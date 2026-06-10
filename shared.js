// AI Nav Shared JS v6 — 日志系统+光晕+顶栏(天气/刷新/版本)+底栏+FAB+路径修正
(function(){
  'use strict';

  // ═══ LOG SYSTEM ═══
  var LOG_PREFIX = '[AINav]';
  function log(action, detail) {
    var msg = LOG_PREFIX + ' ' + action + (detail ? ' | ' + detail : '');
    console.log(msg);
    // Also store in global array for QA inspection
    if (!window.__ainav_logs) window.__ainav_logs = [];
    window.__ainav_logs.push({ts: new Date().toISOString(), action: action, detail: detail || ''});
  }
  log('page_load', 'title=' + document.title + ' url=' + location.pathname);

  // ═══ PATH RESOLVER ═══
  function resolveIndex() {
    var pn = location.pathname;
    // Subdirectory pages: bilibili/BV*.html, vibe-coding-lessons/*.html, etc.
    // Root pages: /page.html or /ai-nav/page.html
    if (pn.includes('/bilibili/') || pn.includes('/vibe-coding-lessons/')) {
      return '../index.html';
    }
    return './index.html';
  }
  var INDEX_PATH = resolveIndex();
  log('path_resolve', 'index=' + INDEX_PATH + ' path=' + location.pathname);

  // ═══ GLOW ═══
  var g = document.getElementById('glowSpot');
  if (g && !('ontouchstart' in window)) {
    log('glow', 'active');
    var gx = innerWidth / 2, gy = innerHeight / 2, tgx = gx, tgy = gy;
    document.addEventListener('mousemove', function(e) { tgx = e.clientX; tgy = e.clientY; });
    function animGlow() {
      gx += (tgx - gx) * 0.05; gy += (tgy - gy) * 0.05;
      g.style.background = 'radial-gradient(circle 420px at ' + gx.toFixed(0) + 'px ' + gy.toFixed(0) + 'px,rgba(99,102,241,.06) 0%,rgba(236,72,153,.035) 18%,rgba(6,182,212,.02) 42%,transparent 70%)';
      requestAnimationFrame(animGlow);
    }
    animGlow();
  }

  // Clock and index pages are exempt from header/nav injection
  var isClock = location.pathname.includes('clock');
  var isIndex = location.pathname.endsWith('index.html') || location.pathname === '/' || location.pathname.endsWith('/ai-nav/');
  if (isClock || isIndex) { log('inject_skip', isClock ? 'clock' : 'index'); return; }

  var ver = 'v26';
  try { var v = JSON.parse(localStorage.getItem('site_version')); if (v) ver = 'v' + v; } catch (e) {}

  // ═══ HEADER ═══
  var hdr = document.querySelector('.header');
  if (!hdr) {
    hdr = document.createElement('header'); hdr.className = 'header';
    var backHref = INDEX_PATH;
    if (location.pathname.includes('vibe-coding-lessons')) backHref = '../vibe-coding.html';
    else if (location.pathname.includes('vibe-coding')) backHref = './knowledge.html';
    else if (location.pathname.includes('bilibili/')) backHref = '../bilibili.html';

    hdr.innerHTML = '<div class="header-in">' +
      '<a class="back-btn" href="' + backHref + '" title="返回" data-ainav="back"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></a>' +
      '<span class="header-logo" id="spTitle">' + document.title.replace(/ · .*/, '') + '</span>' +
      '<span class="header-clock" id="spClock">--:--</span>' +
      '<span class="header-weather" id="spWeather" title="天气加载中">--</span>' +
      '<a class="header-refresh" href="javascript:location.reload()" title="刷新" data-ainav="refresh">🔄</a>' +
      '<span class="header-ver" id="spVer">' + ver + '</span>' +
      '<a class="home-btn" href="' + INDEX_PATH + '" title="主页" data-ainav="home"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></a>' +
      '</div>';
    document.body.insertBefore(hdr, document.body.firstChild);
    log('header', 'created back=' + backHref + ' home=' + INDEX_PATH);
  } else {
    var hdrIn = hdr.querySelector('.header-in');
    if (hdrIn) {
      if (!hdr.querySelector('#spClock')) {
        var ce = document.createElement('span'); ce.className = 'header-clock'; ce.id = 'spClock'; ce.textContent = '--:--';
        var we = document.createElement('span'); we.className = 'header-weather'; we.id = 'spWeather'; we.textContent = '--';
        var re = document.createElement('a'); re.className = 'header-refresh'; re.href = 'javascript:location.reload()'; re.title = '刷新'; re.setAttribute('data-ainav', 'refresh'); re.textContent = '🔄';
        var ve = document.createElement('span'); ve.className = 'header-ver'; ve.id = 'spVer'; ve.textContent = ver;
        var hb = hdrIn.querySelector('.home-btn');
        // Fix existing home button href
        if (hb && hb.getAttribute('href') === './index.html') hb.setAttribute('href', INDEX_PATH);
        if (hb) { hdrIn.insertBefore(ve, hb); hdrIn.insertBefore(re, ve); hdrIn.insertBefore(we, re); hdrIn.insertBefore(ce, we); }
        else { hdrIn.appendChild(ce); hdrIn.appendChild(we); hdrIn.appendChild(re); hdrIn.appendChild(ve); }
        log('header', 'augmented');
      }
      // Fix existing home/back links in augmented headers
      var hb2 = hdr.querySelector('.home-btn');
      if (hb2 && hb2.getAttribute('href') === './index.html') { hb2.setAttribute('href', INDEX_PATH); log('header', 'fixed home href'); }
    }
  }

  // Clock
  function tick() {
    var el = document.getElementById('spClock'); if (!el) return;
    var n = new Date(); el.textContent = ('0' + n.getHours()).slice(-2) + ':' + ('0' + n.getMinutes()).slice(-2);
  }
  tick(); setInterval(tick, 30000);

  // Weather
  function loadWeather() {
    var el = document.getElementById('spWeather'); if (!el) return;
    try {
      var cached = JSON.parse(localStorage.getItem('weather_cache') || '{}');
      if (cached.temp && Date.now() - cached.ts < 600000) { el.textContent = cached.temp + '°'; return; }
    } catch (e) {}
    var A = location.hostname === 'localhost' ? 'http://localhost:8765' : 'https://99107705bcfb4f23-183-6-87-29.serveousercontent.com';
    fetch(A + '/api/weather?lat=23.13&lon=113.26').then(function(r) { return r.json(); }).then(function(d) {
      var t = Math.round(d.current?.temperature_2m || 0);
      el.textContent = t + '°';
      localStorage.setItem('weather_cache', JSON.stringify({ temp: t, ts: Date.now() }));
    }).catch(function() { el.textContent = ''; });
  }
  loadWeather();

  // ═══ BOTTOM NAV ═══
  if (!document.querySelector('.bottom-nav') && !document.querySelector('.nav-btn')) {
    var nav = document.createElement('div'); nav.className = 'bottom-nav'; nav.id = 'sharedBN';
    nav.innerHTML = '<a href="#" data-ainav="scrolltop" onclick="window.scrollTo({top:0,behavior:\'smooth\'});window.__ainav_logs&&window.__ainav_logs.push({ts:new Date().toISOString(),action:\'nav_scrolltop\'});return false">↑ 顶部</a>' +
      '<a href="javascript:history.back()" data-ainav="goback" onclick="window.__ainav_logs&&window.__ainav_logs.push({ts:new Date().toISOString(),action:\'nav_goback\'})">← 返回</a>' +
      '<a href="' + INDEX_PATH + '" data-ainav="gohome" onclick="window.__ainav_logs&&window.__ainav_logs.push({ts:new Date().toISOString(),action:\'nav_gohome\'})">⌂ 主页</a>';
    document.body.appendChild(nav); document.body.style.paddingBottom = '80px';
    log('bottom_nav', 'created home=' + INDEX_PATH);
  }

  // ═══ FAB ═══
  if (!document.querySelector('.fab-top') && !document.querySelector('[onclick*="scrollTo"]')) {
    var fab = document.createElement('button'); fab.className = 'fab-top'; fab.textContent = '↑'; fab.setAttribute('data-ainav', 'fab');
    fab.onclick = function() { window.scrollTo({ top: 0, behavior: 'smooth' }); log('fab', 'clicked'); };
    document.body.appendChild(fab);
    log('fab', 'created');
  }

  // ═══ ERROR TRACKING ═══
  window.addEventListener('error', function(e) {
    if (e.target && e.target.tagName === 'IMG') {
      log('img_error', e.target.src);
    } else {
      log('js_error', (e.message || '') + ' @ ' + (e.filename || '') + ':' + (e.lineno || ''));
    }
  }, true);

  // ═══ NAV CLICK TRACKING ═══
  document.addEventListener('click', function(e) {
    var el = e.target.closest('[data-ainav]');
    if (el) {
      var action = el.getAttribute('data-ainav');
      var href = el.getAttribute('href') || '';
      log('click_' + action, href);
    }
  });

  log('inject_done', 'v6');
})();
