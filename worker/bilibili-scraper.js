// Bilibili ForAI Favorites Scraper + Page Generator
// Fetches videos from user's "ForAI" favorites folder and generates static HTML pages.

import { ensureDir } from "https://deno.land/std@0.224.0/fs/mod.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

// ═══ Constants ═══
const MEDIA_ID = 4054260043;
const UID = 30993043;
const API_BASE = "https://api.bilibili.com/x/v3/fav/resource/list";
const PAGE_SIZE = 20;
const BASE_DIR = "/Users/lasky_my/ai-nav";
const BILI_DIR = join(BASE_DIR, "bilibili");
const MANIFEST_PATH = join(BILI_DIR, "manifest.json");
const BUVID_PATH = join(BILI_DIR, "buvid3.txt");
const VER = "b1";

// ═══ Helpers ═══
function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function rateLimitDelay() {
  const jitter = Math.floor(Math.random() * 1000);
  await delay(1500 + jitter);
}

function fmt(n) {
  if (!n && n !== 0) return "0";
  if (n >= 10000) return (n / 10000).toFixed(1) + "万";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

function fmtTime(ts) {
  if (!ts) return "未知";
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDuration(sec) {
  if (!sec) return "00:00";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function escapeHtml(s) {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Parse intro text into structured sections for 136 reading mode
function parseIntroSections(intro) {
  if (!intro || intro.length < 10) return { digest: "(暂无简介)", points: [] };

  const text = intro.trim();
  // Try to split by newlines, periods, or numbered items
  const lines = text.split(/[\n\r]+/).filter(l => l.trim().length > 0);
  const points = [];

  // Extract key points (lines that look like facts/tips)
  for (const line of lines) {
    const clean = line.replace(/^[\d]+[\.\、\s]+/, '').replace(/^[-•·]+/, '').trim();
    if (clean.length > 8 && clean.length < 120 && !clean.startsWith('来源') && !clean.startsWith('上传') && !clean.startsWith('http')) {
      points.push(clean);
    }
  }

  // Build digest: first ~200 chars as overview
  const firstLine = lines[0] || text.slice(0, 200);
  const digest = firstLine.length > 200 ? firstLine.slice(0, 200) + '…' : firstLine;

  // Build structured digest for 3-min reading
  let digest3 = text;
  if (text.length > 600) {
    // Truncate intelligently at sentence boundary
    const truncated = text.slice(0, 600);
    const lastPeriod = Math.max(truncated.lastIndexOf('！'), truncated.lastIndexOf('。'), truncated.lastIndexOf('？'));
    digest3 = lastPeriod > 300 ? truncated.slice(0, lastPeriod + 1) + '…' : truncated + '…';
  }

  return { digest: digest3, points: points.slice(0, 12) };
}

// ═══ buvid3 ═══
function genBuvid3() {
  const hex = "0123456789abcdef";
  let u = "";
  for (let i = 0; i < 32; i++) {
    if ([8, 12, 16, 20].includes(i)) u += "-";
    if (i === 12) u += "4";
    else if (i === 16) u += hex[(Math.random() * 4 | 0) + 8];
    else u += hex[Math.random() * 16 | 0];
  }
  return u.toUpperCase();
}

async function getBuvid3() {
  try {
    const txt = await Deno.readTextFile(BUVID_PATH);
    if (txt.trim()) return txt.trim();
  } catch { /* file doesn't exist */ }
  const id = genBuvid3();
  await ensureDir(BILI_DIR);
  await Deno.writeTextFile(BUVID_PATH, id);
  return id;
}

// ═══ API ═══
async function fetchFavoritesPage(pageNum) {
  const buvid3 = await getBuvid3();
  const url = `${API_BASE}?media_id=${MEDIA_ID}&pn=${pageNum}&ps=${PAGE_SIZE}&platform=web&order=mtime`;

  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Referer": `https://space.bilibili.com/${UID}/favlist?fid=${MEDIA_ID}`,
      "Cookie": `buvid3=${buvid3}`,
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
  }

  const json = await resp.json();
  if (json.code !== 0) {
    throw new Error(`API error code ${json.code}: ${json.message}`);
  }

  return json.data;
}

async function fetchAllFavorites() {
  const allMedias = [];
  let page = 1;

  // Fetch first page
  const firstPage = await fetchFavoritesPage(page);
  for (const m of firstPage.medias || []) {
    if (m.type === 2 && m.title !== "已失效视频") allMedias.push(m);
  }
  const total = firstPage.info?.media_count || allMedias.length;

  console.log(`[bilibili] Page 1: ${firstPage.medias?.length || 0} videos (total: ${total})`);

  // Fetch remaining pages
  while (firstPage.has_more) {
    page++;
    await rateLimitDelay();
    try {
      const data = await fetchFavoritesPage(page);
      for (const m of data.medias || []) {
        if (m.type === 2 && m.title !== "已失效视频") allMedias.push(m);
      }
      console.log(`[bilibili] Page ${page}: ${data.medias?.length || 0} videos`);
      if (!data.has_more) break;
    } catch (e) {
      console.error(`[bilibili] Page ${page} fetch failed: ${e.message}`);
      break;
    }
  }

  return allMedias;
}

// ═══ Manifest ═══
async function loadManifest() {
  try {
    const raw = await Deno.readTextFile(MANIFEST_PATH);
    return JSON.parse(raw);
  } catch {
    return {
      version: 1,
      folder_title: "ForAI",
      media_id: MEDIA_ID,
      last_full_update: null,
      total_videos: 0,
      videos: {},
    };
  }
}

async function saveManifest(m) {
  await ensureDir(BILI_DIR);
  await Deno.writeTextFile(MANIFEST_PATH, JSON.stringify(m, null, 2));
}

// ═══ Page Generation ═══
function generateVideoPage(meta) {
  const {
    bvid, title, cover, duration, play_count, danmaku_count,
    pubtime, fav_time, upper_name, intro,
  } = meta;

  const durStr = fmtDuration(duration);
  const playStr = fmt(play_count);
  const danmuStr = fmt(danmaku_count);
  const pubDate = fmtTime(pubtime);
  const favDate = fmtTime(fav_time);
  const biliUrl = `https://www.bilibili.com/video/${bvid}`;
  const desc = escapeHtml(intro) || "(暂无简介)";
  const coverUrl = cover ? cover.replace("http://", "https://") : "";

  // Parse intro into structured sections for 136 reading mode
  const sections = parseIntroSections(intro);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,viewport-fit=cover">
<meta name="theme-color" content="#0a0a0f">
<title>${escapeHtml(title)} · B站视频整理</title>
<link rel="icon" href="../icon.svg">
<style>
:root{--bg:#0a0a0f;--card-bg:rgba(255,255,255,.05);--card-border:rgba(255,255,255,.08);--a1:#6366f1;--cyan:#06B6D4;--pink:#ec4899;--amber:#F59E0B;--green:#10B981;--tx:rgba(255,255,255,.92);--tx2:rgba(255,255,255,.55);--tx3:rgba(255,255,255,.35);--tx4:rgba(255,255,255,.18);--r:16px;--ease:cubic-bezier(.22,1,.36,1)}
*,::before,::after{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--tx);font-size:14px;line-height:1.7;min-height:100vh;padding-bottom:80px;-webkit-font-smoothing:antialiased;overflow-x:hidden}
.bg{position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:0}
.bg__orb{position:absolute;border-radius:50%;filter:blur(120px);opacity:.3}
.bg__orb:nth-child(1){width:500px;height:500px;background:radial-gradient(circle,var(--pink) 0%,transparent 70%);top:-15%;left:-10%;animation:floatOrb 20s ease-in-out infinite}
.bg__orb:nth-child(2){width:400px;height:400px;background:radial-gradient(circle,var(--cyan) 0%,transparent 70%);bottom:-10%;right:-8%;animation:floatOrb 24s ease-in-out infinite reverse}
.bg__orb:nth-child(3){width:350px;height:350px;background:radial-gradient(circle,var(--a1) 0%,transparent 70%);top:50%;left:50%;animation:floatOrb 22s ease-in-out infinite;animation-delay:-7s}
@keyframes floatOrb{0%,100%{transform:translate(0,0)scale(1)}25%{transform:translate(80px,-60px)scale(1.15)}50%{transform:translate(-40px,40px)scale(.9)}75%{transform:translate(-60px,-30px)scale(1.1)}}
.glow-spot{position:fixed;inset:0;pointer-events:none;z-index:0;opacity:1}
.wrap{max-width:760px;margin:0 auto;padding:20px;position:relative;z-index:1}

h1{font-size:22px;font-weight:700;margin:12px 0 4px;background:linear-gradient(135deg,var(--pink),var(--cyan),var(--a1));background-size:300% 300%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:tFlow 5s ease-in-out infinite}
@keyframes tFlow{0%{background-position:0% 50%}50%{background-position:100% 100%}100%{background-position:0% 50%}}
.sub{font-size:11px;color:var(--tx3);margin-bottom:16px}

/* ── 136 Reading Mode ── */
.reading-mode{display:flex;gap:8px;margin:14px 0}
.mode-btn{flex:1;padding:10px 6px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.02);color:var(--tx3);font-size:11px;cursor:pointer;text-align:center;transition:all .3s;font-family:inherit}
.mode-btn:hover{border-color:rgba(236,72,153,.2);color:var(--tx2)}
.mode-btn.active{border-color:rgba(236,72,153,.4);background:rgba(236,72,153,.08);color:var(--pink);font-weight:600}
.mode-time{display:block;font-size:22px;font-weight:700;margin-bottom:2px}
.mode-label{font-size:10px;opacity:.6}

.content-section{margin:10px 0;transition:all .3s}
.content-section.hidden{display:none}

/* ── Hero Cover ── */
.video-hero{position:relative;border-radius:16px;overflow:hidden;margin-bottom:12px;border:1px solid rgba(255,255,255,.08);aspect-ratio:16/9;background:rgba(0,0,0,.3)}
.video-hero img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .5s var(--ease)}
.video-hero:hover img{transform:scale(1.03)}
.video-hero .play-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.35);opacity:0;transition:opacity .3s}
.video-hero:hover .play-overlay{opacity:1}
.play-btn{width:56px;height:56px;border-radius:50%;background:rgba(236,72,153,.5);backdrop-filter:blur(8px);border:2px solid rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:20px;color:#fff;transition:all .3s}

/* ── Glass Card ── */
.card{background:var(--card-bg);backdrop-filter:saturate(180%) blur(40px);-webkit-backdrop-filter:saturate(180%) blur(40px);border:1px solid var(--card-border);border-radius:var(--r);padding:18px;margin-bottom:10px;position:relative;overflow:hidden}
.card::after{content:'';position:absolute;inset:0;border-radius:inherit;background:linear-gradient(135deg,rgba(255,255,255,.04) 0%,transparent 45%,transparent 65%,rgba(255,255,255,.01) 100%);pointer-events:none}
h2{font-size:15px;font-weight:700;color:var(--pink);margin:0 0 10px;padding-left:12px;border-left:3px solid var(--pink)}
h3{font-size:13px;font-weight:600;color:var(--tx);margin:14px 0 6px}

/* ── Meta Grid ── */
.meta-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}
.meta-item{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--tx2);padding:8px 10px;background:rgba(255,255,255,.02);border-radius:8px}
.meta-icon{font-size:15px;flex-shrink:0}
.meta-item b{color:var(--tx);font-weight:600}

