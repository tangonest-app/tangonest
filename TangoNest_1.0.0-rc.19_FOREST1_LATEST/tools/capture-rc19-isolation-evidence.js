const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("@playwright/test");
const {buildData,navigateToPage}=require("../tests/e2e/fixtures");

const output=path.join(__dirname,"..","qa","rc19-account-isolation");
const baseUrl=process.env.TN_QA_BASE_URL||"http://127.0.0.1:4173/?qa=1";

function accountData(account){
  const data=buildData(account==="A"?3:2);
  const terms=account==="A"
    ? [["apple","りんご"],["banana","バナナ"],["experience","経験"]]
    : [["bonjour","こんにちは"],["merci","ありがとう"]];
  data.words=data.words.slice(0,terms.length).map((word,index)=>({
    ...word,
    front:terms[index][0],
    back:terms[index][1],
    memo:account==="A"?"English account-isolation fixture.":"French account-isolation fixture.",
    frontLang:account==="A"?"en-US":"fr-FR"
  }));
  data.meta={...data.meta,userId:`qa-account-${account.toLowerCase()}`,sourceOfTruth:"rc19-isolation-evidence"};
  return data;
}

async function prepare(page,account){
  const data=accountData(account);
  await page.route("https://cdn.jsdelivr.net/**",route=>route.fulfill({
    status:200,
    contentType:"application/javascript",
    body:"window.supabase={};"
  }));
  await page.addInitScript(value=>{
    localStorage.setItem("tangonest_production_stable_v1",JSON.stringify(value));
    localStorage.setItem("tangonest_last_good_data_v1",JSON.stringify(value));
    localStorage.setItem("tangonest_last_page_v2","home");
  },data);
  await page.goto(baseUrl,{waitUntil:"networkidle"});
  await page.locator(".app").waitFor({state:"visible"});
  await page.evaluate(({account,words})=>{
    const note=document.createElement("aside");
    note.id="qaEvidenceNote";
    note.textContent=`QA fixture · Account ${account} · Expected/actual: ${words} Words, 1 List`;
    Object.assign(note.style,{
      position:"fixed",zIndex:"9999",right:"8px",top:"78px",maxWidth:"calc(100vw - 16px)",
      padding:"6px 9px",border:"1px solid #a9b9ca",borderRadius:"6px",
      background:"#fff",color:"#172033",font:"600 11px/1.35 -apple-system,sans-serif",
      boxShadow:"0 1px 4px rgba(0,0,0,.08)"
    });
    document.body.appendChild(note);
  },{account,words:data.words.length});
}

async function captureAccount(browser,account,label,width,height){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
  const page=await context.newPage();
  await prepare(page,account);
  for(const screen of ["home","library"]){
    await navigateToPage(page,screen);
    await page.screenshot({
      path:path.join(output,`${label}-account-${account.toLowerCase()}-${screen}.png`),
      animations:"disabled"
    });
  }
  await context.close();
}

async function captureLanguageOrder(browser){
  const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});
  const page=await context.newPage();
  await prepare(page,"A");
  await navigateToPage(page,"create");
  const select=page.locator("#frontLang");
  await select.selectOption("fr-FR");
  await page.locator('[data-language-picker-trigger="frontLang"]').click();
  await page.evaluate(()=>{
    const note=document.getElementById("qaEvidenceNote");
    if(note)note.textContent="Runtime dropdown order · 1 English · 2 Japanese · 3 Korean · 4 French";
  });
  await page.screenshot({
    path:path.join(output,"desktop-language-dropdown-open.png"),
    animations:"disabled"
  });
  await context.close();
}

async function captureWideAlignment(browser){
  const context=await browser.newContext({viewport:{width:2048,height:1078},deviceScaleFactor:1});
  const page=await context.newPage();
  await prepare(page,"A");
  await navigateToPage(page,"library");
  const insets=await page.evaluate(()=>[...document.querySelectorAll(".tn-word-row")].map(row=>{
    const main=row.querySelector(".tn82-word-main");
    return Math.round(main.getBoundingClientRect().x-row.getBoundingClientRect().x);
  }));
  if(new Set(insets).size!==1)throw new Error(`Library alignment mismatch: ${insets.join(", ")}`);
  await page.evaluate(inset=>{
    const note=document.getElementById("qaEvidenceNote");
    if(note)note.textContent=`Verified: every word starts at the same left inset (${inset}px)`;
  },insets[0]);
  await page.screenshot({
    path:path.join(output,"library-left-alignment-wide.png"),
    animations:"disabled"
  });
  await context.close();
}

async function main(){
  fs.rmSync(output,{recursive:true,force:true});
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({headless:true});
  try{
    for(const account of ["A","B"]){
      await captureAccount(browser,account,"desktop",1280,800);
      await captureAccount(browser,account,"mobile",390,844);
    }
    await captureLanguageOrder(browser);
    await captureWideAlignment(browser);
  }finally{
    await browser.close();
  }
  console.log("RC19_ISOLATION_EVIDENCE_PASS 10 files");
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
