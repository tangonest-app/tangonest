"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),assert=require("node:assert/strict");
const [folder,url]=process.argv.slice(2);
if(!folder||!url)throw new Error("Usage: npm run verify:published -- <candidate-directory> <site-url-ending-in-/> ");
const base=new URL(url),root=path.resolve(folder);
if(!base.pathname.endsWith("/"))throw new Error("Site URL must end in / to preserve the project path.");
const inventory=JSON.parse(fs.readFileSync(path.join(root,"release-inventory.json"),"utf8"));
(async()=>{
  for(const item of inventory.inventory){
    assert.ok(!item.file.includes("..")&&!path.isAbsolute(item.file),"Invalid inventory path");
    const local=fs.readFileSync(path.join(root,item.file));
    assert.equal(crypto.createHash("sha256").update(local).digest("hex"),item.sha256,`Candidate changed: ${item.file}`);
    const response=await fetch(new URL(item.file,base),{cache:"no-store",signal:AbortSignal.timeout(30000)});
    assert.equal(response.status,200,`HTTP ${response.status}: ${item.file}`);
    const bytes=Buffer.from(await response.arrayBuffer());
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"),item.sha256,`Published bytes differ: ${item.file}`);
  }
  if(process.argv.includes("--record-baseline"))fs.writeFileSync(path.join(__dirname,"published-baseline.json"),JSON.stringify(inventory,null,2)+"\n");
  console.log(`Published alignment OK: ${inventory.inventory.length} files; ${inventory.release}; ${base.href}`);
})().catch(error=>{console.error(error.message);process.exitCode=1});
