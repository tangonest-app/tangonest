(function(){
  "use strict";

  const $=id=>document.getElementById(id);
  const localQa=/^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    && new URLSearchParams(location.search).get("qa")==="1";
  let waitingWorker=null;
  let updateRequested=false;
  let currentHistoryPage="";
  let followingHistory=false;
  const pageLabels={
    home:["Forest Desk","Home"],
    create:["Collection","Add Words"],
    library:["Collection","Library"],
    cards:["Practice","Cards"],
    quiz:["Practice","Quiz"],
    listen:["Practice","Listen"],
    settings:["TangoNest","Settings"]
  };

  function normalizePage(page){
    const value=String(page||"").toLowerCase().replace(/^page/,"");
    return {add:"create",words:"library",study:"cards",audio:"listen",manage:"settings"}[value]||value||"home";
  }

  function updateShellContext(page,writeHistory=true){
    const current=normalizePage(page);
    const labels=pageLabels[current]||pageLabels.home;
    const eyebrow=$("appPageEyebrow");
    const title=$("appPageTitle");
    if(eyebrow)eyebrow.textContent=labels[0];
    if(title)title.textContent=labels[1];
    document.title=`${labels[1]} · TangoNest`;
    if(writeHistory&&current!==currentHistoryPage&&pageLabels[current]){
      const url=new URL(location.href);
      url.searchParams.set("page",current);
      if(!currentHistoryPage||followingHistory)history.replaceState({tnPage:current},"",url);
      else history.pushState({tnPage:current},"",url);
      currentHistoryPage=current;
    }
  }

  window.tnUpdateShellContext=updateShellContext;
  window.addEventListener("popstate",()=>{
    const page=new URLSearchParams(location.search).get("page")||"home";
    followingHistory=true;
    try{window.tnStableNavigate?.(page)}finally{followingHistory=false;}
  });

  const shortcutPage=new URLSearchParams(location.search).get("page");
  if(["home","create","library","cards","quiz","listen","settings"].includes(shortcutPage||"")){
    try{localStorage.setItem("tangonest_last_page_v2",shortcutPage)}catch(error){}
    const defer=typeof queueMicrotask==="function" ? queueMicrotask : callback=>Promise.resolve().then(callback);
    defer(()=>window.tnStableNavigate?.(shortcutPage));
  }

  function updateBanner(){
    const banner=$("networkStatus");
    const text=$("networkStatusText");
    const button=$("appUpdateButton");
    if(!banner||!text||!button)return;
    const offline=!navigator.onLine;
    banner.hidden=!offline&&!waitingWorker;
    button.hidden=!waitingWorker;
    text.textContent=waitingWorker
      ? "A TangoNest update is ready."
      : "You are offline. Changes will sync when the connection returns.";
  }

  function watchRegistration(registration){
    if(registration.waiting){
      waitingWorker=registration.waiting;
      updateBanner();
    }
    registration.addEventListener("updatefound",()=>{
      const worker=registration.installing;
      if(!worker)return;
      worker.addEventListener("statechange",()=>{
        if(worker.state==="installed"&&navigator.serviceWorker.controller){
          waitingWorker=worker;
          updateBanner();
        }
      });
    });
  }

  async function registerServiceWorker(){
    if(localQa||!("serviceWorker" in navigator)||!/^https?:$/.test(location.protocol))return;
    try{
      const registration=await navigator.serviceWorker.register("./sw.js",{scope:"./",updateViaCache:"none"});
      await registration.update();
      watchRegistration(registration);
    }catch(error){
      console.warn("TangoNest offline support could not start",error);
    }
  }

  window.addEventListener("online",updateBanner);
  window.addEventListener("offline",updateBanner);
  navigator.serviceWorker?.addEventListener("controllerchange",()=>{
    if(updateRequested)location.reload();
  });
  $("appUpdateButton")?.addEventListener("click",()=>{
    if(!waitingWorker)return;
    if(window.tnBulkProgress?.busy?.()){
      window.toast?.("Finish or stop Bulk Add before updating the app.");
      return;
    }
    updateRequested=true;
    waitingWorker.postMessage({type:"SKIP_WAITING"});
  });

  updateBanner();
  // Auth restore owns the initial route, not the hidden Home shell.
  updateShellContext(shortcutPage||document.querySelector(".page.active")?.id.replace(/^page/,"")||"home",false);
  registerServiceWorker();
})();
