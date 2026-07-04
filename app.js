
/* ===== TangoNest Supabase Config - Beta51 ===== */
window.TANGONEST_SUPABASE_URL = "https://bkbteylavujkfiwuqwdq.supabase.co";
window.TANGONEST_SUPABASE_KEY = "sb_publishable_UKX5qCXkbIRac4cc62_LXw_yEGDG6BZ";
var TANGONEST_SUPABASE_URL = window.TANGONEST_SUPABASE_URL;
var TANGONEST_SUPABASE_KEY = window.TANGONEST_SUPABASE_KEY;


function showAccountPage(){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  const account=document.getElementById("pageAccount");
  if(account)account.classList.add("active");
  document.querySelectorAll(".nav button").forEach(b=>b.classList.remove("active"));
  [...document.querySelectorAll(".nav button")].find(b=>b.textContent.trim()==="Account")?.classList.add("active");
  if(typeof rememberCurrentSession==="function")rememberCurrentSession("account");
}


function appShow(pageId){
  if(pageId==='account'){showAccountPage();return;}
  if(typeof go==="function"){go(pageId);return;}
  if(typeof showPage==="function"){showPage(pageId);return;}
  const target=document.querySelector(`[data-page="${pageId}"]`);
  if(target)target.click();
}

// TangoNest Split Edition - app.js

const KEY="tangonest_production_stable_v1";
const SHADOW_KEY="tangonest_last_good_data_v1";
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
function tnParsedData(raw){
  try{return raw ? JSON.parse(raw) : null}catch(e){return null}
}
function tnIsDefaultList(list){
  const id=String(list?.id||"");
  const name=String(list?.name||"").trim().toLowerCase();
  return !name || name==="new playlist" || id==="starter" || id==="local-starter";
}
function tnHasUserData(data){
  if(!data || typeof data!=="object")return false;
  const words=Array.isArray(data.words)?data.words:[];
  const lists=Array.isArray(data.lists)?data.lists:[];
  return words.some(w=>String(w?.front||"").trim()&&String(w?.back||"").trim()) ||
    lists.some(list=>!tnIsDefaultList(list));
}
function tnListName(data,id){
  return String((data?.lists||[]).find(list=>list.id===id)?.name||"New Playlist").trim().toLowerCase();
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
    const name=String(list.name||"New Playlist").trim().toLowerCase();
    const existing=out.lists.find(item=>item.id===list.id||String(item.name||"").trim().toLowerCase()===name);
    if(existing)Object.assign(existing,list);
    else out.lists.push({...list});
  };
  (b.lists||[]).forEach(addList);
  (a.lists||[]).forEach(addList);
  if(!out.lists.length)out.lists.push({id:"starter",name:"New Playlist"});
  const listIdByName=new Map(out.lists.map(list=>[String(list.name||"").trim().toLowerCase(),list.id]));
  const wordMap=new Map();
  const addWord=(source,word)=>{
    if(!word||!String(word.front||"").trim()||!String(word.back||"").trim())return;
    const sourceListName=tnListName(source,word.listId);
    const next={...word,listId:listIdByName.get(sourceListName)||word.listId||out.lists[0].id};
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
  const text=JSON.stringify(data);
  localStorage.setItem(KEY,text);
  if(tnHasUserData(data))localStorage.setItem(SHADOW_KEY,text);
}
function tnClearLastGoodData(){
  try{localStorage.removeItem(SHADOW_KEY)}catch(e){}
}
function loadTangoNestDB(){
  const current=localStorage.getItem(KEY);
  if(current){
    const parsed=tnParsedData(current);
    const shadow=tnParsedData(localStorage.getItem(SHADOW_KEY));
    if(parsed){
      if(tnHasUserData(parsed) && tnHasUserData(shadow)){
        const merged=tnMergeStoredData(parsed,shadow);
        tnWriteData(merged);
        return merged;
      }
      if(tnHasUserData(parsed) || !tnHasUserData(shadow))return parsed;
      tnWriteData(shadow);
      console.warn("TangoNest recovered data from last-good backup");
      return shadow;
    }
    if(tnHasUserData(shadow)){
      tnWriteData(shadow);
      console.warn("TangoNest recovered data from last-good backup");
      return shadow;
    }
  }
  const shadow=tnParsedData(localStorage.getItem(SHADOW_KEY));
  if(tnHasUserData(shadow)){
    tnWriteData(shadow);
    console.warn("TangoNest recovered data from last-good backup");
    return shadow;
  }
  let best=null,bestCount=-1,bestKey="";
  const keys=[...LEGACY_KEYS];
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i);
    if(k&&k.toLowerCase().includes(LEGACY_SLUG)&&!keys.includes(k))keys.push(k);
  }
  keys.forEach(k=>{
    try{
      const raw=localStorage.getItem(k);
      if(!raw)return;
      const parsed=JSON.parse(raw);
      if(parsed&&Array.isArray(parsed.words)&&Array.isArray(parsed.lists)){
        const count=parsed.words.length;
        if(count>bestCount){best=parsed;bestCount=count;bestKey=k;}
      }
    }catch(e){}
  });
  if(best){
    tnWriteData(best);
    console.log("TangoNest migrated data from",bestKey);
    return best;
  }
  return {ui:"en",prefs:{frontLang:"en-US",backLang:"ja-JP"},lists:[{id:"starter",name:"New Playlist"}],words:[]};
}
const LANGS=[
  ["fr-FR","French","mot"],["en-US","English","word"],["ja-JP","Japanese","意味"],["ko-KR","Korean","단어"],["zh-CN","Chinese Simplified","词"],["zh-TW","Chinese Traditional","詞"],["es-ES","Spanish","palabra"],["ar-SA","Arabic","كلمة"],["it-IT","Italian","parola"],["de-DE","German","Wort"],["pt-BR","Portuguese","palavra"],["ru-RU","Russian","слово"],["nl-NL","Dutch","woord"],["vi-VN","Vietnamese","tu"],["th-TH","Thai","คำ"],["tr-TR","Turkish","kelime"],["hi-IN","Hindi","शब्द"],["id-ID","Indonesian","kata"],["el-GR","Greek","λέξη"],["he-IL","Hebrew","מילה"]
];
let db=loadTangoNestDB();
db.prefs=db.prefs||{frontLang:"en-US",backLang:"ja-JP"};db.lists=db.lists&&db.lists.length?db.lists:[{id:"starter",name:"New Playlist"}];db.words=db.words||[];db.mistakes=Array.isArray(db.mistakes)?db.mistakes:[];
try{window.db=db;}catch(e){}
let current=null,flipped=false,timer=null,flashTimers=[],audioTimer=null,audioQueue=[],audioIndex=0,audioPaused=false,selectedIds=new Set();
let quiz={queue:[],wrong:[],allWrong:[],index:0,score:0,current:null,answered:false,type:"choice",direction:"front",total:0,listeningReplayUsed:0};let quizAutoTimer=null,quizTimerInterval=null,quizListeningAudioTimer=null,quizQuestionStartedAt=0;
const $=id=>document.getElementById(id);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2);
const today=()=>new Date().toISOString().slice(0,10);
function addDays(n){let d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
function isDue(w){return !!w.nextReview&&w.nextReview<=today()}
function dueWords(){return db.words.filter(isDue)}
function shareDb(){try{window.db=db;}catch(e){}return db}
function tnGetDb(){return shareDb()}
function tnAdoptDb(next){if(next&&typeof next==="object"){Object.keys(db).forEach(key=>delete db[key]);Object.assign(db,next);}return shareDb()}
function save(renderUI=true){shareDb();tnWriteData(db);if(renderUI)render()}
function persist(){shareDb();tnWriteData(db)}
try{window.tnGetDb=tnGetDb;window.tnAdoptDb=tnAdoptDb;window.tnWriteData=tnWriteData;}catch(e){}
function toast(m){$("toast").textContent=m;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),1700)}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function escAttr(s){return String(s??"").replace(/\\/g,"\\\\").replace(/'/g,"\\'").replace(/"/g,'&quot;')}
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
  try{ if(typeof window.tnLearningRenderHome==="function")window.tnLearningRenderHome(); }catch(e){}
}
function markMistakeCorrect(wordId){
  const entry=ensureMistakes().find(item=>item.wordId===wordId);
  if(!entry)return;
  entry.correctAfterMistake=Number(entry.correctAfterMistake||0)+1;
  entry.lastCorrectAt=new Date().toISOString();
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
  try{ if(typeof window.tnLearningRenderHome==="function")window.tnLearningRenderHome(); }catch(e){}
  toast("Mistake Notebook cleared");
}
function mistakeNotebookHtml(limit){
  const entries=mistakeEntriesSorted();
  if(!entries.length)return '<div class="empty">No mistakes yet.</div>';
  const rows=entries.slice(0,limit||entries.length).map(entry=>{
    const live=(db.words||[]).find(word=>word.id===entry.wordId)||entry;
    const date=entry.lastWrongAt?new Date(entry.lastWrongAt).toLocaleDateString():"-";
    const meta=[entry.playlistName,entry.sourceMode,entry.language?langName(entry.language):""].filter(Boolean).join(" · ");
    return `<div class="mistake-row">
      <button type="button" class="mistake-word" onclick="openDetail('${escAttr(entry.wordId)}')"><b>${esc(live.front||entry.front||"")}</b><span>${esc(live.back||entry.back||"")}</span></button>
      <div class="mistake-meta"><span>${esc(meta||"Mistake")}</span><span>${Number(entry.wrongCount||0)} wrong · ${esc(date)}</span>${entry.lastUserAnswer?`<small>Your answer: ${esc(entry.lastUserAnswer)}</small>`:""}</div>
      <div class="mistake-actions"><button type="button" onclick="startMistakeReview()">Review</button><button type="button" onclick="removeMistake('${escAttr(entry.wordId)}')">Clear</button></div>
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

window.tnDataSafety = window.tnDataSafety || (() => {
  const BACKUP_KEY = "tangonest_backup_before_cloud_hydration_v1";
  const clone = value => {
    try{return JSON.parse(JSON.stringify(value || {}));}catch(e){return {};}
  };
  const now = () => new Date().toISOString();
  const normalize = value => {
    const data = clone(value);
    data.ui = data.ui || "en";
    data.prefs = data.prefs || {};
    data.meta = data.meta || {};
    data.lists = Array.isArray(data.lists) ? data.lists.filter(Boolean) : [];
    data.words = Array.isArray(data.words) ? data.words.filter(Boolean) : [];
    if(!data.prefs.frontLang)data.prefs.frontLang = "en-US";
    if(!data.prefs.backLang)data.prefs.backLang = "ja-JP";
    if(!data.lists.length)data.lists.push({id:"starter",name:"New Playlist",createdAt:now()});
    data.words = data.words.map(word => ({...word,listId:word.listId || data.lists[0]?.id}));
    return data;
  };
  const isDefaultList = list => {
    const id = String(list?.id || "");
    const name = String(list?.name || "").trim().toLowerCase();
    return !name || name === "new playlist" || id === "starter" || id === "local-starter";
  };
  const hasUserData = value => {
    const data = normalize(value);
    const hasCustomPrefs = Object.entries(data.prefs || {}).some(([key,value]) => {
      if(key === "frontLang")return value && value !== "en-US";
      if(key === "backLang")return value && value !== "ja-JP";
      return value !== undefined && value !== null && value !== "";
    });
    return data.words.some(word => String(word.front || "").trim() && String(word.back || "").trim()) ||
      data.lists.some(list => !isDefaultList(list)) ||
      hasCustomPrefs;
  };
  const listName = (data,id) => String((data.lists || []).find(list => list.id === id)?.name || "New Playlist").trim().toLowerCase();
  const wordKey = (data,word) => [
    String(word.front || "").trim().toLowerCase(),
    String(word.back || "").trim().toLowerCase(),
    listName(data,word.listId)
  ].join("|");
  const newer = (a,b) => {
    const at = a?.updatedAt || a?.updated_at || a?.createdAt || a?.created_at || "";
    const bt = b?.updatedAt || b?.updated_at || b?.createdAt || b?.created_at || "";
    if(!at)return b;
    if(!bt)return a;
    return new Date(at) >= new Date(bt) ? a : b;
  };
  function merge(localValue,cloudValue){
    const local = normalize(localValue);
    const cloud = normalize(cloudValue);
    const lists = [];
    const addList = list => {
      if(!list)return;
      const name = String(list.name || "New Playlist").trim().toLowerCase();
      const exists = lists.find(item => item.id === list.id || String(item.name || "").trim().toLowerCase() === name);
      if(exists)Object.assign(exists,newer(exists,list));
      else lists.push({...list});
    };
    cloud.lists.forEach(addList);
    local.lists.forEach(addList);
    if(!lists.length)lists.push({id:"starter",name:"New Playlist",createdAt:now()});
    const byName = new Map(lists.map(list => [String(list.name || "").trim().toLowerCase(),list.id]));
    const merged = {...cloud,prefs:{...local.prefs,...cloud.prefs},meta:{...local.meta,...cloud.meta},lists,words:[],mistakes:[]};
    const words = new Map();
    const addWord = (source,word) => {
      if(!word || !String(word.front || "").trim() || !String(word.back || "").trim())return;
      const sourceListName = listName(source,word.listId);
      const next = {...word,listId:byName.get(sourceListName) || word.listId || lists[0].id};
      const key = wordKey({...source,lists},next);
      words.set(key,words.has(key) ? newer(words.get(key),next) : next);
    };
    cloud.words.forEach(word => addWord(cloud,word));
    local.words.forEach(word => addWord(local,word));
    merged.words = [...words.values()];
    const mistakes = new Map();
    [...(cloud.mistakes||[]),...(local.mistakes||[])].forEach(entry=>{
      if(!entry?.wordId)return;
      const existing=mistakes.get(entry.wordId);
      if(!existing)mistakes.set(entry.wordId,{...entry});
      else mistakes.set(entry.wordId,{...existing,...entry,wrongCount:Math.max(Number(existing.wrongCount||0),Number(entry.wrongCount||0)),lastWrongAt:String(entry.lastWrongAt||"").localeCompare(String(existing.lastWrongAt||""))>0?entry.lastWrongAt:existing.lastWrongAt});
    });
    merged.mistakes = [...mistakes.values()];
    merged.meta.updatedAt = newer(local.meta,cloud.meta)?.updatedAt || newer(local.meta,cloud.meta)?.updated_at || local.meta.updatedAt || cloud.meta.updatedAt || now();
    return normalize(merged);
  }
  function backup(reason,local,incoming){
    try{
      localStorage.setItem(BACKUP_KEY,JSON.stringify({at:now(),reason,local:clone(local),incoming:clone(incoming)}));
    }catch(e){}
  }
  function replace(next){
    const safe = normalize(next);
    Object.keys(db).forEach(key => delete db[key]);
    Object.assign(db,safe);
    shareDb();
    persist();
    return db;
  }
  function safeHydrate(incoming,reason="cloud-hydration"){
    const local = normalize(db);
    const cloud = normalize(incoming);
    const localHas = hasUserData(local);
    const cloudHas = hasUserData(cloud);
    if(localHas && !cloudHas){
      backup(reason + ":kept-local",local,cloud);
      persist();
      return {action:"kept-local",data:local};
    }
    const next = localHas && cloudHas ? merge(local,cloud) : cloud;
    if(JSON.stringify(next) !== JSON.stringify(local))backup(reason,local,cloud);
    replace(next);
    return {action:localHas && cloudHas ? "merged" : "applied-cloud",data:db};
  }
  return {normalize,hasUserData,merge,safeHydrate,backup};
})();
function tnSafeApplyCloudData(incoming,reason){
  return window.tnDataSafety?.safeHydrate(incoming,reason)?.data || incoming;
}
function langName(c){return (LANGS.find(l=>l[0]===c)||[c,c])[1]}
function placeholderFor(c){return (LANGS.find(l=>l[0]===c)||["","", "word"])[2]}
function optionsHTML(selected){return LANGS.map(l=>`<option value="${l[0]}" ${l[0]===selected?"selected":""}>${l[1]}</option>`).join("")}
function fillLangSelects(){db.prefs=db.prefs||{};db.prefs.frontLang=db.prefs.frontLang||"en-US";db.prefs.backLang=db.prefs.backLang||"ja-JP";["frontLang","bulkFrontLang","editFrontLang"].forEach(id=>{if($(id))$(id).innerHTML=optionsHTML(db.prefs.frontLang)});["backLang","bulkBackLang","editBackLang"].forEach(id=>{if($(id))$(id).innerHTML=optionsHTML(db.prefs.backLang)});updatePlaceholders();attachLangMemory()}
function attachLangMemory(){["frontLang","backLang","bulkFrontLang","bulkBackLang"].forEach(id=>{let el=$(id);if(el&&!el.dataset.attached){el.addEventListener("change",()=>{if(id.includes("Front"))db.prefs.frontLang=el.value;else if(id.includes("Back"))db.prefs.backLang=el.value;else if(id==="frontLang")db.prefs.frontLang=el.value;else if(id==="backLang")db.prefs.backLang=el.value;persist();updatePlaceholders()});el.dataset.attached=1}})}
function updatePlaceholders(){if($("front"))$("front").placeholder=placeholderFor($("frontLang").value);if($("back"))$("back").placeholder=placeholderFor($("backLang").value)}
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
function renderSelect(id,all=false){let el=$(id);if(!el)return;let v=el.value;el.innerHTML="";if(all){let o=document.createElement("option");o.value="all";o.textContent="All";el.appendChild(o)}db.lists.forEach(l=>{let o=document.createElement("option");o.value=l.id;o.textContent=l.name;el.appendChild(o)});if([...el.options].some(o=>o.value===v))el.value=v;else if(all)el.value="all"}
function go(p){["home","add","words","study","quiz","audio","manage"].forEach(x=>{let page=$("page"+cap(x)),nav=$("nav"+cap(x)),mnav=$("mnav"+cap(x));if(page)page.classList.toggle("active",x===p);if(nav)nav.classList.toggle("active",x===p);if(mnav)mnav.classList.toggle("active",x===p)});if(p==="quiz")resetQuiz();render()}

function listWords(listId){
  return db.words.filter(w=>w.listId===listId);
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
  const selectors=["quizList","cardList","audioList","listFilter","bulkList","addList"];
  for(const id of selectors){
    const el=$(id);
    if(el&&el.value)return el.value;
  }
  return db.lists[0]?.id||"starter";
}
function updateBrandContext(){
  db.words=Array.isArray(db.words)?db.words:[];
  db.lists=Array.isArray(db.lists)&&db.lists.length?db.lists:[{id:"starter",name:"New Playlist"}];
  const total=db.words.length;
  const learned=db.words.filter(w=>w.status==="learned").length;
  const listId=activeListId();
  const list=db.lists.find(l=>l.id===listId)||db.lists[0]||{id:"starter",name:"New Playlist"};
  const words=listWords(list.id);
  const meta=playlistLangMeta(list.id);
  if($("heroWords"))$("heroWords").textContent=total;
  if($("heroLists"))$("heroLists").textContent=db.lists.length;
  if($("heroLearned"))$("heroLearned").textContent=learned;
  if($("heroPlaylistName"))$("heroPlaylistName").textContent=list.name;
  if($("heroPlaylistMeta"))$("heroPlaylistMeta").textContent=`${meta} · ${words.length} words`;
  if($("contextPlaylistName"))$("contextPlaylistName").textContent=list.name;
  if($("contextPlaylistMeta"))$("contextPlaylistMeta").textContent=`${meta} · ${words.length} words`;
  if($("heroPhoneDeck"))$("heroPhoneDeck").textContent=list.name;
  if($("heroPhoneMeta"))$("heroPhoneMeta").textContent=`${meta} · ${words.length} words`;
}
function goStudy(listId,mode){
  ["quizList","cardList","audioList","listFilter"].forEach(id=>{const el=$(id);if(el)el.value=listId;});
  if(mode==="quiz")showPage("quiz");
  else if(mode==="audio")showPage("audio");
  else if(mode==="cards")showPage("cards");
  else showPage("list");
  updateBrandContext();
}

function render(){fillLangSelects();["addList","bulkList","studyList","quizList","audioList","renameListSelect","editList"].forEach(id=>renderSelect(id,false));renderSelect("wordListSelect",true);renderHome();if(typeof window.tnLibraryRender==="function")window.tnLibraryRender();else renderWords();renderMistakeNotebook();if(typeof renderManage==="function")renderManage();updateStudyStar();try{updateQuizModeSettings()}catch(e){}}
function renderHome(){
  const set=(id,value)=>{const el=$(id);if(el)el.textContent=value};
  const learned=db.words.filter(w=>w.status==="learned").length;
  const hard=db.words.filter(w=>w.status==="hard").length;
  set("totalWords",db.words.length);
  set("totalLists",db.lists.length);
  set("totalLearned",learned);
  set("totalHard",hard);
  set("dashTotal",db.words.length);
  set("dashLearned",Math.round((learned/Math.max(1,db.words.length))*100)+"%");
  set("dashDue",dueWords().length);
  set("dashHard",hard);
  const homeLists=$("homeLists");
  if(!homeLists)return;
  homeLists.innerHTML=db.lists.map(l=>{
    const ws=listWords(l.id);
    const meta=playlistLangMeta(l.id);
    const learned=ws.filter(w=>w.status==="learned").length;
    const hard=ws.filter(w=>w.status==="hard").length;
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
        <button class="btn small primary" onclick="goStudy('${l.id}','quiz')">Quiz</button>
        <button class="btn small" onclick="goStudy('${l.id}','cards')">Cards</button>
        <button class="btn small" onclick="goStudy('${l.id}','audio')">Listen</button>
      </div>
    </div>`
  }).join("")||'<div class="empty">No playlists yet</div>';
  updateBrandContext();
}

