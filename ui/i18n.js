(function(root){
  "use strict";
  const en=root.TangoNestEnglish||{},dicts={en},key="tangonest_interface_language_v1";
  const locales=Object.freeze((root.TangoNestInterfaceLocales||[["en","English"]]).map(Object.freeze));
  let locale="en",request=0;
  const bindings=new Map(),missing=new Set();
  const sourceKeys=new Map(Object.entries(en).map(([id,text])=>[text,id]));
  // Product identity is shared worldwide; instructions and accessible labels remain localized.
  const brandKeys=new Set(["navigation.home","navigation.library","navigation.addWords","navigation.cards","navigation.quiz","navigation.listen","navigation.settings","ui.bulk_add","ui.language","ui.your_living_library","ui.your_own_language_space","ui.find_rhythm_build_meaning","ui.learn_grow_remember","ui.forest_desk"]);
  const escape=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function supported(code){
    const value=String(code||"").replace(/_/g,"-");
    if(/^zh\b/i.test(value))return /(?:Hant|TW|HK|MO)/i.test(value)?"zh-Hant":"zh-Hans";
    return locales.find(([id])=>id===value.toLowerCase().split("-")[0])?.[0]||null;
  }
  function detect(languages){for(const language of languages||[]){const match=supported(language);if(match)return match;}return "en";}
  function t(id,params={}){
    if(!Object.hasOwn(en,id))return id;
    if(locale!=="en"&&!Object.hasOwn(dicts[locale]||{},id))missing.add(`${locale}:${id}`);
    const text=brandKeys.has(id)?en[id]:(dicts[locale]?.[id]??en[id]);
    return text.replace(/\{(\w+)\}/g,(match,name)=>Object.hasOwn(params,name)?String(params[name]):match);
  }
  function mark(id,params={}){
    // Parameters come from already-escaped template expressions. No vocabulary is looked up as a key.
    return `<span data-i18n="${escape(id)}" data-i18n-params="${escape(JSON.stringify(params))}" data-i18n-resolved="${locale}">${t(id,params)}</span>`;
  }
  function bindText(element,render){if(!element)return "";bindings.set(element,render);const value=render();element.textContent=value;return value;}
  function bindUI(element,text){
    const id=sourceKeys.get(text)||Object.values(dicts).map(dict=>Object.keys(dict).find(id=>dict[id]===text)).find(Boolean);
    return bindText(element,()=>id?t(id):text);
  }
  function uiText(text){const id=sourceKeys.get(text);return id?t(id):text;}
  function studyName(code){
    const item=root.TangoNestLanguages.find(code);
    if(!item)return String(code||"");
    if(locale==="en")return item.name;
    try{return new Intl.DisplayNames([locale],{type:"language"}).of(item.script==="Hans"?"zh-Hans":item.script==="Hant"?"zh-Hant":item.id.split("-")[0])||item.name;}catch(error){return item.name;}
  }
  function applyElement(element){
    if(element.hasAttribute("data-user-content"))return;
    const id=element.getAttribute("data-i18n");
    if(brandKeys.has(id)){element.lang="en";element.dir="ltr";}
    if(id&&element.getAttribute("data-i18n-resolved")!==locale){
      let params={};try{params=JSON.parse(element.getAttribute("data-i18n-params")||"{}")}catch(error){}
      if(element.tagName==="OPTION")element.textContent=t(id,params);
      else element.innerHTML=t(id,params);
      element.setAttribute("data-i18n-resolved",locale);
    }
    for(const attr of ["title","aria-label","placeholder"]){const key=element.getAttribute(`data-i18n-${attr}`);if(key&&element.getAttribute(attr)!==t(key))element.setAttribute(attr,t(key));}
  }
  const selector="[data-i18n],[data-i18n-title],[data-i18n-aria-label],[data-i18n-placeholder]";
  function apply(container=document){
    if(container.nodeType===1&&container.matches(selector))applyElement(container);
    container.querySelectorAll?.(selector).forEach(applyElement);
  }
  const wordSelector=".fword,.fmemo,#quizWord,#quizAnswer,.choice,.quiz-reveal-answer,.quiz-reveal-selected,#audioNow,#audioSub,#audioExample,[data-user-content]";
  function applyWordDirection(container=document){
    if(container.nodeType===1&&container.matches(wordSelector))container.dir="auto";
    container.querySelectorAll?.(wordSelector).forEach(element=>element.dir="auto");
  }
  function applyDirection(){
    document.documentElement.lang=locale;
    document.documentElement.dataset.uiDirection=locale==="ar"?"rtl":"ltr";
    // Navigation placement remains stable; reading direction belongs to each UI surface.
    document.querySelectorAll(".page,.modal,.tn-word-detail-card,.auth-card,.network-status,.toast").forEach(el=>el.dir=locale==="ar"?"rtl":"ltr");
    applyWordDirection();
  }
  async function setLocale(code,{persist=true}={}){
    const next=supported(code)||"en",token=++request;
    if(!dicts[next]){
      try{
        const response=await fetch(new URL(`../locales/${next}.json`,scriptURL));
        if(!response.ok)throw new Error(`Locale unavailable: ${response.status}`);
        const dictionary=await response.json();
        if(!dictionary||Array.isArray(dictionary)||typeof dictionary!=="object")throw new Error("Invalid locale");
        dicts[next]=Object.fromEntries(Object.entries(dictionary).filter(([id,value])=>Object.hasOwn(en,id)&&typeof value==="string"));
      }catch(error){if(token===request){const select=document.getElementById("appLanguage");if(select)select.value=locale;}return false;}
    }
    if(token!==request)return false;
    locale=next;
    if(persist)try{localStorage.setItem(key,locale)}catch(error){}
    const select=document.getElementById("appLanguage");if(select)select.value=locale;
    apply();applyDirection();
    for(const [element,render]of bindings){if(!element.isConnected){bindings.delete(element);continue;}element.textContent=render();}
    root.dispatchEvent(new CustomEvent("tn:locale",{detail:{locale}}));
    return true;
  }
  const scriptURL=document.currentScript.src;
  const api={t,mark,uiText,studyName,bindText,bindUI,unbind:element=>bindings.delete(element),apply,setLocale,detect,locales,get locale(){return locale;},get missing(){return [...missing];},clearMissing:()=>missing.clear(),number:value=>new Intl.NumberFormat(locale).format(value)};
  root.TNI18n=api;
  const select=document.getElementById("appLanguage");
  if(select){for(const [id,label]of locales){const option=document.createElement("option");option.value=id;option.textContent=label;option.lang=id;select.append(option);}select.addEventListener("change",()=>setLocale(select.value));}
  let saved="";try{saved=localStorage.getItem(key)||""}catch(error){}
  api.ready=setLocale(supported(saved)||detect(navigator.languages||[navigator.language]),{persist:false});
  const observer=new MutationObserver(records=>{
    const roots=new Set();for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)roots.add(node);
    for(const node of roots){if(!node.isConnected)continue;apply(node);applyWordDirection(node);if(node.matches(".modal,.tn-word-detail-card"))node.dir=locale==="ar"?"rtl":"ltr";}
    for(const element of bindings.keys())if(!element.isConnected)bindings.delete(element);
  });
  observer.observe(document.body,{childList:true,subtree:true});
  apply();applyDirection();
})(window);
