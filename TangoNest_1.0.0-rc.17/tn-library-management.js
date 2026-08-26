(function(){
  "use strict";

  const DATA_KEY = "tangonest_production_stable_v1";
  const SHADOW_KEY = "tangonest_last_good_data_v1";
  const WORD_RENDER_LIMIT = 100;
  const LOCAL_DEFAULT_PLAYLIST_ID = "local-my-words";
  const DEFAULT_PLAYLIST_NAME = "My Words";
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const engine = () => window.TangoNestLearningEngine || null;
  const presentation = () => window.TangoNestLearningPresentation || null;
  let activeView = localStorage.getItem("tangonest_library_view_v1") || "words";
  let displaySide = localStorage.getItem("tangonest_library_side_v1") || "both";
  let audioSide = localStorage.getItem("tangonest_library_audio_side_v1") || "front";
  let renderLimit = WORD_RENDER_LIMIT;
  let pendingDeleteId = "";
  let pendingRenameId = "";
  let contextTargetId = "";
  let searchRenderTimer = null;
  const filterValues={query:"",language:"all",letter:"all",playlist:"all",pos:"all",favorite:"all",learning:"all",sort:"newest"};
  const returnFocus = {rename:null,delete:null,detail:null};
  const selectedWordIds=new Set();
  window.__tnLibraryManagementActive = true;

  function parseData(raw){
    try{return raw ? JSON.parse(raw) : null;}catch(e){return null;}
  }

  function isDefaultList(list){
    try{if(typeof window.tnIsDefaultList==="function")return window.tnIsDefaultList(list);}catch(e){}
    const id = String(list?.id || "");
    return !!list?.isDefault || id === "starter" || id === "local-starter" || id === LOCAL_DEFAULT_PLAYLIST_ID;
  }

  function hasUserData(data){
    if(!data || typeof data !== "object")return false;
    const words = Array.isArray(data.words) ? data.words : [];
    const lists = Array.isArray(data.lists) ? data.lists : [];
    return words.some(word => String(word?.front || "").trim() && String(word?.back || "").trim()) ||
      lists.some(list => !isDefaultList(list));
  }

  function dbRef(){
    try{
      if(typeof window.tnGetDb === "function"){
        const shared = window.tnGetDb();
        if(shared && typeof shared === "object")return shared;
      }
    }catch(e){}
    try{ if(typeof db !== "undefined" && db)return db; }catch(e){}
    try{
      const primary = parseData(localStorage.getItem(DATA_KEY)) || {};
      const backup = parseData(localStorage.getItem(SHADOW_KEY)) || {};
      const chosen = hasUserData(primary) || !hasUserData(backup) ? primary : backup;
      if(hasUserData(chosen) && typeof window.tnAdoptDb === "function")return window.tnAdoptDb(chosen);
      return chosen;
    }catch(e){}
    return {ui:"en",prefs:{frontLang:"en-US",backLang:"ja-JP"},lists:[],words:[],meta:{}};
  }

  function persist(){
    const data = dbRef();
    data.meta = data.meta || {};
    data.meta.updatedAt = new Date().toISOString();
    try{
      if(typeof window.tnWriteData === "function")window.tnWriteData(data);
      else localStorage.setItem(DATA_KEY,JSON.stringify(data));
    }catch(e){}
  }

  function toast(message){
    const t = $("toast");
    if(t){
      t.textContent = message;
      t.classList.add("show");
      setTimeout(() => t.classList.remove("show"),1600);
    }
  }

  function ensureData(){
    const data = dbRef();
    data.lists = Array.isArray(data.lists) ? data.lists : [];
    data.words = Array.isArray(data.words) ? data.words : [];
    data.prefs = data.prefs || {frontLang:"en-US",backLang:"ja-JP"};
    const legacyIds=new Set(["starter","local-starter"]);
    if(window.TangoNestDefaultPlaylist?.enforce)window.TangoNestDefaultPlaylist.enforce(data,{clone:false});
    else if(!data.lists.length){
      const at=new Date().toISOString();
      data.lists.unshift({id:LOCAL_DEFAULT_PLAYLIST_ID,name:DEFAULT_PLAYLIST_NAME,isDefault:true,createdAt:at,updatedAt:at});
    }
    const validListIds=new Set(data.lists.map(list=>list.id));
    data.words.forEach(word => {
      if(legacyIds.has(String(word.listId||""))&&validListIds.has(LOCAL_DEFAULT_PLAYLIST_ID))word.listId=LOCAL_DEFAULT_PLAYLIST_ID;
      else if(!validListIds.has(String(word.listId||"")))word.listId = "";
    });
    return data;
  }

  function listName(id,data){
    const source=data||ensureData();
    return source.lists.find(list => list.id === id)?.name || "Unfiled";
  }

  function wordCount(listId){
    return ensureData().words.filter(word => word.listId === listId).length;
  }

  function wordsForList(listId){
    return ensureData().words.filter(word => word.listId === listId);
  }

  function playlistLanguagePair(listId){
    const words = wordsForList(listId);
    if(!words.length)return "No words yet";
    const first = words[0];
    return `${languageLabel(first.frontLang)} -> ${languageLabel(first.backLang)}`;
  }

  function playlistProgress(listId){
    const words = wordsForList(listId);
    const learned = words.filter(word => engine()?.isMasteredWord(word) ?? word.status === "learned").length;
    const hard = words.filter(word => engine()?.isWeakWord(word) ?? word.status === "hard").length;
    return {learned,hard,total:words.length};
  }

  function friendlyDate(value){
    if(!value)return "Recently updated";
    const date = new Date(value);
    if(Number.isNaN(date.getTime()))return "Recently updated";
    return date.toLocaleDateString(undefined,{month:"short",day:"numeric"});
  }

  function languageLabel(code){
    const names = {
      "en-US":"English","en-GB":"English","ja-JP":"Japanese","ko-KR":"Korean",
      "zh-CN":"Chinese","zh-TW":"Chinese","fr-FR":"French","es-ES":"Spanish",
      "de-DE":"German","it-IT":"Italian","pt-BR":"Portuguese"
    };
    return names[code] || code || "Unknown";
  }

  function firstLatinLetter(word){
    const first = String(word?.front || "").trim().charAt(0).toUpperCase();
    return /^[A-Z]$/.test(first) ? first : "";
  }

  function filterState(){
    return {...filterValues};
  }

  function isFilterActive(state=filterState()){
    return !!String(state.query || "").trim() || state.language !== "all" || state.letter !== "all" || state.playlist !== "all" || state.pos !== "all" || state.favorite !== "all" || state.learning !== "all" || state.sort !== "newest";
  }

  function filteredWords(source){
    const data = source||ensureData();
    const state = filterState();
    let words = [...data.words];
    const query=String(state.query || "").trim().toLowerCase();
    if(query){
      const listNames=new Map(data.lists.map(list=>[list.id,list.name||"Unfiled"]));
      words = words.filter(word => [word.front,word.back,word.memo,word.tags,word.pos,word.gender,listNames.get(word.listId)||"Unfiled"].join(" ").toLowerCase().includes(query));
    }
    if(state.language !== "all")words = words.filter(word => word.frontLang === state.language || word.backLang === state.language);
    if(state.letter !== "all")words = words.filter(word => firstLatinLetter(word) === state.letter);
    if(state.playlist !== "all")words = words.filter(word => word.listId === state.playlist);
    if(state.pos !== "all")words = words.filter(word => String(word.pos || "") === state.pos);
    if(state.favorite === "saved")words = words.filter(word => !!word.saved);
    if(state.learning === "due")words = words.filter(word => engine()?.isDueWord(word) ?? false);
    if(state.learning === "weak")words = words.filter(word => engine()?.isWeakWord(word) ?? false);
    if(state.learning === "mastered")words = words.filter(word => engine()?.isMasteredWord(word) ?? false);
    if(state.learning === "new")words = words.filter(word => Number(word.reviewCount || 0) === 0);
    if(state.learning === "strong")words = words.filter(word => presentation()?.state(word).key === "strong");
    if(state.sort === "oldest")words.sort((a,b) => String(a.createdAt || a.created_at || "").localeCompare(String(b.createdAt || b.created_at || "")));
    if(state.sort === "newest")words.sort((a,b) => String(b.createdAt || b.created_at || "").localeCompare(String(a.createdAt || a.created_at || "")));
    if(state.sort === "front")words.sort((a,b) => String(a.front || "").localeCompare(String(b.front || ""),undefined,{sensitivity:"base"}));
    if(state.sort === "back")words.sort((a,b) => String(a.back || "").localeCompare(String(b.back || ""),undefined,{sensitivity:"base"}));
    if(state.sort === "review")words.sort((a,b) => String(a.nextReview || "9999-12-31").localeCompare(String(b.nextReview || "9999-12-31")));
    return words;
  }

  function options(items,current){
    return items.map(item => `<option value="${esc(item.value)}" ${item.value === current ? "selected" : ""}>${esc(item.label)}</option>`).join("");
  }

  function libraryShell(content){
    const tab = name => `role="tab" aria-selected="${activeView === name}" class="${activeView === name ? "active" : ""}"`;
    return `
      <div class="tn-library-shell">
        <div class="tn-library-top">
          <div>
            <span class="tn-library-kicker">Library</span>
            <h3>Your collection</h3>
          </div>
          <div class="tn-library-tabs" role="tablist" aria-label="Library views">
            <button type="button" data-library-view="words" ${tab("words")}>All</button>
            <button type="button" data-library-view="playlists" ${tab("playlists")}>Playlists</button>
            <button type="button" data-library-view="due" ${tab("due")}>Due</button>
            <button type="button" data-library-view="weak" ${tab("weak")}>Weak</button>
            <button type="button" data-library-view="mastered" ${tab("mastered")}>Mastered</button>
          </div>
        </div>
        ${content}
      </div>
    `;
  }

  function wordsTools(){
    const data = ensureData();
    const state = filterState();
    const languages = [...new Set(data.words.flatMap(word => [word.frontLang,word.backLang]).filter(Boolean))]
      .sort((a,b) => languageLabel(a).localeCompare(languageLabel(b)));
    const pos = [...new Set(data.words.map(word => word.pos).filter(Boolean))]
      .sort((a,b) => String(a).localeCompare(String(b)));
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(letter => ({value:letter,label:letter}));
    return `
      <div class="tn-library-tools">
        <label class="tn-library-search-label" for="tnLibrarySearch">Search your collection</label>
        <input id="tnLibrarySearch" type="search" placeholder="Word, meaning, tag, or playlist" value="${esc(state.query)}">
        <details class="tn-library-filter-panel">
          <summary>Filters and sort${isFilterActive(state)?" · Active":""}</summary>
          <div class="tn-library-filter-row">
            <select id="tnFilterLanguage" aria-label="Filter by language">${options([{value:"all",label:"All languages"},...languages.map(value => ({value,label:languageLabel(value)}))],state.language)}</select>
            <select id="tnFilterLetter" aria-label="Filter by first letter">${options([{value:"all",label:"All letters"},...letters],state.letter)}</select>
            <select id="tnFilterPlaylist" aria-label="Filter by playlist">${options([{value:"all",label:"All playlists"},...data.lists.map(list => ({value:list.id,label:list.name || "Untitled Playlist"}))],state.playlist)}</select>
            <select id="tnFilterPos" aria-label="Filter by part of speech">${options([{value:"all",label:"All POS"},...pos.map(value => ({value,label:value}))],state.pos)}</select>
            <select id="tnFilterFavorite" aria-label="Filter saved words">${options([{value:"all",label:"All favorites"},{value:"saved",label:"Saved only"}],state.favorite)}</select>
            <select id="tnFilterLearning" aria-label="Filter by learning state">${options([{value:"all",label:"All learning states"},{value:"due",label:"Due today"},{value:"weak",label:"Needs practice"},{value:"new",label:"New"},{value:"strong",label:"Strong"},{value:"mastered",label:"Mastered"}],state.learning)}</select>
            <select id="tnSortWords" aria-label="Sort words">${options([{value:"newest",label:"Newest added"},{value:"oldest",label:"Oldest added"},{value:"front",label:"Front A-Z"},{value:"back",label:"Back A-Z"},{value:"review",label:"Next review"}],state.sort)}</select>
            <button type="button" id="tnClearFilters" class="${isFilterActive(state) ? "is-active" : ""}">Reset</button>
          </div>
          <div class="tn-library-secondary-tools">
            <select id="tnDisplaySide" aria-label="Word row display"><option value="both" ${displaySide==="both"?"selected":""}>Front + Back</option><option value="front" ${displaySide==="front"?"selected":""}>Front only</option><option value="back" ${displaySide==="back"?"selected":""}>Back only</option></select>
            <select id="tnAudioSide" aria-label="Word row audio"><option value="front" ${audioSide==="front"?"selected":""}>Play front</option><option value="back" ${audioSide==="back"?"selected":""}>Play back</option></select>
            <button type="button" data-select-visible>Select visible</button>
            <button type="button" data-delete-selected ${selectedWordIds.size?"":"disabled"}>Delete selected${selectedWordIds.size?` (${selectedWordIds.size})`:""}</button>
            <span>Use Up / Down to arrange a playlist.</span>
          </div>
        </details>
      </div>
    `;
  }

  function learningDisplay(word){
    return presentation()?.state(word) || {key:"learning",label:"Learning",tone:"learning"};
  }

  function iconAudio(){
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"></path><path d="M16 9.5a4 4 0 0 1 0 5"></path><path d="M18.5 7a7 7 0 0 1 0 10"></path></svg>`;
  }

  function iconTrash(){
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M6 7l1 14h10l1-14"></path><path d="M9 7V4h6v3"></path></svg>`;
  }

  function wordsView(mode="words"){
    const data=ensureData();
    let allWords = filteredWords(data);
    if(mode === "due"){
      allWords = allWords.filter(word => engine()?.isDueWord(word) ?? false);
    }
    if(mode === "weak"){
      allWords = allWords.filter(word => engine()?.isWeakWord(word) ?? false);
    }
    if(mode === "mastered"){
      allWords = allWords.filter(word => engine()?.isMasteredWord(word) ?? false);
    }
    const words = allWords.slice(0,renderLimit);
    const hiddenCount = Math.max(0,allWords.length - words.length);
    const body = allWords.length ? `
      <div class="tn82-word-list">
        ${words.map(word => {
          const learning=learningDisplay(word);
          const next=presentation()?.review(word)?.label||"Review not scheduled";
          return `
          <article class="tn82-word-card tn-word-row" data-word-id="${esc(word.id)}">
            <input type="checkbox" class="tn-word-select" data-select-word="${esc(word.id)}" ${selectedWordIds.has(word.id)?"checked":""} aria-label="Select ${esc(word.front)}">
            <button type="button" class="tn82-word-main" data-open-word="${esc(word.id)}" aria-label="Open details for ${esc(word.front)}">
              ${displaySide!=="back"?`<div class="tn82-front">${esc(word.front)}</div>`:""}
              ${displaySide!=="front"?`<div class="tn82-back">${esc(word.back)}</div>`:""}
              ${word.memo ? `<div class="tn-word-example">${esc(word.memo)}</div>` : ""}
            </button>
            <div class="tn82-word-meta">
              <span>${esc(listName(word.listId,data))}</span>
              <span class="tn-learning-badge ${esc(learning.tone)}">${esc(learning.label)}</span>
              <span class="tn-review-label">${esc(next)}</span>
              ${word.pos ? `<span>${esc(word.pos)}</span>` : ""}
              <button type="button" class="tn-word-action ${word.saved ? "is-saved" : ""}" data-word-fav="${esc(word.id)}" title="Favorite" aria-label="Toggle favorite">${word.saved ? "★" : "☆"}</button>
              <button type="button" class="tn-word-action" data-word-audio="${esc(word.id)}" title="Play audio" aria-label="Play ${audioSide} word audio">${iconAudio()}</button>
              <button type="button" class="tn-word-action" data-word-move="${esc(word.id)}" data-move-direction="-1" title="Move up" aria-label="Move ${esc(word.front)} up">Up</button>
              <button type="button" class="tn-word-action" data-word-move="${esc(word.id)}" data-move-direction="1" title="Move down" aria-label="Move ${esc(word.front)} down">Down</button>
              <button type="button" class="tn-word-action danger" data-word-delete="${esc(word.id)}" title="Delete word" aria-label="Delete word">${iconTrash()}</button>
            </div>
          </article>
        `;}).join("")}
      </div>
      ${hiddenCount ? `<div class="tn82-library-summary tn-load-more-row"><span>${hiddenCount} more word${hiddenCount === 1 ? "" : "s"} hidden for speed.</span><button type="button" class="tn-load-more-btn" data-load-more>Load more</button></div>` : ""}
    ` : `
      <div class="tn-library-empty">
        <h3>${isFilterActive() ? "No words found" : mode === "due" ? "You’re all caught up" : mode === "weak" ? "No weak words" : mode === "mastered" ? "No mastered words yet" : "No words yet"}</h3>
        <p>${isFilterActive() ? "Try changing your search or reset the filters." : mode === "due" ? "Nothing needs review today. Nice work." : mode === "weak" ? "Words that need more practice will appear here." : mode === "mastered" ? "Words appear here after several stable reviews." : "Add your first word to start building your vocabulary."}</p>
        <button type="button" data-go-create>Add word</button>
      </div>
    `;
    const title = mode === "due" ? "Due Today" : mode === "weak" ? "Needs Practice" : mode === "mastered" ? "Mastered" : "All Words";
    return libraryShell(`
      ${wordsTools()}
      <div class="tn82-library-summary">${title}: ${allWords.length} word${allWords.length === 1 ? "" : "s"} found${hiddenCount ? ` · ${words.length} rendered` : ""}</div>
      ${body}
    `);
  }

  function playlistsView(){
    const data = ensureData();
    const cards = data.lists.length ? `
      <div class="tn-library-playlist-grid">
        ${data.lists.map(list => {
          const progress = playlistProgress(list.id);
          return `
          <article class="tn-library-playlist-card" data-playlist-id="${esc(list.id)}">
            <button type="button" class="tn-playlist-open" data-open-playlist="${esc(list.id)}">
              <span class="tn-playlist-art">${esc(String(list.name || "N").slice(0,2).toUpperCase())}</span>
              <span class="tn-playlist-copy">
                <strong>${esc(list.name || "Untitled Playlist")}</strong>
                <em>${progress.total} word${progress.total === 1 ? "" : "s"} · ${esc(playlistLanguagePair(list.id))}</em>
                <small>${progress.learned} mastered · ${progress.hard} weak · ${esc(friendlyDate(list.updatedAt || list.createdAt))}</small>
              </span>
            </button>
            <div class="tn-playlist-actions">
              <button type="button" data-playlist-mode="quiz" data-playlist-id="${esc(list.id)}" aria-label="Quiz ${esc(list.name)}">Quiz</button>
              <button type="button" data-playlist-mode="cards" data-playlist-id="${esc(list.id)}" aria-label="Study ${esc(list.name)} with cards">Cards</button>
              <button type="button" data-playlist-mode="listen" data-playlist-id="${esc(list.id)}" aria-label="Listen to ${esc(list.name)}">Listen</button>
              ${isDefaultList(list)?'<span class="tn-default-playlist-label">Default</span>':`<button type="button" data-rename-playlist="${esc(list.id)}" aria-label="Rename ${esc(list.name)}">Rename</button><button type="button" class="tn-playlist-delete-btn" data-delete-playlist="${esc(list.id)}" aria-label="Delete ${esc(list.name)}">Delete</button>`}
              ${isDefaultList(list)?"":`<button type="button" class="tn-playlist-menu-btn" data-menu-playlist="${esc(list.id)}" aria-label="More actions for ${esc(list.name)}">...</button>`}
            </div>
          </article>
        `;}).join("")}
      </div>
    ` : `
      <div class="tn-library-empty">
        <h3>No playlists yet</h3>
        <p>Create a playlist, then collect words into it.</p>
        <button type="button" data-go-create>Create playlist</button>
      </div>
    `;
    return libraryShell(`
      <div class="tn-library-playlists-head">
        <h3>Playlists</h3>
        <div><span>${data.lists.length} list${data.lists.length === 1 ? "" : "s"}</span><button type="button" data-go-create>New playlist</button></div>
      </div>
      ${cards}
    `);
  }

  function renderLibrary(){
    const mount = $("tn82LibraryMount");
    if(!mount)return;
    const validIds=new Set(ensureData().words.map(word=>word.id));
    selectedWordIds.forEach(id=>{if(!validIds.has(id))selectedWordIds.delete(id)});
    if(!["words","playlists","due","weak","mastered"].includes(activeView))activeView = "words";
    mount.innerHTML = activeView === "playlists" ? playlistsView() : wordsView(activeView);
    bindLibraryUi();
    updateHeaderCounts();
  }

  function updateHeaderCounts(){
    const data = ensureData();
    const learned = data.words.filter(word => engine()?.isMasteredWord(word) ?? word.status === "learned").length;
    const hard = data.words.filter(word => engine()?.isWeakWord(word) ?? word.status === "hard").length;
    const set = (id,value) => { const el = $(id); if(el)el.textContent = value; };
    ["wc","dashTotal"].forEach(id => set(id,data.words.length));
    ["listCount"].forEach(id => set(id,data.lists.length));
    ["lc"].forEach(id => set(id,learned));
    ["hc","dashHard"].forEach(id => set(id,hard));
  }

  function resetFilters(){
    renderLimit = WORD_RENDER_LIMIT;
    clearTimeout(searchRenderTimer);
    Object.assign(filterValues,{query:"",language:"all",letter:"all",playlist:"all",pos:"all",favorite:"all",learning:"all",sort:"newest"});
    renderLibrary();
  }

  function switchView(view){
    activeView = ["words","playlists","due","weak","mastered"].includes(view) ? view : "words";
    renderLimit = WORD_RENDER_LIMIT;
    localStorage.setItem("tangonest_library_view_v1",activeView);
    renderLibrary();
  }

  function openPlaylist(listId){
    activeView = "words";
    renderLimit = WORD_RENDER_LIMIT;
    filterValues.playlist=listId;
    localStorage.setItem("tangonest_library_view_v1",activeView);
    renderLibrary();
  }

  function normalizePage(page){
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

  function legacyPage(page){
    return {create:"add",library:"words",cards:"study",listen:"audio",settings:"manage"}[page] || page;
  }

  function stableNavigate(page){
    page = normalizePage(page);
    if(!["home","create","library","cards","quiz","listen","settings"].includes(page))page = "home";
    localStorage.setItem("tangonest_last_page_v2",page);

    const ids = {
      home:"pageHome",
      create:"pageAdd",
      library:"pageWords",
      cards:"pageStudy",
      quiz:"pageQuiz",
      listen:"pageAudio",
      settings:"pageManage"
    };
    document.querySelectorAll(".page").forEach(section => section.classList.remove("active"));
    const target = $(ids[page]);
    if(target)target.classList.add("active");

    document.querySelectorAll(".nav button,.mobile-tabbar button,.mobile-add-button").forEach(button => {
      const textPage = normalizePage(button.textContent);
      const idPage = normalizePage((button.id || "").replace(/^m?nav/i,""));
      button.classList.toggle("active",textPage === page || idPage === page);
    });

    try{ if(typeof window.render === "function")window.render(); }catch(e){}
    if(page === "quiz"){
      try{ if(typeof window.resetQuiz === "function")window.resetQuiz(); }catch(e){}
    }
    if(page === "library")renderLibrary();
    const shellLabels={
      home:["Study Focus","Home"],create:["Collection","Add Words"],library:["Collection","Library"],
      cards:["Practice","Cards"],quiz:["Practice","Quiz"],listen:["Practice","Listen"],settings:["TangoNest","Settings"]
    };
    const labels=shellLabels[page]||shellLabels.home;
    if($("appPageEyebrow"))$("appPageEyebrow").textContent=labels[0];
    if($("appPageTitle"))$("appPageTitle").textContent=labels[1];
    if($("mnavAdd"))$("mnavAdd").hidden=page!=="library";
    document.title=`${labels[1]} · TangoNest`;
    try{window.tnUpdateShellContext?.(page)}catch(error){}
    stabilizeHeader();
  }

  function installStableNavigation(){
    const nav = page => stableNavigate(page);
    nav.__tnLibraryStable = true;
    window.go = nav;
    window.appShow = nav;
    window.showPage = nav;
    const navTargets={
      navHome:"home",navWords:"library",navStudy:"cards",navQuiz:"quiz",navAudio:"listen",navManage:"settings",navAdd:"create",
      mnavHome:"home",mnavWords:"library",mnavStudy:"cards",mnavQuiz:"quiz",mnavAudio:"listen",mnavManage:"settings",mnavAdd:"create"
    };
    Object.entries(navTargets).forEach(([id,page])=>{
      const button=$(id);
      if(!button || button.dataset.tnStableNav)return;
      button.dataset.tnStableNav="1";
      button.addEventListener("click",event=>{
        event.preventDefault();
        stableNavigate(page);
      });
    });
  }

  function goToCreate(){
    stableNavigate("create");
  }

  function startPlaylistMode(listId,mode){
    const page = normalizePage(mode);
    const selectIds = {quiz:"quizList",cards:"studyList",listen:"audioList"};
    const select = $(selectIds[page]);
    if(select && [...select.options].some(option => option.value === listId))select.value = listId;
    if(page === "cards"){
      try{ if(typeof window.resetCard === "function")window.resetCard(); }catch(e){}
    }
    stableNavigate(page);
  }

  async function cloudDeleteWord(id){
    try{
      const client = typeof window.tnCloudClient === "function" ? window.tnCloudClient() : null;
      if(!client?.auth)return;
      const userResult = await client.auth.getUser();
      const userId = userResult?.data?.user?.id;
      if(!userId)return;
      await client.from("tn_words").delete().eq("id",id).eq("user_id",userId);
    }catch(error){
      console.warn("Word cloud deletion sync skipped",error);
    }
  }

  function wordById(id){
    return ensureData().words.find(word => word.id === id);
  }

  function playWord(id,side=audioSide){
    const word = wordById(id);
    if(!word)return;
    const text = side === "back" ? word.back : word.front;
    const lang = side === "back" ? word.backLang : word.frontLang;
    if(typeof window.speakText === "function")window.speakText(text,lang);
    else if(typeof window.speak === "function")window.speak(text,lang);
  }

  function toggleFavorite(id){
    if(typeof window.tnToggleFavorite === "function"){
      window.tnToggleFavorite(id);
      return;
    }
    const word = wordById(id);
    if(!word)return;
    word.saved = !word.saved;
    persist();
    renderLibrary();
    renderWordDetail(id);
    if(typeof window.tnSyncWord === "function")window.tnSyncWord(id);
  }

  function deleteWord(id){
    if(typeof window.tnDeleteWord === "function"){
      hideWordDetail();
      window.tnDeleteWord(id);
      return;
    }
    const data = ensureData();
    const word = wordById(id);
    if(!word)return toast("Word not found");
    if(!confirm(`Delete "${word.front}"?`))return;
    data.words = data.words.filter(item => item.id !== id);
    persist();
    hideWordDetail();
    renderLibrary();
    try{ if(typeof renderHome === "function")renderHome(); }catch(e){}
    cloudDeleteWord(id);
    toast("Word deleted");
  }

  function renderWordDetail(id,trigger=null){
    const word = wordById(id);
    if(!word)return;
    const learning=presentation()?.state(word)||{label:"Learning",tone:"learning"};
    const nextReview=presentation()?.review(word)?.label||"Review not scheduled";
    const accuracy=presentation()?.accuracy(word)?.label||"Not studied yet";
    const lastStudied=presentation()?.lastStudied(word)||"Not studied yet";
    let panel = $("tnWordDetailPanel");
    if(!panel){
      panel = document.createElement("div");
      panel.id = "tnWordDetailPanel";
      panel.className = "tn-word-detail-panel";
      document.body.appendChild(panel);
    }
    returnFocus.detail={element:trigger||document.activeElement,wordId:id};
    panel.innerHTML = `
      <div class="tn-word-detail-card" role="dialog" aria-modal="true" aria-labelledby="tnWordDetailTitle">
        <button type="button" class="tn-detail-close" data-close-word-detail>Close</button>
        <div class="tn-detail-kicker">${esc(languageLabel(word.frontLang))} -> ${esc(languageLabel(word.backLang))}</div>
        <h2 id="tnWordDetailTitle">${esc(word.front)}</h2>
        <p class="tn-detail-meaning">${esc(word.back)}</p>
        <div class="tn-detail-actions">
          <button type="button" data-detail-audio="${esc(word.id)}">${iconAudio()} Audio</button>
          <button type="button" data-detail-fav="${esc(word.id)}">${word.saved ? "★ Saved" : "☆ Save"}</button>
          ${typeof window.openEdit === "function" ? `<button type="button" data-detail-edit="${esc(word.id)}">Edit</button>` : ""}
          <button type="button" class="danger" data-detail-delete="${esc(word.id)}">Delete</button>
        </div>
        <div class="tn-detail-grid">
          <div><span>Playlist</span><strong>${esc(listName(word.listId))}</strong></div>
          <div><span>Front language</span><strong>${esc(languageLabel(word.frontLang))}</strong></div>
          <div><span>Back language</span><strong>${esc(languageLabel(word.backLang))}</strong></div>
          <div><span>POS</span><strong>${esc(word.pos || "-")}</strong></div>
          <div><span>Gender</span><strong>${esc(word.gender || "-")}</strong></div>
          <div><span>Learning</span><strong class="tn-learning-badge ${esc(learning.tone)}">${esc(learning.label)}</strong></div>
          <div><span>Accuracy</span><strong>${esc(accuracy)}</strong></div>
          <div><span>Last studied</span><strong>${esc(lastStudied)}</strong></div>
          <div><span>Next review</span><strong>${esc(nextReview)}</strong></div>
        </div>
        ${word.memo ? `<section class="tn-detail-example"><span>Example</span><p>${esc(word.memo)}</p><button type="button" class="tn-example-audio" data-example-audio="${esc(word.id)}">${iconAudio()} Example audio</button></section>` : ""}
      </div>
    `;
    panel.classList.add("show");
    setTimeout(()=>panel.querySelector("[data-close-word-detail]")?.focus({preventScroll:true}),0);
  }

  function hideWordDetail(){
    $("tnWordDetailPanel")?.classList.remove("show");
    const target=returnFocus.detail?.element?.isConnected&&returnFocus.detail.element.matches?.("[data-open-word]")
      ? returnFocus.detail.element
      : [...document.querySelectorAll("[data-open-word]")].find(element=>element.dataset.openWord===returnFocus.detail?.wordId);
    target?.focus({preventScroll:true});
    returnFocus.detail=null;
  }

  function renamePlaylist(listId,trigger=null){
    const list=ensureData().lists.find(item=>item.id===listId);
    if(!list)return toast("Playlist not found");
    pendingRenameId=listId;
    returnFocus.rename={element:trigger||document.activeElement,listId};
    let modal=$("tnPlaylistRenameModal");
    if(!modal){
      modal=document.createElement("div");
      modal.id="tnPlaylistRenameModal";
      modal.className="tn-rename-modal";
      document.body.appendChild(modal);
    }
    modal.innerHTML=`
      <div class="tn-rename-dialog" role="dialog" aria-modal="true" aria-labelledby="tnRenameTitle">
        <h2 id="tnRenameTitle">Rename playlist</h2>
        <label for="tnRenamePlaylistInput">Playlist name</label>
        <input id="tnRenamePlaylistInput" value="${esc(list.name||"")}" maxlength="80" autocomplete="off">
        <div class="tn-rename-actions">
          <button type="button" data-cancel-rename>Cancel</button>
          <button type="button" data-confirm-rename>Save name</button>
        </div>
      </div>`;
    modal.classList.add("show");
    setTimeout(()=>{$("tnRenamePlaylistInput")?.focus({preventScroll:true});$("tnRenamePlaylistInput")?.select()},0);
  }

  function hideRenameModal(){
    $("tnPlaylistRenameModal")?.classList.remove("show");
    pendingRenameId="";
    const target=returnFocus.rename?.element?.isConnected&&returnFocus.rename.element.matches?.("[data-rename-playlist]")
      ? returnFocus.rename.element
      : [...document.querySelectorAll("[data-rename-playlist]")].find(element=>element.dataset.renamePlaylist===returnFocus.rename?.listId);
    target?.focus({preventScroll:true});
    returnFocus.rename=null;
  }

  async function confirmRename(){
    const clean=String($("tnRenamePlaylistInput")?.value||"").trim();
    if(!clean)return toast("Playlist name is required");
    const listId=pendingRenameId;
    if(!listId)return;
    if(typeof window.tnRenamePlaylist==="function")await window.tnRenamePlaylist(listId,clean);
    else{
      if($("renameListSelect"))$("renameListSelect").value=listId;
      if($("renameListInput"))$("renameListInput").value=clean;
      await window.renameList?.();
    }
    renderLibrary();
    hideRenameModal();
  }

  function showContextMenu(listId,x,y){
    hideContextMenu();
    contextTargetId = listId;
    const menu = document.createElement("div");
    menu.id = "tnPlaylistContextMenu";
    menu.className = "tn-context-menu";
    menu.style.left = Math.min(x,window.innerWidth - 210) + "px";
    menu.style.top = Math.min(y,window.innerHeight - 82) + "px";
    menu.innerHTML = `<button type="button" data-context-delete>Delete playlist</button>`;
    document.body.appendChild(menu);
  }

  function hideContextMenu(){
    $("tnPlaylistContextMenu")?.remove();
  }

  function showDeleteModal(listId,trigger=null){
    hideContextMenu();
    pendingDeleteId = listId;
    returnFocus.delete={element:trigger||document.activeElement,listId};
    const list = ensureData().lists.find(item => item.id === listId);
    if(!list)return toast("Playlist not found");
    let modal = $("tnPlaylistDeleteModal");
    if(!modal){
      modal = document.createElement("div");
      modal.id = "tnPlaylistDeleteModal";
      modal.className = "tn-delete-modal";
      document.body.appendChild(modal);
    }
    modal.innerHTML = `
      <div class="tn-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="tnDeleteTitle">
        <h2 id="tnDeleteTitle">Delete playlist?</h2>
        <p>The playlist will be deleted. Words inside it will remain in your Library.</p>
        <strong>${esc(list.name || "Untitled Playlist")}</strong>
        <div class="tn-delete-actions">
          <button type="button" data-cancel-delete>Cancel</button>
          <button type="button" data-confirm-delete>Delete playlist</button>
        </div>
      </div>
    `;
    modal.classList.add("show");
    setTimeout(()=>modal.querySelector("[data-cancel-delete]")?.focus({preventScroll:true}),0);
  }

  function hideDeleteModal(){
    $("tnPlaylistDeleteModal")?.classList.remove("show");
    pendingDeleteId = "";
    const target=returnFocus.delete?.element?.isConnected&&returnFocus.delete.element.matches?.("[data-delete-playlist]")
      ? returnFocus.delete.element
      : [...document.querySelectorAll("[data-delete-playlist]")].find(element=>element.dataset.deletePlaylist===returnFocus.delete?.listId);
    target?.focus({preventScroll:true});
    returnFocus.delete=null;
  }

  async function syncPlaylistDeletion(listId){
    try{
      const client = typeof window.tnCloudClient === "function" ? window.tnCloudClient() : null;
      if(!client?.auth)return;
      const userResult = await client.auth.getUser();
      const userId = userResult?.data?.user?.id;
      if(!userId)return;
      await client.from("tn_words").update({playlist_id:null}).eq("playlist_id",listId).eq("user_id",userId);
      await client.from("tn_playlists").delete().eq("id",listId).eq("user_id",userId);
      if(typeof window.tnCloudLoad === "function")setTimeout(() => window.tnCloudLoad(),200);
    }catch(error){
      console.warn("Playlist cloud deletion sync skipped",error);
    }
  }

  function deletePlaylist(listId){
    if(typeof window.tnDeletePlaylist === "function"){
      hideDeleteModal();
      window.tnDeletePlaylist(listId,{confirmed:true});
      return;
    }
    const data = ensureData();
    const list = data.lists.find(item => item.id === listId);
    if(!list)return toast("Playlist not found");
    data.words.forEach(word => {
      if(word.listId === listId)word.listId = "";
    });
    data.lists = data.lists.filter(item => item.id !== listId);
    persist();
    renderSelectsSafe();
    if(filterValues.playlist === listId)filterValues.playlist = "all";
    renderLibrary();
    try{ if(typeof renderHome === "function")renderHome(); }catch(e){}
    syncPlaylistDeletion(listId);
    hideDeleteModal();
    toast("Playlist deleted");
  }

  function renderSelectsSafe(){
    const data = ensureData();
    ["addList","bulkList","studyList","quizList","audioList","renameListSelect","editList"].forEach(id => {
      const el = $(id);
      if(!el)return;
      const current = el.value;
      const hasRendered=el.dataset.tnSelectionReady==="1";
      const unfiled=["addList","bulkList","editList"].includes(id);
      const allWords=["studyList","quizList","audioList"].includes(id);
      const availableLists=id==="renameListSelect"?data.lists.filter(list=>!isDefaultList(list)):data.lists;
      const virtual=unfiled?'<option value="">No playlist</option>':allWords?'<option value="all">All words</option>':"";
      el.innerHTML = virtual+availableLists.map(list => `<option value="${esc(list.id)}">${esc(list.name || "Untitled Playlist")}</option>`).join("");
      const canRestore=[...el.options].some(option=>option.value===current) && (current!=="" || !unfiled || hasRendered);
      if(canRestore)el.value = current;
      else if(allWords)el.value="all";
      else if(unfiled)el.value=(data.lists.find(isDefaultList)||data.lists[0])?.id||"";
      el.dataset.tnSelectionReady="1";
      const renameUnavailable=id==="renameListSelect"&&!availableLists.length;
      el.disabled=renameUnavailable;
      if(id==="renameListSelect"){
        if($("renameListInput"))$("renameListInput").disabled=renameUnavailable;
        if($("renameListButton"))$("renameListButton").disabled=renameUnavailable;
      }
    });
  }

  function stabilizeHeader(){
    moveCloudPanelsToSettings();
    const header = $("tn80HeaderCloud");
    if(header){
      header.title = "Cloud sync details are in Settings.";
      header.style.minWidth = "76px";
      header.style.width = "76px";
    }
    const pill = $("tn80StatusPill");
    if(pill){
      pill.style.minWidth = "62px";
    }
  }

  function moveCloudPanelsToSettings(){
    const settings = $("pageManage");
    const host = settings?.querySelector(".card") || settings;
    if(!host)return;
    ["tn80CloudPanel","tn78CloudBox"].forEach(id => {
      const panel = $(id);
      if(panel && panel.parentElement !== host){
        host.insertBefore(panel,host.firstChild);
      }
    });
  }

  function bindLibraryUi(){
    const filterKeys={tnLibrarySearch:"query",tnFilterLanguage:"language",tnFilterLetter:"letter",tnFilterPlaylist:"playlist",tnFilterPos:"pos",tnFilterFavorite:"favorite",tnFilterLearning:"learning",tnSortWords:"sort"};
    Object.keys(filterKeys).forEach(id => {
      const el = $(id);
      if(el && !el.__tnLibraryBound){
        el.addEventListener(el.tagName === "INPUT" ? "input" : "change",() => {
          const shouldRefocus = id === "tnLibrarySearch";
          filterValues[filterKeys[id]]=el.value;
          renderLimit = WORD_RENDER_LIMIT;
          const update=()=>{
            renderLibrary();
            if(!shouldRefocus)return;
            requestAnimationFrame(() => {
              const next = $("tnLibrarySearch");
              if(next){
                try{next.focus({preventScroll:true})}catch(e){next.focus()}
                const len = next.value.length;
                try{ next.setSelectionRange(len,len); }catch(e){}
              }
            });
          };
          if(shouldRefocus){
            clearTimeout(searchRenderTimer);
            searchRenderTimer=setTimeout(update,120);
          }else update();
        });
        el.__tnLibraryBound = true;
      }
    });
    const clear = $("tnClearFilters");
    if(clear)clear.onclick = resetFilters;
    const side=$("tnDisplaySide");
    if(side)side.onchange=()=>{displaySide=side.value;localStorage.setItem("tangonest_library_side_v1",displaySide);renderLibrary()};
    const audio=$("tnAudioSide");
    if(audio)audio.onchange=()=>{audioSide=audio.value;localStorage.setItem("tangonest_library_audio_side_v1",audioSide)};
  }

  document.addEventListener("change",event => {
    const selected=event.target?.closest?.("[data-select-word]");
    if(!selected)return;
    const id=selected.dataset.selectWord;
    selected.checked?selectedWordIds.add(id):selectedWordIds.delete(id);
    try{window.toggleSelected?.(id,selected.checked)}catch(e){}
    const button=$("tn82LibraryMount")?.querySelector("[data-delete-selected]");
    if(button){button.disabled=!selectedWordIds.size;button.textContent=`Delete selected${selectedWordIds.size?` (${selectedWordIds.size})`:""}`}
  },true);

  document.addEventListener("click",event => {
    if(event.target?.closest?.("[data-select-visible]")){
      const boxes=[...$("tn82LibraryMount").querySelectorAll("[data-select-word]")];
      const selectAll=boxes.some(box=>!box.checked);
      boxes.forEach(box=>{box.checked=selectAll;selectAll?selectedWordIds.add(box.dataset.selectWord):selectedWordIds.delete(box.dataset.selectWord);try{window.toggleSelected?.(box.dataset.selectWord,selectAll)}catch(e){}});
      renderLibrary();
      return;
    }
    if(event.target?.closest?.("[data-delete-selected]")){
      Promise.resolve(window.deleteSelected?.()).finally(()=>{selectedWordIds.clear();renderLibrary()});
      return;
    }
    const loadMore = event.target?.closest?.("[data-load-more]");
    if(loadMore){
      event.preventDefault();
      renderLimit += WORD_RENDER_LIMIT;
      renderLibrary();
      return;
    }
    const view = event.target?.closest?.("[data-library-view]");
    if(view){
      event.preventDefault();
      switchView(view.dataset.libraryView);
      return;
    }
    const create = event.target?.closest?.("[data-go-create]");
    if(create){
      event.preventDefault();
      goToCreate();
      return;
    }
    const mode = event.target?.closest?.("[data-playlist-mode]");
    if(mode){
      event.preventDefault();
      event.stopPropagation();
      startPlaylistMode(mode.dataset.playlistId,mode.dataset.playlistMode);
      return;
    }
    const rename=event.target?.closest?.("[data-rename-playlist]");
    if(rename){
      event.preventDefault();
      event.stopPropagation();
      renamePlaylist(rename.dataset.renamePlaylist,rename);
      return;
    }
    const wordFav = event.target?.closest?.("[data-word-fav],[data-detail-fav]");
    if(wordFav){
      event.preventDefault();
      event.stopPropagation();
      toggleFavorite(wordFav.dataset.wordFav || wordFav.dataset.detailFav);
      return;
    }
    const wordAudio = event.target?.closest?.("[data-word-audio],[data-detail-audio]");
    if(wordAudio){
      event.preventDefault();
      event.stopPropagation();
      playWord(wordAudio.dataset.wordAudio || wordAudio.dataset.detailAudio);
      return;
    }
    const exampleAudio=event.target?.closest?.("[data-example-audio]");
    if(exampleAudio){
      event.preventDefault();
      event.stopPropagation();
      window.tnSpeakExample?.(exampleAudio.dataset.exampleAudio);
      return;
    }
    const wordMove=event.target?.closest?.("[data-word-move]");
    if(wordMove){
      event.preventDefault();
      event.stopPropagation();
      window.moveWord?.(wordMove.dataset.wordMove,Number(wordMove.dataset.moveDirection||0));
      renderLibrary();
      return;
    }
    const wordDelete = event.target?.closest?.("[data-word-delete],[data-detail-delete]");
    if(wordDelete){
      event.preventDefault();
      event.stopPropagation();
      deleteWord(wordDelete.dataset.wordDelete || wordDelete.dataset.detailDelete);
      return;
    }
    const wordEdit = event.target?.closest?.("[data-detail-edit]");
    if(wordEdit){
      event.preventDefault();
      event.stopPropagation();
      try{ if(typeof window.openEdit === "function")window.openEdit(wordEdit.dataset.detailEdit); }catch(e){}
      hideWordDetail();
      return;
    }
    if(event.target?.closest?.("[data-close-word-detail]")){
      event.preventDefault();
      hideWordDetail();
      return;
    }
    if(event.target?.id === "tnWordDetailPanel"){
      hideWordDetail();
      return;
    }
    const wordOpen = event.target?.closest?.("[data-open-word]");
    if(wordOpen){
      event.preventDefault();
      renderWordDetail(wordOpen.dataset.openWord,wordOpen);
      return;
    }
    const open = event.target?.closest?.("[data-open-playlist]");
    if(open){
      event.preventDefault();
      openPlaylist(open.dataset.openPlaylist);
      return;
    }
    const directDelete = event.target?.closest?.("[data-delete-playlist]");
    if(directDelete){
      event.preventDefault();
      event.stopPropagation();
      showDeleteModal(directDelete.dataset.deletePlaylist,directDelete);
      return;
    }
    const menu = event.target?.closest?.("[data-menu-playlist]");
    if(menu){
      event.preventDefault();
      event.stopPropagation();
      const rect = menu.getBoundingClientRect();
      showContextMenu(menu.dataset.menuPlaylist,rect.left,rect.bottom + 8);
      return;
    }
    if(event.target?.closest?.("[data-context-delete]")){
      showDeleteModal(contextTargetId);
      return;
    }
    if(event.target?.closest?.("[data-cancel-delete]")){
      hideDeleteModal();
      return;
    }
    if(event.target?.closest?.("[data-confirm-delete]")){
      deletePlaylist(pendingDeleteId);
      return;
    }
    if(event.target?.closest?.("[data-cancel-rename]") || event.target?.id==="tnPlaylistRenameModal"){
      hideRenameModal();
      return;
    }
    if(event.target?.closest?.("[data-confirm-rename]")){
      confirmRename();
      return;
    }
    if(!event.target?.closest?.("#tnPlaylistContextMenu"))hideContextMenu();
  },true);

  document.addEventListener("contextmenu",event => {
    const card = event.target?.closest?.("[data-playlist-id],.playlist-card");
    if(!card)return;
    const listId = card.dataset.playlistId || card.querySelector("[data-open-playlist]")?.dataset.openPlaylist;
    if(!listId)return;
    event.preventDefault();
    showContextMenu(listId,event.clientX,event.clientY);
  },true);

  document.addEventListener("keydown",event => {
    if(event.key === "Escape"){
      hideContextMenu();
      hideDeleteModal();
      hideRenameModal();
      hideWordDetail();
      if($("editModal")?.classList.contains("show"))window.closeEdit?.();
      if($("detailModal")?.classList.contains("show"))window.closeDetail?.();
    }
    if(event.key === "Enter" && event.target?.id === "tnRenamePlaylistInput"){
      event.preventDefault();
      confirmRename();
    }
    if(event.key === "Tab"){
      const dialog=document.querySelector(".tn-rename-modal.show [role='dialog'],.tn-delete-modal.show [role='dialog'],.tn-word-detail-panel.show [role='dialog'],.modal-backdrop.show [role='dialog']");
      if(!dialog)return;
      const focusable=[...dialog.querySelectorAll("button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]")];
      if(!focusable.length)return;
      const first=focusable[0];
      const last=focusable[focusable.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    }
  });

  const previousRenderWords = window.renderWords;
  window.tnLibraryRender = renderLibrary;
  window.renderWords = function(){
    renderLibrary();
    try{ if(typeof previousRenderWords === "function" && !document.getElementById("tn82LibraryMount"))previousRenderWords(); }catch(e){}
  };
  window.tnDeletePlaylist = showDeleteModal;
  window.tnOpenLibraryView = switchView;
  window.tnStableHeader = stabilizeHeader;
  window.tnStableNavigate = stableNavigate;
  installStableNavigation();

  function boot(){
    ensureData();
    renderSelectsSafe();
    renderLibrary();
    stabilizeHeader();
    installStableNavigation();
    const active=document.querySelector(".page.active");
    if(active)stableNavigate(active.id);
  }

  if(document.readyState === "loading")document.addEventListener("DOMContentLoaded",boot);
  else boot();
  window.addEventListener("pageshow",installStableNavigation);
  window.addEventListener("pagehide",()=>clearTimeout(searchRenderTimer),{once:true});
})();
