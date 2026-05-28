#!/usr/bin/env python3
"""Generate 21 puxing-man pages with rich visual components."""
import os

CSS = '''<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
:root{--bg:#0a0a0f;--card-bg:rgba(255,255,255,.06);--card-border:rgba(255,255,255,.08);--a1:#6366f1;--a2:#10B981;--a3:#EF4444;--pink:#ec4899;--amber:#F59E0B;--cyan:#06B6D4;--vio:#a855f7;--tx:rgba(255,255,255,.92);--tx2:rgba(255,255,255,.55);--tx3:rgba(255,255,255,.35);--tx4:rgba(255,255,255,.18);--r:24px;--ease:cubic-bezier(.22,1,.36,1);--accent:var(--cyan);--accent-bg:rgba(6,182,212,.12);--accent-border:rgba(6,182,212,.2)}
.s-cyan{--accent:var(--cyan);--accent-bg:rgba(6,182,212,.12);--accent-border:rgba(6,182,212,.2)}
.s-green{--accent:var(--a2);--accent-bg:rgba(16,185,129,.12);--accent-border:rgba(16,185,129,.2)}
.s-indigo{--accent:var(--a1);--accent-bg:rgba(99,102,241,.12);--accent-border:rgba(99,102,241,.2)}
.s-amber{--accent:var(--amber);--accent-bg:rgba(245,158,11,.12);--accent-border:rgba(245,158,11,.2)}
*,::before,::after{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;background:var(--bg);color:var(--tx);font-size:15px;line-height:1.6;min-height:100vh;padding-bottom:calc(100px + env(safe-area-inset-bottom,0));-webkit-font-smoothing:antialiased;overflow-x:hidden;letter-spacing:-.01em}
::-webkit-scrollbar{width:2px;height:2px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.04);border-radius:1px}
::selection{background:rgba(6,182,212,.3)}
.bg{position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:0}
.bg__orb{position:absolute;border-radius:50%;filter:blur(120px);opacity:.5;will-change:transform}
.bg__orb:nth-child(1){width:500px;height:500px;background:radial-gradient(circle,var(--cyan) 0%,transparent 70%);top:-15%;left:-10%;animation:floatOrb 20s ease-in-out infinite}
.bg__orb:nth-child(2){width:400px;height:400px;background:radial-gradient(circle,var(--a1) 0%,transparent 70%);bottom:-10%;right:-8%;animation:floatOrb 24s ease-in-out infinite reverse}
.bg__orb:nth-child(3){width:350px;height:350px;background:radial-gradient(circle,var(--a2) 0%,transparent 70%);top:50%;left:50%;transform:translate(-50%,-50%);animation:floatOrb 20s ease-in-out infinite;animation-delay:-7s}
@keyframes floatOrb{0%,100%{transform:translate(0,0)scale(1)}25%{transform:translate(80px,-60px)scale(1.15)}50%{transform:translate(-40px,40px)scale(.9)}75%{transform:translate(-60px,-30px)scale(1.1)}}
.glow-spot{position:fixed;inset:0;pointer-events:none;z-index:0;background:radial-gradient(circle 420px at 50% 50%,rgba(6,182,212,.05),rgba(99,102,241,.04) 20%,rgba(16,185,129,.02) 45%,transparent 70%)}
.header{position:sticky;top:0;z-index:50;background:rgba(24,24,32,.78);border:1px solid rgba(255,255,255,.1);border-top:none;padding:10px 20px;border-radius:0 0 22px 22px;backdrop-filter:saturate(200%) blur(60px);-webkit-backdrop-filter:saturate(200%) blur(60px);box-shadow:0 0 40px rgba(6,182,212,.1),0 8px 32px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.04)}
.header-in{max-width:800px;margin:0 auto;display:flex;align-items:center;gap:10px}
.header-logo{font-size:17px;font-weight:700;white-space:nowrap;letter-spacing:-.02em;background:linear-gradient(135deg,var(--cyan),var(--a1),var(--a2));background-size:300% 300%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:tFlow 6s ease-in-out infinite}
@keyframes tFlow{0%{background-position:0% 50%}50%{background-position:100% 100%}100%{background-position:0% 50%}}
.back-btn{width:32px;height:32px;border-radius:8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--tx2);transition:all .3s var(--ease);flex-shrink:0;text-decoration:none}
.back-btn:hover{background:rgba(255,255,255,.1);color:var(--tx)}
.container{max-width:800px;margin:0 auto;padding:18px 20px;position:relative;z-index:1;will-change:transform}
.hero{text-align:center;padding:24px 0 10px}
.hero h1{font-size:26px;font-weight:700;letter-spacing:-.03em;margin-bottom:6px;background:linear-gradient(135deg,var(--accent),var(--a1));background-size:200% 200%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:tFlow 4s ease-in-out infinite}
.hero .sub{color:var(--tx2);font-size:14px}
.tags{display:flex;gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap}
.tag{background:var(--accent-bg);color:var(--accent);font-size:11px;padding:4px 12px;border-radius:8px;font-weight:500;border:1px solid var(--accent-border)}
.card{background:var(--card-bg);backdrop-filter:saturate(180%) blur(40px);-webkit-backdrop-filter:saturate(180%) blur(40px);border:1px solid var(--card-border);border-radius:var(--r);padding:20px;transition:all .35s var(--ease);box-shadow:0 0 60px rgba(6,182,212,.04),0 4px 24px rgba(0,0,0,.1);position:relative;overflow:hidden;margin-bottom:14px}
.card::after{content:'';position:absolute;inset:0;border-radius:inherit;background:linear-gradient(135deg,rgba(255,255,255,.04) 0%,transparent 35%,transparent 65%,rgba(255,255,255,.02) 100%);pointer-events:none}
.card:hover{border-color:var(--accent-border);transform:translateY(-2px);box-shadow:0 0 80px rgba(6,182,212,.1),0 0 40px rgba(99,102,241,.05),0 16px 48px rgba(0,0,0,.15)}
.card:active{transform:scale(.98)!important;transition:transform .12s ease!important}
.card-num{display:inline-flex;align-items:center;justify-content:center;min-width:32px;height:32px;padding:0 8px;border-radius:10px;background:var(--accent-bg);text-align:center;line-height:32px;font-weight:700;font-size:14px;color:var(--accent);margin-bottom:10px;border:1px solid var(--accent-border)}
.card h3{font-size:16px;font-weight:600;margin-bottom:6px;letter-spacing:-.01em}
.card p{font-size:13px;color:var(--tx3);line-height:1.65}
/* ---- NEW VISUAL COMPONENTS ---- */
.takeaway{border-left:3px solid var(--accent);background:var(--accent-bg);padding:12px 16px;border-radius:0 14px 14px 0;margin-top:12px;font-size:13px;color:var(--tx2);display:flex;gap:10px;align-items:flex-start;line-height:1.55}
.takeaway .ta-icon{flex-shrink:0;font-size:18px;margin-top:1px}
.cmp-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
.cmp-do,.cmp-dont{border-radius:14px;padding:12px 14px;font-size:12px;line-height:1.5}
.cmp-do{background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.18)}
.cmp-do .cmp-label{color:var(--a2);font-weight:600;font-size:11px;margin-bottom:4px}
.cmp-do p{color:rgba(16,185,129,.7)!important;font-size:12px!important}
.cmp-dont{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.18)}
.cmp-dont .cmp-label{color:var(--a3);font-weight:600;font-size:11px;margin-bottom:4px}
.cmp-dont p{color:rgba(239,68,68,.7)!important;font-size:12px!important}
.checklist{list-style:none;padding:0;margin-top:10px}
.checklist li{padding:5px 0 5px 26px;position:relative;font-size:13px;color:var(--tx3);line-height:1.5}
.checklist li::before{content:"✓";position:absolute;left:0;color:var(--a2);font-weight:700;font-size:13px}
.step-flow{display:flex;gap:6px;margin:14px 0;align-items:center;flex-wrap:wrap}
.step-dot{width:30px;height:30px;border-radius:50%;background:var(--accent-bg);border:2px solid var(--accent-border);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--accent);flex-shrink:0}
.step-bar{flex:1;min-width:20px;height:2px;background:rgba(255,255,255,.06);border-radius:1px}
.step-label{font-size:11px;color:var(--tx3);text-align:center;margin-top:3px;white-space:nowrap}
.big-num{font-size:42px;font-weight:700;color:var(--accent);line-height:1;margin:8px 0 4px;letter-spacing:-.02em}
.big-num-label{font-size:12px;color:var(--tx3)}
.section-badge{display:inline-flex;align-items:center;gap:6px;background:var(--accent-bg);border:1px solid var(--accent-border);padding:6px 14px;border-radius:20px;margin-bottom:16px;font-size:12px;color:var(--accent);font-weight:600}
@keyframes popIn{0%{transform:scale(.8);opacity:0}60%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}
.big-num{animation:popIn .5s var(--ease) both}
/* ---- END NEW COMPONENTS ---- */
.progress{text-align:center;font-size:12px;color:var(--tx3);margin-bottom:14px}
.progress span{color:var(--accent);font-weight:600}
.page-nav{display:flex;justify-content:space-between;gap:10px;margin-bottom:18px}
.page-nav a{flex:1;text-align:center;padding:8px 14px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);color:var(--tx2);text-decoration:none;font-size:12px;transition:all .3s var(--ease);font-family:inherit}
.page-nav a:hover{background:rgba(255,255,255,.08);color:var(--tx);border-color:var(--accent-border)}
.page-nav a.disabled{opacity:.25;pointer-events:none}
.bottom-nav{position:fixed;bottom:calc(12px + env(safe-area-inset-bottom,0));left:50%;transform:translateX(-50%);width:calc(100% - 28px);max-width:440px;height:58px;background:rgba(24,24,32,.78);border:1px solid rgba(255,255,255,.1);border-radius:22px;display:flex;justify-content:center;align-items:center;gap:16px;z-index:100;backdrop-filter:saturate(200%) blur(60px);-webkit-backdrop-filter:saturate(200%) blur(60px);box-shadow:0 0 50px rgba(99,102,241,.12),0 8px 32px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.04)}
.nav-btn{display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);color:var(--tx3);padding:6px 14px;border-radius:14px;cursor:pointer;font-family:inherit;font-size:12px;transition:all .3s var(--ease);-webkit-tap-highlight-color:transparent;text-decoration:none}
.nav-btn:hover{background:rgba(255,255,255,.08);color:var(--tx2)}
.nav-btn svg{width:14px;height:14px}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)scale(.96)}to{opacity:1;transform:translateY(0)scale(1)}}
.card{animation:fadeUp .5s var(--ease) both}
.card:nth-child(1){animation-delay:.03s}.card:nth-child(2){animation-delay:.07s}.card:nth-child(3){animation-delay:.11s}.card:nth-child(4){animation-delay:.15s}.card:nth-child(5){animation-delay:.19s}.card:nth-child(6){animation-delay:.23s}.card:nth-child(7){animation-delay:.27s}.card:nth-child(8){animation-delay:.31s}
@media(max-width:480px){.hero h1{font-size:22px}.card{padding:14px}.cmp-row{grid-template-columns:1fr}.big-num{font-size:32px}.step-flow{gap:4px}.step-dot{width:26px;height:26px;font-size:11px}}
/* mini-games */
.mg-reveal,.mg-quiz,.mg-flip,.mg-slider,.mg-match,.mg-scenario,.mg-counter,.mg-sort{margin-top:10px;position:relative;z-index:1}
.mg-btn{display:inline-block;padding:6px 14px;border-radius:10px;border:1px solid var(--card-border);background:rgba(255,255,255,.05);color:var(--tx2);cursor:pointer;font-family:inherit;font-size:12px;margin:3px 4px 3px 0;transition:all .2s;min-height:36px;-webkit-tap-highlight-color:transparent}
.mg-btn:hover{background:rgba(255,255,255,.1);color:var(--tx);border-color:var(--accent-border)}
.mg-body{display:none;font-size:12px;color:var(--tx2);padding:8px 12px;border-radius:10px;background:rgba(255,255,255,.03);margin-top:6px;line-height:1.5}
.mg-body.show{display:block;animation:fadeUp .3s var(--ease) both}
.mg-btn.correct{background:rgba(16,185,129,.15);border-color:rgba(16,185,129,.35);color:var(--a2)}
.mg-btn.wrong{background:rgba(239,68,68,.15);border-color:rgba(239,68,68,.35);color:var(--a3);animation:shake .4s}
.mg-feedback{display:block;font-size:12px;margin-top:6px;padding:4px 0}
.mg-right{color:var(--a2)}.mg-wrong{color:var(--a3)}
@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-4px)}40%{transform:translateX(4px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}
.mg-flip{perspective:600px;height:80px;cursor:pointer}
.mg-flip-inner{position:relative;width:100%;height:100%;transition:transform .5s;transform-style:preserve-3d}
.mg-flip.flipped .mg-flip-inner{transform:rotateY(180deg)}
.mg-front,.mg-back{position:absolute;inset:0;backface-visibility:hidden;display:flex;align-items:center;justify-content:center;border-radius:12px;font-size:13px;padding:10px;text-align:center}
.mg-front{background:var(--accent-bg);border:1px solid var(--accent-border);color:var(--tx);font-weight:600}
.mg-back{background:rgba(255,255,255,.05);border:1px solid var(--card-border);color:var(--tx2);transform:rotateY(180deg);line-height:1.4;font-size:12px}
.mg-slider{display:flex;flex-direction:column;gap:6px}
.mg-slider input[type=range]{-webkit-appearance:none;width:100%;height:4px;border-radius:2px;background:rgba(255,255,255,.1);outline:none}
.mg-slider input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:var(--accent);cursor:pointer;border:2px solid rgba(255,255,255,.2)}
.mg-slider-label{font-size:13px;color:var(--tx2);text-align:center;font-weight:500}
.mg-match{display:flex;gap:12px;flex-wrap:wrap}
.mg-match-l,.mg-match-r{flex:1;min-width:100px;display:flex;flex-direction:column;gap:5px}
.mg-match .mg-opt{padding:6px 10px;border-radius:8px;border:1px solid var(--card-border);font-size:12px;color:var(--tx2);cursor:pointer;text-align:center;transition:all .2s}
.mg-match .mg-opt:hover{background:rgba(255,255,255,.06)}
.mg-match .mg-opt.sel{border-color:var(--a1);background:rgba(99,102,241,.1);color:var(--tx)}
.mg-match .mg-opt.ok{border-color:var(--a2);background:rgba(16,185,129,.1);color:var(--a2);pointer-events:none}
.mg-match .mg-opt.bad{border-color:var(--a3);background:rgba(239,68,68,.1);color:var(--a3)}
.mg-match-msg{font-size:12px;color:var(--a2);text-align:center;margin-top:6px;width:100%}
.mg-outcome{display:none;font-size:13px;color:var(--tx2);padding:8px 12px;border-radius:10px;background:rgba(255,255,255,.04);margin-top:8px;line-height:1.5}
.mg-outcome.show{display:block}
.mg-count{font-size:28px;font-weight:700;color:var(--accent);margin:0 6px;min-width:30px;display:inline-block;text-align:center}
.mg-msg{font-size:12px;color:var(--tx2);margin-top:4px}
.mg-sort-q{font-size:13px;color:var(--tx);margin-bottom:6px;font-weight:500}
.mg-sort-score{font-size:12px;color:var(--tx2);margin-top:6px}
@media(max-width:480px){.mg-flip{height:90px}.mg-match{flex-direction:column}}
</style>'''

