const {test,expect,openTestApp,navigateToPage}=require('./fixtures');

async function chinese(page){
  await openTestApp(page);
  await page.evaluate(()=>{Object.assign(db.words[0],{front:'首都',back:'首都',frontLang:'zh-CN',tags:'travel',memo:'北京是中国的首都。'});persist();render();});
}
async function editFirst(page){
  await navigateToPage(page,'library');
  await page.locator('[data-open-word="qa-word-1"]').click();
  await page.locator('[data-detail-edit="qa-word-1"]').click();
  await expect(page.locator('#editModal')).toBeVisible();
}

test('optional Pinyin saves, edits, reloads, clears, and preserves all other word data',async({page},testInfo)=>{
  await chinese(page);
  const before=await page.evaluate(()=>structuredClone(db.words));
  await editFirst(page);
  await expect(page.locator('#editPronunciationSection')).toHaveAttribute('open','');
  await expect(page.getByLabel('Pinyin / Pronunciation',{exact:true})).toHaveValue('');
  await page.locator('#editPronunciation').fill('shǒudū');
  await page.locator('#editModal [onclick="saveEdit()"]').click();
  expect(await page.evaluate(()=>({word:db.words[0]}))).toMatchObject({word:{frontLang:'zh-CN',pronunciation:'shǒudū'}});
  await expect(page.locator('[data-word-id="qa-word-1"] .tn-word-pinyin')).toHaveText('shǒudū');
  const after=await page.evaluate(()=>structuredClone(db.words));
  expect(after.map(w=>{const {pronunciation,...rest}=w;return {...rest,gender:rest.gender||""}})).toEqual(before.map(w=>{const {pronunciation,...rest}=w;return {...rest,gender:rest.gender||""}}));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(0);
  await page.screenshot({path:testInfo.outputPath('library-pinyin.png')});
  await page.reload();await editFirst(page);await expect(page.locator('#editPronunciation')).toHaveValue('shǒudū');
  await page.locator('#editPronunciation').fill('shǒu dū');await page.locator('#editModal [onclick="saveEdit()"]').click();
  await editFirst(page);await expect(page.locator('#editPronunciation')).toHaveValue('shǒu dū');
  await expect(page.locator("#editModal .modal")).toHaveCSS("overflow-y","auto");
  if(testInfo.project.name==="mobile"&&await page.locator(".mobile-add-button").isVisible())expect(await page.locator(".mobile-add-button").evaluate(button=>{const r=button.getBoundingClientRect();return !!document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest("#editModal")})).toBe(true);
  await page.screenshot({path:testInfo.outputPath('edit-pinyin.png')});
  await page.locator('#editPronunciation').fill('');await page.locator('#editModal [onclick="saveEdit()"]').click();
  await page.reload();await editFirst(page);await expect(page.locator('#editPronunciation')).toHaveValue('');
});

test('legacy Pinyin remains editable; empty non-Chinese fields are discreet and optional',async({page})=>{
  await chinese(page);await page.evaluate(()=>{db.words[0].pinyin='shǒudū';delete db.words[0].pronunciation;render();});
  await editFirst(page);await expect(page.locator('#editPronunciation')).toHaveValue('shǒudū');
  await page.locator('#editPronunciation').fill('');await page.locator('#editModal [onclick="saveEdit()"]').click();
  await page.reload();await editFirst(page);await expect(page.locator('#editPronunciation')).toHaveValue('');
  await page.locator('#editModal [onclick="closeEdit()"]').click();
  await page.evaluate(()=>{closeDetail();openEdit('qa-word-2');});
  await expect(page.locator('#editPronunciationSection')).not.toHaveAttribute('open','');
  await page.locator('#editModal [onclick="saveEdit()"]').click();
  expect(await page.evaluate(()=>db.words.length)).toBe(6);
});

