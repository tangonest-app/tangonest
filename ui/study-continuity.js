(function(){
  "use strict";
  const $=id=>document.getElementById(id),t=(key,args)=>window.TNI18n.t(key,args);
  let restoring=false,activeOwner=null;
  const owner=()=>db.meta?.userId||"guest";
  const key=()=>`tangonest_checkpoint_v1:${owner()}`;
  const fingerprint=word=>JSON.stringify([word.id,word.listId,word.front,word.back,word.frontLang,word.backLang,word.memo,word.pronunciation,word.pos,word.gender]);
  function read(){try{return JSON.parse(localStorage.getItem(key())||"null")}catch(error){return null}}
  function write(value){try{if(value)localStorage.setItem(key(),JSON.stringify(value));else localStorage.removeItem(key())}catch(error){}render()}
  function capture(){
    if(restoring||activeOwner!==owner())return;
    const page=document.querySelector(".page.active")?.id;
    let state=null;
    if(page==="pageQuiz"&&quiz.current&&!quiz.ended&&$("quizRun").style.display!=="none"){
      const index=quiz.index+(quiz.answered?1:0);
      if(index>=quiz.queue.length)return write(null);
      state={mode:"quiz",listId:$("quizList").value,index,total:quiz.total,queue:quiz.queue.map(fingerprint),records:quiz.records||[],type:quiz.type,direction:quiz.direction,options:{quizAutoAdvance:$("quizAutoAdvance").value,quizAudioAfter:$("quizAudioAfter").value}};
    }else if(page==="pageStudy"&&current){
      state={mode:"cards",listId:$("studyList").value,word:fingerprint(current),flipped,rated:cardRated,studyMode:$("studyMode").value};
    }else if(page==="pageAudio"&&audioQueue.length){
      state={mode:"listen",listId:$("audioList").value,queue:audioQueue.map(fingerprint),index:Math.max(0,audioIndex-1),pattern:$("audioPattern").value};
    }
    if(state)write({...state,owner:owner(),at:new Date().toISOString()});
  }
  function valid(state){
    if(!state||state.owner!==owner()||!["quiz","cards","listen"].includes(state.mode))return false;
    if(state.listId!=="all"&&!db.lists.some(list=>list.id===state.listId))return false;
    const live=new Set(db.words.map(fingerprint));
    return (state.queue||[state.word]).every(value=>live.has(value));
  }
  function render(){
    const button=document.querySelector(".home-resume");if(!button)return;
    let detail=$("homeResumeContext");
    if(!detail){detail=document.createElement("p");detail.id="homeResumeContext";detail.className="home-resume-context";button.parentElement.before(detail)}
    const state=read(),canResume=valid(state);
    button.hidden=!state;
    button.onclick=canResume?resume:()=>{write(null);window.tnStableNavigate(state?.mode||"quiz")};
    button.textContent=canResume?t("ui.continue_learning"):t("navigation."+(state?.mode||"quiz"));
    detail.hidden=!state;
    if(!state)return;
    if(!canResume){detail.textContent=t("study.cannotResume");return}
    const list=db.lists.find(list=>list.id===state.listId)?.name||t("ui.all_words");
    const position=state.mode==="quiz"?`${t("ui.question")} ${state.index+1} / ${state.total}`:state.mode==="cards"?JSON.parse(state.word)[2]:`${state.index+1} / ${state.queue.length}`;
    detail.textContent=`${list} · ${t("navigation."+state.mode)} · ${position} · ${new Date(state.at).toLocaleString(window.TNI18n.locale)}`;
  }
  function resume(){
    const state=read();if(!valid(state)){render();return}
    restoring=true;
    try{
      window.tnStableNavigate(state.mode);
      const words=new Map(db.words.map(word=>[fingerprint(word),word]));
      if(state.mode==="quiz"){
        $("quizList").value=state.listId;
        for(const [id,value]of Object.entries(state.options))$(id).value=value;
        // Resuming never restarts a deadline or plays audio without a fresh user action.
        $("quizHardMode").value="off";$("listeningTimerMode").value="off";
        quiz={queue:state.queue.map(value=>words.get(value)),wrong:[],allWrong:[],records:state.records,index:state.index,total:state.total,score:state.records.filter(record=>record.ok).length,type:state.type,direction:state.direction,current:null,answered:false,ended:false,listeningReplayUsed:0};
        quiz.allWrong=Array.from(new Set(state.records.filter(record=>!record.ok).map(record=>record.id))).map(id=>db.words.find(word=>word.id===id)).filter(Boolean);
        $("quizSetup").style.display="none";$("quizEnd").style.display="none";$("quizRun").style.display="grid";$("pageQuiz").classList.add("quiz-focus-active");showQuizQuestion();clearTimeout(quizListeningAudioTimer);
      }else if(state.mode==="cards"){
        $("studyList").value=state.listId;$("studyMode").value=state.studyMode;current=words.get(state.word);flipped=state.flipped;cardRated=state.rated;$("flash").classList.toggle("is-flipped",flipped);drawCard();updateCardRating();updateStudyProgress();
      }else{
        $("audioList").value=state.listId;$("audioPattern").value=state.pattern;audioQueue=state.queue.map(value=>words.get(value));audioIndex=state.index+1;audioPaused=true;updateNow(audioQueue[state.index]);setAudioPlayerState("paused");
      }
    }finally{restoring=false;activeOwner=owner()}
  }
  function enter(page){
    if(activeOwner!==owner()){clearQuizTimers();clearFlashTimers();current=null;activeOwner=owner()}
    if(page==="cards"&&!restoring){if(!current||!studyWords().some(word=>word.id===current.id)){if(studyWords().length)nextCard();else resetCard()}updateCardRating()}
    if(page==="home")render();
  }
  window.tnStudyContinuity={capture,render,resume,enter,complete(mode){if(read()?.mode===mode)write(null)}};
  window.addEventListener("pagehide",capture);
  document.addEventListener("visibilitychange",()=>{if(document.hidden)capture()});
  window.addEventListener("tn:locale",render);
  activeOwner=owner();enter(({pageStudy:"cards",pageHome:"home"})[document.querySelector(".page.active")?.id]);
})();