/* =========================================================
   Beta53 Bulk Add Parser Fix
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
      let front="",back="",pos="",gender="",memo="";

      if(parts.length>=5){
        front=parts[0];
        back=parts[1];
        pos=parts[2];
        gender=parts[3];
        memo=parts.slice(4).join(" ");
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
        memo = memo ? `${memo} | ${exampleFromPipe}` : exampleFromPipe;
      }

      return {
        row,
        front:cleanBulkValue(front),
        back:cleanBulkValue(back),
        pos:cleanBulkValue(pos),
        gender:cleanBulkValue(gender),
        memo:cleanBulkValue(memo)
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
function clearBulkPreview(){
  let b=$("bulkPreview");if(b){b.style.display="none";b.innerHTML=""}
  let d=$("bulkDuplicatePanel");if(d){d.classList.remove("show");d.innerHTML=""}
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
  let rows=bulkRows(),box=$("bulkPreview");
  box.style.display="block";
  if(!rows.length){box.innerHTML='<div class="empty">No readable words</div>';return}
  renderDuplicatePanel(rows);
  box.innerHTML=`<p class="desc">Rows: ${rows.length} / Exact duplicates: ${rows.filter(r=>r.duplicate).length} / Same-front words: ${rows.filter(r=>r.frontDuplicate).length}</p><div class="tablewrap"><table><thead><tr><th>Row</th><th>Front</th><th>Back</th><th>POS</th><th>Gender</th><th>Example</th><th>Status</th></tr></thead><tbody>`+rows.map(r=>`<tr><td>${r.row}</td><td><b>${esc(r.front)}</b></td><td>${esc(r.back)}</td><td>${esc(r.pos)}</td><td>${esc(r.gender)}</td><td>${esc(r.memo)}</td><td>${r.duplicate?'<span class="badge red">Exact Duplicate</span>':r.frontDuplicate?'<span class="badge yellow">Same Front</span>':'<span class="badge green">New</span>'}</td></tr>`).join("")+"</tbody></table></div>"
}
function bulkImport(mode){
  let rows=bulkRows();
  if(!rows.length)return toast("No readable words");
  const hasFrontDup=rows.some(r=>r.frontDuplicate);
  if(hasFrontDup&&!mode){previewBulk();return toast("Duplicate words need confirmation");}
  let listId=$("bulkList").value,frontLang=$("bulkFrontLang").value,backLang=$("bulkBackLang").value;
  if(mode==="replace"){
    rows.forEach(r=>{
      const ex=softDuplicateMatch(r,listId);
      if(ex){
        db.words=db.words.map(w=>w.id===ex.id?{...w,front:r.front,back:r.back,frontLang,backLang,listId,memo:r.memo,pos:r.pos,gender:r.gender}:w);
      }else{
        db.words.push({id:uid(),front:r.front,back:r.back,frontLang,backLang,listId,memo:r.memo,pos:r.pos,gender:r.gender,tags:"",saved:false,status:"new",seen:0,level:1,nextReview:addDays(1),createdAt:new Date().toISOString()});
      }
    });
    $("bulkText").value="";clearBulkPreview();save();return toast(`${rows.length} processed`);
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
  db.words=[...db.words,...rows.map(r=>({id:uid(),front:r.front,back:r.back,frontLang,backLang,listId,memo:r.memo,pos:r.pos,gender:r.gender,tags:"",saved:false,status:"new",seen:0,level:1,nextReview:addDays(1),createdAt:new Date().toISOString()}))];
  $("bulkText").value="";clearBulkPreview();save();toast(`${rows.length} added`);
}
function posBadge(pos){return pos?`<span class="badge ${["noun","verb","adjective","adverb","phrase"].includes(pos)?pos:""}">${esc(pos)}</span>`:""}
function genderBadge(g){if(!g)return"";let letter=g==="masculine"?"M":g==="feminine"?"F":g==="neutral"?"N":g==="plural"?"PL":g[0].toUpperCase();let cls=g==="masculine"?"m":g==="feminine"?"f":"n";return`<span class="badge ${cls}">${letter}</span>`}
function sortedWords(words){let mode=$("sortMode")?$("sortMode").value:"added",arr=[...words];if(mode==="frontAZ")arr.sort((a,b)=>String(a.front).localeCompare(String(b.front),undefined,{sensitivity:"base"}));if(mode==="backAZ")arr.sort((a,b)=>String(a.back).localeCompare(String(b.back),undefined,{sensitivity:"base"}));return arr}
function moveWord(id,dir){let w=db.words.find(x=>x.id===id);if(!w)return;let same=db.words.filter(x=>x.listId===w.listId),pos=same.findIndex(x=>x.id===id),target=same[pos+dir];if(!target)return toast("Cannot move further");let i1=db.words.findIndex(x=>x.id===id),i2=db.words.findIndex(x=>x.id===target.id);[db.words[i1],db.words[i2]]=[db.words[i2],db.words[i1]];save()}
function filteredWordsForList(){let list=$("wordListSelect").value||"all",filter=$("statusFilter").value||"all",q=($("wordSearch").value||"").toLowerCase();let words=list==="all"?[...db.words]:db.words.filter(w=>w.listId===list);if(filter==="star")words=words.filter(w=>w.saved);else if(filter==="due")words=words.filter(isDue);else if(filter!=="all")words=words.filter(w=>(w.status||"new")===filter);if(q)words=words.filter(w=>(w.front+" "+w.back+" "+(w.memo||"")+" "+(w.tags||"")+" "+(w.pos||"")+" "+(w.gender||"")).toLowerCase().includes(q));return sortedWords(words)}
function renderWords(){let box=$("wordsBox");if(!box)return;let words=filteredWordsForList(),view=$("tableView").value||"both";if(!words.length){box.innerHTML='<div class="empty">No words</div>';return}let h=view==="both"?"<th>Front</th><th>Back</th>":view==="front"?"<th>Front only</th>":"<th>Back only</th>";let table='<div class="tablewrap desktop-word-table"><table><thead><tr><th></th>'+h+'<th>Info</th><th>Status</th><th>Review</th><th>Actions</th></tr></thead><tbody>'+words.map(w=>{let main=view==="both"?`<td><b onclick="openDetail('${w.id}')">${esc(w.front)}</b></td><td>${esc(w.back)}</td>`:view==="front"?`<td><b onclick="openDetail('${w.id}')">${esc(w.front)}</b></td>`:`<td><b onclick="openDetail('${w.id}')">${esc(w.back)}</b></td>`;let st=w.status==="learned"?"<span class='badge green'>learned</span>":w.status==="hard"?"<span class='badge red'>hard</span>":"<span class='badge'>new</span>";return`<tr><td><input type="checkbox" ${selectedIds.has(w.id)?"checked":""} onchange="toggleSelected('${w.id}',this.checked)"></td>${main}<td>${langName(w.frontLang)} → ${langName(w.backLang)}<br>${posBadge(w.pos)} ${genderBadge(w.gender)} ${w.tags?`<span class="badge">${esc(w.tags)}</span>`:""}</td><td>${w.saved?"<span class='badge yellow'>★</span> ":""}${st} <span class='badge'>Lv.${w.level||1}</span></td><td>${w.nextReview||"-"} ${isDue(w)?"<span class='badge red'>Due</span>":""}</td><td><button class="icon" onclick="moveWord('${w.id}',-1)">↑</button> <button class="icon" onclick="moveWord('${w.id}',1)">↓</button> <button class="icon ${w.saved?'saved':''}" onclick="toggleStar('${w.id}')">${w.saved?'★':'☆'}</button> <button class="icon" onclick="speakListWord('${w.id}')">▶</button> <button class="icon edit" onclick="openEdit('${w.id}')">✎</button> <button class="icon" onclick="removeWord('${w.id}')">🗑</button></td></tr>`}).join("")+"</tbody></table></div>";
let cards='<div class="mobile-word-cards">'+words.map(w=>{let st=w.status==="learned"?"<span class='badge green'>learned</span>":w.status==="hard"?"<span class='badge red'>hard</span>":"<span class='badge'>new</span>";return`<div class="mobile-word-card"><div class="mobile-word-main"><button class="mobile-play" onclick="speakListWord('${w.id}')">▶</button><div onclick="openDetail('${w.id}')"><div class="mobile-front">${esc(w.front)}</div><div class="mobile-back">${esc(w.back)}</div></div></div><div class="mobile-meta">${posBadge(w.pos)} ${genderBadge(w.gender)} ${st} ${w.saved?"<span class='badge yellow'>★</span>":""}<span class="badge">${langName(w.frontLang)}→${langName(w.backLang)}</span></div><div class="mobile-actions"><button onclick="moveWord('${w.id}',-1)">↑</button><button onclick="moveWord('${w.id}',1)">↓</button><button onclick="toggleStar('${w.id}')">${w.saved?'★':'☆'}</button><button class="edit" onclick="openEdit('${w.id}')">Edit</button><button class="del" onclick="removeWord('${w.id}')">Delete</button></div></div>`}).join("")+"</div>";box.innerHTML=table+cards}
function toggleSelected(id,c){c?selectedIds.add(id):selectedIds.delete(id)}
function toggleSelectAll(){let words=filteredWordsForList(),all=words.every(w=>selectedIds.has(w.id));words.forEach(w=>all?selectedIds.delete(w.id):selectedIds.add(w.id));renderWords()}
function deleteSelected(){if(!selectedIds.size)return toast("Select words first");if(!confirm(`${selectedIds.size} words will be deleted.`))return;db.words=db.words.filter(w=>!selectedIds.has(w.id));db.mistakes=ensureMistakes().filter(entry=>!selectedIds.has(entry.wordId));selectedIds.clear();save()}
function removeWord(id){if(!confirm("Delete this word?"))return;db.words=db.words.filter(w=>w.id!==id);db.mistakes=ensureMistakes().filter(entry=>entry.wordId!==id);selectedIds.delete(id);save()}
function toggleStar(id){db.words=db.words.map(w=>w.id===id?{...w,saved:!w.saved}:w);if(current&&current.id===id)current=db.words.find(w=>w.id===id);save()}
function speakListWord(id){let w=db.words.find(x=>x.id===id),side=$("listSpeakSide").value;if(!w)return;if(side==="front")speak(w.front,w.frontLang);else if(side==="back")speak(w.back,w.backLang);else speakPair(w,"frontBack")}
function openDetail(id){let w=db.words.find(x=>x.id===id);if(!w)return;$("detailContent").innerHTML=`<div class="dict-title">${esc(w.front)}</div><div class="dict-meaning">${esc(w.back)}</div><div>${posBadge(w.pos)} ${genderBadge(w.gender)} ${w.tags?`<span class="badge">${esc(w.tags)}</span>`:""}</div><div class="actions"><button class="btn blue" onclick="speak('${escAttr(w.front)}','${w.frontLang}')">▶ Front</button><button class="btn blue" onclick="speak('${escAttr(w.back)}','${w.backLang}')">▶ Back</button><button class="btn" onclick="openEdit('${w.id}')">Edit</button></div><div class="dict-grid"><div class="dict-box"><b>Languages</b>${langName(w.frontLang)} → ${langName(w.backLang)}</div><div class="dict-box"><b>Status</b>${w.status||"new"} / Lv.${w.level||1}</div><div class="dict-box"><b>Next Review</b>${w.nextReview||"-"}</div><div class="dict-box"><b>Memo / Example</b>${esc(w.memo||"-")}</div></div>`;$("detailModal").classList.add("show")}
function closeDetail(){$("detailModal").classList.remove("show")}
function openEdit(id){let w=db.words.find(x=>x.id===id);if(!w)return;$("editId").value=w.id;$("editFront").value=w.front;$("editBack").value=w.back;$("editFrontLang").innerHTML=optionsHTML(w.frontLang);$("editBackLang").innerHTML=optionsHTML(w.backLang);$("editList").value=w.listId;$("editPOS").value=w.pos||"";$("editGender").value=w.gender||"";$("editTags").value=w.tags||"";$("editStatus").value=w.status||"new";$("editLevel").value=w.level||1;$("editMemo").value=w.memo||"";$("editModal").classList.add("show")}
function closeEdit(){$("editModal").classList.remove("show")}
function saveEdit(){let id=$("editId").value;db.words=db.words.map(w=>w.id===id?{...w,front:$("editFront").value.trim(),back:$("editBack").value.trim(),frontLang:$("editFrontLang").value,backLang:$("editBackLang").value,listId:$("editList").value,pos:$("editPOS").value,gender:$("editGender").value,tags:$("editTags").value.trim(),status:$("editStatus").value,level:parseInt($("editLevel").value),memo:$("editMemo").value.trim()}:w);const edited=db.words.find(w=>w.id===id);const mistake=ensureMistakes().find(entry=>entry.wordId===id);if(edited&&mistake){Object.assign(mistake,{front:edited.front,back:edited.back,playlistId:edited.listId,language:edited.frontLang,backLanguage:edited.backLang,pronunciation:wordPronunciation(edited)})}closeEdit();save()}
function studyWords(){let list=$("studyList").value,mode=$("studyMode").value;let words=db.words.filter(w=>w.listId===list);if(mode==="hard")words=words.filter(w=>w.status==="hard");if(mode==="due")words=words.filter(isDue);if(mode==="star")words=words.filter(w=>w.saved);return words}
function resetCard(){clearFlashTimers();current=null;flipped=false;$("flash").classList.remove("is-flipped");$("frontWord").textContent="---";$("backWord").textContent="---";$("frontMemo").textContent="";$("backMemo").textContent="";updateStudyStar()}
function weighted(words){let pool=[];words.forEach(w=>{let n=w.status==="hard"?4:isDue(w)?3:w.status==="new"?2:1;for(let i=0;i<n;i++)pool.push(w)});return pool[Math.floor(Math.random()*pool.length)]}
function nextCard(){clearFlashTimers();let words=studyWords();if(!words.length){resetCard();return toast("No words")}current=weighted(words);flipped=false;$("flash").classList.remove("is-flipped");current.seen=(current.seen||0)+1;drawCard();persist();updateStudyStar()}
function drawCard(){if(!current)return;let mode=$("studyMode").value;if(mode==="back"){$("frontWord").textContent=current.back;$("backWord").textContent=current.front;$("backMemo").textContent=current.memo||""}else{$("frontWord").textContent=current.front;$("backWord").textContent=current.back;$("backMemo").textContent=current.memo||""}$("frontMemo").textContent=[current.pos,current.gender].filter(Boolean).join(" / ")}
function flipCard(){if(!current)return;flipped=!flipped;$("flash").classList.toggle("is-flipped",flipped)}
function speakCard(){if(!current)return;let mode=$("studyMode").value,text,lang;if(mode==="back"){text=flipped?current.front:current.back;lang=flipped?current.frontLang:current.backLang}else{text=flipped?current.back:current.front;lang=flipped?current.backLang:current.frontLang}speak(text,lang)}
function markCard(status){if(!current)return;if(status==="hard")recordMistake(current,"flashcard","Hard");else markMistakeCorrect(current.id);updateWordLearning(current.id,status);current=db.words.find(w=>w.id===current.id);save();toast(status)}
function toggleCardStar(){if(current)toggleStar(current.id)}
function updateStudyStar(){let b=$("studyStar");if(b)b.textContent=current&&current.saved?"★ Saved":"☆ Save"}
function clearFlashTimers(){flashTimers.forEach(t=>clearTimeout(t));flashTimers=[]}
function startFlashAuto(){$("flashAutoMode").value="on";playFlashAutoCycle()}
function stopFlashAuto(){clearFlashTimers();$("flashAutoMode").value="off"}
function playFlashAutoCycle(){clearFlashTimers();if($("flashAutoMode").value!=="on")return;nextCard();if(!current)return stopFlashAuto();let mode=$("studyMode").value,frontText=mode==="back"?current.back:current.front,frontLang=mode==="back"?current.backLang:current.frontLang,backText=mode==="back"?current.front:current.back,backLang=mode==="back"?current.frontLang:current.backLang;speak(frontText,frontLang);let flipDelay=parseInt($("flashFlipDelay").value),nextDelay=parseInt($("flashNextDelay").value);flashTimers.push(setTimeout(()=>{if($("flashAutoMode").value!=="on")return;if(!flipped)flipCard();speak(backText,backLang)},flipDelay));flashTimers.push(setTimeout(()=>playFlashAutoCycle(),flipDelay+nextDelay))}
function updateWordLearning(id,status){db.words=db.words.map(w=>{if(w.id!==id)return w;const oldLevel=Math.min(5,Math.max(1,Number(w.level||3)));const ok=status==="learned";const level=ok?Math.min(5,oldLevel+1):Math.max(1,oldLevel-1);const next=addDays(({1:1,2:2,3:4,4:8,5:16}[level])||4);return{...w,status:ok?(level>=5?"learned":"new"):"hard",level,nextReview:next,lastReviewed:today(),correctCount:Number(w.correctCount||0)+(ok?1:0),wrongCount:Number(w.wrongCount||0)+(ok?0:1),reviewCount:Number(w.reviewCount||0)+1,lastAnsweredAt:new Date().toISOString(),lastWrongAt:ok?w.lastWrongAt:new Date().toISOString()}});persist()}
function quizLearningWeight(w){const level=Math.min(5,Math.max(1,Number(w.level||3)));let weight=({1:5,2:4,3:2.5,4:1,5:.3}[level])||2.5;if(w.lastWrongAt)weight+=2;if(w.status==="hard")weight+=1.5;if(w.nextReview&&w.nextReview<=today())weight+=1;return weight}
function quizAdaptiveOrder(words){return [...words].sort((a,b)=>((Math.random()/Math.max(.1,quizLearningWeight(a)))-(Math.random()/Math.max(.1,quizLearningWeight(b)))))}
function quizPool(){let list=$("quizList").value,scope=$("quizScope").value;let words=db.words.filter(w=>w.listId===list);if(scope==="mistakes"){const ids=new Set(ensureMistakes().map(entry=>entry.wordId));words=db.words.filter(w=>ids.has(w.id))}else{if(scope==="hard")words=words.filter(w=>(Number(w.level||3)<=2)||w.status==="hard"||w.lastWrongAt);if(scope==="due")words=words.filter(isDue);if(scope==="star")words=words.filter(w=>w.saved)}return quizAdaptiveOrder(words)}
function shuffle(arr){let a=[...arr];for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
const QUIZ_FEEDBACK_SPEED_KEY="tangonest_quiz_feedback_speed_v1";
function ensureQuizFeedbackDefault(){
  const el=$("quizAutoAdvance");
  if(!el)return;
  if(!el.__tnFeedbackSpeedBound){
    el.addEventListener("change",()=>{try{localStorage.setItem(QUIZ_FEEDBACK_SPEED_KEY,el.value)}catch(e){}});
    el.__tnFeedbackSpeedBound=true;
  }
  let saved="";
  try{saved=localStorage.getItem(QUIZ_FEEDBACK_SPEED_KEY)||""}catch(e){}
  const values=[...el.options].map(option=>option.value);
  el.value=values.includes(saved)?saved:"1.5";
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
  if(type==="typing"&&$("quizAutoAdvance")){
    $("quizAutoAdvance").value="manual";
  }
  if(type==="listening"){
    if($("quizAutoAdvance"))$("quizAutoAdvance").value="manual";
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
function resetQuiz(){clearQuizTimers();ensureQuizFeedbackDefault();quiz={queue:[],wrong:[],allWrong:[],index:0,score:0,current:null,answered:false,type:"choice",direction:"front",total:0,previousQuestionId:"",previousQuestionKey:"",selectedAnswer:null,listeningReplayUsed:0};if($("quizType"))$("quizType").value="choice";updateQuizModeSettings();placeTypingArea(false);$("quizSetup").style.display="block";$("quizRun").style.display="none";$("quizEnd").style.display="none";if($("listeningPanel"))$("listeningPanel").style.display="none";resetQuizAnswerVisualState()}
function startQuiz(){clearQuizTimers();ensureQuizFeedbackDefault();updateQuizModeSettings();let words=quizPool();let requested=parseInt($("quizCount").value,10)||10;if(requested<1)requested=1;if(!words.length)return toast("No words");let actual=Math.min(requested,words.length);if(actual<requested)toast(`Only ${actual} words available`);quiz={queue:quizAdaptiveOrder(words).slice(0,actual),wrong:[],allWrong:[],index:0,score:0,current:null,answered:false,type:$("quizType").value||"choice",direction:$("quizDirection").value,total:actual,previousQuestionId:"",previousQuestionKey:"",selectedAnswer:null,listeningReplayUsed:0};$("quizSetup").style.display="none";$("quizRun").style.display="block";$("quizEnd").style.display="none";showQuizQuestion()}
function resetQuizAnswerVisualState(){quiz.selectedAnswer=null;document.querySelectorAll(".choice").forEach(b=>{b.disabled=false;b.classList.remove("selected","active","correct","incorrect","wrong","is-selected","is-active","is-correct","is-wrong");try{b.blur()}catch(e){}});const result=$("quizResult");if(result){result.className="result-box";result.textContent=""}const answer=$("quizQuestionAnswer");if(answer){answer.className="quiz-question-answer";answer.textContent=""}const card=document.querySelector(".quiz-question");if(card){card.classList.remove("is-answered","has-long-answer","is-listening")}}
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
  addFrom((db.words||[]));
  pool.sort(()=>Math.random()-.5);
  pool.splice(3);
  let choices=shuffle([correct,...pool]);
  $("choiceArea").innerHTML=choices.map(c=>`<button type="button" class="choice" onclick="chooseAnswer(this,'${escAttr(c)}')">${esc(c)}</button>`).join("");
}
function chooseAnswer(btn,ans){if(quiz.answered)return;quiz.selectedAnswer=ans;let ok=normalize(ans)===normalize(correctAnswer());[...document.querySelectorAll(".choice")].forEach(b=>{b.disabled=true;b.classList.remove("selected","active","correct","incorrect","wrong","is-selected","is-active","is-correct","is-wrong");try{b.blur()}catch(e){};if(normalize(b.textContent)===normalize(correctAnswer()))b.classList.add("correct")});btn.classList.add("selected");if(!ok)btn.classList.add("wrong");finishAnswer(ok)}
function quizFeedbackHtml(ok,level){const answer=correctAnswer();const selected=quiz.selectedAnswer||($("quizAnswer")?.value||"").trim()||"No answer";const levelText=level?`<span class="quiz-level-note">${ok?`Level increased to ${level}`:"This word will appear more often."}</span>`:"";return `<div class="quiz-feedback-copy"><strong>${ok?"Correct":"Incorrect"}</strong><span>Your answer: ${esc(selected)}</span>${ok?"":`<span>Correct answer: ${esc(answer)}</span>`}${levelText}</div><button type="button" class="quiz-next-btn" onclick="nextQuizQuestion()">Next</button>`}
function renderQuizQuestionAnswer(ok,level){const box=$("quizQuestionAnswer");if(!box||!quiz.current)return;const answer=correctAnswer();const selected=quiz.selectedAnswer||"";const levelText=level?`<div class="quiz-answer-block quiz-answer-meta"><span>Learning</span><strong>${ok?`Level increased to ${level}`:"This word will appear more often."}</strong></div>`:"";const card=document.querySelector(".quiz-question");if(card){const long=[answer,selected].some(v=>String(v||"").length>32||String(v||"").includes("\n"));card.classList.add("is-answered");card.classList.toggle("has-long-answer",long)}box.className=`quiz-question-answer show ${ok?"ok":"no"}`;if(quiz.type==="listening"){const pronunciation=wordPronunciation(quiz.current);box.innerHTML=`<div class="quiz-answer-status ${ok?"ok":"no"}">${ok?"Correct":"Incorrect"}</div><div class="quiz-answer-block"><span>Correct answer</span><strong>${esc(answer)}</strong></div>${pronunciation?`<div class="quiz-answer-block quiz-answer-meta"><span>Pronunciation</span><strong>${esc(pronunciation)}</strong></div>`:""}${!ok&&selected?`<div class="quiz-answer-block"><span>Your answer</span><em>${esc(selected)}</em></div>`:""}${levelText}<div class="quiz-answer-actions"><button type="button" class="quiz-answer-audio" onclick="speakQuizFront()">Replay front audio</button></div>`;return}box.innerHTML=`<div class="quiz-answer-status ${ok?"ok":"no"}">${ok?"Correct":"Incorrect"}</div><div class="quiz-answer-block"><span>Correct answer</span><strong>${esc(answer)}</strong></div>${!ok&&selected?`<div class="quiz-answer-block"><span>Your answer</span><em>${esc(selected)}</em></div>`:""}${levelText}<div class="quiz-answer-actions"><button type="button" class="quiz-answer-audio" onclick="speakQuizFront()">Play front</button><button type="button" class="quiz-answer-audio" onclick="speakQuizBack()">Play back</button></div>`}
function finishAnswer(ok){if(quiz.answered)return;quiz.answered=true;quiz.previousQuestionId=quiz.current?.id||quiz.previousQuestionId;quiz.previousQuestionKey=quizQuestionKey(quiz.current)||quiz.previousQuestionKey;clearInterval(quizTimerInterval);const selected=quiz.selectedAnswer||$("quizAnswer")?.value||"";let fresh=null;if(ok){quiz.score++;markMistakeCorrect(quiz.current.id);updateWordLearning(quiz.current.id,"learned");fresh=db.words.find(w=>w.id===quiz.current.id);$("quizResult").className="result-box show ok";$("quizResult").innerHTML=quizFeedbackHtml(true,fresh?.level)}else{recordMistake(quiz.current,quiz.type||"quiz",selected,correctAnswer());updateWordLearning(quiz.current.id,"hard");fresh=db.words.find(w=>w.id===quiz.current.id);$("quizResult").className="result-box show no";$("quizResult").innerHTML=quizFeedbackHtml(false,fresh?.level);quiz.wrong.push(quiz.current);if(!quiz.allWrong.some(w=>w.id===quiz.current.id))quiz.allWrong.push(quiz.current)}renderQuizQuestionAnswer(ok,fresh?.level);$("quizScore").textContent=quiz.score+" / "+quiz.total;if($("quizAudioAfter").value==="on")setTimeout(()=>{try{speakQuizFront()}catch(e){}},80);if(isAutoAdvance())scheduleNext(ok)}
function isAutoAdvance(){const mode=$("quizAutoAdvance")?.value||"1.5";return mode!=="manual"&&mode!=="off"}
function nextDelay(ok){const mode=$("quizAutoAdvance")?.value||"1.5";let v=mode==="manual"||mode==="off"?parseFloat($("quizNextDelay")?.value||"1.5"):parseFloat(mode);if(!Number.isFinite(v))v=parseFloat($("quizNextDelay")?.value||"1.5");v=Math.max(1,Math.min(10,v));return Math.round(v*1000)}
function scheduleNext(ok){clearTimeout(quizAutoTimer);quizAutoTimer=setTimeout(()=>advanceQuiz(),nextDelay(ok))}
function advanceQuiz(){clearQuizTimers();if(!quiz.current)return;if(!quiz.answered){finishAnswer(false);return}quiz.index++;if(quiz.index>=quiz.queue.length)return endQuiz();showQuizQuestion()}
function nextQuizQuestion(){if(!quiz.current)return;if(!quiz.answered){finishAnswer(false);return}advanceQuiz()}
function speakQuizQuestion(){if(!quiz.current)return;if(quiz.type==="listening")return playListeningAudio(true);let text=quiz.direction==="front"?quiz.current.front:quiz.current.back,lang=quiz.direction==="front"?quiz.current.frontLang:quiz.current.backLang;speak(text,lang)}
function speakCorrectAnswer(){if(!quiz.current)return;speak(correctAnswer(),correctAnswerLang())}
function speakQuizFront(){if(!quiz.current)return;speak(quiz.current.front,quiz.current.frontLang)}
function speakQuizBack(){if(!quiz.current)return;speak(quiz.current.back,quiz.current.backLang)}
function clearQuizTimers(){clearTimeout(quizAutoTimer);clearTimeout(quizListeningAudioTimer);clearInterval(quizTimerInterval);quizAutoTimer=null;quizListeningAudioTimer=null;quizTimerInterval=null}
function startQuestionTimer(){let wrap=$("quizTimerWrap"),fill=$("quizTimerFill"),text=$("quizTimerText"),label=$("quizTimerLabel");if(!wrap||!fill||!text)return;let limit=0;if(quiz.type==="listening")limit=listeningTimerLimit();else if($("quizHardMode").value==="on")limit=Math.max(2,parseInt($("quizTimeLimit").value||"8",10));if(!limit){wrap.classList.remove("show");if(label)label.textContent="Time limit: Off";text.textContent="";fill.style.width="0%";fill.classList.remove("danger");if(quiz.type==="listening")updateListeningTimerInline("");return}quizQuestionStartedAt=Date.now();wrap.classList.toggle("show",quiz.type!=="listening");if(label)label.textContent=quiz.type==="listening"?"Listening timer":"Time limit";fill.style.width="100%";fill.classList.remove("danger");text.textContent=limit+"s";if(quiz.type==="listening")updateListeningTimerInline(limit+"s");quizTimerInterval=setInterval(()=>{if(quiz.answered){clearInterval(quizTimerInterval);return}let remain=Math.max(0,limit-(Date.now()-quizQuestionStartedAt)/1000),pct=remain/limit*100;fill.style.width=pct+"%";if(pct<30)fill.classList.add("danger");const shown=Math.ceil(remain)+"s";text.textContent=shown;if(quiz.type==="listening")updateListeningTimerInline(shown);if(remain<=0){clearInterval(quizTimerInterval);finishAnswer(false)}},200)}
function endQuiz(){clearQuizTimers();$("quizRun").style.display="none";$("quizEnd").style.display="block";$("quizEndText").textContent=`Score: ${quiz.score} / ${quiz.total}`;renderWrongList();render()}
function renderWrongList(){let box=$("quizWrongList"),wrong=quiz.allWrong||[];if(!wrong.length){box.innerHTML='<div class="empty">No wrong answers. Great job!</div>';return}box.innerHTML='<h2 style="margin-top:8px">Wrong Answers</h2>'+wrong.map(item=>{let w=db.words.find(x=>x.id===item.id)||item,q=quiz.direction==="front"?w.front:w.back,a=quiz.direction==="front"?w.back:w.front,lang=quiz.direction==="front"?w.frontLang:w.backLang;return`<div class="quiz-wrong-card"><div onclick="openDetail('${w.id}')"><div class="quiz-wrong-front">${esc(q)}</div><div class="quiz-wrong-back">Answer: ${esc(a)}</div></div><div class="quiz-wrong-actions"><button onclick="speak('${escAttr(q)}','${lang}')">▶</button><button class="${w.saved?'starred':''}" onclick="toggleQuizWrongStar('${w.id}')">${w.saved?'★ Saved':'☆ Save'}</button><button onclick="openDetail('${w.id}')">Detail</button></div></div>`}).join("")}
function toggleQuizWrongStar(id){toggleStar(id);renderWrongList()}
function restartWrongQuiz(){let wrong=quiz.allWrong||[];if(!wrong.length)return resetQuiz();quiz={...quiz,queue:shuffle(wrong),wrong:[],index:0,score:0,current:null,answered:false,total:wrong.length};$("quizEnd").style.display="none";$("quizRun").style.display="block";showQuizQuestion()}
function audioWords(){let list=$("audioList").value,order=$("audioOrder").value;let words=db.words.filter(w=>w.listId===list);if(order==="star")words=words.filter(w=>w.saved);if(order==="due")words=words.filter(isDue);if(order==="hard")words=[...words].sort((a,b)=>(b.status==="hard")-(a.status==="hard"));if(order==="random")words=shuffle(words);return words}
function startAudio(){stopAudio();audioQueue=audioWords();if(!audioQueue.length)return toast("No words");audioIndex=0;audioPaused=false;playAudioCurrent()}
function pauseAudio(){audioPaused=true;clearTimeout(audioTimer);speechSynthesis.cancel();toast("Paused")}
function stopAudio(){clearTimeout(audioTimer);speechSynthesis.cancel();audioPaused=false;audioIndex=0;$("audioNow").textContent="---";$("audioSub").textContent="Start"}
function playAudioOnce(){let words=audioWords();if(!words.length)return toast("No words");let w=words[Math.floor(Math.random()*words.length)];updateNow(w);speakByPattern(w)}
function playAudioCurrent(){if(audioPaused)return;if(audioIndex>=audioQueue.length){audioIndex=0;if($("audioOrder").value==="random")audioQueue=shuffle(audioQueue)}let w=audioQueue[audioIndex++];updateNow(w);speakByPattern(w);audioTimer=setTimeout(playAudioCurrent,Math.max(.5,parseFloat($("audioIntervalCustom").value||"5"))*1000)}
function updateNow(w){$("audioNow").textContent=w.front;$("audioSub").textContent=`${w.front} → ${w.back}`}
function speakByPattern(w){speakPair(w,$("audioPattern").value)}
function speakPair(w,p){
  let gap=Math.max(.1,parseFloat($("pairGapCustom")?.value||"1.8"))*1000;
  if(p==="front")speak(w.front,w.frontLang);
  if(p==="back")speak(w.back,w.backLang);
  if(p==="frontBack")speakQueued([{text:w.front,lang:w.frontLang},{text:w.back,lang:w.backLang}],gap);
  if(p==="backFront")speakQueued([{text:w.back,lang:w.backLang},{text:w.front,lang:w.frontLang}],gap);
}

function downloadBackupFile(){
  const data={app:"TangoNest",version:"backup-v1",exportedAt:new Date().toISOString(),data:db};
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

function exportDataText(){let data={app:"TangoNest",version:"stable-reset-v32",exportedAt:new Date().toISOString(),data:db},text=JSON.stringify(data),box=$("syncDataBox");box.value=text;box.focus();box.select();if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(text).then(()=>toast("Copied export data")).catch(()=>toast("Export data is ready"));else toast("Export data is ready. Copy the text.")}
function importDataText(){let text=($("syncDataBox").value||"").trim();if(!text)return toast("Paste export data first");let parsed;try{parsed=JSON.parse(text)}catch(e){return alert("Import failed: invalid data")}let incoming=parsed.data&&parsed.data.words?parsed.data:parsed;if(!incoming.words||!incoming.lists)return alert("Import failed: this is not TangoNest data");if(!confirm(`Import ${incoming.words.length} words? Current data will be replaced.`))return;db={ui:incoming.ui||"en",prefs:incoming.prefs||{frontLang:"en-US",backLang:"ja-JP"},lists:incoming.lists.length?incoming.lists:[{id:"starter",name:"New Playlist"}],words:incoming.words,mistakes:Array.isArray(incoming.mistakes)?incoming.mistakes:[],meta:incoming.meta||{}};save();toast("Imported")}
function clearAll(){if(!confirm(`Delete all vocabulary data in this browser? (${db.words.length} words)`))return;let final=prompt("Type DELETE to confirm.");if(final!=="DELETE")return toast("Cancelled");db={ui:"en",prefs:{frontLang:"en-US",backLang:"ja-JP"},lists:[{id:"starter",name:"New Playlist"}],words:[],mistakes:[],meta:{intentionalClearAt:new Date().toISOString()}};shareDb();tnClearLastGoodData();localStorage.setItem(KEY,JSON.stringify(db));resetCard();resetQuiz();render();toast("All data deleted")}

let VOICES_READY=false;
let VOICE_CACHE=[];
const BEST_VOICE_CACHE=new Map();
let voiceLoadStarted=false;
const VOICE_PREF_KEY="tangonest_voice_preferences_v1";
const VOICE_LANGUAGE_SETTINGS=[
  {lang:"en-US",label:"English",sample:"Hello, this is English."},
  {lang:"ja-JP",label:"Japanese",sample:"こんにちは。日本語です。"},
  {lang:"zh-CN",label:"Chinese",sample:"你好，这是中文。"},
  {lang:"ko-KR",label:"Korean",sample:"안녕하세요. 한국어입니다."},
  {lang:"fr-FR",label:"French",sample:"Bonjour, ceci est le français."},
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
    const finish=()=>{
      if(done)return;
      done=true;
      voices=refreshVoices();
      resolve(voices);
    };
    window.speechSynthesis.onvoiceschanged=finish;
    setTimeout(finish,timeout);
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
    return `<div class="tn-voice-row"><div class="tn-voice-meta"><strong>${esc(item.label)}</strong><span>${current?esc(current.name)+" / "+esc(current.lang):"Auto voice unavailable"}</span>${warning}</div><div class="tn-voice-controls"><select onchange="tnSetVoicePreference('${target}',this.value)">${options}</select><button type="button" onclick="tnTestVoice('${target}')">Test</button></div></div>`;
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

if(window.speechSynthesis){
  refreshVoices();
  window.speechSynthesis.onvoiceschanged=()=>{refreshVoices();renderVoiceSettings()};
  setTimeout(refreshVoices,300);
  setTimeout(refreshVoices,1000);
  setTimeout(renderVoiceSettings,1200);
}

function attachBrandContextListeners(){
  ["quizList","cardList","audioList","listFilter","bulkList","addList"].forEach(id=>{
    const el=$(id);
    if(el&&!el.dataset.contextAttached){
      el.dataset.contextAttached="1";
      el.addEventListener("change",updateBrandContext);
    }
  });
}

attachBrandContextListeners();
render();resetQuiz();

const TN_SESSION_KEY="tangonest_last_session_v1";
function getLastSession(){
  try{return JSON.parse(localStorage.getItem(TN_SESSION_KEY)||"{}")}catch(e){return{}}
}
function setLastSession(patch){
  const current=getLastSession();
  const next={...current,...patch,updatedAt:new Date().toISOString()};
  localStorage.setItem(TN_SESSION_KEY,JSON.stringify(next));
  updateResumeCard();
}
function selectedValue(id){
  const el=$(id);
  return el?el.value:"";
}
function applyLastSessionToControls(){
  const s=getLastSession();
  if(s.listId){
    ["quizList","cardList","audioList","listFilter","bulkList","addList"].forEach(id=>{
      const el=$(id);
      if(el&&[...el.options].some(o=>o.value===s.listId))el.value=s.listId;
    });
  }
  if(s.quizCount&&$("quizCount"))$("quizCount").value=s.quizCount;
  if(s.quizMode&&$("quizMode"))$("quizMode").value=s.quizMode;
  if(s.quizDirection&&$("quizDirection"))$("quizDirection").value=s.quizDirection;
  if(s.quizOrder&&$("quizOrder"))$("quizOrder").value=s.quizOrder;
  if(s.audioMode&&$("audioMode"))$("audioMode").value=s.audioMode;
  if(s.cardDirection&&$("cardDirection"))$("cardDirection").value=s.cardDirection;
}
function rememberCurrentSession(mode){
  const listId=selectedValue(mode==="cards"?"cardList":mode==="audio"?"audioList":mode==="quiz"?"quizList":"listFilter")||activeListId?.();
  const patch={mode:mode||"home",listId};
  if($("quizCount"))patch.quizCount=$("quizCount").value;
  if($("quizMode"))patch.quizMode=$("quizMode").value;
  if($("quizDirection"))patch.quizDirection=$("quizDirection").value;
  if($("quizOrder"))patch.quizOrder=$("quizOrder").value;
  if($("audioMode"))patch.audioMode=$("audioMode").value;
  if($("cardDirection"))patch.cardDirection=$("cardDirection").value;
  setLastSession(patch);
}
function resumeLastSession(){
  const s=getLastSession();
  applyLastSessionToControls();
  const mode=s.mode||"quiz";
  if(mode==="audio")appShow("audio");
  else if(mode==="cards")appShow("cards");
  else if(mode==="list")appShow("list");
  else appShow("quiz");
}
function updateResumeCard(){
  const s=getLastSession();
  const list=db?.lists?.find(l=>l.id===s.listId)||db?.lists?.[0];
  const modeLabel=(s.mode||"quiz").replace(/^./,c=>c.toUpperCase());
  const count=s.quizCount?` · ${s.quizCount} questions`:"";
  const lang=list?playlistLangMeta(list.id):"Choose a playlist";
  if($("resumeMeta"))$("resumeMeta").textContent=list?`${list.name} · ${lang} · ${modeLabel}${count}`:"Your last playlist and study mode will stay ready.";
  if($("resumeMainBtn"))$("resumeMainBtn").textContent=list?`Resume ${modeLabel}`:"Start Quiz";
}
function attachSessionMemory(){
  const map={quizList:"quiz",cardList:"cards",audioList:"audio",listFilter:"list",quizCount:"quiz",quizMode:"quiz",quizDirection:"quiz",quizOrder:"quiz",audioMode:"audio",cardDirection:"cards"};
  Object.entries(map).forEach(([id,mode])=>{
    const el=$(id);
    if(el&&!el.dataset.sessionMemory){
      el.dataset.sessionMemory="1";
      el.addEventListener("change",()=>rememberCurrentSession(mode));
    }
  });
}
function rotateHeroLanguages(){
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
  let i=0;
  const apply=()=>{
    const s=sets[i%sets.length];
    [one,two,three].forEach(el=>el.classList.add("changing"));
    setTimeout(()=>{
      one.innerHTML=`<span>Front</span><b>${esc(s.front)}</b><small>${esc(s.frontLang)}</small>`;
      two.innerHTML=`<span>Back</span><b>${esc(s.back)}</b><small>${esc(s.backLang)}</small>`;
      three.innerHTML=`<span>Mode</span><b>${esc(s.mode)}</b><small>Ready</small>`;
      [one,two,three].forEach(el=>el.classList.remove("changing"));
    },220);
    i++;
  };
  apply();
  if(!window.__tnHeroLanguageTimer)window.__tnHeroLanguageTimer=setInterval(apply,3600);
}


function enhanceTangoNestApp(){
  applyLastSessionToControls();
  attachSessionMemory();
  updateResumeCard();
  rotateHeroLanguages();
  if(typeof updateBrandContext==="function")updateBrandContext();
}
setTimeout(enhanceTangoNestApp,120);
setTimeout(enhanceTangoNestApp,800);


setTimeout(()=>{
  if(typeof go==="function"&&!go.__wrappedForSession){
    const originalGo=go;
    window.go=function(page){
      originalGo(page);
      const modeMap={quiz:"quiz",audio:"audio",cards:"cards",list:"list",add:"add",home:"home"};
      rememberCurrentSession(modeMap[page]||page);
      updateResumeCard();
      rotateHeroLanguages();
    };
    window.go.__wrappedForSession=true;
  }
  if(typeof showPage==="function"&&!showPage.__wrappedForSession){
    const originalShow=showPage;
    window.showPage=function(page){
      originalShow(page);
      const modeMap={quiz:"quiz",audio:"audio",cards:"cards",list:"list",add:"add",home:"home"};
      rememberCurrentSession(modeMap[page]||page);
      updateResumeCard();
      rotateHeroLanguages();
    };
    window.showPage.__wrappedForSession=true;
  }
},200);



/* =========================================================
   TangoNest Beta46 Login & Supabase Sync
   Public publishable key is okay to ship in browser.
   Data access is protected by Supabase RLS policies.
========================================================= */

