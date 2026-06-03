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
