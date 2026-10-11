"use strict";
const assert=require("node:assert/strict");
const bulk=require("../../bulk-format.js");
const pair={frontLang:"en-US",backLang:"ja-JP",listId:"a"};
const parse=text=>bulk.analyze(text,pair);
assert.equal(parse("\tmeaning\tnoun").invalid,1,"Missing front does not shift the following columns");
assert.equal(parse("word\t\tnoun").invalid,1);
assert.equal(parse("book\t本\t\t\t\t").ready,1,"Optional empty columns are valid");
assert.equal(parse('"hello, friend",こんにちは,noun,,"Hello, friend!"').rows[0].memo,"Hello, friend!");
assert.equal(parse('"broken,entry').invalid,1);
assert.equal(parse("book\t本\tnoun\t\tA book.\tbʊk").rows[0].pronunciation,"bʊk");
assert.equal(parse("book\t本\tnoun\t\tA book.\tbʊk\textra").invalid,1);
assert.equal(parse("学生\tstudent\tnoun\t-\txuéshēng | 我是学生。").rows[0].memo,"我是学生。");
assert.equal(parse("学生\tstudent\tnoun\t-\txuéshēng | 我是学生。").rows[0].pronunciation,"xuéshēng");
assert.equal(parse("book  本  noun").valid,1);
assert.equal(parse("book 本 noun").valid,1);
assert.equal(parse("book\t本\nnothing\nwater\t水").invalid,1,"Invalid rows stay visible");
assert.equal(parse("Front\tBack").invalid,1);
assert.equal(parse("\uFEFFbook\t本\r\nwater\t水").valid,2);
assert.equal(parse("book\t本\nbook\t本").warnings,1);
assert.equal(parse("<img src=x onerror=alert(1)>\tHTML").warnings,1);
assert.equal(parse("book\t\uFFFD").invalid,1);
const foreign={front:"book",back:"本",pos:"",frontLang:"fr-FR",backLang:"ja-JP",listId:"a"};
assert.equal(bulk.analyze("book\t本",{...pair,words:[foreign]}).warnings,0,"Another language pair is not an exact duplicate");
const words=[{...foreign,frontLang:"en-US"}];
assert.equal(bulk.analyze("book\t本",{...pair,words}).rows[0].duplicate,true);
assert.equal(bulk.analyze("book\t本",{...pair,words:listCopy(words)}).rows[0].duplicate,false);
function listCopy(rows){return rows.map(row=>({...row,listId:"b"}));}
for(const code of ["en-US","ja-JP","ko-KR","fr-FR","zh-CN","zh-TW","es-ES","de-DE","it-IT","pt-BR","ar-SA","ru-RU","nl-NL","vi-VN","th-TH","tr-TR","hi-IN","id-ID","el-GR","he-IL"]){
  for(const format of bulk.formats){
    const text=bulk.sample({format:format.id,frontLang:code,backLang:"ja-JP"});
    assert.equal(bulk.analyze(text,{...pair,format:format.id}).valid,2,`${code} ${format.id} samples round-trip`);
  }
}
for(const size of [10,100,500,1000]){
  const text=Array.from({length:size},(_,i)=>`word-${i}\t意味${i}\tnoun\t\tExample ${i}.\treading`).join("\n");
  const start=performance.now(),result=bulk.analyze(text,{...pair,words});
  assert.equal(result.ready,size);
  const ms=performance.now()-start;
  assert.ok(ms<1000,`Parse ${size} within one second`);
  console.log(`BULK_PARSE ${size}: ${ms.toFixed(2)}ms`);
}
assert.ok(bulk.prompt({frontLabel:"Chinese",backLabel:"Japanese"}).includes(bulk.formatText("complete")));
console.log("BULK_FORMAT_TEST_PASS");
