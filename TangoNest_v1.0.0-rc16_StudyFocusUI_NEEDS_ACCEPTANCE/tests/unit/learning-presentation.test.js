const assert=require("node:assert/strict");
const engine=require("../../learning-engine.js");
const view=require("../../ui/learning-presentation.js");

const now=new Date(2026,7,24,12,0,0);
const base={
  id:"word",
  front:"hello",
  back:"こんにちは",
  level:1,
  reviewCount:0,
  correctCount:0,
  wrongCount:0,
  consecutiveCorrect:0,
  nextReview:"2026-08-24",
  reviewIntervalDays:0,
  lastResult:""
};

assert.equal(view.VERSION,"1.0.0");
assert.equal(view.state(base,now).label,"New");
assert.equal(view.review(base,now).label,"Ready to learn");

const due={...base,level:2,reviewCount:1,correctCount:1,lastResult:"good",lastAnsweredAt:"2026-08-23T12:00:00.000Z"};
assert.equal(view.state(due,now).label,"Due today");
assert.equal(view.review(due,now).label,"Due today");

const overdue={...due,nextReview:"2026-08-21"};
assert.equal(view.review(overdue,now).label,"Overdue by 3 days");

const weak={...due,lastResult:"again",wrongCount:1,lastWrongAt:"2026-08-24T01:00:00.000Z"};
assert.equal(view.state(weak,now).label,"Needs practice");

const strong={...base,level:4,reviewCount:5,correctCount:5,consecutiveCorrect:2,lastResult:"good",lastAnsweredAt:"2026-08-23T01:00:00.000Z",nextReview:"2026-09-01",reviewIntervalDays:14};
assert.equal(view.state(strong,now).label,"Strong");

const mastered={...strong,level:5,reviewCount:6,correctCount:6,consecutiveCorrect:3,reviewIntervalDays:30,nextReview:"2026-09-23"};
assert.equal(engine.isMasteredWord(mastered),true);
assert.equal(view.state(mastered,now).label,"Mastered");
assert.equal(view.accuracy(mastered).label,"100% accuracy");
assert.equal(view.lastStudied({...due,lastAnsweredAt:"2026-08-23T08:00:00.000Z"},now),"Yesterday");

const summary=view.session([base,due,weak,strong,mastered],now);
assert.equal(summary.new,1);
assert.equal(summary.mastered,1);
assert.ok(summary.total>0);
assert.ok(summary.minutes>0);

const feedback=view.rating(due,"good",now);
assert.equal(feedback.label,"Good progress");
assert.equal(typeof feedback.review,"string");

console.log("LEARNING_PRESENTATION_TEST_PASS");
