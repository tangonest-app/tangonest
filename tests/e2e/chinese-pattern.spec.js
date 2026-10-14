const {test,expect,openTestApp,navigateToPage}=require('./fixtures');
async function setup(page){
 await page.addInitScript(()=>{
   window.patternUtterances=[];window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
   Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>['zh-CN','fr-FR','ja-JP','en-US'].map(lang=>({name:lang,lang,voiceURI:lang,localService:true})),addEventListener(){},removeEventListener(){},cancel(){},speak(u){patternUtterances.push({text:u.text,lang:u.lang});setTimeout(()=>u.onend?.(),0)}}});
 });
 await openTestApp(page);await page.evaluate(()=>{Object.assign(db.words[0],{front:'因为～所以',back:'〜なので、〜だから',frontLang:'zh-CN',pronunciation:'yīnwèi suǒyǐ',memo:'因为下雨，所以我没出门。'});shareDb();render();});
}
test('Chinese speech normalizes all three separators without changing originals or French speech',async({page})=>{
 await setup(page);const original=await page.evaluate(()=>JSON.stringify(db));
 const utterances=await page.evaluate(async()=>{for(const symbol of ['～','〜','~'])await speakText(`因为${symbol}所以`,'zh-CN',{strict:true});await speakText('A~B','fr-FR',{strict:true});return patternUtterances;});
 expect(utterances).toEqual([{text:'因为 所以',lang:'zh-CN'},{text:'因为 所以',lang:'zh-CN'},{text:'因为 所以',lang:'zh-CN'},{text:'A~B',lang:'fr-FR'}]);
 expect(await page.evaluate(()=>JSON.stringify(db))).toBe(original);
 expect(await page.evaluate(()=>tnChinesePatternText('一边～一边〜越~越'))).toBe('一边 一边 越 越');
});
test('pattern Pinyin appears in Library and Edit and only after a Quiz answer',async({page})=>{
 await setup(page);await navigateToPage(page,'library');await expect(page.locator('[data-word-id="qa-word-1"] .tn-word-pinyin')).toHaveText('yīnwèi suǒyǐ');
 await page.locator('[data-open-word="qa-word-1"]').click();await page.locator('[data-detail-edit="qa-word-1"]').click();await expect(page.locator('#editFront')).toHaveValue('因为～所以');await expect(page.locator('#editPronunciation')).toHaveValue('yīnwèi suǒyǐ');await page.locator('#editModal [onclick="closeEdit()"]').click();await page.evaluate(()=>closeDetail());
 await navigateToPage(page,'quiz');await page.locator('#quizType').selectOption('typing');await page.locator('#quizOrderMode').selectOption('playlist');await page.locator('#quizCount').fill('1');await page.locator('#quizAudioAfter').selectOption('off');await page.locator('#quizAutoAdvance').selectOption('manual');await page.locator('[onclick="startQuiz()"]').click();
 await expect(page.locator('#quizRun')).not.toContainText('yīnwèi suǒyǐ');await page.locator('#quizSkipButton').click();await expect(page.locator('#quizResult .quiz-answer-pronunciation')).toContainText('yīnwèi suǒyǐ');expect(await page.evaluate(()=>db.words[0].front)).toBe('因为～所以');
});
test('Flashcards still display and flip Chinese patterns without editing their text',async({page})=>{
 await setup(page);await page.evaluate(()=>{db.words=[db.words[0]];shareDb();render();});await navigateToPage(page,'cards');await page.evaluate(()=>{document.getElementById('studyMode').value='front';nextCard();});
 await expect(page.locator('#frontWord')).toHaveText('因为～所以');await page.evaluate(()=>flipCard());await expect(page.locator('#flash')).toHaveClass(/is-flipped/);await expect(page.locator('#backWord')).toHaveText('〜なので、〜だから');expect(await page.evaluate(()=>db.words[0].pronunciation)).toBe('yīnwèi suǒyǐ');
});