var TANGONEST_SUPABASE_URL = window.TANGONEST_SUPABASE_URL;
var TANGONEST_SUPABASE_KEY = window.TANGONEST_SUPABASE_KEY;
var tnSupabase = null;
var tnUser = null;
var tnSyncReady = false;
var tnLastCloudSave = 0;

function initTangoNestSupabase(){
  if(!window.supabase){
    console.warn("Supabase library not loaded yet.");
    return;
  }
  if(!tnSupabase){
    tnSupabase = window.supabase.createClient(TANGONEST_SUPABASE_URL, TANGONEST_SUPABASE_KEY);
  }
}

function safeToast(msg){
  if(typeof toast==="function")toast(msg);
  else console.log(msg);
}

function getUserEmail(){
  return $("authEmail")?.value?.trim() || "";
}

function getUserPassword(){
  return $("authPassword")?.value || "";
}

function setAuthMessage(status, sub){
  if($("authStatus"))$("authStatus").textContent=status;
  if($("authSub"))$("authSub").textContent=sub;
}

function updateAuthUI(){
  const form=$("authForm");
  const actions=$("authActions");
  if(tnUser){
    hideLoginGate();
    setAuthMessage("Logged in", tnUser.email || "TangoNest account");
    if(form)form.style.display="none";
    if(actions)actions.style.display="flex";
  }else{
    setAuthMessage("Guest mode", "Login to sync your words across PC and phone.");
    if(form)form.style.display="flex";
    if(actions)actions.style.display="none";
  }
}

async function refreshTangoNestSession(){
  initTangoNestSupabase();
  if(!tnSupabase)return;
  const {data,error} = await tnSupabase.auth.getUser();
  if(error || !data?.user){
    tnUser=null;
  }else{
    tnUser=data.user;
  }
  updateAuthUI();
}

function cloudPayload(){
  return {
    version:"tangonest-cloud-v1",
    savedAt:new Date().toISOString(),
    data:db
  };
}

async function ensureCloudRow(){
  if(!tnSupabase||!tnUser)throw new Error("Not logged in");
  const payload=cloudPayload();
  const {data,error} = await tnSupabase
    .from("tangonest_data")
    .select("id")
    .eq("user_id", tnUser.id)
    .maybeSingle();

  if(error)throw error;
  if(data?.id){
    const {error:updateError} = await tnSupabase
      .from("tangonest_data")
      .update({data:payload, updated_at:new Date().toISOString()})
      .eq("id", data.id)
      .eq("user_id", tnUser.id);
    if(updateError)throw updateError;
  }else{
    const {error:insertError} = await tnSupabase
      .from("tangonest_data")
      .insert({user_id:tnUser.id, data:payload});
    if(insertError)throw insertError;
  }
}

async function saveProfile(){
  if(!tnSupabase||!tnUser)return;
  await tnSupabase.from("tangonest_profiles").upsert({
    id:tnUser.id,
    email:tnUser.email || ""
  });
}

async function signUpTangoNest(){
  initTangoNestSupabase();
  const email=getUserEmail();
  const password=getUserPassword();
  if(!email||!password)return safeToast("Email and password are required");
  if(password.length<6)return safeToast("Password must be at least 6 characters");
  const {data,error} = await tnSupabase.auth.signUp({email,password});
  if(error)return safeToast(error.message);
  tnUser=data.user || null;
  await refreshTangoNestSession();
  await saveProfile();
  if(tnUser){
    await syncNowToCloud();
    safeToast("Account created and synced");
  }else{
    safeToast("Check your email to confirm signup");
  }
}

async function loginTangoNest(){
  initTangoNestSupabase();
  const email=getUserEmail();
  const password=getUserPassword();
  if(!email||!password)return safeToast("Email and password are required");
  const {data,error} = await tnSupabase.auth.signInWithPassword({email,password});
  if(error)return safeToast(error.message);
  tnUser=data.user;
  await saveProfile();
  updateAuthUI();
  safeToast("Logged in");
}

async function logoutTangoNest(){
  initTangoNestSupabase();
  if(tnSupabase)await tnSupabase.auth.signOut();
  tnUser=null;
  updateAuthUI();
  localStorage.removeItem("tangonest_guest_mode");
  showLoginGate();
  safeToast("Logged out");
}

async function syncNowToCloud(){
  initTangoNestSupabase();
  await refreshTangoNestSession();
  if(!tnUser)return safeToast("Login first");
  try{
    await saveProfile();
    await ensureCloudRow();
    tnLastCloudSave=Date.now();
    safeToast("Saved to cloud");
  }catch(e){
    console.error(e);
    safeToast("Cloud save failed: "+(e.message||e));
  }
}

async function loadFromCloud(){
  initTangoNestSupabase();
  await refreshTangoNestSession();
  if(!tnUser)return safeToast("Login first");
  try{
    const {data,error} = await tnSupabase
      .from("tangonest_data")
      .select("data, updated_at")
      .eq("user_id", tnUser.id)
      .order("updated_at", {ascending:false})
      .limit(1)
      .maybeSingle();
    if(error)throw error;
    if(!data?.data?.data)return safeToast("No cloud data yet");
    const cloudDb=data.data.data;
    if(!cloudDb.words||!cloudDb.lists)return safeToast("Cloud data format error");
    tnSafeApplyCloudData(cloudDb,"manual-load-from-cloud");
    if(typeof save==="function")save();
    if(typeof render==="function")render();
    if(typeof updateBrandContext==="function")updateBrandContext();
    safeToast("Loaded from cloud");
  }catch(e){
    console.error(e);
    safeToast("Cloud load failed: "+(e.message||e));
  }
}

async function autoCloudSaveIfNeeded(){
  if(!tnUser)return;
  const now=Date.now();
  if(now-tnLastCloudSave<5000)return;
  try{
    await ensureCloudRow();
    tnLastCloudSave=now;
  }catch(e){
    console.warn("Auto cloud save failed",e);
  }
}

function wrapLocalSaveForCloud(){
  if(typeof save!=="function"||save.__cloudWrapped)return;
  const originalSave=save;
  window.save=function(){
    originalSave();
    autoCloudSaveIfNeeded();
  };
  window.save.__cloudWrapped=true;
}

function initLoginSyncEdition(){
  initTangoNestSupabase();
  wrapLocalSaveForCloud();
  refreshTangoNestSession();
  if(tnSupabase){
    tnSupabase.auth.onAuthStateChange((_event,session)=>{
      tnUser=session?.user || null;
      updateAuthUI();
    });
  }
}

setTimeout(initLoginSyncEdition,300);
setTimeout(initLoginSyncEdition,1200);


/* =========================================================
   Beta48 Login Gate
========================================================= */
function showLoginGate(){
  const gate=document.getElementById("loginGate");
  if(gate)gate.classList.remove("hidden");
}
function hideLoginGate(){
  const gate=document.getElementById("loginGate");
  if(gate)gate.classList.add("hidden");
}
function copyGateCredentials(){
  const ge=document.getElementById("gateEmail");
  const gp=document.getElementById("gatePassword");
  const ae=document.getElementById("authEmail");
  const ap=document.getElementById("authPassword");
  if(ae&&ge)ae.value=ge.value;
  if(ap&&gp)ap.value=gp.value;
}
async function gateLogin(){
  copyGateCredentials();
  if(typeof loginTangoNest==="function"){
    await loginTangoNest();
    if(window.tnUser || tnUser)hideLoginGate();
  }
}
async function gateSignUp(){
  copyGateCredentials();
  if(typeof signUpTangoNest==="function"){
    await signUpTangoNest();
    if(window.tnUser || tnUser)hideLoginGate();
  }
}
function continueAsGuest(){
  localStorage.setItem("tangonest_guest_mode","1");
  hideLoginGate();
}
function checkLoginGateState(){
  const guest=localStorage.getItem("tangonest_guest_mode")==="1";
  if(typeof tnUser!=="undefined" && tnUser){hideLoginGate();return;}
  if(guest){hideLoginGate();return;}
  showLoginGate();
}
setTimeout(checkLoginGateState,500);
setTimeout(checkLoginGateState,1600);


/* =========================================================
   Beta49 Login Feedback
========================================================= */
function setGateMessage(message,type="info"){
  const box=document.getElementById("gateMessage");
  if(!box)return;
  box.textContent=message;
  box.className="gate-message "+type;
}
function gateCredentials(){
  const email=document.getElementById("gateEmail")?.value?.trim()||"";
  const password=document.getElementById("gatePassword")?.value||"";
  return {email,password};
}
async function gateLogin(){
  const {email,password}=gateCredentials();
  if(!email||!password){
    setGateMessage("Email and password are required.","error");
    return;
  }
  setGateMessage("Logging in...","info");
  try{
    ensureTangoNestSupabaseReady();
    const {data,error}=await tnSupabase.auth.signInWithPassword({email,password});
    if(error){
      setGateMessage(error.message,"error");
      return;
    }
    tnUser=data.user;
    updateAuthUI();
    hideLoginGate();
    setGateMessage("Logged in.","success");
    safeToast("Logged in");
  }catch(e){
    setGateMessage(e.message||String(e),"error");
  }
}
async function gateSignUp(){
  const {email,password}=gateCredentials();
  if(!email||!password){
    setGateMessage("Email and password are required.","error");
    return;
  }
  if(password.length<6){
    setGateMessage("Password must be at least 6 characters.","error");
    return;
  }
  setGateMessage("Creating account...","info");
  try{
    ensureTangoNestSupabaseReady();
    const {data,error}=await tnSupabase.auth.signUp({email,password});
    if(error){
      setGateMessage(error.message,"error");
      return;
    }
    tnUser=data.user||null;
    if(tnUser){
      await saveProfile();
      await syncNowToCloud();
      updateAuthUI();
      hideLoginGate();
      safeToast("Account created");
    }else{
      setGateMessage("Account created. Check your email to confirm, then login.","success");
    }
  }catch(e){
    setGateMessage(e.message||String(e),"error");
  }
}


/* =========================================================
   Beta50 Supabase Init Safety Patch
========================================================= */
function ensureTangoNestSupabaseReady(){
  if(typeof window.supabase==="undefined"){
    throw new Error("Supabase library is still loading. Please wait a moment and try again.");
  }
  if(typeof tnSupabase==="undefined" || !tnSupabase){
    tnSupabase = window.supabase.createClient(TANGONEST_SUPABASE_URL, TANGONEST_SUPABASE_KEY);
  }
  return tnSupabase;
}

if(typeof initTangoNestSupabase==="function"){
  initTangoNestSupabase = function(){
    try{
      ensureTangoNestSupabaseReady();
    }catch(e){
      console.warn(e.message);
    }
  };
}


/* =========================================================
   Beta51 Supabase URL Hard Fix
========================================================= */
function getTangoNestSupabaseConfig(){
  return {
    url: "https://bkbteylavujkfiwuqwdq.supabase.co",
    key: "sb_publishable_UKX5qCXkbIRac4cc62_LXw_yEGDG6BZ"
  };
}

function ensureTangoNestSupabaseReady(){
  if(typeof window.supabase==="undefined"){
    throw new Error("Supabase library is still loading. Please wait a moment and try again.");
  }
  const cfg=getTangoNestSupabaseConfig();
  if(!cfg.url)throw new Error("Supabase URL is missing.");
  if(!cfg.key)throw new Error("Supabase publishable key is missing.");
  if(typeof tnSupabase==="undefined" || !tnSupabase){
    tnSupabase = window.supabase.createClient(cfg.url, cfg.key);
  }
  return tnSupabase;
}

function initTangoNestSupabase(){
  try{
    ensureTangoNestSupabaseReady();
  }catch(e){
    console.warn(e.message);
  }
}


/* =========================================================
   Beta52 Mobile Login Polish & Email Confirmation
========================================================= */
function isEmailNotConfirmedError(message){
  return String(message||"").toLowerCase().includes("email not confirmed");
}
function showResendButton(show=true){
  const btn=document.getElementById("resendEmailBtn");
  if(btn)btn.style.display=show?"block":"none";
}
async function resendConfirmEmail(){
  const email=document.getElementById("gateEmail")?.value?.trim() || document.getElementById("authEmail")?.value?.trim() || "";
  if(!email){
    setGateMessage("Enter your email first, then resend the confirmation email.","error");
    return;
  }
  try{
    ensureTangoNestSupabaseReady();
    setGateMessage("Sending confirmation email...","info");
    const {error}=await tnSupabase.auth.resend({type:"signup",email});
    if(error){
      setGateMessage(error.message,"error");
      return;
    }
    setGateMessage("Confirmation email sent. Open your email, confirm your account, then login again.","success");
    showResendButton(false);
  }catch(e){
    setGateMessage(e.message||String(e),"error");
  }
}

// Override gateLogin with better email-confirmation message.
async function gateLogin(){
  const email=document.getElementById("gateEmail")?.value?.trim()||"";
  const password=document.getElementById("gatePassword")?.value||"";
  showResendButton(false);
  if(!email||!password){
    setGateMessage("Email and password are required.","error");
    return;
  }
  setGateMessage("Logging in...","info");
  try{
    ensureTangoNestSupabaseReady();
    const {data,error}=await tnSupabase.auth.signInWithPassword({email,password});
    if(error){
      if(isEmailNotConfirmedError(error.message)){
        setGateMessage("Email not confirmed. Check your inbox, or resend the confirmation email below.","error");
        showResendButton(true);
      }else{
        setGateMessage(error.message,"error");
      }
      return;
    }
    tnUser=data.user;
    updateAuthUI();
    hideLoginGate();
    setGateMessage("Logged in.","success");
    safeToast("Logged in");
  }catch(e){
    setGateMessage(e.message||String(e),"error");
  }
}

// Override gateSignUp with clearer confirmation flow.
async function gateSignUp(){
  const email=document.getElementById("gateEmail")?.value?.trim()||"";
  const password=document.getElementById("gatePassword")?.value||"";
  showResendButton(false);
  if(!email||!password){
    setGateMessage("Email and password are required.","error");
    return;
  }
  if(password.length<6){
    setGateMessage("Password must be at least 6 characters.","error");
    return;
  }
  setGateMessage("Creating account...","info");
  try{
    ensureTangoNestSupabaseReady();
    const {data,error}=await tnSupabase.auth.signUp({email,password});
    if(error){
      setGateMessage(error.message,"error");
      return;
    }
    tnUser=data.user||null;

    // If Supabase requires email confirmation, session may be missing.
    if(data.session){
      await saveProfile();
      await syncNowToCloud();
      updateAuthUI();
      hideLoginGate();
      safeToast("Account created");
    }else{
      setGateMessage("Account created. Check your email, confirm your account, then login.","success");
      showResendButton(true);
    }
  }catch(e){
    setGateMessage(e.message||String(e),"error");
  }
}


/* =========================================================
   Beta53 Bulk Import Safe Override
========================================================= */
function bulkImport(mode){
  try{
    let rows=bulkRows();
    let box=$("bulkPreview");
    if(!rows.length){
      if(box){box.style.display="block";box.innerHTML='<div class="empty">No readable words. Use: Front / Back / POS / Gender / Example</div>'}
      return toast("No readable words");
    }

    const hasFrontDup=rows.some(r=>r.frontDuplicate);
    if(hasFrontDup&&!mode){
      previewBulk();
      return toast("Duplicate words need confirmation");
    }

    let listId=$("bulkList").value;
    let frontLang=$("bulkFrontLang").value;
    let backLang=$("bulkBackLang").value;

    if(mode==="replace"){
      rows.forEach(r=>{
        const ex=softDuplicateMatch(r,listId);
        if(ex){
          db.words=db.words.map(w=>w.id===ex.id?{...w,front:r.front,back:r.back,frontLang,backLang,listId,memo:r.memo,pos:r.pos,gender:r.gender}:w);
        }else{
          db.words.push({id:uid(),front:r.front,back:r.back,frontLang,backLang,listId,memo:r.memo,pos:r.pos,gender:r.gender,tags:"",saved:false,status:"new",seen:0,level:1,nextReview:addDays(1),createdAt:new Date().toISOString()});
        }
      });
      $("bulkText").value="";
      clearBulkPreview();
      save();
      toast(`${rows.length} processed`);
      return;
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

    const newWords=rows.map(r=>({
      id:uid(),
      front:r.front,
      back:r.back,
      frontLang,
      backLang,
      listId,
      memo:r.memo,
      pos:r.pos,
      gender:r.gender,
      tags:"",
      saved:false,
      status:"new",
      seen:0,
      level:1,
      nextReview:addDays(1),
      createdAt:new Date().toISOString()
    }));

    db.words=[...db.words,...newWords];
    $("bulkText").value="";
    clearBulkPreview();
    save();
    toast(`${newWords.length} added`);
  }catch(e){
    console.error(e);
    let box=$("bulkPreview");
    if(box){
      box.style.display="block";
      box.innerHTML=`<div class="empty">Bulk Add error: ${esc(e.message||e)}</div>`;
    }
    toast("Bulk Add error");
  }
}


/* =========================================================
   Beta53 Bulk Button Event Binding
========================================================= */
function attachBulkButtonFix(){
  const addPage=document.getElementById("pageAdd");
  if(!addPage)return;
  const buttons=[...addPage.querySelectorAll("button")];
  buttons.forEach(btn=>{
    const txt=(btn.textContent||"").trim().toLowerCase();
    if(txt==="preview"&&!btn.dataset.bulkFixed){
      btn.dataset.bulkFixed="1";
      btn.addEventListener("click",e=>{e.preventDefault();previewBulk();});
    }
    if(txt==="bulk register"&&!btn.dataset.bulkFixed){
      btn.dataset.bulkFixed="1";
      btn.addEventListener("click",e=>{e.preventDefault();bulkImport();});
    }
  });
}
setTimeout(attachBulkButtonFix,300);
setTimeout(attachBulkButtonFix,1200);


/* =========================================================
   Beta54 English-Japanese Defaults
========================================================= */
function setSelectIfExists(id,value){
  const el=$(id);
  if(!el)return;
  if([...el.options].some(o=>o.value===value))el.value=value;
}
function applyEnglishJapaneseDefaults(force=false){
  const pairs=[
    ["frontLang","en-US"],["backLang","ja-JP"],
    ["bulkFrontLang","en-US"],["bulkBackLang","ja-JP"]
  ];
  pairs.forEach(([id,val])=>{
    const el=$(id);
    if(!el)return;
    if(force || !el.dataset.userChanged){
      setSelectIfExists(id,val);
    }
    if(!el.dataset.defaultWatch){
      el.dataset.defaultWatch="1";
      el.addEventListener("change",()=>{el.dataset.userChanged="1"});
    }
  });
  const memo=$("memo");
  if(memo && !memo.value && memo.placeholder) memo.placeholder="Example sentence or memo.";
  const newList=$("newListName");
  if(newList && newList.placeholder) newList.placeholder="English A1";
  const bulk=$("bulkText");
  if(bulk && !bulk.value && bulk.placeholder){
    bulk.placeholder="front word\tback meaning\tPOS\tgender\texample sentence";
  }
}
setTimeout(()=>applyEnglishJapaneseDefaults(true),400);
setTimeout(()=>applyEnglishJapaneseDefaults(false),1200);

setTimeout(()=>{
  if(typeof render==="function" && !render.__beta54Wrapped){
    const originalRender=render;
    window.render=function(){
      originalRender();
      applyEnglishJapaneseDefaults(false);
    };
    window.render.__beta54Wrapped=true;
  }
},500);


/* =========================================================
   Beta54 Quiz Order
========================================================= */
function orderQuizWords(words){
  const order=$("quizOrder")?.value || "random";
  let arr=[...words];
  if(order==="added"){
    arr.sort((a,b)=>new Date(a.createdAt||0)-new Date(b.createdAt||0));
  }else if(order==="az"){
    const dir=$("quizDirection")?.value || "front";
    const key=dir==="back"?"back":"front";
    arr.sort((a,b)=>String(a[key]||"").localeCompare(String(b[key]||""),undefined,{sensitivity:"base"}));
  }else{
    arr.sort(()=>Math.random()-.5);
  }
  return arr;
}

// Wrap startQuiz to apply selected order after original list is prepared.
setTimeout(()=>{
  if(typeof startQuiz==="function"&&!startQuiz.__beta54OrderWrapped){
    const originalStartQuiz=startQuiz;
    window.startQuiz=function(){
      originalStartQuiz();
      try{
        if(typeof quiz!=="undefined" && Array.isArray(quiz.queue)){
          quiz.queue=orderQuizWords(quiz.queue);
          quiz.index=0;
          if(typeof renderQuiz==="function")renderQuiz();
          else if(typeof showQuizQuestion==="function")showQuizQuestion();
        }else if(typeof quizState!=="undefined" && Array.isArray(quizState.queue)){
          quizState.queue=orderQuizWords(quizState.queue);
          quizState.index=0;
          if(typeof renderQuiz==="function")renderQuiz();
        }
      }catch(e){
        console.warn("Quiz order fallback",e);
      }
      if(typeof rememberCurrentSession==="function")rememberCurrentSession("quiz");
    };
    window.startQuiz.__beta54OrderWrapped=true;
  }
},600);



/* =========================================================
   Beta55 Stable Bulk Add Override
   This override avoids old missing DOM references and handles all output inside #bulkPreview.
========================================================= */

function tnEsc(v){
  if(typeof esc==="function")return esc(v);
  return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
}

function tnBulkPreviewBox(){
  let box=document.getElementById("bulkPreview");
  if(!box){
    const text=document.getElementById("bulkText");
    if(text){
      box=document.createElement("div");
      box.id="bulkPreview";
      box.className="bulk-preview";
      const parent=text.closest(".card")||text.parentElement;
      parent.appendChild(box);
    }
  }
  return box;
}

function tnGet(id){
  return document.getElementById(id);
}

function tnToast(msg){
  if(typeof toast==="function")toast(msg);
  else console.log(msg);
}

function tnUid(){
  if(typeof uid==="function")return uid();
  return "w_"+Date.now()+"_"+Math.random().toString(16).slice(2);
}

function tnAddDays(n){
  if(typeof addDays==="function")return addDays(n);
  const d=new Date();
  d.setDate(d.getDate()+n);
  return d.toISOString();
}

function cleanBulkValue(v){
  return String(v ?? "").trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g,"").trim();
}

function splitBulkLine(line){
  const raw=String(line||"").trim();
  if(!raw)return [];
  if(raw.includes("\t"))return raw.split("\t").map(cleanBulkValue);
  if(raw.includes(","))return raw.split(",").map(cleanBulkValue);
  const multi=raw.split(/\s{2,}/).map(cleanBulkValue).filter(Boolean);
  if(multi.length>=2)return multi;
  return raw.split(/\s+/).map(cleanBulkValue).filter(Boolean);
}

function parseBulk(text){
  return String(text||"")
    .split(/\r?\n/)
    .map((line,i)=>({line:String(line||"").trim(),row:i+1}))
    .filter(x=>x.line)
    .map(({line,row})=>{
      let example="";
      let before=line;
      if(line.includes("|")){
        const pieces=line.split("|");
        before=pieces.shift().trim();
        example=pieces.join("|").trim();
      }

      const parts=splitBulkLine(before);
      let front="",back="",pos="",gender="",memo="";

      if(parts.length>=5){
        front=parts[0]; back=parts[1]; pos=parts[2]; gender=parts[3]; memo=parts.slice(4).join(" ");
      }else if(parts.length===4){
        front=parts[0]; back=parts[1]; pos=parts[2]; gender=parts[3];
      }else if(parts.length===3){
        front=parts[0]; back=parts[1]; pos=parts[2];
      }else if(parts.length===2){
        front=parts[0]; back=parts[1];
      }else{
        front=parts[0]||"";
      }

      if(example)memo=memo?`${memo} | ${example}`:example;

      return {
        row,
        front:cleanBulkValue(front),
        back:cleanBulkValue(back),
        pos:cleanBulkValue(pos),
        gender:cleanBulkValue(gender),
        memo:cleanBulkValue(memo)
      };
    })
    .filter(r=>r.front&&r.back);
}

function duplicateMatch(row,listId){
  const key=(x)=>String(x||"").trim().toLowerCase();
  return (db.words||[]).find(w=>
    w.listId===listId &&
    key(w.front)===key(row.front) &&
    key(w.back)===key(row.back) &&
    key(w.pos)===key(row.pos)
  );
}

function softDuplicateMatch(row,listId){
  const key=(x)=>String(x||"").trim().toLowerCase();
  return (db.words||[]).find(w=>
    w.listId===listId &&
    key(w.front)===key(row.front)
  );
}

function bulkRows(){
  const text=tnGet("bulkText")?.value||"";
  const listId=tnGet("bulkList")?.value || (db.lists?.[0]?.id || "starter");
  const rows=parseBulk(text);
  const seenFront=new Set();
  const seenExact=new Set();

  return rows.map(r=>{
    const frontKey=String(r.front||"").trim().toLowerCase();
    const exactKey=[r.front,r.back,r.pos].map(x=>String(x||"").trim().toLowerCase()).join("||");
    const existingExact=duplicateMatch(r,listId);
    const existingFront=softDuplicateMatch(r,listId);
    const pastedFront=seenFront.has(frontKey);
    const pastedExact=seenExact.has(exactKey);
    seenFront.add(frontKey);
    seenExact.add(exactKey);
    return {
      ...r,
      duplicate:!!existingExact || pastedExact,
      frontDuplicate:!!existingFront || pastedFront,
      duplicateReason: existingExact ? "Already exists" : pastedExact ? "Duplicate in pasted text" : existingFront ? "Same front already exists" : pastedFront ? "Same front in pasted text" : ""
    };
  });
}

