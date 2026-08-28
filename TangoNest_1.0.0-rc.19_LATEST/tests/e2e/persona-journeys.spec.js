const {test,expect,openTestApp,navigateToPage}=require("./fixtures");

test.skip(({browserName})=>browserName==="webkit","Desktop and mobile persona validation; WebKit stays in the regression suite");

test("twelve real-user journeys remain direct and coherent",async({page})=>{
  test.setTimeout(120000);
  const noOverflow=async()=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  const exactText=value=>new RegExp(`^${String(value).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}$`);
  await openTestApp(page,{wordCount:0});

  await test.step("1. New user adds the first word and reaches Library",async()=>{
    await expect(page.locator("#wc")).toHaveText("0");
    await expect(page.locator("#listCount")).toHaveText("1");
    await navigateToPage(page,"create");
    await page.locator("#front").fill("practice");
    await page.locator("#back").fill("練習");
    await page.locator("#addWordBtn").click();
    await expect(page.locator("#wc")).toHaveText("1");
    await navigateToPage(page,"library");
    await expect(page.locator(".tn-word-row")).toContainText("practice");
  });

  await test.step("2. Busy learner bulk-adds ten English to Japanese words",async()=>{
    await navigateToPage(page,"create");
    const rows=Array.from({length:10},(_,index)=>`journey-${index+1}\t意味${index+1}\tnoun`).join("\n");
    await page.locator("#bulkText").fill(rows);
    await page.getByRole("button",{name:"Preview",exact:true}).click();
    await expect(page.locator("#bulkPreview")).toContainText("10 valid");
    await page.getByRole("button",{name:"Bulk Register",exact:true}).click();
    await expect(page.locator("#wc")).toHaveText("11");
  });

  await test.step("3. Library search and filters find a word without layout drift",async()=>{
    await navigateToPage(page,"library");
    await page.locator("#tnLibrarySearch").fill("journey-7");
    await expect(page.locator(".tn-word-row")).toHaveCount(1);
    await page.locator("#tnLibrarySearch").fill("");
    const summary=page.locator(".tn-library-filter-panel summary");
    if(await summary.isVisible())await summary.click();
    await page.locator("#tnFilterPos").selectOption("noun");
    await expect(page.locator(".tn-word-row")).toHaveCount(10);
    await page.locator("#tnClearFilters").click();
    await noOverflow();
  });

  await test.step("4. Serious learner reviews ten cards",async()=>{
    await navigateToPage(page,"cards");
    await page.getByRole("button",{name:"Next Card",exact:true}).click();
    for(let index=0;index<10;index++){
      const before=await page.locator("#frontWord").textContent();
      await page.getByRole("button",{name:/Reveal/}).click();
      await page.getByRole("button",{name:/Good/}).click();
      await expect.poll(()=>page.locator("#frontWord").textContent(),{timeout:1800}).not.toBe(before);
    }
  });

  await test.step("5. Choice Quiz runs ten questions with visible feedback",async()=>{
    await navigateToPage(page,"quiz");
    await page.locator("#quizCount").fill("10");
    await page.locator("#quizAudioAfter").selectOption("off");
    await page.locator("#quizAutoAdvance").selectOption("manual");
    await page.getByRole("button",{name:"Start Quiz",exact:true}).click();
    for(let index=0;index<10;index++){
      const before=await page.locator("#quizWord").textContent();
      const correct=await page.evaluate(()=>correctAnswer());
      await page.locator("#choiceArea .choice").filter({hasText:exactText(correct)}).click();
      await expect(page.locator("#quizResult")).toContainText("✓ Correct");
      if(index<9){
        await page.locator("#quizResult .quiz-next-btn").click();
        await expect(page.locator("#quizProgress")).toHaveText(`${index+2} / 10`,{timeout:2500});
        await expect(page.locator("#quizWord")).not.toHaveText(before);
      }else{
        await page.locator("#quizResult .quiz-next-btn").click();
        await expect(page.locator("#quizEnd")).toBeVisible({timeout:2500});
      }
    }
  });

  await test.step("6. Typing Quiz works from the keyboard",async()=>{
    await page.evaluate(()=>resetQuiz());
    await page.locator("#quizType").selectOption("typing");
    await page.locator("#quizCount").fill("2");
    await page.locator("#quizAutoAdvance").selectOption("manual");
    await page.locator("#quizAudioAfter").selectOption("off");
    await page.getByRole("button",{name:"Start Quiz",exact:true}).click();
    for(let index=0;index<2;index++){
      const correct=await page.evaluate(()=>correctAnswer());
      await page.locator("#quizAnswer").fill(correct);
      await page.locator("#quizAnswer").press("Enter");
      await expect(page.locator("#quizResult")).toContainText("✓ Correct");
      await page.locator("#quizAnswer").press("Enter");
    }
    await expect(page.locator("#quizEnd")).toBeVisible();
  });

  await test.step("7. Listen playback controls stay reachable",async()=>{
    await navigateToPage(page,"listen");
    await page.getByRole("button",{name:"Play",exact:true}).click();
    await expect(page.locator("#audioNow")).not.toHaveText("---");
    await page.getByRole("button",{name:"Pause",exact:true}).click();
    await page.getByRole("button",{name:"Previous",exact:true}).click();
    await page.getByRole("button",{name:"Next",exact:true}).click();
    await page.getByRole("button",{name:"Stop",exact:true}).click();
    await expect(page.locator("#audioNow")).toHaveText("---");
  });

  await test.step("8. French to English uses the same language priority",async()=>{
    await navigateToPage(page,"create");
    await page.locator("#bulkFrontLang").selectOption("fr-FR");
    await page.locator("#bulkBackLang").selectOption("en-US");
    await page.locator("#bulkText").fill("bonjour\thello\tphrase");
    await page.getByRole("button",{name:"Bulk Register",exact:true}).click();
    await expect(page.locator("#wc")).toHaveText("12");
  });

  await test.step("9. English to Japanese preferences remain available",async()=>{
    await expect(page.locator("#frontLang option").nth(0)).toHaveText("English");
    await expect(page.locator("#frontLang option").nth(1)).toHaveText("Japanese");
    await page.locator("#frontLang").selectOption("en-US");
    await page.locator("#backLang").selectOption("ja-JP");
  });

  await test.step("10. Mobile and desktop controls avoid horizontal overflow",async()=>{
    await noOverflow();
    await navigateToPage(page,"library");
    await noOverflow();
    await navigateToPage(page,"quiz");
    await noOverflow();
  });

  await test.step("11. A wrong answer enters Mistake Review",async()=>{
    await page.locator("#quizCount").fill("1");
    await page.locator("#quizAutoAdvance").selectOption("manual");
    await page.locator("#quizAudioAfter").selectOption("off");
    await page.getByRole("button",{name:"Start Quiz",exact:true}).click();
    const correct=await page.evaluate(()=>correctAnswer());
    await page.locator("#choiceArea .choice").filter({hasNotText:correct}).first().click();
    await expect(page.locator("#quizResult")).toContainText("× Incorrect");
    await navigateToPage(page,"library");
    await expect(page.locator("#mistakeNotebookLibrary")).toContainText("saved mistakes");
  });

  await test.step("12. Reload resumes the current page and keeps one default list",async()=>{
    await page.reload();
    await expect(page.locator("#pageWords")).toHaveClass(/active/);
    await expect(page.locator("#listCount")).toHaveText("1");
    await expect(page.locator("#wc")).toHaveText("12");
    await noOverflow();
  });
});
