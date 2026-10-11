(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.TangoNestDefaultPlaylist=api;
})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";

  const NAME="New Playlist";
  const LOCAL_ID="local-my-words";
  const SYSTEM_KEY="primary-playlist";
  const LEGACY_SYSTEM_KEY="default-my-words";
  const LEGACY_IDS=new Set(["starter","local-starter"]);
  const LEGACY_EMPTY_NAMES=new Set();
  const LEGACY_REPAIR_ONLY_NAMES=new Set();

  function clone(value){
    try{return JSON.parse(JSON.stringify(value||{}));}catch(error){return {};}
  }

  function text(value){return String(value??"").trim();}
  function normalizedName(value){return text(value).toLowerCase();}
  function isMarkedDefault(list){
    const id=text(list?.id);
    return !!(list?.isDefault||list?.is_default||list?.systemKey===SYSTEM_KEY||list?.systemKey===LEGACY_SYSTEM_KEY||id===LOCAL_ID);
  }

  function parsedTime(value){
    const timestamp=Date.parse(value||"");
    return Number.isFinite(timestamp)?timestamp:null;
  }

  function isRepairTimestampPair(list,canonical){
    if(!canonical)return false;
    const updated=parsedTime(list?.updatedAt||list?.updated_at);
    if(updated===null)return false;
    const canonicalTimes=[
      parsedTime(canonical?.createdAt||canonical?.created_at),
      parsedTime(canonical?.updatedAt||canonical?.updated_at)
    ].filter(value=>value!==null);
    return canonicalTimes.some(value=>Math.abs(updated-value)<=5000);
  }

  function isUntouchedGeneratedCandidate(){return false;}

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

    const lists=data.lists.map((list,index)=>({
      ...list,
      id:text(list.id)||`list-${index+1}`,
      name:text(list.name)||"Untitled Playlist",
      isDefault:isMarkedDefault(list),
      createdAt:list.createdAt||list.created_at||at,
      updatedAt:list.updatedAt||list.updated_at||at
    }));

    // One internal primary row keeps forms usable. It is not a protected or
    // user-visible "default" playlist: it can be renamed or deleted like any
    // other list, and another row is promoted only to preserve the invariant.
    let canonical=lists.find(isMarkedDefault)||lists[0];
    if(!canonical){
      canonical=createDefault(at,options.idFactory);
      lists.unshift(canonical);
    }

    canonical.name=text(canonical.name)||NAME;
    canonical.isDefault=true;
    canonical.systemKey=SYSTEM_KEY;
    for(const list of lists){
      if(list===canonical)continue;
      list.isDefault=false;
      if(list.systemKey===SYSTEM_KEY||list.systemKey===LEGACY_SYSTEM_KEY)list.systemKey="";
    }
    data.lists=lists;
    return data;
  }

  function audit(data){
    const lists=Array.isArray(data?.lists)?data.lists:[];
    const defaults=lists.filter(isMarkedDefault);
    const defaultRow=defaults[0]||null;
    return {
      total:lists.length,
      defaults:defaults.length,
      defaultNames:defaults.map(list=>text(list.name)),
      canonicalRows:defaultRow?1:0,
      valid:lists.length>=1&&defaults.length===1&&!!defaultRow&&text(defaultRow.name).length>0
    };
  }

  return Object.freeze({
    NAME,LOCAL_ID,SYSTEM_KEY,LEGACY_SYSTEM_KEY,LEGACY_IDS,LEGACY_EMPTY_NAMES,LEGACY_REPAIR_ONLY_NAMES,
    createDefault,enforce,audit,isMarkedDefault,isUntouchedGeneratedCandidate,isRepairTimestampPair
  });
});
