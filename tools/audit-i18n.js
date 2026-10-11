"use strict";
const fs=require("node:fs"),path=require("node:path"),acorn=require("acorn");
const root=path.resolve(__dirname,".."),en=require("../locales/en.json");
const files=["app.js","tn-library-management.js","tn-supabase-sync.js","ui/runtime.js","ui/learning-presentation.js","tn-learning-flow.js"];
const missing=[];
const registry=require("../locales/registry.js");
for(const [locale]of registry){
  if(!fs.existsSync(path.join(root,"locales",`${locale}.json`)))missing.push({file:`locales/${locale}.json`,key:"Missing published locale"});
}
for(const file of files){
  const ast=acorn.parse(fs.readFileSync(path.join(root,file),"utf8"),{ecmaVersion:"latest"});
  function walk(node){
    if(!node||typeof node!=="object")return;
    if(node.type==="CallExpression"&&["t","mark"].includes(node.callee?.property?.name)&&node.callee.object?.property?.name==="TNI18n"){
      const key=node.arguments[0]?.value;
      if(typeof key==="string"&&!Object.hasOwn(en,key))missing.push({file,key});
    }
    for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value?.type)walk(value);
  }
  walk(ast);
}
const coverage={};
for(const file of fs.readdirSync(path.join(root,"locales")).filter(file=>file.endsWith(".json")&&file!=="en.json")){
  const dictionary=JSON.parse(fs.readFileSync(path.join(root,"locales",file),"utf8"));
  const params=text=>[...text.matchAll(/\{(\w+)\}/g)].map(match=>match[1]).sort().join();
  for(const [key,value]of Object.entries(dictionary)){
    if(!Object.hasOwn(en,key)||typeof value!=="string"||!value.trim()||params(value)!==params(en[key]))missing.push({file:`locales/${file}`,key});
  }
  coverage[file.slice(0,-5)]={translated:Object.keys(dictionary).length,total:Object.keys(en).length,missing:Object.keys(en).filter(key=>!Object.hasOwn(dictionary,key))};
}
fs.mkdirSync(path.join(root,"qa"),{recursive:true});
fs.writeFileSync(path.join(root,"qa/i18n-coverage.json"),JSON.stringify({missingKeys:missing,coverage},null,2));
console.log(JSON.stringify({missingKeys:missing,coverage:Object.fromEntries(Object.entries(coverage).map(([locale,data])=>[locale,`${data.translated}/${data.total}`]))},null,2));
if(missing.length||(process.argv.includes("--release")&&Object.values(coverage).some(data=>data.missing.length)))process.exitCode=1;
