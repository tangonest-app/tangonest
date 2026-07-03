(function(){
  "use strict";

  const DATA_KEY = "tangonest_production_stable_v1";
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const today = () => new Date().toISOString().slice(0,10);

  function dbRef(){
    try{
      if(typeof window.tnGetDb === "function")return window.tnGetDb();
    }catch(e){}
    try{ if(typeof db !== "undefined" && db)return db; }catch(e){}
    try{ return JSON.parse(localStorage.getItem(DATA_KEY) || "{}"); }catch(e){}
    return {lists:[],words:[],prefs:{frontLang:"en-US",backLang:"ja-JP"},meta:{}};
  }

  function persistQuiet(){
    try{
      const data = dbRef();
      if(typeof window.tnWriteData === "function")window.tnWriteData(data);
      else localStorage.setItem(DATA_KEY,JSON.stringify(data));
    }catch(e){}
  }

  function normalizeWords(){
    const data = dbRef();
    data.words = Array.isArray(data.words) ? data.words : [];
    data.lists = Array.isArray(data.lists) && data.lists.length ? data.lists : [{id:"starter",name:"New Playlist"}];
    data.mistakes = Array.isArray(data.mistakes) ? data.mistakes : [];
    data.words.forEach(word => {
      word.level = Math.min(5,Math.max(1,Number(word.level || 3)));
      word.correctCount = Number(word.correctCount || 0);
      word.wrongCount = Number(word.wrongCount || 0);
      word.reviewCount = Number(word.reviewCount || 0);
      if(!word.listId || !data.lists.some(list => list.id === word.listId))word.listId = data.lists[0].id;
    });
    data.prefs = data.prefs || {};
    data.prefs.frontLang = data.prefs.frontLang || "en-US";
    data.prefs.backLang = data.prefs.backLang || "ja-JP";
    persistQuiet();
  }

  function isDemoAppleWord(word){
    return false;
  }

  function neutralizeDemoPlaceholders(){
    const replacements = {
      front:"word",
      back:"meaning",
      memo:"Example sentence or memo.",
      bulkText:"front word\tback meaning\tPOS\tgender\texample sentence"
    };
    Object.entries(replacements).forEach(([id,placeholder]) => {
      const el = $(id);
      if(el)el.placeholder = placeholder;
    });
  }

  function addDays(n){
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0,10);
  }

  function isReviewDue(word){
    if(!word)return false;
    if(word.status === "hard")return true;
    if((word.level || 3) <= 2)return true;
    return !!word.nextReview && word.nextReview <= today();
  }

  function weakWords(){
    const words = dbRef().words || [];
    const mistakes = new Set((dbRef().mistakes || []).map(entry => entry.wordId));
    return words
      .filter(word => mistakes.has(word.id) || (word.level || 3) <= 2 || word.status === "hard" || !!word.lastWrongAt)
      .sort((a,b) => learningWeight(b) - learningWeight(a));
  }

  function masteredWords(){
    return (dbRef().words || []).filter(word => (word.level || 3) >= 5);
  }

  function dueWordsLearning(){
    return (dbRef().words || []).filter(isReviewDue).sort((a,b) => learningWeight(b) - learningWeight(a));
  }

  function learningWeight(word){
    const level = Math.min(5,Math.max(1,Number(word.level || 3)));
    const data = dbRef();
    const mistake = (data.mistakes || []).find(entry => entry.wordId === word.id);
    const base = {1:12,2:8,3:5,4:2.5,5:1}[level] || 5;
    const wrongBoost = Math.min(8,Number(word.wrongCount || 0) * 1.4);
    const recentWrong = word.lastWrongAt ? 4 : 0;
    const hard = word.status === "hard" ? 5 : 0;
    const mistakeBoost = mistake ? Math.min(12,Number(mistake.wrongCount || 1) * 2.2) : 0;
    const savedBoost = word.saved ? 1 : 0;
    const recentAdd = word.createdAt && Date.now() - new Date(word.createdAt).getTime() < 86400000 * 3 ? 1.5 : 0;
    return base + wrongBoost + recentWrong + hard + mistakeBoost + savedBoost + recentAdd;
  }

  function weightedOrder(words){
    return [...words].sort((a,b) => {
      const aw = Math.max(0.5,learningWeight(a));
      const bw = Math.max(0.5,learningWeight(b));
      return (Math.random() / bw) - (Math.random() / aw);
    });
  }

  function levelLabel(level){
    const value = Math.min(5,Math.max(1,Number(level || 3)));
    return `Level ${value}`;
  }

  function renderHomeDashboard(){
    const page = $("pageHome");
    if(!page)return;
    normalizeWords();
    let mount = $("tnLearningDashboard");
    if(!mount){
      mount = document.createElement("section");
      mount.id = "tnLearningDashboard";
      mount.className = "tn-learning-dashboard";
      const hero = page.querySelector(".hero-concept");
      if(hero?.nextSibling)page.insertBefore(mount,hero.nextSibling);
      else page.prepend(mount);
    }
    const data = dbRef();
    const words = data.words || [];
    const due = dueWordsLearning();
    const weak = weakWords();
    const mistakeIds = new Set((data.mistakes || []).map(entry => entry.wordId));
    const mistakeWords = weightedOrder(words.filter(word => mistakeIds.has(word.id)));
    const saved = weightedOrder(words.filter(word => word.saved));
    const recentAdded = [...words].sort((a,b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    const priorityMap = new Map();
    [...mistakeWords,...due,...weak,...saved,...recentAdded].forEach(word => {
      if(word?.id && !priorityMap.has(word.id))priorityMap.set(word.id,word);
    });
    const priorityQueue = [...priorityMap.values()];
    const levelCounts = [1,2,3,4,5].map(level => words.filter(word => Number(word.level || 3) === level).length);
    const last = priorityQueue[0] || words
      .filter(word => word.lastAnsweredAt || word.lastReviewed || word.createdAt)
      .sort((a,b) => String(b.lastAnsweredAt || b.lastReviewed || b.createdAt || "").localeCompare(String(a.lastAnsweredAt || a.lastReviewed || a.createdAt || "")))[0];
    const lastList = data.lists.find(list => list.id === last?.listId) || data.lists[0];
    const recentContext = last
      ? `${esc(last.front)} · ${esc(levelLabel(last.level))} · ${esc(lastList?.name || "New Playlist")}`
      : "Add a word, then TangoNest will guide your next session.";

    mount.innerHTML = `
      <div class="tn-learn-hero-card">
        <span class="tn-learn-kicker">Today's Review</span>
        <strong>${due.length}</strong>
        <p>${due.length ? "words need attention today." : "No urgent reviews. Keep the rhythm going."}</p>
        <div class="tn-learn-hero-stats"><span><b>${priorityQueue.length}</b> review words</span><span><b>${data.mistakes.length}</b> mistakes</span></div>
        <button type="button" data-tn-start-review="today">Start Review</button>
      </div>
      <div class="tn-learn-grid">
        <section>
          <div class="tn-learn-section-head"><h2>Review Queue</h2><button type="button" data-tn-start-review="weak">Review Words</button></div>
          <div class="tn-learn-word-strip">
            ${priorityQueue.slice(0,5).map(word => `<button type="button" data-open-word="${esc(word.id)}"><b>${esc(word.front)}</b><span>${esc(word.back)} · ${mistakeIds.has(word.id) ? "Mistake · " : ""}${esc(levelLabel(word.level))}</span></button>`).join("") || `<p>No review words yet.</p>`}
          </div>
        </section>
        <section>
          <div class="tn-learn-section-head"><h2>Continue Learning</h2><button type="button" data-tn-start-review="${data.mistakes.length ? "mistakes" : "quiz"}">Continue Quiz</button></div>
          <p class="tn-learn-muted">${recentContext}</p>
          <div class="tn-learn-session-links">
            <button type="button" data-tn-start-review="${data.mistakes.length ? "mistakes" : "quiz"}">${data.mistakes.length ? "Mistake review" : "Recent quiz"}</button>
            <button type="button" data-tn-go="listen">Recent listen</button>
            <button type="button" data-tn-go="library">${esc(lastList?.name || "New Playlist")}</button>
          </div>
          <span class="tn-learn-actions-label">Quick Actions</span>
          <div class="tn-learn-actions">
            <button type="button" data-tn-go="create">Add Word</button>
            <button type="button" data-tn-go="create">Bulk Add</button>
            <button type="button" data-tn-start-review="quiz">Start Quiz</button>
            <button type="button" data-tn-go="listen">Listen</button>
          </div>
        </section>
      </div>
      <section class="tn-learn-progress">
        <h2>Learning Progress</h2>
        <div>${levelCounts.map((count,index) => `<span class="tn-progress-level level-${index + 1}"><b>${count}</b><small>Level ${index + 1}</small></span>`).join("")}</div>
      </section>
    `;
  }

  function startReview(mode){
    normalizeWords();
    const data = dbRef();
    const listId = data.lists[0]?.id || "starter";
    if($("quizList"))$("quizList").value = listId;
    if($("quizScope")){
      const scope = mode === "mistakes" ? "mistakes" : mode === "weak" ? "hard" : mode === "today" ? (dueWordsLearning().length ? "due" : data.mistakes?.length ? "mistakes" : weakWords().length ? "hard" : "all") : "all";
      $("quizScope").value = scope;
    }
    try{ if(typeof window.tnEmergencyStableGo === "function")window.tnEmergencyStableGo("quiz"); else if(typeof window.go === "function")window.go("quiz"); }catch(e){}
    setTimeout(() => {
      try{ if(typeof window.startQuiz === "function")window.startQuiz(); }catch(e){}
    },120);
  }

  function installQuizLearning(){
    if(window.__tnLearningQuizInstalled)return;
    window.__tnLearningQuizInstalled = true;
    window.tnLearningWeight = learningWeight;
    window.tnLearningWeightedOrder = weightedOrder;

    window.updateWordLearning = function(id,status){
      const data = dbRef();
      data.words = data.words.map(word => {
        if(word.id !== id)return word;
        const wasLevel = Math.min(5,Math.max(1,Number(word.level || 3)));
        const correct = status === "learned";
        const nextLevel = correct ? Math.min(5,wasLevel + 1) : Math.max(1,wasLevel - 1);
        const interval = {1:1,2:2,3:4,4:7,5:14}[nextLevel] || 4;
        return {
          ...word,
          level:nextLevel,
          status: correct ? (nextLevel >= 5 ? "learned" : "new") : "hard",
          correctCount:Number(word.correctCount || 0) + (correct ? 1 : 0),
          wrongCount:Number(word.wrongCount || 0) + (correct ? 0 : 1),
          reviewCount:Number(word.reviewCount || 0) + 1,
          lastAnsweredAt:new Date().toISOString(),
          lastWrongAt:correct ? word.lastWrongAt : new Date().toISOString(),
          nextReview:addDays(interval),
          lastReviewed:today()
        };
      });
      persistQuiet();
      renderHomeDashboard();
      try{ if(typeof window.tnLibraryRender === "function")window.tnLibraryRender(); }catch(e){}
    };

    window.quizPool = function(){
      const list = $("quizList")?.value;
      const scope = $("quizScope")?.value || "all";
      let words = (dbRef().words || []).filter(word => !list || word.listId === list);
      if(scope === "mistakes"){
        const ids = new Set((dbRef().mistakes || []).map(entry => entry.wordId));
        words = (dbRef().words || []).filter(word => ids.has(word.id));
      }else{
        if(scope === "hard")words = words.filter(word => (word.level || 3) <= 2 || word.status === "hard" || word.lastWrongAt);
        if(scope === "due")words = words.filter(isReviewDue);
        if(scope === "star")words = words.filter(word => word.saved);
      }
      return weightedOrder(words);
    };

    const originalStartQuiz = window.startQuiz;
    window.startQuiz = function(){
      if(typeof originalStartQuiz !== "function")return;
      return originalStartQuiz();
    };

    window.weighted = function(words){
      const ordered = weightedOrder(words || []);
      return ordered[0] || words?.[0];
    };

    window.audioWords = function(){
      const list = $("audioList")?.value;
      const order = $("audioOrder")?.value || "normal";
      let words = (dbRef().words || []).filter(word => !list || word.listId === list);
      if(order === "star")words = words.filter(word => word.saved);
      if(order === "due")words = words.filter(isReviewDue);
      if(order === "hard")words = words.filter(word => (word.level || 3) <= 2 || word.status === "hard");
      return order === "random" || order === "hard" || order === "due" ? weightedOrder(words) : words;
    };

    const originalFinishAnswer = window.finishAnswer;
    window.finishAnswer = function(ok){
      if(typeof originalFinishAnswer === "function")originalFinishAnswer(ok);
      const result = $("quizResult");
      if(result?.classList.contains("show")){
        if(result.querySelector?.(".quiz-next-btn"))return renderHomeDashboard();
        const add = ok ? "Level increased." : "This word will appear more often.";
        if(!result.textContent.includes(add))result.textContent = `${result.textContent} · ${add}`;
      }
      renderHomeDashboard();
    };
  }

  function normalizeVoiceLang(lang){
    const raw = String(lang || "").toLowerCase();
    if(raw.startsWith("ja") || raw.includes("japanese") || raw.includes("日本"))return "ja-JP";
    if(raw.startsWith("ko") || raw.includes("korean"))return "ko-KR";
    if(raw.startsWith("zh") || raw.includes("chinese") || raw.includes("mandarin"))return "zh-CN";
    if(raw.startsWith("fr") || raw.includes("french"))return "fr-FR";
    if(raw.startsWith("es") || raw.includes("spanish"))return "es-ES";
    if(raw.startsWith("en") || raw.includes("english"))return "en-US";
    return "en-US";
  }

  function cleanSpeechText(text){
    return String(text || "").replace(/\s*\/\s*/g,", ").replace(/\s+/g," ").trim();
  }

  function installAudioGuard(){
    const originalSpeak = window.speak;
    window.speak = function(text,lang,opts){
      const clean = cleanSpeechText(text);
      const finalLang = normalizeVoiceLang(lang);
      if(typeof originalSpeak === "function")return originalSpeak(clean,finalLang,opts);
    };
    window.tnSpeakExample = function(id){
      const word = (dbRef().words || []).find(item => item.id === id);
      if(word?.memo)window.speak(word.memo,word.frontLang || word.backLang || "en-US");
    };
  }

  document.addEventListener("click",event => {
    const review = event.target?.closest?.("[data-tn-start-review]");
    if(review){
      event.preventDefault();
      startReview(review.dataset.tnStartReview);
      return;
    }
    const go = event.target?.closest?.("[data-tn-go]");
    if(go){
      event.preventDefault();
      const page = go.dataset.tnGo;
      try{ if(typeof window.tnEmergencyStableGo === "function")window.tnEmergencyStableGo(page); else if(typeof window.go === "function")window.go(page); }catch(e){}
      return;
    }
    const word = event.target?.closest?.("[data-open-word]");
    if(word){
      event.preventDefault();
      try{ if(typeof window.openDetail === "function")window.openDetail(word.dataset.openWord); }catch(e){}
    }
  },true);

  function boot(){
    normalizeWords();
    installQuizLearning();
    installAudioGuard();
    neutralizeDemoPlaceholders();
    renderHomeDashboard();
    try{ if(typeof window.renderHome === "function"){
      const oldRenderHome = window.renderHome;
      if(!oldRenderHome.__tnLearningWrapped){
        window.renderHome = function(){ oldRenderHome(); renderHomeDashboard(); };
        window.renderHome.__tnLearningWrapped = true;
      }
    }}catch(e){}
  }

  window.tnLearningBoot = boot;
  window.tnLearningRenderHome = renderHomeDashboard;
  window.tnLearningWeakWords = weakWords;
  window.tnLearningMasteredWords = masteredWords;

  if(document.readyState === "loading")document.addEventListener("DOMContentLoaded",boot);
  else boot();
  setTimeout(boot,500);
  setTimeout(neutralizeDemoPlaceholders,1200);
})();
