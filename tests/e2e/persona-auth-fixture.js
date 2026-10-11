function personaUuid(index,offset=0){
  return `00000000-0000-4000-8000-${String(index*100+offset).padStart(12,"0")}`;
}

async function installPersonaAuthMock(page,{index,email,password,wordCount=8,samples=[]}){
  await page.route("**/vendor/supabase-*.js",route=>route.fulfill({status:200,contentType:"application/javascript",body:"window.supabase={};"}));
  await page.addInitScript(({index,email,password,wordCount,samples})=>{
    const SESSION_KEY=`tangonest_persona_session_${index}`;
    const user={id:`00000000-0000-4000-8000-${String(index*100).padStart(12,"0")}`,email};
    const listId=`00000000-0000-4000-8000-${String(index*100+1).padStart(12,"0")}`;
    const at="2026-08-31T00:00:00.000Z";
    localStorage.setItem(`tangonest_account_isolation_reset_v2:${user.id}`,"complete");

    const playlists=[{id:listId,user_id:user.id,name:"My Words",is_default:true,created_at:at,updated_at:at}];
    const words=Array.from({length:wordCount},(_,wordIndex)=>({
      id:`00000000-0000-4000-8000-${String(index*100000+wordIndex+2).padStart(12,"0")}`,
      user_id:user.id,
      playlist_id:listId,
      front:samples[wordIndex]?.front||`${index}-word-${wordIndex+1}`,
      back:samples[wordIndex]?.back||`meaning-${index}-${wordIndex+1}`,
      front_lang:samples[wordIndex]?.frontLang||"en-US",
      back_lang:samples[wordIndex]?.backLang||"ja-JP",
      pos:wordIndex%2?"verb":"noun",
      status:"new",
      saved:wordIndex%7===0,
      level:1,
      next_review:"2026-08-31",
      correct_count:0,
      wrong_count:0,
      review_count:0,
      consecutive_correct:0,
      review_interval_days:0,
      learning_state:"new",
      position:wordIndex,
      memo:wordIndex%3===0?`Example ${wordIndex+1}.`:"",
      created_at:new Date(Date.parse(at)-wordIndex*60000).toISOString(),
      updated_at:at
    }));
    const tables={tn_playlists:playlists,tn_words:words,tn_learning_events:[]};
    let authCallback=null;
    let idCounter=index*100000+wordCount+20;
    const session=()=>({user,access_token:`persona-access-${index}`,refresh_token:`persona-refresh-${index}`});
    const stored=()=>localStorage.getItem(SESSION_KEY)?session():null;
    const clone=value=>JSON.parse(JSON.stringify(value));

    function query(table){
      const state={operation:"select",payload:null,filters:[],from:0,to:null,single:false};
      const api={
        select(){return api},
        eq(key,value){state.filters.push({key,value});return api},
        order(){return api},
        range(from,to){state.from=from;state.to=to;return api},
        single(){state.single=true;return api},
        maybeSingle(){state.single=true;return api},
        insert(payload){state.operation="insert";state.payload=payload;return api},
        upsert(payload){state.operation="upsert";state.payload=payload;return api},
        update(payload){state.operation="update";state.payload=payload;return api},
        delete(){state.operation="delete";return api},
        then(resolve,reject){
          const rows=tables[table]||[];
          let filtered=rows.filter(row=>state.filters.every(filter=>String(row[filter.key])===String(filter.value)));
          if(state.operation==="insert"||state.operation==="upsert"){
            const inserted=(Array.isArray(state.payload)?state.payload:[state.payload]).map(payload=>{
              const row={id:`00000000-0000-4000-8000-${String(++idCounter).padStart(12,"0")}`,user_id:user.id,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),...payload};
              rows.push(row);
              return row;
            });
            filtered=inserted;
          }else if(state.operation==="update"){
            filtered.forEach(row=>Object.assign(row,state.payload,{updated_at:new Date().toISOString()}));
          }else if(state.operation==="delete"){
            for(let rowIndex=rows.length-1;rowIndex>=0;rowIndex--){
              if(filtered.includes(rows[rowIndex]))rows.splice(rowIndex,1);
            }
          }
          if(state.operation==="select"&&state.to!==null)filtered=filtered.slice(state.from,state.to+1);
          const data=state.single?(filtered[0]||null):filtered.map(clone);
          return Promise.resolve({data,error:null,count:Array.isArray(data)?data.length:(data?1:0)}).then(resolve,reject);
        }
      };
      return api;
    }

    window.tnSupabaseClient={
      auth:{
        getSession:async()=>({data:{session:stored()},error:null}),
        getUser:async()=>({data:{user:stored()?.user||null},error:null}),
        signInWithPassword:async credentials=>{
          if(credentials.email!==email||credentials.password!==password)return {data:{session:null},error:{message:"Invalid login credentials",code:"invalid_credentials"}};
          localStorage.setItem(SESSION_KEY,"1");
          const next=session();
          setTimeout(()=>authCallback?.("SIGNED_IN",next),0);
          return {data:{session:next},error:null};
        },
        signUp:async()=>({data:{session:null},error:{message:"User already exists",code:"user_already_exists"}}),
        signOut:async()=>{localStorage.removeItem(SESSION_KEY);setTimeout(()=>authCallback?.("SIGNED_OUT",null),0);return {error:null}},
        resetPasswordForEmail:async()=>({data:{},error:null}),
        updateUser:async()=>({data:{user},error:null}),
        onAuthStateChange:callback=>{authCallback=callback;setTimeout(()=>callback("INITIAL_SESSION",stored()),0);return {data:{subscription:{unsubscribe(){authCallback=null}}}}}
      },
      rpc:async(name,args={})=>{
        if(name==="tn_ensure_default_playlist")return {data:clone(playlists[0]),error:null};
        if(name==="tn_record_learning_result"){
          const word=words.find(item=>item.id===args.p_word_id);
          if(word)Object.assign(word,{review_count:(word.review_count||0)+1,last_result:args.p_result,updated_at:new Date().toISOString()});
          return {data:clone(word),error:null};
        }
        if(name==="tn_upsert_word_nonlearning")return {data:clone(words.find(item=>item.id===args.p_word?.id)||null),error:null};
        return {data:null,error:{message:`function ${name} not found`}};
      },
      from:query,
      channel:()=>({on(){return this},subscribe(callback){callback?.("SUBSCRIBED");return this}}),
      removeChannel(){}
    };
  },{index,email,password,wordCount,samples});
}

module.exports={installPersonaAuthMock,personaUuid};
