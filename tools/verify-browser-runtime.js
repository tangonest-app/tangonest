"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),assert=require("node:assert/strict");
const {chromium}=require("playwright"),root=path.resolve(__dirname,"..");
const base=new URL(process.argv[2]||"http://127.0.0.1:4173/");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const expected=[...html.matchAll(/<script[^>]+src="\.\/([^"?]+)(?:\?[^"#]*)?"/g)].map(m=>m[1]);
const hash=data=>crypto.createHash("sha256").update(data).digest("hex");
(async()=>{
  const browser=await chromium.launch(),errors=[],responses=new Map();
  try{
    // Fresh isolated context: no user credentials, no sign-in or cloud mutations.
    const context=await browser.newContext({serviceWorkers:"block",locale:"en-US"});
    const page=await context.newPage();
    page.on("pageerror",error=>errors.push(error.message));
    page.on("response",response=>{const url=new URL(response.url());if(url.origin===base.origin&&url.pathname.startsWith(base.pathname))responses.set(url.pathname.slice(base.pathname.length),response)});
    await page.goto(base.href,{waitUntil:"networkidle"});
    await page.locator("#authScreen").waitFor({state:"visible"});
    for(const file of expected){
      const response=responses.get(file);assert.ok(response,`Browser did not load ${file}`);
      assert.equal(response.status(),200,file);
      assert.equal(hash(await response.body()),hash(fs.readFileSync(path.join(root,file))),`Loaded bytes differ: ${file}`);
    }
    const release=require("../release.json");
    assert.ok((await page.locator("#appBuildVersion").textContent()).includes(release.version));
    assert.deepEqual(errors,[]);
    console.log(`Browser loading OK: ${expected.length} scripts; ${release.version}; ${base.href}; no page errors.`);
  }finally{await browser.close()}
})().catch(error=>{console.error(error.message);process.exitCode=1});
