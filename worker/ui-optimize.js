// AI Nav Loop v3 — 120项开发迭代完成 — 每30分钟：数据引擎迭代 + UI巡检 + 自动部署
const BASE = "/Users/lasky_my/ai-nav";
const DENO = "/Users/lasky_my/.deno/bin/deno";
const SERVER = "http://localhost:8765";
const SKIP = ["clock.html","clock-old.html","clock-proj.html","obd-dash.html","test.html","index.html","bilibili.html"];

console.log(`[Loop] ${new Date().toISOString()}`);

// ═══ Part A: 数据引擎健康检查 ═══
console.log("[Loop] 数据引擎检查...");
const dataApis = [
  ["/api/trending/github", "GitHub Trending"],
  ["/api/trending/hn", "HackerNews"],
  ["/api/news-summary", "AI新闻摘要"],
  ["/api/financial/latest", "金融简报"],
  ["/api/db/stats", "DB统计"],
];
let dataOK = 0, dataFail = 0;
for (const [path, name] of dataApis) {
  try {
    const r = await fetch(SERVER + path, { signal: AbortSignal.timeout(5000) });
    if (r.ok) { dataOK++; } else { console.log(`[Loop] ⚠️ ${name}: HTTP ${r.status}`); dataFail++; }
  } catch (e) { console.log(`[Loop] ⚠️ ${name}: ${e.message}`); dataFail++; }
}

// ═══ Part A2: 热点数据持久化到DB ═══
try {
  const persistSources = ["/api/trending/github", "/api/news-summary"];
  for (const src of persistSources) {
    const r = await fetch(SERVER + src, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) continue;
    const d = await r.json();
    const items = d.items || [];
    if (items.length > 0) {
      const text = items.map(i => i.title || i.name || '').join(' ').slice(0, 5000);
      const r2 = await fetch(SERVER + "/api/auto/update", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({status:"success",summary:text.slice(0,200)})
      });
    }
  }
} catch(e) {}

console.log(`[Loop] 数据API: ${dataOK}/${dataApis.length} 正常`);
  // Update alert state
  for (const [path, name] of dataApis) {
    try {
      const r = await fetch(SERVER + path, { signal: AbortSignal.timeout(5000) });
      if (!r.ok) {
        if (!alerts[name]) alerts[name] = { failCount: 0, lastFail: null };
        alerts[name].failCount++;
        alerts[name].lastFail = new Date().toISOString();
        if (alerts[name].failCount >= 3) console.log(`[Loop] 🚨 ${name} 连续${alerts[name].failCount}次失败!`);
      } else { if (alerts[name]?.failCount >= 3) console.log(`[Loop] ✅ ${name} 已恢复`); alerts[name] = { failCount: 0, lastFail: null }; }
    } catch(e) { if (!alerts[name]) alerts[name] = { failCount: 0, lastFail: null }; alerts[name].failCount++; alerts[name].lastFail = new Date().toISOString(); }
  }
  try { await Deno.writeTextFile(ALERT_FILE, JSON.stringify(alerts)); } catch(e) {}

// ═══ Part B: UI巡检 ═══
const files = [...Deno.readDirSync(BASE)].filter(f => f.name.endsWith(".html") && !SKIP.includes(f.name));
const picked = files.sort(() => Math.random() - 0.5).slice(0, 2).map(f => f.name);
console.log(`[Loop] UI巡检: ${picked.join(", ")}`);

