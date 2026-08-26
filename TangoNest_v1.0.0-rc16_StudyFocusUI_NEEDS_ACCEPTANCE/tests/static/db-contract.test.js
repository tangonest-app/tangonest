"use strict";

const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");

const root=path.resolve(__dirname,"../..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const client=[read("tn-supabase-sync.js"),read("app.js"),read("tn-library-management.js")].join("\n");
const sql=read("SUPABASE_SCHEMA_CURRENT.sql");

const tables=new Set([...client.matchAll(/\.from\(["'](tn_[a-z0-9_]+)["']\)/g)].map(match=>match[1]));
const rpcs=new Set([...client.matchAll(/\.rpc\(["'](tn_[a-z0-9_]+)["']/g)].map(match=>match[1]));

for(const table of tables){
  assert.match(sql,new RegExp(`create table if not exists public\\.${table}\\b`,`i`),`SQL defines client table ${table}`);
}
for(const rpc of rpcs){
  assert.match(sql,new RegExp(`create or replace function public\\.${rpc}\\s*\\(`,`i`),`SQL defines client RPC ${rpc}`);
}

const requiredColumns={
  tn_playlists:["id","user_id","name","is_default","created_at","updated_at"],
  tn_words:[
    "id","user_id","playlist_id","front","back","front_lang","back_lang","pos","gender","tags","memo",
    "pronunciation","status","saved","level","next_review","correct_count","wrong_count","review_count",
    "last_answered_at","last_wrong_at","consecutive_correct","review_interval_days","last_result","learning_state",
    "position","created_at","content_updated_at","updated_at"
  ]
};
for(const [table,columns] of Object.entries(requiredColumns)){
  const block=sql.match(new RegExp(`create table if not exists public\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`,`i`))?.[1] || "";
  for(const column of columns){
    assert.match(block,new RegExp(`(?:^|\\n)\\s*${column}\\s+`,`i`),`${table}.${column} exists`);
  }
}

assert.match(sql,/alter table public\.tn_words alter column playlist_id drop not null/i,"Unfiled words are supported");
assert.match(sql,/unnest\(c\.conkey\)[\s\S]+a\.attname = 'playlist_id'/i,"Migration removes every legacy playlist foreign key by source column");
assert.match(sql,/notify pgrst, 'reload schema'/i,"Canonical migration refreshes the PostgREST schema cache");
assert.match(sql,/set playlist_id = null[\s\S]+where user_id = v_user_id[\s\S]+playlist_id = p_playlist_id/i,"Playlist deletion preserves words as unfiled");
assert.match(client,/async function ensureDefaultPlaylist\(\)/,"Default playlist creation has one client entry point");
assert.match(sql,/create or replace function public\.tn_ensure_default_playlist\(\)/i,"Default playlist creation is atomic in the database");
assert.match(sql,/pg_advisory_xact_lock[\s\S]+values \(v_user_id,'My Words',true\)/i,"Default playlist RPC is serialized and canonical");
assert.match(sql,/create unique index if not exists tn_playlists_one_default_per_user_idx[\s\S]+where is_default/i,"Database permits one marked default per user");
assert.doesNotMatch(client,/name\s*:\s*["'](?:Chinese|Starter|Demo|Default|New Playlist)["']/i,"Client has no initial playlist seed");
assert.doesNotMatch(sql,/values\s*\([^)]*'(?:Chinese|Starter|Demo|Default|New Playlist)'/i,"SQL has no playlist seed");
assert.match(sql,/tn_delete_all_account_data[\s\S]+values \(v_user_id,'My Words',true\)[\s\S]+jsonb_build_object\('words',0,'lists',1/i,"Delete all restores the canonical empty state");
assert.match(client,/tangonest_account_cache_v1:/,"Cache is account-scoped");
assert.match(client,/BOOTING[\s\S]+UNAUTHENTICATED[\s\S]+AUTHENTICATED[\s\S]+SYNCING[\s\S]+READY[\s\S]+SYNC_ERROR/,"Startup states are explicit");

const rootSql=fs.readdirSync(root).filter(name=>name.endsWith(".sql"));
assert.deepEqual(rootSql,["SUPABASE_SCHEMA_CURRENT.sql"],"Only canonical SQL is runnable from the project root");

console.log("DB_CONTRACT_TEST_PASS");
