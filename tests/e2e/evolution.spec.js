const {test,expect,openTestApp,navigateToPage}=require('./fixtures');

async function setupQuiz(page,count=3){
  await openTestApp(page);
  await navigateToPage(page,'quiz');
  await page.locator('#quizCount').fill(String(count));
  await page.locator('#quizAudioAfter').selectOption('off');
  await page.locator('#quizOrderMode').selectOption('playlist');
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.getByRole('button',{name:'Start Quiz',exact:true}).click();
  await page.clock.runFor(400);
}
async function answer(page,ok){
  const value=await page.evaluate(ok=>ok?correctAnswer():quiz.currentChoices.find(value=>value!==correctAnswer()),ok);
  await page.getByRole('button',{name:new RegExp('^[1-4]\\. '+value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')}).click();
  await page.clock.runFor(40);
}

test('automatic session finishes mixed answers without Next and records each once',async({page})=>{
  await setupQuiz(page);
  await page.evaluate(()=>{window.events=[];window.tnRecordLearningResult=event=>events.push(event)});
  await page.clock.runFor(10000);
  expect(await page.evaluate(()=>quiz.index)).toBe(0);
  for(const ok of [true,false,true]){
    await answer(page,ok);
    await expect(page.locator('.quiz-next-btn')).toHaveCount(1);
    const index=await page.evaluate(()=>quiz.index);
    await page.clock.runFor(1900);
    expect(await page.evaluate(()=>quiz.index)).toBe(index);
    await page.clock.runFor(140);
    await page.clock.runFor(400);
  }
  await expect(page.locator('#quizEnd')).toBeVisible();
  expect(await page.evaluate(()=>({score:quiz.score,records:quiz.records.length,events:events.length,unique:new Set(events.map(event=>event.eventId)).size}))).toEqual({score:2,records:3,events:3,unique:3});
  await expect(page.locator('#quizResultSummary')).toContainText('67%');
});

test('feedback delay remains authoritative when automatic speech stalls and stale callbacks cannot advance',async({page})=>{
  await setupQuiz(page);
  await page.evaluate(()=>{document.getElementById('quizAudioAfter').value='on';window.speak=()=>new Promise(resolve=>window.finishSpeech=resolve)});
  await answer(page,true);await page.clock.runFor(2300);
  expect(await page.evaluate(()=>quiz.index)).toBe(1);
  await page.evaluate(()=>finishSpeech(true));
  expect(await page.evaluate(()=>quiz.index)).toBe(1);
  await page.clock.runFor(400);await answer(page,false);
  await page.evaluate(()=>{finishSpeech(true);finishSpeech(true)});
  await page.clock.runFor(1900);expect(await page.evaluate(()=>quiz.index)).toBe(1);
  await page.clock.runFor(500);expect(await page.evaluate(()=>quiz.index)).toBe(2);
});

test('unresponsive automatic speech does not stall learning',async({page})=>{
  await setupQuiz(page);
  await page.evaluate(()=>{document.getElementById('quizAudioAfter').value='on';window.speak=()=>new Promise(()=>{})});
  await answer(page,true);await page.clock.runFor(2400);expect(await page.evaluate(()=>quiz.index)).toBe(1);
});

test('pause and tab hiding require deliberate resume with fresh reading time',async({page})=>{
  await setupQuiz(page);
  await answer(page,true);
  await expect(page.locator('.quiz-answer-example')).toBeVisible();
  await page.locator('#quizPauseAdvance').click();
  await expect.poll(()=>page.evaluate(()=>quizFeedback.paused)).toBe(true);
  await page.clock.runFor(5000);
  expect(await page.evaluate(()=>quiz.index)).toBe(0);
  await expect(page.locator('#quizPauseAdvance')).toHaveText('Resume');
  await page.locator('#quizPauseAdvance').click();await page.clock.runFor(600);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});
  await page.clock.runFor(9000);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))});
  await page.clock.runFor(5000);expect(await page.evaluate(()=>quiz.index)).toBe(0);
  await page.locator('#quizPauseAdvance').click();await page.clock.runFor(1900);
  expect(await page.evaluate(()=>quiz.index)).toBe(0);
  await page.clock.runFor(150);expect(await page.evaluate(()=>quiz.index)).toBe(1);
});

