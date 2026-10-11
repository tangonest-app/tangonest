const {test,expect,openTestApp,navigateToPage}=require("./fixtures");

test("Settings sync state stays readable without truncation",async({page})=>{
  await openTestApp(page,{pageName:"manage"});
  for(const width of [320,390,834,1280]){
    await page.setViewportSize({width,height:844});
    for(const text of ["Offline","Synced","Needs attention"]){
      const metrics=await page.locator("#tn80StatusPill").evaluate((pill,value)=>{
        pill.textContent=value;const style=getComputedStyle(pill);
        return {scroll:pill.scrollWidth,client:pill.clientWidth,nowrap:style.whiteSpace,overflow:style.overflow};
      },text);
      expect(metrics.scroll).toBeLessThanOrEqual(metrics.client);
      expect(metrics.nowrap).not.toBe("nowrap");
      expect(metrics.overflow).toBe("visible");
    }
  }
});

test("Cards reveal upright text and return to the front without rotation",async({page})=>{
  await openTestApp(page,{pageName:"study"});
  await page.getByRole("button",{name:"Next Card",exact:true}).click();
  await page.getByRole("button",{name:/Reveal/}).click();
  await expect(page.locator("#flash .back")).toBeVisible();
  await expect.poll(()=>page.locator("#flash").evaluate(card=>new DOMMatrixReadOnly(getComputedStyle(card).transform).m11)).toBe(1);
  await expect(page.locator("#backWord")).not.toHaveText("---");
  await page.getByRole("button",{name:/Reveal/}).click();
  await expect.poll(()=>page.locator("#flash").evaluate(card=>new DOMMatrixReadOnly(getComputedStyle(card).transform).m11)).toBe(1);
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.getByRole("button",{name:/Reveal/}).click();
  await expect(page.locator("#flash .back")).toBeVisible();
  await expect.poll(()=>page.locator("#flash").evaluate(card=>new DOMMatrixReadOnly(getComputedStyle(card).transform).m11)).toBe(1);
});

test("Cards count follows the restored study filter immediately",async({page})=>{
  await openTestApp(page,{wordCount:1,pageName:"study"});
  await page.evaluate(()=>localStorage.setItem("tangonest_learning_session_v1",JSON.stringify({listId:"all",studyMode:"hard"})));
  await page.reload();
  await expect(page.locator("#studyMode")).toHaveValue("hard");
  await expect(page.locator("#studyProgress")).toHaveText("No cards in this view.");
});

test("Home mastery uses the same metrics in every summary",async({page})=>{
  await openTestApp(page,{wordCount:1000});
  const counts=await page.evaluate(()=>({
    header:Number(document.getElementById("totalLearned").textContent),
    path:Number(document.querySelector("#homeMemoryPath .tn-memory-stages div:last-child b").textContent),
    total:[...document.querySelectorAll("#homeMemoryPath .tn-memory-stages b")].reduce((sum,node)=>sum+Number(node.textContent),0),
    expected:window.db.words.filter(word=>window.TangoNestLearningEngine.isMasteredWord(word)).length
  }));
  expect(counts.path).toBe(counts.expected);
  expect(counts.header).toBe(counts.expected);
  expect(counts.total).toBe(1000);
});

test("saved page, explicit links and browser history retain their intended destination",async({page})=>{
  await openTestApp(page,{pageName:"words"});
  await expect(page.locator("#pageWords")).toHaveClass(/active/);
  await navigateToPage(page,"cards");
  await navigateToPage(page,"settings");
  await page.goBack();
  await expect(page.locator("#pageStudy")).toHaveClass(/active/);
  await page.goForward();
  await expect(page.locator("#pageManage")).toHaveClass(/active/);
  await page.evaluate(()=>localStorage.setItem("tangonest_last_page_v2","quiz"));
  await page.goto("/?qa=1&page=library");
  await expect(page.locator("#pageWords")).toHaveClass(/active/);
  await page.reload();
  await expect(page.locator("#pageWords")).toHaveClass(/active/);
});