JS = '''<script>(function(){const s=document.querySelector('.glow-spot');let r;window.addEventListener('mousemove',e=>{if(!r){r=requestAnimationFrame(()=>{s.style.background='radial-gradient(circle 420px at '+e.clientX+'px '+e.clientY+'px,rgba(6,182,212,.05),rgba(99,102,241,.04) 20%,rgba(16,185,129,.02) 45%,transparent 70%)';r=null;});}},{passive:true});})();(function(){if(!('ontouchstart' in window))return;const c=document.getElementById('mainContainer');let gx=0,gy=0,tx=0,ty=0;const m=2.5;if(typeof DeviceOrientationEvent!=='undefined'&&'requestPermission' in DeviceOrientationEvent){document.addEventListener('click',function r(){DeviceOrientationEvent.requestPermission().then(p=>{if(p==='granted')window.addEventListener('deviceorientation',o);});document.removeEventListener('click',r);},{once:true});}else{window.addEventListener('deviceorientation',o);}function o(e){if(e.beta!==null){tx=e.gamma||0;ty=e.beta||0;}}function l(){gx+=(tx*0.04-gx)*0.04;gy+=(ty*0.04-gy)*0.04;c.style.transform='perspective(1000px) rotateX('+(-Math.max(-m,Math.min(m,gy)))+'deg) rotateY('+Math.max(-m,Math.min(m,gx))+'deg)';requestAnimationFrame(l);}l();})();</script>\n<script src="./mini-games.js"></script>'''

