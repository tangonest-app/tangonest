(function(){
  "use strict";

  const URL = "https://bkbteylavujkfiwuqwdq.supabase.co";
  const KEY = "sb_publishable_UKX5qCXkbIRac4cc62_LXw_yEGDG6BZ";
  const LOCAL_KEY = "tangonest_production_stable_v1";
  const MIGRATION_KEY = "tangonest_cloud_first_migrated_v1";
  const PAGE_KEY = "tangonest_last_page_v2";
  let client = null;
  let session = null;
  let user = null;
  let channel = null;
  let loading = false;
  let booted = false;
  let authListenerBound = false;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  function dbRef(){
    try{
      if(typeof window.tnGetDb === "function")return window.tnGetDb();
    }catch(e){}
    try{
      if(typeof db !== "undefined" && db)return db;
    }catch(e){}
    window.db = window.db || {ui:"en",prefs:{frontLang:"en-US",backLang:"ja-JP"},lists:[],words:[],meta:{}};
    return window.db;
  }

  function ensureDb(){
    const data = dbRef();
    data.lists = Array.isArray(data.lists) ? data.lists : [];
    data.words = Array.isArray(data.words) ? data.words : [];
    data.prefs = data.prefs || {};
    data.meta = data.meta || {};
    data.prefs.frontLang = data.prefs.frontLang || "en-US";
    data.prefs.backLang = data.prefs.backLang || "ja-JP";
    if(!data.lists.length)data.lists.push({id:"local-starter",name:"New Playlist"});
    return data;
  }

  function persist(){
    const data = ensureDb();
    if(typeof window.tnWriteData === "function")window.tnWriteData(data);
    else localStorage.setItem(LOCAL_KEY,JSON.stringify(data));
  }

  function toast(message){
    const t = $("toast");
    if(t){
      t.textContent = message;
      t.classList.add("show");
      setTimeout(() => t.classList.remove("show"),1600);
    }
  }

  function setMessage(message,type="info"){
    const msg = $("tn73Msg");
    if(msg){
      msg.textContent = message;
      msg.className = "tn73-msg " + type;
    }
  }

  function busy(on){
    ["tn73Login","tn73Create","tn73Guest"].forEach(id => {
      const button = $(id);
      if(button)button.disabled = !!on;
    });
  }

  function getClient(){
    if(client)return client;
    if(window.tnSupabaseClient?.auth){
      client = window.tnSupabaseClient;
      return client;
    }
    if(window.supabase?.createClient){
      client = window.supabase.createClient(URL,KEY);
      window.tnSupabaseClient = client;
      window.supabaseClient = client;
      window.sb = client;
      return client;
    }
    return null;
  }

  function showApp(){
    document.documentElement.classList.add("tn73-ready","tn-authenticated","tn-has-session");
    document.documentElement.classList.remove("tn-logged-out","tn-needs-auth");
    document.body?.classList.add("tn-logged-in");
    document.body?.classList.remove("tn-auth-open");
    const auth = $("tn73Auth");
    if(auth){
      auth.style.setProperty("display","none","important");
      auth.style.setProperty("pointer-events","none","important");
      auth.style.setProperty("visibility","hidden","important");
      auth.style.setProperty("opacity","0","important");
    }
    const old = $("loginGate");
    if(old){
      old.style.setProperty("display","none","important");
      old.setAttribute("inert","");
    }
    try{ document.activeElement?.blur(); }catch(e){}
    try{ window.scrollTo(0,0); }catch(e){}
  }

  function showAuth(){
    document.documentElement.classList.remove("tn73-ready","tn-authenticated","tn-has-session");
    document.documentElement.classList.add("tn-logged-out","tn-needs-auth");
    document.body?.classList.add("tn-auth-open");
    document.body?.classList.remove("tn-logged-in");
    const auth = $("tn73Auth");
    if(auth){
      auth.style.setProperty("display","flex","important");
      auth.style.setProperty("pointer-events","auto","important");
      auth.style.setProperty("visibility","visible","important");
      auth.style.setProperty("opacity","1","important");
    }
    try{ window.scrollTo(0,0); }catch(e){}
    // Delay focus so the auth card fully renders before keyboard opens on mobile
    setTimeout(() => {
      try{ $("tn73Email")?.focus(); }catch(e){}
    }, 300);
  }

  function goSavedPage(){
    const saved = localStorage.getItem(PAGE_KEY) || "home";
    const map = {create:"add",library:"words",cards:"study",listen:"audio",settings:"manage"};
    try{ if(typeof go === "function")go(map[saved] || saved); }catch(e){}
  }

  function updateCloudUi(text="Auto Sync On",synced=true){
    const header = $("tn80HeaderCloud");
    if(header){
      header.textContent = "Cloud";
      header.classList.toggle("synced",!!synced && !!user);
    }
    const pill = $("tn80StatusPill");
    if(pill){
      pill.textContent = "Sync";
      pill.className = "tn80-status-pill " + (user ? "synced" : "local");
    }
    const account = $("tn80Account");
    if(account)account.textContent = user ? "Signed in" : "Not logged in";
    const localWords = $("tn80LocalWords");
    if(localWords)localWords.textContent = ensureDb().words.length;
    const localLists = $("tn80LocalLists");
    if(localLists)localLists.textContent = ensureDb().lists.length;
    const connection = $("tn80Connection");
    if(connection)connection.textContent = user ? "Cloud-first auto sync" : "Login to sync";
  }

  function cloudToDb(playlists,words){
    const fallback = ensureDb();
    const remote = {
      ui:fallback.ui || "en",
      prefs:{...(fallback.prefs || {})},
      meta:{updatedAt:new Date().toISOString()},
      lists: playlists.map(row => ({
      id:row.id,
      name:row.name || "New Playlist",
      createdAt:row.created_at,
      updatedAt:row.updated_at
    })),
      words:[]
    };
    if(!remote.lists.length)remote.lists.push({id:"local-starter",name:"New Playlist"});
    remote.words = words.map(row => ({
      id:row.id,
      listId:row.playlist_id || remote.lists[0]?.id,
      front:row.front,
      back:row.back,
      frontLang:row.front_lang || "en-US",
      backLang:row.back_lang || "ja-JP",
      pos:row.pos || "",
      gender:row.gender || "",
      tags:row.tags || "",
      memo:row.memo || "",
      status:row.status || "new",
      saved:!!row.saved,
      level:row.level || 3,
      nextReview:row.next_review || "",
      createdAt:row.created_at,
      updatedAt:row.updated_at
    }));
    if(window.tnDataSafety?.safeHydrate)window.tnDataSafety.safeHydrate(remote,"cloud-first-table-load");
    else{
      const data = ensureDb();
      Object.keys(data).forEach(key => delete data[key]);
      Object.assign(data,remote);
      persist();
    }
  }

  async function removeDemoAppleEverywhere(){
    return;
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
      option.textContent = list.name;
      el.appendChild(option);
    });
    if([...el.options].some(option => option.value === current))el.value = current;
    else if(all)el.value = "all";
    else if(data.lists[0])el.value = data.lists[0].id;
  }

  function renderSelects(){
    ["addList","bulkList","studyList","quizList","audioList","renameListSelect","editList"].forEach(id => renderSelect(id));
    renderSelect("wordListSelect",{all:true});
    applyLanguageDefaults(false);
  }

  function applyLanguageDefaults(force=false){
    const data = ensureDb();
    const set = (id,value) => {
      const el = $(id);
      if(!el || ![...el.options].some(option => option.value === value))return;
      if(force || !el.value)el.value = value;
    };
    set("frontLang",data.prefs.frontLang || "en-US");
    set("backLang",data.prefs.backLang || "ja-JP");
    set("bulkFrontLang",data.prefs.frontLang || "en-US");
    set("bulkBackLang",data.prefs.backLang || "ja-JP");
  }

  function neutralizeOldLanguageForcers(){
    const safe = () => applyLanguageDefaults(false);
    [
      "tn82ForceDefaultLanguages",
      "tn81ForceDefaultLanguages",
      "tn64EnsureEnglishJapaneseDefaults",
      "tn64BootDefaultsAndButtons",
      "applyEnglishJapaneseDefaults",
      "tnApplyDefaultLanguageIfEmpty"
    ].forEach(name => {
      try{ window[name] = safe; }catch(e){}
      try{ eval(name + " = safe"); }catch(e){}
    });
  }

  function rememberLanguagePrefs(){
    const data = ensureDb();
    const front = $("frontLang")?.value;
    const back = $("backLang")?.value;
    if(front)data.prefs.frontLang = front;
    if(back)data.prefs.backLang = back;
    persist();
  }

  function id(prefix){
    return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,8);
  }

  function touchLocal(){
    const data = ensureDb();
    data.meta.updatedAt = new Date().toISOString();
    data.meta.lastDeviceId = localStorage.getItem("tangonest_device_id_v1") || data.meta.lastDeviceId || "local";
    persist();
  }

  function saveLocalChange(){
    touchLocal();
    renderAll();
    if(typeof window.tnFixCloudSave === "function"){
      setTimeout(() => window.tnFixCloudSave(),600);
    }
  }

  function localCreatePlaylist(name){
    const data = ensureDb();
    name = String(name || $("newList")?.value || "").trim();
    if(!name)return toast("Playlist name is required");
    const exists = data.lists.some(list => String(list.name || "").trim().toLowerCase() === name.toLowerCase());
    if(exists)return toast("Playlist already exists");
    data.lists.push({id:id("list"),name,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
    if($("newList"))$("newList").value = "";
    saveLocalChange();
    toast("Playlist created");
    return true;
  }

  function localRenamePlaylist(listId,name){
    const data = ensureDb();
    listId = listId || $("renameListSelect")?.value || data.lists[0]?.id;
    name = String(name || $("renameListInput")?.value || "").trim();
    const list = data.lists.find(item => item.id === listId);
    if(!name)return toast("Playlist name is required");
    if(!list)return toast("Playlist not found");
    list.name = name;
    list.updatedAt = new Date().toISOString();
    if($("renameListInput"))$("renameListInput").value = "";
    saveLocalChange();
    toast("Playlist renamed");
    return true;
  }

  function localAddWord(event){
    if(event?.preventDefault)event.preventDefault();
    const data = ensureDb();
    const front = String($("front")?.value || "").trim();
    const back = String($("back")?.value || "").trim();
    if(!front || !back)return toast("Front and Back are required");
    rememberLanguagePrefs();
    let playlistId = $("addList")?.value || data.lists[0]?.id;
    if(!data.lists.some(list => list.id === playlistId))playlistId = data.lists[0]?.id;
    const now = new Date().toISOString();
    data.words.push({
      id:id("w"),
      front,
      back,
      listId:playlistId,
      frontLang:$("frontLang")?.value || data.prefs.frontLang || "en-US",
      backLang:$("backLang")?.value || data.prefs.backLang || "ja-JP",
      pos:$("pos")?.value || "",
      gender:$("gender")?.value || "",
      tags:String($("tags")?.value || "").trim(),
      memo:String($("memo")?.value || "").trim(),
      status:"new",
      saved:false,
      seen:0,
      level:1,
      nextReview:new Date().toISOString().slice(0,10),
      createdAt:now,
      updatedAt:now
    });
    ["front","back","memo","tags"].forEach(inputId => { if($(inputId))$(inputId).value = ""; });
    ["pos","gender"].forEach(inputId => { if($(inputId))$(inputId).value = ""; });
    saveLocalChange();
    toast("1 word added");
    return false;
  }

  function localDeleteWord(wordId){
    const data = ensureDb();
    const word = data.words.find(item => item.id === wordId);
    if(!word)return toast("Word not found");
    if(!confirm(`Delete "${word.front}"?`))return false;
    data.words = data.words.filter(item => item.id !== wordId);
    saveLocalChange();
    toast("Word deleted");
    return true;
  }

  function listName(id){
    return ensureDb().lists.find(list => list.id === id)?.name || "New Playlist";
  }

  function filteredWords(){
    const data = ensureDb();
    const listId = $("wordListSelect")?.value || "all";
    const status = $("statusFilter")?.value || "all";
    const query = String($("wordSearch")?.value || "").trim().toLowerCase();
    let words = [...data.words];
    if(listId !== "all")words = words.filter(word => word.listId === listId);
    if(status === "star")words = words.filter(word => word.saved);
    else if(status === "due")words = words.filter(word => word.nextReview && word.nextReview <= new Date().toISOString().slice(0,10));
    else if(status !== "all")words = words.filter(word => (word.status || "new") === status);
    if(query)words = words.filter(word => [word.front,word.back,word.memo,word.tags,word.pos,word.gender,listName(word.listId)].join(" ").toLowerCase().includes(query));
    return words;
  }

  function renderLibrary(){
    const mount = $("tn82LibraryMount");
    if(!mount)return;
    const words = filteredWords();
    mount.innerHTML = `
      <div class="tn82-library-summary">${words.length} word${words.length === 1 ? "" : "s"} shown</div>
      <div class="tn82-word-list">
        ${words.length ? words.map(word => `
          <div class="tn82-word-card">
            <div class="tn82-word-main">
              <div class="tn82-front">${esc(word.front)}</div>
              <div class="tn82-back">${esc(word.back)}</div>
            </div>
            <div class="tn82-word-meta">
              <span>${esc(listName(word.listId))}</span>
              <span>${esc(word.frontLang || "en-US")} -> ${esc(word.backLang || "ja-JP")}</span>
              <button type="button" class="tn-word-delete" data-word-id="${esc(word.id)}">Delete</button>
            </div>
          </div>
        `).join("") : `<div class="tn82-empty">No words yet. Add a word from Create.</div>`}
      </div>
    `;
  }

  function updateCounts(){
    const data = ensureDb();
    const learned = data.words.filter(word => word.status === "learned").length;
    const hard = data.words.filter(word => word.status === "hard").length;
    const set = (id,value) => { const el = $(id); if(el)el.textContent = value; };
    ["wc","totalWords","dashTotal","heroWords"].forEach(id => set(id,data.words.length));
    ["listCount","totalLists","heroLists"].forEach(id => set(id,data.lists.length));
    ["lc","totalLearned","heroLearned"].forEach(id => set(id,learned));
    ["hc","totalHard","dashHard"].forEach(id => set(id,hard));
  }

  function renderPlaylistManager(){
    const rows = $("tn82PlaylistRows");
    if(!rows)return;
    rows.innerHTML = ensureDb().lists.map(list => `
      <div class="tn82-playlist-row">
        <input class="tn82-playlist-input" data-list-id="${esc(list.id)}" value="${esc(list.name)}">
        <button type="button" class="tn82-rename-btn" data-list-id="${esc(list.id)}">Rename</button>
      </div>
    `).join("");
  }

  function renderAll(){
    renderSelects();
    if(window.tnLibraryRender)window.tnLibraryRender();
    else renderLibrary();
    renderPlaylistManager();
    updateCounts();
    updateCloudUi();
    try{ if(typeof renderHome === "function")renderHome(); }catch(e){}
  }

  async function ensureDefaultPlaylist(){
    const data = ensureDb();
    if(data.words.length || data.lists.some(list => list.id !== "local-starter"))return;
    if(data.lists.length && data.lists[0].id !== "local-starter")return;
    const result = await client.from("tn_playlists").insert({user_id:user.id,name:"New Playlist"}).select().single();
    if(result.error)throw result.error;
    data.lists = [{id:result.data.id,name:result.data.name,createdAt:result.data.created_at,updatedAt:result.data.updated_at}];
    persist();
  }

  async function loadCloud(){
    if(!user || loading)return;
    loading = true;
    try{
      updateCloudUi("Auto Sync: Loading",true);
      const playlistsResult = await client.from("tn_playlists").select("*").eq("user_id",user.id).order("created_at",{ascending:true});
      if(playlistsResult.error)throw playlistsResult.error;
      const wordsResult = await client.from("tn_words").select("*").eq("user_id",user.id).order("created_at",{ascending:true});
      if(wordsResult.error)throw wordsResult.error;
      let cloudPlaylists = playlistsResult.data || [];
      let cloudWords = wordsResult.data || [];
      if(!cloudPlaylists.length && !cloudWords.length && window.tnDataSafety?.hasUserData?.(ensureDb())){
        localStorage.removeItem(MIGRATION_KEY);
        await migrateLocalOnce(true);
        const retryPlaylists = await client.from("tn_playlists").select("*").eq("user_id",user.id).order("created_at",{ascending:true});
        const retryWords = await client.from("tn_words").select("*").eq("user_id",user.id).order("created_at",{ascending:true});
        if(!retryPlaylists.error)cloudPlaylists = retryPlaylists.data || cloudPlaylists;
        if(!retryWords.error)cloudWords = retryWords.data || cloudWords;
      }
      cloudToDb(cloudPlaylists,cloudWords);
      await removeDemoAppleEverywhere();
      await ensureDefaultPlaylist();
      renderAll();
      updateCloudUi("Auto Sync: On",true);
    }catch(error){
      console.error("Cloud-first load failed",error);
      updateCloudUi("Auto Sync: Error",false);
      toast(error.message || "Cloud load failed");
    }finally{
      loading = false;
    }
  }

  async function migrateLocalOnce(force=false){
    if(!user || (!force && localStorage.getItem(MIGRATION_KEY) === user.id))return;
    const data = ensureDb();
    const localLists = data.lists.filter(list => list.id && list.id !== "local-starter");
    const localWords = data.words.filter(word => word.front && word.back);
    if(!localLists.length && !localWords.length){
      localStorage.setItem(MIGRATION_KEY,user.id);
      return;
    }
    try{
      const listMap = new Map();
      for(const list of data.lists){
        const inserted = await client.from("tn_playlists").insert({user_id:user.id,name:list.name || "New Playlist"}).select().single();
        if(inserted.error)throw inserted.error;
        listMap.set(list.id,inserted.data.id);
      }
      for(const word of localWords){
        await client.from("tn_words").insert({
          user_id:user.id,
          playlist_id:listMap.get(word.listId) || [...listMap.values()][0] || null,
          front:word.front,
          back:word.back,
          front_lang:word.frontLang || word.front_lang || "en-US",
          back_lang:word.backLang || word.back_lang || "ja-JP",
          pos:word.pos || null,
          gender:word.gender || null,
          tags:word.tags || null,
          memo:word.memo || null,
          status:word.status || "new",
          saved:!!word.saved,
          level:word.level || 1,
          next_review:word.nextReview || null
        });
      }
      localStorage.setItem(MIGRATION_KEY,user.id);
    }catch(error){
      console.warn("Local migration skipped",error);
    }
  }

  async function createPlaylist(){
    const input = $("newList");
    const name = String(input?.value || "").trim();
    if(!user)return localCreatePlaylist(name);
    if(!name)return toast("Playlist name is required");
    const result = await client.from("tn_playlists").insert({user_id:user.id,name}).select().single();
    if(result.error)return toast(result.error.message);
    if(input)input.value = "";
    await loadCloud();
    toast("Playlist created");
  }

  async function renamePlaylist(id,name){
    id = id || $("renameListSelect")?.value;
    name = String(name || $("renameListInput")?.value || "").trim();
    if(!user)return localRenamePlaylist(id,name);
    if(!id || !name)return toast("Playlist name is required");
    const result = await client.from("tn_playlists").update({name}).eq("id",id).eq("user_id",user.id);
    if(result.error)return toast(result.error.message);
    if($("renameListInput"))$("renameListInput").value = "";
    await loadCloud();
    toast("Playlist renamed");
  }

  async function addWord(event){
    if(event?.preventDefault)event.preventDefault();
    if(!user)return localAddWord(event);
    await ensureDefaultPlaylist();
    const front = String($("front")?.value || "").trim();
    const back = String($("back")?.value || "").trim();
    if(!front || !back)return toast("Front and Back are required");
    rememberLanguagePrefs();
    const frontLang = $("frontLang")?.value || ensureDb().prefs.frontLang || "en-US";
    const backLang = $("backLang")?.value || ensureDb().prefs.backLang || "ja-JP";
    let playlistId = $("addList")?.value || ensureDb().lists[0]?.id;
    if(!ensureDb().lists.some(list => list.id === playlistId))playlistId = ensureDb().lists[0]?.id;
    const result = await client.from("tn_words").insert({
      user_id:user.id,
      playlist_id:playlistId,
      front,
      back,
      front_lang:frontLang,
      back_lang:backLang,
      pos:$("pos")?.value || null,
      gender:$("gender")?.value || null,
      tags:String($("tags")?.value || "").trim() || null,
      memo:String($("memo")?.value || "").trim() || null,
      status:"new",
      saved:false,
      level:1,
      next_review:new Date().toISOString().slice(0,10)
    });
    if(result.error)return toast(result.error.message);
    ["front","back","memo","tags"].forEach(id => { if($(id))$(id).value = ""; });
    await loadCloud();
    toast("1 word added");
    return false;
  }

  async function deleteWord(id){
    if(!user)return localDeleteWord(id);
    if(!id)return;
    const ok = confirm("Delete this word?");
    if(!ok)return;
    const result = await client.from("tn_words").delete().eq("id",id).eq("user_id",user.id);
    if(result.error)return toast(result.error.message);
    await loadCloud();
    toast("Word deleted");
  }

  function subscribeRealtime(){
    if(!user || !client)return;
    if(channel){
      try{ client.removeChannel(channel); }catch(e){}
      channel = null;
    }
    channel = client
      .channel("tangonest-cloud-first-" + user.id)
      .on("postgres_changes",{event:"*",schema:"public",table:"tn_playlists",filter:"user_id=eq." + user.id},() => loadCloud())
      .on("postgres_changes",{event:"*",schema:"public",table:"tn_words",filter:"user_id=eq." + user.id},() => loadCloud())
      .subscribe();
  }

  async function afterLogin(newSession){
    session = newSession;
    user = session?.user || null;
    if(!user){showAuth();return;}
    localStorage.removeItem("tangonest_guest_mode");
    showApp();
    setMessage("Logged in. Auto sync is on.","success");
    await migrateLocalOnce();
    await loadCloud();
    subscribeRealtime();
    goSavedPage();
  }

  async function login(){
    const email = String($("tn73Email")?.value || "").trim().toLowerCase();
    const password = $("tn73Password")?.value || "";
    if(!email || !password)return setMessage("Email and password are required.","error");
    busy(true);
    setMessage("Logging in...");
    try{
      const result = await client.auth.signInWithPassword({email,password});
      if(result.error)throw result.error;
      await afterLogin(result.data.session);
    }catch(error){
      setMessage(error.message || "Login failed","error");
    }finally{
      busy(false);
    }
  }

  async function signup(){
    const email = String($("tn73Email")?.value || "").trim().toLowerCase();
    const password = $("tn73Password")?.value || "";
    if(!email || !password)return setMessage("Email and password are required.","error");
    if(password.length < 6)return setMessage("Password must be at least 6 characters.","error");
    busy(true);
    setMessage("Creating account...");
    try{
      const result = await client.auth.signUp({email,password});
      if(result.error)throw result.error;
      const activeSession = result.data.session || (await client.auth.signInWithPassword({email,password})).data.session;
      await afterLogin(activeSession);
      setMessage("Account created. Auto sync is on.","success");
    }catch(error){
      setMessage(error.message || "Create account failed","error");
    }finally{
      busy(false);
    }
  }

  async function logout(){
    try{ await client.auth.signOut(); }catch(e){}
    session = null;
    user = null;
    if(channel){
      try{ client.removeChannel(channel); }catch(e){}
      channel = null;
    }
    showAuth();
    updateCloudUi("Auto Sync: Login",false);
  }

  function bind(){
    neutralizeOldLanguageForcers();
    $("tn73Login") && ($("tn73Login").onclick = login);
    $("tn73Create") && ($("tn73Create").onclick = signup);
    $("tn73Guest") && ($("tn73Guest").onclick = () => {
      localStorage.setItem("tangonest_guest_mode","1");
      showApp();
      goSavedPage();
    });
    $("addWordBtn") && ($("addWordBtn").onclick = addWord);
    ["frontLang","backLang","bulkFrontLang","bulkBackLang"].forEach(id => {
      const el = $(id);
      if(el && !el.__tnCloudLangBound){
        el.addEventListener("change",() => {
          const data = ensureDb();
          if(id.includes("Front") || id === "frontLang")data.prefs.frontLang = el.value;
          if(id.includes("Back") || id === "backLang")data.prefs.backLang = el.value;
          persist();
        });
        el.__tnCloudLangBound = true;
      }
    });
    window.createList = createPlaylist;
    window.renameList = () => renamePlaylist($("renameListSelect")?.value,$("renameListInput")?.value);
    window.tnRegisterWordCritical = addWord;
    window.addWord = addWord;
    window.registerWord = addWord;
    window.logoutTangoNest = logout;

    if(!window.__tnCloudFirstClickBound){
      window.__tnCloudFirstClickBound = true;
      document.addEventListener("click",event => {
        const button = event.target?.closest?.("button");
        if(!button)return;
        const text = String(button.textContent || "").trim().toLowerCase();
        const attr = String(button.getAttribute("onclick") || "").toLowerCase();
        if(text === "create" && (attr.includes("createlist") || button.closest("#pageAdd"))){
          event.preventDefault();
          event.stopPropagation();
          createPlaylist();
        }
        if(text === "rename" && (attr.includes("renamelist") || button.closest("#pageAdd") || button.classList.contains("tn82-rename-btn"))){
          event.preventDefault();
          event.stopPropagation();
          const row = button.closest(".tn82-playlist-row");
          const input = row?.querySelector(".tn82-playlist-input");
          renamePlaylist(button.dataset?.listId || input?.dataset?.listId || $("renameListSelect")?.value,input?.value || $("renameListInput")?.value);
        }
        if(button.classList.contains("tn-word-delete")){
          event.preventDefault();
          event.stopPropagation();
          deleteWord(button.dataset.wordId);
        }
      },true);
    }
  }

  async function boot(){
    if(booted){
      bind();
      return;
    }
    booted = true;
    document.documentElement.dataset.tnCloudFirst = "loading";
    client = getClient();
    if(!client){
      document.documentElement.dataset.tnCloudFirst = "no-client";
      setMessage("Supabase SDK is still loading. Reload once.","error");
      return;
    }
    bind();
    const current = await client.auth.getSession();
    if(current.error)console.warn(current.error);
    if(current.data.session)await afterLogin(current.data.session);
    else if(localStorage.getItem("tangonest_guest_mode") === "1"){showApp();goSavedPage();}
    else showAuth();
    if(!authListenerBound){
      authListenerBound = true;
      client.auth.onAuthStateChange((_event,nextSession) => {
        session = nextSession;
        user = nextSession?.user || null;
        if(user)afterLogin(nextSession);
        else showAuth();
      });
    }
    document.documentElement.dataset.tnCloudFirst = "ready";
  }

  window.tnCloudFirstBoot = boot;
  window.tnCloudFirstLoad = loadCloud;
  window.tnCloudFirstClient = () => client;

  if(document.readyState === "loading")document.addEventListener("DOMContentLoaded",boot);
  else boot();
  setTimeout(bind,500);
  setTimeout(bind,1500);
  setInterval(bind,1500);
})();
