(function(root){
  "use strict";
  // IDs preserve stored vocabulary. Regions identify default TTS locales, not languages' ownership.
  const rows=[
    ["en-US","English","English","Latn","word"],
    ["ja-JP","Japanese","日本語","Jpan","単語"],
    ["ko-KR","Korean","한국어","Kore","단어"],
    ["fr-FR","French","Français","Latn","mot"],
    ["zh-CN","Chinese Simplified","简体中文","Hans","词"],
    ["zh-TW","Chinese Traditional","繁體中文","Hant","詞"],
    ["es-ES","Spanish","Español","Latn","palabra"],
    ["de-DE","German","Deutsch","Latn","Wort"],
    ["it-IT","Italian","Italiano","Latn","parola"],
    ["pt-BR","Portuguese","Português","Latn","palavra"],
    ["ar-SA","Arabic","العربية","Arab","كلمة"],
    ["ru-RU","Russian","Русский","Cyrl","слово"],
    ["nl-NL","Dutch","Nederlands","Latn","woord"],
    ["vi-VN","Vietnamese","Tiếng Việt","Latn","từ"],
    ["th-TH","Thai","ไทย","Thai","คำ"],
    ["tr-TR","Turkish","Türkçe","Latn","kelime"],
    ["hi-IN","Hindi","हिन्दी","Deva","शब्द"],
    ["id-ID","Indonesian","Bahasa Indonesia","Latn","kata"],
    ["el-GR","Greek","Ελληνικά","Grek","λέξη"],
    ["he-IL","Hebrew","עברית","Hebr","מילה"],
    ["pl-PL","Polish","Polski","Latn","słowo"],
    ["sv-SE","Swedish","Svenska","Latn","ord"],
    ["nb-NO","Norwegian","Norsk bokmål","Latn","ord"],
    ["da-DK","Danish","Dansk","Latn","ord"],
    ["uk-UA","Ukrainian","Українська","Cyrl","слово"],
    ["bn-BD","Bengali","বাংলা","Beng","শব্দ"],
    ["ur-PK","Urdu","اردو","Arab","لفظ"],
    ["fa-IR","Persian","فارسی","Arab","واژه"],
    ["sw-KE","Swahili","Kiswahili","Latn","neno"],
    ["ms-MY","Malay","Bahasa Melayu","Latn","perkataan"],
    ["fil-PH","Filipino","Filipino","Latn","salita"],
    ["ro-RO","Romanian","Română","Latn","cuvânt"],
    ["cs-CZ","Czech","Čeština","Latn","slovo"],
    ["hu-HU","Hungarian","Magyar","Latn","szó"],
    ["fi-FI","Finnish","Suomi","Latn","sana"],
    ["pa-IN","Punjabi","ਪੰਜਾਬੀ","Guru","ਸ਼ਬਦ"],
    ["ta-IN","Tamil","தமிழ்","Taml","சொல்"]
  ];
  const registry=Object.freeze(rows.map(([id,name,nativeName,script,sample])=>Object.freeze({
    id,locale:id,name,nativeName,script,sample,ttsLocale:id,direction:["Arab","Hebr"].includes(script)?"rtl":"ltr"
  })));
  const byId=new Map(registry.map(item=>[item.id.toLowerCase(),item]));
  function find(code){
    const value=String(code||"").toLowerCase();
    if(/^zh-(?:hant|tw|hk|mo)/.test(value))return byId.get("zh-tw");
    return byId.get(value)||registry.find(item=>item.id.split("-")[0]===value.split("-")[0])||null;
  }
  function normalize(code){
    const value=String(code||"").trim();
    const aliases={chinese:"zh-CN",mandarin:"zh-CN",farsi:"fa-IR",tagalog:"fil-PH",no:"nb-NO",tl:"fil-PH"};
    if(aliases[value.toLowerCase()])return aliases[value.toLowerCase()];
    // Keep regional voices such as en-GB and pt-PT instead of rewriting saved preferences.
    if(/^[a-z]{2,3}-[a-z]{2}$/i.test(value)&&find(value))return value.slice(0,value.indexOf("-")).toLowerCase()+"-"+value.slice(value.indexOf("-")+1).toUpperCase();
    const known=find(value)||registry.find(item=>item.name.toLowerCase()===value.toLowerCase()||item.nativeName===value);
    return known?.id||value||"en-US";
  }
  const options=Object.freeze(registry.map(item=>Object.freeze([item.id,item.name,item.sample])));
  const api=Object.freeze({registry,options,find,normalize,label:code=>find(code)?.name||String(code||""),direction:code=>find(code)?.direction||"auto",priority:code=>{const n=registry.findIndex(item=>item.id===code);return n<0?registry.length:n;}});
  root.TangoNestLanguages=api;
  if(typeof module!=="undefined")module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