/* ── Content ── */
.desc{font-size:13px;color:var(--tx2);line-height:2;white-space:pre-wrap}
.section-body{font-size:13px;color:var(--tx2);line-height:1.9}
.tag{display:inline-block;padding:4px 10px;border-radius:8px;background:rgba(236,72,153,.08);color:var(--pink);font-size:10px;margin:2px;border:1px solid rgba(236,72,153,.12)}
.tag-blue{background:rgba(99,102,241,.08);color:var(--a1);border-color:rgba(99,102,241,.12)}
.tag-cyan{background:rgba(6,182,212,.08);color:var(--cyan);border-color:rgba(6,182,212,.12)}

/* ── Embed ── */
.video-embed{position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:12px;margin-top:8px}
.video-embed iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:none}

/* ── Buttons ── */
.btn{display:inline-block;padding:8px 16px;border-radius:10px;font-size:12px;text-decoration:none;transition:all .25s;margin:3px;font-family:inherit;cursor:pointer}
.btn-primary{background:rgba(236,72,153,.12);border:1px solid rgba(236,72,153,.25);color:var(--pink);font-weight:600}
.btn-primary:hover{background:rgba(236,72,153,.22)}
.btn-outline{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);color:var(--tx2)}
.btn-outline:hover{background:rgba(255,255,255,.06);color:var(--tx)}

