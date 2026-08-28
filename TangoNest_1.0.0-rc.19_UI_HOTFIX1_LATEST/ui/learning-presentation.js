(function(root,factory){
  const presentation=factory(root?.TangoNestLearningEngine);
  if(typeof module==="object"&&module.exports){
    module.exports=factory(require("../learning-engine.js"));
  }
  if(root)root.TangoNestLearningPresentation=presentation;
})(typeof globalThis!=="undefined"?globalThis:this,function(engine){
  "use strict";

  function currentEngine(){
    return engine||(typeof globalThis!=="undefined"?globalThis.TangoNestLearningEngine:null);
  }

  function localDateKey(value){
    const active=currentEngine();
    if(active?.localDateKey)return active.localDateKey(value);
    const date=value instanceof Date?value:new Date(value||Date.now());
    return [date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");
  }

  function dayDifference(from,to){
    const active=currentEngine();
    if(active?.daysBetween)return active.daysBetween(from,to);
    const start=new Date(`${from}T12:00:00`);
    const end=new Date(`${to}T12:00:00`);
    return Math.round((end-start)/86400000);
  }

  function state(word,now){
    const active=currentEngine();
    const normalized=active?.normalizeWord?active.normalizeWord(word,now):(word||{});
    if(active?.isMasteredWord?.(normalized))return {key:"mastered",label:"Mastered",tone:"mastered"};
    if(active?.isWeakWord?.(normalized,now))return {key:"weak",label:"Needs practice",tone:"weak"};
    if(Number(normalized.reviewCount||0)===0)return {key:"new",label:"New",tone:"new"};
    if(active?.isDueWord?.(normalized,now))return {key:"due",label:"Due today",tone:"due"};
    if(Number(normalized.level||1)>=4)return {key:"strong",label:"Strong",tone:"strong"};
    return {key:"learning",label:"Learning",tone:"learning"};
  }

  function review(word,now){
    const active=currentEngine();
    const normalized=active?.normalizeWord?active.normalizeWord(word,now):(word||{});
    if(Number(normalized.reviewCount||0)===0)return {label:"Ready to learn",days:0,tone:"new"};
    const next=String(normalized.nextReview||normalized.next_review||"");
    if(!next)return {label:"Review not scheduled",days:null,tone:"muted"};
    const days=dayDifference(localDateKey(now),next);
    if(days<0)return {label:`Overdue by ${Math.abs(days)} day${Math.abs(days)===1?"":"s"}`,days,tone:"due"};
    if(days===0)return {label:"Due today",days,tone:"due"};
    if(days===1)return {label:"Review tomorrow",days,tone:"learning"};
    return {label:`Review in ${days} days`,days,tone:"learning"};
  }

  function accuracy(word){
    const active=currentEngine();
    const value=active?.accuracy?active.accuracy(word):0;
    const reviews=Number(word?.reviewCount??word?.review_count??0);
    return {value,percent:Math.round(value*100),label:reviews?`${Math.round(value*100)}% accuracy`:"Not studied yet"};
  }

  function lastStudied(word,now){
    const raw=word?.lastAnsweredAt||word?.last_answered_at||word?.lastReviewed||word?.last_reviewed||"";
    if(!raw)return "Not studied yet";
    const date=new Date(raw);
    if(Number.isNaN(date.getTime()))return "Not studied yet";
    const days=dayDifference(localDateKey(date),localDateKey(now));
    if(days===0)return "Today";
    if(days===1)return "Yesterday";
    if(days>1&&days<14)return `${days} days ago`;
    return date.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"});
  }

  function session(words,now){
    const active=currentEngine();
    const all=Array.isArray(words)?words:[];
    const due=all.filter(word=>active?.isDueWord?.(word,now)).length;
    const weak=all.filter(word=>active?.isWeakWord?.(word,now)).length;
    const fresh=all.filter(word=>Number(word?.reviewCount??word?.review_count??0)===0).length;
    const mastered=all.filter(word=>active?.isMasteredWord?.(word)).length;
    const queue=active?.buildSmartSession?active.buildSmartSession(all,{limit:20,now}):all.slice(0,20);
    return {due,weak,new:fresh,mastered,total:queue.length,minutes:queue.length?Math.max(1,Math.ceil(queue.length/2)):0};
  }

  function rating(word,ratingValue,now){
    const label={again:"Again soon",hard:"Review sooner",good:"Good progress",easy:"Interval extended"}[ratingValue]||"Progress saved";
    return {label,review:review(word,now).label,state:state(word,now)};
  }

  return {VERSION:"1.0.0",state,review,accuracy,lastStudied,session,rating};
});
