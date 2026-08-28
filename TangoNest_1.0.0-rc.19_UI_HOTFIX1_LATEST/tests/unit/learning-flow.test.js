"use strict";

const assert=require("node:assert/strict");
const engine=require("../../learning-engine.js");

const start=new Date(2026,7,24,12,0,0,0);
const day=index=>new Date(2026,7,24+index,12,0,0,0);
let word={
  id:"flow-word",
  front:"flow",
  back:"流れ",
  level:1,
  status:"new",
  nextReview:engine.localDateKey(start),
  correctCount:0,
  wrongCount:0,
  reviewCount:0,
  consecutiveCorrect:0,
  reviewIntervalDays:0,
  lastResult:"",
  learningState:"new",
  createdAt:start.toISOString()
};

assert.equal(engine.isDueWord(word,start),true,"new word is available to learn today");

word=engine.calculateLearningUpdate(word,{rating:"again",mode:"cards",at:day(0)});
assert.equal(word.learningState,"weak","Cards Again records a weakness");
assert.equal(word.nextReview,"2026-08-24","Again is due again today");

let todaySession=engine.buildSmartSession([word],{limit:10,now:day(0)});
assert.deepEqual(todaySession.map(item=>item.id),["flow-word"],"weak due word enters Today's Session");

word=engine.calculateLearningUpdate(word,{rating:"good",mode:"typing",at:day(0)});
assert.equal(engine.isWeakWord(word,day(0)),true,"one correction does not instantly erase a recent mistake");

word=engine.calculateLearningUpdate(word,{rating:"good",mode:"listening",at:day(1)});
assert.equal(engine.isWeakWord(word,day(1)),false,"stable correction can recover from Weak");

word=engine.calculateLearningUpdate(word,{rating:"good",mode:"choice",at:day(3)});
word=engine.calculateLearningUpdate(word,{rating:"good",mode:"choice",at:day(7)});
word=engine.calculateLearningUpdate(word,{rating:"easy",mode:"cards",at:day(15)});
word=engine.calculateLearningUpdate(word,{rating:"good",mode:"choice",at:day(31)});
assert.equal(word.reviewCount,7);
assert.equal(word.level,5,"stable multi-mode learning reaches Level 5");
assert.equal(engine.isMasteredWord(word),true,"stable multi-mode learning reaches Mastered");

word=engine.calculateLearningUpdate(word,{rating:"again",mode:"listening",at:day(40)});
assert.equal(engine.isMasteredWord(word),false,"a Mastered word can return to review");
assert.equal(word.learningState,"weak");
assert.equal(word.wrongCount,2);

console.log("LEARNING_FLOW_TEST_PASS");
