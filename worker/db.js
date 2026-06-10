// AI Nav PostgreSQL 数据库模块
// Deno 运行: deno run --allow-net --allow-env --allow-read worker/db.js
// 驱动: deno-postgres (PostgreSQL 客户端)
import { Client } from "https://deno.land/x/postgres@v0.19.0/mod.ts";

const DB_CONFIG = {
  hostname: "127.0.0.1",
  port: 5432,
  user: "lasky_my",
  password: "",
  database: "ai_nav",
};

let client;

// ── 初始化 ──
export async function initDB(config = {}) {
  client = new Client({ ...DB_CONFIG, ...config });
  await client.connect();
  console.log("[DB] PostgreSQL ready:", DB_CONFIG.database);
  return client;
}

// ── News ──
export async function insertNews(items) {
  if (!client) return 0;
  let count = 0;
  for (const item of items) {
    try {
      await client.queryArray(
        `INSERT INTO news (title, title_cn, summary, source, keywords, level, metric, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (title) DO NOTHING`,
        [item.title||"", item.title_cn||item.title||"", item.summary||"", item.source||"NPR",
         item.keywords||"", item.level||"normal", item.metric||"", item.time||new Date().toISOString()]
      );
      count++;
    } catch (_) {}
  }
  return count;
}

export async function getNews(limit = 100, offset = 0) {
  if (!client) return [];
  const r = await client.queryObject(
    "SELECT * FROM news ORDER BY fetched_at DESC LIMIT $1 OFFSET $2", [limit, offset]
  );
  return r.rows;
}

export async function getNewsCount() {
  if (!client) return 0;
  const r = await client.queryObject("SELECT COUNT(*) as c FROM news");
  return Number(r.rows[0]?.c) || 0;
}

export async function searchNews(query, limit = 50) {
  if (!client) return [];
  const q = `%${query}%`;
  const r = await client.queryObject(
    `SELECT * FROM news WHERE title ILIKE $1 OR title_cn ILIKE $1 OR summary ILIKE $1 OR keywords ILIKE $1
     ORDER BY fetched_at DESC LIMIT $2`, [q, limit]
  );
  return r.rows;
}

// ── Weather ──
export async function saveWeather(lat, lon, locationName, data) {
  if (!client) return;
  await client.queryArray(
    "INSERT INTO weather (lat, lon, location_name, data) VALUES ($1, $2, $3, $4)",
    [lat, lon, locationName, JSON.stringify(data)]
  );
}

export async function getWeather(lat, lon, maxAgeMin = 60) {
  if (!client) return null;
  const r = await client.queryObject(
    `SELECT * FROM weather WHERE lat = $1 AND lon = $2
     AND fetched_at > NOW() - INTERVAL '1 minute' * $3
     ORDER BY fetched_at DESC LIMIT 1`, [lat, lon, maxAgeMin]
  );
  return r.rows[0] || null;
}

// ── AI Summaries ──
export async function saveSummary(type, content, usage = {}) {
  if (!client) return;
  await client.queryArray(
    "INSERT INTO ai_summaries (type, content, model, prompt_tokens, completion_tokens, cost) VALUES ($1, $2, $3, $4, $5, $6)",
    [type, content, usage.model||"deepseek-chat", usage.prompt_tokens||0, usage.completion_tokens||0, usage.cost||0]
  );
}

export async function getLatestSummary(type) {
  if (!client) return null;
  const r = await client.queryObject(
    "SELECT content, created_at as updated, cost FROM ai_summaries WHERE type = $1 ORDER BY created_at DESC LIMIT 1",
    [type]
  );
  if (!r.rows.length) return null;
  return { summary: r.rows[0].content, updated: r.rows[0].updated, cost: r.rows[0].cost };
}

export async function getSummaries(type, limit = 10) {
  if (!client) return [];
  const r = await client.queryObject(
    "SELECT * FROM ai_summaries WHERE type = $1 ORDER BY created_at DESC LIMIT $2", [type, limit]
  );
  return r.rows;
}

// ── Usage Log ──
export async function logUsage(endpoint, model, promptTokens, completionTokens, cost) {
  if (!client) return;
  await client.queryArray(
    "INSERT INTO usage_log (endpoint, model, prompt_tokens, completion_tokens, total_tokens, cost) VALUES ($1, $2, $3, $4, $5, $6)",
    [endpoint, model, promptTokens, completionTokens, promptTokens+completionTokens, cost]
  );
}

