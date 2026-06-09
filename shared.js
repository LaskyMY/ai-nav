// AI Nav Shared JS v4 — 光晕+补全header+底栏+FAB
(function(){
  var g=document.getElementById('glowSpot');
  if(g&&!('ontouchstart' in window)){
    var x=innerWidth/2,y=innerHeight/2,tx=x,ty=y;
    document.addEventListener('mousemove',function(e){tx=e.clientX;ty=e.clientY});
    function anim(){x+=(tx-x)*0.05;y+=(ty-y)*0.05;g.style.background='radial-gradient(circle 420px at '+x.toFixed(0)+'px '+y.toFixed(0)+'px,rgba(99,102,241,.06) 0%,rgba(236,72,153,.035) 18%,rgba(6,182,212,.02) 42%,transparent 70%)';requestAnimationFrame(anim)}
    anim();
  }

  var isClock=location.pathname.includes('clock');
  var isIndex=location.pathname.endsWith('index.html')||location.pathname==='/'||location.pathname.endsWith('/ai-nav/');
  if(isClock||isIndex)return;

  var ver='v25';
  try{var v=JSON.parse(localStorage.getItem('site_version'));if(v)ver='v'+v}catch(e){}

  // ═══ 补全/创建 header ═══
  var hdr=document.querySelector('.header');
  if(!hdr){
    // 完全没有header — 创建
    hdr=document.createElement('header');hdr.className='header';
    var backHref='./index.html';
    if(location.pathname.includes('vibe-coding-lessons'))backHref='../vibe-coding.html';
    else if(location.pathname.includes('vibe-coding'))backHref='./knowledge.html';
    hdr.innerHTML='<div class="header-in">'+
      '<a class="back-btn" href="'+backHref+'" title="返回"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></a>'+
      '<span class="header-logo" id="spTitle">'+document.title.replace(/ · .*/,'')+'</span>'+
      '<span class="header-clock" id="spClock">--:--</span>'+
      '<span class="header-ver" id="spVer">'+ver+'</span>'+
      '<a class="home-btn" href="./index.html" title="主页"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></a>'+
      '</div>';
    document.body.insertBefore(hdr,document.body.firstChild);
  } else {
    // 已有header但缺时钟/版本 — 补全
    var hdrIn=hdr.querySelector('.header-in');
    if(hdrIn&&!hdr.querySelector('#spClock')){
      var clockEl=document.createElement('span');clockEl.className='header-clock';clockEl.id='spClock';clockEl.textContent='--:--';
      var verEl=document.createElement('span');verEl.className='header-ver';verEl.id='spVer';verEl.textContent=ver;
      // Insert before home-btn or at end
      var homeBtn=hdrIn.querySelector('.home-btn');
      if(homeBtn){hdrIn.insertBefore(verEl,homeBtn);hdrIn.insertBefore(clockEl,verEl)}
      else{hdrIn.appendChild(clockEl);hdrIn.appendChild(verEl)}
    }
  }
  // Live clock
  function tick(){var el=document.getElementById('spClock');if(el){var n=new Date();el.textContent=('0'+n.getHours()).slice(-2)+':'+('0'+n.getMinutes()).slice(-2)}}tick();setInterval(tick,30000);

  // ═══ 底栏 ═══
  if(!document.querySelector('.bottom-nav')&&!document.querySelector('.nav-btn')){
    var nav=document.createElement('div');nav.className='bottom-nav';nav.id='sharedBN';
    nav.innerHTML='<a href="#" onclick="window.scrollTo({top:0,behavior:\'smooth\'});return false">↑ 顶部</a><a href="javascript:history.back()">← 返回</a><a href="./index.html">⌂ 主页</a>';
    document.body.appendChild(nav);document.body.style.paddingBottom='80px';
  }

  // ═══ FAB ═══
  if(!document.querySelector('.fab-top')&&!document.querySelector('[onclick*="scrollTo"]')){
    var fab=document.createElement('button');fab.className='fab-top';fab.textContent='↑';
    fab.onclick=function(){window.scrollTo({top:0,behavior:'smooth'})};document.body.appendChild(fab);
  }
})();
