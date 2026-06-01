// ===== Floating Back Navigation =====
// Hidden by default, appears on mouse/touch move, hides after 3s inactivity
// Injects two buttons: ← back to previous page, ⌂ back to home

(function(){
  // Don't inject on homepage
  if (location.pathname.endsWith('/') || location.pathname.endsWith('index.html')) return;

  var style = document.createElement('style');
  style.textContent = [
    '.fn-ct{position:fixed;left:8px;top:50%;transform:translateY(-50%);z-index:9999;display:flex;flex-direction:column;opacity:0;transition:opacity .3s ease;pointer-events:none;}',
    '.fn-ct.show{opacity:1;pointer-events:auto;}',
    '.fn-btn{width:32px;height:32px;border-radius:16px;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.7);font-size:16px;display:flex;align-items:center;justify-content:center;cursor:pointer;margin:2px 0;-webkit-backdrop-filter:blur(10px);}',
    '.fn-btn:active{background:rgba(0,210,255,.2);color:#00e5ff;}',
    '.fn-btn svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;}'
  ].join('');
  document.head.appendChild(style);

  var ct = document.createElement('div');
  ct.className = 'fn-ct';
  ct.innerHTML = [
    '<button class="fn-btn" title="返回上一级" onclick="history.back()"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button>',
    '<button class="fn-btn" title="返回主页" onclick="location.href=\'./index.html\'"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></button>'
  ].join('');
  document.body.appendChild(ct);

  var timer = null;
  function show(){ct.classList.add('show');if(timer)clearTimeout(timer);timer=setTimeout(function(){ct.classList.remove('show');},3000);}
  document.addEventListener('mousemove',show,{passive:true});
  document.addEventListener('touchstart',show,{passive:true});
  document.addEventListener('touchmove',show,{passive:true});
  // Initial show for 3s
  show();
})();
