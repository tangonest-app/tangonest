(function(){
  "use strict";

  const config = window.TangoNestConfig || {};
  const SUPABASE_URL = String(config.supabaseUrl || "").trim();
  const SUPABASE_KEY = String(config.supabasePublishableKey || "").trim();
  const LEGACY_DATA_KEY = "tangonest_production_stable_v1";
  const LEGACY_SHADOW_KEY = "tangonest_last_good_data_v1";
  const PAGE_KEY = "tangonest_last_page_v2";
  const LEGACY_CACHE_USER_KEY = "tangonest_cache_user_id_v1";
  const LEGACY_ACCOUNT_DATA_PREFIX = "tangonest_account_cache_v1:";
  const LEGACY_ACCOUNT_SHADOW_PREFIX = "tangonest_account_shadow_v1:";
  const ACCOUNT_STORAGE_PREFIX = "tangonest:account:v2:";
  const UNASSIGNED_BACKUP_KEY = "tangonest_unassigned_cache_backup_v1";
  const LEGACY_PENDING_KEY = "tangonest_pending_mutations_v1";
  const LEGACY_RECENT_PLAYLIST_KEY = "tangonest_recent_playlist_v1";
  const ACCOUNT_CLEAN_START_PREFIX = "tangonest_account_isolation_reset_v2:";
  const DEFAULT_PLAYLIST_NAME = "My Words";
  const LOCAL_DEFAULT_PLAYLIST_ID = "local-my-words";
  const CLOUD_PAGE_SIZE = 1000;
  const BULK_INSERT_SIZE = 250;
  const LEGACY_EMPTY_PLAYLIST_NAMES = new Set(["new playlist","starter","default","chinese"]);
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
  let activeCloudLoad = null;
  let activeCloudLoadUserId = "";
  let loadTimer = null;
  let savingWordTimers = new Map();
  let lastSyncAt = "";
  let lastSyncState = "Offline";
  let cloudCounts = {words:null,lists:null,userId:""};
  let realtimeStatus = "Disconnected";
  let flushingPending = false;
  let authInFlight = false;
  let sessionLoadPromise = null;
  let sessionLoadUserId = "";
  let initializedUserId = "";
  let authEventTimer = null;
  let passwordRecoveryMode = false;
  let lastCloudFetchOk = false;
  let startupState = "BOOTING";
  let defaultPlaylistPromise = null;
  let defaultPlaylistUserId = "";
  let defaultPlaylistVerifiedUserId = "";
  let accountCleanStartPromise = null;
  let accountCleanStartUserId = "";
  let accountCleanStartGeneration = -1;
  let authGeneration = 0;

  function accountStorageKey(userId,kind){
    const owner=safeText(userId);
    return owner?`${ACCOUNT_STORAGE_PREFIX}${owner}:${kind}`:"";
  }

  function activeRequest(userId,generation){
    return !!userId&&currentUser?.id===userId&&authGeneration===generation;
  }

  function assertActiveRequest(userId,generation){
    if(activeRequest(userId,generation))return;
    const error=new Error("Discarded stale account request.");
    error.name="TangoNestStaleAccountRequest";
    error.staleAccountRequest=true;
    throw error;
  }

  function resetDefaultPlaylistGuard(){
    defaultPlaylistPromise=null;
    defaultPlaylistUserId="";
    defaultPlaylistVerifiedUserId="";
  }

  const STARTUP_STATES = new Set(["BOOTING","UNAUTHENTICATED","AUTHENTICATED","SYNCING","READY","SYNC_ERROR"]);
  function setStartupState(next){
    startupState = STARTUP_STATES.has(next) ? next : startupState;
    document.documentElement.dataset.startupState = startupState;
  }

  function newId(){
    if(typeof window.crypto?.randomUUID === "function")return window.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,char => {
      const value=Math.random()*16|0;
      return (char === "x" ? value : (value&3|8)).toString(16);
    });
  }

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
        detectSessionInUrl:true,
        storage:window.localStorage,
        flowType:"pkce"
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
      try{
        const migrated=window.tnMigrateData(data);
        if(window.TangoNestDefaultPlaylist?.enforce)window.TangoNestDefaultPlaylist.enforce(migrated,{clone:false});
        migrated.meta=migrated.meta||{};
        if(currentUser?.id)migrated.meta.userId=currentUser.id;
        return migrated;
      }catch(e){}
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
    if(currentUser?.id)next.meta.userId=currentUser.id;
    next.meta.updatedAt = next.meta.updatedAt || at;
    if(window.TangoNestDefaultPlaylist?.enforce)window.TangoNestDefaultPlaylist.enforce(next,{clone:false,now:at});
    return next;
  }

  function adoptDb(next){
    const owner=safeText(next?.meta?.userId);
    if(currentUser?.id&&owner!==currentUser.id){
      console.warn("TangoNest blocked a database adoption outside the active account boundary.");
      return getDb();
    }
    if(!currentUser&&owner){
      console.warn("TangoNest blocked authenticated data while signed out.");
      return getDb();
    }
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
    if(!currentUser?.id)return;
    if(safeText(next?.meta?.userId)!==currentUser.id){
      console.warn("TangoNest blocked a cache write for a different or unowned account.");
      return;
    }
    const safe = normalizeData(next);
    try{
      const serialized=JSON.stringify(safe);
      window.tnSetActiveUserScope?.(currentUser.id);
      if(typeof window.tnWriteData === "function")window.tnWriteData(safe);
      else{
        localStorage.setItem(accountStorageKey(currentUser.id,"data"),serialized);
        if(Array.isArray(safe.words)&&safe.words.length&&serialized.length<=1500000)localStorage.setItem(accountStorageKey(currentUser.id,"shadow"),serialized);
        else localStorage.removeItem(accountStorageKey(currentUser.id,"shadow"));
      }
    }catch(error){
      console.warn("TangoNest cache write failed",error);
    }
  }

  function readJsonKey(key){
    try{
      const parsed=JSON.parse(localStorage.getItem(key) || "null");
      return parsed && typeof parsed === "object" ? parsed : null;
    }catch(e){
      return null;
    }
  }

  function readAccountCache(userId){
    if(!userId)return null;
    const cached=readJsonKey(accountStorageKey(userId,"data")) || readJsonKey(accountStorageKey(userId,"shadow"));
    if(!cached)return null;
    if(cached.meta?.userId!==userId){
      clearUserCache({purgeScopedUserId:userId});
      return null;
    }
    return normalizeData(cached);
  }

  function cleanLegacyAuthKeys(){
    LEGACY_AUTH_KEYS.forEach(key => {
      try{ localStorage.removeItem(key); }catch(e){}
    });
  }

  function readPendingFor(userId){
    const key=accountStorageKey(userId,"pending");
    if(!key)return[];
    try{
      const parsed = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(parsed) ? parsed.filter(item => item?.userId===userId) : [];
    }catch(e){
      return [];
    }
  }

  function storePendingFor(userId,items){
    const key=accountStorageKey(userId,"pending");
    if(!key)return;
    try{
      const safe = Array.isArray(items) ? items.filter(item => item?.userId===userId) : [];
      if(safe.length)localStorage.setItem(key,JSON.stringify(safe));
      else localStorage.removeItem(key);
    }catch(e){}
  }

  function clearUserCache(options={}){
    try{
      localStorage.removeItem(LEGACY_DATA_KEY);
      localStorage.removeItem(LEGACY_SHADOW_KEY);
      localStorage.removeItem(LEGACY_CACHE_USER_KEY);
      if(options.purgeScopedUserId){
        ["data","shadow","learning-session","recent-playlist"].forEach(kind=>localStorage.removeItem(accountStorageKey(options.purgeScopedUserId,kind)));
      }
      if(options.discardPendingUserId){
        localStorage.removeItem(accountStorageKey(options.discardPendingUserId,"pending"));
      }
    }catch(e){}
  }

  function clearAllLocalAppData(){
    try{
      const keys=[];
      for(let index=0;index<localStorage.length;index++)keys.push(localStorage.key(index));
      keys.filter(Boolean).forEach(key => {
        if(
          key===LEGACY_DATA_KEY||key===LEGACY_SHADOW_KEY||key===PAGE_KEY||key===LEGACY_CACHE_USER_KEY||
          key===UNASSIGNED_BACKUP_KEY||key===LEGACY_PENDING_KEY||key===LEGACY_RECENT_PLAYLIST_KEY||
          key.startsWith(LEGACY_ACCOUNT_DATA_PREFIX)||key.startsWith(LEGACY_ACCOUNT_SHADOW_PREFIX)||key.startsWith(ACCOUNT_STORAGE_PREFIX)||
          key.startsWith(ACCOUNT_CLEAN_START_PREFIX)
        )localStorage.removeItem(key);
      });
    }catch(e){}
  }

  async function requireFreshLoginForRelease(){
    return false;
  }

  async function applyAccountCleanStartOnce(){
    const account=await requireAccountContext();
    const userId=account.userId;
    const localMarker=ACCOUNT_CLEAN_START_PREFIX+userId;
    try{
      if(localStorage.getItem(localMarker)==="complete")return {applied:false,localComplete:true};
    }catch(e){}
    if(accountCleanStartPromise&&accountCleanStartUserId===userId&&accountCleanStartGeneration===account.generation)return accountCleanStartPromise;

    accountCleanStartUserId=userId;
    accountCleanStartGeneration=account.generation;
    const task=(async()=>{
      if(typeof client.rpc!=="function")throw new Error("Account clean-start RPC is unavailable. Run SUPABASE_SCHEMA_CURRENT.sql once.");
      const result=await client.rpc("tn_apply_account_isolation_reset_v2");
      if(result.error){
        const missing=/function|schema cache|not found|404/i.test(result.error.message||"");
        if(missing)throw new Error("TangoNest database setup is out of date. Run SUPABASE_SCHEMA_CURRENT.sql once, then log in again.");
        throw result.error;
      }
      assertActiveRequest(userId,account.generation);

      clearUserCache({discardPendingUserId:userId,purgeScopedUserId:userId});
      try{localStorage.setItem(localMarker,"complete");}catch(e){}
      resetDefaultPlaylistGuard();
      adoptDb(emptyData("account-isolation-reset-v2"));
      writeCache(getDb());
      renderAll();
      return result.data||{applied:false};
    })();
    accountCleanStartPromise=task;
    try{return await task;}
    finally{
      if(accountCleanStartPromise===task){
        accountCleanStartPromise=null;
        accountCleanStartUserId="";
        accountCleanStartGeneration=-1;
      }
    }
  }

  function adoptAccountCache(userId,reason){
    window.tnSetActiveUserScope?.(userId);
    const scoped=readAccountCache(userId) || emptyData(reason || "account-cache-empty");
    scoped.meta=scoped.meta||{};
    scoped.meta.userId=userId;
    adoptDb(scoped);
    writeCache(scoped);
    renderAll();
  }

  function readPending(){
    return readPendingFor(currentUser?.id||"");
  }

  function writePending(items){
    const currentItems = Array.isArray(items) ? items.filter(item => item && item.userId === currentUser?.id) : [];
    storePendingFor(currentUser?.id||"",currentItems);
    updateCloudUi(lastSyncState);
  }

  function queueWordMutation(word,account={userId:currentUser?.id,generation:authGeneration}){
    if(!word?.id||!activeRequest(account.userId,account.generation))return;
    const timestamp=nowIso();
    const snapshot={...JSON.parse(JSON.stringify(word)),updatedAt:timestamp,contentUpdatedAt:timestamp};
    const items = readPending().filter(item => item.id !== word.id);
    items.push({
      type:"word_upsert",
      id:word.id,
      userId:account.userId,
      word:snapshot,
      attempts:0,
      createdAt:nowIso(),
      updatedAt:nowIso()
    });
    writePending(items);
  }

  function isRetryableSyncError(error){
    const raw=String(error?.message || error || "").toLowerCase();
    if(/permission denied|row-level security|schema cache|does not exist|invalid input|foreign key|not authenticated|jwt/.test(raw))return false;
    return navigator.onLine === false || /failed to fetch|network|offline|timeout|cloud unavailable|load failed|mock .*failed/.test(raw);
  }

  function adoptLocalWord(word){
    const data=getDb();
    const index=(data.words || []).findIndex(item => item.id === word.id);
    if(index >= 0)data.words[index]={...data.words[index],...word};
    else data.words.push(word);
    writeCache(data);
    renderAll();
  }

  function queueLearningMutation(event,account={userId:currentUser?.id,generation:authGeneration}){
    if(!event?.eventId||!event?.wordId||!activeRequest(account.userId,account.generation))return;
    const items = readPending();
    if(items.some(item => item.type === "learning_event" && item.event?.eventId === event.eventId))return;
    items.push({
      type:"learning_event",
      id:event.eventId,
      userId:account.userId,
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
    const serverWord=toLocalWord(row);
    data.words=data.words.map(word => word.id === serverWord.id ? {...word,...serverWord} : word);
    writeCache(data);
    try{ if(typeof window.renderHome === "function")window.renderHome(); }catch(e){}
    try{ if(typeof window.tnLibraryRender === "function")window.tnLibraryRender(); }catch(e){}
  }

  async function sendLearningMutation(event,account=null){
    account=account||await requireAccountContext();
    assertActiveRequest(account.userId,account.generation);
    const result=await client.rpc("tn_record_learning_result",{
      p_word_id:event.wordId,
      p_rating:event.rating,
      p_mode:event.mode || "study",
      p_event_id:event.eventId,
      p_answered_at:event.answeredAt || nowIso(),
      p_local_date:event.localDate || today()
    });
    if(result.error)throw result.error;
    assertActiveRequest(account.userId,account.generation);
    return result.data;
  }

  async function flushPendingMutations(){
    if(flushingPending || !currentUser)return;
    const pendingUserId=currentUser.id;
    const pendingGeneration=authGeneration;
    let items = readPending();
    if(!items.length)return;
    flushingPending = true;
    updateCloudUi("Syncing");
    const remaining = [];
    const learningRows = new Map();
    try{
      for(const item of items){
        if(!activeRequest(pendingUserId,pendingGeneration))return;
        try{
          if(item.type === "learning_event" && item.event?.eventId){
            const saved=await sendLearningMutation(item.event,{userId:pendingUserId,generation:pendingGeneration});
            if(saved?.word?.id)learningRows.set(saved.word.id,saved.word);
          }else if(item.type === "word_upsert" && item.word?.id){
            await upsertWordRemote(item.word,{userId:pendingUserId,generation:pendingGeneration});
          }
          assertActiveRequest(pendingUserId,pendingGeneration);
        }catch(error){
          if(error?.staleAccountRequest)return;
          item.attempts = Number(item.attempts || 0) + 1;
          item.updatedAt = nowIso();
          item.lastError = error.message || String(error);
          remaining.push(item);
        }
      }
      if(!activeRequest(pendingUserId,pendingGeneration))return;
      writePending(remaining);
      learningRows.forEach((row,wordId) => {
        const stillPending=remaining.some(item => item.type === "learning_event" && item.event?.wordId === wordId);
        if(!stillPending)adoptLearningRow(row);
      });
      lastSyncAt = new Date().toLocaleString();
      lastCloudFetchOk=false;
      if(activeRequest(pendingUserId,pendingGeneration))updateCloudUi(remaining.length ? "Error" : "Syncing");
    }finally{
      flushingPending = false;
    }
  }

  function emptyData(reason){
    try{if(typeof window.tnEmptyData === "function")return window.tnEmptyData(reason);}catch(e){}
    const at = nowIso();
    return {
      schemaVersion:1,
      dataVersion:"1.0.0",
      ui:"en",
      prefs:{frontLang:"en-US",backLang:"ja-JP"},
      lists:[{id:LOCAL_DEFAULT_PLAYLIST_ID,name:DEFAULT_PLAYLIST_NAME,isDefault:true,createdAt:at,updatedAt:at}],
      words:[],
      mistakes:[],
      meta:{updatedAt:at,sourceOfTruth:"supabase",localStorageRole:"cache-backup",reason:reason || "auth-empty",userId:currentUser?.id||""}
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
    if(/user_already_exists|already registered|already exists/.test(normalized))return "An account already exists for this email. Use Login instead.";
    if(/email not confirmed/.test(normalized))return "Confirm your email, then try logging in again.";
    if(/invalid email|validate email/.test(normalized))return "Enter a valid email address.";
    if(/weak_password|password.*(?:weak|short)|at least .*characters/.test(normalized))return "Use a password with at least 6 characters.";
    if(/rate limit|too many requests|over_email_send_rate_limit/.test(normalized))return "Too many attempts. Wait a few minutes, then try again.";
    if(/jwt|refresh token|session.*expired|not authenticated/.test(normalized))return "Your session has expired. Please log in again.";
    if(/failed to fetch|network|offline|cloud unavailable|load failed/.test(normalized))return fallback;
    return fallback;
  }

  function dataErrorMessage(error){
    const raw=String(error?.message || error || "").toLowerCase();
    if(/permission denied|does not exist|schema cache|pgrst|column .* not found/.test(raw)){
      return "You are signed in, but cloud vocabulary is unavailable because the database setup is incomplete.";
    }
    if(/failed to fetch|network|offline|load failed|timeout/.test(raw)){
      return "You are signed in. Cloud vocabulary is temporarily unavailable, and your local data remains safe.";
    }
    return "You are signed in, but cloud vocabulary could not be loaded. Try Sync now again later.";
  }

  function authMessage(message,type="info"){
    const box = $("authMessage");
    if(box){
      box.textContent = message;
      box.className = "auth-message " + type;
    }
  }

  function setBusy(value,action="login"){
    authInFlight = !!value;
    ["loginButton","signupButton","forgotPasswordButton","updatePasswordButton"].forEach(id => {
      const button = $(id);
      if(button)button.disabled = !!value;
    });
    const loginButton=$("loginButton");
    const signupButton=$("signupButton");
    const updateButton=$("updatePasswordButton");
    if(loginButton)loginButton.textContent=value&&action==="login" ? "Logging in..." : "Login";
    if(signupButton)signupButton.textContent=value&&action==="signup" ? "Creating..." : "Create account";
    if(updateButton)updateButton.textContent=value&&action==="recovery" ? "Updating..." : "Update password";
  }

  function setPasswordRecoveryMode(value){
    passwordRecoveryMode=!!value;
    const loginButton=$("loginButton");
    const signupButton=$("signupButton");
    const forgotButton=$("forgotPasswordButton");
    const updateButton=$("updatePasswordButton");
    if(loginButton)loginButton.hidden=passwordRecoveryMode;
    if(signupButton)signupButton.hidden=passwordRecoveryMode;
    if(forgotButton)forgotButton.hidden=passwordRecoveryMode;
    if(updateButton)updateButton.hidden=!passwordRecoveryMode;
    const password=$("authPassword");
    if(password){
      password.value="";
      password.autocomplete=passwordRecoveryMode ? "new-password" : "current-password";
      password.placeholder=passwordRecoveryMode ? "New password" : "At least 6 characters";
    }
  }

  function showAuth(message){
    setStartupState("UNAUTHENTICATED");
    lastCloudFetchOk=false;
    document.documentElement.classList.remove("auth-ready","tn-authenticated","tn-auth-loading");
    document.documentElement.classList.add("tn-logged-out","tn-needs-auth");
    document.body?.classList.add("tn-auth-open");
    document.body?.classList.remove("tn-logged-in");
    const app=document.querySelector?.(".app");
    if(app){
      app.inert=true;
      app.setAttribute("inert","");
      app.setAttribute("aria-hidden","true");
    }
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

  function unlockAppShell(){
    const app=document.querySelector?.(".app");
    if(!app)return;
    app.inert=false;
    app.removeAttribute("inert");
    app.removeAttribute("aria-hidden");
  }

  function showApp(){
    document.documentElement.classList.add("auth-ready","tn-authenticated");
    document.documentElement.classList.remove("tn-logged-out","tn-needs-auth","tn-auth-loading");
    document.body?.classList.add("tn-logged-in");
    document.body?.classList.remove("tn-auth-open");
    unlockAppShell();
    const auth = $("authScreen");
    if(auth){
      auth.style.setProperty("display","none","important");
      auth.style.setProperty("pointer-events","none","important");
    }
    const defer=typeof queueMicrotask==="function" ? queueMicrotask : callback=>Promise.resolve().then(callback);
    defer(() => {
      if(document.documentElement.classList.contains("tn-authenticated"))unlockAppShell();
    });
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
    const synced = !!currentUser && lastCloudFetchOk && !pendingCount && lastSyncState === "Synced";
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
      name:row.name || "Untitled Playlist",
      isDefault:!!row.is_default,
      systemKey:row.is_default ? "default-my-words" : "",
      createdAt:row.created_at || nowIso(),
      updatedAt:row.updated_at || row.created_at || nowIso(),
      contentUpdatedAt:row.content_updated_at || row.updated_at || row.created_at || nowIso()
    };
  }

  function timestamp(value){
    const parsed=Date.parse(value||"");
    return Number.isFinite(parsed)?parsed:null;
  }

  function isLegacyDefaultRepairPair(row,canonical){
    if(!row||!canonical||row.id===canonical.id)return false;
    if(!LEGACY_EMPTY_PLAYLIST_NAMES.has(safeText(row.name).toLowerCase()))return false;
    const created=timestamp(row.created_at);
    const updated=timestamp(row.updated_at);
    const name=safeText(row.name).toLowerCase();
    if(name!=="chinese"&&created!==null&&updated!==null&&Math.abs(updated-created)<=5000)return true;
    if(updated===null)return false;
    return [timestamp(canonical.created_at),timestamp(canonical.updated_at)]
      .some(value=>value!==null&&Math.abs(updated-value)<=5000);
  }

  async function repairLegacyDefaultRows(playlistRows,wordRows,userId){
    if(!Array.isArray(playlistRows)||!Array.isArray(wordRows)||!userId)return playlistRows;
    const canonical=playlistRows.find(row=>row.is_default&&safeText(row.name).toLowerCase()===DEFAULT_PLAYLIST_NAME.toLowerCase())
      ||playlistRows.find(row=>safeText(row.name).toLowerCase()===DEFAULT_PLAYLIST_NAME.toLowerCase());
    if(!canonical)return playlistRows;
    const usedPlaylistIds=new Set(wordRows.map(row=>safeText(row.playlist_id)).filter(Boolean));
    const candidates=playlistRows.filter(row=>!usedPlaylistIds.has(safeText(row.id))&&isLegacyDefaultRepairPair(row,canonical));
    if(!candidates.length)return playlistRows;
    const removedIds=new Set();
    for(const candidate of candidates){
      const result=await client.from("tn_playlists")
        .delete()
        .eq("id",candidate.id)
        .eq("user_id",userId);
      if(result.error)throw result.error;
      removedIds.add(candidate.id);
    }
    return playlistRows.filter(row=>!removedIds.has(row.id));
  }

  function toLocalWord(row){
    return {
      id:row.id,
      listId:row.playlist_id || "",
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

  function wordRowFromLocal(word,playlistId,userId=currentUser?.id){
    if(!userId)throw new Error("Please login first.");
    return {
      user_id:userId,
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
      content_updated_at:word.contentUpdatedAt || word.updatedAt || nowIso(),
      updated_at:word.updatedAt || nowIso()
    };
  }

  function wordNonLearningRowFromLocal(word,playlistId,userId=currentUser?.id){
    const row=wordRowFromLocal(word,playlistId,userId);
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

  async function requireAccountContext(){
    const user=await requireUser();
    const account={userId:user.id,generation:authGeneration};
    assertActiveRequest(account.userId,account.generation);
    return account;
  }

  async function ensureDefaultPlaylist(){
    const account=await requireAccountContext();
    const userId=account.userId;
    if(defaultPlaylistPromise&&defaultPlaylistUserId===userId)return defaultPlaylistPromise;
    defaultPlaylistUserId=userId;
    const task=(async()=>{
      if(typeof client.rpc==="function"){
        const rpcResult=await client.rpc("tn_ensure_default_playlist");
        assertActiveRequest(userId,account.generation);
        if(!rpcResult.error){
          defaultPlaylistVerifiedUserId=userId;
          return rpcResult.data || null;
        }
        if(!/function|schema cache|not found|404/i.test(rpcResult.error.message||""))throw rpcResult.error;
      }

      const existing=await client.from("tn_playlists")
        .select("*")
        .eq("user_id",userId)
        .order("created_at",{ascending:true});
      assertActiveRequest(userId,account.generation);
      if(existing.error)throw existing.error;
      const namedRows=(existing.data||[]).filter(row=>safeText(row.name).toLowerCase()===DEFAULT_PLAYLIST_NAME.toLowerCase());
      const named=namedRows.find(row=>row.is_default)||namedRows[0]||null;
      for(const duplicate of namedRows){
        if(!named||duplicate.id===named.id)continue;
        const moved=await client.from("tn_words")
          .update({playlist_id:named.id,content_updated_at:nowIso(),updated_at:nowIso()})
          .eq("playlist_id",duplicate.id)
          .eq("user_id",userId);
        assertActiveRequest(userId,account.generation);
        if(moved.error)throw moved.error;
        const removed=await client.from("tn_playlists")
          .delete()
          .eq("id",duplicate.id)
          .eq("user_id",userId);
        assertActiveRequest(userId,account.generation);
        if(removed.error)throw removed.error;
      }
      for(const row of existing.data||[]){
        if(!row.is_default||row.id===named?.id)continue;
        const demoted=await client.from("tn_playlists")
          .update({is_default:false})
          .eq("id",row.id)
          .eq("user_id",userId);
        assertActiveRequest(userId,account.generation);
        if(demoted.error)throw demoted.error;
      }
      if(named){
        const promoted=await client.from("tn_playlists")
          .update({name:DEFAULT_PLAYLIST_NAME,is_default:true})
          .eq("id",named.id)
          .eq("user_id",userId)
          .select("*")
          .single();
        assertActiveRequest(userId,account.generation);
        if(!promoted.error){
          defaultPlaylistVerifiedUserId=userId;
          return promoted.data;
        }
      }

      const inserted=await client.from("tn_playlists")
        .insert({user_id:userId,name:DEFAULT_PLAYLIST_NAME,is_default:true})
        .select("*")
        .single();
      assertActiveRequest(userId,account.generation);
      if(!inserted.error){
        defaultPlaylistVerifiedUserId=userId;
        return inserted.data;
      }

      const afterRace=await client.from("tn_playlists")
        .select("*")
        .eq("user_id",userId)
        .order("created_at",{ascending:true});
      assertActiveRequest(userId,account.generation);
      if(afterRace.error)throw inserted.error;
      const winner=(afterRace.data||[]).find(row=>row.is_default)||null;
      if(winner){
        defaultPlaylistVerifiedUserId=userId;
        return winner;
      }
      throw inserted.error;
    })();
    defaultPlaylistPromise=task;
    try{return await task;}
    finally{
      if(defaultPlaylistPromise===task){
        defaultPlaylistPromise=null;
        defaultPlaylistUserId="";
      }
    }
  }

  async function fetchAllAccountRows(table,userId,orders,generation){
    const rows=[];
    for(let offset=0,page=0;page<10000;page++,offset+=CLOUD_PAGE_SIZE){
      let query=client.from(table).select("*").eq("user_id",userId);
      (orders||[]).forEach(order=>{
        query=query.order(order.column,{ascending:order.ascending!==false});
      });
      const supportsRange=typeof query.range==="function";
      if(supportsRange)query=query.range(offset,offset+CLOUD_PAGE_SIZE-1);
      const result=await query;
      assertActiveRequest(userId,generation);
      if(result.error)return {data:null,error:result.error};
      const pageRows=Array.isArray(result.data)?result.data:[];
      if(offset===0&&(!supportsRange||pageRows.length<CLOUD_PAGE_SIZE))return {data:pageRows,error:null};
      rows.push(...pageRows);
      if(pageRows.length<CLOUD_PAGE_SIZE)return {data:rows,error:null};
    }
    return {data:null,error:new Error(`Cloud pagination did not finish for ${table}.`)};
  }

  async function loadCloud(options={}){
    const requestedUserId=currentUser?.id || "";
    if(activeCloudLoad){
      if(activeCloudLoadUserId===requestedUserId)return activeCloudLoad;
    }
    activeCloudLoadUserId=requestedUserId;
    const task=(async() => {
      const user=await requireUser();
      const loadUserId=user.id;
      const loadGeneration=authGeneration;
      assertActiveRequest(loadUserId,loadGeneration);
      if(!options.skipPendingFlush && readPending().length){
        await flushPendingMutations();
        assertActiveRequest(loadUserId,loadGeneration);
        if(readPending().length){
          updateCloudUi("Pending");
          if(!options.silent)toast("Pending learning changes will retry before cloud reload.");
          return getDb();
        }
      }
      loading = true;
      lastCloudFetchOk = false;
      setStartupState("SYNCING");
      updateCloudUi("Loading");
      const errors=[];
      try{
        const currentDb=getDb();
        const previous=currentDb?.meta?.userId===loadUserId?currentDb:emptyData("load-owner-boundary");
        previous.meta=previous.meta||{};
        previous.meta.userId=loadUserId;
        let playlistRows=null;
        let wordRows=null;

        const playlistsResult=await client.from("tn_playlists")
          .select("*")
          .eq("user_id",loadUserId)
          .order("created_at",{ascending:true});
        assertActiveRequest(loadUserId,loadGeneration);
        if(playlistsResult.error){
          errors.push({scope:"playlists",error:playlistsResult.error});
        }else{
          playlistRows=playlistsResult.data || [];
          const defaults=playlistRows.filter(row=>row.is_default);
          const defaultIsCanonical=defaults.length===1&&safeText(defaults[0].name)===DEFAULT_PLAYLIST_NAME;
          if(defaultPlaylistVerifiedUserId!==loadUserId||!defaultIsCanonical){
            try{
              await ensureDefaultPlaylist();
              const refreshed=await client.from("tn_playlists")
                .select("*")
                .eq("user_id",loadUserId)
                .order("created_at",{ascending:true});
              assertActiveRequest(loadUserId,loadGeneration);
              if(refreshed.error)throw refreshed.error;
              playlistRows=refreshed.data || [];
            }catch(error){
              errors.push({scope:"default-playlist",error});
            }
          }
        }

        const wordsResult=await fetchAllAccountRows("tn_words",loadUserId,[
          {column:"position",ascending:true},
          {column:"created_at",ascending:true},
          {column:"id",ascending:true}
        ],loadGeneration);
        assertActiveRequest(loadUserId,loadGeneration);
        if(wordsResult.error)errors.push({scope:"words",error:wordsResult.error});
        else wordRows=wordsResult.data || [];

        if(playlistRows!==null&&wordRows!==null){
          try{
            playlistRows=await repairLegacyDefaultRows(playlistRows,wordRows,loadUserId);
            assertActiveRequest(loadUserId,loadGeneration);
          }catch(error){
            errors.push({scope:"legacy-default-repair",error});
          }
        }

        assertActiveRequest(loadUserId,loadGeneration);
        const playlists=playlistRows===null ? (previous.lists || []) : playlistRows.map(toLocalPlaylist);
        const words=wordRows===null ? (previous.words || []) : wordRows.map(toLocalWord);
        const wordIds=new Set(words.map(word => word.id));
        const next=normalizeData({
          ...previous,
          prefs:{
            frontLang:safeLang(previous?.prefs?.frontLang,"en-US"),
            backLang:safeLang(previous?.prefs?.backLang,"ja-JP")
          },
          lists:playlists,
          words,
          mistakes:wordRows===null ? (previous.mistakes || []) : (previous.mistakes || []).filter(entry => wordIds.has(entry.wordId)),
          meta:{
            ...(previous.meta || {}),
            updatedAt:nowIso(),
            sourceOfTruth:errors.length ? "partial-cloud" : "supabase",
            lastCloudLoadAt:nowIso(),
            lastCloudError:errors.map(item => `${item.scope}: ${item.error?.message || item.error}`).join("; "),
            userId:loadUserId
          }
        });
        cloudCounts={
          words:wordRows===null ? null : wordRows.length,
          lists:playlistRows===null ? null : playlistRows.length,
          userId:loadUserId
        };
        const signature=data => JSON.stringify({
          prefs:data?.prefs || {},
          lists:data?.lists || [],
          words:data?.words || [],
          mistakes:data?.mistakes || [],
          userId:data?.meta?.userId || ""
        });
        const changed=signature(previous)!==signature(next);
        if(changed){
          adoptDb(next);
          writeCache(next);
          renderAll();
        }
        lastSyncAt=new Date().toLocaleString();
        if(errors.length){
          const detail=errors.map(item => `${item.scope}: ${item.error?.message || item.error}`).join("; ");
          const error=new Error(detail || "Cloud data load failed");
          error.name="TangoNestDataLoadError";
          error.isDataError=true;
          updateCloudUi("Error");
          setStartupState("SYNC_ERROR");
          console.warn("Cloud data load incomplete",error);
          if(!options.silent)toast(dataErrorMessage(error));
          if(!options.allowPartial)throw error;
          return changed ? next : previous;
        }
        lastCloudFetchOk=true;
        updateCloudUi("Synced");
        setStartupState("READY");
        if(!changed)renderAll();
        return changed ? next : previous;
      }catch(error){
        if(error?.staleAccountRequest)throw error;
        if(!error?.isDataError){
          cloudCounts={words:null,lists:null,userId:currentUser?.id || ""};
          updateCloudUi("Error");
          setStartupState("SYNC_ERROR");
          console.warn("Cloud load failed",error);
          if(!options.silent)toast(dataErrorMessage(error));
        }
        throw error;
      }finally{
        if(activeRequest(loadUserId,loadGeneration))loading=false;
      }
    })();
    activeCloudLoad=task;
    try{return await task;}
    finally{
      if(activeCloudLoad===task){
        activeCloudLoad=null;
        activeCloudLoadUserId="";
      }
    }
  }

  function scheduleLoad(reason){
    if(!currentUser)return;
    const scheduledUserId=currentUser.id;
    const scheduledGeneration=authGeneration;
    clearTimeout(loadTimer);
    loadTimer = setTimeout(() => {
      if(!activeRequest(scheduledUserId,scheduledGeneration))return;
      loadCloud({silent:true,reason}).catch(error => {
        if(!error?.staleAccountRequest)console.warn("Scheduled cloud load skipped",error);
      });
    },350);
  }

  function subscribeRealtime(){
    if(!client || !currentUser)return;
    if(realtimeChannel && realtimeUserId === currentUser.id)return;
    unsubscribeRealtime();
    const subscribedUserId=currentUser.id;
    const subscribedGeneration=authGeneration;
    realtimeUserId = subscribedUserId;
    realtimeStatus = "Connecting";
    updateCloudUi(lastSyncState);
    const acceptRealtime=payload=>{
      const payloadUserId=payload?.new?.user_id||payload?.old?.user_id||"";
      return activeRequest(subscribedUserId,subscribedGeneration)&&(!payloadUserId||payloadUserId===subscribedUserId);
    };
    realtimeChannel = client.channel("tangonest-learning-" + subscribedUserId)
      .on("postgres_changes",{event:"*",schema:"public",table:"tn_playlists",filter:"user_id=eq." + subscribedUserId},payload => {if(acceptRealtime(payload))scheduleLoad("playlist-realtime")})
      .on("postgres_changes",{event:"*",schema:"public",table:"tn_words",filter:"user_id=eq." + subscribedUserId},payload => {if(acceptRealtime(payload))scheduleLoad("word-realtime")})
      .subscribe(status => {
        if(!activeRequest(subscribedUserId,subscribedGeneration))return;
        realtimeStatus = status || "Unknown";
        if(status === "SUBSCRIBED")updateCloudUi(lastSyncState === "Error" ? "Error" : "Synced");
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

  function cancelAccountRuntime(){
    authGeneration++;
    clearTimeout(loadTimer);
    loadTimer=null;
    savingWordTimers.forEach(timer=>clearTimeout(timer));
    savingWordTimers.clear();
    unsubscribeRealtime();
    activeCloudLoad=null;
    activeCloudLoadUserId="";
    sessionLoadPromise=null;
    sessionLoadUserId="";
    accountCleanStartPromise=null;
    accountCleanStartUserId="";
    accountCleanStartGeneration=-1;
    flushingPending=false;
    loading=false;
    cloudCounts={words:null,lists:null,userId:""};
    lastCloudFetchOk=false;
    window.tnResetAccountUiState?.();
  }

  function showAccountLoading(message="Loading your TangoNest library..."){
    setStartupState("SYNCING");
    document.documentElement.classList.add("tn-auth-loading");
    const app=document.querySelector?.(".app");
    if(app){app.inert=true;app.setAttribute("inert","");app.setAttribute("aria-hidden","true")}
    const auth=$("authScreen");
    if(auth){auth.style.setProperty("display","flex","important");auth.style.setProperty("pointer-events","none","important")}
    authMessage(message,"info");
  }

  async function afterSession(session,mode){
    const incomingUser=session?.user||null;
    if(!incomingUser){
      completeSignedOut();
      return;
    }
    if(sessionLoadPromise&&sessionLoadUserId===incomingUser.id)return sessionLoadPromise;

    const previousUserId=currentUser?.id||"";
    cancelAccountRuntime();
    if(previousUserId&&previousUserId!==incomingUser.id){
      clearUserCache({discardPendingUserId:previousUserId,purgeScopedUserId:previousUserId});
    }
    currentSession=session;
    currentUser=incomingUser;
    const boundaryGeneration=authGeneration;
    window.tnSetActiveUserScope?.(incomingUser.id);
    cleanLegacyAuthKeys();
    resetDefaultPlaylistGuard();
    adoptAccountCache(incomingUser.id,previousUserId&&previousUserId!==incomingUser.id?"account-switch-empty":"session-restore-empty");
    window.tnResetAccountUiState?.();
    renderAll();
    showAccountLoading();
    setStartupState("AUTHENTICATED");

    sessionLoadUserId=incomingUser.id;
    const task=(async() => {
      let initializationError=null;
      try{
        await applyAccountCleanStartOnce();
        assertActiveRequest(incomingUser.id,boundaryGeneration);
        await loadCloud({silent:mode!=="login",force:true,allowPartial:false});
      }catch(error){
        if(error?.staleAccountRequest)return;
        initializationError=error;
        const empty=emptyData("account-load-failed-safe-empty");
        empty.meta.userId=incomingUser.id;
        adoptDb(empty);
        updateCloudUi("Error");
        renderAll();
        toast(dataErrorMessage(error));
      }finally{
        if(!activeRequest(incomingUser.id,boundaryGeneration))return;
        showApp();
        navigate(mode==="login"?"home":savedPage());
        if(mode==="login"){
          const focusHome=() => {
            const homeNav=window.matchMedia?.("(max-width: 900px)").matches ? $("mnavHome") : $("navHome");
            homeNav?.focus({preventScroll:true});
          };
          if(typeof requestAnimationFrame==="function")requestAnimationFrame(focusHome);
          else setTimeout(focusHome,0);
        }
        if(!initializationError)subscribeRealtime();
        initializedUserId=incomingUser.id;
        if(initializationError){
          setStartupState("SYNC_ERROR");
          authMessage("Signed in. Cloud vocabulary needs attention.","error");
        }
      }
    })();
    sessionLoadPromise=task;
    try{return await task;}
    finally{
      if(sessionLoadPromise===task){
        sessionLoadPromise=null;
        sessionLoadUserId="";
      }
    }
  }

  async function login(){
    if(authInFlight)return;
    const email = safeText($("authEmail")?.value).toLowerCase();
    const password = $("authPassword")?.value || "";
    if(!email || !password)return authMessage("Email and password are required.","error");
    setBusy(true,"login");
    authMessage("Logging in...");
    try{
      const authClient=getClient();
      if(!authClient)throw new Error("Authentication service is unavailable.");
      const result = await authClient.auth.signInWithPassword({email,password});
      if(result.error)throw result.error;
      if(!result.data?.session?.user)throw new Error("Login completed without a valid session.");
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
    if(authInFlight)return;
    const email = safeText($("authEmail")?.value).toLowerCase();
    const password = $("authPassword")?.value || "";
    if(!email || !password)return authMessage("Email and password are required.","error");
    if(password.length < 6)return authMessage("Password must be at least 6 characters.","error");
    setBusy(true,"signup");
    authMessage("Creating account...");
    try{
      const authClient=getClient();
      if(!authClient)throw new Error("Authentication service is unavailable.");
      const result = await authClient.auth.signUp({email,password});
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

  async function forgotPassword(){
    if(authInFlight)return;
    const email=safeText($("authEmail")?.value).toLowerCase();
    if(!email)return authMessage("Enter your email address first.","error");
    setBusy(true,"reset");
    authMessage("Sending password reset email...");
    try{
      const authClient=getClient();
      if(!authClient)throw new Error("Authentication service is unavailable.");
      const redirectTo=new URL(".",window.location.href).href;
      const result=await authClient.auth.resetPasswordForEmail(email,{redirectTo});
      if(result.error)throw result.error;
      authMessage("Password reset email sent. Check your inbox.","success");
    }catch(error){
      authMessage(userError(error,"Couldn't send the reset email. Check your connection and try again."),"error");
    }finally{
      setBusy(false);
    }
  }

  async function updateRecoveredPassword(){
    if(authInFlight)return;
    const password=$("authPassword")?.value || "";
    if(password.length<6)return authMessage("Password must be at least 6 characters.","error");
    setBusy(true,"recovery");
    authMessage("Updating password...");
    try{
      const authClient=getClient();
      if(!authClient)throw new Error("Authentication service is unavailable.");
      const result=await authClient.auth.updateUser({password});
      if(result.error)throw result.error;
      setPasswordRecoveryMode(false);
      authMessage("Password updated. You are logged in.","success");
      if(currentSession?.user)await afterSession(currentSession,"login");
    }catch(error){
      authMessage(userError(error,"Couldn't update the password. Request a new reset email and try again."),"error");
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
    completeSignedOut("Signed out.",signingOutUserId);
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
      const account=await requireAccountContext();
      const input = $("newList");
      name = safeText(name || input?.value);
      if(!name)return toast("Playlist name is required");
      if(name.toLowerCase()===DEFAULT_PLAYLIST_NAME.toLowerCase())return toast("My Words already exists and is reserved as the default playlist.");
      const result = await client.from("tn_playlists")
        .insert({user_id:account.userId,name})
        .select("*")
        .single();
      if(result.error)throw result.error;
      assertActiveRequest(account.userId,account.generation);
      if(input)input.value = "";
      await loadCloud({force:true,silent:true});
      toast("Playlist created");
    }catch(error){
      if(error?.staleAccountRequest)return;
      toast(userError(error,"Couldn't create the playlist. Please try again."));
    }
  }

  async function renamePlaylist(id,name){
    if(LOCAL_QA_MODE){
      const data=getDb();
      id = id || $("renameListSelect")?.value;
      name = safeText(name || $("renameListInput")?.value);
      if(!id || !name)return toast("Playlist name is required");
      if(name.toLowerCase()===DEFAULT_PLAYLIST_NAME.toLowerCase())return toast("My Words is reserved as the default playlist.");
      const list=data.lists?.find(item=>item.id===id);
      if(!list)return toast("Playlist not found");
      if(list.isDefault)return toast("My Words is the default playlist and cannot be renamed.");
      list.name=name;
      list.updatedAt=nowIso();
      window.tnWriteData?.(data);
      if($("renameListInput"))$("renameListInput").value="";
      renderAll();
      toast("Playlist renamed");
      return;
    }
    try{
      const account=await requireAccountContext();
      id = id || $("renameListSelect")?.value;
      name = safeText(name || $("renameListInput")?.value);
      if(!id || !name)return toast("Playlist name is required");
      if(name.toLowerCase()===DEFAULT_PLAYLIST_NAME.toLowerCase())return toast("My Words is reserved as the default playlist.");
      if(getDb().lists?.find(item=>item.id===id)?.isDefault)return toast("My Words is the default playlist and cannot be renamed.");
      const result = await client.from("tn_playlists")
        .update({name,updated_at:nowIso()})
        .eq("id",id)
        .eq("user_id",account.userId)
        .select("*")
        .single();
      if(result.error)throw result.error;
      assertActiveRequest(account.userId,account.generation);
      if($("renameListInput"))$("renameListInput").value = "";
      await loadCloud({force:true,silent:true});
      toast("Playlist renamed");
    }catch(error){
      if(error?.staleAccountRequest)return;
      toast(userError(error,"Couldn't rename the playlist. Please try again."));
    }
  }

  async function deletePlaylist(id,options={}){
    try{
      const account=await requireAccountContext();
      id = id || "";
      if(!id)return;
      const db = getDb();
      const list = db.lists.find(item => item.id === id);
      if(!list)return toast("Playlist not found");
      if(list.isDefault)return toast("My Words is the default playlist and cannot be deleted.");
      if(!options.confirmed&&!confirm(`Delete "${list.name}"? Its words will remain in All Words as unfiled words.`))return;
      if(typeof client.rpc === "function"){
        const rpcResult = await client.rpc("tn_delete_playlist",{p_playlist_id:id});
        assertActiveRequest(account.userId,account.generation);
        if(!rpcResult.error){
          await loadCloud({force:true,silent:true});
          toast("Playlist deleted");
          return;
        }
        if(!/function|schema cache|not found|404/i.test(rpcResult.error.message || ""))throw rpcResult.error;
      }
      const fallbackResult = await deletePlaylistFallback(id,db,account);
      if(fallbackResult.error)throw fallbackResult.error;
      await loadCloud({force:true,silent:true});
      toast("Playlist deleted");
    }catch(error){
      if(error?.staleAccountRequest)return;
      toast(userError(error,"Couldn't delete the playlist. Please try again."));
    }
  }

  async function deletePlaylistFallback(id,db,account){
    assertActiveRequest(account.userId,account.generation);
    const affectedIds=(db.words || []).filter(word => word.listId === id).map(word => word.id);
    const move = await client.from("tn_words")
      .update({playlist_id:null,content_updated_at:nowIso(),updated_at:nowIso()})
      .eq("playlist_id",id)
      .eq("user_id",account.userId);
    if(move.error)return {error:move.error};
    assertActiveRequest(account.userId,account.generation);
    const result = await client.from("tn_playlists")
      .delete()
      .eq("id",id)
      .eq("user_id",account.userId);
    if(result.error){
      try{
        if(affectedIds.length){
          await client.from("tn_words")
            .update({playlist_id:id,content_updated_at:nowIso(),updated_at:nowIso()})
            .in("id",affectedIds)
            .eq("user_id",account.userId);
        }
      }catch(rollbackError){
        console.warn("Playlist delete rollback failed",rollbackError);
      }
      return {error:result.error};
    }
    return {unfiled:true};
  }

  function selectedPlaylistId(id){
    const el = $(id);
    return el?.value || "";
  }

  function rememberPlaylist(id){
    if(!id)return;
    const key=accountStorageKey(currentUser?.id||"","recent-playlist");
    if(key)try{ localStorage.setItem(key,id); }catch(e){}
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
      const account=await requireAccountContext();
      const playlist = selectedPlaylistId("addList");
      rememberPlaylist(playlist);
      const front = safeText($("front")?.value);
      const back = safeText($("back")?.value);
      if(!front || !back)return toast("Front and Back are required");
      const position = getDb().words.filter(word => word.listId === playlist).length;
      const at=nowIso();
      const row = {
        id:newId(),
        user_id:account.userId,
        playlist_id:playlist || null,
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
        position,
        created_at:at,
        updated_at:at,
        content_updated_at:at
      };
      const result = await client.from("tn_words").insert(row).select("*").single();
      assertActiveRequest(account.userId,account.generation);
      if(result.error){
        if(!isRetryableSyncError(result.error))throw result.error;
        const localWord=toLocalWord(row);
        adoptLocalWord(localWord);
        queueWordMutation(localWord,account);
        clearForm();
        toast("Word saved offline. It will sync automatically.");
        focusFrontSoon();
        return false;
      }
      clearForm();
      await loadCloud({force:true,silent:true});
      toast("1 word added");
      focusFrontSoon();
      return false;
    }catch(error){
      if(error?.staleAccountRequest)return false;
      toast(userError(error,"Couldn't add the word. Please try again."));
      return false;
    }
  }

  async function updateWordRemote(id,patch,account=null){
    account=account||await requireAccountContext();
    assertActiveRequest(account.userId,account.generation);
    const contentUpdatedAt=patch.content_updated_at || nowIso();
    const result = await client.from("tn_words")
      .update({...patch,content_updated_at:contentUpdatedAt,updated_at:patch.updated_at || nowIso()})
      .eq("id",id)
      .eq("user_id",account.userId)
      .select("*")
      .single();
    if(result.error)throw result.error;
    assertActiveRequest(account.userId,account.generation);
    return result.data;
  }

  async function upsertWordRemote(word,account=null){
    account=account||await requireAccountContext();
    if(!word?.id)throw new Error("Word not found.");
    assertActiveRequest(account.userId,account.generation);
    const row={id:word.id,...wordNonLearningRowFromLocal(word,word.listId,account.userId)};
    if(typeof client.rpc === "function"){
      const rpcResult=await client.rpc("tn_upsert_word_nonlearning",{p_word:row});
      if(!rpcResult.error){
        assertActiveRequest(account.userId,account.generation);
        return rpcResult.data;
      }
      if(!/function|schema cache|not found|404/i.test(rpcResult.error.message || ""))throw rpcResult.error;
    }
    const result=await client.from("tn_words").upsert(row,{onConflict:"id"}).select("*").single();
    if(result.error)throw result.error;
    assertActiveRequest(account.userId,account.generation);
    return {applied:true,word:result.data};
  }

  async function saveEdit(){
    let localUpdate=null;
    let account=null;
    try{
      account=await requireAccountContext();
      const id = $("editId")?.value;
      if(!id)return;
      const front = safeText($("editFront")?.value);
      const back = safeText($("editBack")?.value);
      if(!front || !back)return toast("Front and Back are required");
      const patch={
        front,
        back,
        front_lang:safeLang($("editFrontLang")?.value,"en-US"),
        back_lang:safeLang($("editBackLang")?.value,"ja-JP"),
        playlist_id:$("editList")?.value || null,
        pos:safeText($("editPOS")?.value) || null,
        gender:safeText($("editGender")?.value) || null,
        tags:safeText($("editTags")?.value) || null,
        memo:safeText($("editMemo")?.value) || null
      };
      const existing=getDb().words.find(item => item.id === id);
      localUpdate=existing ? {
        ...existing,
        front,back,
        frontLang:patch.front_lang,
        backLang:patch.back_lang,
        listId:patch.playlist_id || "",
        pos:patch.pos || "",
        gender:patch.gender || "",
        tags:patch.tags || "",
        memo:patch.memo || "",
        updatedAt:nowIso(),
        contentUpdatedAt:nowIso()
      } : null;
      const saved=await upsertWordRemote(localUpdate,account);
      if(typeof window.closeEdit === "function")window.closeEdit();
      await loadCloud({force:true,silent:true});
      toast(saved?.applied === false ? "A newer cloud edit was kept." : "Word updated");
    }catch(error){
      if(error?.staleAccountRequest)return;
      if(localUpdate && isRetryableSyncError(error)){
        adoptLocalWord(localUpdate);
        queueWordMutation(localUpdate,account);
        if(typeof window.closeEdit === "function")window.closeEdit();
        toast("Edit saved offline. It will sync automatically.");
        return;
      }
      toast(userError(error,"Couldn't save the word. Please try again."));
    }
  }

  async function removeWord(id){
    try{
      const account=await requireAccountContext();
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
        .eq("user_id",account.userId);
      if(result.error)throw result.error;
      assertActiveRequest(account.userId,account.generation);
      await loadCloud({force:true,silent:true});
      toast("Word deleted");
    }catch(error){
      if(error?.staleAccountRequest)return;
      toast(userError(error,"Couldn't delete the word. Please try again."));
    }
  }

  async function toggleFavoriteRemote(id){
    try{
      const account=await requireAccountContext();
      const word = getDb().words.find(item => item.id === id);
      if(!word)return toast("Word not found");
      const timestamp=nowIso();
      const next={...word,saved:!word.saved,updatedAt:timestamp,contentUpdatedAt:timestamp};
      try{
        const saved=await upsertWordRemote(next,account);
        if(saved?.applied === false){
          await loadCloud({force:true,silent:true});
          toast("A newer cloud change was kept.");
          return;
        }
      }catch(error){
        if(!isRetryableSyncError(error))throw error;
        assertActiveRequest(account.userId,account.generation);
        adoptLocalWord(next);
        queueWordMutation(next,account);
        toast("Saved offline. It will sync automatically.");
        return;
      }
      await loadCloud({force:true,silent:true});
      toast(word.saved ? "Removed from saved" : "Saved");
    }catch(error){
      if(error?.staleAccountRequest)return;
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
      const account=await requireAccountContext();
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
        .eq("user_id",account.userId)
        .in("id",ids);
      if(result.error)throw result.error;
      assertActiveRequest(account.userId,account.generation);
      await loadCloud({force:true,silent:true});
      toast("Selected words deleted");
    }catch(error){
      if(error?.staleAccountRequest)return;
      toast(userError(error,"Couldn't delete the selected words. Please try again."));
    }
  }

  async function bulkImport(mode){
    try{
      const account=await requireAccountContext();
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
      const playlist = selectedPlaylistId("bulkList");
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
              playlist_id:playlist || null,
              pos:safeText(row.pos) || null,
              gender:safeText(row.gender) || null,
              memo:safeText(row.memo) || null
            },account);
          }else{
            await client.from("tn_words").insert(wordRowFromLocal({
              front:row.front,back:row.back,frontLang,backLang,listId:playlist,
              memo:row.memo,pos:row.pos,gender:row.gender,tags:"",status:"new",level:1,nextReview:today()
            },playlist,account.userId));
            assertActiveRequest(account.userId,account.generation);
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
        },playlist,account.userId));
        let insertedCount=0;
        clearTimeout(loadTimer);
        loadTimer=null;
        for(let start=0;start<payload.length;start+=BULK_INSERT_SIZE){
          const chunk=payload.slice(start,start+BULK_INSERT_SIZE);
          const result=await client.from("tn_words").insert(chunk).select("id");
          if(result.error){
            throw new Error(`Bulk Add stopped at row ${start+1}: ${result.error.message||result.error}`);
          }
          assertActiveRequest(account.userId,account.generation);
          if(Array.isArray(result.data)&&result.data.length!==chunk.length){
            throw new Error(`Bulk Add saved ${result.data.length} of ${chunk.length} rows in batch ${Math.floor(start/BULK_INSERT_SIZE)+1}.`);
          }
          insertedCount+=Array.isArray(result.data)?result.data.length:chunk.length;
        }
        if(insertedCount!==payload.length)throw new Error(`Bulk Add saved ${insertedCount} of ${payload.length} rows.`);
      }
      if($("bulkText"))$("bulkText").value = "";
      try{ if(typeof window.clearBulkPreview === "function")window.clearBulkPreview(); }catch(e){}
      clearTimeout(loadTimer);
      loadTimer=null;
      await loadCloud({force:true,silent:true});
      toast(`${rows.length} added`);
    }catch(error){
      if(error?.staleAccountRequest)return;
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
        name:String(list.name || "Untitled Playlist"),
        isDefault:!!list.isDefault,
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
        name:safeText(list.name) || "Imported Playlist",
        isDefault:!!list.isDefault
      }));
    const safeLists = lists;
    const listIds = new Set(safeLists.map(list => list.id));
    const words = incoming.words
      .filter(word => safeText(word?.front) && safeText(word?.back))
      .map((word,index) => ({
        listId:listIds.has(String(word.listId || "")) ? String(word.listId) : "",
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
      const account=await requireAccountContext();
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
      assertActiveRequest(account.userId,account.generation);
      await loadCloud({force:true,silent:true,skipPendingFlush:true});
      toast(`Imported ${result.data?.words ?? payload.words.length} words`);
    }catch(error){
      if(error?.staleAccountRequest)return;
      toast(userError(error,"Couldn't import this backup. Check the file and try again."));
    }
  }

  async function clearLocalCacheOnly(){
    if(currentUser && readPending().length){
      try{ await flushPendingMutations(); }catch(error){ console.warn(error); }
      if(readPending().length)return toast("Local cache cannot be cleared while learning changes are pending.");
    }
    if(!confirm("Clear only this browser cache? Cloud data will be loaded again after sync."))return;
    clearUserCache({purgeScopedUserId:currentUser?.id || ""});
    adoptDb(emptyData("clear-local-cache"));
    renderAll();
    if(currentUser){
      try{ await loadCloud({force:true,silent:true,skipPendingFlush:true}); }catch(e){ updateCloudUi("Error"); }
    }
    toast("Local cache cleared");
  }

  async function deleteAllAccountData(){
    try{
      const account=await requireAccountContext();
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
      assertActiveRequest(account.userId,account.generation);
      clearUserCache({discardPendingUserId:account.userId,purgeScopedUserId:account.userId});
      await loadCloud({force:true,silent:true,skipPendingFlush:true});
      toast("Account vocabulary data deleted");
    }catch(error){
      if(error?.staleAccountRequest)return;
      toast(userError(error,"Couldn't delete the account vocabulary. Please try again."));
    }
  }

  function syncWordFromCache(id,delay=300){
    if(!currentUser || !id)return;
    const account={userId:currentUser.id,generation:authGeneration};
    const snapshot = getDb().words.find(item => item.id === id);
    if(snapshot)queueWordMutation(snapshot,account);
    clearTimeout(savingWordTimers.get(id));
    savingWordTimers.set(id,setTimeout(async() => {
      try{
        assertActiveRequest(account.userId,account.generation);
        const word = getDb().words.find(item => item.id === id);
        if(!word)return;
        await updateWordRemote(id,wordNonLearningRowFromLocal(word,word.listId,account.userId),account);
        writePending(readPending().filter(item => !(item.type === "word_upsert" && item.id === id)));
        lastSyncAt = new Date().toLocaleString();
        lastCloudFetchOk=false;
        updateCloudUi("Syncing");
        scheduleLoad("word-save");
      }catch(error){
        if(error?.staleAccountRequest)return;
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
    const account={userId:currentUser.id,generation:authGeneration};
    queueLearningMutation({...event,localDate:event.localDate || today()},account);
    updateCloudUi("Pending");
    setTimeout(() => {
      if(!activeRequest(account.userId,account.generation))return;
      flushPendingMutations()
        .then(() => {
          if(activeRequest(account.userId,account.generation)&&!readPending().length)scheduleLoad("learning-save");
        })
        .catch(error => {
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
    const account={userId:currentUser.id,generation:authGeneration};
    setTimeout(async() => {
      try{
        assertActiveRequest(account.userId,account.generation);
        const word = getDb().words.find(item => item.id === changedWordId);
        if(!word)return;
        const words = getDb().words.filter(item => item.listId === word.listId);
        for(let index=0; index<words.length; index++){
          words[index].position = index;
          queueWordMutation(words[index],account);
          await client.from("tn_words").update({position:index,content_updated_at:nowIso(),updated_at:nowIso()}).eq("id",words[index].id).eq("user_id",account.userId);
          assertActiveRequest(account.userId,account.generation);
        }
        writePending(readPending().filter(item => !(item.type === "word_upsert" && words.some(word => word.id === item.id))));
        lastCloudFetchOk=false;
        updateCloudUi("Syncing");
        scheduleLoad("position-save");
      }catch(error){
        if(error?.staleAccountRequest)return;
        flushPendingMutations().catch(err => console.warn("Position retry failed",err));
        console.warn("Position sync failed",error);
      }
    },400);
  }

  function bindAuthUi(){
    const form=$("authForm");
    const loginBtn = $("loginButton");
    const createBtn = $("signupButton");
    const forgotBtn=$("forgotPasswordButton");
    const toggleBtn=$("togglePasswordButton");
    const updateBtn=$("updatePasswordButton");
    if(form && !form.__tnAuthSubmit){
      form.addEventListener("submit",event => { event.preventDefault(); login(); });
      form.__tnAuthSubmit=true;
    }
    if(loginBtn)loginBtn.onclick = event => { event.preventDefault(); return login(); };
    if(createBtn)createBtn.onclick = event => { event.preventDefault(); return signup(); };
    if(forgotBtn)forgotBtn.onclick=event => { event.preventDefault(); return forgotPassword(); };
    if(updateBtn)updateBtn.onclick=event => { event.preventDefault(); return updateRecoveredPassword(); };
    if(toggleBtn)toggleBtn.onclick=event => {
      event.preventDefault();
      const password=$("authPassword");
      if(!password)return;
      const visible=password.type==="text";
      password.type=visible ? "password" : "text";
      toggleBtn.textContent=visible ? "Show" : "Hide";
      toggleBtn.setAttribute("aria-pressed",visible ? "false" : "true");
      toggleBtn.setAttribute("aria-label",visible ? "Show password" : "Hide password");
      password.focus({preventScroll:true});
    };
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

  function completeSignedOut(message="Signed out.",explicitUserId=""){
    const signingOutUserId=explicitUserId||currentUser?.id||"";
    cancelAccountRuntime();
    clearUserCache({discardPendingUserId:signingOutUserId,purgeScopedUserId:signingOutUserId});
    currentSession=null;
    currentUser=null;
    window.tnSetActiveUserScope?.("");
    resetDefaultPlaylistGuard();
    initializedUserId="";
    cleanLegacyAuthKeys();
    adoptDb(emptyData("signed-out"));
    renderAll();
    setPasswordRecoveryMode(false);
    showAuth(message);
  }

  function bindAuthListener(){
    if(authUnsubscribe || !client?.auth?.onAuthStateChange)return;
    const subscription=client.auth.onAuthStateChange((event,session) => {
      clearTimeout(authEventTimer);
      authEventTimer=setTimeout(() => {
        if(event==="SIGNED_OUT"){
          completeSignedOut("Signed out.");
          return;
        }
        if(event==="PASSWORD_RECOVERY" && session?.user){
          currentSession=session;
          currentUser=session.user;
          showAuth("Enter a new password for your account.");
          setPasswordRecoveryMode(true);
          $("authPassword")?.focus({preventScroll:true});
          return;
        }
        if(!session?.user){
          if(!currentUser && event==="INITIAL_SESSION")showAuth("Login or create an account to sync your vocabulary.");
          return;
        }
        const sameUser=currentUser?.id===session.user.id;
        if(sameUser){
          currentSession=session;
          currentUser=session.user;
          updateCloudUi(lastSyncState);
          if(sessionLoadPromise)return;
          if(initializedUserId===session.user.id){
            showApp();
            return;
          }
        }
        afterSession(session,"restore").catch(error => console.warn("Auth state initialization failed",error));
      },0);
    });
    authUnsubscribe=subscription?.data?.subscription || subscription;
  }

  function installGlobals(){
    window.tnCloudClient = () => getClient();
    window.tnCloudLoad = () => loadCloud({force:true});
    window.tnEnsureDefaultPlaylist = ensureDefaultPlaylist;
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
    window.tnAuthDiagnostics = () => ({
      authenticated:!!currentSession?.user,
      userId:currentSession?.user?.id || "",
      initialized:initializedUserId===currentSession?.user?.id,
      dataState:lastSyncState,
      realtimeState:realtimeStatus,
      startupState,
      lastCloudFetchOk
    });
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
    setStartupState("BOOTING");
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
      setStartupState("READY");
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
    if(await requireFreshLoginForRelease()){
      bindAuthListener();
      return;
    }
    bindAuthListener();
    try{
      const result = await client.auth.getSession();
      if(result.error)throw result.error;
      if(result.data.session)await afterSession(result.data.session,"restore");
      else showAuth("Login or create an account to sync your vocabulary.");
    }catch(error){
      console.warn("Session restore failed",error);
      if(currentSession?.user){
        showApp();
        updateCloudUi("Error");
        toast("Your session is still active. Online sync will retry automatically.");
      }else{
        showAuth(userError(error,"Online login is temporarily unavailable. Check your connection and try again."));
      }
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
  window.addEventListener("pagehide",event => {
    clearTimeout(loadTimer);
    savingWordTimers.forEach(timer=>clearTimeout(timer));
    savingWordTimers.clear();
    unsubscribeRealtime();
    if(!event?.persisted){
      try{authUnsubscribe?.unsubscribe?.()}catch(e){}
      authUnsubscribe=null;
    }
  });
  window.addEventListener("pageshow",event => {
    if(!event?.persisted)return;
    bindAuthListener();
    getClient()?.auth?.getSession?.().then(result => {
      if(result?.data?.session)return afterSession(result.data.session,"restore");
      completeSignedOut("Login or create an account to sync your vocabulary.");
    }).catch(error => {
      console.warn("Session resume failed",error);
      if(currentSession?.user)showApp();
    });
  });

  if(document.readyState === "loading")document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();
