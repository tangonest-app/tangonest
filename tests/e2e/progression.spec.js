const {test,expect,openTestApp,navigateToPage}=require('./fixtures');

async function voices(page){
  await page.addInitScript(()=>{
    class Utterance{constructor(text){this.text=text}}
    window.SpeechSynthesisUtterance=Utterance;
    const h=window.voiceHarness={calls:[],events:[],active:0,maxActive:0,hold:false,failAt:{},current:null,timer:null};
    const finish=error=>{const u=h.current;if(!u)return;clearTimeout(h.timer);h.current=null;h.active=0;h.events.push({text:u.text,type:error?'error':'end',error});if(error)u.onerror?.({error});else u.onend?.()};
    h.finish=finish;
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
      getVoices:()=>[{name:'QA English',lang:'en-US',voiceURI:'qa-en',localService:true},{name:'QA Japanese',lang:'ja-JP',voiceURI:'qa-ja',localService:true}],addEventListener(){},removeEventListener(){},
      cancel(){finish('canceled')},speak(u){h.current=u;h.calls.push(u.text);h.active++;h.maxActive=Math.max(h.maxActive,h.active);h.events.push({text:u.text,type:'start'});u.onstart?.();if(!h.hold)h.timer=setTimeout(()=>finish(h.failAt[h.calls.length]),50)}
    }});
  });
}
async function open(page,screen){await voices(page);await openTestApp(page,{wordCount:10});await navigateToPage(page,screen);await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));}
async function startQuizRun(page,audio='off'){
  await page.locator('#quizCount').fill('10');await page.locator('#quizAudioAfter').selectOption(audio);await page.locator('#quizOrderMode').selectOption('playlist');
  await page.getByRole('button',{name:'Start Quiz',exact:true}).click();await page.clock.runFor(400);
}
async function choose(page,ok){const i=await page.evaluate(ok=>quiz.currentChoices.findIndex(v=>ok?v===correctAnswer():v!==correctAnswer()),ok);await page.locator('.choice').nth(i).click();await page.clock.runFor(40);}

for(const audio of ['off','on'])test(`Quiz completes 10 mixed answers without Next, audio ${audio}`,async({page})=>{
  await page.addInitScript(()=>{localStorage.setItem('tangonest_quiz_auto_feedback_fdg9_v1','complete');localStorage.setItem('tangonest_quiz_feedback_speed_v1','manual');localStorage.setItem('qa-unrelated','keep')});
  await open(page,'quiz');await expect(page.locator('#quizAutoAdvance')).toHaveValue('auto');await startQuizRun(page,audio);
  await page.clock.runFor(10000);expect(await page.evaluate(()=>quiz.index)).toBe(0);
  for(let i=0;i<10;i++){
    await choose(page,i%2===0);await expect(page.locator('.quiz-next-btn')).toHaveCount(1);
    await page.clock.runFor(1950);expect(await page.evaluate(()=>quiz.index)).toBe(i);
    await page.clock.runFor(500);
  }
  await expect(page.locator('#quizEnd')).toBeVisible();
  expect(await page.evaluate(()=>({score:quiz.score,count:quiz.records.length,unique:new Set(quiz.records.map(r=>r.eventId)).size,unrelated:localStorage.getItem('qa-unrelated')}))).toEqual({score:5,count:10,unique:10,unrelated:'keep'});
  expect(await page.evaluate(()=>voiceHarness.calls.length)).toBe(audio==='on'?10:0);
});

test('Play answer temporarily holds progression but preserves an explicit pause',async({page})=>{
  await open(page,'quiz');await startQuizRun(page);await choose(page,true);
  await page.evaluate(()=>voiceHarness.hold=true);await page.locator('.quiz-answer-audio').click();await page.clock.runFor(5000);
  expect(await page.evaluate(()=>quiz.index)).toBe(0);await page.evaluate(()=>voiceHarness.finish());await page.clock.runFor(550);expect(await page.evaluate(()=>quiz.index)).toBe(0);
  await page.clock.runFor(500);expect(await page.evaluate(()=>quiz.index)).toBe(1);
  await choose(page,false);await page.locator('#quizPauseAdvance').click();await page.locator('.quiz-answer-audio').click();await page.evaluate(()=>voiceHarness.finish());await page.clock.runFor(8000);
  expect(await page.evaluate(()=>quiz.index)).toBe(1);await expect(page.locator('#quizPauseAdvance')).toHaveText('Resume');await page.locator('#quizPauseAdvance').click();await page.clock.runFor(2600);expect(await page.evaluate(()=>quiz.index)).toBe(2);
});

