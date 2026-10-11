"use strict";
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const release=require("../release.json");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const write=(file,text)=>fs.writeFileSync(path.join(root,file),text);
const icons=release.iconDirectory;
write("locales/base.js",`window.TangoNestInterfaceLocales=${JSON.stringify(require("../locales/registry.js"))};\nwindow.TangoNestEnglish=${JSON.stringify(JSON.parse(read("locales/en.json")))};\n`);
write("config.js",read("config.js").replace(/appVersion:"[^"]+"/,`appVersion:"${release.version}"`));
fs.copyFileSync(path.join(root,"config.js"),path.join(root,"config-rc19-fdg1.js"));
write("style.css",read("style.css").replace(/\.\/assets\/icons\/fdg\d+\/icon-192\.png/g,`./${icons}/icon-192.png`));
fs.copyFileSync(path.join(root,"style.css"),path.join(root,"style-rc19-fdg1.css"));
let html=read("index.html").replace(/\?v=1\.0\.0-rc\.19-fdg\d+/g,`?v=${release.version}`);
html=html.replace(/\.\/assets\/icons\/fdg\d+\/icon-192\.png/g,`./${icons}/icon-192.png`);
write("ui/living-library.css",read("ui/living-library.css").replace(/\.\.\/assets\/icons\/fdg\d+\/icon-64\.png/g,`../${icons}/icon-64.png`));
html=html.replace(/\.\/vendor\/supabase-[^"]+\.js/,`./vendor/supabase-${release.supabaseSdk}.js`);
html=html.replace(/(id="appBuildVersion"[^>]*>)[^<]+/,`$1TangoNest · ${release.version}`);
html=html.replace(/(<link rel="icon" type="image\/png")[^>]*>/,`$1 sizes="32x32" href="./${icons}/icon-32.png">`)
  .replace(/<link rel="icon" href="[^"]+">/,`<link rel="icon" href="./${icons}/favicon.ico">`)
  .replace(/<link rel="apple-touch-icon"[^>]*>\n(?:<link rel="apple-touch-icon"[^>]*>\n)?/,`<link rel="apple-touch-icon" sizes="180x180" href="./${icons}/icon-180.png">\n<link rel="apple-touch-icon" sizes="152x152" href="./${icons}/icon-152.png">\n`)
  .replace(/\.\/icon-192\.png\?v=[^"]+/g,`./${icons}/icon-192.png`);
write("index.html",html);
const manifest=JSON.parse(read("manifest.json"));
manifest.icons=[192,512].map(size=>({src:`${icons}/icon-${size}.png`,sizes:`${size}x${size}`,type:"image/png",purpose:"any"}));
manifest.icons.push({src:`${icons}/maskable-512.png`,sizes:"512x512",type:"image/png",purpose:"maskable"});
for(const shortcut of manifest.shortcuts)shortcut.icons=[{src:`${icons}/icon-192.png`,sizes:"192x192"}];
write("manifest.json",JSON.stringify(manifest,null,2)+"\n");
// These compatibility entrypoints are generated from the canonical sources.
for(const [source,target] of require("./runtime-pairs.json"))fs.copyFileSync(path.join(root,source),path.join(root,target));
let sw=read("sw.js").replace(/const CACHE_VERSION="[^"]+";/,`const CACHE_VERSION="tangonest-shell-v${release.version}";`);
const htmlAssets=[...html.matchAll(/(?:src|href)="(\.\/[^"?#]+)(?:\?[^"#]*)?"/g)].map(match=>match[1]);
const localeAssets=fs.readdirSync(path.join(root,"locales")).filter(file=>file.endsWith(".json")).map(file=>`./locales/${file}`);
const assets=[...new Set(["./","./index.html",...htmlAssets,...localeAssets,...manifest.icons.map(icon=>"./"+icon.src),"./assets/botanical-corner.svg","./assets/forest-study-login-v1.png","./favicon.png","./favicon.ico","./apple-touch-icon.png"])];
assets.push(`./${icons}/icon-64.png`);
for(const asset of assets)if(asset!=="./"&&!fs.existsSync(path.join(root,asset)))throw new Error(`Missing release asset: ${asset}`);
sw=sw.replace(/const SHELL=\[[\s\S]*?\]\.map/,`const SHELL=${JSON.stringify(assets,null,2)}.map`);
write("sw.js",sw);
console.log(`Prepared ${release.version}; ${assets.length} shell assets.`);