for(const direction of ['front','back'])for(const kind of ['correct','incorrect','skipped'])test(`${direction} ${kind}: post-answer Pinyin, grade, history and retry`,async({page},testInfo)=>{
  await chinese(page);await page.evaluate(()=>{db.words[0].pronunciation='shǒudū';});
  await navigateToPage(page,'quiz');await page.locator('#quizType').selectOption('typing');
  await page.locator('#quizDirection').selectOption(direction);await page.locator('#quizOrderMode').selectOption('playlist');
  await page.locator('#quizCount').fill('1');await page.locator('#quizAudioAfter').selectOption('off');await page.locator('#quizAutoAdvance').selectOption('manual');
  await page.locator('[onclick="startQuiz()"]').click();
  await expect(page.locator('#quizRun')).not.toContainText('shǒudū');
  const before=await page.evaluate(()=>db.words[0].wrongCount);
  if(kind==='skipped')await page.locator('#quizSkipButton').click();else {await page.locator('#quizAnswer').fill(kind==='correct'?'首都':'wrong');await page.locator('#quizAnswer').press('Enter');}
  await expect(page.locator('#quizResult .quiz-answer-pronunciation')).toContainText('shǒudū');
  await page.evaluate(()=>{finishAnswer(false,'skipped');nextQuizQuestion(true);});
  expect(await page.evaluate(()=>quiz.records.length)).toBe(1);
  expect(await page.evaluate(()=>db.words[0].wrongCount)).toBe(before+(kind==='correct'?0:1));
  const record=await page.evaluate(()=>quiz.records[0]);expect(record.status).toBe(kind==='correct'?'correct':'incorrect');expect(record.skipped).toBe(kind==='skipped');expect(record.eventId).toBeTruthy();
  await page.screenshot({path:testInfo.outputPath('quiz-pinyin-feedback.png')});
  await page.locator('.quiz-next-btn').click();
  await expect(page.locator('#quizResultSummary')).toContainText(kind==='correct'?'100%':'0%');
  await expect(page.locator('.quiz-review-card summary')).toContainText('shǒudū');
  expect(await page.evaluate(()=>getLastSession().quizResults[0].records[0].status)).toBe(record.status);
  if(kind!=='correct'){
    await page.locator('[data-quiz-review-filter="incorrect"]').click();await expect(page.locator('.quiz-review-card')).toHaveCount(1);
    await page.locator('#quizRetryMistakes').click();expect(await page.evaluate(()=>quiz.queue.map(w=>w.id))).toEqual(['qa-word-1']);
  }
});

test('Chinese listening hint cannot leak Pinyin before Skip, including when preference is on',async({page})=>{
  await chinese(page);await page.evaluate(()=>{db.words[0].pronunciation='shǒudū';});
  await navigateToPage(page,'quiz');await page.locator('#quizType').selectOption('listening');
  await page.locator('#quizOrderMode').selectOption('playlist');await page.locator('#listeningHintMode').selectOption('on');
  await page.locator('#quizAudioAfter').selectOption('off');await page.locator('#quizAutoAdvance').selectOption('manual');
  await page.locator('[onclick="startQuiz()"]').click();await expect(page.locator('#quizRun')).not.toContainText('shǒudū');
  await page.locator('#quizSkipButton').click();await expect(page.locator('#quizResult')).toContainText('shǒudū');
  expect(await page.evaluate(()=>quiz.records[0].status)).toBe('incorrect');await expect(page.locator('#listeningHintMode')).toHaveValue('on');
});

