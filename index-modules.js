// AI Nav Index Modules — Deferred non-critical JS
// Loaded after page render. Contains: Papers, Tools, Fav, Insights, Automations,
// Todo, Requests, DailyTasks, Timer, System, and init.

(function(){
if(typeof $==='undefined'){console.warn('[modules] core not loaded');return}

// ═══════════ PAPERS ═══════════
window.Papers = {
  allPapers: null,
  catFilter: '',
  async load(){
    const cached=Store.cached('papers');
    if(cached){this.allPapers=cached;this.render();this._tryRefresh();return}
    if(typeof FALLBACK_PAPERS!=='undefined')this.allPapers=FALLBACK_PAPERS;
    else this.allPapers=[];
    this.render();this._tryRefresh();
  },
  async _tryRefresh(){
    try{
      const papers=await this._fetchOpenAlex();
      if(papers&&papers.length>=5){this.allPapers=papers;Store.cache('papers',papers,1800000);this.render()}
    }catch(e){}
  },
  async _fetchOpenAlex(){
    const url='https://api.openalex.org/works?filter=type:article,concepts.id:C154945302|C119857082|C41008148|C2778048844&sort=publication_date:desc&per_page=20';
    const r=await fetch(url,{signal:AbortSignal.timeout(8000)});
    if(!r.ok)return null;
    const d=await r.json();
    if(!d.results||!d.results.length)return null;
    return d.results.map(x=>({
      t:x.title||'Untitled',
      s:(x.primary_location?.source?.display_name||'arXiv').slice(0,25),
      d:(x.publication_date||'').slice(0,10),
      u:x.doi?'https://doi.org/'+x.doi:(x.primary_location?.landing_page_url||x.id||'#'),
      a:(x.authorships||[]).slice(0,2).map(z=>z.author.display_name).join(', '),
      c:this._cat(x.concepts||[]),
      b:x.abstract_inverted_index?this._abs(x.abstract_inverted_index):(x.title||'').slice(0,200)
    }));
  },
  _cat(concepts){
    const n=concepts.slice(0,5).map(c=>c.display_name).join(' ');
    if(/language model|LLM|GPT|BERT|transformer|large language/i.test(n))return'LLM';
    if(/computer vision|image|detection|segment|object/i.test(n))return'CV';
    if(/multimodal|vision-language|clip|audio/i.test(n))return'多模态';
    if(/agent|reinforcement|planning|tool|robot/i.test(n))return'Agent';
    if(/video|animation|rendering|3d generation/i.test(n))return'视频';
    return'AI';
  },
  _abs(inv){
    const p=[];for(const[w,idx]of Object.entries(inv))idx.forEach(i=>p.push([i,w]));
    p.sort((a,b)=>a[0]-b[0]);return p.map(x=>x[1]).join(' ').slice(0,300);
  },
  render(filterCat){
    if(filterCat!==undefined)this.catFilter=filterCat;
    const p=this.catFilter?this.allPapers.filter(x=>x.c===this.catFilter):this.allPapers;
    const ps=$('paperScroll');if(ps)ps.innerHTML=p.map(x=>'<div class="paper-card card" data-url="'+escA(x.u)+'"><div class="paper-cat">'+esc(x.c)+'</div><div class="paper-title">'+esc(x.t)+'</div><div class="paper-abs">'+esc((x.b||x.t).slice(0,150))+'</div><div class="paper-meta"><span>'+esc(x.d||'')+'</span><span>'+esc((x.a||'').slice(0,30))+'</span></div></div>').join('');
    const rp=$('recentPapersScroll');if(rp)rp.innerHTML=p.slice(0,8).map(x=>'<div class="paper-card card" data-url="'+escA(x.u)+'"><div class="paper-cat">'+esc(x.c)+'</div><div class="paper-title">'+esc(x.t)+'</div><div class="paper-abs">'+esc((x.b||x.t).slice(0,120))+'</div><div class="paper-meta"><span>'+esc(x.d||'')+'</span></div></div>').join('');
    const cats={};this.allPapers.forEach(x=>{cats[x.c]=(cats[x.c]||0)+1});
    const top=Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,4);
    const s=$('paperSummary');if(s)s.innerHTML=top.map(([k,v])=>'<div class="stat-card card"><div class="stat-num">'+v+'</div><div class="stat-lbl">'+esc(k)+'</div></div>').join('')+'<div class="stat-card card"><div class="stat-num">'+this.allPapers.length+'</div><div class="stat-lbl">总计</div></div>';
    const sg=$('statsGrid');if(sg)sg.innerHTML='<div class="stat-card card"><div class="stat-num">'+this.allPapers.length+'</div><div class="stat-lbl">论文总数</div></div><div class="stat-card card"><div class="stat-num">'+Object.keys(cats).length+'</div><div class="stat-lbl">研究方向</div></div>';
    const pb=$('paperBadge');if(pb)pb.textContent='同步 '+new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
  },
  filterByCat(cat,e){
    this.catFilter=cat;
    document.querySelectorAll('#paperFilters button').forEach(b=>b.classList.remove('active'));
    if(e&&e.target)e.target.classList.add('active');
    else document.querySelector('#paperFilters button[data-cat=""]')?.classList.add('active');
    this.render();
  }
};

// ═══════════ TOOLS ═══════════
window.Tools = {
  _searchQ:'',
  render(filtered){
    const tools=filtered||DATA.tools;
    const cats=['LLM','编程','图像','视频','音乐','设计','办公','搜索','社区','本地'];
    const pick=tools[Math.floor(Math.random()*tools.length)]||DATA.tools[1];
    const ht=$('heroTitle');if(ht)ht.textContent=pick.nm;
    const hd=$('heroDesc');if(hd)hd.textContent=pick.d;
    const hc=$('heroCard');if(hc)hc.dataset.url=pick.u;
    const hn=$('heroNum');if(hn)hn.textContent=tools.length;
    const hl=$('heroLbl');if(hl)hl.textContent=tools.length+' 工具';
    const tc=$('toolCount');if(tc)tc.textContent=tools.length+' 工具';
    const tcat=$('toolCategories');if(tcat)tcat.innerHTML=cats.map(c=>{const count=tools.filter(t=>t.c===c).length;return count?'<button class="subnav-btn" onclick="Tools.filterCat(\''+escA(c)+'\',event)">'+esc(c)+' ('+count+')</button>':''}).join('');
    const tg=$('toolGrid');if(tg)tg.innerHTML=tools.map(x=>'<div class="tool-card card" data-url="'+escA(x.u)+'"><div class="tool-top"><span class="tool-emoji">'+esc(x.e)+'</span><span class="tool-name">'+esc(x.nm)+'</span><button class="tool-fav" data-tool="'+escA(x.nm)+'" onclick="Fav.toggle(event,\''+escA(x.nm)+'\')">☆</button></div><div class="tool-desc">'+esc(x.d)+'</div><div class="tool-tags">'+x.t.map(tg=>'<span class="tool-tag">'+esc(tg)+'</span>').join('')+'</div></div>').join('');
    Fav.sync();
  },
  filterCat(c,e){this.render(DATA.tools.filter(t=>t.c===c));document.querySelectorAll('#toolCategories button').forEach(b=>b.classList.remove('active'));if(e&&e.target)e.target.classList.add('active');}
};

// ═══════════ FAV ═══════════
window.Fav = {
  get(){return Store.get('favs')||[]},
  toggle(e,name){e.stopPropagation();const f=this.get();const i=f.indexOf(name);if(i>-1)f.splice(i,1);else f.push(name);Store.set('favs',f);this.sync();toast(i>-1?'取消收藏:'+name:'已收藏:'+name);},
  sync(){
    const f=this.get();
    const fl=$('favList');if(!fl)return;
    fl.innerHTML=f.length?f.map(n=>{const t=DATA.tools.find(x=>x.nm===n);if(!t)return'';return'<div class="fav-item" onclick="window.open(\''+escA(t.u)+'\',\'_blank\')">'+esc(t.e)+' '+esc(t.nm)+'</div>'}).join(''):'<div style="font-size:12px;color:var(--tx2);text-align:center;padding:12px">暂无收藏</div>';
    document.querySelectorAll('.tool-fav').forEach(b=>{if(f.includes(b.dataset.tool))b.classList.add('on');else b.classList.remove('on');});
  },
  open(){$('favPanel').classList.toggle('open');},
  close(){$('favPanel').classList.remove('open');}
};

// ═══════════ INSIGHTS ═══════════
window.Insights = {
  render(){
    const d=DATA.insights;
    const is=$('insightsScroll');if(!is)return;
    is.innerHTML=d.map(x=>'<div class="insight-card card"><div class="insight-cat" style="color:'+x.color+'">'+esc(x.cat)+'</div><div class="insight-sum">'+esc(x.sum)+'</div><div class="insight-list">'+x.items.map(p=>'<div class="insight-item" onclick="window.open(\''+escA(p.u)+'\',\'_blank\')"><span class="insight-dot" style="background:'+x.color+'"></span><span class="title">'+esc(p.t)+'</span><span class="src">'+esc(p.s)+'</span></div>').join('')+'</div></div>').join('');
  }
};

// ═══════════ AUTOMATIONS ═══════════
window.Automations = {
  async load(){
    let tasks=Store.cached('autos')||[];
    try{
      const r=await fetch('https://raw.githubusercontent.com/LaskyMY/ai-nav/main/automations.json',{signal:AbortSignal.timeout(3000)});
      if(r.ok){const d=await r.json();tasks=d.tasks||[];Store.cache('autos',tasks,300000);}
    }catch(e){}
    if(!tasks.length)tasks=[{name:'论文数据刷新',schedule:'每5分钟',status:'active',last:'-'},{name:'天气更新',schedule:'每10分钟',status:'active',last:'-'},{name:'GitHub Pages 部署',schedule:'自动',status:'active',last:'刚刚'}];
    const as=$('automationsScroll');if(as)as.innerHTML=tasks.map(x=>'<div class="card" style="min-width:200px;padding:14px;flex-shrink:0"><div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span style="width:6px;height:6px;border-radius:50%;background:'+(x.status==='active'?'var(--a2)':'var(--amber)')+'"></span><span style="font-weight:600;font-size:13px">'+esc(x.nm||x.name)+'</span></div><div style="font-size:11px;color:var(--tx2)">⏱ '+esc(x.sch||x.schedule||'')+' · '+esc(x.last||'-')+'</div></div>').join('');
  }
};

// ═══════════ TODO ═══════════
window.Todo = {
  _pri:false,_fullPri:false,_filter:'all',
  get(){return Store.get('todos')||[]},
  save(d){Store.set('todos',d)},
  init(){
    const t=this.get();this.renderHero(t);this.renderFull();
  },
  renderHero(todos){
    const t=todos||this.get();
    const done=t.filter(x=>x.done).length,total=t.length;
    const urgent=t.filter(x=>!x.done&&x.priority==='high').length;
    const bc=$('todoBadgeCount');if(bc)bc.textContent=done+'/'+total;
    const st=$('todoStatTotal');if(st)st.textContent=total;
    const sd=$('todoStatDone');if(sd)sd.textContent=done;
    const su=$('todoStatUrgent');if(su)su.textContent=urgent;
    const pb=$('todoProgressBar');if(pb)pb.style.width=total?Math.round(done/total*100)+'%':'0%';
    const show=t.slice(0,5);
    const hl=$('todoHeroList');if(hl)hl.innerHTML=show.map(x=>this.itemHtml(x,false)).join('');
    if(total>5&&hl)hl.innerHTML+='<div style="font-size:12px;color:var(--tx3);text-align:center;padding:8px;cursor:pointer" onclick="App.switchPage(\'todos\')">还有 '+(total-5)+' 个任务 → 查看全部</div>';
    else if(total===0&&hl)hl.innerHTML='<div style="font-size:12px;color:var(--tx3);text-align:center;padding:16px">暂无待办 ✅</div>';
  },
  renderFull(){
    let t=this.get();
    if(this._filter==='pending')t=t.filter(x=>!x.done);
    else if(this._filter==='done')t=t.filter(x=>x.done);
    else if(this._filter==='urgent')t=t.filter(x=>!x.done&&x.priority==='high');
    const fc=$('todoFilterCount');if(fc)fc.textContent='共 '+t.length+' 项';
    const tb=$('todoBadge');if(tb)tb.textContent='共 '+this.get().length+' 项';
    const fl=$('todoFullList');if(fl)fl.innerHTML=t.length?t.map(x=>this.itemHtml(x,true)).join(''):'<div style="text-align:center;padding:30px;color:var(--tx3)">没有符合条件的任务</div>';
  },
  itemHtml(t,full){
    let dl='',dlClass='';
    if(t.deadline){const d=new Date(t.deadline);const diff=d-Date.now();const days=Math.floor(diff/86400000);let ds=days<0?'已过期':(days===0?'今天':(days===1?'明天':(d.getMonth()+1)+'/'+d.getDate()));dl='⏰ '+ds;dlClass=days<0?'urgent':(days<=2?'soon':'');}
    return '<div class="todo-item'+(t.done?' done':'')+'" data-id="'+escA(t.id)+'"><div class="todo-check'+(t.done?' checked':'')+'" onclick="Todo.toggle(\''+escA(t.id)+'\')"></div><div class="todo-body"><div class="todo-text">'+esc(t.text)+'</div>'+(full?'<div class="todo-meta">'+(dl?'<span class="'+dlClass+'">'+esc(dl)+'</span>':'')+(t.priority==='high'?'<span class="urgent">🔴 紧急</span>':'')+'</div>':'')+'</div>'+(full?'<button class="todo-del" onclick="Todo.del(\''+escA(t.id)+'\')">×</button>':'')+'</div>';
  },
  toggleAdd(){const a=$('todoAddArea'),b=$('todoAddToggle');if(a.style.display==='none'){a.style.display='block';b.textContent='收起'}else{a.style.display='none';b.textContent='+ 添加'}},
  togglePri(){this._pri=!this._pri;const b=$('todoPriBtn');if(b)b.classList.toggle('urgent',this._pri);const t=$('todoPriBtn');if(t)t.textContent=this._pri?'🔴 已标紧急':'🔴 设为紧急'},
  toggleFullPri(){this._fullPri=!this._fullPri;const b=$('todoFullPriBtn');if(b)b.classList.toggle('urgent',this._fullPri);const t=$('todoFullPriBtn');if(t)t.textContent=this._fullPri?'🔴 已标紧急':'🔴 设为紧急'},
  add(){
    const inp=$('todoInputHero');const txt=inp.value.trim();if(!txt){toast('请输入任务内容');return}
    const t=this.get();t.unshift({id:'t'+Date.now(),text:txt,done:false,createdAt:new Date().toISOString(),priority:this._pri?'high':null,deadline:$('todoDeadline').value||null});
    this.save(t);inp.value='';const dd=$('todoDeadline');if(dd)dd.value='';this._pri=false;const b=$('todoPriBtn');if(b)b.classList.remove('urgent');if(b)b.textContent='🔴 设为紧急';this.init();toast('已添加: '+txt);
  },
  addFull(){
    const inp=$('todoFullInput');const txt=inp.value.trim();if(!txt){toast('请输入任务内容');return}
    const t=this.get();t.unshift({id:'t'+Date.now(),text:txt,done:false,createdAt:new Date().toISOString(),priority:this._fullPri?'high':null,deadline:$('todoFullDeadline').value||null});
    this.save(t);inp.value='';const dd=$('todoFullDeadline');if(dd)dd.value='';this._fullPri=false;const b=$('todoFullPriBtn');if(b)b.classList.remove('urgent');if(b)b.textContent='🔴 设为紧急';this.init();toast('已添加: '+txt);
  },
  toggle(id){const t=this.get();const item=t.find(x=>x.id===id);if(item)item.done=!item.done;this.save(t);this.init();toast(item.done?'✅ 已完成':'↩️ 已重做');},
  del(id){const t=this.get();const i=t.findIndex(x=>x.id===id);if(i>-1){const rm=t.splice(i,1)[0];this.save(t);this.init();toast('已删除: '+rm.text);}},
  filter(f,e){this._filter=f;document.querySelectorAll('#todoFilters button').forEach(b=>b.classList.remove('active'));if(e&&e.target)e.target.classList.add('active');this.renderFull();}
};

// ═══════════ REQUESTS ═══════════
window.Requests = {
  get(){return Store.get('reqs')||[];},
  save(d){Store.set('reqs',d);},
  render(){
    const reqs=this.get();
    const rl=$('reqList');if(!rl)return;
    if(!reqs.length){rl.innerHTML='<div style="text-align:center;padding:30px;color:var(--tx3)">还没有需求记录<br>在上方输入框创建第一个</div>';return}
    reqs.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    rl.innerHTML=reqs.map(r=>{const sm={open:['open','待处理'],doing:['doing','进行中'],done:['done','已完成']};const[cls,label]=sm[r.status]||sm.open;return '<div class="req-item'+(r.status==='done'?' done':'')+'"><div class="req-item-body"><div class="req-item-text">'+esc(r.text)+'</div><div class="req-item-date">'+this._date(r.createdAt)+'</div></div><span class="req-status '+cls+'" onclick="Requests.cycle(\''+escA(r.id)+'\')">'+esc(label)+'</span><button class="req-del" onclick="Requests.del(\''+escA(r.id)+'\')">✕</button></div>';}).join('');
  },
  add(){const inp=$('reqInput');const txt=inp.value.trim();if(!txt){toast('请输入需求内容');return}const reqs=this.get();reqs.unshift({id:'r'+Date.now(),text:txt,status:'open',createdAt:new Date().toISOString()});this.save(reqs);inp.value='';this.render();toast('已记录: '+txt);},
  cycle(id){const reqs=this.get();const item=reqs.find(r=>r.id===id);if(!item)return;const flow=['open','doing','done'];item.status=flow[(flow.indexOf(item.status)+1)%3];this.save(reqs);this.render();toast('→ '+({'open':'待处理','doing':'进行中','done':'已完成'})[item.status]);},
  del(id){const reqs=this.get();const i=reqs.findIndex(r=>r.id===id);if(i>-1){const rm=reqs.splice(i,1)[0];this.save(reqs);this.render();toast('已删除: '+rm.text)}},
  _date(iso){try{const d=new Date(iso);return(d.getMonth()+1)+'/'+d.getDate()+' '+d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0')}catch(e){return iso}}
};

// ═══════════ DAILY TASKS ═══════════
window.DailyTasks = {
  TASKS:[{id:'upper-body-am',icon:'🏋️',label:'上肢锻炼（上午）'},{id:'upper-body-pm',icon:'🏋️',label:'上肢锻炼（下午）'},{id:'swimming',icon:'🏊',label:'游泳'},{id:'stand-hourly',icon:'🧍',label:'每小时起立活动'},{id:'ai-review',icon:'🤖',label:'AI成果验收'}],
  get(){const d=Store.get('dailyTasks');const today=new Date().toDateString();if(!d||d.date!==today)return{date:today,tasks:this.TASKS.map(t=>({...t,done:false}))};return d;},
  save(d){Store.set('dailyTasks',d)},
  init(){const d=this.get();this.save(d);this.render(d);},
  render(d){const data=d||this.get();const done=data.tasks.filter(t=>t.done).length;const total=data.tasks.length;const db=$('dailyBadge');if(db)db.textContent=done+'/'+total;const pb=$('dailyProgressBar');if(pb)pb.style.width=Math.round(done/total*100)+'%';const dl=$('dailyList');if(dl)dl.innerHTML=data.tasks.map(t=>'<div class="daily-item'+(t.done?' done':'')+'" onclick="DailyTasks.toggle(\''+escA(t.id)+'\')"><div class="daily-check'+(t.done?' checked':'')+'"></div><span class="daily-icon">'+esc(t.icon)+'</span><span class="daily-text">'+esc(t.label)+'</span><span class="daily-reset">每日重置</span></div>').join('');},
  toggle(id){const d=this.get();const t=d.tasks.find(x=>x.id===id);if(t){t.done=!t.done;this.save(d);this.render(d)}}
};

// ═══════════ TIMER ═══════════
window.Timer = {
  mode:'stopwatch',running:false,interval:null,startTime:0,elapsed:0,cdTotal:0,cdRemain:0,laps:[],pomoCount:0,pomoTotal:0,pomoBreak:false,
  switchMode(m,e){this.reset();this.mode=m;document.querySelectorAll('#timerTabs button').forEach(b=>b.classList.remove('active'));if(e&&e.target)e.target.classList.add('active');const cp=$('countdownPresets');if(cp)cp.style.display=m==='countdown'?'block':'none';const ps=$('pomoSection');if(ps)ps.style.display=m==='pomodoro'?'block':'none';const ls=$('lapSection');if(ls)ls.style.display=m==='stopwatch'?'block':'none';if(m==='pomodoro'){this.cdTotal=25*60;this.cdRemain=this.cdTotal;this._disp(this.cdRemain);this._ring(1);const tl=$('timerLabel');if(tl)tl.textContent='🍅 专注时间';}else{const tl=$('timerLabel');if(tl)tl.textContent='点击开始计时';this._disp(0);this._ring(1);}},
  setCountdown(m){this.cdTotal=m*60;this.cdRemain=this.cdTotal;this._disp(this.cdRemain);this._ring(1);const tl=$('timerLabel');if(tl)tl.textContent='已设定 '+m+' 分钟';},
  start(){if(this.running)return;this.running=true;const pb=$('timerPauseBtn');if(pb)pb.style.display='inline-block';if(this.mode==='stopwatch'){this.startTime=Date.now()-this.elapsed;const tl=$('timerLabel');if(tl)tl.textContent='计时中...';}else{if(this.cdRemain<=0){toast('请先设定时间');this.running=false;if(pb)pb.style.display='none';return}const tl=$('timerLabel');if(tl)tl.textContent=this.pomoBreak?'🍅 休息中...':(this.mode==='pomodoro'?'🍅 专注中...':'倒计时中...');}this.interval=setInterval(()=>this._tick(),200);},
  pause(){if(!this.running)return;this.running=false;clearInterval(this.interval);const pb=$('timerPauseBtn');if(pb)pb.style.display='none';const tl=$('timerLabel');if(tl)tl.textContent='已暂停';if(this.mode==='stopwatch')this.elapsed=Date.now()-this.startTime;},
  reset(){this.running=false;clearInterval(this.interval);this.elapsed=0;this.laps=[];const ll=$('lapList');if(ll)ll.innerHTML='';const pb=$('timerPauseBtn');if(pb)pb.style.display='none';const rt=$('timerRingText');if(rt){rt.classList.remove('warn','danger');}if(this.mode==='stopwatch'){this._disp(0);this._ring(1);const tl=$('timerLabel');if(tl)tl.textContent='点击开始计时';}else if(this.mode==='pomodoro'){this.pomoBreak=false;this.cdTotal=25*60;this.cdRemain=this.cdTotal;this._disp(this.cdRemain);this._ring(1);const tl=$('timerLabel');if(tl)tl.textContent='🍅 专注时间';}else{this.cdRemain=this.cdTotal;this._disp(this.cdRemain);this._ring(1);const tl=$('timerLabel');if(tl)tl.textContent='已重置';}this._updatePomo();},
  lap(){if(this.mode!=='stopwatch'||!this.running)return;const now=Date.now()-this.startTime;this.laps.push(now);const ll=$('lapList');if(ll)ll.innerHTML=this.laps.map((l,i)=>{const prev=i>0?this.laps[i-1]:0;const diff=l-prev;return '<div style="display:flex;justify-content:space-between;padding:6px 10px;font-size:12px;border-bottom:1px solid rgba(255,255,255,.03)"><span style="color:var(--tx2)">#'+(i+1)+'</span><span style="color:var(--a1)">'+this._fmt(diff)+'</span><span style="color:var(--tx3)">'+this._fmt(l)+'</span></div>'}).reverse().join('');},
  _tick(){if(this.mode==='stopwatch'){this.elapsed=Date.now()-this.startTime;this._disp(Math.floor(this.elapsed/1000));this._ring(1);}else{if(this.cdRemain<=0){this.running=false;clearInterval(this.interval);const pb=$('timerPauseBtn');if(pb)pb.style.display='none';this._onEnd();return;}this.cdRemain--;this._disp(this.cdRemain);this._ring(this.cdRemain/this.cdTotal);const rt=$('timerRingText');if(this.cdRemain<=10){rt.classList.add('danger');rt.classList.remove('warn');}else if(this.cdRemain<=60){rt.classList.add('warn');rt.classList.remove('danger');}}},
  _onEnd(){if(this.mode==='pomodoro'){if(!this.pomoBreak){this.pomoCount++;this.pomoTotal+=25;this._updatePomo();toast('🍅 专注完成！休息 5 分钟');Modal.show({icon:'🍅',title:'专注完成！',body:'休息 5 分钟，放松一下',btn:'开始休息'});this.pomoBreak=true;this.cdTotal=5*60;this.cdRemain=this.cdTotal;}else{toast('休息结束，新一轮开始！');Modal.show({icon:'🍅',title:'休息结束',body:'新一轮专注开始！',btn:'开始专注'});this.pomoBreak=false;this.cdTotal=25*60;this.cdRemain=this.cdTotal;}const tl=$('timerLabel');if(tl)tl.textContent=this.pomoBreak?'🍅 休息时间':'🍅 新一轮';}else{toast('⏰ 倒计时结束！');const tl=$('timerLabel');if(tl)tl.textContent='✅ 倒计时结束！';Modal.show({icon:'⏰',title:'倒计时结束！',body:'设定时间已到，请注意。',btn:'知道了'});}try{const ctx=new(window.AudioContext||window.webkitAudioContext)();const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=880;g.gain.value=.3;o.start();o.stop(ctx.currentTime+.3);setTimeout(()=>{const o2=ctx.createOscillator(),g2=ctx.createGain();o2.connect(g2);g2.connect(ctx.destination);o2.frequency.value=1100;g2.gain.value=.3;o2.start();o2.stop(ctx.currentTime+.3)},350)}catch(e){}},
  _disp(secs){const h=Math.floor(secs/3600),m=Math.floor((secs%3600)/60),s=secs%60;let t=h>0?h+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'):String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');if(this.mode==='stopwatch')t+='.'+Math.floor((this.elapsed%1000)/100);const rt=$('timerRingText');if(rt)rt.textContent=t;},
  _ring(ratio){const rf=$('timerRingFg');if(rf)rf.style.strokeDashoffset=(2*Math.PI*90)*(1-ratio);},
  _updatePomo(){Store.set('pomo',{c:this.pomoCount,t:this.pomoTotal});const pc=$('pomoCount');if(pc)pc.textContent=this.pomoCount;const pt=$('pomoTotal');if(pt)pt.textContent=this.pomoTotal+'m';},
  _fmt(ms){const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60);return(h>0?h+':':'')+String(m).padStart(2,'0')+':'+String(s%60).padStart(2,'0')+'.'+Math.floor((ms%1000)/100);}
};

// ═══════════ SYSTEM ═══════════
window.System = {
  _base:'http://127.0.0.1:9337',_online:false,
  async init(){const ok=await this.ping();if(ok){this._online=true;this.load();this.autoRefresh=setInterval(()=>this.load(),5000);}},
  async ping(){try{const r=await fetch(this._base+'/api/ping',{signal:AbortSignal.timeout(2000)});const d=await r.json();const sh=$('sysHost');if(sh)sh.textContent=d.host||'--';const sd=$('sysStatusDot');if(sd)sd.style.background='#10b981';return true;}catch(e){const so=$('sysOutput');if(so)so.textContent='Bridge 离线\n\n请在本机运行:  python3 server.py';return false;}},
  async load(){if(!this._online)return;try{const r=await fetch(this._base+'/api/status',{signal:AbortSignal.timeout(3000)});const d=await r.json();const su=$('sysUptime');if(su)su.textContent=d.uptime||'--';const sc=$('sysClaude');if(sc)sc.textContent=d.claudeProcs!==undefined?d.claudeProcs:'--';const sl=$('sysLoad');if(sl)sl.textContent=d.load||'--';const sm=$('sysMem');if(sm)sm.textContent=d.memory||'--';const sd=$('sysStatusDot');if(sd)sd.style.background='#10b981';}catch(e){const sd=$('sysStatusDot');if(sd)sd.style.background='#ef4444';}},
  async exec(){const input=$('sysCmd');const cmd=input.value.trim();if(!cmd)return;const out=$('sysOutput');out.textContent+='\n$ '+cmd+'\n';input.value='';out.scrollTop=out.scrollHeight;if(!this._online){out.textContent+='Bridge 离线\n';return}try{const r=await fetch(this._base+'/api/cli',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cmd,timeout:15}),signal:AbortSignal.timeout(18000)});const d=await r.json();if(d.out)out.textContent+=d.out;if(d.err)out.textContent+=d.err;if(!d.ok&&d.err)out.textContent+=d.err;out.scrollTop=out.scrollHeight;}catch(e){out.textContent+='错误: '+e.message+'\n';}},
  keydown(e){if(e.key==='Enter')this.exec();}
};

// ═══════════ MODULE EVENT BINDINGS ═══════════
// Paper filters
document.querySelectorAll('#paperFilters button').forEach(b=>b.addEventListener('click',function(){Papers.filterByCat(this.dataset.cat||'',{target:this});}));
// Timer tabs
document.querySelectorAll('#timerTabs button').forEach(b=>b.addEventListener('click',function(){Timer.switchMode(this.dataset.mode,{target:this});}));
// Todo filters
document.querySelectorAll('#todoFilters button').forEach(b=>b.addEventListener('click',function(){Todo.filter(this.dataset.filter,{target:this});}));

// ═══════════ MODULES INIT ═══════════
System.init();
setTimeout(function(){
  Weather.load();
  Papers.load();
  Tools.render();
  Insights.render();
  Automations.load();
  Todo.init();
  DailyTasks.init();
  Requests.render();
},50);
(function(){const p=Store.get('pomo');if(p){Timer.pomoCount=p.c||0;Timer.pomoTotal=p.t||0;Timer._updatePomo();}})();
// Auto-refresh
setInterval(function(){Papers._tryRefresh();},300000);
setInterval(function(){Weather.load();},600000);
setInterval(function(){Automations.load();},120000);

console.log('[modules] ✅ 所有模块已加载');
})();
