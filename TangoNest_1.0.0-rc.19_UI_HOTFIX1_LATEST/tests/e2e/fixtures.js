const {test:base,expect}=require("@playwright/test");

const DATA_KEY="tangonest_production_stable_v1";
const SHADOW_KEY="tangonest_last_good_data_v1";
const PAGE_KEY="tangonest_last_page_v2";

function buildData(wordCount=6){
  const at="2026-08-24T01:00:00.000Z";
  const lists=[
    {id:"qa-list-1",name:"My Words",isDefault:true,systemKey:"default-my-words",createdAt:at,updatedAt:at}
  ];
  const samples=[
    ["serendipity","思いがけない幸運","noun",1,0,"","2026-08-24"],
    ["consider","検討する","verb",2,2,"again","2026-08-24"],
    ["reliable","信頼できる","adjective",4,5,"good","2026-09-01"],
    ["departure","出発","noun",5,6,"good","2026-09-23"],
    ["reservation","予約","noun",3,3,"good","2026-08-25"],
    ["itinerary","旅程","noun",2,1,"good","2026-08-26"]
  ];
  const words=Array.from({length:wordCount},(_,index)=>{
    const sample=samples[index%samples.length];
    const reviewCount=index<samples.length?sample[4]:index%7;
    const level=index<samples.length?sample[3]:Math.min(5,1+(index%5));
    return {
      id:`qa-word-${index+1}`,
      listId:"qa-list-1",
      front:index<samples.length?sample[0]:`word ${String(index+1).padStart(5,"0")}`,
      back:index<samples.length?sample[1]:`meaning ${index+1}`,
      frontLang:"en-US",
      backLang:"ja-JP",
      pos:sample[2],
      memo:index%4===0?`Example sentence ${index+1}.`:"",
      saved:index%11===0,
      level,
      status:level===5?"learned":sample[5]==="again"?"hard":"new",
      reviewCount,
      correctCount:sample[5]==="again"?Math.max(0,reviewCount-1):reviewCount,
      wrongCount:sample[5]==="again"?1:0,
      consecutiveCorrect:level===5?3:Math.min(2,reviewCount),
      nextReview:sample[6],
      reviewIntervalDays:level===5?30:Math.max(0,reviewCount),
      lastResult:sample[5],
      lastAnsweredAt:reviewCount?at:"",
      lastWrongAt:sample[5]==="again"?at:"",
      createdAt:new Date(Date.parse(at)-index*60000).toISOString()
    };
  });
  return {
    schemaVersion:2,
    dataVersion:"1.0.0-rc.18",
    ui:"en",
    prefs:{frontLang:"en-US",backLang:"ja-JP"},
    lists,
    words,
    mistakes:wordCount>1?[{wordId:"qa-word-2",front:"consider",back:"検討する",wrongCount:1,lastWrongAt:at,playlistName:"Everyday English",sourceMode:"quiz"}]:[],
    meta:{updatedAt:at,sourceOfTruth:"e2e-local"}
  };
}

async function installTestState(page,{wordCount=6,pageName="home"}={}){
  const data=buildData(wordCount);
  await page.route("https://cdn.jsdelivr.net/**",route=>route.fulfill({status:200,contentType:"application/javascript",body:"window.supabase={};"}));
  await page.addInitScript(({data,dataKey,shadowKey,pageKey,pageName})=>{
    const serialized=JSON.stringify(data);
    if(!localStorage.getItem(dataKey))localStorage.setItem(dataKey,serialized);
    if(serialized.length<=1500000&&!localStorage.getItem(shadowKey))localStorage.setItem(shadowKey,serialized);
    if(!localStorage.getItem(pageKey))localStorage.setItem(pageKey,pageName);
  },{data,dataKey:DATA_KEY,shadowKey:SHADOW_KEY,pageKey:PAGE_KEY,pageName});
}

const NAV_IDS={
  home:["navHome","mnavHome"],
  create:["navAdd","mnavAdd"],
  library:["navWords","mnavWords"],
  cards:["navStudy","mnavStudy"],
  quiz:["navQuiz","mnavQuiz"],
  listen:["navAudio","mnavAudio"],
  settings:["navManage","mnavManage"]
};

async function navigateToPage(page,name){
  const ids=NAV_IDS[name];
  if(!ids)throw new Error(`Unknown page navigation: ${name}`);
  for(const id of ids){
    const button=page.locator(`#${id}`);
    if(await button.isVisible()){
      await button.click();
      return;
    }
  }
  if(name==="create"){
    await page.locator("#mnavWords").click();
    await page.locator("#mnavAdd").waitFor({state:"visible"});
    await page.locator("#mnavAdd").click();
    return;
  }
  throw new Error(`No visible navigation control for ${name}`);
}

async function selectLanguage(page,id,value){
  const trigger=page.locator(`[data-language-picker-trigger="${id}"]`);
  await trigger.click();
  await page.locator(`[data-language-picker="${id}"] .tn-language-picker-option[data-value="${value}"]`).click();
  await expect(page.locator(`#${id}`)).toHaveValue(value);
}

async function openTestApp(page,options={}){
  await installTestState(page,options);
  await page.goto("/?qa=1");
  await expect(page.locator(".app")).toBeVisible();
  await expect(page.locator("#authScreen")).toBeHidden();
  await expect(page.locator("#wc")).toHaveText(String(options.wordCount??6));
}

const test=base.extend({
  page:async({page},use)=>{
    const fatal=[];
    page.on("pageerror",error=>fatal.push(`pageerror: ${error.message}`));
    page.on("console",message=>{
      if(message.type()==="error"&&!/favicon|Failed to load resource.*404/i.test(message.text()))fatal.push(`console.error: ${message.text()}`);
    });
    await use(page);
    expect(fatal,"No uncaught exceptions, unhandled rejections, or console errors").toEqual([]);
  }
});

module.exports={test,expect,buildData,installTestState,openTestApp,navigateToPage,selectLanguage};
