// Local API server — same logic as deno-deploy.js, wrapped in Deno.serve
// Run: deno run --allow-net --allow-env --allow-read --allow-write worker/local-server.js

const DEEPSEEK = "https://api.deepseek.com/v1/chat/completions";
const USAGE_FILE = "./usage-log.json";
const PRICING = { prompt: 0.27 / 1_000_000, completion: 1.10 / 1_000_000 }; // DeepSeek V3 pricing per token

// ── Usage tracking ──
async function loadUsage() { try { return JSON.parse(await Deno.readTextFile(USAGE_FILE)); } catch (_) { return []; } }
async function saveUsage(entries) { await Deno.writeTextFile(USAGE_FILE, JSON.stringify(entries, null, 2)); }

async function trackUsage(endpoint, usage, model) {
  const entry = {
    ts: new Date().toISOString(),
    endpoint,
    model: model || "deepseek-chat",
    prompt_tokens: usage.prompt_tokens || 0,
    completion_tokens: usage.completion_tokens || 0,
    total_tokens: usage.total_tokens || 0,
  };
  entry.cost = entry.prompt_tokens * PRICING.prompt + entry.completion_tokens * PRICING.completion;
  const entries = await loadUsage();
  entries.push(entry);
  // Keep last 90 days
  const cutoff = Date.now() - 90 * 86400000;
  const trimmed = entries.filter(e => new Date(e.ts).getTime() > cutoff);
  await saveUsage(trimmed);
  console.log(`[usage] ${entry.endpoint}: ${entry.total_tokens} tokens, $${entry.cost.toFixed(6)}`);
}

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
    // ── Static pages ──
    const staticFiles = {"/clock-old.html":"./clock-old.html","/clock-old":"./clock-old.html","/clock-proj.html":"./clock-proj.html","/usage.html":"./usage.html"};
    if (staticFiles[path]) {
      try {
        const html = await Deno.readTextFile(staticFiles[path]);
        return new Response(html, { headers: { ...cors(), "Content-Type": "text/html; charset=utf-8" } });
      } catch (_) { return err("page not found", 404); }
    }

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
        { url: "https://feeds.npr.org/1001/rss.xml", type: "xml", parse: r => { const items = [...r.matchAll(/<item>([\s\S]*?)<\/item>/g)]; return items.slice(0, 20).map(m => { const t = (m[1].match(/<title>([^<]+)<\/title>/) || [])[1] || ""; return { title: t.replace(/&#39;/g,"'").replace(/&apos;/g,"'").replace(/&amp;/g,"&").replace(/&quot;/g,'"'), source: "NPR" }; }); } },
        { url: "https://api.vvhan.com/api/hotlist/news", parse: d => (d.data || []).map(i => ({ title: i.title, source: i.source || "综合" })) },
        { url: "https://api.oioweb.cn/api/top/hot", parse: d => (d.result || []).map(i => ({ title: i.title || i.name, source: i.desc || "热榜" })) },
      ];
      const results = await Promise.all(sources.map(async s => {
        try { const r = await fetch(s.url, { signal: AbortSignal.timeout(4000) }); if (!r.ok) return []; const raw = s.type === "xml" ? await r.text() : await r.json(); return s.parse(raw) || []; } catch (_) { return []; }
      }));
      const seen = new Set(), merged = [];
      for (const items of results) for (const item of items) { const k = item.title.slice(0, 10); if (!seen.has(k)) { seen.add(k); merged.push(item); } }
      // HN fallback when Chinese sources unreachable
      if (merged.length === 0) {
        try {
          const idsResp = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json", { signal: AbortSignal.timeout(8000) });
          if (idsResp.ok) {
            const ids = await idsResp.json();
            const stories = await Promise.all(ids.slice(0, 20).map(async id => {
              try { const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { signal: AbortSignal.timeout(3000) }); return r.ok ? await r.json() : null; } catch (_) { return null; }
            }));
            for (const s of stories) {
              if (s && s.title) merged.push({ title: s.title, source: "HackerNews" });
            }
          }
        } catch (_) {}
      }
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
      if (data.usage) trackUsage("/api/summary", data.usage, "deepseek-chat");
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
      if (aiData.usage) trackUsage("/api/papers-summary", aiData.usage, "deepseek-chat");
      return ok({ papers, summary: aiData.choices?.[0]?.message?.content || "" });
    }

    // ── Usage stats ──
    if (path === "/api/usage") {
      const entries = await loadUsage();
      const total = entries.reduce((s, e) => ({ prompt: s.prompt + e.prompt_tokens, completion: s.completion + e.completion_tokens, tokens: s.tokens + e.total_tokens, cost: s.cost + (e.cost || 0) }), { prompt: 0, completion: 0, tokens: 0, cost: 0 });
      // Group by day
      const byDay = {};
      for (const e of entries) {
        const day = e.ts.slice(0, 10);
        if (!byDay[day]) byDay[day] = { day, tokens: 0, cost: 0, calls: 0 };
        byDay[day].tokens += e.total_tokens;
        byDay[day].cost += e.cost || 0;
        byDay[day].calls++;
      }
      const days = Object.values(byDay).sort((a, b) => b.day.localeCompare(a.day));

      // Estimate conversation tokens from transcript
      let convTokens = 0, convChars = 0;
      try {
        const home = Deno.env.get("HOME") || "/Users/lasky_my";
        const dir = home + "/.claude/projects/-Users-lasky-my/";
        for await (const f of Deno.readDir(dir)) {
          if (!f.name.endsWith(".jsonl")) continue;
          const text = await Deno.readTextFile(dir + f.name);
          convChars += text.length;
        }
        convTokens = Math.round(convChars / 2);
      } catch (_) {}
      const convCost = convTokens * (0.27 + 1.10) / 2 / 1_000_000;

      return ok({ total, days, entries: entries.slice(-50), conversation: { chars: convChars, tokens: convTokens, cost: convCost } });
    }

    // ── News CN (AI translated + prioritized, cached 10min) ──
    if (path === "/api/news-cn") {
      const cached = cacheGet("news-cn", 0); // always use cache if exists
      if (cached) {
        // Background refresh if older than 5 min
        if (Date.now() - (cached._ts || 0) > 300000) {
          refreshNewsCN();
        }
        return ok(cached);
      }
      // No cache yet — fetch synchronously first time
      // Fetch raw news
      const resp = await fetch("https://feeds.npr.org/1001/rss.xml", { signal: AbortSignal.timeout(8000) });
      if (!resp.ok) return ok([]);
      const xml = await resp.text();
      const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 8).map(m => {
        const t = (m[1].match(/<title>([^<]+)<\/title>/) || [])[1] || "";
        return { title: t.replace(/&#39;/g,"'").replace(/&apos;/g,"'").replace(/&amp;/g,"&").replace(/&quot;/g,'"'), source: "NPR" };
      });
      if (!items.length) return ok([]);
      // Ask DeepSeek to translate + prioritize
      const titles = items.map((n,i) => `${i+1}. ${n.title}`).join("\n");
      try {
        const r = await fetch(DEEPSEEK, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DEEPSEEK_KEY}` },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [{
              role: "system",
              content: `你是中文新闻编辑。将每条英文新闻翻译成简洁中文(20字内)，提取关键数字/指标，分配优先级(critical/high/normal/low)。输出纯JSON对象，格式：{"outline":{"title":"今日要闻总览","summary":"2-3句话总结今日全球最重要趋势(30字内)","metric":"覆盖N条新闻","keywords":"关键词1,关键词2"},"items":[{"level":"high","title":"中文标题(20字内)","summary":"一句话要点","metric":"关键数字","source":"NPR","keywords":"术语1,术语2"}]} 生成20条items覆盖所有新闻要点。keywords:负面/危机事件前加!，经济数据前加*。每个标题和摘要必须不同且涵盖独特信息点。`
            }, {
              role: "user",
              content: `翻译并分析以下新闻：\n${titles}`
            }],
            temperature: 0.2, max_tokens: 2500
          })
        });
        if (r.ok) {
          const data = await r.json();
          const text = data.choices?.[0]?.message?.content || "";
          // Extract JSON array from response
          const jsonMatch = text.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const arr = JSON.parse(jsonMatch[0]);
            const result = arr.map((item, i) => ({ ...item, id: i, time: new Date().toISOString() }));
            result._ts = Date.now();
            cacheSet("news-cn", result);
            try { await Deno.writeTextFile("./news-cn-cache.json", JSON.stringify(result)); } catch(_) {}
            if (data.usage) trackUsage("news-cn", data.usage, "deepseek-chat");
            return ok(result);
          }
        }
      } catch (e) { console.log("[news-cn] DeepSeek error:", e.message); }
      // Fallback: raw titles
      const fallback = { outline: { title: "今日要闻", summary: "正在加载AI摘要...", metric: items.length+"条", keywords: "" }, items: items.map((item, i) => ({ level: "normal", title: item.title, summary: "", metric: "", source: item.source, id: i, time: new Date().toISOString() })) };
      fallback._ts = Date.now(); cacheSet("news-cn", fallback);
      return ok(fallback);
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
async function refreshNewsCN() {
  try {
    const resp = await fetch("https://feeds.npr.org/1001/rss.xml", { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return;
    const xml = await resp.text();
    const items = [...xml.matchAll(/<item>([\\s\\S]*?)<\\/item>/g)].slice(0, 20).map(m => {
      const t = (m[1].match(/<title>([^<]+)<\\/title>/) || [])[1] || "";
      return { title: t.replace(/&#39;/g,"'").replace(/&apos;/g,"'").replace(/&amp;/g,"&").replace(/&quot;/g,'"'), source: "NPR" };
    });
    if (!items.length) return;
    const titles = items.map((n,i) => `${i+1}. ${n.title}`).join("\\n");
    const r = await fetch(DEEPSEEK, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DEEPSEEK_KEY}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "system", content: "你是中文新闻编辑。将每条英文新闻翻译成简洁中文(20字内)，提取关键数字/指标，分配优先级(critical/high/normal/low)。输出纯JSON数组：[{\"level\":\"high\",\"title\":\"中文标题\",\"summary\":\"一句话要点\",\"metric\":\"关键数字\",\"source\":\"NPR\",\"keywords\":\"术语1,术语2\"}] keywords:负面前加!，经济数据前加*。" }, { role: "user", content: `翻译并分析以下新闻：\\n${titles}` }],
        temperature: 0.2, max_tokens: 2500
      })
    });
    if (!r.ok) return;
    const data = await r.json();
    const text = data.choices?.[0]?.message?.content || "";
    const jsonMatch = text.match(/\\[[\\s\\S]*\\]/);
    if (jsonMatch) {
      const arr = JSON.parse(jsonMatch[0]);
      const result = arr.map((item, i) => ({ ...item, id: i, time: new Date().toISOString() }));
      result._ts = Date.now();
      cacheSet("news-cn", result);
      try { await Deno.writeTextFile("./news-cn-cache.json", JSON.stringify(result)); } catch(_) {}
      if (data.usage) trackUsage("news-cn", data.usage, "deepseek-chat");
      console.log(`[news-cn] updated: ${result.length} items`);
    }
  } catch(e) { console.log("[news-cn] bg error:", e.message); }
}

async function refreshNewsSummary() {
  try {
    console.log("[news-summary] fetching news...");
    const sources = [
      { url: "https://feeds.npr.org/1001/rss.xml", type: "xml", parse: r => { const items = [...r.matchAll(/<item>([\s\S]*?)<\/item>/g)]; return items.slice(0, 20).map(m => { const t = (m[1].match(/<title>([^<]+)<\/title>/) || [])[1] || ""; return { title: t.replace(/&#39;/g,"'").replace(/&apos;/g,"'").replace(/&amp;/g,"&").replace(/&quot;/g,'"'), source: "NPR" }; }); } },
      { url: "https://api.vvhan.com/api/hotlist/news", parse: d => (d.data || []).map(i => ({ title: i.title, source: i.source || "综合" })) },
      { url: "https://api.oioweb.cn/api/top/hot", parse: d => (d.result || []).map(i => ({ title: i.title || i.name, source: i.desc || "热榜" })) },
    ];
    const results = await Promise.all(sources.map(async s => {
      try { const r = await fetch(s.url, { signal: AbortSignal.timeout(8000) }); if (!r.ok) return []; const raw = s.type === "xml" ? await r.text() : await r.json(); return s.parse(raw) || []; } catch (_) { return []; }
    }));
    const seen = new Set(), merged = [];
    for (const items of results) for (const item of items) { const k = item.title.slice(0, 10); if (!seen.has(k)) { seen.add(k); merged.push(item); } }
    const topNews = merged.slice(0, 15);

    // Fallback: HackerNews (works internationally via VPN)
	    if (topNews.length === 0) {
	      console.log("[news-summary] Chinese sources empty, trying HackerNews...");
	      try {
	        const idsResp = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json", { signal: AbortSignal.timeout(8000) });
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
          content: `你是一个专业的中文新闻简报编辑。用户会给你当前热门新闻标题列表，请生成一份结构清晰的新闻简报。

输出格式要求（使用markdown）：
## 今日热点聚焦
用2-3句话概括当前最重要的趋势

## 要闻速览
| 序号 | 新闻 | 要点 |
|------|------|------|
| 1 | 新闻标题 | 一句话要点 |

## 深度关注 🔍
选2-3条最重要的新闻，用加粗小标题分段，每段2-3句话分析

## 一句话总结
用一句话概括今天最值得关注的事

注意：
- 表格至少5行
- 每个栏目标题用 ## 开头
- 适当使用emoji增加可读性
- 总体控制在500字以内`
        }, {
          role: "user",
          content: `以下是当前热门新闻标题，请生成新闻简报：\n\n${titles}`
        }],
        temperature: 0.4, max_tokens: 800
      }),
    });

    if (!r.ok) { console.log(`[news-summary] DeepSeek error: ${r.status}`); return; }
    const data = await r.json();
    const summary = data.choices?.[0]?.message?.content || "";
    if (!summary) { console.log("[news-summary] empty response"); return; }
    if (data.usage) trackUsage("news-summary", data.usage, "deepseek-chat");

    const result = { summary, updated: new Date().toISOString(), newsCount: topNews.length };
    cacheSet("news-summary", result);
    // Persist to disk
    try { await Deno.writeTextFile("./news-cache.json", JSON.stringify(result)); } catch(_) {}
    console.log(`[news-summary] updated (${summary.length} chars, ${topNews.length} news)`);
  } catch (e) {
    console.log(`[news-summary] error: ${e.message}`);
  }
}

// Run immediately, then every 15 minutes
// Load persistent caches on startup
try { const cn = JSON.parse(await Deno.readTextFile("./news-cn-cache.json")); if (cn && cn.length) { cn._ts = Date.now(); cacheSet("news-cn", cn); console.log("[init] loaded news-cn cache:", cn.length, "items"); } } catch(_) {}
try { const ns = JSON.parse(await Deno.readTextFile("./news-cache.json")); if (ns && ns.summary) { cacheSet("news-summary", ns); console.log("[init] loaded news-summary cache"); } } catch(_) {}
refreshNewsSummary();
setInterval(refreshNewsSummary, 900_000);
setInterval(refreshNewsCN, 300000);

const PORT = parseInt(Deno.env.get("PORT") || "8765");
console.log(`AI Nav API server running on http://localhost:${PORT}`);
Deno.serve({ port: PORT }, handle);
