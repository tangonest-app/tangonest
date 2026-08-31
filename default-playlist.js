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
  const LEGACY_EMPTY_NAMES=new Set(["new playlist","starter","default","chinese"]);
  const LEGACY_REPAIR_ONLY_NAMES=new Set(["chinese"]);

  function clone(value){
    try{return JSON.parse(JSON.stringify(value||{}));}catch(error){return {};}
  }

  function text(value){return String(value??"").trim();}
  function normalizedName(value){return text(value).toLowerCase();}
  function isMarkedDefault(list){
    const id=text(list?.id);
    return !!(list?.isDefault||list?.is_default||list?.systemKey===SYSTEM_KEY||id===LOCAL_ID);
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

  function isUntouchedGeneratedCandidate(list,canonical){
    if(LEGACY_IDS.has(text(list?.id))||list?.systemKey===SYSTEM_KEY||list?.generatedBy==="tangonest"||list?.isGenerated===true)return true;
    const created=parsedTime(list?.createdAt||list?.created_at);
    const updated=parsedTime(list?.updatedAt||list?.updated_at);
    const originallyUntouched=created!==null&&updated!==null&&Math.abs(updated-created)<=5000;
    // Old builds demoted their generated default when My Words was introduced.
    // That trigger changed updated_at, so the canonical creation/promotion time is
    // the remaining reliable link between the two generated rows.
    return originallyUntouched||isRepairTimestampPair(list,canonical);
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

    // The default role is permanent, but its user-facing name is editable.
    // systemKey/local ID distinguish a renamed default from an old playlist
    // that a legacy build accidentally marked as default.
    let canonical=lists.find(list=>list.systemKey===SYSTEM_KEY||text(list.id)===LOCAL_ID)
      ||lists.find(list=>normalizedName(list.name)==="my words"&&list.isDefault)
      ||lists.find(list=>normalizedName(list.name)==="my words");
    if(!canonical){
      canonical=createDefault(at,options.idFactory);
      lists.unshift(canonical);
    }

    canonical.name=text(canonical.name)||NAME;
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
      if(name==="my words"){
        removedIds.add(id);
        continue;
      }
      const knownEmptyLegacy=LEGACY_EMPTY_NAMES.has(name);
      const hasLegacyProof=LEGACY_REPAIR_ONLY_NAMES.has(name)
        ?isRepairTimestampPair(list,canonical)
        :isUntouchedGeneratedCandidate(list,canonical);
      if(!hasWords&&knownEmptyLegacy&&hasLegacyProof){
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
    const canonicalRows=lists.filter(list=>normalizedName(list?.name)==="my words");
    const defaultRow=defaults[0]||null;
    return {
      total:lists.length,
      defaults:defaults.length,
      defaultNames:defaults.map(list=>text(list.name)),
      canonicalRows:canonicalRows.length,
      valid:defaults.length===1&&!!defaultRow&&text(defaultRow.name).length>0&&canonicalRows.length<=1&&(!canonicalRows.length||canonicalRows[0]?.id===defaultRow.id)
    };
  }

  return Object.freeze({
    NAME,LOCAL_ID,SYSTEM_KEY,LEGACY_IDS,LEGACY_EMPTY_NAMES,LEGACY_REPAIR_ONLY_NAMES,
    createDefault,enforce,audit,isMarkedDefault,isUntouchedGeneratedCandidate,isRepairTimestampPair
  });
});
