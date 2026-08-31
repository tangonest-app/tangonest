(function(){
  "use strict";

  const engine=()=>window.TangoNestLearningEngine||null;

  function dbRef(){
    try{if(typeof window.tnGetDb==="function")return window.tnGetDb()}catch(e){}
    return {words:[]};
  }

  function words(){
    const data=dbRef();
    return Array.isArray(data.words)?data.words:[];
  }

  function weakWords(){
    return words()
      .filter(word=>engine()?.isWeakWord(word)??false)
      .sort((a,b)=>(engine()?.learningWeight(b)||0)-(engine()?.learningWeight(a)||0));
  }

  function masteredWords(){
    return words().filter(word=>engine()?.isMasteredWord(word)??false);
  }

  function speakExample(id){
    const word=words().find(item=>item.id===id);
    if(!word?.memo)return;
    try{window.speak?.(word.memo,word.frontLang||word.backLang||"en-US")}catch(e){}
  }

  function boot(){
    window.tnLearningWeakWords=weakWords;
    window.tnLearningMasteredWords=masteredWords;
    window.tnSpeakExample=speakExample;
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();
})();