def nav_row(prev_n, next_n):
    parts = []
    if prev_n is None:
        parts.append('<a class="disabled">← 已经是第一篇</a>')
    else:
        parts.append(f'<a href="./puxing-{prev_n:02d}.html">← 上一篇</a>')
    parts.append(f'<a href="./puxing-man.html">↑ 目录</a>')
    if next_n is None:
        parts.append('<a class="disabled">已经是最后一篇 →</a>')
    else:
        parts.append(f'<a href="./puxing-{next_n:02d}.html">下一篇 →</a>')
    return '<div class="page-nav">' + ''.join(parts) + '</div>'

def make_page(n, total, title, subtitle, tags, cards, accent_class="s-cyan"):
    prev_n = n - 1 if n > 1 else None
    next_n = n + 1 if n < total else None
    nav = nav_row(prev_n, next_n)
    cards_html = '\n'.join(cards)
    tags_html = ''.join(f'<span class="tag">{t}</span>' for t in tags)

    return f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,viewport-fit=cover">
<meta name="theme-color" content="#0a0a0f">
<title>{title} - 普行男养成计划</title>
<link rel="icon" href="./icon.svg">
{CSS}
</head>
<body class="{accent_class}">
<div class="bg"><div class="bg__orb"></div><div class="bg__orb"></div><div class="bg__orb"></div></div>
<div class="glow-spot"></div>
<div class="header"><div class="header-in"><a class="back-btn" href="./knowledge.html"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg></a><span class="header-logo">普行男养成计划</span></div></div>
<div class="container" id="mainContainer">
<div class="hero"><h1>{title}</h1><p class="sub">{subtitle}</p><div class="tags">{tags_html}</div></div>
<div class="progress"><span>{n}</span> / {total}</div>
{nav}
{cards_html}
{nav}
</div>
<div class="bottom-nav"><a class="nav-btn" href="./puxing-man.html"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>目录</a><a class="nav-btn" href="./knowledge.html"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>百科</a><a class="nav-btn" href="./index.html"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>首页</a></div>
{JS}
</body>
</html>'''

# ============================================================
# Helper: takeaway box
# ============================================================
def TA(icon, text):
    return f'<div class="takeaway"><span class="ta-icon">{icon}</span><span>{text}</span></div>'

def CMP(do_text, dont_text):
    return f'<div class="cmp-row"><div class="cmp-do"><div class="cmp-label">✓ 应该这样</div><p>{do_text}</p></div><div class="cmp-dont"><div class="cmp-label">✗ 不要这样</div><p>{dont_text}</p></div></div>'

def CL(items):
    lis = ''.join(f'<li>{item}</li>' for item in items)
    return f'<ul class="checklist">{lis}</ul>'

def STEPS(steps):
    """steps: list of (num, label) tuples"""
    parts = []
    for i, (num, label) in enumerate(steps):
        parts.append(f'<div style="text-align:center;flex-shrink:0"><div class="step-dot">{num}</div><div class="step-label">{label}</div></div>')
        if i < len(steps) - 1:
            parts.append('<div class="step-bar"></div>')
    return '<div class="step-flow">' + ''.join(parts) + '</div>'

def BN(num, label):
    return f'<div class="big-num">{num}</div><div class="big-num-label">{label}</div>'

# ============================================================
# 21 pages data — enriched with emoji, takeaway, cmp, checklist, steps
# ============================================================
# accent_class per section: intro/outro=s-cyan, 外形篇=s-green, 能力篇=s-indigo, 思想行为篇=s-amber

pages = [
    # ===== 1 - 序 (s-cyan) =====
    (
        '序：普信？普行！普通男生也可以被人喜欢！',
        'BV12W4y147cz · 8分钟 · 开篇',
        ['开篇', '自我提升', '认知重塑'],
        's-cyan',
        [
            '''<div class="card"><span class="card-num">1</span><h3>💡 普信男 vs 普行男</h3><p>"普信男"这个词曾让无数普通男生陷入自卑。但"普通"不是原罪，"自信"也不是。问题在于：你只有自信，却没有行动。<strong>普行男的核心哲学：用行动证明价值，而非空谈自信。</strong></p></div>''',
            '''<div class="card"><span class="card-num">2</span><h3>🎲 为什么普通男生也可以被喜欢？</h3><p>喜欢不是彩票中奖，而是概率游戏。每提升一个维度（外形、能力、思想），你被喜欢的概率就翻倍。大多数男生竞争的是"不动"的赛道——你只要动起来，就已经超过了80%的人。</p>''' + TA('📊', '核心公式：外形 × 能力 × 思想 = 被喜欢的概率。三个维度中任意一个翻倍，总概率就翻倍。') + '''</div>''',
            '''<div class="card"><span class="card-num">3</span><h3>📋 这个系列会教你什么？</h3><p>外形篇：从审美到穿搭，打造最好的第一印象。能力篇：信息汲取、兴趣培养、社交扩圈——让别人有理由喜欢你。思想行为篇：共情、情商、性意识——让喜欢持续下去。</p>''' + STEPS([('1','外形篇'),('2','能力篇'),('3','思想行为篇')]) + '''</div>''',
            '''<div class="card"><span class="card-num">4</span><h3>🧭 一个重要的心态准备</h3><p>自我提升不是为了"取悦别人"，而是为了让你成为更好的自己。当你专注于自身成长，吸引力是自然产生的副产品。</p>''' + TA('💎', '这个系列不教"套路"，只教"成为更好的人"。当你成为更有价值的自己，喜欢会自然发生。') + '''</div>''',
        ]
    ),
    # ===== 2 - 外形篇·审美 (s-green) =====
    (
        '外形篇·审美：男性审美提升',
        'BV1VG4y1t75f · 5分钟 · 外形篇 1/7',
        ['外形篇', '审美', '形象提升'],
        's-green',
        [
            '''<div class="card"><span class="card-num">1</span><h3>👁️ 审美是可以学习的</h3><p>很多人觉得"审美是天生的"，但事实是审美可以通过大量观看优秀作品来训练。关键在于建立自己的"审美参考库"——收集你觉得好看的穿搭、发型、配色，找出其中的共同规律。</p></div>''',
            '''<div class="card"><span class="card-num">2</span><h3>📱 全网最简单的操作</h3><p>打开小红书 / Instagram / Pinterest，搜索"男生穿搭"，保存100张你觉得顺眼的图片。然后问自己：这些图有什么共同点？颜色搭配？版型选择？你已经在不知不觉中建立审美框架了。</p>''' + TA('🔑', '审美提升的本质不是"学规则"，而是"看足够多的好样本"。大脑会自动提取规律——你不需要刻意背诵任何穿搭法则。') + '''</div>''',
            '''<div class="card"><span class="card-num">3</span><h3>📶 从模仿到内化：三个阶段</h3><p>审美提升分三个阶段，大多数人卡在"不知道自己适合什么"——这是因为模仿得还不够多。</p>''' + STEPS([('1','模仿照搬'),('2','理解规律'),('3','形成风格')]) + TA('💡', '别急着"找到自己的风格"，先老老实实模仿100套搭配。风格是在大量模仿后自然浮现的，不是凭空设计的。') + '''</div>''',
        ]
    ),
    # ===== 3 - 外形篇·形象管理 (s-green) =====
    (
        '外形篇·形象管理：怎么做一个"干净清爽"的男生？',
        'BV1RG4y1o7BN · 7分钟 · 外形篇 2/7',
        ['外形篇', '形象管理', '干净清爽'],
        's-green',
        [
            '''<div class="card"><span class="card-num">1</span><h3>✨ "干净清爽"是第一要求</h3><p>在女生对男生外形的评价中，"干净清爽"是出现频率最高的词——甚至超过"帅"。一个干净的外表传递的信息是：我在乎自己，我有基本的生活自理能力。</p>''' + BN('No.1', '女生最看重的男性外形特质') + '''</div>''',
            '''<div class="card"><span class="card-num">2</span><h3>🪥 基础三件套：洗、剪、护</h3><p>每天洗澡（尤其运动后）、2-3周剪一次头发、用适合自己的护肤品（至少：洁面+保湿+防晒）。指甲剪短干净、眉毛修整、鼻毛修剪——这些细节对方一定会注意到。</p>''' + CL(['每天洗澡 + 运动后立即冲洗', '2-3周理发一次，保持清爽发型', '基础护肤三步：洁面 → 保湿 → 防晒', '指甲每周修剪，保持短而干净', '眉毛修杂毛，鼻毛定期修剪']) + '''</div>''',
            '''<div class="card"><span class="card-num">3</span><h3>🌸 气味管理同样重要</h3><p>选择一款清淡的香水或身体喷雾，不用太浓。洗衣液选有持久清香的。口腔卫生：刷牙+牙线+漱口水。</p>''' + TA('👃', '气味是最容易被忽视但影响最大的细节。你不需要闻起来像香水店，但绝对不能有异味。清淡 > 浓烈，干净 > 掩盖。') + '''</div>''',
        ]
    ),
    # ===== 4 - 外形篇·穿搭上 (s-green) =====
    (
        '外形篇·穿搭（上）：5分钟零基础穿搭基本原则',
        'BV1zM411k7qB · 5分钟 · 外形篇 3/7',
        ['外形篇', '穿搭', '基本原则'],
        's-green',
        [
            '''<div class="card"><span class="card-num">1</span><h3>📐 穿搭第一原则：合身</h3><p>99%的穿搭灾难都源于不合身。衣服太大显得邋遢，太小显得局促。肩线应该在肩膀边缘、袖子长度到手腕骨、裤子长度刚好盖住鞋面不堆褶——这是最基本的要求。</p>''' + CMP('肩线正好在肩膀边缘，袖长到手腕骨，裤脚刚好盖住鞋面', '衣服松垮像借来的，或紧绷勒肉，裤脚堆在鞋面上像抹布') + '''</div>''',
            '''<div class="card"><span class="card-num">2</span><h3>🎨 颜色搭配的"三色原则"</h3><p>全身不超过三个主色（不含黑白灰）。新手安全色：黑、白、灰、藏青、卡其、军绿。这些颜色任意组合都不会出错。等你熟练了再尝试亮色和图案。</p>''' + TA('🎯', '新手黄金法则：全身 ≤ 3 个主色。当你犹豫时，选择更少的颜色永远比更多安全。') + '''</div>''',
            '''<div class="card"><span class="card-num">3</span><h3>👕 基础单品的万能组合</h3><p>纯色T恤（白/黑/灰）+ 合身牛仔裤/休闲裤 + 干净的小白鞋 = 永远不会出错的日常穿搭。外搭一件衬衫或轻薄夹克即可应对大多数场合。先把这个公式穿好，再谈进阶。</p></div>''',
        ]
    ),
    # ===== 5 - 外形篇·穿搭下 (s-green) =====
    (
        '外形篇·穿搭（下）：零基础保姆级穿搭单品配置',
        'BV1R14y1H7ak · 4分钟 · 外形篇 4/7',
        ['外形篇', '穿搭', '单品推荐'],
        's-green',
        [
            '''<div class="card"><span class="card-num">1</span><h3>🧥 必备基础单品清单</h3><p>上衣：3件纯色T恤（白/黑/灰）、2件牛津纺衬衫（白/浅蓝）、1件薄款针织衫。下装：深色牛仔裤、卡其休闲裤、黑色九分裤。外套：一件百搭夹克（牛仔/飞行夹克/轻薄风衣）。鞋：小白鞋+一双皮鞋。</p>''' + CL(['3件纯色T恤：白、黑、灰各一', '2件牛津纺衬衫：白色 + 浅蓝色', '1条深色牛仔裤 + 1条卡其裤 + 1条黑色九分裤', '1件百搭夹克：牛仔/飞行夹克/风衣任选', '2双鞋：小白鞋（日常）+ 皮鞋（正式场合）']) + '''</div>''',
            '''<div class="card"><span class="card-num">2</span><h3>🔄 一衣多穿的组合逻辑</h3><p>买衣服前先问：这件能和衣柜里至少3件现有单品搭配吗？如果不能，就不要买。目标是：每一件都能和其他多件组合出不同的造型，最大化衣柜利用率。</p>''' + TA('💰', '购物铁律：一件新衣服必须能和衣柜里至少3件旧衣服搭配。这样买10件就能组合出30+套穿搭，而不是10套。') + '''</div>''',
            '''<div class="card"><span class="card-num">3</span><h3>🏃 不同场景的穿搭方案</h3><p>日常通勤/上课：T恤+休闲裤+小白鞋。约会/聚会：衬衫+深色牛仔裤+皮鞋。运动/周末：卫衣+运动裤+运动鞋。三个场景，基本覆盖90%的生活需要。</p></div>''',
        ]
    ),
    # ===== 6 - 外形篇·尺码 (s-green) =====
    (
        '外形篇·尺码选择：懒人专用的穿搭尺码攻略',
        'BV1Eh4y197HC · 8分钟 · 外形篇 5/7',
        ['外形篇', '尺码', '购物技巧'],
        's-green',
        [
            '''<div class="card"><span class="card-num">1</span><h3>📏 为什么你总买错尺码？</h3><p>不同品牌的M码可能差出一个尺码。只看S/M/L/XL是买衣服最大的坑。你需要记住自己的三个关键数据：胸围、腰围、肩宽。网购时只看厘米/英寸，不看字母尺码。</p></div>''',
            '''<div class="card"><span class="card-num">2</span><h3>📐 不用尺量的懒人方法</h3><p>找一件你穿着最合身的衣服，平铺测量：肩宽、胸宽、衣长、袖长。每次网购时对照卖家提供的尺码表，找出最接近你"完美衣服"数据的那个尺码。一劳永逸。</p>''' + CL(['找出一件最合身的衣服作为"基准款"', '平铺测量：肩宽、胸宽、衣长、袖长 四个数据', '每次网购对照尺码表，选最接近基准数据的尺码', '不同品类（T恤/衬衫/外套）各建立一套基准']) + '''</div>''',
            '''<div class="card"><span class="card-num">3</span><h3>✅ 不同单品的合身标准</h3><p>T恤：肩线在肩膀边缘，下摆在臀部中间。衬衫：扣上最上面一颗扣子后能塞进一个手指。裤子：不用腰带也不会掉，大腿和小腿处有适度空间但不松垮。</p>''' + TA('🎯', '记住你自己的三个数字：胸围、腰围、肩宽。忽略 S/M/L，只看厘米/英寸。字母尺码是世界上最不靠谱的度量衡。') + '''</div>''',
        ]
    ),
    # ===== 7 - 外形篇·穿搭答疑 (s-green) =====
    (
        '答疑·穿搭问题：穿搭实践中会踩哪些雷？',
        'BV1sR4y1C7cU · 6分钟 · 外形篇 6/7',
        ['外形篇', '穿搭答疑', '避雷'],
        's-green',
        [
            '''<div class="card"><span class="card-num">1</span><h3>⚡ 雷区一：运动风 ≠ 运动服</h3><p>运动风格是"看起来像会去运动的人"，不是"穿着运动服到处走"。区别在于：运动风格会混搭休闲单品，而全套运动服 = 刚从健身房出来。</p>''' + CMP('运动卫衣 + 休闲裤 + 小白鞋（运动风格混搭）', '全套运动品牌 + 运动裤 + 跑鞋（像刚从健身房出来）') + '''</div>''',
            '''<div class="card"><span class="card-num">2</span><h3>🧥 雷区二：冬天裹成"粽子"</h3><p>冬天穿搭的核心是"层次感"而非"厚度"。三层法则：内层贴身保暖、中层锁温、外层防风。这样穿既保暖又能脱，不会显得臃肿。</p>''' + STEPS([('1','内层\n贴身保暖'),('2','中层\n针织锁温'),('3','外层\n防风外套')]) + '''</div>''',
            '''<div class="card"><span class="card-num">3</span><h3>👟 雷区三：忽略鞋子的重要性</h3><p>很多人精心搭配了衣服，却穿了一双脏兮兮的旧球鞋。鞋子是整体造型的"句号"——一双干净合脚的鞋能拯救一身平庸的搭配。</p>''' + TA('👞', '鞋子是你全身穿搭的"句号"。投资两双好鞋，保持它们干净，定期轮换。一双脏鞋可以毁掉一身精心搭配。') + '''</div>''',
        ]
    ),
    # ===== 8 - 外形篇·矮个子 (s-green) =====
    (
        '外形篇·特别篇：矮个子男生更需要有外形危机感',
        'BV1Gd4y1t7YD · 5分钟 · 外形篇 7/7',
        ['外形篇', '矮个子', '特别篇'],
        's-green',
        [
            '''<div class="card"><span class="card-num">1</span><h3>📏 身高不是决定性因素</h3><p>身高确实影响第一印象，但绝不是被喜欢的必要条件。一个160cm但干净有型的男生，比一个180cm邋遢没品位的男生有吸引力得多。</p>''' + BN('160cm', '有型 > 180cm 邋遢') + '''</div>''',
            '''<div class="card"><span class="card-num">2</span><h3>📐 穿搭视觉增高技巧</h3><p>提高腰线（高腰裤、上衣塞进去）、同色系穿搭（上下同色不切割身体）、避免过长的衣服、选择修身而非紧身的版型。</p>''' + CL(['提高腰线：高腰裤 + 上衣塞进裤子', '同色系穿搭：上下同色，视觉不被切割', '避免长款上衣：下摆不超过臀部中线', '修身不紧身：有型但不勒', '增高鞋垫 2-3cm：合理利用，不丢人']) + '''</div>''',
            '''<div class="card"><span class="card-num">3</span><h3>💪 用其他优势弥补</h3><p>外形只是众多维度中的一个。幽默感、才华、情商、身材（矮个子练出肌肉比例更明显）——这些都可以成为你的核心优势。</p>''' + TA('🏆', '你不需要在所有维度上取胜，只需要在一个维度上突出。矮个子练肌肉比例更明显——把劣势转化为优势。') + '''</div>''',
        ]
    ),
    # ===== 9 - 能力篇·信息汲取 (s-indigo) =====
    (
        '能力篇·信息汲取：为什么聊天没话题？',
        'BV1QR4y1o7Ei · 6分钟 · 能力篇 1/9',
        ['能力篇', '聊天话题', '信息汲取'],
        's-indigo',
        [
            '''<div class="card"><span class="card-num">1</span><h3>🗣️ 没话题的底层原因</h3><p>你聊不下去不是因为嘴笨，而是因为"输入太少"。一个每天只看游戏直播和搞笑视频的人，和一个每天阅读、观影、体验生活的人——后者永远不缺话题。信息输入的质量决定聊天输出的质量。</p></div>''',
            '''<div class="card"><span class="card-num">2</span><h3>📡 建立你的信息输入系统</h3><p>每天至少30分钟的高质量信息摄入：读一篇深度文章、看一段知识类视频、听一集播客。关注3-5个不同领域的优质内容创作者。</p>''' + STEPS([('1','每日30min\n高质量输入'),('2','跨领域\n3-5个方向'),('3','记录金句\n和观点'),('4','用自己的话\n复述输出')]) + '''</div>''',
            '''<div class="card"><span class="card-num">3</span><h3>🔄 从"输入"到"输出"</h3><p>看了一个有趣的内容后，试着用自己的话讲给别人听。这既是练习表达能力，也是巩固记忆。那些看起来"什么都能聊"的人，本质上是积累了足够多的可输出内容。</p>''' + TA('💡', '聊天素材 = 信息输入 × 复述练习。每天30分钟高质量阅读 + 1次复述输出，一个月后你会发现自己"突然有话题了"。') + '''</div>''',
        ]
    ),
    # ===== 10 - 能力篇·兴趣特长 (s-indigo) =====
    (
        '能力篇·兴趣特长：普通男生被喜欢的唯一途径',
        'BV1bK411R7cp · 6分钟 · 能力篇 2/9',
        ['能力篇', '兴趣特长', '自我价值'],
        's-indigo',
        [
            '''<div class="card"><span class="card-num">1</span><h3>❤️ 被喜欢的核心逻辑</h3><p>人们被吸引不是因为"你对ta好"，而是因为"你有价值"。价值可以是外表、才华、幽默、资源、情绪价值——任何能让对方觉得"和这个人在一起生活会更有趣/更好"的东西。</p>''' + TA('🔑', '核心公式：吸引力 = 你能为对方的生活带来什么。对ta好是加分项，但不是吸引力的来源。') + '''</div>''',
            '''<div class="card"><span class="card-num">2</span><h3>🎯 培养一个"拿得出手"的特长</h3><p>不需要成为专业级别，但至少要有一个你比周围80%的人做得好的事情。乐器、摄影、运动、烹饪、编程、写作——什么都可以。这个特长会成为你的社交名片和自信来源。</p></div>''',
            '''<div class="card"><span class="card-num">3</span><h3>📈 深入而非广泛</h3><p>与其同时学5样东西每样只会皮毛，不如深耕一个领域到"可以展示"的水平。</p>''' + CMP('深耕一项技能到可以展示的水平（会弹5首完整吉他曲）', '同时浅尝10种爱好（每种都只会一点点，什么都拿不出手）') + '''</div>''',
        ]
    ),
    # ===== 11 - 能力篇·自我展示 (s-indigo) =====
    (
        '能力篇·自我展示：开屏开得好，人缘差不了',
        'BV1wD4y1e7fd · 5分钟 · 能力篇 3/9',
        ['能力篇', '自我展示', '第一印象'],
        's-indigo',
        [
            '''<div class="card"><span class="card-num">1</span><h3>🦚 "孔雀开屏"效应</h3><p>自然界中雄性通过展示来吸引雌性——人类社会也一样。你的外形、谈吐、朋友圈、社交账号都是你的"屏"。开屏不是炫耀，而是让别人有机会看到你的价值。</p></div>''',
            '''<div class="card"><span class="card-num">2</span><h3>🪪 你的"个人名片"是什么？</h3><p>当一个陌生人第一次了解你时，ta能在3分钟内看到什么？你的朋友圈是三天可见且空空如也？还是展示着你的生活、爱好和价值观？</p>''' + CL(['朋友圈：至少展示最近半年的精彩生活', '头像：清晰、干净、有审美感的个人照', '签名：简短有趣，反映你的态度或幽默感', '社交账号：展示你的兴趣和特长（摄影/音乐/运动等）']) + '''</div>''',
            '''<div class="card"><span class="card-num">3</span><h3>👁️ 展示而非告诉</h3><p>"我很幽默" → 不如展示你有趣的朋友圈文案。"我爱运动" → 不如放一张运动照片。"我很有品位" → 不如展示你的穿搭和生活方式。行动永远比语言更有说服力。</p>''' + TA('📸', '黄金法则：不要说你是什么样的人，展示出来。一张照片胜过一百句自我介绍。') + '''</div>''',
        ]
    ),
    # ===== 12 - 能力篇·社媒运营 (s-indigo) =====
    (
        '能力篇·社媒运营：如何发好朋友圈？',
        'BV1fV4y1w7cj · 6分钟 · 能力篇 4/9',
        ['能力篇', '朋友圈', '社媒运营'],
        's-indigo',
        [
            '''<div class="card"><span class="card-num">1</span><h3>📱 朋友圈是你的第二张脸</h3><p>在这个时代，加了微信后第一件事就是翻对方朋友圈。如果你的朋友圈是空白、全是转发、或者充满负能量——这已经替你"说了"很多话。经营好朋友圈就是经营你的社交形象。</p></div>''',
            '''<div class="card"><span class="card-num">2</span><h3>✅ 朋友圈内容红黑榜</h3>''' + CMP('展示兴趣爱好、记录有趣生活瞬间、分享有价值的观点、偶尔幽默自嘲', '频繁发牢骚/负能量、刷屏广告、过于私密的情绪宣泄、炫耀式凡尔赛') + '''</div>''',
            '''<div class="card"><span class="card-num">3</span><h3>⏱️ 频率与质量</h3><p>不需要每天发，但建议每周至少1-2条高质量内容。一条好的朋友圈应该满足：有信息量、有审美感、或有趣味性。</p>''' + TA('📝', '发之前问自己：别人看到这条会觉得"这个人有意思"吗？如果答案是否定的——别发。') + '''</div>''',
        ]
    ),
    # ===== 13 - 能力篇·拍照p图 (s-indigo) =====
    (
        '能力篇·拍照p图：直男不会拍照？5分钟零基础上手',
        'BV11Y411U739 · 5分钟 · 能力篇 5/9',
        ['能力篇', '拍照', 'p图'],
        's-indigo',
        [
            '''<div class="card"><span class="card-num">1</span><h3>📷 拍照不是天赋，是技能</h3><p>那些"随便拍拍就好看"的人，99%都学过基本的构图和光线知识。你只需要了解几个基本规则，照片质量就能从2分提升到7分。拍照是当今社交中最被低估的实用技能。</p></div>''',
            '''<div class="card"><span class="card-num">2</span><h3>📐 三个万能构图法则</h3><p>1. 三分法：把画面分成九宫格，主体放在交点。2. 留白：不要把主体塞满画面，留出空间感。3. 前景：在主体前方放置虚化的物体增加层次感。记住这三个就够用了。</p>''' + CL(['三分法：打开网格线，主体放在四个交叉点上', '留白：主体占画面 1/3 ~ 2/3，留出呼吸空间', '前景虚化：用树叶/杯子/手指做前景增加层次', '光线：正面自然光最佳，避免头顶强光和逆光']) + '''</div>''',
            '''<div class="card"><span class="card-num">3</span><h3>🎨 P图不是造假，是还原</h3><p>手机镜头因为焦段限制，拍出来的人往往不如本人好看。适度调整曝光、对比度、色温，让照片更接近你眼中看到的自己。</p>''' + TA('📱', '推荐工具：Lightroom手机版（专业调色）、醒图（人像优化）。P图底线：让别人看到你时还能认出你。') + '''</div>''',
        ]
    ),
    # ===== 14 - 能力篇·交友扩圈 (s-indigo) =====
    (
        '能力篇·交友扩圈：圈子太小？超硬核交友逻辑方法',
        'BV1cW4y157Jh · 10分钟 · 能力篇 6/9',
        ['能力篇', '交友扩圈', '社交方法'],
        's-indigo',
        [
            '''<div class="card"><span class="card-num">1</span><h3>🔻 交友是一个"漏斗模型"</h3><p>认识100人 → 加联系方式50人 → 深度交流10人 → 成为朋友3人 → 发展为亲密关系1人。你不能跳过前面的步骤直接要到结果。圈子小是因为漏斗的入口太小。</p>''' + STEPS([('100','认识'),('50','加好友'),('10','深聊'),('3','成朋友'),('1','亲密')]) + TA('📊', '漏斗逻辑：如果你只想认识1个人就成功，概率几乎为零。扩大入口，让概率为你工作。') + '''</div>''',
            '''<div class="card"><span class="card-num">2</span><h3>🌐 扩大接触面：从线上到线下</h3><p>线上：兴趣社群（豆瓣小组、QQ群、Discord）、社交App（Bumble和青藤之恋更适合认真交友）、活动平台（Meetup、活动行）。线下：兴趣班、运动社团、志愿者活动、桌游局。</p></div>''',
            '''<div class="card"><span class="card-num">3</span><h3>⚡ 从"认识"到"朋友"的关键一步</h3><p>大多数人的社交卡在"加了微信后再也没说过话"。破冰方法：在加微信后48小时内发起一个具体邀约。</p>''' + CMP('加微信48小时内："周六下午有个xx展，要不要一起去？"（具体邀约）', '"有空出来玩啊"然后三个月没下文（模糊邀约 = 永远不会发生的邀约）') + '''</div>''',
        ]
    ),
    # ===== 15 - 能力篇·唱歌乐器 (s-indigo) =====
    (
        '能力篇·唱歌&乐器：音乐小白学什么乐器好？',
        'BV1fP4y1C7q7 · 10分钟 · 能力篇 7/9',
        ['能力篇', '音乐', '唱歌乐器'],
        's-indigo',
        [
            '''<div class="card"><span class="card-num">1</span><h3>🎵 音乐是最强社交货币之一</h3><p>会唱歌或弹奏乐器的人在任何社交场合都有天然的吸引力。KTV里自信拿起话筒的人、聚会上随手弹起吉他的人——音乐能力是一种"展示即价值"的硬通货。</p></div>''',
            '''<div class="card"><span class="card-num">2</span><h3>🎸 小白入门推荐：吉他还是键盘？</h3>''' + CMP('吉他：便携、1-2个月可弹唱、社交属性强（聚会随时拿出来）。尤克里里：更简单，4根弦一周上手', '键盘/钢琴：投资大不便携。零基础建议从吉他或尤克里里开始，上手快，正反馈强') + '''</div>''',
            '''<div class="card"><span class="card-num">3</span><h3>🎤 唱歌跑调怎么练？</h3><p>跑调不是因为"天生乐感差"——是因为耳朵和声带之间的连接没建立。用调音App（如Vocal Pitch Monitor）看着音高练单音，每天10分钟，一个月音准会有质的飞跃。</p>''' + TA('🎯', '跑调 ≠ 没救。每天10分钟对着调音App练单音，一个月后你的音准会有质的飞跃。') + '''</div>''',
        ]
    ),
    # ===== 16 - 能力篇·游戏运动 (s-indigo) =====
    (
        '能力篇·游戏&运动：打游戏脱单的终极奥义',
        'BV1D8411P7w7 · 6分钟 · 能力篇 8/9',
        ['能力篇', '游戏', '运动'],
        's-indigo',
        [
            '''<div class="card"><span class="card-num">1</span><h3>🎮 游戏不只是"玩"</h3><p>游戏是当今最自然的社交场景之一。但"打得好"不是关键——"打得有趣"才是。你是那个赢了就嘲讽对方、输了就骂队友的人？还是那个输了也能开玩笑、赢了会夸队友的人？</p>''' + CMP('输了开玩笑自嘲，赢了夸队友，不管输赢都有趣', '赢了嘲讽对面，输了骂队友甩锅，情绪失控') + '''</div>''',
            '''<div class="card"><span class="card-num">2</span><h3>⚽ 运动是最好的"外形+社交"双修</h3><p>规律运动不仅改善体型（提升外形），还能加入运动社群（扩大社交圈）。</p>''' + CL(['羽毛球：男女皆可，容易约，互动性强', '攀岩：室内攀岩馆越来越多，有趣且易互动', '飞盘/橄榄球：团队运动，天然社交场景', '健身：改善体型 + 健身房也是社交场所']) + '''</div>''',
            '''<div class="card"><span class="card-num">3</span><h3>💑 CPDD的正确打开方式</h3><p>在游戏中找对象的重点不是"找"，而是"展示自己"。你的游戏ID、头像、聊天风格、朋友圈都是展示面。</p>''' + TA('🎯', '与其到处CPDD，不如先把自己打造成一个"在游戏里让人觉得有趣的人"。吸引力是吸引来的，不是求来的。') + '''</div>''',
        ]
    ),
    # ===== 17 - 能力篇·逻辑思维 (s-indigo) =====
    (
        '能力篇·逻辑思维：逻辑不清、表达混乱怎么改善？',
        'BV1DR4y1a7hK · 24分钟 · 能力篇 9/9',
        ['能力篇', '逻辑思维', '表达能力'],
        's-indigo',
        [
            '''<div class="card"><span class="card-num">1</span><h3>🧠 逻辑思维是底层能力</h3><p>聊天没条理、工作时说不清需求、吵架时被对方带跑——这些问题的根源都是逻辑思维不足。逻辑不是"聪明人"的专属，而是一种可以刻意训练的思维方式。</p></div>''',
            '''<div class="card"><span class="card-num">2</span><h3>🏗️ 核心方法：结构化表达</h3><p>结论先行 → 分点论述 → 举例说明 → 总结。比如："我觉得这部电影很好看（结论），原因有三点：第一...第二...第三...（分点），比如那个反转镜头...（举例），所以我会推荐去看（总结）。"</p>''' + STEPS([('1','结论\n先行'),('2','分点\n论述'),('3','举例\n说明'),('4','总结\n收尾')]) + '''</div>''',
            '''<div class="card"><span class="card-num">3</span><h3>📝 日常训练方法</h3><p>每天选一个话题，用手机录音讲3分钟，然后回听——你会发现自己的逻辑漏洞。阅读时主动总结"作者的核心观点是什么？论据是什么？论证有没有问题？"</p>''' + CL(['每天选一个话题，录音讲3分钟，回听找逻辑漏洞', '阅读后总结：核心观点 → 论据 → 论证是否成立', '用"第一、第二、第三"结构化表达日常观点', '和朋友辩论时先复述对方观点再回应（确保你听懂了）']) + '''</div>''',
        ]
    ),
    # ===== 18 - 思想行为篇·共情 (s-amber) =====
    (
        '思想行为篇·共情：男性共情能力如何培养',
        'BV19T411X7c5 · 8分钟 · 思想行为篇 1/3',
        ['思想行为篇', '共情能力', '两性沟通'],
        's-amber',
        [
            '''<div class="card"><span class="card-num">1</span><h3>💬 为什么女生总觉得"你不懂我"？</h3><p>男女沟通中最大的冲突模式：女生倾诉是为了获得情感共鸣，男生则本能地给出解决方案。</p>''' + CMP('当她说"今天好累"→ "辛苦了，今天发生了什么？"（倾听 + 共情）', '当她说"今天好累"→ "那你早点睡"（直接给方案，忽略了情感需求）') + '''</div>''',
            '''<div class="card"><span class="card-num">2</span><h3>📶 共情的三个层次</h3>''' + STEPS([('L1','听到\n对方的话'),('L2','理解\n处境感受'),('L3','回应\n让ta感到被懂')]) + TA('⚠️', '大多数男生卡在 Level 1 —— 听到了话，但直接跳到了解决方案，跳过了理解和回应。共情的核心不是"解决问题"，而是"确认感受"。') + '''</div>''',
            '''<div class="card"><span class="card-num">3</span><h3>🛠️ 练习共情的具体方法</h3><p>当对方表达情绪时，先复述ta的感受："听起来你很沮丧"。然后问一个开放式问题："能多跟我说说吗？"</p>''' + CL(['第一步：复述感受——"听起来你很[情绪词]"', '第二步：开放提问——"能多跟我说说吗？"', '❌ 不做：评价、建议、比较、说教', '✅ 只做：倾听、确认感受、表达理解']) + '''</div>''',
        ]
    ),
    # ===== 19 - 思想行为篇·性意识 (s-amber) =====
    (
        '思想行为篇·性意识：警惕男性软性羊尾',
        'BV1W8411T7eY · 7分钟 · 思想行为篇 2/3',
        ['思想行为篇', '性意识', '男性健康'],
        's-amber',
        [
            '''<div class="card"><span class="card-num">1</span><h3>⚠️ 什么是"软性羊尾"？</h3><p>不是生理上的功能障碍，而是在心理层面丧失了对真实亲密关系的欲望和经营能力。过度依赖成人内容、社交回避、对真实关系缺乏耐心——这些都是软性羊尾的表现。</p></div>''',
            '''<div class="card"><span class="card-num">2</span><h3>🧠 成人内容对大脑的影响</h3><p>过度消费成人内容会重塑大脑的奖赏回路——真实世界中的亲密关系变得"不够刺激"，导致对真实交往失去兴趣和动力。</p>''' + TA('⚠️', '节制不是为了道德，而是为了保护你对真实关系的感受力。数字刺激的阈值越高，真实世界的吸引力越低。') + '''</div>''',
            '''<div class="card"><span class="card-num">3</span><h3>🌱 重建健康的性意识</h3>''' + CL(['减少数字刺激，重建对真实社交的敏感度', '把亲密关系视为"两个人之间的连接"而非"生理需求的满足"', '投资于真实的社交能力而非幻想的满足', '运动、户外活动、面对面社交——用真实体验替代虚拟刺激']) + '''</div>''',
        ]
    ),
    # ===== 20 - 思想行为篇·说话情商 (s-amber) =====
    (
        '思想行为篇·说话情商：嘴笨无趣情商低怎么挽救',
        'BV1aM4y1Z7it · 6分钟 · 思想行为篇 3/3',
        ['思想行为篇', '情商', '说话技巧'],
        's-amber',
        [
            '''<div class="card"><span class="card-num">1</span><h3>🧭 情商不是"会来事"</h3><p>很多人以为高情商就是圆滑、会说话、会来事——这是误解。真正的情商是：感知他人情绪的能力 + 管理自己情绪的能力 + 用恰当方式回应情绪的能力。它不是表演，而是理解。</p></div>''',
            '''<div class="card"><span class="card-num">2</span><h3>🤔 "嘴笨"的真相</h3><p>你觉得自己"嘴笨"，其实是因为你在聊天时太关注自己——"我该说什么？""我说得对不对？""ta怎么看我？"——而不是关注对方。当你真正对对方感兴趣时，问题会自然涌现。</p>''' + TA('💡', '嘴笨的解药不是"学话术"，而是"转移注意力"——从关注自己转向关注对方。当你真心好奇对方时，你不会缺话题。') + '''</div>''',
            '''<div class="card"><span class="card-num">3</span><h3>⚡ 三个立即可用的技巧</h3>''' + CL(['用 "是什么让你...？" 代替 "为什么...？" ——前者关注故事，后者像审问', '回答前停顿 2 秒 —— 显得你在认真思考，而非急于回应', '多问 "然后呢？" —— 这是最有力的聊天催化剂，简单但极其有效', '用对方说过的话来回应 —— "你刚才说...让我想到..."（证明你在听）']) + '''</div>''',
        ]
    ),
    # ===== 21 - 结语 (s-cyan) =====
    (
        '结语：愿你不再自卑，年少有为',
        'BV12b411D7z4 · 5分钟 · 终章',
        ['结语', '总结', '自我成长'],
        's-cyan',
        [
            '''<div class="card"><span class="card-num">1</span><h3>🔙 回顾：你学到了什么？</h3><p>外形篇教你把最好的自己展示给世界，能力篇教你让世界有理由喜欢你，思想行为篇教你让喜欢持续下去。这三个维度不是割裂的——它们共同构成了一个完整的、值得被喜欢的人。</p>''' + STEPS([('🧥','外形篇'),('🧠','能力篇'),('❤️','思想行为篇')]) + '''</div>''',
            '''<div class="card"><span class="card-num">2</span><h3>🌱 改变的开始是接受自己</h3><p>自我提升的前提是自我接受。你不是因为"不够好"才需要改变——而是因为"你值得更好"才选择改变。自卑不是动力，自爱才是。</p>''' + TA('💎', '当你真正接受自己时，改变会从"必须"变成"想要"。从"我必须变好才能被喜欢"到"我值得更好所以我要成长"。') + '''</div>''',
            '''<div class="card"><span class="card-num">3</span><h3>🚀 年少有为不是终点</h3><p>这个系列的标题叫"普行男养成计划"——重点在"养成"。没有人天生完美，每个人都是在不断行动中成为更好的自己。愿你不再自卑，年少有为。更重要的是：愿你始终在路上。</p></div>''',
        ]
    ),
]

# ============================================================
# Generate all pages
# ============================================================
out_dir = '/Users/lasky_my/ai-nav'

for i, (title, subtitle, tags, accent_class, cards) in enumerate(pages, 1):
    html = make_page(i, 21, title, subtitle, tags, cards, accent_class)
    filepath = os.path.join(out_dir, f'puxing-{i:02d}.html')
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'Created: puxing-{i:02d}.html — {title}')

print(f'\nDone! Generated {len(pages)} pages in {out_dir}')
