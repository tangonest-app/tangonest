const assert=require('node:assert/strict');
const {buildAudit,validateCandidate,patternText,renderReport}=require('../../tools/chinese-playlist-audit');
const clone=x=>JSON.parse(JSON.stringify(x));
const backup={data:{lists:[{id:'zh',name:'Chinese'},{id:'fr',name:'French'}],words:[{id:'one',listId:'zh',front:'因为～所以',frontLang:'zh-CN',backLang:'ja-JP',pronunciation:'',back:'〜なので',memo:'例文',level:4,saved:true},{id:'two',listId:'fr',front:'bonjour',back:'hello'}],mistakes:[{wordId:'one',wrongCount:2}],meta:{sourceOfTruth:'supabase'}},learningSession:{quizResults:[{score:2}]}};
const decisions={playlistId:'zh',expectedCount:1,reviewedCount:1,changes:[{id:'one',front:'因为～所以',before:{pronunciation:''},after:{pronunciation:'yīnwèi suǒyǐ'},reason:'verified'}],needsReview:[]};
const {candidate,report}=buildAudit(backup,decisions);
assert.equal(backup.data.words[0].pronunciation,'');assert.equal(candidate.data.words[0].front,'因为～所以');assert.equal(report.summary.pinyinFilled,1);assert.equal(report.summary.chineseOriginalChanges,0);assert.equal(report.summary.otherPlaylistChanges,0);
const repeat=buildAudit(candidate,decisions);assert.equal(repeat.report.summary.changedWords,0);assert.equal(repeat.report.summary.alreadyPresent,1);assert.deepEqual(repeat.candidate,candidate);
for(const mutate of [d=>d.changes[0].after.front='changed',d=>d.changes[0].id='two',d=>d.changes[0].before.pronunciation='stale',d=>d.changes[0].after.pronunciation='yīnwèi～suǒyǐ',d=>d.changes.push(clone(d.changes[0])),d=>d.playlistId='fr',d=>d.reviewedCount=0]){const d=clone(decisions);mutate(d);assert.throws(()=>buildAudit(backup,d));}
for(const mutate of [d=>d.data.words[0].front+=' ',d=>d.data.words[0].level=1,d=>d.data.words[0].memo='',d=>d.data.words[1].back='salut',d=>d.learningSession.quizResults=[],d=>d.data.words[0].listId='fr']){const d=clone(candidate);mutate(d);assert.throws(()=>validateCandidate(backup,d,'zh'));}
const bad=clone(backup);bad.data.words[0].frontLang='fr-FR';assert.throws(()=>buildAudit(bad,decisions));
assert.equal(patternText(' 因为～所以〜如果~就 '),'因为 所以 如果 就');assert.equal(decisions.changes[0].front,'因为～所以');
assert(renderReport(report).includes('yīnwèi suǒyǐ'));assert(!renderReport({...report,needsReview:[{front:'<script>x</script>',reason:'&'}]}).includes('<script>x</script>'));
console.log('Chinese audit OK: selective patches, stale values, IDs/languages, original/history/other playlist protection, idempotence and separators.');
