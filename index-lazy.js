// AI Nav 按需加载模块 — 减少首页初始加载
(function(){
  if(typeof App==='undefined')return;
  var loaded={};
  var API=location.hostname==='localhost'?'http://localhost:8765':'https://99107705bcfb4f23-183-6-87-29.serveousercontent.com';
  
  // 拦截页面切换，按需加载数据
  var origSwitch=App.switchPage;
  App.switchPage=function(name){
    origSwitch.call(App,name);
    // 懒加载各页面数据
    if(name==='papers'&&!loaded.papers){
      loaded.papers=true;
      fetch(API+'/api/db/summaries?type=papers-summary').then(r=>r.json()).then(d=>{
        if(d&&d.length)console.log('[lazy] Papers loaded:',d.length);
      }).catch(function(){});
    }
    if(name==='vfx'&&!loaded.vfx){
      loaded.vfx=true;
      console.log('[lazy] VFX section activated');
    }
    if(name==='overview'&&!loaded.insights){
      loaded.insights=true;
      // Insights already loaded by init, just mark
    }
  };
  
  // 延迟加载非关键资源
  window.addEventListener('load',function(){
    setTimeout(function(){
      // 预加载金融简报
      if(document.getElementById('finBriefCard')){
        fetch(API+'/api/financial/latest').then(r=>r.json()).then(d=>{
          if(d&&d.length){
            var s=d.find(function(x){return x.type==='summary'});
            if(s&&s.content){
              var el=document.getElementById('finBriefContent');
              if(el)el.textContent=s.content.slice(0,200)+'...';
            }
          }
        }).catch(function(){});
      }
    },2000);
  });
  
  console.log('[lazy] 按需加载模块已激活');
})();
