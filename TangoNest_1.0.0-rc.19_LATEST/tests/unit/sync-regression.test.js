const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");
const learningEngine = require("../../learning-engine.js");
const defaultPlaylist = require("../../default-playlist.js");

const appDir = path.resolve(__dirname, "../..");
const syncScript = fs.readFileSync(path.join(appDir, "tn-supabase-sync.js"), "utf8");

const DATA_KEY = "tangonest_production_stable_v1";
const SHADOW_KEY = "tangonest_last_good_data_v1";
const PENDING_KEY = "tangonest_pending_mutations_v1";
const ACCOUNT_STORAGE_PREFIX = "tangonest:account:v2:";
const ACCOUNT_CLEAN_START_PREFIX = "tangonest_account_isolation_reset_v2:";
const accountKey = (userId,kind) => `${ACCOUNT_STORAGE_PREFIX}${userId}:${kind}`;

function uuid(seed){
  const hex = String(seed).padStart(12, "0").slice(-12);
  return `00000000-0000-4000-8000-${hex}`;
}

function classList(){
  const values = new Set();
  return {
    add: (...items) => items.forEach(item => values.add(item)),
    remove: (...items) => items.forEach(item => values.delete(item)),
    contains: item => values.has(item),
    toggle: (item, force) => {
      const shouldAdd = force === undefined ? !values.has(item) : !!force;
      if(shouldAdd)values.add(item);
      else values.delete(item);
      return shouldAdd;
    },
    toArray: () => [...values]
  };
}

function makeElement(id){
  return {
    id,
    value: "",
    textContent: "",
    innerHTML: "",
    disabled: false,
    hidden: false,
    type: id === "authPassword" ? "password" : "",
    autocomplete: "",
    dataset: {},
    options: [],
    tagName: id.includes("Select") || id.endsWith("List") ? "SELECT" : "INPUT",
    style: {
      setProperty(name,value){ this[name] = value; },
      removeProperty(name){ delete this[name]; }
    },
    classList: classList(),
    addEventListener(){},
    focus(){},
    select(){},
    setSelectionRange(){},
    closest(){ return null; },
    getAttribute(name){ return this[name] || ""; },
    setAttribute(name,value){ this[name] = value; },
    removeAttribute(name){ delete this[name]; }
  };
}

function makeStorage(initial = {}){
  const data = {...initial};
  return {
    get length(){ return Object.keys(data).length; },
    key(index){ return Object.keys(data)[index] || null; },
    getItem(key){ return Object.prototype.hasOwnProperty.call(data,key) ? data[key] : null; },
    setItem(key,value){ data[key] = String(value); },
    removeItem(key){ delete data[key]; },
    clear(){ Object.keys(data).forEach(key => delete data[key]); },
    dump(){ return {...data}; }
  };
}