/* ── Key Points ── */
.key-points{list-style:none;padding:0}
.key-points li{padding:6px 0;font-size:13px;color:var(--tx2);border-bottom:1px solid rgba(255,255,255,.03);display:flex;gap:8px}
.key-points li .kp-dot{width:6px;height:6px;border-radius:50%;background:var(--pink);flex-shrink:0;margin-top:7px}

/* ── Canvas Animation ── */
.anim-canvas{width:100%;height:120px;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,.05);background:rgba(0,0,0,.2);margin-bottom:12px}
.anim-canvas canvas{width:100%;height:100%;display:block}

.back-link{text-align:center;margin-top:24px}
.back-link a{color:var(--tx4);font-size:11px;text-decoration:none}

@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.card{animation:fadeUp .4s var(--ease) both}
.card:nth-child(2){animation-delay:.03s}.card:nth-child(3){animation-delay:.06s}

@media(max-width:500px){.wrap{padding:12px}h1{font-size:18px}.meta-grid{grid-template-columns:repeat(2,1fr)}.reading-mode{gap:4px}.mode-btn{padding:8px 4px}}
</style>
</head>
<body>
<div class="bg"><div class="bg__orb"></div><div class="bg__orb"></div><div class="bg__orb"></div></div>
<div class="glow-spot" id="glowSpot"></div>