export async function getUsageStats(days = 90) {
  if (!client) return { total: { prompt:0, completion:0, tokens:0, cost:0 }, daily: [] };
  const totalR = await client.queryObject(
    `SELECT COALESCE(SUM(prompt_tokens),0) as prompt, COALESCE(SUM(completion_tokens),0) as completion,
            COALESCE(SUM(total_tokens),0) as tokens, COALESCE(SUM(cost),0) as cost
     FROM usage_log WHERE created_at > NOW() - INTERVAL '1 day' * $1`, [days]
  );
  const dailyR = await client.queryObject(
    `SELECT DATE(created_at) as day, SUM(total_tokens) as tokens, SUM(cost) as cost, COUNT(*) as calls
     FROM usage_log WHERE created_at > NOW() - INTERVAL '1 day' * $1
     GROUP BY day ORDER BY day DESC`, [days]
  );
  return { total: totalR.rows[0] || { prompt:0, completion:0, tokens:0, cost:0 }, daily: dailyR.rows };
}

// ── Pages ──
export async function trackPage(path) {
  if (!client) return;
  await client.queryArray(
    `INSERT INTO pages (path, view_count) VALUES ($1, 1)
     ON CONFLICT (path) DO UPDATE SET view_count = pages.view_count + 1, updated_at = NOW()`, [path]
  );
}

export async function getPageStats() {
  if (!client) return [];
  const r = await client.queryObject("SELECT * FROM pages ORDER BY view_count DESC");
  return r.rows;
}

// ── AI 数据处理 ──
export async function queryForAI(sql, params = []) {
  if (!client) return [];
  const r = await client.queryObject(sql, params);
  return r.rows;
}

export async function getDBStats() {
  if (!client) return {};
  const tables = ["news", "weather", "ai_summaries", "usage_log", "pages"];
  const stats = {};
  for (const t of tables) {
    const r = await client.queryObject(`SELECT COUNT(*) as c FROM ${t}`);
    stats[t] = Number(r.rows[0]?.c) || 0;
  }
  return stats;
}

// ── Financial Briefs ──
export async function ingestFinancialBrief(date, type, title, content, sourceUrl = "") {
  if (!client) return;
  await client.queryArray(
    `INSERT INTO financial_briefs (date, type, title, content, source_url)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (date, type) DO UPDATE SET content=$4, title=$3, source_url=$5, created_at=NOW()`,
    [date, type, title, content, sourceUrl]
  );
}

export async function getFinancialBriefs(days = 10) {
  if (!client) return [];
  const r = await client.queryObject(
    `SELECT * FROM financial_briefs WHERE date > CURRENT_DATE - $1::int ORDER BY date DESC, type`, [days]
  );
  return r.rows;
}

export async function getLatestFinancialBriefs() {
  if (!client) return [];
  // Get the most recent date's briefs (not strictly today)
  const r = await client.queryObject(
    "SELECT * FROM financial_briefs WHERE date = (SELECT MAX(date) FROM financial_briefs) ORDER BY type"
  );
  return r.rows;
}

export async function cleanupOldFinancialBriefs(days = 10) {
  if (!client) return;
  await client.queryArray("DELETE FROM financial_briefs WHERE date < CURRENT_DATE - $1", [days]);
}

// ── Page Meta + Full-Text Search ──
export async function upsertPageMeta(path, title, description, bodyText, category = 'other') {
  if (!client) return;
  await client.queryArray(
    `INSERT INTO page_meta (path, title, description, body_text, category, search_vector, indexed_at)
     VALUES ($1, $2, $3, $4, $5,
       setweight(to_tsvector('simple', COALESCE($2, '')), 'A') ||
       setweight(to_tsvector('simple', COALESCE($3, '')), 'B') ||
       setweight(to_tsvector('simple', COALESCE($4, '')), 'C'),
       NOW())
     ON CONFLICT (path) DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       body_text = EXCLUDED.body_text,
       category = EXCLUDED.category,
       search_vector = EXCLUDED.search_vector,
       indexed_at = NOW()`,
    [path, title, description, bodyText, category]
  );
}

export async function getPageMetas(activeOnly = true) {
  if (!client) return [];
  const r = await client.queryObject(
    activeOnly
      ? "SELECT * FROM page_meta WHERE is_active = true ORDER BY category, nav_order"
      : "SELECT * FROM page_meta ORDER BY category, nav_order"
  );
  return r.rows;
}

