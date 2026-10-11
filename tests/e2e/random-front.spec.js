const {test,expect,openTestApp,navigateToPage}=require('./fixtures');
const {installPersonaAuthMock,personaUuid}=require('./persona-auth-fixture');
async function setup(page,count=10){
  await page.addInitScript(()=>{
    window.audioCalls=[];window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
    let active=null,timer;
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>['en-US','ja-JP','zh-CN'].map(lang=>({name:lang,lang,voiceURI:lang,localService:true})),addEventListener(){},removeEventListener(){},cancel(){clearTimeout(timer);active?.onerror?.({error:'canceled'});active=null},speak(u){active=u;audioCalls.push({text:u.text,lang:u.lang,voice:u.voice.lang});u.onstart?.();timer=setTimeout(()=>{active=null;u.onend?.()},50)}}});
  });
  await openTestApp(page,{wordCount:count});await page.waitForFunction(()=>document.getElementById('quizAdvanced'));
}
async function answer(page){const i=await page.evaluate(()=>quiz.currentChoices.indexOf(correctAnswer()));await page.locator('.choice').nth(i).click();}

test('fresh defaults and one-time legacy migration preserve later explicit choices and unrelated data',async({page})=>{
  await page.addInitScript(()=>{if(!localStorage.getItem('seeded15')){localStorage.setItem('seeded15','1');localStorage.setItem('tangonest_learning_session_v1',JSON.stringify({quizOrderMode:'playlist',audioOrder:'normal',audioPattern:'frontBack',quizCount:'7',custom:'keep'}))}});
  await setup(page);await navigateToPage(page,'quiz');
  await expect(page.locator('#quizOrderMode')).toHaveValue('random');await expect(page.locator('#quizCount')).toHaveValue('7');
  await expect(page.locator('#audioOrder')).toHaveValue('random');await expect(page.locator('#audioPattern')).toHaveValue('front');
  await page.locator('#quizOrderMode').selectOption('playlist');await navigateToPage(page,'listen');await page.locator('#audioOrder').selectOption('normal');await page.locator('#audioPattern').selectOption('back');
  await page.reload();await page.waitForFunction(()=>document.getElementById('quizAdvanced'));
  await expect(page.locator('#quizOrderMode')).toHaveValue('playlist');await expect(page.locator('#audioOrder')).toHaveValue('normal');await expect(page.locator('#audioPattern')).toHaveValue('back');
  expect(await page.evaluate(()=>getLastSession().custom)).toBe('keep');await expect(page.locator('#wc')).toHaveText('10');
});

test('Random samples all candidate IDs and does not shuffle during redraw or answers',async({page})=>{
  await setup(page,40);await navigateToPage(page,'quiz');
  const result=await page.evaluate(()=>{
    let seed=19;const original=Math.random;Math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
    const seen=new Set(),runs=[];
    try{for(let n=0;n<60;n++){startQuiz();const ids=quiz.queue.map(w=>w.id);runs.push(ids);ids.forEach(id=>seen.add(id));}}finally{Math.random=original}
    const before=quiz.queue.map(w=>w.id);render();const after=quiz.queue.map(w=>w.id);
    return {runs,seen:[...seen],before,after};
  });
  expect(result.seen).toHaveLength(40);expect(result.before).toEqual(result.after);expect(new Set(result.runs.map(r=>r.join())).size).toBeGreaterThan(1);
  for(const run of result.runs){expect(run).toHaveLength(10);expect(new Set(run).size).toBe(10)}
});

test('same-spelling entries keep unique IDs and complete without a queue rewrite',async({page})=>{
  await setup(page);await navigateToPage(page,'quiz');await page.locator('#quizAudioAfter').selectOption('off');
  await page.locator('#quizOrderMode').selectOption('playlist');await page.evaluate(()=>db.words.forEach((w,i)=>w.front=i===0?'different':'same'));await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.getByRole('button',{name:'Start Quiz',exact:true}).click();const ids=await page.evaluate(()=>quiz.queue.map(w=>w.id));
  for(let i=0;i<10;i++){await answer(page);await page.clock.runFor(1800)}
  await expect(page.locator('#quizEnd')).toBeVisible();expect(await page.evaluate(()=>quiz.records.map(r=>r.id))).toEqual(ids);
});