let fixed = 0;
for (const name of picked) {
  const path = `${BASE}/${name}`;
  let html = await Deno.readTextFile(path);
  let changes = [];

  // h1渐变
  if (!html.includes("tFlow") && html.includes("<h1>")) {
    html = html.replace("</style>", "@keyframes tFlow{0%{background-position:0 50%}50%{background-position:100% 100%}100%{background-position:0 50%}}\n</style>");
    html = html.replace(/h1\{([^}]*)\}/g, (m, inner) => inner.includes("linear-gradient") ? m : `h1{${inner};background:linear-gradient(135deg,var(--a1),var(--cyan),var(--pink));background-size:300% 300%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:tFlow 5s ease-in-out infinite}`);
    changes.push("h1渐变");
  }
  // 3光球
  if ((html.match(/<div class="bg__orb"><\/div>/g) || []).length === 2) {
    html = html.replace("</div></div>", "</div><div class=\"bg__orb\"></div></div>");
    if (!html.includes("nth-child(3)")) html = html.replace("</style>", ".bg__orb:nth-child(3){width:350px;height:350px;background:radial-gradient(circle,var(--cyan) 0%,transparent 70%);top:50%;left:50%;animation:floatOrb 22s ease-in-out infinite;animation-delay:-7s}\n</style>");
    changes.push("3光球");
  }
  // card::after
  if (html.includes(".card{") && !html.includes("card::after")) {
    html = html.replace(".card{", ".card{position:relative;overflow:hidden;");
    html = html.replace("</style>", ".card::after{content:'';position:absolute;inset:0;border-radius:inherit;background:linear-gradient(135deg,rgba(255,255,255,.04) 0%,transparent 45%,transparent 65%,rgba(255,255,255,.01) 100%);pointer-events:none}\n</style>");
    changes.push("card::after");
  }
  // floatOrb
  if (html.includes("bg__orb") && !html.includes("@keyframes floatOrb")) {
    html = html.replace("</style>", "@keyframes floatOrb{0%,100%{transform:translate(0,0)scale(1)}25%{transform:translate(80px,-60px)scale(1.15)}50%{transform:translate(-40px,40px)scale(.9)}75%{transform:translate(-60px,-30px)scale(1.1)}}\n</style>");
    changes.push("floatOrb");
  }
  // fadeUp
  if (!html.includes("fadeUp") && html.includes(".card{")) {
    html = html.replace("</style>", "@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}\n.card{animation:fadeUp .5s cubic-bezier(.22,1,.36,1) both}\n</style>");
    changes.push("fadeUp");
  }
  // Google Fonts
  if (html.includes("fonts.googleapis.com")) {
    html = html.replace(/@import url\('https:\/\/fonts.googleapis.com[^']*'\);/g, "");
    html = html.replace(/'Inter',\s*/g, "");
    changes.push("去GoogleFonts");
  }

  if (changes.length > 0) {
    await Deno.writeTextFile(path, html);
    console.log(`[Loop] ✅ ${name}: ${changes.join(", ")}`);
    fixed++;
  } else {
    console.log(`[Loop] ⏭ ${name}: 已达标`);
  }
}


// ═══ Part E: 安全检查 ═══
try {
  for (const name of picked.slice(0,1)) {
    const html = await Deno.readTextFile(`${BASE}/${name}`);
    if (html.includes("eval(") || (html.includes("innerHTML") && html.includes("+"))) {
      console.log(`[Loop] ⚠️ ${name}: 潜在XSS风险`);
    }
  }
} catch(e) {}

// ═══ Part C: 提交推送 ═══
if (fixed > 0) {
  const a = new Deno.Command("git", { args: ["-C", BASE, "add", "-A"] }); await a.output();
  const c = new Deno.Command("git", { args: ["-C", BASE, "commit", "-m", `Loop: UI巡检修复${fixed}页 + 数据引擎${dataOK}/${dataApis.length}正常`] });
  const cr = await c.output();
  if (cr.code === 0) {
    const p = new Deno.Command("git", { args: ["-C", BASE, "push", "origin", "main"] }); await p.output();
    console.log(`[Loop] ✅ 已提交推送 (${fixed}修)`);
  }
}

// ═══ Part D: 过期数据清理 ═══
try {
  const now = Date.now();
  const cacheKeys = Object.keys(localStorage||{});
  for (const k of cacheKeys) {
    if (k.startsWith('trending-') || k.startsWith('insight-')) {
      const d = JSON.parse(localStorage[k]);
      if (d.updated && now - new Date(d.updated).getTime() > 86400000) {
        delete localStorage[k];
        console.log(`[Loop] 🧹 清理过期缓存: ${k}`);
      }
    }
  }
} catch(e) {}

console.log(`[Loop] 完成: UI${fixed}修/${2-fixed}跳 数据${dataOK}/${dataApis.length}`);
