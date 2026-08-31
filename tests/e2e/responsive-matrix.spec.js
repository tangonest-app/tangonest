const {test,expect,openTestApp,navigateToPage}=require("./fixtures");

const VIEWPORTS=[
  ["windows-laptop",1366,768],
  ["desktop-full-hd",1920,1080],
  ["ipad-landscape",1024,768],
  ["ipad-portrait",768,1024],
  ["iphone-se",375,667],
  ["iphone-pro",393,852],
  ["android-small",360,800],
  ["android-large",412,915]
];

async function layoutAudit(page,label){
  const result=await page.evaluate(()=>{
    const visible=element=>{
      const style=getComputedStyle(element);
      const rect=element.getBoundingClientRect();
      return style.display!=="none"&&style.visibility!=="hidden"&&rect.width>0&&rect.height>0;
    };
    const selectors=[
      ".header",".page.active",".home-focus",".tn-today-card","#homeLists .playlist-card",
      "#homeLists .playlist-main","#homeLists .playlist-stats","#homeLists .playlist-actions",
      ".tn-today-grid button",".tn-recent-strip button",".progress-card",".tn-voice-row",".tn-voice-controls"
    ];
    const overflow=[];
    for(const selector of selectors){
      document.querySelectorAll(selector).forEach((element,index)=>{
        if(!visible(element))return;
        const rect=element.getBoundingClientRect();
        if(element.scrollWidth>element.clientWidth+1||rect.left<-.5||rect.right>innerWidth+.5){
          overflow.push({selector,index,clientWidth:element.clientWidth,scrollWidth:element.scrollWidth,left:rect.left,right:rect.right});
        }
      });
    }
    document.querySelectorAll("#homeLists .playlist-card").forEach((card,cardIndex)=>{
      const parent=card.getBoundingClientRect();
      card.querySelectorAll(".playlist-main,.playlist-stats,.playlist-actions").forEach((child,index)=>{
        const rect=child.getBoundingClientRect();
        if(rect.left<parent.left-.5||rect.right>parent.right+.5||rect.top<parent.top-.5||rect.bottom>parent.bottom+.5){
          overflow.push({selector:`playlist-card-${cardIndex}-child`,index,left:rect.left,right:rect.right,parentLeft:parent.left,parentRight:parent.right});
        }
      });
    });
    const brand=document.querySelector(".app-sidebar .brand");
    const mark=brand?.querySelector(".brand-mark");
    const title=brand?.querySelector("h1");
    const brandOffset=brand&&visible(brand)&&mark&&title
      ? Math.abs(mark.getBoundingClientRect().top-title.getBoundingClientRect().top)
      : 0;
    return {viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,overflow,brandOffset};
  });
  expect(result.documentWidth,`${label}: document width`).toBeLessThanOrEqual(result.viewport);
  expect(result.overflow,`${label}: controls stay within their containers`).toEqual([]);
  expect(result.brandOffset,`${label}: logo and title share a visual top edge`).toBeLessThanOrEqual(6);
}

for(const [name,width,height] of VIEWPORTS){
  test(`${name} stays composed at ${width}x${height}`,async({page})=>{
    await page.setViewportSize({width,height});
    await openTestApp(page,{wordCount:1014,listCount:2});
    await layoutAudit(page,`${name} home`);
    await navigateToPage(page,"settings");
    await layoutAudit(page,`${name} settings`);
    await navigateToPage(page,"library");
    await layoutAudit(page,`${name} library`);
  });
}
