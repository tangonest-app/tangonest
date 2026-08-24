(function(){
  "use strict";

  const config = window.TangoNestConfig || {};
  const SUPABASE_URL = String(config.supabaseUrl || "").trim();
  const SUPABASE_KEY = String(config.supabasePublishableKey || "").trim();
  const DATA_KEY = "tangonest_production_stable_v1";
  const SHADOW_KEY = "tangonest_last_good_data_v1";
  const PAGE_KEY = "tangonest_last_page_v2";
  const CACHE_USER_KEY = "tangonest_cache_user_id_v1";
  const PENDING_KEY = "tangonest_pending_mutations_v1";
  const RECENT_PLAYLIST_KEY = "tangonest_recent_playlist_v1";
  const LEGACY_AUTH_KEYS = [
    "tangonest_sync_email_v1",
    "tangonest_sync_hash_v1",
    "tangonest_sync_mode_v1",
    "tangonest_guest_mode",
    "tangonest_last_cloud_updated_at_v1",
    "tangonest_last_cloud_updated_at_v2",
    "tangonest_cloud_first_migrated_v1",
    "tangonest_last_session_v1"
  ];
  const qaLocation = window.location || {};
  const LOCAL_QA_MODE = /^(localhost|127\.0\.0\.1)$/.test(qaLocation.hostname || "")
    && /(?:^|[?&])qa=1(?:&|$)/.test(qaLocation.search || "");
  const localFallbacks={
    bulkImport:window.bulkImport,
    deleteSelected:window.deleteSelected,
    toggleFavorite:window.toggleStar
  };

  const $ = id => document.getElementById(id);
  const nowIso = () => new Date().toISOString();
  const learningEngine = () => window.TangoNestLearningEngine || null;
  const today = () => learningEngine()?.localDateKey() || new Date().toLocaleDateString("en-CA");
  const safeText = value => String(value ?? "").trim();
  const safeLang = (value,fallback="en-US") => {
    const text = safeText(value);
    return /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3}$/.test(text) ? text : fallback;
  };
  const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  let client = null;
  let currentSession = null;
  let currentUser = null;
  let realtimeChannel = null;
  let realtimeUserId = "";
  let authUnsubscribe = null;
  let booted = false;
  let bootRetryCount = 0;
  let loading = false;
  let loadTimer = null;
  let savingWordTimers = new Map();
  let lastSyncAt = "";
  let lastSyncState = "Offline";
  let cloudCounts = {words:null,lists:null,userId:""};
  let realtimeStatus = "Disconnected";
  let flushingPending = false;

  function getClient(){
    if(client)return client;
    if(window.tnSupabaseClient?.auth){
      client = window.tnSupabaseClient;
      return client;
    }
    if(!SUPABASE_URL||!SUPABASE_KEY||!window.supabase?.createClient)return null;
    client = window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
      auth:{
        persistSession:true,
        autoRefreshToken:true,
        detectSessionInUrl:true
      },
      realtime:{params:{eventsPerSecond:4}}
    });
    window.tnSupabaseClient = client;
    window.supabaseClient = client;
    window.sb = client;
    return client;
  }

  function getDb(){
    try{
      if(typeof window.tnGetDb === "function")return window.tnGetDb();
    }catch(e){}
    return window.db || {ui:"en",prefs:{frontLang:"en-US",backLang:"ja-JP"},lists:[],words:[],mistakes:[],meta:{}};
  }

  function normalizeData(data){
    if(typeof window.tnMigrateData === "function"){
      try{return window.tnMigrateData(data);}catch(e){}
    }
    const at = nowIso();
    const next = data && typeof data === "object" ? JSON.parse(JSON.stringify(data)) : {};
    next.schemaVersion = Number(next.schemaVersion || 1);
    next.dataVersion = next.dataVersion || "1.0.0";
    next.ui = next.ui || "en";
    next.prefs = next.prefs || {};
    next.prefs.frontLang = safeLang(next.prefs.frontLang,"en-US");
    next.prefs.backLang = safeLang(next.prefs.backLang,"ja-JP");
    next.lists = Array.isArray(next.lists) ? next.lists : [];
    next.words = Array.isArray(next.words) ? next.words : [];
    next.mistakes = Array.isArray(next.mistakes) ? next.mistakes : [];
    next.meta = next.meta || {};
    next.meta.updatedAt = next.meta.updatedAt || at;
    return next;
  }

  function adoptDb(next){
    const safe = normalizeData(next);
    try{
      if(typeof window.tnAdoptDb === "function")window.tnAdoptDb(safe);
      else window.db = safe;
    }catch(e){
      window.db = safe;
    }
    return getDb();
  }

  function writeCache(next){
    const safe = normalizeData(next);
    try{
      if(typeof window.tnWriteData === "function")window.tnWriteData(safe);
      else localStorage.setItem(DATA_KEY,JSON.stringify(safe));
      if(Array.isArray(safe.words) && safe.words.length)localStorage.setItem(SHADOW_KEY,JSON.stringify(safe));
      else localStorage.removeItem(SHADOW_KEY);
      if(currentUser?.id)localStorage.setItem(CACHE_USER_KEY,currentUser.id);
      else localStorage.removeItem(CACHE_USER_KEY);
    }catch(error){
      console.warn("TangoNest cache write failed",error);
    }
  }

  function cleanLegacyAuthKeys(){
    LEGACY_AUTH_KEYS.forEach(key => {
      try{ localStorage.removeItem(key); }catch(e){}
    });
  }

  function readAllPending(){
    try{
      const parsed = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.filter(item => item && item.userId) : [];
    }catch(e){
      return [];
    }
  }

  function storeAllPending(items){
    try{
      const safe = Array.isArray(items) ? items.filter(item => item && item.userId) : [];
      if(safe.length)localStorage.setItem(PENDING_KEY,JSON.stringify(safe));
      else localStorage.removeItem(PENDING_KEY);
    }catch(e){}
  }

  function clearUserCache(options={}){
    try{
      localStorage.removeItem(DATA_KEY);
      localStorage.removeItem(SHADOW_KEY);
      localStorage.removeItem(CACHE_USER_KEY);
      if(options.discardPendingUserId){
        storeAllPending(readAllPending().filter(item => item.userId !== options.discardPendingUserId));
      }
    }catch(e){}
  }

  function cacheOwnerId(){
    try{return localStorage.getItem(CACHE_USER_KEY) || "";}catch(e){return "";}
  }

  function readPending(){
    return readAllPending().filter(item => item.userId === currentUser?.id);
  }

  function writePending(items){
    const otherUsers = readAllPending().filter(item => item.userId !== currentUser?.id);
    const currentItems = Array.isArray(items) ? items.filter(item => item && item.userId === currentUser?.id) : [];
    storeAllPending([...otherUsers,...currentItems]);
    updateCloudUi(lastSyncState);
  }

  function queueWordMutation(word){
    if(!currentUser || !word?.id)return;
    const items = readPending().filter(item => !(item.type === "word_upsert" && item.id === word.id));
    items.push({
      type:"word_upsert",
      id:word.id,
      userId:currentUser.id,
      word:JSON.parse(JSON.stringify(word)),
      attempts:0,
      createdAt:nowIso(),
      updatedAt:nowIso()
    });
    writePending(items);
  }

  function queueLearningMutation(event){
    if(!currentUser || !event?.eventId || !event?.wordId)return;
    const items = readPending();
    if(items.some(item => item.type === "learning_event" && item.event?.eventId === event.eventId))return;
    items.push({
      type:"learning_event",
      id:event.eventId,
      userId:currentUser.id,
      event:{...event,localDate:event.localDate || today()},
      attempts:0,
      createdAt:nowIso(),
      updatedAt:nowIso()
    });
    writePending(items);
  }

  function adoptLearningRow(row){
    if(!row?.id)return;
    const data=getDb();
    const fallback=data.words.find(word => word.id === row.id)?.listId || data.lists[0]?.id || "";
    const serverWord=toLocalWord(row,fallback);
    data.words=data.words.map(word => word.id === serverWord.id ? {...word,...serverWord} : word);
    writeCache(data);
    try{ if(typeof window.renderHome === "function")window.renderHome(); }catch(e){}
    try{ if(typeof window.tnLibraryRender === "function")window.tnLibraryRender(); }catch(e){}
  }

  async function sendLearningMutation(event){
    await requireUser();
    const result=await client.rpc("tn_record_learning_result",{
      p_word_id:event.wordId,
      p_rating:event.rating,
      p_mode:event.mode || "study",
      p_event_id:event.eventId,
      p_answered_at:event.answeredAt || nowIso(),
      p_local_date:event.localDate || today()
    });
    if(result.error)throw result.error;
    return result.data;
  }

  async function flushPendingMutations(){
    if(flushingPending || !currentUser)return;
    let items = readPending();
    if(!items.length)return;
    flushingPending = true;
    updateCloudUi("Syncing");
    const remaining = [];
    const learningRows = new Map();
    try{
      for(const item of items){
        try{
          if(item.type === "learning_event" && item.event?.eventId){
            const saved=await sendLearningMutation(item.event);
            if(saved?.word?.id)learningRows.set(saved.word.id,saved.word);
          }else if(item.type === "word_upsert" && item.word?.id){
            await updateWordRemote(item.word.id,wordNonLearningRowFromLocal(item.word,item.word.listId));
          }
        }catch(error){
          item.attempts = Number(item.attempts || 0) + 1;
          item.updatedAt = nowIso();
          item.lastError = error.message || String(error);
          remaining.push(item);
        }
      }
      writePending(remaining);
      learningRows.forEach((row,wordId) => {
        const stillPending=remaining.some(item => item.type === "learning_event" && item.event?.wordId === wordId);
        if(!stillPending)adoptLearningRow(row);
      });
      lastSyncAt = new Date().toLocaleString();
      updateCloudUi(remaining.length ? "Error" : "Synced");
    }finally{
      flushingPending = false;
    }
  }

  function emptyData(reason){
    const at = nowIso();
    return {
      schemaVersion:1,
      dataVersion:"1.0.0",
      ui:"en",
      prefs:{frontLang:"en-US",backLang:"ja-JP"},
      lists:[],
      words:[],
      mistakes:[],
      meta:{updatedAt:at,sourceOfTruth:"supabase",localStorageRole:"cache-backup",reason:reason || "auth-empty"}
    };
  }

  function renderAll(){
    try{ if(typeof window.render === "function")window.render(); }catch(error){ console.warn(error); }
    try{ if(typeof window.tnLibraryRender === "function")window.tnLibraryRender(); }catch(error){ console.warn(error); }
    try{ if(typeof window.renderMistakeNotebook === "function")window.renderMistakeNotebook(); }catch(e){}
    updateCloudUi(lastSyncState);
  }

  function toast(message){
    try{
      if(typeof window.toast === "function")return window.toast(message);
    }catch(e){}
    const box = $("toast");
    if(box){
      box.textContent = message;
      box.classList.add("show");
      setTimeout(() => box.classList.remove("show"),1600);
    }else{
      console.log("[TangoNest]",message);
    }
  }

  function userError(error,fallback){
    const raw=String(error?.message || error || "");
    const normalized=raw.toLowerCase();
    if(/invalid login credentials|invalid password/.test(normalized))return "Email or password is incorrect.";
    if(/email not confirmed/.test(normalized))return "Confirm your email, then try logging in again.";
    if(/invalid email|validate email/.test(normalized))return "Enter a valid email address.";
    if(/jwt|refresh token|session.*expired|not authenticated/.test(normalized))return "Your session has expired. Please log in again.";
    if(/failed to fetch|network|offline|cloud unavailable|load failed/.test(normalized))return fallback;
    return fallback;
  }

  function authMessage(message,type="info"){
    const box = $("authMessage");
    if(box){
      box.textContent = message;
      box.className = "auth-message " + type;
    }
  }

  function setBusy(value){
    ["loginButton","signupButton"].forEach(id => {
      const button = $(id);
      if(button)button.disabled = !!value;
    });
  }

  function showAuth(message){
    document.documentElement.classList.remove("auth-ready","tn-authenticated","tn-auth-loading");
    document.documentElement.classList.add("tn-logged-out","tn-needs-auth");
    document.body?.classList.add("tn-auth-open");
    document.body?.classList.remove("tn-logged-in");
    const app=document.querySelector?.(".app");
    app?.setAttribute("inert","");
    app?.setAttribute("aria-hidden","true");
    const auth = $("authScreen");
    if(auth){
      auth.style.setProperty("display","flex","important");
      auth.style.setProperty("pointer-events","auto","important");
      auth.style.removeProperty("visibility");
      auth.style.removeProperty("opacity");
    }
    if(message)authMessage(message);
    updateCloudUi("Offline");
    setTimeout(() => {
      const email = $("authEmail");
      if(email && !email.value)email.focus({preventScroll:true});
    },0);
  }

  function showApp(){
    document.documentElement.classList.add("auth-ready","tn-authenticated");
    document.documentElement.classList.remove("tn-logged-out","tn-needs-auth","tn-auth-loading");
    document.body?.classList.add("tn-logged-in");
    document.body?.classList.remove("tn-auth-open");
    const app=document.querySelector?.(".app");
    app?.removeAttribute("inert");
    app?.removeAttribute("aria-hidden");
    const auth = $("authScreen");
    if(auth){
      auth.style.setProperty("display","none","important");
      auth.style.setProperty("pointer-events","none","important");
    }
  }

  function normalizePage(page){
    page = String(page || "").toLowerCase().trim();
    const map = {add:"create",words:"library",study:"cards",audio:"listen",manage:"settings"};
    return map[page] || page || "home";
  }

  function legacyPage(page){
    page = normalizePage(page);
    return {create:"add",library:"words",cards:"study",listen:"audio",settings:"manage"}[page] || page;
  }

  function savedPage(){
    try{return normalizePage(localStorage.getItem(PAGE_KEY) || "home");}catch(e){return "home";}
  }

  function navigate(page){
    const normalized = normalizePage(page);
    try{ localStorage.setItem(PAGE_KEY,normalized); }catch(e){}
    if(typeof window.go === "function")window.go(legacyPage(normalized));
    else if(typeof window.appShow === "function")window.appShow(legacyPage(normalized));
  }

  function updateCloudUi(state){
    lastSyncState = state || lastSyncState || "Offline";
    const email = currentUser?.email || "";
    const pendingCount = readPending().length;
    const synced = !!currentUser && !pendingCount && /synced|online|loaded|saved|ready/i.test(lastSyncState);
    const working=pendingCount||/loading|syncing|pending/i.test(lastSyncState);
    const failed=/error/i.test(lastSyncState);
    const pillText = currentUser ? (working ? "Syncing" : failed ? "Needs attention" : synced ? "Synced" : "Offline") : "Offline";
    const set = (id,text) => { const el=$(id); if(el&&el.textContent!==String(text))el.textContent=text; };
    set("tn80HeaderCloud",currentUser ? pillText : "Login");
    set("tn80StatusPill",pillText);
    set("tn80Account",email || "Not logged in");
    set("tn80Connection",currentUser ? (pendingCount ? `Needs attention · ${pendingCount} pending` : pillText) : "Not logged in");
    set("tn80Device",currentUser ? "This browser" : "-");
    set("tn80CloudUpdated",lastSyncAt || "-");
    set("tn80UserId",currentUser?.id || "-");
    set("tn80RealtimeStatus",currentUser ? realtimeStatus : "-");
    set("tn80PendingMutations",String(pendingCount));
    const db = getDb();
    set("tn80LocalWords",String(db.words?.length || 0));
    set("tn80CloudWords",currentUser ? (cloudCounts.words == null ? "Not loaded" : String(cloudCounts.words)) : "-");
    set("tn80LocalLists",String(db.lists?.length || 0));
    set("tn80CloudLists",currentUser ? (cloudCounts.lists == null ? "Not loaded" : String(cloudCounts.lists)) : "-");
    const status = $("tn80StatusPill");
    if(status){
      status.classList.toggle("synced",!!currentUser && synced);
      status.classList.toggle("local",!currentUser || !synced || !!pendingCount);
    }
    const app=document.querySelector?.(".app");
    if(app)app.setAttribute("aria-busy",working?"true":"false");
    const check = $("tn80CheckCloudBtn");
    if(check){check.textContent = "Sync now"; check.onclick = () => syncNow();}
    const load = $("tn80LoadCloudBtn");
    if(load){load.textContent = "Load latest"; load.onclick = () => syncNow();}
    const logoutButton = $("tn80LogoutBtn");
    if(logoutButton)logoutButton.onclick = logout;
    const guest = $("guestButton");
    if(guest){
      guest.style.display = "none";
      guest.disabled = true;
      guest.textContent = "Login required for sync";
    }
    const pill = $("authModeLabel");
    if(pill)pill.textContent = currentUser ? "Signed in" : "Login required";
  }

  function toLocalPlaylist(row){
    return {
      id:row.id,
      name:row.name || "New Playlist",
      createdAt:row.created_at || nowIso(),
      updatedAt:row.updated_at || row.created_at || nowIso()
    };
  }

  function toLocalWord(row,fallbackListId){
    return {
      id:row.id,
      listId:row.playlist_id || fallbackListId || "",
      front:row.front || "",
      back:row.back || "",
      frontLang:safeLang(row.front_lang,"en-US"),
      backLang:safeLang(row.back_lang,"ja-JP"),
      pos:row.pos || "",
      gender:row.gender || "",
      tags:row.tags || "",
      memo:row.memo || "",
      pronunciation:row.pronunciation || "",
      saved:!!row.saved,
      status:row.status || "new",
      level:Number(row.level || 1),
      nextReview:row.next_review || today(),
      correctCount:Number(row.correct_count || 0),
      wrongCount:Number(row.wrong_count || 0),
      reviewCount:Number(row.review_count || 0),
      lastAnsweredAt:row.last_answered_at || "",
      lastWrongAt:row.last_wrong_at || "",
      consecutiveCorrect:Number(row.consecutive_correct || 0),
      reviewIntervalDays:Number(row.review_interval_days || 0),
      lastResult:row.last_result || "",
      learningState:row.learning_state || "new",
      position:Number(row.position || 0),
      createdAt:row.created_at || nowIso(),
      updatedAt:row.updated_at || row.created_at || nowIso()
    };
  }

  function wordRowFromLocal(word,playlistId){
    return {
      user_id:currentUser.id,
      playlist_id:playlistId || word.listId || null,
      front:safeText(word.front),
      back:safeText(word.back),
      front_lang:safeLang(word.frontLang,"en-US"),
      back_lang:safeLang(word.backLang,"ja-JP"),
      pos:safeText(word.pos) || null,
      gender:safeText(word.gender) || null,
      tags:safeText(word.tags) || null,
      memo:safeText(word.memo) || null,
      pronunciation:safeText(word.pronunciation) || null,
      status:word.status || "new",
      saved:!!word.saved,
      level:Math.max(1,Math.min(5,Number(word.level || 1))),
      next_review:word.nextReview || today(),
      correct_count:Number(word.correctCount || 0),
      wrong_count:Number(word.wrongCount || 0),
      review_count:Number(word.reviewCount || 0),
      last_answered_at:word.lastAnsweredAt || null,
      last_wrong_at:word.lastWrongAt || null,
      consecutive_correct:Number(word.consecutiveCorrect || 0),
      review_interval_days:Number(word.reviewIntervalDays || 0),
      last_result:["again","hard","good","easy"].includes(word.lastResult) ? word.lastResult : null,
      learning_state:["new","learning","review","weak","mastered"].includes(word.learningState) ? word.learningState : "new",
      position:Number(word.position || 0),
      updated_at:nowIso()
    };
  }

  function wordNonLearningRowFromLocal(word,playlistId){
    const row=wordRowFromLocal(word,playlistId);
    [
      "status","level","next_review","correct_count","wrong_count","review_count",
      "last_answered_at","last_wrong_at","consecutive_correct","review_interval_days",
      "last_result","learning_state"
    ].forEach(key => delete row[key]);
    return row;
  }

  async function requireUser(){
    if(currentUser)return currentUser;
    const c = getClient();
    if(!c)throw new Error("Supabase SDK is not ready.");
    const result = await c.auth.getSession();
    if(result.error)throw result.error;
    currentSession = result.data.session || null;
    currentUser = currentSession?.user || null;
    if(!currentUser)throw new Error("Please login first.");
    return currentUser;
  }

  async function ensureDefaultPlaylist(){
    await requireUser();
    const existing = await client.from("tn_playlists").select("*").eq("user_id",currentUser.id).order("created_at",{ascending:true});
    if(existing.error)throw existing.error;
    if(existing.data?.length)return existing.data[0];
    const inserted = await client.from("tn_playlists")
      .insert({user_id:currentUser.id,name:"New Playlist"})
      .select("*")
      .single();
    if(inserted.error)throw inserted.error;
    return inserted.data;
  }

  async function loadCloud(options={}){
    if(loading && !options.force)return;
    await requireUser();
    if(!options.skipPendingFlush && readPending().length){
      await flushPendingMutations();
      if(readPending().length){
        updateCloudUi("Pending");
        if(!options.silent)toast("Pending learning changes will retry before cloud reload.");
        return getDb();
      }
    }
    loading = true;
    updateCloudUi("Loading");
    try{
      let playlistsResult = await client.from("tn_playlists")
        .select("*")
        .eq("user_id",currentUser.id)
        .order("created_at",{ascending:true});
      if(playlistsResult.error)throw playlistsResult.error;
      if(!playlistsResult.data?.length){
        await ensureDefaultPlaylist();
        playlistsResult = await client.from("tn_playlists")
          .select("*")
          .eq("user_id",currentUser.id)
          .order("created_at",{ascending:true});
        if(playlistsResult.error)throw playlistsResult.error;
      }
      const playlists = (playlistsResult.data || []).map(toLocalPlaylist);
      const firstListId = playlists[0]?.id || "";
      const wordsResult = await client.from("tn_words")
        .select("*")
        .eq("user_id",currentUser.id)
        .order("position",{ascending:true})
        .order("created_at",{ascending:true});
      if(wordsResult.error)throw wordsResult.error;
      cloudCounts = {
        words:(wordsResult.data || []).length,
        lists:(playlistsResult.data || []).length,
        userId:currentUser.id
      };
      const previous = getDb();
      const wordIds = new Set((wordsResult.data || []).map(row => row.id));
      const next = normalizeData({
        ...previous,
        prefs:{
          frontLang:safeLang(previous?.prefs?.frontLang,"en-US"),
          backLang:safeLang(previous?.prefs?.backLang,"ja-JP")
        },
        lists:playlists,
        words:(wordsResult.data || []).map(row => toLocalWord(row,firstListId)),
        mistakes:(previous.mistakes || []).filter(entry => wordIds.has(entry.wordId)),
        meta:{...(previous.meta || {}),updatedAt:nowIso(),sourceOfTruth:"supabase",lastCloudLoadAt:nowIso(),userId:currentUser.id}
      });
      const signature = data => JSON.stringify({
        prefs:data?.prefs || {},
        lists:data?.lists || [],
        words:data?.words || [],
        mistakes:data?.mistakes || []
      });
      const changed = signature(previous) !== signature(next);
      if(changed){
        adoptDb(next);
        writeCache(next);
      }
      lastSyncAt = new Date().toLocaleString();
      updateCloudUi("Synced");
      if(changed)renderAll();
      return changed ? next : previous;
    }catch(error){
      cloudCounts = {words:null,lists:null,userId:currentUser?.id || ""};
      updateCloudUi("Error");
      console.warn("Cloud load failed",error);
      if(!options.silent)toast(userError(error,"Couldn't sync your changes. We'll try again automatically."));
      throw error;
    }finally{
      loading = false;
    }
  }

  function scheduleLoad(reason){
    if(!currentUser)return;
    clearTimeout(loadTimer);
    loadTimer = setTimeout(() => {
      loadCloud({silent:true,reason}).catch(error => console.warn("Scheduled cloud load skipped",error));
    },350);
  }

  function subscribeRealtime(){
    if(!client || !currentUser)return;
    if(realtimeChannel && realtimeUserId === currentUser.id)return;
    unsubscribeRealtime();
    realtimeUserId = currentUser.id;
    realtimeStatus = "Connecting";
    updateCloudUi(lastSyncState);
    realtimeChannel = client.channel("tangonest-learning-" + currentUser.id)
      .on("postgres_changes",{event:"*",schema:"public",table:"tn_playlists",filter:"user_id=eq." + currentUser.id},() => scheduleLoad("playlist-realtime"))
      .on("postgres_changes",{event:"*",schema:"public",table:"tn_words",filter:"user_id=eq." + currentUser.id},() => scheduleLoad("word-realtime"))
      .subscribe(status => {
        realtimeStatus = status || "Unknown";
        if(status === "SUBSCRIBED")updateCloudUi("Synced");
        else updateCloudUi(lastSyncState);
      });
  }

  function unsubscribeRealtime(){
    if(realtimeChannel && client){
      try{ client.removeChannel(realtimeChannel); }catch(e){}
    }
    realtimeChannel = null;
    realtimeUserId = "";
    realtimeStatus = "Disconnected";
    updateCloudUi(lastSyncState);
  }

  async function afterSession(session,mode){
    const previousUserId = currentUser?.id || "";
    const ownerBefore = cacheOwnerId();
    currentSession = session || null;
    currentUser = currentSession?.user || null;
    cleanLegacyAuthKeys();
    if(!currentUser){
      unsubscribeRealtime();
      clearUserCache({preservePending:true});
      adoptDb(emptyData("signed-out"));
      renderAll();
      showAuth();
      return;
    }
    const switchingUser = !!previousUserId && previousUserId !== currentUser.id;
    const ownerMismatch = !!ownerBefore && ownerBefore !== currentUser.id;
    if(switchingUser || ownerMismatch){
      clearUserCache();
      adoptDb(emptyData("user-switch"));
      renderAll();
    }
    showApp();
    updateCloudUi("Loading");
    try{
      await loadCloud({silent:mode !== "login",force:true});
      subscribeRealtime();
      navigate(mode === "login" ? "home" : savedPage());
    }catch(error){
      updateCloudUi("Error");
      const cachedForThisUser = ownerBefore === currentUser.id && getDb()?.meta?.userId === currentUser.id;
      if(cachedForThisUser){
        renderAll();
        toast("Cloud is unavailable. Showing the latest local cache.");
        navigate(savedPage());
        return;
      }
      clearUserCache({preservePending:true});
      adoptDb(emptyData("cloud-load-failed"));
      renderAll();
      showAuth(userError(error,"Couldn't load your account. Please try again."));
      throw error;
    }
  }

  async function login(){
    const email = safeText($("authEmail")?.value).toLowerCase();
    const password = $("authPassword")?.value || "";
    if(!email || !password)return authMessage("Email and password are required.","error");
    setBusy(true);
    authMessage("Logging in...");
    try{
      const result = await getClient().auth.signInWithPassword({email,password});
      if(result.error)throw result.error;
      await afterSession(result.data.session,"login");
      authMessage("Logged in.","success");
    }catch(error){
      const message=userError(error,"Couldn't log in. Check your email and password.");
      showAuth(message);
      authMessage(message,"error");
    }finally{
      setBusy(false);
    }
  }

  async function signup(){
    const email = safeText($("authEmail")?.value).toLowerCase();
    const password = $("authPassword")?.value || "";
    if(!email || !password)return authMessage("Email and password are required.","error");
    if(password.length < 6)return authMessage("Password must be at least 6 characters.","error");
    setBusy(true);
    authMessage("Creating account...");
    try{
      const result = await getClient().auth.signUp({email,password});
      if(result.error)throw result.error;
      const session = result.data.session || null;
      if(!session){
        showAuth("Account created. Check your email to confirm your account, then login.");
        authMessage("Check your email to confirm your account, then login.","success");
        return;
      }
      await afterSession(session,"login");
      authMessage("Account created.","success");
    }catch(error){
      const message=userError(error,"Couldn't create the account. Please try again.");
      showAuth(message);
      authMessage(message,"error");
    }finally{
      setBusy(false);
    }
  }

  async function logout(){
    if(currentUser && readPending().length){
      try{ await flushPendingMutations(); }catch(error){ console.warn(error); }
      if(readPending().length){
        toast("Learning changes are still pending. Reconnect and sync before logging out.");
        return;
      }
    }
    const signingOutUserId=currentUser?.id || "";
    try{ await getClient()?.auth.signOut(); }catch(error){ console.warn(error); }
    unsubscribeRealtime();
    currentSession = null;
    currentUser = null;
    cleanLegacyAuthKeys();
    clearUserCache({discardPendingUserId:signingOutUserId});
    adoptDb(emptyData("logout"));
    renderAll();
    showAuth("Signed out.");
  }

  async function syncNow(){
    try{
      await flushPendingMutations();
      await loadCloud({force:true});
      toast("Synced");
    }catch(error){
      toast(userError(error,"Couldn't sync your changes. We'll try again automatically."));
    }
  }

  async function createPlaylist(name){
    try{
      await requireUser();
      const input = $("newList");
      name = safeText(name || input?.value);
      if(!name)return toast("Playlist name is required");
      const result = await client.from("tn_playlists")
        .insert({user_id:currentUser.id,name})
        .select("*")
        .single();
      if(result.error)throw result.error;
      if(input)input.value = "";
      await loadCloud({force:true,silent:true});
      toast("Playlist created");
    }catch(error){
      toast(userError(error,"Couldn't create the playlist. Please try again."));
    }
  }

  async function renamePlaylist(id,name){
    if(LOCAL_QA_MODE){
      const data=getDb();
      id = id || $("renameListSelect")?.value;
      name = safeText(name || $("renameListInput")?.value);
      if(!id || !name)return toast("Playlist name is required");
      const list=data.lists?.find(item=>item.id===id);
      if(!list)return toast("Playlist not found");
      list.name=name;
      list.updatedAt=nowIso();
      window.tnWriteData?.(data);
      if($("renameListInput"))$("renameListInput").value="";
      renderAll();
      toast("Playlist renamed");
      return;
    }
    try{
      await requireUser();
      id = id || $("renameListSelect")?.value;
      name = safeText(name || $("renameListInput")?.value);
      if(!id || !name)return toast("Playlist name is required");
      const result = await client.from("tn_playlists")
        .update({name,updated_at:nowIso()})
        .eq("id",id)
        .eq("user_id",currentUser.id)
        .select("*")
        .single();
      if(result.error)throw result.error;
      if($("renameListInput"))$("renameListInput").value = "";
      await loadCloud({force:true,silent:true});
      toast("Playlist renamed");
    }catch(error){
      toast(userError(error,"Couldn't rename the playlist. Please try again."));
    }
  }

  async function deletePlaylist(id,options={}){
    try{
      await requireUser();
      id = id || "";
      if(!id)return;
      const db = getDb();
      const list = db.lists.find(item => item.id === id);
      if(!list)return toast("Playlist not found");
      if(!options.confirmed&&!confirm(`Delete "${list.name}"? Words will be moved to another playlist.`))return;
      if(typeof client.rpc === "function"){
        const rpcResult = await client.rpc("tn_delete_playlist_with_fallback",{p_playlist_id:id});
        if(!rpcResult.error){
          await loadCloud({force:true,silent:true});
          toast("Playlist deleted");
          return;
        }
        if(!/function|schema cache|not found|404/i.test(rpcResult.error.message || ""))throw rpcResult.error;
      }
      const fallbackResult = await deletePlaylistFallback(id,db);
      if(fallbackResult.error)throw fallbackResult.error;
      await loadCloud({force:true,silent:true});
      toast("Playlist deleted");
    }catch(error){
      toast(userError(error,"Couldn't delete the playlist. Please try again."));
    }
  }

  async function deletePlaylistFallback(id,db){
    const other = db.lists.find(item => item.id !== id);
    let fallbackId = other?.id || "";
    let createdFallback = null;
    if(!fallbackId){
      const inserted = await client.from("tn_playlists")
        .insert({user_id:currentUser.id,name:"New Playlist"})
        .select("*")
        .single();
      if(inserted.error)return {error:inserted.error};
      createdFallback = inserted.data;
      fallbackId = inserted.data.id;
    }
    const move = await client.from("tn_words")
      .update({playlist_id:fallbackId,updated_at:nowIso()})
      .eq("playlist_id",id)
      .eq("user_id",currentUser.id);
    if(move.error)return {error:move.error};
    const result = await client.from("tn_playlists")
      .delete()
      .eq("id",id)
      .eq("user_id",currentUser.id);
    if(result.error){
      try{
        await client.from("tn_words")
          .update({playlist_id:id,updated_at:nowIso()})
          .eq("playlist_id",fallbackId)
          .eq("user_id",currentUser.id);
        if(createdFallback?.id){
          await client.from("tn_playlists").delete().eq("id",createdFallback.id).eq("user_id",currentUser.id);
        }
      }catch(rollbackError){
        console.warn("Playlist delete rollback failed",rollbackError);
      }
      return {error:result.error};
    }
    return {fallbackId};
  }

  function selectedPlaylistId(id){
    const el = $(id);
    return el?.value || getDb().lists?.[0]?.id || "";
  }

  function rememberPlaylist(id){
    if(!id)return;
    try{ localStorage.setItem(RECENT_PLAYLIST_KEY,id); }catch(e){}
  }

  function focusFrontSoon(){
    setTimeout(() => {
      const front = $("front");
      if(front){
        try{ front.focus({preventScroll:true}); }catch(e){ try{ front.focus(); }catch(err){} }
      }
    },60);
  }

  function clearForm(){
    ["front","back","memo","tags"].forEach(id => { const el=$(id); if(el)el.value = ""; });
    if($("pos"))$("pos").value = "";
    if($("gender"))$("gender").value = "";
  }

  async function addWord(event){
    if(event?.preventDefault)event.preventDefault();
    try{
      await requireUser();
      const playlist = selectedPlaylistId("addList") || (await ensureDefaultPlaylist()).id;
      rememberPlaylist(playlist);
      const front = safeText($("front")?.value);
      const back = safeText($("back")?.value);
      if(!front || !back)return toast("Front and Back are required");
      const position = getDb().words.filter(word => word.listId === playlist).length;
      const row = {
        user_id:currentUser.id,
        playlist_id:playlist,
        front,
        back,
        front_lang:safeLang($("frontLang")?.value || getDb().prefs?.frontLang,"en-US"),
        back_lang:safeLang($("backLang")?.value || getDb().prefs?.backLang,"ja-JP"),
        pos:safeText($("pos")?.value) || null,
        gender:safeText($("gender")?.value) || null,
        tags:safeText($("tags")?.value) || null,
        memo:safeText($("memo")?.value) || null,
        status:"new",
        saved:false,
        level:1,
        next_review:today(),
        position
      };
      const result = await client.from("tn_words").insert(row).select("*").single();
      if(result.error)throw result.error;
      clearForm();
      await loadCloud({force:true,silent:true});
      toast("1 word added");
      focusFrontSoon();
      return false;
    }catch(error){
      toast(userError(error,"Couldn't add the word. Please try again."));
      return false;
    }
  }

  async function updateWordRemote(id,patch){
    await requireUser();
    const result = await client.from("tn_words")
      .update({...patch,updated_at:nowIso()})
      .eq("id",id)
      .eq("user_id",currentUser.id)
      .select("*")
      .single();
    if(result.error)throw result.error;
    return result.data;
  }

  async function saveEdit(){
    try{
      await requireUser();
      const id = $("editId")?.value;
      if(!id)return;
      const front = safeText($("editFront")?.value);
      const back = safeText($("editBack")?.value);
      if(!front || !back)return toast("Front and Back are required");
      await updateWordRemote(id,{
        front,
        back,
        front_lang:safeLang($("editFrontLang")?.value,"en-US"),
        back_lang:safeLang($("editBackLang")?.value,"ja-JP"),
        playlist_id:$("editList")?.value || null,
        pos:safeText($("editPOS")?.value) || null,
        gender:safeText($("editGender")?.value) || null,
        tags:safeText($("editTags")?.value) || null,
        memo:safeText($("editMemo")?.value) || null
      });
      if(typeof window.closeEdit === "function")window.closeEdit();
      await loadCloud({force:true,silent:true});
      toast("Word updated");
    }catch(error){
      toast(userError(error,"Couldn't save the word. Please try again."));
    }
  }

  async function removeWord(id){
    try{
      await requireUser();
      const word = getDb().words.find(item => item.id === id);
      if(!word)return toast("Word not found");
      if(readPending().some(item => item.id === id || item.event?.wordId === id)){
        await flushPendingMutations();
        if(readPending().some(item => item.id === id || item.event?.wordId === id)){
          return toast("This word still has unsynced changes. Reconnect and try again.");
        }
      }
      if(!confirm(`Delete "${word.front}"?`))return;
      const result = await client.from("tn_words")
        .delete()
        .eq("id",id)
        .eq("user_id",currentUser.id);
      if(result.error)throw result.error;
      await loadCloud({force:true,silent:true});
      toast("Word deleted");
    }catch(error){
      toast(userError(error,"Couldn't delete the word. Please try again."));
    }
  }

  async function toggleFavoriteRemote(id){
    try{
      await requireUser();
      const word = getDb().words.find(item => item.id === id);
      if(!word)return toast("Word not found");
      await updateWordRemote(id,{saved:!word.saved});
      await loadCloud({force:true,silent:true});
      toast(word.saved ? "Removed from saved" : "Saved");
    }catch(error){
      toast(userError(error,"Couldn't update the saved word. Please try again."));
    }
  }

  function selectedWordIdsFromDom(){
    const modern=[...document.querySelectorAll("[data-select-word]:checked")].map(input=>input.dataset.selectWord).filter(Boolean);
    const legacy=[...document.querySelectorAll("#wordsBox input[type='checkbox']:checked")].map(input => {
      const attr = input.getAttribute("onchange") || "";
      const match = attr.match(/toggleSelected\('([^']+)'/);
      return match ? match[1] : "";
    }).filter(Boolean);
    return [...new Set([...modern,...legacy])];
  }

  async function deleteSelected(){
    try{
      await requireUser();
      const ids = selectedWordIdsFromDom();
      if(!ids.length)return toast("Select words first");
      if(readPending().some(item => ids.includes(item.id) || ids.includes(item.event?.wordId))){
        await flushPendingMutations();
        if(readPending().some(item => ids.includes(item.id) || ids.includes(item.event?.wordId))){
          return toast("Some selected words still have unsynced changes. Reconnect and try again.");
        }
      }
      if(!confirm(`${ids.length} words will be deleted.`))return;
      const result = await client.from("tn_words")
        .delete()
        .eq("user_id",currentUser.id)
        .in("id",ids);
      if(result.error)throw result.error;
      await loadCloud({force:true,silent:true});
      toast("Selected words deleted");
    }catch(error){
      toast(userError(error,"Couldn't delete the selected words. Please try again."));
    }
  }

  async function bulkImport(mode){
    try{
      await requireUser();
      if(mode === "replace"){
        return toast("Cloud Replace is disabled for bulk safety. Use Skip or Add Both, or edit a word directly.");
      }
      if(typeof window.bulkRows !== "function")return toast("Bulk parser is not ready");
      let rows = window.bulkRows();
      if(!rows.length)return toast("No readable words");
      const hasFrontDup = rows.some(row => row.frontDuplicate);
      if(hasFrontDup && !mode){
        try{ if(typeof window.previewBulk === "function")window.previewBulk(); }catch(e){}
        return toast("Duplicate words need confirmation");
      }
      if(mode === "skip" || !mode)rows = rows.filter(row => !row.duplicate);
      if(mode === "addBoth"){
        const seen = new Set();
        rows = rows.filter(row => {
          const key = [row.front,row.back,row.pos].map(value => String(value || "").trim().toLowerCase()).join("||");
          if(seen.has(key))return false;
          seen.add(key);
          return true;
        });
      }
      const playlist = selectedPlaylistId("bulkList") || (await ensureDefaultPlaylist()).id;
      rememberPlaylist(playlist);
      const frontLang = safeLang($("bulkFrontLang")?.value,"en-US");
      const backLang = safeLang($("bulkBackLang")?.value,"ja-JP");
      if(mode === "replace"){
        for(const row of rows){
          const existing = getDb().words.find(word =>
            word.listId === playlist &&
            String(word.front || "").trim().toLowerCase() === String(row.front || "").trim().toLowerCase()
          );
          if(existing){
            await updateWordRemote(existing.id,{
              front:row.front,
              back:row.back,
              front_lang:frontLang,
              back_lang:backLang,
              playlist_id:playlist,
              pos:safeText(row.pos) || null,
              gender:safeText(row.gender) || null,
              memo:safeText(row.memo) || null
            });
          }else{
            await client.from("tn_words").insert(wordRowFromLocal({
              front:row.front,back:row.back,frontLang,backLang,listId:playlist,
              memo:row.memo,pos:row.pos,gender:row.gender,tags:"",status:"new",level:1,nextReview:today()
            },playlist));
          }
        }
      }else if(rows.length){
        const existingCount = getDb().words.filter(word => word.listId === playlist).length;
        const payload = rows.map((row,index) => wordRowFromLocal({
          front:row.front,
          back:row.back,
          frontLang,
          backLang,
          listId:playlist,
          memo:row.memo,
          pos:row.pos,
          gender:row.gender,
          tags:"",
          status:"new",
          level:1,
          nextReview:today(),
          position:existingCount + index
        },playlist));
        const result = await client.from("tn_words").insert(payload);
        if(result.error)throw result.error;
      }
      if($("bulkText"))$("bulkText").value = "";
      try{ if(typeof window.clearBulkPreview === "function")window.clearBulkPreview(); }catch(e){}
      await loadCloud({force:true,silent:true});
      toast(`${rows.length} processed`);
    }catch(error){
      toast(userError(error,"Couldn't add these words. Check the entries and try again."));
    }
  }

  function safeExportData(){
    const db = normalizeData(getDb());
    const clean = {
      ui:db.ui || "en",
      prefs:{
        frontLang:safeLang(db.prefs?.frontLang,"en-US"),
        backLang:safeLang(db.prefs?.backLang,"ja-JP")
      },
      lists:(db.lists || []).map(list => ({
        id:String(list.id || ""),
        name:String(list.name || "New Playlist"),
        createdAt:list.createdAt || list.created_at || "",
        updatedAt:list.updatedAt || list.updated_at || ""
      })),
      words:(db.words || []).map(word => ({
        id:String(word.id || ""),
        listId:String(word.listId || ""),
        front:String(word.front || ""),
        back:String(word.back || ""),
        frontLang:safeLang(word.frontLang,"en-US"),
        backLang:safeLang(word.backLang,"ja-JP"),
        pos:word.pos || "",
        gender:word.gender || "",
        tags:word.tags || "",
        memo:word.memo || "",
        pronunciation:word.pronunciation || "",
        status:word.status || "new",
        saved:!!word.saved,
        level:Number(word.level || 1),
        nextReview:word.nextReview || today(),
        correctCount:Number(word.correctCount || 0),
        wrongCount:Number(word.wrongCount || 0),
        reviewCount:Number(word.reviewCount || 0),
        lastAnsweredAt:word.lastAnsweredAt || "",
        lastWrongAt:word.lastWrongAt || "",
        consecutiveCorrect:Number(word.consecutiveCorrect || 0),
        reviewIntervalDays:Number(word.reviewIntervalDays || 0),
        lastResult:word.lastResult || "",
        learningState:word.learningState || "new",
        position:Number(word.position || 0),
        createdAt:word.createdAt || "",
        updatedAt:word.updatedAt || ""
      })),
      mistakes:[]
    };
    return {app:"TangoNest",version:"backup-v1",exportedAt:nowIso(),data:clean};
  }

  function parseImportText(){
    const text = safeText($("syncDataBox")?.value);
    if(!text)throw new Error("Paste export data first.");
    let parsed;
    try{ parsed = JSON.parse(text); }catch(e){ throw new Error("Import failed: invalid JSON."); }
    const incoming = parsed?.data?.words ? parsed.data : parsed;
    if(!Array.isArray(incoming?.words) || !Array.isArray(incoming?.lists))throw new Error("Import failed: this is not TangoNest data.");
    const lists = incoming.lists
      .filter(Boolean)
      .map((list,index) => ({
        id:String(list.id || `import-list-${index}`),
        name:safeText(list.name) || "Imported Playlist"
      }));
    const safeLists = lists.length ? lists : [{id:"import-default",name:"New Playlist"}];
    const listIds = new Set(safeLists.map(list => list.id));
    const fallbackListId = safeLists[0].id;
    const words = incoming.words
      .filter(word => safeText(word?.front) && safeText(word?.back))
      .map((word,index) => ({
        listId:listIds.has(String(word.listId || "")) ? String(word.listId) : fallbackListId,
        front:safeText(word.front),
        back:safeText(word.back),
        frontLang:safeLang(word.frontLang,"en-US"),
        backLang:safeLang(word.backLang,"ja-JP"),
        pos:safeText(word.pos),
        gender:safeText(word.gender),
        tags:safeText(word.tags),
        memo:safeText(word.memo),
        pronunciation:safeText(word.pronunciation),
        status:["new","learned","hard"].includes(word.status) ? word.status : "new",
        saved:!!word.saved,
        level:Math.max(1,Math.min(5,Number(word.level || 1))),
        nextReview:word.nextReview || today(),
        correctCount:Number(word.correctCount || 0),
        wrongCount:Number(word.wrongCount || 0),
        reviewCount:Number(word.reviewCount || 0),
        lastAnsweredAt:word.lastAnsweredAt || "",
        lastWrongAt:word.lastWrongAt || "",
        position:Number.isFinite(Number(word.position)) ? Number(word.position) : index
      }));
    return {
      ui:incoming.ui || "en",
      prefs:{
        frontLang:safeLang(incoming.prefs?.frontLang,"en-US"),
        backLang:safeLang(incoming.prefs?.backLang,"ja-JP")
      },
      lists:safeLists,
      words
    };
  }

  async function importDataToCloud(){
    try{
      await requireUser();
      if(readPending().length){
        await flushPendingMutations();
        if(readPending().length)return toast("Sync pending learning changes before importing a backup.");
      }
      const payload = parseImportText();
      if(!confirm(`Import ${payload.words.length} words into this Supabase account? Current cloud vocabulary will be replaced.`))return;
      const typed = prompt('Type IMPORT to replace this account vocabulary.');
      if(typed !== "IMPORT")return toast("Import cancelled");
      updateCloudUi("Importing");
      const result = await client.rpc("tn_import_snapshot",{p_data:payload});
      if(result.error)throw result.error;
      await loadCloud({force:true,silent:true,skipPendingFlush:true});
      toast(`Imported ${result.data?.words ?? payload.words.length} words`);
    }catch(error){
      toast(userError(error,"Couldn't import this backup. Check the file and try again."));
    }
  }

  async function clearLocalCacheOnly(){
    if(currentUser && readPending().length){
      try{ await flushPendingMutations(); }catch(error){ console.warn(error); }
      if(readPending().length)return toast("Local cache cannot be cleared while learning changes are pending.");
    }
    if(!confirm("Clear only this browser cache? Cloud data will be loaded again after sync."))return;
    clearUserCache();
    adoptDb(emptyData("clear-local-cache"));
    renderAll();
    if(currentUser){
      try{ await loadCloud({force:true,silent:true,skipPendingFlush:true}); }catch(e){ updateCloudUi("Error"); }
    }
    toast("Local cache cleared");
  }

  async function deleteAllAccountData(){
    try{
      await requireUser();
      if(readPending().length){
        await flushPendingMutations();
        if(readPending().length)return toast("Sync pending changes before deleting account vocabulary.");
      }
      if(!confirm("Delete all TangoNest cloud words and playlists for this account? This cannot be undone."))return;
      const typed = prompt("Type DELETE CLOUD DATA to permanently delete this account's TangoNest data.");
      if(typed !== "DELETE CLOUD DATA")return toast("Cancelled");
      updateCloudUi("Deleting");
      const result = await client.rpc("tn_delete_all_account_data");
      if(result.error)throw result.error;
      clearUserCache({discardPendingUserId:currentUser.id});
      await loadCloud({force:true,silent:true,skipPendingFlush:true});
      toast("Account vocabulary data deleted");
    }catch(error){
      toast(userError(error,"Couldn't delete the account vocabulary. Please try again."));
    }
  }

  function syncWordFromCache(id,delay=300){
    if(!currentUser || !id)return;
    const snapshot = getDb().words.find(item => item.id === id);
    if(snapshot)queueWordMutation(snapshot);
    clearTimeout(savingWordTimers.get(id));
    savingWordTimers.set(id,setTimeout(async() => {
      try{
        const word = getDb().words.find(item => item.id === id);
        if(!word)return;
        await updateWordRemote(id,wordNonLearningRowFromLocal(word,word.listId));
        writePending(readPending().filter(item => !(item.type === "word_upsert" && item.id === id)));
        lastSyncAt = new Date().toLocaleString();
        updateCloudUi("Saved");
      }catch(error){
        console.warn("Word progress sync failed",error);
        updateCloudUi("Error");
      }
    },delay));
  }

  function recordLearningResultRemote(event){
    if(!event?.eventId || !event?.wordId)return;
    if(!currentUser){
      updateCloudUi("Offline");
      return;
    }
    queueLearningMutation({...event,localDate:event.localDate || today()});
    updateCloudUi("Pending");
    setTimeout(() => {
      flushPendingMutations().catch(error => {
        console.warn("Learning result sync will retry",error);
        updateCloudUi("Pending");
      });
    },80);
  }

  function wrapLocalWordMutations(){
    const wrap = (name,after) => {
      if(name === "toggleStar" && typeof window.tnToggleFavorite === "function")return;
      const original = window[name];
      if(typeof original !== "function" || original.__tnCloudWrapped)return;
      const wrapped = function(...args){
        const result = original.apply(this,args);
        try{ after(args,result); }catch(error){ console.warn(error); }
        return result;
      };
      wrapped.__tnCloudWrapped = true;
      window[name] = wrapped;
    };
    wrap("toggleStar",args => syncWordFromCache(args[0]));
    wrap("moveWord",args => syncPlaylistPositions(args[0]));
  }

  async function syncPlaylistPositions(changedWordId){
    if(!currentUser)return;
    setTimeout(async() => {
      try{
        const word = getDb().words.find(item => item.id === changedWordId);
        if(!word)return;
        const words = getDb().words.filter(item => item.listId === word.listId);
        for(let index=0; index<words.length; index++){
          words[index].position = index;
          queueWordMutation(words[index]);
          await client.from("tn_words").update({position:index,updated_at:nowIso()}).eq("id",words[index].id).eq("user_id",currentUser.id);
        }
        writePending(readPending().filter(item => !(item.type === "word_upsert" && words.some(word => word.id === item.id))));
        updateCloudUi("Saved");
      }catch(error){
        flushPendingMutations().catch(err => console.warn("Position retry failed",err));
        console.warn("Position sync failed",error);
      }
    },400);
  }

  function bindAuthUi(){
    const loginBtn = $("loginButton");
    const createBtn = $("signupButton");
    if(loginBtn)loginBtn.onclick = event => { event.preventDefault(); return login(); };
    if(createBtn)createBtn.onclick = event => { event.preventDefault(); return signup(); };
    ["authEmail","authPassword"].forEach(id => {
      const el = $(id);
      if(el && !el.__tnAuthEnter){
        el.addEventListener("keydown",event => {
          if(event.key === "Enter"){
            event.preventDefault();
            if(id === "authEmail")$("authPassword")?.focus();
            else login();
          }
        });
        el.__tnAuthEnter = true;
      }
    });
    updateCloudUi(lastSyncState);
  }

  function installGlobals(){
    window.tnCloudClient = () => getClient();
    window.tnCloudLoad = () => loadCloud({force:true});
    window.tnSyncNow = syncNow;
    window.tnLogout = logout;
    window.tnSyncWord = syncWordFromCache;
    window.tnRecordLearningResult = recordLearningResultRemote;
    window.tnDeleteWord = removeWord;
    window.tnToggleFavorite = toggleFavoriteRemote;
    window.tnDeletePlaylist = deletePlaylist;
    window.logoutTangoNest = logout;
    window.createList = () => createPlaylist($("newList")?.value);
    window.renameList = () => renamePlaylist($("renameListSelect")?.value,$("renameListInput")?.value);
    window.tnRenamePlaylist = renamePlaylist;
    window.tnRegisterWordCritical = addWord;
    window.addWord = addWord;
    window.registerWord = addWord;
    window.clearForm = clearForm;
    window.saveEdit = saveEdit;
    window.removeWord = removeWord;
    window.deleteSelected = deleteSelected;
    window.bulkImport = bulkImport;
    window.toggleStar = toggleFavoriteRemote;
    window.tnBuildSafeExportData = safeExportData;
    window.tnImportDataToCloud = importDataToCloud;
    window.importDataText = importDataToCloud;
    window.tnClearLocalCache = clearLocalCacheOnly;
    window.clearLocalCache = clearLocalCacheOnly;
    window.tnDeleteAllAccountData = deleteAllAccountData;
    window.deleteAllAccountData = deleteAllAccountData;
    window.clearAll = clearLocalCacheOnly;
  }

  async function boot(){
    if(booted)return;
    booted = true;
    cleanLegacyAuthKeys();
    installGlobals();
    bindAuthUi();
    if(LOCAL_QA_MODE){
      window.createList = async() => {
        const data=getDb();
        const input=$("newList");
        const name=safeText(input?.value);
        if(!name)return toast("Playlist name is required");
        data.lists.push({id:`qa-list-${Date.now()}`,name,createdAt:nowIso(),updatedAt:nowIso()});
        window.tnWriteData?.(data);
        if(input)input.value="";
        renderAll();
        toast("Playlist created");
      };
      const qaRenamePlaylist = renamePlaylist;
      window.tnRenamePlaylist = qaRenamePlaylist;
      window.renameList = () => qaRenamePlaylist($("renameListSelect")?.value,$("renameListInput")?.value);
      const qaAddWord = async event => {
        event?.preventDefault?.();
        const data=getDb();
        const front=safeText($("front")?.value);
        const back=safeText($("back")?.value);
        if(!front||!back)return toast("Front and Back are required");
        const playlist=selectedPlaylistId("addList");
        data.words.push({
          id:`qa-added-${Date.now()}`,
          listId:playlist,
          front,
          back,
          frontLang:safeLang($("frontLang")?.value||"en-US","en-US"),
          backLang:safeLang($("backLang")?.value||"ja-JP","ja-JP"),
          pos:safeText($("pos")?.value),
          gender:safeText($("gender")?.value),
          tags:safeText($("tags")?.value),
          memo:safeText($("memo")?.value),
          status:"new",
          saved:false,
          level:1,
          reviewCount:0,
          nextReview:today(),
          createdAt:nowIso()
        });
        window.tnWriteData?.(data);
        clearForm();
        renderAll();
        focusFrontSoon();
        toast("1 word added");
        return false;
      };
      window.tnRegisterWordCritical=qaAddWord;
      window.addWord=qaAddWord;
      window.registerWord=qaAddWord;
      window.tnDeletePlaylist=undefined;
      window.tnDeleteWord=undefined;
      window.tnToggleFavorite=undefined;
      if(typeof localFallbacks.bulkImport==="function")window.bulkImport=localFallbacks.bulkImport;
      if(typeof localFallbacks.deleteSelected==="function")window.deleteSelected=localFallbacks.deleteSelected;
      if(typeof localFallbacks.toggleFavorite==="function")window.toggleStar=localFallbacks.toggleFavorite;
      showApp();
      updateCloudUi("Offline");
      navigate(savedPage());
      return;
    }
    wrapLocalWordMutations();
    client = getClient();
    if(!client){
      showAuth("Online sync is taking longer than expected. Check your connection and reload.");
      if(bootRetryCount < 8){
        bootRetryCount++;
        booted = false;
        setTimeout(boot,500);
      }
      return;
    }
    bootRetryCount = 0;
    try{
      const result = await client.auth.getSession();
      if(result.error)throw result.error;
      if(result.data.session)await afterSession(result.data.session,"restore");
      else showAuth("Login or create an account to sync your vocabulary.");
    }catch(error){
      console.warn("Session restore failed",error);
      showAuth(userError(error,"Online sync is temporarily unavailable. Your saved local data is safe. Try again later."));
    }
    if(!authUnsubscribe){
      const subscription = client.auth.onAuthStateChange((event,session) => {
        if(event === "SIGNED_OUT"){
          currentSession = null;
          currentUser = null;
          unsubscribeRealtime();
          cleanLegacyAuthKeys();
          clearUserCache();
          adoptDb(emptyData("signed-out"));
          renderAll();
          showAuth("Signed out.");
          return;
        }
        if(session?.user && session.user.id !== currentUser?.id){
          afterSession(session,"restore").catch(error => console.warn("Auth state load failed",error));
        }
      });
      authUnsubscribe = subscription?.data?.subscription || subscription;
    }
  }

  window.addEventListener("focus",() => {
    if(currentUser){
      flushPendingMutations().finally(() => scheduleLoad("focus"));
    }
  });
  document.addEventListener("visibilitychange",() => {
    if(document.visibilityState === "visible" && currentUser){
      flushPendingMutations().finally(() => scheduleLoad("visibility"));
    }
  });
  window.addEventListener("online",() => {
    if(currentUser){
      updateCloudUi("Online");
      flushPendingMutations().finally(() => scheduleLoad("online"));
    }
  });
  window.addEventListener("offline",() => updateCloudUi("Offline"));
  window.addEventListener("pagehide",() => {
    clearTimeout(loadTimer);
    savingWordTimers.forEach(timer=>clearTimeout(timer));
    savingWordTimers.clear();
    unsubscribeRealtime();
    try{authUnsubscribe?.unsubscribe?.()}catch(e){}
    authUnsubscribe=null;
  });

  if(document.readyState === "loading")document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();
