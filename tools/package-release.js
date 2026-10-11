"use strict";
// Build first. Packaging fails on stale outputs and never rewrites sources or SQL.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
require("./check-runtime.js");
const root=path.resolve(__dirname,".."),release=require("../release.json");
const output=path.resolve(process.argv[2]||path.join(root,"work",`release-${release.version}`));
if(fs.existsSync(output))throw new Error("Output already exists; choose a new directory to preserve prior artifacts.");
if(root===output||root.startsWith(output+path.sep))throw new Error("Output cannot contain the source checkout.");
const shell=JSON.parse(fs.readFileSync(path.join(root,"sw.js"),"utf8").match(/const SHELL=(\[[\s\S]*?\])\.map/)[1]);
const files=[...new Set([...shell.filter(p=>p!=="./").map(p=>p.slice(2)),"sw.js","release.json",`${release.iconDirectory}/provenance.json`,"vendor/supabase-LICENSE.txt","assets/ui/LICENSE"])].sort();
const inventory=[];
for(const file of files){
  if(file.includes("..")||/^(?:qa|tests|tools|node_modules|docs)\//.test(file)||file.endsWith(".sql"))throw new Error(`Non-runtime file: ${file}`);
  const bytes=fs.readFileSync(path.join(root,file));
  inventory.push({file,bytes:bytes.length,sha256:crypto.createHash("sha256").update(bytes).digest("hex")});
}
const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,"published-baseline.json"),"utf8"));
if(release.version===baseline.release){
  const previous=new Map(baseline.inventory.map(item=>[item.file,item.sha256]));
  if(inventory.length!==previous.size||inventory.some(item=>previous.get(item.file)!==item.sha256))throw new Error("Runtime changed without a new release.json version. Bump the version, build, and test again.");
}
fs.mkdirSync(output,{recursive:true});
for(const {file} of inventory){const dest=path.join(output,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,file),dest)}
fs.writeFileSync(path.join(output,".nojekyll"),"");
fs.writeFileSync(path.join(output,"release-inventory.json"),JSON.stringify({release:release.version,inventory},null,2)+"\n");
console.log(`Packaged ${inventory.length} verified files at ${output}`);
