(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.TangoNestBulkFormat=api;
})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";
  const fields=Object.freeze([
    {key:"front",label:"Front",required:true},
    {key:"back",label:"Back",required:true},
    {key:"pos",label:"POS"},
    {key:"gender",label:"Gender"},
    {key:"memo",label:"Example"},
    {key:"pronunciation",label:"Pronunciation"}
  ].map(Object.freeze));
  const formats=Object.freeze([
    {id:"complete",label:"Full details (TAB recommended)",keys:fields.map(field=>field.key)},
    {id:"simple",label:"Front + Back",keys:["front","back"]},
    {id:"legacy",label:"Legacy / automatic",keys:fields.slice(0,5).map(field=>field.key)}
  ].map(Object.freeze));
  const clean=value=>String(value??"").trim();
  const getFormat=id=>formats.find(format=>format.id===id)||formats[0];
  function columns(id){return getFormat(id).keys.map(key=>fields.find(field=>field.key===key));}
  function formatText(id){return columns(id).map(field=>field.label).join("[TAB]");}

  function split(line,delimiter){
    const values=[];let value="",quoted=false,closed=false;
    for(let i=0;i<line.length;i++){
      const char=line[i];
      if(char==='"'&&quoted&&line[i+1]==='"'){value+='"';i++;continue;}
      if(char==='"'&&(!value.trim()||quoted)){quoted=!quoted;closed=!quoted;continue;}
      if(char===delimiter&&!quoted){values.push(value);value="";closed=false;continue;}
      if(closed&&char.trim())return {values:[],error:"Unexpected text after a quoted field."};
      value+=char;
    }
    values.push(value);
    return {values,error:quoted?"Unclosed quote. Keep each word on one line.":""};
  }

  function parse(text,formatId="complete",options={}){
    const rows=[];let empty=0;
    const selected=columns(formatId);
    String(text??"").replace(/^\uFEFF/,"").split(/\r\n|\n|\r/).forEach((raw,index)=>{
      if(!raw.trim()){empty++;return;}
      const row={row:index+1,raw,front:"",back:"",pos:"",gender:"",memo:"",pronunciation:"",warnings:[],errors:[]};
      let before=raw,pipeExample=null;
      // Retain the old "pronunciation | example" format when there is no
      // complete six-column TSV row. A literal pipe in an example stays text.
      if(raw.includes("|")&&(!raw.includes("\t")||raw.split("\t").length<=5)){
        const at=raw.indexOf("|");before=raw.slice(0,at);pipeExample=raw.slice(at+1).trim();
      }
      let result;
      if(before.includes("\t"))result=split(before,"\t");
      else if(before.includes(","))result=split(before,",");
      else result={values:before.trim().split(/\s{2,}/)};
      if(result.values.length<2&&!before.includes("\t")&&!before.includes(","))result={values:before.trim().split(/\s+/)};
      if(result.error)row.errors.push(result.error);
      const values=result.values.map(clean);
      const legacy=pipeExample!==null||formatId==="legacy";
      const keys=legacy?fields.slice(0,5).map(field=>field.key):selected.map(field=>field.key);
      keys.forEach((key,i)=>row[key]=values[i]||"");
      if(legacy&&values.length>4){
        row.memo=pipeExample===null?values.slice(4).join(" "):pipeExample;
        row.pronunciation=pipeExample===null?"":values.slice(4).join(" ");
      }else if(pipeExample!==null)row.memo=pipeExample;
      if(!legacy&&values.length>keys.length)row.errors.push(`Expected at most ${keys.length} columns; found ${values.length}. Check the format or delimiters.`);
      if(legacy&&values.length>5)row.warnings.push("Extra legacy columns are preserved together. Check the example.");
      if(!row.front)row.errors.push("Front is missing.");
      if(!row.back)row.errors.push("Back is missing.");
      if(/^front$/i.test(row.front)&&/^back$/i.test(row.back))row.errors.push("Remove the header row.");
      if(/^```/.test(raw.trim()))row.errors.push("Remove the code fence; paste only word rows.");
      if(/\uFFFD/.test(raw))row.errors.push("Unreadable character detected. Paste the original text as UTF-8.");
      if(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(raw))row.errors.push("Unsupported control character.");
      if(/<\/?[a-z][^>]*>/i.test(raw))row.warnings.push("HTML will be stored as plain text, not executed.");
      if(options.pos?.length&&row.pos&&!options.pos.includes(row.pos))row.warnings.push("Unrecognized POS; it will be kept as entered.");
      if(options.genders?.length&&row.gender&&!options.genders.includes(row.gender))row.warnings.push("Unrecognized gender; check the selected columns.");
      if(row.gender&&/^(ja|ko|zh)-/.test(options.frontLang||""))row.warnings.push("This language usually does not need grammatical gender.");
      if(result.values.some((value,i)=>value!==values[i]))row.warnings.push("Outer whitespace removed.");
      rows.push(row);
    });
    return {rows,empty};
  }

  function analyze(text,{format="complete",words=[],listId="",frontLang="",backLang="",...options}={}){
    const parsed=parse(text,format,{...options,frontLang});
    const exactKey=row=>JSON.stringify([row.front,row.back,row.pos].map(value=>clean(value).toLowerCase()));
    const frontKey=row=>clean(row.front).toLowerCase();
    const exact=new Set(),fronts=new Map(),library=new Set();
    for(const word of words){
      if(word.frontLang!==frontLang||word.backLang!==backLang)continue;
      library.add(exactKey(word));
      if(word.listId!==listId)continue;
      exact.add(exactKey(word));
      if(!fronts.has(frontKey(word)))fronts.set(frontKey(word),word);
    }
    const seenExact=new Set(),seenFront=new Set();
    for(const row of parsed.rows){
      const key=exactKey(row),front=frontKey(row);
      row.duplicate=exact.has(key)||seenExact.has(key);
      row.frontDuplicate=fronts.has(front)||seenFront.has(front);
      row.existing=fronts.get(front)||null;
      if(row.duplicate)row.warnings.push("Exact duplicate in this playlist or pasted rows.");
      else if(row.frontDuplicate)row.warnings.push("Same Front, possibly a different meaning.");
      else if(library.has(key))row.warnings.push("Already in another playlist; a separate copy will be added here.");
      if(!row.errors.length){seenExact.add(key);seenFront.add(front);}
      row.status=row.errors.length?"error":row.warnings.length?"warning":"ready";
    }
    return {
      ...parsed,lines:parsed.rows.length,valid:parsed.rows.filter(row=>!row.errors.length).length,
      invalid:parsed.rows.filter(row=>row.errors.length).length,
      ready:parsed.rows.filter(row=>row.status==="ready").length,
      warnings:parsed.rows.filter(row=>row.status==="warning").length
    };
  }

  function prompt({format="complete",frontLabel,backLabel,count=50,pos=[],genders=[]}){
    const n=Math.max(1,Math.min(1000,Math.floor(Number(count)||50)));
    const keys=columns(format).map(field=>field.key);
    const rules=[
      "Use literal TAB characters between columns, one word per line, no header, no Markdown fences, and no explanations.",
      `Front must be in ${frontLabel}; Back must be in ${backLabel}.`,
      "Keep optional fields empty if not applicable, preserving their TAB positions. Do not repeat words. Use plain text, not HTML."
    ];
    if(keys.includes("memo"))rules.push(`Use natural example sentences in ${frontLabel}.`);
    if(keys.includes("pronunciation"))rules.push("Pronunciation describes the Front word only and must not be appended to Example.");
    if(keys.includes("pos")&&pos.length)rules.push(`POS may be ${pos.join(", ")}.`);
    if(keys.includes("gender")&&genders.length)rules.push(`Gender, if relevant, may be ${genders.join(", ")}.`);
    return `Create ${n} useful vocabulary entries for TangoNest, ${frontLabel} to ${backLabel}.\nReturn exactly these columns: ${formatText(format)}\n${rules.join(" ")}`;
  }
  // Sample vocabulary is data, not a second language definition list.
  const samples={
    en:["book","water","A book is on the table.","Please drink some water.","bʊk","ˈwɔːtər"],
    ja:["本","水","テーブルの上に本があります。","水を飲んでください。","ほん","みず"],
    ko:["책","물","탁자 위에 책이 있어요.","물을 마셔 주세요.","chaek","mul"],
    fr:["livre","eau","Le livre est sur la table.","Je bois de l'eau.","livʁ","o"],
    "zh-CN":["书","水","桌子上有一本书。","请喝水。","shū","shuǐ"],
    "zh-TW":["書","水","桌上有一本書。","請喝水。","shū","shuǐ"],
    es:["libro","agua","El libro está en la mesa.","Bebo agua.","ˈliβɾo","ˈaɣwa"],
    de:["Buch","Wasser","Das Buch liegt auf dem Tisch.","Ich trinke Wasser.","buːx","ˈvasɐ"],
    it:["libro","acqua","Il libro è sul tavolo.","Bevo acqua.","ˈlibro","ˈakkwa"],
    pt:["livro","água","O livro está na mesa.","Eu bebo água.","",""],
    ar:["كتاب","ماء","الكتاب على الطاولة.","أشرب الماء.","kitāb","māʾ"],
    ru:["книга","вода","Книга на столе.","Я пью воду.","",""],
    nl:["boek","water","Het boek ligt op tafel.","Ik drink water.","",""],
    vi:["sách","nước","Quyển sách ở trên bàn.","Tôi uống nước.","",""],
    th:["หนังสือ","น้ำ","หนังสืออยู่บนโต๊ะ","ฉันดื่มน้ำ","",""],
    tr:["kitap","su","Kitap masanın üzerinde.","Su içiyorum.","",""],
    hi:["किताब","पानी","किताब मेज़ पर है।","मैं पानी पीता हूँ।","",""],
    id:["buku","air","Buku ada di atas meja.","Saya minum air.","",""],
    el:["βιβλίο","νερό","Το βιβλίο είναι στο τραπέζι.","Πίνω νερό.","",""],
    he:["ספר","מים","הספר על השולחן.","אני שותה מים.","",""]
  };
  const sampleFor=code=>samples[code]||samples[String(code).split("-")[0]];
  function sample({format="complete",frontLang,backLang}){
    const front=sampleFor(frontLang),back=sampleFor(backLang);
    if(!front||!back)return "";
    return [0,1].map(index=>{
      const word={front:front[index],back:back[index],pos:"noun",gender:"",memo:front[index+2],pronunciation:front[index+4]};
      return columns(format).map(field=>word[field.key]||"").join("\t");
    }).join("\n");
  }
  return Object.freeze({fields,formats,columns,formatText,parse,analyze,prompt,sample});
});
