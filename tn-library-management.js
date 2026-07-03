(function(){
  "use strict";

  const DATA_KEY = "tangonest_production_stable_v1";
  const SHADOW_KEY = "tangonest_last_good_data_v1";
  const RESET_KEY = "tangonest_beta83_library_clean_reset_v1";
  const WORD_RENDER_LIMIT = 200;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let activeView = localStorage.getItem("tangonest_library_view_v1") || "words";
  let renderLimit = WORD_RENDER_LIMIT;
  let pendingDeleteId = "";
  let contextTargetId = "";
  window.__tnLibraryManagementActive = true;

  function parseData(raw){
    try{return raw ? JSON.parse(raw) : null;}catch(e){return null;}
  }

  function isDefaultList(list){
    const id = String(list?.id || "");
    const name = String(list?.name || "").trim().toLowerCase();
    return !name || name === "new playlist" || id === "starter" || id === "local-starter";
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
        if(hasUserData(shared))return shared;
      }
    }catch(e){}
    try{ if(typeof db !== "undefined" && db && hasUserData(db))return db; }catch(e){}
    try{
      const primary = parseData(localStorage.getItem(DATA_KEY)) || {};
      const backup = parseData(localStorage.getItem(SHADOW_KEY)) || {};
      const chosen = hasUserData(primary) || !hasUserData(backup) ? primary : backup;
      if(hasUserData(chosen) && typeof window.tnAdoptDb === "function")return window.tnAdoptDb(chosen);
      return chosen;
    }catch(e){}
    return {ui:"en",prefs:{frontLang:"en-US",backLang:"ja-JP"},lists:[],words:[],meta:{}};
  }

  function setDb(next){
    try{
      if(typeof db !== "undefined" && db){
        Object.keys(db).forEach(key => delete db[key]);
        Object.assign(db,next);
        return;
      }
    }catch(e){}
    window.db = next;
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

  function cleanStartOnce(){
    // Disabled for this patch: preserve existing user words/playlists.
    return;
    if(localStorage.getItem(RESET_KEY))return;
    const fresh = {
      ui:"en",
      prefs:{frontLang:"en-US",backLang:"ja-JP"},
      lists:[{id:"starter",name:"New Playlist",createdAt:new Date().toISOString()}],
      words:[],
      meta:{updatedAt:new Date().toISOString()}
    };
    setDb(fresh);
    if(typeof window.tnWriteData === "function")window.tnWriteData(fresh);
    else localStorage.setItem(DATA_KEY,JSON.stringify(fresh));
    localStorage.setItem(RESET_KEY,"1");
  }

  function ensureData(){
    const data = dbRef();
    data.lists = Array.isArray(data.lists) ? data.lists : [];
    data.words = Array.isArray(data.words) ? data.words : [];
    data.prefs = data.prefs || {frontLang:"en-US",backLang:"ja-JP"};
    if(!data.lists.length){
      data.lists.push({id:"starter",name:"New Playlist",createdAt:new Date().toISOString()});
    }
    data.words.forEach(word => {
      if(!data.lists.some(list => list.id === word.listId))word.listId = data.lists[0].id;
    });
    return data;
  }

  function listName(id){
    return ensureData().lists.find(list => list.id === id)?.name || "New Playlist";
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
    const learned = words.filter(word => word.status === "learned").length;
    const hard = words.filter(word => word.status === "hard").length;
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
    return {
      query:String($("tnLibrarySearch")?.value || "").trim().toLowerCase(),
      language:$("tnFilterLanguage")?.value || "all",
      letter:$("tnFilterLetter")?.value || "all",
      playlist:$("tnFilterPlaylist")?.value || "all",
      pos:$("tnFilterPos")?.value || "all"
    };
  }

  function isFilterActive(state=filterState()){
    return !!state.query || state.language !== "all" || state.letter !== "all" || state.playlist !== "all" || state.pos !== "all";
  }

  function filteredWords(){
    const data = ensureData();
    const state = filterState();
    let words = [...data.words];
    if(state.query){
      words = words.filter(word => [word.front,word.back,word.memo,word.tags,word.pos,word.gender,listName(word.listId)].join(" ").toLowerCase().includes(state.query));
    }
    if(state.language !== "all")words = words.filter(word => word.frontLang === state.language || word.backLang === state.language);
    if(state.letter !== "all")words = words.filter(word => firstLatinLetter(word) === state.letter);
    if(state.playlist !== "all")words = words.filter(word => word.listId === state.playlist);
    if(state.pos !== "all")words = words.filter(word => String(word.pos || "") === state.pos);
    return words;
  }

  function options(items,current){
    return items.map(item => `<option value="${esc(item.value)}" ${item.value === current ? "selected" : ""}>${esc(item.label)}</option>`).join("");
  }

  function libraryShell(content){
    const tab = name => activeView === name ? "active" : "";
    return `
      <div class="tn-library-shell">
        <div class="tn-library-top">
          <div>
            <span class="tn-library-kicker">Library</span>
            <h3>Your collection</h3>
          </div>
          <div class="tn-library-tabs" role="tablist">
            <button type="button" data-library-view="words" class="${tab("words")}">Words</button>
            <button type="button" data-library-view="playlists" class="${tab("playlists")}">Playlists</button>
            <button type="button" data-library-view="weak" class="${tab("weak")}">Review</button>
            <button type="button" data-library-view="mastered" class="${tab("mastered")}">Mastered</button>
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
        <input id="tnLibrarySearch" placeholder="Search words" value="${esc(state.query)}">
        <div class="tn-library-filter-row">
          <select id="tnFilterLanguage">${options([{value:"all",label:"All languages"},...languages.map(value => ({value,label:languageLabel(value)}))],state.language)}</select>
          <select id="tnFilterLetter">${options([{value:"all",label:"All letters"},...letters],state.letter)}</select>
          <select id="tnFilterPlaylist">${options([{value:"all",label:"All playlists"},...data.lists.map(list => ({value:list.id,label:list.name || "New Playlist"}))],state.playlist)}</select>
          <select id="tnFilterPos">${options([{value:"all",label:"All POS"},...pos.map(value => ({value,label:value}))],state.pos)}</select>
          <button type="button" id="tnClearFilters" class="${isFilterActive(state) ? "is-active" : ""}">Reset</button>
        </div>
      </div>
    `;
  }

  function wordLevelLabel(word){
    const level = Math.min(5,Math.max(1,Number(word?.level || 3)));
    return `Level ${level}`;
  }

  function levelClass(word){
    const level = Math.min(5,Math.max(1,Number(word?.level || 3)));
    return `level-${level}`;
  }

  function levelBars(word){
    return "";
  }

  function iconAudio(){
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"></path><path d="M16 9.5a4 4 0 0 1 0 5"></path><path d="M18.5 7a7 7 0 0 1 0 10"></path></svg>`;
  }

  function iconTrash(){
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M6 7l1 14h10l1-14"></path><path d="M9 7V4h6v3"></path></svg>`;
  }

  function wordsView(mode="words"){
    let allWords = filteredWords();
    if(mode === "weak"){
      allWords = allWords.filter(word => Number(word.level || 3) <= 2 || word.status === "hard" || word.lastWrongAt);
    }
    if(mode === "mastered"){
      allWords = allWords.filter(word => Number(word.level || 3) >= 5);
    }
    const words = allWords.slice(0,renderLimit);
    const hiddenCount = Math.max(0,allWords.length - words.length);
    const body = allWords.length ? `
      <div class="tn82-word-list">
        ${words.map(word => `
          <div class="tn82-word-card tn-word-row" data-word-id="${esc(word.id)}" data-open-word="${esc(word.id)}">
            <div class="tn82-word-main">
              <div class="tn82-front">${esc(word.front)}</div>
              <div class="tn82-back">${esc(word.back)}</div>
              ${word.memo ? `<div class="tn-word-example">${esc(word.memo)}</div>` : ""}
            </div>
            <div class="tn82-word-meta">
              <span>${esc(listName(word.listId))}</span>
              <span class="tn-level-chip ${levelClass(word)}">${esc(wordLevelLabel(word))}${levelBars(word)}</span>
              ${word.pos ? `<span>${esc(word.pos)}</span>` : ""}
              <button type="button" class="tn-word-action ${word.saved ? "is-saved" : ""}" data-word-fav="${esc(word.id)}" title="Favorite" aria-label="Toggle favorite">${word.saved ? "★" : "☆"}</button>
              <button type="button" class="tn-word-action" data-word-audio="${esc(word.id)}" title="Play audio" aria-label="Play front word audio">${iconAudio()}</button>
              <button type="button" class="tn-word-action danger" data-word-delete="${esc(word.id)}" title="Delete word" aria-label="Delete word">${iconTrash()}</button>
            </div>
          </div>
        `).join("")}
      </div>
      ${hiddenCount ? `<div class="tn82-library-summary tn-load-more-row"><span>${hiddenCount} more word${hiddenCount === 1 ? "" : "s"} hidden for speed.</span><button type="button" class="tn-load-more-btn" data-load-more>Load more</button></div>` : ""}
    ` : `
      <div class="tn-library-empty">
        <h3>${isFilterActive() ? "No words found" : mode === "weak" ? "Review queue is clear" : mode === "mastered" ? "No mastered words yet" : "No words yet"}</h3>
        <p>${isFilterActive() ? "Try changing your search or filters." : mode === "weak" ? "Low-level or recently missed words will appear here." : mode === "mastered" ? "Level 5 words will appear here." : "Add your first word to start building your vocabulary."}</p>
        <button type="button" data-go-create>Add word</button>
      </div>
    `;
    const title = mode === "weak" ? "Review Queue" : mode === "mastered" ? "Mastered" : "Words";
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
          <article class="tn-library-playlist-card" data-playlist-id="${esc(list.id)}" tabindex="0">
            <button type="button" class="tn-playlist-open" data-open-playlist="${esc(list.id)}">
              <span class="tn-playlist-art">${esc(String(list.name || "N").slice(0,2).toUpperCase())}</span>
              <span class="tn-playlist-copy">
                <strong>${esc(list.name || "New Playlist")}</strong>
                <em>${progress.total} word${progress.total === 1 ? "" : "s"} · ${esc(playlistLanguagePair(list.id))}</em>
                <small>${progress.learned} learned · ${progress.hard} hard · ${esc(friendlyDate(list.updatedAt || list.createdAt))}</small>
              </span>
            </button>
            <div class="tn-playlist-actions">
              <button type="button" data-playlist-mode="quiz" data-playlist-id="${esc(list.id)}">Quiz</button>
              <button type="button" data-playlist-mode="cards" data-playlist-id="${esc(list.id)}">Cards</button>
              <button type="button" data-playlist-mode="listen" data-playlist-id="${esc(list.id)}">Listen</button>
              <button type="button" class="tn-playlist-delete-btn" data-delete-playlist="${esc(list.id)}">Delete</button>
            </div>
            <button type="button" class="tn-playlist-menu-btn" data-menu-playlist="${esc(list.id)}" aria-label="Playlist menu">...</button>
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
        <span>${data.lists.length} list${data.lists.length === 1 ? "" : "s"}</span>
      </div>
      ${cards}
    `);
  }

  function renderLibrary(){
    const mount = $("tn82LibraryMount");
    if(!mount)return;
    if(!["words","playlists","weak","mastered"].includes(activeView))activeView = "words";
    mount.innerHTML = activeView === "playlists" ? playlistsView() : wordsView(activeView);
    bindLibraryUi();
    updateLegacyControls();
    updateHeaderCounts();
  }

  function updateHeaderCounts(){
    const data = ensureData();
    const learned = data.words.filter(word => word.status === "learned").length;
    const hard = data.words.filter(word => word.status === "hard").length;
    const set = (id,value) => { const el = $(id); if(el)el.textContent = value; };
    ["wc","totalWords","dashTotal","heroWords"].forEach(id => set(id,data.words.length));
    ["listCount","totalLists","heroLists"].forEach(id => set(id,data.lists.length));
    ["lc","totalLearned","heroLearned"].forEach(id => set(id,learned));
    ["hc","totalHard","dashHard"].forEach(id => set(id,hard));
  }

  function updateLegacyControls(){
    const state = filterState();
    if($("wordSearch"))$("wordSearch").value = state.query;
    if($("wordListSelect") && [...$("wordListSelect").options].some(option => option.value === state.playlist))$("wordListSelect").value = state.playlist;
  }

  function resetFilters(){
    renderLimit = WORD_RENDER_LIMIT;
    ["tnLibrarySearch","wordSearch"].forEach(id => { if($(id))$(id).value = ""; });
    ["tnFilterLanguage","tnFilterLetter","tnFilterPlaylist","tnFilterPos"].forEach(id => { if($(id))$(id).value = "all"; });
    if($("wordListSelect"))$("wordListSelect").value = "all";
    if($("statusFilter"))$("statusFilter").value = "all";
    renderLibrary();
  }

  function switchView(view){
    activeView = ["words","playlists","weak","mastered"].includes(view) ? view : "words";
    renderLimit = WORD_RENDER_LIMIT;
    localStorage.setItem("tangonest_library_view_v1",activeView);
    renderLibrary();
  }

  function openPlaylist(listId){
    activeView = "words";
    renderLimit = WORD_RENDER_LIMIT;
    localStorage.setItem("tangonest_library_view_v1",activeView);
    renderLibrary();
    const select = $("tnFilterPlaylist");
    if(select)select.value = listId;
    if($("wordListSelect"))$("wordListSelect").value = listId;
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

    document.querySelectorAll(".nav button,.mobile-tabbar button").forEach(button => {
      const textPage = normalizePage(button.textContent);
      const idPage = normalizePage((button.id || "").replace(/^m?nav/i,""));
      button.classList.toggle("active",textPage === page || idPage === page);
    });

    try{ if(typeof window.tn82RememberPage === "function")window.tn82RememberPage(page); }catch(e){}
    try{ if(typeof window.tnFixForceLanguages === "function")window.tnFixForceLanguages(); }catch(e){}
    try{ if(typeof window.render === "function")window.render(); }catch(e){}
    if(page === "quiz"){
      try{ if(typeof window.resetQuiz === "function")window.resetQuiz(); }catch(e){}
    }
    if(page === "library")renderLibrary();
    if(page === "settings"){
      try{ if(typeof window.tn82RenderPlaylistManager === "function")window.tn82RenderPlaylistManager(); }catch(e){}
      try{ if(typeof window.tnFixRenderPlaylistManager === "function")window.tnFixRenderPlaylistManager(); }catch(e){}
    }
    stabilizeHeader();
  }

  function installStableNavigation(){
    const nav = page => stableNavigate(page);
    nav.__tn82Wrapped = true;
    nav.__tnFixWrapped = true;
    nav.__tnLibraryStable = true;
    window.go = nav;
    window.appShow = nav;
    window.showPage = nav;
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

  function cloudSaveSoon(){
    try{ if(typeof window.tn82CloudSaveSoon === "function")window.tn82CloudSaveSoon("library-change"); }catch(e){}
    try{ if(typeof window.tnFixCloudSave === "function")window.tnFixCloudSave(); }catch(e){}
  }

  async function cloudDeleteWord(id){
    try{
      const client = typeof window.tnCloudFirstClient === "function" ? window.tnCloudFirstClient() : null;
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

  function playWord(id,side="front"){
    const word = wordById(id);
    if(!word)return;
    const text = side === "back" ? word.back : word.front;
    const lang = side === "back" ? word.backLang : word.frontLang;
    if(typeof window.speakText === "function")window.speakText(text,lang);
    else if(typeof window.speak === "function")window.speak(text,lang);
  }

  function toggleFavorite(id){
    const word = wordById(id);
    if(!word)return;
    word.saved = !word.saved;
    persist();
    renderLibrary();
    renderWordDetail(id);
    cloudSaveSoon();
  }

  function deleteWord(id){
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
    cloudSaveSoon();
    toast("Word deleted");
  }

  function renderWordDetail(id){
    const word = wordById(id);
    if(!word)return;
    let panel = $("tnWordDetailPanel");
    if(!panel){
      panel = document.createElement("div");
      panel.id = "tnWordDetailPanel";
      panel.className = "tn-word-detail-panel";
      document.body.appendChild(panel);
    }
    panel.innerHTML = `
      <div class="tn-word-detail-card" role="dialog" aria-modal="true">
        <button type="button" class="tn-detail-close" data-close-word-detail>Close</button>
        <div class="tn-detail-kicker">${esc(languageLabel(word.frontLang))} -> ${esc(languageLabel(word.backLang))}</div>
        <h2>${esc(word.front)}</h2>
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
          <div><span>Level</span><strong class="tn-detail-level ${levelClass(word)}">${esc(wordLevelLabel(word))}</strong></div>
          <div><span>Correct</span><strong>${esc(word.correctCount || 0)}</strong></div>
          <div><span>Wrong</span><strong>${esc(word.wrongCount || 0)}</strong></div>
          <div><span>Reviews</span><strong>${esc(word.reviewCount || 0)}</strong></div>
        </div>
        ${word.memo ? `<section class="tn-detail-example"><span>Example</span><p>${esc(word.memo)}</p><button type="button" class="tn-example-audio" onclick="window.tnSpeakExample && window.tnSpeakExample('${esc(word.id)}')">${iconAudio()} Example audio</button></section>` : ""}
      </div>
    `;
    panel.classList.add("show");
  }

  function hideWordDetail(){
    $("tnWordDetailPanel")?.classList.remove("show");
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

  function showDeleteModal(listId){
    hideContextMenu();
    pendingDeleteId = listId;
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
        <strong>${esc(list.name || "New Playlist")}</strong>
        <div class="tn-delete-actions">
          <button type="button" data-cancel-delete>Cancel</button>
          <button type="button" data-confirm-delete>Delete playlist</button>
        </div>
      </div>
    `;
    modal.classList.add("show");
  }

  function hideDeleteModal(){
    $("tnPlaylistDeleteModal")?.classList.remove("show");
    pendingDeleteId = "";
  }

  function fallbackPlaylist(exceptId){
    const data = ensureData();
    let fallback = data.lists.find(list => list.id !== exceptId);
    if(!fallback){
      fallback = {id:"starter",name:"New Playlist",createdAt:new Date().toISOString()};
      data.lists.push(fallback);
    }
    return fallback;
  }

  async function syncPlaylistDeletion(listId,fallbackId){
    try{
      const client = typeof window.tnCloudFirstClient === "function" ? window.tnCloudFirstClient() : null;
      if(!client?.auth)return;
      const userResult = await client.auth.getUser();
      const userId = userResult?.data?.user?.id;
      if(!userId)return;
      await client.from("tn_words").update({playlist_id:fallbackId}).eq("playlist_id",listId).eq("user_id",userId);
      await client.from("tn_playlists").delete().eq("id",listId).eq("user_id",userId);
      if(typeof window.tnCloudFirstLoad === "function")setTimeout(() => window.tnCloudFirstLoad(),200);
    }catch(error){
      console.warn("Playlist cloud deletion sync skipped",error);
    }
  }

  function deletePlaylist(listId){
    const data = ensureData();
    const list = data.lists.find(item => item.id === listId);
    if(!list)return toast("Playlist not found");
    const fallback = fallbackPlaylist(listId);
    data.words.forEach(word => {
      if(word.listId === listId)word.listId = fallback.id;
    });
    data.lists = data.lists.filter(item => item.id !== listId);
    persist();
    renderSelectsSafe();
    if($("tnFilterPlaylist")?.value === listId)$("tnFilterPlaylist").value = "all";
    if($("wordListSelect")?.value === listId)$("wordListSelect").value = "all";
    renderLibrary();
    try{ if(typeof renderHome === "function")renderHome(); }catch(e){}
    try{ if(typeof tn82CloudSaveSoon === "function")tn82CloudSaveSoon("playlist-delete"); }catch(e){}
    syncPlaylistDeletion(listId,fallback.id);
    hideDeleteModal();
    toast("Playlist deleted");
  }

  function renderSelectsSafe(){
    const data = ensureData();
    ["addList","bulkList","studyList","quizList","audioList","renameListSelect","editList"].forEach(id => {
      const el = $(id);
      if(!el)return;
      const current = el.value;
      el.innerHTML = data.lists.map(list => `<option value="${esc(list.id)}">${esc(list.name || "New Playlist")}</option>`).join("");
      if([...el.options].some(option => option.value === current))el.value = current;
    });
    const wordSelect = $("wordListSelect");
    if(wordSelect){
      const current = wordSelect.value;
      wordSelect.innerHTML = `<option value="all">All</option>` + data.lists.map(list => `<option value="${esc(list.id)}">${esc(list.name || "New Playlist")}</option>`).join("");
      wordSelect.value = [...wordSelect.options].some(option => option.value === current) ? current : "all";
    }
  }

  function stabilizeHeader(){
    moveCloudPanelsToSettings();
    const header = $("tn80HeaderCloud");
    if(header){
      if(header.textContent !== "Cloud")header.textContent = "Cloud";
      header.title = "Cloud sync details are in Settings.";
      header.style.minWidth = "76px";
      header.style.width = "76px";
    }
    const pill = $("tn80StatusPill");
    if(pill){
      if(pill.textContent !== "Sync")pill.textContent = "Sync";
      pill.style.minWidth = "62px";
    }
    const account = $("tn80Account");
    if(account && /@/.test(account.textContent || ""))account.textContent = "Signed in";
    const syncBadge = $("syncStatusBadge");
    if(syncBadge && syncBadge.textContent !== "Sync")syncBadge.textContent = "Sync";
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
    ["tnLibrarySearch","tnFilterLanguage","tnFilterLetter","tnFilterPlaylist","tnFilterPos"].forEach(id => {
      const el = $(id);
      if(el && !el.__tnLibraryBound){
        el.addEventListener(el.tagName === "INPUT" ? "input" : "change",() => {
          const shouldRefocus = id === "tnLibrarySearch";
          renderLimit = WORD_RENDER_LIMIT;
          renderLibrary();
          if(shouldRefocus){
            requestAnimationFrame(() => {
              const next = $("tnLibrarySearch");
              if(next){
                next.focus();
                const len = next.value.length;
                try{ next.setSelectionRange(len,len); }catch(e){}
              }
            });
          }
        });
        el.__tnLibraryBound = true;
      }
    });
    const clear = $("tnClearFilters");
    if(clear)clear.onclick = resetFilters;
  }

  document.addEventListener("click",event => {
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
    if(wordOpen && !event.target?.closest?.("button,a,select,input,textarea")){
      event.preventDefault();
      renderWordDetail(wordOpen.dataset.openWord);
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
      showDeleteModal(directDelete.dataset.deletePlaylist);
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
      hideWordDetail();
    }
  });

  const previousRenderWords = window.renderWords;
  window.tnLibraryRender = renderLibrary;
  window.tn82RenderLibrary = renderLibrary;
  window.tnFixRenderLibrary = renderLibrary;
  window.renderWords = function(){
    renderLibrary();
    try{ if(typeof previousRenderWords === "function" && !document.getElementById("tn82LibraryMount"))previousRenderWords(); }catch(e){}
  };
  window.tnDeletePlaylist = showDeleteModal;
  window.tnStableHeader = stabilizeHeader;
  window.tnStableNavigate = stableNavigate;
  installStableNavigation();

  function boot(){
    cleanStartOnce();
    ensureData();
    renderSelectsSafe();
    renderLibrary();
    stabilizeHeader();
    installStableNavigation();
    ["wordSearch","wordListSelect","statusFilter"].forEach(id => {
      const el = $(id);
      if(el && !el.__tnLibraryProxyBound){
        el.addEventListener(el.tagName === "INPUT" ? "input" : "change",renderLibrary);
        el.__tnLibraryProxyBound = true;
      }
    });
  }

  if(document.readyState === "loading")document.addEventListener("DOMContentLoaded",boot);
  else boot();
  setTimeout(boot,400);
  setTimeout(boot,1300);
  setInterval(installStableNavigation,1200);
  const observer = new MutationObserver(stabilizeHeader);
  if(document.body)observer.observe(document.body,{subtree:true,childList:true,characterData:true});
})();
