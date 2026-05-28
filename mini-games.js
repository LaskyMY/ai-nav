/* mini-games.js — 12 interactive knowledge games. Zero deps. */
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
      if(i===correct){b.classList.add('correct');fb.textContent=el.dataset.right||'✅ 正确！';fb.className='mg-feedback mg-right';}
      else{b.classList.add('wrong');btns[correct].classList.add('correct');fb.textContent=el.dataset.wrong||'❌ 不对哦';fb.className='mg-feedback mg-wrong';}
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
    if(pairs[li]===ri){selL.classList.add('ok');r.classList.add('ok');matched++;if(matched===pairs.length)el.querySelector('.mg-match-msg').textContent='🎉 全部正确！';}
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

// ── ✨ NEW: Quiz4 — 4-option quiz with per-option explanation + score ──
function initQuiz4(el){
  const correct=parseInt(el.dataset.correct);
  const explains=JSON.parse(el.dataset.explains||'["","","",""]');
  const opts=el.querySelectorAll('.mg-q4-opt');
  const explainEl=el.querySelector('.mg-q4-explain');
  const scoreEl=el.querySelector('.mg-q4-score');
  let done=false,total=0,correctCount=0;

  // Page-level score persistence across multiple quiz4 cards
  const pageScore=el.closest('.card')?null:null;

  opts.forEach((b,i)=>{
    b.addEventListener('click',()=>{
      if(done)return;done=true;
      // Highlight correct & wrong
      opts.forEach((x,j)=>{
        x.classList.add(j===correct?'correct':'wrong');
        x.style.pointerEvents='none';
      });
      // Show explanation
      explainEl.innerHTML='<div class="mg-q4-explain-inner">'+
        (i===correct?'<span class="mg-q4-icon">🎯</span> ':'<span class="mg-q4-icon">📌</span> ')+
        explains[i]+'</div>';
      explainEl.classList.add('show');
      // Score
      if(i===correct){
        correctCount++;
        el.querySelector('.mg-q4-counter').textContent='✓';
      } else {
        el.querySelector('.mg-q4-counter').textContent='✗';
      }
    });
  });
}

// ── ✨ NEW: Scale — Likert 1-5 self-assessment → score profile ──
function initScale(el){
  const items=JSON.parse(el.dataset.items||'[]');
  const profiles=JSON.parse(el.dataset.profiles||'{}');
  const profileKeys=Object.keys(profiles).sort((a,b)=>parseInt(a)-parseInt(b));
  const rows=el.querySelectorAll('.mg-scale-row');
  const resultEl=el.querySelector('.mg-scale-result');
  const scoreLabel=el.querySelector('.mg-scale-score');
  let answers=Array(items.length).fill(-1);

  rows.forEach((row,ri)=>{
    const btns=row.querySelectorAll('.mg-scale-btn');
    btns.forEach(b=>{
      b.addEventListener('click',()=>{
        btns.forEach(x=>x.classList.remove('sel'));
        b.classList.add('sel');
        answers[ri]=parseInt(b.dataset.v);
        // Check if all answered
        if(answers.every(a=>a>=0)){
          const total=answers.reduce((s,a)=>s+a,0);
          const max=items.length*5;
          // Find matching profile
          let label='';
          for(const k of profileKeys){
            if(total>=parseInt(k)) label=profiles[k];
          }
          scoreLabel.textContent=total+'/'+max;
          resultEl.textContent=label;
          resultEl.classList.add('show');
        }
      });
    });
  });
}

// ── ✨ NEW: Spot — find the bias/fallacy among 4 scenarios ──
function initSpot(el){
  const cards=el.querySelectorAll('.mg-spot-card');
  const fbEl=el.querySelector('.mg-spot-fb');
  const label=el.dataset.label||'目标概念';
  let done=false;

  cards.forEach(card=>{
    card.addEventListener('click',()=>{
      if(done)return;done=true;
      const hasIt=card.dataset.has==='true';
      cards.forEach(c=>{
        c.style.pointerEvents='none';
        if(c.dataset.has==='true') c.classList.add('correct');
        if(c===card&&!hasIt) c.classList.add('wrong');
      });
      if(hasIt){
        fbEl.innerHTML='<span class="mg-right">🎯 找到了！这就是<strong>'+label+'</strong>的典型表现。</span>';
      } else {
        fbEl.innerHTML='<span class="mg-wrong">❌ 这不是。上面<strong>绿色高亮</strong>的才是包含<strong>'+label+'</strong>的场景。</span>';
      }
      fbEl.classList.add('show');
    });
  });
}