test('automatic answer audio cannot block the configured delay and late events cannot advance twice',async({page})=>{
  await open(page,'quiz');await page.evaluate(()=>{db.words[0].front='A long meaningful prompt. '.repeat(30);voiceHarness.hold=true});await startQuizRun(page,'on');await choose(page,true);
  await page.evaluate(()=>{window.oldUtterance=voiceHarness.current});
  await page.clock.runFor(2500);expect(await page.evaluate(()=>({index:quiz.index,active:voiceHarness.active}))).toEqual({index:1,active:0});
  await page.evaluate(()=>{oldUtterance.onend();oldUtterance.onerror({error:'network'});oldUtterance.onstart()});
  expect(await page.evaluate(()=>({index:quiz.index,count:quiz.records.length}))).toEqual({index:1,count:1});
});

test('blank examples are absent and identical front/back data is retained',async({page})=>{
  await open(page,'quiz');await page.evaluate(()=>{db.words[0].front='accident';db.words[0].back='accident';db.words[0].frontLang='fr-FR';db.words[0].backLang='en-US';db.words[0].memo='   '});await startQuizRun(page);await choose(page,true);
  await expect(page.locator('.quiz-explanation')).toHaveCount(0);expect(await page.evaluate(()=>correctAnswer())).toBe('accident');expect(await page.evaluate(()=>quiz.current.frontLang)).toBe('fr-FR');
});