test('old buttons and held keys cannot answer the following question',async({page})=>{
  await setupQuiz(page);
  await page.evaluate(()=>window.oldChoice=document.querySelector('.choice'));
  await answer(page,true);await page.clock.runFor(2020);
  await page.evaluate(()=>{oldChoice.click();chooseAnswer(oldChoice,'stale')});
  await page.locator('body').dispatchEvent('keydown',{key:'1',repeat:true});
  expect(await page.evaluate(()=>({index:quiz.index,answered:quiz.answered,records:quiz.records.length}))).toEqual({index:1,answered:false,records:1});
});

test('early results count answered questions, never untouched words as improved',async({page})=>{
  await setupQuiz(page,6);
  await page.getByRole('button',{name:'End session',exact:true}).click();
  await expect(page.locator('#quizResultSummary')).toContainText('0 answered / 6 planned');
  await expect(page.locator('#quizResultSummary')).not.toContainText('100%');
  await page.evaluate(()=>{startQuiz();document.getElementById('quizAudioAfter').value='off'});await page.clock.runFor(400);
  await answer(page,true);await page.clock.runFor(2400);await answer(page,false);
  await page.getByRole('button',{name:'End session',exact:true}).click();
  await expect(page.locator('#quizResultSummary')).toContainText('50%');
  await expect(page.locator('#quizResultSummary')).toContainText('2 answered / 6 planned');
});

test('Home resumes the next unanswered word after reload without resaving a result',async({page})=>{
  await setupQuiz(page);await answer(page,true);
  await navigateToPage(page,'home');
  await page.reload();
  await expect(page.locator('#homeResumeContext')).toContainText('Question 2 / 3');
  const before=await page.evaluate(()=>db.words.map(word=>word.reviewCount));
  await page.locator('.home-resume').click();
  expect(await page.evaluate(()=>({index:quiz.index,records:quiz.records.length}))).toEqual({index:1,records:1});
  expect(await page.evaluate(()=>db.words.map(word=>word.reviewCount))).toEqual(before);
});

test('Home does not resume a completed, foreign-account or changed session',async({page})=>{
  await setupQuiz(page,1);await answer(page,true);await page.clock.runFor(2300);
  await navigateToPage(page,'home');await expect(page.locator('.home-resume')).toBeHidden();
  await navigateToPage(page,'cards');await navigateToPage(page,'home');
  await page.evaluate(()=>{db.words=[];tnStudyContinuity.render()});
  await expect(page.locator('#homeResumeContext')).toContainText('changed');
  await page.evaluate(()=>{db.meta.userId='another-account';tnStudyContinuity.enter('home')});
  await expect(page.locator('.home-resume')).toBeHidden();
});

test('Cards prepare the first word, reveal upright text, and rate exactly once',async({page})=>{
  await openTestApp(page);await navigateToPage(page,'cards');
  await expect(page.locator('#frontWord')).not.toHaveText('---');
  await expect(page.locator('.tn-card-rating button').first()).toBeDisabled();
  const before=await page.evaluate(()=>current.reviewCount);
  await page.locator('#flash').click();
  await expect(page.locator('.tn-card-rating button').first()).toBeEnabled();
  expect(await page.locator('#flash').evaluate(el=>getComputedStyle(el).transform)).toBe('none');
  await page.evaluate(()=>{markCard('good');markCard('good')});
  expect(await page.evaluate(()=>current.reviewCount)).toBe(before+1);
  await expect(page.locator('.tn-card-rating button').first()).toBeDisabled();
});

test('Library search keeps focus and caret while the desktop detail is open',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await openTestApp(page);
  await navigateToPage(page,'library');
  await page.locator('[data-open-word]').first().click();
  const search=page.locator('#tnLibrarySearch');
  await search.fill('ser');
  await search.evaluate(input=>input.setSelectionRange(1,1));
  await page.waitForTimeout(300);
  await expect(search).toBeFocused();
  expect(await search.evaluate(input=>input.selectionStart)).toBe(1);
});

