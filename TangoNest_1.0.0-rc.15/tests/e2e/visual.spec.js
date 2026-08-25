const {test,expect,openTestApp}=require("./fixtures");

async function attachScreen(page,testInfo,name){
  await testInfo.attach(name,{body:await page.screenshot({fullPage:true,animations:"disabled"}),contentType:"image/png"});
  const layout=await page.evaluate(()=>({
    viewport:innerWidth,
    documentWidth:document.documentElement.scrollWidth,
    appWidth:document.querySelector(".app")?.getBoundingClientRect().width||0,
    headerWidth:document.querySelector(".header")?.getBoundingClientRect().width||0,
    sidebarWidth:document.querySelector(".app-sidebar")?.getBoundingClientRect().width||0,
    workspaceWidth:document.querySelector(".app-workspace")?.getBoundingClientRect().width||0
  }));
  expect(layout.documentWidth,`${name} has no horizontal overflow`).toBeLessThanOrEqual(layout.viewport);
  expect(Math.abs(layout.workspaceWidth-layout.headerWidth),`${name} keeps the shared workspace width`).toBeLessThanOrEqual(1);
  expect(Math.abs(layout.appWidth-layout.sidebarWidth-layout.workspaceWidth),`${name} keeps sidebar and workspace aligned`).toBeLessThanOrEqual(1);
}

test("login visual capture",async({page},testInfo)=>{
  await page.route("https://cdn.jsdelivr.net/**",route=>route.fulfill({status:200,contentType:"application/javascript",body:"window.supabase={};"}));
  await page.goto("/");
  await expect(page.locator("#authScreen")).toBeVisible();
  await testInfo.attach("login",{body:await page.screenshot({fullPage:true,animations:"disabled"}),contentType:"image/png"});
});

test("primary screens retain one stable layout system",async({page},testInfo)=>{
  await openTestApp(page);
  const screens=[
    ["navHome","home"],["navAdd","create"],["navWords","library"],["navStudy","cards"],
    ["navQuiz","quiz"],["navAudio","listen"],["navManage","settings"]
  ];
  for(const [nav,name] of screens){
    await page.locator(`#${nav}`).click();
    await attachScreen(page,testInfo,name);
  }
});
