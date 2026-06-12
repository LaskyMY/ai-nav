// Local API server — PostgreSQL backend
// Run: deno run --allow-net --allow-env --allow-read --allow-write worker/local-server.js

const DEEPSEEK = "https://api.deepseek.com/v1/chat/completions";
const USAGE_FILE = "/Users/lasky_my/ai-nav/usage-log.json";
const PRICING = { prompt: 0.27 / 1_000_000, completion: 1.10 / 1_000_000 }; // DeepSeek V3 pricing per token

// ── PostgreSQL Database ──
import { initDB, insertNews, getNews, getNewsCount, searchNews, getLatestSummary, getSummaries,
         saveSummary, saveWeather, getWeather, logUsage as dbLogUsage, getUsageStats as dbUsageStats,
         getPageStats, trackPage, getDBStats, queryForAI,
         ingestFinancialBrief as dbIngestFinancial, getFinancialBriefs as dbGetFinancialBriefs,
         getLatestFinancialBriefs as dbGetLatestFinancial, cleanupOldFinancialBriefs as dbCleanupFinancial,
         searchPageContent as dbSearchPages, getPageMetas as dbGetPageMetas,
         updateAutomationStatus as dbUpdateAuto, getAutomationStatus as dbGetAuto } from "./db.js";
let dbReady = false;

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
  // Also log to SQLite
  if (dbReady) {
    try {
      dbLogUsage(entry.endpoint, entry.model, entry.prompt_tokens, entry.completion_tokens, entry.cost);
    } catch(_) {}
  }
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

const DEEPSEEK_KEY = Deno.env.get("DEEPSEEK_API_KEY") || "sk-9b5d4743d7a1405a95d7de478f29dcdc";

