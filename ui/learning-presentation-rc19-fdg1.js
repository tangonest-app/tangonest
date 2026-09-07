(function(root,factory){
  const presentation=factory(root?.TangoNestLearningEngine);
  if(typeof module==="object"&&module.exports){
    module.exports=factory(require("../learning-engine.js"));
  }
  if(root)root.TangoNestLearningPresentation=presentation;
})(typeof globalThis!=="undefined"?globalThis:this,function(engine){
  "use strict";
  function message(key,fallback,params={}){
    const i18n=typeof globalThis!=="undefined"?globalThis.TNI18n:null;
    return i18n?i18n.t(key,params):fallback.replace(/\{(\w+)\}/g,(_,name)=>String(params[name]??""));
  }

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
    if(active?.isMasteredWord?.(normalized))return {key:"mastered",label:message("learning.mastered","Mastered"),tone:"mastered"};
    if(active?.isWeakWord?.(normalized,now))return {key:"weak",label:message("learning.needsPractice","Needs practice"),tone:"weak"};
    if(Number(normalized.reviewCount||0)===0)return {key:"new",label:message("ui.new","New"),tone:"new"};
    if(active?.isDueWord?.(normalized,now))return {key:"due",label:message("learning.dueToday","Due today"),tone:"due"};
    if(Number(normalized.level||1)>=4)return {key:"strong",label:message("learning.strong","Strong"),tone:"strong"};
    return {key:"learning",label:message("ui.learning","Learning"),tone:"learning"};
  }

  function review(word,now){
    const active=currentEngine();
    const normalized=active?.normalizeWord?active.normalizeWord(word,now):(word||{});
    if(Number(normalized.reviewCount||0)===0)return {label:message("learning.ready","Ready to learn"),days:0,tone:"new"};
    const next=String(normalized.nextReview||normalized.next_review||"");
    if(!next)return {label:message("learning.unscheduled","Review not scheduled"),days:null,tone:"muted"};
    const days=dayDifference(localDateKey(now),next);
    if(days<0)return {label:message("learning.overdue",`Overdue by ${Math.abs(days)} day${Math.abs(days)===1?"":"s"}`,{count:Math.abs(days)}),days,tone:"due"};
    if(days===0)return {label:message("learning.dueToday","Due today"),days,tone:"due"};
    if(days===1)return {label:message("learning.tomorrow","Review tomorrow"),days,tone:"learning"};
    return {label:message("learning.inDays","Review in {count} days",{count:days}),days,tone:"learning"};
  }

  function accuracy(word){
    const active=currentEngine();
    const value=active?.accuracy?active.accuracy(word):0;
    const reviews=Number(word?.reviewCount??word?.review_count??0);
    return {value,percent:Math.round(value*100),label:reviews?message("learning.accuracyPercent","{percent}% accuracy",{percent:Math.round(value*100)}):message("learning.notStudied","Not studied yet")};
  }

  function lastStudied(word,now){
    const raw=word?.lastAnsweredAt||word?.last_answered_at||word?.lastReviewed||word?.last_reviewed||"";
    if(!raw)return message("learning.notStudied","Not studied yet");
    const date=new Date(raw);
    if(Number.isNaN(date.getTime()))return message("learning.notStudied","Not studied yet");
    const days=dayDifference(localDateKey(date),localDateKey(now));
    const locale=typeof globalThis!=="undefined"?globalThis.TNI18n?.locale:undefined;
    if(locale&&days>=0&&days<14)return new Intl.RelativeTimeFormat(locale,{numeric:"auto"}).format(-days,"day");
    if(days===0)return "Today";
    if(days===1)return "Yesterday";
    if(days>1&&days<14)return `${days} days ago`;
    return date.toLocaleDateString(locale,{year:"numeric",month:"short",day:"numeric"});
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
    const labels={again:["learning.againSoon","Again soon"],hard:["learning.reviewSooner","Review sooner"],good:["learning.goodProgress","Good progress"],easy:["learning.intervalExtended","Interval extended"]};
    const [key,fallback]=labels[ratingValue]||["learning.progressSaved","Progress saved"];
    const label=message(key,fallback);
    return {label,review:review(word,now).label,state:state(word,now)};
  }

  return {VERSION:"1.0.0",state,review,accuracy,lastStudied,session,rating};
});
