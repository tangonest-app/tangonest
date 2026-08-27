const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("@playwright/test");
const {buildData,navigateToPage}=require("../tests/e2e/fixtures");

const output=path.join(__dirname,"..","qa","screenshots");
const viewports=[
  ["desktop-1440",1440,1000],
  ["desktop-1280",1280,900],
  ["tablet-1024",1024,900],
  ["tablet-768",768,900],
  ["mobile-430",430,932],
  ["mobile-390",390,844],
  ["mobile-375",375,812]
];
const screens=["home","library","cards","quiz","listen","settings"];

async function main(){
  fs.rmSync(output,{recursive:true,force:true});
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({headless:true});
  try{
    for(const [label,width,height] of viewports){
      const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
      const page=await context.newPage();
      await page.route("https://cdn.jsdelivr.net/**",route=>route.fulfill({status:200,contentType:"application/javascript",body:"window.supabase={};"}));
      await page.addInitScript(({data})=>{
        localStorage.setItem("tangonest_production_stable_v1",JSON.stringify(data));
        localStorage.setItem("tangonest_last_good_data_v1",JSON.stringify(data));
        localStorage.setItem("tangonest_last_page_v2","home");
      },{data:buildData(18)});
      await page.goto("http://127.0.0.1:4190/?qa=1",{waitUntil:"networkidle"});
      await page.locator(".app").waitFor({state:"visible"});
      for(const screen of screens){
        await navigateToPage(page,screen);
        if(screen==="cards"&&await page.getByRole("button",{name:"Next Card",exact:true}).isVisible()){
          await page.getByRole("button",{name:"Next Card",exact:true}).click();
        }
        if(screen==="quiz"&&await page.getByRole("button",{name:"Start Quiz",exact:true}).isVisible()){
          await page.locator("#quizAudioAfter").selectOption("off");
          await page.getByRole("button",{name:"Start Quiz",exact:true}).click();
        }
        await page.screenshot({
          path:path.join(output,`${label}-${screen}.png`),
          animations:"disabled"
        });
      }
      await context.close();
    }
  }finally{
    await browser.close();
  }
  console.log(`STUDY_FOCUS_SCREENSHOTS_PASS ${viewports.length*screens.length} files`);
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