async function listenSetup(page){await open(page,'listen');await page.locator('#audioOrder').selectOption('normal');await page.locator('#audioPattern').selectOption('frontBackExample');await page.locator('#pairGapCustom').fill('0.1');await page.locator('#audioIntervalCustom').fill('0.4');}
const play=page=>page.locator('#pageAudio').getByRole('button',{name:'Play',exact:true});
const resume=page=>page.locator('#pageAudio').getByRole('button',{name:'Resume',exact:true});
test('Listen completes 10 items from one Play, skips empty optional fields and stops',async({page})=>{
  await listenSetup(page);const expected=await page.evaluate(()=>{db.words[1].back='';db.words[2].memo=' ';return audioWords().flatMap(w=>listenParts(w).map(p=>p.text))});
  await play(page).click();await page.clock.runFor(14000);
  expect(await page.evaluate(()=>({index:audioIndex,phase:listenRun.phase,calls:voiceHarness.calls,max:voiceHarness.maxActive}))).toEqual({index:10,phase:'completed',calls:expected,max:1});
  await expect(page.locator('.listen-state')).toContainText('Playback complete');await page.clock.runFor(15000);expect(await page.evaluate(()=>voiceHarness.calls)).toEqual(expected);
});
test('Listen pause, resume and paused navigation never overlap or consume items',async({page})=>{
  await listenSetup(page);await page.evaluate(()=>voiceHarness.hold=true);await play(page).click();await page.clock.runFor(100);
  await page.locator('#pageAudio').getByRole('button',{name:'Pause',exact:true}).click();await page.clock.runFor(10000);
  expect(await page.evaluate(()=>({index:audioIndex,phase:listenRun.phase,active:voiceHarness.active}))).toEqual({index:1,phase:'paused',active:0});
  await page.locator('#pageAudio').getByRole('button',{name:'Next',exact:true}).click();expect(await page.evaluate(()=>audioIndex)).toBe(2);expect(await page.evaluate(()=>voiceHarness.active)).toBe(0);
  await page.locator('#pageAudio').getByRole('button',{name:'Previous',exact:true}).click();await resume(page).click();await page.clock.runFor(100);expect(await page.evaluate(()=>voiceHarness.calls)).toEqual(['serendipity','serendipity']);
  await page.locator('#audioRate').selectOption('1.05');await page.clock.runFor(100);expect(await page.evaluate(()=>voiceHarness.maxActive)).toBe(1);
  await navigateToPage(page,'home');await page.clock.runFor(10000);expect(await page.evaluate(()=>voiceHarness.active)).toBe(0);
});
for(const repeat of ['all','word'])test(`Listen ${repeat} repeat is explicit and continuous`,async({page})=>{
  await listenSetup(page);await page.locator('#audioPattern').selectOption('front');await page.locator('#audioRepeat').selectOption(repeat);await play(page).click();await page.clock.runFor(6000);
  const calls=await page.evaluate(()=>voiceHarness.calls);expect(calls.length).toBeGreaterThan(10);if(repeat==='word')expect(new Set(calls).size).toBe(1);else expect(calls[10]).toBe(calls[0]);
  await page.locator('#pageAudio').getByRole('button',{name:'Pause',exact:true}).click();
});
test('Listen records isolated failures but stops blocked or repeated failures',async({page})=>{
  await listenSetup(page);await page.locator('#audioPattern').selectOption('front');await page.evaluate(()=>voiceHarness.failAt={1:'network'});await play(page).click();await page.clock.runFor(8000);
  expect(await page.evaluate(()=>({phase:listenRun.phase,errors:listenRun.errors.length}))).toEqual({phase:'completed',errors:1});
  await page.evaluate(()=>{voiceHarness.calls=[];voiceHarness.failAt={1:'network',2:'network'}});await play(page).click();await page.clock.runFor(8000);
  expect(await page.evaluate(()=>({phase:listenRun.phase,index:audioIndex,calls:voiceHarness.calls.length}))).toEqual({phase:'error',index:2,calls:2});
  await page.locator('#pageAudio').getByRole('button',{name:'Stop',exact:true}).click();await page.evaluate(()=>{voiceHarness.calls=[];voiceHarness.failAt={1:'not-allowed'}});await play(page).click();await page.clock.runFor(8000);
  expect(await page.evaluate(()=>voiceHarness.calls.length)).toBe(1);await expect(page.locator('.listen-state')).toContainText('not-allowed');await expect(resume(page)).toBeVisible();
});
test('redraw, hidden document and End session cannot consume unseen items',async({page})=>{
  await open(page,'quiz');await startQuizRun(page,'on');await page.evaluate(()=>voiceHarness.hold=true);await choose(page,true);
  await page.evaluate(()=>render());expect(await page.evaluate(()=>quiz.index)).toBe(0);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});await page.clock.runFor(5000);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))});await page.clock.runFor(5000);expect(await page.evaluate(()=>quiz.index)).toBe(0);
  await page.evaluate(()=>endQuiz());expect(await page.evaluate(()=>voiceHarness.active)).toBe(0);expect(await page.evaluate(()=>quiz.records.length)).toBe(1);
  await navigateToPage(page,'listen');await play(page).click();await page.clock.runFor(100);await page.evaluate(()=>render());
  expect(await page.evaluate(()=>audioIndex)).toBe(1);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});await page.clock.runFor(8000);
  expect(await page.evaluate(()=>({index:audioIndex,active:voiceHarness.active,phase:listenRun.phase}))).toEqual({index:1,active:0,phase:'paused'});
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))});
});

test('an older manual checkpoint cannot undo the settings migration',async({page})=>{
  await open(page,'quiz');await startQuizRun(page);await choose(page,true);await navigateToPage(page,'home');
  await page.evaluate(()=>{const key='tangonest_checkpoint_v1:guest',state=JSON.parse(localStorage.getItem(key));state.options.quizAutoAdvance='manual';localStorage.setItem(key,JSON.stringify(state));tnStudyContinuity.render()});
  await page.locator('.home-resume').click();await page.clock.runFor(400);await expect(page.locator('#quizAutoAdvance')).toHaveValue('auto');await choose(page,false);await page.clock.runFor(2700);
  expect(await page.evaluate(()=>quiz.index)).toBe(2);
});

test('saved Listen opt-out migrates only once without altering unrelated settings',async({page})=>{
  await page.addInitScript(()=>{if(!localStorage.getItem('seeded')){localStorage.setItem('seeded','yes');localStorage.setItem('tangonest_listen_options_v1',JSON.stringify({auto:false,interval:2}));localStorage.setItem('qa-other','safe')}});
  await open(page,'listen');await expect(page.locator('#audioAutoPlay')).toBeChecked();await expect(page.locator('#audioIntervalCustom')).toHaveValue('2');
  await page.locator('#audioAutoPlay').uncheck();await page.reload();await navigateToPage(page,'listen');await expect(page.locator('#audioAutoPlay')).not.toBeChecked();expect(await page.evaluate(()=>localStorage.getItem('qa-other'))).toBe('safe');
});