// ── ✨ NEW: Trap — multi-step choices → fall into the bias → reveal ──
function initTrap(el){
  const steps=JSON.parse(el.dataset.steps||'[]');
  const title=el.dataset.title||'';
  let stepIdx=0;
  const promptEl=el.querySelector('.mg-trap-prompt');
  const choicesEl=el.querySelector('.mg-trap-choices');
  const revealEl=el.querySelector('.mg-trap-reveal');
  const stepNum=el.querySelector('.mg-trap-step');

  function showStep(){
    if(stepIdx>=steps.length){
      promptEl.textContent='测验完成';
      choicesEl.innerHTML='';
      stepNum.textContent=steps.length+'/'+steps.length;
      return;
    }
    const s=steps[stepIdx];
    stepNum.textContent=(stepIdx+1)+'/'+steps.length;
    promptEl.textContent=s.prompt;
    choicesEl.innerHTML='';
    const labels=s.labels||['A','B','C','D'];
    s.choices.forEach((c,i)=>{
      const btn=document.createElement('button');
      btn.className='mg-btn';
      btn.textContent=labels[i]+'. '+c;
      btn.addEventListener('click',()=>{
        // Disable all
        choicesEl.querySelectorAll('.mg-btn').forEach(b=>{b.style.pointerEvents='none';});
        // Highlight
        if(s.trap!==undefined&&i===s.trap){
          btn.classList.add('wrong');
          choicesEl.querySelectorAll('.mg-btn')[s.trap].classList.add('wrong');
          const correctIdx=s.correct!==undefined?s.correct:(s.trap===0?1:0);
          choicesEl.querySelectorAll('.mg-btn')[correctIdx].classList.add('correct');
          revealEl.innerHTML=s.reveal||'';
          revealEl.classList.add('show');
        } else if(s.correct!==undefined){
          if(i===s.correct){
            btn.classList.add('correct');
            revealEl.innerHTML=s.reveal||'✅ 正确！';
          } else {
            btn.classList.add('wrong');
            choicesEl.querySelectorAll('.mg-btn')[s.correct].classList.add('correct');
            revealEl.innerHTML=s.reveal||'';
          }
          revealEl.classList.add('show');
        } else {
          btn.classList.add('correct');
          revealEl.innerHTML=s.reveal||'';
          revealEl.classList.add('show');
        }
        // Show next button
        const nextBtn=document.createElement('button');
        nextBtn.className='mg-btn mg-trap-next';
        nextBtn.textContent=stepIdx<steps.length-1?'下一题 →':'查看结果';
        nextBtn.addEventListener('click',()=>{
          stepIdx++;
          revealEl.classList.remove('show');
          showStep();
        });
        choicesEl.appendChild(nextBtn);
      });
      choicesEl.appendChild(btn);
    });
  }
  showStep();
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
    else if(t==='quiz4')initQuiz4(el);
    else if(t==='scale')initScale(el);
    else if(t==='spot')initSpot(el);
    else if(t==='trap')initTrap(el);
    }catch(e){console.warn('mini-games:',t,e);}
  });
});

// ── Scroll progress bar ──
(function(){
  var bar=document.createElement('div');
  bar.style.cssText='position:fixed;top:0;left:0;height:2.5px;background:linear-gradient(90deg,var(--a1),var(--cyan,var(--a1)),var(--a2));z-index:9999;width:0;border-radius:0 2px 2px 0;transition:width .08s linear;pointer-events:none';
  document.body.appendChild(bar);
  window.addEventListener('scroll',function(){
    var h=document.documentElement.scrollHeight-window.innerHeight;
    bar.style.width=h>0?(window.pageYOffset/h*100)+'%':'0%';
  },{passive:true});
})();

})();
