const {test,expect,openTestApp,navigateToPage}=require('./fixtures');

async function setup(page,count=3){
  await openTestApp(page,{wordCount:12,listCount:2});await navigateToPage(page,'quiz');
  await page.locator('#quizType').selectOption('typing');await page.locator('#quizAudioAfter').selectOption('off');
  await page.locator('#quizAutoAdvance').selectOption('manual');await page.locator('#quizCount').fill(String(count));
  await page.locator('#quizOrderMode').selectOption('playlist');
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
}
const start=page=>page.locator('[onclick="startQuiz()"]').click();
async function answer(page,kind){await page.locator('#quizAnswer').fill(kind==='correct'?await page.evaluate(()=>correctAnswer()):kind==='incorrect'?'incorrect answer':'   ');await page.locator('#quizAnswer').press('Enter');}
async function next(page){await page.locator('.quiz-next-btn').click();await page.clock.runFor(400);}

test('a fast typed answer is accepted immediately after Next while repeated empty Enter cannot skip',async({page})=>{
  await setup(page);await start(page);await answer(page,'correct');await page.locator('.quiz-next-btn').click();
  await expect(page.locator('#quizAnswer')).toBeEditable();await page.locator('#quizAnswer').press('Enter');expect(await page.evaluate(()=>quiz.records.length)).toBe(1);
  await answer(page,'correct');expect(await page.evaluate(()=>quiz.records.map(quizRecordStatus))).toEqual(['correct','correct']);
  await page.locator('.quiz-next-btn').click();await page.locator('#quizAnswer').press('Enter');expect(await page.evaluate(()=>({index:quiz.index,records:quiz.records.length}))).toEqual({index:2,records:2});
});

test('every Quiz preference saves on change and restores after reload without starting a session',async({page})=>{
  await setup(page);
  const values={quizList:'qa-list-2',quizFrontLang:'en-US',quizBackLang:'ja-JP',quizScope:'mistakes',quizCount:'7',quizType:'typing',quizDirection:'front',quizOrderMode:'weak',quizAutoAdvance:'4',quizAudioAfter:'off',quizHardMode:'on',quizTimeLimit:'12',listeningDifficulty:'hard',listeningReplayLimit:'3',listeningTimerMode:'20',listeningHintMode:'on'};
  // Hidden listening controls are still the same real controls, changed through their change contract.
  await page.evaluate(values=>{for(const [id,value] of Object.entries(values)){const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}))}},values);
  expect(await page.evaluate(()=>quizSavedPreferences().settings)).toEqual(values);
  await page.reload();await navigateToPage(page,'quiz');
  expect(await page.evaluate(()=>captureQuizSettings())).toEqual(values);
  await page.locator('#quizType').selectOption('listening');
  await expect(page.locator('#listeningReplayLimit')).toHaveValue('3');await expect(page.locator('#listeningTimerMode')).toHaveValue('20');
  await page.locator('#listeningReplayLimit').selectOption('unlimited');await page.locator('#listeningTimerMode').selectOption('off');
  await page.reload();await navigateToPage(page,'quiz');await expect(page.locator('#listeningDifficulty')).toHaveValue('hard');
  await expect(page.locator('#listeningReplayLimit')).toHaveValue('unlimited');await expect(page.locator('#listeningTimerMode')).toHaveValue('off');
});

test('invalid deleted settings safely fall back and storage failures give feedback without erasing words',async({page})=>{
  await page.addInitScript(()=>{localStorage.setItem('tangonest_quiz_preferences_v1:qa',JSON.stringify({settings:{quizList:'deleted',quizFrontLang:'unknown',quizBackLang:'unknown',quizScope:'deleted',quizCount:'99999'},directions:{typing:'back'}}))});
  await openTestApp(page);await navigateToPage(page,'quiz');
  for(const id of ['quizList','quizFrontLang','quizBackLang','quizScope'])await expect(page.locator('#'+id)).toHaveValue('all');
  await expect(page.locator('#quizCount')).toHaveValue('300');
  const before=await page.evaluate(()=>JSON.stringify(db.words));
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('tangonest_quiz_preferences_'))throw new DOMException('Full','QuotaExceededError');return original.call(this,key,value)}});
  await page.locator('#quizCount').fill('8');await page.locator('#quizCount').dispatchEvent('change');
  await expect(page.locator('#toast')).toContainText('Settings');expect(await page.evaluate(()=>JSON.stringify(db.words))).toBe(before);
});

