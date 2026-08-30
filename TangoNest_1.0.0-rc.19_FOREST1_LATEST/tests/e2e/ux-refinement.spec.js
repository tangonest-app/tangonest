const {test,expect,openTestApp,navigateToPage}=require("./fixtures");
const exactText=value=>new RegExp(`^${String(value).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}$`);

test("language priority is shared by create, bulk, edit, and Library",async({page})=>{
  await openTestApp(page);
  await navigateToPage(page,"create");
  const expected=["English","Japanese","Korean","French","Chinese Simplified","Chinese Traditional","Spanish"];
  for(const selector of ["#frontLang","#backLang","#bulkFrontLang","#bulkBackLang","#editFrontLang","#editBackLang"]){
    await expect.poll(()=>page.locator(`${selector} option`).evaluateAll(options=>options.slice(0,7).map(option=>option.textContent))).toEqual(expected);
  }
  const nativeLanguage=page.locator("#frontLang");
  await expect(nativeLanguage).toHaveCSS("display","none");
  await expect(nativeLanguage).toHaveCSS("pointer-events","none");
  const languageTrigger=page.locator('[data-language-picker-trigger="frontLang"]');
  const triggerBox=await languageTrigger.boundingBox();
  expect(triggerBox).not.toBeNull();
  await page.mouse.click(triggerBox.x+triggerBox.width-12,triggerBox.y+triggerBox.height/2);
  await expect(page.locator('[data-language-picker="frontLang"] .tn-language-picker-menu')).toBeVisible();
  await expect.poll(()=>page.locator('[data-language-picker="frontLang"] .tn-language-picker-option').evaluateAll(options=>options.slice(0,7).map(option=>option.textContent.replace("Selected","").trim()))).toEqual(expected);
  await page.locator('[data-language-picker="frontLang"] .tn-language-picker-option').nth(3).click();
  await expect(languageTrigger).toHaveText("French");
  await page.mouse.click(triggerBox.x+triggerBox.width-12,triggerBox.y+triggerBox.height/2);
  await expect.poll(()=>page.locator('[data-language-picker="frontLang"] .tn-language-picker-option').evaluateAll(options=>options.slice(0,7).map(option=>option.textContent.replace("Selected","").trim()))).toEqual(expected);
  await expect(page.locator('[data-language-picker="frontLang"] .tn-language-picker-option').nth(3)).toHaveAttribute("aria-selected","true");
  await navigateToPage(page,"library");
  const filterOptions=await page.locator("#tnFilterLanguage option").evaluateAll(options=>options.map(option=>option.textContent));
  expect(filterOptions.slice(0,3)).toEqual(["All languages","English","Japanese"]);
});

test("Library rows share one alignment system and never overflow",async({page})=>{
  await openTestApp(page,{wordCount:100});
  await navigateToPage(page,"library");
  await page.evaluate(()=>{
    const word=window.db.words[0];
    word.front="a deliberately long vocabulary expression that must wrap naturally";
    word.back="長い翻訳でも横方向へ画面を押し広げない";
    word.memo="A longer example sentence confirms that the information column remains aligned while content can grow naturally.";
    window.tnLibraryRender();
  });
  const metrics=await page.evaluate(()=>{
    const rows=[...document.querySelectorAll(".tn-word-row")].slice(0,8);
    const x=selector=>rows.map(row=>row.querySelector(selector)?.getBoundingClientRect().x).filter(Number.isFinite);
    return {
      width:innerWidth,
      rowX:rows.map(row=>row.getBoundingClientRect().x),
      mainX:x(".tn82-word-main"),
      frontX:x(".tn82-front"),
      backX:x(".tn82-back"),
      posX:x(".tn-word-list-pos"),
      rowHeights:rows.map(row=>row.getBoundingClientRect().height),
      overflow:document.documentElement.scrollWidth-innerWidth
    };
  });
  const spread=values=>Math.max(...values)-Math.min(...values);
  expect(spread(metrics.mainX)).toBeLessThanOrEqual(1);
  expect(spread(metrics.frontX)).toBeLessThanOrEqual(1);
  expect(spread(metrics.backX)).toBeLessThanOrEqual(1);
  const insets=metrics.mainX.map((value,index)=>value-metrics.rowX[index]);
  expect(Math.min(...insets)).toBeGreaterThanOrEqual(30);
  expect(Math.max(...insets)).toBeLessThanOrEqual(80);
  const frontInsets=metrics.frontX.map((value,index)=>value-metrics.rowX[index]);
  expect(Math.max(...frontInsets)).toBeLessThanOrEqual(80);
  expect(spread(metrics.posX)).toBeLessThanOrEqual(1);
  expect(metrics.overflow).toBeLessThanOrEqual(0);
  expect(Math.min(...metrics.rowHeights)).toBeGreaterThanOrEqual(60);
});

