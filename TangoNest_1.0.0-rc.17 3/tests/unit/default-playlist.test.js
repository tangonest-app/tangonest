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

const repairAt="2026-06-11T00:10:00.000Z";
const staleGeneratedLegacy=run({
  lists:[
    list("my","My Words",{isDefault:true,createdAt:repairAt,updatedAt:repairAt}),
    list("old-new","New Playlist",{updatedAt:repairAt})
  ],
  words:[]
});
assert.deepEqual(staleGeneratedLegacy.lists.map(item=>item.name),["My Words"],"an old generated list touched by the My Words repair is removed");

const staleChineseDemo=run({
  lists:[
    list("my","My Words",{isDefault:true,createdAt:repairAt,updatedAt:repairAt}),
    list("old-chinese","Chinese",{updatedAt:repairAt})
  ],
  words:[]
});
assert.deepEqual(staleChineseDemo.lists.map(item=>item.name),["My Words"],"the historical empty Chinese demo is removed only when tied to the repair transaction");

const userChinese=run({
  lists:[
    list("my","My Words",{isDefault:true}),
    list("user-chinese","Chinese",{createdAt:later,updatedAt:later})
  ],
  words:[]
});
assert.deepEqual(userChinese.lists.map(item=>item.name),["My Words","Chinese"],"a normal empty Chinese collection without repair evidence is preserved");

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
assert.equal(nonEmptyDuplicate.lists.length,1,"non-empty duplicate My Words is merged into the canonical list");
assert.equal(nonEmptyDuplicate.words[0].listId,"my-a","duplicate-list words move to the canonical list without data loss");
assert.equal(defaults(nonEmptyDuplicate).length,1,"the merged list remains the only default");
assert.equal(invariant.audit(nonEmptyDuplicate).valid,true,"the audit rejects hidden duplicate My Words rows");

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
