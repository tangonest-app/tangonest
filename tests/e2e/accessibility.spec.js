const AxeBuilder=require("@axe-core/playwright").default;
const {test,expect,openTestApp,navigateToPage}=require("./fixtures");

async function expectNoSeriousViolations(page,label){
  const result=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze();
  const blocking=result.violations.filter(item=>item.impact==="critical"||item.impact==="serious");
  expect(blocking.map(item=>({id:item.id,impact:item.impact,nodes:item.nodes.map(node=>({target:node.target,reason:node.failureSummary}))})),label).toEqual([]);
}

test("login screen has no serious axe violations",async({page})=>{
  await page.route("**/vendor/supabase-*.js",route=>route.fulfill({status:200,contentType:"application/javascript",body:"window.supabase={};"}));
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

test("navigation keeps text opaque throughout the page transition",async({page})=>{
  await openTestApp(page);
  const frames=await page.evaluate(()=>{
    const section=document.querySelector('.page.active');
    TangoNestMotion.enter(section);
    const animation=section.getAnimations()[0];
    if(!animation)throw new Error('Expected the normal navigation transition');
    animation.pause();
    const duration=animation.effect.getComputedTiming().duration;
    const samples=[0,.5,1].map(progress=>{animation.currentTime=duration*progress;return getComputedStyle(section).opacity});
    animation.cancel();return samples;
  });
  expect(frames).toEqual(['1','1','1']);
});
