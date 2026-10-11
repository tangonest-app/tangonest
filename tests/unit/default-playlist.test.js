const assert=require("node:assert/strict");
const invariant=require("../../default-playlist.js");

const at="2026-06-11T00:00:00.000Z";
const list=(id,name,extra={})=>({id,name,createdAt:at,updatedAt:at,...extra});
const run=data=>invariant.enforce(data,{clone:true,now:at});
const primaries=data=>data.lists.filter(invariant.isMarkedDefault);

let empty=run({lists:[],words:[]});
assert.equal(empty.words.length,0,"new account has zero words");
assert.equal(empty.lists.length,1,"new account has one total list");
assert.equal(empty.lists[0].name,"New Playlist","new account uses New Playlist");
assert.equal(primaries(empty).length,1,"new account has one internal primary row");

let renamed=run({
  lists:[list("local-my-words","Personal Vocabulary",{isDefault:true,systemKey:"default-my-words"})],
  words:[]
});
for(let index=0;index<10;index++)renamed=run(renamed);
assert.equal(renamed.lists[0].name,"Personal Vocabulary","a renamed primary survives normalization");
assert.equal(primaries(renamed).length,1,"renaming keeps one internal primary");

const existing=run({
  lists:[list("travel","Travel"),list("toeic","TOEIC")],
  words:[{id:"w1",listId:"travel",front:"station",back:"駅"}]
});
assert.deepEqual(existing.lists.map(item=>item.name),["Travel","TOEIC"],"existing playlists are preserved without injecting a visible default");
assert.equal(primaries(existing).length,1,"the first existing playlist becomes the internal primary");
assert.equal(existing.words[0].listId,"travel","word ownership is untouched");

const languageLists=run({
  lists:[
    list("fr","French",{isDefault:true}),
    list("zh","Chinese"),
    list("starter","Starter"),
    list("new","New Playlist")
  ],
  words:[]
});
assert.deepEqual(languageLists.lists.map(item=>item.name),["French","Chinese","Starter","New Playlist"],"playlist names never trigger deletion");

const duplicateNames=run({
  lists:[list("same-a","French",{isDefault:true}),list("same-b","French",{isDefault:true})],
  words:[{id:"w2",listId:"same-b",front:"keep",back:"保持"}]
});
assert.equal(duplicateNames.lists.length,2,"normalization never merges user playlists by display name");
assert.equal(duplicateNames.words[0].listId,"same-b","normalization never moves words between playlists");
assert.equal(primaries(duplicateNames).length,1,"duplicate internal markers collapse to one");

const afterDeletingPrimary=run({
  lists:[list("remaining","Work")],
  words:[]
});
assert.equal(afterDeletingPrimary.lists[0].name,"Work","an existing list is promoted without renaming");
assert.equal(primaries(afterDeletingPrimary).length,1,"one replacement primary is selected");

const afterDeletingLast=run({lists:[],words:[]});
assert.deepEqual(afterDeletingLast.lists.map(item=>item.name),["New Playlist"],"deleting the last list recreates one empty New Playlist");

const snapshot=JSON.stringify(existing);
for(let index=0;index<10;index++)invariant.enforce(existing,{clone:false,now:at});
assert.equal(JSON.stringify(existing),snapshot,"ten ensure calls are idempotent");
assert.equal(invariant.audit(existing).valid,true,"final invariant audit passes");

console.log("DEFAULT_PLAYLIST_TEST_PASS");
