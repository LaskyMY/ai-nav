// AI Nav 按需加载模块 v2 — 主页拆分后智能加载
(function(){
  if(typeof App==='undefined')return;

  var API=location.hostname==='localhost'?'http://localhost:8765':'https://99107705bcfb4f23-183-6-87-29.serveousercontent.com';

  // Track which data has been fetched
  var fetched={};

  // Intercept page switches for lazy data loading
  var origSwitch=App.switchPage;
  App.switchPage=function(name){
    origSwitch.call(App,name);

    // Load data when user switches to specific tabs
    if(name==='papers'&&!fetched.papers){
      fetched.papers=true;
      fetch(API+'/api/db/summaries?type=papers-summary').then(function(r){return r.json()}).then(function(d){
        if(d&&d.length)console.log('[lazy] Papers loaded:',d.length);
      }).catch(function(){});
    }
    if(name==='overview'&&!fetched.insights){
      fetched.insights=true;
    }
  };

  // Deferred: load non-critical data after page is fully loaded
  window.addEventListener('load',function(){
    setTimeout(function(){
      // Pre-load financial brief content
      var el=document.getElementById('finBriefCard');
      if(el){
        fetch(API+'/api/financial/latest').then(function(r){return r.json()}).then(function(d){
          if(d&&d.length){
            var s=d.find(function(x){return x.type==='summary'});
            var briefEl=document.getElementById('finBriefContent');
            if(s&&s.content&&briefEl){
              briefEl.textContent=s.content.slice(0,200)+'...';
            }
          }
        }).catch(function(){});
      }
    },1500);
  });

  console.log('[lazy] v2 模块加载器已激活');
})();
