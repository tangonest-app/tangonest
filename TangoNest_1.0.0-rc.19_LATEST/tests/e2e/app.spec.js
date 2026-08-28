const {test,expect,openTestApp,navigateToPage}=require("./fixtures");

async function installAuthMock(page,{failWords=false,startSignedIn=false,skipFreshLoginMarker=false,skipAccountResetMarker=false}={}){
  await page.route("https://cdn.jsdelivr.net/**",route=>route.fulfill({status:200,contentType:"application/javascript",body:"window.supabase={};"}));
  await page.addInitScript(({failWords,startSignedIn,skipFreshLoginMarker,skipAccountResetMarker})=>{
    const SESSION_KEY="tangonest_e2e_auth_session";
    const user={id:"00000000-0000-4000-8000-000000008012",email:"learner@example.com"};
    if(startSignedIn)localStorage.setItem(SESSION_KEY,"1");
    if(!skipFreshLoginMarker)localStorage.setItem("tangonest_fresh_login_rc17_pdca6","complete");
    if(!skipAccountResetMarker)localStorage.setItem(`tangonest_account_clean_start_v1:${user.id}`,"complete");
    const session=()=>({user,access_token:"e2e-access",refresh_token:"e2e-refresh"});
    const stored=()=>localStorage.getItem(SESSION_KEY) ? session() : null;
    let authCallback=null;
    let cleanStartApplied=false;
    const playlists=[{id:"00000000-0000-4000-8000-000000008013",user_id:user.id,name:"Auth Test",created_at:"2026-08-25T00:00:00.000Z",updated_at:"2026-08-25T00:00:00.000Z"}];
    const words=[{id:"00000000-0000-4000-8000-000000008014",user_id:user.id,playlist_id:playlists[0].id,front:"session",back:"セッション",front_lang:"en-US",back_lang:"ja-JP",status:"new",saved:false,level:1,next_review:"2026-08-25",correct_count:0,wrong_count:0,review_count:0,consecutive_correct:0,review_interval_days:0,learning_state:"new",position:0,created_at:"2026-08-25T00:00:00.000Z",updated_at:"2026-08-25T00:00:00.000Z"}];
    function builder(table){
      return {
        operation:"select",payload:null,wantsSingle:false,
        select(){return this;},eq(){return this;},order(){return this;},
        insert(payload){this.operation="insert";this.payload=payload;return this;},
        single(){this.wantsSingle=true;return this;},
        then(resolve,reject){
          let result;
          if(table==="tn_words"&&failWords)result={data:null,error:{message:"permission denied for table tn_words"}};
          else{
            const rows=table==="tn_playlists"?playlists:words;
            if(this.operation==="insert"){
              const row={id:"00000000-0000-4000-8000-000000008015",created_at:new Date().toISOString(),updated_at:new Date().toISOString(),...this.payload};
              rows.push(row);
              result={data:this.wantsSingle?row:[row],error:null};
            }else result={data:this.wantsSingle?(rows[0]||null):rows.map(row=>({...row})),error:null};
          }
          return Promise.resolve(result).then(resolve,reject);
        }
      };
    }
    window.tnSupabaseClient={
      auth:{
        getSession:async()=>({data:{session:stored()},error:null}),
        signInWithPassword:async({email,password})=>{
          if(email!==user.email||password!=="correct-password")return {data:{session:null},error:{message:"Invalid login credentials",code:"invalid_credentials"}};
          localStorage.setItem(SESSION_KEY,"1");
          const next=session();
          setTimeout(()=>authCallback?.("SIGNED_IN",next),0);
          return {data:{session:next},error:null};
        },
        signUp:async({email})=>{
          if(email===user.email)return {data:{session:null},error:{message:"User already exists",code:"user_already_exists"}};
          localStorage.setItem(SESSION_KEY,"1");
          const next=session();
          setTimeout(()=>authCallback?.("SIGNED_IN",next),0);
          return {data:{session:next},error:null};
        },
        signOut:async()=>{localStorage.removeItem(SESSION_KEY);setTimeout(()=>authCallback?.("SIGNED_OUT",null),0);return {error:null};},
        resetPasswordForEmail:async()=>({data:{},error:null}),
        updateUser:async()=>({data:{user},error:null}),
        onAuthStateChange:callback=>{authCallback=callback;setTimeout(()=>callback("INITIAL_SESSION",stored()),0);return {data:{subscription:{unsubscribe(){authCallback=null;}}}};}
      },
      rpc:async name=>{
        if(name==="tn_apply_account_clean_start_v1"){
          if(!cleanStartApplied){
            words.splice(0,words.length);
            playlists.splice(0,playlists.length,{id:"00000000-0000-4000-8000-000000008016",user_id:user.id,name:"My Words",is_default:true,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
            cleanStartApplied=true;
            return {data:{applied:true,words:0,lists:1},error:null};
          }
          return {data:{applied:false,words:words.length,lists:playlists.length},error:null};
        }
        return {data:null,error:{message:`function ${name} not found`}};
      },
      from:builder,
      channel:()=>({on(){return this;},subscribe(callback){callback?.("SUBSCRIBED");return this;}}),
      removeChannel(){}
    };
  },{failWords,startSignedIn,skipFreshLoginMarker,skipAccountResetMarker});
}

test("login gate is operable and reports validation",async({page})=>{
  await page.route("https://cdn.jsdelivr.net/**",route=>route.fulfill({status:200,contentType:"application/javascript",body:"window.supabase={};"}));
  await page.goto("/");
  const auth=page.locator("#authScreen");
  await expect(auth).toBeVisible();
  await expect(page.getByRole("button",{name:"Login",exact:true})).toBeEnabled();
  await page.getByRole("button",{name:"Login",exact:true}).click();
  await expect(page.locator("#authMessage")).toContainText("Email and password are required");
  await page.locator("#authEmail").fill("learner@example.com");
  await expect(page.locator("#authEmail")).toBeFocused();
});

test("updated release restores a valid saved session without exposing stale data",async({page})=>{
  await installAuthMock(page,{startSignedIn:true,skipFreshLoginMarker:true});
  await page.goto("/");
  await expect(page.locator("#authScreen")).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>window.tnAuthDiagnostics().authenticated)).toBe(true);
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem("tangonest_e2e_auth_session"))).not.toBe(null);
  await expect(page.locator("#wc")).toHaveText("0");
  await expect(page.locator("#listCount")).toHaveText("1");
});