function previewBulk(){
  const box=tnBulkPreviewBox();
  if(!box)return;
  const rows=bulkRows();
  box.style.display="block";
  if(!rows.length){
    box.innerHTML='<div class="bulk-empty">No readable rows. Use: Front / Back / POS / Gender / Example</div>';
    return;
  }

  const frontDupCount=rows.filter(r=>r.frontDuplicate).length;
  const exactDupCount=rows.filter(r=>r.duplicate).length;
  const warning=frontDupCount?`
    <div class="bulk-warning">
      <b>${frontDupCount} possible duplicate${frontDupCount>1?"s":""}</b>
      <span>Choose how to import them below.</span>
    </div>`:"";

  const actions=frontDupCount?`
    <div class="bulk-review-actions">
      <button class="btn primary small" onclick="bulkImport('addBoth')">Import all</button>
      <button class="btn small" onclick="bulkImport('skip')">Skip duplicates</button>
      <button class="btn small" onclick="bulkImport('replace')">Replace same front</button>
    </div>`:"";

  box.innerHTML=`
    ${warning}
    <div class="bulk-summary">
      <span>${rows.length} readable rows</span>
      <span>${frontDupCount} possible duplicates</span>
      <span>${exactDupCount} exact duplicates</span>
    </div>
    <div class="bulk-table-wrap">
      <table class="bulk-table">
        <thead>
          <tr><th>#</th><th>Front</th><th>Back</th><th>POS</th><th>Gender</th><th>Memo / Example</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${rows.map(r=>`
            <tr class="${r.frontDuplicate?'dup-row':''}">
              <td>${r.row}</td>
              <td><b>${tnEsc(r.front)}</b></td>
              <td>${tnEsc(r.back)}</td>
              <td>${tnEsc(r.pos||"—")}</td>
              <td>${tnEsc(r.gender||"—")}</td>
              <td>${tnEsc(r.memo||"")}</td>
              <td>${r.frontDuplicate?`<span class="badge yellow">${tnEsc(r.duplicateReason||"Possible duplicate")}</span>`:`<span class="badge green">Ready</span>`}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>
    ${actions}
  `;
}

function clearBulkPreview(){
  const box=tnBulkPreviewBox();
  if(box){
    box.style.display="none";
    box.innerHTML="";
  }
}

function bulkImport(mode){
  const box=tnBulkPreviewBox();
  try{
    let rows=bulkRows();
    const listId=tnGet("bulkList")?.value || (db.lists?.[0]?.id || "starter");
    const frontLang=tnGet("bulkFrontLang")?.value || "en-US";
    const backLang=tnGet("bulkBackLang")?.value || "ja-JP";

    if(!rows.length){
      if(box){box.style.display="block";box.innerHTML='<div class="bulk-empty">No readable rows. Use: Front / Back / POS / Gender / Example</div>';}
      tnToast("No readable words");
      return;
    }

    const hasFrontDup=rows.some(r=>r.frontDuplicate);
    if(hasFrontDup&&!mode){
      previewBulk();
      tnToast("Duplicate check needs your choice");
      return;
    }

    if(mode==="skip"){
      rows=rows.filter(r=>!r.frontDuplicate&&!r.duplicate);
    }

    if(mode==="replace"){
      let replaced=0;
      let added=0;
      rows.forEach(r=>{
        const ex=softDuplicateMatch(r,listId);
        if(ex){
          Object.assign(ex,{front:r.front,back:r.back,pos:r.pos,gender:r.gender,memo:r.memo,frontLang,backLang,listId});
          replaced++;
        }else{
          (db.words ||= []).push({
            id:tnUid(),front:r.front,back:r.back,pos:r.pos,gender:r.gender,memo:r.memo,
            frontLang,backLang,listId,tags:"",saved:false,status:"new",seen:0,level:1,
            nextReview:tnAddDays(1),createdAt:new Date().toISOString()
          });
          added++;
        }
      });
      tnGet("bulkText").value="";
      clearBulkPreview();
      if(typeof save==="function")save();
      if(typeof render==="function")render();
      tnToast(`${added} added, ${replaced} replaced`);
      return;
    }

    // addBoth or no duplicates mode: remove exact duplicate within paste only, allow same-front different-back.
    const seenExact=new Set();
    rows=rows.filter(r=>{
      const k=[r.front,r.back,r.pos].map(x=>String(x||"").trim().toLowerCase()).join("||");
      if(seenExact.has(k))return false;
      seenExact.add(k);
      return true;
    });

    const newWords=rows.map(r=>({
      id:tnUid(),front:r.front,back:r.back,pos:r.pos,gender:r.gender,memo:r.memo,
      frontLang,backLang,listId,tags:"",saved:false,status:"new",seen:0,level:1,
      nextReview:tnAddDays(1),createdAt:new Date().toISOString()
    }));

    db.words=[...(db.words||[]),...newWords];
    tnGet("bulkText").value="";
    clearBulkPreview();
    if(typeof save==="function")save();
    if(typeof render==="function")render();
    tnToast(`${newWords.length} added`);
  }catch(e){
    console.error(e);
    if(box){
      box.style.display="block";
      box.innerHTML=`<div class="bulk-empty">Bulk Add error: ${tnEsc(e.message||e)}</div>`;
    }
    tnToast("Bulk Add error");
  }
}

function attachBulkButtonsStable(){
  const addPage=document.getElementById("pageAdd")||document;
  [...addPage.querySelectorAll("button")].forEach(btn=>{
    const txt=(btn.textContent||"").trim().toLowerCase();
    if(txt==="preview"&&!btn.dataset.tnBulkStable){
      btn.dataset.tnBulkStable="1";
      btn.onclick=(e)=>{e.preventDefault();previewBulk();return false;};
    }
    if(txt==="bulk register"&&!btn.dataset.tnBulkStable){
      btn.dataset.tnBulkStable="1";
      btn.onclick=(e)=>{e.preventDefault();bulkImport();return false;};
    }
  });
}
setTimeout(attachBulkButtonsStable,100);
setTimeout(attachBulkButtonsStable,800);
setTimeout(attachBulkButtonsStable,1800);



/* =========================================================
   Beta56 Render + Bulk Final Safety Patch
   Root cause fixed:
   old renderHome/update functions referenced IDs that no longer exist
   in the current TangoNest HTML. This patch safely updates both
   old and new IDs and prevents Bulk Register from failing after save().
========================================================= */

function tnSafeEl(id){
  return document.getElementById(id);
}

function tnSetText(id,value){
  const el=tnSafeEl(id);
  if(el)el.textContent=value;
}

function tnSetHTML(id,value){
  const el=tnSafeEl(id);
  if(el)el.innerHTML=value;
}

function tnSafeToast(message){
  const t=tnSafeEl("toast");
  if(t){
    t.textContent=message;
    t.classList.add("show");
    setTimeout(()=>t.classList.remove("show"),1700);
  }else{
    console.log("[TangoNest]",message);
  }
}

// Override unsafe toast globally
toast = tnSafeToast;

// Safe renderHome replacement. Updates current header IDs and old hidden compat IDs.
renderHome = function(){
  const words=db.words||[];
  const lists=db.lists||[];
  const learned=words.filter(w=>w.status==="learned").length;
  const hard=words.filter(w=>w.status==="hard").length;
  const due=(typeof dueWords==="function"?dueWords():[]).length;

  // New header IDs
  tnSetText("wc",words.length);
  tnSetText("listCount",lists.length);
  tnSetText("lc",learned);
  tnSetText("hc",hard);

  // Old IDs retained for compatibility
  tnSetText("totalWords",words.length);
  tnSetText("totalLists",lists.length);
  tnSetText("totalLearned",learned);
  tnSetText("totalHard",hard);
  tnSetText("dashTotal",words.length);
  tnSetText("dashLearned",Math.round((learned/Math.max(1,words.length))*100)+"%");
  tnSetText("dashDue",due);
  tnSetText("dashHard",hard);
  tnSetText("heroWords",words.length);
  tnSetText("heroLists",lists.length);
  tnSetText("heroLearned",learned);

  const activeId=typeof activeListId==="function"?activeListId():(lists[0]?.id);
  const list=lists.find(l=>l.id===activeId)||lists[0]||{id:"starter",name:"New Playlist"};
  const ws=typeof listWords==="function"?listWords(list.id):words.filter(w=>w.listId===list.id);
  const meta=typeof playlistLangMeta==="function"?playlistLangMeta(list.id):"Language space";

  tnSetText("heroPlaylistName",list.name);
  tnSetText("heroPlaylistMeta",`${meta} · ${ws.length} words`);
  tnSetText("contextPlaylistName",list.name);
  tnSetText("contextPlaylistMeta",`${meta} · ${ws.length} words`);
  tnSetText("heroPhoneDeck",list.name);
  tnSetText("heroPhoneMeta",`${meta} · ${ws.length} words`);

  const homeLists=tnSafeEl("homeLists");
  if(homeLists){
    homeLists.innerHTML=lists.map(l=>{
      const lws=typeof listWords==="function"?listWords(l.id):words.filter(w=>w.listId===l.id);
      const lmeta=typeof playlistLangMeta==="function"?playlistLangMeta(l.id):"Language space";
      const llearned=lws.filter(w=>w.status==="learned").length;
      const lhard=lws.filter(w=>w.status==="hard").length;
      return `<div class="playlist-card">
        <div class="playlist-main">
          <div class="playlist-icon">${tnEsc(l.name.slice(0,1).toUpperCase())}</div>
          <div>
            <b>${tnEsc(l.name)}</b>
            <span>${tnEsc(lmeta)} · ${lws.length} words · ${llearned} learned · ${lhard} hard</span>
          </div>
        </div>
        <div class="playlist-actions">
          <button class="btn small" onclick="setActiveList('${l.id}','quiz')">Quiz</button>
          <button class="btn small" onclick="setActiveList('${l.id}','study')">Cards</button>
          <button class="btn small" onclick="setActiveList('${l.id}','audio')">Listen</button>
        </div>
      </div>`;
    }).join("");
  }
};

// Safe render wrapper
if(typeof render==="function" && !render.__beta56SafeWrapped){
  const originalRenderBeta56=render;
  render=function(){
    try{
      originalRenderBeta56();
    }catch(e){
      console.warn("Render recovered:",e);
      try{
        if(typeof fillLangSelects==="function")fillLangSelects();
        ["addList","bulkList","studyList","quizList","audioList","renameListSelect","editList"].forEach(id=>{
          try{ if(typeof renderSelect==="function")renderSelect(id,false); }catch(_){}
        });
        try{ if(typeof renderSelect==="function")renderSelect("wordListSelect",true); }catch(_){}
        renderHome();
        try{ if(typeof renderWords==="function")renderWords(); }catch(_){}
        try{ if(typeof renderManage==="function")renderManage(); }catch(_){}
        try{ if(typeof updateStudyStar==="function")updateStudyStar(); }catch(_){}
      }catch(inner){
        console.error("Safe render failed:",inner);
      }
    }
  };
  render.__beta56SafeWrapped=true;
}

// Final Bulk Import override: use persist + safe render to avoid post-save crashes.
bulkImport = function(mode){
  const box=tnBulkPreviewBox();
  try{
    let rows=bulkRows();
    const listId=tnGet("bulkList")?.value || (db.lists?.[0]?.id || "starter");
    const frontLang=tnGet("bulkFrontLang")?.value || "en-US";
    const backLang=tnGet("bulkBackLang")?.value || "ja-JP";

    if(!rows.length){
      if(box){
        box.style.display="block";
        box.innerHTML='<div class="bulk-empty">No readable rows. Use: Front / Back / POS / Gender / Example</div>';
      }
      tnSafeToast("No readable words");
      return;
    }

    const hasFrontDup=rows.some(r=>r.frontDuplicate);
    if(hasFrontDup&&!mode){
      previewBulk();
      tnSafeToast("Duplicate check needs your choice");
      return;
    }

    if(mode==="skip"){
      rows=rows.filter(r=>!r.frontDuplicate&&!r.duplicate);
    }

    let added=0;
    let replaced=0;

    if(mode==="replace"){
      rows.forEach(r=>{
        const ex=softDuplicateMatch(r,listId);
        if(ex){
          Object.assign(ex,{front:r.front,back:r.back,pos:r.pos,gender:r.gender,memo:r.memo,frontLang,backLang,listId});
          replaced++;
        }else{
          (db.words ||= []).push({
            id:tnUid(),front:r.front,back:r.back,pos:r.pos,gender:r.gender,memo:r.memo,
            frontLang,backLang,listId,tags:"",saved:false,status:"new",seen:0,level:1,
            nextReview:tnAddDays(1),createdAt:new Date().toISOString()
          });
          added++;
        }
      });
    }else{
      const seenExact=new Set();
      rows=rows.filter(r=>{
        const k=[r.front,r.back,r.pos].map(x=>String(x||"").trim().toLowerCase()).join("||");
        if(seenExact.has(k))return false;
        seenExact.add(k);
        return true;
      });

      rows.forEach(r=>{
        (db.words ||= []).push({
          id:tnUid(),front:r.front,back:r.back,pos:r.pos,gender:r.gender,memo:r.memo,
          frontLang,backLang,listId,tags:"",saved:false,status:"new",seen:0,level:1,
          nextReview:tnAddDays(1),createdAt:new Date().toISOString()
        });
        added++;
      });
    }

    const textBox=tnGet("bulkText");
    if(textBox)textBox.value="";
    clearBulkPreview();

    if(typeof persist==="function")persist();
    else tnWriteData(db);

    render();
    tnSafeToast(replaced?`${added} added, ${replaced} replaced`:`${added} added`);
  }catch(e){
    console.error("Bulk Add final error:",e);
    if(box){
      box.style.display="block";
      box.innerHTML=`<div class="bulk-empty">Bulk Add error: ${tnEsc(e.message||e)}</div>`;
    }
    tnSafeToast("Bulk Add error");
  }
};

// Rebind buttons after all scripts
function attachBulkButtonsBeta56(){
  const addPage=document.getElementById("pageAdd")||document;
  [...addPage.querySelectorAll("button")].forEach(btn=>{
    const txt=(btn.textContent||"").trim().toLowerCase();
    if(txt==="preview"){
      btn.onclick=(e)=>{e.preventDefault();previewBulk();return false;};
    }
    if(txt==="bulk register"){
      btn.onclick=(e)=>{e.preventDefault();bulkImport();return false;};
    }
  });
}
setTimeout(attachBulkButtonsBeta56,50);
setTimeout(attachBulkButtonsBeta56,500);
setTimeout(attachBulkButtonsBeta56,1500);



/* =========================================================
   Beta57 Preflight Safety Check
========================================================= */
function tnPreflightCheck(){
  const requiredIds=[
    "bulkText","bulkPreview","bulkList","bulkFrontLang","bulkBackLang",
    "quizList","quizCount","quizDirection","quizOrder",
    "wc","listCount","lc","hc","toast"
  ];
  const missing=requiredIds.filter(id=>!document.getElementById(id));
  if(missing.length){
    console.warn("TangoNest preflight missing IDs:",missing);
  }

  const requiredFns=[
    "parseBulk","bulkRows","previewBulk","bulkImport",
    "renderHome","render","save"
  ];
  const missingFns=requiredFns.filter(name=>typeof window[name]!=="function" && typeof globalThis[name]!=="function");
  if(missingFns.length){
    console.warn("TangoNest preflight missing functions:",missingFns);
  }
  return {missing,missingFns};
}

// Make Add/Bulk default English -> Japanese on first clean use.
// This does not stop the user from changing language manually after loading.
function tnApplyDefaultLanguageIfEmpty(){
  const front=document.getElementById("frontLang");
  const back=document.getElementById("backLang");
  const bulkFront=document.getElementById("bulkFrontLang");
  const bulkBack=document.getElementById("bulkBackLang");
  const set=(el,val)=>{
    if(!el)return;
    if([...el.options].some(o=>o.value===val)){
      // If a stale old default remains, correct it.
      if(el.value==="zh-CN" || el.value==="fr-FR" || !el.value) el.value=val;
    }
  };
  set(front,"en-US");
  set(back,"ja-JP");
  set(bulkFront,"en-US");
  set(bulkBack,"ja-JP");
}

setTimeout(()=>{tnPreflightCheck();tnApplyDefaultLanguageIfEmpty();attachBulkButtonsBeta56?.();},250);
setTimeout(()=>{tnPreflightCheck();tnApplyDefaultLanguageIfEmpty();attachBulkButtonsBeta56?.();},1200);



/* =========================================================
   Beta58 Bulk Import Isolated Final Fix
   Main idea:
   Bulk Add must NOT call save() or render() after import.
   Older render code can still reference legacy DOM and break.
   This version only persists data and updates safe header counters.
========================================================= */

function tnSafePersistOnly(){
  try{
    if(typeof KEY!=="undefined"){
      tnWriteData(db);
    }else{
      localStorage.setItem("tangonest_data_backup",JSON.stringify(db));
    }
  }catch(e){
    console.error("Persist failed",e);
    throw e;
  }
}

function tnUpdateHeaderCountsOnly(){
  try{
    const words=db.words||[];
    const lists=db.lists||[];
    const learned=words.filter(w=>w.status==="learned").length;
    const hard=words.filter(w=>w.status==="hard").length;
    const set=(id,val)=>{
      const el=document.getElementById(id);
      if(el)el.textContent=val;
    };
    set("wc",words.length);
    set("listCount",lists.length);
    set("lc",learned);
    set("hc",hard);
    set("totalWords",words.length);
    set("totalLists",lists.length);
    set("totalLearned",learned);
    set("totalHard",hard);
  }catch(e){
    console.warn("Header count update skipped",e);
  }
}

function tnStableToast(msg){
  const t=document.getElementById("toast");
  if(t){
    t.textContent=msg;
    t.classList.add("show");
    setTimeout(()=>t.classList.remove("show"),1600);
  }else{
    console.log("[TangoNest]",msg);
  }
}

function tnFinalBulkPreviewBox(){
  let box=document.getElementById("bulkPreview");
  if(!box){
    const text=document.getElementById("bulkText");
    box=document.createElement("div");
    box.id="bulkPreview";
    box.className="bulk-preview";
    (text?.closest(".card")||document.body).appendChild(box);
  }
  return box;
}

function tnFinalEsc(v){
  return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
}

function tnFinalUid(){
  return "w_"+Date.now()+"_"+Math.random().toString(16).slice(2);
}

function tnFinalAddDays(n){
  const d=new Date();
  d.setDate(d.getDate()+n);
  return d.toISOString();
}

function tnFinalClean(v){
  return String(v??"").trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g,"").trim();
}

function tnFinalSplitLine(line){
  const raw=String(line||"").trim();
  if(!raw)return [];
  if(raw.includes("\t"))return raw.split("\t").map(tnFinalClean);
  if(raw.includes(","))return raw.split(",").map(tnFinalClean);
  const multi=raw.split(/\s{2,}/).map(tnFinalClean).filter(Boolean);
  if(multi.length>=2)return multi;
  return raw.split(/\s+/).map(tnFinalClean).filter(Boolean);
}

function parseBulk(text){
  return String(text||"")
    .split(/\r?\n/)
    .map((line,i)=>({line:String(line||"").trim(),row:i+1}))
    .filter(x=>x.line)
    .map(({line,row})=>{
      let before=line;
      let example="";
      if(line.includes("|")){
        const pieces=line.split("|");
        before=pieces.shift().trim();
        example=pieces.join("|").trim();
      }
      const parts=tnFinalSplitLine(before);
      let front="",back="",pos="",gender="",memo="";
      if(parts.length>=5){
        front=parts[0];back=parts[1];pos=parts[2];gender=parts[3];memo=parts.slice(4).join(" ");
      }else if(parts.length===4){
        front=parts[0];back=parts[1];pos=parts[2];gender=parts[3];
      }else if(parts.length===3){
        front=parts[0];back=parts[1];pos=parts[2];
      }else if(parts.length===2){
        front=parts[0];back=parts[1];
      }
      if(example)memo=memo?`${memo} | ${example}`:example;
      return {row,front:tnFinalClean(front),back:tnFinalClean(back),pos:tnFinalClean(pos),gender:tnFinalClean(gender),memo:tnFinalClean(memo)};
    })
    .filter(r=>r.front&&r.back);
}

function tnFinalKey(v){
  return String(v||"").trim().toLowerCase();
}

function duplicateMatch(row,listId){
  return (db.words||[]).find(w=>
    w.listId===listId &&
    tnFinalKey(w.front)===tnFinalKey(row.front) &&
    tnFinalKey(w.back)===tnFinalKey(row.back) &&
    tnFinalKey(w.pos)===tnFinalKey(row.pos)
  );
}

function softDuplicateMatch(row,listId){
  return (db.words||[]).find(w=>
    w.listId===listId &&
    tnFinalKey(w.front)===tnFinalKey(row.front)
  );
}

function bulkRows(){
  const text=document.getElementById("bulkText")?.value||"";
  const listId=document.getElementById("bulkList")?.value || (db.lists?.[0]?.id || "starter");
  const rows=parseBulk(text);
  const seenFront=new Set();
  const seenExact=new Set();
  return rows.map(r=>{
    const frontKey=tnFinalKey(r.front);
    const exactKey=[r.front,r.back,r.pos].map(tnFinalKey).join("||");
    const existingExact=duplicateMatch(r,listId);
    const existingFront=softDuplicateMatch(r,listId);
    const pastedFront=seenFront.has(frontKey);
    const pastedExact=seenExact.has(exactKey);
    seenFront.add(frontKey);
    seenExact.add(exactKey);
    return {
      ...r,
      duplicate:!!existingExact||pastedExact,
      frontDuplicate:!!existingFront||pastedFront,
      duplicateReason:existingExact?"Already exists":pastedExact?"Duplicate in pasted text":existingFront?"Same front already exists":pastedFront?"Same front in pasted text":""
    };
  });
}

function previewBulk(){
  const box=tnFinalBulkPreviewBox();
  const rows=bulkRows();
  box.style.display="block";
  if(!rows.length){
    box.innerHTML='<div class="bulk-empty">No readable rows. Use: Front / Back / POS / Gender / Example</div>';
    return;
  }
  const frontDupCount=rows.filter(r=>r.frontDuplicate).length;
  const exactDupCount=rows.filter(r=>r.duplicate).length;
  box.innerHTML=`
    ${frontDupCount?`<div class="bulk-warning"><b>${frontDupCount} possible duplicate${frontDupCount>1?"s":""}</b><span>Choose how to import them below.</span></div>`:""}
    <div class="bulk-summary">
      <span>${rows.length} readable rows</span>
      <span>${frontDupCount} possible duplicates</span>
      <span>${exactDupCount} exact duplicates</span>
    </div>
    <div class="bulk-table-wrap">
      <table class="bulk-table">
        <thead><tr><th>#</th><th>Front</th><th>Back</th><th>POS</th><th>Gender</th><th>Memo / Example</th><th>Status</th></tr></thead>
        <tbody>
          ${rows.map(r=>`
            <tr class="${r.frontDuplicate?'dup-row':''}">
              <td>${r.row}</td>
              <td><b>${tnFinalEsc(r.front)}</b></td>
              <td>${tnFinalEsc(r.back)}</td>
              <td>${tnFinalEsc(r.pos||"—")}</td>
              <td>${tnFinalEsc(r.gender||"—")}</td>
              <td>${tnFinalEsc(r.memo||"")}</td>
              <td>${r.frontDuplicate?`<span class="badge yellow">${tnFinalEsc(r.duplicateReason||"Possible duplicate")}</span>`:`<span class="badge green">Ready</span>`}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>
    ${frontDupCount?`
      <div class="bulk-review-actions">
        <button class="btn primary small" onclick="bulkImport('addBoth')">Import all</button>
        <button class="btn small" onclick="bulkImport('skip')">Skip duplicates</button>
        <button class="btn small" onclick="bulkImport('replace')">Replace same front</button>
      </div>`:""}
  `;
}

function clearBulkPreview(){
  window.__tnBulkSuppressEmptyUntil=Date.now()+5000;
  const box=tnFinalBulkPreviewBox();
  box.style.display="none";
  box.innerHTML="";
}

function bulkImport(mode){
  if(window.__tnBulkImportBusy)return;
  window.__tnBulkImportBusy=true;
  const box=tnFinalBulkPreviewBox();
  try{
    let rows=bulkRows();
    const listId=document.getElementById("bulkList")?.value || (db.lists?.[0]?.id || "starter");
    const frontLang=document.getElementById("bulkFrontLang")?.value || "en-US";
    const backLang=document.getElementById("bulkBackLang")?.value || "ja-JP";

    if(!rows.length){
      if(Date.now()<(window.__tnBulkSuppressEmptyUntil||0)||Date.now()-(window.__tnBulkLastSuccessAt||0)<5000){
        clearBulkPreview();
        return;
      }
      box.style.display="block";
      box.innerHTML='<div class="bulk-empty">No readable rows. Use: Front / Back / POS / Gender / Example</div>';
      tnStableToast("No readable words");
      return;
    }

    const hasFrontDup=rows.some(r=>r.frontDuplicate);
    if(hasFrontDup && !mode){
      previewBulk();
      tnStableToast("Duplicate check needs your choice");
      return;
    }

    if(mode==="skip"){
      rows=rows.filter(r=>!r.frontDuplicate&&!r.duplicate);
    }

    let added=0;
    let replaced=0;

    if(mode==="replace"){
      rows.forEach(r=>{
        const ex=softDuplicateMatch(r,listId);
        if(ex){
          Object.assign(ex,{front:r.front,back:r.back,pos:r.pos,gender:r.gender,memo:r.memo,frontLang,backLang,listId});
          replaced++;
        }else{
          (db.words ||= []).push({
            id:tnFinalUid(),front:r.front,back:r.back,pos:r.pos,gender:r.gender,memo:r.memo,
            frontLang,backLang,listId,tags:"",saved:false,status:"new",seen:0,level:1,
            nextReview:tnFinalAddDays(1),createdAt:new Date().toISOString()
          });
          added++;
        }
      });
    }else{
      const seenExact=new Set();
      rows=rows.filter(r=>{
        const k=[r.front,r.back,r.pos].map(tnFinalKey).join("||");
        if(seenExact.has(k))return false;
        seenExact.add(k);
        return true;
      });
      rows.forEach(r=>{
        (db.words ||= []).push({
          id:tnFinalUid(),front:r.front,back:r.back,pos:r.pos,gender:r.gender,memo:r.memo,
          frontLang,backLang,listId,tags:"",saved:false,status:"new",seen:0,level:1,
          nextReview:tnFinalAddDays(1),createdAt:new Date().toISOString()
        });
        added++;
      });
    }

    const text=document.getElementById("bulkText");
    if(text)text.value="";
    clearBulkPreview();

    // Critical: do NOT call save() or render() here.
    tnSafePersistOnly();
    tnUpdateHeaderCountsOnly();

    // Try to refresh the library only if its render function is safe.
    try{ if(typeof renderWords==="function")renderWords(); }catch(e){ console.warn("renderWords skipped",e); }

    tnStableToast(replaced?`${added} added, ${replaced} replaced`:`${added} added`);
    window.__tnBulkLastSuccessAt=Date.now();
  }catch(e){
    console.error("Bulk import isolated error:",e);
    box.style.display="block";
    box.innerHTML=`<div class="bulk-empty">Bulk Add error: ${tnFinalEsc(e.message||e)}</div>`;
    tnStableToast("Bulk Add error");
  }finally{
    setTimeout(()=>{window.__tnBulkImportBusy=false},1200);
  }
}

function tnBindBulkButtonsFinal(){
  const addPage=document.getElementById("pageAdd")||document;
  [...addPage.querySelectorAll("button")].forEach(btn=>{
    const txt=(btn.textContent||"").trim().toLowerCase();
    if(txt==="preview"){
      btn.onclick=(e)=>{e.preventDefault();previewBulk();return false;};
    }
    if(txt==="bulk register"){
      btn.onclick=(e)=>{e.preventDefault();bulkImport();return false;};
    }
  });
}
function tnFinalizeBulkClickUi(beforeCount){
  const afterCount=(db.words||[]).length;
  if(afterCount<=beforeCount)return;
  window.__tnBulkLastSuccessAt=Date.now();
  window.__tnBulkSuppressEmptyUntil=Date.now()+5000;
  const preview=document.getElementById("bulkPreview");
  if(preview&&/No readable/i.test(preview.textContent||"")){
    preview.style.display="none";
    preview.innerHTML="";
  }
  const toastEl=document.getElementById("toast");
  if(toastEl&&/No readable words/i.test(toastEl.textContent||"")){
    tnStableToast(`${afterCount-beforeCount} added`);
  }
}
function tnInstallBulkUiGuard(){
  if(document.__tnBulkUiGuardInstalled)return;
  document.__tnBulkUiGuardInstalled=true;
  document.addEventListener("click",event=>{
    const btn=event.target?.closest?.("button");
    const text=(btn?.textContent||"").trim().toLowerCase();
    if(text!=="bulk register"&&text!=="import all")return;
    const beforeCount=(db.words||[]).length;
    window.__tnBulkClickAt=Date.now();
    window.__tnBulkStartCount=beforeCount;
    [250,700,1200,2000,3500].forEach(delay=>setTimeout(()=>tnFinalizeBulkClickUi(beforeCount),delay));
  },true);
}
setTimeout(tnBindBulkButtonsFinal,50);
setTimeout(tnBindBulkButtonsFinal,500);
setTimeout(tnBindBulkButtonsFinal,1500);
tnInstallBulkUiGuard();



/* =========================================================
   Beta59 Session Persistence + Cloud Sync Fix
   Goals:
   1. Do not show login screen after reload if Supabase session exists.
   2. Auto-load cloud data after login / existing session.
   3. Auto-save cloud after Add Word / Bulk Add / save().
   4. Keep Bulk Import isolated from full render().
========================================================= */

window.__tnCloudLoadedOnce = window.__tnCloudLoadedOnce || false;
window.__tnBootChecked = window.__tnBootChecked || false;

function tnLog(...args){
  console.log("[TangoNest]",...args);
}

function tnShowApp(){
  const gate=document.getElementById("loginGate");
  if(gate)gate.classList.add("hidden");
  document.body.classList.add("tn-logged-in");
}

function tnShowLogin(){
  const gate=document.getElementById("loginGate");
  if(gate)gate.classList.remove("hidden");
  document.body.classList.remove("tn-logged-in");
}

function tnHasGuestMode(){
  return localStorage.getItem("tangonest_guest_mode")==="1";
}

function tnSetGuestMode(on){
  if(on)localStorage.setItem("tangonest_guest_mode","1");
  else localStorage.removeItem("tangonest_guest_mode");
}

async function tnGetSessionUser(){
  ensureTangoNestSupabaseReady();
  const {data,error}=await tnSupabase.auth.getSession();
  if(error)throw error;
  const session=data?.session||null;
  if(session?.user){
    tnUser=session.user;
    return tnUser;
  }
  const userRes=await tnSupabase.auth.getUser();
  if(userRes?.data?.user){
    tnUser=userRes.data.user;
    return tnUser;
  }
  tnUser=null;
  return null;
}

function tnLocalDbIsMostlyEmpty(){
  return !(db?.words?.length) && !(db?.lists?.length>1);
}

async function tnLoadCloudSilently(){
  if(!tnUser || !tnSupabase)return false;
  try{
    const {data,error}=await tnSupabase
      .from("tangonest_data")
      .select("data, updated_at")
      .eq("user_id", tnUser.id)
      .order("updated_at", {ascending:false})
      .limit(1)
      .maybeSingle();

    if(error)throw error;
    if(!data?.data?.data)return false;

    const cloudDb=data.data.data;
    if(!cloudDb.words || !cloudDb.lists)return false;

    tnSafeApplyCloudData(cloudDb,"silent-login-cloud-load");

    try{ render(); }catch(e){ console.warn("render after cloud load recovered",e); try{renderHome?.();renderWords?.();}catch(_){} }
    tnUpdateHeaderCountsOnly?.();
    window.__tnCloudLoadedOnce=true;
    tnStableToast?.("Cloud data loaded");
    return true;
  }catch(e){
    console.warn("Cloud load skipped:",e);
    return false;
  }
}

async function tnCloudSaveSilently(){
  if(!tnUser || !tnSupabase)return false;
  try{
    const payload={
      version:"tangonest-cloud-v1",
      savedAt:new Date().toISOString(),
      data:db
    };

    const {data,error}=await tnSupabase
      .from("tangonest_data")
      .select("id")
      .eq("user_id", tnUser.id)
      .maybeSingle();

    if(error)throw error;

    if(data?.id){
      const {error:updateError}=await tnSupabase
        .from("tangonest_data")
        .update({data:payload, updated_at:new Date().toISOString()})
        .eq("id",data.id)
        .eq("user_id",tnUser.id);
      if(updateError)throw updateError;
    }else{
      const {error:insertError}=await tnSupabase
        .from("tangonest_data")
        .insert({user_id:tnUser.id,data:payload});
      if(insertError)throw insertError;
    }
    return true;
  }catch(e){
    console.warn("Cloud save failed:",e);
    return false;
  }
}

// Override old refresh session behavior
refreshTangoNestSession = async function(){
  try{
    const user=await tnGetSessionUser();
    if(user){
      tnShowApp();
      updateAuthUI?.();
      if(!window.__tnCloudLoadedOnce){
        await tnLoadCloudSilently();
      }
    }else{
      if(tnHasGuestMode())tnShowApp();
      else tnShowLogin();
      updateAuthUI?.();
    }
  }catch(e){
    console.warn("Session refresh failed:",e);
    if(tnHasGuestMode())tnShowApp();
    else tnShowLogin();
  }
};

// Override login/signup so login loads cloud immediately.
gateLogin = async function(){
  const email=document.getElementById("gateEmail")?.value?.trim()||"";
  const password=document.getElementById("gatePassword")?.value||"";
  showResendButton?.(false);
  if(!email||!password){
    setGateMessage?.("Email and password are required.","error");
    return;
  }
  setGateMessage?.("Logging in...","info");
  try{
    ensureTangoNestSupabaseReady();
    const {data,error}=await tnSupabase.auth.signInWithPassword({email,password});
    if(error){
      if(typeof isEmailNotConfirmedError==="function" && isEmailNotConfirmedError(error.message)){
        setGateMessage?.("Email not confirmed. For development, turn off email confirmation in Supabase or use a confirmed account.","error");
        showResendButton?.(true);
      }else{
        setGateMessage?.(error.message,"error");
      }
      return;
    }
    tnUser=data.user;
    tnSetGuestMode(false);
    updateAuthUI?.();
    tnShowApp();
    setGateMessage?.("Logged in. Loading cloud data...","success");
    await tnLoadCloudSilently();
    tnStableToast?.("Logged in");
  }catch(e){
    setGateMessage?.(e.message||String(e),"error");
  }
};

gateSignUp = async function(){
  const email=document.getElementById("gateEmail")?.value?.trim()||"";
  const password=document.getElementById("gatePassword")?.value||"";
  showResendButton?.(false);
  if(!email||!password){
    setGateMessage?.("Email and password are required.","error");
    return;
  }
  if(password.length<6){
    setGateMessage?.("Password must be at least 6 characters.","error");
    return;
  }
  setGateMessage?.("Creating account...","info");
  try{
    ensureTangoNestSupabaseReady();
    const {data,error}=await tnSupabase.auth.signUp({email,password});
    if(error){
      setGateMessage?.(error.message,"error");
      return;
    }

    // If email confirmation is OFF, session should exist.
    tnUser=data.user||data.session?.user||null;
    if(data.session || tnUser){
      tnSetGuestMode(false);
      updateAuthUI?.();
      tnShowApp();
      await tnCloudSaveSilently();
      setGateMessage?.("Account created.","success");
      tnStableToast?.("Account created");
    }else{
      setGateMessage?.("Account created, but Supabase still requires email confirmation. Turn off email confirmation or confirm the email.","error");
      showResendButton?.(true);
    }
  }catch(e){
    setGateMessage?.(e.message||String(e),"error");
  }
};

continueAsGuest = function(){
  tnSetGuestMode(true);
  tnShowApp();
};

// Override logout: logout should show login page.
logoutTangoNest = async function(){
  try{
    ensureTangoNestSupabaseReady();
    await tnSupabase.auth.signOut();
  }catch(e){
    console.warn(e);
  }
  tnUser=null;
  window.__tnCloudLoadedOnce=false;
  tnSetGuestMode(false);
  updateAuthUI?.();
  tnShowLogin();
  tnStableToast?.("Logged out");
};

// Make updateAuthUI safe and consistent.
updateAuthUI = function(){
  const form=document.getElementById("authForm");
  const actions=document.getElementById("authActions");
  const status=document.getElementById("authStatus");
  const sub=document.getElementById("authSub");

  if(tnUser){
    if(status)status.textContent="Logged in";
    if(sub)sub.textContent=tnUser.email||"TangoNest account";
    if(form)form.style.display="none";
    if(actions)actions.style.display="flex";
  }else{
    if(status)status.textContent=tnHasGuestMode()?"Guest mode":"Not logged in";
    if(sub)sub.textContent=tnHasGuestMode()?"Local-only mode. Cloud sync is off.":"Login to sync across PC and phone.";
    if(form)form.style.display="flex";
    if(actions)actions.style.display="none";
  }
};

// Wrap save: local save + cloud save if logged in.
if(typeof save==="function" && !save.__beta59CloudWrapped){
  const oldSaveBeta59=save;
  save=function(){
    oldSaveBeta59();
    if(tnUser)tnCloudSaveSilently();
  };
  save.__beta59CloudWrapped=true;
}

// Wrap direct persist too, if available.
if(typeof persist==="function" && !persist.__beta59CloudWrapped){
  const oldPersistBeta59=persist;
  persist=function(){
    oldPersistBeta59();
    if(tnUser)tnCloudSaveSilently();
  };
  persist.__beta59CloudWrapped=true;
}

// Override Bulk Import again to include cloud save after local isolated persist.
if(typeof bulkImport==="function" && !bulkImport.__beta59CloudWrapped){
  const oldBulkImportBeta59=bulkImport;
  bulkImport=function(mode){
    oldBulkImportBeta59(mode);
    if(tnUser){
      // wait for oldBulkImport to mutate db/persist, then cloud save
      setTimeout(()=>tnCloudSaveSilently().then(ok=>{if(ok)tnStableToast?.("Saved to cloud");}),100);
    }
  };
  bulkImport.__beta59CloudWrapped=true;
}

// Better boot: check session before forcing login.
async function tnBootSession(){
  if(window.__tnBootChecked)return;
  window.__tnBootChecked=true;

  // If guest mode, do not bother user.
  if(tnHasGuestMode()){
    tnShowApp();
    return;
  }

  try{
    const user=await tnGetSessionUser();
    if(user){
      tnShowApp();
      updateAuthUI?.();
      await tnLoadCloudSilently();
    }else{
      tnShowLogin();
    }
  }catch(e){
    console.warn("Boot session check failed:",e);
    tnShowLogin();
  }
}

setTimeout(tnBootSession,100);
setTimeout(refreshTangoNestSession,900);
setTimeout(refreshTangoNestSession,2200);

// Listen to auth changes from Supabase.
setTimeout(()=>{
  try{
    ensureTangoNestSupabaseReady();
    if(!window.__tnAuthListenerSet){
      window.__tnAuthListenerSet=true;
      tnSupabase.auth.onAuthStateChange(async(_event,session)=>{
        tnUser=session?.user||null;
        if(tnUser){
          tnShowApp();
          updateAuthUI?.();
          await tnLoadCloudSilently();
        }else if(!tnHasGuestMode()){
          tnShowLogin();
          updateAuthUI?.();
        }
      });
    }
  }catch(e){
    console.warn(e);
  }
},500);



/* =========================================================
   Beta60 No-Email Sync Account
   Supabase Auth is NOT used.
   No email confirmation. No email OTP. No localhost redirect.
   Sync uses RPC functions:
   - tn_signup
   - tn_login
   - tn_save
========================================================= */

const TN_ACCOUNT_EMAIL_KEY = "tangonest_sync_email_v1";
const TN_ACCOUNT_HASH_KEY = "tangonest_sync_hash_v1";
const TN_ACCOUNT_MODE_KEY = "tangonest_sync_mode_v1";
let tnSyncEmail = localStorage.getItem(TN_ACCOUNT_EMAIL_KEY) || "";
let tnSyncHash = localStorage.getItem(TN_ACCOUNT_HASH_KEY) || "";
let tnCloudSaveTimer = null;
let tnBootDone = false;

function tnNoEmailShowApp(){
  const gate=document.getElementById("loginGate");
  if(gate)gate.classList.add("hidden");
  document.body.classList.add("tn-logged-in");
}

function tnNoEmailShowLogin(){
  const gate=document.getElementById("loginGate");
  if(gate)gate.classList.remove("hidden");
  document.body.classList.remove("tn-logged-in");
}

function tnNoEmailSetMessage(msg,type="info"){
  if(typeof setGateMessage==="function")setGateMessage(msg,type);
  else{
    const box=document.getElementById("gateMessage");
    if(box){box.textContent=msg;box.className="gate-message "+type;}
  }
}

function tnNoEmailToast(msg){
  const t=document.getElementById("toast");
  if(t){
    t.textContent=msg;
    t.classList.add("show");
    setTimeout(()=>t.classList.remove("show"),1700);
  }else{
    console.log("[TangoNest]",msg);
  }
}

async function tnSha256(text){
  const bytes=new TextEncoder().encode(text);
  const hash=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");
}

async function tnPasswordHash(email,password){
  return await tnSha256("TangoNest::"+String(email).toLowerCase().trim()+"::"+password);
}

function tnGetGateCredentials(){
  return {
    email:(document.getElementById("gateEmail")?.value||"").trim().toLowerCase(),
    password:document.getElementById("gatePassword")?.value||""
  };
}

function tnRememberAccount(email,hash){
  tnSyncEmail=email;
  tnSyncHash=hash;
  localStorage.setItem(TN_ACCOUNT_EMAIL_KEY,email);
  localStorage.setItem(TN_ACCOUNT_HASH_KEY,hash);
  localStorage.setItem(TN_ACCOUNT_MODE_KEY,"sync");
  // Keep old auth listener from showing login.
  localStorage.setItem("tangonest_guest_mode","1");
}

function tnForgetAccount(){
  tnSyncEmail="";
  tnSyncHash="";
  localStorage.removeItem(TN_ACCOUNT_EMAIL_KEY);
  localStorage.removeItem(TN_ACCOUNT_HASH_KEY);
  localStorage.removeItem(TN_ACCOUNT_MODE_KEY);
  localStorage.removeItem("tangonest_guest_mode");
}

function tnIsRemembered(){
  return !!(localStorage.getItem(TN_ACCOUNT_EMAIL_KEY) && localStorage.getItem(TN_ACCOUNT_HASH_KEY));
}

function tnCloudPayload(){
  return {
    version:"tangonest-cloud-v2-no-email",
    savedAt:new Date().toISOString(),
    data:db
  };
}

function tnApplyCloudPayload(payload){
  const cloudDb=payload?.data || payload;
  if(!cloudDb || !cloudDb.words || !cloudDb.lists){
    return false;
  }
  tnSafeApplyCloudData(cloudDb,"account-cloud-payload");
  try{render();}catch(e){
    console.warn("render recovered after cloud load",e);
    try{renderHome?.();renderWords?.();tnUpdateHeaderCountsOnly?.();}catch(_){}
  }
  return true;
}

async function tnRpcLogin(email,hash){
  ensureTangoNestSupabaseReady();
  const {data,error}=await tnSupabase.rpc("tn_login",{
    p_email:email,
    p_password_hash:hash
  });
  if(error)throw error;
  return data;
}

async function tnRpcSignup(email,hash){
  ensureTangoNestSupabaseReady();
  const {data,error}=await tnSupabase.rpc("tn_signup",{
    p_email:email,
    p_password_hash:hash,
    p_data:tnCloudPayload()
  });
  if(error)throw error;
  return data;
}

async function tnRpcSave(email=tnSyncEmail,hash=tnSyncHash){
  if(!email||!hash)return false;
  ensureTangoNestSupabaseReady();
  const {data,error}=await tnSupabase.rpc("tn_save",{
    p_email:email,
    p_password_hash:hash,
    p_data:tnCloudPayload()
  });
  if(error)throw error;
  if(data && data.ok===false)throw new Error(data.error||"Cloud save failed");
  return true;
}

async function tnNoEmailLoadCloud(){
  if(!tnSyncEmail||!tnSyncHash)return false;
  try{
    const result=await tnRpcLogin(tnSyncEmail,tnSyncHash);
    if(result?.ok===false)throw new Error(result.error||"Login failed");
    tnRememberAccount(tnSyncEmail,tnSyncHash);
    tnNoEmailShowApp();
    updateAuthUI?.();
    if(result?.data){
      tnApplyCloudPayload(result.data);
    }
    tnNoEmailToast("Cloud data loaded");
    return true;
  }catch(e){
    console.warn("No-email cloud load failed:",e);
    tnNoEmailSetMessage(
      String(e.message||e).includes("function") || String(e.message||e).includes("schema cache")
      ? "Cloud sync table is not ready. Run SUPABASE_SQL_RUN_ONCE.sql in Supabase SQL Editor."
      : e.message||String(e),
      "error"
    );
    return false;
  }
}

async function tnNoEmailSaveCloud(){
  if(!tnSyncEmail||!tnSyncHash)return false;
  try{
    await tnRpcSave(tnSyncEmail,tnSyncHash);
    return true;
  }catch(e){
    console.warn("No-email cloud save failed:",e);
    return false;
  }
}

function tnScheduleCloudSave(){
  if(!tnSyncEmail||!tnSyncHash)return;
  clearTimeout(tnCloudSaveTimer);
  tnCloudSaveTimer=setTimeout(async()=>{
    const ok=await tnNoEmailSaveCloud();
    if(ok)tnNoEmailToast("Saved to cloud");
  },650);
}

// Override visible auth UI
updateAuthUI = function(){
  const status=document.getElementById("authStatus");
  const sub=document.getElementById("authSub");
  const form=document.getElementById("authForm");
  const actions=document.getElementById("authActions");
  if(tnIsRemembered()){
    if(status)status.textContent="Logged in";
    if(sub)sub.textContent=localStorage.getItem(TN_ACCOUNT_EMAIL_KEY)||"TangoNest account";
    if(form)form.style.display="none";
    if(actions)actions.style.display="flex";
  }else{
    if(status)status.textContent="Not logged in";
    if(sub)sub.textContent="Login to sync across PC and phone.";
    if(form)form.style.display="flex";
    if(actions)actions.style.display="none";
  }
};

// Override login / signup
gateLogin = async function(){
  const {email,password}=tnGetGateCredentials();
  if(!email||!password){
    tnNoEmailSetMessage("Email and password are required.","error");
    return;
  }
  tnNoEmailSetMessage("Logging in...","info");
  try{
    const hash=await tnPasswordHash(email,password);
    const result=await tnRpcLogin(email,hash);
    if(result?.ok===false)throw new Error(result.error||"Login failed");
    tnRememberAccount(email,hash);
    tnNoEmailShowApp();
    if(result?.data)tnApplyCloudPayload(result.data);
    updateAuthUI?.();
    tnNoEmailSetMessage("Logged in.","success");
    tnNoEmailToast("Logged in");
  }catch(e){
    tnNoEmailSetMessage(
      String(e.message||e).includes("Could not find the function") || String(e.message||e).includes("schema cache")
      ? "Cloud sync is not ready. Run SUPABASE_SQL_RUN_ONCE.sql once in Supabase."
      : e.message||String(e),
      "error"
    );
  }
};

gateSignUp = async function(){
  const {email,password}=tnGetGateCredentials();
  if(!email||!password){
    tnNoEmailSetMessage("Email and password are required.","error");
    return;
  }
  if(password.length<6){
    tnNoEmailSetMessage("Password must be at least 6 characters.","error");
    return;
  }
  tnNoEmailSetMessage("Creating sync account...","info");
  try{
    const hash=await tnPasswordHash(email,password);
    const result=await tnRpcSignup(email,hash);
    if(result?.ok===false)throw new Error(result.error||"Create account failed");
    tnRememberAccount(email,hash);
    tnNoEmailShowApp();
    updateAuthUI?.();
    tnNoEmailSetMessage("Account created.","success");
    tnNoEmailToast("Account created and saved to cloud");
  }catch(e){
    tnNoEmailSetMessage(
      String(e.message||e).includes("Could not find the function") || String(e.message||e).includes("schema cache")
      ? "Cloud sync is not ready. Run SUPABASE_SQL_RUN_ONCE.sql once in Supabase."
      : e.message||String(e),
      "error"
    );
  }
};

continueAsGuest = function(){
  localStorage.setItem("tangonest_guest_mode","1");
  tnNoEmailShowApp();
};

logoutTangoNest = async function(){
  tnForgetAccount();
  updateAuthUI?.();
  tnNoEmailShowLogin();
  tnNoEmailToast("Logged out");
};

syncNowToCloud = async function(){
  if(!tnIsRemembered()){
    tnNoEmailToast("Login first");
    tnNoEmailShowLogin();
    return;
  }
  const ok=await tnNoEmailSaveCloud();
  tnNoEmailToast(ok?"Saved to cloud":"Cloud save failed");
};

loadFromCloud = async function(){
  if(!tnIsRemembered()){
    tnNoEmailToast("Login first");
    tnNoEmailShowLogin();
    return;
  }
  await tnNoEmailLoadCloud();
};

// Keep old email confirmation UI hidden forever in no-email mode.
function showResendButton(){const b=document.getElementById("resendEmailBtn");if(b)b.style.display="none";}
function resendConfirmEmail(){tnNoEmailSetMessage("Email confirmation is not used in this version.","info");}

// Save wrappers
if(typeof save==="function"&&!save.__beta60NoEmailWrapped){
  const oldSaveBeta60=save;
  save=function(renderUI=true){
    oldSaveBeta60(renderUI);
    tnScheduleCloudSave();
  };
  save.__beta60NoEmailWrapped=true;
}

if(typeof persist==="function"&&!persist.__beta60NoEmailWrapped){
  const oldPersistBeta60=persist;
  persist=function(){
    oldPersistBeta60();
    tnScheduleCloudSave();
  };
  persist.__beta60NoEmailWrapped=true;
}

// Ensure Bulk Add cloud-saves after isolated import.
if(typeof bulkImport==="function"&&!bulkImport.__beta60NoEmailWrapped){
  const oldBulkImportBeta60=bulkImport;
  bulkImport=function(mode){
    oldBulkImportBeta60(mode);
    tnScheduleCloudSave();
  };
  bulkImport.__beta60NoEmailWrapped=true;
}

// Auto hide login on reload if account remembered.
async function tnNoEmailBoot(){
  if(tnBootDone)return;
  tnBootDone=true;

  if(tnIsRemembered()){
    tnNoEmailShowApp();
    updateAuthUI?.();
    await tnNoEmailLoadCloud();
    return;
  }

  if(localStorage.getItem("tangonest_guest_mode")==="1"){
    tnNoEmailShowApp();
    return;
  }

  tnNoEmailShowLogin();
}

// Maintain gate state to defeat old Supabase Auth listeners.
function tnMaintainNoEmailGate(){
  if(tnIsRemembered() || localStorage.getItem("tangonest_guest_mode")==="1"){
    tnNoEmailShowApp();
  }
}

setTimeout(tnNoEmailBoot,20);
setTimeout(tnNoEmailBoot,250);
setTimeout(tnMaintainNoEmailGate,600);
setInterval(tnMaintainNoEmailGate,1200);



/* =========================================================
   Beta61 Add Word Stable Register Fix
   Add Word must not depend on old save()/render() chain.
========================================================= */

function tnVal(id){
  return (document.getElementById(id)?.value ?? "").trim();
}

function tnSelected(id,fallback=""){
  const el=document.getElementById(id);
  return el?.value || fallback;
}

function tnStableId(){
  return "w_"+Date.now()+"_"+Math.random().toString(16).slice(2);
}

function tnStableAddDays(n){
  const d=new Date();
  d.setDate(d.getDate()+n);
  return d.toISOString();
}

function tnStablePersist(){
  if(typeof KEY!=="undefined"){
    tnWriteData(db);
  }else{
    localStorage.setItem("tangonest_local_data_v1",JSON.stringify(db));
  }
}

function tnStableUpdateCounts(){
  const words=db.words||[];
  const lists=db.lists||[];
  const learned=words.filter(w=>w.status==="learned").length;
  const hard=words.filter(w=>w.status==="hard").length;
  const set=(id,val)=>{
    const el=document.getElementById(id);
    if(el)el.textContent=val;
  };
  ["wc","totalWords","dashTotal","heroWords"].forEach(id=>set(id,words.length));
  ["listCount","totalLists","heroLists"].forEach(id=>set(id,lists.length));
  ["lc","totalLearned","heroLearned"].forEach(id=>set(id,learned));
  ["hc","totalHard","dashHard"].forEach(id=>set(id,hard));
}

function tnStableNotify(msg){
  const t=document.getElementById("toast");
  if(t){
    t.textContent=msg;
    t.classList.add("show");
    setTimeout(()=>t.classList.remove("show"),1600);
  }else{
    console.log("[TangoNest]",msg);
  }
}

function tnClearAddForm(){
  ["front","back","memo","tags"].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.value="";
  });
  const pos=document.getElementById("pos");
  if(pos)pos.value="";
  const gender=document.getElementById("gender");
  if(gender)gender.value="";
}

