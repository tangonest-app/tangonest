"use strict";
// Exercise the actual build/package tools in an isolated copy, including failure paths.
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),assert=require("node:assert/strict"),{spawnSync}=require("node:child_process");
const root=path.resolve(__dirname,"../.."),scratch=fs.mkdtempSync(path.join(os.tmpdir(),"tangonest-pipeline-"));
const pairs=require("../../tools/runtime-pairs.json");
const shell=JSON.parse(fs.readFileSync(path.join(root,"sw.js"),"utf8").match(/const SHELL=(\[[\s\S]*?\])\.map/)[1]);
const release=require("../../release.json");
const files=new Set([...shell.filter(p=>p!=="./").map(p=>p.slice(2)),...pairs.flat(),"locales/registry.js","sw.js","release.json","tools/runtime-pairs.json","tools/check-runtime.js","tools/prepare-release.js","tools/package-release.js","tools/published-baseline.json",`${release.iconDirectory}/provenance.json`,"vendor/supabase-LICENSE.txt","assets/ui/LICENSE"]);
const run=(script,args=[])=>spawnSync(process.execPath,[path.join(scratch,script),...args],{cwd:scratch,encoding:"utf8"});
try{
  for(const file of files){const dest=path.join(scratch,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,file),dest)}
  const sqlFiles=["SUPABASE_SCHEMA_CURRENT.sql","TANGONEST_RC19_PRODUCTION_MIGRATION.sql"];
  for(const file of sqlFiles)fs.writeFileSync(path.join(scratch,file),`preserve ${file}`);
  // Make the baseline follow this release so the guard stays meaningful after every version bump.
  const initial=run("tools/package-release.js",["baseline-fixture"]);assert.equal(initial.status,0,initial.stderr);
  fs.copyFileSync(path.join(scratch,"baseline-fixture/release-inventory.json"),path.join(scratch,"tools/published-baseline.json"));
  for(const file of ["app.js","default-playlist.js","learning-engine.js"])fs.appendFileSync(path.join(scratch,file),"\n// isolated pipeline propagation probe\n");
  assert.notEqual(run("tools/check-runtime.js").status,0,"Stale runtime must fail verification");
  assert.notEqual(run("tools/package-release.js",["candidate-stale"]).status,0,"Stale runtime must not package");
  const build=run("tools/prepare-release.js");assert.equal(build.status,0,build.stderr);
  const check=run("tools/check-runtime.js");assert.equal(check.status,0,check.stderr);
  for(const [source,target] of pairs)assert.ok(fs.readFileSync(path.join(scratch,source)).equals(fs.readFileSync(path.join(scratch,target))));
  for(const file of sqlFiles)assert.equal(fs.readFileSync(path.join(scratch,file),"utf8"),`preserve ${file}`);
  const first=fs.readFileSync(path.join(scratch,"sw.js"));
  assert.equal(run("tools/prepare-release.js").status,0);
  assert.ok(first.equals(fs.readFileSync(path.join(scratch,"sw.js"))),"Rebuilding must be deterministic");
  assert.notEqual(run("tools/package-release.js",["candidate-same-version"]).status,0,"Changed runtime must use a new release version");
  const nextRelease={...release,version:release.version.replace(/fdg(\d+)$/,(_,number)=>`fdg${Number(number)+1}`)};
  fs.writeFileSync(path.join(scratch,"release.json"),JSON.stringify(nextRelease));
  assert.equal(run("tools/prepare-release.js").status,0);
  const pack=run("tools/package-release.js",["candidate"]);assert.equal(pack.status,0,pack.stderr);
  const candidate=path.join(scratch,"candidate"),inventory=JSON.parse(fs.readFileSync(path.join(candidate,"release-inventory.json")));
  for(const {file} of inventory.inventory){assert.ok(!file.endsWith(".sql"));assert.ok(fs.readFileSync(path.join(candidate,file)).equals(fs.readFileSync(path.join(scratch,file))))}
  assert.notEqual(run("tools/package-release.js",["candidate"]).status,0,"Existing candidate must never be overwritten");
  console.log(`PIPELINE_TEST_PASS: stale rejection, source propagation, deterministic build, preserved SQL, ${inventory.inventory.length} packaged files, overwrite rejection, version guard`);
}finally{fs.rmSync(scratch,{recursive:true,force:true})}