test('authenticated cloud edit preserves pronunciation after reload and sends a single Skip learning event',async({page})=>{
  const fs=require('node:fs'),path=require('node:path');
  await page.route('**/vendor/supabase-*.js',route=>route.fulfill({contentType:'application/javascript',body:'window.supabase={};'}));
  await page.addInitScript({content:fs.readFileSync(path.join(__dirname,'cloud-fixture.js'),'utf8')+'\nif(!localStorage.getItem("tn-audit-cloud-fdg10"))__tnQA.seed("pinyin@example.test",3);'});
  await page.goto('/');await page.locator('#authEmail').fill('pinyin@example.test');await page.locator('#authPassword').fill('Audit-only-2026!');await page.locator('#loginButton').click();
  await expect(page.locator('#wc')).toHaveText('3');await navigateToPage(page,'library');
  await page.locator('[data-open-word]').first().click();await page.locator('[data-detail-edit]').click();
  await page.locator('#editFront').fill('首都');await page.locator('#editBack').fill('首都');
  const {selectLanguage}=require('./fixtures');await selectLanguage(page,'editFrontLang','zh-CN');
  await page.locator('#editPronunciation').fill('shǒudū');
  await page.locator('#editModal [onclick="saveEdit()"]').click();await expect(page.locator('.tn-word-pinyin')).toHaveText('shǒudū');
  expect(await page.evaluate(()=>__tnQA.snapshot().tn_words.find(w=>w.front==='首都').pronunciation)).toBe('shǒudū');
  await page.reload();await expect(page.locator('#wc')).toHaveText('3');await navigateToPage(page,'library');await expect(page.locator('.tn-word-pinyin')).toHaveText('shǒudū');
  await navigateToPage(page,'quiz');await page.locator('#quizAutoAdvance').selectOption('manual');await page.locator('#quizAudioAfter').selectOption('off');
  await page.evaluate(()=>{window.learningEvents=[];const send=window.tnRecordLearningResult;window.tnRecordLearningResult=event=>{learningEvents.push(event);return send(event);};});
  await page.locator('[onclick="startQuiz()"]').click();await page.locator('#quizSkipButton').click();await page.evaluate(()=>{finishAnswer(false,'skipped');nextQuizQuestion(true);});
  expect(await page.evaluate(()=>learningEvents.map(e=>e.rating))).toEqual(['again']);
  await expect.poll(()=>page.evaluate(()=>__tnQA.calls.filter(call=>call.rpc==='tn_record_learning_result').length)).toBe(1);
  expect(await page.evaluate(()=>__tnQA.snapshot().tn_words.length)).toBe(3);
});

test('Pinyin keeps Library search, sort and language filters intact',async({page})=>{
  await chinese(page);await page.evaluate(()=>{db.words[0].pronunciation='shǒudū';render();});await navigateToPage(page,'library');
  await page.locator('#tnLibrarySearch').fill('首都');await expect(page.locator('.tn-word-list-row')).toHaveCount(1);await expect(page.locator('.tn-word-pinyin')).toHaveText('shǒudū');
  await page.locator('#tnLibrarySearch').fill('');await expect(page.locator('.tn-word-list-row')).toHaveCount(6);
  await page.locator('.tn-library-filter-panel summary').click();await page.locator('#tnSortWords').selectOption('front');
  await page.locator('#tnFilterLanguage').selectOption('zh-CN');await expect(page.locator('.tn-word-list-row')).toHaveCount(1);await expect(page.locator('.tn-word-pinyin')).toHaveText('shǒudū');
  await page.locator('#tnFilterLanguage').selectOption('all');await expect(page.locator('.tn-word-list-row')).toHaveCount(6);
});

test('multiple choice Skip records Wrong once, reveals Pinyin and advances to a different question',async({page})=>{
  await chinese(page);await page.evaluate(()=>{db.words[0].pronunciation='shǒudū';});await navigateToPage(page,'quiz');
  await page.locator('#quizType').selectOption('choice');await page.locator('#quizOrderMode').selectOption('playlist');await page.locator('#quizCount').fill('2');
  await page.locator('#quizAutoAdvance').selectOption('manual');await page.locator('#quizAudioAfter').selectOption('off');
  await page.locator('[onclick="startQuiz()"]').click();await expect(page.locator('#quizRun')).not.toContainText('shǒudū');
  const first=await page.evaluate(()=>quiz.current.id);await page.locator('#quizSkipButton').click();
  await expect(page.locator('#quizResult')).toContainText('shǒudū');await page.evaluate(()=>nextQuizQuestion(true));expect(await page.evaluate(()=>quiz.records.length)).toBe(1);
  await page.locator('.quiz-next-btn').click();expect(await page.evaluate(()=>quiz.current.id)).not.toBe(first);
  await page.locator('#quizEndSession').click();await expect(page.locator('#quizResultSummary')).toContainText('0%');
  await page.locator('[data-quiz-review-filter="incorrect"]').click();await expect(page.locator('.quiz-review-card')).toHaveCount(1);
});