async function handle(req) {
  const url = new URL(req.url);
  const path = url.pathname;
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });

  try {
    // ── Static pages (serve all files from BASE) ──
    const BASE = "/Users/lasky_my/ai-nav";
    if (path.endsWith(".html") || path.endsWith(".json") || path.endsWith(".js") || path.endsWith(".svg") || path.endsWith(".ico") || path.endsWith(".css")) {
      const safePath = path.replace(/\.\./g, "").replace(/\/\//g, "/");
      try {
        const content = await Deno.readTextFile(BASE + safePath);
        const ct = path.endsWith(".json") ? "application/json" : path.endsWith(".js") ? "application/javascript" : path.endsWith(".svg") ? "image/svg+xml" : path.endsWith(".css") ? "text/css" : "text/html; charset=utf-8";
        return new Response(content, { headers: { ...cors(), "Content-Type": ct } });
      } catch (_) { return err("page not found", 404); }
    }

    // ── Weather ──
    if (path === "/api/weather") {
      const lat = url.searchParams.get("lat"), lon = url.searchParams.get("lon");
      if (!lat || !lon) return err("missing lat/lon", 400);
      const ck = `w:${lat.slice(0,5)}:${lon.slice(0,5)}`;
      const cached = cacheGet(ck, 600_000);
      if (cached) return ok(cached);
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,weather_code,precipitation_probability,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=2`);
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
      const cached = cacheGet("news-cn", 3600000);
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
            let result = arr.map((item, i) => ({ ...item, id: i, time: new Date().toISOString() }));
            result._ts = Date.now();
            // Accumulate: merge with existing, keep last 100 unique
            try {
              const old = JSON.parse(await Deno.readTextFile("/Users/lasky_my/ai-nav/news-cn-cache.json"));
              const seen = new Set(old.map(e => e.title));
              const fresh = result.filter(e => !seen.has(e.title));
              result = [...fresh, ...old].slice(0, 100);
            } catch(_) {}
            cacheSet("news-cn", result);
            try { await Deno.writeTextFile("/Users/lasky_my/ai-nav/news-cn-cache.json", JSON.stringify(result)); } catch(_) {}
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

	    // ── DB: Database stats ──
	    if (path === "/api/db/stats") {
	      if (!dbReady) return err("database not ready", 503);
	      return ok(await getDBStats());
	    }

	    if (path === "/api/db/news") {
	      if (!dbReady) return err("database not ready", 503);
	      const limit = parseInt(url.searchParams.get("limit") || "50");
	      const offset = parseInt(url.searchParams.get("offset") || "0");
	      return ok(await getNews(limit, offset));
	    }

	    if (path === "/api/db/search") {
	      if (!dbReady) return err("database not ready", 503);
	      const q = url.searchParams.get("q");
	      if (!q) return err("missing q", 400);
	      return ok(await searchNews(q));
	    }

	    if (path === "/api/db/summaries") {
	      if (!dbReady) return err("database not ready", 503);
	      const type = url.searchParams.get("type") || "news-summary";
	      return ok(await getSummaries(type));
	    }

	    if (path === "/api/db/pages") {
	      if (!dbReady) return err("database not ready", 503);
	      return ok(await getPageStats());
	    }

	    if (path === "/api/db/ai") {
	      if (!dbReady) return err("database not ready", 503);
	      const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
	      if (!rateLimit(ip, 5, 60_000)) return err("请求太频繁", 429);
	      const question = url.searchParams.get("q") || "摘要数据库当前状态";
	      const stats = await getDBStats();
	      const recentNews = await getNews(5);
	      const context = JSON.stringify({ stats, recentNews });
	      const r = await fetch(DEEPSEEK, {
	        method: "POST",
	        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DEEPSEEK_KEY}` },
	        body: JSON.stringify({
	          model: "deepseek-chat",
	          messages: [
	            { role: "system", content: "你是AI Nav网站的数据分析师。根据数据库内容回答用户问题。用中文，简洁准确。" },
	            { role: "user", content: `数据库上下文：${context}\n\n用户问题：${question}` }
	          ],
	          temperature: 0.3, max_tokens: 1000
	        })
	      });
	      if (!r.ok) return err("AI 服务暂不可用", 502);
	      const data = await r.json();
	      if (data.usage) trackUsage("/api/db/ai", data.usage, "deepseek-chat");
	      return ok({ answer: data.choices?.[0]?.message?.content || "", question });
	    }

	    
// ── DB Query Helper ──
async function dbQuery(sql, params = []) {
  const { Client } = await import("https://deno.land/x/postgres@v0.19.0/mod.ts");
  const pg = new Client({ hostname:"127.0.0.1", port:5432, user:"lasky_my", database:"ai_nav" });
  await pg.connect();
  try { const r = await pg.queryObject(sql, params); return r.rows; }
  finally { await pg.end(); }
}

