// AI Nav Shared JS v3 — 光晕+完整顶栏+底栏+FAB
(function(){
  // ═══ Glow spot ═══
  var g=document.getElementById('glowSpot');
  if(g&&!('ontouchstart' in window)){
    var x=innerWidth/2,y=innerHeight/2,tx=x,ty=y;
    document.addEventListener('mousemove',function(e){tx=e.clientX;ty=e.clientY});
    function anim(){x+=(tx-x)*0.05;y+=(ty-y)*0.05;g.style.background='radial-gradient(circle 420px at '+x.toFixed(0)+'px '+y.toFixed(0)+'px,rgba(99,102,241,.06) 0%,rgba(236,72,153,.035) 18%,rgba(6,182,212,.02) 42%,transparent 70%)';requestAnimationFrame(anim)}
    anim();
  }

  // ═══ Header injection (non-clock pages, non-index) ═══
  var isClock=location.pathname.includes('clock');
  var isIndex=location.pathname.endsWith('index.html')||location.pathname==='/'||location.pathname.endsWith('/');
  var isTool=location.pathname.includes('esp32')||location.pathname.includes('status')||location.pathname.includes('usage');
  if(!isClock&&!isIndex&&!document.querySelector('.header')&&!document.querySelector('header')){
    var hdr=document.createElement('header');hdr.className='header';
    // Get version from cache or default
    var ver='v25';
    try{var v=JSON.parse(localStorage.getItem('site_version'));if(v)ver='v'+v}catch(e){}
    // Build parent link
    var backHref='./index.html',backLabel='主页';
    if(location.pathname.includes('vibe-coding-lessons')){backHref='../vibe-coding.html';backLabel='课程'}
    else if(location.pathname.includes('vibe-coding')){backHref='./knowledge.html';backLabel='百科'}
    else if(location.pathname.includes('manual')){backHref='./index.html';backLabel='主页'}
    else if(location.pathname.includes('hardware')){backHref='./index.html';backLabel='主页'}
    else if(location.pathname.includes('financial')){backHref='./manual.html';backLabel='手册'}
    else{backHref='./index.html';backLabel='主页'}
    
    hdr.innerHTML='<div class="header-in">'+
      '<a class="back-btn" href="'+backHref+'" title="返回'+backLabel+'"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></a>'+
      '<span class="header-logo" id="sharedPageTitle">'+document.title.replace(' · ',' ').split(' ')[0]+'</span>'+
      '<span class="header-clock" id="sharedClock">--:--</span>'+
      '<span class="header-ver" id="sharedVer">'+ver+'</span>'+
      '<a class="home-btn" href="./index.html" title="主页"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></a>'+
      '</div>';
    document.body.insertBefore(hdr,document.body.firstChild);
    // Live clock
    function updateClock(){
      var el=document.getElementById('sharedClock');if(!el)return;
      var n=new Date();el.textContent=('0'+n.getHours()).slice(-2)+':'+('0'+n.getMinutes()).slice(-2);
    }
    updateClock();setInterval(updateClock,30000);
  }

  // ═══ Bottom nav ═══
  if(!isClock&&!isIndex&&!document.querySelector('.bottom-nav')&&!document.querySelector('.nav-btn')){
    var nav=document.createElement('div');nav.className='bottom-nav';nav.id='sharedBottomNav';
    nav.innerHTML='<a href="#" onclick="window.scrollTo({top:0,behavior:\'smooth\'});return false">↑ 顶部</a><a href="javascript:history.back()">← 返回</a><a href="./index.html">⌂ 主页</a>';
    document.body.appendChild(nav);
    document.body.style.paddingBottom='80px';
  }

  // ═══ FAB ═══
  if(!isClock&&!isIndex&&!document.querySelector('.fab-top')&&!document.querySelector('[onclick*="scrollTo"]')){
    var fab=document.createElement('button');fab.className='fab-top';fab.textContent='↑';
    fab.onclick=function(){window.scrollTo({top:0,behavior:'smooth'})};
    document.body.appendChild(fab);
  }
})();
