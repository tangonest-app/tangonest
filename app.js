
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
const TN_DEFAULT_PLAYLIST_NAME="My Words";
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
const LANGUAGE_OPTIONS=Object.freeze([
  ["en-US","English","word"],["ja-JP","Japanese","意味"],["ko-KR","Korean","단어"],["fr-FR","French","mot"],["zh-CN","Chinese Simplified","词"],["zh-TW","Chinese Traditional","詞"],["es-ES","Spanish","palabra"],["de-DE","German","Wort"],["it-IT","Italian","parola"],["pt-BR","Portuguese","palavra"],["ar-SA","Arabic","كلمة"],["ru-RU","Russian","слово"],["nl-NL","Dutch","woord"],["vi-VN","Vietnamese","tu"],["th-TH","Thai","คำ"],["tr-TR","Turkish","kelime"],["hi-IN","Hindi","शब्द"],["id-ID","Indonesian","kata"],["el-GR","Greek","λέξη"],["he-IL","Hebrew","מילה"]
]);
const LANGS=LANGUAGE_OPTIONS;
const LANGUAGE_PRIORITY=new Map(LANGUAGE_OPTIONS.map((item,index)=>[item[0],index]));
try{
  window.TangoNestLanguages=Object.freeze({
    options:LANGUAGE_OPTIONS,
    label:code=>(LANGUAGE_OPTIONS.find(item=>item[0]===code)||[code,code])[1],
    priority:code=>LANGUAGE_PRIORITY.has(code)?LANGUAGE_PRIORITY.get(code):LANGUAGE_OPTIONS.length
  });
}catch(e){}
let db=loadTangoNestDB();
db.prefs=db.prefs||{frontLang:"en-US",backLang:"ja-JP"};db.lists=Array.isArray(db.lists)?db.lists:[];db.words=db.words||[];db.mistakes=Array.isArray(db.mistakes)?db.mistakes:[];
try{window.db=db;}catch(e){}
let current=null,flipped=false,flashTimers=[],audioTimer=null,audioQueue=[],audioIndex=0,audioPaused=false,selectedIds=new Set();
const modalReturnFocus={edit:null,detail:null};
let quiz={queue:[],wrong:[],allWrong:[],index:0,score:0,current:null,answered:false,type:"choice",direction:"front",total:0,listeningReplayUsed:0};let quizAutoTimer=null,quizTimerInterval=null,quizListeningAudioTimer=null,quizQuestionStartedAt=0;
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
  if(!words.length)return toast("No mistakes yet");
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
  if(!ensureMistakes().length)return toast("No mistakes yet");
  if(!confirm("Clear the Mistake Notebook? Your words will stay saved."))return;
  db.mistakes=[];
  persist();
  renderMistakeNotebook();
  toast("Mistake Notebook cleared");
}
function mistakeNotebookHtml(limit){
  const entries=mistakeEntriesSorted();
  if(!entries.length)return '<div class="empty"><div><strong>No mistakes yet</strong><span>Your missed answers will collect here for focused review.</span></div><button type="button" class="btn" onclick="appShow(\'quiz\')">Start Quiz</button></div>';
  const rows=entries.slice(0,limit||entries.length).map(entry=>{
    const live=(db.words||[]).find(word=>word.id===entry.wordId)||entry;
    const date=entry.lastWrongAt?new Date(entry.lastWrongAt).toLocaleDateString():"-";
    const meta=[entry.playlistName,entry.sourceMode,entry.language?langName(entry.language):""].filter(Boolean).join(" · ");
    const id=jsArg(entry.wordId);
    return `<div class="mistake-row">
      <button type="button" class="mistake-word" onclick="openDetail(${id})"><b>${esc(live.front||entry.front||"")}</b><span>${esc(live.back||entry.back||"")}</span></button>
      <div class="mistake-meta"><span>${esc(meta||"Mistake")}</span><span>${Number(entry.wrongCount||0)} wrong · ${esc(date)}</span>${entry.lastUserAnswer?`<small>Your answer: ${esc(entry.lastUserAnswer)}</small>`:""}</div>
      <div class="mistake-actions"><button type="button" onclick="startMistakeReview()">Review</button><button type="button" onclick="removeMistake(${id})">Clear</button></div>
    </div>`;
  }).join("");
  const more=limit&&entries.length>limit?`<p class="desc">${entries.length-limit} more mistakes in Library.</p>`:"";
  return `<div class="mistake-head"><span>${entries.length} saved mistakes</span><div><button type="button" onclick="startMistakeReview()">Review Mistakes</button><button type="button" onclick="clearMistakes()">Clear All</button></div></div><div class="mistake-list">${rows}</div>${more}`;
}
function renderMistakeNotebook(){
  const home=$("mistakeNotebookHome");
  if(home)home.innerHTML=mistakeNotebookHtml(4);
  const library=$("mistakeNotebookLibrary");
  if(library){
    library.innerHTML=`<h2>Mistake Notebook</h2><p class="desc">Wrong answers from Quiz, Typing, Listening, and Hard flashcards.</p>${mistakeNotebookHtml()}`;
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
function optionsHTML(selected){selected=safeLang(selected);return LANGS.map(l=>`<option value="${l[0]}" ${l[0]===selected?"selected":""}>${l[1]}</option>`).join("")}
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
  if(trigger)trigger.textContent=selected?.textContent||"Select language";
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
  if(unfiled){const option=document.createElement("option");option.value="";option.textContent="No playlist";el.appendChild(option)}
  if(allWords){const option=document.createElement("option");option.value="all";option.textContent="All words";el.appendChild(option)}
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
  if(!words.length)return "No words yet";
  const first=words[0];
  const front=langName(first.frontLang)||first.frontLang||"Front";
  const back=langName(first.backLang)||first.backLang||"Back";
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
  const list=db.lists.find(item=>item.id===listId)||{id:"all",name:"All Words"};
  const words=listWords(list.id);
  const meta=playlistLangMeta(list.id);
  if($("heroPhoneDeck"))$("heroPhoneDeck").textContent=list.name;
  if($("heroPhoneMeta"))$("heroPhoneMeta").textContent=`${meta} · ${words.length} words`;
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
function render(){fillLangSelects();["addList","bulkList","studyList","quizList","audioList","renameListSelect","editList"].forEach(id=>renderSelect(id,false));renderHome();if(typeof window.tnLibraryRender==="function")window.tnLibraryRender();else if(!$('tn82LibraryMount')&&typeof renderWords==="function")renderWords();renderMistakeNotebook();renderManage();updateStudyStar();updateStudyProgress();updateBulkDestinationSummary();try{updateQuizModeSettings()}catch(e){}}
function startSmartSession(kind="random"){
  if(!db.words.length){appShow("add");return toast("Add your first words")}
  const engine=learningEngine();
  const matches=kind==="due"?dueWords():kind==="weak"?weakWords():kind==="new"?db.words.filter(w=>Number(w.reviewCount||0)===0):kind==="saved"?db.words.filter(w=>w.saved):kind==="today"&&engine?engine.buildSmartSession(db.words,{limit:20}):db.words;
  if(!matches.length)return toast(kind==="due"?"You are all caught up":kind==="weak"?"No weak words right now":kind==="new"?"No new words waiting":"No words in this session");
  smartSessionQueue=kind==="random"?[]:[...matches];
  const firstList=db.lists.find(list=>matches.some(word=>word.listId===list.id))||db.lists.find(list=>db.words.some(word=>word.listId===list.id))||null;
  if($("quizList"))$("quizList").value=firstList?.id||"all";
  if($("quizType"))$("quizType").value="choice";
  if($("quizOrderMode"))$("quizOrderMode").value=kind==="today"?"playlist":kind==="weak"?"weak":kind==="due"?"due":"random";
  if($("quizScope")){
    $("quizScope").value=kind==="due"?"due":kind==="weak"?"hard":kind==="saved"?"star":"all";
  }
  appShow("quiz");
  setTimeout(()=>{try{startQuiz()}catch(e){toast("Quiz could not start")}},80);
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
  const todayPlan=$("todayPlan");
  if(todayPlan){
    const newCount=session.new;
    const primary=due.length||weak.length||newCount
      ? {label:"Today’s Session",detail:`${session.total} words · about ${session.minutes} min`,action:"startSmartSession('today')",button:"Start Today’s Session"}
      : db.words.length
        ? {label:"Keep the rhythm moving",detail:"Run a short random quiz",action:"startSmartSession('random')",button:"Start Quiz"}
        : {label:"Build your first collection",detail:"Add 3-5 words to begin",action:"appShow('add')",button:"Add Words"};
    todayPlan.innerHTML=`
      <div class="tn-today-primary">
        <div><span class="tn-today-label">Recommended</span><strong>${esc(primary.label)}</strong><em>${esc(primary.detail)}</em></div>
        <button type="button" class="btn primary" onclick="${primary.action}">${esc(primary.button)}</button>
      </div>
      <div class="tn-today-grid">
        <button type="button" onclick="startSmartSession('due')"><b>${session.due}</b><span>Due today</span></button>
        <button type="button" onclick="startSmartSession('weak')"><b>${session.weak}</b><span>Needs practice</span></button>
        <button type="button" onclick="startSmartSession('new')"><b>${session.new}</b><span>New</span></button>
        <button type="button" onclick="window.tnOpenLibraryView?tnOpenLibraryView('mastered'):appShow('words')"><b>${session.mastered}</b><span>Mastered</span></button>
      </div>
      <div class="tn-recent-strip">${recent.length?recent.map(w=>`<button type="button" onclick="openDetail(${jsArg(w.id)})"><b>${esc(w.front)}</b><span>${esc(w.back)}</span></button>`).join(""):"<span class='desc'>Recent words will appear here after you add them.</span>"}</div>
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
          <span>${esc(meta)} · ${ws.length} words</span>
        </div>
      </div>
      <div class="playlist-stats">
        <span>${learned} learned</span>
        <span>${hard} hard</span>
      </div>
      <div class="playlist-actions">
        <button class="btn small primary" onclick="goStudy(${id},'quiz')">Quiz</button>
        <button class="btn small" onclick="goStudy(${id},'cards')">Cards</button>
        <button class="btn small" onclick="goStudy(${id},'audio')">Listen</button>
      </div>
    </div>`
  }).join("")||'<div class="empty"><div><strong>No lists yet</strong><span>Create a list when you want to group words by language, topic, or goal.</span></div><button type="button" class="btn" onclick="appShow(\'add\')">Create List</button></div>';
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
  return String(text||"")
    .split(/\r?\n/)
    .map((line,i)=>({line:String(line||"").trim(),row:i+1}))
    .filter(x=>x.line)
    .map(({line,row})=>{
      let exampleFromPipe="";
      let before=line;
      if(line.includes("|")){
        const pieces=line.split("|");
        before=pieces.shift().trim();
        exampleFromPipe=pieces.join("|").trim();
      }

      let parts=splitBulkLine(before);
      let front="",back="",pos="",gender="",memo="",pronunciation="";

      if(parts.length>=5){
        front=parts[0];
        back=parts[1];
        pos=parts[2];
        gender=parts[3];
        if(exampleFromPipe)pronunciation=parts.slice(4).join(" ");
        else memo=parts.slice(4).join(" ");
      }else if(parts.length===4){
        front=parts[0];
        back=parts[1];
        pos=parts[2];
        gender=parts[3];
      }else if(parts.length===3){
        front=parts[0];
        back=parts[1];
        pos=parts[2];
      }else if(parts.length===2){
        front=parts[0];
        back=parts[1];
      }else{
        front=line;
      }

      if(exampleFromPipe){
        memo=exampleFromPipe;
      }

      const normalized=window.TangoNestExampleFields?.normalizeFields(memo,pronunciation)||{memo,pronunciation};
      return {
        row,
        front:cleanBulkValue(front),
        back:cleanBulkValue(back),
        pos:cleanBulkValue(pos),
        gender:cleanBulkValue(gender),
        memo:cleanBulkValue(normalized.memo),
        pronunciation:cleanBulkValue(normalized.pronunciation)
      };
    })
    .filter(r=>r.front && r.back);
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
  let listId=$("bulkList").value,seenExact=new Set(),seenFront=new Set();
  return parseBulk($("bulkText").value).map(r=>{
    let exactKey=[r.front,r.back,r.pos].map(x=>String(x||"").trim().toLowerCase()).join("||");
    let frontKey=String(r.front||"").trim().toLowerCase();
    let exactDuplicate=!!duplicateMatch(r,listId)||seenExact.has(exactKey);
    let frontDuplicate=!!softDuplicateMatch(r,listId)||seenFront.has(frontKey);
    seenExact.add(exactKey);
    seenFront.add(frontKey);
    return{...r,duplicate:exactDuplicate,frontDuplicate,existing:softDuplicateMatch(r,listId)||null};
  });
}
function bulkParseStats(){
  const lines=String($("bulkText")?.value||"").split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  const rows=bulkRows();
  return {lines:lines.length,valid:rows.length,invalid:Math.max(0,lines.length-rows.length),rows};
}
let approvedBulkConfirmationKey="";
let lastLocalBulkUndo=null;
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
  return JSON.stringify({listId:target.listId,frontLang:target.frontLang,backLang:target.backLang,mode:mode||"skip",rows:rows.map(row=>[row.front,row.back,row.pos])});
}
function updateBulkDestinationSummary(){
  const box=$("bulkTargetSummary");
  if(!box)return;
  const target=bulkDestination();
  box.innerHTML=`<span>Destination</span><strong>${esc(target.listName)}</strong><small>${esc(langName(target.frontLang))} → ${esc(langName(target.backLang))}</small>`;
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
  panel.hidden=false;
  panel.innerHTML=`<div><span class="tn-bulk-confirm-kicker">Confirm destination</span><strong>${esc(target.listName)}</strong><small>${rows.length} words · ${esc(langName(target.frontLang))} → ${esc(langName(target.backLang))}</small></div><div class="tn-bulk-confirm-actions"><button type="button" data-bulk-cancel>Go back</button><button type="button" data-bulk-approve>Import here</button></div>`;
  panel.querySelector("[data-bulk-cancel]")?.addEventListener("click",hideBulkDestinationConfirmation);
  panel.querySelector("[data-bulk-approve]")?.addEventListener("click",()=>{approvedBulkConfirmationKey=key;window.bulkImport(mode||undefined)});
  return false;
}
function showBulkUndo(info){
  const panel=$("bulkUndoPanel");
  if(!panel)return;
  panel.hidden=false;
  panel.innerHTML=`<div><strong>${Number(info?.count||0)} words added to ${esc(info?.playlistName||"the selected playlist")}</strong><small>You can undo this import without affecting earlier words.</small></div><button type="button" onclick="undoLastBulkImport()">Undo last Bulk Add</button>`;
}
function clearBulkUndo(){lastLocalBulkUndo=null;const panel=$("bulkUndoPanel");if(panel){panel.hidden=true;panel.innerHTML=""}}
async function undoLastBulkImport(){
  if(!lastLocalBulkUndo)return toast("There is no Bulk Add to undo");
  if(lastLocalBulkUndo.type==="snapshot")db.words=lastLocalBulkUndo.words;
  else{const ids=new Set(lastLocalBulkUndo.ids||[]);db.words=db.words.filter(word=>!ids.has(word.id))}
  const count=lastLocalBulkUndo.count||0;
  clearBulkUndo();
  save();
  toast(`${count} imported words removed`);
}
function clearBulkPreview(){
  let b=$("bulkPreview");if(b){b.style.display="none";b.innerHTML=""}
  let d=$("bulkDuplicatePanel");if(d){d.classList.remove("show");d.innerHTML=""}
  hideBulkDestinationConfirmation();
}
function renderDuplicatePanel(rows){
  const panel=$("bulkDuplicatePanel");
  if(!panel)return;
  const dup=rows.filter(r=>r.frontDuplicate);
  if(!dup.length){panel.classList.remove("show");panel.innerHTML="";return;}
  panel.classList.add("show");
  panel.innerHTML=`<div class="dup-title">Duplicate front words found: ${dup.length}</div>
  <p class="desc">Frontが同じ単語があります。自動スキップせず、下のボタンで登録方法を選んでください。</p>
  <div class="dup-list">`+dup.map(r=>{
    let ex=r.existing;
    return `<div class="dup-item"><b>${esc(r.front)}</b>
      <span class="badge">New: ${esc(r.back)} / ${esc(r.pos||"—")}</span>
      ${ex?`<span class="badge yellow">Existing: ${esc(ex.back)} / ${esc(ex.pos||"—")}</span>`:"<span class='badge'>Duplicate in pasted rows</span>"}
    </div>`
  }).join("")+`</div>
  <div class="dup-actions">
    <button class="btn red" onclick="bulkImport('skip')">Skip Exact Duplicates</button>
    <button class="btn green" onclick="bulkImport('addBoth')">Add Both</button>
    <button class="btn blue" onclick="bulkImport('replace')">Replace Existing</button>
  </div>`;
}
function previewBulk(){
  let stats=bulkParseStats(),rows=stats.rows,box=$("bulkPreview");
  box.style.display="block";
  if(!rows.length){box.innerHTML='<div class="empty"><h3>No readable words</h3><p>Each row needs at least Front and Back.</p></div>';return}
  renderDuplicatePanel(rows);
  const target=bulkDestination();
  box.innerHTML=`<div class="tn-bulk-preview-target"><b>Import to ${esc(target.listName)}</b><span>${esc(langName(target.frontLang))} → ${esc(langName(target.backLang))}</span></div><div class="tn-bulk-summary"><span>${stats.valid} valid</span><span>${stats.invalid} invalid</span><span>${rows.filter(r=>r.duplicate).length} exact duplicates</span><span>${rows.filter(r=>r.frontDuplicate).length} same-front</span></div><div class="tablewrap"><table><thead><tr><th>Row</th><th>Front</th><th>Back</th><th>POS</th><th>Gender</th><th>Pronunciation</th><th>Example</th><th>Status</th></tr></thead><tbody>`+rows.map(r=>`<tr><td>${r.row}</td><td><b>${esc(r.front)}</b></td><td>${esc(r.back)}</td><td>${esc(r.pos)}</td><td>${esc(r.gender)}</td><td>${esc(r.pronunciation)}</td><td>${esc(r.memo)}</td><td>${r.duplicate?'<span class="badge red">Exact Duplicate</span>':r.frontDuplicate?'<span class="badge yellow">Same Front</span>':'<span class="badge green">Ready</span>'}</td></tr>`).join("")+"</tbody></table></div>"
}
function bulkImport(mode){
  let rows=bulkRows();
  if(!rows.length)return toast("No readable words");
  const hasFrontDup=rows.some(r=>r.frontDuplicate);
  if(hasFrontDup&&!mode){previewBulk();return toast("Duplicate words need confirmation");}
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
    $("bulkText").value="";clearBulkPreview();save();showBulkUndo({count:rows.length,playlistName:target.listName});return toast(`${rows.length} processed`);
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
  if(!rows.length)return toast("No new words to add");
  if(!requestBulkDestinationConfirmation(rows,mode))return;
  const additions=rows.map(r=>({id:uid(),front:r.front,back:r.back,frontLang,backLang,listId,memo:r.memo,pronunciation:r.pronunciation,pos:r.pos,gender:r.gender,tags:"",saved:false,status:"new",seen:0,level:1,nextReview:today(),learningState:"new",reviewIntervalDays:0,consecutiveCorrect:0,lastResult:"",createdAt:new Date().toISOString()}));
  db.words=[...db.words,...additions];
  lastLocalBulkUndo={type:"ids",ids:additions.map(word=>word.id),count:additions.length};
  $("bulkText").value="";clearBulkPreview();save();showBulkUndo({count:additions.length,playlistName:target.listName});toast(`${additions.length} added`);
}
try{window.bulkRows=bulkRows;window.previewBulk=previewBulk;window.clearBulkPreview=clearBulkPreview;window.requestBulkDestinationConfirmation=requestBulkDestinationConfirmation;window.showBulkUndo=showBulkUndo;window.clearBulkUndo=clearBulkUndo;window.undoLastBulkImport=undoLastBulkImport;window.updateBulkDestinationSummary=updateBulkDestinationSummary;}catch(e){}
function posBadge(pos){return pos?`<span class="badge ${["noun","verb","adjective","adverb","phrase"].includes(pos)?pos:""}">${esc(pos)}</span>`:""}
function genderBadge(g){if(!g)return"";let letter=g==="masculine"?"M":g==="feminine"?"F":g==="neutral"?"N":g==="plural"?"PL":String(g)[0].toUpperCase();let cls=g==="masculine"?"m":g==="feminine"?"f":"n";return`<span class="badge ${cls}">${esc(letter)}</span>`}
function moveWord(id,dir){let w=db.words.find(x=>x.id===id);if(!w)return;let same=db.words.filter(x=>x.listId===w.listId),pos=same.findIndex(x=>x.id===id),target=same[pos+dir];if(!target)return toast("Cannot move further");let i1=db.words.findIndex(x=>x.id===id),i2=db.words.findIndex(x=>x.id===target.id);[db.words[i1],db.words[i2]]=[db.words[i2],db.words[i1]];save()}
function toggleSelected(id,c){c?selectedIds.add(id):selectedIds.delete(id)}
function deleteSelected(){if(!selectedIds.size)return toast("Select words first");if(!confirm(`${selectedIds.size} words will be deleted.`))return;db.words=db.words.filter(w=>!selectedIds.has(w.id));db.mistakes=ensureMistakes().filter(entry=>!selectedIds.has(entry.wordId));selectedIds.clear();save()}
function removeWord(id){if(!confirm("Delete this word?"))return;db.words=db.words.filter(w=>w.id!==id);db.mistakes=ensureMistakes().filter(entry=>entry.wordId!==id);selectedIds.delete(id);save()}
function toggleStar(id){db.words=db.words.map(w=>w.id===id?{...w,saved:!w.saved}:w);if(current&&current.id===id)current=db.words.find(w=>w.id===id);save()}
function openDetail(id){let w=db.words.find(x=>x.id===id);if(!w)return;modalReturnFocus.detail=document.activeElement;const view=learningPresentation();const learning=view?.state(w)||{label:learningEngine()?.levelName(w.level)||"Learning"};const review=view?.review(w)||{label:w.nextReview||"Review not scheduled"};const accuracy=view?.accuracy(w)||{label:`${Math.round((learningEngine()?.accuracy(w)||0)*100)}% accuracy`};const lastStudied=view?.lastStudied(w)||(w.lastAnsweredAt?new Date(w.lastAnsweredAt).toLocaleDateString():"Not studied yet");$("detailContent").innerHTML=`<div class="dict-title">${esc(w.front)}</div><div class="dict-meaning">${esc(w.back)}</div><div>${posBadge(w.pos)} ${genderBadge(w.gender)} ${w.tags?`<span class="badge">${esc(w.tags)}</span>`:""}</div><div class="actions"><button class="btn blue" onclick="speak(${jsArg(w.front)},${jsArg(safeLang(w.frontLang))})">Play Front</button><button class="btn blue" onclick="speak(${jsArg(w.back)},${jsArg(safeLang(w.backLang,"ja-JP"))})">Play Back</button><button class="btn" onclick="openEdit(${jsArg(w.id)})">Edit</button></div><div class="dict-grid"><div class="dict-box"><b>Languages</b>${langName(w.frontLang)} → ${langName(w.backLang)}</div><div class="dict-box"><b>Learning</b>${esc(learning.label)}</div><div class="dict-box"><b>Accuracy</b>${esc(accuracy.label)}</div><div class="dict-box"><b>Next Review</b>${esc(review.label)}</div><div class="dict-box"><b>Last Studied</b>${esc(lastStudied)}</div><div class="dict-box"><b>Memo / Example</b>${esc(w.memo||"-")}</div></div>`;$("detailModal").classList.add("show");setTimeout(()=>$("detailModal")?.querySelector("button")?.focus({preventScroll:true}),0)}
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
  el.textContent=words.length?`${words.length} cards · ${due} due · ${hard} weak · Space flips · 1-4 rates`:"No cards in this view.";
}
function resetCard(){clearFlashTimers();current=null;flipped=false;$("flash").classList.remove("is-flipped");$("frontWord").textContent="---";$("backWord").textContent="---";$("frontMemo").textContent="";$("backMemo").textContent="";updateStudyStar();updateStudyProgress()}
function weighted(words){if(!words.length)return null;const ordered=[...words].sort((a,b)=>(learningEngine()?.learningWeight(b)||0)-(learningEngine()?.learningWeight(a)||0));const top=ordered.slice(0,Math.max(1,Math.ceil(ordered.length/2)));return top[Math.floor(Math.random()*top.length)]}
function nextCard(){clearFlashTimers();let words=studyWords();if(!words.length){resetCard();return toast("No words")}const candidates=current&&words.length>1?words.filter(word=>word.id!==current.id):words;current=weighted(candidates);flipped=false;$("flash").classList.remove("is-flipped");current.seen=(current.seen||0)+1;drawCard();persist();updateStudyStar();updateStudyProgress()}
function drawCard(){if(!current)return;let mode=$("studyMode").value;if(mode==="back"){$("frontWord").textContent=current.back;$("backWord").textContent=current.front;$("backMemo").textContent=current.memo||""}else{$("frontWord").textContent=current.front;$("backWord").textContent=current.back;$("backMemo").textContent=current.memo||""}$("frontMemo").textContent=[current.pos,current.gender].filter(Boolean).join(" / ")}
function flipCard(){if(!current)return;flipped=!flipped;$("flash").classList.toggle("is-flipped",flipped)}
function speakCard(){if(!current)return;let mode=$("studyMode").value,text,lang;if(mode==="back"){text=flipped?current.front:current.back;lang=flipped?current.frontLang:current.backLang}else{text=flipped?current.back:current.front;lang=flipped?current.backLang:current.frontLang}speak(text,lang)}
function markCard(rating,autoNext=false){if(!current)return;const normalized=learningEngine()?.normalizeRating(rating)||rating;if(normalized==="again")recordMistake(current,"flashcard","Again",current.back);const updated=updateWordLearning(current.id,normalized,{mode:"cards"});current=updated||db.words.find(w=>w.id===current.id);if(normalized==="good"||normalized==="easy")markMistakeCorrect(current.id);const feedback=learningPresentation()?.rating(current,normalized);toast(feedback?`${feedback.label} · ${feedback.review}`:`${normalized[0].toUpperCase()+normalized.slice(1)} saved`);if(autoNext)flashTimers.push(setTimeout(()=>nextCard(),700))}
function toggleCardStar(){if(current)toggleStar(current.id)}
function updateStudyStar(){let b=$("studyStar");if(b)b.textContent=current&&current.saved?"★ Saved":"☆ Save"}
function clearFlashTimers(){flashTimers.forEach(t=>clearTimeout(t));flashTimers=[]}
function startFlashAuto(){$("flashAutoMode").value="on";playFlashAutoCycle()}
function stopFlashAuto(){clearFlashTimers();$("flashAutoMode").value="off"}
function playFlashAutoCycle(){clearFlashTimers();if($("flashAutoMode").value!=="on")return;nextCard();if(!current)return stopFlashAuto();let mode=$("studyMode").value,frontText=mode==="back"?current.back:current.front,frontLang=mode==="back"?current.backLang:current.frontLang,backText=mode==="back"?current.front:current.back,backLang=mode==="back"?current.frontLang:current.backLang;speak(frontText,frontLang);let flipDelay=parseInt($("flashFlipDelay").value),nextDelay=parseInt($("flashNextDelay").value);flashTimers.push(setTimeout(()=>{if($("flashAutoMode").value!=="on")return;if(!flipped)flipCard();speak(backText,backLang)},flipDelay));flashTimers.push(setTimeout(()=>playFlashAutoCycle(),flipDelay+nextDelay))}
function updateWordLearning(id,rating,context={}){const engine=learningEngine();const at=new Date();const eventId=context.eventId||learningEventId();let updated=null;db.words=db.words.map(w=>{if(w.id!==id)return w;updated=engine?engine.calculateLearningUpdate(w,{rating,mode:context.mode||"study",at}):w;return updated});if(!updated)return null;persist();const event={eventId,wordId:id,rating:engine?.normalizeRating(rating)||rating,mode:context.mode||"study",answeredAt:at.toISOString(),localWord:{...updated}};try{window.tnRecordLearningResult?.(event)}catch(e){console.warn("Learning sync queued locally",e)}try{renderHome();window.tnLibraryRender?.();updateStudyProgress()}catch(e){}return updated}
function quizLearningWeight(w){return learningEngine()?.learningWeight(w)??1}
function quizAdaptiveOrder(words){return [...words].sort((a,b)=>((Math.random()/Math.max(.1,quizLearningWeight(a)))-(Math.random()/Math.max(.1,quizLearningWeight(b)))))}
function quizPool(){let list=$("quizList").value,scope=$("quizScope").value;let words=list==="all"?[...db.words]:db.words.filter(w=>(w.listId||"")===(list||""));if(scope==="mistakes"){const ids=new Set(ensureMistakes().map(entry=>entry.wordId));words=db.words.filter(w=>ids.has(w.id))}else{if(scope==="hard")words=words.filter(w=>learningEngine()?.isWeakWord(w)??w.status==="hard");if(scope==="due")words=words.filter(isDue);if(scope==="star")words=words.filter(w=>w.saved)}return words}
function quizOrderedWords(words){
  const order=$("quizOrderMode")?.value||"random";
  if(order==="playlist")return [...words];
  if(order==="weak")return [...words].sort((a,b)=>Number(learningEngine()?.isWeakWord(b))-Number(learningEngine()?.isWeakWord(a))||quizLearningWeight(b)-quizLearningWeight(a));
  if(order==="due")return [...words].sort((a,b)=>Number(isDue(b))-Number(isDue(a))||String(a.nextReview||"9999").localeCompare(String(b.nextReview||"9999"))||quizLearningWeight(b)-quizLearningWeight(a));
  if(order==="newest")return [...words].sort((a,b)=>String(b.createdAt||b.created_at||"").localeCompare(String(a.createdAt||a.created_at||"")));
  return shuffle(words);
}
function shuffle(arr){let a=[...arr];for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
const QUIZ_FEEDBACK_SPEED_KEY="tangonest_quiz_feedback_speed_v1";
const QUIZ_AUTO_ADVANCE_MIGRATION_KEY="tangonest_quiz_auto_advance_rc18_v1";
function ensureQuizFeedbackDefault(){
  const el=$("quizAutoAdvance");
  if(!el)return;
  if(!el.__tnFeedbackSpeedBound){
    el.addEventListener("change",()=>{try{localStorage.setItem(QUIZ_FEEDBACK_SPEED_KEY,el.value)}catch(e){}});
    el.__tnFeedbackSpeedBound=true;
  }
  let saved="",migrated=false;
  try{
    migrated=localStorage.getItem(QUIZ_AUTO_ADVANCE_MIGRATION_KEY)==="complete";
    saved=localStorage.getItem(QUIZ_FEEDBACK_SPEED_KEY)||"";
    if(!migrated){saved="auto";localStorage.setItem(QUIZ_FEEDBACK_SPEED_KEY,saved);localStorage.setItem(QUIZ_AUTO_ADVANCE_MIGRATION_KEY,"complete")}
  }catch(e){}
  const values=[...el.options].map(option=>option.value);
  el.value=values.includes(saved)?saved:"auto";
  const custom=$("quizNextDelay");
  if(custom&&!custom.value)custom.value="1.5";
}
function updateQuizModeSettings(forceDefaults=false){
  const type=$("quizType")?.value||"choice";
  const difficulty=$("listeningDifficulty")?.value||"normal";
  document.querySelectorAll("[data-quiz-setting]").forEach(node=>{
    const modes=String(node.dataset.quizSetting||"").split(/\s+/).filter(Boolean);
    const visible=modes.includes("all")||modes.includes(type)||(type==="listening"&&difficulty==="hard"&&modes.includes("listening-hard"));
    node.hidden=!visible;
  });
  if(type==="listening"){
    if($("quizAudioAfter"))$("quizAudioAfter").value="off";
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
function resetQuiz(){clearQuizTimers();ensureQuizFeedbackDefault();quiz={queue:[],wrong:[],allWrong:[],index:0,score:0,current:null,answered:false,type:"choice",direction:"front",total:0,previousQuestionId:"",previousQuestionKey:"",selectedAnswer:null,listeningReplayUsed:0};if($("quizType"))$("quizType").value="choice";updateQuizModeSettings();placeTypingArea(false);$("quizSetup").style.display="block";$("quizRun").style.display="none";$("quizEnd").style.display="none";$("pageQuiz")?.classList.remove("quiz-focus-active");if($("listeningPanel"))$("listeningPanel").style.display="none";resetQuizAnswerVisualState()}
function startQuiz(){clearQuizTimers();ensureQuizFeedbackDefault();updateQuizModeSettings();let words=smartSessionQueue.length?[...smartSessionQueue]:quizPool();smartSessionQueue=[];let requested=parseInt($("quizCount").value,10)||10;if(requested<1)requested=1;if(!words.length)return toast("No words");let actual=Math.min(requested,words.length);quiz={queue:quizOrderedWords(words).slice(0,actual),wrong:[],allWrong:[],index:0,score:0,current:null,answered:false,type:$("quizType").value||"choice",direction:$("quizDirection").value,total:actual,previousQuestionId:"",previousQuestionKey:"",selectedAnswer:null,listeningReplayUsed:0};$("quizSetup").style.display="none";$("quizRun").style.display="grid";$("quizEnd").style.display="none";$("pageQuiz")?.classList.add("quiz-focus-active");showQuizQuestion();window.scrollTo(0,0)}
function resetQuizAnswerVisualState(){quiz.selectedAnswer=null;document.querySelectorAll(".choice").forEach(b=>{b.disabled=false;b.classList.remove("selected","active","correct","incorrect","wrong","is-selected","is-active","is-correct","is-wrong");try{b.blur()}catch(e){}});$("choiceArea")?.classList.remove("is-answered");const result=$("quizResult");if(result){result.className="result-box";result.textContent=""}const answer=$("quizQuestionAnswer");if(answer){answer.className="quiz-question-answer";answer.textContent=""}const skip=$("quizSkipButton");if(skip)skip.hidden=false;const card=document.querySelector(".quiz-question");if(card){card.classList.remove("is-answered","has-long-answer","is-listening")}}
function quizQuestionKey(word){if(!word)return "";const text=quiz.type==="listening"?listeningPromptText(word):(quiz.direction==="back"?word.back:word.front);return normalize(text)}
function avoidConsecutiveDuplicateQuestion(){if(!quiz.queue||quiz.queue.length<=1)return;const current=quiz.queue[quiz.index];if(!current)return;const prevId=quiz.previousQuestionId||"";const prevKey=quiz.previousQuestionKey||"";const sameId=prevId&&current.id===prevId;const sameKey=prevKey&&quizQuestionKey(current)===prevKey;if(!sameId&&!sameKey)return;const swapIndex=quiz.queue.findIndex((w,i)=>i>quiz.index&&w&&w.id!==prevId&&quizQuestionKey(w)!==prevKey);if(swapIndex>-1){const tmp=quiz.queue[quiz.index];quiz.queue[quiz.index]=quiz.queue[swapIndex];quiz.queue[swapIndex]=tmp;return}const fallback=quiz.queue.find(w=>w&&w.id!==prevId&&quizQuestionKey(w)!==prevKey);if(fallback)quiz.queue[quiz.index]=fallback}
function listeningPromptText(word=quiz.current){if(!word)return"";return word.front}
function listeningPromptLang(word=quiz.current){if(!word)return"en-US";return word.frontLang}
function listeningIsHard(){return ($("listeningDifficulty")?.value||"normal")==="hard"}
function listeningReplayLimit(){if(!listeningIsHard())return Infinity;const raw=$("listeningReplayLimit")?.value||"1";return raw==="unlimited"?Infinity:Math.max(1,parseInt(raw,10)||1)}
function listeningTimerLimit(){if(!listeningIsHard())return 0;const raw=$("listeningTimerMode")?.value||"10";return raw==="off"?0:Math.max(2,parseInt(raw,10)||10)}
function updateListeningTimerInline(value){
  const el=$("listeningTimeInline");
  if(el)el.textContent=value?`Time: ${value}`:"No time limit";
}
function renderListeningPanel(){
  const panel=$("listeningPanel");
  if(!panel)return;
  if(quiz.type!=="listening"||!quiz.current){panel.style.display="none";panel.innerHTML="";placeTypingArea(false);return}
  const limit=listeningReplayLimit();
  const used=Number(quiz.listeningReplayUsed||0);
  const replayText=limit===Infinity?"Replay: Unlimited":`Replay: ${Math.max(0,limit-used)} left`;
  const timeLimit=listeningTimerLimit();
  const pronunciation=wordPronunciation(quiz.current);
  const hint=$("listeningHintMode")?.value==="on"&&pronunciation?`<span class="listening-hint">Pronunciation: ${esc(pronunciation)}</span>`:"";
  const input=$("quizAnswer");
  const previousValue=input?.value||"";
  const hadFocus=document.activeElement===input;
  placeTypingArea(false);
  panel.style.display="grid";
  panel.innerHTML=`<div class="listening-main"><button type="button" class="listening-play" onclick="playListeningAudio(true)">▶ Play Audio</button><span>${esc(replayText)}</span><span id="listeningTimeInline">${timeLimit?`Time: ${timeLimit}s`:"No time limit"}</span>${hint}</div><p>Type what you hear</p><div id="listeningInputSlot"></div>`;
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
    if(limit!==Infinity&&used>=limit){renderListeningPanel();return toast("Replay limit reached")}
    quiz.listeningReplayUsed=used+1;
  }
  speak(listeningPromptText(),listeningPromptLang());
  renderListeningPanel();
}
function focusQuizInput(){
  if(!(quiz.type==="typing"||quiz.type==="listening"))return;
  const input=$("quizAnswer");
  if(!input||quiz.answered)return;
  setTimeout(()=>{try{input.focus({preventScroll:true});input.select()}catch(e){try{input.focus()}catch(err){}}},80);
}
function showQuizQuestion(){clearQuizTimers();resetQuizAnswerVisualState();quiz.answered=false;quiz.selectedAnswer=null;quiz.listeningReplayUsed=0;avoidConsecutiveDuplicateQuestion();quiz.current=quiz.queue[quiz.index];if(!quiz.current)return endQuiz();$("quizProgress").textContent=(quiz.index+1)+" / "+quiz.total;$("quizScore").textContent=quiz.score+" / "+quiz.total;const isListening=quiz.type==="listening";let q=isListening?"":(quiz.direction==="front"?quiz.current.front:quiz.current.back);$("quizWord").textContent=q;$("quizLabel").textContent=isListening?"Listening Quiz":(quiz.direction==="front"?"Front → ?":"Back → ?");if(!isListening)placeTypingArea(false);$("typingArea").style.display=(quiz.type==="typing"||isListening)?"block":"none";$("choiceArea").style.display=quiz.type==="choice"?"grid":"none";$("quizAnswer").value="";$("quizAnswer").placeholder=isListening?"Type the front word":"Type answer";const card=document.querySelector(".quiz-question");if(card)card.classList.toggle("is-listening",isListening);renderListeningPanel();if(quiz.type==="choice")renderChoices();startQuestionTimer();focusQuizInput();if(isListening)quizListeningAudioTimer=setTimeout(()=>{if(!quiz.answered)playListeningAudio(false)},180)}
function correctAnswer(){return quiz.type==="listening"?listeningPromptText():(quiz.direction==="front"?quiz.current.back:quiz.current.front)}
function correctAnswerLang(){return quiz.type==="listening"?listeningPromptLang():(quiz.direction==="front"?quiz.current.backLang:quiz.current.frontLang)}
function quizAnswerText(word){return quiz.direction==="front"?word.back:word.front}
function quizAnswerLang(word){return quiz.direction==="front"?word.backLang:word.frontLang}
function normalize(s){return String(s||"").trim().toLowerCase()}
function checkTypingAnswer(){if(quiz.answered)return;const input=$("quizAnswer");const value=input?.value||"";if(!value.trim()){focusQuizInput();return}quiz.selectedAnswer=value;finishAnswer(normalize(value)===normalize(correctAnswer()))}
function handleQuizAnswerKey(event){
  if(event.key!=="Enter")return;
  event.preventDefault();
  if(quiz.answered)return nextQuizQuestion();
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
  $("choiceArea").innerHTML=choices.map((c,index)=>`<button type="button" class="choice" data-shortcut="${index+1}" onclick="chooseAnswer(this,quiz.currentChoices[${index}])" aria-label="Answer ${index+1}: ${esc(c)}">${esc(c)}</button>`).join("");
}
function chooseAnswer(btn,ans){if(quiz.answered)return;quiz.selectedAnswer=ans;let ok=normalize(ans)===normalize(correctAnswer());[...document.querySelectorAll(".choice")].forEach(b=>{b.disabled=true;b.classList.remove("selected","active","correct","incorrect","wrong","is-selected","is-active","is-correct","is-wrong");try{b.blur()}catch(e){};if(normalize(b.textContent)===normalize(correctAnswer()))b.classList.add("correct")});btn.classList.add("selected");if(!ok)btn.classList.add("wrong");finishAnswer(ok)}
function quizLearningMessage(word,ok){if(!word)return"";const view=learningPresentation();const state=view?.state(word);const review=view?.review(word);return [state?.label,review?.label,!ok?"This word will appear more often.":""].filter(Boolean).join(" · ")}
function quizFeedbackHtml(ok,word){const answer=correctAnswer();const selected=quiz.selectedAnswer||($("quizAnswer")?.value||"").trim()||"No answer";const learning=quizLearningMessage(word,ok);const auto=isAutoAdvance();const timing=auto?`<span class="quiz-auto-note">Next question in ${(nextDelay(ok)/1000).toFixed(1)}s</span>`:"";return `<div class="quiz-feedback-copy"><strong>${ok?"✓ Correct":"× Incorrect"}</strong><span>Your answer: ${esc(selected)}</span>${ok?"":`<span>Correct answer: ${esc(answer)}</span>`}${learning?`<span class="quiz-level-note">${esc(learning)}</span>`:""}${timing}</div><div class="quiz-feedback-actions"><button type="button" class="quiz-answer-audio" onclick="speakCorrectAnswer()">Play answer</button><button type="button" class="quiz-next-btn" onclick="nextQuizQuestion()">Next now</button></div>`}
function renderQuizQuestionAnswer(ok){const box=$("quizQuestionAnswer");if(!box||!quiz.current)return;const card=document.querySelector(".quiz-question");if(card)card.classList.add("is-answered");box.className=`quiz-question-answer show ${ok?"ok":"no"}`;box.innerHTML=`<div class="quiz-answer-status ${ok?"ok":"no"}">${ok?"✓ Correct":"× Incorrect"}</div>`}
function finishAnswer(ok){if(quiz.answered)return;quiz.answered=true;quiz.previousQuestionId=quiz.current?.id||quiz.previousQuestionId;quiz.previousQuestionKey=quizQuestionKey(quiz.current)||quiz.previousQuestionKey;clearInterval(quizTimerInterval);const selected=quiz.selectedAnswer||$("quizAnswer")?.value||"";let fresh=null;if(ok){quiz.score++;fresh=updateWordLearning(quiz.current.id,"good",{mode:quiz.type||"quiz"});markMistakeCorrect(quiz.current.id);$("quizResult").className="result-box show ok";$("quizResult").innerHTML=quizFeedbackHtml(true,fresh)}else{recordMistake(quiz.current,quiz.type||"quiz",selected,correctAnswer());fresh=updateWordLearning(quiz.current.id,"again",{mode:quiz.type||"quiz"});$("quizResult").className="result-box show no";$("quizResult").innerHTML=quizFeedbackHtml(false,fresh);quiz.wrong.push(quiz.current);if(!quiz.allWrong.some(w=>w.id===quiz.current.id))quiz.allWrong.push(quiz.current)}$("choiceArea")?.classList.add("is-answered");renderQuizQuestionAnswer(ok);const skip=$("quizSkipButton");if(skip)skip.hidden=true;$("quizScore").textContent=quiz.score+" / "+quiz.total;if($("quizAudioAfter").value==="on")setTimeout(()=>{try{speakQuizFront()}catch(e){}},80);if(isAutoAdvance())scheduleNext(ok)}
function isAutoAdvance(){const mode=$("quizAutoAdvance")?.value||"auto";return mode!=="manual"&&mode!=="off"}
function nextDelay(ok){const mode=$("quizAutoAdvance")?.value||"auto";if(mode==="auto")return ok?1000:1600;let v=mode==="manual"||mode==="off"?1.5:parseFloat(mode);if(!Number.isFinite(v))v=1.5;v=Math.max(.7,Math.min(10,v));return Math.round(v*1000)}
function scheduleNext(ok){clearTimeout(quizAutoTimer);quizAutoTimer=setTimeout(()=>advanceQuiz(),nextDelay(ok))}
function advanceQuiz(){clearQuizTimers();if(!quiz.current)return;if(!quiz.answered){finishAnswer(false);return}quiz.index++;if(quiz.index>=quiz.queue.length)return endQuiz();showQuizQuestion()}
function nextQuizQuestion(){if(!quiz.current)return;if(!quiz.answered){finishAnswer(false);return}advanceQuiz()}
function speakQuizQuestion(){if(!quiz.current)return;if(quiz.type==="listening")return playListeningAudio(true);let text=quiz.direction==="front"?quiz.current.front:quiz.current.back,lang=quiz.direction==="front"?quiz.current.frontLang:quiz.current.backLang;speak(text,lang)}
function speakCorrectAnswer(){if(!quiz.current)return;speak(correctAnswer(),correctAnswerLang())}
function speakQuizFront(){if(!quiz.current)return;speak(quiz.current.front,quiz.current.frontLang)}
function speakQuizBack(){if(!quiz.current)return;speak(quiz.current.back,quiz.current.backLang)}
function clearQuizTimers(){clearTimeout(quizAutoTimer);clearTimeout(quizListeningAudioTimer);clearInterval(quizTimerInterval);quizAutoTimer=null;quizListeningAudioTimer=null;quizTimerInterval=null}
function startQuestionTimer(){let wrap=$("quizTimerWrap"),fill=$("quizTimerFill"),text=$("quizTimerText"),label=$("quizTimerLabel");if(!wrap||!fill||!text)return;let limit=0;if(quiz.type==="listening")limit=listeningTimerLimit();else if($("quizHardMode").value==="on")limit=Math.max(2,parseInt($("quizTimeLimit").value||"8",10));if(!limit){wrap.classList.remove("show");if(label)label.textContent="Time limit: Off";text.textContent="";fill.style.width="0%";fill.classList.remove("danger");if(quiz.type==="listening")updateListeningTimerInline("");return}quizQuestionStartedAt=Date.now();wrap.classList.toggle("show",quiz.type!=="listening");if(label)label.textContent=quiz.type==="listening"?"Listening timer":"Time limit";fill.style.width="100%";fill.classList.remove("danger");text.textContent=limit+"s";if(quiz.type==="listening")updateListeningTimerInline(limit+"s");quizTimerInterval=setInterval(()=>{if(quiz.answered){clearInterval(quizTimerInterval);return}let remain=Math.max(0,limit-(Date.now()-quizQuestionStartedAt)/1000),pct=remain/limit*100;fill.style.width=pct+"%";if(pct<30)fill.classList.add("danger");const shown=Math.ceil(remain)+"s";text.textContent=shown;if(quiz.type==="listening")updateListeningTimerInline(shown);if(remain<=0){clearInterval(quizTimerInterval);finishAnswer(false)}},200)}
function renderQuizSummary(){
  const box=$("quizResultSummary");
  if(!box)return;
  const wrong=(quiz.allWrong||[]).length;
  const accuracy=quiz.total?Math.round(quiz.score/quiz.total*100):0;
  const improved=quiz.queue.filter(word=>!learningEngine()?.isWeakWord(word)).length;
  const stillWeak=quiz.queue.filter(word=>learningEngine()?.isWeakWord(word)).length;
  const next=wrong?"Retry mistakes or review weak words.":"Nice. Add a few new words or keep listening.";
  box.innerHTML=`
    <div><b>${quiz.score}</b><span>Correct</span></div>
    <div><b>${wrong}</b><span>Wrong</span></div>
    <div><b>${accuracy}%</b><span>Accuracy</span></div>
    <div><b>${improved}</b><span>Improved</span></div>
    <div><b>${stillWeak}</b><span>Still weak</span></div>
    <div class="wide"><strong>${esc(next)}</strong></div>
  `;
}
function endQuiz(){clearQuizTimers();$("quizRun").style.display="none";$("quizEnd").style.display="block";$("pageQuiz")?.classList.remove("quiz-focus-active");$("quizEndText").textContent=`Score: ${quiz.score} / ${quiz.total}`;renderQuizSummary();renderWrongList();render()}
function renderWrongList(){let box=$("quizWrongList"),wrong=quiz.allWrong||[];if(!wrong.length){box.innerHTML='<div class="empty">No wrong answers. Great job!</div>';return}box.innerHTML='<h2 style="margin-top:8px">Wrong Answers</h2>'+wrong.map(item=>{let w=db.words.find(x=>x.id===item.id)||item,q=quiz.direction==="front"?w.front:w.back,a=quiz.direction==="front"?w.back:w.front,lang=safeLang(quiz.direction==="front"?w.frontLang:w.backLang);let id=jsArg(w.id);return`<div class="quiz-wrong-card"><button type="button" class="quiz-wrong-copy" onclick="openDetail(${id})"><span class="quiz-wrong-front">${esc(q)}</span><span class="quiz-wrong-back">Answer: ${esc(a)}</span></button><div class="quiz-wrong-actions"><button type="button" onclick="speak(${jsArg(q)},${jsArg(lang)})" aria-label="Play word audio">Play</button><button type="button" class="${w.saved?'starred':''}" onclick="toggleQuizWrongStar(${id})">${w.saved?'★ Saved':'☆ Save'}</button><button type="button" onclick="openDetail(${id})">Detail</button></div></div>`}).join("")}
function toggleQuizWrongStar(id){toggleStar(id);renderWrongList()}
function restartWrongQuiz(){let wrong=quiz.allWrong||[];if(!wrong.length)return resetQuiz();quiz={...quiz,queue:shuffle(wrong),wrong:[],index:0,score:0,current:null,answered:false,total:wrong.length};$("quizEnd").style.display="none";$("quizRun").style.display="grid";$("pageQuiz")?.classList.add("quiz-focus-active");showQuizQuestion()}
function audioWords(){let list=$("audioList").value,order=$("audioOrder").value;let words=list==="all"?[...db.words]:db.words.filter(w=>(w.listId||"")===(list||""));if(order==="star")words=words.filter(w=>w.saved);if(order==="due")words=words.filter(isDue);if(order==="hard")words=[...words].sort((a,b)=>Number(learningEngine()?.isWeakWord(b))-Number(learningEngine()?.isWeakWord(a))||quizLearningWeight(b)-quizLearningWeight(a));if(order==="random")words=shuffle(words);return words}
function setAudioPlayerState(state){const player=$("audioNow")?.closest(".now-playing");if(player)player.dataset.state=state}
function startAudio(){stopAudio();audioQueue=audioWords();if(!audioQueue.length)return toast("No words");audioIndex=0;audioPaused=false;setAudioPlayerState("playing");playAudioCurrent()}
function pauseAudio(){audioPaused=true;clearTimeout(audioTimer);speechSynthesis.cancel();setAudioPlayerState("paused");toast("Paused")}
function stopAudio(){clearTimeout(audioTimer);speechSynthesis.cancel();audioPaused=false;audioIndex=0;$("audioNow").textContent="---";$("audioSub").textContent="Choose a playlist and press Play";setAudioPlayerState("idle")}
function playAudioOnce(){let words=audioWords();if(!words.length)return toast("No words");let w=words[Math.floor(Math.random()*words.length)];updateNow(w);speakByPattern(w)}
function nextAudio(){clearTimeout(audioTimer);try{speechSynthesis.cancel()}catch(e){};if(!audioQueue.length)audioQueue=audioWords();if(!audioQueue.length)return toast("No words");audioPaused=false;playAudioCurrent()}
function previousAudio(){clearTimeout(audioTimer);try{speechSynthesis.cancel()}catch(e){};if(!audioQueue.length)audioQueue=audioWords();if(!audioQueue.length)return toast("No words");audioIndex=Math.max(0,audioIndex-2);audioPaused=false;playAudioCurrent()}
function playAudioCurrent(){if(audioPaused)return;if(audioIndex>=audioQueue.length){audioIndex=0;if($("audioOrder").value==="random")audioQueue=shuffle(audioQueue)}let w=audioQueue[audioIndex++];updateNow(w);speakByPattern(w);audioTimer=setTimeout(playAudioCurrent,Math.max(.5,parseFloat($("audioIntervalCustom").value||"5"))*1000)}
function updateNow(w){$("audioNow").textContent=w.front;$("audioSub").textContent=w.back;setAudioPlayerState("playing")}
function speakByPattern(w){speakPair(w,$("audioPattern").value)}
function speakPair(w,p){
  let gap=Math.max(.1,parseFloat($("pairGapCustom")?.value||"1.8"))*1000;
  if(p==="front")speak(w.front,w.frontLang);
  if(p==="back")speak(w.back,w.backLang);
  if(p==="frontBack")speakQueued([{text:w.front,lang:w.frontLang},{text:w.back,lang:w.backLang}],gap);
  if(p==="backFront")speakQueued([{text:w.back,lang:w.backLang},{text:w.front,lang:w.frontLang}],gap);
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
  toast("Backup downloaded");
}

function exportDataText(){
  const data=typeof window.tnBuildSafeExportData==="function"
    ? window.tnBuildSafeExportData()
    : {app:"TangoNest",version:"backup-v2",exportedAt:new Date().toISOString(),data:db};
  const text=JSON.stringify(data,null,2),box=$("syncDataBox");
  box.value=text;box.focus();box.select();
  if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(text).then(()=>toast("Copied export data")).catch(()=>toast("Export data is ready"));
  else toast("Export data is ready. Copy the text.");
}
function importDataText(){
  if(typeof window.tnImportDataToCloud==="function")return window.tnImportDataToCloud();
  toast("Import requires a signed-in account with online sync available.");
}
function clearLocalCache(){
  if(typeof window.tnClearLocalCache==="function")return window.tnClearLocalCache();
  if(!confirm("Clear this browser cache? Cloud data will be loaded again after sync."))return;
  tnPurgeUserStorage(tnActiveStorageUserId);
  db=tnEmptyData("manual-clear-local-cache");shareDb();resetCard();resetQuiz();render();toast("Local cache cleared");
}
function deleteAllAccountData(){
  if(typeof window.tnDeleteAllAccountData==="function")return window.tnDeleteAllAccountData();
  toast("Sign in with online sync available before deleting cloud data.");
}
function clearAll(){return clearLocalCache()}

let VOICES_READY=false;
let VOICE_CACHE=[];
const BEST_VOICE_CACHE=new Map();
let voiceLoadStarted=false;
const VOICE_PREF_KEY="tangonest_voice_preferences_v1";
const VOICE_LANGUAGE_SETTINGS=[
  {lang:"en-US",label:"English",sample:"Hello, this is English."},
  {lang:"ja-JP",label:"Japanese",sample:"こんにちは。日本語です。"},
  {lang:"fr-FR",label:"French",sample:"Bonjour, ceci est le français."},
  {lang:"ko-KR",label:"Korean",sample:"안녕하세요. 한국어입니다."},
  {lang:"zh-CN",label:"Chinese",sample:"你好，这是中文。"},
  {lang:"es-ES",label:"Spanish",sample:"Hola, esto es español."}
];
function loadVoicePrefs(){try{return JSON.parse(localStorage.getItem(VOICE_PREF_KEY)||"{}")||{}}catch(e){return{}}}
function saveVoicePrefs(prefs){try{localStorage.setItem(VOICE_PREF_KEY,JSON.stringify(prefs||{}))}catch(e){}}
function voiceIdentity(v){return [v?.voiceURI||"",v?.name||"",v?.lang||""].join("||")}

function normalizeVoiceLang(lang){
  const raw=String(lang||"").trim();
  const lower=raw.toLowerCase();
  if(lower.includes("english"))return "en-US";
  if(lower.includes("japanese")||lower.includes("日本"))return "ja-JP";
  if(lower.includes("korean"))return "ko-KR";
  if(lower.includes("chinese")||lower.includes("mandarin"))return "zh-CN";
  if(lower.includes("french"))return "fr-FR";
  if(lower.includes("spanish"))return "es-ES";
  const map={
    "en":"en-US","en-US":"en-US","en-GB":"en-GB",
    "fr":"fr-FR","fr-FR":"fr-FR",
    "ja":"ja-JP","ja-JP":"ja-JP",
    "ko":"ko-KR","ko-KR":"ko-KR",
    "zh":"zh-CN","zh-CN":"zh-CN","zh-TW":"zh-TW",
    "es":"es-ES","es-ES":"es-ES",
    "ar":"ar-SA","ar-SA":"ar-SA",
    "it":"it-IT","it-IT":"it-IT",
    "de":"de-DE","de-DE":"de-DE",
    "pt":"pt-BR","pt-BR":"pt-BR","pt-PT":"pt-PT",
    "ru":"ru-RU","ru-RU":"ru-RU",
    "nl":"nl-NL","nl-NL":"nl-NL",
    "vi":"vi-VN","vi-VN":"vi-VN",
    "th":"th-TH","th-TH":"th-TH",
    "tr":"tr-TR","tr-TR":"tr-TR",
    "hi":"hi-IN","hi-IN":"hi-IN",
    "id":"id-ID","id-ID":"id-ID",
    "el":"el-GR","el-GR":"el-GR",
    "he":"he-IL","he-IL":"he-IL"
  };
  return map[raw]||raw||"en-US";
}
window.tnNormalizeVoiceLang = normalizeVoiceLang;
function sanitizeSpeechText(text){
  return String(text||"")
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

async function speak(text,lang,opts={}){
  text=sanitizeSpeechText(text);
  if(!text)return;
  const finalLang=inferSpeechLanguage(text,lang);
  if(!window.speechSynthesis)return;
  await waitForVoices();
  try{
    // Cancel only before a new manual utterance. This prevents overlapped voices.
    if(opts.cancel!==false)window.speechSynthesis.cancel();
  }catch(e){}
  const u=new SpeechSynthesisUtterance(text);
  u.lang=finalLang;
  u.rate=parseFloat($("audioRate")?.value||"0.92");
  u.pitch=1;
  u.volume=1;
  const voice=pickVoice(finalLang);
  if(voice)u.voice=voice;
  try{
    window.speechSynthesis.speak(u);
  }catch(e){
    console.warn("Speech failed",e);
  }
}
async function speakText(text,language,opts={}){return speak(text,language,opts)}
window.speakText = speakText;

function speakQueued(items,gap=900){
  if(!items||!items.length)return;
  try{window.speechSynthesis.cancel()}catch(e){}
  let delay=0;
  items.forEach((it,idx)=>{
    setTimeout(()=>speak(it.text,it.lang,{cancel:false}),delay);
    delay+=gap;
  });
}

function renderVoiceSettings(){
  const box=$("voiceSettingsBox");
  if(!box)return;
  const voices=refreshVoices();
  if(!voices.length){
    box.innerHTML='<p class="desc">Browser voices are still loading. Press Refresh Voices if this does not update.</p>';
    waitForVoices().then(renderVoiceSettings);
    return;
  }
  const rows=VOICE_LANGUAGE_SETTINGS.map(item=>{
    const target=normalizeVoiceLang(item.lang);
    const matches=matchingVoicesForLanguage(target);
    const current=pickVoice(target);
    const currentId=current?voiceIdentity(current):"";
    const options=['<option value="">Auto best voice</option>'].concat(matches.map(v=>`<option value="${escAttr(voiceIdentity(v))}" ${voiceIdentity(v)===currentId?"selected":""}>${esc(v.name)} / ${esc(v.lang)}</option>`)).join("");
    const warning=!matches.length?`<div class="tn-voice-warning">No native ${esc(item.label)} voice found in this browser.</div>`:"";
    return `<div class="tn-voice-row"><div class="tn-voice-meta"><strong>${esc(item.label)}</strong><span>${current?esc(current.name)+" / "+esc(current.lang):"Auto voice unavailable"}</span>${warning}</div><div class="tn-voice-controls"><select aria-label="Voice for ${esc(item.label)}" onchange="tnSetVoicePreference('${target}',this.value)">${options}</select><button type="button" aria-label="Test ${esc(item.label)} voice" onclick="tnTestVoice('${target}')">Test</button></div></div>`;
  }).join("");
  const chineseVoice=pickVoice("zh-CN");
  const chineseOk=chineseVoice&&voiceMatchesLanguage(chineseVoice,"zh-CN");
  const chineseWarning=chineseOk?"":'<div class="tn-voice-warning strong">Chinese playback may sound wrong because this browser has no native Mandarin / zh-CN voice loaded.</div>';
  box.innerHTML=chineseWarning+rows;
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
  const langs=["en-US","fr-FR","ja-JP","ko-KR","zh-CN","zh-TW","es-ES","de-DE","it-IT","pt-BR","ru-RU"];
  box.style.display="block";
  if(!voices.length){
    box.innerHTML='<p class="desc">No browser voices loaded yet. Try again after a few seconds, or reload the page.</p>';
    waitForVoices().then(showVoiceStatus);
    return;
  }
  const zh=pickVoice("zh-CN");
  const zhWarning=zh&&voiceMatchesLanguage(zh,"zh-CN")?"":'<p class="tn-voice-warning strong">No native Chinese / Mandarin voice was found. Install or enable a zh-CN voice for best pronunciation.</p>';
  box.innerHTML='<p class="desc">Available voices: '+voices.length+'</p>'+zhWarning+
    langs.map(l=>{
      const v=pickVoice(l);
      const google=v&&String(v.name||"").toLowerCase().includes("google");
      return `<div style="padding:8px;border-bottom:1px solid var(--line)"><b>${langName(l)||l}</b> → ${v?esc(v.name)+" / "+esc(v.lang):"No voice"} ${google?'<span class="badge green">Google</span>':'<span class="badge">Fallback</span>'}</div>`
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

const TN_SESSION_KEY="tangonest_learning_session_v1";
function getLastSession(){
  const key=TN_LOCAL_QA_MODE?TN_SESSION_KEY:tnSessionStorageKey();
  if(!key)return{};
  try{return JSON.parse(localStorage.getItem(key)||"{}")}catch(e){return{}}
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
  if(s.quizType&&$("quizType"))$("quizType").value=s.quizType;
  if(s.quizDirection&&$("quizDirection"))$("quizDirection").value=s.quizDirection;
  if(s.quizOrderMode&&$("quizOrderMode"))$("quizOrderMode").value=s.quizOrderMode;
  if(s.audioPattern&&$("audioPattern"))$("audioPattern").value=s.audioPattern;
  if(s.audioOrder&&$("audioOrder"))$("audioOrder").value=s.audioOrder;
  if(s.studyMode&&$("studyMode"))$("studyMode").value=s.studyMode;
}
function rememberCurrentSession(mode){
  const listId=selectedValue(mode==="cards"?"studyList":mode==="audio"?"audioList":mode==="quiz"?"quizList":"addList")||activeListId?.();
  const patch={mode:mode||"home",listId};
  if($("quizCount"))patch.quizCount=$("quizCount").value;
  if($("quizType"))patch.quizType=$("quizType").value;
  if($("quizDirection"))patch.quizDirection=$("quizDirection").value;
  if($("quizOrderMode"))patch.quizOrderMode=$("quizOrderMode").value;
  if($("audioPattern"))patch.audioPattern=$("audioPattern").value;
  if($("audioOrder"))patch.audioOrder=$("audioOrder").value;
  if($("studyMode"))patch.studyMode=$("studyMode").value;
  setLastSession(patch);
}
function attachSessionMemory(){
  const map={quizList:"quiz",studyList:"cards",audioList:"audio",quizCount:"quiz",quizType:"quiz",quizDirection:"quiz",quizOrderMode:"quiz",audioOrder:"audio",audioPattern:"audio",studyMode:"cards"};
  Object.entries(map).forEach(([id,mode])=>{
    const el=$(id);
    if(el&&!el.dataset.sessionMemory){
      el.dataset.sessionMemory="1";
      el.addEventListener("change",()=>rememberCurrentSession(mode));
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
    one.innerHTML="<span>Front</span><b>Your word</b><small>Language</small>";
    two.innerHTML="<span>Back</span><b>Meaning</b><small>Translation</small>";
    three.innerHTML="<span>Mode</span><b>Quiz</b><small>Ready</small>";
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
  one.innerHTML=`<span>Front</span><b>${esc(s.front)}</b><small>${esc(s.frontLang)}</small>`;
  two.innerHTML=`<span>Back</span><b>${esc(s.back)}</b><small>${esc(s.backLang)}</small>`;
  three.innerHTML=`<span>Mode</span><b>${esc(s.mode)}</b><small>Ready</small>`;
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
  clearFlashTimers();
  clearQuizTimers();
  clearTimeout(audioTimer);
  try{speechSynthesis.cancel()}catch(e){}
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
  if(sub)sub.textContent="Choose a playlist and press Play";
  setAudioPlayerState("idle");
}
window.tnResetAccountUiState=resetAccountUiState;
function setupCoreInteractions(){
  if(window.__tnCoreInteractions)return;
  window.__tnCoreInteractions=true;
  ["addList","bulkList"].forEach(id=>{
    const el=$(id);
    if(el&&!el.dataset.recentPlaylist){
      el.dataset.recentPlaylist="1";
      el.addEventListener("change",()=>{rememberRecentPlaylist(el.value);if(id==="bulkList"){hideBulkDestinationConfirmation();updateBulkDestinationSummary()}});
    }
  });
  document.addEventListener("keydown",event=>{
    if(event.isComposing)return;
    const target=event.target;
    const tag=String(target?.tagName||"").toLowerCase();
    const inField=["input","textarea","select"].includes(tag);
    const createActive=$("pageAdd")?.classList.contains("active");
    const quizActive=$("pageQuiz")?.classList.contains("active")&&$("quizRun")?.style.display!=="none"&&quiz.current;
    if(quizActive&&!event.defaultPrevented){
      if(quiz.answered&&!inField&&(event.key==="Enter"||event.code==="Space")){
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
      $("addWordBtn")?.click();
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
  applyLastSessionToControls();
  attachSessionMemory();
  setupCoreInteractions();
  restoreRecentPlaylist();
  updateBulkDestinationSummary();
  ["bulkFrontLang","bulkBackLang"].forEach(id=>$(id)?.addEventListener("change",()=>{hideBulkDestinationConfirmation();updateBulkDestinationSummary()}));
  updateHeroPreview();
  if(typeof updateBrandContext==="function")updateBrandContext();
}
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
