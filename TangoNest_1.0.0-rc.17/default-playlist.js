(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.TangoNestDefaultPlaylist=api;
})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";

  const NAME="My Words";
  const LOCAL_ID="local-my-words";
  const SYSTEM_KEY="default-my-words";
  const LEGACY_IDS=new Set(["starter","local-starter"]);
  const LEGACY_EMPTY_NAMES=new Set(["new playlist","starter","default"]);

  function clone(value){
    try{return JSON.parse(JSON.stringify(value||{}));}catch(error){return {};}
  }

  function text(value){return String(value??"").trim();}
  function normalizedName(value){return text(value).toLowerCase();}
  function isMarkedDefault(list){
    const id=text(list?.id);
    return !!(list?.isDefault||list?.is_default||list?.systemKey===SYSTEM_KEY||id===LOCAL_ID);
  }

  function isUntouchedGeneratedCandidate(list){
    if(LEGACY_IDS.has(text(list?.id))||list?.systemKey===SYSTEM_KEY||list?.generatedBy==="tangonest"||list?.isGenerated===true)return true;
    const created=Date.parse(list?.createdAt||list?.created_at||"");
    const updated=Date.parse(list?.updatedAt||list?.updated_at||"");
    return Number.isFinite(created)&&Number.isFinite(updated)&&Math.abs(updated-created)<=5000;
  }

  function createDefault(nowValue,idFactory){
    const at=nowValue||new Date().toISOString();
    return {
      id:typeof idFactory==="function"?String(idFactory()):LOCAL_ID,
      name:NAME,
      isDefault:true,
      systemKey:SYSTEM_KEY,
      createdAt:at,
      updatedAt:at
    };
  }

  function enforce(input,options={}){
    const data=options.clone===false&&input&&typeof input==="object"?input:clone(input);
    const at=options.now||new Date().toISOString();
    data.lists=Array.isArray(data.lists)?data.lists.filter(Boolean):[];
    data.words=Array.isArray(data.words)?data.words.filter(Boolean):[];

    const listIdsWithWords=new Set(data.words.map(word=>text(word?.listId||word?.playlist_id)).filter(Boolean));
    const lists=data.lists.map((list,index)=>({
      ...list,
      id:text(list.id)||`list-${index+1}`,
      name:text(list.name)||"Untitled Playlist",
      isDefault:isMarkedDefault(list),
      createdAt:list.createdAt||list.created_at||at,
      updatedAt:list.updatedAt||list.updated_at||at
    }));

    let canonical=lists.find(list=>normalizedName(list.name)==="my words"&&list.isDefault)
      ||lists.find(list=>normalizedName(list.name)==="my words")
      ||lists.find(list=>list.systemKey===SYSTEM_KEY||text(list.id)===LOCAL_ID);
    if(!canonical){
      canonical=createDefault(at,options.idFactory);
      lists.unshift(canonical);
    }

    canonical.name=NAME;
    canonical.isDefault=true;
    canonical.systemKey=SYSTEM_KEY;
    const removedIds=new Set();
    const kept=[];
    for(const list of lists){
      if(list===canonical){kept.push(list);continue;}
      list.isDefault=false;
      if(list.systemKey===SYSTEM_KEY)list.systemKey="";
      const id=text(list.id);
      const name=normalizedName(list.name);
      const hasWords=listIdsWithWords.has(id);
      const knownEmptyLegacy=LEGACY_EMPTY_NAMES.has(name)||(name==="my words"&&id!==canonical.id);
      if(!hasWords&&knownEmptyLegacy&&isUntouchedGeneratedCandidate(list)){
        removedIds.add(id);
        continue;
      }
      kept.push(list);
    }

    data.lists=kept;
    data.words.forEach(word=>{
      const current=text(word.listId||word.playlist_id);
      if(!removedIds.has(current))return;
      if(Object.prototype.hasOwnProperty.call(word,"playlist_id"))word.playlist_id=canonical.id;
      else word.listId=canonical.id;
    });
    return data;
  }

  function audit(data){
    const lists=Array.isArray(data?.lists)?data.lists:[];
    const defaults=lists.filter(isMarkedDefault);
    return {
      total:lists.length,
      defaults:defaults.length,
      defaultNames:defaults.map(list=>text(list.name)),
      valid:defaults.length===1&&defaults[0]?.name===NAME
    };
  }

  return Object.freeze({
    NAME,LOCAL_ID,SYSTEM_KEY,LEGACY_IDS,LEGACY_EMPTY_NAMES,
    createDefault,enforce,audit,isMarkedDefault,isUntouchedGeneratedCandidate
  });
});
