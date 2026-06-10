// AI Nav 全站爬虫 v2
const BASE = "http://localhost:8765";
let pass=0, fail=0, visited=new Set();

async function crawl(url, depth=0) {
  if (depth>3 || visited.has(url) || visited.size>200) return;
  if (url==="/") url="/index.html";
  visited.add(url);
  try {
    const r = await fetch(BASE+url, {signal:AbortSignal.timeout(5000)});
    const html = await r.text();
    if (!r.ok || html.length<300) return;

    const checks = {
      doctype: html.startsWith("<!DOCTYPE"),
      viewport: html.includes("viewport"),
      body_close: html.includes("</body>"),
      glow_spot: html.includes("glowSpot"),
      font_ui: html.includes("system-ui"),
      backdrop: html.includes("backdrop-filter"),
      return_link: html.includes("返回") || html.includes('history.back'),
    };
    let failed=[];
    for(const[k,v] of Object.entries(checks)) if(!v) failed.push(k);

    const name = url.split("/").pop()||"index.html";
    console.log(`  ${failed.length?"❌":"✅"} ${name} (${html.length}B)${failed.length?" — 缺:"+failed.join(","):""}`);
    failed.length?fail++:pass++;

    // 发现新链接: href="./xxx.html" or href="/xxx.html"
    const links = html.match(/href=["']\.?\/([^"']+\.html)["']/g)||[];
    for(const l of links.slice(0,30)) {
      const href = l.match(/href=["']([^"']+)["']/)[1];
      let nu = href.startsWith("/") ? href : url.split("/").slice(0,-1).join("/")+"/"+href;
      nu = nu.replace(/\/\.\//g,"/");
      while(nu.includes("/../")) nu = nu.replace(/\/[^/]+\/\.\.\//,"/");
      if(!visited.has(nu)) await crawl(nu, depth+1);
    }
  } catch(e) { console.log(`  ⚠️ ${url}: ${e.message}`) }
}

console.log("🔍 AI Nav Crawler v2\n");
await crawl("/");
const pct = pass+fail>0 ? Math.round(pass/(pass+fail)*100) : 0;
console.log(`\n═══ 爬虫结果 ═══`);
console.log(`  ✅ ${pass}  ❌ ${fail}  通过率: ${pct}%  发现: ${visited.size}页`);
Deno.exit(fail>0?1:0);
