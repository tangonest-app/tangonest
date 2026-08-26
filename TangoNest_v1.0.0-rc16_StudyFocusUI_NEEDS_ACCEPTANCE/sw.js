"use strict";

const CACHE_VERSION="tangonest-shell-v1.0.0-rc.16-pdca6";
const BASE=new URL("./",self.location.href);
const SHELL=[
  "./",
  "./index.html",
  "./config.js",
  "./style.css",
  "./ui/study-focus.css",
  "./app.js",
  "./learning-engine.js",
  "./tn-supabase-sync.js",
  "./tn-library-management.js",
  "./tn-learning-flow.js",
  "./ui/learning-presentation.js",
  "./ui/runtime.js",
  "./manifest.json",
  "./favicon.png",
  "./favicon.ico",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-1024.png"
].map(path=>new URL(path,BASE).href);
const SHELL_PATHS=new Set(SHELL.map(url=>new URL(url).pathname));

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE_VERSION).then(cache=>cache.addAll(SHELL)));
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key.startsWith("tangonest-shell-")&&key!==CACHE_VERSION).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("message",event=>{
  if(event.data?.type==="SKIP_WAITING")self.skipWaiting();
});

async function navigationResponse(request){
  try{
    const response=await fetch(request);
    if(response.ok){
      const cache=await caches.open(CACHE_VERSION);
      cache.put(new URL("./",BASE).href,response.clone());
    }
    return response;
  }catch(error){
    return (await caches.match(new URL("./",BASE).href,{ignoreSearch:true})) || Response.error();
  }
}

async function staticResponse(request){
  const cached=await caches.match(request,{ignoreSearch:true});
  try{
    const response=await fetch(request);
    if(response.ok){
      const cache=await caches.open(CACHE_VERSION);
      await cache.put(request,response.clone());
    }
    return response;
  }catch(error){
    return cached||Response.error();
  }
}

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;
  if(request.mode==="navigate"){
    event.respondWith(navigationResponse(request));
    return;
  }
  if(SHELL_PATHS.has(url.pathname))event.respondWith(staticResponse(request));
});
