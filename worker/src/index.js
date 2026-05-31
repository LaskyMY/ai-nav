export default {
  async fetch(req) {
    const url = new URL(req.url);
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Content-Type': 'application/json; charset=utf-8',
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

    const cache = caches.default;
    const path = url.pathname;

    try {
      // ── Weather ──
      if (path === '/api/weather') {
        const lat = url.searchParams.get('lat'), lon = url.searchParams.get('lon');
        if (!lat || !lon) return new Response(JSON.stringify({ error: 'missing lat/lon' }), { status: 400, headers });

        const ck = new Request(`https://cache/${path}?lat=${lat.slice(0,5)}&lon=${lon.slice(0,5)}`);
        let resp = await cache.match(ck);
        if (resp) return resp;

        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,relative_humidity_2m&hourly=temperature_2m,weather_code,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=2`);
        resp = new Response(r.body, { headers: { ...headers, 'Cache-Control': 'public, max-age=600' } });
        await cache.put(ck, resp.clone());
        return resp;
      }

      // ── News ──
      if (path === '/api/news') {
        const ck = new Request('https://cache/news');
        let resp = await cache.match(ck);
        if (resp) return resp;

        const sources = [
          { url: 'https://api.vvhan.com/api/hotlist/news', parse: d => (d.data || []).map(i => ({ title: i.title, source: i.source || '综合' })) },
          { url: 'https://api.oioweb.cn/api/top/hot', parse: d => (d.result || []).map(i => ({ title: i.title || i.name, source: i.desc || '热榜' })) },
        ];

        const results = await Promise.all(sources.map(async s => {
          try { const r = await fetch(s.url, { signal: AbortSignal.timeout(4000) }); return r.ok ? (s.parse(await r.json()) || []) : []; } catch (e) { return []; }
        }));

        const seen = new Set(), merged = [];
        for (const items of results) for (const item of items) { const k = item.title.slice(0, 10); if (!seen.has(k)) { seen.add(k); merged.push(item); } }

        const body = JSON.stringify(merged.slice(0, 20));
        resp = new Response(body, { headers: { ...headers, 'Cache-Control': 'public, max-age=120' } });
        await cache.put(ck, resp.clone());
        return resp;
      }

      // ── Geocode ──
      if (path === '/api/geocode') {
        const lat = url.searchParams.get('lat'), lon = url.searchParams.get('lon');
        if (!lat || !lon) return new Response(JSON.stringify({ error: 'missing lat/lon' }), { status: 400, headers });

        const ck = new Request(`https://cache/${path}?lat=${lat.slice(0,5)}&lon=${lon.slice(0,5)}`);
        let resp = await cache.match(ck);
        if (resp) return resp;

        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=zh&zoom=12`, { headers: { 'User-Agent': 'ai-nav-clock/1.0' } });
        const data = await r.json(), addr = data.address || {};
        const body = JSON.stringify({ city: addr.city || addr.town || addr.county || addr.state || addr.country || '未知位置' });
        resp = new Response(body, { headers: { ...headers, 'Cache-Control': 'public, max-age=3600' } });
        await cache.put(ck, resp.clone());
        return resp;
      }

      return new Response(JSON.stringify({ ok: true, routes: ['/api/weather', '/api/news', '/api/geocode'] }), { headers });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'internal error' }), { status: 500, headers });
    }
  },
};
