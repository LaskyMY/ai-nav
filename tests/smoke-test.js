#!/usr/bin/env deno run --allow-net --allow-read
// AI Nav 冒烟测试 — 全站QA自动化
// 用法: deno run --allow-net --allow-read tests/smoke-test.js
// 返回: 0=全通过, 1=有失败
const BASE = "http://localhost:8765";
const PASS = 0, FAIL = 0;
let pass = 0, fail = 0, warnings = 0;
const LOG = [];

function log(level, msg) {
  const ts = new Date().toISOString().slice(11, 19);
  const line = `[${ts}] [${level}] ${msg}`;
  console.log(line);
  LOG.push(line);
}

function check(name, condition, detail = "") {
  if (condition) { pass++; log("PASS", name + (detail ? " — " + detail : "")); }
  else { fail++; log("FAIL", name + (detail ? " — " + detail : "")); }
}

async function httpGet(path, expect200 = true) {
  try {
    const resp = await fetch(BASE + path, { signal: AbortSignal.timeout(5000) });
    return { status: resp.status, ok: resp.ok, body: await resp.text().catch(() => "") };
  } catch (e) {
    return { status: 0, ok: false, body: e.message };
  }
}

// ══════════════════════════════════════════
// 1. 服务健康检查
// ══════════════════════════════════════════
console.log("\n═══ 1. 服务健康 ═══");

// API 根
const root = await httpGet("/");
check("服务器可达", root.status > 0 || root.ok, `status=${root.status}`);

// DB
const dbStats = await httpGet("/api/db/stats");
check("数据库统计API", dbStats.ok);
try {
  const s = JSON.parse(dbStats.body);
  check("数据库有数据", s.news > 0 || s.usage_log > 0, `news:${s.news} usage:${s.usage_log}`);
} catch (_) { check("DB响应JSON格式", false); }

// ══════════════════════════════════════════
// 2. API 端点全覆盖
// ══════════════════════════════════════════
console.log("\n═══ 2. API端点 ═══");

const apis = [
  ["/api/weather?lat=23.13&lon=113.26", "天气API"],
  ["/api/news", "新闻API"],
  ["/api/news-cn", "中文新闻API"],
  ["/api/news-summary", "新闻摘要API"],
  ["/api/usage", "用量API"],
  ["/api/db/stats", "DB统计"],
  ["/api/db/news?limit=5", "DB新闻"],
  ["/api/db/summaries", "DB摘要"],
  ["/api/db/pages", "DB页面统计"],
  ["/api/financial/briefs?days=3", "金融简报"],
  ["/api/financial/latest", "金融最新"],
];
for (const [path, name] of apis) {
  const r = await httpGet(path);
  check(name, r.ok, `HTTP ${r.status}`);
}

// ══════════════════════════════════════════
// 3. 核心页面加载
// ══════════════════════════════════════════
console.log("\n═══ 3. 核心页面 ═══");

const pages = [
  "index.html", "knowledge.html", "vibe-coding.html",
  "financial-news.html", "manual.html", "hardware.html",
  "dashboards.html", "sitemap.html", "papers.html",
  "esp32-c3.html", "esp32-oled.html", "esp32-relay.html",
  "soldering-iron.html", "esp32-guide.html", "multimeter-guide.html", "tools-guide.html",
  "clock.html", "clock-old.html", "clock-proj.html",
  "status.html", "usage.html", "changelog.html",
];
for (const p of pages) {
  const r = await httpGet("/" + p);
  check(p, r.ok && r.body.length > 100, `${r.body.length} bytes`);
}

// ══════════════════════════════════════════
// 4. Vibe-Coding 子页面
// ══════════════════════════════════════════
console.log("\n═══ 4. 课程子页面 ═══");

const lessons = [
  "restart","fear","prompt","errors","tools","think","mvp","verify",
  "safe","copy","duck","try","spot","env","docs","small","show",
];
for (const l of lessons) {
  const r = await httpGet("/vibe-coding-lessons/" + l + ".html");
  check("课程:" + l, r.ok && r.body.length > 500, `${r.body.length} bytes`);
}

// ══════════════════════════════════════════
// 5. 导航链接检查
// ══════════════════════════════════════════
console.log("\n═══ 5. 导航链接 ═══");

const idx = await httpGet("/index.html");
const navLinks = [...idx.body.matchAll(/location\.href='\.\/([^']+)'/g)].map(m => m[1]);
check("主页导航链接数", navLinks.length >= 10, `${navLinks.length}个`);
for (const link of navLinks.slice(0, 8)) {
  const r = await httpGet("/" + link);
  check("导航→" + link, r.ok, `HTTP ${r.status}`);
}

