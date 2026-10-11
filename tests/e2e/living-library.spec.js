const {test,expect,openTestApp,navigateToPage}=require("./fixtures");

test("empty Library states follow the selected interface language",async({page})=>{
  await openTestApp(page,{wordCount:0});
  await page.evaluate(()=>TNI18n.setLocale("ja"));
  await navigateToPage(page,"library");
  const empty=page.locator(".tn-library-empty");
  await expect(empty).toBeVisible();
  await expect(empty).not.toContainText(/Add your first|No words|Try changing/);
  await page.locator("#tnLibrarySearch").fill("not-present");
  await expect(empty.locator("h3")).toHaveText(await page.evaluate(()=>TNI18n.t("ui.no_words_in_this_session")));
});

test("early UI status messages follow late locale loading and later switches",async({page})=>{
  await openTestApp(page);
  await page.evaluate(()=>{
    const element=document.createElement("p");element.id="late-locale-status";document.body.append(element);
    TNI18n.bindUI(element,TNI18n.t("ui.login_or_create_an_account_to_sync_your_vocabulary"));
  });
  for(const locale of ["ja","de","ar","en"]){
    await page.evaluate(locale=>TNI18n.setLocale(locale),locale);
    const expected=await page.evaluate(()=>TNI18n.t("ui.login_or_create_an_account_to_sync_your_vocabulary"));
    await expect(page.locator("#late-locale-status")).toHaveText(expected);
  }
});

test("interface preference persists without changing vocabulary or study languages",async({page})=>{
  await openTestApp(page);
  const before=await page.evaluate(()=>localStorage.getItem("tangonest_production_stable_v1"));
  await navigateToPage(page,"settings");
  await page.locator("#appLanguage").selectOption("ja");
  await expect(page.locator("#navHome")).toContainText("Home");
  await expect(page.locator("#appPageTitle")).toHaveText("Settings");
  expect(await page.evaluate(()=>localStorage.getItem("tangonest_production_stable_v1"))).toBe(before);
  await page.reload();
  await expect(page.locator("#navHome")).toContainText("Home");
  expect(await page.evaluate(()=>TNI18n.detect(["xx-ZZ","es-MX"]))).toBe("es");
  expect(await page.evaluate(()=>TNI18n.detect(["zh-TW"]))).toBe("zh-Hant");
  expect(await page.evaluate(()=>TNI18n.detect(["xx-ZZ"]))).toBe("en");
});

test("Arabic UI direction does not reinterpret Japanese vocabulary",async({page})=>{
  await openTestApp(page);
  await page.evaluate(()=>TNI18n.setLocale("ar"));
  await navigateToPage(page,"library");
  await expect(page.locator("#pageWords")).toHaveAttribute("dir","rtl");
  await expect(page.locator(".tn-word-list-row").first()).toContainText("思いがけない幸運");
  expect(await page.locator("[data-user-content]").first().getAttribute("dir")).toBe("auto");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(0);
});

test("atmosphere boundaries and manual preference are deterministic",async({page})=>{
  await openTestApp(page);
  const values=await page.evaluate(()=>[0,5,6,10,11,16,17,20,21,23].map(hour=>TangoNestAtmosphere.timeAtmosphere(new Date(2026,8,6,hour))));
  expect(values).toEqual(["night","night","morning","morning","day","day","evening","evening","night","night"]);
  await navigateToPage(page,"settings");
  await page.locator("#atmosphereMode").selectOption("morning");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-atmosphere","morning");
});

test("new Quiz answers retain vocabulary direction after selecting Arabic UI",async({page})=>{
  await openTestApp(page);
  await page.evaluate(()=>TNI18n.setLocale("ar"));
  await navigateToPage(page,"quiz");
  await page.evaluate(()=>{
    quiz.current={front:"كتاب",back:"a book",frontLang:"ar-SA",backLang:"en-US",listId:"qa-list-1"};
    quiz.direction="front";quiz.type="choice";
    renderChoices();
  });
  await expect(page.locator(".choice").first()).toHaveAttribute("dir","auto");
  for(const answer of await page.locator(".choice").all()){
    await expect(answer).toHaveAttribute("dir","auto");
    expect(await answer.evaluate(element=>getComputedStyle(element).direction)).toBe("ltr");
  }
  await page.evaluate(()=>{quiz.current.back="كتاب";document.getElementById("quizResult").innerHTML=quizFeedbackHtml(false);});
  expect(await page.locator("#quizResult bdi").last().evaluate(element=>getComputedStyle(element).direction)).toBe("rtl");
  await expect(page.locator("#quizAnswer")).toHaveAttribute("dir","auto");
});

