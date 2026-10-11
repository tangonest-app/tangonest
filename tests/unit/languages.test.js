"use strict";
const assert=require("node:assert/strict"),languages=require("../../languages.js");
assert.equal(languages.registry.length,37);
assert.equal(new Set(languages.registry.map(item=>item.id)).size,37);
for(const item of languages.registry){
  assert.equal(new Intl.Locale(item.locale).toString(),item.locale);
  assert.ok(item.name&&item.nativeName&&item.ttsLocale&&item.script);
  assert.ok(Object.isFrozen(item));
}
assert.deepEqual(languages.options.slice(0,3).map(item=>item[0]),["en-US","ja-JP","ko-KR"]);
for(const [input,result]of [["English","en-US"],["mandarin","zh-CN"],["Chinese Traditional","zh-TW"],["farsi","fa-IR"],["tagalog","fil-PH"],["EN-gb","en-GB"],["pt-PT","pt-PT"],["ja","ja-JP"]])assert.equal(languages.normalize(input),result);
for(const id of ["ar-SA","he-IL","fa-IR","ur-PK"])assert.equal(languages.direction(id),"rtl");
assert.equal(languages.direction("en-GB"),"ltr");
assert.equal(languages.find("zh-Hant-HK").id,"zh-TW");
assert.equal(languages.label("pt-PT"),"Portuguese");
console.log("LANGUAGE_REGISTRY_TEST_PASS");
