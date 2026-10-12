
function appShow(pageId){
  if(typeof closeLanguagePickers==="function")closeLanguagePickers();
  if(typeof go==="function"){go(pageId);return;}
  if(typeof showPage==="function"){showPage(pageId);return;}
  const target=document.querySelector(`[data-page="${pageId}"]`);
  if(target)target.click();
}

// TangoNest Split Edition - app.js

const KEY="tangonest_production_stable_v1";
const SHADOW_KEY="tangonest_last_good_data_v1";
const TN_SESSION_KEY="tangonest_learning_session_v1";
const TN_ACCOUNT_STORAGE_PREFIX="tangonest:account:v2:";
const TN_ACCOUNT_ISOLATION_MARKER="tangonest_account_isolation_rc19_v1";
const TN_LOCAL_QA_MODE=/^(localhost|127\.0\.0\.1)$/.test(location.hostname||"")&&/(?:^|[?&])qa=1(?:&|$)/.test(location.search||"");
let tnActiveStorageUserId="";
const TN_SHADOW_MAX_CHARS=1500000;
const LEGACY_SLUG="vocab"+"rise";
const LEGACY_KEYS=[
  `${LEGACY_SLUG}_production_stable_v1`,
  `${LEGACY_SLUG}_stable_reset_v32`,
  `${LEGACY_SLUG}_beta34`,
  `${LEGACY_SLUG}_beta33`,
  `${LEGACY_SLUG}_beta32`,
  `${LEGACY_SLUG}_beta31`,
  `${LEGACY_SLUG}_beta30`,
  `${LEGACY_SLUG}_beta29`,
  `${LEGACY_SLUG}_beta28`,
  `${LEGACY_SLUG}_beta27`,
  `${LEGACY_SLUG}_beta26`,
  `${LEGACY_SLUG}_beta25`,
  `${LEGACY_SLUG}_beta24`,
  `${LEGACY_SLUG}_beta23`,
  `${LEGACY_SLUG}_beta22`,
  `${LEGACY_SLUG}_beta21`,
  `${LEGACY_SLUG}_beta20`,
  `${LEGACY_SLUG}_beta19`,
  `${LEGACY_SLUG}_beta18`
];
const TN_SCHEMA_VERSION=3;
const TN_DATA_VERSION="1.0.0";
const TN_DEFAULT_PLAYLIST_NAME="New Playlist";
const TN_LOCAL_DEFAULT_PLAYLIST_ID="local-my-words";
const LEGACY_RESET_MARKER_KEY="tangonest_task1_reset_20260823_v1";
const LEGACY_SNAPSHOT_KEY="tangonest_task1_legacy_snapshot_v1";
const LEGACY_SNAPSHOT_INDEX_KEY="tangonest_task1_legacy_snapshot_index_v1";
const RETIRED_LOCAL_KEYS=[
  "tangonest_data",
  "tangonest_local_data_v1",
  "tangonest_data_backup",
  "tangonest_backup_before_cloud_hydration_v1",
  "tangonest_emergency_reset_20260614_v1",
  "tangonest_beta83_library_clean_reset_v1"
];
function tnNowIso(){return new Date().toISOString()}
function tnLocalDefaultPlaylist(at=tnNowIso()){
  return window.TangoNestDefaultPlaylist?.createDefault(at)||{id:TN_LOCAL_DEFAULT_PLAYLIST_ID,name:TN_DEFAULT_PLAYLIST_NAME,isDefault:true,createdAt:at,updatedAt:at};
}
function tnEmptyData(reason){
  const at=tnNowIso();
  return {
    schemaVersion:TN_SCHEMA_VERSION,
    dataVersion:TN_DATA_VERSION,
    ui:"en",
    prefs:{frontLang:"en-US",backLang:"ja-JP"},
    lists:[tnLocalDefaultPlaylist(at)],
    words:[],
    mistakes:[],
    meta:{
      schemaVersion:TN_SCHEMA_VERSION,
      dataVersion:TN_DATA_VERSION,
      updatedAt:at,
      resetReason:reason||"clean-cache",
      sourceOfTruth:"supabase",
      localStorageRole:"cache-backup",
      userId:tnActiveStorageUserId||""
    }
  };
}
function tnAccountStorageKey(userId,kind){
  const owner=String(userId||"").trim();
  return owner?`${TN_ACCOUNT_STORAGE_PREFIX}${owner}:${kind}`:"";
}
function tnDataStorageKey(){return TN_LOCAL_QA_MODE?KEY:tnAccountStorageKey(tnActiveStorageUserId,"data")}
function tnShadowStorageKey(){return TN_LOCAL_QA_MODE?SHADOW_KEY:tnAccountStorageKey(tnActiveStorageUserId,"shadow")}
function tnSessionStorageKey(){return tnAccountStorageKey(tnActiveStorageUserId,"learning-session")}
function tnRecentPlaylistStorageKey(){return tnAccountStorageKey(tnActiveStorageUserId,"recent-playlist")}
function tnSetActiveUserScope(userId){
  tnActiveStorageUserId=String(userId||"").trim();
  return tnActiveStorageUserId;
}
function tnPurgeUserStorage(userId){
  const owner=String(userId||"").trim();
  if(!owner)return;
  ["data","shadow","learning-session","recent-playlist","pending"].forEach(kind=>{
    try{localStorage.removeItem(tnAccountStorageKey(owner,kind))}catch(e){}
  });
}
function tnClone(value){
  try{return JSON.parse(JSON.stringify(value||{}))}catch(e){return{}}
}
function tnStableId(prefix){
  return `${prefix||"id"}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
}
function tnNormalizeDataShape(value,reason){
  const data=value&&typeof value==="object"?tnClone(value):tnEmptyData(reason);
  const at=tnNowIso();
  data.schemaVersion=Number(data.schemaVersion||data?.meta?.schemaVersion||1);
  data.dataVersion=data.dataVersion||data?.meta?.dataVersion||TN_DATA_VERSION;
  data.ui=data.ui||"en";
  data.prefs=data.prefs&&typeof data.prefs==="object"?data.prefs:{};
  data.prefs.frontLang=data.prefs.frontLang||"en-US";
  data.prefs.backLang=data.prefs.backLang||"ja-JP";
  const legacyDefaultIds=new Set(["starter","local-starter"]);
  data.lists=(Array.isArray(data.lists)?data.lists:[]).filter(Boolean).map((list,index)=>({
    id:String(list.id||`list-${index+1}`),
    name:String(list.name||"Untitled Playlist").trim()||"Untitled Playlist",
    isDefault:!!(list.isDefault||list.is_default||String(list.id||"")===TN_LOCAL_DEFAULT_PLAYLIST_ID),
    systemKey:list.systemKey||"",
    generatedBy:list.generatedBy||list.generated_by||"",
    isGenerated:list.isGenerated===true||list.is_generated===true,
    createdAt:list.createdAt||list.created_at||at,
    updatedAt:list.updatedAt||list.updated_at||at
  }));
  data.words=Array.isArray(data.words)?data.words.filter(word=>word&&String(word.front||"").trim()&&String(word.back||"").trim()):[];
  if(window.TangoNestDefaultPlaylist?.enforce)window.TangoNestDefaultPlaylist.enforce(data,{clone:false,now:at});
  else if(!data.lists.length)data.lists.unshift(tnLocalDefaultPlaylist(at));
  const validListIds=new Set(data.lists.map(list=>list.id));
  data.words=data.words.map(word=>{
    let normalized={
      ...word,
      id:String(word.id||tnStableId("word")),
      listId:legacyDefaultIds.has(String(word.listId||""))&&validListIds.has(TN_LOCAL_DEFAULT_PLAYLIST_ID)
        ?TN_LOCAL_DEFAULT_PLAYLIST_ID
        :(validListIds.has(String(word.listId||""))?String(word.listId):""),
      frontLang:word.frontLang||data.prefs.frontLang,
      backLang:word.backLang||data.prefs.backLang,
      createdAt:word.createdAt||word.created_at||at,
      updatedAt:word.updatedAt||word.updated_at||at
    };
    try{normalized=window.TangoNestExampleFields?.normalizeWord(normalized)||normalized}catch(e){}
    try{return window.TangoNestLearningEngine?.normalizeWord(normalized)||normalized}catch(e){return normalized}
  });
  data.mistakes=Array.isArray(data.mistakes)?data.mistakes.filter(entry=>entry&&entry.wordId):[];
  data.meta=data.meta&&typeof data.meta==="object"?data.meta:{};
  data.meta.schemaVersion=TN_SCHEMA_VERSION;
  data.meta.dataVersion=TN_DATA_VERSION;
  data.meta.updatedAt=data.meta.updatedAt||at;
  return data;
}
function tnMigrateData(value){
  const data=tnNormalizeDataShape(value,"migration-normalize");
  if(Number(data.schemaVersion)<1)data.schemaVersion=1;
  data.schemaVersion=TN_SCHEMA_VERSION;
  data.dataVersion=TN_DATA_VERSION;
  data.meta.schemaVersion=TN_SCHEMA_VERSION;
  data.meta.dataVersion=TN_DATA_VERSION;
  return data;
}
function tnStorageKeyLooksRelevant(key){
  const k=String(key||"").toLowerCase();
  if(k.startsWith("sb-") || k.includes("auth") || k.includes("token") || k.includes("session"))return false;
  if(k.includes("sync_email") || k.includes("sync_hash"))return false;
  return k.startsWith("tangonest_") || k.includes(LEGACY_SLUG);
}
function tnResetRetiredLocalStorage(){
  if(TN_LOCAL_QA_MODE)return;
  try{
    if(localStorage.getItem(TN_ACCOUNT_ISOLATION_MARKER)==="complete")return;
    const exact=new Set([
      KEY,SHADOW_KEY,"tangonest_cache_user_id_v1","tangonest_unassigned_cache_backup_v1",
      "tangonest_pending_mutations_v1","tangonest_recent_playlist_v1","tangonest_learning_session_v1",
      LEGACY_SNAPSHOT_KEY,LEGACY_SNAPSHOT_INDEX_KEY,LEGACY_RESET_MARKER_KEY,
      ...RETIRED_LOCAL_KEYS,...LEGACY_KEYS
    ]);
    for(let i=localStorage.length-1;i>=0;i--){
      const key=localStorage.key(i);
      if(!key)continue;
      if(
        exact.has(key)||key.toLowerCase().includes(LEGACY_SLUG)||
        key.startsWith("tangonest_account_cache_v1:")||
        key.startsWith("tangonest_account_shadow_v1:")||
        key.startsWith("tangonest_account_clean_start_v1:")||
        key.startsWith("tangonest_legacy_snapshot_")
      )localStorage.removeItem(key);
    }
    localStorage.setItem(TN_ACCOUNT_ISOLATION_MARKER,"complete");
  }catch(e){
    console.warn("TangoNest account-isolation storage cleanup skipped",e);
  }
}
function tnParsedData(raw){
  try{return raw ? JSON.parse(raw) : null}catch(e){return null}
}
tnResetRetiredLocalStorage();
function tnIsDefaultList(list){
  try{if(window.TangoNestDefaultPlaylist?.isMarkedDefault)return window.TangoNestDefaultPlaylist.isMarkedDefault(list)}catch(e){}
  const id=String(list?.id||"");
  return !!list?.isDefault || id==="starter" || id==="local-starter" || id===TN_LOCAL_DEFAULT_PLAYLIST_ID;
}
function tnHasUserData(data){
  if(!data || typeof data!=="object")return false;
  const words=Array.isArray(data.words)?data.words:[];
  const lists=Array.isArray(data.lists)?data.lists:[];
  return words.some(w=>String(w?.front||"").trim()&&String(w?.back||"").trim()) ||
    lists.some(list=>!tnIsDefaultList(list));
}
function tnListName(data,id){
  return String((data?.lists||[]).find(list=>list.id===id)?.name||"Unfiled").trim().toLowerCase();
}
function tnMergeStoredData(primary,backup){
  const a=primary&&typeof primary==="object"?primary:{};
  const b=backup&&typeof backup==="object"?backup:{};
  const out={
    ui:a.ui||b.ui||"en",
    prefs:{...(b.prefs||{}),...(a.prefs||{})},
    lists:[],
    words:[],
    mistakes:[],
    meta:{...(b.meta||{}),...(a.meta||{})}
  };
  const addList=list=>{
    if(!list)return;
    const name=String(list.name||"Untitled Playlist").trim().toLowerCase();
    const existing=out.lists.find(item=>item.id===list.id||String(item.name||"").trim().toLowerCase()===name);
    if(existing)Object.assign(existing,list);
    else out.lists.push({...list});
  };
  (b.lists||[]).forEach(addList);
  (a.lists||[]).forEach(addList);
  const listIdByName=new Map(out.lists.map(list=>[String(list.name||"").trim().toLowerCase(),list.id]));
  const wordMap=new Map();
  const addWord=(source,word)=>{
    if(!word||!String(word.front||"").trim()||!String(word.back||"").trim())return;
    const sourceListName=tnListName(source,word.listId);
    const requestedId=String(word.listId||"");
    const next={...word,listId:listIdByName.get(sourceListName)||(out.lists.some(list=>list.id===requestedId)?requestedId:"")};
    const key=next.id||[String(next.front).trim().toLowerCase(),String(next.back).trim().toLowerCase(),sourceListName].join("|");
    wordMap.set(key,{...(wordMap.get(key)||{}),...next});
  };
  (b.words||[]).forEach(word=>addWord(b,word));
  (a.words||[]).forEach(word=>addWord(a,word));
  out.words=[...wordMap.values()];
  const mistakeMap=new Map();
  const addMistake=entry=>{
    if(!entry?.wordId)return;
    const prev=mistakeMap.get(entry.wordId)||{};
    mistakeMap.set(entry.wordId,{
      ...prev,
      ...entry,
      wrongCount:Math.max(Number(prev.wrongCount||0),Number(entry.wrongCount||0)),
      lastWrongAt:String(entry.lastWrongAt||"").localeCompare(String(prev.lastWrongAt||""))>0?entry.lastWrongAt:prev.lastWrongAt
    });
  };
  (b.mistakes||[]).forEach(addMistake);
  (a.mistakes||[]).forEach(addMistake);
  out.mistakes=[...mistakeMap.values()];
  out.prefs.frontLang=out.prefs.frontLang||"en-US";
  out.prefs.backLang=out.prefs.backLang||"ja-JP";
  out.meta.updatedAt=out.meta.updatedAt||new Date().toISOString();
  return out;
}
function tnWriteData(data){
  const safe=tnMigrateData(data);
  safe.meta=safe.meta||{};
  const incomingOwner=String(safe.meta.userId||"").trim();
  if(!TN_LOCAL_QA_MODE&&(!tnActiveStorageUserId||(incomingOwner&&incomingOwner!==tnActiveStorageUserId))){
    console.warn("TangoNest blocked a cache write outside the active account boundary.");
    return safe;
  }
  safe.meta.userId=tnActiveStorageUserId||safe.meta.userId||"";
  if(data&&typeof data==="object"&&data!==safe){
    Object.keys(data).forEach(key=>delete data[key]);
    Object.assign(data,safe);
  }
  const dataKey=tnDataStorageKey();
  const shadowKey=tnShadowStorageKey();
  if(!dataKey)return safe;
  const text=JSON.stringify(safe);
  localStorage.setItem(dataKey,text);
  if(!tnHasUserData(safe)){
    tnClearLastGoodData();
    return;
  }
  // A second full local copy can exceed Safari's storage quota on large libraries.
  if(text.length>TN_SHADOW_MAX_CHARS){
    tnClearLastGoodData();
    return;
  }
  try{
    localStorage.setItem(shadowKey,text);
  }catch(error){
    tnClearLastGoodData();
    console.warn("TangoNest skipped the local last-good backup because browser storage is full.");
  }
}
function tnClearLastGoodData(){
  const key=tnShadowStorageKey();
  if(key)try{localStorage.removeItem(key)}catch(e){}
}
function loadTangoNestDB(){
  const dataKey=tnDataStorageKey();
  const shadowKey=tnShadowStorageKey();
  if(!dataKey)return tnEmptyData("auth-boundary-empty");
  const current=localStorage.getItem(dataKey);
  if(current){
    let parsed=tnParsedData(current);
    let shadow=tnParsedData(localStorage.getItem(shadowKey));
    if(!TN_LOCAL_QA_MODE&&parsed?.meta?.userId!==tnActiveStorageUserId){
      try{localStorage.removeItem(dataKey)}catch(e){}
      parsed=null;
    }
    if(!TN_LOCAL_QA_MODE&&shadow?.meta?.userId!==tnActiveStorageUserId){
      try{localStorage.removeItem(shadowKey)}catch(e){}
      shadow=null;
    }
    if(parsed){
      if(tnHasUserData(parsed) && tnHasUserData(shadow)){
        const merged=tnMergeStoredData(parsed,shadow);
        tnWriteData(merged);
        return merged;
      }
      if(tnHasUserData(parsed) || !tnHasUserData(shadow)){
        const migrated=tnMigrateData(parsed);
        tnWriteData(migrated);
        return migrated;
      }
      const migratedShadow=tnMigrateData(shadow);
      tnWriteData(migratedShadow);
      console.warn("TangoNest recovered data from last-good backup");
      return migratedShadow;
    }
    if(tnHasUserData(shadow)){
      const migratedShadow=tnMigrateData(shadow);
      tnWriteData(migratedShadow);
      console.warn("TangoNest recovered data from last-good backup");
      return migratedShadow;
    }
  }
  let shadow=tnParsedData(localStorage.getItem(shadowKey));
  if(!TN_LOCAL_QA_MODE&&shadow?.meta?.userId!==tnActiveStorageUserId){
    try{localStorage.removeItem(shadowKey)}catch(e){}
    shadow=null;
  }
  if(tnHasUserData(shadow)){
    const migratedShadow=tnMigrateData(shadow);
    tnWriteData(migratedShadow);
    console.warn("TangoNest recovered data from last-good backup");
    return migratedShadow;
  }
  const fresh=tnEmptyData("empty-load");
  tnWriteData(fresh);
  return fresh;
}
const LANGUAGE_OPTIONS=window.TangoNestLanguages.options;
const LANGS=LANGUAGE_OPTIONS;
let db=loadTangoNestDB();
db.prefs=db.prefs||{frontLang:"en-US",backLang:"ja-JP"};db.lists=Array.isArray(db.lists)?db.lists:[];db.words=db.words||[];db.mistakes=Array.isArray(db.mistakes)?db.mistakes:[];
try{window.db=db;}catch(e){}
let current=null,flipped=false,flashTimers=[],audioTimer=null,audioQueue=[],audioIndex=0,audioPaused=false,selectedIds=new Set();
let audioRunToken=0,speechEpoch=0;
const pendingSpeech=new Set();
const modalReturnFocus={edit:null,detail:null};
let quiz={queue:[],wrong:[],allWrong:[],index:0,score:0,current:null,answered:false,type:"choice",direction:"front",total:0,listeningReplayUsed:0};let quizAutoTimer=null,quizTimerInterval=null,quizListeningAudioTimer=null,quizQuestionStartedAt=0;
let quizFeedback=null,quizEpoch=0,quizInputReadyAt=0,quizInputUnlockTimer=null,quizHiddenAt=0,cardRated=false;
let smartSessionQueue=[];
const $=id=>document.getElementById(id);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2);
function learningEngine(){return window.TangoNestLearningEngine||null}
function learningPresentation(){return window.TangoNestLearningPresentation||null}
function learningEventId(){
  try{if(crypto?.randomUUID)return crypto.randomUUID()}catch(e){}
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==="x"?r:(r&3|8)).toString(16)})
}
const today=()=>learningEngine()?.localDateKey()||new Date().toLocaleDateString("en-CA");
function addDays(n){return learningEngine()?.addLocalDays(n)||(()=>{let d=new Date();d.setDate(d.getDate()+n);return d.toLocaleDateString("en-CA")})()}
function isDue(w){return learningEngine()?.isDueWord(w)??(!!w.nextReview&&w.nextReview<=today())}
function dueWords(){return db.words.filter(isDue)}
function weakWords(){return db.words.filter(w=>learningEngine()?.isWeakWord(w)??w.status==="hard")}
function masteredWords(){return db.words.filter(w=>learningEngine()?.isMasteredWord(w)??w.status==="learned")}
function recentWords(limit=5){return [...db.words].sort((a,b)=>String(b.createdAt||b.created_at||"").localeCompare(String(a.createdAt||a.created_at||""))).slice(0,limit)}
function shareDb(){try{window.db=db;}catch(e){}return db}
function tnGetDb(){return shareDb()}
function tnAdoptDb(next){if(next&&typeof next==="object"){Object.keys(db).forEach(key=>delete db[key]);Object.assign(db,next);}return shareDb()}
function save(renderUI=true){shareDb();tnWriteData(db);if(renderUI)render()}
function persist(){shareDb();tnWriteData(db)}
try{
  window.tnGetDb=tnGetDb;
  window.tnAdoptDb=tnAdoptDb;
  window.tnWriteData=tnWriteData;
  window.tnMigrateData=tnMigrateData;
  window.tnEmptyData=tnEmptyData;
  window.tnIsDefaultList=tnIsDefaultList;
  window.tnSetActiveUserScope=tnSetActiveUserScope;
  window.tnPurgeUserStorage=tnPurgeUserStorage;
  window.tnGetActiveUserScope=()=>tnActiveStorageUserId;
}catch(e){}
let toastTimer=null;
function toast(m){const box=$("toast");if(!box)return;clearTimeout(toastTimer);box.textContent=m;box.classList.add("show");toastTimer=setTimeout(()=>box.classList.remove("show"),1900)}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function escAttr(s){return String(s??"").replace(/\\/g,"\\\\").replace(/'/g,"\\'").replace(/"/g,'&quot;')}
function jsArg(s){return esc(JSON.stringify(String(s??"")))}
function safeLang(s,fallback="en-US"){s=String(s??"").trim();return /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3}$/.test(s)?s:fallback}
function ensureMistakes(){db.mistakes=Array.isArray(db.mistakes)?db.mistakes:[];return db.mistakes}
function wordPronunciation(w){return String(w?.pronunciation||w?.pron||w?.reading||w?.pinyin||"").trim()}
function mistakePriority(entry){
  const wrong=Number(entry?.wrongCount||0);
  const corrected=Number(entry?.correctAfterMistake||0);
  const age=entry?.lastWrongAt?Math.max(0,Date.now()-new Date(entry.lastWrongAt).getTime()):0;
  return wrong*3-corrected+(entry?.sourceMode==="listening"?1.5:0)-Math.min(1,age/86400000/14);
}
function recordMistake(word,sourceMode,lastUserAnswer,correctValue){
  if(!word?.id)return;
  const list=db.lists?.find(l=>l.id===word.listId);
  const mistakes=ensureMistakes();
  const now=new Date().toISOString();
  let entry=mistakes.find(item=>item.wordId===word.id);
  if(!entry){
    entry={wordId:word.id,wrongCount:0,correctAfterMistake:0};
    mistakes.push(entry);
  }
  Object.assign(entry,{
    front:word.front||"",
    back:word.back||"",
    pronunciation:wordPronunciation(word),
    playlistId:word.listId||"",
    playlistName:list?.name||"",
    language:word.frontLang||"",
    backLanguage:word.backLang||"",
    wrongCount:Number(entry.wrongCount||0)+1,
    lastWrongAt:now,
    sourceMode:sourceMode||"quiz",
    mode:sourceMode||"quiz",
    lastUserAnswer:String(lastUserAnswer||"").trim(),
    userAnswer:String(lastUserAnswer||"").trim(),
    correctAnswer:String(correctValue||word.back||word.front||"").trim()
  });
  persist();
  renderMistakeNotebook();
}
function markMistakeCorrect(wordId){
  const entry=ensureMistakes().find(item=>item.wordId===wordId);
  if(!entry)return;
  entry.correctAfterMistake=Number(entry.correctAfterMistake||0)+1;
  entry.lastCorrectAt=new Date().toISOString();
  const word=db.words.find(item=>item.id===wordId);
  if(word&&entry.correctAfterMistake>=2&&learningEngine()&&!learningEngine().isWeakWord(word)){
    db.mistakes=db.mistakes.filter(item=>item.wordId!==wordId);
  }
  persist();
  renderMistakeNotebook();
}
function removeMistake(wordId){
  db.mistakes=ensureMistakes().filter(item=>item.wordId!==wordId);
  persist();
  renderMistakeNotebook();
}
function mistakeEntriesSorted(){
  return ensureMistakes()
    .filter(entry=>entry?.wordId)
    .sort((a,b)=>mistakePriority(b)-mistakePriority(a)||String(b.lastWrongAt||"").localeCompare(String(a.lastWrongAt||"")));
}
function mistakeWords(){
  const byId=new Map((db.words||[]).map(word=>[word.id,word]));
  return mistakeEntriesSorted().map(entry=>{
    const live=byId.get(entry.wordId);
    if(live)return live;
    return {id:entry.wordId,front:entry.front,back:entry.back,frontLang:entry.language,backLang:entry.backLanguage,listId:entry.playlistId,status:"hard",level:1,lastWrongAt:entry.lastWrongAt,wrongCount:entry.wrongCount};
  }).filter(word=>word?.front||word?.back);
}
function startMistakeReview(){
  const words=mistakeWords().filter(word=>(db.words||[]).some(live=>live.id===word.id));
  if(!words.length)return toast(window.TNI18n.t("ui.no_mistakes_yet",{}));
  if($("quizList")){
    const firstList=words[0]?.listId||db.lists?.[0]?.id;
    if(firstList&&[...$("quizList").options].some(o=>o.value===firstList))$("quizList").value=firstList;
  }
  if($("quizScope"))$("quizScope").value="mistakes";
  if($("quizType"))$("quizType").value="choice";
  try{appShow("quiz")}catch(e){try{go("quiz")}catch(err){}}
  setTimeout(()=>{try{startQuiz()}catch(e){}},80);
}
function clearMistakes(){
  if(!ensureMistakes().length)return toast(window.TNI18n.t("ui.no_mistakes_yet",{}));
  if(!confirm(window.TNI18n.t("ui.clear_the_mistake_notebook_your_words_will_stay_saved",{})))return;
  db.mistakes=[];
  persist();
  renderMistakeNotebook();
  toast(window.TNI18n.t("ui.mistake_notebook_cleared",{}));
}
function mistakeNotebookHtml(limit){
  const entries=mistakeEntriesSorted();
  if(!entries.length)return `<div class="empty"><div class="tn-mistakes-empty-copy"><strong>${window.TNI18n.mark("ui.no_mistakes_yet",{})}</strong><span>${window.TNI18n.mark("ui.your_missed_answers_will_collect_here_for_focused_review",{})}</span></div><button type="button" class="btn" onclick="appShow('quiz')">${window.TNI18n.mark("ui.start_quiz",{})}</button></div>`;
  const rows=entries.slice(0,limit||entries.length).map(entry=>{
    const live=(db.words||[]).find(word=>word.id===entry.wordId)||entry;
    const date=entry.lastWrongAt?new Date(entry.lastWrongAt).toLocaleDateString(window.TNI18n.locale):"-";
    const modeNames={quiz:"Quiz",typing:"Typing",listening:"Listening Quiz",cards:"Cards",flashcards:"Cards",listen:"Listen"};
    const mode=window.TNI18n.uiText(modeNames[entry.sourceMode]||entry.sourceMode||"");
    const meta=[entry.playlistName,mode,entry.language?window.TNI18n.studyName(entry.language):""].filter(Boolean).join(" · ");
    const id=jsArg(entry.wordId);
    return `<div class="mistake-row">
      <button type="button" class="mistake-word" onclick="openDetail(${id})"><b>${esc(live.front||entry.front||"")}</b><span>${esc(live.back||entry.back||"")}</span></button>
      <div class="mistake-meta"><span>${esc(meta||"Mistake")}</span><span>${window.TNI18n.mark("ui.value_wrong_value",{p4:Number(entry.wrongCount||0),p5:esc(date)})}</span>${entry.lastUserAnswer?`<small>${window.TNI18n.mark("ui.your_answer_value",{p0:esc(entry.lastUserAnswer)})}</small>`:""}</div>
      <div class="mistake-actions"><button type="button" onclick="startMistakeReview()">${window.TNI18n.mark("ui.review_2",{})}</button><button type="button" onclick="removeMistake(${id})">${window.TNI18n.mark("ui.clear",{})}</button></div>
    </div>`;
  }).join("");
  const more=limit&&entries.length>limit?`<p class="desc">${window.TNI18n.mark("ui.value_more_mistakes_in_library",{p0:entries.length-limit})}</p>`:"";
  return `<div class="mistake-head"><span>${window.TNI18n.mark("ui.value_saved_mistakes",{p0:entries.length})}</span><div><button type="button" onclick="startMistakeReview()">${window.TNI18n.mark("ui.review_mistakes",{})}</button><button type="button" onclick="clearMistakes()">${window.TNI18n.mark("ui.clear_all",{})}</button></div></div><div class="mistake-list">${rows}</div>${more}`;
}
function renderMistakeNotebook(){
  const home=$("mistakeNotebookHome");
  if(home)home.innerHTML=mistakeNotebookHtml(4);
  const library=$("mistakeNotebookLibrary");
  if(library){
    library.innerHTML=`<h2>${window.TNI18n.mark("ui.mistake_notebook",{})}</h2><p class="desc">${window.TNI18n.mark("ui.wrong_answers_from_quiz_typing_listening_and_hard_flashcards",{})}</p>${mistakeNotebookHtml()}`;
  }
}
try{
  window.tnRecordMistake=recordMistake;
  window.tnMistakeWords=mistakeWords;
  window.tnRenderMistakeNotebook=renderMistakeNotebook;
  window.startMistakeReview=startMistakeReview;
  window.clearMistakes=clearMistakes;
}catch(e){}
function cap(s){return s[0].toUpperCase()+s.slice(1)}

function langName(c){c=safeLang(c);return (LANGS.find(l=>l[0]===c)||[c,c])[1]}
function placeholderFor(c){c=safeLang(c);return (LANGS.find(l=>l[0]===c)||["","", "word"])[2]}
function optionsHTML(selected){selected=safeLang(selected);return LANGS.map(l=>`<option value="${l[0]}" ${l[0]===selected?"selected":""}>${esc(window.TNI18n.studyName(l[0]))}</option>`).join("")}
window.addEventListener("tn:locale",()=>{
  document.querySelectorAll(".tn-language-picker select").forEach(select=>{
    for(const option of select.options)if(window.TangoNestLanguages.find(option.value))option.textContent=window.TNI18n.studyName(option.value);
    syncLanguagePicker(select);
  });
  updateBulkAssistant();
});
function closeLanguagePickers(except){
  document.querySelectorAll(".tn-language-picker.is-open").forEach(picker=>{
    if(picker===except)return;
    picker.classList.remove("is-open");
    picker.querySelector(".tn-language-picker-trigger")?.setAttribute("aria-expanded","false");
  });
}
function syncLanguagePicker(select){
  if(!select)return;
  const picker=select.closest(".tn-language-picker");
  if(!picker)return;
  const trigger=picker.querySelector(".tn-language-picker-trigger");
  const menu=picker.querySelector(".tn-language-picker-menu");
  const selected=[...select.options].find(option=>option.value===select.value)||select.options[0];
  if(trigger)window.TNI18n.bindText(trigger,()=>(selected?.textContent||window.TNI18n.t("ui.select_language",{})));
  if(!menu)return;
  menu.replaceChildren(...[...select.options].map(option=>{
    const button=document.createElement("button");
    button.type="button";
    button.className="tn-language-picker-option";
    button.dataset.value=option.value;
    button.setAttribute("role","option");
    button.setAttribute("aria-selected",String(option.value===select.value));
    button.textContent=option.textContent;
    button.addEventListener("click",()=>{
      select.value=option.value;
      select.dispatchEvent(new Event("change",{bubbles:true}));
      syncLanguagePicker(select);
      closeLanguagePickers();
      trigger?.focus({preventScroll:true});
    });
    return button;
  }));
}
function enhanceLanguagePicker(select){
  if(!select)return;
  let picker=select.closest(".tn-language-picker");
  if(!picker){
    picker=document.createElement("div");
    picker.className="tn-language-picker";
    picker.dataset.languagePicker=select.id;
    select.before(picker);
    picker.appendChild(select);
    select.classList.add("tn-language-native");
    select.tabIndex=-1;
    select.setAttribute("aria-hidden","true");
    const label=document.querySelector(`label[for="${select.id}"]`)?.textContent?.trim()||"Language";
    const trigger=document.createElement("button");
    trigger.type="button";
    trigger.className="tn-language-picker-trigger";
    trigger.dataset.languagePickerTrigger=select.id;
    trigger.setAttribute("aria-label",label);
    trigger.setAttribute("aria-haspopup","listbox");
    trigger.setAttribute("aria-expanded","false");
    const menu=document.createElement("div");
    menu.className="tn-language-picker-menu";
    menu.setAttribute("role","listbox");
    menu.setAttribute("aria-label",`${label} options`);
    trigger.addEventListener("click",()=>{
      const opening=!picker.classList.contains("is-open");
      closeLanguagePickers(opening?picker:null);
      picker.classList.toggle("is-open",opening);
      trigger.setAttribute("aria-expanded",String(opening));
      if(opening)menu.querySelector(".tn-language-picker-option")?.focus({preventScroll:true});
    });
    select.addEventListener("change",()=>syncLanguagePicker(select));
    picker.append(trigger,menu);
  }
  syncLanguagePicker(select);
}
function enhanceLanguagePickers(){
  ["frontLang","backLang","bulkFrontLang","bulkBackLang","editFrontLang","editBackLang"].forEach(id=>enhanceLanguagePicker($(id)));
}
document.addEventListener("pointerdown",event=>{
  if(!event.target?.closest?.(".tn-language-picker"))closeLanguagePickers();
});
document.addEventListener("keydown",event=>{
  if(event.key!=="Escape")return;
  const open=document.querySelector(".tn-language-picker.is-open");
  if(!open)return;
  closeLanguagePickers();
  open.querySelector(".tn-language-picker-trigger")?.focus({preventScroll:true});
});
function fillLangSelects(){db.prefs=db.prefs||{};db.prefs.frontLang=db.prefs.frontLang||"en-US";db.prefs.backLang=db.prefs.backLang||"ja-JP";["frontLang","bulkFrontLang","editFrontLang"].forEach(id=>{if($(id))$(id).innerHTML=optionsHTML(db.prefs.frontLang)});["backLang","bulkBackLang","editBackLang"].forEach(id=>{if($(id))$(id).innerHTML=optionsHTML(db.prefs.backLang)});attachLangMemory();enhanceLanguagePickers();updatePlaceholders()}
function attachLangMemory(){["frontLang","backLang","bulkFrontLang","bulkBackLang"].forEach(id=>{let el=$(id);if(el&&!el.dataset.attached){el.addEventListener("change",()=>{if(id.includes("Front"))db.prefs.frontLang=el.value;else if(id.includes("Back"))db.prefs.backLang=el.value;else if(id==="frontLang")db.prefs.frontLang=el.value;else if(id==="backLang")db.prefs.backLang=el.value;persist();updatePlaceholders()});el.dataset.attached=1}})}
function updatePlaceholders(){if($("front"))$("front").placeholder=placeholderFor($("frontLang").value);if($("back"))$("back").placeholder=placeholderFor($("backLang").value);syncLanguagePicker($("frontLang"));syncLanguagePicker($("backLang"))}
function detectLang(t,currentLang){
  const s=String(t||"").trim().toLowerCase();
  if(/[؀-ۿ]/.test(s))return"ar-SA";
  if(/[֐-׿]/.test(s))return"he-IL";
  if(/[ऀ-ॿ]/.test(s))return"hi-IN";
  if(/[ก-๿]/.test(s))return"th-TH";
  if(/[가-힣]/.test(s))return"ko-KR";
  if(/[ぁ-んァ-ン]/.test(s))return"ja-JP";
  if(/[一-龯]/.test(s)){
    if(["ja-JP","zh-CN","zh-TW"].includes(currentLang))return currentLang;
    return"zh-CN";
  }
  if(/[а-яё]/i.test(s))return"ru-RU";
  if(/[α-ωάέήίόύώϊϋΐΰ]/i.test(s))return"el-GR";
  if(/[àâçéèêëîïôûùüÿœæ]/i.test(s))return"fr-FR";
  if(/[äöüß]/i.test(s))return"de-DE";
  if(/[ãõ]/i.test(s))return"pt-BR";
  if(/[áéíóúñ¿¡]/i.test(s))return"es-ES";
  if(/[ăâđêôơư]/i.test(s))return"vi-VN";
  const dict={pomme:"fr-FR",bonjour:"fr-FR",merci:"fr-FR",mela:"it-IT",ciao:"it-IT",apfel:"de-DE",hallo:"de-DE","maçã":"pt-BR","olá":"pt-BR",manzana:"es-ES",hola:"es-ES",appel:"nl-NL",elma:"tr-TR",apel:"id-ID"};
  return dict[s]||"en-US";
}
function detectLangWithContext(t,currentLang,context){
  const text=String(t||"").trim();
  const ctx=String(context||"");
  if(/[一-龯]/.test(text)&&!/[ぁ-んァ-ン]/.test(text)&&/[ぁ-んァ-ン]/.test(ctx))return"ja-JP";
  return detectLang(text,currentLang);
}
function autoDetectFront(){let t=$("front").value.trim();if(t){$("frontLang").value=detectLangWithContext(t,$("frontLang").value,($("back")?.value||"")+" "+($("memo")?.value||""));updatePlaceholders()}}
function autoDetectBack(){let t=$("back").value.trim();if(t){$("backLang").value=detectLangWithContext(t,$("backLang").value,($("front")?.value||"")+" "+($("memo")?.value||""));updatePlaceholders()}}
function renderSelect(id){
  const el=$(id);if(!el)return;
  const previous=el.value;
  const hasRendered=el.dataset.tnSelectionReady==="1";
  const unfiled=["addList","bulkList","editList"].includes(id);
  const allWords=["studyList","quizList","audioList"].includes(id);
  const availableLists=db.lists;
  el.innerHTML="";
  if(unfiled){const option=document.createElement("option");option.value="";window.TNI18n.bindText(option,()=>(window.TNI18n.t("ui.no_playlist",{})));el.appendChild(option)}
  if(allWords){const option=document.createElement("option");option.value="all";window.TNI18n.bindText(option,()=>(window.TNI18n.t("ui.all_words",{})));el.appendChild(option)}
  availableLists.forEach(list=>{const option=document.createElement("option");option.value=list.id;option.textContent=list.name;el.appendChild(option)});
  const canRestore=[...el.options].some(option=>option.value===previous) && (previous!=="" || !unfiled || hasRendered);
  if(canRestore)el.value=previous;
  else if(allWords)el.value="all";
  else if(unfiled)el.value=(db.lists.find(tnIsDefaultList)||db.lists[0])?.id||"";
  el.dataset.tnSelectionReady="1";
  const renameUnavailable=id==="renameListSelect"&&!availableLists.length;
  el.disabled=renameUnavailable;
  if(id==="renameListSelect"){
    if($("renameListInput"))$("renameListInput").disabled=renameUnavailable;
    if($("renameListButton"))$("renameListButton").disabled=renameUnavailable;
  }
}
function go(p){
  if(typeof window.tnStableNavigate==="function")return window.tnStableNavigate(p);
  ["home","add","words","study","quiz","audio","manage"].forEach(x=>{let page=$("page"+cap(x)),nav=$("nav"+cap(x)),mnav=$("mnav"+cap(x));if(page)page.classList.toggle("active",x===p);if(nav)nav.classList.toggle("active",x===p);if(mnav)mnav.classList.toggle("active",x===p)});
  if(p==="quiz")resetQuiz();
  render();
}

function listWords(listId){
  if(listId==="all")return [...db.words];
  return db.words.filter(word=>(word.listId||"")===(listId||""));
}
function playlistLangMeta(listId){
  const words=listWords(listId);
  if(!words.length)return window.TNI18n.t("ui.no_words");
  const first=words[0];
  const front=window.TNI18n.studyName(first.frontLang)||first.frontLang||"Front";
  const back=window.TNI18n.studyName(first.backLang)||first.backLang||"Back";
  return `${front} → ${back}`;
}
function activeListId(){
  const selectors=["quizList","studyList","audioList","bulkList","addList"];
  for(const id of selectors){
    const el=$(id);
    if(el&&el.value)return el.value;
  }
  return "all";
}
function updateBrandContext(){
  db.words=Array.isArray(db.words)?db.words:[];
  db.lists=Array.isArray(db.lists)?db.lists:[];
  const total=db.words.length;
  const learned=masteredWords().length;
  const listId=activeListId();
  const list=db.lists.find(item=>item.id===listId)||{id:"all",name:window.TNI18n.t("ui.all_words")};
  const words=listWords(list.id);
  const meta=playlistLangMeta(list.id);
  if($("heroPhoneDeck"))$("heroPhoneDeck").textContent=list.name;
  if($("heroPhoneMeta"))window.TNI18n.bindText($("heroPhoneMeta"),()=>(window.TNI18n.t("ui.value_value_words",{p0:meta,p1:words.length})));
}
function goStudy(listId,mode){
  ["quizList","studyList","audioList"].forEach(id=>{const el=$(id);if(el)el.value=listId;});
  if(mode==="quiz")appShow("quiz");
  else if(mode==="audio")appShow("listen");
  else if(mode==="cards")appShow("cards");
  else appShow("library");
  updateBrandContext();
}

function renderManage(){
  const counts={
    mgNew:db.words.filter(word=>(word.reviewCount||0)===0).length,
    mgDue:db.words.filter(isDue).length,
    mgNoPOS:db.words.filter(word=>!String(word.pos||"").trim()).length,
    mgSaved:db.words.filter(word=>word.saved).length
  };
  Object.entries(counts).forEach(([id,value])=>{const el=$(id);if(el)el.textContent=String(value)});
}
function render(){fillLangSelects();renderQuizLanguages();["addList","bulkList","studyList","quizList","audioList","renameListSelect","editList"].forEach(id=>renderSelect(id,false));renderHome();if(typeof window.tnLibraryRender==="function")window.tnLibraryRender();else if(!$('tn82LibraryMount')&&typeof renderWords==="function")renderWords();renderMistakeNotebook();renderManage();updateStudyStar();updateStudyProgress();updateBulkDestinationSummary();try{updateQuizModeSettings();restoreStudySettingsForOwner()}catch(e){}}
function startSmartSession(kind="random"){
  if(!db.words.length){appShow("add");return toast(window.TNI18n.t("ui.add_your_first_words",{}))}
  const engine=learningEngine();
  const matches=kind==="due"?dueWords():kind==="weak"?weakWords():kind==="new"?db.words.filter(w=>Number(w.reviewCount||0)===0):kind==="saved"?db.words.filter(w=>w.saved):kind==="today"&&engine?engine.buildSmartSession(db.words,{limit:20}):db.words;
  if(!matches.length)return toast(kind==="due"?window.TNI18n.t("ui.you_are_all_caught_up",{}):kind==="weak"?window.TNI18n.t("ui.no_weak_words_right_now",{}):kind==="new"?window.TNI18n.t("ui.no_new_words_waiting",{}):window.TNI18n.t("ui.no_words_in_this_session",{}));
  smartSessionQueue=kind==="random"?[]:[...matches];
  const firstList=db.lists.find(list=>matches.some(word=>word.listId===list.id))||db.lists.find(list=>db.words.some(word=>word.listId===list.id))||null;
  if($("quizList"))$("quizList").value=firstList?.id||"all";
  if($("quizType"))$("quizType").value="choice";
  if($("quizScope")){
    $("quizScope").value=kind==="due"?"due":kind==="weak"?"hard":kind==="saved"?"star":"all";
  }
  appShow("quiz");
  setTimeout(()=>{try{startQuiz()}catch(e){toast(window.TNI18n.t("ui.quiz_could_not_start",{}))}},80);
}
function renderHome(){
  const set=(id,value)=>{const el=$(id);if(el)el.textContent=value};
  const learned=masteredWords().length;
  const hard=weakWords().length;
  const due=dueWords();
  const weak=weakWords();
  const recent=recentWords(4);
  const session=learningPresentation()?.session(db.words)||{due:due.length,weak:weak.length,new:db.words.filter(w=>Number(w.reviewCount||0)===0).length,mastered:learned,total:Math.min(20,db.words.length),minutes:Math.ceil(Math.min(20,db.words.length)/2)};
  set("totalWords",db.words.length);
  set("totalLists",db.lists.length);
  set("totalLearned",learned);
  set("totalHard",hard);
  set("dashTotal",db.words.length);
  set("dashLearned",Math.round((learned/Math.max(1,db.words.length))*100)+"%");
  set("dashDue",due.length);
  set("dashHard",hard);
  const memoryPath=$("homeMemoryPath");
  if(memoryPath){
    const stages={new:0,learning:0,review:0,mastered:0};
    (db.words||[]).forEach(source=>{
      const word=learningEngine()?.normalizeWord(source)||source;
      const reviewCount=Number(word.reviewCount||0);
      const level=Number(word.level||1);
      const interval=Number(word.reviewIntervalDays||0);
      const streak=Number(word.consecutiveCorrect||0);
      if(learningEngine()?.isMasteredWord(word)??word.status==="learned")stages.mastered++;
      else if(reviewCount===0)stages.new++;
      else if(interval>=7||streak>=3||level>=4)stages.review++;
      else stages.learning++;
    });
    const total=Math.max(1,db.words.length);
    const items=[
      {key:"new",label:window.TNI18n.t("ui.new",{}),note:window.TNI18n.t("ui.seeds",{}),count:stages.new},
      {key:"learning",label:window.TNI18n.t("ui.learning",{}),note:window.TNI18n.t("ui.taking_root",{}),count:stages.learning},
      {key:"review",label:window.TNI18n.t("ui.review_2",{}),note:window.TNI18n.t("ui.growing",{}),count:stages.review},
      {key:"mastered",label:window.TNI18n.t("ui.mastered",{}),note:window.TNI18n.t("ui.established",{}),count:stages.mastered}
    ];
    memoryPath.innerHTML=db.words.length?`<div class="tn-memory-track" aria-hidden="true">${items.map(item=>`<i class="${item.key}" style="--tn-memory-share:${(item.count/total).toFixed(4)}"></i>`).join("")}</div><div class="tn-memory-stages">${items.map(item=>`<div><span class="tn-memory-dot ${item.key}"></span><b>${item.count}</b><strong>${item.label}</strong><small>${item.note}</small></div>`).join("")}</div>`:`<div class="tn-memory-empty"><strong>${window.TNI18n.mark("ui.your_memory_path_begins_with_one_word",{})}</strong><button type="button" class="btn" onclick="appShow('add')">${window.TNI18n.mark("ui.add_the_first_word",{})}</button></div>`;
  }
  const todayPlan=$("todayPlan");
  if(todayPlan){
    const newCount=session.new;
    const primary=due.length||weak.length||newCount
      ? {label:window.TNI18n.t("ui.today_s_session",{}),detail:window.TNI18n.t("ui.value_words_about_value_min",{p0:session.total,p1:session.minutes}),action:"startSmartSession('today')",button:window.TNI18n.t("ui.start_today_s_session",{})}
      : db.words.length
        ? {label:window.TNI18n.t("ui.keep_the_rhythm_moving",{}),detail:window.TNI18n.t("ui.run_a_short_random_quiz",{}),action:"startSmartSession('random')",button:window.TNI18n.t("ui.start_quiz",{})}
        : {label:window.TNI18n.t("ui.build_your_first_collection",{}),detail:window.TNI18n.t("ui.add_3_5_words_to_begin",{}),action:"appShow('add')",button:window.TNI18n.t("navigation.addWords",{})};
    todayPlan.innerHTML=`
      <div class="tn-today-primary">
        <div><span class="tn-today-label">${window.TNI18n.mark("ui.recommended",{})}</span><strong>${esc(primary.label)}</strong><em>${esc(primary.detail)}</em></div>
        <button type="button" class="btn primary" onclick="${primary.action}">${esc(primary.button)}</button>
      </div>
      <div class="tn-today-grid">
        <button type="button" onclick="startSmartSession('due')"><b>${session.due}</b><span>${window.TNI18n.mark("ui.due_today",{})}</span></button>
        <button type="button" onclick="startSmartSession('weak')"><b>${session.weak}</b><span>${window.TNI18n.mark("ui.needs_practice",{})}</span></button>
        <button type="button" onclick="startSmartSession('new')"><b>${session.new}</b><span>${window.TNI18n.mark("ui.new",{})}</span></button>
        <button type="button" onclick="window.tnOpenLibraryView?tnOpenLibraryView('mastered'):appShow('words')"><b>${session.mastered}</b><span>${window.TNI18n.mark("ui.mastered",{})}</span></button>
      </div>
      <div class="tn-recent-strip">${recent.length?recent.map(w=>`<button type="button" onclick="openDetail(${jsArg(w.id)})"><b>${esc(w.front)}</b><span>${esc(w.back)}</span></button>`).join(""):`<span class='desc'>${window.TNI18n.mark("ui.recent_words_will_appear_here_after_you_add_them",{})}</span>`}</div>
    `;
  }
  const homeLists=$("homeLists");
  if(!homeLists)return;
  homeLists.innerHTML=db.lists.map(l=>{
    const ws=listWords(l.id);
    const meta=playlistLangMeta(l.id);
    const learned=ws.filter(w=>learningEngine()?.isMasteredWord(w)??w.status==="learned").length;
    const hard=ws.filter(w=>learningEngine()?.isWeakWord(w)??w.status==="hard").length;
    const id=jsArg(l.id);
    return `<div class="playlist-card">
      <div class="playlist-main">
        <div class="playlist-icon">${esc(l.name.slice(0,1).toUpperCase())}</div>
        <div>
          <b>${esc(l.name)}</b>
          <span>${window.TNI18n.mark("ui.value_value_words_2",{p2:esc(meta),p3:ws.length})}</span>
        </div>
      </div>
      <div class="playlist-stats">
        <span>${window.TNI18n.mark("ui.value_learned",{p4:learned})}</span>
        <span>${window.TNI18n.mark("ui.value_hard",{p5:hard})}</span>
      </div>
      <div class="playlist-actions">
        <button class="btn small primary" onclick="goStudy(${id},'quiz')">${window.TNI18n.mark("navigation.quiz",{})}</button>
        <button class="btn small" onclick="goStudy(${id},'cards')">${window.TNI18n.mark("navigation.cards",{})}</button>
        <button class="btn small" onclick="goStudy(${id},'audio')">${window.TNI18n.mark("navigation.listen",{})}</button>
      </div>
    </div>`
  }).join("")||`<div class="empty"><div><strong>${window.TNI18n.mark("ui.no_lists_yet",{})}</strong><span>${window.TNI18n.mark("ui.create_a_list_when_you_want_to_group_words_by_language_topic_or_goal",{})}</span></div><button type="button" class="btn" onclick="appShow('add')">${window.TNI18n.mark("ui.create_list",{})}</button></div>`;
  updateBrandContext();
}

/* =========================================================
   Bulk Add parser compatibility
   Supports:
   - tab separated: front back pos gender example
   - comma separated
   - multi-space separated
   - "front back pos gender pinyin | example" style
========================================================= */
function cleanBulkValue(v){
  return String(v ?? "").trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g,"").trim();
}

function splitBulkLine(line){
  const raw=String(line||"").trim();
  if(!raw)return [];
  if(raw.includes("\t"))return raw.split("\t").map(cleanBulkValue);
  if(raw.includes(","))return raw.split(",").map(cleanBulkValue);
  // Prefer 2+ spaces as column separators.
  let parts=raw.split(/\s{2,}/).map(cleanBulkValue).filter(Boolean);
  if(parts.length>=2)return parts;
  // Fallback: normal whitespace. This is useful for Chinese/Japanese rows with compact columns.
  return raw.split(/\s+/).map(cleanBulkValue).filter(Boolean);
}

function parseBulk(text){
  return window.TangoNestBulkFormat.parse(text,$("bulkFormat")?.value||"complete").rows.filter(row=>!row.errors.length);
}

function duplicateMatch(row,listId){
  const f=String(row.front||"").trim().toLowerCase();
  const b=String(row.back||"").trim().toLowerCase();
  const p=String(row.pos||"").trim().toLowerCase();
  return db.words.find(w=>
    w.listId===listId &&
    String(w.front||"").trim().toLowerCase()===f &&
    String(w.back||"").trim().toLowerCase()===b &&
    String(w.pos||"").trim().toLowerCase()===p
  );
}

function setBulkMessage(message,type="info"){
  let box=$("bulkPreview");
  if(!box)return;
  box.style.display="block";
  const cls=type==="error"?"badge red":type==="success"?"badge green":"badge";
  box.innerHTML=`<p><span class="${cls}">${esc(message)}</span></p>` + (box.innerHTML||"");
}

function softDuplicateMatch(row,listId){
  const f=String(row.front||"").trim().toLowerCase();
  return db.words.find(w=>w.listId===listId && String(w.front||"").trim().toLowerCase()===f);
}
function bulkRows(){
  return bulkParseStats().rows.filter(row=>!row.errors.length);
}
function bulkParseStats(){
  const result=window.TangoNestBulkFormat.analyze($("bulkText")?.value||"",{
    format:$("bulkFormat")?.value||"complete",words:db.words,...bulkDestination(),
    pos:[...($("pos")?.options||[])].map(option=>option.value).filter(Boolean),
    genders:[...($("gender")?.options||[])].map(option=>option.value).filter(Boolean)
  });
  const diagnostic=text=>{
    const columns=text.match(/^Expected at most (\d+) columns; found (\d+)\. Check the format or delimiters\.$/);
    return columns?window.TNI18n.t("bulk.columnCount",{expected:columns[1],actual:columns[2]}):window.TNI18n.uiText(text);
  };
  for(const row of result.rows){row.errors=row.errors.map(diagnostic);row.warnings=row.warnings.map(diagnostic);}
  return result;
}
window.bulkParseStats=bulkParseStats;
function updateBulkAssistant(){
  const api=window.TangoNestBulkFormat,select=$("bulkFormat");
  if(!api||!select)return;
  if(!select.options.length)select.innerHTML=api.formats.map(format=>`<option value="${format.id}">${esc(window.TNI18n.uiText(format.label))}</option>`).join("");
  for(const option of select.options){const format=api.formats.find(item=>item.id===option.value);if(format)option.textContent=window.TNI18n.uiText(format.label);}
  $("bulkFormatGuide").textContent=api.formatText(select.value);
  $("bulkText").placeholder=api.sample({...bulkDestination(),format:select.value});
}
window.updateBulkAssistant=updateBulkAssistant;
window.updateBulkActionDock=updateBulkActionDock;
async function copyBulkAssistant(kind){
  const target=bulkDestination(),format=$("bulkFormat").value;
  const api=window.TangoNestBulkFormat;
  const text=kind==="format"?api.formatText(format):api.prompt({format,frontLabel:langName(target.frontLang),backLabel:langName(target.backLang),count:$("bulkPromptCount").value,pos:[...$("pos").options].map(option=>option.value).filter(Boolean),genders:[...$("gender").options].map(option=>option.value).filter(Boolean)});
  try{
    await navigator.clipboard.writeText(text);
    window.TNI18n.bindText($("bulkAssistantStatus"),()=>(kind==="format"?window.TNI18n.t("ui.format_copied",{}):window.TNI18n.t("ui.prompt_copied_paste_it_into_your_ai_tool_then_bring_the_word_rows_back_here",{})));
    $("bulkCopyFallback").hidden=true;
  }catch(error){
    $("bulkCopyFallback").hidden=false;
    $("bulkCopyText").value=text;
    $("bulkCopyText").focus();$("bulkCopyText").select();
    window.TNI18n.bindText($("bulkAssistantStatus"),()=>(window.TNI18n.t("ui.clipboard_access_is_unavailable_the_text_below_is_selected_for_copying",{})));
  }
}
function insertBulkSample(){
  if($("bulkText").value.trim()&&!confirm(window.TNI18n.t("ui.replace_the_pasted_text_with_two_sample_rows",{})))return;
  $("bulkText").value=window.TangoNestBulkFormat.sample({...bulkDestination(),format:$("bulkFormat").value});
  clearBulkPreview();previewBulk();
  window.TNI18n.bindText($("bulkAssistantStatus"),()=>(window.TNI18n.t("ui.two_sample_rows_inserted_review_them_before_importing",{})));
}
let approvedBulkConfirmationKey="";
let lastLocalBulkUndo=null;
let localBulkImportInFlight=false;
let bulkDockTimer=0;
let bulkProgressHideTimer=0;
let bulkStopRequested=false;
const bulkDisabledControls=new Set();
function setBulkControlsBusy(busy){
  if(busy){
    $("bulkCard")?.querySelectorAll("input,select,textarea,button").forEach(control=>{
      if(!control.disabled){bulkDisabledControls.add(control);control.disabled=true;}
    });
  }else{
    bulkDisabledControls.forEach(control=>control.disabled=false);
    bulkDisabledControls.clear();
  }
  const cancel=$("bulkCancelButton");
  if(cancel){cancel.hidden=!busy;cancel.disabled=false;window.TNI18n.bindText(cancel,()=>(window.TNI18n.t("ui.stop_after_this_batch",{})));}
}
function bulkDestination(){
  const listId=$("bulkList")?.value||"";
  const list=db.lists.find(item=>item.id===listId);
  return {
    listId,
    listName:list?.name||"No playlist",
    frontLang:$("bulkFrontLang")?.value||db.prefs?.frontLang||"en-US",
    backLang:$("bulkBackLang")?.value||db.prefs?.backLang||"ja-JP"
  };
}
function bulkConfirmationKey(rows,mode){
  const target=bulkDestination();
  return JSON.stringify({...target,mode:mode||"skip",rows:rows.map(row=>window.TangoNestBulkFormat.fields.map(field=>row[field.key]))});
}
function updateBulkDestinationSummary(){
  const box=$("bulkTargetSummary");
  if(!box)return;
  const target=bulkDestination();
  box.innerHTML=`<span>${window.TNI18n.mark("ui.destination",{})}</span><strong>${esc(target.listName)}</strong><small>${esc(window.TNI18n.studyName(target.frontLang))} → ${esc(window.TNI18n.studyName(target.backLang))}</small>`;
}
function hideBulkDestinationConfirmation(){
  approvedBulkConfirmationKey="";
  const panel=$("bulkTargetConfirm");
  if(panel){panel.hidden=true;panel.innerHTML=""}
}
function requestBulkDestinationConfirmation(rows,mode){
  const key=bulkConfirmationKey(rows,mode);
  if(approvedBulkConfirmationKey===key){approvedBulkConfirmationKey="";const panel=$("bulkTargetConfirm");if(panel){panel.hidden=true;panel.innerHTML=""}return true}
  const panel=$("bulkTargetConfirm");
  if(!panel)return true;
  const target=bulkDestination();
  const duplicatePanel=$("bulkDuplicatePanel");
  if(duplicatePanel)duplicatePanel.classList.remove("show");
  panel.hidden=false;
  const stats=bulkParseStats();
  panel.innerHTML=`<div><span class="tn-bulk-confirm-kicker">${window.TNI18n.mark("ui.confirm_destination",{})}</span><strong id="bulkConfirmTitle">${esc(target.listName)}</strong><small>${window.TNI18n.mark("ui.value_words_value_value",{p1:rows.length,p2:esc(window.TNI18n.studyName(target.frontLang)),p3:esc(window.TNI18n.studyName(target.backLang))})}</small><small>${window.TNI18n.mark("ui.value_warning_rows_value_skipped",{p4:stats.warnings,p5:Math.max(0,stats.valid-rows.length)})}</small></div><div class="tn-bulk-confirm-actions"><button type="button" data-bulk-cancel>${window.TNI18n.mark("ui.go_back",{})}</button><button type="button" data-bulk-approve>${window.TNI18n.mark("ui.import_value_words_here",{p6:rows.length})}</button></div>`;
  panel.querySelector("[data-bulk-cancel]")?.addEventListener("click",hideBulkDestinationConfirmation);
  panel.querySelector("[data-bulk-approve]")?.addEventListener("click",()=>{approvedBulkConfirmationKey=key;window.bulkImport(mode||undefined)});
  setTimeout(()=>panel.querySelector("[data-bulk-approve]")?.focus({preventScroll:true}),0);
  return false;
}
function setBulkProgress(current,total,label,state="working"){
  const panel=$("bulkProgressPanel");
  if(!panel)return;
  clearTimeout(bulkProgressHideTimer);
  const safeTotal=Math.max(1,Number(total)||1);
  const safeCurrent=Math.max(0,Math.min(safeTotal,Number(current)||0));
  const percent=Math.max(0,Math.min(100,Math.round(safeCurrent/safeTotal*100)));
  panel.hidden=false;
  panel.dataset.state=state;
  if($("bulkProgressLabel"))window.TNI18n.bindText($("bulkProgressLabel"),()=>(window.TNI18n.uiText(label)||window.TNI18n.t("ui.saving_your_words",{})));
  if($("bulkProgressDetail"))window.TNI18n.bindText($("bulkProgressDetail"),()=>(state==="done"?window.TNI18n.t("ui.value_words_are_safely_in_your_collection",{p0:safeCurrent}):state==="error"?window.TNI18n.t("ui.value_of_value_confirmed_your_import_can_be_resumed_without_repeating_saved_rows",{p0:safeCurrent,p1:safeTotal}):window.TNI18n.t("ui.value_of_value_words_saved_keep_this_tab_open",{p0:safeCurrent,p1:safeTotal})));
  if($("bulkProgressPercent"))$("bulkProgressPercent").textContent=`${percent}%`;
  if($("bulkProgressFill"))$("bulkProgressFill").style.transform=`scaleX(${percent/100})`;
}
function beginBulkProgress(total){bulkStopRequested=false;setBulkControlsBusy(true);setBulkProgress(0,total,"Preparing your collection","working")}
function updateBulkProgress(current,total,label){setBulkProgress(current,total,label||window.TNI18n.t("ui.saving_your_words"),"working")}
function finishBulkProgress(total){setBulkControlsBusy(false);setBulkProgress(total,total,window.TNI18n.t("bulk.complete"),"done");updateBulkActionDock();bulkProgressHideTimer=setTimeout(()=>{const panel=$("bulkProgressPanel");if(panel)panel.hidden=true},1400)}
function failBulkProgress(current,total,message){setBulkControlsBusy(false);setBulkProgress(current,total,message||window.TNI18n.t("bulk.paused"),"error");updateBulkActionDock()}
function bulkProgressBusy(){return localBulkImportInFlight||$("bulkProgressPanel")?.dataset.state==="working"}
window.tnBulkProgress={start:beginBulkProgress,update:updateBulkProgress,finish:finishBulkProgress,fail:failBulkProgress,busy:bulkProgressBusy,cancelled:()=>bulkStopRequested};
function updateBulkActionDock(){
  const dock=$("bulkActionDock");
  if(!dock)return;
  const stats=bulkParseStats();
  dock.hidden=!stats.lines;
  if($("bulkDockCount"))window.TNI18n.bindText($("bulkDockCount"),()=>(window.TNI18n.t("ui.value_rows_detected",{p0:stats.lines})));
  if($("bulkDockMeta"))window.TNI18n.bindText($("bulkDockMeta"),()=>(window.TNI18n.t("ui.value_ready_value_warnings_value_errors",{p0:stats.ready,p1:stats.warnings,p2:stats.invalid})));
  if($("bulkRegisterBtn")){
    window.TNI18n.bindText($("bulkRegisterBtn"),()=>(window.TNI18n.t("ui.review_import_value",{p0:stats.valid})));
    $("bulkRegisterBtn").disabled=!!stats.invalid||!stats.valid||bulkProgressBusy();
  }
}
function queueBulkActionDock(){clearTimeout(bulkDockTimer);bulkDockTimer=setTimeout(updateBulkActionDock,120)}
function clearBulkInput(){if($("bulkText"))$("bulkText").value="";clearBulkPreview();updateBulkActionDock()}
window.clearBulkInput=clearBulkInput;
function showBulkUndo(info){
  const panel=$("bulkUndoPanel");
  if(!panel)return;
  panel.hidden=false;
  panel.innerHTML=`<div><strong>${window.TNI18n.mark("ui.value_words_added_to_value",{p0:Number(info?.count||0),p1:esc(info?.playlistName||"the selected playlist")})}</strong><small>${window.TNI18n.mark("ui.you_can_undo_this_import_without_affecting_earlier_words",{})}</small></div><button type="button" onclick="undoLastBulkImport()">${window.TNI18n.mark("ui.undo_last_bulk_add",{})}</button>`;
}
function clearBulkUndo(){lastLocalBulkUndo=null;const panel=$("bulkUndoPanel");if(panel){panel.hidden=true;panel.innerHTML=""}}
async function undoLastBulkImport(){
  if(!lastLocalBulkUndo)return toast(window.TNI18n.t("ui.there_is_no_bulk_add_to_undo",{}));
  if(lastLocalBulkUndo.type==="snapshot")db.words=lastLocalBulkUndo.words;
  else{const ids=new Set(lastLocalBulkUndo.ids||[]);db.words=db.words.filter(word=>!ids.has(word.id))}
  const count=lastLocalBulkUndo.count||0;
  clearBulkUndo();
  save();
  toast(window.TNI18n.t("ui.value_imported_words_removed",{p0:count}));
}
function clearBulkPreview(){
  let b=$("bulkPreview");if(b){b.style.display="none";b.innerHTML=""}
  let d=$("bulkDuplicatePanel");if(d){d.classList.remove("show");d.innerHTML=""}
  hideBulkDestinationConfirmation();
  updateBulkActionDock();
}
function renderDuplicatePanel(rows){
  const panel=$("bulkDuplicatePanel");
  if(!panel)return;
  const dup=rows.filter(r=>r.frontDuplicate);
  if(!dup.length){panel.classList.remove("show");panel.innerHTML="";return;}
  const visible=dup.slice(0,60);
  panel.classList.add("show");
  panel.innerHTML=`<div class="dup-panel-head"><div id="bulkDuplicateTitle" class="dup-title">${window.TNI18n.mark("ui.duplicate_front_words_found_value",{p0:dup.length})}</div><button type="button" class="dup-close" data-dup-close aria-label="Close duplicate review" data-i18n-aria-label="ui.close_duplicate_review">${window.TNI18n.mark("common.close",{})}</button></div>
  <p class="desc">${window.TNI18n.mark("ui.some_words_have_the_same_front_choose_how_to_import_them_nothing_is_skipped_automatically",{})}</p>
  <div class="dup-list">`+visible.map(r=>{
    let ex=r.existing;
    return `<div class="dup-item"><b>${esc(r.front)}</b>
      <span class="badge">${window.TNI18n.mark("ui.new_value_value",{p1:esc(r.back),p2:esc(r.pos||"—")})}</span>
      ${ex?`<span class="badge yellow">${window.TNI18n.mark("ui.existing_value_value",{p0:esc(ex.back),p1:esc(ex.pos||"—")})}</span>`:`<span class='badge'>${window.TNI18n.mark("ui.duplicate_in_pasted_rows",{})}</span>`}
    </div>`
  }).join("")+(dup.length>visible.length?`<div class="dup-more">${window.TNI18n.mark("ui.value_more_duplicate_rows_are_included_in_this_decision",{p0:dup.length-visible.length})}</div>`:"")+`</div>
  <div class="dup-actions">
    <button class="btn red" type="button" data-bulk-mode="skip">${window.TNI18n.mark("ui.skip_exact_duplicates",{})}</button>
    <button class="btn green" type="button" data-bulk-mode="addBoth">${window.TNI18n.mark("ui.add_both",{})}</button>
    <button class="btn blue" type="button" data-bulk-mode="replace" ${TN_LOCAL_QA_MODE?'':'disabled title="Cloud Replace is disabled to protect saved words. Edit individual words in Library."'}>${window.TNI18n.mark("ui.replace_existing",{})}</button>
  </div>`;
  panel.querySelector("[data-dup-close]")?.addEventListener("click",()=>panel.classList.remove("show"));
  panel.querySelectorAll("[data-bulk-mode]").forEach(button=>button.addEventListener("click",()=>window.bulkImport(button.dataset.bulkMode)));
  setTimeout(()=>panel.querySelector("[data-bulk-mode='addBoth']")?.focus({preventScroll:true}),0);
}
function previewBulk(reviewDuplicates=false){
  let stats=bulkParseStats(),rows=stats.rows,box=$("bulkPreview");
  box.dataset.inputVersion=JSON.stringify([$("bulkText").value,$("bulkFormat").value,bulkDestination()]);
  box.style.display="block";
  if(!rows.length){box.innerHTML=`<div class="empty"><h3>${window.TNI18n.mark("ui.no_readable_words",{})}</h3><p>${window.TNI18n.mark("ui.each_row_needs_at_least_front_and_back",{})}</p></div>`;return}
  if(!stats.invalid&&reviewDuplicates)renderDuplicatePanel(rows);
  else $("bulkDuplicatePanel")?.classList.remove("show");
  const target=bulkDestination();
  const visible=rows.slice(0,60);
  const fields=window.TangoNestBulkFormat.fields;
  box.innerHTML=`<div class="tn-bulk-preview-target"><b>${window.TNI18n.mark("ui.import_to_value",{p0:esc(target.listName)})}</b><span>${esc(window.TNI18n.studyName(target.frontLang))} → ${esc(window.TNI18n.studyName(target.backLang))}</span></div><div class="tn-bulk-summary" role="status"><span>${window.TNI18n.mark("ui.value_ready",{p3:stats.ready})}</span><span>${window.TNI18n.mark("ui.value_warnings",{p4:stats.warnings})}</span><span>${window.TNI18n.mark("ui.value_errors",{p5:stats.invalid})}</span><span>${window.TNI18n.mark("ui.value_valid",{p6:stats.valid})}</span><span>${window.TNI18n.mark("ui.value_exact_duplicates",{p7:rows.filter(r=>r.duplicate).length})}</span></div><p class="tn-bulk-validation-note">${window.TNI18n.mark("ui.errors_must_be_corrected_before_importing_warnings_can_be_imported_after_review",{})}</p>${rows.length>visible.length?`<p class="tn-bulk-preview-limit">${window.TNI18n.mark("ui.showing_value_of_value_rows_every_row_is_validated",{p0:visible.length,p1:rows.length})}</p>`:""}<div class="tablewrap" tabindex="0" role="region" aria-label="Bulk Add preview" data-i18n-aria-label="ui.bulk_add_preview"><table><thead><tr><th>${window.TNI18n.mark("ui.row",{})}</th>${fields.map(field=>`<th>${esc(window.TNI18n.uiText(field.label))}</th>`).join("")}<th>${window.TNI18n.mark("ui.status",{})}</th></tr></thead><tbody>`+visible.map(r=>`<tr><td>${r.row}</td>${fields.map(field=>`<td dir="auto">${esc(r[field.key])}</td>`).join("")}<td><strong>${r.status==="error"?window.TNI18n.uiText("Error"):r.status==="warning"?window.TNI18n.uiText("Warning"):window.TNI18n.uiText("Ready")}</strong><span class="tn-bulk-row-issues">${esc([...r.errors,...r.warnings].join(" "))}</span></td></tr>`).join("")+"</tbody></table></div>";
  const issues=rows.filter(row=>row.errors.length);
  if(issues.length)box.innerHTML+=`<div class="tn-bulk-errors" role="alert">${issues.slice(0,30).map(row=>`<p>${window.TNI18n.mark("ui.row_value_value",{p0:row.row,p1:esc(row.errors.join(" "))})}</p>`).join("")}${issues.length>30?`<p>${window.TNI18n.mark("ui.value_additional_rows_need_correction",{p0:issues.length-30})}</p>`:""}</div>`;
  const problems=rows.filter(row=>row.errors.length||row.warnings.length);
  if(problems.length){
    const list=document.createElement("div");list.className="bulk-problem-links";
    for(const row of problems){
      const button=document.createElement("button");button.type="button";
      button.textContent=window.TNI18n.t("bulk.editRow",{row:row.row})+" · "+[...row.errors,...row.warnings].join(" ");
      button.onclick=()=>focusBulkRow(row.row);list.appendChild(button);
    }
    box.prepend(list);
  }
}
function focusBulkRow(row){
  const input=$("bulkText"),lines=input.value.split("\n");
  const start=lines.slice(0,row-1).reduce((length,line)=>length+line.length+1,0);
  input.focus();input.setSelectionRange(start,start+(lines[row-1]||"").length);
  input.scrollTop=(row-1)*(parseFloat(getComputedStyle(input).lineHeight)||22);
  input.scrollIntoView({block:"center",behavior:"instant"});
}
async function bulkImport(mode){
  if(localBulkImportInFlight)return toast(window.TNI18n.t("ui.bulk_add_is_already_running",{}));
  if(bulkParseStats().invalid){previewBulk();return toast(window.TNI18n.t("ui.fix_the_highlighted_rows_before_importing",{}))}
  let rows=bulkRows();
  if(!rows.length)return toast(window.TNI18n.t("ui.no_readable_words",{}));
  const hasFrontDup=rows.some(r=>r.frontDuplicate);
  if(hasFrontDup&&!mode){previewBulk(true);return toast(window.TNI18n.t("ui.duplicate_words_need_confirmation",{}));}
  let listId=$("bulkList").value,frontLang=$("bulkFrontLang").value,backLang=$("bulkBackLang").value;
  const target=bulkDestination();
  if(mode==="replace"){
    if(!requestBulkDestinationConfirmation(rows,mode))return;
    const beforeWords=JSON.parse(JSON.stringify(db.words));
    rows.forEach(r=>{
      const ex=softDuplicateMatch(r,listId);
      if(ex){
        db.words=db.words.map(w=>w.id===ex.id?{...w,front:r.front,back:r.back,frontLang,backLang,listId,memo:r.memo,pronunciation:r.pronunciation,pos:r.pos,gender:r.gender}:w);
      }else{
        db.words.push({id:uid(),front:r.front,back:r.back,frontLang,backLang,listId,memo:r.memo,pronunciation:r.pronunciation,pos:r.pos,gender:r.gender,tags:"",saved:false,status:"new",seen:0,level:1,nextReview:today(),learningState:"new",reviewIntervalDays:0,consecutiveCorrect:0,lastResult:"",createdAt:new Date().toISOString()});
      }
    });
    lastLocalBulkUndo={type:"snapshot",words:beforeWords,count:rows.length};
    $("bulkText").value="";clearBulkPreview();save();showBulkUndo({count:rows.length,playlistName:target.listName});return toast(window.TNI18n.t("ui.value_processed",{p0:rows.length}));
  }
  if(mode==="skip"||!mode){
    rows=rows.filter(r=>!r.duplicate);
  }
  if(mode==="addBoth"){
    const seen=new Set();
    rows=rows.filter(r=>{
      const k=[r.front,r.back,r.pos].map(x=>String(x||"").trim().toLowerCase()).join("||");
      if(seen.has(k))return false;
      seen.add(k);
      return true;
    });
  }
  if(!rows.length)return toast(window.TNI18n.t("ui.no_new_words_to_add",{}));
  if(!requestBulkDestinationConfirmation(rows,mode))return;
  localBulkImportInFlight=true;
  beginBulkProgress(rows.length);
  try{
    const additions=[];
    const chunkSize=200;
    for(let start=0;start<rows.length;start+=chunkSize){
      if(bulkStopRequested){failBulkProgress(0,rows.length,"Import stopped. No local words were added.");return;}
      const chunk=rows.slice(start,start+chunkSize).map(r=>({id:uid(),front:r.front,back:r.back,frontLang,backLang,listId,memo:r.memo,pronunciation:r.pronunciation,pos:r.pos,gender:r.gender,tags:"",saved:false,status:"new",seen:0,level:1,nextReview:today(),learningState:"new",reviewIntervalDays:0,consecutiveCorrect:0,lastResult:"",createdAt:new Date().toISOString()}));
      additions.push(...chunk);
      updateBulkProgress(additions.length,rows.length,`Preparing batch ${Math.floor(start/chunkSize)+1}`);
      await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
    }
    if(bulkStopRequested){failBulkProgress(0,rows.length,"Import stopped. No local words were added.");return;}
    db.words=[...db.words,...additions];
    lastLocalBulkUndo={type:"ids",ids:additions.map(word=>word.id),count:additions.length};
    $("bulkText").value="";clearBulkPreview();save();showBulkUndo({count:additions.length,playlistName:target.listName});finishBulkProgress(additions.length);toast(window.TNI18n.t("ui.value_added",{p0:additions.length}));
  }catch(error){
    failBulkProgress(0,rows.length,"Import could not be completed");
    toast(window.TNI18n.t("ui.couldn_t_add_these_words_please_try_again",{}));
  }finally{localBulkImportInFlight=false;updateBulkActionDock()}
}
try{window.bulkRows=bulkRows;window.previewBulk=previewBulk;window.clearBulkPreview=clearBulkPreview;window.requestBulkDestinationConfirmation=requestBulkDestinationConfirmation;window.showBulkUndo=showBulkUndo;window.clearBulkUndo=clearBulkUndo;window.undoLastBulkImport=undoLastBulkImport;window.updateBulkDestinationSummary=updateBulkDestinationSummary;}catch(e){}
function posBadge(pos){return pos?`<span class="badge ${["noun","verb","adjective","adverb","phrase"].includes(pos)?pos:""}">${esc(pos)}</span>`:""}
function genderBadge(g){if(!g)return"";let letter=g==="masculine"?"M":g==="feminine"?"F":g==="neutral"?"N":g==="plural"?"PL":String(g)[0].toUpperCase();let cls=g==="masculine"?"m":g==="feminine"?"f":"n";return`<span class="badge ${cls}">${esc(letter)}</span>`}
function moveWord(id,dir){let w=db.words.find(x=>x.id===id);if(!w)return;let same=db.words.filter(x=>x.listId===w.listId),pos=same.findIndex(x=>x.id===id),target=same[pos+dir];if(!target)return toast(window.TNI18n.t("ui.cannot_move_further",{}));let i1=db.words.findIndex(x=>x.id===id),i2=db.words.findIndex(x=>x.id===target.id);[db.words[i1],db.words[i2]]=[db.words[i2],db.words[i1]];save()}
function toggleSelected(id,c){c?selectedIds.add(id):selectedIds.delete(id)}
function deleteSelected(){if(!selectedIds.size)return toast(window.TNI18n.t("ui.select_words_first",{}));if(!confirm(window.TNI18n.t("ui.value_words_will_be_deleted",{p0:selectedIds.size})))return;db.words=db.words.filter(w=>!selectedIds.has(w.id));db.mistakes=ensureMistakes().filter(entry=>!selectedIds.has(entry.wordId));selectedIds.clear();save()}
function removeWord(id){if(!confirm(window.TNI18n.t("ui.delete_this_word",{})))return;db.words=db.words.filter(w=>w.id!==id);db.mistakes=ensureMistakes().filter(entry=>entry.wordId!==id);selectedIds.delete(id);save()}
function toggleStar(id){db.words=db.words.map(w=>w.id===id?{...w,saved:!w.saved}:w);if(current&&current.id===id)current=db.words.find(w=>w.id===id);save()}
function openDetail(id){let w=db.words.find(x=>x.id===id);if(!w)return;modalReturnFocus.detail=document.activeElement;const view=learningPresentation();const learning=view?.state(w)||{label:learningEngine()?.levelName(w.level)||"Learning"};const review=view?.review(w)||{label:w.nextReview||"Review not scheduled"};const accuracy=view?.accuracy(w)||{label:window.TNI18n.t("ui.value_accuracy",{p0:Math.round((learningEngine()?.accuracy(w)||0)*100)})};const lastStudied=view?.lastStudied(w)||(w.lastAnsweredAt?new Date(w.lastAnsweredAt).toLocaleDateString():"Not studied yet");$("detailContent").innerHTML=`<div class="dict-title">${esc(w.front)}</div><div class="dict-meaning">${esc(w.back)}</div><div>${posBadge(w.pos)} ${genderBadge(w.gender)} ${w.tags?`<span class="badge">${esc(w.tags)}</span>`:""}</div><div class="actions"><button class="btn blue" onclick="speak(${jsArg(w.front)},${jsArg(safeLang(w.frontLang))})">${window.TNI18n.mark("ui.play_front",{})}</button><button class="btn blue" onclick="speak(${jsArg(w.back)},${jsArg(safeLang(w.backLang,"ja-JP"))})">${window.TNI18n.mark("ui.play_back",{})}</button><button class="btn" onclick="openEdit(${jsArg(w.id)})">${window.TNI18n.mark("ui.edit",{})}</button></div><div class="dict-grid"><div class="dict-box"><b>${window.TNI18n.mark("ui.languages",{})}</b>${window.TNI18n.studyName(w.frontLang)} → ${window.TNI18n.studyName(w.backLang)}</div><div class="dict-box"><b>${window.TNI18n.mark("ui.learning",{})}</b>${esc(learning.label)}</div><div class="dict-box"><b>${window.TNI18n.mark("ui.accuracy",{})}</b>${esc(accuracy.label)}</div><div class="dict-box"><b>${window.TNI18n.mark("ui.next_review",{})}</b>${esc(review.label)}</div><div class="dict-box"><b>${window.TNI18n.mark("ui.last_studied",{})}</b>${esc(lastStudied)}</div><div class="dict-box"><b>${window.TNI18n.mark("ui.memo_example",{})}</b>${esc(w.memo||"-")}</div></div>`;$("detailModal").classList.add("show");setTimeout(()=>$("detailModal")?.querySelector("button")?.focus({preventScroll:true}),0)}
function closeDetail(){$("detailModal").classList.remove("show");if(modalReturnFocus.detail?.isConnected)modalReturnFocus.detail.focus({preventScroll:true});modalReturnFocus.detail=null}
function openEdit(id){let w=db.words.find(x=>x.id===id);if(!w)return;modalReturnFocus.edit=document.activeElement;$("editId").value=w.id;$("editFront").value=w.front;$("editBack").value=w.back;$("editFrontLang").innerHTML=optionsHTML(w.frontLang);$("editBackLang").innerHTML=optionsHTML(w.backLang);syncLanguagePicker($("editFrontLang"));syncLanguagePicker($("editBackLang"));$("editList").value=w.listId;$("editPOS").value=w.pos||"";$("editGender").value=w.gender||"";$("editTags").value=w.tags||"";$("editMemo").value=w.memo||"";$("editModal").classList.add("show");setTimeout(()=>$("editFront")?.focus({preventScroll:true}),0)}
function closeEdit(){$("editModal").classList.remove("show");if(modalReturnFocus.edit?.isConnected)modalReturnFocus.edit.focus({preventScroll:true});modalReturnFocus.edit=null}
function saveEdit(){let id=$("editId").value;db.words=db.words.map(w=>w.id===id?{...w,front:$("editFront").value.trim(),back:$("editBack").value.trim(),frontLang:$("editFrontLang").value,backLang:$("editBackLang").value,listId:$("editList").value,pos:$("editPOS").value,gender:$("editGender").value,tags:$("editTags").value.trim(),memo:$("editMemo").value.trim()}:w);const edited=db.words.find(w=>w.id===id);const mistake=ensureMistakes().find(entry=>entry.wordId===id);if(edited&&mistake){Object.assign(mistake,{front:edited.front,back:edited.back,playlistId:edited.listId,language:edited.frontLang,backLanguage:edited.backLang,pronunciation:wordPronunciation(edited)})}closeEdit();save()}
function studyWords(){let list=$("studyList").value,mode=$("studyMode").value;let words=list==="all"?[...db.words]:db.words.filter(w=>(w.listId||"")===(list||""));if(mode==="hard")words=words.filter(w=>learningEngine()?.isWeakWord(w)??w.status==="hard");if(mode==="due")words=words.filter(isDue);if(mode==="star")words=words.filter(w=>w.saved);return words}
function updateStudyProgress(){
  const el=$("studyProgress");
  if(!el)return;
  const words=studyWords();
  const due=words.filter(isDue).length;
  const hard=words.filter(w=>learningEngine()?.isWeakWord(w)??w.status==="hard").length;
  window.TNI18n.bindText(el,()=>(words.length?window.TNI18n.t("ui.value_cards_value_due_value_weak_space_flips_1_4_rates",{p0:words.length,p1:due,p2:hard}):window.TNI18n.t("ui.no_cards_in_this_view",{})));
}
function resetCard(){clearFlashTimers();current=null;flipped=false;cardRated=false;$("flash").classList.remove("is-flipped");$("frontWord").textContent=window.TNI18n.t(studyWords().length?"ui.next_card":"ui.no_cards_in_this_view");$("backWord").textContent="";$("frontMemo").textContent="";$("backMemo").textContent="";updateCardRating();updateStudyStar();updateStudyProgress()}
function weighted(words){if(!words.length)return null;const ordered=[...words].sort((a,b)=>(learningEngine()?.learningWeight(b)||0)-(learningEngine()?.learningWeight(a)||0));const top=ordered.slice(0,Math.max(1,Math.ceil(ordered.length/2)));return top[Math.floor(Math.random()*top.length)]}
function nextCard(){clearFlashTimers();let words=studyWords();if(!words.length){resetCard();return toast(window.TNI18n.t("ui.no_words",{}))}const candidates=current&&words.length>1?words.filter(word=>word.id!==current.id):words;current=weighted(candidates);flipped=false;cardRated=false;$("flash").classList.remove("is-flipped");current.seen=(current.seen||0)+1;drawCard();persist();updateCardRating();updateStudyStar();updateStudyProgress();window.tnStudyContinuity?.capture()}
function drawCard(){if(!current)return;let mode=$("studyMode").value;if(mode==="back"){$("frontWord").textContent=current.back;$("backWord").textContent=current.front;$("backMemo").textContent=current.memo||""}else{$("frontWord").textContent=current.front;$("backWord").textContent=current.back;$("backMemo").textContent=current.memo||""}$("frontMemo").textContent=[current.pos,current.gender].filter(Boolean).join(" / ")}
function updateCardRating(){document.querySelectorAll(".tn-card-rating button").forEach(button=>button.disabled=!current||!flipped||cardRated);const sides=$("flash")?.querySelectorAll(".front,.back");sides?.forEach(side=>side.setAttribute("aria-hidden",String(side.classList.contains("back")?!flipped:flipped)))}
function flipCard(){if(!current)return;flipped=!flipped;$("flash").classList.toggle("is-flipped",flipped);updateCardRating();window.tnStudyContinuity?.capture()}
function speakCard(){if(!current)return;let mode=$("studyMode").value,text,lang;if(mode==="back"){text=flipped?current.front:current.back;lang=flipped?current.frontLang:current.backLang}else{text=flipped?current.back:current.front;lang=flipped?current.backLang:current.frontLang}speak(text,lang)}
function markCard(rating,autoNext=false){if(!current||!flipped||cardRated)return;cardRated=true;updateCardRating();const normalized=learningEngine()?.normalizeRating(rating)||rating;if(normalized==="again")recordMistake(current,"flashcard","Again",current.back);const updated=updateWordLearning(current.id,normalized,{mode:"cards"});current=updated||db.words.find(w=>w.id===current.id);if(normalized==="good"||normalized==="easy")markMistakeCorrect(current.id);const feedback=learningPresentation()?.rating(current,normalized);toast(feedback?`${feedback.label} · ${feedback.review}`:window.TNI18n.t("ui.value_saved",{p0:normalized[0].toUpperCase()+normalized.slice(1)}));window.tnStudyContinuity?.capture();if(autoNext)flashTimers.push(setTimeout(()=>nextCard(),220))}
function toggleCardStar(){if(current)toggleStar(current.id)}
function updateStudyStar(){let b=$("studyStar");if(b)window.TNI18n.bindText(b,()=>(current&&current.saved?window.TNI18n.t("ui.saved_2",{}):window.TNI18n.t("ui.save",{})))}
function clearFlashTimers(){flashTimers.forEach(t=>clearTimeout(t));flashTimers=[]}
function startFlashAuto(){$("flashAutoMode").value="on";playFlashAutoCycle()}
function stopFlashAuto(){clearFlashTimers();$("flashAutoMode").value="off"}
function playFlashAutoCycle(){clearFlashTimers();if($("flashAutoMode").value!=="on")return;nextCard();if(!current)return stopFlashAuto();let mode=$("studyMode").value,frontText=mode==="back"?current.back:current.front,frontLang=mode==="back"?current.backLang:current.frontLang,backText=mode==="back"?current.front:current.back,backLang=mode==="back"?current.frontLang:current.backLang;speak(frontText,frontLang);let flipDelay=parseInt($("flashFlipDelay").value),nextDelay=parseInt($("flashNextDelay").value);flashTimers.push(setTimeout(()=>{if($("flashAutoMode").value!=="on")return;if(!flipped)flipCard();speak(backText,backLang)},flipDelay));flashTimers.push(setTimeout(()=>playFlashAutoCycle(),flipDelay+nextDelay))}
function updateWordLearning(id,rating,context={}){const engine=learningEngine();const at=new Date();const eventId=context.eventId||learningEventId();let updated=null;db.words=db.words.map(w=>{if(w.id!==id)return w;updated=engine?engine.calculateLearningUpdate(w,{rating,mode:context.mode||"study",at}):w;return updated});if(!updated)return null;persist();const event={eventId,wordId:id,rating:engine?.normalizeRating(rating)||rating,mode:context.mode||"study",answeredAt:at.toISOString(),localWord:{...updated}};try{window.tnRecordLearningResult?.(event)}catch(e){console.warn("Learning sync queued locally",e)}try{renderHome();window.tnLibraryRender?.();updateStudyProgress()}catch(e){}return updated}
function quizLearningWeight(w){return learningEngine()?.learningWeight(w)??1}
function quizAdaptiveOrder(words){return words.map(word=>({word,key:-Math.log(Math.max(Number.EPSILON,Math.random()))/Math.max(.1,quizLearningWeight(word))})).sort((a,b)=>a.key-b.key).map(item=>item.word)}
function quizPool(settings=captureQuizSettings()){let list=settings.quizList,scope=settings.quizScope;let words=list==="all"?[...db.words]:db.words.filter(w=>(w.listId||"")===(list||""));for(const side of ["front","back"]){const language=settings[side==="front"?"quizFrontLang":"quizBackLang"];if(language&&language!=="all")words=words.filter(word=>word[side+"Lang"]===language)}if(scope==="mistakes"){const ids=new Set(ensureMistakes().map(entry=>entry.wordId));words=words.filter(w=>ids.has(w.id))}else{if(scope==="hard")words=words.filter(w=>learningEngine()?.isWeakWord(w)??w.status==="hard");if(scope==="due")words=words.filter(isDue);if(scope==="star")words=words.filter(w=>w.saved)}return words}
function quizOrderedWords(words){
  words=uniqueStudyWords(words);
  const order=$("quizOrderMode")?.value||"random";
  if(order==="playlist")return [...words];
  if(order==="weak")return [...words].sort((a,b)=>Number(learningEngine()?.isWeakWord(b))-Number(learningEngine()?.isWeakWord(a))||quizLearningWeight(b)-quizLearningWeight(a));
  if(order==="due")return [...words].sort((a,b)=>Number(isDue(b))-Number(isDue(a))||String(a.nextReview||"9999").localeCompare(String(b.nextReview||"9999"))||quizLearningWeight(b)-quizLearningWeight(a));
  if(order==="newest")return [...words].sort((a,b)=>String(b.createdAt||b.created_at||"").localeCompare(String(a.createdAt||a.created_at||"")));
  return shuffle(words);
}
function shuffle(arr){let a=[...arr];for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function uniqueStudyWords(words){const ids=new Set();return words.filter(word=>word?.id&&!ids.has(word.id)&&ids.add(word.id))}
const QUIZ_FEEDBACK_SPEED_KEY="tangonest_quiz_feedback_speed_v1";
const QUIZ_AUTO_ADVANCE_MIGRATION_KEY="tangonest_quiz_auto_feedback_fdg14_v1";
function ensureQuizFeedbackDefault(){
  const el=$("quizAutoAdvance");
  if(!el)return;
  if(!el.__tnFeedbackSpeedBound){
    el.addEventListener("change",()=>{if(TN_LOCAL_QA_MODE)try{localStorage.setItem(QUIZ_FEEDBACK_SPEED_KEY,el.value)}catch(e){}});
    el.__tnFeedbackSpeedBound=true;
  }
  let saved="",migrated=false;
  try{
    migrated=localStorage.getItem(QUIZ_AUTO_ADVANCE_MIGRATION_KEY)==="complete";
    saved=localStorage.getItem(QUIZ_FEEDBACK_SPEED_KEY)||"";
    if(!migrated){if(!saved||["manual","off"].includes(saved))saved="auto";localStorage.setItem(QUIZ_FEEDBACK_SPEED_KEY,saved);localStorage.setItem(QUIZ_AUTO_ADVANCE_MIGRATION_KEY,"complete")}
  }catch(e){}
  const values=[...el.options].map(option=>option.value);
  const accountValue=quizSavedPreferences().settings?.quizAutoAdvance;
  // Migrate the old device-wide setting to one owner; later accounts start independently.
  let legacyAllowed=TN_LOCAL_QA_MODE;
  if(tnActiveStorageUserId)try{
    const key=QUIZ_FEEDBACK_SPEED_KEY+":owner",owner=localStorage.getItem(key);
    if(!owner)localStorage.setItem(key,tnActiveStorageUserId);
    legacyAllowed=!owner||owner===tnActiveStorageUserId;
  }catch(error){}
  el.value=values.includes(accountValue)?accountValue:legacyAllowed&&values.includes(saved)?saved:"auto";
}
function updateQuizModeSettings(forceDefaults=false){
  const type=$("quizType")?.value||"choice";
  if(updateQuizModeSettings.lastType!==type&&$("quizDirection"))$("quizDirection").value=quizDirectionForType(type);
  updateQuizModeSettings.lastType=type;
  const difficulty=$("listeningDifficulty")?.value||"normal";
  if($("quizTimeLimit"))$("quizTimeLimit").disabled=$("quizHardMode")?.value!=="on";
  updateStudySettingsSummary();
  document.querySelectorAll("[data-quiz-setting]").forEach(node=>{
    const modes=String(node.dataset.quizSetting||"").split(/\s+/).filter(Boolean);
    const visible=modes.includes("all")||modes.includes(type)||(type==="listening"&&difficulty==="hard"&&modes.includes("listening-hard"));
    node.hidden=!visible;
  });
  if(type==="listening"&&forceDefaults){
    if(difficulty==="hard"){
      if(forceDefaults||$("listeningReplayLimit")?.value==="unlimited")$("listeningReplayLimit").value="1";
      if(forceDefaults||$("listeningTimerMode")?.value==="off")$("listeningTimerMode").value="10";
    }else{
      if($("listeningReplayLimit"))$("listeningReplayLimit").value="unlimited";
      if($("listeningTimerMode"))$("listeningTimerMode").value="off";
    }
  }
}
function placeTypingArea(inListeningCard){
  const area=$("typingArea");
  if(!area)return;
  const target=inListeningCard?$("listeningInputSlot"):$("typingAreaHome");
  if(target&&area.parentElement!==target)target.appendChild(area);
}
const QUIZ_SETTING_IDS=Object.freeze(["quizList","quizFrontLang","quizBackLang","quizScope","quizCount","quizType","quizDirection","quizOrderMode","quizAutoAdvance","quizAudioAfter","quizHardMode","quizTimeLimit","listeningDifficulty","listeningReplayLimit","listeningTimerMode","listeningHintMode"]);
function captureQuizSettings(){return Object.fromEntries(QUIZ_SETTING_IDS.map(id=>[id,$(id)?.value||""]))}
function applyQuizSettings(settings){for(const id of QUIZ_SETTING_IDS){const el=$(id),value=settings?.[id];if(!el||value===undefined)continue;if(el.tagName==="SELECT"){if([...el.options].some(option=>option.value===value))el.value=value;else if(["quizList","quizFrontLang","quizBackLang","quizScope"].includes(id))el.value="all"}else if(el.type==="number"){const number=Number(value);if(Number.isFinite(number)&&number>0)el.value=String(Math.max(Number(el.min)||1,Math.min(Number(el.max)||300,number)))}else el.value=value}updateQuizModeSettings.lastType=$("quizType").value;updateQuizModeSettings()}
function quizPreferencesKey(){const owner=TN_LOCAL_QA_MODE?"qa":tnActiveStorageUserId;return owner?`tangonest_quiz_preferences_v1:${owner}`:""}
function quizSavedPreferences(){try{const value=JSON.parse(localStorage.getItem(quizPreferencesKey())||"{}");return value&&typeof value==="object"&&!Array.isArray(value)?value:{}}catch(error){return{}}}
function saveQuizPreferences(){const key=quizPreferencesKey();if(!key)return;const previous=quizSavedPreferences(),directions={...quizSavedDirections(),...previous.directions};const settings=captureQuizSettings();if(settings.quizType!=="listening")directions[settings.quizType]=settings.quizDirection;try{localStorage.setItem(key,JSON.stringify({version:1,settings,directions,updatedAt:new Date().toISOString()}))}catch(error){toast(window.TNI18n.t("quiz.settingsSaveFailed"))}}
function renderQuizLanguages(){for(const [id,field] of [["quizFrontLang","frontLang"],["quizBackLang","backLang"]]){const select=$(id);if(!select)continue;const value=select.value||"all",languages=[...new Set(db.words.map(word=>word[field]).filter(Boolean))].sort();select.innerHTML=`<option value="all">${esc(window.TNI18n.t("ui.all"))}</option>`+languages.map(language=>`<option value="${esc(language)}">${esc(window.TangoNestLanguages?.label(language)||language)}</option>`).join("");select.value=languages.includes(value)?value:"all"}}
function quizDirectionsStorageKey(){const owner=TN_LOCAL_QA_MODE?"qa":tnActiveStorageUserId;return owner?`tangonest_quiz_directions_v1:${owner}`:""}
function quizSavedDirections(){try{return JSON.parse(localStorage.getItem(quizDirectionsStorageKey())||"{}")||{}}catch(error){return{}}}
function quizDirectionForType(type,saved=getLastSession()){
  const direction=quizSavedPreferences().directions?.[type]||saved.quizDirections?.[type]||quizSavedDirections()[type]||(saved.quizDirection&&(!saved.quizType||saved.quizType===type)?saved.quizDirection:"");
  return ["front","back"].includes(direction)?direction:type==="typing"?"back":"front";
}
function quizRecordStatus(record){return record.status|| (record.ok?"correct":"incorrect")}
function quizRecords(status){return (quiz.records||[]).filter(record=>!status||quizRecordStatus(record)===status)}
function resetQuiz(){clearQuizTimers();ensureQuizFeedbackDefault();quiz={queue:[],records:[],wrong:[],allWrong:[],index:0,score:0,current:null,answered:false,type:$("quizType")?.value||"choice",direction:$("quizDirection")?.value||"front",total:0,previousQuestionId:"",previousQuestionKey:"",selectedAnswer:null,listeningReplayUsed:0};updateQuizModeSettings();placeTypingArea(false);$("quizSetup").style.display="block";$("quizRun").style.display="none";$("quizEnd").style.display="none";$("pageQuiz")?.classList.remove("quiz-focus-active","quiz-review-active");if($("listeningPanel"))$("listeningPanel").style.display="none";resetQuizAnswerVisualState()}
function beginQuizSession(queue,settings,originSettings=settings,originQueueIds=queue.map(word=>word.id)){
  clearQuizTimers();applyQuizSettings(settings);
  quiz={sessionId:uid(),startedAt:new Date().toISOString(),queue,records:[],wrong:[],allWrong:[],index:0,score:0,current:null,answered:false,ended:false,type:settings.quizType||"choice",direction:settings.quizDirection,total:queue.length,previousQuestionId:"",previousQuestionKey:"",selectedAnswer:null,listeningReplayUsed:0,settings:{...settings},originSettings:{...originSettings},originQueueIds:[...originQueueIds],reviewFilter:"all"};
  $("quizSetup").style.display="none";$("quizRun").style.display="grid";$("quizEnd").style.display="none";$("pageQuiz")?.classList.remove("quiz-review-active");$("pageQuiz")?.classList.add("quiz-focus-active");showQuizQuestion();window.scrollTo(0,0);
}
function startQuiz(){
  ensureQuizFeedbackDefault();updateQuizModeSettings();saveQuizPreferences();const settings=captureQuizSettings();
  const smartWords=smartSessionQueue.length?[...smartSessionQueue]:null;smartSessionQueue=[];
  const words=uniqueStudyWords(smartWords||quizPool(settings));if(!words.length)return toast(window.TNI18n.t("ui.no_words",{}));
  if(smartWords)settings.wordIds=words.map(word=>word.id);
  const requested=Math.max(1,parseInt(settings.quizCount,10)||10);
  beginQuizSession(quizOrderedWords(words).slice(0,requested),settings);
}
function continueQuiz(){
  const settings=quiz.originSettings||quiz.settings;if(!settings)return resetQuiz();
  let words=uniqueStudyWords(quizPool(settings));if(settings.wordIds)words=words.filter(word=>settings.wordIds.includes(word.id));
  if(!words.length)return toast(window.TNI18n.t("quiz.noEligibleWords"));
  const count=Math.min(words.length,Math.max(1,parseInt(settings.quizCount,10)||10));
  const recent=new Set(quiz.originQueueIds||quiz.queue.map(word=>word.id));
  let queue=[...shuffle(words.filter(word=>!recent.has(word.id))),...shuffle(words.filter(word=>recent.has(word.id)))].slice(0,count);
  queue=shuffle(queue);
  if(queue.length>1&&queue.every((word,index)=>word.id===(quiz.originQueueIds||quiz.queue.map(word=>word.id))[index]))queue=[...queue.slice(1),queue[0]];
  beginQuizSession(queue,settings,settings);
}
function resetQuizAnswerVisualState(){quiz.selectedAnswer=null;document.querySelectorAll(".choice").forEach(b=>{b.disabled=false;b.classList.remove("selected","active","correct","incorrect","wrong","is-selected","is-active","is-correct","is-wrong");try{b.blur()}catch(e){}});$("choiceArea")?.classList.remove("is-answered");const result=$("quizResult");if(result){result.className="result-box";result.textContent=""}const answer=$("quizQuestionAnswer");if(answer){answer.className="quiz-question-answer";answer.textContent=""}const front=$("quizQuestionFront");const back=$("quizQuestionBack");if(front)front.setAttribute("aria-hidden","false");if(back)back.setAttribute("aria-hidden","true");const skip=$("quizSkipButton");if(skip)skip.hidden=false;const card=$("quizQuestionCard");if(card){card.classList.remove("is-answered","has-long-answer","is-listening")}}
function quizQuestionKey(word){if(!word)return "";const text=quiz.type==="listening"?listeningPromptText(word):(quiz.direction==="back"?word.back:word.front);return normalize(text)}
function listeningPromptText(word=quiz.current){if(!word)return"";return word.front}
function listeningPromptLang(word=quiz.current){return frontSpeech(word).lang}
function listeningIsHard(){return ($("listeningDifficulty")?.value||"normal")==="hard"}
function listeningReplayLimit(){if(!listeningIsHard())return Infinity;const raw=$("listeningReplayLimit")?.value||"1";return raw==="unlimited"?Infinity:Math.max(1,parseInt(raw,10)||1)}
function listeningTimerLimit(){if(!listeningIsHard())return 0;const raw=$("listeningTimerMode")?.value||"10";return raw==="off"?0:Math.max(2,parseInt(raw,10)||10)}
function updateListeningTimerInline(value){
  const el=$("listeningTimeInline");
  if(el)window.TNI18n.bindText(el,()=>(value?window.TNI18n.t("ui.time_value",{p0:value}):window.TNI18n.t("ui.no_time_limit",{})));
}
function renderListeningPanel(){
  const panel=$("listeningPanel");
  if(!panel)return;
  if(quiz.type!=="listening"||!quiz.current){panel.style.display="none";panel.innerHTML="";placeTypingArea(false);return}
  const limit=listeningReplayLimit();
  const used=Number(quiz.listeningReplayUsed||0);
  const replayText=`${window.TNI18n.t("ui.replay_limit")}: ${limit===Infinity?window.TNI18n.t("ui.unlimited"):Math.max(0,limit-used)}`;
  const timeLimit=listeningTimerLimit();
  const pronunciation=wordPronunciation(quiz.current);
  const hint=$("listeningHintMode")?.value==="on"&&pronunciation?`<span class="listening-hint">${window.TNI18n.mark("ui.pronunciation_value",{p0:esc(pronunciation)})}</span>`:"";
  const input=$("quizAnswer");
  const previousValue=input?.value||"";
  const hadFocus=document.activeElement===input;
  placeTypingArea(false);
  panel.style.display="grid";
  panel.innerHTML=`<div class="listening-main"><button type="button" class="listening-play" onclick="playListeningAudio(true)">${window.TNI18n.mark("ui.play_front",{})}</button><span>${esc(replayText)}</span><span id="listeningTimeInline">${timeLimit?window.TNI18n.mark("ui.time_value",{p0:timeLimit+"s"}):window.TNI18n.mark("ui.no_time_limit")}</span>${hint}</div><div id="listeningInputSlot"></div>`;
  placeTypingArea(true);
  const nextInput=$("quizAnswer");
  if(nextInput){
    nextInput.value=previousValue;
    if(hadFocus)try{nextInput.focus({preventScroll:true})}catch(e){try{nextInput.focus()}catch(err){}}
  }
}
function playListeningAudio(manual){
  if(!quiz.current)return;
  if(quiz.type==="listening"&&manual){
    const limit=listeningReplayLimit();
    const used=Number(quiz.listeningReplayUsed||0);
    if(limit!==Infinity&&used>=limit){renderListeningPanel();return toast(window.TNI18n.t("ui.replay_limit_reached",{}))}
    quiz.listeningReplayUsed=used+1;
  }
  speakFront(quiz.current);
  renderListeningPanel();
}
function focusQuizInput(){
  if(!(quiz.type==="typing"||quiz.type==="listening"))return;
  const input=$("quizAnswer");
  if(!input||quiz.answered||quiz.ended)return;
  const epoch=quizEpoch;
  const focus=()=>{if(epoch!==quizEpoch||quiz.answered||quiz.ended||!input.isConnected)return;try{input.focus({preventScroll:true})}catch(e){try{input.focus()}catch(err){}}};
  // Keep the first focus inside the user's Start/Continue/Retry gesture for mobile keyboards.
  focus();requestAnimationFrame(focus);
}
function showQuizQuestion(){
  clearQuizTimers();resetQuizAnswerVisualState();quiz.answered=false;quiz.selectedAnswer=null;quiz.listeningReplayUsed=0;
  quiz.current=quiz.queue[quiz.index];if(!quiz.current)return endQuiz();
  quizInputReadyAt=performance.now()+(quiz.index>0?350:0);
  window.TNI18n.bindText($("quizProgress"),()=>`${window.TNI18n.t("ui.question")} ${quiz.index+1} / ${quiz.total}`);
  $("quizSessionProgress").max=quiz.total;$("quizSessionProgress").value=quiz.index+1;
  const isListening=quiz.type==="listening";
  $("quizWord").textContent=isListening?"":(quiz.direction==="front"?quiz.current.front:quiz.current.back);
  $("quizPronunciation").textContent=!isListening&&quiz.direction==="front"?wordPronunciation(quiz.current):"";
  window.TNI18n.bindText($("quizLabel"),()=>window.TNI18n.t(isListening?"ui.type_what_you_hear":quiz.type==="choice"?"quiz.chooseMeaning":"ui.type_answer"));
  if(!isListening)placeTypingArea(false);
  $("typingArea").style.display=(quiz.type==="typing"||isListening)?"block":"none";
  $("choiceArea").style.display=quiz.type==="choice"?"grid":"none";
  $("quizAnswer").value="";$("quizAnswer").disabled=false;
  $("quizAnswer").placeholder=window.TNI18n.t(isListening?"ui.type_the_front_word":"ui.type_answer");
  $("quizQuestionCard").classList.toggle("is-listening",isListening);
  renderListeningPanel();if(quiz.type==="choice")renderChoices();
  // Keep the editable input focused across questions; the Enter guard handles rapid repeats.
  $("quizAnswer").readOnly=false;
  if(quiz.index>0){
    document.querySelectorAll(".choice").forEach(button=>button.disabled=true);
    quizInputUnlockTimer=setTimeout(()=>{if(quiz.answered||quiz.ended)return;document.querySelectorAll(".choice").forEach(button=>button.disabled=false);$("quizAnswer").readOnly=false;focusQuizInput()},350);
  }
  startQuestionTimer();focusQuizInput();
  if(quiz.type==="choice")$("quizWord").focus({preventScroll:true});
  if(isListening)quizListeningAudioTimer=setTimeout(()=>{if(!quiz.answered)playListeningAudio(false)},180);
}
function correctAnswer(){return quiz.type==="listening"?listeningPromptText():(quiz.direction==="front"?quiz.current.back:quiz.current.front)}
function correctAnswerLang(){return quiz.type==="listening"?listeningPromptLang():(quiz.direction==="front"?quiz.current.backLang:quiz.current.frontLang)}
function quizAnswerText(word){return quiz.direction==="front"?word.back:word.front}
function quizAnswerLang(word){return quiz.direction==="front"?word.backLang:word.frontLang}
function normalize(s){return String(s||"").trim().toLowerCase()}
function checkTypingAnswer(){if(quiz.answered)return;const input=$("quizAnswer");const value=input?.value||"";if(!value.trim()){focusQuizInput();return}quiz.selectedAnswer=value;finishAnswer(normalize(value)===normalize(correctAnswer()))}
function handleQuizAnswerKey(event){
  if(event.key!=="Enter")return;
  if(event.isComposing||event.keyCode===229)return;
  if(event.repeat){event.preventDefault();return}
  event.preventDefault();
  if(quiz.ended)return;
  if(performance.now()<quizInputReadyAt&&!quiz.answered&&!$("quizAnswer").value.trim())return;
  if(quiz.answered)return nextQuizQuestion();
  if(!$("quizAnswer").value.trim())return finishAnswer(false,"skipped");
  checkTypingAnswer();
}
function renderChoices(){
  let correct=correctAnswer();
  const currentList=quiz.current.listId;
  const answerLang=correctAnswerLang();
  const pool=[];
  const seen=new Set([normalize(correct)]);
  const addFrom=words=>{
    words.forEach(w=>{
      const value=quizAnswerText(w);
      const key=normalize(value);
      if(!key||seen.has(key))return;
      seen.add(key);
      pool.push(value);
    });
  };
  addFrom((db.words||[]).filter(w=>w.listId===currentList&&quizAnswerLang(w)===answerLang));
  addFrom((db.words||[]).filter(w=>quizAnswerLang(w)===answerLang));
  pool.sort(()=>Math.random()-.5);
  pool.splice(3);
  let choices=shuffle([correct,...pool]);
  quiz.currentChoices=choices;
  $("choiceArea").innerHTML=choices.map((c,index)=>`<button type="button" class="choice" dir="auto" lang="${esc(answerLang)}" data-shortcut="${index+1}" onclick="chooseAnswer(this,quiz.currentChoices[${index}])" aria-label="${index+1}. ${esc(c)}">${esc(c)}</button>`).join("");
}
function chooseAnswer(btn,ans){if(quiz.answered||!btn?.isConnected||performance.now()<quizInputReadyAt)return;quiz.selectedAnswer=ans;let ok=normalize(ans)===normalize(correctAnswer());[...document.querySelectorAll(".choice")].forEach(b=>{b.disabled=true;b.classList.remove("selected","active","correct","incorrect","wrong","is-selected","is-active","is-correct","is-wrong");try{b.blur()}catch(e){};if(normalize(b.textContent)===normalize(correctAnswer()))b.classList.add("correct")});btn.classList.add("selected");if(!ok)btn.classList.add("wrong");finishAnswer(ok)}
function quizLearningMessage(word,ok){if(!word)return"";const view=learningPresentation();const state=view?.state(word);const review=view?.review(word);return [state?.label,review?.label,!ok?window.TNI18n.t("quiz.reviewMore"):""].filter(Boolean).join(" · ")}
function quizWordNotes(word,answerIsFront){
  const pronunciation=wordPronunciation(word),language=word?.frontLang||"";
  return {pronunciation,pronunciationLang:language,pronunciationLabel:/^zh(?:-|$)/i.test(language)?"quiz.pinyin":"quiz.pronunciation",pronunciationIsAnswer:answerIsFront,example:String(word?.memo||"").trim(),exampleLang:language};
}
function quizPronunciationHtml(notes){if(!notes?.pronunciation)return"";const label=notes.pronunciationIsAnswer?notes.pronunciationLabel:"quiz.frontPronunciation";return `<p class="quiz-answer-pronunciation"><span>${window.TNI18n.mark(label)}</span><bdi lang="${esc(notes.pronunciationLang)}">${esc(notes.pronunciation)}</bdi></p>`}
function quizExampleHtml(notes){return notes?.example?`<p class="quiz-answer-example"><span>${window.TNI18n.mark("ui.example")}</span><bdi lang="${esc(notes.exampleLang)}">${esc(notes.example)}</bdi></p>`:""}
function quizFeedbackHtml(ok,status=ok?"correct":"incorrect"){
  const selected=quiz.selectedAnswer||($("quizAnswer")?.value||"").trim()||window.TNI18n.t("quiz.noAnswer");
  const answer=`<bdi lang="${esc(correctAnswerLang())}">${esc(correctAnswer())}</bdi>`;
  const detail=(status==="incorrect"?`<span>${window.TNI18n.mark("ui.your_answer_value_2",{p1:`<bdi>${esc(selected)}</bdi>`})}</span>`:"")+`<span>${window.TNI18n.mark("ui.correct_answer_value",{p0:answer})}</span>`;
  const notes=quiz.records?.at(-1)?.notes||quizWordNotes(quiz.current,quiz.type==="listening"||quiz.direction==="back");
  const extra=quizExampleHtml(notes);
  return `<div class="quiz-feedback-copy"><strong>${window.TNI18n.t(status==="skipped"?"quiz.skipped":ok?"quiz.correctFeedback":"quiz.incorrectFeedback")}</strong>${detail}${quizPronunciationHtml(notes)}${extra}<span id="quizAdvanceStatus"></span></div><div class="quiz-feedback-actions"><button type="button" class="quiz-answer-audio" onclick="speakCorrectAnswer()">${window.TNI18n.mark("quiz.playAnswer")}</button><button type="button" class="quiz-next-btn" onclick="nextQuizQuestion()">${window.TNI18n.mark("common.next")}</button>${isAutoAdvance()?`<button type="button" id="quizPauseAdvance" onclick="toggleQuizAdvance()">${window.TNI18n.mark("quiz.pauseAdvance")}</button>`:""}</div>`;
}
function renderQuizQuestionAnswer(){
  // Keep the prompt in place; feedback belongs to the single status region below the choices.
  $("quizQuestionCard")?.classList.add("is-answered");
}
function finishAnswer(ok,status=ok?"correct":"incorrect"){
  if(quiz.answered||!quiz.current||quiz.ended)return;
  quiz.answered=true;
  quiz.previousQuestionId=quiz.current.id;quiz.previousQuestionKey=quizQuestionKey(quiz.current);
  clearInterval(quizTimerInterval);clearTimeout(quizListeningAudioTimer);
  const selected=quiz.selectedAnswer||$("quizAnswer")?.value||"";
  quiz.records=quiz.records||[];
  quiz.records.push({id:quiz.current.id,ok,status,eventId:status==="skipped"?null:learningEventId(),question:quiz.type==="listening"?listeningPromptText():(quiz.direction==="front"?quiz.current.front:quiz.current.back),answer:correctAnswer(),answerLang:correctAnswerLang(),selectedAnswer:status==="skipped"?"":selected,word:{...quiz.current},type:quiz.type,direction:quiz.direction});
  quiz.records.at(-1).notes=quizWordNotes(quiz.current,quiz.type==="listening"||quiz.direction==="back");
  if(status!=="skipped"){
    if(ok){quiz.score++;markMistakeCorrect(quiz.current.id)}
    else{recordMistake(quiz.current,quiz.type||"quiz",selected,correctAnswer());quiz.wrong.push(quiz.current);if(!quiz.allWrong.some(w=>w.id===quiz.current.id))quiz.allWrong.push(quiz.current)}
    updateWordLearning(quiz.current.id,ok?"good":"again",{mode:quiz.type||"quiz",eventId:quiz.records.at(-1).eventId});
  }
  $("quizAnswer").readOnly=true;
  $("quizResult").className="result-box show "+(status==="skipped"?"skipped":ok?"ok":"no");$("quizResult").innerHTML=quizFeedbackHtml(ok,status);
  $("choiceArea")?.classList.add("is-answered");renderQuizQuestionAnswer();
  $("quizSkipButton").hidden=true;$("quizScore").textContent=quiz.score+" / "+quiz.total;
  scheduleNext(ok,status);
}
function isAutoAdvance(){const mode=$("quizAutoAdvance")?.value||"auto";return mode!=="manual"&&mode!=="off"}
const QUIZ_NEXT_TIMING=Object.freeze({correct:2000,incorrect:2000,skipped:2000});
function nextDelay(ok){const mode=$("quizAutoAdvance")?.value||"auto";if(mode==="auto")return ok?QUIZ_NEXT_TIMING.correct:QUIZ_NEXT_TIMING.incorrect;let v=mode==="manual"||mode==="off"?2.5:parseFloat(mode);if(!Number.isFinite(v))v=2.5;v=Math.max(1.2,Math.min(10,v));return Math.round(v*1000)}
function scheduleNext(ok,status=ok?"correct":"incorrect"){
  clearTimeout(quizAutoTimer);
  const state=quizFeedback={epoch:quizEpoch,ok,status,paused:document.hidden,displayed:false,minDone:false,audioDone:$("quizAudioAfter").value!=="on",failed:false,advanced:false};
  // Two frames ensure the feedback has been painted before its reading time starts.
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(quizFeedback!==state)return;
    state.displayed=true;
    if(!state.paused)armQuizFeedback(state);
    if(!state.audioDone&&!document.hidden)playQuizFeedbackAudio(state);
    updateQuizAdvanceControl();
  }));
}
function armQuizFeedback(state,delay=nextDelay(state.ok)){
  clearTimeout(quizAutoTimer);state.minDone=false;
  if(state.paused||document.hidden||quizFeedback!==state)return;
  quizAutoTimer=setTimeout(()=>{if(quizFeedback!==state)return;state.minDone=true;maybeAdvanceQuiz(state)},delay);
}
async function playQuizFeedbackAudio(state,review=false){
  const attempt=(state.audioAttempt||0)+1;state.audioAttempt=attempt;state.audioDone=false;
  let timeout;
  const watchdog=new Promise(resolve=>{timeout=setTimeout(()=>{if(quizFeedback===state&&state.audioAttempt===attempt)cancelSpeech();resolve(false)},speechWatchdogDelay(correctAnswer())+1000)});
  let ok=false;
  try{ok=await Promise.race([speak(correctAnswer(),correctAnswerLang(),{strict:true}),watchdog])}catch(error){}
  clearTimeout(timeout);
  if(quizFeedback!==state||state.audioAttempt!==attempt)return;
  state.audioDone=true;state.failed=!ok;state.reviewing=false;
  if(!ok)toast(window.TNI18n.t("ui.voice_playback_failed_try_another_voice_in_settings"));
  if(review&&!state.paused)armQuizFeedback(state,600);
  updateQuizAdvanceControl();maybeAdvanceQuiz(state);
}
function maybeAdvanceQuiz(state){
  if(quizFeedback!==state||state.epoch!==quizEpoch||state.advanced||state.paused||state.reviewing||document.hidden||!state.minDone||!isAutoAdvance())return;
  state.advanced=true;advanceQuiz();
}
function updateQuizAdvanceControl(){
  const state=quizFeedback;if(!state)return;
  window.TNI18n.bindText($("quizPauseAdvance"),()=>window.TNI18n.t(state.paused?"quiz.resumeAdvance":"quiz.pauseAdvance"));
  window.TNI18n.bindText($("quizAdvanceStatus"),()=>state.failed?window.TNI18n.t("ui.voice_playback_failed_try_another_voice_in_settings"):state.paused?window.TNI18n.t("ui.paused"):!state.audioDone?window.TNI18n.t("ui.now_playing"):isAutoAdvance()?window.TNI18n.t("quiz.advancing"):"");
}
function toggleQuizAdvance(){
  if(!quizFeedback)return;
  if(!quizFeedback.paused)return pauseQuizAdvance();
  if(document.hidden)return;
  quizFeedback.paused=false;if(!quizFeedback.audioDone&&!quizFeedback.audioAttempt)playQuizFeedbackAudio(quizFeedback);armQuizFeedback(quizFeedback);updateQuizAdvanceControl();
}
function advanceQuiz(){if(!quiz.current||!quiz.answered||quiz.ended)return;clearQuizTimers();quiz.index++;if(quiz.index>=quiz.queue.length)return endQuiz();showQuizQuestion()}
function nextQuizQuestion(allowSkip=false){if(!quiz.current||quiz.ended||(!quiz.answered&&performance.now()<quizInputReadyAt))return;if(!quiz.answered){if(allowSkip)finishAnswer(false,"skipped");return}advanceQuiz()}
function speakQuizQuestion(){if(!quiz.current)return;if(quiz.answered)return speakCorrectAnswer();if(quiz.type==="listening")return playListeningAudio(true);return speak(quiz.direction==="back"?quiz.current.back:quiz.current.front,quiz.direction==="back"?quiz.current.backLang:quiz.current.frontLang,{strict:true})}
function pauseQuizAdvance(){clearTimeout(quizAutoTimer);if(quizFeedback){quizFeedback.paused=true;updateQuizAdvanceControl()}}
function speakCorrectAnswer(){if(!quiz.current||!quiz.answered)return;if(quizFeedback){clearTimeout(quizAutoTimer);quizFeedback.minDone=false;quizFeedback.reviewing=true;playQuizFeedbackAudio(quizFeedback,true);updateQuizAdvanceControl()}else speak(correctAnswer(),correctAnswerLang(),{strict:true})}
function speakQuizFront(){return speakQuizQuestion()}
function speakQuizBack(){if(!quiz.current)return;speak(quiz.current.back,quiz.current.backLang)}
function clearQuizTimers(){quizEpoch++;if(quizFeedback&&!quizFeedback.audioDone)cancelSpeech();quizFeedback=null;clearTimeout(quizInputUnlockTimer);clearTimeout(quizAutoTimer);clearTimeout(quizListeningAudioTimer);clearInterval(quizTimerInterval);quizAutoTimer=null;quizListeningAudioTimer=null;quizTimerInterval=null}
document.addEventListener("visibilitychange",()=>{
  if(document.hidden){quizHiddenAt=Date.now();pauseQuizAdvance();if(quizFeedback&&!quizFeedback.audioDone)cancelSpeech()}
  else if(quizHiddenAt){quizQuestionStartedAt+=Date.now()-quizHiddenAt;quizHiddenAt=0}
});
function startQuestionTimer(){
  const wrap=$("quizTimerWrap"),fill=$("quizTimerFill"),text=$("quizTimerText"),label=$("quizTimerLabel");
  if(!wrap||!fill||!text)return;
  const limit=quiz.type==="listening"?listeningTimerLimit():$("quizHardMode").value==="on"?Math.max(2,parseInt($("quizTimeLimit").value||"8",10)):0;
  if(!limit){wrap.classList.remove("show");window.TNI18n.bindText(label,()=>window.TNI18n.t("ui.time_limit_off"));text.textContent="";fill.style.width="0%";fill.classList.remove("danger");if(quiz.type==="listening")updateListeningTimerInline("");return}
  quizQuestionStartedAt=Date.now();quizHiddenAt=document.hidden?Date.now():0;
  wrap.classList.toggle("show",quiz.type!=="listening");window.TNI18n.bindText(label,()=>window.TNI18n.t(quiz.type==="listening"?"ui.listening_timer":"ui.time_limit"));
  fill.style.width="100%";fill.classList.remove("danger");text.textContent=limit+"s";if(quiz.type==="listening")updateListeningTimerInline(limit+"s");
  quizTimerInterval=setInterval(()=>{
    if(quiz.answered){clearInterval(quizTimerInterval);return}
    if(document.hidden)return;
    const remain=Math.max(0,limit-(Date.now()-quizQuestionStartedAt)/1000),pct=remain/limit*100;
    fill.style.width=pct+"%";fill.classList.toggle("danger",pct<30);
    const shown=Math.ceil(remain)+"s";text.textContent=shown;if(quiz.type==="listening")updateListeningTimerInline(shown);
    if(remain<=0){clearInterval(quizTimerInterval);finishAnswer(false)}
  },200);
}
function renderQuizSummary(){
  const box=$("quizResultSummary");if(!box)return;
  const records=quizRecords(),graded=records.filter(record=>quizRecordStatus(record)!=="skipped");
  const wrong=quizRecords("incorrect").length,skipped=quizRecords("skipped").length;
  const accuracy=graded.length?Math.round(quiz.score/graded.length*100):null;
  const improved=new Set(quizRecords("correct").map(record=>record.id)).size;
  const studied=Array.from(new Set(graded.map(record=>record.id))).map(id=>db.words.find(word=>word.id===id)).filter(Boolean);
  const stillWeak=studied.filter(word=>learningEngine()?.isWeakWord(word)).length;
  const next=!records.length?window.TNI18n.t("quiz.noAnswer"):wrong||skipped?window.TNI18n.t("quiz.retryMistakes"):window.TNI18n.t("ui.no_wrong_answers_great_job");
  box.innerHTML=`
    <div><b>${quiz.score}</b><span>${window.TNI18n.mark("ui.correct",{})}</span></div>
    <div><b>${wrong}</b><span>${window.TNI18n.mark("ui.wrong",{})}</span></div>
    <div><b>${skipped}</b><span>${window.TNI18n.mark("quiz.skipped",{})}</span></div>
    <div><b>${accuracy===null?"—":accuracy+"%"}</b><span>${window.TNI18n.mark("ui.accuracy",{})}</span></div>
    <div class="quiz-summary-secondary"><b>${improved}</b><span>${window.TNI18n.mark("ui.improved",{})}</span></div>
    <div class="quiz-summary-secondary"><b>${stillWeak}</b><span>${window.TNI18n.mark("ui.still_weak",{})}</span></div>
    <div class="wide"><span>${window.TNI18n.mark("quiz.answeredCount",{count:graded.length,total:quiz.total})}</span><strong>${esc(next)}</strong></div>`;
}
function endQuiz(){
  quiz.ended=true;clearQuizTimers();cancelSpeech();$("quizRun").style.display="none";$("quizEnd").style.display="block";$("pageQuiz")?.classList.remove("quiz-focus-active");$("pageQuiz")?.classList.add("quiz-review-active");
  window.TNI18n.bindText($("quizEndText"),()=>window.TNI18n.t("ui.score_value_value",{p0:quiz.score,p1:quizRecords().filter(record=>quizRecordStatus(record)!=="skipped").length}));
  $("quizRetryMistakes").hidden=!quizRecords().some(record=>quizRecordStatus(record)!=="correct");
  renderQuizSummary();renderWrongList();render();window.tnStudyContinuity?.complete("quiz");
  if(quiz.records?.length){try{quiz.sessionId=quiz.sessionId||uid();const result={sessionId:quiz.sessionId,startedAt:quiz.startedAt,endedAt:new Date().toISOString(),settings:quiz.settings||captureQuizSettings(),total:quiz.total,score:quiz.score,records:quiz.records};const previous=getLastSession().quizResults||[];setLastSession({quizResults:[result,...previous.filter(entry=>entry.sessionId!==result.sessionId)].slice(0,20)})}catch(error){toast(window.TNI18n.t("quiz.historySaveFailed"))}}
  $("quizEndHeading").focus({preventScroll:true});
  window.scrollTo(0,0);
}
function renderWrongList(){
  const box=$("quizWrongList"),records=quizRecords();if(!records.length){box.innerHTML="";return}
  const filter=quiz.reviewFilter||"all";
  const filters=[["all","ui.all"],["incorrect","ui.wrong"],["skipped","quiz.skipped"],["correct","ui.correct"]];
  box.innerHTML=`<h3>${window.TNI18n.mark("quiz.reviewAnswers")}</h3><p class="desc">${window.TNI18n.mark("quiz.reviewHint")}</p><div class="quiz-review-filters" role="group" aria-label="${esc(window.TNI18n.t("quiz.reviewAnswers"))}">${filters.map(([value,key])=>`<button type="button" class="btn" data-quiz-review-filter="${value}" aria-pressed="${value===filter}" onclick="setQuizReviewFilter('${value}')">${window.TNI18n.mark(key)} (${value==="all"?records.length:quizRecords(value).length})</button>`).join("")}</div>`;
  const rows=records.map((record,index)=>({record,index})).filter(({record})=>filter==="all"||quizRecordStatus(record)===filter);
  box.innerHTML+=rows.length?rows.map(({record,index})=>{
    const status=quizRecordStatus(record),live=db.words.find(word=>word.id===record.id),word=record.word||live||{};
    const direction=record.direction||quiz.direction;
    const question=record.question??(quiz.type==="listening"?word.front:direction==="front"?word.front:word.back)??"";
    const answer=record.answer??(direction==="front"?word.back:word.front)??"";
    const selected=status==="skipped"?window.TNI18n.t("quiz.skipped"):record.selectedAnswer||window.TNI18n.t("quiz.noAnswer");
    const label=status==="skipped"?"quiz.skipped":status==="correct"?"ui.correct":"ui.wrong";
    const id=jsArg(record.id),notes=record.notes||quizWordNotes(word,(record.type||quiz.type)==="listening"||direction==="back");
    const pronunciation=notes.pronunciationIsAnswer&&notes.pronunciation?`<small class="quiz-review-reading" lang="${esc(notes.pronunciationLang)}">${esc(notes.pronunciation)}</small>`:"";
    return `<details class="quiz-review-card" data-quiz-review-status="${status}" ${quiz.reviewExpanded?.includes(index)?"open":""} ontoggle="setQuizReviewExpanded(${index},this.open)"><summary><span class="quiz-review-status ${status}">${window.TNI18n.mark(label)}</span><span class="quiz-review-overview"><bdi class="quiz-review-question">${esc(question)}</bdi><bdi class="quiz-review-answer" lang="${esc(record.answerLang||"")}">${esc(answer)}</bdi>${pronunciation}</span><span class="quiz-review-chevron" aria-hidden="true">⌄</span></summary><div class="quiz-review-expanded"><div class="quiz-review-copy"><p><span>${window.TNI18n.mark("ui.question")}</span><bdi>${esc(question)}</bdi></p><p><span>${window.TNI18n.mark("ui.your_answer")}</span><bdi>${esc(selected)}</bdi></p><p><span>${window.TNI18n.mark("ui.correct_answer_value",{p0:""})}</span><bdi lang="${esc(record.answerLang||"")}">${esc(answer)}</bdi></p>${quizPronunciationHtml(notes)}${quizExampleHtml(notes)}</div><div class="quiz-wrong-actions"><button type="button" onclick="playQuizReviewAnswer(${index})">${window.TNI18n.mark("quiz.playAnswer")}</button>${live?`<button type="button" class="${live.saved?'starred':''}" onclick="toggleQuizWrongStar(${id})">${live.saved?window.TNI18n.t("ui.saved"):window.TNI18n.t("ui.save")}</button><button type="button" onclick="openDetail(${id})">${window.TNI18n.mark("ui.detail")}</button>`:""}</div></div></details>`;
  }).join(""):`<p class="empty">${window.TNI18n.mark("quiz.emptyReview")}</p>`;
}
function setQuizReviewExpanded(index,open){const expanded=new Set(quiz.reviewExpanded||[]);if(open)expanded.add(index);else expanded.delete(index);quiz.reviewExpanded=[...expanded]}
function setQuizReviewFilter(filter){quiz.reviewFilter=filter;renderWrongList();document.querySelector(`[data-quiz-review-filter="${filter}"]`)?.focus({preventScroll:true})}
function reviewAllQuizAnswers(){setQuizReviewFilter("all");$("quizWrongList").scrollIntoView({block:"start"})}
function playQuizReviewAnswer(index){const record=quiz.records?.[index];if(!record)return;const word=record.word||db.words.find(word=>word.id===record.id);if(record.answer!==undefined)return speak(record.answer,record.answerLang,{strict:true});if(word)return speakFront(word)}
function playQuizWrongFront(id){const word=db.words.find(word=>word.id===id)||(quiz.allWrong||[]).find(word=>word.id===id);if(word)return speakFront(word)}
function toggleQuizWrongStar(id){toggleStar(id);renderWrongList()}
function retryQuizRecords(status){
  const ids=new Set(quizRecords().filter(record=>status?quizRecordStatus(record)===status:quizRecordStatus(record)!=="correct").map(record=>record.id)),words=uniqueStudyWords(db.words.filter(word=>ids.has(word.id)));
  if(!words.length)return toast(window.TNI18n.t("quiz.noEligibleWords"));
  const settings=quiz.settings||captureQuizSettings(),origin=quiz.originSettings||settings;
  beginQuizSession(shuffle(words),settings,origin,quiz.originQueueIds||quiz.queue.map(word=>word.id));
}
function restartWrongQuiz(){retryQuizRecords()}
function restartSkippedQuiz(){retryQuizRecords("skipped")}
function audioWords(){let list=$("audioList").value,order=$("audioOrder").value;let words=uniqueStudyWords(list==="all"?[...db.words]:db.words.filter(w=>(w.listId||"")===(list||"")));if(order==="star")words=words.filter(w=>w.saved);if(order==="due")words=words.filter(isDue);if(order==="hard")words=[...words].sort((a,b)=>Number(learningEngine()?.isWeakWord(b))-Number(learningEngine()?.isWeakWord(a))||quizLearningWeight(b)-quizLearningWeight(a));if(order==="random")words=shuffle(words);return words}
function setAudioPlayerState(state){const player=$("audioNow")?.closest(".now-playing");if(player)player.dataset.state=state;window.tnListenReading?.state(state)}
let listenRun={phase:"idle",part:0,errors:[],consecutive:0,beforePause:"idle"};
const LISTEN_PREF_KEY="tangonest_listen_options_v1";
function listenParts(word){
  const front={...frontSpeech(word),field:"front",strict:true},back={text:word.back,lang:word.backLang,field:"back"},example={text:word.memo,lang:frontSpeech(word).lang,field:"example",strict:true};
  const patterns={front:[front],back:[back],frontBack:[front,back],backFront:[back,front],frontBackExample:[front,back,example]};
  return (patterns[$("audioPattern").value]||patterns.front).filter(part=>part.field==="front"||sanitizeSpeechText(part.text));
}
function listenState(phase){
  listenRun.phase=phase;setAudioPlayerState(phase);
  $("audioPlayButton")?.setAttribute("aria-pressed",String(["playing","preparing","waiting"].includes(phase)));
}
function invalidateListen(){audioRunToken++;clearTimeout(audioTimer);audioTimer=null;cancelSpeech()}
function startAudio(){
  if(["playing","preparing","waiting"].includes(listenRun.phase))return;
  const resume=audioQueue.length&&(audioPaused||["paused","unavailable","error"].includes(listenRun.phase));
  invalidateListen();audioPaused=false;listenRun.once=false;
  if(resume){
    listenRun.consecutive=0;
    if(listenRun.beforePause==="waiting"&&listenRun.part>=listenParts(audioQueue[audioIndex-1]).length)return scheduleAudioNext(audioRunToken);
    return playAudioCurrent(true);
  }
  audioQueue=audioWords();audioIndex=0;listenRun={phase:"idle",part:0,errors:[],consecutive:0,beforePause:"idle"};
  if(!audioQueue.length)return toast(window.TNI18n.t("ui.no_words"));
  playAudioCurrent();
}
function pauseAudio(){
  if(["idle","completed"].includes(listenRun.phase))return;
  listenRun.beforePause=listenRun.phase;invalidateListen();audioPaused=true;listenState("paused");
}
function stopAudio(){
  invalidateListen();audioPaused=false;audioIndex=0;audioQueue=[];listenRun={phase:"idle",part:0,errors:[],consecutive:0,beforePause:"idle"};
  $("audioNow").textContent="";window.TNI18n.bindText($("audioSub"),()=>window.TNI18n.t("ui.choose_a_playlist_and_press_play"));
  $("audioPronunciation").textContent="";$("audioExample").textContent="";$("audioPosition").textContent="0 / 0";$("audioSeek").disabled=true;listenState("idle");
}
async function playAudioOnce(){
  stopAudio();audioQueue=audioWords();if(!audioQueue.length)return toast(window.TNI18n.t("ui.no_words"));
  listenRun.once=true;return playAudioCurrent();
}
function selectAudioItem(index,play=!audioPaused){
  invalidateListen();if(!audioQueue.length)audioQueue=audioWords();
  if(!audioQueue.length)return;
  index=Math.max(0,Math.min(audioQueue.length-1,index));listenRun.part=0;listenRun.beforePause="paused";
  audioPaused=!play;audioIndex=index+1;updateNow(audioQueue[index]);
  if(!play)return listenState("paused");
  audioIndex=index;playAudioCurrent();
}
function nextAudio(){selectAudioItem(Math.min(audioQueue.length-1,audioIndex))}
function previousAudio(){selectAudioItem(Math.max(0,audioIndex-2))}
function scheduleAudioNext(token){
  if(token!==audioRunToken||audioPaused)return;
  const repeat=$("audioRepeat")?.value||"off";
  if(listenRun.once||!$("audioAutoPlay").checked){audioPaused=true;listenState("paused");return}
  if(audioIndex>=audioQueue.length&&repeat==="off"){listenState("completed");window.tnStudyContinuity?.complete("listen");return}
  listenState("waiting");
  const seconds=Number($("audioIntervalCustom").value);
  audioTimer=setTimeout(()=>{
    if(token!==audioRunToken||audioPaused||listenRun.phase!=="waiting")return;
    if(repeat==="word")audioIndex=Math.max(0,audioIndex-1);
    else if(audioIndex>=audioQueue.length)audioIndex=0;
    playAudioCurrent();
  },Math.max(0,Number.isFinite(seconds)?seconds:.4)*1000);
}
async function playAudioCurrent(resumePart=false){
  if(audioPaused||!audioQueue.length)return;
  const token=audioRunToken;
  const index=resumePart?Math.max(0,audioIndex-1):audioIndex;
  if(index>=audioQueue.length){listenState("completed");return}
  const word=audioQueue[index],parts=listenParts(word);
  audioIndex=index+1;if(!resumePart)listenRun.part=0;
  updateNow(word);listenState("preparing");
  let failure=null;
  cancelSpeech();
  for(let part=listenRun.part;part<parts.length;part++){
    if(token!==audioRunToken||audioPaused)return;
    listenRun.part=part;
    const item=parts[part];let reason="";
    const ok=await speak(item.text,item.lang,{strict:item.strict,cancel:false,onstart:()=>{if(token===audioRunToken&&!audioPaused)listenState("playing")},onerror:error=>{reason=error}});
    if(token!==audioRunToken||audioPaused)return;
    if(!ok){failure={wordId:word.id,part:item.field,reason:reason||"speech-failed"};break}
    listenRun.part=part+1;
    if(part<parts.length-1){listenState("preparing");if(!await speechGap(Math.max(0,Number($("pairGapCustom").value)||0)*1000,speechEpoch))return;}
  }
  if(token!==audioRunToken||audioPaused)return;
  if(!parts.length)failure={wordId:word.id,part:"empty",reason:"empty-item"};
  if(failure){
    listenRun.errors.push(failure);listenRun.consecutive++;
    const blocked=["not-allowed","audio-busy","audio-hardware","voice-unavailable","language-unavailable","synthesis-unavailable","timeout"].includes(failure.reason);
    toast(window.TNI18n.t("ui.voice_playback_failed_try_another_voice_in_settings"));
    if(blocked||listenRun.consecutive>=2){audioPaused=true;listenRun.beforePause="error";listenState("error");return}
  }else listenRun.consecutive=0;
  scheduleAudioNext(token);
}
function updateNow(w){
  window.TNI18n.unbind($("audioSub"));
  $("audioNow").textContent=w.front;$("audioNow").lang=w.frontLang||"";
  $("audioSub").textContent=w.back;$("audioSub").lang=w.backLang||"";
  $("audioPronunciation").textContent=wordPronunciation(w);$("audioExample").textContent=String(w.memo||"").trim();$("audioExample").lang=w.frontLang||"";
  for(const id of ["audioSub","audioPronunciation","audioExample"])$(id).hidden=!$(id).textContent.trim();
  $("audioPosition").textContent=`${audioIndex} / ${audioQueue.length}`;
  const seek=$("audioSeek");seek.max=String(Math.max(1,audioQueue.length));seek.value=String(Math.max(1,audioIndex));seek.disabled=!audioQueue.length;
  window.TangoNestMotion?.enter($("audioNow"),true);window.tnListenReading?.update();
}
$("audioSeek")?.addEventListener("change",event=>selectAudioItem(Number(event.target.value)-1));
$("audioList")?.addEventListener("change",stopAudio);
for(const id of ["audioPattern","audioRate","audioOrder"]){
  $(id)?.addEventListener("change",()=>{
    if(!audioQueue.length)return;
    if(id==="audioOrder")return stopAudio();
    const play=!audioPaused&&["playing","preparing","waiting"].includes(listenRun.phase);
    selectAudioItem(Math.max(0,audioIndex-1),play);
  });
}
function restoreListenOptions(){
  let prefs={};try{prefs=JSON.parse(localStorage.getItem(LISTEN_PREF_KEY)||"{}")}catch(error){}
  if(prefs.migration!=="fdg14"){prefs.auto=true;prefs.repeat="off";prefs.migration="fdg14"}
  $("audioAutoPlay").checked=prefs.auto!==false;
  $("audioRepeat").value=["off","all","word"].includes(prefs.repeat)?prefs.repeat:"off";
  if(Number.isFinite(prefs.interval))$("audioIntervalCustom").value=String(prefs.interval);
  const save=()=>{try{localStorage.setItem(LISTEN_PREF_KEY,JSON.stringify({migration:"fdg14",auto:$("audioAutoPlay").checked,repeat:$("audioRepeat").value,interval:Number($("audioIntervalCustom").value)}))}catch(error){}};
  save();
  for(const id of ["audioAutoPlay","audioRepeat","audioIntervalCustom"])$(id).addEventListener("change",()=>{
    save();
    if(listenRun.phase==="waiting"){clearTimeout(audioTimer);scheduleAudioNext(audioRunToken)}
  });
}
restoreListenOptions();
document.addEventListener("visibilitychange",()=>{if(document.hidden&&["preparing","playing","waiting"].includes(listenRun.phase))pauseAudio()});
function speakByPattern(w){return speakPair(w,$("audioPattern").value)}
function speakPair(w,p,opts={}){
  const front={text:w.front,lang:w.frontLang},back={text:w.back,lang:w.backLang},example={text:w.memo,lang:w.frontLang};
  const parts={front:[front],back:[back],frontBack:[front,back],backFront:[back,front],frontBackExample:[front,back,example]}[p]||[front,back];
  return speakQueued(parts,Math.max(0,Number($("pairGapCustom")?.value)||0)*1000,opts);
}

function downloadBackupFile(){
  const data=typeof window.tnBuildSafeExportData==="function"
    ? window.tnBuildSafeExportData()
    : {app:"TangoNest",version:"backup-v2",exportedAt:new Date().toISOString(),data:db};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="tangonest_backup_"+new Date().toISOString().slice(0,10)+".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast(window.TNI18n.t("ui.backup_downloaded",{}));
}

function exportDataText(){
  const data=typeof window.tnBuildSafeExportData==="function"
    ? window.tnBuildSafeExportData()
    : {app:"TangoNest",version:"backup-v2",exportedAt:new Date().toISOString(),data:db};
  const text=JSON.stringify(data,null,2),box=$("syncDataBox");
  box.value=text;box.focus();box.select();
  if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(text).then(()=>toast(window.TNI18n.t("ui.copied_export_data",{}))).catch(()=>toast(window.TNI18n.t("ui.export_data_is_ready",{})));
  else toast(window.TNI18n.t("ui.export_data_is_ready_copy_the_text",{}));
}
function importDataText(){
  if(typeof window.tnImportDataToCloud==="function")return window.tnImportDataToCloud();
  toast(window.TNI18n.t("ui.import_requires_a_signed_in_account_with_online_sync_available",{}));
}
function clearLocalCache(){
  if(typeof window.tnClearLocalCache==="function")return window.tnClearLocalCache();
  if(!confirm(window.TNI18n.t("ui.clear_this_browser_cache_cloud_data_will_be_loaded_again_after_sync",{})))return;
  tnPurgeUserStorage(tnActiveStorageUserId);
  db=tnEmptyData("manual-clear-local-cache");shareDb();resetCard();resetQuiz();render();toast(window.TNI18n.t("ui.local_cache_cleared",{}));
}
function deleteAllAccountData(){
  if(typeof window.tnDeleteAllAccountData==="function")return window.tnDeleteAllAccountData();
  toast(window.TNI18n.t("ui.sign_in_with_online_sync_available_before_deleting_cloud_data",{}));
}
function clearAll(){return clearLocalCache()}

let VOICES_READY=false;
let VOICE_CACHE=[];
const BEST_VOICE_CACHE=new Map();
let voiceLoadStarted=false;
const VOICE_PREF_KEY="tangonest_voice_preferences_v1";
const VOICE_LANGUAGE_SETTINGS=window.TangoNestLanguages.registry.map(item=>({lang:item.ttsLocale,label:item.name,sample:item.sample}));
function loadVoicePrefs(){try{return JSON.parse(localStorage.getItem(VOICE_PREF_KEY)||"{}")||{}}catch(e){return{}}}
function saveVoicePrefs(prefs){try{localStorage.setItem(VOICE_PREF_KEY,JSON.stringify(prefs||{}))}catch(e){}}
function voiceIdentity(v){return [v?.voiceURI||"",v?.name||"",v?.lang||""].join("||")}

function normalizeVoiceLang(lang){
  return window.TangoNestLanguages.normalize(lang);
}
window.tnNormalizeVoiceLang = normalizeVoiceLang;
function sanitizeSpeechText(text){
  return String(text||"")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi," ")
    .replace(/<[^>]*>/g," ")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g," ")
    .replace(/[|｜]/g,", ")
    .replace(/\s*\/\s*/g,", ")
    .replace(/[()[\]{}<>]/g," ")
    .replace(/[“”"]/g,"")
    .replace(/\s+/g," ")
    .trim();
}
function cleanSpeechText(text){return sanitizeSpeechText(text)}
window.sanitizeSpeechText = sanitizeSpeechText;
window.tnCleanSpeechText = sanitizeSpeechText;
function inferSpeechLanguage(text,lang){
  const cleaned=String(text||"").trim();
  const selected=normalizeVoiceLang(lang);
  if(lang&&window.TangoNestLanguages.find(selected))return selected;
  if(/[가-힣]/.test(cleaned))return"ko-KR";
  if(/[ぁ-んァ-ン]/.test(cleaned))return"ja-JP";
  if(/[一-龯]/.test(cleaned)){
    if(selected==="ja-JP"||selected==="zh-CN"||selected==="zh-TW")return selected;
    return"zh-CN";
  }
  return selected;
}

function refreshVoices(){
  try{
    const previousCount=VOICE_CACHE.length;
    VOICE_CACHE=window.speechSynthesis?window.speechSynthesis.getVoices():[];
    VOICES_READY=VOICE_CACHE.length>0;
    if(VOICE_CACHE.length!==previousCount){
      BEST_VOICE_CACHE.clear();
      setTimeout(()=>{try{renderVoiceSettings()}catch(e){}},0);
    }
  }catch(e){
    VOICE_CACHE=[];
    VOICES_READY=false;
    BEST_VOICE_CACHE.clear();
  }
  return VOICE_CACHE;
}

function waitForVoices(timeout=1200){
  return new Promise(resolve=>{
    let voices=refreshVoices();
    if(voices.length)return resolve(voices);
    if(!window.speechSynthesis)return resolve([]);
    let done=false;
    let timeoutId=0;
    const finish=()=>{
      if(done)return;
      done=true;
      clearTimeout(timeoutId);
      window.speechSynthesis.removeEventListener?.("voiceschanged",finish);
      voices=refreshVoices();
      resolve(voices);
    };
    window.speechSynthesis.addEventListener?.("voiceschanged",finish,{once:true});
    timeoutId=setTimeout(finish,timeout);
  });
}

function voiceScore(v,lang){
  const target=normalizeVoiceLang(lang).toLowerCase();
  const prefix=target.split("-")[0];
  const vlang=String(v.lang||"").toLowerCase();
  const name=String(v.name||"").toLowerCase();
  let score=0;
  if(vlang===target)score+=100;
  if(vlang.startsWith(prefix))score+=60;
  if(target==="zh-cn"){
    if(vlang==="zh-cn")score+=160;
    if(vlang==="zh-hans-cn")score+=150;
    if(vlang.startsWith("zh-hans"))score+=120;
    if(vlang.startsWith("zh"))score+=80;
    if(/mandarin|普通话|chinese simplified|simplified|china|zh-cn/.test(name))score+=90;
    if(vlang.startsWith("en")||/english|american|british/.test(name))score-=500;
  }
  if(name.includes("google"))score+=50;
  if(name.includes("premium"))score+=20;
  if(name.includes("enhanced"))score+=15;
  if(name.includes("natural"))score+=15;
  if(name.includes("microsoft"))score+=8;
  if(name.includes("siri"))score+=5;
  return score;
}
function voiceMatchesLanguage(v,lang){
  const target=normalizeVoiceLang(lang).toLowerCase();
  const vlang=String(v?.lang||"").toLowerCase();
  const name=String(v?.name||"").toLowerCase();
  if(!vlang)return false;
  if(target==="zh-cn"){
    return vlang==="zh-cn"||vlang==="zh-hans-cn"||vlang.startsWith("zh-hans")||(/mandarin|普通话|chinese|simplified|china/.test(name)&&vlang.startsWith("zh"));
  }
  const prefix=target.split("-")[0];
  return vlang===target||vlang.startsWith(prefix);
}
function matchingVoicesForLanguage(lang){
  const target=normalizeVoiceLang(lang);
  return refreshVoices().filter(v=>voiceMatchesLanguage(v,target)).sort((a,b)=>voiceScore(b,target)-voiceScore(a,target));
}

function pickVoice(lang){
  const target=normalizeVoiceLang(lang);
  const cacheKey=target.toLowerCase();
  if(BEST_VOICE_CACHE.has(cacheKey))return BEST_VOICE_CACHE.get(cacheKey);
  const voices=refreshVoices();
  if(!voices.length)return null;
  const prefs=loadVoicePrefs();
  const saved=prefs[target];
  if(saved){
    const preferred=voices.find(v=>(v.voiceURI&&v.voiceURI===saved.voiceURI)||voiceIdentity(v)===saved.identity||(v.name===saved.name&&v.lang===saved.lang));
    if(preferred&&voiceMatchesLanguage(preferred,target)){
      BEST_VOICE_CACHE.set(cacheKey,preferred);
      return preferred;
    }
  }
  const candidates=matchingVoicesForLanguage(target);
  if(!candidates.length){
    BEST_VOICE_CACHE.set(cacheKey,null);
    return null;
  }
  const best=candidates.sort((a,b)=>voiceScore(b,target)-voiceScore(a,target))[0]||null;
  BEST_VOICE_CACHE.set(cacheKey,best);
  return best;
}

function getBestVoiceForLanguage(language){return pickVoice(language)}
window.getBestVoiceForLanguage = getBestVoiceForLanguage;

function speechWatchdogDelay(text,rate=Number($("audioRate")?.value)||.92){return Math.max(20000,String(text||"").length*500/Math.max(.3,rate)+5000)}
function frontSpeech(word){const list=db.lists.find(list=>list.id===word?.listId);return {text:word?.front||"",lang:word?.frontLang||list?.frontLang||""}}
function speakFront(word,opts={}){const front=frontSpeech(word);return speak(front.text,front.lang,{...opts,strict:true})}
async function speak(text,lang,opts={}){
  text=sanitizeSpeechText(text);
  if(opts.cancel!==false)cancelSpeech();
  if(opts.strict&&(!text||!lang||!window.TangoNestLanguages.find(lang))){opts.onerror?.("front-data-missing");toast(window.TNI18n.t("audio.frontMissing"));return false;}
  if(!text)return true;
  const finalLang=opts.strict?normalizeVoiceLang(lang):inferSpeechLanguage(text,lang);
  const epoch=speechEpoch;
  if(!window.speechSynthesis){opts.onerror?.("synthesis-unavailable");toast(window.TNI18n.t("ui.voice_unavailable_on_this_device",{}));return false;}
  await waitForVoices();
  if(epoch!==speechEpoch)return false;
  const voice=pickVoice(finalLang);
  if(!voice){opts.onerror?.("voice-unavailable");toast(window.TNI18n.t("ui.voice_unavailable_on_this_device",{}));return false;}
  const u=new SpeechSynthesisUtterance(text);
  u.lang=finalLang;
  u.rate=parseFloat($("audioRate")?.value||"0.92");
  u.pitch=1;
  u.volume=1;
  u.voice=voice;
  return new Promise(resolve=>{
    let finished=false;
    const finish=ok=>{if(finished)return;finished=true;clearTimeout(timeout);pendingSpeech.delete(cancel);resolve(ok);};
    const cancel=()=>finish(false);
    let timeout;
    const arm=(remaining=text)=>{clearTimeout(timeout);timeout=setTimeout(()=>{opts.onerror?.("timeout");finish(false);if(epoch===speechEpoch)cancelSpeech();},speechWatchdogDelay(remaining,u.rate))};
    arm();
    pendingSpeech.add(cancel);
    u.onend=()=>finish(epoch===speechEpoch);
    u.onstart=()=>{if(!finished&&epoch===speechEpoch){arm();opts.onstart?.()}};
    u.onboundary=event=>{if(!finished&&epoch===speechEpoch)arm(text.slice(event.charIndex||0))};
    u.onerror=event=>{if(finished||epoch!==speechEpoch)return;opts.onerror?.(event.error||"speech-failed");if(!["canceled","interrupted"].includes(event.error))toast(window.TNI18n.t("ui.voice_playback_failed_try_another_voice_in_settings",{}));finish(false);};
    try{window.speechSynthesis.speak(u);}catch(error){opts.onerror?.("not-allowed");finish(false);toast(window.TNI18n.t("ui.voice_playback_failed_try_another_voice_in_settings",{}));}
  });
}
async function speakText(text,language,opts={}){return speak(text,language,opts)}
window.speakText = speakText;

function cancelSpeech(){speechEpoch++;for(const cancel of pendingSpeech)cancel();pendingSpeech.clear();try{window.speechSynthesis?.cancel()}catch(error){}}
async function speakQueued(items,gap=900,opts={}){
  items=(items||[]).filter(item=>sanitizeSpeechText(item.text));
  if(!items?.length)return false;
  cancelSpeech();const epoch=speechEpoch;
  for(let index=0;index<items.length;index++){
    if(epoch!==speechEpoch)return false;
    if(!await speak(items[index].text,items[index].lang,{...opts,cancel:false}))return false;
    if(index<items.length-1&&!await speechGap(gap,epoch))return false;
  }
  return epoch===speechEpoch;
}
function speechGap(ms,epoch){
  return new Promise(resolve=>{
    const finish=()=>{clearTimeout(timer);pendingSpeech.delete(finish);resolve(epoch===speechEpoch)};
    const timer=setTimeout(finish,ms);pendingSpeech.add(finish);
  });
}

function renderVoiceSettings(){
  const box=$("voiceSettingsBox");
  if(!box)return;
  const voices=refreshVoices();
  if(!voices.length){
    box.innerHTML=`<p class="desc">${window.TNI18n.mark("ui.browser_voices_are_still_loading_press_refresh_voices_if_this_does_not_update",{})}</p>`;
    waitForVoices().then(loaded=>{if(loaded.length)renderVoiceSettings();else if(box.isConnected)box.innerHTML=`<p class="desc">${window.TNI18n.mark("ui.voice_unavailable_on_this_device",{})}</p>`;});
    return;
  }
  const rows=VOICE_LANGUAGE_SETTINGS.map(item=>{
    const target=normalizeVoiceLang(item.lang);
    const matches=matchingVoicesForLanguage(target);
    const current=pickVoice(target);
    const currentId=current?voiceIdentity(current):"";
    const options=[`<option value="" data-i18n="ui.auto_best_voice">Auto best voice</option>`].concat(matches.map(v=>`<option value="${escAttr(voiceIdentity(v))}" ${voiceIdentity(v)===currentId?"selected":""}>${esc(v.name)} / ${esc(v.lang)}</option>`)).join("");
    const warning=!matches.length?`<div class="tn-voice-warning">${window.TNI18n.mark("ui.no_native_value_voice_found_in_this_browser",{p0:esc(item.label)})}</div>`:"";
    return `<div class="tn-voice-row"><div class="tn-voice-meta"><strong>${esc(item.label)}</strong><span>${current?esc(current.name)+" / "+esc(current.lang):window.TNI18n.t("ui.voice_unavailable_on_this_device")}</span>${warning}</div><div class="tn-voice-controls"><select aria-label="Voice for ${esc(item.label)}" onchange="tnSetVoicePreference('${target}',this.value)">${options}</select><button type="button" aria-label="Test ${esc(item.label)} voice" onclick="tnTestVoice('${target}')">${window.TNI18n.mark("ui.test",{})}</button></div></div>`;
  }).join("");
  box.innerHTML=rows;
}
function tnSetVoicePreference(lang,value){
  const target=normalizeVoiceLang(lang);
  const prefs=loadVoicePrefs();
  if(!value){
    delete prefs[target];
  }else{
    const voice=refreshVoices().find(v=>voiceIdentity(v)===value);
    if(voice&&voiceMatchesLanguage(voice,target)){
      prefs[target]={identity:voiceIdentity(voice),voiceURI:voice.voiceURI||"",name:voice.name||"",lang:voice.lang||""};
    }
  }
  saveVoicePrefs(prefs);
  BEST_VOICE_CACHE.clear();
  if(audioQueue.length)selectAudioItem(Math.max(0,audioIndex-1),!audioPaused&&["playing","preparing","waiting"].includes(listenRun.phase));
  renderVoiceSettings();
}
function tnTestVoice(lang){
  const item=VOICE_LANGUAGE_SETTINGS.find(v=>normalizeVoiceLang(v.lang)===normalizeVoiceLang(lang));
  speak(item?.sample||"TangoNest voice test.",normalizeVoiceLang(lang));
}
window.tnSetVoicePreference=tnSetVoicePreference;
window.tnTestVoice=tnTestVoice;

function showVoiceStatus(){
  const box=$("voiceStatusBox");
  if(!box)return;
  renderVoiceSettings();
  const voices=refreshVoices();
  const langs=window.TangoNestLanguages.registry.map(item=>item.ttsLocale);
  box.style.display="block";
  if(!voices.length){
    box.innerHTML=`<p class="desc">${window.TNI18n.mark("ui.no_browser_voices_loaded_yet_try_again_after_a_few_seconds_or_reload_the_page",{})}</p>`;
    waitForVoices().then(loaded=>{if(loaded.length)showVoiceStatus();});
    return;
  }
  const zh=pickVoice("zh-CN");
  const zhWarning=zh&&voiceMatchesLanguage(zh,"zh-CN")?"":`<p class="tn-voice-warning strong">${window.TNI18n.mark("ui.no_native_chinese_mandarin_voice_was_found_install_or_enable_a_zh_cn_voice_for_best_pronunciation",{})}</p>`;
  box.innerHTML=`<p class="desc">${window.TNI18n.mark("ui.available_voices",{})} `+voices.length+'</p>'+zhWarning+
    langs.map(l=>{
      const v=pickVoice(l);
      const google=v&&String(v.name||"").toLowerCase().includes("google");
      return `<div style="padding:8px;border-bottom:1px solid var(--line)"><b>${window.TNI18n.studyName(l)||l}</b> → ${v?esc(v.name)+" / "+esc(v.lang):window.TNI18n.t("ui.voice_unavailable_on_this_device")} ${google?`<span class="badge green">${window.TNI18n.mark("ui.google",{})}</span>`:`<span class="badge">${window.TNI18n.mark("ui.fallback",{})}</span>`}</div>`
    }).join("");
}

function testAllMainVoices(){
  const tests=[
    ["Hello, this is English.","en-US"],
    ["Bonjour, ceci est le français.","fr-FR"],
    ["こんにちは、日本語です。","ja-JP"],
    ["안녕하세요. 한국어입니다.","ko-KR"],
    ["你好，这是中文。","zh-CN"]
  ];
  speakQueued(tests.map(([text,lang])=>({text,lang})),1600);
}

function handleVoicesChanged(){
  refreshVoices();
  renderVoiceSettings();
}

if(window.speechSynthesis){
  refreshVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged",handleVoicesChanged);
  setTimeout(refreshVoices,300);
  setTimeout(refreshVoices,1000);
  setTimeout(renderVoiceSettings,1200);
}

function attachBrandContextListeners(){
  ["quizList","studyList","audioList","bulkList","addList"].forEach(id=>{
    const el=$(id);
    if(el&&!el.dataset.contextAttached){
      el.dataset.contextAttached="1";
      el.addEventListener("change",updateBrandContext);
    }
  });
}

attachBrandContextListeners();
render();resetQuiz();

function getLastSession(){
  const key=TN_LOCAL_QA_MODE?TN_SESSION_KEY:tnSessionStorageKey();
  if(!key)return{};
  try{
    let saved=JSON.parse(localStorage.getItem(key)||"{}");
    if(!saved||typeof saved!=="object"||Array.isArray(saved))saved={};
    if(saved.studyDefaultsVersion!=="fdg15"){
      saved={...saved,quizOrderMode:"random",audioOrder:"random",audioPattern:"front",studyDefaultsVersion:"fdg15"};
      localStorage.setItem(key,JSON.stringify(saved));
    }
    return saved;
  }catch(e){return{}}
}
function setLastSession(patch){
  const key=TN_LOCAL_QA_MODE?TN_SESSION_KEY:tnSessionStorageKey();
  if(!key)return;
  const current=getLastSession();
  const next={...current,...patch,updatedAt:new Date().toISOString()};
  localStorage.setItem(key,JSON.stringify(next));
}
function selectedValue(id){
  const el=$(id);
  return el?el.value:"";
}
function applyLastSessionToControls(){
  const s=getLastSession();
  if(s.listId){
    ["quizList","studyList","audioList","bulkList","addList"].forEach(id=>{
      const el=$(id);
      if(el&&[...el.options].some(o=>o.value===s.listId))el.value=s.listId;
    });
  }
  if(s.quizCount&&$("quizCount"))$("quizCount").value=s.quizCount;
  if($("quizType"))$("quizType").value=s.quizType||"choice";
  if($("quizDirection"))$("quizDirection").value=quizDirectionForType($("quizType").value,s);
  updateQuizModeSettings.lastType=$("quizType").value;
  if(s.quizOrderMode&&$("quizOrderMode"))$("quizOrderMode").value=s.quizOrderMode;
  if(s.audioPattern&&$("audioPattern"))$("audioPattern").value=s.audioPattern;
  if(s.audioOrder&&$("audioOrder"))$("audioOrder").value=s.audioOrder;
  if(s.studyMode&&$("studyMode"))$("studyMode").value=s.studyMode;
  const preferences=quizSavedPreferences();
  if(preferences.settings)applyQuizSettings(preferences.settings);
  if($("quizDirection"))$("quizDirection").value=quizDirectionForType($("quizType").value,s);
  updateQuizModeSettings.lastType=$("quizType").value;updateQuizModeSettings();
  updateStudySettingsSummary();
  updateStudyProgress();
}
function restoreStudySettingsForOwner(){
  const key=TN_LOCAL_QA_MODE?"tangonest_learning_session_v1":tnSessionStorageKey();
  if(!key||restoreStudySettingsForOwner.key===key)return;
  if(!TN_LOCAL_QA_MODE&&!db.meta?.lastCloudLoadAt&&!db.words.length)return;
  for(const id of QUIZ_SETTING_IDS){const el=$(id);if(!el)continue;if(el.tagName==="SELECT")el.value=[...el.options].find(option=>option.defaultSelected)?.value||el.options[0]?.value||"";else el.value=el.defaultValue}
  applyLastSessionToControls();restoreStudySettingsForOwner.key=key;
}
function updateStudySettingsSummary(){
  const selected=id=>$(id)?.selectedOptions?.[0]?.textContent||"";
  const advance=$("quizAutoAdvance")?.value==="auto"?window.TNI18n.t("quiz.autoTiming"):selected("quizAutoAdvance");
  if($("quizSettingsSummary"))$("quizSettingsSummary").textContent=[selected("quizOrderMode"),advance,window.TNI18n.t("ui.after_answer_audio")+": "+selected("quizAudioAfter")].join(" · ");
  if($("quizAdvanceValue"))$("quizAdvanceValue").textContent=advance;
}
function setupStudySettings(){
  const setup=$("quizSetup");if(!setup||$("quizAdvanced"))return;
  const basic=document.createElement("div");basic.className="quiz-basic-settings";
  for(const id of ["quizList","quizType","quizCount","quizDirection"])basic.append($(id).parentElement);
  const summary=document.createElement("p");summary.id="quizSettingsSummary";summary.className="quiz-settings-summary";
  const details=document.createElement("details");details.id="quizAdvanced";
  const heading=document.createElement("summary");window.TNI18n.bindText(heading,()=>window.TNI18n.t("ui.session_options"));details.append(heading);
  const grid=document.createElement("div");grid.className="quiz-advanced-settings";
  setup.querySelectorAll("[data-quiz-setting]").forEach(node=>grid.append(node));details.append(grid);
  setup.querySelectorAll(".row,.row3,.row4").forEach(node=>node.remove());setup.prepend(basic,summary,details);
  const current=document.createElement("small");current.id="quizAdvanceValue";$("quizAutoAdvance").after(current);$("quizAutoAdvance").setAttribute("aria-describedby",current.id);
  const automatic=$("quizAutoAdvance").querySelector('[value="auto"]');automatic.dataset.i18n="quiz.autoShort";window.TNI18n.bindText(automatic,()=>window.TNI18n.t("quiz.autoShort"));
  const limitHint=document.createElement("small");limitHint.id="quizLimitHint";$("quizTimeLimit").after(limitHint);$("quizTimeLimit").setAttribute("aria-describedby",limitHint.id);
  const update=()=>{updateStudySettingsSummary();const enabled=$("quizHardMode").value==="on";$("quizTimeLimit").disabled=!enabled;limitHint.textContent=enabled?"":window.TNI18n.t("ui.time_limit_off")};
  setup.addEventListener("change",update);window.addEventListener("tn:locale",update);update();
}
function rememberCurrentSession(mode){
  const listId=selectedValue(mode==="cards"?"studyList":mode==="audio"?"audioList":mode==="quiz"?"quizList":"addList")||activeListId?.();
  const patch={mode:mode||"home",listId};
  if($("quizCount"))patch.quizCount=$("quizCount").value;
  if($("quizType"))patch.quizType=$("quizType").value;
  if($("quizDirection")){
    patch.quizDirection=$("quizDirection").value;patch.quizDirections={...quizSavedDirections(),...getLastSession().quizDirections};
    if(patch.quizType!=="listening")patch.quizDirections[patch.quizType]=patch.quizDirection;
    // UI preferences survive logout; vocabulary and credentials retain their existing account lifecycle.
    const key=quizDirectionsStorageKey();if(key)try{localStorage.setItem(key,JSON.stringify(patch.quizDirections))}catch(error){}
  }
  if($("quizOrderMode"))patch.quizOrderMode=$("quizOrderMode").value;
  if($("audioPattern"))patch.audioPattern=$("audioPattern").value;
  if($("audioOrder"))patch.audioOrder=$("audioOrder").value;
  if($("studyMode"))patch.studyMode=$("studyMode").value;
  try{setLastSession(patch)}catch(error){}
  if(mode==="quiz")saveQuizPreferences();
}
function attachSessionMemory(){
  const map={...Object.fromEntries(QUIZ_SETTING_IDS.map(id=>[id,"quiz"])),studyList:"cards",audioList:"audio",audioOrder:"audio",audioPattern:"audio",studyMode:"cards"};
  Object.entries(map).forEach(([id,mode])=>{
    const el=$(id);
    if(el&&!el.dataset.sessionMemory){
      el.dataset.sessionMemory="1";
      el.addEventListener("change",()=>rememberCurrentSession(mode));
      if(el.tagName==="INPUT")el.addEventListener("input",()=>rememberCurrentSession(mode));
    }
  });
}
function updateHeroPreview(){
  const one=document.querySelector(".float-one");
  const two=document.querySelector(".float-two");
  const three=document.querySelector(".float-three");
  if(!one||!two||!three)return;
  const words=Array.isArray(db?.words)?db.words.filter(w=>w?.front&&w?.back).slice(-8):[];
  if(!words.length){
    one.innerHTML=`<span>${window.TNI18n.mark("ui.front",{})}</span><b>${window.TNI18n.mark("ui.your_word",{})}</b><small>${window.TNI18n.mark("ui.language",{})}</small>`;
    two.innerHTML=`<span>${window.TNI18n.mark("ui.back",{})}</span><b>${window.TNI18n.mark("ui.meaning_2",{})}</b><small>${window.TNI18n.mark("ui.translation",{})}</small>`;
    three.innerHTML=`<span>${window.TNI18n.mark("ui.mode",{})}</span><b>${window.TNI18n.mark("navigation.quiz",{})}</b><small>${window.TNI18n.mark("ui.ready",{})}</small>`;
    return;
  }
  const sets=words.map((word,index)=>({
    front:word.front,
    frontLang:langName(word.frontLang || "en-US"),
    back:word.back,
    backLang:langName(word.backLang || "ja-JP"),
    mode:["Quiz","Cards","Listen"][index%3]
  }));
  const s=sets[sets.length-1];
  one.innerHTML=`<span>${window.TNI18n.mark("ui.front",{})}</span><b>${esc(s.front)}</b><small>${esc(s.frontLang)}</small>`;
  two.innerHTML=`<span>${window.TNI18n.mark("ui.back",{})}</span><b>${esc(s.back)}</b><small>${esc(s.backLang)}</small>`;
  three.innerHTML=`<span>${window.TNI18n.mark("ui.mode",{})}</span><b>${esc(s.mode)}</b><small>${window.TNI18n.mark("ui.ready",{})}</small>`;
}

const TN_RECENT_PLAYLIST_KEY="tangonest_recent_playlist_v1";
function rememberRecentPlaylist(value){
  if(!value)return;
  const key=TN_LOCAL_QA_MODE?TN_RECENT_PLAYLIST_KEY:tnRecentPlaylistStorageKey();
  if(key)try{localStorage.setItem(key,value)}catch(e){}
}
function restoreRecentPlaylist(){
  let value="";
  const key=TN_LOCAL_QA_MODE?TN_RECENT_PLAYLIST_KEY:tnRecentPlaylistStorageKey();
  if(key)try{value=localStorage.getItem(key)||""}catch(e){}
  if(!value)return;
  ["addList","bulkList"].forEach(id=>{
    const el=$(id);
    if(el&&[...el.options].some(option=>option.value===value))el.value=value;
  });
}
function resetAccountUiState(){
  restoreStudySettingsForOwner.key="";
  clearFlashTimers();
  clearQuizTimers();
  clearTimeout(audioTimer);
  audioRunToken++;
  cancelSpeech();
  audioQueue=[];
  audioIndex=0;
  audioPaused=false;
  current=null;
  flipped=false;
  selectedIds.clear();
  smartSessionQueue=[];
  resetCard();
  resetQuiz();
  try{window.tnLibraryResetAccountState?.()}catch(e){}
  const now=$("audioNow");
  const sub=$("audioSub");
  if(now)now.textContent="---";
  if(sub)window.TNI18n.bindText(sub,()=>(window.TNI18n.t("ui.choose_a_playlist_and_press_play",{})));
  setAudioPlayerState("idle");
}
window.tnResetAccountUiState=resetAccountUiState;
function setupCoreInteractions(){
  if(window.__tnCoreInteractions)return;
  window.__tnCoreInteractions=true;
  $("bulkCancelButton")?.addEventListener("click",()=>{bulkStopRequested=true;$("bulkCancelButton").disabled=true;window.TNI18n.bindText($("bulkCancelButton"),()=>(window.TNI18n.t("ui.stopping_after_this_batch",{})))});
  window.addEventListener("beforeunload",event=>{if(bulkProgressBusy()){event.preventDefault();event.returnValue="";}});
  updateBulkAssistant();
  $("bulkCopyPrompt")?.addEventListener("click",()=>copyBulkAssistant("prompt"));
  $("bulkCopyFormat")?.addEventListener("click",()=>copyBulkAssistant("format"));
  $("bulkInsertSample")?.addEventListener("click",insertBulkSample);
  $("bulkFormat")?.addEventListener("change",()=>{clearBulkPreview();updateBulkAssistant()});
  ["addList","bulkList"].forEach(id=>{
    const el=$(id);
    if(el&&!el.dataset.recentPlaylist){
      el.dataset.recentPlaylist="1";
      el.addEventListener("change",()=>{rememberRecentPlaylist(el.value);if(id==="bulkList"){hideBulkDestinationConfirmation();updateBulkDestinationSummary()}});
    }
  });
  const bulkText=$("bulkText");
  if(bulkText&&!bulkText.dataset.bulkDock){bulkText.dataset.bulkDock="1";bulkText.addEventListener("input",()=>{hideBulkDestinationConfirmation();$("bulkDuplicatePanel")?.classList.remove("show");if($("bulkPreview"))$("bulkPreview").style.display="none";queueBulkActionDock()})}
  document.addEventListener("keydown",event=>{
    if(event.isComposing)return;
    const bulkModal=!$("bulkTargetConfirm")?.hidden?$("bulkTargetConfirm"):$("bulkDuplicatePanel")?.classList.contains("show")?$("bulkDuplicatePanel"):null;
    if(bulkModal){
      if(event.key==="Escape"){
        event.preventDefault();hideBulkDestinationConfirmation();$("bulkDuplicatePanel")?.classList.remove("show");$("bulkRegisterBtn")?.focus();return;
      }
      if(event.key==="Tab"){
        const buttons=[...bulkModal.querySelectorAll("button:not(:disabled)")];
        const at=buttons.indexOf(document.activeElement);
        event.preventDefault();buttons[(at+(event.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus();return;
      }
    }
    const target=event.target;
    const tag=String(target?.tagName||"").toLowerCase();
    const inField=["input","textarea","select"].includes(tag)||target?.isContentEditable;
    const createActive=$("pageAdd")?.classList.contains("active");
    const quizActive=$("pageQuiz")?.classList.contains("active")&&$("quizRun")?.style.display!=="none"&&quiz.current;
    if(quizActive&&!event.defaultPrevented){
      if(event.isComposing||event.keyCode===229)return;
      if(event.repeat){if(event.key==="Enter"||event.code==="Space")event.preventDefault();return;}
      if(event.ctrlKey||event.metaKey||event.altKey)return;
      if(event.key==="Escape"&&!inField){event.preventDefault();pauseQuizAdvance();$("quizEndSession")?.focus();return;}
      if(quiz.answered&&!inField&&tag!=="button"&&(event.key==="Enter"||event.code==="Space")){
        event.preventDefault();
        nextQuizQuestion();
        return;
      }
      if(!quiz.answered&&quiz.type==="choice"&&!inField&&/^[1-4]$/.test(event.key)){
        const choice=$("choiceArea")?.querySelector(`.choice[data-shortcut="${event.key}"]`);
        if(choice){event.preventDefault();choice.click()}
        return;
      }
    }
    if(createActive&&(event.metaKey||event.ctrlKey)&&event.key==="Enter"){
      event.preventDefault();
      if(target?.closest?.("#bulkCard"))$("bulkRegisterBtn")?.click();
      else $("addWordBtn")?.click();
      return;
    }
    if(createActive&&event.key==="Enter"&&inField&&tag!=="textarea"){
      const order=["front","back","frontLang","backLang","addList","pos","gender","tags","memo"];
      const i=order.indexOf(target.id);
      if(i>-1){
        event.preventDefault();
        $(order[i+1])?.focus();
      }
      return;
    }
    if(!$("pageStudy")?.classList.contains("active")||inField)return;
    if(event.code==="Space"){event.preventDefault();flipCard();return}
    if(event.key==="Enter"){event.preventDefault();nextCard();return}
    if(event.key==="1"){event.preventDefault();markCard("again",true);return}
    if(event.key==="2"){event.preventDefault();markCard("hard",true);return}
    if(event.key==="3"){event.preventDefault();markCard("good",true);return}
    if(event.key==="4"){event.preventDefault();markCard("easy",true);return}
  });
}

function enhanceTangoNestApp(){
  restoreStudySettingsForOwner();
  attachSessionMemory();
  setupCoreInteractions();
  restoreRecentPlaylist();
  updateBulkDestinationSummary();
  updateBulkActionDock();
  ["bulkFrontLang","bulkBackLang"].forEach(id=>$(id)?.addEventListener("change",()=>{clearBulkPreview();updateBulkDestinationSummary();updateBulkAssistant()}));
  updateHeroPreview();
  if(typeof updateBrandContext==="function")updateBrandContext();
}
restoreStudySettingsForOwner();setupStudySettings();attachSessionMemory();
setTimeout(enhanceTangoNestApp,120);


setTimeout(()=>{
  const installedGo=window.go;
  if(typeof installedGo==="function"&&!installedGo.__wrappedForSession){
    const originalGo=installedGo;
    window.go=function(page){
      originalGo(page);
      const modeMap={quiz:"quiz",audio:"audio",cards:"cards",list:"list",add:"add",home:"home"};
      rememberCurrentSession(modeMap[page]||page);
      updateHeroPreview();
    };
    window.go.__wrappedForSession=true;
    if(originalGo.__tnLibraryStable)window.go.__tnLibraryStable=true;
  }
  const installedShowPage=window.showPage;
  if(typeof installedShowPage==="function"&&!installedShowPage.__wrappedForSession){
    const originalShow=installedShowPage;
    window.showPage=function(page){
      originalShow(page);
      const modeMap={quiz:"quiz",audio:"audio",cards:"cards",list:"list",add:"add",home:"home"};
      rememberCurrentSession(modeMap[page]||page);
      updateHeroPreview();
    };
    window.showPage.__wrappedForSession=true;
  }
},200);

window.addEventListener("pagehide",()=>{
  clearFlashTimers();
  clearQuizTimers();
  clearTimeout(audioTimer);
  window.speechSynthesis?.removeEventListener?.("voiceschanged",handleVoicesChanged);
  try{window.speechSynthesis?.cancel()}catch(e){}
});

/* Supabase Auth and cloud persistence live in tn-supabase-sync.js. */