<div class="wrap">

<!-- Hero Cover -->
${coverUrl ? `<a class="video-hero" href="${biliUrl}" target="_blank" rel="noopener">
  <img src="${coverUrl}" alt="${escapeHtml(title)}" loading="lazy" referrerpolicy="no-referrer">
  <div class="play-overlay"><div class="play-btn">▶</div></div>
</a>` : ""}

<h1>${escapeHtml(title)}</h1>
<p class="sub">👤 ${escapeHtml(upper_name)} · ▶ ${playStr} 播放 · 💬 ${danmuStr} 弹幕 · ⏱ ${durStr} · 📅 ${pubDate}</p>

<!-- ── 136 Reading Modes ── -->
<div class="reading-mode">
  <button class="mode-btn active" onclick="setMode('1min',this)"><span class="mode-time">1</span><span class="mode-label">分钟速览</span></button>
  <button class="mode-btn" onclick="setMode('3min',this)"><span class="mode-time">3</span><span class="mode-label">分钟梳理</span></button>
  <button class="mode-btn" onclick="setMode('6min',this)"><span class="mode-time">6</span><span class="mode-label">分钟深读</span></button>
</div>

<!-- ── Canvas Animation ── -->
<div class="anim-canvas"><canvas id="animC"></canvas></div>

<!-- ── Section 1: 一分钟速览（元数据卡片）── -->
<div class="content-section" id="s1">
  <div class="card"><h2>📋 视频信息</h2>
  <div class="meta-grid">
    <div class="meta-item"><span class="meta-icon">⏱</span><b>${durStr}</b><span style="font-size:10px">时长</span></div>
    <div class="meta-item"><span class="meta-icon">▶</span><b>${playStr}</b><span style="font-size:10px">播放</span></div>
    <div class="meta-item"><span class="meta-icon">💬</span><b>${danmuStr}</b><span style="font-size:10px">弹幕</span></div>
    <div class="meta-item"><span class="meta-icon">👤</span><b>${escapeHtml(upper_name)}</b></div>
    <div class="meta-item"><span class="meta-icon">📅</span><b>${pubDate}</b></div>
    <div class="meta-item"><span class="meta-icon">⭐</span>收藏于 ${favDate}</div>
  </div>
  <div style="margin-top:10px">
    <span class="tag">B站视频</span><span class="tag-blue">ForAI收藏夹</span><span class="tag-cyan">自动抓取</span>
  </div>
  </div>
</div>