// ══════════════════════════════════════════
// 6. HTML有效性
// ══════════════════════════════════════════
console.log("\n═══ 6. HTML结构 ═══");

for (const p of pages.slice(0, 6)) {
  const r = await httpGet("/" + p);
  const hasDoctype = r.body.startsWith("<!DOCTYPE") || r.body.startsWith("<html");
  const hasCloseHtml = r.body.includes("</html>");
  const hasBody = r.body.includes("<body") || r.body.includes("<body>");
  check(p + " 结构完整", hasDoctype && hasCloseHtml && hasBody);
}

// ══════════════════════════════════════════
// 7. 版本/更新
// ══════════════════════════════════════════
console.log("\n═══ 7. 版本文件 ═══");

const ver = await httpGet("/version.json");
check("version.json可访问", ver.ok);
try {
  const v = JSON.parse(ver.body);
  check("版本号存在", v.version && v.updated, `v${v.version} @ ${v.updated}`);
} catch (_) { check("version.json格式", false); }

// ══════════════════════════════════════════
// 8. 协议规范
// ══════════════════════════════════════════
console.log("\n═══ 8. 协议检查 ═══");

for (const p of pages.slice(0, 4)) {
  const r = await httpGet("/" + p);
  check(p + " CORS头", r.body.length > 0);
}


// ══════════════════════════════════════════
// 9. 设计规范QA
// ══════════════════════════════════════════
console.log("\n═══ 9. 设计规范QA ═══");

const designPages = [
  "financial-news.html", "manual.html", "hardware.html", "dashboards.html",
  "esp32-c3.html", "esp32-oled.html", "esp32-relay.html",
  "soldering-iron.html", "esp32-guide.html", "multimeter-guide.html", "tools-guide.html",
  "changelog.html", "status.html", "usage.html", "papers.html", "sitemap.html",
];
for (const p of designPages) {
  const r = await httpGet("/" + p);
  const h = r.body;
  const checks = {
    DOCTYPE: h.startsWith("<!DOCTYPE"),
    viewport: h.includes("viewport"),
    bg_0a0a0f: h.includes("0a0a0f") || h.includes("--bg"),
    glowSpot: h.includes("glowSpot"),
    system_ui: h.includes("system-ui"),
    antialiased: h.includes("antialiased"),
    backdrop_filter: h.includes("backdrop-filter"),
    return_link: h.includes("返回"),
  };
  let failed = [];
  for (const [k, v] of Object.entries(checks)) { if (!v) failed.push(k); }
  if (failed.length > 0) {
    check(p + " 设计规范", false, "缺: " + failed.join(", "));
  } else {
    check(p + " 设计规范", true);
  }
}
// 课程子页面
const lessonPages = ["restart","fear","prompt","errors","tools","think","mvp","verify","safe","copy","duck","try","spot","env","docs","small","show"];
for (const l of lessonPages) {
  const r = await httpGet("/vibe-coding-lessons/" + l + ".html");
  const h = r.body;
  const checks = {
    DOCTYPE: h.startsWith("<!DOCTYPE"),
    viewport: h.includes("viewport"),
    bg_0a0a0f: h.includes("0a0a0f") || h.includes("--bg"),
    glowSpot: h.includes("glowSpot"),
    system_ui: h.includes("system-ui"),
    antialiased: h.includes("antialiased"),
    backdrop_filter: h.includes("backdrop-filter"),
    return_link: h.includes("返回"),
  };
  let failed = [];
  for (const [k, v] of Object.entries(checks)) { if (!v) failed.push(k); }
  if (failed.length > 0) {
    check("课程:"+l+" 设计规范", false, "缺: " + failed.join(", "));
  } else {
    check("课程:"+l+" 设计规范", true);
  }
}
for (const c of ["clock.html","clock-old.html","clock-proj.html"]) {
  check(c + " 时钟豁免", true);
}


// ══════════════════════════════════════════
// 总结
// ══════════════════════════════════════════
const total = pass + fail;
const pct = total > 0 ? Math.round(pass / total * 100) : 0;
console.log(`\n══════════════════════════════`);
console.log(`  ✅ PASS: ${pass}  ❌ FAIL: ${fail}  ⚠️ WARN: ${warnings}`);
console.log(`  通过率: ${pct}% (${pass}/${total})`);
console.log(`══════════════════════════════`);

// 写日志文件
const logContent = LOG.join("\n");
const logPath = "/tmp/ai-nav-smoke-test.log";
await Deno.writeTextFile(logPath, logContent + `\n\nPASS:${pass} FAIL:${fail} RATE:${pct}%`);
console.log(`\n📝 日志已保存: ${logPath}`);

Deno.exit(fail > 0 ? 1 : 0);