// ── Financial Briefs ──
	    if (path === "/api/financial/briefs") {
	      if (!dbReady) return err("database not ready", 503);
	      const days = parseInt(url.searchParams.get("days") || "10");
	      return ok(await dbGetFinancialBriefs(days));
	    }
	    if (path === "/api/financial/latest") {
	      if (!dbReady) return err("database not ready", 503);
	      return ok(await dbGetLatestFinancial());
	    }
	    if (path === "/api/financial/ingest" && req.method === "POST") {
	      if (!dbReady) return err("database not ready", 503);
	      const body = await req.json().catch(() => null);
	      if (!body || !body.content) return err("missing content", 400);
	      const date = body.date || new Date().toISOString().slice(0, 10);
	      const type = body.type || "morning";
	      await dbIngestFinancial(date, type, body.title || `金融${type==='morning'?'早间':'晚间'}简报`, body.content, body.source_url);
	      return ok({ status: "ok", date, type });
	    }

	    
    
    // ── Site Data API ──
    if (path === "/api/site/config") {
      if (!dbReady) return err("db not ready", 503);
      const r = await dbQuery("SELECT key, value FROM site_config");
      const cfg = {}; r.forEach(row => { cfg[row.key] = row.value; });
      return ok(cfg);
    }
    if (path === "/api/site/pages") {
      if (!dbReady) return err("db not ready", 503);
      return ok(await dbQuery("SELECT * FROM page_meta WHERE is_active = true ORDER BY nav_order"));
    }
    if (path === "/api/site/nav") {
      if (!dbReady) return err("db not ready", 503);
      return ok(await dbQuery("SELECT * FROM nav_items WHERE is_visible = true ORDER BY sort_order"));
    }
    if (path === "/api/site/changelog") {
      if (!dbReady) return err("db not ready", 503);
      return ok(await dbQuery("SELECT * FROM changelog ORDER BY entry_date DESC LIMIT 20"));
    }
    if (path === "/api/site/manual") {
      if (!dbReady) return err("db not ready", 503);
      return ok(await dbQuery("SELECT slug, title, category, description FROM manual_content ORDER BY category"));
    }

    
    // ── DB-driven Sitemap ──
    if (path === "/api/site/sitemap-db") {
      if (!dbReady) return err("db not ready", 503);
      const pages = await dbQuery("SELECT path, title, category, nav_order FROM page_meta WHERE is_active = true ORDER BY nav_order");
      const categories = {};
      for (const p of pages) {
        const cat = p.category || "other";
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(p);
      }
      return ok({ pages, categories, total: pages.length, updated: new Date().toISOString() });
    }

    // ── Git log sync to changelog ──
    if (path === "/api/site/git-log") {
      try {
        const cmd = new Deno.Command("git", { args: ["-C", "/Users/lasky_my/ai-nav", "log", "--oneline", "-20", "--format=%h|%s|%ai"], stdout: "piped" });
        const out = await cmd.output();
        const text = new TextDecoder().decode(out.stdout);
        const entries = text.trim().split("\n").filter(l => l).map(line => {
          const [hash, msg, date] = line.split("|");
          return { hash, message: msg, date: date?.replace(/\s+\+\d+$/, "") };
        });
        return ok({ entries, total: entries.length });
      } catch(e) {
        return ok({ entries: [], error: e.message });
      }
    }

    
    // ── Automation Status ──
    if (path === "/api/auto/status") {
      if (!dbReady) return err("db not ready", 503);
      const rows = await dbGetAuto();
      return ok(rows);
    }
    if (path === "/api/auto/update" && req.method === "POST") {
      if (!dbReady) return err("db not ready", 503);
      try {
        const body = await req.json();
        await dbUpdateAuto(body.name, body.status, body.summary || null, body.error || null);
        return ok({ ok: true });
      } catch(e) { console.log("[auto] update error:", e.message); return err(e.message, 400); }
    }


    // ── Data Engine APIs ──
    if (path === "/api/trending/github") {
      const cached = cacheGet("trending-github", 1800000);
      if (cached) return ok(cached);
      try {
        const r = await fetch("https://api.github.com/search/repositories?q=stars:>100+pushed:>"+new Date(Date.now()-7*86400000).toISOString().slice(0,10)+"&sort=stars&order=desc&per_page=10", {headers:{"User-Agent":"ai-nav/1.0"},signal:AbortSignal.timeout(8000)});
        const d = await r.json();
        const items = (d.items||[]).map(i=>({name:i.full_name,stars:i.stargazers_count,desc:i.description,url:i.html_url,lang:i.language}));
        cacheSet("trending-github", {items});
        return ok({items});
      } catch(e) { return err(e.message,500); }
    }
    if (path === "/api/trending/hn") {
      const cached = cacheGet("trending-hn", 600000);
      if (cached) return ok(cached);
      try {
        const ids = await (await fetch("https://hacker-news.firebaseio.com/v0/topstories.json",{signal:AbortSignal.timeout(5000)})).json();
        const items = await Promise.all(ids.slice(0,8).map(async id=>{
          const r=await fetch("https://hacker-news.firebaseio.com/v0/item/"+id+".json",{signal:AbortSignal.timeout(3000)});
          const d=await r.json(); return {title:d.title,url:d.url,score:d.score,by:d.by};
        }));
        cacheSet("trending-hn", {items});
        return ok({items});
      } catch(e) { return err(e.message,500); }
    }


    // ── 创业热点聚合 ──
    if (path === "/api/trending/startups") {
      const cached = cacheGet("trending-startups", 3600000);
      if (cached) return ok(cached);
      try {
        const items = [];
        // Get HN top
        try {
          const ids = await (await fetch("https://hacker-news.firebaseio.com/v0/topstories.json",{signal:AbortSignal.timeout(5000)})).json();
          for (const id of ids.slice(0,5)) {
            const d = await (await fetch("https://hacker-news.firebaseio.com/v0/item/"+id+".json",{signal:AbortSignal.timeout(3000)})).json();
            if (d && d.title) items.push({title:d.title,url:d.url||"https://news.ycombinator.com/item?id="+id,source:"HackerNews",score:d.score,type:"startup"});
          }
        } catch(e) {}
        // Get Reddit r/startups
        try {
          const r = await fetch("https://www.reddit.com/r/startups/hot.json?limit=5",{headers:{"User-Agent":"ai-nav/1.0"},signal:AbortSignal.timeout(5000)});
          const d = await r.json();
          for (const c of (d.data?.children||[]).slice(0,5)) {
            const p = c.data;
            items.push({title:p.title,url:"https://reddit.com"+p.permalink,source:"Reddit r/startups",score:p.ups,type:"startup"});
          }
        } catch(e) {}
        cacheSet("trending-startups", {items,updated:new Date().toISOString()});
        return ok({items,updated:new Date().toISOString()});
      } catch(e) { return err(e.message,500); }
    }


    // ── 知乎日报 ──
    if (path === "/api/trending/zhihu") {
      const cached = cacheGet("trending-zhihu", 3600000);
      if (cached) return ok(cached);
      try {
        const r = await fetch("https://news-at.zhihu.com/api/4/news/latest",{headers:{"User-Agent":"Mozilla/5.0"},signal:AbortSignal.timeout(8000)});
        const d = await r.json();
        const items = (d.stories||[]).slice(0,10).map(i=>({title:i.title,url:"https://daily.zhihu.com/story/"+i.id,image:i.images?.[0]||"",source:"知乎日报"}));
        cacheSet("trending-zhihu", {items,updated:new Date().toISOString()});
        return ok({items,updated:new Date().toISOString()});
      } catch(e) { return err(e.message,500); }
    }


    // ── 信息差分析 ──
    if (path === "/api/insight/gap") {
      const cached = cacheGet("insight-gap", 7200000);
      if (cached) return ok(cached);
      try {
        // Collect titles from 3 sources
        const sources = [];
        try {
          const r = await fetch("https://api.github.com/search/repositories?q=stars:>50+pushed:>"+new Date(Date.now()-86400000).toISOString().slice(0,10)+"&sort=stars&order=desc&per_page=5",{headers:{"User-Agent":"ai-nav/1.0"},signal:AbortSignal.timeout(5000)});
          const d = await r.json();
          sources.push({name:"GitHub",titles:(d.items||[]).map(i=>i.full_name)});
        } catch(e) {}
        try {
          const ids = await (await fetch("https://hacker-news.firebaseio.com/v0/topstories.json",{signal:AbortSignal.timeout(5000)})).json();
          const items = await Promise.all(ids.slice(0,5).map(async id=>{const r=await fetch("https://hacker-news.firebaseio.com/v0/item/"+id+".json",{signal:AbortSignal.timeout(3000)});return (await r.json()).title||""}));
          sources.push({name:"HN",titles:items});
        } catch(e) {}
        try {
          const r = await fetch("https://news-at.zhihu.com/api/4/news/latest",{headers:{"User-Agent":"Mozilla/5.0"},signal:AbortSignal.timeout(5000)});
          const d = await r.json();
          sources.push({name:"知乎",titles:(d.stories||[]).map(i=>i.title)});
        } catch(e) {}
        // Find gaps: topics unique to each source
        const gaps = sources.map(s=>({source:s.name,unique:s.titles.slice(0,3),count:s.titles.length}));
        cacheSet("insight-gap", {gaps,updated:new Date().toISOString()});
        return ok({gaps,updated:new Date().toISOString()});
      } catch(e) { return err(e.message,500); }
    }


    // ── V2EX 最新 ──
    if (path === "/api/trending/v2ex2") {
      const cached = cacheGet("trending-v2ex2", 1800000);
      if (cached) return ok(cached);
      try {
        const r = await fetch("https://www.v2ex.com/api/topics/latest.json",{headers:{"User-Agent":"Mozilla/5.0"},signal:AbortSignal.timeout(8000)});
        const d = await r.json();
        const items = d.slice(0,10).map(i=>({title:i.title,url:"https://www.v2ex.com/t/"+i.id,replies:i.replies,node:i.node?.title||"",source:"V2EX"}));
        cacheSet("trending-v2ex2", {items,updated:new Date().toISOString()});
        return ok({items,updated:new Date().toISOString()});
      } catch(e) { return err(e.message,500); }
    }


    // ── Reddit 编程 ──
    if (path === "/api/trending/reddit") {
      const cached = cacheGet("trending-reddit", 3600000);
      if (cached) return ok(cached);
      try {
        const r = await fetch("https://www.reddit.com/r/programming/hot.json?limit=10",{headers:{"User-Agent":"ai-nav/1.0"},signal:AbortSignal.timeout(8000)});
        const d = await r.json();
        const items = (d.data?.children||[]).map(c=>({title:c.data.title,url:"https://reddit.com"+c.data.permalink,score:c.data.score,comments:c.data.num_comments,source:"r/programming"}));
        cacheSet("trending-reddit", {items,updated:new Date().toISOString()});
        return ok({items,updated:new Date().toISOString()});
      } catch(e) { return err(e.message,500); }
    }


    // ── 掘金热门 ──
    if (path === "/api/trending/juejin") {
      const cached = cacheGet("trending-juejin", 3600000);
      if (cached) return ok(cached);
      try {
        const r = await fetch("https://api.juejin.cn/recommend_api/v1/article/recommend_all_feed",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id_type:2,sort_type:200,cursor:"0",limit:10}),signal:AbortSignal.timeout(8000)});
        const d = await r.json();
        const items = (d.data||[]).map(i=>({title:i.item_info?.article_info?.title||"",url:"https://juejin.cn/post/"+i.item_info?.article_id,source:"掘金"}));
        cacheSet("trending-juejin", {items,updated:new Date().toISOString()});
        return ok({items,updated:new Date().toISOString()});
      } catch(e) { return err(e.message,500); }
    }
    // ── HuggingFace 模型趋势 ──
    if (path === "/api/trending/hf") {
      const cached = cacheGet("trending-hf", 7200000);
      if (cached) return ok(cached);
      try {
        const r = await fetch("https://huggingface.co/api/models?sort=downloads&direction=-1&limit=10",{signal:AbortSignal.timeout(8000)});
        const d = await r.json();
        const items = d.map(i=>({title:i.id||i.modelId,url:"https://huggingface.co/"+i.id,downloads:i.downloads||0,likes:i.likes||0,source:"HuggingFace"}));
        cacheSet("trending-hf", {items,updated:new Date().toISOString()});
        return ok({items,updated:new Date().toISOString()});
      } catch(e) { return err(e.message,500); }
    }


    // ── ProductHunt 今日精选 ──
    if (path === "/api/trending/ph") {
      const cached = cacheGet("trending-ph", 7200000);
      if (cached) return ok(cached);
      try {
        const r = await fetch("https://api.producthunt.com/v1/posts?access_token=public",{signal:AbortSignal.timeout(8000)});
        if (!r.ok) throw new Error("PH requires token");
        const d = await r.json();
        const items = (d.posts||[]).slice(0,10).map(i=>({title:i.name,tagline:i.tagline,url:i.discussion_url,votes:i.votes_count,source:"ProductHunt"}));
        cacheSet("trending-ph", {items,updated:new Date().toISOString()});
        return ok({items,updated:new Date().toISOString()});
      } catch(e) {
        // Fallback: use RSS
        try {
          const r = await fetch("https://www.producthunt.com/feed",{headers:{"User-Agent":"Mozilla/5.0"},signal:AbortSignal.timeout(5000)});
          const items = [{title:"ProductHunt RSS feed loaded",url:"https://www.producthunt.com",source:"ProductHunt"}];
          cacheSet("trending-ph", {items,updated:new Date().toISOString()});
          return ok({items,updated:new Date().toISOString()});
        } catch(e2) { return err("PH unavailable", 500); }
      }
    }
    // ── API监控面板 ──
    if (path === "/api/monitor") {
      const stats = {endpoints:{}, uptime:process.uptime?.()||0};
      const apis_to_check = ["/api/trending/github","/api/news-summary","/api/financial/latest","/api/db/stats"];
      for (const ep of apis_to_check) {
        const t0 = Date.now();
        try { const r = await fetch("http://localhost:8765"+ep,{signal:AbortSignal.timeout(3000)}); stats.endpoints[ep] = {ok:r.ok,latency:Date.now()-t0}; }
        catch(e) { stats.endpoints[ep] = {ok:false,error:e.message}; }
      }
      return ok(stats);
    }


    // ── 内容质量评分 ──
    if (path === "/api/quality/score") {
      const title = url.searchParams.get("title") || "";
      const text = url.searchParams.get("text") || "";
      const score = Math.min(100, 
        (title.length > 10 ? 30 : 10) + 
        (text.length > 50 ? 30 : 5) + 
        (title.includes("AI")||title.includes("GPT")||title.includes("LLM") ? 20 : 10) +
        (text.length > 200 ? 20 : 5)
      );
      return ok({score,title,grade:score>70?"A":score>50?"B":"C"});
    }

    // ── Full-text Search ──
    if (path === "/api/search") {
      const q = url.searchParams.get("q");
      if (!q || q.length < 1) return ok({ results: [] });
      if (!dbReady) return err("db not ready", 503);

      const results = await dbSearchPages(q, 20);
      const formatted = results.map(r => ({
        type: r.path?.includes('vibe-coding') ? 'course' :
              r.path?.includes('financial') ? 'financial' : 'page',
        title: r.title,
        desc: r.excerpt || r.description || '',
        path: r.path,
        cat: r.category || ''
      }));

      return ok({ results: formatted, query: q });
    }

    // ── Course API ──
    if (path === "/api/course/list") {
      if (!dbReady) return err("database not ready", 503);
      const r = await dbQuery("SELECT slug, title, stage, num, emoji, desc_text FROM course_lessons ORDER BY num");
      return ok(r);
    }
    if (path.startsWith("/api/course/")) {
      if (!dbReady) return err("database not ready", 503);
      const slug = path.replace("/api/course/", "").replace(/[^a-z-]/g, "");
      const r = await dbQuery("SELECT * FROM course_lessons WHERE slug = $1", [slug]);
      if (!r.length) return err("lesson not found", 404);
      return ok(r[0]);
    }

    return ok({ routes: ["/api/weather", "/api/news", "/api/geocode", "/api/papers", "/api/summary", "/api/papers-summary", "/api/news-summary", "/api/db/stats", "/api/db/news", "/api/db/search", "/api/db/summaries", "/api/db/pages", "/api/db/ai", "/api/financial/briefs", "/api/financial/latest"] });
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
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 20).map(m => {
      const t = (m[1].match(/<title>([^<]+)<\/title>/) || [])[1] || "";
      return { title: t.replace(/&#39;/g,"'").replace(/&apos;/g,"'").replace(/&amp;/g,"&").replace(/&quot;/g,'"'), source: "NPR" };
    });
    if (!items.length) return;
    const titles = items.map((n,i) => `${i+1}. ${n.title}`).join("\n");
    const r = await fetch(DEEPSEEK, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DEEPSEEK_KEY}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "system", content: "你是中文新闻编辑。将每条英文新闻翻译成简洁中文(20字内)，提取关键数字/指标，分配优先级(critical/high/normal/low)。输出纯JSON数组：[{\"level\":\"high\",\"title\":\"中文标题\",\"summary\":\"一句话要点\",\"metric\":\"关键数字\",\"source\":\"NPR\",\"keywords\":\"术语1,术语2\"}] keywords:负面前加!，经济数据前加*。" }, { role: "user", content: `翻译并分析以下新闻：\n${titles}` }],
        temperature: 0.2, max_tokens: 2500
      })
    });
    if (!r.ok) return;
    const data = await r.json();
    const text = data.choices?.[0]?.message?.content || "";
    const jsonMatch = text.match(/\\[[\s\S]*\\]/);
    if (jsonMatch) {
      const arr = JSON.parse(jsonMatch[0]);
      let result = arr.map((item, i) => ({ ...item, id: i, time: new Date().toISOString() }));
      result._ts = Date.now();
      // Accumulate: merge with existing, keep last 100 unique
      try {
        const old = JSON.parse(await Deno.readTextFile("/Users/lasky_my/ai-nav/news-cn-cache.json"));
        const seen = new Set(old.map(e => e.title));
        const fresh = result.filter(e => !seen.has(e.title));
        result = [...fresh, ...old].slice(0, 100);
      } catch(_) {}
      cacheSet("news-cn", result);
      try { await Deno.writeTextFile("/Users/lasky_my/ai-nav/news-cn-cache.json", JSON.stringify(result)); } catch(_) {}
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
    // Accumulate: keep last 10 summaries
            try {
              const old = JSON.parse(await Deno.readTextFile("/Users/lasky_my/ai-nav/news-summaries.json"));
              old.unshift(result);
              const trimmed = old.slice(0, 10);
              await Deno.writeTextFile("/Users/lasky_my/ai-nav/news-summaries.json", JSON.stringify(trimmed));
            } catch(_) {
              try { await Deno.writeTextFile("/Users/lasky_my/ai-nav/news-summaries.json", JSON.stringify([result])); } catch(_) {}
            }
            cacheSet("news-summary", result);
    // Persist to disk
    try { await Deno.writeTextFile("/Users/lasky_my/ai-nav/news-cache.json", JSON.stringify(result)); } catch(_) {}
    console.log(`[news-summary] updated (${summary.length} chars, ${topNews.length} news)`);
  } catch (e) {
    console.log(`[news-summary] error: ${e.message}`);
  }
}


