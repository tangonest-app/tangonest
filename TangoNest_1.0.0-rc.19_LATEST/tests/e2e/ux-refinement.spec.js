const {test,expect,openTestApp,navigateToPage}=require("./fixtures");
const exactText=value=>new RegExp(`^${String(value).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}$`);

test("language priority is shared by create, bulk, edit, and Library",async({page})=>{
  await openTestApp(page);
  await navigateToPage(page,"create");
  const expected=["English","Japanese","French","Korean","Chinese Simplified","Chinese Traditional","Spanish"];
  for(const selector of ["#frontLang","#backLang","#bulkFrontLang","#bulkBackLang","#editFrontLang","#editBackLang"]){
    await expect.poll(()=>page.locator(`${selector} option`).evaluateAll(options=>options.slice(0,7).map(option=>option.textContent))).toEqual(expected);
  }
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
      mainX:x(".tn82-word-main"),
      frontX:x(".tn82-front"),
      backX:x(".tn82-back"),
      rowHeights:rows.map(row=>row.getBoundingClientRect().height),
      overflow:document.documentElement.scrollWidth-innerWidth
    };
  });
  const spread=values=>Math.max(...values)-Math.min(...values);
  expect(spread(metrics.mainX)).toBeLessThanOrEqual(1);
  expect(spread(metrics.frontX)).toBeLessThanOrEqual(1);
  expect(spread(metrics.backX)).toBeLessThanOrEqual(1);
  expect(metrics.overflow).toBeLessThanOrEqual(0);
  expect(Math.min(...metrics.rowHeights)).toBeGreaterThanOrEqual(70);
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
    return {scrollY,limit,bottom:Math.max(...nodes.map(node=>node.getBoundingClientRect().bottom)),overflow:document.documentElement.scrollWidth-innerWidth};
  });
  expect(before.scrollY).toBe(0);
  expect(before.overflow).toBeLessThanOrEqual(0);
  expect(before.bottom).toBeLessThanOrEqual(before.limit+1);

  await page.locator("#choiceArea .choice").last().evaluate(button=>button.click());
  const after=await page.evaluate(()=>{
    const tab=document.querySelector(".mobile-tabbar");
    const limit=tab&&getComputedStyle(tab).display!=="none"?tab.getBoundingClientRect().top:innerHeight;
    const result=document.querySelector("#quizResult").getBoundingClientRect();
    return {scrollY,limit,resultBottom:result.bottom,overflow:document.documentElement.scrollWidth-innerWidth};
  });
  expect(after.scrollY).toBe(0);
  expect(after.overflow).toBeLessThanOrEqual(0);
  expect(after.resultBottom).toBeLessThanOrEqual(after.limit+1);
});
