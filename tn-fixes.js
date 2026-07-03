(function(){
  "use strict";
  document.documentElement.dataset.tnFix = "loading";

  const DATA_KEY = "tangonest_production_stable_v1";
  const PAGE_KEY = "tangonest_last_page_v2";
  const EMAIL_KEY = "tangonest_sync_email_v1";
  const HASH_KEY = "tangonest_sync_hash_v1";
  const CLOUD_TIME_KEY = "tangonest_last_cloud_updated_at_v2";
  let saveTimer = null;
  let loading = false;
  let saving = false;

  const $ = id => document.getElementById(id);
  const today = () => new Date().toISOString().slice(0,10);
  const pageMap = {add:"create",words:"library",manage:"settings",study:"cards",audio:"listen"};
  const oldPageMap = {create:"add",library:"words",settings:"manage",cards:"study",listen:"audio"};

  function getDb(){
    try{
      if(typeof window.tnGetDb === "function")return window.tnGetDb();
    }catch(e){}
    try{
      if(typeof db !== "undefined" && db)return db;
    }catch(e){}
    try{
      const parsed = JSON.parse(localStorage.getItem(DATA_KEY) || "{}");
      if(parsed && typeof parsed === "object")return parsed;
    }catch(e){}
    return {ui:"en",prefs:{frontLang:"en-US",backLang:"ja-JP"},lists:[],words:[],meta:{}};
  }

  function setDb(next){
    try{
      if(typeof db !== "undefined" && db){
        if(db === next)return db;
        Object.keys(db).forEach(key => delete db[key]);
        Object.assign(db,next);
        return db;
      }
    }catch(e){}
    window.db = next;
    return window.db;
  }

  function ensureDb(){
    const data = getDb();
    data.lists = Array.isArray(data.lists) ? data.lists : [];
    data.words = Array.isArray(data.words) ? data.words : [];
    data.prefs = data.prefs || {};
    data.meta = data.meta || {};
    data.prefs.frontLang = "en-US";
    data.prefs.backLang = "ja-JP";
    if(!data.lists.length){
      data.lists.push({id:"starter",name:"New Playlist",createdAt:new Date().toISOString()});
    }
    data.words = data.words.filter(Boolean).map(word => {
      word.id = word.id || id("w");
      word.listId = word.listId || data.lists[0].id;
      word.frontLang = "en-US";
      word.backLang = "ja-JP";
      word.status = word.status || "new";
      word.level = word.level || 1;
      word.createdAt = word.createdAt || new Date().toISOString();
      return word;
    });
    setDb(data);
    return data;
  }

  function persist(){
    const data = ensureDb();
    if(typeof window.tnWriteData === "function")window.tnWriteData(data);
    else localStorage.setItem(DATA_KEY,JSON.stringify(data));
  }

  function id(prefix){
    return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,8);
  }

  function touch(){
    const data = ensureDb();
    data.meta.updatedAt = new Date().toISOString();
    data.meta.lastDeviceId = deviceId();
    persist();
  }

  function esc(value){
    return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }

  function toast(message){
    const t = $("toast");
    if(t){
      t.textContent = message;
      t.classList.add("show");
      setTimeout(() => t.classList.remove("show"),1600);
    }
  }

  function listName(listId){
    const data = ensureDb();
    return data.lists.find(list => list.id === listId)?.name || "New Playlist";
  }

  function normalizePage(page){
    page = String(page || "home").toLowerCase().trim();
    return pageMap[page] || page || "home";
  }

  function rememberPage(page){
    page = normalizePage(page);
    if(["home","create","library","cards","quiz","listen","settings"].includes(page)){
      localStorage.setItem(PAGE_KEY,page);
    }
  }

  function savedPage(){
    return normalizePage(localStorage.getItem(PAGE_KEY) || "home");
  }

  function setText(id,value){
    const el = $(id);
    if(el)el.textContent = value;
  }

  function updateCounts(){
    const data = ensureDb();
    const learned = data.words.filter(word => word.status === "learned").length;
    const hard = data.words.filter(word => word.status === "hard").length;
    const due = data.words.filter(word => word.nextReview && word.nextReview <= today()).length;
    ["wc","totalWords","dashTotal","heroWords"].forEach(id => setText(id,data.words.length));
    ["listCount","totalLists","heroLists"].forEach(id => setText(id,data.lists.length));
    ["lc","totalLearned","heroLearned"].forEach(id => setText(id,learned));
    ["hc","totalHard","dashHard"].forEach(id => setText(id,hard));
    setText("dashLearned",Math.round((learned / Math.max(1,data.words.length)) * 100) + "%");
    setText("dashDue",due);
  }

  function forceLanguages(){
    const data = ensureDb();
    data.prefs.frontLang = data.prefs.frontLang || "en-US";
    data.prefs.backLang = data.prefs.backLang || "ja-JP";
    ["frontLang","bulkFrontLang","editFrontLang"].forEach(id => {
      const el = $(id);
      if(el && !el.value && [...el.options].some(option => option.value === data.prefs.frontLang))el.value = data.prefs.frontLang;
    });
    ["backLang","bulkBackLang","editBackLang"].forEach(id => {
      const el = $(id);
      if(el && !el.value && [...el.options].some(option => option.value === data.prefs.backLang))el.value = data.prefs.backLang;
    });
    if($("front"))$("front").placeholder = "word";
    if($("back"))$("back").placeholder = "meaning";
    if($("memo"))$("memo").placeholder = "Example sentence or memo.";
    if($("bulkText"))$("bulkText").placeholder = "hello\tこんにちは\tphrase\tnone\tHello, nice to meet you.";
  }

  function renderSelect(id,{all=false}={}){
    const data = ensureDb();
    const el = $(id);
    if(!el)return;
    const current = el.value;
    el.innerHTML = "";
    if(all){
      const option = document.createElement("option");
      option.value = "all";
      option.textContent = "All";
      el.appendChild(option);
    }
    data.lists.forEach(list => {
      const option = document.createElement("option");
      option.value = list.id;
      option.textContent = list.name || "New Playlist";
      el.appendChild(option);
    });
    if([...el.options].some(option => option.value === current))el.value = current;
    else if(all)el.value = "all";
    else if(data.lists[0])el.value = data.lists[0].id;
  }

  function renderPlaylistSelects(){
    ["addList","bulkList","studyList","quizList","audioList","renameListSelect","editList"].forEach(id => renderSelect(id));
    renderSelect("wordListSelect",{all:true});
  }

  function filteredWords(){
    const data = ensureDb();
    const listFilter = $("wordListSelect")?.value || "all";
    const status = $("statusFilter")?.value || "all";
    const query = String($("wordSearch")?.value || "").trim().toLowerCase();
    let words = [...data.words];
    if(listFilter !== "all"){
      words = words.filter(word => word.listId === listFilter);
    }
    if(status === "star")words = words.filter(word => word.saved);
    else if(status === "due")words = words.filter(word => word.nextReview && word.nextReview <= today());
    else if(status !== "all")words = words.filter(word => (word.status || "new") === status);
    if(query){
      words = words.filter(word => [word.front,word.back,word.memo,word.tags,word.pos,word.gender,listName(word.listId)].join(" ").toLowerCase().includes(query));
    }
    return words;
  }

  function renderLibrary(){
    const mount = $("tn82LibraryMount");
    const words = filteredWords();
    if(mount){
      mount.innerHTML = `
        <div class="tn82-library-summary">${words.length} word${words.length === 1 ? "" : "s"} shown</div>
        <div class="tn82-word-list">
          ${words.length ? words.map(word => `
            <div class="tn82-word-card" data-word-id="${esc(word.id)}">
              <div class="tn82-word-main">
                <div class="tn82-front">${esc(word.front)}</div>
                <div class="tn82-back">${esc(word.back)}</div>
              </div>
              <div class="tn82-word-meta">
                <span>${esc(listName(word.listId))}</span>
                <span>English -> Japanese</span>
                ${word.pos ? `<span>${esc(word.pos)}</span>` : ""}
              </div>
            </div>
          `).join("") : `<div class="tn82-empty">No words yet. Add a word from Create.</div>`}
        </div>
      `;
    }
    updateCounts();
  }

  function createPlaylist(name){
    const data = ensureDb();
    name = String(name || "").trim();
    if(!name){toast("Playlist name is required");return false;}
    if(data.lists.some(list => String(list.name || "").trim().toLowerCase() === name.toLowerCase())){
      toast("Playlist already exists");
      return false;
    }
    data.lists.push({id:id("list"),name,createdAt:new Date().toISOString()});
    touch();
    if($("newList"))$("newList").value = "";
    renderAll();
    saveSoon();
    toast("Playlist created");
    return true;
  }

  function renamePlaylist(listId,name){
    const data = ensureDb();
    listId = listId || $("renameListSelect")?.value || data.lists[0]?.id;
    name = String(name || $("renameListInput")?.value || "").trim();
    const list = data.lists.find(item => item.id === listId);
    if(!name){toast("Playlist name is required");return false;}
    if(!list){toast("Playlist not found");return false;}
    list.name = name;
    touch();
    if($("renameListInput"))$("renameListInput").value = "";
    renderAll();
    saveSoon();
    toast("Playlist renamed");
    return true;
  }

  function renderPlaylistManager(){
    const data = ensureDb();
    const rows = $("tn82PlaylistRows");
    if(!rows)return;
    rows.innerHTML = data.lists.map(list => `
      <div class="tn82-playlist-row">
        <input class="tn82-playlist-input" data-list-id="${esc(list.id)}" value="${esc(list.name || "New Playlist")}">
        <button type="button" class="tn82-rename-btn" data-list-id="${esc(list.id)}">Rename</button>
      </div>
    `).join("");
    rows.querySelectorAll(".tn82-rename-btn").forEach(button => {
      button.onclick = event => {
        event.preventDefault();
        const input = rows.querySelector(`.tn82-playlist-input[data-list-id="${CSS.escape(button.dataset.listId)}"]`);
        renamePlaylist(button.dataset.listId,input?.value || "");
      };
    });
  }

  function addWord(event){
    if(event && event.preventDefault)event.preventDefault();
    const data = ensureDb();
    forceLanguages();
    const front = String($("front")?.value || "").trim();
    const back = String($("back")?.value || "").trim();
    if(!front || !back){toast("Front and Back are required");return false;}
    let listId = $("addList")?.value || data.lists[0].id;
    if(!data.lists.some(list => list.id === listId))listId = data.lists[0].id;
    data.words.push({
      id:id("w"),
      front,
      back,
      listId,
      frontLang:"en-US",
      backLang:"ja-JP",
      pos:$("pos")?.value || "",
      gender:$("gender")?.value || "",
      tags:String($("tags")?.value || "").trim(),
      memo:String($("memo")?.value || "").trim(),
      saved:false,
      status:"new",
      seen:0,
      level:1,
      nextReview:today(),
      createdAt:new Date().toISOString()
    });
    touch();
    ["front","back","memo","tags"].forEach(id => { if($(id))$(id).value = ""; });
    ["pos","gender"].forEach(id => { if($(id))$(id).value = ""; });
    renderAll();
    saveSoon();
    toast("1 word added");
    return false;
  }

  function removeDemoApple(){
    return;
  }

  function goPage(page){
    page = normalizePage(page);
    rememberPage(page);
    // Ensure auth overlay is hidden before page transition (critical on mobile)
    const authEl = $("tn73Auth");
    if(authEl && document.documentElement.classList.contains("tn73-ready")){
      authEl.style.setProperty("display","none","important");
      authEl.style.setProperty("pointer-events","none","important");
    }
    try{
      if(typeof window.__tnFixOldGo === "function"){
        window.__tnFixOldGo(oldPageMap[page] || page);
      }
    }catch(e){}
    const ids = {
      home:["pageHome"],
      create:["pageAdd"],
      library:["pageWords"],
      cards:["pageStudy"],
      quiz:["pageQuiz"],
      listen:["pageAudio"],
      settings:["pageManage"]
    };
    document.querySelectorAll(".page").forEach(section => section.classList.remove("active"));
    const target = ids[page]?.map(id => $(id)).find(Boolean);
    if(target)target.classList.add("active");
    document.querySelectorAll(".nav button,.mobile-tabbar button").forEach(button => {
      const text = normalizePage(button.textContent);
      button.classList.toggle("active",text === page);
    });
    forceLanguages();
    if(page === "library"){
      if(window.tnLibraryRender)window.tnLibraryRender();
      else renderLibrary();
    }
    if(page === "settings")renderPlaylistManager();
  }

  function bind(){
    if(typeof window.go === "function" && !window.go.__tnFixWrapped){
      window.__tnFixOldGo = window.go;
    }
    window.go = goPage;
    window.go.__tnFixWrapped = true;
    window.appShow = page => goPage(page);
    window.createList = () => createPlaylist($("newList")?.value || "");
    window.renameList = () => renamePlaylist($("renameListSelect")?.value,$("renameListInput")?.value);
    window.tnRegisterWordCritical = addWord;
    window.addWord = addWord;
    window.registerWord = addWord;
    if($("addWordBtn"))$("addWordBtn").onclick = addWord;
    ["wordListSelect","statusFilter"].forEach(id => {
      const el = $(id);
      if(el && !el.__tnFixBound){
        el.addEventListener("change",renderLibrary);
        el.__tnFixBound = true;
      }
    });
    if($("wordSearch") && !$("wordSearch").__tnFixBound){
      $("wordSearch").addEventListener("input",renderLibrary);
      $("wordSearch").__tnFixBound = true;
    }
  }

  function isCreatePlaylistButton(button){
    const text = String(button?.textContent || "").trim().toLowerCase();
    const attr = String(button?.getAttribute("onclick") || "").toLowerCase();
    return text === "create" && (attr.includes("createlist") || button.closest("#pageAdd"));
  }

  function isRenamePlaylistButton(button){
    const text = String(button?.textContent || "").trim().toLowerCase();
    const attr = String(button?.getAttribute("onclick") || "").toLowerCase();
    return text === "rename" && (attr.includes("renamelist") || button.closest("#pageAdd") || button.classList.contains("tn82-rename-btn"));
  }

  function bindHardClickDelegation(){
    if(window.__tnFixHardClickBound)return;
    window.__tnFixHardClickBound = true;
    document.documentElement.dataset.tnFixClicks = "bound";
    document.addEventListener("click", event => {
      const button = event.target?.closest?.("button");
      if(!button)return;
      if(isCreatePlaylistButton(button)){
        event.preventDefault();
        event.stopPropagation();
        createPlaylist($("newList")?.value || "");
        return;
      }
      if(isRenamePlaylistButton(button)){
        event.preventDefault();
        event.stopPropagation();
        const row = button.closest(".tn82-playlist-row");
        const rowInput = row?.querySelector(".tn82-playlist-input");
        const rowId = button.dataset?.listId || rowInput?.dataset?.listId;
        renamePlaylist(rowId || $("renameListSelect")?.value,rowInput?.value || $("renameListInput")?.value || "");
        return;
      }
      if(button.id === "addWordBtn" || String(button.getAttribute("onclick") || "").includes("tnRegisterWordCritical")){
        event.preventDefault();
        event.stopPropagation();
        addWord(event);
      }
    },true);
  }

  function supabase(){
    try{if(window.tn74GetSupabase){const client = window.tn74GetSupabase(); if(client?.rpc)return client;}}catch(e){}
    try{if(window.tnSupabaseClient?.rpc)return window.tnSupabaseClient;}catch(e){}
    try{if(window.supabaseClient?.rpc)return window.supabaseClient;}catch(e){}
    try{if(window.sb?.rpc)return window.sb;}catch(e){}
    return null;
  }

  function hasSession(){
    return !!(localStorage.getItem(EMAIL_KEY) && localStorage.getItem(HASH_KEY));
  }

  function deviceId(){
    let value = localStorage.getItem("tangonest_device_id_v1");
    if(!value){
      value = id("device");
      localStorage.setItem("tangonest_device_id_v1",value);
    }
    return value;
  }

  async function cloudSave(){
    if(!hasSession() || saving)return false;
    const client = supabase();
    if(!client)return false;
    saving = true;
    try{
      const data = ensureDb();
      if(!data.meta.updatedAt)touch();
      const result = await client.rpc("tn_save",{
        p_email:localStorage.getItem(EMAIL_KEY),
        p_password_hash:localStorage.getItem(HASH_KEY),
        p_data:data
      });
      if(result.error)throw result.error;
      localStorage.setItem(CLOUD_TIME_KEY,result.data?.updated_at || new Date().toISOString());
      updateCloudLabel("Synced",true);
      return true;
    }catch(e){
      console.warn("Auto sync save failed",e);
      updateCloudLabel("Sync error",false);
      return false;
    }finally{
      saving = false;
    }
  }

  async function cloudLoad(force=false){
    if(!hasSession() || loading || saving)return false;
    const client = supabase();
    if(!client)return false;
    loading = true;
    const page = savedPage();
    try{
      const result = await client.rpc("tn_login",{
        p_email:localStorage.getItem(EMAIL_KEY),
        p_password_hash:localStorage.getItem(HASH_KEY)
      });
      if(result.error)throw result.error;
      if(!result.data || result.data.ok === false)throw new Error(result.data?.error || "Cloud load failed");
      const cloud = result.data.data || {};
      const local = ensureDb();
      const cloudUpdated = result.data.updated_at || cloud.meta?.updatedAt || "";
      const localUpdated = local.meta?.updatedAt || "";
      const cloudIsNewer = force || !localUpdated || !cloudUpdated || new Date(cloudUpdated) >= new Date(localUpdated);
      if(cloudIsNewer && JSON.stringify(cloud) !== JSON.stringify(local)){
        if(window.tnDataSafety?.safeHydrate)window.tnDataSafety.safeHydrate(cloud,"tn-fixes-cloud-load");
        else{
          setDb(cloud);
          persist();
        }
        renderAll();
      }
      localStorage.setItem(CLOUD_TIME_KEY,result.data.updated_at || new Date().toISOString());
      updateCloudLabel("Synced",true);
      setTimeout(() => goPage(page),60);
      return true;
    }catch(e){
      console.warn("Auto sync load failed",e);
      updateCloudLabel("Sync error",false);
      return false;
    }finally{
      loading = false;
    }
  }

  function saveSoon(){
    clearTimeout(saveTimer);
    saveTimer = setTimeout(cloudSave,500);
  }

  function updateCloudLabel(text,synced){
    const button = $("tn80HeaderCloud");
    if(button){
      button.textContent = "Cloud";
      button.classList.toggle("synced",!!synced);
    }
    const panel = $("tnFixSyncPanel");
    if(panel){
      panel.classList.toggle("is-synced",!!synced);
      const status = panel.querySelector("[data-sync-status]");
      if(status)status.textContent = hasSession() ? text : "Local only";
      const account = panel.querySelector("[data-sync-account]");
      if(account)account.textContent = hasSession() ? localStorage.getItem(EMAIL_KEY) : "Login to sync PC and phone";
    }
  }

  function renderSimpleSyncPanel(){
    const host = $("pageManage")?.querySelector(".card") || $("pageManage");
    if(!host || $("tnFixSyncPanel"))return;
    const panel = document.createElement("div");
    panel.id = "tnFixSyncPanel";
    panel.className = "tn-fix-sync-panel";
    panel.innerHTML = `
      <div>
        <span class="tn-fix-kicker">AUTO SYNC</span>
        <strong data-sync-status>${hasSession() ? "Ready" : "Local only"}</strong>
        <p data-sync-account>${hasSession() ? esc(localStorage.getItem(EMAIL_KEY)) : "Login to sync PC and phone"}</p>
      </div>
      <button type="button" data-sync-now>Sync now</button>
    `;
    panel.querySelector("[data-sync-now]").onclick = () => {
      updateCloudLabel("Syncing...",false);
      cloudSave().then(() => cloudLoad(false));
    };
    host.prepend(panel);
  }

  function renderAll(){
    forceLanguages();
    renderPlaylistSelects();
    renderPlaylistManager();
    if(window.tnLibraryRender)window.tnLibraryRender();
    else renderLibrary();
    renderSimpleSyncPanel();
    updateCloudLabel(hasSession() ? "On" : "Local",hasSession());
    updateCounts();
    try{if(typeof renderHome === "function")renderHome();}catch(e){}
  }

  function boot(){
    try{
      document.documentElement.dataset.tnFix = "booting";
      ensureDb();
      removeDemoApple();
      bind();
      bindHardClickDelegation();
      renderAll();
      setTimeout(() => goPage(savedPage()),250);
      if(hasSession())setTimeout(() => cloudLoad(true),900);
      document.documentElement.dataset.tnFix = "ready";
    }catch(error){
      document.documentElement.dataset.tnFix = "error";
      document.documentElement.dataset.tnFixError = String(error && (error.stack || error.message) || error).slice(0,240);
      console.error("TangoNest fix boot failed",error);
    }
  }

  window.tnFixBoot = boot;
  window.tnFixRenderLibrary = renderLibrary;
  window.tnFixCloudSave = cloudSave;
  window.tnFixCloudLoad = cloudLoad;

  if(document.readyState === "loading")document.addEventListener("DOMContentLoaded",boot);
  else boot();
  setTimeout(boot,500);
  setTimeout(boot,1500);
  setInterval(() => { bind(); renderAll(); },2500);
  setInterval(() => { if(document.visibilityState === "visible")cloudLoad(false); },3500);
  window.addEventListener("focus",() => cloudLoad(false));
  document.addEventListener("visibilitychange",() => {
    if(document.visibilityState === "visible")cloudLoad(false);
  });
})();
