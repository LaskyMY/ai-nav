// Vercel Serverless — proxies weather, news, geocode with caching
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const NEWS_SOURCES = [
  {
    url: 'https://api.vvhan.com/api/hotlist/news',
    parse(d) { return (d.data || []).map(i => ({ title: i.title, source: i.source || '综合' })); },
  },
  {
    url: 'https://api.oioweb.cn/api/top/hot',
    parse(d) { return (d.result || []).map(i => ({ title: i.title || i.name, source: i.desc || '热榜' })); },
  },
];

// Simple in-memory cache
const cache = new Map();
function getCached(key, ttlMs) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < ttlMs) return entry.data;
  return null;
}
function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

export default async function handler(req, res) {
  const { pathname, searchParams } = new URL(req.url, 'http://localhost');
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // ── Weather ──
    if (pathname === '/api/weather') {
      const lat = searchParams.get('lat');
      const lon = searchParams.get('lon');
      if (!lat || !lon) return res.status(400).json({ error: 'missing lat/lon' });

      const ck = `w:${lat.slice(0,5)}:${lon.slice(0,5)}`;
      const cached = getCached(ck, 600_000);
      if (cached) return res.json(cached);

      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,relative_humidity_2m&hourly=temperature_2m,weather_code,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=2`);
      const data = await r.json();
      setCache(ck, data);
      return res.json(data);
    }

    // ── News ──
    if (pathname === '/api/news') {
      const cached = getCached('news', 120_000);
      if (cached) return res.json(cached);

      const results = await Promise.all(
        NEWS_SOURCES.map(async (src) => {
          try {
            const controller = new AbortController();
            const t = setTimeout(() => controller.abort(), 4000);
            const r = await fetch(src.url, { signal: controller.signal });
            clearTimeout(t);
            if (!r.ok) return [];
            return src.parse(await r.json()) || [];
          } catch (e) { return []; }
        })
      );

      const seen = new Set();
      const merged = [];
      for (const items of results) {
        for (const item of items) {
          const key = item.title.slice(0, 10);
          if (!seen.has(key)) { seen.add(key); merged.push(item); }
        }
      }

      const data = merged.slice(0, 20);
      setCache('news', data);
      return res.json(data);
    }

    // ── Geocode ──
    if (pathname === '/api/geocode') {
      const lat = searchParams.get('lat');
      const lon = searchParams.get('lon');
      if (!lat || !lon) return res.status(400).json({ error: 'missing lat/lon' });

      const ck = `g:${lat.slice(0,5)}:${lon.slice(0,5)}`;
      const cached = getCached(ck, 3_600_000);
      if (cached) return res.json(cached);

      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=zh&zoom=12`,
        { headers: { 'User-Agent': 'ai-nav-clock/1.0' } }
      );
      const data = await r.json();
      const addr = data.address || {};
      const result = { city: addr.city || addr.town || addr.county || addr.state || addr.country || '未知位置' };
      setCache(ck, result);
      return res.json(result);
    }

    return res.json({ ok: true, routes: ['/api/weather', '/api/news', '/api/geocode'] });
  } catch (e) {
    return res.status(500).json({ error: 'internal error' });
  }
}
