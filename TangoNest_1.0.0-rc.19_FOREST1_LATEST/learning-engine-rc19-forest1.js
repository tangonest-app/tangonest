(function(root,factory){
  const engine=factory();
  if(typeof module==="object"&&module.exports)module.exports=engine;
  if(root)root.TangoNestLearningEngine=engine;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const CONFIG=Object.freeze({
    dayMs:86400000,
    levels:Object.freeze({1:"New",2:"Learning",3:"Developing",4:"Strong",5:"Mastered"}),
    baseLevel:Object.freeze({
      strong:Object.freeze({correct:5,reviews:5,accuracy:0.7,streak:2}),
      developing:Object.freeze({correct:3,reviews:3,accuracy:0.55,streak:1})
    }),
    mastery:Object.freeze({correct:6,reviews:6,accuracy:0.8,streak:3,intervalDays:21,minScheduledDays:30}),
    weak:Object.freeze({againDays:21,hardDays:14,recentWrongDays:14,accuracyWindowDays:30,minReviews:3,maxAccuracy:0.6,recoveryStreak:3,recoveryLevel:3}),
    intervals:Object.freeze({
      hardMultiplier:0.6,
      hardMaxDays:7,
      goodMinimum:Object.freeze({1:1,2:2,3:4,4:14,5:30}),
      easyMinimum:Object.freeze({1:2,2:4,3:8,4:18,5:45}),
      goodMultiplier:1.7,
      easyMultiplier:2.2,
      maxDays:180
    }),
    weights:Object.freeze({
      levels:Object.freeze({1:6,2:5,3:3.5,4:2,5:0.5}),
      overdueBase:2,
      overduePerDay:0.8,
      overdueMax:10,
      due:2,
      weak:6,
      again:3,
      hard:1.5
    }),
    smartSession:Object.freeze({defaultLimit:20,maxLimit:50,dueRatio:0.55,weakRatio:0.3,newRatio:0.25})
  });
  const DAY_MS=CONFIG.dayMs;
  const LEVEL_NAMES=CONFIG.levels;
  const RATINGS=new Set(["again","hard","good","easy"]);

  function clamp(value,min,max){
    return Math.min(max,Math.max(min,Number(value)||0));
  }

  function asCount(value){
    return Math.max(0,Math.floor(Number(value)||0));
  }

  function dateFrom(value){
    const date=value instanceof Date?new Date(value.getTime()):new Date(value||Date.now());
    return Number.isNaN(date.getTime())?new Date():date;
  }

  function localDateKey(value){
    const date=dateFrom(value);
    const year=date.getFullYear();
    const month=String(date.getMonth()+1).padStart(2,"0");
    const day=String(date.getDate()).padStart(2,"0");
    return `${year}-${month}-${day}`;
  }

  function localDateFromKey(value){
    const match=String(value||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!match)return null;
    const date=new Date(Number(match[1]),Number(match[2])-1,Number(match[3]),12,0,0,0);
    return Number.isNaN(date.getTime())?null:date;
  }

  function addLocalDays(days,from){
    const date=dateFrom(from);
    date.setHours(12,0,0,0);
    date.setDate(date.getDate()+Math.max(0,Math.floor(Number(days)||0)));
    return localDateKey(date);
  }

  function daysBetween(fromKey,toKey){
    const from=localDateFromKey(fromKey);
    const to=localDateFromKey(toKey);
    if(!from||!to)return 0;
    return Math.round((to.getTime()-from.getTime())/DAY_MS);
  }

  function daysSince(value,now){
    if(!value)return Infinity;
    const then=dateFrom(value);
    const current=dateFrom(now);
    return Math.max(0,Math.floor((current.getTime()-then.getTime())/DAY_MS));
  }

  function normalizeRating(value){
    const raw=String(value||"").trim().toLowerCase();
    if(RATINGS.has(raw))return raw;
    if(["incorrect","wrong","failed","harder"].includes(raw))return "again";
    if(["learned","correct","known","know"].includes(raw))return "good";
    return "good";
  }

  function normalizeWord(word,now){
    const source=word&&typeof word==="object"?word:{};
    const reviewCount=asCount(source.reviewCount??source.review_count);
    const correctCount=asCount(source.correctCount??source.correct_count);
    const wrongCount=asCount(source.wrongCount??source.wrong_count);
    const level=clamp(source.level||1,1,5);
    const nextReview=String(source.nextReview??source.next_review??localDateKey(now));
    const lastAnsweredAt=String(source.lastAnsweredAt??source.last_answered_at??"");
    const lastWrongAt=String(source.lastWrongAt??source.last_wrong_at??"");
    const lastResult=String(source.lastResult??source.last_result??"").toLowerCase();
    const inferredResult=lastResult||(
      lastWrongAt&&lastAnsweredAt&&dateFrom(lastWrongAt).getTime()>=dateFrom(lastAnsweredAt).getTime()-1000
        ?"again"
        :reviewCount?"good":""
    );
    const interval=asCount(source.reviewIntervalDays??source.review_interval_days) || Math.max(0,daysBetween(localDateKey(lastAnsweredAt||now),nextReview));
    return {
      ...source,
      level,
      status:String(source.status||"new"),
      nextReview,
      correctCount,
      wrongCount,
      reviewCount,
      lastAnsweredAt,
      lastWrongAt,
      consecutiveCorrect:asCount(source.consecutiveCorrect??source.consecutive_correct),
      reviewIntervalDays:interval,
      lastResult:inferredResult,
      learningState:String(source.learningState??source.learning_state??(reviewCount?"learning":"new"))
    };
  }

  function accuracy(word){
    const normalized=normalizeWord(word);
    const attempts=normalized.correctCount+normalized.wrongCount;
    return attempts?normalized.correctCount/attempts:0;
  }

  function baseLevel(word){
    const normalized=normalizeWord(word);
    const rate=accuracy(normalized);
    const strong=CONFIG.baseLevel.strong;
    const developing=CONFIG.baseLevel.developing;
    if(normalized.reviewCount===0)return 1;
    if(normalized.correctCount>=strong.correct&&normalized.reviewCount>=strong.reviews&&rate>=strong.accuracy&&normalized.consecutiveCorrect>=strong.streak)return 4;
    if(normalized.correctCount>=developing.correct&&normalized.reviewCount>=developing.reviews&&rate>=developing.accuracy&&normalized.consecutiveCorrect>=developing.streak)return 3;
    if(normalized.correctCount>=1)return 2;
    return 1;
  }

  function masteredByMetrics(word){
    const normalized=normalizeWord(word);
    const mastery=CONFIG.mastery;
    return normalized.level>=5&&
      normalized.correctCount>=mastery.correct&&
      normalized.reviewCount>=mastery.reviews&&
      normalized.consecutiveCorrect>=mastery.streak&&
      accuracy(normalized)>=mastery.accuracy&&
      normalized.reviewIntervalDays>=mastery.intervalDays&&
      normalized.lastResult!=="again"&&
      normalized.lastResult!=="hard";
  }

  function isMasteredWord(word){
    return masteredByMetrics(word);
  }

  function isWeakWord(word,now){
    const normalized=normalizeWord(word,now);
    const weak=CONFIG.weak;
    if(isMasteredWord(normalized))return false;
    const recentStudy=daysSince(normalized.lastAnsweredAt,now);
    const recentWrong=daysSince(normalized.lastWrongAt,now);
    if(normalized.lastResult==="again"&&recentStudy<=weak.againDays)return true;
    if(normalized.lastResult==="hard"&&recentStudy<=weak.hardDays)return true;
    if(normalized.consecutiveCorrect>=weak.recoveryStreak&&normalized.level>=weak.recoveryLevel)return false;
    if(recentWrong<=weak.recentWrongDays&&normalized.consecutiveCorrect<2)return true;
    return normalized.reviewCount>=weak.minReviews&&recentStudy<=weak.accuracyWindowDays&&accuracy(normalized)<weak.maxAccuracy;
  }

  function isDueWord(word,now){
    const normalized=normalizeWord(word,now);
    if(!normalized.nextReview)return false;
    return normalized.nextReview<=localDateKey(now);
  }

  function isOverdueWord(word,now){
    const normalized=normalizeWord(word,now);
    return !!normalized.nextReview&&normalized.nextReview<localDateKey(now);
  }

  function calculateInterval(word,rating,level){
    const normalized=normalizeWord(word);
    const intervals=CONFIG.intervals;
    const previous=Math.max(0,normalized.reviewIntervalDays);
    if(rating==="again")return 0;
    if(rating==="hard")return Math.max(1,Math.min(intervals.hardMaxDays,Math.round(previous*intervals.hardMultiplier)||1));
    const minimum=rating==="easy"
      ?(intervals.easyMinimum[level]||4)
      :(intervals.goodMinimum[level]||2);
    const multiplier=rating==="easy"?intervals.easyMultiplier:intervals.goodMultiplier;
    return Math.min(intervals.maxDays,Math.max(minimum,Math.round(previous*multiplier)||minimum));
  }

  function stateFor(word,now){
    if(isMasteredWord(word))return "mastered";
    if(isWeakWord(word,now))return "weak";
    if(isDueWord(word,now))return "review";
    return normalizeWord(word).reviewCount?"learning":"new";
  }

  function statusFor(word,now){
    const state=stateFor(word,now);
    if(state==="mastered")return "learned";
    if(state==="weak")return "hard";
    return "new";
  }

  function calculateLearningUpdate(word,input={}){
    const at=dateFrom(input.at);
    const rating=normalizeRating(input.rating);
    const previous=normalizeWord(word,at);
    const correctIncrement=rating==="good"||rating==="easy"?1:0;
    const wrongIncrement=rating==="again"?1:0;
    const consecutiveCorrect=correctIncrement
      ?previous.consecutiveCorrect+1
      :rating==="hard"?Math.max(0,previous.consecutiveCorrect-1):0;
    const counters={
      correctCount:previous.correctCount+correctIncrement,
      wrongCount:previous.wrongCount+wrongIncrement,
      reviewCount:previous.reviewCount+1,
      consecutiveCorrect
    };
    const provisional={...previous,...counters,lastResult:rating};
    let level=baseLevel(provisional);
    if(rating==="again")level=previous.level>=5?3:Math.max(1,Math.min(level,previous.level-1));
    if(rating==="hard")level=previous.level>=5?4:Math.max(1,Math.min(level,previous.level));
    if(rating==="easy"&&level<4&&counters.correctCount>=3)level=Math.min(4,level+1);
    let interval=calculateInterval(previous,rating,level);
    let next={
      ...previous,
      ...counters,
      level,
      lastResult:rating,
      lastAnsweredAt:at.toISOString(),
      lastWrongAt:rating==="again"?at.toISOString():previous.lastWrongAt,
      reviewIntervalDays:interval,
      nextReview:addLocalDays(interval,at),
      lastReviewed:localDateKey(at)
    };
    const masteryCandidate={...next,level:5};
    if(masteredByMetrics(masteryCandidate)){
      next.level=5;
      next.reviewIntervalDays=Math.max(CONFIG.mastery.minScheduledDays,next.reviewIntervalDays);
      next.nextReview=addLocalDays(next.reviewIntervalDays,at);
    }else if(next.level>=5){
      next.level=4;
    }
    next.learningState=stateFor(next,at);
    next.status=statusFor(next,at);
    return next;
  }

  function learningWeight(word,now){
    const normalized=normalizeWord(word,now);
    const weights=CONFIG.weights;
    const overdue=normalized.nextReview?Math.max(0,-daysBetween(localDateKey(now),normalized.nextReview)):0;
    let weight=weights.levels[normalized.level]||3;
    if(isOverdueWord(normalized,now))weight+=Math.min(weights.overdueMax,overdue*weights.overduePerDay+weights.overdueBase);
    else if(isDueWord(normalized,now))weight+=weights.due;
    if(isWeakWord(normalized,now))weight+=weights.weak;
    if(normalized.lastResult==="again")weight+=weights.again;
    if(normalized.lastResult==="hard")weight+=weights.hard;
    return weight;
  }

  function sortReviewQueue(words,now){
    return [...(words||[])].sort((a,b)=>{
      const aOver=isOverdueWord(a,now)?1:0;
      const bOver=isOverdueWord(b,now)?1:0;
      if(aOver!==bOver)return bOver-aOver;
      const aWeak=isWeakWord(a,now)?1:0;
      const bWeak=isWeakWord(b,now)?1:0;
      if(aWeak!==bWeak)return bWeak-aWeak;
      const aDue=isDueWord(a,now)?1:0;
      const bDue=isDueWord(b,now)?1:0;
      if(aDue!==bDue)return bDue-aDue;
      return learningWeight(b,now)-learningWeight(a,now);
    });
  }

  function buildSmartSession(words,options={}){
    const all=Array.isArray(words)?words.filter(Boolean):[];
    const session=CONFIG.smartSession;
    const limit=Math.max(1,Math.min(session.maxLimit,Number(options.limit)||session.defaultLimit));
    const seen=new Set();
    const output=[];
    const add=(items,max)=>{
      let added=0;
      for(const word of items){
        if(output.length>=limit||added>=max)break;
        if(!word?.id||seen.has(word.id))continue;
        seen.add(word.id);
        output.push(word);
        added++;
      }
    };
    const due=sortReviewQueue(all.filter(word=>normalizeWord(word).reviewCount>0&&isDueWord(word,options.now)),options.now);
    const weak=sortReviewQueue(all.filter(word=>isWeakWord(word,options.now)),options.now);
    const fresh=all.filter(word=>normalizeWord(word).reviewCount===0)
      .sort((a,b)=>String(a.createdAt||a.created_at||"").localeCompare(String(b.createdAt||b.created_at||"")));
    add(due,Math.ceil(limit*session.dueRatio));
    add(weak,Math.ceil(limit*session.weakRatio));
    add(fresh,Math.ceil(limit*session.newRatio));
    add(sortReviewQueue(all,options.now),limit);
    return output;
  }

  function levelName(level){
    return LEVEL_NAMES[clamp(level||1,1,5)]||LEVEL_NAMES[1];
  }

  return {
    VERSION:"1.0.0",
    CONFIG,
    RATINGS:["again","hard","good","easy"],
    LEVEL_NAMES,
    localDateKey,
    addLocalDays,
    daysBetween,
    normalizeRating,
    normalizeWord,
    accuracy,
    levelName,
    calculateLearningUpdate,
    calculateNextReview:(word,rating,at)=>calculateLearningUpdate(word,{rating,at}).nextReview,
    isWeakWord,
    isDueWord,
    isOverdueWord,
    isMasteredWord,
    learningWeight,
    sortReviewQueue,
    buildSmartSession
  };
});
