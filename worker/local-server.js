// Local API server — same logic as deno-deploy.js, wrapped in Deno.serve
// Run: deno run --allow-net --allow-env worker/local-server.js

const DEEPSEEK = "https://api.deepseek.com/v1/chat/completions";

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function ok(data, extra = {}) {
  return new Response(JSON.stringify(data), { headers: { ...cors(), ...extra } });
}

function err(msg, status) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: cors() });
}

// Simple Map-based cache
const memCache = new Map();
function cacheGet(key, ttlMs) {
  const e = memCache.get(key);
  if (e && Date.now() - e.ts < ttlMs) return e.data;
  return null;
}
function cacheSet(key, data) {
  memCache.set(key, { data, ts: Date.now() });
}

// Rate limiting for DeepSeek endpoints
const rl = new Map();
function rateLimit(ip, limit, windowMs) {
  const now = Date.now();
  let e = rl.get(ip);
  if (!e || now - e.reset > windowMs) { rl.set(ip, { count: 1, reset: now + windowMs }); return true; }
  if (e.count >= limit) return false;
  e.count++;
  return true;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of rl) { if (now - v.reset > 120_000) rl.delete(k); } }, 60_000);

const DEEPSEEK_KEY = Deno.env.get("DEEPSEEK_API_KEY") || "";