test("initial playlist is an ordinary renameable and deleteable playlist",async({page})=>{
  await openTestApp(page);
  await navigateToPage(page,"library");
  await page.locator('[data-library-view="playlists"]').click();
  const card=page.locator('article[data-playlist-id="qa-list-1"]');
  await card.getByRole("button",{name:"Rename My Words"}).click();
  await page.locator("#tnRenamePlaylistInput").fill("Personal Vocabulary");
  await page.getByRole("button",{name:"Save name"}).click();
  await expect(card).toContainText("Personal Vocabulary");
  await expect(card).not.toContainText("Default");
  await expect(card.getByRole("button",{name:"Delete Personal Vocabulary"})).toBeVisible();

  await navigateToPage(page,"home");
  await navigateToPage(page,"library");
  await page.locator('[data-library-view="playlists"]').click();
  await expect(page.locator('article[data-playlist-id="qa-list-1"]')).toContainText("Personal Vocabulary");
  await expect(page.locator("#renameListSelect option")).toContainText(["Personal Vocabulary"]);
});

test("Bulk Add confirms its destination and can undo only the imported words",async({page})=>{
  await openTestApp(page);
  await navigateToPage(page,"create");
  const initial=await page.evaluate(()=>window.db.words.length);
  await page.locator("#bulkList").selectOption("qa-list-1");
  await page.locator("#bulkText").fill("forest\t森\tnoun\npath\t道\tnoun");
  await page.getByRole("button",{name:/Review & Import/}).click();
  await expect(page.locator("#bulkTargetConfirm")).toBeVisible();
  await expect(page.locator("#bulkTargetConfirm")).toContainText("My Words");
  await expect(page.locator("#bulkTargetConfirm")).toContainText("2 words");
  expect(await page.evaluate(()=>window.db.words.length)).toBe(initial);

  await page.locator("[data-bulk-approve]").click();
  await expect(page.locator("#bulkUndoPanel")).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.db.words.length)).toBe(initial+2);
  await page.getByRole("button",{name:"Undo last Bulk Add"}).click();
  await expect.poll(()=>page.evaluate(()=>window.db.words.length)).toBe(initial);
  await expect(page.locator("#bulkUndoPanel")).toBeHidden();
});

test("Bulk Add duplicate decisions stay visible and Add Both reaches destination confirmation",async({page})=>{
  await openTestApp(page);
  await navigateToPage(page,"create");
  await page.locator("#bulkText").fill("forest\t森\tnoun\nforest\t森林\tnoun");
  await page.getByRole("button",{name:/Review & Import/}).click();
  await expect(page.locator("#bulkDuplicatePanel")).toBeVisible();
  await page.getByRole("button",{name:"Add Both",exact:true}).click();
  await expect(page.locator("#bulkTargetConfirm")).toBeVisible();
  await expect(page.locator("#bulkTargetConfirm")).toContainText("2 words");
});

test("Bulk Add shows progress and saves all 1014 pasted words",async({page})=>{
  await openTestApp(page);
  await navigateToPage(page,"create");
  const initial=await page.evaluate(()=>window.db.words.length);
  const rows=Array.from({length:1014},(_,index)=>`bulk-${index+1}\tmeaning-${index+1}\tnoun`).join("\n");
  await page.locator("#bulkText").fill(rows);
  await expect(page.locator("#bulkActionDock")).toBeVisible();
  await expect(page.locator("#bulkDockCount")).toContainText("1014 rows detected");
  await page.getByRole("button",{name:/Review & Import 1014/}).click();
  await page.locator("[data-bulk-approve]").click();
  await expect(page.locator("#bulkProgressPanel")).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.db.words.length),{timeout:10000}).toBe(initial+1014);
  await expect(page.locator("#bulkUndoPanel")).toContainText("1014 words added");
});

