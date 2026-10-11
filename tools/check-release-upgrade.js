const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const oldLabel=process.env.TN_UPGRADE_BASELINE||'fdg13',newLabel=require('../release.json').version.match(/fdg\d+$/)[0];
const oldRoot=path.resolve('../TangoNest_'+oldLabel.toUpperCase()+'_REVIEW_CANDIDATE'),newRoot=process.cwd();
let root=oldRoot;
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,`.${name==='/'?'/index.html':name}`);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});
  fs.createReadStream(file).pipe(res);
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch();
  try{
    const page=await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(()=>navigator.serviceWorker.controller);
    await page.evaluate(async()=>{await TNI18n.setLocale('ja');localStorage.setItem('qa-upgrade-sentinel','preserved');});
    assert((await page.evaluate(()=>caches.keys())).some(key=>key.includes(oldLabel)));
    root=newRoot;
    await page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration.update();});
    await page.waitForFunction(async({oldLabel,newLabel})=>{const keys=await caches.keys();return keys.some(key=>key.includes(newLabel))&&!keys.some(key=>key.includes(oldLabel));},{oldLabel,newLabel});
    await page.reload();
    await page.waitForFunction(()=>window.TNI18n?.locale==='ja');
    assert.equal(await page.evaluate(()=>TNI18n.t('navigation.home')),'Home');
    assert.equal(await page.evaluate(()=>localStorage.getItem('qa-upgrade-sentinel')),'preserved');
    assert.equal(await page.evaluate(()=>QUIZ_NEXT_TIMING.correct),1200);
    console.log(oldLabel+' -> '+newLabel+': old shell removed, updated code loaded, saved locale and browser data preserved.');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