test("reduced motion and study mode disable pointer parallax",async({page})=>{
  await openTestApp(page);
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.mouse.move(100,100);
  expect(await page.locator(".tn-atmosphere-scene").evaluate(el=>el.style.getPropertyValue("--scene-x"))).toBe("0px");
  await page.emulateMedia({reducedMotion:"no-preference"});
  await navigateToPage(page,"quiz");
  await expect(page.locator("body")).toHaveAttribute("data-motion-mode","study");
  await page.mouse.move(300,200);
  expect(await page.locator(".tn-atmosphere-scene").evaluate(el=>el.style.getPropertyValue("--scene-x"))).toBe("0px");
});

test("unavailable speech resolves honestly instead of using another language",async({page})=>{
  await openTestApp(page);
  await page.evaluate(()=>{speechSynthesis.getVoices=()=>[];speechSynthesis.speak=()=>{throw Error("Should not speak")};});
  expect(await page.evaluate(()=>speakText("bonjour","fr-FR"))).toBe(false);
  await expect(page.locator(".toast").last()).toContainText("Voice unavailable");
});

test("changing UI language preserves the Listen word and meaning",async({page})=>{
  await openTestApp(page);
  await navigateToPage(page,"listen");
  await page.evaluate(()=>{stopAudio();updateNow({front:"كتاب",back:"本",frontLang:"ar-SA",backLang:"ja-JP",memo:"هذا كتاب."});});
  await page.evaluate(()=>TNI18n.setLocale("ja"));
  await expect(page.locator("#audioNow")).toHaveText("كتاب");
  await expect(page.locator("#audioSub")).toHaveText("本");
  await expect(page.locator("#audioExample")).toHaveText("هذا كتاب.");
});

async function installControlledSpeech(page){
  await page.evaluate(()=>{
    window.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
    window.qaUtterances=[];
    speechSynthesis.getVoices=()=>[
      {name:"QA English",lang:"en-US",voiceURI:"qa-en",localService:true,default:true},
      {name:"QA Japanese",lang:"ja-JP",voiceURI:"qa-ja",localService:true,default:false}
    ];
    speechSynthesis.speak=utterance=>window.qaUtterances.push(utterance);
    speechSynthesis.cancel=()=>{};
    refreshVoices();
  });
}

test("paired speech waits for completion and cancellation prevents the second side",async({page})=>{
  await openTestApp(page);
  await installControlledSpeech(page);
  await page.evaluate(()=>{
    window.qaPairResult="pending";
    speakQueued([{text:"first",lang:"en-US"},{text:"次",lang:"ja-JP"}],100)
      .then(result=>window.qaPairResult=result);
  });
  await expect.poll(()=>page.evaluate(()=>qaUtterances.length)).toBe(1);
  await page.waitForTimeout(250);
  expect(await page.evaluate(()=>qaUtterances.length)).toBe(1);
  await page.evaluate(()=>qaUtterances[0].onend());
  await expect.poll(()=>page.evaluate(()=>qaUtterances.length)).toBe(2);
  expect(await page.evaluate(()=>qaUtterances.map(utterance=>utterance.lang))).toEqual(["en-US","ja-JP"]);
  await page.evaluate(()=>qaUtterances[1].onend());
  await expect.poll(()=>page.evaluate(()=>qaPairResult)).toBe(true);
  await page.evaluate(()=>{
    window.qaPairResult="pending";
    speakQueued([{text:"cancel this",lang:"en-US"},{text:"再生しない",lang:"ja-JP"}],100)
      .then(result=>window.qaPairResult=result);
  });
  await expect.poll(()=>page.evaluate(()=>qaUtterances.length)).toBe(3);
  await page.evaluate(()=>{cancelSpeech();qaUtterances[2].onend();});
  await expect.poll(()=>page.evaluate(()=>qaPairResult)).toBe(false);
  await page.waitForTimeout(200);
  expect(await page.evaluate(()=>qaUtterances.length)).toBe(3);
});

test("Listen waits for speech before its interval and stop cancels pending progression",async({page})=>{
  await openTestApp(page);
  await installControlledSpeech(page);
  await navigateToPage(page,"listen");
  await page.evaluate(()=>{
    document.getElementById("audioPattern").value="front";
    document.getElementById("audioIntervalCustom").value="0.5";
    document.getElementById("audioAutoPlay").checked=true;
    startAudio();
  });
  await expect.poll(()=>page.evaluate(()=>qaUtterances.length)).toBe(1);
  await page.waitForTimeout(700);
  expect(await page.evaluate(()=>qaUtterances.length)).toBe(1);
  await page.evaluate(()=>qaUtterances[0].onend());
  await expect.poll(()=>page.evaluate(()=>qaUtterances.length)).toBe(2);
  await page.evaluate(()=>{stopAudio();qaUtterances[1].onend();});
  await page.waitForTimeout(700);
  expect(await page.evaluate(()=>qaUtterances.length)).toBe(2);
  await expect(page.locator("#audioPosition")).toHaveText("0 / 0");
  await expect(page.locator("#audioSeek")).toBeDisabled();
});