for(const kind of ['correct','incorrect','skipped'])test(`${kind} uses the common configured delay; immediate Next cancels old timers`,async({page})=>{
  await setup(page,4);await page.locator('#quizAutoAdvance').selectOption('1.5');await start(page);
  const before=await page.evaluate(()=>JSON.stringify({word:quiz.current,mistakes:db.mistakes}));
  await answer(page,kind);expect(await page.evaluate(()=>quizRecordStatus(quiz.records[0]))).toBe(kind);
  await expect(page.locator('#quizResult')).toContainText(await page.evaluate(()=>correctAnswer()));
  if(kind==='skipped')expect(await page.evaluate(()=>JSON.stringify({word:quiz.current,mistakes:db.mistakes}))).toBe(before);
  await page.clock.runFor(1400);expect(await page.evaluate(()=>quiz.index)).toBe(0);
  await page.clock.runFor(200);expect(await page.evaluate(()=>quiz.index)).toBe(1);await page.clock.runFor(400);await expect(page.locator('#quizAnswer')).toBeFocused();
  await answer(page,kind);await next(page);expect(await page.evaluate(()=>quiz.index)).toBe(2);
  await page.clock.runFor(2000);expect(await page.evaluate(()=>({index:quiz.index,records:quiz.records.length}))).toEqual({index:2,records:2});
});

for(const lang of ['zh-CN','zh-TW','en-US'])test(`registered ${lang} pronunciation and example match feedback and expandable Review snapshots`,async({page})=>{
  await setup(page,1);
  const reading=lang==='en-US'?'/rɪˈlaɪəbəl/':'zì dòng tí kuǎn jī',front=lang==='zh-TW'?'自動提款機':lang==='zh-CN'?'自动提款机':'reliable';
  await page.evaluate(({lang,reading,front})=>{Object.assign(db.words[0],{front,saved:false,frontLang:lang,pronunciation:reading,memo:lang==='en-US'?'A reliable friend.':'附近有自动提款机。'})},{lang,reading,front});
  await start(page);await answer(page,'skipped');
  await expect(page.locator('#quizResult .quiz-answer-pronunciation')).toContainText(reading);
  await expect(page.locator('#quizResult .quiz-answer-pronunciation')).toContainText(lang==='en-US'?'Pronunciation':'Pinyin');
  await expect(page.locator('#quizResult .quiz-answer-example')).toBeVisible();await next(page);
  const row=page.locator('.quiz-review-card');await expect(row).not.toHaveAttribute('open','');await expect(row.locator('summary')).toContainText(reading);
  await row.locator('summary').click();await expect(row.locator('.quiz-answer-pronunciation')).toContainText(reading);await expect(row.locator('.quiz-answer-example')).toBeVisible();
  await page.evaluate(()=>{db.words[0].pronunciation='edited';db.words[0].memo='edited example';renderWrongList()});
  await expect(row.locator('.quiz-answer-pronunciation')).toContainText(reading);await expect(row.locator('.quiz-answer-example')).not.toContainText('edited');
  await row.getByRole('button',{name:/Save$/}).click();await expect(row).toHaveAttribute('open','');await expect(row.getByRole('button',{name:'Saved',exact:true})).toBeVisible();
  await row.getByRole('button',{name:'Detail',exact:true}).click();await expect(page.locator('#detailModal')).toBeVisible();
});

test('missing pronunciation is never inferred, and Front IPA is not labelled as Back Pinyin',async({page})=>{
  await setup(page,1);await page.locator('#quizDirection').selectOption('front');
  await page.evaluate(()=>Object.assign(db.words[0],{front:'reliable',back:'可靠',frontLang:'en-US',backLang:'zh-CN',pronunciation:'/rɪˈlaɪəbəl/'}));
  await start(page);await answer(page,'correct');await expect(page.locator('#quizResult .quiz-answer-pronunciation')).toContainText('Front pronunciation');await expect(page.locator('#quizResult')).not.toContainText('Pinyin');
  await next(page);await page.locator('[onclick="resetQuiz()"]').click();await page.evaluate(()=>{delete db.words[0].pronunciation;delete db.words[0].pron;delete db.words[0].reading;delete db.words[0].pinyin});
  await start(page);await answer(page,'skipped');await expect(page.locator('#quizResult .quiz-answer-pronunciation')).toHaveCount(0);
});

