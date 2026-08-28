const AxeBuilder=require("@axe-core/playwright").default;
const {test,expect,openTestApp,navigateToPage}=require("./fixtures");

async function expectNoSeriousViolations(page,label){
  const result=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze();
  const blocking=result.violations.filter(item=>item.impact==="critical"||item.impact==="serious");
  expect(blocking.map(item=>({id:item.id,impact:item.impact,nodes:item.nodes.map(node=>node.target)})),label).toEqual([]);
}

test("login screen has no serious axe violations",async({page})=>{
  await page.route("https://cdn.jsdelivr.net/**",route=>route.fulfill({status:200,contentType:"application/javascript",body:"window.supabase={};"}));
  await page.goto("/");
  await expect(page.locator("#authScreen")).toBeVisible();
  await expectNoSeriousViolations(page,"Login accessibility");
});

test("primary app screens have no serious axe violations",async({page})=>{
  await openTestApp(page);
  for(const name of ["home","create","library","cards","quiz","listen","settings"]){
    await navigateToPage(page,name);
    await expectNoSeriousViolations(page,`${name} accessibility`);
  }
});