for(const direction of ['front','back'])test(`Front text/language stays Chinese with ${direction} direction and another app language`,async({page})=>{
  await setup(page);await navigateToPage(page,'quiz');await page.locator('#quizDirection').selectOption(direction);
  await page.evaluate(()=>{db.words.forEach((w,i)=>{w.front='你好'+i;w.back='こんにちは'+i;w.frontLang='zh-CN';w.backLang='ja-JP'});TNI18n.setLocale('ar')});
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));await page.locator('[onclick="startQuiz()"]').click();
  await page.clock.runFor(500);expect(await page.evaluate(()=>audioCalls)).toEqual([]);
  const front=await page.evaluate(()=>quiz.current.front);await answer(page);await page.clock.runFor(150);
  expect(await page.evaluate(()=>audioCalls)).toEqual([{text:front,lang:'zh-CN',voice:'zh-CN'}]);
  await page.locator('.quiz-answer-audio').click();await page.clock.runFor(200);expect(await page.evaluate(()=>audioCalls[1])).toEqual({text:front,lang:'zh-CN',voice:'zh-CN'});
});

test('Front missing metadata never falls back to Back or app language; explicit library Front language works',async({page})=>{
  await setup(page);const r=await page.evaluate(async()=>{
    const word={id:'missing',front:'你好',back:'こんにちは',backLang:'ja-JP',listId:db.lists[0].id};
    const missing=await speakFront(word);db.lists[0].frontLang='zh-CN';const supplied=await speakFront(word);
    const blank=await speakFront({...word,front:''});const clean=await speakFront({...word,front:'<b>你好</b>\u0000<script>bad()</script>'});
    return {missing,supplied,blank,clean,calls:audioCalls};
  });
  expect(r).toEqual({missing:false,supplied:true,blank:false,clean:true,calls:[{text:'你好',lang:'zh-CN',voice:'zh-CN'},{text:'你好',lang:'zh-CN',voice:'zh-CN'}]});
});

test('wrong-answer results replay Front even for Back-to-Front questions',async({page})=>{
  await setup(page);await navigateToPage(page,'quiz');await page.locator('#quizDirection').selectOption('back');await page.locator('#quizAudioAfter').selectOption('off');
  await page.evaluate(()=>db.words.forEach((w,i)=>{w.front='你好'+i;w.back='こんにちは'+i;w.frontLang='zh-CN';w.backLang='ja-JP'}));
  await page.locator('[onclick="startQuiz()"]').click();const state=await page.evaluate(()=>({front:quiz.current.front,index:quiz.currentChoices.findIndex(value=>value!==correctAnswer())}));
  await page.locator('.choice').nth(state.index).click();await page.locator('[onclick="endQuiz()"]').click();await page.locator('#quizWrongList').getByRole('button',{name:'Play Front',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>audioCalls)).toEqual([{text:state.front,lang:'zh-CN',voice:'zh-CN'}]);
});

test('Listen defaults to Random and Front-only, keeps its queue during pause, and finishes ten items',async({page})=>{
  await setup(page);await navigateToPage(page,'listen');await expect(page.locator('#audioOrder')).toHaveValue('random');await expect(page.locator('#audioPattern')).toHaveValue('front');
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));await page.locator('#pageAudio').getByRole('button',{name:'Play',exact:true}).click();await page.clock.runFor(120);
  const queue=await page.evaluate(()=>audioQueue.map(w=>({id:w.id,text:w.front,lang:w.frontLang})));
  await page.locator('#pageAudio').getByRole('button',{name:'Pause',exact:true}).click();await page.clock.runFor(3000);expect(await page.evaluate(()=>audioQueue.map(w=>w.id))).toEqual(queue.map(w=>w.id));
  await page.locator('#pageAudio').getByRole('button',{name:'Resume',exact:true}).click();await page.clock.runFor(10000);
  expect(await page.evaluate(()=>listenRun.phase)).toBe('completed');expect(await page.evaluate(()=>audioCalls.map(x=>x.text))).toEqual(queue.map(x=>x.text));
});

test('zero, one and over-requested pools remain bounded by distinct IDs',async({page})=>{
  await setup(page,1);await navigateToPage(page,'quiz');await page.locator('#quizCount').fill('100');await page.locator('[onclick="startQuiz()"]').click();expect(await page.evaluate(()=>quiz.queue.length)).toBe(1);
  await page.evaluate(()=>{endQuiz();db.words=[];startQuiz();startAudio()});expect(await page.evaluate(()=>audioQueue.length)).toBe(0);
});

