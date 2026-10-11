/* Local audit server only. Never referenced by the production HTML. */
(function(){
  "use strict";
  const KEY="tn-audit-cloud-fdg10",SESSION="tn-audit-session-fdg10";
  const password="Audit-only-2026!";
  const uid=()=>crypto.randomUUID();
  const read=()=>JSON.parse(localStorage.getItem(KEY)||'{"users":[],"tn_playlists":[],"tn_words":[],"tn_learning_events":[]}');
  const write=data=>localStorage.setItem(KEY,JSON.stringify(data));
  const copy=value=>JSON.parse(JSON.stringify(value));
  const session=()=>JSON.parse(localStorage.getItem(SESSION)||"null");
  let authCallback=null;
  const qa={calls:[],errors:[],insertBatches:0,failBatch:0,loseResponseBatch:0,failTable:"",delay:0};
  window.addEventListener("error",event=>qa.errors.push(event.message));
  window.addEventListener("unhandledrejection",event=>qa.errors.push(String(event.reason)));
  qa.seed=(email,count=6)=>{
    const data=read();let user=data.users.find(item=>item.email===email);
    if(!user){user={id:uid(),email};data.users.push(user);}
    let list=data.tn_playlists.find(item=>item.user_id===user.id);
    const at=new Date().toISOString();
    if(!list){list={id:uid(),user_id:user.id,name:"Audit English",is_default:true,created_at:at,updated_at:at};data.tn_playlists.push(list);}
    const samples=[["book","本"],["water","水"],["learn","学ぶ"],["quiet","静かな"],["forest","森"],["remember","覚える"]];
    for(let i=0;i<count;i++)data.tn_words.push({id:uid(),user_id:user.id,playlist_id:list.id,front:samples[i%6][0]+(i>=6?` ${i}`:""),back:samples[i%6][1]+(i>=6?` ${i}`:""),front_lang:"en-US",back_lang:"ja-JP",pos:i%3?"noun":"verb",memo:"A quiet place to learn.",pronunciation:"",position:i,level:1,saved:false,review_count:0,wrong_count:0,correct_count:0,status:"new",next_review:"2026-01-01",created_at:at,updated_at:at});
    write(data);return user;
  };
  qa.reset=()=>{localStorage.removeItem(KEY);localStorage.removeItem(SESSION);for(const key of Object.keys(localStorage))if(key.startsWith("tangonest:account:"))localStorage.removeItem(key);};
  qa.snapshot=()=>read();
  function query(table){
    const state={op:"select",filters:[],from:0,to:null,single:false,orders:[]};
    const api={select(){return api},eq(key,value){state.filters.push(row=>row[key]===value);return api},in(key,values){state.filters.push(row=>values.includes(row[key]));return api},order(key,options){state.orders.push([key,options?.ascending!==false]);return api},range(from,to){state.from=from;state.to=to;return api},single(){state.single=true;return api},maybeSingle(){state.single=true;return api},insert(payload){state.op="insert";state.payload=payload;return api},upsert(payload){state.op="upsert";state.payload=payload;return api},update(payload){state.op="update";state.payload=payload;return api},delete(){state.op="delete";return api},then(resolve,reject){return perform().then(resolve,reject)}};
    async function perform(){
      qa.calls.push({table,op:state.op,size:Array.isArray(state.payload)?state.payload.length:1});
      if(qa.delay)await new Promise(resolve=>setTimeout(resolve,qa.delay));
      const data=read(),owner=session()?.user.id;
      if(!owner)return {data:null,error:{message:"Not authenticated"}};
      if(qa.failTable===table)return {data:null,error:{message:`Network unavailable for ${table}`}};
      const rows=data[table]||(data[table]=[]);
      let matched=rows.filter(row=>row.user_id===owner&&state.filters.every(fn=>fn(row)));
      if(state.op==="insert"||state.op==="upsert"){
        if(table==="tn_words")qa.insertBatches++;
        if(table==="tn_words"&&qa.insertBatches===qa.failBatch)return {data:null,error:{message:"Network failed before batch commit"}};
        const payload=(Array.isArray(state.payload)?state.payload:[state.payload]);
        if(payload.some(row=>row.user_id!==owner))return {data:null,error:{message:"Row-level security violation"}};
        if(state.op==="insert"&&payload.some(row=>row.id&&rows.some(existing=>existing.id===row.id)))return {data:null,error:{message:"duplicate key"}};
        matched=payload.map(row=>{
          const next={id:uid(),created_at:new Date().toISOString(),updated_at:new Date().toISOString(),...row};
          const existing=state.op==="upsert"?rows.find(item=>item.id===next.id):null;
          if(existing)Object.assign(existing,next);else rows.push(next);
          return next;
        });
      }else if(state.op==="update")matched.forEach(row=>Object.assign(row,state.payload));
      else if(state.op==="delete")data[table]=rows.filter(row=>!matched.includes(row));
      if(state.op!=="select")write(data);
      if(table==="tn_words"&&state.op==="insert"&&qa.insertBatches===qa.loseResponseBatch)return {data:null,error:{message:"Network response lost after commit"}};
      if(state.op==="select"){
        matched.sort((a,b)=>{for(const [key,ascending]of state.orders){const result=String(a[key]??"").localeCompare(String(b[key]??""),undefined,{numeric:true});if(result)return ascending?result:-result;}return 0;});
        matched=matched.slice(state.from,state.to===null?state.from+1000:state.to+1);
      }
      return {data:copy(state.single?(matched[0]||null):matched),error:null};
    }
    return api;
  }
  const notify=(event,next)=>setTimeout(()=>authCallback?.(event,next),0);
  window.tnSupabaseClient={
    auth:{
      getSession:async()=>({data:{session:session()},error:null}),getUser:async()=>({data:{user:session()?.user||null},error:null}),
      signInWithPassword:async input=>{
        const user=read().users.find(item=>item.email===input.email);
        if(!user||input.password!==password)return {data:{session:null},error:{code:"invalid_credentials",message:"Invalid login credentials"}};
        const next={user,access_token:"local-audit-access",refresh_token:"local-audit-refresh"};localStorage.setItem(SESSION,JSON.stringify(next));notify("SIGNED_IN",next);return {data:{session:next},error:null};
      },
      signUp:async input=>{
        if(read().users.some(user=>user.email===input.email))return {data:{session:null},error:{code:"user_already_exists",message:"User already exists"}};
        qa.seed(input.email,0);return window.tnSupabaseClient.auth.signInWithPassword(input);
      },
      signOut:async()=>{localStorage.removeItem(SESSION);notify("SIGNED_OUT",null);return {error:null}},
      resetPasswordForEmail:async()=>({error:null}),updateUser:async()=>({data:{user:session()?.user},error:null}),
      onAuthStateChange:callback=>{authCallback=callback;notify("INITIAL_SESSION",session());return {data:{subscription:{unsubscribe(){authCallback=null}}}}}
    },
    from:query,
    rpc:async(name,args={})=>{
      qa.calls.push({rpc:name});const data=read(),owner=session()?.user.id;
      if(!owner)return {data:null,error:{message:"Not authenticated"}};
      if(/reset|clean_start/.test(name))throw new Error("A destructive legacy reset was attempted");
      if(name==="tn_ensure_default_playlist"){
        let lists=data.tn_playlists.filter(row=>row.user_id===owner);
        if(!lists.length){const row={id:uid(),user_id:owner,name:"New Playlist",is_default:true,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};data.tn_playlists.push(row);lists=[row];}
        const primary=lists.find(row=>row.is_default)||lists[0];lists.forEach(row=>row.is_default=row.id===primary.id);write(data);return {data:copy(primary),error:null};
      }
      if(name==="tn_clean_example_fields")return {data:0,error:null};
      if(name==="tn_delete_playlist"){
        const list=data.tn_playlists.find(row=>row.id===args.p_playlist_id&&row.user_id===owner);
        data.tn_playlists=data.tn_playlists.filter(row=>row!==list);
        data.tn_words.forEach(row=>{if(row.user_id===owner&&row.playlist_id===list?.id)row.playlist_id=null;});write(data);
        await window.tnSupabaseClient.rpc("tn_ensure_default_playlist");return {data:{deleted:true},error:null};
      }
      if(name==="tn_record_learning_result"){
        const word=data.tn_words.find(row=>row.id===args.p_word_id&&row.user_id===owner);
        if(word){word.review_count=(word.review_count||0)+1;word.last_result=args.p_rating;word.learning_state="learning";word.updated_at=new Date().toISOString();write(data);}
        return {data:copy(word||null),error:null};
      }
      if(name==="tn_upsert_word_nonlearning"){
        const input=args.p_word;const word=data.tn_words.find(row=>row.id===input?.id&&row.user_id===owner);
        if(word){Object.assign(word,input);write(data);}return {data:copy(word||null),error:null};
      }
      return {data:null,error:{message:`function ${name} not found`}};
    },
    channel:()=>({on(){return this},subscribe(callback){callback?.("SUBSCRIBED");return this}}),removeChannel(){}
  };
  window.addEventListener("storage",event=>{if(event.key===SESSION)notify(session()?"SIGNED_IN":"SIGNED_OUT",session());});
  window.__tnQA=qa;
})();
