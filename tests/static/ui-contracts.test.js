const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");

const root=path.resolve(__dirname,"../..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const html=read("index.html");
const app=read("app.js");
const library=read("tn-library-management.js");
const flow=read("tn-learning-flow.js");
const style=read("style.css");
const engine=read("learning-engine.js");
const sync=read("tn-supabase-sync.js");

assert.match(html,/ui\/learning-presentation\.js/);
assert.match(html,/Today’s Session/);
assert.match(html,/Show Next button/);
assert.match(html,/Advanced sync details/);
assert.match(html,/role="status" aria-live="polite"/);
assert.doesNotMatch(html,/id="quizNextDelay"/);
assert.doesNotMatch(html,/writes to Supabase|counts are read from Supabase/i);

assert.match(engine,/const CONFIG=Object\.freeze/);
assert.match(engine,/\bCONFIG,\n/);
assert.match(app,/learningPresentation\(\)/);
assert.doesNotMatch(app,/__tnHeroLanguageTimer/);
assert.doesNotMatch(app,/run the Supabase setup first/i);
assert.doesNotMatch(flow,/tn-learning-dashboard/);
assert.doesNotMatch(library,/new MutationObserver/);
assert.match(library,/data-library-view="due"/);
assert.match(library,/tnFilterFavorite/);
assert.match(library,/tnFilterLearning/);
assert.match(library,/tnSortWords/);
assert.match(library,/data-rename-playlist/);
assert.match(library,/data-select-visible/);
assert.match(library,/data-delete-selected/);
assert.match(library,/document\.addEventListener\("change",event => \{/);
assert.doesNotMatch(html,/id="wordsBox"/);
assert.doesNotMatch(sync,/const logout = \$\("tn80LogoutBtn"\)/);
assert.doesNotMatch(sync,/Supabase SDK is still loading|currentUser \? "Supabase Auth"/);
assert.match(sync,/Online sync is temporarily unavailable\. Your saved local data is safe\./);

assert.equal((style.match(/^:root\{/gm)||[]).length,1);
assert.match(style,/TangoNest Design System/);
assert.match(style,/@media\(prefers-reduced-motion:reduce\)/);
assert.match(style,/\.tn-learning-badge\.mastered/);
assert.match(style,/overflow-x:clip/);

console.log("UI_CONTRACTS_TEST_PASS");
