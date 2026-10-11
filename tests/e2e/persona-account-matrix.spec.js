const {test,expect,navigateToPage,selectLanguage}=require("./fixtures");
const {installPersonaAuthMock}=require("./persona-auth-fixture");

const PERSONAS=[
  {role:"new student",area:"home",words:0},
  {role:"high school exam learner",area:"quiz",words:12},
  {role:"university language major",area:"cards",words:18},
  {role:"busy office worker",area:"home",words:24},
  {role:"language teacher",area:"create",words:30},
  {role:"foreign resident",area:"language",words:8},
  {role:"commuting listener",area:"listen",words:16},
  {role:"application developer",area:"settings",words:6},
  {role:"keyboard-only learner",area:"keyboard",words:10},
  {role:"multilingual learner",area:"language",words:14},
  {role:"large-library power user",area:"library",words:1014},
  {role:"returning daily learner",area:"reload",words:20}
];

for(const [personaIndex,persona] of PERSONAS.entries()){
  test(`${personaIndex+1}. ${persona.role} can sign in and reach the intended workflow`,async({page},testInfo)=>{
    test.setTimeout(60000);
    const accountIndex=personaIndex+1;
    const email=`qa.${String(accountIndex).padStart(2,"0")}.${persona.role.replace(/[^a-z]+/g,".")}@tangonest.test`;
    const password=`TangoNest-QA-${String(accountIndex).padStart(2,"0")}!`;
    await installPersonaAuthMock(page,{index:accountIndex,email,password,wordCount:persona.words});
    await page.goto("/");
    await page.locator("#authEmail").fill(email);
    await page.locator("#authPassword").fill(password);
    await page.getByRole("button",{name:"Login",exact:true}).click();
    await expect(page.locator("#authScreen")).toBeHidden();
    await expect(page.locator("#pageHome")).toHaveClass(/active/);
    await expect(page.locator("#wc")).toHaveText(String(persona.words));
    await expect(page.locator("#listCount")).toHaveText("1");
    await expect.poll(()=>page.evaluate(()=>window.tnAuthDiagnostics().authenticated)).toBe(true);

    if(testInfo.project.name==="desktop"){
      const positions=await page.locator("#navHome,#navWords,#navAdd").evaluateAll(nodes=>Object.fromEntries(nodes.map(node=>[node.id,node.getBoundingClientRect().top])));
      expect(positions.navHome).toBeLessThan(positions.navWords);
      expect(positions.navWords).toBeLessThan(positions.navAdd);
    }

    if(persona.area==="quiz"){
      await navigateToPage(page,"quiz");
      await expect(page.locator("#quizRun")).toBeHidden();
      await expect(page.getByRole("button",{name:"Start Quiz",exact:true})).toBeVisible();
    }else if(persona.area==="cards"){
      await navigateToPage(page,"cards");
      await page.getByRole("button",{name:"Next Card",exact:true}).click();
      await expect(page.locator("#frontWord")).not.toHaveText("---");
    }else if(persona.area==="create"){
      await navigateToPage(page,"create");
      await expect(page.locator("#bulkText")).toBeVisible();
      if(testInfo.project.name==="desktop")await expect(page.locator("#front")).toBeFocused();
    }else if(persona.area==="language"){
      await navigateToPage(page,"create");
      await selectLanguage(page,"frontLang",personaIndex%2?"fr-FR":"ko-KR");
      await expect(page.locator("#frontLang option").nth(0)).toHaveText("English");
    }else if(persona.area==="listen"){
      await navigateToPage(page,"listen");
      await expect(page.getByRole("button",{name:"Play",exact:true})).toBeVisible();
    }else if(persona.area==="settings"){
      await navigateToPage(page,"settings");
      await page.locator("#tnDataTransferDetails > summary").click();
      await expect(page.getByRole("button",{name:"Export / Copy Data",exact:true})).toBeVisible();
    }else if(persona.area==="keyboard"){
      const homeNav=testInfo.project.name==="mobile" ? page.locator("#mnavHome") : page.locator("#navHome");
      await expect(homeNav).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.locator("#pageHome")).toHaveClass(/active/);
      await navigateToPage(page,"create");
      await page.locator("#front").fill("keyboard");
    }else if(persona.area==="library"){
      await navigateToPage(page,"library");
      await expect(page.locator(".tn82-library-summary").first()).toContainText("Words: 1014");
      await expect(page.locator("[data-load-all]")).toBeVisible();
    }else if(persona.area==="reload"){
      await page.reload();
      await expect(page.locator("#authScreen")).toBeHidden();
      await expect(page.locator("#wc")).toHaveText(String(persona.words));
    }else{
      await expect(page.getByRole("button",{name:/Add Words/}).first()).toBeVisible();
    }

    await page.reload();
    await expect(page.locator("#authScreen")).toBeHidden();
    await expect.poll(()=>page.evaluate(()=>window.tnAuthDiagnostics().authenticated)).toBe(true);
  });
}