export async function getPageMetaByPath(path) {
  if (!client) return null;
  const r = await client.queryObject(
    "SELECT * FROM page_meta WHERE path = $1", [path]
  );
  return r.rows[0] || null;
}

// Full-text search across page_meta
export async function searchPageContent(query, limit = 20) {
  if (!client || !query || query.length < 1) return [];

  // Try tsvector search first (for Chinese, 'simple' config works best)
  const tsQuery = query.split(/\s+/).filter(w => w.length > 0).join(' & ');
  let results = [];
  try {
    const r = await client.queryObject(
      `SELECT path, title, description,
              COALESCE(left(body_text, 300), description) as excerpt,
              category,
              ts_rank(search_vector, to_tsquery('simple', $1)) as rank
       FROM page_meta
       WHERE is_active = true AND search_vector @@ to_tsquery('simple', $1)
       ORDER BY rank DESC LIMIT $2`,
      [tsQuery, limit]
    );
    results = r.rows;
  } catch (_) {
    // tsquery parse error — fall through to ILIKE
  }

  // Fallback: ILIKE search
  if (results.length === 0) {
    const q = `%${query}%`;
    const r = await client.queryObject(
      `SELECT path, title, description,
              COALESCE(left(body_text, 300), description) as excerpt,
              category
       FROM page_meta
       WHERE is_active = true
         AND (title ILIKE $1 OR description ILIKE $1 OR body_text ILIKE $1)
       ORDER BY title LIMIT $2`,
      [q, limit]
    );
    results = r.rows;
  }

  // Also search course_lessons
  const q = `%${query}%`;
  const cr = await client.queryObject(
    `SELECT ('./vibe-coding-lessons/' || slug || '.html') as path,
            title, desc_text as description,
            desc_text as excerpt,
            ('课程·阶段' || stage) as category
     FROM course_lessons
     WHERE title ILIKE $1 OR desc_text ILIKE $1
     LIMIT 5`,
    [q]
  );
  results.push(...cr.rows);

  // Also search financial_briefs
  const fr = await client.queryObject(
    `SELECT './financial-news.html' as path,
            title,
            left(content, 200) as description,
            left(content, 300) as excerpt,
            type as category
     FROM financial_briefs
     WHERE content ILIKE $1
     ORDER BY date DESC LIMIT 3`,
    [q]
  );
  results.push(...fr.rows);

  return results.slice(0, limit);
}

// ── Automation Log ──
export async function updateAutomationStatus(name, status, resultSummary = null, errorMsg = null) {
  if (!client) return;
  await client.queryArray(
    `INSERT INTO automation_log (process_name, status, result_summary, error_message, started_at, finished_at, next_run_at, run_count)
     VALUES ($1, $2, $3, $4, NOW(), NOW(),
       CASE $2 WHEN 'running' THEN NULL ELSE NOW() + (
         CASE $1
           WHEN 'bilibili-scraper' THEN INTERVAL '1 hour'
           WHEN 'financial-daily' THEN INTERVAL '24 hours'
           WHEN 'news-summary' THEN INTERVAL '15 minutes'
           WHEN 'news-cn' THEN INTERVAL '5 minutes'
           WHEN 'weather-refresh' THEN INTERVAL '10 minutes'
           WHEN 'papers-refresh' THEN INTERVAL '5 minutes'
           ELSE INTERVAL '1 hour'
         END
       ) END,
       1)
     ON CONFLICT ON CONSTRAINT automation_log_process_name_key DO UPDATE SET
       status = EXCLUDED.status,
       result_summary = COALESCE(EXCLUDED.result_summary, automation_log.result_summary),
       error_message = EXCLUDED.error_message,
       started_at = CASE WHEN $2 = 'running' THEN EXCLUDED.started_at ELSE automation_log.started_at END,
       finished_at = CASE WHEN $2 != 'running' THEN EXCLUDED.finished_at ELSE automation_log.finished_at END,
       next_run_at = EXCLUDED.next_run_at,
       run_count = automation_log.run_count + 1`,
    [name, status, resultSummary, errorMsg]
  );
}

export async function getAutomationStatus() {
  if (!client) return [];
  const r = await client.queryObject(
    "SELECT * FROM automation_log ORDER BY process_name"
  );
  return r.rows;
}

// ── 关闭 ──
export async function closeDB() {
  if (client) await client.end();
}

// ── CLI ──
if (import.meta.main) {
  await initDB();
  console.log("Stats:", await getDBStats());
  await closeDB();
}