async function handle(req) {
  const url = new URL(req.url);
  const path = url.pathname;
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });

  try {
    // ── Weather ──
    if (path === "/api/weather") {
      const lat = url.searchParams.get("lat"), lon = url.searchParams.get("lon");
      if (!lat || !lon) return err("missing lat/lon", 400);
      const ck = `w:${lat.slice(0,5)}:${lon.slice(0,5)}`;
      const cached = cacheGet(ck, 600_000);
      if (cached) return ok(cached);
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,relative_humidity_2m&hourly=temperature_2m,weather_code,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=2`);
      const data = await r.json();
      cacheSet(ck, data);
      return ok(data);
    }

    // ── News ──
    if (path === "/api/news") {
      const cached = cacheGet("news", 120_000);
      if (cached) return ok(cached);
      const sources = [
        { url: "https://api.vvhan.com/api/hotlist/news", parse: d => (d.data || []).map(i => ({ title: i.title, source: i.source || "综合" })) },
        { url: "https://api.oioweb.cn/api/top/hot", parse: d => (d.result || []).map(i => ({ title: i.title || i.name, source: i.desc || "热榜" })) },
      ];
      const results = await Promise.all(sources.map(async s => {
        try { const r = await fetch(s.url, { signal: AbortSignal.timeout(4000) }); return r.ok ? (s.parse(await r.json()) || []) : []; } catch (_) { return []; }
      }));
      const seen = new Set(), merged = [];
      for (const items of results) for (const item of items) { const k = item.title.slice(0, 10); if (!seen.has(k)) { seen.add(k); merged.push(item); } }
      const data = merged.slice(0, 20);
      cacheSet("news", data);
      return ok(data);
    }

    // ── Geocode ──
    if (path === "/api/geocode") {
      const lat = url.searchParams.get("lat"), lon = url.searchParams.get("lon");
      if (!lat || !lon) return err("missing lat/lon", 400);
      const ck = `g:${lat.slice(0,5)}:${lon.slice(0,5)}`;
      const cached = cacheGet(ck, 3_600_000);
      if (cached) return ok(cached);
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=zh&zoom=12`, { headers: { "User-Agent": "ai-nav/1.0" } });
      const d = await r.json(), addr = d.address || {};
      const data = { city: addr.city || addr.town || addr.county || addr.state || addr.country || "未知位置" };
      cacheSet(ck, data);
      return ok(data);
    }

    // ── Papers (arXiv) ──
    if (path === "/api/papers") {
      const q = url.searchParams.get("q");
      if (!q) return err("missing q", 400);
      const ck = `p:${q}`;
      const cached = cacheGet(ck, 1_800_000);
      if (cached) return ok(cached);
      const arxivUrl = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}&start=0&max_results=10&sortBy=submittedDate&sortOrder=descending`;
      const r = await fetch(arxivUrl);
      const xml = await r.text();
      const papers = [];
      const re = /<entry>([\s\S]*?)<\/entry>/g;
      let m;
      while ((m = re.exec(xml)) !== null) {
        const e = m[1];
        const id = (e.match(/<id>([^<]+)<\/id>/) || [])[1] || "";
        papers.push({
          id: id.replace("http://arxiv.org/abs/", ""),
          title: ((e.match(/<title>([^<]+)<\/title>/) || [])[1] || "").replace(/\s+/g, " ").trim(),
          summary: ((e.match(/<summary>([^<]+)<\/summary>/) || [])[1] || "").replace(/\s+/g, " ").trim(),
          authors: [...e.matchAll(/<name>([^<]+)<\/name>/g)].map(a => a[1]),
          published: (e.match(/<published>([^<]+)<\/published>/) || [])[1] || "",
          link: id,
        });
      }
      cacheSet(ck, papers);
      return ok(papers);
    }

    // ── AI Summary (DeepSeek) ──
    if (path === "/api/summary") {
      if (req.method !== "POST") return err("POST required", 405);
      const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
      if (!rateLimit(ip, 10, 60_000)) return err("请求太频繁，请等一分钟再试", 429);

      const body = await req.json().catch(() => null);
      if (!body || !body.text) return err("missing text", 400);
      const system = body.system || "你是一个专业的科技内容总结助手。用中文回复，简洁准确。";
      const prompt = body.prompt || "请总结以下内容，提取核心要点，用3-5个要点的形式呈现：";

      const r = await fetch(DEEPSEEK, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DEEPSEEK_KEY}` },
        body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "system", content: system }, { role: "user", content: `${prompt}\n\n${body.text}` }], temperature: 0.3, max_tokens: 2000 }),
      });
      if (!r.ok) return err("AI 总结服务暂不可用", 502);
      const data = await r.json();
      return ok({ summary: data.choices?.[0]?.message?.content || "", usage: data.usage });
    }

    // ── Papers + AI Summary ──
    if (path === "/api/papers-summary") {
      const q = url.searchParams.get("q");
      if (!q) return err("missing q", 400);
      const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
      if (!rateLimit(ip, 5, 60_000)) return err("请求太频繁，请等一分钟再试", 429);

      const arxivUrl = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}&start=0&max_results=5&sortBy=submittedDate&sortOrder=descending`;
      const r = await fetch(arxivUrl);
      const xml = await r.text();
      const papers = [];
      const re = /<entry>([\s\S]*?)<\/entry>/g;
      let m;
      while ((m = re.exec(xml)) !== null) {
        const e = m[1];
        const id = (e.match(/<id>([^<]+)<\/id>/) || [])[1] || "";
        papers.push({
          id: id.replace("http://arxiv.org/abs/", ""),
          title: ((e.match(/<title>([^<]+)<\/title>/) || [])[1] || "").replace(/\s+/g, " ").trim(),
          summary: ((e.match(/<summary>([^<]+)<\/summary>/) || [])[1] || "").replace(/\s+/g, " ").trim(),
          authors: [...e.matchAll(/<name>([^<]+)<\/name>/g)].map(a => a[1]),
          published: (e.match(/<published>([^<]+)<\/published>/) || [])[1] || "",
        });
      }
      const text = papers.map((p, i) => `[${i + 1}] ${p.title}\n${p.summary.slice(0, 400)}`).join("\n\n");
      const aiResp = await fetch(DEEPSEEK, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DEEPSEEK_KEY}` },
        body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "system", content: "你是前沿科技论文解读专家。用中文总结最新论文，突出每篇论文的创新点和应用场景。" }, { role: "user", content: `以下是关于 "${q}" 的最新 arXiv 论文摘要。请：1) 用2-3句话总的概括这个方向的前沿趋势 2) 逐篇介绍论文的核心创新点和实用价值\n\n${text}` }], temperature: 0.4, max_tokens: 3000 }),
      });
      if (!aiResp.ok) return ok({ papers, summary: "AI 总结生成失败" });
      const aiData = await aiResp.json();
      return ok({ papers, summary: aiData.choices?.[0]?.message?.content || "" });
    }

    // ── News AI Summary (cached, refreshed every 15 min) ──
	    if (path === "/api/news-summary") {
	      const cached = cacheGet("news-summary", 900_000);
	      if (cached) return ok(cached);
	      return ok({ summary: "新闻简报生成中，请稍后再试...", updated: new Date().toISOString() });
	    }

	    return ok({ routes: ["/api/weather", "/api/news", "/api/geocode", "/api/papers", "/api/summary", "/api/papers-summary", "/api/news-summary"] });
  } catch (e) {
    return err("internal error", 500);
  }
}


