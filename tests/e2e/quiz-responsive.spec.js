const {test,expect,openTestApp,navigateToPage}=require('./fixtures');
const path=require('node:path');
const widths=[1440,1280,1024,834,768,430,390,375,320];
const languages=['en','ja','zh-Hans','zh-Hant','fr','ko','ar'];

async function noOverflow(page,label){
  const metric=await page.evaluate(()=>({width:innerWidth,content:document.documentElement.scrollWidth}));
  expect(metric.content,`${label}: no horizontal document overflow`).toBeLessThanOrEqual(metric.width);
}
for(const width of widths)for(const language of languages)test(`Quiz four states at ${width}px in ${language}`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:width>=768?900:844});await openTestApp(page);await navigateToPage(page,'quiz');
  await page.evaluate(async language=>{db.words.forEach((w,i)=>Object.assign(w,{front:i?'图书馆':'自动提款机',back:i?'Library':'Cash machine',frontLang:'zh-CN',backLang:'en-US',pronunciation:i?'tú shū guǎn':'zì dòng tí kuǎn jī',memo:'附近有自动提款机。'}));render();await TNI18n.setLocale(language)},language);
  await page.locator('#quizType').selectOption('typing');await page.locator('#quizAutoAdvance').selectOption('manual');await page.locator('#quizAudioAfter').selectOption('off');await page.locator('#quizCount').fill('3');
  await noOverflow(page,'setup');
  await page.locator('[onclick="startQuiz()"]').click();await expect(page.locator('#quizAnswer')).toBeFocused();await noOverflow(page,'question');
  await page.locator('#quizAnswer').fill(await page.evaluate(()=>correctAnswer()));await page.locator('#quizAnswer').press('Enter');await expect(page.locator('#quizResult')).toBeVisible();await noOverflow(page,'feedback');
  await expect(page.locator('#quizResult .quiz-answer-pronunciation')).toBeVisible();
  await page.locator('#quizEndSession').click();await noOverflow(page,'review');
  const row=page.locator('.quiz-review-card').first();expect((await row.boundingBox()).height).toBeLessThan(160);
  for(const id of ['quizContinue','quizRetryMistakes','quizReviewAll','quizFinish']){const button=page.locator('#'+id);if(await button.isVisible())expect((await button.boundingBox()).height,id+' touch height').toBeGreaterThanOrEqual(44)}
  if([390,834,1280].includes(width)&&['en','zh-Hans','ar'].includes(language))await page.screenshot({path:path.join('work','qa-fdg18',`${testInfo.project.name}-${language}-${width}-review.png`),fullPage:true});
  await row.locator('summary').click();await expect(row.locator('.quiz-answer-example')).toBeVisible();await noOverflow(page,'expanded review');
  await page.evaluate(()=>{const record=quiz.records[0];record.question='LongWord'.repeat(80);record.answer='繁體中文とالعربية '.repeat(35);record.selectedAnswer='Long incorrect answer '.repeat(50);renderWrongList()});
  await noOverflow(page,'long multilingual expanded review');
});

test('shrinking VisualViewport keeps normal typing focus and releases compact keyboard UI after blur',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>{const viewport=new EventTarget();Object.assign(viewport,{height:844,width:390,offsetTop:0,offsetLeft:0,scale:1});Object.defineProperty(window,'visualViewport',{configurable:true,value:viewport})});
  await openTestApp(page);await navigateToPage(page,'quiz');await page.locator('#quizType').selectOption('typing');await page.locator('[onclick="startQuiz()"]').click();await expect(page.locator('#quizAnswer')).toBeFocused();
  await page.evaluate(()=>{visualViewport.height=430;visualViewport.dispatchEvent(new Event('resize'))});
  await expect(page.locator('body')).toHaveClass(/tn-quiz-keyboard/);await expect(page.locator('.header')).toBeHidden();await expect(page.locator('.mobile-tabbar')).toBeHidden();await expect(page.locator('#quizAnswer')).toBeFocused();
  const box=await page.locator('#quizAnswer').boundingBox();expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(430);
  await page.locator('#quizEndSession').click();await expect(page.locator('body')).not.toHaveClass(/tn-quiz-keyboard/);await expect(page.locator('.header')).toBeVisible();
});
