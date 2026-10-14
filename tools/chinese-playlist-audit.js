/* Offline review only. Never connects to Supabase or writes application data. */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const clone=value=>JSON.parse(JSON.stringify(value));
const hash=value=>crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const allowed=new Set(['pronunciation','back']);
const html=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function patternText(value){return String(value??'').replace(/[～〜~]/g,' ').replace(/\s+/g,' ').trim()}
function validateCandidate(original,candidate,playlistId){
  const a=original.data,b=candidate.data;
  assert.equal(a.words.length,b.words.length,'Word count changed');
  const ids=new Set(a.words.map(w=>w.id));assert.equal(ids.size,a.words.length,'Duplicate original IDs');
  assert.equal(new Set(b.words.map(w=>w.id)).size,b.words.length,'Duplicate candidate IDs');
  let chineseChanges=0,otherChanges=0;
  for(let i=0;i<a.words.length;i++){
    const old=a.words[i],next=b.words[i];assert.equal(old.id,next.id,'ID/order changed');
    if(old.front!==next.front)chineseChanges++;
    if(old.listId!==playlistId){assert.deepEqual(next,old,'Other playlist changed');continue;}
    for(const key of new Set([...Object.keys(old),...Object.keys(next)])){
      if(!allowed.has(key))assert.deepEqual(next[key],old[key],`Protected field changed: ${key}`);
      else if(next[key]!==old[key])otherChanges++;
    }
  }
  assert.equal(chineseChanges,0,'Chinese original changed');
  const strip=doc=>{const copy=clone(doc);delete copy.data.words;return copy};
  assert.deepEqual(strip(candidate),strip(original),'History, lists, settings or metadata changed');
  return {chineseOriginalChanges:chineseChanges,otherPlaylistChanges:0,protectedFieldsUnchanged:true,changedFields:otherChanges};
}
function buildAudit(snapshot,decisions){
  assert(Array.isArray(snapshot.data?.words)&&Array.isArray(snapshot.data?.lists),'Invalid backup');
  const list=snapshot.data.lists.find(l=>l.id===decisions.playlistId);
  assert(list&&list.name==='Chinese','Target playlist ID/name mismatch');
  const target=snapshot.data.words.filter(w=>w.listId===list.id);
  assert.equal(target.length,decisions.expectedCount,'Target count changed');
  assert.equal(decisions.reviewedCount,target.length,'Incomplete review');
  assert(target.every(w=>w.frontLang==='zh-CN'&&w.backLang==='ja-JP'),'Target language mismatch');
  const candidate=clone(snapshot),byId=new Map(candidate.data.words.map(w=>[w.id,w]));
  assert.equal(byId.size,candidate.data.words.length,'Duplicate IDs');
  const plan=[],seen=new Set();
  for(const change of decisions.changes){
    assert(!seen.has(change.id),'Duplicate change ID');seen.add(change.id);
    const word=byId.get(change.id);
    assert(word?.listId===list.id,'Change outside target');assert.equal(word.front,change.front,'Chinese original mismatch');
    const fields=Object.keys(change.after);assert(fields.length>0&&fields.every(k=>allowed.has(k)),'Forbidden patch field');
    assert(fields.every(k=>typeof change.after[k]==='string'&&change.after[k].trim()),'Patch values must be nonempty text');
    assert.deepEqual(Object.keys(change.before).sort(),fields.sort(),'Incomplete before values');
    const already=fields.every(k=>word[k]===change.after[k]);
    if(!already)for(const k of fields)assert.equal(word[k],change.before[k],`Existing value changed: ${word.id}/${k}`);
    if('pronunciation' in change.after){const p=change.after.pronunciation;
      assert(typeof p==='string'&&p.trim()&&p.normalize('NFC')===p,'Invalid pinyin');
      assert(!/[～〜~\u3400-\u9fff0-9]/u.test(p),'Pinyin contains separator, Hanzi or tone numbers');
      assert(/^[a-zA-ZüÜāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ\s'’]+$/u.test(p),'Unexpected pinyin characters');
    }
    plan.push({...clone(change),status:already?'already-present':'proposed'});
    if(!already)Object.assign(word,change.after);
  }
  for(const pending of decisions.needsReview){
    const word=byId.get(pending.id);
    assert(word?.listId===list.id&&word.front===pending.front,'Invalid review item');
    assert(!seen.has(pending.id),'An unresolved item cannot be patched');
  }
  const validation=validateCandidate(snapshot,candidate,list.id);
  const proposed=plan.filter(c=>c.status==='proposed');
  const summary={playlistId:list.id,playlistName:list.name,frontLang:'zh-CN',backLang:'ja-JP',totalWords:target.length,allAccountWords:snapshot.data.words.length,
    missingPinyin:target.filter(w=>!String(w.pronunciation??'').trim()).length,
    pinyinFilled:proposed.filter(c=>'pronunciation' in c.after&&!c.before.pronunciation.trim()).length,
    pinyinCorrected:proposed.filter(c=>'pronunciation' in c.after&&c.before.pronunciation.trim()).length,
    translationCorrected:proposed.filter(c=>'back' in c.after).length,
    changedWords:proposed.length,alreadyPresent:plan.filter(c=>c.status==='already-present').length,needsReview:decisions.needsReview.length,
    missingPinyinAfter:candidate.data.words.filter(w=>w.listId===list.id&&!String(w.pronunciation??'').trim()).length,
    duplicateIds:0,sharedWordIdsAcrossPlaylists:0,...validation};
  const report={mode:'review-only',backupSha256:hash(snapshot),summary,plan,needsReview:clone(decisions.needsReview),preservedReadingNotes:clone(decisions.preservedReadingNotes||[])};
  return {candidate,report};
}
function renderReport(report){
 const s=report.summary;
 const rows=report.plan.map(c=>`<tr><td>${html(c.front)}<small>${html(c.id)}</small></td><td>${html(c.before.pronunciation??'—')}</td><td>${html(c.after.pronunciation??'—')}</td><td>${html(c.before.back??'—')}</td><td>${html(c.after.back??'—')}</td><td>${html(c.reason)}</td></tr>`).join('');
 return `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Chinese 修正候補</title><style>body{font:16px system-ui;margin:32px;color:#222}main{max-width:1300px;margin:auto}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:12px;text-align:left;vertical-align:top}small{display:block;font-size:10px;color:#777}h1{font-size:26px}.scroll{overflow:auto}td{min-width:110px}li{margin:12px 0}</style><main><h1>Chinese：修正前後の比較（未適用）</h1><p>${s.totalWords}件・ピンイン補完${s.pinyinFilled}件・ピンイン修正${s.pinyinCorrected}件（軽声候補を含む）・日本語訳${s.translationCorrected}件・要確認${s.needsReview}件。中国語原文変更${s.chineseOriginalChanges}件。</p><p>ID：${html(s.playlistId)}／zh-CN → ja-JP。履歴・設定・他プレイリストの変更0件。</p><div class="scroll"><table><thead><tr><th>中国語（変更なし）／ID</th><th>Pinyin変更前</th><th>Pinyin候補</th><th>日本語変更前</th><th>日本語候補</th><th>理由</th></tr></thead><tbody>${rows}</tbody></table></div><h2>要確認（保留）</h2><ul>${report.needsReview.map(c=>`<li><b>${html(c.front)}</b>：${html(c.reason)}</li>`).join('')}</ul><h2>読みの保持・異読</h2><ul>${report.preservedReadingNotes.map(n=>`<li>${html(n)}</li>`).join('')}</ul><p>参照：<a href="https://www.mdbg.net/chinese/dictionary?page=cc-cedict">CC-CEDICT / MDBG配布辞書</a>。辞書の語全体の読み・語義と既存例文を照合。機械変換結果をそのまま登録しない。</p></main></html>`;
}
if(require.main===module){
 const [backup,decisionsFile,outDir]=process.argv.slice(2);
 if(!backup||!decisionsFile||!outDir)throw Error('Usage: node tools/chinese-playlist-audit.js <backup.json> <decisions.json> <new-output-dir>');
 assert(!fs.existsSync(outDir),'Output exists; use a new directory');
 const snapshot=JSON.parse(fs.readFileSync(backup,'utf8')),decisions=JSON.parse(fs.readFileSync(decisionsFile,'utf8'));
 const {candidate,report}=buildAudit(snapshot,decisions);fs.mkdirSync(outDir,{recursive:true,mode:0o700});
 for(const [name,value] of [['candidate-snapshot.json',candidate],['review-plan.json',report]])fs.writeFileSync(path.join(outDir,name),JSON.stringify(value,null,2)+'\n',{mode:0o600});
 fs.writeFileSync(path.join(outDir,'review.html'),renderReport(report),{mode:0o600});
 console.log(JSON.stringify(report.summary,null,2));
}
module.exports={buildAudit,validateCandidate,patternText,renderReport};