test('Continue retains the selected pair and all settings, avoids previous words, and records separate sessions',async({page})=>{
  await setup(page,2);await page.locator('#quizList').selectOption('qa-list-1');await page.locator('#quizFrontLang').selectOption('en-US');await page.locator('#quizBackLang').selectOption('ja-JP');await start(page);
  const origin=await page.evaluate(()=>({ids:quiz.queue.map(w=>w.id),settings:quiz.settings,sessionId:quiz.sessionId}));
  await answer(page,'incorrect');await next(page);await answer(page,'skipped');await next(page);
  await page.locator('#quizRetryMistakes').click();expect(await page.evaluate(()=>quiz.total)).toBe(2);await answer(page,'correct');await next(page);await answer(page,'correct');await next(page);
  await page.locator('#quizContinue').click();
  const current=await page.evaluate(()=>({ids:quiz.queue.map(w=>w.id),settings:quiz.settings,sessionId:quiz.sessionId,records:quiz.records,score:quiz.score,history:getLastSession().quizResults}));
  expect(current.settings).toEqual(origin.settings);expect(current.ids).toHaveLength(2);expect(current.ids.some(id=>origin.ids.includes(id))).toBe(false);expect(current.sessionId).not.toBe(origin.sessionId);expect(current.records).toEqual([]);expect(current.score).toBe(0);
  expect(current.history).toHaveLength(2);expect(new Set(current.history.map(r=>r.sessionId)).size).toBe(2);expect(current.history[1].records.map(r=>r.status)).toEqual(['incorrect','skipped']);
});

test('all Review filters, Review All, Finish and return to setup keep their purpose',async({page})=>{
  await setup(page);await start(page);for(const kind of ['correct','incorrect','skipped']){await answer(page,kind);await next(page)}
  for(const filter of ['correct','incorrect','skipped']){await page.locator(`[data-quiz-review-filter="${filter}"]`).click();await expect(page.locator('.quiz-review-card')).toHaveCount(1);await expect(page.locator('.quiz-review-card')).toHaveAttribute('data-quiz-review-status',filter)}
  await page.locator('[onclick="reviewAllQuizAnswers()"]').click();await expect(page.locator('.quiz-review-card')).toHaveCount(3);
  await page.locator('[onclick="resetQuiz()"]').click();await expect(page.locator('#quizSetup')).toBeVisible();await expect(page.locator('#quizType')).toHaveValue('typing');
  await start(page);await answer(page,'skipped');await page.locator('#quizEndSession').click();await page.locator('#quizEnd [data-i18n="quiz.finish"]').click();await expect(page.locator('#pageHome')).toHaveClass(/active/);
});

test('same-account logout/login restores the complete preference set and keeps accounts isolated',async({page})=>{
  const fs=require('node:fs'),path=require('node:path');
  await page.route('**/vendor/supabase-*.js',route=>route.fulfill({contentType:'application/javascript',body:'window.supabase={};'}));
  await page.addInitScript({content:fs.readFileSync(path.join(__dirname,'cloud-fixture.js'),'utf8')+'\nif(!localStorage.getItem("tn-audit-cloud-fdg10")){__tnQA.seed("prefs-a@example.test",6);__tnQA.seed("prefs-b@example.test",6);}'});
  await page.goto('/');
  async function login(email){await page.locator('#authEmail').fill(email);await page.locator('#authPassword').fill('Audit-only-2026!');await page.locator('#loginButton').click();await expect(page.locator('#authScreen')).toBeHidden();await expect(page.locator('#wc')).toHaveText('6');await navigateToPage(page,'quiz')}
  async function logout(){await page.evaluate(()=>tnSupabaseClient.auth.signOut());await expect(page.locator('#authScreen')).toBeVisible()}
  await login('prefs-a@example.test');
  await page.locator('#quizType').selectOption('typing');await page.locator('#quizDirection').selectOption('front');await page.locator('#quizFrontLang').selectOption('en-US');await page.locator('#quizBackLang').selectOption('ja-JP');
  await page.locator('#quizList').selectOption(await page.evaluate(()=>db.lists[0].id));await page.locator('#quizCount').fill('4');await page.locator('#quizAutoAdvance').selectOption('manual');await page.locator('#quizAudioAfter').selectOption('off');await page.locator('#quizScope').selectOption('due');
  const original=await page.evaluate(()=>captureQuizSettings());
  await logout();await login('prefs-a@example.test');expect(await page.evaluate(()=>captureQuizSettings())).toEqual(original);
  await logout();await login('prefs-b@example.test');await expect(page.locator('#quizFrontLang')).toHaveValue('all');await expect(page.locator('#quizAutoAdvance')).toHaveValue('auto');await expect(page.locator('#quizCount')).toHaveValue('10');
  await page.locator('#quizType').selectOption('typing');await expect(page.locator('#quizDirection')).toHaveValue('back');
  await logout();await login('prefs-a@example.test');expect(await page.evaluate(()=>captureQuizSettings())).toEqual(original);
  expect(await page.evaluate(()=>({words:__tnQA.snapshot().tn_words.length,events:__tnQA.snapshot().tn_learning_events.length}))).toEqual({words:12,events:0});
});
