// AI Nav Shared JS v1.0 — 鼠标光晕+底栏+FAB
(function(){
  // Glow spot
  var g=document.getElementById('glowSpot');
  if(!g||'ontouchstart' in window)return;
  var x=innerWidth/2,y=innerHeight/2,tx=x,ty=y;
  document.addEventListener('mousemove',function(e){tx=e.clientX;ty=e.clientY});
  function anim(){x+=(tx-x)*0.05;y+=(ty-y)*0.05;g.style.background='radial-gradient(circle 420px at '+x.toFixed(0)+'px '+y.toFixed(0)+'px,rgba(99,102,241,.06) 0%,rgba(236,72,153,.035) 18%,rgba(6,182,212,.02) 42%,transparent 70%)';requestAnimationFrame(anim)}
  anim();
  // Bottom nav injection — if page lacks it
  if(!document.querySelector('.bottom-nav')&&!document.querySelector('.nav-btn')){
    var nav=document.createElement('div');nav.className='bottom-nav';
    nav.innerHTML='<a href="#" onclick="window.scrollTo({top:0,behavior:\'smooth\'})">↑ 顶部</a><a href="javascript:history.back()">← 返回</a><a href="./index.html">⌂ 主页</a>';
    document.body.appendChild(nav);
  }
  // FAB injection
  if(!document.querySelector('.fab-top')&&!document.querySelector('button[onclick*="scrollTo"]')){
    var fab=document.createElement('button');fab.className='fab-top';fab.textContent='↑';
    fab.onclick=function(){window.scrollTo({top:0,behavior:'smooth'})};
    document.body.appendChild(fab);
  }
})();
