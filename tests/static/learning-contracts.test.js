"use strict";

const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");

const root=path.resolve(__dirname,"../..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const app=read("app.js");
const html=read("index.html");
const sync=read("tn-supabase-sync.js");
const library=read("tn-library-management.js");
const flow=read("tn-learning-flow.js");
const sql=read("SUPABASE_SQL_RUN_ONCE.sql");

assert.ok(html.indexOf("learning-engine.js")<html.indexOf("app.js"),"Learning Engine loads before app.js");
assert.equal((app.match(/function updateWordLearning\(/g)||[]).length,1,"one app learning writer remains");
assert.equal((flow.match(/window\.updateWordLearning\s*=/g)||[]).length,0,"learning-flow does not override the writer");
assert.ok(app.includes("calculateLearningUpdate"),"app delegates transitions to Learning Engine");
assert.ok(html.includes("markCard('again',true)")&&html.includes("markCard('hard',true)")&&html.includes("markCard('good',true)")&&html.includes("markCard('easy',true)"),"Cards expose all four ratings");
assert.ok(app.includes('"good",{mode:quiz.type||"quiz"}')&&app.includes('"again",{mode:quiz.type||"quiz"}'),"choice, typing, and listening quiz use the common writer");
assert.ok(app.includes("buildSmartSession"),"Home can build a mixed smart session");
assert.ok(library.includes("engine()?.isDueWord")&&library.includes("engine()?.isMasteredWord"),"Library uses formal Due and Mastered rules");
assert.ok(!html.includes("editStatus")&&!html.includes("editLevel"),"manual level/status editing cannot bypass the engine");

assert.ok(sync.includes('type:"learning_event"'),"offline-safe learning event queue exists");
assert.ok(sync.includes('client.rpc("tn_record_learning_result"'),"cloud learning uses the atomic RPC");
assert.ok(!sync.includes('wrap("updateWordLearning"'),"legacy full-row learning sync wrapper is removed");
assert.ok(sync.includes("consecutive_correct")&&sync.includes("review_interval_days"),"new learning fields map both directions");

assert.ok(!/drop table if exists public\.tn_(words|playlists)/i.test(sql),"migration does not drop vocabulary tables");
assert.ok(sql.includes("add column if not exists consecutive_correct"),"migration preserves data while adding fields");
assert.ok(/create(?: or replace)? function public\.tn_record_learning_result/i.test(sql),"atomic learning RPC is defined");
assert.ok(sql.includes("for update")&&sql.includes("on conflict (event_id) do nothing"),"RPC serializes rows and deduplicates retries");
assert.ok(sql.includes("tn_learning_events"),"idempotent learning event table exists");

const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
const duplicates=ids.filter((id,index)=>ids.indexOf(id)!==index);
assert.deepEqual(duplicates,[],"HTML ids are unique");

for(const ref of [...html.matchAll(/(?:src|href)="\.\/([^"?#]+)(?:\?[^"#]*)?"/g)].map(match=>match[1])){
  assert.ok(fs.existsSync(path.join(root,ref)),`Local asset exists: ${ref}`);
}

console.log("LEARNING_CONTRACTS_TEST_PASS");
