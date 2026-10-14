const {test,expect,openTestApp,navigateToPage}=require('./fixtures');

async function setup(page,count=3){
  await openTestApp(page);await navigateToPage(page,'quiz');
  await page.locator('#quizType').selectOption('typing');
  await page.locator('#quizAutoAdvance').selectOption('manual');
  await page.locator('#quizAudioAfter').selectOption('off');
  await page.locator('#quizOrderMode').selectOption('playlist');
  await page.locator('#quizCount').fill(String(count));
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
}
const start=page=>page.getByRole('button',{name:'Start Quiz',exact:true}).click();
async function answer(page,ok){await page.locator('#quizAnswer').fill(ok?await page.evaluate(()=>correctAnswer()):'my incorrect answer');await page.locator('#quizAnswer').press('Enter');}
async function next(page){await page.locator('#quizAnswer').press('Enter');await page.clock.runFor(400);}
async function skip(page){await page.locator('#quizSkipButton').click();await expect(page.locator('#quizResult')).toContainText('Skipped');await next(page);}

test('Typing defaults to Back to Front and explicit directions persist independently by format',async({page})=>{
  await openTestApp(page);await navigateToPage(page,'quiz');
  await expect(page.locator('#quizDirection')).toHaveValue('front');
  await page.locator('#quizType').selectOption('typing');await expect(page.locator('#quizDirection')).toHaveValue('back');
  await page.locator('#quizDirection').selectOption('front');
  await page.locator('#quizType').selectOption('choice');await expect(page.locator('#quizDirection')).toHaveValue('front');
  await page.locator('#quizDirection').selectOption('back');
  await page.locator('#quizType').selectOption('typing');await expect(page.locator('#quizDirection')).toHaveValue('front');
  await page.reload();await navigateToPage(page,'quiz');await expect(page.locator('#quizType')).toHaveValue('typing');await expect(page.locator('#quizDirection')).toHaveValue('front');
  await page.locator('#quizType').selectOption('choice');await expect(page.locator('#quizDirection')).toHaveValue('back');
});

test('legacy saved Typing direction is preserved rather than replaced by the new default',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('tangonest_learning_session_v1',JSON.stringify({quizType:'typing',quizDirection:'front',studyDefaultsVersion:'fdg15'})));
  await openTestApp(page);await navigateToPage(page,'quiz');await expect(page.locator('#quizDirection')).toHaveValue('front');
});

test('focus and Enter survive grading and Skip while IME and repeated Enter stay harmless',async({page})=>{
  await setup(page);await start(page);await expect(page.locator('#quizAnswer')).toBeFocused();
  await page.evaluate(()=>{window.learningCalls=[];window.tnRecordLearningResult=event=>learningCalls.push(event)});
  await page.locator('#quizAnswer').fill(await page.evaluate(()=>correctAnswer()));
  await page.locator('#quizAnswer').dispatchEvent('keydown',{key:'Enter',isComposing:true});expect(await page.evaluate(()=>quiz.answered)).toBe(false);
  await page.locator('#quizAnswer').press('Enter');
  await page.locator('#quizAnswer').dispatchEvent('keydown',{key:'Enter',repeat:true});expect(await page.evaluate(()=>quiz.index)).toBe(0);
  await next(page);await expect(page.locator('#quizAnswer')).toBeFocused();
  const before=await page.evaluate(()=>JSON.stringify(db.words.find(word=>word.id===quiz.current.id)));
  await skip(page);await expect(page.locator('#quizAnswer')).toBeFocused();
  expect(await page.evaluate(()=>db.words.find(word=>word.id===quiz.records[1].id).reviewCount)).toBe(JSON.parse(before).reviewCount+1);
  expect(await page.evaluate(()=>({statuses:quiz.records.map(quizRecordStatus),learningCalls:learningCalls.length,mistakeIds:quiz.allWrong.map(word=>word.id)}))).toEqual({statuses:['correct','incorrect'],learningCalls:2,mistakeIds:['qa-word-2']});
});