// ── Background: refresh news AI summary every 15 minutes ──
async function refreshNewsSummary() {
  try {
    console.log("[news-summary] fetching news...");
    const sources = [
      { url: "https://api.vvhan.com/api/hotlist/news", parse: d => (d.data || []).map(i => ({ title: i.title, source: i.source || "综合" })) },
      { url: "https://api.oioweb.cn/api/top/hot", parse: d => (d.result || []).map(i => ({ title: i.title || i.name, source: i.desc || "热榜" })) },
    ];
    const results = await Promise.all(sources.map(async s => {
      try { const r = await fetch(s.url, { signal: AbortSignal.timeout(5000) }); return r.ok ? (s.parse(await r.json()) || []) : []; } catch (_) { return []; }
    }));
    const seen = new Set(), merged = [];
    for (const items of results) for (const item of items) { const k = item.title.slice(0, 10); if (!seen.has(k)) { seen.add(k); merged.push(item); } }
    const topNews = merged.slice(0, 15);

    // Fallback: HackerNews (works internationally via VPN)
	    if (topNews.length === 0) {
	      console.log("[news-summary] Chinese sources empty, trying HackerNews...");
	      try {
	        const idsResp = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json", { signal: AbortSignal.timeout(5000) });
	        if (idsResp.ok) {
	          const ids = await idsResp.json();
	          const topIds = ids.slice(0, 15);
	          const stories = await Promise.all(topIds.map(async id => {
	            try { const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { signal: AbortSignal.timeout(3000) }); return r.ok ? await r.json() : null; } catch (_) { return null; }
	          }));
	          for (const s of stories) {
	            if (s && s.title) topNews.push({ title: s.title, source: "HackerNews" });
	          }
	          console.log(`[news-summary] HN fallback: got ${topNews.length} stories`);
	        }
	      } catch (_) { console.log("[news-summary] HN fallback also failed"); }
	    }

	    if (topNews.length === 0) { console.log("[news-summary] no news fetched"); return; }

    const titles = topNews.map((n, i) => `${i + 1}. [${n.source}] ${n.title}`).join("\n");
    console.log(`[news-summary] got ${topNews.length} items, sending to DeepSeek...`);

    const r = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DEEPSEEK_KEY}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{
          role: "system",
          content: "你是一个专业的中文新闻简报编辑。用户会给你当前热门新闻标题列表，请用3-5句话概括当前的主要新闻热点话题，然后列出5-7条最重要的新闻做一句话摘要。风格简洁有力，适合快速阅读。纯文本输出，不要markdown格式。控制在300字以内。"
        }, {
          role: "user",
          content: `以下是当前热门新闻标题，请生成新闻简报：\n\n${titles}`
        }],
        temperature: 0.4, max_tokens: 600
      }),
    });

    if (!r.ok) { console.log(`[news-summary] DeepSeek error: ${r.status}`); return; }
    const data = await r.json();
    const summary = data.choices?.[0]?.message?.content || "";
    if (!summary) { console.log("[news-summary] empty response"); return; }

    cacheSet("news-summary", { summary, updated: new Date().toISOString(), newsCount: topNews.length });
    console.log(`[news-summary] updated (${summary.length} chars, ${topNews.length} news)`);
  } catch (e) {
    console.log(`[news-summary] error: ${e.message}`);
  }
}

// Run immediately, then every 15 minutes
refreshNewsSummary();
setInterval(refreshNewsSummary, 900_000);

const PORT = parseInt(Deno.env.get("PORT") || "8765");
console.log(`AI Nav API server running on http://localhost:${PORT}`);
Deno.serve({ port: PORT }, handle);
