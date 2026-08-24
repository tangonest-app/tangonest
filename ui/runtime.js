(function(){
  "use strict";

  const $=id=>document.getElementById(id);
  const localQa=/^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    && new URLSearchParams(location.search).get("qa")==="1";
  let waitingWorker=null;
  let updateRequested=false;

  const shortcutPage=new URLSearchParams(location.search).get("page");
  if(["home","create","library","cards","quiz","listen","settings"].includes(shortcutPage||"")){
    try{localStorage.setItem("tangonest_last_page_v2",shortcutPage)}catch(error){}
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
      const registration=await navigator.serviceWorker.register("./sw.js",{scope:"./"});
      watchRegistration(registration);
      registration.update().catch(()=>{});
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
    updateRequested=true;
    waitingWorker.postMessage({type:"SKIP_WAITING"});
  });

  updateBanner();
  registerServiceWorker();
})();
