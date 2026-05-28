/* mini-games.js — 8 interactive knowledge games. Zero deps. */
(function(){
'use strict';

// ── Reveal: click to show hidden answer ──
function initReveal(el){
  const btn=el.querySelector('.mg-btn');
  const body=el.querySelector('.mg-body');
  if(btn&&body){btn.addEventListener('click',()=>{body.classList.add('show');btn.style.display='none';});}
}

// ── Quiz: two-choice with feedback ──
function initQuiz(el){
  const correct=parseInt(el.dataset.correct);
  const btns=el.querySelectorAll('.mg-btn');
  const fb=el.querySelector('.mg-feedback');
  let done=false;
  btns.forEach((b,i)=>{
    b.addEventListener('click',()=>{
      if(done)return;done=true;
      if(i===correct){b.classList.add('correct');fb.textContent=el.dataset.right||'✓ 正确！';fb.className='mg-feedback mg-right';}
      else{b.classList.add('wrong');btns[correct].classList.add('correct');fb.textContent=el.dataset.wrong||'✗ 不对哦';fb.className='mg-feedback mg-wrong';}
    });
  });
}

// ── Flip: CSS 3D card flip ──
function initFlip(el){
  el.addEventListener('click',()=>el.classList.toggle('flipped'));
}

// ── Slider: range input with dynamic label ──
function initSlider(el){
  const input=el.querySelector('input[type=range]');
  const label=el.querySelector('.mg-slider-label');
  if(!input||!label)return;
  const stops=JSON.parse(el.dataset.stops||'[]');
  function update(){label.textContent=stops[parseInt(input.value)]||'';}
  input.addEventListener('input',update);update();
}

// ── Match: click left, click right to pair ──
function initMatch(el){
  const lefts=el.querySelectorAll('.mg-match-l .mg-opt');
  const rights=el.querySelectorAll('.mg-match-r .mg-opt');
  const pairs=JSON.parse(el.dataset.pairs||'[]');
  let selL=null,matched=0;
  lefts.forEach(l=>l.addEventListener('click',()=>{
    lefts.forEach(x=>x.classList.remove('sel'));l.classList.add('sel');selL=l;
  }));
  rights.forEach(r=>r.addEventListener('click',()=>{
    if(!selL)return;
    const li=parseInt(selL.dataset.idx),ri=parseInt(r.dataset.idx);
    if(pairs[li]===ri){selL.classList.add('ok');r.classList.add('ok');matched++;if(matched===pairs.length)el.querySelector('.mg-match-msg').textContent='✓ 全部正确！';}
    else{selL.classList.add('bad');r.classList.add('bad');setTimeout(()=>{selL.classList.remove('sel','bad');r.classList.remove('bad');},400);}
    selL=null;
  }));
}

// ── Scenario: choose-your-own-outcome ──
function initScenario(el){
  const btns=el.querySelectorAll('.mg-btn');
  const out=el.querySelector('.mg-outcome');
  btns.forEach(b=>b.addEventListener('click',()=>{
    btns.forEach(x=>x.style.display='none');
    out.textContent=b.dataset.outcome;out.classList.add('show');
  }));
}

// ── Counter: tap counter with threshold messages ──
function initCounter(el){
  const btn=el.querySelector('.mg-btn');
  const num=el.querySelector('.mg-count');
  const msg=el.querySelector('.mg-msg');
  const steps=JSON.parse(el.dataset.steps||'{}');
  const keys=Object.keys(steps).map(Number).sort((a,b)=>a-b);
  let count=0;
  btn.addEventListener('click',()=>{count++;num.textContent=count;
    for(let i=keys.length-1;i>=0;i--){if(count>=keys[i]){msg.textContent=steps[keys[i]];break;}}
  });
}

// ── Sort: classify items into categories ──
function initSort(el){
  const cats=JSON.parse(el.dataset.categories||'[]');
  const items=JSON.parse(el.dataset.items||'[]');
  let idx=0,score=0,total=items.length;
  const qEl=el.querySelector('.mg-sort-q');
  const btns=el.querySelectorAll('.mg-sort-btns .mg-btn');
  const scoreEl=el.querySelector('.mg-sort-score');
  function show(){if(idx<total){qEl.textContent=items[idx][0];}else{qEl.textContent='完成！';btns.forEach(b=>b.style.display='none');scoreEl.textContent='得分: '+score+'/'+total;}}
  btns.forEach((b,ci)=>b.addEventListener('click',()=>{if(idx>=total)return;if(items[idx][1]===ci){score++;b.classList.add('correct');}else{b.classList.add('wrong');}
    idx++;setTimeout(()=>{btns.forEach(x=>x.classList.remove('correct','wrong'));show();},500);show();
  }));
  show();
}

// ── Auto-init ──
document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('[data-mg]').forEach(el=>{
    const t=el.dataset.mg;
    try{
    if(t==='reveal')initReveal(el);
    else if(t==='quiz')initQuiz(el);
    else if(t==='flip')initFlip(el);
    else if(t==='slider')initSlider(el);
    else if(t==='match')initMatch(el);
    else if(t==='scenario')initScenario(el);
    else if(t==='counter')initCounter(el);
    else if(t==='sort')initSort(el);
    }catch(e){console.warn('mini-games:',t,e);}
  });
});

})();
