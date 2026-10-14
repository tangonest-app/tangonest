"use strict";

const assert=require("node:assert/strict");
const fields=require("../../example-fields-rc19-fdg1.js");

assert.deepEqual(
  fields.normalizeFields("我是学生。 shi",""),
  {memo:"我是学生。",pronunciation:"shi",changed:true}
);
assert.deepEqual(
  fields.normalizeFields("shi | 我是学生。",""),
  {memo:"我是学生。",pronunciation:"shi",changed:true}
);
assert.deepEqual(
  fields.normalizeFields("Il y a un accident. /aksidɑ̃/",""),
  {memo:"Il y a un accident.",pronunciation:"/aksidɑ̃/",changed:true}
);
assert.deepEqual(
  fields.normalizeFields("I eat an apple every morning.",""),
  {memo:"I eat an apple every morning.",pronunciation:"",changed:false}
);
assert.deepEqual(
  fields.normalizeFields("我是学生。 shi","shì"),
  {memo:"我是学生。",pronunciation:"shì",changed:true}
);

console.log("example field tests passed");

assert.equal(fields.normalizeWord({memo:"A sentence.",pronunciation:"",pinyin:"legacy"}).pronunciation,"","explicit empty pronunciation does not revive a legacy alias");
assert.equal(fields.normalizeWord({memo:"A sentence.",pinyin:"shǒudū"}).pronunciation,"shǒudū","missing canonical field retains legacy Pinyin");
