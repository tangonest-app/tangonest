const {test,expect,openTestApp,navigateToPage}=require('./fixtures');

for(const width of [320,390,820,1280]){
  test(`brand and navigation icons keep their proportions at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});await openTestApp(page);
    const logo=page.locator(width>860?'.app-sidebar .brand-mark':'.mobile-brand .brand-mark');
    await expect(logo).toBeVisible();
    const dimensions=await logo.evaluate(node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return{width:r.width,height:r.height,shrink:s.flexShrink,background:s.backgroundImage}});
    expect(dimensions).toEqual({width:width>860?44:36,height:width>860?44:36,shrink:'0',background:'none'});
    if(width>860){
      const icons=await page.locator('.tn-nav-icon').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect(),b=n.closest('button').getBoundingClientRect();return{w:r.width,h:r.height,delta:Math.abs((r.left+r.right-b.left-b.right)/2),buttonHeight:b.height}}));
      for(const icon of icons){expect(icon.w).toBe(24);expect(icon.h).toBe(24);expect(icon.delta).toBeLessThan(1);expect(icon.buttonHeight).toBeGreaterThanOrEqual(44)}
    }
    for(const icon of await page.locator('.tn-desk-destinations img').all()){
      const box=await icon.boundingBox();expect(box.width).toBe(28);expect(box.height).toBe(28);
    }
    await navigateToPage(page,'quiz');await expect(page.locator('#quizOrderMode')).toHaveValue('random');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });

  test(`login logo does not shrink beside its title at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});await page.goto('/');await expect(page.locator('#authScreen')).toBeVisible();
    const box=await page.locator('.auth-logo').boundingBox();expect(box.width).toBe(52);expect(box.height).toBe(52);
    await page.locator('.auth-title').evaluate(node=>node.style.fontSize='42px');
    const enlarged=await page.locator('.auth-logo').boundingBox();expect(enlarged.width).toBe(52);expect(enlarged.height).toBe(52);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}
