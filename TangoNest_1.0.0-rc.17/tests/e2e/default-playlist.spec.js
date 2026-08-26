const {test,expect}=require("./fixtures");

async function readState(page){
  return page.evaluate(()=>{
    const data=window.tnGetDb?.()||window.db||{};
    const lists=Array.isArray(data.lists)?data.lists:[];
    const words=Array.isArray(data.words)?data.words:[];
    return {
      words:words.length,
      lists:lists.length,
      names:lists.map(list=>list.name),
      defaults:lists.filter(list=>window.tnIsDefaultList?.(list)||list.isDefault).length
    };
  });
}

test("empty state remains zero words and one My Words list across ten reloads",async({page})=>{
  await page.route("https://cdn.jsdelivr.net/**",route=>route.fulfill({status:200,contentType:"application/javascript",body:"window.supabase={};"}));
  await page.goto("/?qa=1");
  await expect(page.locator("#pageHome")).toHaveClass(/active/);

  for(let index=0;index<10;index++){
    const state=await readState(page);
    expect(state,`reload ${index+1}`).toEqual({words:0,lists:1,names:["My Words"],defaults:1});
    await page.reload();
    await expect(page.locator("#pageHome")).toHaveClass(/active/);
  }
});