<!-- ── Section 2: 三分钟内容梳理 ── -->
<div class="content-section" id="s2">
  <div class="card"><h2>📝 内容梳理</h2>
  <div class="section-body">${sections.digest}</div>
  ${sections.points.length > 0 ? `
  <h3>🔑 关键要点</h3>
  <ul class="key-points">${sections.points.map(p => `<li><span class="kp-dot"></span>${escapeHtml(p)}</span></li>`).join('')}</ul>` : ''}
  </div>
</div>

<!-- ── Section 3: 六分钟深读（原文+播放）── -->
<div class="content-section" id="s3">
  ${intro ? `<div class="card"><h2>📖 原文简介</h2><div class="desc">${desc}</div></div>` : ''}
  <div class="card"><h2>🎬 播放视频</h2>
  <div class="video-embed">
    <iframe src="//player.bilibili.com/player.html?bvid=${bvid}&page=1&high_quality=1" scrolling="no" allowfullscreen loading="lazy"></iframe>
  </div>
  <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">
    <a class="btn btn-primary" href="${biliUrl}" target="_blank" rel="noopener">在 Bilibili 观看 →</a>
    <a class="btn btn-outline" href="../bilibili.html">← 返回视频整理</a>
  </div>
  </div>
</div>

<div class="back-link">
  <a href="../bilibili.html">← 返回 B站视频整理</a> · <a href="../index.html">返回首页</a>
</div>
</div>

<!-- ── Scripts ── -->
<script>
// 136 Reading Mode
function setMode(mode,btn){
  document.querySelectorAll('.mode-btn').forEach(function(b){b.classList.remove('active')});
  btn.classList.add('active');
  var s1=document.getElementById('s1'),s2=document.getElementById('s2'),s3=document.getElementById('s3');
  if(mode==='1min'){s1.classList.remove('hidden');s2.classList.add('hidden');s3.classList.add('hidden')}
  else if(mode==='3min'){s1.classList.remove('hidden');s2.classList.remove('hidden');s3.classList.add('hidden')}
  else{s1.classList.remove('hidden');s2.classList.remove('hidden');s3.classList.remove('hidden')}
}

// Canvas particle animation
(function(){
  var c=document.getElementById('animC'),ctx=c.getContext('2d');
  var W,H,particles=[];
  function resize(){var box=c.parentElement;W=box.clientWidth;H=box.clientHeight;c.width=W;c.height=H}
  resize();window.addEventListener('resize',resize);
  for(var i=0;i<40;i++){particles.push({x:Math.random()*W,y:Math.random()*H,r:Math.random()*2+1,vx:(Math.random()-.5)*.5,vy:(Math.random()-.5)*.5,a:Math.random()*.3+.1})}
  function anim(){
    ctx.clearRect(0,0,W,H);
    for(var i=0;i<particles.length;i++){
      var p=particles[i];p.x+=p.vx;p.y+=p.vy;
      if(p.x<0)p.x=W;if(p.x>W)p.x=0;if(p.y<0)p.y=H;if(p.y>H)p.y=0;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle='rgba(236,72,153,'+p.a+')';ctx.fill();
    }
    // Draw connections
    for(var i=0;i<particles.length;i++){
      for(var j=i+1;j<particles.length;j++){
        var dx=particles[i].x-particles[j].x,dy=particles[i].y-particles[j].y;
        var dist=Math.sqrt(dx*dx+dy*dy);
        if(dist<80){ctx.beginPath();ctx.moveTo(particles[i].x,particles[i].y);ctx.lineTo(particles[j].x,particles[j].y);ctx.strokeStyle='rgba(236,72,153,'+(.06*(1-dist/80))+')';ctx.lineWidth=.5;ctx.stroke()}
      }
    }
    requestAnimationFrame(anim);
  }
  anim();
})();

