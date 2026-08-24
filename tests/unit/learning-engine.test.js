"use strict";

const assert=require("node:assert/strict");
const engine=require("../../learning-engine.js");

const at=(year,month,day,hour=12)=>new Date(year,month-1,day,hour,0,0,0);
const NOW=at(2026,8,24);

function fresh(id="word-1"){
  return {
    id,
    front:"word",
    back:"meaning",
    level:1,
    status:"new",
    nextReview:"2026-08-24",
    correctCount:0,
    wrongCount:0,
    reviewCount:0,
    consecutiveCorrect:0,
    reviewIntervalDays:0,
    lastResult:"",
    learningState:"new"
  };
}

function rate(word,rating,days=0){
  return engine.calculateLearningUpdate(word,{rating,at:at(2026,8,24+days)});
}

assert.equal(engine.VERSION,"1.0.0");
assert.equal(engine.localDateKey(at(2026,8,24,23)),"2026-08-24");
assert.equal(engine.addLocalDays(1,at(2026,8,24,23)),"2026-08-25");
assert.equal(engine.levelName(1),"New");
assert.equal(engine.levelName(5),"Mastered");

const newWord=engine.normalizeWord(fresh(),NOW);
assert.equal(newWord.level,1);
assert.equal(newWord.reviewCount,0);
assert.equal(engine.isDueWord(newWord,NOW),true);
assert.equal(engine.isWeakWord(newWord,NOW),false);
assert.equal(engine.isMasteredWord(newWord),false);

const correct=rate(fresh(),"good");
assert.equal(correct.correctCount,1);
assert.equal(correct.wrongCount,0);
assert.equal(correct.reviewCount,1);
assert.equal(correct.level,2);
assert.equal(correct.lastResult,"good");
assert.equal(correct.nextReview,"2026-08-26");
assert.equal(engine.isDueWord(correct,NOW),false);

const incorrect=rate(fresh(),"again");
assert.equal(incorrect.correctCount,0);
assert.equal(incorrect.wrongCount,1);
assert.equal(incorrect.reviewCount,1);
assert.equal(incorrect.level,1);
assert.equal(incorrect.nextReview,"2026-08-24");
assert.equal(incorrect.status,"hard");
assert.equal(engine.isWeakWord(incorrect,NOW),true);
assert.equal(engine.isDueWord(incorrect,NOW),true);

const hardBase={
  ...fresh("hard-word"),
  level:3,
  correctCount:3,
  wrongCount:1,
  reviewCount:4,
  consecutiveCorrect:2,
  reviewIntervalDays:8,
  lastResult:"good",
  lastAnsweredAt:at(2026,8,20).toISOString(),
  nextReview:"2026-08-28"
};
const hard=rate(hardBase,"hard");
assert.equal(hard.correctCount,3);
assert.equal(hard.wrongCount,1);
assert.equal(hard.reviewCount,5);
assert.equal(hard.level,3);
assert.equal(hard.reviewIntervalDays,5);
assert.equal(hard.status,"hard");
assert.equal(engine.isWeakWord(hard,NOW),true);

let mastered=fresh("mastered-word");
for(let index=0;index<6;index++)mastered=rate(mastered,"good",index);
assert.equal(mastered.correctCount,6);
assert.equal(mastered.reviewCount,6);
assert.equal(mastered.level,5);
assert.equal(mastered.status,"learned");
assert.equal(mastered.learningState,"mastered");
assert.ok(mastered.reviewIntervalDays>=30);
assert.equal(engine.isMasteredWord(mastered),true);

const masteredWrong=engine.calculateLearningUpdate(mastered,{rating:"again",at:at(2026,9,1)});
assert.equal(masteredWrong.level,3);
assert.equal(masteredWrong.status,"hard");
assert.equal(masteredWrong.learningState,"weak");
assert.equal(engine.isMasteredWord(masteredWrong),false);
assert.equal(engine.isWeakWord(masteredWrong,at(2026,9,1)),true);

const recoveryOne=engine.calculateLearningUpdate(masteredWrong,{rating:"good",at:at(2026,9,1)});
const recoveryTwo=engine.calculateLearningUpdate(recoveryOne,{rating:"good",at:at(2026,9,2)});
const recoveryThree=engine.calculateLearningUpdate(recoveryTwo,{rating:"easy",at:at(2026,9,3)});
assert.equal(engine.isWeakWord(recoveryOne,at(2026,9,1)),true);
assert.equal(engine.isWeakWord(recoveryTwo,at(2026,9,2)),false);
assert.equal(engine.isMasteredWord(recoveryThree),true);

const overdue={...correct,nextReview:"2026-08-20"};
assert.equal(engine.isDueWord(overdue,NOW),true);
assert.equal(engine.isOverdueWord(overdue,NOW),true);
assert.equal(engine.isOverdueWord({...overdue,nextReview:"2026-08-24"},NOW),false);

const easy=rate({...fresh(),correctCount:2,reviewCount:2,consecutiveCorrect:2,level:2,reviewIntervalDays:4},"easy");
assert.equal(easy.lastResult,"easy");
assert.ok(easy.reviewIntervalDays>=8);
assert.ok(easy.level>=3);

const queue=engine.sortReviewQueue([
  {...fresh("new"),nextReview:"2026-08-24"},
  {...correct,id:"due",nextReview:"2026-08-24"},
  {...incorrect,id:"weak",nextReview:"2026-08-24"},
  {...correct,id:"overdue",nextReview:"2026-08-20"}
],NOW);
assert.equal(queue[0].id,"overdue");

const smart=engine.buildSmartSession([
  {...correct,id:"due",nextReview:"2026-08-24"},
  {...incorrect,id:"weak"},
  {...fresh("new-a"),createdAt:"2026-08-20T00:00:00Z"},
  {...fresh("new-b"),createdAt:"2026-08-21T00:00:00Z"}
],{limit:4,now:NOW});
assert.equal(smart.length,4);
assert.equal(new Set(smart.map(word=>word.id)).size,4);
assert.deepEqual(engine.buildSmartSession([],{limit:10,now:NOW}),[]);
assert.equal(engine.buildSmartSession([fresh("only")],{limit:10,now:NOW}).length,1);

console.log("LEARNING_ENGINE_TEST_PASS");
