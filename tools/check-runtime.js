"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,".."),pairs=require("./runtime-pairs.json");
const read=file=>fs.readFileSync(path.join(root,file));
const localeBundle=`window.TangoNestInterfaceLocales=${JSON.stringify(require("../locales/registry.js"))};\nwindow.TangoNestEnglish=${JSON.stringify(JSON.parse(read("locales/en.json").toString()))};\n`;
assert.equal(read("locales/base.js").toString(),localeBundle,"English browser dictionary is stale. Run npm run build.");
for(const [source,target] of pairs)assert.ok(read(source).equals(read(target)),`${source} differs from loaded ${target}. Run npm run build, then test the generated runtime.`);
const html=read("index.html").toString();
const shell=JSON.parse(read("sw.js").toString().match(/const SHELL=(\[[\s\S]*?\])\.map/)[1]);
const generated=new Set(pairs.map(([,target])=>target));
const sources=new Set(pairs.map(([source])=>source));
const refs=[...html.matchAll(/(?:src|href)="\.\/([^"?#]+)(?:\?[^"#]*)?"/g)].map(m=>m[1]);
for(const ref of refs){
  assert.ok(!sources.has(ref),`HTML must load compatibility entrypoint, not ${ref}`);
  assert.ok(fs.existsSync(path.join(root,ref)),`Missing loaded asset: ${ref}`);
  assert.ok(shell.includes(`./${ref}`),`Offline shell misses ${ref}`);
}
for(const target of generated)assert.ok(refs.includes(target),`Generated entrypoint is not loaded: ${target}`);
for(const ref of shell){
  assert.ok(ref.startsWith("./")&&!ref.includes(".."),`Invalid shell path: ${ref}`);
  if(ref!=="./")assert.ok(fs.existsSync(path.join(root,ref)),`Missing shell asset: ${ref}`);
}
console.log(`Runtime alignment OK: ${pairs.length} source/output pairs; ${refs.length} HTML references; ${shell.length} offline entries.`);