test('review keeps answer snapshots and Retry Mistakes then Continue retains the original full settings',async({page})=>{
  await setup(page);await start(page);
  const origin=await page.evaluate(()=>({...quiz.originSettings,queue:quiz.queue.map(word=>word.id)}));
  await answer(page,true);await next(page);await answer(page,false);await next(page);await skip(page);
  await expect(page.locator('#quizEnd')).toBeVisible();await expect(page.locator('#quizResultSummary')).toContainText('33%');
  await expect(page.locator('.quiz-review-card')).toHaveCount(3);
  await page.locator('[data-quiz-review-filter="incorrect"]').click();await expect(page.locator('.quiz-review-card')).toHaveCount(2);await expect(page.locator('.quiz-review-card').first()).toContainText('my incorrect answer');
  const snapshot=await page.evaluate(()=>quiz.records[1].answer);
  await page.evaluate(()=>{db.words.find(word=>word.id===quiz.records[1].id).front='Edited after answering';renderWrongList()});
  await expect(page.locator('.quiz-review-card').first()).toContainText(snapshot);
  await page.locator('#quizRetryMistakes').click();expect(await page.evaluate(()=>quiz.total)).toBe(2);await expect(page.locator('#quizAnswer')).toBeFocused();
  await answer(page,true);await next(page);await answer(page,true);await next(page);await expect(page.locator('#quizRetryMistakes')).toBeHidden();
  // Controls changed by another view must not replace the original session configuration.
  await page.evaluate(()=>{document.getElementById('quizCount').value='1';document.getElementById('quizDirection').value='front';Math.random=()=>.9999});
  await page.locator('#quizContinue').click();await expect(page.locator('#quizAnswer')).toBeFocused();
  const current=await page.evaluate(()=>({settings:quiz.originSettings,queue:quiz.queue.map(word=>word.id),total:quiz.total,direction:quiz.direction}));
  const {queue,...settings}=origin;expect(current.settings).toEqual(settings);expect(current.total).toBe(3);expect(current.queue).not.toEqual(queue);expect(current.direction).toBe('back');expect(new Set(current.queue).size).toBe(3);
});

test('all skipped questions are graded Wrong, update learning once, and are included in Retry Mistakes',async({page})=>{
  await setup(page);await start(page);const before=await page.evaluate(()=>JSON.stringify({words:db.words,mistakes:db.mistakes}));
  for(let i=0;i<3;i++)await skip(page);
  await expect(page.locator('#quizRetryMistakes')).toBeVisible();
  await expect(page.locator('#quizResultSummary')).toContainText('0%');await expect(page.locator('#quizResultSummary')).toContainText('3 answered / 3 planned');
  expect(await page.evaluate(()=>quiz.records.every(r=>r.status==='incorrect'&&r.skipped&&r.eventId))).toBe(true);expect(await page.evaluate(()=>db.words.slice(0,3).map(w=>w.reviewCount))).toEqual(JSON.parse(before).words.slice(0,3).map(w=>w.reviewCount+1));
  await page.locator('#quizRetryMistakes').click();expect(await page.evaluate(()=>quiz.total)).toBe(3);await expect(page.locator('#quizAnswer')).toBeFocused();
});

test('Continue shuffles even a two-word playlist, caps count and safely handles one or zero eligible words',async({page})=>{
  await setup(page,20);await page.evaluate(()=>{db.words.forEach((word,index)=>word.saved=index<2)});await page.locator('#quizScope').selectOption('star');await start(page);
  const before=await page.evaluate(()=>quiz.queue.map(word=>word.id));expect(before).toHaveLength(2);
  await page.locator('#quizEndSession').click();await page.locator('#quizContinue').click();
  const after=await page.evaluate(()=>quiz.queue.map(word=>word.id));expect(new Set(after)).toEqual(new Set(before));expect(after).not.toEqual(before);
  await page.evaluate(()=>{db.words.find(word=>word.id===quiz.queue[0].id).saved=false});await page.locator('#quizEndSession').click();await page.locator('#quizContinue').click();expect(await page.evaluate(()=>quiz.total)).toBe(1);
  await page.evaluate(()=>{db.words.forEach(word=>word.saved=false)});await page.locator('#quizEndSession').click();await page.locator('#quizContinue').click();await expect(page.locator('#quizEnd')).toBeVisible();await expect(page.locator('#toast')).toContainText('No words currently match');
});

