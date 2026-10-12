const {test,expect,openTestApp,navigateToPage}=require('./fixtures');

test('IME confirmation and held Enter never submit or skip a typing question',async({page})=>{
  await openTestApp(page);
  await navigateToPage(page,'quiz');
  await page.locator('#quizType').selectOption('typing');
  await page.locator('#quizAutoAdvance').selectOption('manual');
  await page.getByRole('button',{name:'Start Quiz',exact:true}).click();
  await page.locator('#quizAnswer').fill('変換中');
  await page.locator('#quizAnswer').dispatchEvent('keydown',{key:'Enter',isComposing:true});
  expect(await page.evaluate(()=>quiz.answered)).toBe(false);
  await page.locator('#quizAnswer').press('Enter');
  expect(await page.evaluate(()=>quiz.answered)).toBe(true);
  await page.locator('#quizAnswer').dispatchEvent('keydown',{key:'Enter',repeat:true});
  expect(await page.evaluate(()=>quiz.index)).toBe(0);
});

test('brand is universal while functional guidance follows six locales',async({page})=>{
  await openTestApp(page);
  for(const locale of ['en','ja','de','es','zh-Hans','ar']){
    await page.evaluate(locale=>TNI18n.setLocale(locale),locale);
    await navigateToPage(page,'home');
    await expect(page.locator('#navHome')).toContainText('Home');
    await expect(page.locator('.home-focus-copy')).toContainText('Your own language space.');
    await expect(page.locator('[data-i18n="ui.your_own_language_space"]')).toHaveAttribute('dir','ltr');
    await expect(page.locator('[data-i18n="ui.your_own_language_space"]')).toHaveAttribute('lang','en');
    await navigateToPage(page,'quiz');
    await page.evaluate(()=>{startQuiz();document.getElementById('quizAutoAdvance').value='manual';});
    const instruction=await page.evaluate(()=>TNI18n.t('quiz.chooseMeaning'));
    await expect(page.locator('#quizLabel')).toHaveText(instruction);
    if(locale!=='en')expect(instruction).not.toBe('Choose the correct meaning.');
    await page.evaluate(()=>resetQuiz());
  }
});

test('equal timing, manual advance and audio review do not double advance',async({page})=>{
  await openTestApp(page);
  await navigateToPage(page,'quiz');
  await page.evaluate(()=>{startQuiz();document.getElementById('quizAudioAfter').value='off';});
  expect(await page.evaluate(()=>[nextDelay(true),nextDelay(false)])).toEqual([2000,2000]);
  await page.clock.install({time:new Date('2030-01-01T00:00:00Z')});
  await page.clock.pauseAt(new Date('2030-01-01T00:00:01Z'));
  await page.evaluate(()=>finishAnswer(true));
  await page.clock.runFor(40);
  await page.clock.runFor(1900);
  expect(await page.evaluate(()=>quiz.index)).toBe(0);
  await page.clock.runFor(150);
  expect(await page.evaluate(()=>quiz.index)).toBe(1);
  await page.evaluate(()=>finishAnswer(false));
  await page.clock.runFor(1900);
  expect(await page.evaluate(()=>quiz.index)).toBe(1);
  await page.evaluate(()=>nextQuizQuestion());
  await page.clock.runFor(1500);
  expect(await page.evaluate(()=>quiz.index)).toBe(2);
  await page.evaluate(()=>{finishAnswer(true);speakCorrectAnswer();});
  await page.clock.runFor(2000);
  expect(await page.evaluate(()=>quiz.index)).toBe(2);
});

for(const width of [1440,1280,1024,834,768,430,390,375,320])test(`Quiz layout stays legible without nested scrolling at ${width}px and three heights`,async({page})=>{
  await openTestApp(page);
  await navigateToPage(page,'quiz');
  await page.evaluate(()=>{startQuiz();document.getElementById('quizAutoAdvance').value='manual';});
    for(const height of [768,800,900]){
      await page.setViewportSize({width,height});
      await page.evaluate(()=>showQuizQuestion());
      await page.waitForTimeout(250);
      const before=await page.locator('#choiceArea').boundingBox();
      await page.evaluate(()=>{quiz.selectedAnswer='An incorrect answer';finishAnswer(false);});
      const after=await page.locator('#choiceArea').boundingBox();
      expect(Math.abs(before.y-after.y)).toBeLessThan(1);
      expect(await page.locator('#quizQuestionBack').count()).toBe(0);
      await expect(page.locator('#quizScore')).toBeHidden();
      const metrics=await page.evaluate(()=>({
        overflow:document.documentElement.scrollWidth-innerWidth,
        nested:[...document.querySelectorAll('#quizRun *')].filter(el=>el.getBoundingClientRect().height>0&&/auto|scroll/.test(getComputedStyle(el).overflowY)&&el.scrollHeight>el.clientHeight+1).map(el=>el.id),
        bottom:document.getElementById('quizResult').getBoundingClientRect().bottom
      }));
      expect(metrics.overflow).toBeLessThanOrEqual(0);
      expect(metrics.nested).toEqual([]);
      if(width>=1024)expect(metrics.bottom).toBeLessThan(height);
    }
});

test('long answers wrap instead of clipping or creating feedback scrollbars',async({page})=>{
  await openTestApp(page);
  await navigateToPage(page,'quiz');
  await page.setViewportSize({width:320,height:768});
  await page.evaluate(()=>{
    startQuiz();document.getElementById('quizAutoAdvance').value='manual';
    quiz.current.back='A longer definition with detailed context and enough words to require several lines on a narrow phone. '.repeat(3);
    renderChoices();quiz.selectedAnswer='A different long answer. '.repeat(4);finishAnswer(false);
  });
  expect(await page.locator('#quizResult').evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);
  expect(await page.locator('#choiceArea').evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(0);
});