function tnMakeWordFromAddForm(){
  const front=tnVal("front");
  const back=tnVal("back");
  if(!front || !back){
    throw new Error("Front and Back are required.");
  }
  const word={
    id:tnStableId(),
    front,
    back,
    frontLang:detectLang(front,tnSelected("frontLang","en-US")),
    backLang:detectLang(back,tnSelected("backLang","ja-JP")),
    listId:tnSelected("addList", db.lists?.[0]?.id || "starter"),
    pos:tnSelected("pos",""),
    gender:tnSelected("gender",""),
    tags:tnVal("tags"),
    memo:tnVal("memo"),
    saved:false,
    status:"new",
    seen:0,
    level:1,
    nextReview:tnStableAddDays(1),
    createdAt:new Date().toISOString()
  };
  return word;
}

async function tnRegisterWordStable(){
  try{
    const word=tnMakeWordFromAddForm();
    db.words = db.words || [];
    db.words.push(word);

    // Local save first. No old save()/render() dependency.
    tnStablePersist();
    tnStableUpdateCounts();

    // Refresh visible list only if safe.
    try{ if(typeof renderWords==="function")renderWords(); }catch(e){console.warn("renderWords skipped",e);}
    try{ if(typeof renderHome==="function")renderHome(); }catch(e){console.warn("renderHome skipped",e);tnStableUpdateCounts();}

    tnClearAddForm();
    tnStableNotify("1 word added");

    // Cloud save, no blocking.
    if(typeof tnScheduleCloudSave==="function"){
      tnScheduleCloudSave();
    }else if(typeof tnNoEmailSaveCloud==="function"){
      tnNoEmailSaveCloud().then(ok=>{if(ok)tnStableNotify("Saved to cloud");});
    }
  }catch(e){
    console.error("Add Word error:",e);
    tnStableNotify(e.message || "Add Word error");
    let box=document.getElementById("addWordError");
    if(!box){
      const btn=document.getElementById("addWordBtn");
      box=document.createElement("div");
      box.id="addWordError";
      box.className="gate-message error add-error";
      btn?.parentElement?.appendChild(box);
    }
    if(box)box.textContent=e.message || "Add Word error";
  }
}

// Override old functions if buttons or old code call them.
addWord = tnRegisterWordStable;
registerWord = tnRegisterWordStable;

function tnBindAddWordButtonStable(){
  const btn=document.getElementById("addWordBtn") || [...document.querySelectorAll("button")].find(b=>(b.textContent||"").trim()==="+ Register");
  if(btn){
    btn.id="addWordBtn";
    btn.onclick=(e)=>{e.preventDefault();tnRegisterWordStable();return false;};
  }
}
setTimeout(tnBindAddWordButtonStable,50);
setTimeout(tnBindAddWordButtonStable,500);
setTimeout(tnBindAddWordButtonStable,1500);



/* =========================================================
   Beta62 True Login Gate
   Login screen is not a normal layer anymore.
   It appears only when there is no remembered sync account / guest mode.
========================================================= */

function tnHasSavedSession(){
  try{
    return !!(
      localStorage.getItem("tangonest_sync_email_v1") &&
      localStorage.getItem("tangonest_sync_hash_v1")
    );
  }catch(e){return false;}
}

function tnIsGuestMode(){
  try{return localStorage.getItem("tangonest_guest_mode")==="1";}catch(e){return false;}
}

function tnGateApplyState(){
  const has=tnHasSavedSession() || tnIsGuestMode();
  document.documentElement.classList.toggle("tn-has-session",has);
  document.documentElement.classList.toggle("tn-needs-auth",!has);
  document.body?.classList.toggle("tn-logged-in",has);
  const gate=document.getElementById("loginGate");
  if(gate){
    gate.classList.toggle("hidden",has);
    gate.setAttribute("aria-hidden",has?"true":"false");
  }
}

function tnShowApp(){
  document.documentElement.classList.add("tn-has-session");
  document.documentElement.classList.remove("tn-needs-auth");
  document.body?.classList.add("tn-logged-in");
  const gate=document.getElementById("loginGate");
  if(gate){
    gate.classList.add("hidden");
    gate.setAttribute("aria-hidden","true");
  }
}

function tnShowLogin(){
  document.documentElement.classList.remove("tn-has-session");
  document.documentElement.classList.add("tn-needs-auth");
  document.body?.classList.remove("tn-logged-in");
  const gate=document.getElementById("loginGate");
  if(gate){
    gate.classList.remove("hidden");
    gate.setAttribute("aria-hidden","false");
  }
}

function tnNoEmailShowApp(){tnShowApp();}
function tnNoEmailShowLogin(){tnShowLogin();}

// Override the maintenance function from older builds.
function tnMaintainNoEmailGate(){
  if(tnHasSavedSession() || tnIsGuestMode()) tnShowApp();
  else tnShowLogin();
}

// Strong boot behavior.
function tnBootGateOnly(){
  tnGateApplyState();
}
setTimeout(tnBootGateOnly,0);
setTimeout(tnBootGateOnly,100);
setTimeout(tnBootGateOnly,600);

// After login/signup, old functions call tnRememberAccount. Ensure it hides login immediately.
if(typeof tnRememberAccount==="function" && !tnRememberAccount.__beta62Wrapped){
  const oldRememberBeta62=tnRememberAccount;
  tnRememberAccount=function(email,hash){
    oldRememberBeta62(email,hash);
    tnShowApp();
  };
  tnRememberAccount.__beta62Wrapped=true;
}

// After logout, force login page.
if(typeof logoutTangoNest==="function" && !logoutTangoNest.__beta62Wrapped){
  const oldLogoutBeta62=logoutTangoNest;
  logoutTangoNest=async function(){
    try{await oldLogoutBeta62();}catch(e){console.warn(e);}
    tnShowLogin();
  };
  logoutTangoNest.__beta62Wrapped=true;
}

// If the user is remembered, do not let older Supabase Auth listeners bring the login gate back.
setInterval(()=>{
  if(tnHasSavedSession() || tnIsGuestMode()) tnShowApp();
},1000);



/* =========================================================
   Beta64 CRITICAL Add Word + Default Language Fix
   This is the final Add Word path. It does not depend on old addWord/save/render.
========================================================= */

