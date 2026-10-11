"use strict";
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,"../..");
const release=require("../../release.json");
(async()=>{
  const handlers={},stores=new Map();let offline=false,claimed=0,skipped=0;
  const cacheFor=name=>{
    if(!stores.has(name))stores.set(name,new Map());const entries=stores.get(name);
    return {addAll:async urls=>{for(const url of urls){const pathname=new URL(url).pathname.replace(/^\/tangonest\//,"")||"index.html";assert.ok(fs.existsSync(path.join(root,pathname)),`Precache path ${pathname}`);entries.set(url,new Response(`cached:${pathname}`))}},put:async(req,res)=>entries.set(typeof req==="string"?req:req.url,res),match:async(req,options)=>{const url=typeof req==="string"?req:req.url;const key=options?.ignoreSearch?[...entries.keys()].find(k=>k.split("?")[0]===url.split("?")[0]):url;return entries.get(key)?.clone()}};
  };
  stores.set("unrelated-account-cache",new Map());stores.set("tangonest-shell-old",new Map());
  const context={URL,Response,Set,Promise,caches:{open:async name=>cacheFor(name),keys:async()=>[...stores.keys()],delete:async key=>stores.delete(key)},fetch:async()=>{if(offline)throw new Error("offline");return new Response("network")},self:{location:{href:"https://example.test/tangonest/sw.js"},addEventListener:(name,fn)=>handlers[name]=fn,clients:{claim:async()=>claimed++},skipWaiting:()=>skipped++}};
  vm.runInNewContext(fs.readFileSync(path.join(root,"sw.js"),"utf8"),context);
  let pending;handlers.install({waitUntil:p=>pending=p});await pending;
  handlers.activate({waitUntil:p=>pending=p});await pending;
  assert.equal(claimed,1);assert.ok(stores.has("unrelated-account-cache"));assert.ok(!stores.has("tangonest-shell-old"));assert.ok(stores.has(`tangonest-shell-v${release.version}`));
  const dispatch=async request=>{let response;handlers.fetch({request,respondWith:p=>response=p});return response?await response:null};
  for(const req of [
    {url:"https://project.supabase.co/auth/v1/token",method:"GET"},
    {url:"https://example.test/tangonest/auth/v1/token",method:"GET"},
    {url:"https://example.test/tangonest/rest/v1/tn_words",method:"GET"},
    {url:"https://example.test/tangonest/index.html",method:"POST"},
    {url:"https://example.test/other/index.html",method:"GET"}
  ])assert.equal(await dispatch(req),null,"Auth, data and unrelated paths must never be intercepted");
  offline=true;
  const navigation=await dispatch({url:"https://example.test/tangonest/?page=library",method:"GET",mode:"navigate"});assert.match(await navigation.text(),/cached:index.html/);
  const icon=await dispatch({url:`https://example.test/tangonest/${release.iconDirectory}/icon-192.png?v=stale`,method:"GET"});assert.equal(await icon.text(),`cached:${release.iconDirectory}/icon-192.png`);
  const sdk=await dispatch({url:`https://example.test/tangonest/vendor/supabase-${release.supabaseSdk}.js`,method:"GET"});assert.ok(sdk.ok,"Offline startup includes the Auth SDK");
  handlers.message({data:{type:"anything"}});assert.equal(skipped,0);handlers.message({data:{type:"SKIP_WAITING"}});assert.equal(skipped,1);
  console.log("SERVICE_WORKER_TEST_PASS");
})().catch(error=>{console.error(error);process.exitCode=1});
