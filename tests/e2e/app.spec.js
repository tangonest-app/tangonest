const {test,expect,openTestApp}=require("./fixtures");

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

test("core learning journey remains clickable",async({page})=>{
  await openTestApp(page);
  await expect(page.locator("#pageHome")).toHaveClass(/active/);

  await page.locator("#navAdd").click();
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
  await expect(page.locator("#addList option")).toContainText(["Everyday English","Travel and Conversation Essentials","Work English"]);

  await page.locator("#navWords").click();
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
  await expect(page.locator(".tn-playlist-copy strong").first()).toHaveText("Daily English");

  await page.locator("#navStudy").click();
  await page.getByRole("button",{name:"Next Card",exact:true}).click();
  const firstCard=await page.locator("#frontWord").textContent();
  await page.getByRole("button",{name:/Reveal/}).click();
  await page.getByRole("button",{name:/Good/}).click();
  await expect.poll(()=>page.locator("#frontWord").textContent()).not.toBe(firstCard);

  await page.locator("#navQuiz").click();
  await page.locator("#quizAudioAfter").selectOption("off");
  await page.getByRole("button",{name:"Start Quiz",exact:true}).click();
  await page.locator("#choiceArea button").first().click();
  await expect(page.locator("#quizResult")).toContainText(/Correct|Incorrect/);
  await expect(page.getByRole("button",{name:"Next",exact:true})).toBeVisible();
  const firstQuestion=await page.locator("#quizWord").textContent();
  await page.getByRole("button",{name:"Next",exact:true}).click();
  await expect.poll(()=>page.locator("#quizWord").textContent()).not.toBe(firstQuestion);

  await page.locator("#navAudio").click();
  await page.getByRole("button",{name:"Play",exact:true}).click();
  await expect(page.locator("#audioNow")).not.toHaveText("---");
  await page.getByRole("button",{name:"Stop",exact:true}).click();
  await expect(page.locator("#audioNow")).toHaveText("---");

  await page.locator("#navManage").click();
  await expect(page.getByRole("button",{name:"Sync now",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Log out",exact:true}).click();
  await expect(page.locator("#authScreen")).toBeVisible();
});

test("all primary pages retain their location after reload",async({page})=>{
  await openTestApp(page);
  const pages=[
    ["navHome","pageHome"],["navAdd","pageAdd"],["navWords","pageWords"],
    ["navStudy","pageStudy"],["navQuiz","pageQuiz"],["navAudio","pageAudio"],["navManage","pageManage"]
  ];
  for(const [nav,pageId] of pages){
    await page.locator(`#${nav}`).click();
    await expect(page.locator(`#${pageId}`)).toHaveClass(/active/);
    await page.reload();
    await expect(page.locator(`#${pageId}`)).toHaveClass(/active/);
  }
});
