"use strict";

const fs=require("node:fs");
const path=require("node:path");
const postcss=require("postcss");
const selectorParser=require("postcss-selector-parser");

const rootDir=path.resolve(__dirname,"..");
const cssPath=path.join(rootDir,"style.css");
const sourceFiles=[
  "index.html","config.js","app.js","learning-engine.js","tn-supabase-sync.js",
  "tn-library-management.js","tn-learning-flow.js","ui/learning-presentation.js","ui/runtime.js"
];
const source=sourceFiles.map(file=>fs.readFileSync(path.join(rootDir,file),"utf8")).join("\n");
const statePattern=/^(active|show|error|success|correct|wrong|selected|synced|local|danger|green|red|blue|yellow|purple|strong|weak|due|new|mastered|learning|is-|has-|level-|tn-level-)/;

function selectorIsUnused(selector){
  const tokens=[];
  try{
    selectorParser(selectors=>selectors.walk(node=>{
      if(node.type==="class"||node.type==="id")tokens.push(node.value);
    })).processSync(selector);
  }catch(error){
    return false;
  }
  if(!tokens.length)return false;
  return tokens.some(token=>!statePattern.test(token)&&!source.includes(token));
}

const css=fs.readFileSync(cssPath,"utf8");
const root=postcss.parse(css,{from:cssPath});
const removed=[];

root.walkRules(rule=>{
  const selectors=rule.selectors||[rule.selector];
  const kept=selectors.filter(selector=>{
    if(!selectorIsUnused(selector))return true;
    removed.push(selector.trim());
    return false;
  });
  if(!kept.length)rule.remove();
  else if(kept.length!==selectors.length)rule.selectors=kept;
});

let removedEmpty=true;
while(removedEmpty){
  removedEmpty=false;
  root.walkAtRules(rule=>{
    if(!rule.nodes?.length){rule.remove();removedEmpty=true;}
  });
}

const output=root.toString();
const report={
  sourceBytes:Buffer.byteLength(css),
  resultBytes:Buffer.byteLength(output),
  bytesRemoved:Buffer.byteLength(css)-Buffer.byteLength(output),
  selectorsRemoved:removed.length,
  selectors:removed.sort()
};

if(process.argv.includes("--write"))fs.writeFileSync(cssPath,output);
process.stdout.write(JSON.stringify(report,null,2)+"\n");