function makeSupabase(state){
  let idCounter = 1;
  const applyFilters = (rows, filters) => rows.filter(row => filters.every(filter => {
    if(filter.type === "eq")return row[filter.key] === filter.value;
    if(filter.type === "in")return filter.values.includes(row[filter.key]);
    return true;
  }));

  function tableRows(table){
    if(table === "tn_playlists")return state.playlists;
    if(table === "tn_words")return state.words;
    throw new Error("Unknown table " + table);
  }

  function builder(table){
    const query = {
      table,
      filters: [],
      operation: "select",
      payload: null,
      wantsSingle: false,
      select(){
        if(this.operation === "select")this.operation = "select";
        return this;
      },
      eq(key,value){ this.filters.push({type:"eq",key,value}); return this; },
      in(key,values){ this.filters.push({type:"in",key,values}); return this; },
      order(){ return this; },
      single(){ this.wantsSingle = true; return this; },
      insert(payload){ this.operation = "insert"; this.payload = payload; return this; },
      update(payload){ this.operation = "update"; this.payload = payload; return this; },
      delete(){ this.operation = "delete"; return this; },
      upsert(payload){ this.operation = "upsert"; this.payload = payload; return this; },
      then(resolve,reject){
        const result=this.exec();
        const userFilter=this.filters.find(filter=>filter.type==="eq"&&filter.key==="user_id")?.value||state.session?.user?.id||"";
        const delay=Number(state.queryDelays?.[userFilter]||0);
        return new Promise(done=>setTimeout(()=>done(result),delay)).then(resolve,reject);
      },
      exec(){
        if(state.failCloud || state.failTables.has(table))return {data:null,error:{message:state.tableError || "mock cloud unavailable"}};
        const rows = tableRows(table);
        if(this.operation === "select"){
          const data = applyFilters(rows,this.filters);
          return {data:this.wantsSingle ? (data[0] || null) : data.map(row => ({...row})),error:null};
        }
        if(this.operation === "insert"){
          if(table === "tn_words" && state.failNextWordInsert){
            state.failNextWordInsert = false;
            return {data:null,error:{message:"mock word insert failed"}};
          }
          const items = Array.isArray(this.payload) ? this.payload : [this.payload];
          const inserted = items.map(item => ({
            id: item.id || uuid(idCounter++),
            created_at: item.created_at || new Date().toISOString(),
            updated_at: item.updated_at || new Date().toISOString(),
            ...item
          }));
          rows.push(...inserted);
          return {data:this.wantsSingle ? inserted[0] : inserted,error:null};
        }
        if(this.operation === "update"){
          if(table === "tn_words" && state.failNextWordUpdate){
            state.failNextWordUpdate = false;
            return {data:null,error:{message:"mock word update failed"}};
          }
          const matched = applyFilters(rows,this.filters);
          matched.forEach(row => Object.assign(row,this.payload));
          return {data:this.wantsSingle ? (matched[0] || null) : matched,error:null};
        }
        if(this.operation === "delete"){
          const matched = new Set(applyFilters(rows,this.filters));
          const kept = rows.filter(row => !matched.has(row));
          rows.length = 0;
          rows.push(...kept);
          return {data:null,error:null};
        }
        if(this.operation === "upsert"){
          const item = this.payload;
          const existing = rows.find(row => row.id === item.id);
          if(existing)Object.assign(existing,item);
          else rows.push({id:item.id || uuid(idCounter++),created_at:new Date().toISOString(),updated_at:new Date().toISOString(),...item});
          return {data:item,error:null};
        }
        return {data:null,error:null};
      }
    };
    return query;
  }

  return {
    auth: {
      getSession: async () => ({data:{session:state.session},error:state.sessionError || null}),
      signInWithPassword: async () => {
        if(state.loginError)return {data:{session:null},error:state.loginError};
        const session=state.loginSession === undefined ? state.session : state.loginSession;
        state.session=session;
        state.authCallback?.("SIGNED_IN",session);
        return {data:{session},error:null};
      },
      signUp: async () => {
        if(state.signUpError)return {data:{session:null},error:state.signUpError};
        const session=state.signUpSession === undefined ? state.session : state.signUpSession;
        state.session=session;
        if(session)state.authCallback?.("SIGNED_IN",session);
        return {data:{session},error:null};
      },
      signOut: async () => { state.session = null; return {error:null}; },
      resetPasswordForEmail: async (email,options) => { state.resetRequest={email,options}; return state.resetError ? {error:state.resetError} : {data:{},error:null}; },
      updateUser: async payload => { state.passwordUpdate=payload; return {data:{user:state.session?.user || null},error:null}; },
      onAuthStateChange: callback => {
        state.authCallback = callback;
        return {data:{subscription:{unsubscribe(){}}}};
      },
      getUser: async () => ({data:{user:state.session?.user || null},error:null})
    },
    from: builder,
    rpc: async (name,args = {}) => {
      if(state.failCloud)return {data:null,error:{message:"mock cloud unavailable"}};
      const userId = state.session?.user?.id;
      if(!userId)return {data:null,error:{message:"Not authenticated"}};
      if(name === "tn_apply_account_isolation_reset_v2"){
        state.cleanStartCalls++;
        const migrationKey=`${userId}:account-isolation-reset-v2`;
        if(state.accountMigrations.has(migrationKey)){
          return {data:{
            applied:false,
            words:state.words.filter(word=>word.user_id===userId).length,
            lists:state.playlists.filter(list=>list.user_id===userId).length,
            migration:"account-isolation-reset-v2"
          },error:null};
        }
        state.words.splice(0,state.words.length,...state.words.filter(word=>word.user_id!==userId));
        state.playlists.splice(0,state.playlists.length,...state.playlists.filter(list=>list.user_id!==userId));
        const created={id:uuid(idCounter++),user_id:userId,name:"My Words",is_default:true,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
        state.playlists.push(created);
        state.accountMigrations.add(migrationKey);
        return {data:{applied:true,words:0,lists:1,playlist_id:created.id,migration:"account-isolation-reset-v2"},error:null};
      }
      if(name === "tn_record_learning_result"){
        if(state.failNextLearningUpdate){
          state.failNextLearningUpdate = false;
          return {data:null,error:{message:"mock learning RPC failed"}};
        }
        const word=state.words.find(item => item.id === args.p_word_id && item.user_id === userId);
        if(!word)return {data:null,error:{message:"Word not found"}};
        if(state.learningEvents.has(args.p_event_id))return {data:{duplicate:true,word:{...word}},error:null};
        state.learningEvents.add(args.p_event_id);
        const local={
          ...word,
          nextReview:word.next_review,
          correctCount:word.correct_count,
          wrongCount:word.wrong_count,
          reviewCount:word.review_count,
          lastAnsweredAt:word.last_answered_at,
          lastWrongAt:word.last_wrong_at,
          consecutiveCorrect:word.consecutive_correct,
          reviewIntervalDays:word.review_interval_days,
          lastResult:word.last_result,
          learningState:word.learning_state
        };
        const next=learningEngine.calculateLearningUpdate(local,{rating:args.p_rating,at:new Date(args.p_answered_at)});
        Object.assign(word,{
          status:next.status,
          level:next.level,
          next_review:next.nextReview,
          correct_count:next.correctCount,
          wrong_count:next.wrongCount,
          review_count:next.reviewCount,
          last_answered_at:next.lastAnsweredAt,
          last_wrong_at:next.lastWrongAt || null,
          consecutive_correct:next.consecutiveCorrect,
          review_interval_days:next.reviewIntervalDays,
          last_result:next.lastResult,
          learning_state:next.learningState,
          updated_at:new Date().toISOString()
        });
        return {data:{duplicate:false,word:{...word}},error:null};
      }
      if(name === "tn_ensure_default_playlist"){
        if(state.missingEnsureRpc)return {data:null,error:{message:"function tn_ensure_default_playlist not found"}};
        let existing=state.playlists
          .filter(list=>list.user_id===userId)
          .filter(list=>String(list.name||"").trim().toLowerCase()==="my words")
          .sort((a,b)=>Number(!!b.is_default)-Number(!!a.is_default)||String(a.created_at||"").localeCompare(String(b.created_at||"")))[0];
        state.playlists.filter(list=>list.user_id===userId).forEach(list=>{list.is_default=false;});
        if(!existing){
          existing={
            id:uuid(idCounter++),user_id:userId,name:"My Words",is_default:true,
            created_at:new Date().toISOString(),updated_at:new Date().toISOString()
          };
          state.playlists.push(existing);
        }else{
          existing.name="My Words";
          existing.is_default=true;
        }
        const removable=new Set(state.playlists.filter(list=>{
          if(list.user_id!==userId||list.id===existing.id)return false;
          if(!["my words","new playlist","starter","default"].includes(String(list.name||"").trim().toLowerCase()))return false;
          if(state.words.some(word=>word.user_id===userId&&word.playlist_id===list.id))return false;
          const created=Date.parse(list.created_at||"");
          const updated=Date.parse(list.updated_at||"");
          return Number.isFinite(created)&&Number.isFinite(updated)&&Math.abs(updated-created)<=5000;
        }));
        if(removable.size){
          const kept=state.playlists.filter(list=>!removable.has(list));
          state.playlists.length=0;
          state.playlists.push(...kept);
        }
        return {data:{...existing},error:null};
      }
      if(name === "tn_delete_playlist"){
        const targetId = args.p_playlist_id;
        const target = state.playlists.find(list => list.id === targetId && list.user_id === userId);
        if(!target)return {data:null,error:{message:"Playlist not found"}};
        if(target.is_default)return {data:null,error:{message:"The default My Words playlist cannot be deleted"}};
        let moved = 0;
        state.words.forEach(word => {
          if(word.user_id === userId && word.playlist_id === targetId){
            word.playlist_id = null;
            moved++;
          }
        });
        state.playlists = state.playlists.filter(list => !(list.id === targetId && list.user_id === userId));
        return {data:{deleted:targetId,unfiled_words:moved},error:null};
      }
      if(name === "tn_delete_all_account_data"){
        state.words = state.words.filter(word => word.user_id !== userId);
        state.playlists = state.playlists.filter(list => list.user_id !== userId);
        const created={id:uuid(idCounter++),user_id:userId,name:"My Words",is_default:true,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
        state.playlists.push(created);
        return {data:{words:0,lists:1,playlist_id:created.id},error:null};
      }
      if(name === "tn_import_snapshot"){
        const data = args.p_data || {};
        state.words = state.words.filter(word => word.user_id !== userId);
        state.playlists = state.playlists.filter(list => list.user_id !== userId);
        const map = new Map();
        const lists = Array.isArray(data.lists) ? data.lists : [];
        let defaultAssigned=false;
        lists.forEach(list => {
          const isDefault=!defaultAssigned&&(!!list.isDefault||String(list.name||"").trim().toLowerCase()==="my words");
          const next = {id:uuid(idCounter++),user_id:userId,name:isDefault ? "My Words" : (list.name || "Imported Playlist"),is_default:isDefault,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
          state.playlists.push(next);
          map.set(String(list.id || ""),next.id);
          defaultAssigned=defaultAssigned||isDefault;
        });
        let wordCount = 0;
        (Array.isArray(data.words) ? data.words : []).forEach((word,index) => {
          if(!String(word.front || "").trim() || !String(word.back || "").trim())return;
          state.words.push({
            id:uuid(idCounter++),
            user_id:userId,
            playlist_id:map.get(String(word.listId || "")) || null,
            front:word.front,
            back:word.back,
            front_lang:word.frontLang || "en-US",
            back_lang:word.backLang || "ja-JP",
            status:word.status || "new",
            saved:!!word.saved,
            level:Number(word.level || 1),
            position:Number(word.position || index),
            created_at:new Date().toISOString(),
            updated_at:new Date().toISOString()
          });
          wordCount++;
        });
        if(!defaultAssigned){
          const created={id:uuid(idCounter++),user_id:userId,name:"My Words",is_default:true,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
          state.playlists.push(created);
        }
        return {data:{lists:lists.length+(defaultAssigned?0:1),words:wordCount},error:null};
      }
      if(name === "tn_upsert_word_nonlearning"){
        if(state.failNextWordUpsert){
          state.failNextWordUpsert=false;
          return {data:null,error:{message:"mock word upsert failed"}};
        }
        const row=args.p_word || {};
        const existing=state.words.find(word => word.id === row.id && word.user_id === userId);
        if(existing){
          if(row.content_updated_at && existing.content_updated_at && new Date(row.content_updated_at)<new Date(existing.content_updated_at)){
            return {data:{applied:false,reason:"stale",word:{...existing}},error:null};
          }
          Object.assign(existing,row,{user_id:userId,updated_at:new Date().toISOString()});
          return {data:{applied:true,word:{...existing}},error:null};
        }
        const inserted={
          status:"new",saved:false,level:1,next_review:new Date().toLocaleDateString("en-CA"),
          correct_count:0,wrong_count:0,review_count:0,consecutive_correct:0,review_interval_days:0,
          learning_state:"new",created_at:new Date().toISOString(),updated_at:new Date().toISOString(),
          ...row,user_id:userId,playlist_id:row.playlist_id || null
        };
        state.words.push(inserted);
        return {data:{applied:true,word:{...inserted}},error:null};
      }
      return {data:null,error:{message:"RPC not found"}};
    },
    channel: name => {
      const channel = {
        name,
        handlers: [],
        on(event,config,callback){ this.handlers.push({event,config,callback}); return this; },
        subscribe(callback){ state.channels.push(this); if(callback)callback("SUBSCRIBED"); return this; }
      };
      return channel;
    },
    removeChannel(channel){
      state.channels = state.channels.filter(item => item !== channel);
    }
  };
}

function createContext({session, playlists = [], words = [], playlistStore = null, wordStore = null, migrationStore = null, failCloud = false, failTables = [], tableError = "", storage = {}, initialDb = null, signUpSession = undefined, signUpError = null, loginSession = undefined, loginError = null, sessionError = null, localQa = false, missingEnsureRpc = false, forceAccountReset = false, queryDelays = {}}){
  const elements = new Map();
  const ids = [
    "authScreen","authForm","authMessage","loginButton","signupButton","updatePasswordButton","forgotPasswordButton","togglePasswordButton","authEmail","authPassword","guestButton","authModeLabel",
    "tn80HeaderCloud","tn80StatusPill","tn80Account","tn80Connection","tn80Device","tn80CloudUpdated",
    "tn80LocalWords","tn80CloudWords","tn80LocalLists","tn80CloudLists","tn80CheckCloudBtn","tn80LoadCloudBtn",
    "tn80LogoutBtn","tn80PendingMutations","tn80RealtimeStatus","tn80UserId",
    "newList","renameListSelect","renameListInput","front","back","frontLang",
    "backLang","addList","pos","gender","tags","memo","bulkList","bulkFrontLang",
    "editId","editFront","editBack","editFrontLang","editBackLang","editList","editPOS","editGender","editTags","editMemo",
    "bulkBackLang","bulkText","bulkPreview","bulkDuplicatePanel","toast","syncDataBox"
  ];
  ids.forEach(id => elements.set(id,makeElement(id)));
  elements.get("frontLang").value = "en-US";
  elements.get("backLang").value = "ja-JP";
  elements.get("bulkFrontLang").value = "en-US";
  elements.get("bulkBackLang").value = "ja-JP";

  elements.get("updatePasswordButton").hidden=true;
  const state = {session,signUpSession,signUpError,loginSession,loginError,sessionError,playlists:playlistStore||[...playlists],words:wordStore||[...words],failCloud,failTables:new Set(failTables),tableError,channels:[],warnings:[],errors:[],learningEvents:new Set(),accountMigrations:migrationStore||new Set(),cleanStartCalls:0,missingEnsureRpc,queryDelays};
  const mockConsole = {
    log: (...args) => console.log(...args),
    warn: (...args) => state.warnings.push(args.map(String).join(" ")),
    error: (...args) => state.errors.push(args.map(String).join(" "))
  };
  const resetUser=session?.user||loginSession?.user||signUpSession?.user||null;
  const storageSeed={...storage};
  if(resetUser&&!forceAccountReset&&storageSeed[ACCOUNT_CLEAN_START_PREFIX+resetUser.id]===undefined){
    storageSeed[ACCOUNT_CLEAN_START_PREFIX+resetUser.id]="complete";
  }
  const storageApi = makeStorage(storageSeed);
  const docElement = {classList:classList(),dataset:{}};
  const body = {classList:classList()};
  const windowObject = {
    TangoNestConfig:{supabaseUrl:"https://example.supabase.co",supabasePublishableKey:"test-key"},
    location:localQa ? {hostname:"127.0.0.1",search:"?qa=1",href:"http://127.0.0.1/?qa=1"} : {hostname:"example.test",search:"",href:"https://example.test/tangonest/"},
    supabase: {createClient: () => makeSupabase(state)},
    TangoNestLearningEngine: learningEngine,
    TangoNestDefaultPlaylist: defaultPlaylist,
    addEventListener(){},
    removeEventListener(){},
    setTimeout,
    clearTimeout,
    console: mockConsole
  };
  windowObject.window = windowObject;
  windowObject.document = {
    readyState: "complete",
    documentElement: docElement,
    body,
    visibilityState: "visible",
    getElementById: id => elements.get(id) || null,
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener(){},
    removeEventListener(){}
  };
  windowObject.localStorage = storageApi;
  windowObject.confirm = () => true;
  windowObject.prompt = () => state.nextPrompt || "";
  windowObject.alert = () => {};
  windowObject.navigator = {};
  let activeStorageUserId="";
  windowObject.db = initialDb || {ui:"en",prefs:{frontLang:"en-US",backLang:"ja-JP"},lists:[],words:[],mistakes:[],meta:{}};
  windowObject.tnMigrateData = data => data;
  windowObject.tnGetDb = () => windowObject.db;
  windowObject.tnAdoptDb = data => { windowObject.db = data; return windowObject.db; };
  windowObject.tnSetActiveUserScope = userId => { activeStorageUserId=String(userId||""); };
  windowObject.tnGetActiveUserScope = () => activeStorageUserId;
  windowObject.tnPurgeUserStorage = userId => ["data","shadow","pending","learning-session","recent-playlist"].forEach(kind=>storageApi.removeItem(accountKey(userId,kind)));
  windowObject.tnEmptyData = reason => ({
    ui:"en",prefs:{frontLang:"en-US",backLang:"ja-JP"},
    lists:[{id:"local-my-words",name:"My Words",isDefault:true}],words:[],mistakes:[],
    meta:{userId:activeStorageUserId,reason}
  });
  windowObject.tnWriteData = data => {
    if(!activeStorageUserId)return;
    data.meta=data.meta||{};
    data.meta.userId=activeStorageUserId;
    storageApi.setItem(accountKey(activeStorageUserId,"data"),JSON.stringify(data));
  };
  windowObject.render = () => {};
  windowObject.tnLibraryRender = () => {};
  windowObject.renderMistakeNotebook = () => {};
  windowObject.closeEdit = () => {};
  windowObject.toast = message => { elements.get("toast").textContent = message; };

  const context = vm.createContext({
    window: windowObject,
    document: windowObject.document,
    localStorage: storageApi,
    console: mockConsole,
    setTimeout,
    clearTimeout,
    confirm: windowObject.confirm,
    prompt: windowObject.prompt,
    alert: windowObject.alert,
    navigator: windowObject.navigator,
    URL
  });
  context.window = windowObject;
  return {context,window:windowObject,elements,state,storage:storageApi};
}

async function bootApp(options){
  const app = createContext(options);
  vm.runInContext(syncScript,app.context,{filename:"tn-supabase-sync.js"});
  await new Promise(resolve => setTimeout(resolve,20));
  return app;
}

(async () => {
  const userA = {id:uuid(101),email:"a@example.com"};
  const userB = {id:uuid(202),email:"b@example.com"};

  const qaListId="qa-list-existing";
  const qa = await bootApp({
    session:null,
    localQa:true,
    initialDb:{ui:"en",prefs:{frontLang:"en-US",backLang:"ja-JP"},lists:[{id:qaListId,name:"QA List"}],words:[],mistakes:[],meta:{}}
  });
  qa.elements.get("renameListSelect").value=qaListId;
  qa.elements.get("renameListInput").value="QA Renamed";
  await qa.window.renameList();
  assert.strictEqual(qa.window.db.lists[0].name,"QA Renamed","local QA rename never requires cloud login");
  assert.strictEqual(qa.elements.get("toast").textContent,"Playlist renamed","local QA rename reports success");
  assert.strictEqual(qa.window.tnAuthDiagnostics().startupState,"READY","local QA reaches a stable startup state");

  const staleLocalData={
    ui:"en",
    prefs:{frontLang:"en-US",backLang:"ja-JP"},
    lists:[{id:"stale-a",name:"New Playlist"},{id:"stale-b",name:"New Playlist"}],
    words:[{id:"stale-word",listId:"stale-a",front:"old",back:"古い"}],
    mistakes:[],meta:{}
  };
  const sessionRestoreApp=await bootApp({
    session:{user:userA},
    forceAccountReset:true,
    storage:{
      [DATA_KEY]:JSON.stringify(staleLocalData),
      [PENDING_KEY]:JSON.stringify([{type:"word_upsert",id:"stale-word",userId:userA.id}]),
      "sb-test-auth-token":"obsolete-session"
    }
  });
  assert.ok(sessionRestoreApp.state.session,"a valid Supabase session is preserved during the data migration");
  assert.strictEqual(sessionRestoreApp.window.tnAuthDiagnostics().authenticated,true,"session restore reaches the authenticated app");
  assert.strictEqual(sessionRestoreApp.window.db.words.length,0,"the account reset ignores stale global words");
  assert.strictEqual(sessionRestoreApp.window.db.lists.length,1,"the account reset exposes one local default only");
  assert.strictEqual(sessionRestoreApp.storage.getItem(ACCOUNT_CLEAN_START_PREFIX+userA.id),"complete","the isolation reset is recorded per account and device");
  assert.strictEqual(sessionRestoreApp.storage.getItem(accountKey(userA.id,"pending")),null,"obsolete global pending writes are never adopted into the account queue");

  const resetPlaylists=[
    {id:uuid(91),user_id:userA.id,name:"New Playlist",is_default:false,created_at:"2026-06-01T00:00:00.000Z",updated_at:"2026-06-20T00:00:00.000Z"},
    {id:uuid(92),user_id:userA.id,name:"New Playlist",is_default:false,created_at:"2026-06-02T00:00:00.000Z",updated_at:"2026-06-21T00:00:00.000Z"}
  ];
  const resetWords=[
    {id:uuid(93),user_id:userA.id,playlist_id:resetPlaylists[0].id,front:"legacy",back:"旧データ",front_lang:"en-US",back_lang:"ja-JP",position:0,created_at:"2026-06-01T00:00:00.000Z",updated_at:"2026-06-20T00:00:00.000Z"}
  ];
  const resetMigrations=new Set();
  const accountResetApp=await bootApp({
    session:{user:userA},playlistStore:resetPlaylists,wordStore:resetWords,
    migrationStore:resetMigrations,forceAccountReset:true
  });
  assert.strictEqual(resetWords.length,0,"the one-time account reset deletes every existing cloud word");
  assert.strictEqual(resetPlaylists.length,1,"the one-time account reset deletes duplicate legacy playlists");
  assert.strictEqual(resetPlaylists[0].name,"My Words","the one-time account reset recreates the canonical list");
  assert.strictEqual(resetPlaylists[0].is_default,true,"the recreated list is the only database default");
  assert.strictEqual(accountResetApp.window.db.words.length,0,"the first post-reset render is Word 0");
  assert.strictEqual(accountResetApp.window.db.lists.length,1,"the first post-reset render is List 1");
  assert.strictEqual(accountResetApp.storage.getItem(ACCOUNT_CLEAN_START_PREFIX+userA.id),"complete","the device records the completed account reset");

  const parallelResetApps=await Promise.all(Array.from({length:20},()=>bootApp({
    session:{user:userA},playlistStore:resetPlaylists,wordStore:resetWords,
    migrationStore:resetMigrations,forceAccountReset:true
  })));
  assert.strictEqual(resetWords.length,0,"twenty simultaneous clients cannot restore deleted words");
  assert.strictEqual(resetPlaylists.length,1,"twenty simultaneous clients keep exactly one database list");
  assert.ok(parallelResetApps.every(item=>item.window.db.words.length===0&&item.window.db.lists.length===1),"desktop/mobile-style clients all render Word 0 / List 1");

  const app = await bootApp({session:{user:userA},playlists:[],words:[]});
  assert.strictEqual(app.window.db.words.length,0,"new account starts with no words");
  assert.strictEqual(app.window.db.lists.length,1,"new account starts with exactly one playlist");
  assert.strictEqual(app.window.db.lists[0].name,"My Words","new account receives the canonical default playlist");
  assert.strictEqual(app.window.db.lists[0].isDefault,true,"default playlist identity is explicit");
  assert.strictEqual(app.window.db.prefs.frontLang,"en-US","front default is English");
  assert.strictEqual(app.window.db.prefs.backLang,"ja-JP","back default is Japanese");
  assert.strictEqual(JSON.parse(app.storage.getItem(accountKey(userA.id,"data"))).meta.userId,userA.id,"cache owner is embedded in the account namespace");
  assert.strictEqual(app.state.channels.length,1,"one realtime channel is subscribed");
  assert.strictEqual(app.window.tnAuthDiagnostics().startupState,"READY","successful session restore reaches READY");
  assert.strictEqual(app.window.tnAuthDiagnostics().lastCloudFetchOk,true,"Synced requires a complete cloud fetch");
  assert.strictEqual(app.elements.get("tn80CloudWords").textContent,"0","cloud word count is actual cloud count");
  assert.strictEqual(app.elements.get("tn80CloudLists").textContent,"1","cloud list count includes the one canonical default");

  const isolationLists=[
    {id:uuid(610),user_id:userA.id,name:"My Words",is_default:true,created_at:"2026-08-01T00:00:00.000Z",updated_at:"2026-08-01T00:00:00.000Z"},
    {id:uuid(620),user_id:userB.id,name:"My Words",is_default:true,created_at:"2026-08-01T00:00:00.000Z",updated_at:"2026-08-01T00:00:00.000Z"}
  ];
  const isolationWords=[
    ...["apple","banana","experience"].map((front,index)=>({
      id:uuid(611+index),user_id:userA.id,playlist_id:isolationLists[0].id,front,back:`A-${index}`,
      front_lang:"en-US",back_lang:"ja-JP",status:"new",level:1,position:index,created_at:"2026-08-01T00:00:00.000Z",updated_at:"2026-08-01T00:00:00.000Z"
    })),
    ...["bonjour","merci"].map((front,index)=>({
      id:uuid(621+index),user_id:userB.id,playlist_id:isolationLists[1].id,front,back:`B-${index}`,
      front_lang:"fr-FR",back_lang:"ja-JP",status:"new",level:1,position:index,created_at:"2026-08-01T00:00:00.000Z",updated_at:"2026-08-01T00:00:00.000Z"
    }))
  ];
  const isolationStorage={
    [ACCOUNT_CLEAN_START_PREFIX+userA.id]:"complete",
    [ACCOUNT_CLEAN_START_PREFIX+userB.id]:"complete"
  };
  const switchApp=await bootApp({session:{user:userA},playlistStore:isolationLists,wordStore:isolationWords,storage:isolationStorage});
  for(let cycle=0;cycle<20;cycle++){
    const target=cycle%2===0?userB:userA;
    const expected=target.id===userA.id?["apple","banana","experience"]:["bonjour","merci"];
    switchApp.state.session={user:target};
    switchApp.state.authCallback("SIGNED_IN",switchApp.state.session);
    await new Promise(resolve=>setTimeout(resolve,35));
    assert.deepStrictEqual(switchApp.window.db.words.map(word=>word.front).sort(),expected.slice().sort(),`account switch ${cycle+1} renders only ${target.email}`);
    assert.strictEqual(switchApp.window.db.lists.length,1,`account switch ${cycle+1} keeps one independent My Words list`);
    assert.strictEqual(switchApp.window.db.meta.userId,target.id,`account switch ${cycle+1} binds memory to the active user`);
  }

  const delayedSwitchApp=await bootApp({
    session:{user:userA},playlistStore:isolationLists,wordStore:isolationWords,storage:isolationStorage,
    queryDelays:{[userA.id]:120,[userB.id]:0}
  });
  delayedSwitchApp.state.session={user:userB};
  delayedSwitchApp.state.authCallback("SIGNED_IN",delayedSwitchApp.state.session);
  await new Promise(resolve=>setTimeout(resolve,220));
  assert.deepStrictEqual(delayedSwitchApp.window.db.words.map(word=>word.front).sort(),["bonjour","merci"],"A's delayed response is discarded after B becomes active");
  assert.strictEqual(delayedSwitchApp.window.db.meta.userId,userB.id,"the delayed A response cannot replace B's memory owner");

  const ghostWords=Array.from({length:630},(_,index)=>({id:`ghost-${index}`,front:`ghost ${index}`,back:`ghost ${index}`}));
  const ghostFixture={ui:"en",prefs:{frontLang:"en-US",backLang:"ja-JP"},lists:[{id:"ghost-list",name:"French"}],words:ghostWords,mistakes:[],meta:{userId:userA.id}};
  const ghostApp=await bootApp({
    session:{user:userB},
    playlists:[{...isolationLists[1]}],words:[],
    storage:{...isolationStorage,[DATA_KEY]:JSON.stringify(ghostFixture),[SHADOW_KEY]:JSON.stringify(ghostFixture)}
  });
  assert.strictEqual(ghostApp.window.db.words.length,0,"DB zero wins over a legacy global 630-word fixture");
  assert.strictEqual(ghostApp.window.db.lists.length,1,"ghost fixture cannot add its French playlist");

  const wrongOwnerApp=await bootApp({
    session:{user:userB},playlistStore:isolationLists,wordStore:isolationWords,
    storage:{...isolationStorage,[accountKey(userB.id,"data")]:JSON.stringify(ghostFixture)}
  });
  assert.deepStrictEqual(wrongOwnerApp.window.db.words.map(word=>word.front).sort(),["bonjour","merci"],"a B namespace payload marked as A is rejected before normalization");
  assert.strictEqual(JSON.parse(wrongOwnerApp.storage.getItem(accountKey(userB.id,"data"))).meta.userId,userB.id,"B cache is rewritten only from B cloud data");

  for(const target of [userA,userB]){
    const expectedCount=target.id===userA.id?3:2;
    for(let reload=0;reload<20;reload++){
      const reopened=await bootApp({session:{user:target},playlistStore:isolationLists,wordStore:isolationWords,storage:isolationStorage});
      assert.strictEqual(reopened.window.db.words.length,expectedCount,`${target.email} reload ${reload+1} keeps the correct word count`);
      assert.ok(reopened.window.db.words.every(word=>(target.id===userA.id?["apple","banana","experience"]:["bonjour","merci"]).includes(word.front)),`${target.email} reload ${reload+1} contains no cross-account word`);
    }
  }

  await Promise.all([app.window.tnEnsureDefaultPlaylist(),app.window.tnEnsureDefaultPlaylist(),app.window.tnCloudLoad()]);
  assert.strictEqual(app.state.playlists.length,1,"concurrent ensure and reload calls remain idempotent");
  for(let index=0;index<10;index++)await app.window.tnEnsureDefaultPlaylist();
  assert.strictEqual(app.state.playlists.length,1,"ten explicit ensure calls keep exactly one list");
  for(let index=0;index<10;index++)await app.window.tnCloudLoad();
  assert.strictEqual(app.state.playlists.length,1,"ten cloud reloads keep exactly one list");
  app.elements.get("newList").value="my words";
  await app.window.createList();
  assert.strictEqual(app.state.playlists.length,1,"reserved My Words cannot be created a second time");
  assert.match(app.elements.get("toast").textContent,/already exists|reserved/i,"duplicate-create attempt explains the reserved name");
  await app.window.tnDeletePlaylist(app.state.playlists[0].id,{confirmed:true});
  assert.strictEqual(app.state.playlists.length,1,"the canonical default playlist cannot be deleted");
  assert.match(app.elements.get("toast").textContent,/default playlist/i,"protected default deletion explains why it was blocked");

  const reopenPlaylists=[];
  const reopenWords=[];
  for(let index=0;index<10;index++){
    const reopened=await bootApp({session:{user:userA},playlistStore:reopenPlaylists,wordStore:reopenWords});
    assert.strictEqual(reopened.state.playlists.length,1,`session restore ${index+1} keeps one list`);
    assert.strictEqual(reopened.state.playlists[0].name,"My Words",`session restore ${index+1} keeps the canonical name`);
  }

  const simultaneousPlaylists=[];
  const simultaneousWords=[];
  const [desktopApp,mobileApp]=await Promise.all([
    bootApp({session:{user:userA},playlistStore:simultaneousPlaylists,wordStore:simultaneousWords}),
    bootApp({session:{user:userA},playlistStore:simultaneousPlaylists,wordStore:simultaneousWords})
  ]);
  assert.strictEqual(simultaneousPlaylists.length,1,"simultaneous desktop and mobile startup creates one list total");
  assert.strictEqual(desktopApp.window.db.lists.length,1,"desktop receives one canonical list");
  assert.strictEqual(mobileApp.window.db.lists.length,1,"mobile receives one canonical list");

  const markedTravelId=uuid(150);
  const markedTravelApp=await bootApp({
    session:{user:userA},
    playlists:[{id:markedTravelId,user_id:userA.id,name:"Travel",is_default:true,created_at:"2026-06-01T00:00:00.000Z",updated_at:"2026-06-10T00:00:00.000Z"}],
    words:[{id:uuid(151),user_id:userA.id,playlist_id:markedTravelId,front:"ticket",back:"切符",front_lang:"en-US",back_lang:"ja-JP",status:"new",level:1,position:0,created_at:"2026-06-01T00:00:00.000Z",updated_at:"2026-06-10T00:00:00.000Z"}]
  });
  assert.deepStrictEqual(markedTravelApp.state.playlists.map(list=>list.name).sort(),["My Words","Travel"],"a user Travel list is preserved even if an old build marked it default");
  assert.strictEqual(markedTravelApp.state.words[0].playlist_id,markedTravelId,"Travel words remain attached to Travel");
  assert.strictEqual(markedTravelApp.state.playlists.filter(list=>list.is_default).length,1,"only My Words remains default after migration");

  const fallbackTravelId=uuid(160);
  const fallbackApp=await bootApp({
    session:{user:userA},
    missingEnsureRpc:true,
    playlists:[{id:fallbackTravelId,user_id:userA.id,name:"Travel",is_default:true,created_at:"2026-06-01T00:00:00.000Z",updated_at:"2026-06-10T00:00:00.000Z"}],
    words:[]
  });
  assert.deepStrictEqual(fallbackApp.state.playlists.map(list=>list.name).sort(),["My Words","Travel"],"missing-RPC fallback preserves a user playlist and creates My Words");
  assert.strictEqual(fallbackApp.state.playlists.find(list=>list.name==="Travel").is_default,false,"missing-RPC fallback demotes the old user-list flag");
  assert.strictEqual(fallbackApp.state.playlists.filter(list=>list.is_default).length,1,"missing-RPC fallback leaves one default");

  const fallbackPrimaryId=uuid(161);
  const fallbackDuplicateId=uuid(162);
  const fallbackDuplicateWordId=uuid(163);
  const duplicateFallbackApp=await bootApp({
    session:{user:userA},
    missingEnsureRpc:true,
    playlists:[
      {id:fallbackPrimaryId,user_id:userA.id,name:"My Words",is_default:true,created_at:"2026-06-01T00:00:00.000Z",updated_at:"2026-06-01T00:00:00.000Z"},
      {id:fallbackDuplicateId,user_id:userA.id,name:"My Words",is_default:false,created_at:"2026-06-02T00:00:00.000Z",updated_at:"2026-06-10T00:00:00.000Z"}
    ],
    words:[{id:fallbackDuplicateWordId,user_id:userA.id,playlist_id:fallbackDuplicateId,front:"merge",back:"統合",front_lang:"en-US",back_lang:"ja-JP",status:"new",level:1,position:0,created_at:"2026-06-02T00:00:00.000Z",updated_at:"2026-06-10T00:00:00.000Z"}]
  });
  assert.strictEqual(duplicateFallbackApp.state.playlists.length,1,"missing-RPC fallback merges duplicate My Words rows");
  assert.strictEqual(duplicateFallbackApp.state.words.length,1,"duplicate merge never loses vocabulary");
  assert.strictEqual(duplicateFallbackApp.state.words[0].playlist_id,fallbackPrimaryId,"duplicate-list vocabulary moves to canonical My Words");

  const repairedDefaultId=uuid(164);
  const staleGeneratedId=uuid(165);
  const staleChineseId=uuid(166);
  const repairTimestamp="2026-06-12T00:00:00.000Z";
  const staleGeneratedApp=await bootApp({
    session:{user:userA},
    playlists:[
      {id:repairedDefaultId,user_id:userA.id,name:"My Words",is_default:true,created_at:repairTimestamp,updated_at:repairTimestamp},
      {id:staleGeneratedId,user_id:userA.id,name:"New Playlist",is_default:false,created_at:"2026-06-01T00:00:00.000Z",updated_at:repairTimestamp},
      {id:staleChineseId,user_id:userA.id,name:"Chinese",is_default:false,created_at:"2026-06-01T00:00:00.000Z",updated_at:repairTimestamp}
    ],
    words:[]
  });
  assert.strictEqual(staleGeneratedApp.state.playlists.length,1,"session restore removes the stale second generated playlist from cloud");
  assert.strictEqual(staleGeneratedApp.state.playlists[0].name,"My Words","the repaired account keeps only My Words");
  assert.strictEqual(staleGeneratedApp.window.db.lists.length,1,"the local account cache also returns to one list");
  assert.strictEqual(staleGeneratedApp.elements.get("tn80CloudLists").textContent,"1","the visible cloud count reflects the repaired database");

  const unfiledApp=await bootApp({session:{user:userA},playlists:[],words:[]});
  unfiledApp.elements.get("front").value="unfiled";
  unfiledApp.elements.get("back").value="未分類";
  unfiledApp.elements.get("addList").value="";
  await unfiledApp.window.addWord({preventDefault(){}});
  assert.strictEqual(unfiledApp.state.playlists.length,1,"adding an unfiled word never duplicates the default playlist");
  assert.strictEqual(unfiledApp.state.playlists.filter(list=>list.is_default).length,1,"Add Word leaves one canonical default");
  assert.strictEqual(unfiledApp.state.words[0].playlist_id,null,"word can be stored without a playlist");

  unfiledApp.state.failNextWordUpsert=true;
  await unfiledApp.window.tnToggleFavorite(unfiledApp.state.words[0].id);
  assert.strictEqual(unfiledApp.window.db.words[0].saved,true,"offline favorite updates the local account cache");
  assert.ok(unfiledApp.storage.getItem(accountKey(userA.id,"pending")),"offline favorite is queued per account");
  await unfiledApp.window.tnSyncNow();
  assert.strictEqual(unfiledApp.storage.getItem(accountKey(userA.id,"pending")),null,"offline favorite syncs after recovery");
  assert.strictEqual(unfiledApp.state.words[0].saved,true,"offline favorite reaches cloud");

  const unfiledId=unfiledApp.state.words[0].id;
  unfiledApp.elements.get("editId").value=unfiledId;
  unfiledApp.elements.get("editFront").value="edited offline";
  unfiledApp.elements.get("editBack").value="オフライン編集";
  unfiledApp.elements.get("editFrontLang").value="en-US";
  unfiledApp.elements.get("editBackLang").value="ja-JP";
  unfiledApp.elements.get("editList").value="";
  unfiledApp.state.failNextWordUpsert=true;
  await unfiledApp.window.saveEdit();
  assert.strictEqual(unfiledApp.window.db.words[0].front,"edited offline","offline edit remains visible locally");
  await unfiledApp.window.tnSyncNow();
  assert.strictEqual(unfiledApp.state.words[0].front,"edited offline","offline edit reaches cloud after recovery");

  unfiledApp.state.words[0].front="newer remote";
  unfiledApp.state.words[0].content_updated_at="2999-01-01T00:00:00.000Z";
  await unfiledApp.window.tnSyncNow();
  unfiledApp.elements.get("editId").value=unfiledId;
  unfiledApp.elements.get("editFront").value="stale device edit";
  unfiledApp.elements.get("editBack").value="古い編集";
  await unfiledApp.window.saveEdit();
  assert.strictEqual(unfiledApp.state.words[0].front,"newer remote","stale device content cannot roll back a newer cloud edit");
  assert.strictEqual(unfiledApp.window.db.words[0].front,"newer remote","stale conflict reloads the authoritative cloud row");

  const offlineAddApp=await bootApp({session:{user:userA},playlists:[],words:[]});
  offlineAddApp.state.failNextWordInsert=true;
  offlineAddApp.elements.get("front").value="queued word";
  offlineAddApp.elements.get("back").value="保留語";
  await offlineAddApp.window.addWord({preventDefault(){}});
  assert.strictEqual(offlineAddApp.state.words.length,0,"failed offline insert does not claim a cloud write");
  assert.strictEqual(offlineAddApp.window.db.words.length,1,"failed offline insert remains in account cache");
  assert.ok(offlineAddApp.storage.getItem(accountKey(userA.id,"pending")),"offline insert is queued per account");
  await offlineAddApp.window.tnSyncNow();
  assert.strictEqual(offlineAddApp.state.words.length,1,"offline insert reaches cloud after recovery");
  assert.strictEqual(offlineAddApp.storage.getItem(accountKey(userA.id,"pending")),null,"offline insert queue clears after cloud confirmation");

  app.elements.get("newList").value = "English A1";
  await app.window.createList();
  const createdList = app.state.playlists.find(item => item.name === "English A1");
  assert.ok(createdList,"playlist create writes to cloud");

  app.elements.get("renameListSelect").value = createdList.id;
  app.elements.get("renameListInput").value = "Renamed A1";
  await app.window.renameList();
  assert.strictEqual(app.state.playlists.find(item => item.id === createdList.id)?.name,"Renamed A1","playlist rename writes to cloud");

  app.elements.get("addList").value = createdList.id;
  app.elements.get("front").value = "test";
  app.elements.get("back").value = "テスト";
  app.elements.get("frontLang").value = "en-US";
  app.elements.get("backLang").value = "ja-JP";
  await app.window.addWord({preventDefault(){}});
  assert.strictEqual(app.state.words.length,1,"word add writes to cloud");
  assert.strictEqual(app.window.db.words.length,1,"word add reloads local cache from cloud");
  assert.strictEqual(app.window.db.words[0].frontLang,"en-US","word front language remains English");
  assert.strictEqual(app.window.db.words[0].backLang,"ja-JP","word back language remains Japanese");

  const wordId = app.window.db.words[0].id;
  await app.window.tnToggleFavorite(wordId);
  assert.strictEqual(app.state.words[0].saved,true,"favorite writes to cloud before local confirmation");

  const learningEvent={
    eventId:uuid(901),
    wordId,
    rating:"good",
    mode:"typing",
    answeredAt:new Date().toISOString()
  };
  app.state.failNextLearningUpdate = true;
  app.window.tnRecordLearningResult(learningEvent);
  await new Promise(resolve => setTimeout(resolve,180));
  assert.ok(app.storage.getItem(accountKey(userA.id,"pending")),"failed atomic learning event remains pending");
  await app.window.tnSyncNow();
  assert.strictEqual(app.storage.getItem(accountKey(userA.id,"pending")),null,"manual sync retries and clears pending learning event");
  assert.strictEqual(app.state.words[0].correct_count,1,"retried learning event reaches cloud atomically");
  assert.strictEqual(app.state.words[0].review_count,1,"review count increments with the atomic event");

  app.window.tnRecordLearningResult(learningEvent);
  await new Promise(resolve => setTimeout(resolve,180));
  assert.strictEqual(app.state.words[0].correct_count,1,"duplicate event id does not increment twice");
  assert.strictEqual(app.state.words[0].review_count,1,"duplicate retry is idempotent");

  app.window.tnRecordLearningResult({...learningEvent,eventId:uuid(902),mode:"choice",answeredAt:new Date(Date.now()+1000).toISOString()});
  app.window.tnRecordLearningResult({...learningEvent,eventId:uuid(903),mode:"listening",answeredAt:new Date(Date.now()+2000).toISOString()});
  await new Promise(resolve => setTimeout(resolve,220));
  assert.strictEqual(app.state.words[0].correct_count,3,"queued device-style events are serialized without lost increments");
  assert.strictEqual(app.state.words[0].review_count,3,"review count never moves backward");

  await app.window.tnDeletePlaylist(createdList.id);
  assert.strictEqual(app.state.playlists.length,1,"deleting a user playlist preserves the one default playlist");
  assert.strictEqual(app.state.playlists[0].name,"My Words","default playlist remains after user playlist deletion");
  assert.strictEqual(app.state.words[0].playlist_id,null,"word remains available as unfiled after playlist delete");

  await app.window.removeWord(wordId);
  assert.strictEqual(app.state.words.length,0,"word delete removes cloud row");
  assert.strictEqual(app.window.db.words.length,0,"word delete refreshes local cache");

  await app.window.tnLogout();
  assert.strictEqual(app.storage.getItem(accountKey(userA.id,"data")),null,"logout removes the signed-out user's data cache");
  assert.strictEqual(app.window.db.words.length,0,"logout clears runtime data");

  const oldData = {
    ui:"en",
    prefs:{frontLang:"en-US",backLang:"ja-JP"},
    lists:[{id:uuid(303),name:"Private"}],
    words:[{id:uuid(304),listId:uuid(303),front:"secret",back:"秘密"}],
    mistakes:[],
    meta:{userId:userA.id}
  };
  const leakApp = await bootApp({
    session:{user:userB},
    failCloud:true,
    storage:{
      [DATA_KEY]:JSON.stringify(oldData)
    },
    initialDb:oldData
  });
  assert.ok(!String(leakApp.storage.getItem(accountKey(userB.id,"data"))).includes("secret"),"user switch never writes previous account data into B's cache");
  assert.strictEqual(leakApp.window.db.words.length,0,"user switch does not show previous user's words");
  assert.ok(leakApp.window.document.documentElement.classList.contains("auth-ready"),"data failure keeps the valid session inside the app");
  assert.ok(!leakApp.window.document.documentElement.classList.contains("tn-needs-auth"),"data failure is not converted into logout");

  const partialDataApp=await bootApp({
    session:{user:userA},
    failTables:["tn_words"],
    tableError:"permission denied for table tn_words",
    playlists:[]
  });
  assert.strictEqual(partialDataApp.window.db.lists.length,1,"default playlist still loads when words permission is broken");
  assert.strictEqual(partialDataApp.window.db.words.length,0,"failed words load does not invent demo data");
  assert.ok(partialDataApp.window.document.documentElement.classList.contains("auth-ready"),"tn_words 403 never sends an authenticated user back to login");
  assert.strictEqual(partialDataApp.window.tnAuthDiagnostics().authenticated,true,"session remains authenticated after a data-table 403");
  assert.strictEqual(partialDataApp.window.tnAuthDiagnostics().startupState,"SYNC_ERROR","data-table failure is a sync state, not an auth state");
  assert.strictEqual(partialDataApp.elements.get("tn80HeaderCloud").textContent,"Needs attention","partial data failure is reported as a sync issue");

  const preservedPending={
    type:"learning_event",
    id:uuid(420),
    userId:userA.id,
    event:{eventId:uuid(420),wordId:uuid(421),rating:"good",mode:"cards"},
    attempts:1
  };
  const userBListId=uuid(422);
  const userBWordId=uuid(423);
  const pendingIsolationApp=await bootApp({
    session:{user:userB},
    playlists:[{id:userBListId,user_id:userB.id,name:"B List",created_at:new Date().toISOString(),updated_at:new Date().toISOString()}],
    words:[{id:userBWordId,user_id:userB.id,playlist_id:userBListId,front:"account b",back:"B",front_lang:"en-US",back_lang:"ja-JP",level:1,status:"new",next_review:"2026-08-24",position:0,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}],
    storage:{
      [accountKey(userA.id,"pending")]:JSON.stringify([preservedPending])
    }
  });
  assert.deepStrictEqual(JSON.parse(pendingIsolationApp.storage.getItem(accountKey(userA.id,"pending"))),[preservedPending],"B startup never reads or rewrites A's pending namespace");
  pendingIsolationApp.state.failNextLearningUpdate=true;
  pendingIsolationApp.window.tnRecordLearningResult({eventId:uuid(424),wordId:userBWordId,rating:"good",mode:"quiz",answeredAt:new Date().toISOString()});
  await new Promise(resolve => setTimeout(resolve,180));
  let isolatedQueue=JSON.parse(pendingIsolationApp.storage.getItem(accountKey(userB.id,"pending")));
  assert.strictEqual(JSON.parse(pendingIsolationApp.storage.getItem(accountKey(userA.id,"pending"))).length,1,"writing B's queue does not overwrite A's queue");
  assert.strictEqual(isolatedQueue.filter(item=>item.userId===userB.id).length,1,"B's failed event is queued under B");
  await pendingIsolationApp.window.tnSyncNow();
  isolatedQueue=JSON.parse(pendingIsolationApp.storage.getItem(accountKey(userA.id,"pending")));
  assert.strictEqual(isolatedQueue.filter(item=>item.userId===userA.id).length,1,"syncing B leaves A's pending event untouched");
  assert.strictEqual(pendingIsolationApp.storage.getItem(accountKey(userB.id,"pending")),null,"syncing B clears only B's successful event");

  const cachedData = {
    ui:"en",
    prefs:{frontLang:"en-US",backLang:"ja-JP"},
    lists:[{id:uuid(401),name:"Offline Cache"}],
    words:[{id:uuid(402),listId:uuid(401),front:"cached",back:"保存済み",reviewCount:2}],
    mistakes:[],
    meta:{userId:userA.id}
  };
  const offlineRestoreApp = await bootApp({
    session:{user:userA},
    failCloud:true,
    storage:{[DATA_KEY]:JSON.stringify(cachedData)},
    initialDb:cachedData
  });
  assert.strictEqual(offlineRestoreApp.window.db.words.length,0,"a global legacy cache is never restored, even for the same account");
  assert.ok(!offlineRestoreApp.window.document.documentElement.classList.contains("tn-needs-auth"),"same-account offline restore does not hide valid data behind login");

  const scopedRestoreApp=await bootApp({
    session:{user:userA},
    failCloud:true,
    storage:{[accountKey(userA.id,"data")]:JSON.stringify(cachedData)},
    initialDb:{ui:"en",prefs:{frontLang:"en-US",backLang:"ja-JP"},lists:[],words:[],mistakes:[],meta:{}}
  });
  assert.strictEqual(scopedRestoreApp.window.db.words.length,0,"cloud initialization failure falls back to a safe empty view instead of stale vocabulary");

  const pendingListId=uuid(451);
  const pendingWordId=uuid(452);
  const pendingSafetyApp=await bootApp({
    session:{user:userA},
    playlists:[{id:pendingListId,user_id:userA.id,name:"Pending",created_at:new Date().toISOString(),updated_at:new Date().toISOString()}],
    words:[{id:pendingWordId,user_id:userA.id,playlist_id:pendingListId,front:"pending",back:"保留",front_lang:"en-US",back_lang:"ja-JP",level:1,status:"new",next_review:"2026-08-24",position:0,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}]
  });
  pendingSafetyApp.state.failCloud=true;
  pendingSafetyApp.window.tnRecordLearningResult({eventId:uuid(453),wordId:pendingWordId,rating:"again",mode:"cards",answeredAt:new Date().toISOString()});
  await new Promise(resolve => setTimeout(resolve,180));
  await pendingSafetyApp.window.clearLocalCache();
  assert.ok(pendingSafetyApp.storage.getItem(accountKey(userA.id,"pending")),"clear local cache preserves unsynced learning events");
  await pendingSafetyApp.window.tnLogout();
  assert.ok(pendingSafetyApp.state.session,"logout is blocked while learning events are unsynced");
  assert.ok(pendingSafetyApp.storage.getItem(accountKey(userA.id,"pending")),"blocked logout does not erase pending learning events");
  pendingSafetyApp.state.failCloud=false;
  await pendingSafetyApp.window.tnSyncNow();
  await pendingSafetyApp.window.tnLogout();
  assert.strictEqual(pendingSafetyApp.state.session,null,"logout succeeds after pending learning events sync");

  const bulkListId = uuid(505);
  const bulkApp = await bootApp({
    session:{user:userA},
    playlists:[{id:bulkListId,user_id:userA.id,name:"Bulk Lab",created_at:new Date().toISOString(),updated_at:new Date().toISOString()}],
    words:[]
  });
  bulkApp.elements.get("bulkList").value = bulkListId;
  bulkApp.window.bulkRows = () => [
    {front:"bulk one",back:"一",pos:"noun",gender:"",memo:"first",duplicate:false,frontDuplicate:false},
    {front:"bulk two",back:"二",pos:"phrase",gender:"",memo:"second",duplicate:false,frontDuplicate:false}
  ];
  await bulkApp.window.bulkImport();
  assert.strictEqual(bulkApp.state.words.length,2,"bulk import writes rows to cloud");
  assert.strictEqual(bulkApp.state.playlists.length,2,"bulk import preserves Bulk Lab and adds only the one required default");
  assert.strictEqual(bulkApp.state.playlists.filter(list=>list.is_default).length,1,"bulk import leaves exactly one default");
  assert.strictEqual(bulkApp.window.db.words.length,2,"bulk import reloads local cache from cloud");
  assert.strictEqual(bulkApp.storage.getItem(accountKey(userA.id,"recent-playlist")),bulkListId,"bulk import remembers recent playlist only for A");
  bulkApp.window.bulkRows = () => [{front:"bulk one",back:"一 updated",pos:"noun",gender:"",memo:"replace",duplicate:true,frontDuplicate:true}];
  await bulkApp.window.bulkImport("replace");
  assert.strictEqual(bulkApp.state.words.length,2,"cloud bulk replace is disabled to avoid partial overwrite");
  assert.ok(/disabled/i.test(bulkApp.elements.get("toast").textContent),"cloud bulk replace explains the safe alternative");

  const importApp = await bootApp({session:{user:userA},playlists:[],words:[]});
  importApp.state.nextPrompt = "IMPORT";
  importApp.elements.get("syncDataBox").value = JSON.stringify({
    app:"TangoNest",
    version:"backup-v3",
    data:{
      prefs:{frontLang:"en-US",backLang:"ja-JP"},
      lists:[{id:"local-a",name:"Imported A"},{id:"local-b",name:"Imported B"}],
      words:[
        {listId:"local-a",front:"cloud",back:"クラウド",frontLang:"en-US",backLang:"ja-JP",saved:true},
        {listId:"local-b",front:"sync",back:"同期",frontLang:"en-US');alert(1);//",backLang:"ja-JP<script>"}
      ]
    }
  });
  await importApp.window.importDataText();
  assert.strictEqual(importApp.state.words.length,2,"import writes words to cloud");
  assert.strictEqual(importApp.state.playlists.length,3,"import preserves two user playlists and adds one canonical default");
  assert.strictEqual(importApp.state.playlists.filter(list=>list.is_default).length,1,"import creates exactly one default");
  assert.ok(importApp.state.words.every(word => word.playlist_id && !["local-a","local-b"].includes(word.playlist_id)),"import regenerates playlist UUID mapping");
  assert.ok(importApp.state.words.every(word => ["en-US","ja-JP"].includes(word.front_lang) || word.front_lang === "en-US"),"import sanitizes unexpected front language codes");
  assert.ok(importApp.state.words.every(word => word.back_lang === "ja-JP"),"import sanitizes unexpected back language codes");

  const emptyImportApp=await bootApp({session:{user:userB},playlists:[],words:[]});
  emptyImportApp.state.nextPrompt="IMPORT";
  emptyImportApp.elements.get("syncDataBox").value=JSON.stringify({app:"TangoNest",data:{lists:[],words:[]}});
  await emptyImportApp.window.importDataText();
  assert.strictEqual(emptyImportApp.state.playlists.length,1,"empty import restores exactly one default playlist");
  assert.strictEqual(emptyImportApp.state.playlists[0].name,"My Words","empty import uses the canonical default name");

  importApp.storage.setItem("sb-test-auth-token",JSON.stringify({access_token:"secret",refresh_token:"secret"}));
  importApp.elements.get("authPassword").value = "not-exported";
  const exportText = JSON.stringify(importApp.window.tnBuildSafeExportData());
  assert.ok(!/access_token|refresh_token|password|credential|sb-test-auth-token/i.test(exportText),"safe export does not include credentials or auth storage");

  importApp.state.nextPrompt = "DELETE CLOUD DATA";
  await importApp.window.deleteAllAccountData();
  assert.strictEqual(importApp.state.words.length,0,"delete all account data removes cloud words");
  assert.strictEqual(importApp.state.playlists.length,1,"delete all restores exactly one default playlist");
  assert.strictEqual(importApp.state.playlists[0].name,"My Words","delete all restores the canonical default name");

  await importApp.window.clearLocalCache();
  assert.strictEqual(JSON.parse(importApp.storage.getItem(accountKey(userA.id,"data"))).meta.userId,userA.id,"clear local cache reloads only the current account cache");

  const loginSession={user:userA,access_token:"unit-access",refresh_token:"unit-refresh"};
  const loginApp=await bootApp({session:null,loginSession,playlists:[],words:[]});
  loginApp.elements.get("authEmail").value="a@example.com";
  loginApp.elements.get("authPassword").value="correct-password";
  await loginApp.elements.get("loginButton").onclick({preventDefault(){}});
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.ok(loginApp.window.document.documentElement.classList.contains("auth-ready"),"existing account login reaches the app");
  assert.strictEqual(loginApp.window.tnAuthDiagnostics().authenticated,true,"successful login stores the active session in runtime");
  assert.strictEqual(loginApp.state.playlists.length,1,"login and SIGNED_IN listener create exactly one default playlist");
  assert.strictEqual(loginApp.state.channels.length,1,"login and auth listener subscribe to Realtime only once");
  loginApp.state.authCallback("TOKEN_REFRESHED",{...loginSession,access_token:"refreshed-access"});
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.strictEqual(loginApp.window.tnAuthDiagnostics().authenticated,true,"token refresh preserves login");
  assert.strictEqual(loginApp.state.channels.length,1,"token refresh does not repeat initial data setup");

  const wrongPasswordApp=await bootApp({session:null,loginError:{message:"Invalid login credentials",code:"invalid_credentials"}});
  wrongPasswordApp.elements.get("authEmail").value="a@example.com";
  wrongPasswordApp.elements.get("authPassword").value="wrong-password";
  await wrongPasswordApp.elements.get("loginButton").onclick({preventDefault(){}});
  assert.strictEqual(wrongPasswordApp.elements.get("authMessage").textContent,"Email or password is incorrect.","wrong password receives a specific error");
  assert.ok(wrongPasswordApp.window.document.documentElement.classList.contains("tn-needs-auth"),"wrong password remains on login");

  const existingSignupApp=await bootApp({session:null,signUpError:{message:"User already exists",code:"user_already_exists"}});
  existingSignupApp.elements.get("authEmail").value="a@example.com";
  existingSignupApp.elements.get("authPassword").value="secret1";
  await existingSignupApp.elements.get("signupButton").onclick({preventDefault(){}});
  assert.match(existingSignupApp.elements.get("authMessage").textContent,/already exists.*Login/i,"existing signup clearly directs the user to Login");

  const resetApp=await bootApp({session:null});
  resetApp.elements.get("authEmail").value="a@example.com";
  await resetApp.elements.get("forgotPasswordButton").onclick({preventDefault(){}});
  assert.strictEqual(resetApp.state.resetRequest.email,"a@example.com","forgot password sends the entered email");
  assert.strictEqual(resetApp.state.resetRequest.options.redirectTo,"https://example.test/tangonest/","password reset preserves the GitHub Pages base path");
  assert.match(resetApp.elements.get("authMessage").textContent,/reset email sent/i,"password reset reports success");

  const recoveryApp=await bootApp({session:null,playlists:[],words:[]});
  recoveryApp.state.session=loginSession;
  recoveryApp.state.authCallback("PASSWORD_RECOVERY",loginSession);
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.strictEqual(recoveryApp.elements.get("updatePasswordButton").hidden,false,"recovery link shows the password update action");
  assert.strictEqual(recoveryApp.elements.get("loginButton").hidden,true,"recovery mode separates password update from normal login");
  recoveryApp.elements.get("authPassword").value="new-secret-password";
  await recoveryApp.elements.get("updatePasswordButton").onclick({preventDefault(){}});
  assert.strictEqual(recoveryApp.state.passwordUpdate?.password,"new-secret-password","password recovery uses the standard authenticated update API");
  assert.ok(recoveryApp.window.document.documentElement.classList.contains("auth-ready"),"successful password recovery returns to the authenticated app");
  assert.strictEqual(recoveryApp.window.tnAuthDiagnostics().authenticated,true,"password recovery preserves the active session");

  const confirmApp = await bootApp({session:null,signUpSession:null});
  confirmApp.elements.get("authEmail").value = "confirm@example.com";
  confirmApp.elements.get("authPassword").value = "secret1";
  await confirmApp.elements.get("signupButton").onclick({preventDefault(){}});
  assert.ok(/check your email/i.test(confirmApp.elements.get("authMessage").textContent),"signup without session asks user to confirm email");
  assert.ok(confirmApp.window.document.documentElement.classList.contains("tn-needs-auth"),"email confirmation flow stays on auth screen");

  console.log("SYNC_REGRESSION_TEST_PASS");
})().catch(error => {
  console.error(error);
  process.exit(1);
});