test("Library can load every word and keeps examples inside the detail panel",async({page})=>{
  await openTestApp(page,{wordCount:214});
  await navigateToPage(page,"library");
  await expect(page.locator(".tn-word-list-row")).toHaveCount(100);
  await expect(page.getByRole("button",{name:"Load all 214"})).toBeVisible();
  await page.getByRole("button",{name:"Load all 214"}).click();
  await expect(page.locator(".tn-word-list-row")).toHaveCount(214);
  await expect(page.locator(".tn-word-list-row .tn-word-example")).toHaveCount(0);
  await expect(page.locator(".tn-word-list-row .tn-word-row-actions")).toHaveCount(0);

  await page.locator(".tn-word-list-main").first().click();
  await expect(page.locator("#tnWordDetailPanel")).toHaveClass(/show/);
  await expect(page.locator("#tnWordDetailPanel")).toContainText("Example sentence 1.");
  await expect(page.locator("#tnWordDetailPanel")).toContainText("POS");
  await expect(page.locator("#tnWordDetailPanel")).toContainText("noun");
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(0);
});

test("Library base stylesheet keeps words left-aligned without the optional theme layer",async({page})=>{
  await page.route("**/ui/study-focus.css*",route=>route.fulfill({status:200,contentType:"text/css",body:""}));
  await openTestApp(page,{wordCount:6});
  await navigateToPage(page,"library");
  const metrics=await page.evaluate(()=>{
    const rows=[...document.querySelectorAll(".tn-word-row")];
    return rows.map(row=>{
      const main=row.querySelector(".tn82-word-main");
      return {
        inset:main.getBoundingClientRect().x-row.getBoundingClientRect().x,
        width:main.getBoundingClientRect().width,
        textAlign:getComputedStyle(main).textAlign,
        display:getComputedStyle(row).display
      };
    });
  });
  expect(metrics.every(item=>item.inset>=30&&item.inset<=80)).toBe(true);
  expect(metrics.every(item=>item.width>200)).toBe(true);
  expect(metrics.every(item=>item.textAlign==="left"&&item.display==="grid")).toBe(true);
});

test("Quiz uses readable smart auto timing for correct and incorrect answers",async({page})=>{
  await openTestApp(page);
  await navigateToPage(page,"quiz");
  await page.locator("#quizAudioAfter").selectOption("off");
  await expect(page.locator("#quizAutoAdvance")).toHaveValue("auto");
  await page.getByRole("button",{name:"Start Quiz",exact:true}).click();

  const firstQuestion=await page.locator("#quizWord").textContent();
  const firstCorrect=await page.evaluate(()=>correctAnswer());
  const correctButton=page.locator("#choiceArea .choice").filter({hasText:exactText(firstCorrect)});
  const correctStarted=Date.now();
  await correctButton.click();
  await expect(page.locator("#quizResult")).toContainText("✓ Correct");
  await expect(page.locator("#quizResult")).toContainText("Next question in 1.0s");
  await page.waitForTimeout(650);
  await expect(page.locator("#quizWord")).toHaveText(firstQuestion);
  await expect.poll(()=>page.locator("#quizWord").textContent(),{timeout:1800}).not.toBe(firstQuestion);
  expect(Date.now()-correctStarted).toBeGreaterThanOrEqual(850);

  const secondQuestion=await page.locator("#quizWord").textContent();
  const secondCorrect=await page.evaluate(()=>correctAnswer());
  const wrongButton=page.locator("#choiceArea .choice").filter({hasNotText:secondCorrect}).first();
  const wrongStarted=Date.now();
  await wrongButton.click();
  await expect(page.locator("#quizResult")).toContainText("× Incorrect");
  await expect(page.locator("#quizResult")).toContainText(`Correct answer: ${secondCorrect}`);
  await expect(page.locator("#quizResult")).toContainText("Next question in 1.6s");
  await page.waitForTimeout(1050);
  await expect(page.locator("#quizWord")).toHaveText(secondQuestion);
  await expect.poll(()=>page.locator("#quizWord").textContent(),{timeout:1800}).not.toBe(secondQuestion);
  expect(Date.now()-wrongStarted).toBeGreaterThanOrEqual(1400);
  await expect(page.locator("#choiceArea .selected,#choiceArea .correct,#choiceArea .wrong")).toHaveCount(0);
});

test("Quiz keyboard shortcuts work for choice and typing without stale feedback",async({page})=>{
  await openTestApp(page);
  await navigateToPage(page,"quiz");
  await page.locator("#quizAudioAfter").selectOption("off");
  await page.locator("#quizAutoAdvance").selectOption("manual");
  await page.getByRole("button",{name:"Start Quiz",exact:true}).click();
  const first=await page.locator("#quizWord").textContent();
  await page.keyboard.press("1");
  await expect(page.locator("#quizResult")).toContainText(/Correct|Incorrect/);
  await page.keyboard.press("Enter");
  await expect.poll(()=>page.locator("#quizWord").textContent()).not.toBe(first);
  await expect(page.locator("#quizResult")).not.toHaveClass(/show/);

  await page.evaluate(()=>resetQuiz());
  await page.locator("#quizType").selectOption("typing");
  await page.locator("#quizAudioAfter").selectOption("off");
  await page.getByRole("button",{name:"Start Quiz",exact:true}).click();
  const typingQuestion=await page.locator("#quizWord").textContent();
  const answer=await page.evaluate(()=>correctAnswer());
  await page.locator("#quizAnswer").fill(answer);
  await page.locator("#quizAnswer").press("Enter");
  await expect(page.locator("#quizResult")).toContainText("✓ Correct");
  await page.locator("#quizAnswer").press("Enter");
  await expect.poll(()=>page.locator("#quizWord").textContent()).not.toBe(typingQuestion);
});

