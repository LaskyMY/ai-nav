// AI Nav 本地 SQLite 数据库模块
// Deno 运行: deno run --allow-read --allow-write --allow-ffi worker/db.js
import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";

const DB_PATH = "./ai-nav.db";
let db;

// ── 初始化 ──
export function initDB(path = DB_PATH) {
  db = new DB(path);
  db.execute("PRAGMA journal_mode=WAL");
  db.execute("PRAGMA foreign_keys=ON");
  createTables();
  console.log("[DB] SQLite ready:", path);
  return db;
}

// ── 建表 ──
function createTables() {
  db.execute(`
    CREATE TABLE IF NOT EXISTS news (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      title_cn TEXT,
      summary TEXT,
      source TEXT DEFAULT 'NPR',
      url TEXT,
      keywords TEXT,
      level TEXT DEFAULT 'normal',
      metric TEXT,
      published_at TEXT,
      fetched_at TEXT DEFAULT (datetime('now')),
      UNIQUE(title)
    )
  `);

  db.execute(`
    CREATE TABLE IF NOT EXISTS weather (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      location_name TEXT,
      data TEXT NOT NULL,
      fetched_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.execute(`
    CREATE TABLE IF NOT EXISTS ai_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      model TEXT DEFAULT 'deepseek-chat',
      prompt_tokens INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      cost REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.execute(`
    CREATE TABLE IF NOT EXISTS usage_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL,
      model TEXT DEFAULT 'deepseek-chat',
      prompt_tokens INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      cost REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.execute(`
    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT UNIQUE NOT NULL,
      title TEXT,
      description TEXT,
      category TEXT,
      view_count INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // 索引
  db.execute("CREATE INDEX IF NOT EXISTS idx_news_fetched ON news(fetched_at DESC)");
  db.execute("CREATE INDEX IF NOT EXISTS idx_news_level ON news(level)");
  db.execute("CREATE INDEX IF NOT EXISTS idx_usage_date ON usage_log(created_at DESC)");
  db.execute("CREATE INDEX IF NOT EXISTS idx_summaries_type ON ai_summaries(type, created_at DESC)");
  db.execute("CREATE INDEX IF NOT EXISTS idx_weather_loc ON weather(lat, lon, fetched_at DESC)");
}

// ── Helper: convert row array to object ──
const NEWS_COLS = ["id","title","title_cn","summary","source","url","keywords","level","metric","published_at","fetched_at"];
const USAGE_COLS = ["id","endpoint","model","prompt_tokens","completion_tokens","total_tokens","cost","created_at"];
const SUMMARY_COLS = ["id","type","content","model","prompt_tokens","completion_tokens","cost","created_at"];
const WEATHER_COLS = ["id","lat","lon","location_name","data","fetched_at"];
const PAGES_COLS = ["id","path","title","description","category","view_count","updated_at"];

function toObj(row, cols) { const o={}; cols.forEach((c,i)=>{o[c]=row[i]}); return o; }
function toObjs(rows, cols) { return rows.map(r=>toObj(r,cols)); }

// ── News ──
export function insertNews(items) {
  let count = 0;
  for (const item of items) {
    db.query(
      "INSERT OR IGNORE INTO news (title, title_cn, summary, source, keywords, level, metric, published_at) VALUES (?,?,?,?,?,?,?,?)",
      [item.title||"", item.title_cn||item.title||"", item.summary||"", item.source||"NPR", item.keywords||"", item.level||"normal", item.metric||"", item.time||new Date().toISOString()]
    );
    count++;
  }
  return count;
}

export function getNews(limit = 100, offset = 0) {
  return toObjs([...db.query("SELECT * FROM news ORDER BY fetched_at DESC LIMIT ? OFFSET ?", [limit, offset])], NEWS_COLS);
}

export function getNewsCount() {
  return [...db.query("SELECT COUNT(*) FROM news")][0][0] || 0;
}

export function getNewsByLevel(level, limit = 20) {
  return toObjs([...db.query("SELECT * FROM news WHERE level = ? ORDER BY fetched_at DESC LIMIT ?", [level, limit])], NEWS_COLS);
}

export function searchNews(query, limit = 50) {
  const q = `%${query}%`;
  return toObjs([...db.query(
    "SELECT * FROM news WHERE title LIKE ? OR title_cn LIKE ? OR summary LIKE ? OR keywords LIKE ? ORDER BY fetched_at DESC LIMIT ?",
    [q, q, q, q, limit]
  )], NEWS_COLS);
}

// ── Weather ──
export function saveWeather(lat, lon, locationName, data) {
  db.query(
    "INSERT INTO weather (lat, lon, location_name, data) VALUES (?, ?, ?, ?)",
    [lat, lon, locationName, JSON.stringify(data)]
  );
}

export function getWeather(lat, lon, maxAgeMin = 60) {
  const rows = [...db.query(
    "SELECT * FROM weather WHERE lat = ? AND lon = ? AND fetched_at > datetime('now', ?) ORDER BY fetched_at DESC LIMIT 1",
    [lat, lon, `-${maxAgeMin} minutes`]
  )];
  return rows.length ? toObj(rows[0], WEATHER_COLS) : null;
}

// ── AI Summaries ──
export function saveSummary(type, content, usage = {}) {
  db.query(
    "INSERT INTO ai_summaries (type, content, model, prompt_tokens, completion_tokens, cost) VALUES (?, ?, ?, ?, ?, ?)",
    [
      type, content,
      usage.model || "deepseek-chat",
      usage.prompt_tokens || 0,
      usage.completion_tokens || 0,
      usage.cost || 0,
    ]
  );
}

export function getLatestSummary(type) {
  const rows = [...db.query("SELECT * FROM ai_summaries WHERE type = ? ORDER BY created_at DESC LIMIT 1", [type])];
  if (!rows.length) return null;
  const row = toObj(rows[0], SUMMARY_COLS);
  return { summary: row.content, updated: row.created_at, cost: row.cost };
}

export function getSummaries(type, limit = 10) {
  return toObjs([...db.query("SELECT * FROM ai_summaries WHERE type = ? ORDER BY created_at DESC LIMIT ?", [type, limit])], SUMMARY_COLS);
}

// ── Usage Log ──
export function logUsage(endpoint, model, promptTokens, completionTokens, cost) {
  db.query(
    "INSERT INTO usage_log (endpoint, model, prompt_tokens, completion_tokens, total_tokens, cost) VALUES (?, ?, ?, ?, ?, ?)",
    [endpoint, model, promptTokens, completionTokens, promptTokens + completionTokens, cost]
  );
}

export function getUsageStats(days = 90) {
  const totalRow = [...db.query("SELECT SUM(prompt_tokens), SUM(completion_tokens), SUM(total_tokens), SUM(cost) FROM usage_log WHERE created_at > datetime('now', ?)", [`-${days} days`])][0];
  const total = totalRow ? { prompt: totalRow[0]||0, completion: totalRow[1]||0, tokens: totalRow[2]||0, cost: totalRow[3]||0 } : { prompt:0, completion:0, tokens:0, cost:0 };

  const daily = toObjs([...db.query("SELECT date(created_at) as day, SUM(total_tokens) as tokens, SUM(cost) as cost, COUNT(*) as calls FROM usage_log WHERE created_at > datetime('now', ?) GROUP BY day ORDER BY day DESC", [`-${days} days`])], ["day","tokens","cost","calls"]);

  return { total, daily };
}

// ── Pages ──
export function trackPage(path) {
  db.query("INSERT OR REPLACE INTO pages (id, path, view_count, updated_at) VALUES ((SELECT id FROM pages WHERE path = ?), ?, COALESCE((SELECT view_count FROM pages WHERE path = ?), 0) + 1, datetime('now'))", [path, path, path]);
}

export function getPageStats() {
  return toObjs([...db.query("SELECT * FROM pages ORDER BY view_count DESC")], PAGES_COLS);
}

// ── AI 数据处理 ──
export function queryForAI(sql, params = []) {
  return [...db.query(sql, params)];
}

export function getDBStats() {
  const tables = ["news", "weather", "ai_summaries", "usage_log", "pages"];
  const stats = {};
  for (const t of tables) {
    const r = [...db.query(`SELECT COUNT(*) FROM ${t}`)][0];
    stats[t] = r ? r[0] : 0;
  }
  return stats;
}

// ── 关闭 ──
export function closeDB() {
  if (db) db.close();
}

// ── CLI: 直接运行时初始化并打印状态 ──
if (import.meta.main) {
  const db = initDB();
  console.log("Tables created. Stats:", getDBStats());
  closeDB();
}
