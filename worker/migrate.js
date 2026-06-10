// Schema migration script v2 — lightweight (no pg_trgm, no plpgsql)
import { Client } from "https://deno.land/x/postgres@v0.19.0/mod.ts";

const client = new Client({
  hostname: "127.0.0.1", port: 5432, user: "lasky_my", password: "", database: "ai_nav",
});
await client.connect();
console.log("[migrate] Connected");

// Add body_text and search_vector columns to page_meta if not exists
const cols = await client.queryObject("SELECT column_name FROM information_schema.columns WHERE table_name='page_meta'");
const names = cols.rows.map(r => r.column_name);
if (!names.includes('body_text')) {
  await client.queryArray("ALTER TABLE page_meta ADD COLUMN body_text TEXT");
  console.log("[migrate] Added page_meta.body_text");
} else { console.log("[migrate] body_text exists"); }
if (!names.includes('search_vector')) {
  await client.queryArray("ALTER TABLE page_meta ADD COLUMN search_vector tsvector");
  console.log("[migrate] Added page_meta.search_vector");
} else { console.log("[migrate] search_vector exists"); }
if (!names.includes('indexed_at')) {
  await client.queryArray("ALTER TABLE page_meta ADD COLUMN indexed_at TIMESTAMPTZ");
  console.log("[migrate] Added page_meta.indexed_at");
} else { console.log("[migrate] indexed_at exists"); }

// Try GIN index (may fail on limited PG, that's OK)
try { await client.queryArray("CREATE INDEX IF NOT EXISTS idx_page_meta_search ON page_meta USING gin(search_vector)"); console.log("[migrate] GIN index OK"); } catch(e) { console.log("[migrate] GIN not available, using btree"); }

// Add page_meta entries for any missing pages based on sitemap
const existing = await client.queryObject("SELECT path FROM page_meta");
const existingPaths = new Set(existing.rows.map(r => r.path));

// Core pages to ensure are in page_meta
const pages = [
  {path:'/index.html',title:'AI Nav 首页',description:'AI工具导航与知识百科',category:'core'},
  {path:'/knowledge.html',title:'知识百科',description:'心理学、逻辑、科学、自我提升',category:'hub'},
  {path:'/bilibili.html',title:'ForAI 收藏夹',description:'B站收藏夹自动抓取',category:'hub'},
  {path:'/body-map.html',title:'人体肌肉互动图',description:'点击查看全身肌肉训练',category:'fitness'},
  {path:'/fitness-muscles.html',title:'三块被忽视的肌肉',description:'后束、斜方、前臂训练指南',category:'fitness'},
  {path:'/fitness-chest.html',title:'胸肌训练完全指南',description:'卧推、飞鸟、绳索夹胸',category:'fitness'},
  {path:'/fitness-back.html',title:'背部训练完全指南',description:'引体向上、划船、高位下拉',category:'fitness'},
  {path:'/fitness-shoulders.html',title:'肩部训练完全指南',description:'推举、侧平举、面拉',category:'fitness'},
  {path:'/fitness-legs.html',title:'腿部训练完全指南',description:'深蹲、硬拉、腿举',category:'fitness'},
  {path:'/fitness-arms.html',title:'手臂训练完全指南',description:'弯举、下压、窄距卧推',category:'fitness'},
  {path:'/fitness-core.html',title:'核心训练完全指南',description:'平板支撑、卷腹、举腿',category:'fitness'},
  {path:'/causality.html',title:'因果关系科普',description:'相关≠因果、辛普森悖论、do-算子',category:'science'},
  {path:'/attention.html',title:'注意力机制',description:'QKV、Softmax、多头注意力',category:'science'},
  {path:'/logic-puzzle.html',title:'红蓝眼谜题',description:'递归推理经典谜题',category:'science'},
  {path:'/game-theory.html',title:'游戏数学必胜策略',description:'Nim、策梅洛定理、博弈论',category:'science'},
  {path:'/music-math.html',title:'音乐中的数学密码',description:'泛音列、十二平均律',category:'science'},
  {path:'/ai-concepts.html',title:'从LLM到Agent Skill',description:'Token、Context、Prompt、Tool、MCP',category:'science'},
  {path:'/papers.html',title:'前沿论文速览',description:'arXiv论文检索+AI总结',category:'science'},
];

for (const p of pages) {
  if (!existingPaths.has(p.path)) {
    try {
      await client.queryArray(
        `INSERT INTO page_meta (path, title, description, category, is_active) VALUES ($1, $2, $3, $4, true)`,
        [p.path, p.title, p.description, p.category]
      );
      console.log(`[migrate] Added: ${p.path}`);
    } catch(e) { /* dup OK */ }
  }
}

await client.end();
console.log("[migrate] ✅ Migration complete");