test("Quiz primary controls begin in the viewport with zero horizontal overflow",async({page})=>{
  await openTestApp(page);
  await navigateToPage(page,"quiz");
  await page.locator("#quizAudioAfter").selectOption("off");
  await page.locator("#quizAutoAdvance").selectOption("manual");
  await page.getByRole("button",{name:"Start Quiz",exact:true}).click();
  const before=await page.evaluate(()=>{
    const tab=document.querySelector(".mobile-tabbar");
    const limit=tab&&getComputedStyle(tab).display!=="none"?tab.getBoundingClientRect().top:innerHeight;
    const nodes=[...document.querySelectorAll("#quizRun .quiz-top,#quizRun .quiz-question,#choiceArea,#quizRun .quiz-run-actions")];
    const rect=selector=>{const box=document.querySelector(selector).getBoundingClientRect();return {top:box.top,bottom:box.bottom,height:box.height}};
    return {scrollY,limit,bottom:Math.max(...nodes.map(node=>node.getBoundingClientRect().bottom)),overflow:document.documentElement.scrollWidth-innerWidth,question:rect(".quiz-question"),choices:rect("#choiceArea"),actions:rect(".quiz-run-actions")};
  });
  expect(before.scrollY).toBeLessThanOrEqual(8);
  expect(before.overflow).toBeLessThanOrEqual(0);
  expect(before.bottom).toBeLessThanOrEqual(before.limit+1);

  await page.locator("#choiceArea .choice").last().evaluate(button=>button.click());
  const after=await page.evaluate(()=>{
    const tab=document.querySelector(".mobile-tabbar");
    const limit=tab&&getComputedStyle(tab).display!=="none"?tab.getBoundingClientRect().top:innerHeight;
    const result=document.querySelector("#quizResult").getBoundingClientRect();
    const rect=selector=>{const box=document.querySelector(selector).getBoundingClientRect();return {top:box.top,bottom:box.bottom,height:box.height}};
    const visibleChoices=[...document.querySelectorAll("#choiceArea .choice")].filter(button=>getComputedStyle(button).display!=="none").length;
    return {scrollY,limit,resultBottom:result.bottom,overflow:document.documentElement.scrollWidth-innerWidth,visibleChoices,question:rect(".quiz-question"),choices:rect("#choiceArea"),actions:rect(".quiz-run-actions")};
  });
  expect(Math.abs(after.scrollY-before.scrollY)).toBeLessThanOrEqual(1);
  expect(after.overflow).toBeLessThanOrEqual(0);
  expect(after.resultBottom).toBeLessThanOrEqual(after.limit+1);
  expect(after.visibleChoices).toBe(4);
  for(const key of ["question","choices","actions"]){
    expect(Math.abs(after[key].top-before[key].top),`${key} top must remain fixed`).toBeLessThanOrEqual(1);
    expect(Math.abs(after[key].bottom-before[key].bottom),`${key} bottom must remain fixed`).toBeLessThanOrEqual(1);
  }
});

test("Settings keeps sync details inside its intended card grid",async({page})=>{
  await openTestApp(page);
  await navigateToPage(page,"settings");
  await expect(page.locator("#tn80CloudPanel")).toHaveCount(1);
  await expect(page.locator(".tn-settings-pair").first().locator("#tn80CloudPanel")).toHaveCount(1);
  const layout=await page.evaluate(()=>{
    const account=document.querySelector(".tn-settings-pair .tn-account-summary").getBoundingClientRect();
    const cloud=document.querySelector(".tn-settings-pair #tn80CloudPanel").getBoundingClientRect();
    const pair=document.querySelector(".tn-settings-pair");
    return {accountTop:account.top,accountBottom:account.bottom,cloudTop:cloud.top,columns:getComputedStyle(pair).gridTemplateColumns.split(" ").length,overflow:document.documentElement.scrollWidth-innerWidth};
  });
  if(layout.columns>1)expect(Math.abs(layout.accountTop-layout.cloudTop)).toBeLessThanOrEqual(2);
  else{
    expect(layout.cloudTop).toBeGreaterThan(layout.accountBottom);
    expect(layout.cloudTop-layout.accountBottom).toBeLessThanOrEqual(20);
  }
  expect(layout.overflow).toBeLessThanOrEqual(0);
});