function tn64$(id){ return document.getElementById(id); }
function tn64Val(id){ return (tn64$(id)?.value ?? "").trim(); }
function tn64SetValue(id,val){
  const el=tn64$(id);
  if(!el)return;
  if(el.tagName==="SELECT"){
    const opt=[...el.options].find(o=>o.value===val);
    if(opt)el.value=val;
  }else{
    el.value=val;
  }
}
function tn64Toast(msg){
  const t=tn64$("toast");
  if(t){
    t.textContent=msg;
    t.classList.add("show");
    setTimeout(()=>t.classList.remove("show"),1700);
  }else{
    console.log("[TangoNest]",msg);
  }
}
function tn64Id(){ return "w_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2); }
function tn64TodayPlus(n){
  const d=new Date();
  d.setDate(d.getDate()+n);
  return d.toISOString().slice(0,10);
}
function tn64Persist(){
  try{
    if(typeof KEY!=="undefined") tnWriteData(db);
    else localStorage.setItem("tangonest_data", JSON.stringify(db));
  }catch(e){
    console.error("localStorage save failed",e);
    throw new Error("Local save failed");
  }
}
function tn64UpdateCounts(){
  const words=db.words||[];
  const lists=db.lists||[];
  const learned=words.filter(w=>w.status==="learned").length;
  const hard=words.filter(w=>w.status==="hard").length;
  const set=(id,val)=>{ const el=tn64$(id); if(el)el.textContent=val; };
  ["wc","totalWords","dashTotal","heroWords"].forEach(id=>set(id,words.length));
  ["listCount","totalLists","heroLists"].forEach(id=>set(id,lists.length));
  ["lc","totalLearned","heroLearned"].forEach(id=>set(id,learned));
  ["hc","totalHard","dashHard"].forEach(id=>set(id,hard));
}
function tn64EnsureEnglishJapaneseDefaults(){
  // Only default form selectors. Existing words/playlists are not touched.
  if(db){
    db.prefs=db.prefs||{};
    db.prefs.frontLang="en-US";
    db.prefs.backLang="ja-JP";
  }
  tn64SetValue("frontLang","en-US");
  tn64SetValue("backLang","ja-JP");
  tn64SetValue("bulkFrontLang","en-US");
  tn64SetValue("bulkBackLang","ja-JP");
  const front=tn64$("front"); if(front)front.placeholder="word";
  const back=tn64$("back"); if(back)back.placeholder="meaning";
  const memo=tn64$("memo"); if(memo)memo.placeholder="Example sentence or memo.";
  const bulk=tn64$("bulkText");
  if(bulk)bulk.placeholder="front word\tback meaning\tPOS\tgender\texample sentence";
  try{ tn64Persist(); }catch(e){}
}
function tn64ClearAddFields(){
  ["front","back","memo","tags"].forEach(id=>{ const el=tn64$(id); if(el)el.value=""; });
  const pos=tn64$("pos"); if(pos)pos.value="";
  const gender=tn64$("gender"); if(gender)gender.value="";
  tn64EnsureEnglishJapaneseDefaults();
}
function tn64MakeWord(){
  const front=tn64Val("front");
  const back=tn64Val("back");
  if(!front || !back){
    throw new Error("Front and Back are required.");
  }
  let listId=tn64$("addList")?.value;
  if(!listId){
    listId=(db.lists&&db.lists[0]&&db.lists[0].id) || "starter";
  }
  if(!db.lists || !db.lists.length){
    db.lists=[{id:"starter",name:"New Playlist"}];
    listId="starter";
  }
  return {
    id:tn64Id(),
    front,
    back,
    frontLang:detectLang(front,tn64$("frontLang")?.value || "en-US"),
    backLang:detectLang(back,tn64$("backLang")?.value || "ja-JP"),
    listId,
    pos:tn64$("pos")?.value || "",
    gender:tn64$("gender")?.value || "",
    tags:tn64Val("tags"),
    memo:tn64Val("memo"),
    saved:false,
    status:"new",
    seen:0,
    level:1,
    nextReview:tn64TodayPlus(1),
    createdAt:new Date().toISOString()
  };
}
async function tn64CloudSaveNonBlocking(){
  try{
    if(typeof tnScheduleCloudSave==="function"){
      tnScheduleCloudSave();
      return;
    }
    if(typeof tnNoEmailSaveCloud==="function"){
      const ok=await tnNoEmailSaveCloud();
      if(ok)tn64Toast("Saved to cloud");
      return;
    }
  }catch(e){
    console.warn("cloud save skipped",e);
  }
}
function tnRegisterWordCritical(ev){
  if(ev && ev.preventDefault)ev.preventDefault();
  try{
    if(!db)throw new Error("Data is not ready");
    db.words=db.words||[];
    db.lists=db.lists&&db.lists.length?db.lists:[{id:"starter",name:"New Playlist"}];

    const word=tn64MakeWord();
    db.words.push(word);

    // Direct local save first. This is the critical part.
    tn64Persist();
    tn64UpdateCounts();

    // Try safe visual refresh, but do not depend on it.
    try{ if(typeof renderSelect==="function")renderSelect("wordListSelect",true); }catch(e){}
    try{ if(typeof renderWords==="function")renderWords(); }catch(e){ console.warn("renderWords skipped",e); }
    try{ if(typeof renderHome==="function")renderHome(); }catch(e){ console.warn("renderHome skipped",e); tn64UpdateCounts(); }

    tn64ClearAddFields();
    tn64Toast("1 word added");
    tn64CloudSaveNonBlocking();
    return false;
  }catch(e){
    console.error("CRITICAL Add Word error:",e);
    tn64Toast(e.message || "Add Word error");
    let box=tn64$("addWordError");
    if(!box){
      box=document.createElement("div");
      box.id="addWordError";
      box.className="gate-message error add-error";
      const btn=tn64$("addWordBtn") || [...document.querySelectorAll("button")].find(b=>(b.textContent||"").includes("Register"));
      (btn?.parentElement || document.body).appendChild(box);
    }
    box.textContent=e.message || "Add Word error";
    return false;
  }
}

// Force old function names and inline handlers to the critical path.
window.tnRegisterWordCritical=tnRegisterWordCritical;
window.addWord=tnRegisterWordCritical;
window.registerWord=tnRegisterWordCritical;

function tn64BindCriticalAddButton(){
  const btn=tn64$("addWordBtn") || [...document.querySelectorAll("button")].find(b=>(b.textContent||"").trim()==="＋ Register" || (b.textContent||"").trim()==="+ Register");
  if(btn){
    btn.id="addWordBtn";
    btn.type="button";
    btn.onclick=tnRegisterWordCritical;
  }
}
function tn64BootDefaultsAndButtons(){
  tn64EnsureEnglishJapaneseDefaults();
  tn64BindCriticalAddButton();
}
setTimeout(tn64BootDefaultsAndButtons,0);
setTimeout(tn64BootDefaultsAndButtons,200);
setTimeout(tn64BootDefaultsAndButtons,900);
setTimeout(tn64BootDefaultsAndButtons,1800);

// If render/fillLangSelects resets the selectors, put them back to English/Japanese.
if(typeof fillLangSelects==="function" && !fillLangSelects.__beta64Wrapped){
  const oldFillLangSelects64=fillLangSelects;
  fillLangSelects=function(){
    oldFillLangSelects64();
    tn64EnsureEnglishJapaneseDefaults();
  };
  fillLangSelects.__beta64Wrapped=true;
}
if(typeof render==="function" && !render.__beta64DefaultWrapped){
  const oldRender64=render;
  render=function(){
    oldRender64();
    tn64EnsureEnglishJapaneseDefaults();
    tn64BindCriticalAddButton();
  };
  render.__beta64DefaultWrapped=true;
}


/* Beta73 Emergency Click Fix loaded inline in index.html */



/* Beta74 Cloud Sync Direct Fix */
window.TN_SUPABASE_URL = window.TN_SUPABASE_URL || "https://bkbteylavujkfiwuqwdq.supabase.co";
window.TN_SUPABASE_KEY = window.TN_SUPABASE_KEY || "sb_publishable_UKX5qCXkbIRac4cc62_LXw_yEGDG6BZ";
window.tn74GetSupabase = window.tn74GetSupabase || function(){
  try{
    if(window.tnSupabaseClient && window.tnSupabaseClient.rpc)return window.tnSupabaseClient;
    if(window.supabase && window.supabase.createClient){
      window.tnSupabaseClient = window.supabase.createClient(window.TN_SUPABASE_URL, window.TN_SUPABASE_KEY);
      window.sb = window.tnSupabaseClient;
      window.supabaseClient = window.tnSupabaseClient;
      return window.tnSupabaseClient;
    }
  }catch(e){console.error("Supabase direct init failed",e);}
  return null;
};
setTimeout(()=>window.tn74GetSupabase&&window.tn74GetSupabase(),0);
setTimeout(()=>window.tn74GetSupabase&&window.tn74GetSupabase(),500);



/* =========================================================
   Beta75 Sync + Library + Playlist Fix
   Fixes:
   - Rename playlist
   - Library updates immediately after Add Word
   - Manual/auto cloud sync between PC and phone
========================================================= */

function tn75Key(){
  try{ if(typeof KEY !== "undefined") return KEY; }catch(e){}
  return "tangonest_data";
}
function tn75Email(){
  try{return localStorage.getItem("tangonest_sync_email_v1")||"";}catch(e){return "";}
}
function tn75Hash(){
  try{return localStorage.getItem("tangonest_sync_hash_v1")||"";}catch(e){return "";}
}
function tn75HasSession(){return !!(tn75Email()&&tn75Hash());}
function tn75EnsureDb(){
  try{
    if(typeof db==="undefined" || !db) window.db={lists:[],words:[],prefs:{}};
  }catch(e){}
  db.lists=db.lists||[];
  db.words=db.words||[];
  db.mistakes=Array.isArray(db.mistakes)?db.mistakes:[];
  db.prefs=db.prefs||{};
  if(!db.lists.length)db.lists.push({id:"starter",name:"New Playlist"});
}
function tn75Persist(){
  tn75EnsureDb();
  localStorage.setItem(tn75Key(), JSON.stringify(db));
}
function tn75Toast(msg){
  try{ if(typeof tn64Toast==="function") return tn64Toast(msg); }catch(e){}
  const t=document.getElementById("toast");
  if(t){t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1600);}
  else console.log("[TangoNest]",msg);
}
function tn75SafeRender(){
  try{ if(typeof renderSelect==="function"){renderSelect("addList",false);renderSelect("wordListSelect",true);renderSelect("quizList",true);renderSelect("audioList",true);} }catch(e){}
  try{ if(typeof renderWords==="function")renderWords(); }catch(e){console.warn(e);}
  try{ if(typeof renderHome==="function")renderHome(); }catch(e){}
  try{ if(typeof render==="function"){} }catch(e){}
  tn75RenderLibraryNow();
  tn75UpdateCounts();
}
function tn75UpdateCounts(){
  tn75EnsureDb();
  const words=db.words||[], lists=db.lists||[];
  const learned=words.filter(w=>w.status==="learned").length;
  const hard=words.filter(w=>w.status==="hard").length;
  const set=(id,v)=>{const el=document.getElementById(id); if(el)el.textContent=v;};
  ["wc","totalWords","dashTotal","heroWords"].forEach(id=>set(id,words.length));
  ["listCount","totalLists","heroLists"].forEach(id=>set(id,lists.length));
  ["lc","totalLearned","heroLearned"].forEach(id=>set(id,learned));
  ["hc","totalHard","dashHard"].forEach(id=>set(id,hard));
}

/* Immediate Library rendering */
function tn75ListName(id){
  const l=(db.lists||[]).find(x=>x.id===id);
  return l?l.name:"New Playlist";
}
function tn75RenderLibraryNow(){
  tn75EnsureDb();
  const possible=[
    document.getElementById("wordsTable"),
    document.getElementById("wordTable"),
    document.getElementById("libraryTable"),
    document.getElementById("wordsList"),
    document.getElementById("libraryList"),
    document.querySelector("#pageWords table tbody"),
    document.querySelector("#pageLibrary table tbody"),
    document.querySelector("[data-page='library'] table tbody")
  ].filter(Boolean);

  // Do not destroy unknown layout if old renderWords handles it.
  // But if there is a clear list/table, update it directly.
  const target=possible[0];
  if(!target)return;

  const words=db.words||[];
  if(target.tagName==="TBODY"){
    target.innerHTML=words.map(w=>`
      <tr>
        <td><strong>${tn75Esc(w.front||"")}</strong><div class="muted">${tn75Esc(w.frontLang||"")}</div></td>
        <td>${tn75Esc(w.back||"")}<div class="muted">${tn75Esc(w.backLang||"")}</div></td>
        <td>${tn75Esc(tn75ListName(w.listId))}</td>
        <td>${tn75Esc(w.pos||"")}</td>
      </tr>
    `).join("");
  }else{
    target.innerHTML=words.map(w=>`
      <div class="tn75-word-row">
        <div><strong>${tn75Esc(w.front||"")}</strong><div class="muted">${tn75Esc(tn75ListName(w.listId))}</div></div>
        <div>${tn75Esc(w.back||"")}</div>
      </div>
    `).join("");
  }
}
function tn75Esc(s){
  return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

/* Playlist rename UI */
function tn75RenderPlaylistRenameBox(){
  document.getElementById("tn75PlaylistBox")?.remove();
}
function tn75RefreshPlaylistBox(){
  document.getElementById("tn75PlaylistBox")?.remove();
  return;
  const rows=document.getElementById("tn75PlaylistRows");
  if(!rows)return;
  tn75EnsureDb();
  rows.innerHTML=db.lists.map(l=>`
    <div class="tn75-playlist-row">
      <input class="tn75-playlist-input" data-list-id="${tn75Esc(l.id)}" value="${tn75Esc(l.name||"New Playlist")}">
      <button type="button" class="tn75-rename-btn" data-list-id="${tn75Esc(l.id)}">Save</button>
    </div>
  `).join("");
  rows.querySelectorAll(".tn75-rename-btn").forEach(btn=>{
    btn.onclick=()=>{
      const id=btn.dataset.listId;
      const input=rows.querySelector(`.tn75-playlist-input[data-list-id="${CSS.escape(id)}"]`);
      tn75RenamePlaylist(id,input?.value||"");
    };
  });
  rows.querySelectorAll(".tn75-playlist-input").forEach(input=>{
    input.addEventListener("keydown",e=>{
      if(e.key==="Enter")tn75RenamePlaylist(input.dataset.listId,input.value);
    });
  });
}
function tn75RenamePlaylist(id,name){
  tn75EnsureDb();
  name=(name||"").trim();
  if(!name){tn75Toast("Playlist name is required");return;}
  const list=db.lists.find(l=>l.id===id);
  if(!list){tn75Toast("Playlist not found");return;}
  list.name=name;
  tn75Persist();
  tn75SafeRender();
  tn75CloudSaveSoon();
  tn75Toast("Playlist renamed");
}

/* Cloud sync */
function tn75Supabase(){
  try{ if(window.tn74GetSupabase){const x=window.tn74GetSupabase(); if(x&&x.rpc)return x;} }catch(e){}
  try{ if(window.tnSupabaseClient?.rpc)return window.tnSupabaseClient; }catch(e){}
  try{ if(window.supabaseClient?.rpc)return window.supabaseClient; }catch(e){}
  try{ if(window.sb?.rpc)return window.sb; }catch(e){}
  try{ if(typeof supabaseClient!=="undefined"&&supabaseClient.rpc)return supabaseClient; }catch(e){}
  try{ if(typeof sb!=="undefined"&&sb.rpc)return sb; }catch(e){}
  return null;
}
async function tn75CloudSave(){
  if(!tn75HasSession())return false;
  const s=tn75Supabase();
  if(!s){tn75Toast("Cloud is loading. Try again in 2 seconds."); return false;}
  tn75EnsureDb();
  const {data,error}=await s.rpc("tn_save",{p_email:tn75Email(),p_password_hash:tn75Hash(),p_data:db});
  if(error){console.error(error);tn75Toast("Cloud save failed");return false;}
  tn75Toast("Synced ✓");
  return true;
}
async function tn75CloudLoad(){
  if(!tn75HasSession())return false;
  const s=tn75Supabase();
  if(!s){tn75Toast("Cloud is loading. Try again in 2 seconds.");return false;}
  const {data,error}=await s.rpc("tn_login",{p_email:tn75Email(),p_password_hash:tn75Hash()});
  if(error || !data || data.ok===false){console.error(error||data);tn75Toast("Cloud load failed");return false;}
  if(data.data){
    tnSafeApplyCloudData(data.data,"tn75-cloud-load");
    tn75Persist();
    tn75SafeRender();
    tn75Toast("Loaded from cloud ✓");
    return true;
  }
  return false;
}
let tn75CloudTimer=null;
function tn75CloudSaveSoon(){
  clearTimeout(tn75CloudTimer);
  tn75CloudTimer=setTimeout(()=>tn75CloudSave().catch(console.error),700);
}
function tn75AddSyncButton(){
  if(document.getElementById("tn75SyncBtn"))return;
  const nav=document.querySelector("nav")||document.querySelector(".tabs")||document.querySelector("header")||document.body;
  const btn=document.createElement("button");
  btn.id="tn75SyncBtn";
  btn.className="tn75-sync-btn";
  btn.type="button";
  btn.textContent="Sync now";
  btn.onclick=()=>tn75CloudLoad();
  nav.appendChild(btn);
}

/* Wrap Add Word so Library updates instantly and cloud saves */
function tn75WrapAdd(){
  const old = window.tnRegisterWordCritical || window.addWord || window.registerWord;
  if(typeof old==="function" && !old.__tn75Wrapped){
    const wrapped=function(ev){
      const res=old(ev);
      setTimeout(()=>{
        tn75Persist();
        tn75SafeRender();
        tn75CloudSaveSoon();
      },50);
      setTimeout(tn75SafeRender,300);
      return res;
    };
    wrapped.__tn75Wrapped=true;
    window.tnRegisterWordCritical=wrapped;
    window.addWord=wrapped;
    window.registerWord=wrapped;
    const btn=document.getElementById("addWordBtn") || [...document.querySelectorAll("button")].find(b=>(b.textContent||"").includes("Register"));
    if(btn)btn.onclick=wrapped;
  }
}

/* Defaults fixed again */
function tn75ForceDefaults(){
  const set=(id,v)=>{const el=document.getElementById(id); if(el && [...el.options||[]].some(o=>o.value===v))el.value=v;};
  set("frontLang","en-US");
  set("backLang","ja-JP");
  set("bulkFrontLang","en-US");
  set("bulkBackLang","ja-JP");
  try{db.prefs=db.prefs||{};db.prefs.frontLang="en-US";db.prefs.backLang="ja-JP";}catch(e){}
}

function tn75Boot(){
  tn75EnsureDb();
  tn75WrapAdd();
  tn75ForceDefaults();
  tn75SafeRender();
  tn75AddSyncButton();
  tn75RenderPlaylistRenameBox();
  if(tn75HasSession()){
    setTimeout(()=>tn75CloudLoad().catch(console.error),800);
  }
}
setTimeout(tn75Boot,0);
setTimeout(tn75Boot,500);
setTimeout(tn75Boot,1500);
setInterval(()=>{
  tn75WrapAdd();
  tn75ForceDefaults();
  tn75AddSyncButton();
},2000);
window.tn75CloudSave=tn75CloudSave;
window.tn75CloudLoad=tn75CloudLoad;
window.tn75RenamePlaylist=tn75RenamePlaylist;



/* =========================================================
   Beta76 Auto Sync Final
   Goal:
   - Phone Add Word -> cloud save immediately.
   - PC automatically detects newer cloud data.
   - Library updates without pressing Sync now.
   - Conflict rule: latest updated_at wins.
========================================================= */

const TN76_SYNC_POLL_MS = 4000;
let tn76LastCloudUpdatedAt = localStorage.getItem("tangonest_last_cloud_updated_at_v1") || "";
let tn76Saving = false;
let tn76Loading = false;
let tn76PendingSaveTimer = null;

function tn76Email(){
  try{return localStorage.getItem("tangonest_sync_email_v1")||"";}catch(e){return "";}
}
function tn76Hash(){
  try{return localStorage.getItem("tangonest_sync_hash_v1")||"";}catch(e){return "";}
}
function tn76HasSession(){return !!(tn76Email()&&tn76Hash());}
function tn76Key(){
  try{ if(typeof KEY !== "undefined")return KEY; }catch(e){}
  return "tangonest_data";
}
function tn76EnsureDb(){
  try{ if(typeof db==="undefined" || !db) window.db={lists:[],words:[],prefs:{}}; }catch(e){}
  db.lists=db.lists||[];
  db.words=db.words||[];
  db.mistakes=Array.isArray(db.mistakes)?db.mistakes:[];
  db.prefs=db.prefs||{};
  if(!db.lists.length)db.lists.push({id:"starter",name:"New Playlist"});
}
function tn76Persist(){
  tn76EnsureDb();
  localStorage.setItem(tn76Key(),JSON.stringify(db));
}
function tn76Supabase(){
  try{ if(window.tn74GetSupabase){const x=window.tn74GetSupabase(); if(x&&x.rpc)return x;} }catch(e){}
  try{ if(window.tnSupabaseClient?.rpc)return window.tnSupabaseClient; }catch(e){}
  try{ if(window.supabaseClient?.rpc)return window.supabaseClient; }catch(e){}
  try{ if(window.sb?.rpc)return window.sb; }catch(e){}
  try{ if(typeof supabaseClient!=="undefined"&&supabaseClient.rpc)return supabaseClient; }catch(e){}
  try{ if(typeof sb!=="undefined"&&sb.rpc)return sb; }catch(e){}
  return null;
}
function tn76Toast(msg){
  try{ if(typeof tn75Toast==="function")return tn75Toast(msg); }catch(e){}
  try{ if(typeof tn64Toast==="function")return tn64Toast(msg); }catch(e){}
  const t=document.getElementById("toast");
  if(t){t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1500);}
  else console.log("[TangoNest]",msg);
}
function tn76UpdateStatus(text){
  let badge=document.getElementById("syncStatusBadge");
  if(!badge){
    badge=document.createElement("span");
    badge.id="syncStatusBadge";
    badge.className="sync-status-badge sync-status-fixed";
    document.body.appendChild(badge);
  }
  if(tn76HasSession()){
    badge.textContent=text || "Synced ✓";
    badge.classList.add("synced");
    badge.classList.remove("local");
    badge.title=tn76Email();
  }else{
    badge.textContent="Local";
    badge.classList.add("local");
    badge.classList.remove("synced");
    badge.title="";
  }
}
function tn76RenderEverywhere(){
  tn76EnsureDb();
  try{ if(typeof tn75SafeRender==="function")tn75SafeRender(); }catch(e){}
  try{ if(typeof renderSelect==="function"){renderSelect("addList",false);renderSelect("wordListSelect",true);renderSelect("quizList",true);renderSelect("audioList",true);} }catch(e){}
  try{ if(typeof renderWords==="function")renderWords(); }catch(e){}
  try{ if(typeof renderHome==="function")renderHome(); }catch(e){}
  try{ if(typeof tn75RenderLibraryNow==="function")tn75RenderLibraryNow(); }catch(e){}
  try{ if(typeof tn75UpdateCounts==="function")tn75UpdateCounts(); }catch(e){}
  tn76UpdateStatus();
}

/* Save local device changes to cloud immediately */
async function tn76CloudSave(reason="save"){
  if(!tn76HasSession())return false;
  if(tn76Saving)return false;
  const s=tn76Supabase();
  if(!s){tn76UpdateStatus("Cloud loading...");return false;}
  tn76Saving=true;
  tn76UpdateStatus("Saving...");
  try{
    tn76EnsureDb();
    db.meta=db.meta||{};
    db.meta.lastLocalSaveAt=new Date().toISOString();
    db.meta.lastDevice="browser";
    tn76Persist();

    const {data,error}=await s.rpc("tn_save",{
      p_email:tn76Email(),
      p_password_hash:tn76Hash(),
      p_data:db
    });
    if(error)throw error;

    const now=new Date().toISOString();
    tn76LastCloudUpdatedAt = data?.updated_at || now;
    localStorage.setItem("tangonest_last_cloud_updated_at_v1",tn76LastCloudUpdatedAt);
    tn76UpdateStatus("Synced ✓");
    return true;
  }catch(e){
    console.error("Auto cloud save failed",e);
    tn76UpdateStatus("Sync error");
    return false;
  }finally{
    tn76Saving=false;
  }
}
function tn76CloudSaveSoon(reason="change"){
  clearTimeout(tn76PendingSaveTimer);
  tn76PendingSaveTimer=setTimeout(()=>tn76CloudSave(reason),350);
}

/* Load cloud if newer/different */
async function tn76CloudLoad({silent=true, force=false}={}){
  if(!tn76HasSession())return false;
  if(tn76Loading || tn76Saving)return false;
  const s=tn76Supabase();
  if(!s){tn76UpdateStatus("Cloud loading...");return false;}
  tn76Loading=true;
  if(!silent)tn76UpdateStatus("Loading...");
  try{
    const {data,error}=await s.rpc("tn_login",{
      p_email:tn76Email(),
      p_password_hash:tn76Hash()
    });
    if(error)throw error;
    if(!data || data.ok===false)throw new Error(data?.error||"Cloud login failed");

    const cloudUpdated=data.updated_at || "";
    const shouldApply = force || (cloudUpdated && cloudUpdated !== tn76LastCloudUpdatedAt);

    if(shouldApply && data.data){
      const localJson=JSON.stringify(db||{});
      const cloudJson=JSON.stringify(data.data||{});
      if(force || localJson !== cloudJson){
        tnSafeApplyCloudData(data.data,"tn76-cloud-load");
        tn76Persist();
        tn76RenderEverywhere();
        if(!silent)tn76Toast("Loaded from cloud ✓");
      }
      tn76LastCloudUpdatedAt=cloudUpdated || new Date().toISOString();
      localStorage.setItem("tangonest_last_cloud_updated_at_v1",tn76LastCloudUpdatedAt);
    }
    tn76UpdateStatus("Synced ✓");
    return true;
  }catch(e){
    console.error("Auto cloud load failed",e);
    tn76UpdateStatus("Sync error");
    return false;
  }finally{
    tn76Loading=false;
  }
}

/* Wrap all likely mutation points */
function tn76WrapAddWord(){
  const original = window.tnRegisterWordCritical || window.addWord || window.registerWord;
  if(typeof original==="function" && !original.__tn76Wrapped){
    const wrapped=function(ev){
      const res=original(ev);
      setTimeout(()=>{
        tn76Persist();
        tn76RenderEverywhere();
        tn76CloudSaveSoon("add-word");
      },50);
      setTimeout(tn76RenderEverywhere,250);
      return res;
    };
    wrapped.__tn76Wrapped=true;
    window.tnRegisterWordCritical=wrapped;
    window.addWord=wrapped;
    window.registerWord=wrapped;
    const btn=document.getElementById("addWordBtn") || [...document.querySelectorAll("button")].find(b=>(b.textContent||"").includes("Register"));
    if(btn)btn.onclick=wrapped;
  }
}
function tn76WrapPlaylistRename(){
  if(typeof window.tn75RenamePlaylist==="function" && !window.tn75RenamePlaylist.__tn76Wrapped){
    const old=window.tn75RenamePlaylist;
    window.tn75RenamePlaylist=function(id,name){
      const res=old(id,name);
      setTimeout(()=>{
        tn76Persist();
        tn76RenderEverywhere();
        tn76CloudSaveSoon("playlist-rename");
      },50);
      return res;
    };
    window.tn75RenamePlaylist.__tn76Wrapped=true;
  }
}

/* Detect localStorage changes in another tab, and refresh */
window.addEventListener("storage",(e)=>{
  if(e.key===tn76Key()){
    try{
      Object.assign(db,JSON.parse(e.newValue||"{}"));
      tn76RenderEverywhere();
    }catch(err){}
  }
});

/* Auto polling for phone -> PC and PC -> phone */
function tn76StartAutoSync(){
  if(window.__tn76AutoSyncStarted)return;
  window.__tn76AutoSyncStarted=true;

  // First load after login/reload.
  setTimeout(()=>tn76CloudLoad({silent:true,force:true}),1000);

  setInterval(()=>{
    if(document.visibilityState==="visible" && tn76HasSession()){
      tn76CloudLoad({silent:true,force:false});
    }
  },TN76_SYNC_POLL_MS);

  window.addEventListener("focus",()=>{
    if(tn76HasSession())tn76CloudLoad({silent:true,force:false});
  });

  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="visible" && tn76HasSession()){
      tn76CloudLoad({silent:true,force:false});
    }
  });

  // Before leaving, try to save recent changes.
  window.addEventListener("beforeunload",()=>{
    try{
      if(tn76HasSession()){
        tn76Persist();
        // Async may not finish, but normal add already saved earlier.
        tn76CloudSaveSoon("beforeunload");
      }
    }catch(e){}
  });
}

/* Manual button remains, but auto sync is primary */
function tn76AddAutoSyncLabel(){
  const btn=document.getElementById("tn75SyncBtn");
  if(btn){
    btn.textContent="Sync now";
    btn.onclick=()=>tn76CloudLoad({silent:false,force:true});
  }
}

function tn76Boot(){
  tn76EnsureDb();
  tn76WrapAddWord();
  tn76WrapPlaylistRename();
  tn76RenderEverywhere();
  tn76StartAutoSync();
  tn76AddAutoSyncLabel();
  tn76UpdateStatus();
}
setTimeout(tn76Boot,0);
setTimeout(tn76Boot,500);
setTimeout(tn76Boot,1500);
setInterval(()=>{
  tn76WrapAddWord();
  tn76WrapPlaylistRename();
  tn76AddAutoSyncLabel();
},2000);

window.tn76CloudSave=tn76CloudSave;
window.tn76CloudLoad=tn76CloudLoad;



/* =========================================================
   Beta77 Logout Button
   Adds a clear logout button.
========================================================= */

function tn77HasSession(){
  try{
    return !!(
      localStorage.getItem("tangonest_sync_email_v1") &&
      localStorage.getItem("tangonest_sync_hash_v1")
    );
  }catch(e){return false;}
}

function tn77Logout(){
  if(!confirm("Log out of TangoNest?")) return;

  try{
    localStorage.removeItem("tangonest_sync_email_v1");
    localStorage.removeItem("tangonest_sync_hash_v1");
    localStorage.removeItem("tangonest_sync_mode_v1");
    localStorage.removeItem("tangonest_last_cloud_updated_at_v1");
    localStorage.removeItem("tangonest_guest_mode");
  }catch(e){}

  // Return to the emergency login screen if available.
  if(typeof tn73ShowAuth==="function"){
    tn73ShowAuth();
  }else if(typeof tnOpenLoginGate==="function"){
    tnOpenLoginGate();
  }else{
    location.reload();
  }
}

function tn77AddLogoutButton(){
  let btn=document.getElementById("tn77LogoutBtn");
  if(!btn){
    btn=document.createElement("button");
    btn.id="tn77LogoutBtn";
    btn.className="tn77-logout-btn";
    btn.type="button";
    btn.textContent="Log out";
    btn.onclick=tn77Logout;

    const badge=document.getElementById("syncStatusBadge");
    if(badge && badge.parentElement){
      badge.insertAdjacentElement("afterend", btn);
    }else{
      document.body.appendChild(btn);
    }
  }

  btn.style.display = tn77HasSession() ? "inline-flex" : "none";
}

function tn77UpdateLogoutButton(){
  tn77AddLogoutButton();
  const btn=document.getElementById("tn77LogoutBtn");
  if(btn)btn.style.display = tn77HasSession() ? "inline-flex" : "none";
}

setTimeout(tn77UpdateLogoutButton,0);
setTimeout(tn77UpdateLogoutButton,500);
setTimeout(tn77UpdateLogoutButton,1500);
setInterval(tn77UpdateLogoutButton,1200);

window.tn77Logout=tn77Logout;



/* =========================================================
   Beta78 Cloud Status Visible
   Shows whether PC and phone are using the same cloud account.
========================================================= */

