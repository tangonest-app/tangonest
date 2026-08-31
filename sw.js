"use strict";

const CACHE_VERSION="tangonest-shell-v1.0.0-rc.19-fdg7";
const BASE=new URL("./",self.location.href);
const SHELL=[
  "./",
  "./index.html",
  "./config-rc19-fdg1.js",
  "./default-playlist-rc19-fdg1.js",
  "./example-fields-rc19-fdg1.js",
  "./style-rc19-fdg1.css",
  "./ui/forest-desk-glass-rc19-fdg1.css",
  "./app-rc19-fdg1.js",
  "./learning-engine-rc19-fdg1.js",
  "./tn-supabase-sync-rc19-fdg1.js",
  "./tn-library-management-rc19-fdg1.js",
  "./tn-learning-flow-rc19-fdg1.js",
  "./ui/learning-presentation-rc19-fdg1.js",
  "./ui/runtime-rc19-fdg1.js",
  "./manifest-rc19-fdg1.json",
  "./assets/botanical-corner.svg",
  "./assets/forest-study-login-v1.png",
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