test("first login performs the clean account reset before showing Home",async({page})=>{
  await installAuthMock(page,{skipAccountResetMarker:true});
  await page.goto("/");
  await page.locator("#authEmail").fill("learner@example.com");
  await page.locator("#authPassword").fill("correct-password");
  await page.getByRole("button",{name:"Login",exact:true}).click();
  await expect(page.locator("#authScreen")).toBeHidden();
  await expect(page.locator("#pageHome")).toHaveClass(/active/);
  await expect(page.locator("#wc")).toHaveText("0");
  await expect(page.locator("#listCount")).toHaveText("1");
  const state=await page.evaluate(()=>({
    words:window.tnGetDb().words.length,
    lists:window.tnGetDb().lists.map(list=>list.name)
  }));
  expect(state).toEqual({words:0,lists:["My Words"]});
});

test("login persists and data-table failure never becomes logout",async({page})=>{
  await installAuthMock(page,{failWords:true});
  await page.goto("/");
  await page.locator("#authEmail").fill("learner@example.com");
  await page.locator("#authPassword").fill("correct-password");
  await page.getByRole("button",{name:"Login",exact:true}).click();
  await expect(page.locator("#authScreen")).toBeHidden();
  await expect(page.locator("#pageHome")).toHaveClass(/active/);
  await expect(page.locator("#tn80HeaderCloud")).toHaveText("Needs attention");
  await expect.poll(()=>page.evaluate(()=>window.tnAuthDiagnostics().authenticated)).toBe(true);
  await page.reload();
  await expect(page.locator("#authScreen")).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>window.tnAuthDiagnostics().authenticated)).toBe(true);
  await navigateToPage(page,"library");
  await expect(page.locator("#pageWords")).toHaveClass(/active/);
});

test("wrong password and existing-account signup show specific guidance",async({page})=>{
  await installAuthMock(page);
  await page.goto("/");
  await page.locator("#authEmail").fill("learner@example.com");
  await page.locator("#authPassword").fill("wrong-password");
  await page.getByRole("button",{name:"Login",exact:true}).click();
  await expect(page.locator("#authMessage")).toHaveText("Email or password is incorrect.");
  await page.locator("#authPassword").fill("correct-password");
  await page.getByRole("button",{name:"Create account",exact:true}).click();
  await expect(page.locator("#authMessage")).toContainText("already exists");
  await expect(page.locator("#authMessage")).toContainText("Login instead");
});