// Glow
(function(){var g=document.getElementById('glowSpot');if(!g||('ontouchstart' in window))return;var x=innerWidth/2,y=innerHeight/2,tx=x,ty=y;document.addEventListener('mousemove',function(e){tx=e.clientX;ty=e.clientY});function anim(){x+=(tx-x)*0.05;y+=(ty-y)*0.05;g.style.background='radial-gradient(circle 420px at '+x.toFixed(0)+'px '+y.toFixed(0)+'px,rgba(236,72,153,.04) 0%,rgba(99,102,241,.025) 20%,rgba(6,182,212,.01) 45%,transparent 70%)';requestAnimationFrame(anim)}anim()})();
</script>
<script src="../shared.js"></script>
</body>
</html>`;}

// ═══ Hub Page Generation ═══
function generateHubPage(manifest) {
  const videos = Object.values(manifest.videos);
  videos.sort((a, b) => (b.fav_time || 0) - (a.fav_time || 0));

  const cardsHtml = videos.map(v => {
    const coverUrl = (v.cover || "").replace("http://", "https://");
    const durStr = fmtDuration(v.duration);
    const playStr = fmt(v.play_count);
    const pubDate = fmtTime(v.pubtime);
    return `
  <a class="vcard" href="./bilibili/${v.bvid}.html">
    <div class="vcard-cover">
      ${coverUrl ? `<img src="${coverUrl}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<div class="no-cover">🎬</div>'}
      <div class="vcard-overlay"><span class="play-icon">▶</span></div>
      <span class="vcard-dur">${durStr}</span>
    </div>
    <div class="vcard-body">
      <h3>${escapeHtml(v.title)}</h3>
      <div class="vcard-meta">
        <span>👤 ${escapeHtml(v.upper_name)}</span>
        <span>▶ ${playStr}</span>
        <span>📅 ${pubDate}</span>
      </div>
    </div>
  </a>`;
  }).join("\n");

  const lastUpdate = manifest.last_full_update
    ? new Date(manifest.last_full_update).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
    : "首次抓取中...";

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,viewport-fit=cover">
<meta name="theme-color" content="#0a0a0f">
<title>B站视频整理 · AI Nav</title>
<link rel="stylesheet" href="./shared.css">
<link rel="icon" href="./icon.svg">
<style>
:root{--bg:#0a0a0f;--card-bg:rgba(255,255,255,.04);--card-border:rgba(255,255,255,.07);--a1:#6366f1;--cyan:#06B6D4;--pink:#ec4899;--amber:#F59E0B;--green:#10B981;--tx:rgba(255,255,255,.92);--tx2:rgba(255,255,255,.55);--tx3:rgba(255,255,255,.35);--tx4:rgba(255,255,255,.18);--r:14px;--ease:cubic-bezier(.22,1,.36,1)}
*,::before,::after{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--tx);font-size:14px;line-height:1.6;min-height:100vh;padding-bottom:80px;-webkit-font-smoothing:antialiased;overflow-x:hidden}
.bg{position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:0}
.bg__orb{position:absolute;border-radius:50%;filter:blur(120px);opacity:.35}
.bg__orb:nth-child(1){width:500px;height:500px;background:radial-gradient(circle,var(--pink) 0%,transparent 70%);top:-15%;left:-10%;animation:floatOrb 20s ease-in-out infinite}
.bg__orb:nth-child(2){width:400px;height:400px;background:radial-gradient(circle,var(--cyan) 0%,transparent 70%);bottom:-10%;right:-8%;animation:floatOrb 24s ease-in-out infinite reverse}
.bg__orb:nth-child(3){width:350px;height:350px;background:radial-gradient(circle,var(--a1) 0%,transparent 70%);top:50%;left:50%;animation:floatOrb 22s ease-in-out infinite;animation-delay:-7s}
@keyframes floatOrb{0%,100%{transform:translate(0,0)scale(1)}25%{transform:translate(80px,-60px)scale(1.15)}50%{transform:translate(-40px,40px)scale(.9)}75%{transform:translate(-60px,-30px)scale(1.1)}}
.glow-spot{position:fixed;inset:0;pointer-events:none;z-index:0;opacity:1}
.wrap{max-width:860px;margin:0 auto;padding:20px;position:relative;z-index:1}

h1{font-size:24px;font-weight:700;margin:8px 0 4px;background:linear-gradient(135deg,var(--pink),var(--cyan),var(--a1));background-size:300% 300%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:tFlow 5s ease-in-out infinite}
@keyframes tFlow{0%{background-position:0% 50%}50%{background-position:100% 100%}100%{background-position:0% 50%}}
.sub{font-size:12px;color:var(--tx3);margin-bottom:16px}

