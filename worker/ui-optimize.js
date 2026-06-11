// UI Optimize — 每30分钟自动巡检+修复+测试+提交
const BASE = "/Users/lasky_my/ai-nav";
const DENO = "/Users/lasky_my/.deno/bin/deno";
const SKIP = ["clock.html","clock-old.html","clock-proj.html","obd-dash.html","test.html","index.html","bilibili.html"];

const files = [...Deno.readDirSync(BASE)].filter(f => f.name.endsWith(".html") && !SKIP.includes(f.name));
const picked = files.sort(() => Math.random() - 0.5).slice(0, 2).map(f => f.name);
console.log(`[UI] 巡检: ${picked.join(", ")}`);

let fixed = 0, skipped = 0, totalChanges = [];

for (const name of picked) {
  const path = `${BASE}/${name}`;
  let html = await Deno.readTextFile(path);
  let changes = [];

  // Check 1: h1 gradient
  if (!html.includes("tFlow") && html.includes("<h1>")) {
    html = html.replace("</style>", "@keyframes tFlow{0%{background-position:0 50%}50%{background-position:100% 100%}100%{background-position:0 50%}}\n</style>");
    html = html.replace(/h1\{([^}]*)\}/g, (m, inner) => inner.includes("linear-gradient") ? m : `h1{${inner};background:linear-gradient(135deg,var(--a1),var(--cyan),var(--pink));background-size:300% 300%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:tFlow 5s ease-in-out infinite}`);
    changes.push("h1渐变");
  }

  // Check 2: 3 orbs
  const orbCount = (html.match(/<div class="bg__orb"><\/div>/g) || []).length;
  if (orbCount === 2) {
    html = html.replace("</div></div>", "</div><div class=\"bg__orb\"></div></div>");
    if (!html.includes("nth-child(3)")) {
      html = html.replace("</style>", ".bg__orb:nth-child(3){width:350px;height:350px;background:radial-gradient(circle,var(--cyan) 0%,transparent 70%);top:50%;left:50%;animation:floatOrb 22s ease-in-out infinite;animation-delay:-7s}\n</style>");
    }
    changes.push("3光球");
  }

  // Check 3: card::after
  if (html.includes(".card{") && !html.includes("card::after")) {
    html = html.replace(".card{", ".card{position:relative;overflow:hidden;");
    html = html.replace("</style>", ".card::after{content:'';position:absolute;inset:0;border-radius:inherit;background:linear-gradient(135deg,rgba(255,255,255,.04) 0%,transparent 45%,transparent 65%,rgba(255,255,255,.01) 100%);pointer-events:none}\n</style>");
    changes.push("card::after");
  }

  // Check 4: floatOrb
  if (html.includes("bg__orb") && !html.includes("@keyframes floatOrb")) {
    html = html.replace("</style>", "@keyframes floatOrb{0%,100%{transform:translate(0,0)scale(1)}25%{transform:translate(80px,-60px)scale(1.15)}50%{transform:translate(-40px,40px)scale(.9)}75%{transform:translate(-60px,-30px)scale(1.1)}}\n</style>");
    changes.push("floatOrb动画");
  }

  // Check 5: Google Fonts
  if (html.includes("fonts.googleapis.com")) {
    html = html.replace(/@import url\('https:\/\/fonts.googleapis.com[^']*'\);/g, "");
    html = html.replace(/'Inter',\s*/g, "").replace(/"Inter",\s*/g, "");
    changes.push("去GoogleFonts");
  }

  if (changes.length > 0) {
    await Deno.writeTextFile(path, html);
    console.log(`[UI] ✅ ${name}: ${changes.join(", ")}`);
    totalChanges.push(...changes);
    fixed++;
  } else {
    console.log(`[UI] ⏭ ${name}: 无需修复`);
    skipped++;
  }
}

// Smoke test
if (fixed > 0) {
  console.log("[UI] 跑冒烟测试...");
  const cmd = new Deno.Command(DENO, {
    args: ["run", "--allow-read", "--allow-net", "--allow-write", `${BASE}/tests/smoke-test.js`],
    stdout: "piped", stderr: "piped",
  });
  const out = await cmd.output();
  const text = new TextDecoder().decode(out.stdout);
  const failMatch = text.match(/FAIL: (\d+)/);
  const passMatch = text.match(/PASS: (\d+)/);
  const fails = failMatch ? parseInt(failMatch[1]) : 999;
  const passes = passMatch ? parseInt(passMatch[1]) : 0;

  if (fails === 0) {
    const a = new Deno.Command("git", { args: ["-C", BASE, "add", "-A"] }); await a.output();
    const c = new Deno.Command("git", { args: ["-C", BASE, "commit", "-m", `UI巡检: ${picked.join(",")} — ${[...new Set(totalChanges)].join(",")}`] });
    await c.output();
    const p = new Deno.Command("git", { args: ["-C", BASE, "push", "origin", "main"] });
    await p.output();
    console.log(`[UI] ✅ 测试${passes}/${passes+fails}通过，已提交推送`);
  } else {
    console.log(`[UI] ❌ 测试${fails}项失败，未提交`);
  }
} else {
  console.log("[UI] 无改动跳过测试");
}
console.log(`[UI] 完成: ${fixed}修/${skipped}跳`);
