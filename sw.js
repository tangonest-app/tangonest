"use strict";

const CACHE_VERSION="tangonest-shell-v1.0.0-rc.19-fdg10";
const BASE=new URL("./",self.location.href);
const SHELL=[
  "./",
  "./index.html",
  "./style-rc19-fdg1.css",
  "./ui/forest-desk-glass-rc19-fdg1.css",
  "./assets/icons/fdg10/icon-32.png",
  "./assets/icons/fdg10/favicon.ico",
  "./assets/icons/fdg10/icon-180.png",
  "./assets/icons/fdg10/icon-152.png",
  "./manifest-rc19-fdg1.json",
  "./assets/icons/fdg10/icon-192.png",
  "./vendor/supabase-2.115.0.js",
  "./config-rc19-fdg1.js",
  "./default-playlist-rc19-fdg1.js",
  "./learning-engine-rc19-fdg1.js",
  "./ui/learning-presentation-rc19-fdg1.js",
  "./example-fields-rc19-fdg1.js",
  "./bulk-format.js",
  "./app-rc19-fdg1.js",
  "./tn-supabase-sync-rc19-fdg1.js",
  "./tn-library-management-rc19-fdg1.js",
  "./tn-learning-flow-rc19-fdg1.js",
  "./ui/runtime-rc19-fdg1.js",
  "./assets/icons/fdg10/icon-512.png",
  "./assets/icons/fdg10/maskable-512.png",
  "./assets/botanical-corner.svg",
  "./assets/forest-study-login-v1.png",
  "./favicon.png",
  "./favicon.ico",
  "./apple-touch-icon.png"
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
    const cache=await caches.open(CACHE_VERSION);
    return (await cache.match(new URL("./",BASE).href,{ignoreSearch:true})) || Response.error();
  }
}

async function staticResponse(request){
  const cache=await caches.open(CACHE_VERSION);
  const cached=await cache.match(request,{ignoreSearch:true});
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