// ── DB Query Helper ──
async function dbQuery(sql, params = []) {
  const { Client } = await import("https://deno.land/x/postgres@v0.19.0/mod.ts");
  const pg = new Client({ hostname:"127.0.0.1", port:5432, user:"lasky_my", database:"ai_nav" });
  await pg.connect();
  try { const r = await pg.queryObject(sql, params); return r.rows; }
  finally { await pg.end(); }
}

// ── Financial Briefs: 自动从腾讯文档抓取 ──
import { fetchAllDocs } from "./txdocs.js";

async function dailyFinancialTask() {
  console.log("[financial] Daily task running...");
  const today = new Date().toISOString().slice(0, 10);

  // 直接抓取腾讯文档 (不再需要手动导出txt!)
  const docs = await fetchAllDocs();

  let allContent = "";
  for (const doc of docs) {
    if (doc.text && dbReady) {
      await dbIngestFinancial(today, doc.type, doc.title, doc.text, `https://docs.qq.com/doc/${doc.id}`);
      allContent += `\n## ${doc.title}\n${doc.text.slice(0, 3000)}\n`;
    }
  }

  // Generate AI summary (once per day)
  if (allContent.trim() && DEEPSEEK_KEY) {
    try {
      const r = await fetch(DEEPSEEK, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DEEPSEEK_KEY}` },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: "你是资深金融分析师。根据提供的金融简报内容，生成一份200字以内的今日金融要点总结。突出最重要的3-5个关键信息。用中文。" },
            { role: "user", content: `以下是今日金融简报：\n${allContent.slice(0, 5000)}` }
          ],
          temperature: 0.3, max_tokens: 500
        })
      });
      if (r.ok) {
        const data = await r.json();
        const summary = data.choices?.[0]?.message?.content || "";
        if (summary && dbReady) {
          await dbIngestFinancial(today, "summary", "今日金融要点", summary, "");
          if (data.usage) trackUsage("financial-summary", data.usage, "deepseek-chat");
        }
      }
    } catch (e) { console.log("[financial] AI summary failed:", e.message); }
  }

  if (dbReady) { await dbCleanupFinancial(); console.log("[financial] Cleaned up"); }
  console.log("[financial] Daily task complete");
}

// ── Startup: init DB, load caches, start background tasks ──
async function startup() {
  try { await initDB(); dbReady = true; console.log("[server] PostgreSQL ready"); } catch(e) { console.log("[server] DB init failed:", e.message); }
  try { const cn = JSON.parse(await Deno.readTextFile("/Users/lasky_my/ai-nav/news-cn-cache.json")); if (cn && cn.length) { cn._ts = Date.now(); cacheSet("news-cn", cn); console.log("[init] loaded news-cn cache:", cn.length, "items"); } } catch(_) {}
  try { const ns = JSON.parse(await Deno.readTextFile("/Users/lasky_my/ai-nav/news-cache.json")); if (ns && ns.summary) { cacheSet("news-summary", ns); console.log("[init] loaded news-summary cache"); } } catch(_) {}

  // Init automation statuses
  if (dbReady) {
    for (const [name, desc] of [["news-summary","AI新闻摘要"],["news-cn","中文新闻"],["weather-refresh","天气刷新"],["papers-refresh","论文同步"],["financial-daily","金融简报"]]){
      try { await dbUpdateAuto(name, "pending", desc); } catch(_) {}
    }
  }

  refreshNewsSummary();
  setInterval(refreshNewsSummary, 900_000);
  setInterval(refreshNewsCN, 300000);

  // Financial briefs: schedule daily at 6AM
  await scheduleDailyFinancial();

  // Bilibili scraper: run on startup + every hour (backup for launchd)
  try {
    const { scrapeAndGenerate } = await import("./bilibili-scraper.js");
    scrapeAndGenerate();
    setInterval(scrapeAndGenerate, 3600000);
    console.log("[bilibili] Scraper scheduled (hourly)");
  } catch (e) {
    console.log("[bilibili] Scraper not available:", e.message);
  }
}
startup();

async function scheduleDailyFinancial() {
  const now = new Date();
  const sixAM = new Date(now);
  sixAM.setHours(6, 1, 0, 0); // 6:01 AM
  if (now > sixAM) sixAM.setDate(sixAM.getDate() + 1);
  const msUntil6AM = sixAM - now;
  console.log(`[financial] Next daily task: ${sixAM.toLocaleString('zh-CN')} (${Math.round(msUntil6AM/3600000)}h)`);

  setTimeout(() => {
    dailyFinancialTask();
    // Then repeat every 24 hours
    setInterval(dailyFinancialTask, 86400000);
  }, msUntil6AM);
}

const PORT = parseInt(Deno.env.get("PORT") || "8765");
console.log(`AI Nav API server running on http://localhost:${PORT}`);
Deno.serve({ port: PORT }, handle);