/* Stats row */
.stats{display:flex;gap:10px;margin:10px 0 20px;flex-wrap:wrap}
.stat{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);border-radius:12px;padding:10px 16px;text-align:center;flex:1;min-width:80px}
.stat b{display:block;font-size:22px;color:var(--pink);font-weight:700}
.stat span{font-size:10px;color:var(--tx3)}

/* ── Video Card Grid ── */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin:18px 0}

/* Video card */
.vcard{background:var(--card-bg);backdrop-filter:saturate(180%) blur(40px);-webkit-backdrop-filter:saturate(180%) blur(40px);border:1px solid var(--card-border);border-radius:var(--r);overflow:hidden;text-decoration:none;color:var(--tx);transition:all .35s var(--ease);position:relative;animation:fadeUp .5s var(--ease) both}
.vcard::after{content:'';position:absolute;inset:0;border-radius:inherit;background:linear-gradient(135deg,rgba(255,255,255,.03) 0%,transparent 45%,transparent 65%,rgba(255,255,255,.01) 100%);pointer-events:none}
.vcard:hover{transform:translateY(-3px);border-color:rgba(236,72,153,.25);box-shadow:0 0 80px rgba(236,72,153,.08),0 12px 32px rgba(0,0,0,.2)}
.vcard:nth-child(2){animation-delay:.05s}.vcard:nth-child(3){animation-delay:.10s}.vcard:nth-child(4){animation-delay:.15s}.vcard:nth-child(5){animation-delay:.20s}.vcard:nth-child(6){animation-delay:.25s}.vcard:nth-child(7){animation-delay:.30s}.vcard:nth-child(8){animation-delay:.35s}
@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}

/* Cover image — the star of the show */
.vcard-cover{position:relative;aspect-ratio:16/9;background:rgba(0,0,0,.35);overflow:hidden}
.vcard-cover img{width:100%;height:100%;object-fit:cover;transition:transform .5s var(--ease)}
.vcard:hover .vcard-cover img{transform:scale(1.05)}
.vcard-cover .no-cover{display:flex;align-items:center;justify-content:center;height:100%;font-size:56px;background:linear-gradient(135deg,rgba(99,102,241,.15),rgba(236,72,153,.1))}

/* Hover play overlay */
.vcard-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.35);opacity:0;transition:opacity .3s}
.vcard:hover .vcard-overlay{opacity:1}
.play-icon{width:52px;height:52px;border-radius:50%;background:rgba(236,72,153,.5);backdrop-filter:blur(8px);border:2px solid rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff}

/* Duration badge */
.vcard-dur{position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,.75);color:#fff;font-size:10px;padding:3px 7px;border-radius:5px;font-weight:500;letter-spacing:.02em}