test('saved checkpoints preserve Skip status and original settings without replaying learning updates',async({page})=>{
  await setup(page);await start(page);await answer(page,false);await next(page);await skip(page);
  await navigateToPage(page,'home');const before=await page.evaluate(()=>db.words.map(word=>word.reviewCount));
  await page.reload();await page.locator('.home-resume').click();
  expect(await page.evaluate(()=>quiz.records.map(quizRecordStatus))).toEqual(['incorrect','incorrect']);
  expect(await page.evaluate(()=>quiz.allWrong.map(word=>word.id))).toHaveLength(2);expect(await page.evaluate(()=>db.words.map(word=>word.reviewCount))).toEqual(before);
  await page.locator('#quizEndSession').click();await expect(page.locator('#quizResultSummary')).toContainText('0%');await expect(page.locator('#quizRetryMistakes')).toBeVisible();
  await page.locator('#quizContinue').click();expect(await page.evaluate(()=>({total:quiz.total,direction:quiz.direction,type:quiz.type}))).toEqual({total:3,direction:'back',type:'typing'});
});

test('review actions and long answers remain reachable above the phone navigation',async({page})=>{
  await setup(page,1);await page.setViewportSize({width:320,height:640});
  await page.evaluate(()=>{db.words[0].front='LongWord'.repeat(60);db.words[0].back='A long definition. '.repeat(20)});await start(page);await answer(page,false);await next(page);
  await expect(page.locator('#quizContinue')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(0);
  await page.locator('#quizContinue').scrollIntoViewIfNeeded();const box=await page.locator('#quizContinue').boundingBox();expect(box.y+box.height).toBeLessThan(640-60);
  await page.locator('#quizContinue').click();await expect(page.locator('#quizAnswer')).toBeFocused();
});

test('explicit Typing directions remain private to each account and survive logout',async({page})=>{
  const fs=require('node:fs'),path=require('node:path');
  await page.route('**/vendor/supabase-*.js',route=>route.fulfill({contentType:'application/javascript',body:'window.supabase={};'}));
  await page.addInitScript({content:fs.readFileSync(path.join(__dirname,'cloud-fixture.js'),'utf8')+'\nif(!localStorage.getItem("tn-audit-cloud-fdg10")){__tnQA.seed("owner-a@example.test",6);__tnQA.seed("owner-b@example.test",6);}'});
  await page.goto('/');
  async function login(email){
    await page.locator('#authEmail').fill(email);await page.locator('#authPassword').fill('Audit-only-2026!');await page.locator('#loginButton').click();
    await expect(page.locator('#authScreen')).toBeHidden();await expect(page.locator('#wc')).toHaveText('6');
    await navigateToPage(page,'quiz');await page.locator('#quizType').selectOption('typing');
  }
  async function logout(){await page.evaluate(()=>tnSupabaseClient.auth.signOut());await expect(page.locator('#authScreen')).toBeVisible();}
  await login('owner-a@example.test');await expect(page.locator('#quizDirection')).toHaveValue('back');await page.locator('#quizDirection').selectOption('front');
  await logout();await login('owner-b@example.test');await expect(page.locator('#quizDirection')).toHaveValue('back');await page.locator('#quizDirection').selectOption('back');
  await logout();await login('owner-a@example.test');await expect(page.locator('#quizDirection')).toHaveValue('front');
  expect(await page.evaluate(()=>({words:__tnQA.snapshot().tn_words.length,events:__tnQA.snapshot().tn_learning_events.length}))).toEqual({words:12,events:0});
});