test("Quiz defaults to smart auto advance while keeping timing configurable",async({page})=>{
  await openTestApp(page);
  await navigateToPage(page,"quiz");
  await page.locator("#quizAudioAfter").selectOption("off");
  await expect(page.locator("#quizAutoAdvance")).toHaveValue("auto");
  await page.getByRole("button",{name:"Start Quiz",exact:true}).click();
  const firstQuestion=await page.locator("#quizWord").textContent();
  await page.locator("#choiceArea .choice").first().click();
  await expect(page.locator("#quizPauseAdvance")).toHaveText("Pause auto advance");
  expect(await page.evaluate(()=>nextDelay(quiz.score>0))).toBeLessThanOrEqual(2500);
  await expect.poll(()=>page.locator("#quizWord").textContent(),{timeout:4500}).not.toBe(firstQuestion);
  await page.evaluate(()=>resetQuiz());
  await page.locator("#quizAutoAdvance").selectOption("manual");
  await expect(page.locator("#quizAutoAdvance")).toHaveValue("manual");
});

test("Quiz never mixes answer languages when matching distractors are scarce",async({page})=>{
  await openTestApp(page);
  await page.evaluate(()=>{
    const at=new Date().toISOString();
    window.db.lists.push({id:"qa-other-language",name:"Other language",createdAt:at,updatedAt:at});
    window.db.words=[
      {id:"zh-ja-1",listId:"qa-list-1",front:"家电",back:"家電",frontLang:"zh-CN",backLang:"ja-JP",pos:"noun",createdAt:at},
      {id:"zh-ja-2",listId:"qa-list-1",front:"女儿",back:"娘",frontLang:"zh-CN",backLang:"ja-JP",pos:"noun",createdAt:at},
      {id:"zh-en-1",listId:"qa-other-language",front:"女孩",back:"girl",frontLang:"zh-CN",backLang:"en-US",pos:"noun",createdAt:at},
      {id:"zh-en-2",listId:"qa-other-language",front:"情绪",back:"emotion",frontLang:"zh-CN",backLang:"en-US",pos:"noun",createdAt:at}
    ];
    window.tnWriteData(window.db);
    window.render();
  });
  await navigateToPage(page,"quiz");
  await page.locator("#quizList").selectOption("qa-list-1");
  await page.locator("#quizCount").fill("1");
  await page.getByRole("button",{name:"Start Quiz",exact:true}).click();
  const choices=await page.locator("#choiceArea .choice").allTextContents();
  expect(choices.length).toBe(2);
  expect(choices.every(value=>["家電","娘"].includes(value.trim()))).toBe(true);
  expect(choices).not.toContain("girl");
  expect(choices).not.toContain("emotion");
});

test("Library remains stable after repeated cross-page navigation",async({page})=>{
  await openTestApp(page,{wordCount:214,listCount:2});
  for(const name of ["library","cards","quiz","listen","settings","home","library"]){
    await navigateToPage(page,name);
  }
  await expect(page.locator("#tn82LibraryMount")).toHaveCount(1);
  await expect(page.locator(".tn-word-list-row")).toHaveCount(100);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(0);
});

test("Listen uses the compact archive player without circular obstruction",async({page})=>{
  await openTestApp(page);
  await navigateToPage(page,"listen");
  const metrics=await page.locator(".now-playing").evaluate(node=>{
    const box=node.getBoundingClientRect();
    const style=getComputedStyle(node);
    return {width:box.width,height:box.height,radius:parseFloat(style.borderTopLeftRadius),overflow:document.documentElement.scrollWidth-innerWidth};
  });
  if(page.viewportSize().width>=600)expect(metrics.width).toBeGreaterThan(metrics.height*1.7);
  else expect(metrics.width).toBeGreaterThan(200);
  expect(metrics.radius).toBeLessThanOrEqual(16);
  expect(metrics.overflow).toBeLessThanOrEqual(0);
  await expect(page.locator(".listen-state")).toContainText("Choose a playlist");
  await expect(page.locator("#audioSeek")).toBeVisible();
  await expect(page.locator("#audioAutoPlay")).toBeChecked();
});
