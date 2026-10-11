"use strict";

const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");

const root=path.resolve(__dirname,"../..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const client=[read("tn-supabase-sync.js"),read("app.js"),read("tn-library-management.js")].join("\n");
const sql=read("docs/reference/fdg16-schema.sql");

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
assert.match(sql,/pg_advisory_xact_lock[\s\S]+values \(v_user_id,'New Playlist',false\)/i,"Primary playlist RPC is serialized and creates the empty starter only when needed");
assert.match(sql,/create unique index if not exists tn_playlists_one_default_per_user_idx[\s\S]+where is_default/i,"Database permits one marked default per user");
assert.match(sql,/drop index if exists public\.tn_playlists_one_my_words_per_user_idx/i,"The historical reserved-name index is removed");
assert.ok(sql.indexOf("tn_playlists_id_user_unique unique")<sql.indexOf("add constraint tn_words_playlist_user_fk"),"Composite playlist uniqueness exists before the matching word foreign key");
assert.doesNotMatch(sql,/lower\(btrim\(p\.name\)\) in \('my words','new playlist','starter','default','chinese'\)/i,"Playlist repair never deletes rows by display name");
assert.match(client,/repairLegacyDefaultRows\(playlistRows,wordRows,loadUserId\)/,"Cloud load repairs the historical second-list row even when an older RPC is installed");
const ensureBlock=sql.match(/create or replace function public\.tn_ensure_default_playlist\(\)([\s\S]*?)create or replace function public\.tn_apply_account_clean_start_v1/i)?.[1]||"";
assert.doesNotMatch(ensureBlock,/lower\(btrim\(name\)\)|set name=/i,"Primary maintenance never interprets or overwrites user-facing names");
assert.doesNotMatch(client,/reserved as the default playlist|default playlist and cannot be deleted/i,"Client exposes no reserved playlist name or delete protection");
assert.match(sql,/tn_delete_playlist[\s\S]+set is_default=false[\s\S]+values \(v_user_id,'New Playlist',true\)[\s\S]+delete from public\.tn_playlists/i,"Deleting the current primary creates a replacement only when necessary");
assert.match(sql,/tn_delete_all_account_data[\s\S]+values \(v_user_id,'New Playlist',true\)[\s\S]+jsonb_build_object\('words',0,'lists',1/i,"Delete all restores the requested empty state");
const compatibility=sql.slice(sql.indexOf("create or replace function public.tn_apply_account_clean_start_v1()"),sql.indexOf("create or replace function public.tn_delete_playlist("));
assert.doesNotMatch(compatibility,/delete|insert|update\s+public/i,"Old cached clients must not mutate data during login");
assert.match(compatibility,/'disabled',true/);
assert.match(client,/persistSession:true[\s\S]+autoRefreshToken:true/,"Standard Supabase session persistence remains enabled");
assert.doesNotMatch(client,/client\.rpc\("tn_apply_account_(?:isolation_reset_v2|clean_start_v1)"/,"Login must never call destructive legacy reset RPCs");
assert.match(client,/tangonest:account:v2:/,"Every user-owned browser cache uses the rc19 account namespace");
assert.doesNotMatch(sql,/delete from public\.tn_(?:words|playlists|learning_events|account_migrations)\s*;/i,"Setup never globally deletes account data");
assert.doesNotMatch(read("SUPABASE_FDG10_SAFETY.sql"),/delete from|truncate|drop table/i);
assert.doesNotMatch(sql,/delete\s+from\s+auth\.users/i,"Production reset preserves Auth users");
assert.match(sql,/alter table public\.tn_words force row level security/i,"User words enforce RLS even for table-owner execution paths");
assert.match(client,/BOOTING[\s\S]+UNAUTHENTICATED[\s\S]+AUTHENTICATED[\s\S]+SYNCING[\s\S]+READY[\s\S]+SYNC_ERROR/,"Startup states are explicit");

const rootSql=fs.readdirSync(root).filter(name=>name.endsWith(".sql"));
assert.deepEqual(rootSql.sort(),["SUPABASE_SCHEMA_CURRENT.sql","TANGONEST_RC19_PRODUCTION_MIGRATION.sql","SUPABASE_FDG8_PLAYLIST_RESET.sql","SUPABASE_FDG10_SAFETY.sql","SUPABASE_SQL_RUN_ONCE.sql"].sort(),"Historical root SQL is preserved; current contracts use the separately reviewed FDG16 reference");

console.log("DB_CONTRACT_TEST_PASS");