/* Card body */
.vcard-body{padding:14px 16px}
.vcard-body h3{font-size:14px;font-weight:600;line-height:1.5;margin-bottom:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.vcard-meta{display:flex;flex-wrap:wrap;gap:10px;font-size:11px;color:var(--tx3)}
.vcard-meta span{white-space:nowrap}

/* Empty */
.empty{text-align:center;padding:48px 20px;color:var(--tx4)}
.empty .emoji{font-size:64px;display:block;margin-bottom:12px}

.back-link{text-align:center;margin-top:28px}
.back-link a{color:var(--tx4);font-size:11px;text-decoration:none}

@media(max-width:500px){.wrap{padding:12px}h1{font-size:18px}.grid{grid-template-columns:1fr;gap:12px}.vcard-body{padding:12px}}
</style>
</head>
<body>
<div class="bg"><div class="bg__orb"></div><div class="bg__orb"></div><div class="bg__orb"></div></div>
<div class="glow-spot" id="glowSpot"></div>

<div class="wrap">
<h1>📺 B站视频整理</h1>
<p class="sub">ForAI 收藏夹定时抓取 · 封面即缩略图 · 每小时自动更新 · 最后更新：${lastUpdate}</p>

<div class="stats">
  <div class="stat"><b>${videos.length}</b><span>视频</span></div>
  <div class="stat"><b>每小时</b><span>自动抓取</span></div>
  <div class="stat"><b>ForAI</b><span>收藏夹</span></div>
</div>

${videos.length === 0 ? `<div class="empty"><span class="emoji">📭</span><p>暂无视频，等待首次抓取...</p></div>` : `<div class="grid">${cardsHtml}</div>`}

<div class="back-link">
  <a href="./index.html">← 返回首页</a> · <a href="./automations.html">⚙️ 自动化监控</a>
</div>
</div>

<script>
(function(){var g=document.getElementById('glowSpot');if(!g||('ontouchstart' in window))return;var x=innerWidth/2,y=innerHeight/2,tx=x,ty=y;document.addEventListener('mousemove',function(e){tx=e.clientX;ty=e.clientY});function anim(){x+=(tx-x)*0.05;y+=(ty-y)*0.05;g.style.background='radial-gradient(circle 420px at '+x.toFixed(0)+'px '+y.toFixed(0)+'px,rgba(236,72,153,.05) 0%,rgba(99,102,241,.03) 20%,rgba(6,182,212,.015) 45%,transparent 70%)';requestAnimationFrame(anim)}anim()})();
</script>
<script src="./shared.js"></script>
</body>
</html>`;
}

// ═══ Main Orchestrator ═══
export async function scrapeAndGenerate() {
  const startTime = Date.now();
  console.log(`\n[bilibili] ===== Scrape started: ${new Date().toISOString()} =====`);

  // Report to automation status (dual: API + file fallback)
  async function reportStatus(status, summary, errMsg) {
    const payload = { name: "bilibili-scraper", status, summary, error: errMsg, ts: new Date().toISOString() };
    // Try API first
    try {
      await fetch("http://localhost:8765/api/auto/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (_) {
      // Fallback: write status file for server to pick up later
      try {
        await Deno.writeTextFile("/tmp/bilibili-status.json", JSON.stringify(payload));
      } catch (_) {}
    }
  }

  try {
    await reportStatus("running", "抓取中...");

    // 1. Load manifest
    const manifest = await loadManifest();
    console.log(`[bilibili] Manifest loaded: ${Object.keys(manifest.videos).length} known videos`);

    // 2. Fetch all favorites
    const allMedias = await fetchAllFavorites();
    console.log(`[bilibili] Fetched ${allMedias.length} valid videos from API`);

    // 3. Identify new videos
    let newCount = 0;
    let skipCount = 0;

    for (const m of allMedias) {
      const bvid = m.bvid;

      if (manifest.videos[bvid]) {
        skipCount++;
        continue;
      }

      // Build metadata
      const meta = {
        bvid,
        title: m.title,
        intro: m.intro || "",
        cover: m.cover || "",
        duration: m.duration || 0,
        play_count: m.cnt_info?.play || 0,
        danmaku_count: m.cnt_info?.danmaku || 0,
        pubtime: m.pubtime || m.ctime || 0,
        fav_time: m.fav_time || 0,
        upper_name: m.upper?.name || "未知UP主",
        upper_mid: m.upper?.mid || 0,
      };

      // Generate page
      const html = generateVideoPage(meta);
      const pagePath = join(BILI_DIR, `${bvid}.html`);
      await Deno.writeTextFile(pagePath, html);

      // Save to manifest
      manifest.videos[bvid] = {
        ...meta,
        page_path: `bilibili/${bvid}.html`,
        generated_at: new Date().toISOString(),
      };

      newCount++;
      console.log(`[bilibili] Generated: bilibili/${bvid}.html — ${m.title}`);
    }

    // 4. Update manifest
    manifest.last_full_update = new Date().toISOString();
    manifest.total_videos = Object.keys(manifest.videos).length;
    await saveManifest(manifest);

    // 5. Generate hub page
    const hubHtml = generateHubPage(manifest);
    await Deno.writeTextFile(join(BASE_DIR, "bilibili.html"), hubHtml);
    console.log(`[bilibili] Hub page updated: bilibili.html`);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const summary = `${newCount} 新增, ${skipCount} 跳过 · ${manifest.total_videos} 总计 · ${elapsed}s`;
    console.log(`[bilibili] Done: ${summary}`);
    await reportStatus("success", summary);
  } catch (e) {
    console.error(`[bilibili] ERROR: ${e.message}`);
    await reportStatus("error", "抓取失败", e.message);
    throw e;
  }
}

// ═══ CLI Entry ═══
if (import.meta.main) {
  await scrapeAndGenerate();
  Deno.exit(0);
}