test('Home Listen resume retains queue and position without restoring an obsolete Back target',async({page})=>{
  await setup(page);await navigateToPage(page,'listen');await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.locator('[onclick="startAudio()"]').click();await page.clock.runFor(120);await page.locator('[onclick="pauseAudio()"]').click();await navigateToPage(page,'home');
  const saved=await page.evaluate(()=>{const key=`tangonest_checkpoint_v1:${db.meta?.userId||'guest'}`,state=JSON.parse(localStorage.getItem(key));state.pattern='backFront';localStorage.setItem(key,JSON.stringify(state));stopAudio();return{queue:state.queue.map(value=>JSON.parse(value)[0]),index:state.index}});
  await page.locator('.home-resume').click();await expect(page.locator('#audioPattern')).toHaveValue('front');
  expect(await page.evaluate(()=>({queue:audioQueue.map(w=>w.id),index:audioIndex-1,phase:listenRun.phase}))).toEqual({...saved,phase:'paused'});
  await page.locator('[onclick="startAudio()"]').click();await page.clock.runFor(100);expect(await page.evaluate(()=>audioCalls.at(-1).text)).toBe(await page.evaluate(()=>audioQueue[audioIndex-1].front));
});

test('duplicate candidate IDs do not inflate the session total',async({page})=>{
  await setup(page);await navigateToPage(page,'quiz');await page.locator('#quizCount').fill('100');await page.evaluate(()=>db.words.push({...db.words[0]}));await page.locator('[onclick="startQuiz()"]').click();
  expect(await page.evaluate(()=>({total:quiz.total,length:quiz.queue.length,unique:new Set(quiz.queue.map(w=>w.id)).size}))).toEqual({total:10,length:10,unique:10});
});

test('Mistake scope respects the selected Library before shuffling',async({page})=>{
  await setup(page);await navigateToPage(page,'quiz');
  const ids=await page.evaluate(()=>{db.words[1].listId='another';db.mistakes=[{wordId:db.words[0].id},{wordId:db.words[1].id}];document.getElementById('quizList').value=db.lists[0].id;document.getElementById('quizScope').value='mistakes';return quizPool().map(w=>w.id)});
  expect(ids).toEqual(['qa-word-1']);
});

test('late enhancement and normal redraw never restore an older order over an explicit selection',async({page})=>{
  await setup(page);await navigateToPage(page,'quiz');await page.locator('#quizOrderMode').selectOption('playlist');
  await page.evaluate(()=>{enhanceTangoNestApp();render()});await expect(page.locator('#quizOrderMode')).toHaveValue('playlist');
  await page.locator('[onclick="startQuiz()"]').click();expect(await page.evaluate(()=>quiz.current.id)).toBe('qa-word-1');
});

test('signed-in account migrates its own order once and restores explicit choices after login reload',async({page})=>{
  const index=21,email='qa.order@tangonest.test',password='TangoNest-Order-21!',key=`tangonest:account:v2:${personaUuid(index)}:learning-session`;
  await installPersonaAuthMock(page,{index,email,password,wordCount:10});
  await page.addInitScript(key=>{if(!localStorage.getItem('orderSeeded')){localStorage.setItem('orderSeeded','1');localStorage.setItem(key,JSON.stringify({quizOrderMode:'playlist',audioOrder:'normal',audioPattern:'frontBack',custom:'retained'}));localStorage.setItem('tangonest:account:v2:other:learning-session','{"quizOrderMode":"playlist"}')}},key);
  await page.goto('/');await page.locator('#authEmail').fill(email);await page.locator('#authPassword').fill(password);await page.getByRole('button',{name:'Login',exact:true}).click();await expect(page.locator('#authScreen')).toBeHidden();
  await navigateToPage(page,'quiz');await expect(page.locator('#quizOrderMode')).toHaveValue('random');await expect(page.locator('#audioPattern')).toHaveValue('front');
  await page.locator('#quizOrderMode').selectOption('playlist');await page.reload();await expect(page.locator('#authScreen')).toBeHidden();await expect(page.locator('#quizOrderMode')).toHaveValue('playlist');
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).custom,key)).toBe('retained');expect(await page.evaluate(()=>localStorage.getItem('tangonest:account:v2:other:learning-session'))).toBe('{"quizOrderMode":"playlist"}');await expect(page.locator('#wc')).toHaveText('10');
});

test('compact setup exposes full current values and disables an inactive time limit',async({page})=>{
  await setup(page);await navigateToPage(page,'quiz');await page.locator('#quizAdvanced').evaluate(node=>node.open=false);
  await expect(page.locator('#quizSettingsSummary')).toContainText('Random');await expect(page.locator('#quizSettingsSummary')).toContainText('Front only');
  await expect(page.locator('#quizTimeLimit')).toBeHidden();await page.locator('#quizAdvanced>summary').click();await expect(page.locator('#quizTimeLimit')).toBeDisabled();
  await expect(page.locator('#quizAdvanceValue')).toHaveText('Auto (1.2s correct / 2.5s incorrect)');await page.locator('#quizHardMode').selectOption('on');await expect(page.locator('#quizTimeLimit')).toBeEnabled();
});
