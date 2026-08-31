(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root){
    root.TangoNestExampleFields=api;
    root.tnNormalizeExampleFields=api.normalizeWord;
  }
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const CJK=/[㐀-鿿぀-ヿ가-힯]/u;
  const PLAIN_PRONUNCIATION=/^[A-Za-zÀ-ɏḀ-ỿ0-9'’\-\s]{1,80}$/u;
  const SLASH_PRONUNCIATION=/^\/[^/\r\n]{1,80}\/$/u;
  const TRAILING_PRONUNCIATION=/^([\s\S]*?[。！？!?\.])\s+((?:\/[^/\r\n]{1,80}\/)|(?:[A-Za-zÀ-ɏḀ-ỿ][A-Za-zÀ-ɏḀ-ỿ0-9'’\-\s]{0,79}))\s*$/u;

  function text(value){return String(value??"").trim()}
  function looksLikePronunciation(value){
    const candidate=text(value);
    if(!candidate)return false;
    return SLASH_PRONUNCIATION.test(candidate)||PLAIN_PRONUNCIATION.test(candidate);
  }

  function normalizeFields(memoValue,pronunciationValue){
    let memo=text(memoValue);
    let pronunciation=text(pronunciationValue);
    const originalMemo=memo;
    const originalPronunciation=pronunciation;

    const pipeIndex=memo.indexOf("|");
    if(pipeIndex>0){
      const before=text(memo.slice(0,pipeIndex));
      const after=text(memo.slice(pipeIndex+1));
      if(after&&looksLikePronunciation(before)&&(CJK.test(after)||/[。！？!?\.]/u.test(after))){
        pronunciation=pronunciation||before;
        memo=after;
      }
    }

    const trailing=memo.match(TRAILING_PRONUNCIATION);
    if(trailing){
      const example=text(trailing[1]);
      const suffix=text(trailing[2]);
      if(SLASH_PRONUNCIATION.test(suffix)||CJK.test(example)){
        pronunciation=pronunciation||suffix;
        memo=example;
      }
    }

    return {
      memo,
      pronunciation,
      changed:memo!==originalMemo||pronunciation!==originalPronunciation
    };
  }

  function normalizeWord(word){
    const source=word&&typeof word==="object"?word:{};
    const normalized=normalizeFields(source.memo,source.pronunciation||source.pron||source.reading||source.pinyin);
    return {...source,memo:normalized.memo,pronunciation:normalized.pronunciation};
  }

  return {normalizeFields,normalizeWord,looksLikePronunciation};
});
