const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

const DEEPSEEK = 'https://api.deepseek.com/v1/chat/completions';

// Simple sliding-window rate limiter (per IP, in-memory)
const RL = new Map();
function rateLimit(ip, route, limit, windowMs) {
  const key = `${ip}:${route}`;
  const now = Date.now();
  let entry = RL.get(key);
  if (!entry || now - entry.reset > windowMs) {
    entry = { count: 1, reset: now + windowMs };
    RL.set(key, entry);
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}
// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of RL) { if (now - v.reset > 120_000) RL.delete(k); }
}, 60_000);

function ok(data, extraHeaders) {
  return new Response(JSON.stringify(data), { headers: { ...CORS, ...extraHeaders } });
}

function err(msg, status) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: CORS });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const cache = caches.default;

    try {

      // ── Weather ──
      if (path === '/api/weather') {
        const lat = url.searchParams.get('lat'), lon = url.searchParams.get('lon');
        if (!lat || !lon) return err('missing lat/lon', 400);

        const ck = new Request(`https://cache/weather?lat=${lat.slice(0,5)}&lon=${lon.slice(0,5)}`);
        let cached = await cache.match(ck);
        if (cached) return cached;

        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,relative_humidity_2m&hourly=temperature_2m,weather_code,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=2`);
        const resp = ok(await r.json(), { 'Cache-Control': 'public, max-age=600' });
        await cache.put(ck, resp.clone());
        return resp;
      }

      // ── News ──
      if (path === '/api/news') {
        const ck = new Request('https://cache/news');
        let cached = await cache.match(ck);
        if (cached) return cached;

        const sources = [
          { url: 'https://api.vvhan.com/api/hotlist/news', parse: d => (d.data || []).map(i => ({ title: i.title, source: i.source || '综合' })) },
          { url: 'https://api.oioweb.cn/api/top/hot', parse: d => (d.result || []).map(i => ({ title: i.title || i.name, source: i.desc || '热榜' })) },
        ];

        const results = await Promise.all(sources.map(async s => {
          try { const r = await fetch(s.url, { signal: AbortSignal.timeout(4000) }); return r.ok ? (s.parse(await r.json()) || []) : []; } catch (e) { return []; }
        }));

        const seen = new Set(), merged = [];
        for (const items of results) for (const item of items) { const k = item.title.slice(0, 10); if (!seen.has(k)) { seen.add(k); merged.push(item); } }

        const resp = ok(merged.slice(0, 20), { 'Cache-Control': 'public, max-age=120' });
        await cache.put(ck, resp.clone());
        return resp;
      }

      // ── Geocode ──
      if (path === '/api/geocode') {
        const lat = url.searchParams.get('lat'), lon = url.searchParams.get('lon');
        if (!lat || !lon) return err('missing lat/lon', 400);

        const ck = new Request(`https://cache/geocode?lat=${lat.slice(0,5)}&lon=${lon.slice(0,5)}`);
        let cached = await cache.match(ck);
        if (cached) return cached;

        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=zh&zoom=12`, { headers: { 'User-Agent': 'ai-nav-api/1.0' } });
        const data = await r.json(), addr = data.address || {};
        const resp = ok({ city: addr.city || addr.town || addr.county || addr.state || addr.country || '未知位置' }, { 'Cache-Control': 'public, max-age=3600' });
        await cache.put(ck, resp.clone());
        return resp;
      }

      // ── Papers (arXiv) ──
      if (path === '/api/papers') {
        const q = url.searchParams.get('q');
        if (!q) return err('missing q', 400);

        const ck = new Request(`https://cache/papers?q=${encodeURIComponent(q)}`);
        let cached = await cache.match(ck);
        if (cached) return cached;

        const arxivUrl = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}&start=0&max_results=10&sortBy=submittedDate&sortOrder=descending`;
        const r = await fetch(arxivUrl);
        const xml = await r.text();

        // Parse arXiv Atom XML → JSON
        const papers = [];
        const re = /<entry>([\s\S]*?)<\/entry>/g;
        let m;
        while ((m = re.exec(xml)) !== null) {
          const e = m[1];
          const id = (e.match(/<id>([^<]+)<\/id>/) || [])[1] || '';
          const arxivId = id.replace('http://arxiv.org/abs/', '');
          papers.push({
            id: arxivId,
            title: ((e.match(/<title>([^<]+)<\/title>/) || [])[1] || '').replace(/\s+/g, ' ').trim(),
            summary: ((e.match(/<summary>([^<]+)<\/summary>/) || [])[1] || '').replace(/\s+/g, ' ').trim(),
            authors: [...e.matchAll(/<name>([^<]+)<\/name>/g)].map(a => a[1]),
            published: (e.match(/<published>([^<]+)<\/published>/) || [])[1] || '',
            link: id,
          });
        }

        const resp = ok(papers, { 'Cache-Control': 'public, max-age=1800' });
        await cache.put(ck, resp.clone());
        return resp;
      }

      // ── AI Summary (DeepSeek) ──
      if (path === '/api/summary') {
        if (req.method !== 'POST') return err('POST required', 405);

        const ip = req.headers.get('CF-Connecting-IP') || '127.0.0.1';
        if (!rateLimit(ip, 'summary', 10, 60_000)) return err('请求太频繁，请等一分钟再试', 429);

        const body = await req.json().catch(() => null);
        if (!body || !body.text) return err('missing text', 400);

        const system = body.system || '你是一个专业的科技内容总结助手。用中文回复，简洁准确。';
        const prompt = body.prompt || '请总结以下内容，提取核心要点，用3-5个要点的形式呈现：';

        const r = await fetch(DEEPSEEK, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: `${prompt}\n\n${body.text}` },
            ],
            temperature: 0.3,
            max_tokens: 2000,
          }),
        });

        if (!r.ok) return err('AI 总结服务暂不可用', 502);
        const data = await r.json();
        return ok({ summary: data.choices?.[0]?.message?.content || '', usage: data.usage });
      }

      // ── Papers + AI Summary (combined) ──
      if (path === '/api/papers-summary') {
        const q = url.searchParams.get('q');
        if (!q) return err('missing q', 400);

        const ip = req.headers.get('CF-Connecting-IP') || '127.0.0.1';
        if (!rateLimit(ip, 'papers-summary', 5, 60_000)) return err('请求太频繁，请等一分钟再试', 429);

        // Fetch papers
        const arxivUrl = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}&start=0&max_results=5&sortBy=submittedDate&sortOrder=descending`;
        const r = await fetch(arxivUrl);
        const xml = await r.text();

        const papers = [];
        const re = /<entry>([\s\S]*?)<\/entry>/g;
        let m;
        while ((m = re.exec(xml)) !== null) {
          const e = m[1];
          const id = (e.match(/<id>([^<]+)<\/id>/) || [])[1] || '';
          papers.push({
            id: id.replace('http://arxiv.org/abs/', ''),
            title: ((e.match(/<title>([^<]+)<\/title>/) || [])[1] || '').replace(/\s+/g, ' ').trim(),
            summary: ((e.match(/<summary>([^<]+)<\/summary>/) || [])[1] || '').replace(/\s+/g, ' ').trim(),
            authors: [...e.matchAll(/<name>([^<]+)<\/name>/g)].map(a => a[1]),
            published: (e.match(/<published>([^<]+)<\/published>/) || [])[1] || '',
          });
        }

        // Build summary prompt
        const text = papers.map((p, i) => `[${i + 1}] ${p.title}\n${p.summary.slice(0, 400)}`).join('\n\n');

        const aiResp = await fetch(DEEPSEEK, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: '你是前沿科技论文解读专家。用中文总结最新论文，突出每篇论文的创新点和应用场景。回复使用 Markdown 格式，要专业但通俗易懂。' },
              { role: 'user', content: `以下是关于 "${q}" 的最新 arXiv 论文摘要。请：1) 用2-3句话总的概括这个方向的前沿趋势 2) 逐篇介绍论文的核心创新点和实用价值\n\n${text}` },
            ],
            temperature: 0.4,
            max_tokens: 3000,
          }),
        });

        if (!aiResp.ok) return ok({ papers, summary: 'AI 总结生成失败' });

        const aiData = await aiResp.json();
        return ok({
          papers,
          summary: aiData.choices?.[0]?.message?.content || '',
        });
      }

      // ── Root ──
      return ok({
        routes: [
          '/api/weather?lat=X&lon=Y',
          '/api/news',
          '/api/geocode?lat=X&lon=Y',
          '/api/papers?q=keyword',
          '/api/summary (POST {text, prompt?, system?})',
          '/api/papers-summary?q=keyword',
        ],
      });

    } catch (e) {
      return err('internal error', 500);
    }
  },
};