function tn78Email(){
  try{return localStorage.getItem("tangonest_sync_email_v1")||"";}catch(e){return "";}
}
function tn78Hash(){
  try{return localStorage.getItem("tangonest_sync_hash_v1")||"";}catch(e){return "";}
}
function tn78HasSession(){
  return !!(tn78Email() && tn78Hash());
}
function tn78DeviceId(){
  let id=localStorage.getItem("tangonest_device_id_v1");
  if(!id){
    id="device_"+Math.random().toString(36).slice(2,8)+"_"+Date.now().toString(36).slice(-4);
    localStorage.setItem("tangonest_device_id_v1",id);
  }
  return id;
}
function tn78Supabase(){
  try{ if(window.tn74GetSupabase){const x=window.tn74GetSupabase(); if(x&&x.rpc)return x;} }catch(e){}
  try{ if(window.tnSupabaseClient?.rpc)return window.tnSupabaseClient; }catch(e){}
  try{ if(window.supabaseClient?.rpc)return window.supabaseClient; }catch(e){}
  try{ if(window.sb?.rpc)return window.sb; }catch(e){}
  try{ if(typeof supabaseClient!=="undefined"&&supabaseClient.rpc)return supabaseClient; }catch(e){}
  try{ if(typeof sb!=="undefined"&&sb.rpc)return sb; }catch(e){}
  return null;
}
function tn78LocalWords(){
  try{
    if(typeof db!=="undefined" && db && Array.isArray(db.words))return db.words.length;
  }catch(e){}
  return 0;
}
function tn78LocalLists(){
  try{
    if(typeof db!=="undefined" && db && Array.isArray(db.lists))return db.lists.length;
  }catch(e){}
  return 0;
}
function tn78FormatTime(s){
  if(!s)return "-";
  try{
    const d=new Date(s);
    return d.toLocaleString();
  }catch(e){return s;}
}
function tn78CloudBox(){
  let box=document.getElementById("tn78CloudBox");
  if(box)return box;

  box=document.createElement("div");
  box.id="tn78CloudBox";
  box.className="tn78-cloud-box";
  box.innerHTML=`
    <div class="tn78-cloud-title">Cloud Status</div>
    <div class="tn78-cloud-sub">PCとスマホが同じクラウドを見ているか確認できます。</div>
    <div class="tn78-grid">
      <div class="tn78-item"><span>Account</span><strong id="tn78Account">-</strong></div>
      <div class="tn78-item"><span>Device</span><strong id="tn78Device">-</strong></div>
      <div class="tn78-item"><span>Local words</span><strong id="tn78LocalWords">0</strong></div>
      <div class="tn78-item"><span>Cloud words</span><strong id="tn78CloudWords">-</strong></div>
      <div class="tn78-item"><span>Local lists</span><strong id="tn78LocalLists">0</strong></div>
      <div class="tn78-item"><span>Cloud lists</span><strong id="tn78CloudLists">-</strong></div>
      <div class="tn78-item wide"><span>Cloud updated</span><strong id="tn78CloudUpdated">-</strong></div>
      <div class="tn78-item wide"><span>Status</span><strong id="tn78Status">Not checked</strong></div>
    </div>
    <div class="tn78-actions">
      <button id="tn78CheckBtn" type="button">Check cloud</button>
      <button id="tn78PullBtn" type="button">Load cloud now</button>
      <button id="tn78PushBtn" type="button">Save this device now</button>
    </div>
  `;

  const host =
    document.getElementById("pageSettings") ||
    document.getElementById("settings") ||
    document.querySelector("[data-page='settings']") ||
    document.querySelector("main") ||
    document.body;

  host.appendChild(box);

  document.getElementById("tn78CheckBtn").onclick=()=>tn78CheckCloud(false);
  document.getElementById("tn78PullBtn").onclick=()=>tn78LoadCloudVisible();
  document.getElementById("tn78PushBtn").onclick=()=>tn78SaveCloudVisible();

  return box;
}
function tn78Set(id,text){
  const el=document.getElementById(id);
  if(el)el.textContent=text;
}
function tn78UpdateLocalView(){
  tn78CloudBox();
  tn78Set("tn78Account", tn78Email() || "Not logged in");
  tn78Set("tn78Device", tn78DeviceId());
  tn78Set("tn78LocalWords", String(tn78LocalWords()));
  tn78Set("tn78LocalLists", String(tn78LocalLists()));
}
async function tn78CheckCloud(silent=true){
  tn78UpdateLocalView();
  if(!tn78HasSession()){
    tn78Set("tn78Status","Not logged in");
    return false;
  }
  const s=tn78Supabase();
  if(!s){
    tn78Set("tn78Status","Cloud client not ready");
    return false;
  }
  tn78Set("tn78Status","Checking...");
  try{
    const {data,error}=await s.rpc("tn_login",{
      p_email:tn78Email(),
      p_password_hash:tn78Hash()
    });
    if(error)throw error;
    if(!data || data.ok===false)throw new Error(data?.error||"Cloud check failed");

    const cloud=data.data||{};
    const words=Array.isArray(cloud.words)?cloud.words.length:0;
    const lists=Array.isArray(cloud.lists)?cloud.lists.length:0;

    tn78Set("tn78CloudWords",String(words));
    tn78Set("tn78CloudLists",String(lists));
    tn78Set("tn78CloudUpdated",tn78FormatTime(data.updated_at));
    tn78Set("tn78Status","Same cloud account ✓");

    localStorage.setItem("tangonest_last_cloud_updated_at_v1",data.updated_at||new Date().toISOString());

    if(!silent){
      try{tn75Toast?.("Cloud checked ✓");}catch(e){}
    }
    return true;
  }catch(e){
    console.error(e);
    tn78Set("tn78Status",e.message||"Cloud check failed");
    return false;
  }
}
async function tn78LoadCloudVisible(){
  tn78Set("tn78Status","Loading cloud...");
  try{
    if(typeof tn76CloudLoad==="function"){
      await tn76CloudLoad({silent:false,force:true});
    }else if(typeof tn75CloudLoad==="function"){
      await tn75CloudLoad();
    }
    tn78UpdateLocalView();
    await tn78CheckCloud(true);
    try{tn75Toast?.("Loaded cloud ✓");}catch(e){}
  }catch(e){
    console.error(e);
    tn78Set("tn78Status",e.message||"Load failed");
  }
}
async function tn78SaveCloudVisible(){
  tn78Set("tn78Status","Saving this device...");
  try{
    if(typeof tn76CloudSave==="function"){
      await tn76CloudSave("manual-visible");
    }else if(typeof tn75CloudSave==="function"){
      await tn75CloudSave();
    }
    await tn78CheckCloud(true);
    try{tn75Toast?.("Saved to cloud ✓");}catch(e){}
  }catch(e){
    console.error(e);
    tn78Set("tn78Status",e.message||"Save failed");
  }
}
function tn78AddHeaderSmall(){
  let mini=document.getElementById("tn78MiniCloud");
  if(!mini){
    mini=document.createElement("button");
    mini.id="tn78MiniCloud";
    mini.className="tn78-mini-cloud";
    mini.type="button";
    mini.textContent="Cloud";
    mini.onclick=()=>{
      try{ if(typeof go==="function")go("settings"); }catch(e){}
      setTimeout(()=>tn78CheckCloud(false),300);
    };
    const badge=document.getElementById("syncStatusBadge");
    if(badge && badge.parentElement)badge.insertAdjacentElement("afterend",mini);
    else document.body.appendChild(mini);
  }
}
function tn78Boot(){
  tn78CloudBox();
  tn78UpdateLocalView();
  tn78AddHeaderSmall();
  if(tn78HasSession()){
    setTimeout(()=>tn78CheckCloud(true),1200);
  }
}
setTimeout(tn78Boot,0);
setTimeout(tn78Boot,800);
setTimeout(tn78Boot,1800);
setInterval(()=>{
  tn78UpdateLocalView();
  tn78AddHeaderSmall();
},2500);

window.tn78CheckCloud=tn78CheckCloud;



/* =========================================================
   Beta79 Cloud Status Top Fix
   Cloud Status must be visible immediately at the top of Settings.
========================================================= */

function tn79FindSettingsPage(){
  return (
    document.getElementById("pageSettings") ||
    document.getElementById("settings") ||
    document.querySelector("[data-page='settings']") ||
    [...document.querySelectorAll(".page,section,main,div")].find(el=>{
      const txt=(el.textContent||"").slice(0,500).toLowerCase();
      return txt.includes("manage") && txt.includes("data transfer");
    }) ||
    document.querySelector(".page.active") ||
    document.body
  );
}

function tn79MoveCloudBoxToTop(){
  let box=document.getElementById("tn78CloudBox");

  // If Beta78 failed to create it, call it.
  try{
    if(!box && typeof tn78CloudBox==="function"){
      box=tn78CloudBox();
    }
  }catch(e){}

  if(!box)return;

  const host=tn79FindSettingsPage();
  if(!host)return;

  box.classList.add("tn79-cloud-top");

  // Insert near the top of Settings, before Data Transfer.
  const dataTransfer=[...host.querySelectorAll("h1,h2,h3,div,section")].find(el=>{
    return (el.textContent||"").trim().toLowerCase().startsWith("data transfer");
  });

  if(dataTransfer && dataTransfer.parentElement){
    dataTransfer.parentElement.insertBefore(box, dataTransfer);
  }else{
    // Put after first heading area if possible, otherwise first.
    const firstCard=host.querySelector(".card");
    if(firstCard && firstCard !== box){
      if(firstCard.parentElement === host)host.insertBefore(box, firstCard);
      else host.insertBefore(box, host.firstChild);
    }else{
      host.insertBefore(box, host.firstChild);
    }
  }

  box.style.display="block";
  box.style.visibility="visible";
  box.style.opacity="1";
}

function tn79AddCloudButtonTop(){
  let btn=document.getElementById("tn79CloudTopBtn");
  if(!btn){
    btn=document.createElement("button");
    btn.id="tn79CloudTopBtn";
    btn.className="tn79-cloud-top-btn";
    btn.type="button";
    btn.textContent="Cloud";
    btn.onclick=()=>{
      try{ if(typeof go==="function")go("settings"); }catch(e){}
      setTimeout(()=>{
        tn79MoveCloudBoxToTop();
        try{ if(typeof tn78CheckCloud==="function")tn78CheckCloud(false); }catch(e){}
      },200);
    };

    const settingsBtn=[...document.querySelectorAll("button,a")].find(el=>(el.textContent||"").trim().toLowerCase()==="settings");
    if(settingsBtn && settingsBtn.parentElement){
      settingsBtn.insertAdjacentElement("afterend",btn);
    }else{
      document.body.appendChild(btn);
    }
  }
}

function tn79Boot(){
  tn79AddCloudButtonTop();
  try{
    if(typeof tn78CloudBox==="function")tn78CloudBox();
  }catch(e){}
  tn79MoveCloudBoxToTop();
  try{
    if(typeof tn78UpdateLocalView==="function")tn78UpdateLocalView();
    if(typeof tn78CheckCloud==="function")tn78CheckCloud(true);
  }catch(e){}
}

setTimeout(tn79Boot,0);
setTimeout(tn79Boot,500);
setTimeout(tn79Boot,1500);
setInterval(()=>{
  tn79AddCloudButtonTop();
  if(document.querySelector(".active") || location.href){
    tn79MoveCloudBoxToTop();
  }
},2000);



/* =========================================================
   Beta80 Account / Cloud Sync Final
   Direct, visible, fixed implementation inside Settings.
========================================================= */

function tn80Email(){
  try{return localStorage.getItem("tangonest_sync_email_v1")||"";}catch(e){return "";}
}
function tn80Hash(){
  try{return localStorage.getItem("tangonest_sync_hash_v1")||"";}catch(e){return "";}
}
function tn80HasSession(){return !!(tn80Email() && tn80Hash());}

function tn80DeviceId(){
  let id=localStorage.getItem("tangonest_device_id_v1");
  if(!id){
    id="device_"+Math.random().toString(36).slice(2,8)+"_"+Date.now().toString(36).slice(-5);
    localStorage.setItem("tangonest_device_id_v1",id);
  }
  return id;
}

function tn80Key(){
  try{if(typeof KEY!=="undefined")return KEY;}catch(e){}
  return "tangonest_data";
}
function tn80EnsureDb(){
  try{if(typeof db==="undefined" || !db)window.db={lists:[],words:[],prefs:{}};}catch(e){}
  db.lists=db.lists||[];
  db.words=db.words||[];
  db.mistakes=Array.isArray(db.mistakes)?db.mistakes:[];
  db.prefs=db.prefs||{};
  if(!db.lists.length)db.lists.push({id:"starter",name:"New Playlist"});
}
function tn80Persist(){
  tn80EnsureDb();
  localStorage.setItem(tn80Key(),JSON.stringify(db));
}
function tn80Supabase(){
  try{if(window.tn74GetSupabase){const x=window.tn74GetSupabase(); if(x&&x.rpc)return x;}}catch(e){}
  try{if(window.tnSupabaseClient?.rpc)return window.tnSupabaseClient;}catch(e){}
  try{if(window.supabaseClient?.rpc)return window.supabaseClient;}catch(e){}
  try{if(window.sb?.rpc)return window.sb;}catch(e){}
  try{if(typeof supabaseClient!=="undefined"&&supabaseClient.rpc)return supabaseClient;}catch(e){}
  try{if(typeof sb!=="undefined"&&sb.rpc)return sb;}catch(e){}
  return null;
}
function tn80Set(id,text){
  const el=document.getElementById(id);
  if(el)el.textContent=text;
}
function tn80LocalWords(){
  try{return Array.isArray(db.words)?db.words.length:0;}catch(e){return 0;}
}
function tn80LocalLists(){
  try{return Array.isArray(db.lists)?db.lists.length:0;}catch(e){return 0;}
}
function tn80FormatTime(s){
  if(!s)return "-";
  try{return new Date(s).toLocaleString();}catch(e){return s;}
}
function tn80Toast(msg){
  try{if(typeof tn75Toast==="function")return tn75Toast(msg);}catch(e){}
  try{if(typeof tn64Toast==="function")return tn64Toast(msg);}catch(e){}
  console.log("[TangoNest]",msg);
}
function tn80RenderAll(){
  tn80EnsureDb();
  try{tn80Persist();}catch(e){}
  try{if(typeof renderSelect==="function"){renderSelect("addList",false);renderSelect("wordListSelect",true);renderSelect("quizList",true);renderSelect("audioList",true);}}catch(e){}
  try{if(typeof renderWords==="function")renderWords();}catch(e){}
  try{if(typeof renderHome==="function")renderHome();}catch(e){}
  try{if(typeof tn75SafeRender==="function")tn75SafeRender();}catch(e){}
  try{if(typeof tn75RenderLibraryNow==="function")tn75RenderLibraryNow();}catch(e){}
  try{if(typeof tn75UpdateCounts==="function")tn75UpdateCounts();}catch(e){}
  tn80UpdatePanelLocal();
}
function tn80UpdatePill(state,text){
  const pill=document.getElementById("tn80StatusPill");
  const header=document.getElementById("tn80HeaderCloud");
  const label="Sync";
  if(pill){
    pill.textContent=label;
    pill.className="tn80-status-pill "+(state|| (tn80HasSession()?"synced":"local"));
  }
  if(header){
    header.textContent="Cloud";
    header.classList.toggle("synced",tn80HasSession());
  }
}
function tn80UpdatePanelLocal(){
  tn80EnsureDb();
  tn80Set("tn80Account",tn80HasSession() ? "Signed in" : "Not logged in");
  tn80Set("tn80Device",tn80DeviceId());
  tn80Set("tn80LocalWords",String(tn80LocalWords()));
  tn80Set("tn80LocalLists",String(tn80LocalLists()));
  tn80UpdatePill(tn80HasSession()?"synced":"local");
  const logout=document.getElementById("tn80LogoutBtn");
  if(logout)logout.style.display=tn80HasSession()?"inline-flex":"none";
}

async function tn80CheckCloud(silent=false){
  tn80UpdatePanelLocal();

  if(!tn80HasSession()){
    tn80Set("tn80Connection","Not logged in");
    tn80Set("tn80CloudWords","-");
    tn80Set("tn80CloudLists","-");
    tn80Set("tn80CloudUpdated","-");
    tn80UpdatePill("local","Local");
    return false;
  }

  const s=tn80Supabase();
  if(!s){
    tn80Set("tn80Connection","Supabase client not ready");
    tn80UpdatePill("error","Cloud error");
    return false;
  }

  tn80Set("tn80Connection","Checking...");
  tn80UpdatePill("checking","Checking...");

  try{
    const {data,error}=await s.rpc("tn_login",{
      p_email:tn80Email(),
      p_password_hash:tn80Hash()
    });
    if(error)throw error;
    if(!data || data.ok===false)throw new Error(data?.error||"Cloud check failed");

    const cloud=data.data||{};
    const cloudWords=Array.isArray(cloud.words)?cloud.words.length:0;
    const cloudLists=Array.isArray(cloud.lists)?cloud.lists.length:0;

    tn80Set("tn80CloudWords",String(cloudWords));
    tn80Set("tn80CloudLists",String(cloudLists));
    tn80Set("tn80CloudUpdated",tn80FormatTime(data.updated_at));
    tn80Set("tn80Connection","Same cloud account ✓");
    tn80UpdatePill("synced","Synced ✓");
    localStorage.setItem("tangonest_last_cloud_updated_at_v1",data.updated_at||new Date().toISOString());

    if(!silent)tn80Toast("Cloud checked ✓");
    return data;
  }catch(e){
    console.error(e);
    tn80Set("tn80Connection",e.message||"Cloud check failed");
    tn80UpdatePill("error","Cloud error");
    return false;
  }
}

async function tn80LoadCloudNow(){
  if(!tn80HasSession()){
    tn80Toast("Not logged in");
    return false;
  }
  const s=tn80Supabase();
  if(!s){
    tn80Toast("Cloud client not ready");
    return false;
  }
  tn80Set("tn80Connection","Loading cloud...");
  tn80UpdatePill("checking","Loading...");
  try{
    const {data,error}=await s.rpc("tn_login",{
      p_email:tn80Email(),
      p_password_hash:tn80Hash()
    });
    if(error)throw error;
    if(!data || data.ok===false)throw new Error(data?.error||"Cloud load failed");

    if(data.data){
      tnSafeApplyCloudData(data.data,"tn80-manual-cloud-load");
      tn80Persist();
      tn80RenderAll();
    }
    await tn80CheckCloud(true);
    tn80Toast("Loaded cloud ✓");
    return true;
  }catch(e){
    console.error(e);
    tn80Set("tn80Connection",e.message||"Load failed");
    tn80UpdatePill("error","Cloud error");
    return false;
  }
}

async function tn80SaveThisDeviceNow(){
  if(!tn80HasSession()){
    tn80Toast("Not logged in");
    return false;
  }
  const s=tn80Supabase();
  if(!s){
    tn80Toast("Cloud client not ready");
    return false;
  }
  tn80EnsureDb();
  db.meta=db.meta||{};
  db.meta.lastDeviceId=tn80DeviceId();
  db.meta.lastManualSaveAt=new Date().toISOString();
  tn80Persist();

  tn80Set("tn80Connection","Saving this device...");
  tn80UpdatePill("checking","Saving...");

  try{
    const {data,error}=await s.rpc("tn_save",{
      p_email:tn80Email(),
      p_password_hash:tn80Hash(),
      p_data:db
    });
    if(error)throw error;

    localStorage.setItem("tangonest_last_cloud_updated_at_v1",data?.updated_at||new Date().toISOString());
    await tn80CheckCloud(true);
    tn80Toast("Saved this device ✓");
    return true;
  }catch(e){
    console.error(e);
    tn80Set("tn80Connection",e.message||"Save failed");
    tn80UpdatePill("error","Cloud error");
    return false;
  }
}

function tn80Logout(){
  if(!confirm("Log out of TangoNest?"))return;

  try{
    localStorage.removeItem("tangonest_sync_email_v1");
    localStorage.removeItem("tangonest_sync_hash_v1");
    localStorage.removeItem("tangonest_sync_mode_v1");
    localStorage.removeItem("tangonest_last_cloud_updated_at_v1");
    localStorage.removeItem("tangonest_guest_mode");
  }catch(e){}

  tn80UpdatePanelLocal();

  if(typeof tn73ShowAuth==="function"){
    tn73ShowAuth();
  }else if(typeof tnOpenLoginGate==="function"){
    tnOpenLoginGate();
  }else{
    location.reload();
  }
}

function tn80WrapMutationsForCloud(){
  const original=window.tnRegisterWordCritical || window.addWord || window.registerWord;
  if(typeof original==="function" && !original.__tn80Wrapped){
    const wrapped=function(ev){
      const res=original(ev);
      setTimeout(()=>{
        tn80Persist();
        tn80RenderAll();
        if(tn80HasSession())tn80SaveThisDeviceNow();
      },120);
      return res;
    };
    wrapped.__tn80Wrapped=true;
    window.tnRegisterWordCritical=wrapped;
    window.addWord=wrapped;
    window.registerWord=wrapped;
    const btn=document.getElementById("addWordBtn") || [...document.querySelectorAll("button")].find(b=>(b.textContent||"").includes("Register"));
    if(btn)btn.onclick=wrapped;
  }
}

function tn80ForcePanelVisible(){
  const panel=document.getElementById("tn80CloudPanel");
  const page=document.getElementById("pageManage");
  if(panel && page){
    const card=page.querySelector(":scope > .card") || page.querySelector(".card");
    if(card && panel.parentElement!==card){
      card.insertBefore(panel,card.firstChild);
    }else if(card && card.firstElementChild!==panel){
      card.insertBefore(panel,card.firstChild);
    }
  }
  if(panel){
    panel.style.display="block";
    panel.style.visibility="visible";
    panel.style.opacity="1";
  }
}

function tn80Boot(){
  tn80ForcePanelVisible();
  tn80UpdatePanelLocal();
  tn80WrapMutationsForCloud();

  if(tn80HasSession()){
    setTimeout(()=>tn80CheckCloud(true),800);
  }
}
setTimeout(tn80Boot,0);
setTimeout(tn80Boot,500);
setTimeout(tn80Boot,1500);
setInterval(()=>{
  tn80ForcePanelVisible();
  tn80UpdatePanelLocal();
  tn80WrapMutationsForCloud();
},2000);

window.tn80CheckCloud=tn80CheckCloud;
window.tn80LoadCloudNow=tn80LoadCloudNow;
window.tn80SaveThisDeviceNow=tn80SaveThisDeviceNow;
window.tn80Logout=tn80Logout;



/* =========================================================
   Beta81 Stable Sync + Page State + Defaults
   Fixes:
   - Mobile logout button not responding
   - Default language always English/Japanese
   - Reload keeps current page instead of forcing Home
   - Cloud panel compact
   - Sync stability improved
========================================================= */

const TN81_PAGE_KEY="tangonest_last_page_v1";

function tn81Email(){
  try{return localStorage.getItem("tangonest_sync_email_v1")||"";}catch(e){return "";}
}
function tn81Hash(){
  try{return localStorage.getItem("tangonest_sync_hash_v1")||"";}catch(e){return "";}
}
function tn81HasSession(){return !!(tn81Email()&&tn81Hash());}
function tn81Key(){
  try{if(typeof KEY!=="undefined")return KEY;}catch(e){}
  return "tangonest_data";
}
function tn81EnsureDb(){
  try{if(typeof db==="undefined" || !db)window.db={lists:[],words:[],prefs:{}};}catch(e){}
  db.lists=db.lists||[];
  db.words=db.words||[];
  db.mistakes=Array.isArray(db.mistakes)?db.mistakes:[];
  db.prefs=db.prefs||{};
  if(!db.lists.length)db.lists.push({id:"starter",name:"New Playlist"});
}
function tn81Persist(){
  tn81EnsureDb();
  localStorage.setItem(tn81Key(),JSON.stringify(db));
}
function tn81Supabase(){
  try{if(window.tn74GetSupabase){const x=window.tn74GetSupabase(); if(x&&x.rpc)return x;}}catch(e){}
  try{if(window.tnSupabaseClient?.rpc)return window.tnSupabaseClient;}catch(e){}
  try{if(window.supabaseClient?.rpc)return window.supabaseClient;}catch(e){}
  try{if(window.sb?.rpc)return window.sb;}catch(e){}
  try{if(typeof supabaseClient!=="undefined"&&supabaseClient.rpc)return supabaseClient;}catch(e){}
  try{if(typeof sb!=="undefined"&&sb.rpc)return sb;}catch(e){}
  return null;
}

/* 1) Force defaults English/Japanese, repeatedly and after render */
function tn81SetSelect(id,value){
  const el=document.getElementById(id);
  if(!el || el.tagName!=="SELECT")return;
  const found=[...el.options].some(o=>o.value===value);
  if(found)el.value=value;
}
function tn81ForceDefaultLanguages(){
  tn81EnsureDb();
  db.prefs.frontLang="en-US";
  db.prefs.backLang="ja-JP";

  tn81SetSelect("frontLang","en-US");
  tn81SetSelect("backLang","ja-JP");
  tn81SetSelect("bulkFrontLang","en-US");
  tn81SetSelect("bulkBackLang","ja-JP");

  const front=document.getElementById("front");
  const back=document.getElementById("back");
  const memo=document.getElementById("memo");
  if(front)front.placeholder="word";
  if(back)back.placeholder="meaning";
  if(memo)memo.placeholder="Example sentence or memo.";

  try{tn81Persist();}catch(e){}
}

/* 2) Preserve current page across reload */
function tn81NormalizePage(page){
  const map={
    "add":"create",
    "words":"library",
    "manage":"settings",
    "study":"cards",
    "audio":"listen"
  };
  return map[page]||page||"home";
}
function tn81RememberPage(page){
  page=tn81NormalizePage(page);
  localStorage.setItem(TN81_PAGE_KEY,page);
}
function tn81CurrentPageFromDom(){
  const activeNav=[...document.querySelectorAll("button,a")].find(el=>{
    const cls=String(el.className||"").toLowerCase();
    return cls.includes("active") && ["home","create","library","cards","quiz","listen","settings"].includes((el.textContent||"").trim().toLowerCase());
  });
  if(activeNav)return tn81NormalizePage((activeNav.textContent||"").trim().toLowerCase());

  const activePage=document.querySelector(".page.active,[data-page].active");
  if(activePage){
    const id=(activePage.id||"").toLowerCase();
    const data=(activePage.dataset?.page||"").toLowerCase();
    return tn81NormalizePage(data || id.replace(/^page/,""));
  }
  return localStorage.getItem(TN81_PAGE_KEY)||"home";
}
function tn81GoSavedPage(){
  const page=tn81NormalizePage(localStorage.getItem(TN81_PAGE_KEY)||"home");
  try{
    if(typeof go==="function")go(page);
  }catch(e){}
}
function tn81WrapGo(){
  if(typeof window.go==="function" && !window.go.__tn81Wrapped){
    const old=window.go;
    window.go=function(page){
      tn81RememberPage(page);
      const result=old(page);
      setTimeout(tn81ForceDefaultLanguages,50);
      return result;
    };
    window.go.__tn81Wrapped=true;
  }
  document.querySelectorAll("button,a").forEach(el=>{
    const txt=(el.textContent||"").trim().toLowerCase();
    if(["home","create","library","cards","quiz","listen","settings"].includes(txt) && !el.__tn81Remember){
      el.addEventListener("click",()=>tn81RememberPage(txt),true);
      el.__tn81Remember=true;
    }
  });
}

/* Override old Home-forcing login close functions to saved page */
function tn81ShowAppSavedPage(){
  document.documentElement.classList.add("tn73-ready","tn-authenticated");
  document.documentElement.classList.remove("tn-logged-out","tn-needs-auth");
  document.body?.classList.add("tn-logged-in");
  document.body?.classList.remove("tn-auth-open");
  const auth=document.getElementById("tn73Auth");
  if(auth){
    auth.style.setProperty("display","none","important");
    auth.style.setProperty("pointer-events","none","important");
  }
  setTimeout(tn81GoSavedPage,20);
  setTimeout(tn81ForceDefaultLanguages,60);
}
window.tnShowApp=tn81ShowAppSavedPage;
window.tnNoEmailShowApp=tn81ShowAppSavedPage;
window.tn73ShowApp=tn81ShowAppSavedPage;

/* 3) Mobile-safe logout */
function tn81Logout(){
  const ok=confirm("Log out of TangoNest?");
  if(!ok)return;

  try{
    localStorage.removeItem("tangonest_sync_email_v1");
    localStorage.removeItem("tangonest_sync_hash_v1");
    localStorage.removeItem("tangonest_sync_mode_v1");
    localStorage.removeItem("tangonest_last_cloud_updated_at_v1");
    localStorage.removeItem("tangonest_guest_mode");
  }catch(e){}

  document.documentElement.classList.remove("tn73-ready","tn-authenticated");
  document.documentElement.classList.add("tn-logged-out");
  document.body?.classList.remove("tn-logged-in");
  document.body?.classList.add("tn-auth-open");

  const auth=document.getElementById("tn73Auth");
  if(auth){
    auth.style.setProperty("display","flex","important");
    auth.style.setProperty("pointer-events","auto","important");
    auth.style.setProperty("visibility","visible","important");
    auth.style.setProperty("opacity","1","important");
    setTimeout(()=>document.getElementById("tn73Email")?.focus(),100);
  }else if(typeof tnOpenLoginGate==="function"){
    tnOpenLoginGate();
  }else{
    location.reload();
  }
}
window.tn81Logout=tn81Logout;
window.tn80Logout=tn81Logout;
window.tn77Logout=tn81Logout;
window.logoutTangoNest=async function(){tn81Logout();};

function tn81BindLogoutButtons(){
  const ids=["tn80LogoutBtn","tn77LogoutBtn"];
  ids.forEach(id=>{
    const btn=document.getElementById(id);
    if(btn){
      btn.type="button";
      btn.onclick=tn81Logout;
      btn.style.pointerEvents="auto";
      btn.style.cursor="pointer";
      btn.style.display=tn81HasSession() ? "inline-flex" : "none";
    }
  });
  document.querySelectorAll("button").forEach(btn=>{
    const txt=(btn.textContent||"").trim().toLowerCase();
    if(txt==="log out" && !btn.__tn81Logout){
      btn.type="button";
      btn.addEventListener("click",(e)=>{
        e.preventDefault();
        e.stopPropagation();
        tn81Logout();
      },true);
      btn.__tn81Logout=true;
    }
  });
}

