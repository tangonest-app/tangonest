const {test,expect}=require("@playwright/test");
const fs=require("node:fs"),path=require("node:path");
const fixture=fs.readFileSync(path.resolve(__dirname,"../../qa/cloud-fixture.js"),"utf8");
test.beforeEach(async({page})=>{
  await page.addInitScript({content:fixture+'\nif(!localStorage.getItem("tn-audit-cloud-fdg10"))window.__tnQA.seed("bulk@example.test",0);'});
  await page.route("**/vendor/supabase-*.js",route=>route.fulfill({contentType:"application/javascript",body:"window.supabase={};"}));
  await page.goto("/");
  await page.locator("#authEmail").fill("bulk@example.test");
  await page.locator("#authPassword").fill("Audit-only-2026!");
  await page.locator("#loginButton").click();
  await expect(page.locator("#authScreen")).toBeHidden();
  await page.evaluate(()=>window.tnStableNavigate("create"));
});
async function enter(page,count,prefix="entry"){
  await page.locator("#bulkFormat").selectOption("complete");
  await page.locator("#bulkText").fill(Array.from({length:count},(_,i)=>`${prefix} ${i}\t意味 ${i}\tnoun\t\tAn example.\t`).join("\n"));
}
async function confirm(page){
  await page.locator("#bulkRegisterBtn").click();
  await expect(page.locator("#bulkTargetConfirm")).toBeVisible();
  await page.locator("[data-bulk-approve]").click();
}
for(const count of [10,100,500,1000])test(`Bulk assistant imports and restores ${count} words`,async({page})=>{
  await enter(page,count);await confirm(page);
  await expect(page.locator("#wc")).toHaveText(String(count));
  await expect(page.locator("#bulkText")).toHaveValue("");
  await page.reload();await expect(page.locator("#authScreen")).toBeHidden();
  await expect(page.locator("#wc")).toHaveText(String(count));
  expect(await page.evaluate(()=>window.__tnQA.snapshot().tn_words.length)).toBe(count);
});
test("Invalid rows block import and stored HTML stays text",async({page})=>{
  await page.locator("#bulkText").fill("\tmissing front\tnoun\t\t\t");
  await page.getByRole("button",{name:"Preview",exact:true}).click();
  await expect(page.locator("#bulkPreview")).toContainText("Row 1");
  await expect(page.locator("#bulkRegisterBtn")).toBeDisabled();
  await page.locator("#bulkText").fill("<img src=x onerror=alert(1)>\tmeaning\tnoun\t\t\t");
  await page.getByRole("button",{name:"Preview",exact:true}).click();
  await expect(page.locator("#bulkPreview img")).toHaveCount(0);
});
test("Import controls remain reachable after the full preview",async({page})=>{
  await enter(page,1000);
  await page.getByRole("button",{name:"Preview",exact:true}).click();
  await page.locator("#bulkCard").evaluate(card=>window.scrollTo(0,card.offsetTop+card.offsetHeight-innerHeight));
  const bounds=await page.locator("#bulkRegisterBtn").boundingBox();
  const viewport=page.viewportSize();
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y+bounds.height).toBeLessThanOrEqual(viewport.height);
  await page.locator("#bulkRegisterBtn").click();
  await expect(page.locator("#bulkTargetConfirm")).toBeVisible();
});
test("Partial batch failure resumes after reload without duplicates",async({page})=>{
  await enter(page,600);
  await page.evaluate(()=>window.__tnQA.failBatch=2);await confirm(page);
  await expect(page.locator("#bulkRecovery")).toBeVisible();
  expect(await page.evaluate(()=>window.__tnQA.snapshot().tn_words.length)).toBe(250);
  await page.reload();await expect(page.locator("#authScreen")).toBeHidden();
  await page.evaluate(()=>window.tnStableNavigate("create"));
  await page.locator("[data-resume-bulk]").click();
  await page.locator("[data-bulk-approve]").click();
  await expect(page.locator("#wc")).toHaveText("600");
  expect(await page.evaluate(()=>new Set(window.__tnQA.snapshot().tn_words.map(word=>word.id)).size)).toBe(600);
});
