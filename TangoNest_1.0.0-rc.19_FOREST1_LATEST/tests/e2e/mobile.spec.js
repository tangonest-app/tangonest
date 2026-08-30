const {test,expect,openTestApp}=require("./fixtures");

test.skip(({isMobile})=>!isMobile,"mobile project only");

test("mobile controls fit, focus, and remain reachable",async({page})=>{
  await openTestApp(page);
  const noOverflow=async()=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await noOverflow();

  const tabbar=page.locator(".mobile-tabbar");
  await expect(tabbar).toBeVisible();
  const box=await tabbar.boundingBox();
  expect(Math.round(box.y+box.height)).toBe(844);

  await page.locator("#mnavHome").click();
  await page.locator(".home-focus-actions .btn.primary").click();
  await page.locator("#front").fill("focused");
  await page.locator("#back").fill("集中した");
  await expect(page.locator("#back")).toBeFocused();
  await expect(page.locator("#addWordBtn")).toBeVisible();
  await page.locator("#addWordBtn").click();
  await expect(page.locator("#wc")).toHaveText("7");

  await page.locator("#bulkText").fill("patient\t忍耐強い\tadjective\nprogress\t進歩\tnoun");
  await page.getByRole("button",{name:"Preview",exact:true}).click();
  await expect(page.locator("#bulkPreview")).toContainText("2 valid");
  await page.getByRole("button",{name:"Bulk Register",exact:true}).click();
  await expect(page.locator("#wc")).toHaveText("9");
  await noOverflow();

  await page.locator("#newList").fill("Mobile Practice");
  await page.locator("#newList").locator("xpath=following::button[normalize-space()='Create'][1]").click();
  await expect(page.locator("#addList option")).toContainText(["No playlist","My Words","Mobile Practice"]);

  await page.locator("#mnavWords").click();
  await page.locator('[data-library-view="playlists"]').click();
  const renameTrigger=page.locator('[data-rename-playlist]').first();
  await renameTrigger.click();
  const dialog=page.locator(".tn-rename-dialog");
  await expect(dialog).toBeVisible();
  await expect(page.locator("#tnRenamePlaylistInput")).toBeFocused();
  const dialogBox=await dialog.boundingBox();
  expect(Math.round(dialogBox.y+dialogBox.height)).toBe(844);
  await page.getByRole("button",{name:"Cancel",exact:true}).click();
  await expect(renameTrigger).toBeFocused();

  const targets=await page.locator(".tn-playlist-actions button").evaluateAll(buttons=>buttons.map(button=>({w:button.getBoundingClientRect().width,h:button.getBoundingClientRect().height})));
  expect(targets.every(target=>target.w>=44&&target.h>=44)).toBeTruthy();
  await noOverflow();

  await page.locator("#mnavStudy").click();
  await page.getByRole("button",{name:"Next Card",exact:true}).click();
  await expect(page.locator("#frontWord")).not.toHaveText("---");

  await page.locator("#mnavQuiz").click();
  await page.locator("#quizAudioAfter").selectOption("off");
  await page.getByRole("button",{name:"Start Quiz",exact:true}).click();
  await page.locator("#choiceArea button").first().click();
  const question=page.locator("#pageQuiz .quiz-question");
  const answer=page.locator("#quizQuestionAnswer");
  const [questionBox,answerBox]=await Promise.all([question.boundingBox(),answer.boundingBox()]);
  expect(answerBox.y+answerBox.height).toBeLessThanOrEqual(questionBox.y+questionBox.height+1);
  await expect(page.getByRole("button",{name:"Next now",exact:true})).toBeVisible();
  await noOverflow();

  await page.locator("#mnavAudio").click();
  await page.getByRole("button",{name:"Play",exact:true}).click();
  await expect(page.locator("#audioNow")).not.toHaveText("---");
  await page.getByRole("button",{name:"Stop",exact:true}).click();

  await page.locator("#tn80HeaderCloud").click();
  await expect(page.getByRole("button",{name:"Sync now",exact:true})).toBeVisible();
  await page.reload();
  await expect(page.locator("#pageManage")).toHaveClass(/active/);
  await noOverflow();
  await page.getByRole("button",{name:"Log out",exact:true}).click();
  await expect(page.locator("#authScreen")).toBeVisible();
});
