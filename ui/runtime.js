(function(){
  "use strict";

  const $=id=>document.getElementById(id);
  const localQa=/^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    && new URLSearchParams(location.search).get("qa")==="1";
  let waitingWorker=null;
  let updateRequested=false;
  let currentHistoryPage="";
  let followingHistory=false;
  const mobileBar=document.querySelector(".mobile-tabbar");
  if(mobileBar)new ResizeObserver(()=>document.documentElement.style.setProperty("--tn-mobile-nav-height",`${mobileBar.getBoundingClientRect().height}px`)).observe(mobileBar);
  // VisualViewport reflects the usable area when iOS keeps its layout viewport tall.
  // Use only normal user focus; never open a keyboard through synthetic gestures.
  const viewport=window.visualViewport;
  let keyboardBaseline=innerHeight,keyboardFrame=0;
  function updateQuizKeyboard(){
    cancelAnimationFrame(keyboardFrame);
    keyboardFrame=requestAnimationFrame(()=>{
      const input=$("quizAnswer"),focused=document.activeElement===input&&$("pageQuiz")?.classList.contains("active")&&$("quizRun")?.style.display!=="none";
      if(!focused)keyboardBaseline=innerHeight;
      const open=Boolean(focused&&viewport&&Math.max(keyboardBaseline,innerHeight)-viewport.height>120);
      document.body.classList.toggle("tn-quiz-keyboard",open);
      if(open){const rect=input.getBoundingClientRect(),top=viewport.offsetTop,bottom=top+viewport.height;if(rect.top<top+12||rect.bottom>bottom-12)input.scrollIntoView({block:"nearest",behavior:"instant"})}
    });
  }
  viewport?.addEventListener("resize",updateQuizKeyboard);
  viewport?.addEventListener("scroll",updateQuizKeyboard);
  document.addEventListener("focusin",updateQuizKeyboard);
  document.addEventListener("focusout",updateQuizKeyboard);
  window.addEventListener("resize",updateQuizKeyboard);
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
    updateQuizKeyboard();
    const current=normalizePage(page);
    const labels=pageLabels[current]||pageLabels.home;
    const eyebrow=$("appPageEyebrow");
    const title=$("appPageTitle");
    if(eyebrow)eyebrow.textContent=labels[0]==="Practice"?window.TNI18n.t("ui.practice"):labels[0]==="Collection"?window.TNI18n.t("ui.collections"):labels[0];
    const titleKeys={home:"navigation.home",create:"navigation.addWords",library:"navigation.library",cards:"navigation.cards",quiz:"navigation.quiz",listen:"navigation.listen",settings:"navigation.settings"};
    const translated=window.TNI18n.t(titleKeys[current]||titleKeys.home);
    if(title)title.textContent=translated;
    document.title=`${translated} · TangoNest`;
    if(writeHistory&&current!==currentHistoryPage&&pageLabels[current]){
      const url=new URL(location.href);
      url.searchParams.set("page",current);
      url.searchParams.delete("word");
      if(!currentHistoryPage||followingHistory)history.replaceState({tnPage:current},"",url);
      else history.pushState({tnPage:current},"",url);
      currentHistoryPage=current;
    }
  }

  window.tnUpdateShellContext=updateShellContext;
  window.addEventListener("tn:locale",()=>updateShellContext(currentHistoryPage||"home",false));
  window.addEventListener("popstate",()=>{
    const page=new URLSearchParams(location.search).get("page")||"home";
    if(page===currentHistoryPage)return;
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
    window.TNI18n.bindText(text,()=>(waitingWorker
      ? window.TNI18n.t("ui.a_tangonest_update_is_ready",{})
      : window.TNI18n.t("ui.you_are_offline_changes_will_sync_when_the_connection_returns",{})));
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
