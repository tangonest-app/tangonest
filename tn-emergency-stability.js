(function(){
  "use strict";

  const DATA_KEY = "tangonest_production_stable_v1";
  const RESET_KEY = "tangonest_emergency_reset_20260614_v1";
  const PAGE_KEY = "tangonest_last_page_v2";
  const MAX_SAFE_WORDS = Number.MAX_SAFE_INTEGER;
  const $ = id => document.getElementById(id);

  function safeParse(raw){
    try{return JSON.parse(raw || "{}");}catch(e){return {};}
  }

  function data(){
    try{
      if(typeof window.tnGetDb === "function")return window.tnGetDb();
    }catch(e){}
    try{
      if(typeof db !== "undefined" && db)return db;
    }catch(e){}
    return safeParse(localStorage.getItem(DATA_KEY));
  }

  function replaceData(next){
    try{
      if(typeof db !== "undefined" && db){
        Object.keys(db).forEach(key => delete db[key]);
        Object.assign(db,next);
      }else{
        window.db = next;
      }
    }catch(e){
      window.db = next;
    }
    try{
      if(typeof window.tnWriteData === "function")window.tnWriteData(next);
      else localStorage.setItem(DATA_KEY,JSON.stringify(next));
    }catch(e){}
  }

  function cleanData(reason){
    const next = {
      ui:"en",
      prefs:{frontLang:"en-US",backLang:"ja-JP"},
      lists:[{id:"starter",name:"New Playlist",createdAt:new Date().toISOString()}],
      words:[],
      meta:{
        emergencyResetAt:new Date().toISOString(),
        emergencyResetReason:reason
      }
    };
    replaceData(next);
    try{ localStorage.setItem(RESET_KEY,reason); }catch(e){}
    return next;
  }

  function ensureCleanState(){
    const current = data();
    const words = Array.isArray(current.words) ? current.words : [];
    const lists = Array.isArray(current.lists) ? current.lists : [];
    const resetDone = localStorage.getItem(RESET_KEY);
    if(!resetDone && words.length > MAX_SAFE_WORDS){
      current.meta = current.meta || {};
      current.meta.largeCollectionDetectedAt = new Date().toISOString();
    }
    current.words = words;
    current.lists = lists.length ? lists : [{id:"starter",name:"New Playlist",createdAt:new Date().toISOString()}];
    current.prefs = current.prefs || {};
    current.prefs.frontLang = "en-US";
    current.prefs.backLang = "ja-JP";
    current.meta = current.meta || {};
    const validLists = new Set(current.lists.map(list => list.id));
    current.words.forEach(word => {
      if(!validLists.has(word.listId))word.listId = current.lists[0].id;
    });
    replaceData(current);
  }

  function normalize(page){
    page = String(page || "").toLowerCase().trim();
    const map = {
      add:"create",create:"create",
      words:"library",library:"library",
      study:"cards",cards:"cards",
      audio:"listen",listen:"listen",
      manage:"settings",settings:"settings",
      pagehome:"home",pageadd:"create",pagewords:"library",
      pagestudy:"cards",pagequiz:"quiz",pageaudio:"listen",pagemanage:"settings"
    };
    return map[page] || page || "home";
  }

  function legacy(page){
    return {create:"add",library:"words",cards:"study",listen:"audio",settings:"manage"}[page] || page;
  }

  function pages(){
    return {
      home:"pageHome",
      create:"pageAdd",
      library:"pageWords",
      cards:"pageStudy",
      quiz:"pageQuiz",
      listen:"pageAudio",
      settings:"pageManage"
    };
  }

  function updateNav(page){
    document.querySelectorAll(".nav button,.mobile-tabbar button").forEach(button => {
      const idKey = normalize((button.id || "").replace(/^m?nav/i,""));
      const textKey = normalize(button.textContent);
      button.classList.toggle("active",idKey === page || textKey === page);
    });
  }

  function stableGo(page){
    page = normalize(page);
    if(!Object.prototype.hasOwnProperty.call(pages(),page))page = "home";
    try{ localStorage.setItem(PAGE_KEY,page); }catch(e){}

    Object.values(pages()).forEach(id => $(id)?.classList.remove("active"));
    const target = $(pages()[page]);
    if(target)target.classList.add("active");
    updateNav(page);

    if(page === "library"){
      try{ if(typeof window.tnLibraryRender === "function")window.tnLibraryRender(); }catch(e){}
    }
    if(page === "quiz"){
      try{ if(typeof window.resetQuiz === "function")window.resetQuiz(); }catch(e){}
    }
    try{ if(typeof window.renderHome === "function")window.renderHome(); }catch(e){}
    stableHeader();
  }

  function stableHeader(){
    const header = $("tn80HeaderCloud");
    if(header){
      header.textContent = "Cloud";
      header.style.minWidth = "76px";
      header.style.width = "76px";
    }
    const pill = $("tn80StatusPill") || $("syncStatusBadge");
    if(pill){
      pill.textContent = "Sync";
      pill.style.minWidth = "62px";
      pill.style.width = "62px";
    }
    const account = $("tn80Account");
    if(account && /@/.test(account.textContent || ""))account.textContent = "Signed in";
  }

  function installNavigation(){
    const nav = page => stableGo(page);
    nav.__tnEmergencyStable = true;
    nav.__tn82Wrapped = true;
    nav.__tn81Wrapped = true;
    nav.__tnFixWrapped = true;
    window.go = nav;
    window.appShow = nav;
    window.showPage = nav;

    const bindings = [
      ["navHome","home"],["navAdd","create"],["navWords","library"],
      ["navStudy","cards"],["navQuiz","quiz"],["navAudio","listen"],["navManage","settings"],
      ["mnavHome","home"],["mnavAdd","create"],["mnavWords","library"],
      ["mnavStudy","cards"],["mnavQuiz","quiz"],["mnavAudio","listen"],["mnavManage","settings"]
    ];
    bindings.forEach(([id,page]) => {
      const button = $(id);
      if(!button || button.__tnEmergencyNav)return;
      button.removeAttribute("onclick");
      button.addEventListener("click",event => {
        event.preventDefault();
        event.stopPropagation();
        stableGo(page);
      },true);
      button.__tnEmergencyNav = true;
    });
  }

  function quietOldSync(){
    const quiet = async () => false;
    quiet.__tnEmergencyQuiet = true;
    [
      "tn76CloudLoad","tn81CloudLoad","tn82CloudLoad",
      "tnFixCloudLoad","tnCloudFirstLoad"
    ].forEach(name => {
      if(typeof window[name] === "function")window[name] = quiet;
    });
  }

  function boot(){
    ensureCleanState();
    installNavigation();
    quietOldSync();
    stableHeader();
    const saved = normalize(localStorage.getItem(PAGE_KEY) || "home");
    stableGo(saved);
  }

  window.tnEmergencyStableGo = stableGo;
  window.tnEmergencyCleanData = () => cleanData("manual-emergency-reset");
  window.tnEmergencyInstallNavigation = installNavigation;

  if(document.readyState === "loading")document.addEventListener("DOMContentLoaded",boot);
  else boot();
  window.__tnNativeSetTimeout ? window.__tnNativeSetTimeout(boot,300) : setTimeout(boot,300);
})();
