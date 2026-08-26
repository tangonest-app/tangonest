const {test,expect,installTestState}=require("./fixtures");

test.skip(({isMobile})=>isMobile,"desktop performance baseline");

for(const wordCount of [100,1000,5000]){
  test(`Library remains bounded with ${wordCount} words`,async({page})=>{
    await installTestState(page,{wordCount,pageName:"words"});
    const started=Date.now();
    await page.goto("/?qa=1");
    await expect(page.locator("#pageWords")).toHaveClass(/active/);
    const loadMs=Date.now()-started;
    const metrics=await page.evaluate(()=>({
      domNodes:document.getElementsByTagName("*").length,
      renderedRows:document.querySelectorAll(".tn-word-row").length,
      scrollWidth:document.documentElement.scrollWidth,
      viewportWidth:innerWidth
    }));
    expect(metrics.renderedRows).toBeLessThanOrEqual(200);
    expect(metrics.domNodes).toBeLessThan(5000);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(loadMs).toBeLessThan(5000);

    const searchStarted=Date.now();
    await page.locator("#tnLibrarySearch").fill(`word ${String(wordCount).padStart(5,"0")}`);
    await expect(page.locator(".tn-word-row")).toHaveCount(1);
    const searchMs=Date.now()-searchStarted;
    expect(searchMs).toBeLessThan(1500);
    console.log(JSON.stringify({wordCount,loadMs,searchMs,...metrics}));
  });
}
