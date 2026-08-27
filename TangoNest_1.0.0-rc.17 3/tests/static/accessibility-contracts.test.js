"use strict";

const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");

const root=path.resolve(__dirname,"../..");
const style=fs.readFileSync(path.join(root,"style.css"),"utf8");

function token(name){
  const value=style.match(new RegExp(`--${name}:(#[0-9a-f]{6})`,"i"))?.[1];
  assert.ok(value,`Missing color token: ${name}`);
  return value;
}

function luminance(hex){
  const channels=[1,3,5]
    .map(index=>parseInt(hex.slice(index,index+2),16)/255)
    .map(value=>value<=0.03928?value/12.92:((value+0.055)/1.055)**2.4);
  return 0.2126*channels[0]+0.7152*channels[1]+0.0722*channels[2];
}

function contrast(front,back){
  const a=luminance(front);
  const b=luminance(back);
  return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
}

for(const name of ["text","sub","muted","brand","brand-dark","red"]){
  assert.ok(contrast(token(name),"#ffffff")>=4.5,`${name} must meet WCAG AA against white`);
}
assert.ok(contrast(token("muted"),token("surface-2"))>=4.5,"muted metadata must meet WCAG AA on subtle surfaces");

assert.match(style,/:focus-visible\{/);
assert.match(style,/--control-height:44px/);
assert.match(style,/@media\(prefers-reduced-motion:reduce\)/);
assert.match(style,/env\(safe-area-inset-bottom/);

console.log("ACCESSIBILITY_CONTRACTS_TEST_PASS");