/* 4) Compact Cloud panel */
function tn81CompactCloudPanel(){
  const panel=document.getElementById("tn80CloudPanel") || document.getElementById("tn78CloudBox");
  if(!panel)return;

  panel.classList.add("tn81-compact-cloud");

  // Prefer closed by default; user can open when checking.
  if(panel.tagName==="DETAILS"){
    if(!panel.__tn81Initialized){
      panel.open=false;
      panel.__tn81Initialized=true;
    }
  }

  // Keep panel at top but compact.
  const page=document.getElementById("pageManage") || document.getElementById("settings");
  const card=page?.querySelector(".card");
  if(card && panel.parentElement!==card){
    card.insertBefore(panel,card.firstChild);
  }
}

/* 5) More stable sync: save on add, load on focus, avoid Home jumps */
let tn81SyncTimer=null;
let tn81Loading=false;
let tn81Saving=false;
function tn81RenderAll(){
  try{if(typeof tn75SafeRender==="function")tn75SafeRender();}catch(e){}
  try{if(typeof renderSelect==="function"){renderSelect("addList",false);renderSelect("wordListSelect",true);renderSelect("quizList",true);renderSelect("audioList",true);}}catch(e){}
  try{if(typeof renderWords==="function")renderWords();}catch(e){}
  try{if(typeof renderHome==="function")renderHome();}catch(e){}
  try{if(typeof tn75RenderLibraryNow==="function")tn75RenderLibraryNow();}catch(e){}
  try{if(typeof tn80UpdatePanelLocal==="function")tn80UpdatePanelLocal();}catch(e){}
  tn81ForceDefaultLanguages();
}
async function tn81CloudSave(){
  if(!tn81HasSession() || tn81Saving)return false;
  const s=tn81Supabase();
  if(!s)return false;
  tn81Saving=true;
  try{
    tn81EnsureDb();
    db.meta=db.meta||{};
    db.meta.lastDeviceId=localStorage.getItem("tangonest_device_id_v1")||"device";
    db.meta.lastSaveAt=new Date().toISOString();
    tn81Persist();
    const {data,error}=await s.rpc("tn_save",{p_email:tn81Email(),p_password_hash:tn81Hash(),p_data:db});
    if(error)throw error;
    localStorage.setItem("tangonest_last_cloud_updated_at_v1",data?.updated_at||new Date().toISOString());
    return true;
  }catch(e){
    console.error("tn81 cloud save failed",e);
    return false;
  }finally{
    tn81Saving=false;
  }
}
async function tn81CloudLoad(){
  if(!tn81HasSession() || tn81Loading || tn81Saving)return false;
  const s=tn81Supabase();
  if(!s)return false;
  tn81Loading=true;
  const current=tn81CurrentPageFromDom();
  try{
    const {data,error}=await s.rpc("tn_login",{p_email:tn81Email(),p_password_hash:tn81Hash()});
    if(error)throw error;
    if(data && data.ok!==false && data.data){
      tnSafeApplyCloudData(data.data,"tn81-cloud-load");
      tn81Persist();
      tn81RenderAll();
      tn81RememberPage(current);
      try{if(typeof go==="function")go(current);}catch(e){}
      return true;
    }
    return false;
  }catch(e){
    console.error("tn81 cloud load failed",e);
    return false;
  }finally{
    tn81Loading=false;
  }
}
function tn81CloudSaveSoon(){
  clearTimeout(tn81SyncTimer);
  tn81SyncTimer=setTimeout(()=>tn81CloudSave(),500);
}
function tn81WrapMutations(){
  const original=window.tnRegisterWordCritical || window.addWord || window.registerWord;
  if(typeof original==="function" && !original.__tn81Wrapped){
    const wrapped=function(ev){
      const page=tn81CurrentPageFromDom();
      const result=original(ev);
      setTimeout(()=>{
        tn81RememberPage(page);
        tn81Persist();
        tn81RenderAll();
        tn81CloudSaveSoon();
      },80);
      return result;
    };
    wrapped.__tn81Wrapped=true;
    window.tnRegisterWordCritical=wrapped;
    window.addWord=wrapped;
    window.registerWord=wrapped;
    const btn=document.getElementById("addWordBtn") || [...document.querySelectorAll("button")].find(b=>(b.textContent||"").includes("Register"));
    if(btn)btn.onclick=wrapped;
  }
}

function tn81Boot(){
  tn81WrapGo();
  tn81BindLogoutButtons();
  tn81ForceDefaultLanguages();
  tn81CompactCloudPanel();
  tn81WrapMutations();

  // On reload, restore current page after old scripts finish.
  setTimeout(tn81GoSavedPage,700);
  setTimeout(tn81ForceDefaultLanguages,900);

  if(tn81HasSession()){
    setTimeout(tn81CloudLoad,1200);
  }
}
setTimeout(tn81Boot,0);
setTimeout(tn81Boot,500);
setTimeout(tn81Boot,1500);
setInterval(()=>{
  tn81WrapGo();
  tn81BindLogoutButtons();
  tn81ForceDefaultLanguages();
  tn81CompactCloudPanel();
  tn81WrapMutations();
},1500);

window.addEventListener("focus",()=>{ if(tn81HasSession())tn81CloudLoad(); });
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible" && tn81HasSession())tn81CloudLoad(); });

window.tn81CloudSave=tn81CloudSave;
window.tn81CloudLoad=tn81CloudLoad;



/* =========================================================
   Beta82 Core Function Final
   This module intentionally overrides unstable old behavior.
   Required fixes:
   1. Library All shows every word.
   2. Add Word immediately appears in Library.
   3. Playlist Rename works.
   4. Reload keeps current page.
   5. Default languages are always English/Japanese.
   6. Cloud sync is stable enough for PC <-> phone.
========================================================= */

const TN82_DATA_KEY_FALLBACK="tangonest_data";
const TN82_PAGE_KEY="tangonest_last_page_v2";
const TN82_EMAIL_KEY="tangonest_sync_email_v1";
const TN82_HASH_KEY="tangonest_sync_hash_v1";
const TN82_CLOUD_TIME_KEY="tangonest_last_cloud_updated_at_v2";
let tn82SaveTimer=null;
let tn82LoadTimer=null;
let tn82IsSaving=false;
let tn82IsLoading=false;
let tn82LastRenderedJson="";
let tn82LastLocalChangeAt="";

function tn82DataKey(){
  try{ if(typeof KEY!=="undefined" && KEY)return KEY; }catch(e){}
  return TN82_DATA_KEY_FALLBACK;
}

function tn82EnsureDb(){
  try{
    if(typeof db==="undefined" || !db) window.db={lists:[],words:[],prefs:{}};
  }catch(e){
    window.db={lists:[],words:[],prefs:{}};
  }
  db.lists=Array.isArray(db.lists)?db.lists:[];
  db.words=Array.isArray(db.words)?db.words:[];
  db.mistakes=Array.isArray(db.mistakes)?db.mistakes:[];
  db.prefs=db.prefs||{};
  db.meta=db.meta||{};
  if(!db.lists.length){
    db.lists.push({id:"starter",name:"New Playlist",createdAt:new Date().toISOString()});
  }
  db.words=db.words.filter(Boolean).map(w=>{
    w.id=w.id||("w_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2));
    w.listId=w.listId||db.lists[0].id;
    w.front=w.front??"";
    w.back=w.back??"";
    w.frontLang=w.frontLang||"en-US";
    w.backLang=w.backLang||"ja-JP";
    w.createdAt=w.createdAt||new Date().toISOString();
    return w;
  });
}

function tn82TouchLocal(){
  tn82EnsureDb();
  tn82LastLocalChangeAt=new Date().toISOString();
  db.meta.updatedAt=tn82LastLocalChangeAt;
  db.meta.lastDeviceId=tn82DeviceId();
}

function tn82Persist(){
  tn82EnsureDb();
  if(tn82DataKey()===KEY)tnWriteData(db);
  else localStorage.setItem(tn82DataKey(),JSON.stringify(db));
}

function tn82LoadLocal(){
  try{
    const raw=localStorage.getItem(tn82DataKey());
    if(raw){
      const parsed=JSON.parse(raw);
      if(parsed && typeof parsed==="object"){
        Object.assign(db,parsed);
      }
    }
  }catch(e){}
  tn82EnsureDb();
  tn82LastLocalChangeAt=db.meta?.updatedAt||"";
}

function tn82Esc(s){
  return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function tn82LangName(code){
  try{ if(typeof langName==="function")return langName(code); }catch(e){}
  const names={"en-US":"English","en-GB":"English","ja-JP":"Japanese","ko-KR":"Korean","zh-CN":"Chinese","zh-TW":"Chinese","fr-FR":"French","es-ES":"Spanish","de-DE":"German","it-IT":"Italian","pt-BR":"Portuguese"};
  return names[code] || code || "Unknown";
}

function tn82Toast(msg){
  try{ if(typeof tn75Toast==="function") return tn75Toast(msg); }catch(e){}
  try{ if(typeof tn64Toast==="function") return tn64Toast(msg); }catch(e){}
  const t=document.getElementById("toast");
  if(t){t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1600);}
  else console.log("[TangoNest]",msg);
}

/* ---------- 5. Default languages English/Japanese ---------- */
function tn82SetSelect(id,value){
  const el=document.getElementById(id);
  if(!el || el.tagName!=="SELECT")return;
  const exists=[...el.options].some(o=>o.value===value);
  if(exists)el.value=value;
}

function tn82ForceDefaultLanguages(){
  tn82EnsureDb();
  db.prefs.frontLang="en-US";
  db.prefs.backLang="ja-JP";
  tn82SetSelect("frontLang","en-US");
  tn82SetSelect("backLang","ja-JP");
  tn82SetSelect("bulkFrontLang","en-US");
  tn82SetSelect("bulkBackLang","ja-JP");

  const front=document.getElementById("front");
  const back=document.getElementById("back");
  const memo=document.getElementById("memo");
  const bulk=document.getElementById("bulkText");
  if(front)front.placeholder="word";
  if(back)back.placeholder="meaning";
  if(memo)memo.placeholder="Example sentence or memo.";
  if(bulk)bulk.placeholder="front word\tback meaning\tPOS\tgender\texample sentence";
}

/* ---------- 4. Page state ---------- */
function tn82NormalizePage(page){
  page=String(page||"").toLowerCase().trim();
  const map={add:"create",words:"library",manage:"settings",study:"cards",audio:"listen",pagehome:"home",pageadd:"create",pagewords:"library",pagemanage:"settings",pagestudy:"cards",pageaudio:"listen"};
  return map[page]||page||"home";
}

function tn82RememberPage(page){
  page=tn82NormalizePage(page);
  if(["home","create","library","cards","quiz","listen","settings"].includes(page)){
    localStorage.setItem(TN82_PAGE_KEY,page);
  }
}

function tn82GetSavedPage(){
  return tn82NormalizePage(localStorage.getItem(TN82_PAGE_KEY)||"home");
}

function tn82Go(page){
  page=tn82NormalizePage(page);
  tn82RememberPage(page);

  const possibleIds={
    home:["pageHome","home"],
    create:["pageAdd","pageCreate","create","add"],
    library:["pageWords","pageLibrary","library","words"],
    cards:["pageStudy","pageCards","cards","study"],
    quiz:["pageQuiz","quiz"],
    listen:["pageAudio","pageListen","listen","audio"],
    settings:["pageManage","pageSettings","settings","manage"]
  };

  if(typeof window.__tn82OldGo==="function"){
    try{
      const oldPage={create:"add",library:"words",cards:"study",listen:"audio",settings:"manage"}[page]||page;
      window.__tn82OldGo(oldPage);
    }catch(e){}
  }

  // Hard class correction after old go.
  Object.values(possibleIds).flat().forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.classList.remove("active");
  });
  const targetId=(possibleIds[page]||[]).find(id=>document.getElementById(id));
  if(targetId){
    document.getElementById(targetId).classList.add("active");
  }

  // nav active correction by text
  document.querySelectorAll("nav button,.tabs button,header button").forEach(btn=>{
    const txt=(btn.textContent||"").trim().toLowerCase();
    if(["home","create","library","cards","quiz","listen","settings"].includes(txt)){
      btn.classList.toggle("active",txt===page);
    }
  });

  tn82ForceDefaultLanguages();
  if(page==="library"){
    if(window.tnLibraryRender)window.tnLibraryRender();
    else tn82RenderLibrary();
  }
  if(page==="settings")tn82RenderPlaylistManager();
}

function tn82WrapGo(){
  if(typeof window.go==="function" && !window.go.__tn82Wrapped){
    window.__tn82OldGo=window.go;
    window.go=function(page){ tn82Go(page); };
    window.go.__tn82Wrapped=true;
  }else if(typeof window.go!=="function"){
    window.go=function(page){ tn82Go(page); };
  }

  document.querySelectorAll("button,a").forEach(el=>{
    const txt=(el.textContent||"").trim().toLowerCase();
    if(["home","create","library","cards","quiz","listen","settings"].includes(txt) && !el.__tn82PageClick){
      el.addEventListener("click",()=>tn82RememberPage(txt),true);
      el.__tn82PageClick=true;
    }
  });
}

/* ---------- 1. Library All shows every word ---------- */
function tn82ListName(id){
  tn82EnsureDb();
  const l=db.lists.find(x=>x.id===id);
  return l?l.name:"New Playlist";
}

function tn82GetLibraryFilterValue(){
  const ids=["wordListSelect","libraryList","listFilter","filterList"];
  for(const id of ids){
    const el=document.getElementById(id);
    if(el && el.value)return el.value;
  }
  return "all";
}

function tn82FilteredWords(){
  tn82EnsureDb();
  const filter=String(tn82GetLibraryFilterValue()||"all").toLowerCase();
  let words=[...db.words];
  if(filter && filter!=="all" && filter!==""){
    words=words.filter(w=>String(w.listId).toLowerCase()===filter || String(tn82ListName(w.listId)).toLowerCase()===filter);
  }
  const status=document.getElementById("statusFilter")?.value||"all";
  const q=String(document.getElementById("wordSearch")?.value||"").trim().toLowerCase();
  if(status==="star")words=words.filter(w=>w.saved);
  else if(status==="due")words=words.filter(w=>w.nextReview&&w.nextReview<=new Date().toISOString().slice(0,10));
  else if(status && status!=="all")words=words.filter(w=>(w.status||"new")===status);
  if(q)words=words.filter(w=>[w.front,w.back,w.memo,w.tags,w.pos,w.gender,tn82ListName(w.listId)].join(" ").toLowerCase().includes(q));
  return words;
}

function tn82RenderLibrary(){
  tn82EnsureDb();
  const mount=document.getElementById("tn82LibraryMount") ||
    document.getElementById("wordsList") ||
    document.getElementById("libraryListMount") ||
    document.querySelector("#pageWords .word-list") ||
    document.querySelector("#pageLibrary .word-list");

  const words=tn82FilteredWords();
  const html=`
    <div class="tn82-library-summary">${words.length} word${words.length===1?"":"s"} shown</div>
    <div class="tn82-word-list">
      ${words.length?words.map((w,i)=>`
        <div class="tn82-word-card" data-word-id="${tn82Esc(w.id)}">
          <div class="tn82-word-main">
            <div class="tn82-front">${tn82Esc(w.front)}</div>
            <div class="tn82-back">${tn82Esc(w.back)}</div>
          </div>
          <div class="tn82-word-meta">
            <span>${tn82Esc(tn82ListName(w.listId))}</span>
            <span>${tn82Esc(tn82LangName(w.frontLang||"en-US"))} → ${tn82Esc(tn82LangName(w.backLang||"ja-JP"))}</span>
            ${w.pos?`<span>${tn82Esc(w.pos)}</span>`:""}
          </div>
        </div>
      `).join(""):`<div class="tn82-empty">No words yet. Add a word from Create.</div>`}
    </div>
  `;

  if(mount)mount.innerHTML=html;

  // Also fill any table body if old UI uses it.
  const tbody=document.querySelector("#pageWords table tbody,#pageLibrary table tbody");
  if(tbody){
    tbody.innerHTML=words.map(w=>`
      <tr>
        <td><strong>${tn82Esc(w.front)}</strong></td>
        <td>${tn82Esc(w.back)}</td>
        <td>${tn82Esc(tn82ListName(w.listId))}</td>
        <td>${tn82Esc(tn82LangName(w.frontLang||"en-US"))} → ${tn82Esc(tn82LangName(w.backLang||"ja-JP"))}</td>
      </tr>
    `).join("");
  }

  tn82UpdateCounts();
}

function tn82BindLibraryFilters(){
  ["wordListSelect","libraryList","listFilter","filterList","statusFilter","wordSearch"].forEach(id=>{
    const el=document.getElementById(id);
    if(el && !el.__tn82LibraryFilter){
      el.addEventListener(el.tagName==="INPUT"?"input":"change",tn82RenderLibrary);
      el.__tn82LibraryFilter=true;
    }
  });
}

function tn82RenderSelect(id,{all=false,value}={}){
  const el=document.getElementById(id);
  if(!el)return;
  const current=value!==undefined?value:el.value;
  el.innerHTML="";
  if(all){
    const option=document.createElement("option");
    option.value="all";
    option.textContent="All";
    el.appendChild(option);
  }
  db.lists.forEach(list=>{
    const option=document.createElement("option");
    option.value=list.id;
    option.textContent=list.name||"New Playlist";
    el.appendChild(option);
  });
  if([...el.options].some(option=>option.value===current))el.value=current;
  else if(all)el.value="all";
  else if(db.lists[0])el.value=db.lists[0].id;
}

function tn82RenderPlaylistSelects(){
  tn82EnsureDb();
  ["addList","bulkList","studyList","quizList","audioList","renameListSelect","editList"].forEach(id=>tn82RenderSelect(id));
  tn82RenderSelect("wordListSelect",{all:true});
}

/* ---------- Counts ---------- */
function tn82UpdateCounts(){
  tn82EnsureDb();
  const words=db.words.length;
  const lists=db.lists.length;
  const learned=db.words.filter(w=>w.status==="learned").length;
  const hard=db.words.filter(w=>w.status==="hard").length;
  const set=(id,v)=>{const el=document.getElementById(id); if(el)el.textContent=v;};
  ["wc","totalWords","dashTotal","heroWords"].forEach(id=>set(id,words));
  ["listCount","totalLists","heroLists"].forEach(id=>set(id,lists));
  ["lc","totalLearned","heroLearned"].forEach(id=>set(id,learned));
  ["hc","totalHard","dashHard"].forEach(id=>set(id,hard));
}

/* ---------- 2. Add Word fixed + immediate Library reflection ---------- */
function tn82Id(){
  return "w_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8);
}
function tn82TodayPlus(n){
  const d=new Date(); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10);
}
function tn82AddWord(ev){
  if(ev&&ev.preventDefault)ev.preventDefault();
  tn82EnsureDb();
  tn82ForceDefaultLanguages();

  const front=(document.getElementById("front")?.value||"").trim();
  const back=(document.getElementById("back")?.value||"").trim();
  if(!front || !back){
    tn82Toast("Front and Back are required");
    return false;
  }

  let listId=document.getElementById("addList")?.value || db.lists[0].id;
  if(!db.lists.some(l=>l.id===listId))listId=db.lists[0].id;

  const word={
    id:tn82Id(),
    front,
    back,
    listId,
    frontLang:"en-US",
    backLang:"ja-JP",
    pos:document.getElementById("pos")?.value||"",
    gender:document.getElementById("gender")?.value||"",
    tags:(document.getElementById("tags")?.value||"").trim(),
    memo:(document.getElementById("memo")?.value||"").trim(),
    saved:false,
    status:"new",
    seen:0,
    level:1,
    nextReview:tn82TodayPlus(1),
    createdAt:new Date().toISOString()
  };
  db.words.push(word);
  tn82TouchLocal();
  tn82Persist();

  ["front","back","memo","tags"].forEach(id=>{const el=document.getElementById(id); if(el)el.value="";});
  ["pos","gender"].forEach(id=>{const el=document.getElementById(id); if(el)el.value="";});
  tn82ForceDefaultLanguages();

  if(window.tnLibraryRender)window.tnLibraryRender();
  else tn82RenderLibrary();
  tn82RenderPlaylistSelects();
  tn82UpdateCounts();
  tn82CloudSaveSoon();
  tn82Toast("1 word added");
  return false;
}

function tn82BindAdd(){
  window.tnRegisterWordCritical=tn82AddWord;
  window.addWord=tn82AddWord;
  window.registerWord=tn82AddWord;
  const btn=document.getElementById("addWordBtn") || [...document.querySelectorAll("button")].find(b=>(b.textContent||"").includes("Register"));
  if(btn){
    btn.id="addWordBtn";
    btn.type="button";
    btn.onclick=tn82AddWord;
  }
}

/* ---------- 3. Playlist Create/Rename fixed ---------- */
function tn82CreatePlaylist(name){
  tn82EnsureDb();
  name=String(name||"").trim();
  if(!name){tn82Toast("Playlist name is required");return false;}
  const exists=db.lists.some(l=>String(l.name||"").trim().toLowerCase()===name.toLowerCase());
  if(exists){tn82Toast("Playlist already exists");return false;}
  const list={id:"list_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8),name,createdAt:new Date().toISOString()};
  db.lists.push(list);
  tn82TouchLocal();
  tn82Persist();
  const input=document.getElementById("newList");
  if(input)input.value="";
  tn82RenderPlaylistSelects();
  tn82RenderPlaylistManager();
  if(window.tnLibraryRender)window.tnLibraryRender();
  else tn82RenderLibrary();
  tn82UpdateCounts();
  tn82CloudSaveSoon();
  tn82Toast("Playlist created");
  return true;
}

function tn82CreateList(){
  return tn82CreatePlaylist(document.getElementById("newList")?.value||"");
}

function tn82RenderPlaylistManager(){
  tn82EnsureDb();
  tn82RenderPlaylistSelects();
  const rows=document.getElementById("tn82PlaylistRows") || document.getElementById("tn75PlaylistRows");
  if(!rows)return;

  rows.innerHTML=db.lists.map(l=>`
    <div class="tn82-playlist-row">
      <input class="tn82-playlist-input" data-list-id="${tn82Esc(l.id)}" value="${tn82Esc(l.name||"New Playlist")}">
      <button type="button" class="tn82-rename-btn" data-list-id="${tn82Esc(l.id)}">Rename</button>
    </div>
  `).join("");

  rows.querySelectorAll(".tn82-rename-btn").forEach(btn=>{
    btn.onclick=function(ev){
      ev.preventDefault();
      const id=btn.dataset.listId;
      const input=rows.querySelector(`.tn82-playlist-input[data-list-id="${CSS.escape(id)}"]`);
      tn82RenamePlaylist(id,input?.value||"");
    };
  });
  rows.querySelectorAll(".tn82-playlist-input").forEach(input=>{
    input.addEventListener("keydown",e=>{
      if(e.key==="Enter")tn82RenamePlaylist(input.dataset.listId,input.value);
    });
  });
}

function tn82RenamePlaylist(id,name){
  tn82EnsureDb();
  id=id || document.getElementById("renameListSelect")?.value || db.lists[0]?.id;
  name=String(name ?? document.getElementById("renameListInput")?.value ?? "").trim();
  if(!name){tn82Toast("Playlist name is required");return false;}
  const list=db.lists.find(l=>l.id===id);
  if(!list){tn82Toast("Playlist not found");return false;}
  list.name=name;
  tn82TouchLocal();
  tn82Persist();

  const renameInput=document.getElementById("renameListInput");
  if(renameInput)renameInput.value="";
  tn82RenderPlaylistSelects();
  tn82RenderPlaylistManager();
  if(window.tnLibraryRender)window.tnLibraryRender();
  else tn82RenderLibrary();
  try{if(typeof renderHome==="function")renderHome();}catch(e){}
  tn82CloudSaveSoon();
  tn82Toast("Playlist renamed");
  return true;
}
function tn82RenameList(){
  return tn82RenamePlaylist(document.getElementById("renameListSelect")?.value,document.getElementById("renameListInput")?.value);
}
window.createList=tn82CreateList;
window.renameList=tn82RenameList;
window.tn82CreatePlaylist=tn82CreatePlaylist;
window.tn82RenamePlaylist=tn82RenamePlaylist;
window.tn75RenamePlaylist=tn82RenamePlaylist;

/* ---------- 6. Cloud sync PC <-> phone ---------- */
function tn82Email(){
  try{return localStorage.getItem(TN82_EMAIL_KEY)||"";}catch(e){return "";}
}
function tn82Hash(){
  try{return localStorage.getItem(TN82_HASH_KEY)||"";}catch(e){return "";}
}
function tn82HasSession(){return !!(tn82Email()&&tn82Hash());}
function tn82Supabase(){
  try{if(window.tn74GetSupabase){const x=window.tn74GetSupabase(); if(x&&x.rpc)return x;}}catch(e){}
  try{if(window.tnSupabaseClient?.rpc)return window.tnSupabaseClient;}catch(e){}
  try{if(window.supabaseClient?.rpc)return window.supabaseClient;}catch(e){}
  try{if(window.sb?.rpc)return window.sb;}catch(e){}
  try{if(typeof supabaseClient!=="undefined"&&supabaseClient.rpc)return supabaseClient;}catch(e){}
  try{if(typeof sb!=="undefined"&&sb.rpc)return sb;}catch(e){}
  return null;
}

function tn82DeviceId(){
  let id=localStorage.getItem("tangonest_device_id_v1");
  if(!id){
    id="device_"+Math.random().toString(36).slice(2,8)+"_"+Date.now().toString(36).slice(-5);
    localStorage.setItem("tangonest_device_id_v1",id);
  }
  return id;
}

async function tn82CloudSave(){
  if(!tn82HasSession() || tn82IsSaving)return false;
  const s=tn82Supabase();
  if(!s)return false;
  tn82IsSaving=true;
  try{
    tn82EnsureDb();
    if(!db.meta.updatedAt)tn82TouchLocal();
    db.meta.lastDeviceId=tn82DeviceId();
    tn82Persist();
    const {data,error}=await s.rpc("tn_save",{p_email:tn82Email(),p_password_hash:tn82Hash(),p_data:db});
    if(error)throw error;
    localStorage.setItem(TN82_CLOUD_TIME_KEY,data?.updated_at||new Date().toISOString());
    tn82UpdateCloudMini("Synced ✓","synced");
    return true;
  }catch(e){
    console.error("tn82 cloud save failed",e);
    tn82UpdateCloudMini("Sync error","error");
    return false;
  }finally{
    tn82IsSaving=false;
  }
}

async function tn82CloudLoad(force=false){
  if(!tn82HasSession() || tn82IsLoading || tn82IsSaving)return false;
  const s=tn82Supabase();
  if(!s)return false;
  tn82IsLoading=true;
  const page=tn82GetSavedPage();
  try{
    const {data,error}=await s.rpc("tn_login",{p_email:tn82Email(),p_password_hash:tn82Hash()});
    if(error)throw error;
    if(!data || data.ok===false)throw new Error(data?.error||"Cloud load failed");
    const cloud=data.data||{};
    const cloudUpdated=data.updated_at || cloud.meta?.updatedAt || "";
    const localUpdated=db.meta?.updatedAt || tn82LastLocalChangeAt || "";
    const cloudIsNewer=cloudUpdated && (!localUpdated || new Date(cloudUpdated) >= new Date(localUpdated));
    const cloudJson=JSON.stringify(cloud);
    const localJson=JSON.stringify(db||{});
    if((force || cloudJson!==localJson) && (force || cloudIsNewer)){
      tnSafeApplyCloudData(cloud,"tn82-cloud-load");
      tn82EnsureDb();
      tn82Persist();
      tn82RenderPlaylistSelects();
      if(window.tnLibraryRender)window.tnLibraryRender();
      else tn82RenderLibrary();
      tn82RenderPlaylistManager();
      tn82UpdateCounts();
    }
    localStorage.setItem(TN82_CLOUD_TIME_KEY,data.updated_at||new Date().toISOString());
    tn82UpdateCloudMini("Synced ✓","synced");
    tn82RememberPage(page);
    setTimeout(()=>tn82Go(page),80);
    return true;
  }catch(e){
    console.error("tn82 cloud load failed",e);
    tn82UpdateCloudMini("Sync error","error");
    return false;
  }finally{
    tn82IsLoading=false;
  }
}

function tn82CloudSaveSoon(){
  clearTimeout(tn82SaveTimer);
  tn82SaveTimer=setTimeout(()=>tn82CloudSave(),450);
}

function tn82UpdateCloudMini(text,state){
  const btn=document.getElementById("tn80HeaderCloud") || document.getElementById("tn79CloudTopBtn") || document.getElementById("tn78MiniCloud");
  if(btn){
    btn.textContent="Cloud";
    btn.classList.toggle("synced",state==="synced");
  }
}

/* ---------- Initial sample cleanup disabled ----------
   Do not auto-delete apple / りんご. A user's first real word can look identical
   to an old demo sample, so cleanup must never remove saved vocabulary.
*/
function tn82RemoveDemoAppleIfOnlySample(){
  return;
}

/* ---------- Boot ---------- */
function tn82Boot(){
  tn82LoadLocal();
  tn82RemoveDemoAppleIfOnlySample();
  tn82WrapGo();
  tn82BindAdd();
  tn82BindLibraryFilters();
  tn82ForceDefaultLanguages();
  tn82RenderPlaylistSelects();
  if(!window.tnLibraryRender)tn82RenderLibrary();
  tn82RenderPlaylistManager();
  tn82UpdateCounts();

  const saved=tn82GetSavedPage();
  setTimeout(()=>tn82Go(saved),300);

  if(tn82HasSession()){
    setTimeout(()=>tn82CloudLoad(true),900);
  }
}

setTimeout(tn82Boot,0);
setTimeout(tn82Boot,400);
setTimeout(tn82Boot,1200);
setInterval(()=>{
  tn82WrapGo();
  tn82BindAdd();
  tn82BindLibraryFilters();
  tn82ForceDefaultLanguages();
  if(!window.tnLibraryRender)tn82RenderLibrary();
  tn82RenderPlaylistManager();
},2000);

setInterval(()=>{
  if(document.visibilityState==="visible" && tn82HasSession()){
    tn82CloudLoad(false);
  }
},5000);

window.addEventListener("focus",()=>{if(tn82HasSession())tn82CloudLoad(false);});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&tn82HasSession())tn82CloudLoad(false);});

window.tn82CloudSave=tn82CloudSave;
window.tn82CloudLoad=tn82CloudLoad;
window.tn82RenderLibrary=tn82RenderLibrary;
window.tn82ForceDefaultLanguages=tn82ForceDefaultLanguages;
