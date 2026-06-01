// Floating back/home buttons — bottom-right, horizontal, hidden until mouse/touch move
(function(){
  if (location.pathname.endsWith('/') || location.pathname.endsWith('index.html')) return;

  var style = document.createElement('style');
  style.textContent = '.fn-ct{position:fixed;bottom:80px;right:14px;z-index:99999;display:flex;flex-direction:row;opacity:0;transition:opacity .35s ease;pointer-events:none;}.fn-ct.show{opacity:1;pointer-events:auto;}.fn-btn{width:34px;height:34px;border-radius:17px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.15);color:rgba(255,255,255,.75);font-size:15px;display:flex;align-items:center;justify-content:center;cursor:pointer;margin-left:6px;}.fn-btn:active{background:rgba(0,210,255,.25);color:#00e5ff;}.fn-btn svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2.3;stroke-linecap:round;stroke-linejoin:round;}';
  document.head.appendChild(style);

  var ct = document.createElement('div');
  ct.className = 'fn-ct';
  ct.innerHTML = '<button class="fn-btn" title="返回上一级" onclick="history.back()"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button><button class="fn-btn" title="返回主页" onclick="location.href=\'./index.html\'"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></button>';
  document.body.appendChild(ct);

  var timer = null;
  function show(){ct.classList.add('show');if(timer)clearTimeout(timer);timer=setTimeout(function(){ct.classList.remove('show');},3000);}
  document.addEventListener('mousemove',show,{passive:true});
  document.addEventListener('touchstart',show,{passive:true});
  document.addEventListener('touchmove',show,{passive:true});
  show();
})();