test("core learning journey remains clickable",async({page})=>{
  await openTestApp(page);
  await expect(page.locator("#pageHome")).toHaveClass(/active/);

  await navigateToPage(page,"create");
  const languageOrder=await page.locator("#frontLang option").evaluateAll(options=>options.slice(0,7).map(option=>option.textContent));
  expect(languageOrder).toEqual(["English","Japanese","French","Korean","Chinese Simplified","Chinese Traditional","Spanish"]);
  await page.locator("#frontLang").selectOption("fr-FR");
  await page.locator("#front").fill("réfléchir");
  await page.locator("#back").fill("よく考える");
  await page.keyboard.press("Control+Enter");
  await expect(page.locator("#wc")).toHaveText("7");
  await expect(page.locator("#front")).toBeFocused();
  await expect(page.locator("#frontLang")).toHaveValue("fr-FR");

  await page.locator("#bulkText").fill("calm\t落ち着いた\tadjective\nfocus\t集中する\tverb");
  await page.getByRole("button",{name:"Preview",exact:true}).click();
  await expect(page.locator("#bulkPreview")).toContainText("2 valid");

  await page.locator("#newList").fill("Work English");
  await page.locator("#newList").locator("xpath=following::button[normalize-space()='Create'][1]").click();
  await expect(page.locator("#addList option")).toContainText(["No playlist","My Words","Work English"]);

  await navigateToPage(page,"library");
  await page.locator('[data-library-view="words"]').click();
  await page.locator("#tnLibrarySearch").fill("réfléchir");
  await expect(page.locator(".tn-word-row")).toHaveCount(1);
  await expect(page.locator(".tn-word-row")).toContainText("よく考える");
  await page.locator("#tnLibrarySearch").fill("");

  await page.locator('[data-library-view="playlists"]').click();
  await page.locator('[data-rename-playlist]').first().click();
  await expect(page.locator("#tnRenamePlaylistInput")).toBeFocused();
  await page.locator("#tnRenamePlaylistInput").fill("Daily English");
  await page.getByRole("button",{name:"Save name",exact:true}).click();
  await expect(page.locator(".tn-playlist-copy strong",{hasText:"Daily English"})).toHaveText("Daily English");

  await navigateToPage(page,"cards");
  await page.getByRole("button",{name:"Next Card",exact:true}).click();
  const firstCard=await page.locator("#frontWord").textContent();
  await page.getByRole("button",{name:/Reveal/}).click();
  await page.getByRole("button",{name:/Good/}).click();
  await expect.poll(()=>page.locator("#frontWord").textContent()).not.toBe(firstCard);

  await navigateToPage(page,"quiz");
  await page.locator("#quizAudioAfter").selectOption("off");
  await expect(page.locator("#quizAutoAdvance")).toHaveValue("auto");
  await page.getByRole("button",{name:"Start Quiz",exact:true}).click();
  const firstQuestion=await page.locator("#quizWord").textContent();
  await page.locator("#choiceArea button").first().click();
  await expect(page.locator("#quizResult")).toContainText(/Correct|Incorrect/);
  await expect(page.getByRole("button",{name:"Next now",exact:true})).toBeVisible();
  await expect.poll(()=>page.locator("#quizWord").textContent(),{timeout:2400}).not.toBe(firstQuestion);

  await navigateToPage(page,"listen");
  await page.getByRole("button",{name:"Play",exact:true}).click();
  await expect(page.locator("#audioNow")).not.toHaveText("---");
  await page.getByRole("button",{name:"Stop",exact:true}).click();
  await expect(page.locator("#audioNow")).toHaveText("---");

  await navigateToPage(page,"settings");
  await expect(page.getByRole("button",{name:"Sync now",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Log out",exact:true}).click();
  await expect(page.locator("#authScreen")).toBeVisible();
});

test("all primary pages retain their location after reload",async({page})=>{
  await openTestApp(page);
  const pages=[
    ["home","pageHome"],["create","pageAdd"],["library","pageWords"],
    ["cards","pageStudy"],["quiz","pageQuiz"],["listen","pageAudio"],["settings","pageManage"]
  ];
  for(const [name,pageId] of pages){
    await navigateToPage(page,name);
    await expect(page.locator(`#${pageId}`)).toHaveClass(/active/);
    await page.reload();
    await expect(page.locator(`#${pageId}`)).toHaveClass(/active/);
  }
});
