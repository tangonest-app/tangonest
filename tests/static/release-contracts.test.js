"use strict";

const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");

const root=path.resolve(__dirname,"../..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const html=read("index.html");
const app=read("app.js");
const config=read("config.js");
const library=read("tn-library-management.js");
const manifest=JSON.parse(read("manifest.json"));
const runtime=read("ui/runtime.js");
const serviceWorker=read("sw.js");
const sync=read("tn-supabase-sync.js");
const style=read("style.css");
const themeStyle=read("ui/forest-desk-glass.css");
const sql=read("SUPABASE_SCHEMA_CURRENT.sql");
const playwright=read("playwright.config.js");
const workflow=read(".github/workflows/qa.yml");

assert.doesNotMatch(html,/qa\/browser-harness/);
assert.doesNotMatch(sync,/service_role/i);
assert.doesNotMatch(html,/service_role/i);
assert.doesNotMatch(config,/service_role/i);
assert.equal((config.match(/sb_publishable_/g)||[]).length,1,"Publishable key has one source of truth");
assert.doesNotMatch(sync,/sb_publishable_|bkbteylavujkfiwuqwdq/);
assert.doesNotMatch(serviceWorker,/https?:\/\/|\/rest\/v1|authorization|auth\/v1/i,"Service Worker must never cache cloud or auth traffic");
assert.match(serviceWorker,/request\.method!=="GET"/);
assert.match(serviceWorker,/url\.origin!==BASE\.origin/);
assert.match(serviceWorker,/SHELL_PATHS\.has\(url\.pathname\)/);
assert.match(serviceWorker,/async function staticResponse[\s\S]+await fetch\(request\)[\s\S]+return cached\|\|Response\.error\(\)/,"Versioned assets use network-first with offline fallback");
assert.match(serviceWorker,/tangonest-shell-v1\.0\.0-rc\.19-fdg5/);
assert.match(serviceWorker,/\.\/default-playlist-rc19-fdg1\.js/);
assert.match(serviceWorker,/\.\/assets\/botanical-corner\.svg/);
assert.match(serviceWorker,/\.\/assets\/forest-study-login-v1\.png/);
assert.match(runtime,/SKIP_WAITING/);
assert.match(runtime,/controllerchange/);
assert.match(runtime,/localQa\|\|!\("serviceWorker" in navigator\)/);
assert.equal(manifest.start_url,"./");
assert.equal(manifest.scope,"./");
assert.equal(manifest.display,"standalone");
assert.ok(manifest.icons.every(icon=>fs.existsSync(path.join(root,icon.src))),"PWA icons must exist");
const pngSize=file=>{
  const data=fs.readFileSync(path.join(root,file));
  assert.equal(data.subarray(1,4).toString("ascii"),"PNG",`${file} must be a PNG`);
  return [data.readUInt32BE(16),data.readUInt32BE(20)];
};
for(const [file,size] of [["favicon.png",64],["apple-touch-icon.png",180],["icon-192.png",192],["icon-512.png",512],["icon-1024.png",1024]]){
  assert.deepEqual(pngSize(file),[size,size],`${file} must keep its declared square size`);
}
assert.match(html,/class="auth-logo"[^>]*><img src="\.\/icon-192\.png\?v=1\.0\.0-rc\.19-fdg5"/);
assert.match(html,/class="brand-mark"[^>]*><img src="\.\/icon-192\.png\?v=1\.0\.0-rc\.19-fdg5"/);
assert.match(style,/@media\(prefers-reduced-motion:reduce\)/);
assert.equal((style.match(/^:root\{/gm)||[]).length,1);
assert.doesNotMatch(style,/letter-spacing\s*:\s*-/);
assert.ok(Buffer.byteLength(style)<110000,"CSS legacy cleanup must remain below the Task 8 size ceiling");
assert.ok(Buffer.byteLength(style)+Buffer.byteLength(themeStyle)<150000,"Combined CSS must stay within the release cleanup ceiling");
assert.equal((style.match(/!important/g)||[]).length+(themeStyle.match(/!important/g)||[]).length,0,"Presentation CSS must not rely on !important overrides");
assert.doesNotMatch(themeStyle,/gradient\(/i,"The active Forest Desk Glass theme must not use gradients");
assert.match(sync,/realtimeUserId/);
assert.match(sync,/unsubscribeRealtime/);
assert.match(sync,/setAttribute\("inert",""\)/);
assert.match(sync,/removeAttribute\("inert"\)/);
assert.match(sync,/app\.inert=false/);
assert.match(html,/<div class="app" inert aria-hidden="true">/,"App data is inaccessible before session validation");
assert.doesNotMatch(html,/tnCompatNodes|tn73Auth|tn73Login|tn74SupabaseBootstrap/);
assert.doesNotMatch(app,/tn73Auth|tn73Login|tn74SupabaseBootstrap/);
assert.doesNotMatch(library,/chooseAnswer\(this,'\$\{/);
assert.match(app,/chooseAnswer\(this,quiz\.currentChoices\[\$\{index\}\]\)/);
assert.doesNotMatch(app,/chooseAnswer\(this,'\$\{/);
assert.match(library,/document\.addEventListener\("change",event => \{/);
assert.match(sync,/bulkImport:window\.bulkImport/);
assert.match(sync,/window\.bulkImport=localFallbacks\.bulkImport/);
assert.match(sync,/window\.renameList = \(\) => qaRenamePlaylist/);
assert.match(sync,/const CLOUD_PAGE_SIZE = 1000/);
assert.match(sync,/query=query\.range\(offset,offset\+CLOUD_PAGE_SIZE-1\)/);
assert.match(sync,/const BULK_INSERT_SIZE = 250/);
assert.match(html,/onclick="tnRenamePlaylist\(document\.getElementById\('renameListSelect'\)\.value,document\.getElementById\('renameListInput'\)\.value\)"/);
assert.match(sync,/function readPendingFor\(userId\)/);
assert.match(sync,/ACCOUNT_STORAGE_PREFIX = "tangonest:account:v2:"/);
assert.match(sync,/item\?\.userId===userId/);
assert.doesNotMatch(sync,/attempts < 5/);
assert.match(sync,/Needs attention/);
assert.match(sync,/userError\(error/);
assert.doesNotMatch(library,/document\.addEventListener\("click",event => \{\s*const selected=/);
assert.doesNotMatch(sql,/drop\s+table|truncate/i,"Migration must not remove tables or truncate user data");
assert.doesNotMatch(sql,/drop\s+function[^;]+cascade/i,"Migration must not cascade through dependent objects");
assert.doesNotMatch(sql,/delete\s+from\s+auth\.users|truncate[^;]*auth\.users/i,"Learning-data reset must never delete Auth identities");
assert.match(sql,/alter table public\.tn_words enable row level security/i);
assert.match(sql,/alter table public\.tn_playlists enable row level security/i);
assert.match(sql,/alter table public\.tn_learning_events enable row level security/i);
assert.ok((sql.match(/auth\.uid\(\) = user_id/g)||[]).length>=10,"RLS policies must isolate account data");
assert.match(sql,/alter publication supabase_realtime add table public\.tn_words/i);
assert.match(sql,/alter publication supabase_realtime add table public\.tn_playlists/i);
assert.match(sql,/out_of_order/i);
assert.match(sql,/revoke execute on function public\.tn_record_learning_result[\s\S]+from public, anon/i);
assert.match(sql,/alter table public\.tn_words alter column playlist_id drop not null/i);
assert.match(sql,/create or replace function public\.tn_delete_playlist\(p_playlist_id uuid\)/i);
assert.match(sql,/create or replace function public\.tn_upsert_word_nonlearning\(p_word jsonb\)/i);
assert.doesNotMatch(sql,/values\s*\([^)]*'New Playlist'/i,"Canonical schema must never seed a playlist");
assert.match(playwright,/name:"mobile"[\s\S]+browserName:"chromium"/i,"Mobile E2E must use the browser installed by CI");
assert.match(playwright,/name:"webkit"[\s\S]+Desktop Safari/i,"Desktop WebKit must remain in the release matrix");
assert.match(workflow,/playwright install --with-deps chromium webkit/);
assert.match(workflow,/npm audit --audit-level=high/);

const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
assert.equal(new Set(ids).size,ids.length,"HTML IDs must be unique");

const labels=new Set([...html.matchAll(/<label\b[^>]*\bfor=["']([^"']+)["']/gi)].map(match=>match[1]));
for(const match of html.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)){
  const attrs=match[2];
  if(/\btype=["']hidden["']/i.test(attrs))continue;
  const id=attrs.match(/\bid=["']([^"']+)["']/i)?.[1];
  const named=/\baria-label(?:ledby)?=["'][^"']+["']/i.test(attrs)||(id&&labels.has(id));
  assert.ok(named,`Form control requires an accessible name: ${id||match[1]}`);
}

const version=config.match(/appVersion:"([^"]+)"/)?.[1];
assert.equal(version,"1.0.0-rc.19");
assert.match(html,/1\.0\.0-rc\.19-fdg5/,"The responsive polish must bust all earlier asset caches");
for(const asset of ["style-rc19-fdg1.css","ui/forest-desk-glass-rc19-fdg1.css","default-playlist-rc19-fdg1.js","app-rc19-fdg1.js","learning-engine-rc19-fdg1.js","tn-supabase-sync-rc19-fdg1.js","tn-library-management-rc19-fdg1.js","tn-learning-flow-rc19-fdg1.js","ui/learning-presentation-rc19-fdg1.js","ui/runtime-rc19-fdg1.js"]){
  assert.match(html,new RegExp(`${asset.replace(/[.]/g,"\\.")}\\?v=${version.replace(/[.]/g,"\\.")}-fdg5`),`Cache-safe deployed asset: ${asset}`);
}

const deployedCopies=new Map([
  ["style.css","style-rc19-fdg1.css"],
  ["ui/forest-desk-glass.css","ui/forest-desk-glass-rc19-fdg1.css"],
  ["config.js","config-rc19-fdg1.js"],
  ["default-playlist.js","default-playlist-rc19-fdg1.js"],
  ["learning-engine.js","learning-engine-rc19-fdg1.js"],
  ["ui/learning-presentation.js","ui/learning-presentation-rc19-fdg1.js"],
  ["app.js","app-rc19-fdg1.js"],
  ["tn-supabase-sync.js","tn-supabase-sync-rc19-fdg1.js"],
  ["tn-library-management.js","tn-library-management-rc19-fdg1.js"],
  ["tn-learning-flow.js","tn-learning-flow-rc19-fdg1.js"],
  ["ui/runtime.js","ui/runtime-rc19-fdg1.js"],
  ["manifest.json","manifest-rc19-fdg1.json"]
]);
for(const [source,deployed] of deployedCopies){
  assert.equal(read(deployed),read(source),`${deployed} must exactly match ${source}`);
}

const legacyWorkerPaths=new Set([
  "style.css","config.js","app.js","learning-engine.js","tn-supabase-sync.js",
  "tn-library-management.js","tn-learning-flow.js","ui/learning-presentation.js",
  "ui/runtime.js","manifest.json"
]);
const deployedLocalAssets=[...html.matchAll(/(?:href|src)="\.\/([^"?]+)(?:\?[^" ]*)?"/g)].map(match=>match[1]);
for(const asset of deployedLocalAssets){
  assert.ok(!legacyWorkerPaths.has(asset),`${asset} must bypass the rc.11 Service Worker cache`);
}

console.log("RELEASE_CONTRACTS_TEST_PASS");
