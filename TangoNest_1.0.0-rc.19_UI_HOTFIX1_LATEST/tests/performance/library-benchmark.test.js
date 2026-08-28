"use strict";

const assert=require("node:assert/strict");
const {performance}=require("node:perf_hooks");

function fixture(count){
  return Array.from({length:count},(_,index)=>({
    id:`word-${index}`,
    front:`word ${String(index).padStart(5,"0")}`,
    back:`meaning ${index}`,
    pos:index%2?"noun":"verb",
    saved:index%11===0,
    level:1+(index%5),
    nextReview:index%3===0?"2026-08-24":"2026-09-01"
  }));
}

for(const count of [100,1000,5000]){
  const words=fixture(count);
  const start=performance.now();
  let result=[];
  for(let pass=0;pass<20;pass++){
    const query=pass%2?"word 000":"meaning 4";
    result=words.filter(word=>`${word.front} ${word.back} ${word.pos}`.includes(query)).sort((a,b)=>a.front.localeCompare(b.front)).slice(0,100);
  }
  const elapsed=performance.now()-start;
  assert.ok(result.length<=100);
  assert.ok(elapsed<500,`${count} word filter benchmark took ${elapsed.toFixed(1)}ms`);
  console.log(`LIBRARY_BENCHMARK ${count} words ${elapsed.toFixed(1)}ms`);
}