test('Library detail returns to the same search and focus through browser Back',async({page})=>{
  await openTestApp(page);await navigateToPage(page,'library');
  await page.locator('#tnLibrarySearch').fill('serendipity');
  const row=page.locator('[data-open-word]').first();await row.click();
  await expect(page.locator('#tnWordDetailPanel')).toBeVisible();
  await page.goBack();await expect(page.locator('#tnWordDetailPanel')).toBeHidden();
  await expect(page.locator('#tnLibrarySearch')).toHaveValue('serendipity');
  await expect(row).toBeFocused();
});

test('Bulk Add issues jump to their original row and editing invalidates preview',async({page})=>{
  await openTestApp(page);await navigateToPage(page,'create');
  await page.locator('#bulkText').fill('apple\tりんご\nmissing');
  await page.evaluate(()=>previewBulk());
  await page.getByRole('button',{name:/Edit row 2/}).click();
  expect(await page.locator('#bulkText').evaluate(el=>el.value.slice(el.selectionStart,el.selectionEnd))).toBe('missing');
  await page.locator('#bulkText').fill('apple\tりんご\npear\tなし');
  await expect(page.locator('#bulkPreview')).toBeHidden();
});

test('Listen follows real audio state, respects manual browsing and ignores old events',async({page})=>{
  await openTestApp(page,{wordCount:30});await navigateToPage(page,'listen');
  await page.evaluate(()=>{
    window.utterances=[];
    window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
    speechSynthesis.getVoices=()=>[{name:'QA English',lang:'en-US',voiceURI:'qa-en',localService:true}];
    speechSynthesis.speak=utterance=>utterances.push(utterance);speechSynthesis.cancel=()=>{};refreshVoices();
    document.getElementById('audioPattern').value='front';document.getElementById('audioOrder').value='normal';startAudio();
  });
  await expect.poll(()=>page.evaluate(()=>utterances.length)).toBe(1);
  await expect(page.locator('.listen-state')).toHaveText('Preparing audio');
  await page.evaluate(()=>utterances[0].onstart());await expect(page.locator('.listen-state')).toHaveText('Now Playing');
  await page.locator('.listen-reading summary').click();
  await page.locator('.listen-reading ol').dispatchEvent('wheel',{deltaY:250});
  await expect(page.getByRole('button',{name:'Return to playing item'})).toBeVisible();
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await expect(page.locator('.listen-state')).toContainText('Paused.');
  await page.evaluate(()=>{utterances[0].onstart();utterances[0].onend()});
  await expect(page.locator('.listen-state')).toContainText('Paused.');
  await page.getByRole('button',{name:'Resume',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>utterances.length)).toBe(2);
  await page.evaluate(()=>utterances[1].onerror({error:'not-allowed'}));
  await expect(page.locator('.listen-state')).toContainText('failed');
  const failed=await page.locator('#audioNow').innerText();
  await page.getByRole('button',{name:'Resume',exact:true}).click();
  await expect(page.locator('#audioNow')).toHaveText(failed);
  await page.getByRole('button',{name:'Return to playing item'}).click();
  await expect(page.getByRole('button',{name:'Return to playing item'})).toBeHidden();
  await navigateToPage(page,'home');expect(await page.evaluate(()=>audioQueue.length)).toBe(0);
});

test('hidden hard-mode time is held rather than recording an unseen failure',async({page})=>{
  await setupQuiz(page);
  await page.evaluate(()=>{document.getElementById('quizHardMode').value='on';document.getElementById('quizTimeLimit').value='8';startQuestionTimer()});
  await page.clock.runFor(2000);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});
  await page.clock.runFor(30000);expect(await page.evaluate(()=>quiz.answered)).toBe(false);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))});
  await page.clock.runFor(5000);expect(await page.evaluate(()=>quiz.answered)).toBe(false);
  await page.clock.runFor(1200);expect(await page.evaluate(()=>quiz.answered)).toBe(true);
});
