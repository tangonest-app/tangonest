const assert=require("node:assert/strict");
const invariant=require("../../default-playlist.js");

const at="2026-06-11T00:00:00.000Z";
const later="2026-06-11T00:10:00.000Z";
const list=(id,name,extra={})=>({id,name,createdAt:at,updatedAt:at,...extra});
const run=data=>invariant.enforce(data,{clone:true,now:at});
const defaults=data=>data.lists.filter(invariant.isMarkedDefault);

let empty=run({lists:[],words:[]});
assert.equal(empty.words.length,0,"new account has zero words");
assert.equal(empty.lists.length,1,"new account has one total list");
assert.equal(empty.lists[0].name,"My Words","new account uses My Words");
assert.equal(defaults(empty).length,1,"new account has one default");

for(let index=0;index<10;index++)empty=run(empty);
assert.equal(empty.lists.length,1,"ten reload migrations keep one list");
assert.equal(defaults(empty).length,1,"ten reload migrations keep one default");

const existingUsers=run({
  lists:[list("travel","Travel"),list("toeic","TOEIC")],
  words:[{id:"w1",listId:"travel",front:"station",back:"駅"}]
});
assert.deepEqual(existingUsers.lists.map(item=>item.name),["My Words","Travel","TOEIC"],"user playlists are preserved and My Words is added");
assert.equal(defaults(existingUsers).length,1,"existing account receives one default");

const legacy=run({
  lists:[
    list("my","My Words",{isDefault:true}),
    list("old-new","New Playlist"),
    list("old-starter","Starter"),
    list("old-default","Default")
  ],
  words:[]
});
assert.deepEqual(legacy.lists.map(item=>item.name),["My Words"],"empty untouched legacy generated lists are removed");

const userNamedLegacy=run({
  lists:[
    list("my","My Words",{isDefault:true}),
    list("user-new","New Playlist",{updatedAt:later})
  ],
  words:[]
});
assert.equal(userNamedLegacy.lists.length,2,"a modified user list with a legacy-like name is preserved");

const duplicateMyWords=run({
  lists:[
    list("my-a","My Words",{isDefault:true}),
    list("my-b","My Words",{isDefault:true})
  ],
  words:[]
});
assert.equal(duplicateMyWords.lists.length,1,"empty untouched duplicate My Words is removed");
assert.equal(defaults(duplicateMyWords).length,1,"duplicate default flags collapse to one");

const nonEmptyDuplicate=run({
  lists:[
    list("my-a","My Words",{isDefault:true}),
    list("my-b","My Words",{isDefault:true})
  ],
  words:[{id:"w2",listId:"my-b",front:"keep",back:"保持"}]
});
assert.equal(nonEmptyDuplicate.lists.length,2,"non-empty duplicate is preserved to prevent data loss");
assert.equal(defaults(nonEmptyDuplicate).length,1,"only one preserved list remains default");

const starterWord=run({
  lists:[list("starter","Starter")],
  words:[{id:"w3",listId:"starter",front:"hello",back:"こんにちは"}]
});
assert.deepEqual(starterWord.lists.map(item=>item.name),["My Words","Starter"],"a non-empty legacy list is preserved and My Words is added");
assert.equal(starterWord.words[0].listId,"starter","existing words stay in their user-visible list");

const markedTravel=run({
  lists:[list("travel","Travel",{isDefault:true})],
  words:[{id:"w4",listId:"travel",front:"ticket",back:"切符"}]
});
assert.deepEqual(markedTravel.lists.map(item=>item.name),["My Words","Travel"],"an old default flag never renames a user playlist");
assert.equal(markedTravel.words[0].listId,"travel","marked user playlist data is untouched");
assert.equal(defaults(markedTravel).length,1,"only My Words remains the default");

const snapshot=JSON.stringify(existingUsers);
for(let index=0;index<10;index++)invariant.enforce(existingUsers,{clone:false,now:at});
assert.equal(JSON.stringify(existingUsers),snapshot,"ten ensure calls are idempotent");
assert.equal(invariant.audit(existingUsers).valid,true,"final invariant audit passes");

console.log("DEFAULT_PLAYLIST_TEST_PASS");
