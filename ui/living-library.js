(function(){
  "use strict";
  const root=document.documentElement,$=id=>document.getElementById(id);
  const reduced=matchMedia("(prefers-reduced-motion: reduce)"),fine=matchMedia("(hover: hover) and (pointer: fine)");
  const atmosphereKey="tangonest_atmosphere_v1";
  let atmosphere="auto",timer=null,parallaxFrame=0,lastPage="",pointer={x:0,y:0};
  const animations=new WeakMap();
  function duration(token){return parseFloat(getComputedStyle(root).getPropertyValue(token))||0;}
  function enter(element,study=false){
    if(!element||reduced.matches||document.hidden||!element.animate)return;
    animations.get(element)?.cancel();
    // Preserve text contrast throughout navigation, including the first animation frame.
    const animation=element.animate([{transform:study?"none":"translateY(5px)"},{transform:"none"}],{duration:duration(study?"--motion-fast":"--motion-normal"),easing:getComputedStyle(root).getPropertyValue("--ease-enter").trim()});
    animations.set(element,animation);
  }
  // Container-only WAAPI avoids document snapshot input blocking on large libraries.
  window.TangoNestMotion=Object.freeze({enter,swap(element,update){update();enter(element);},reduced:()=>reduced.matches});
  function timeAtmosphere(date=new Date()){
    const hour=date.getHours();return hour<6||hour>=21?"night":hour<11?"morning":hour<17?"day":"evening";
  }
  function updateAtmosphere(){
    clearTimeout(timer);
    root.dataset.atmosphere=atmosphere==="auto"?timeAtmosphere():atmosphere;
    if($("atmosphereMode"))$("atmosphereMode").value=atmosphere;
    if(atmosphere!=="auto"||document.hidden)return;
    const now=new Date(),next=new Date(now);next.setHours([6,11,17,21,30].find(hour=>hour>now.getHours()),0,0,0);
    timer=setTimeout(updateAtmosphere,Math.max(1000,next-now));
  }
  try{const saved=localStorage.getItem(atmosphereKey);if(["auto","morning","day","evening","night"].includes(saved))atmosphere=saved;}catch(error){}
  $("atmosphereMode")?.addEventListener("change",event=>{atmosphere=event.target.value;try{localStorage.setItem(atmosphereKey,atmosphere)}catch(error){}updateAtmosphere();});
  function setScenePosition(x=0,y=0){const scene=document.querySelector(".tn-atmosphere-scene");scene?.style.setProperty("--scene-x",`${x}px`);scene?.style.setProperty("--scene-y",`${y}px`);}
  function discovery(){return ["pageHome","pageWords"].includes(lastPage)&&!reduced.matches&&fine.matches&&!document.hidden;}
  function resetParallax(){cancelAnimationFrame(parallaxFrame);parallaxFrame=0;setScenePosition();}
  window.addEventListener("pointermove",event=>{
    if(!discovery())return;
    pointer={x:(event.clientX/innerWidth-.5)*4,y:(event.clientY/innerHeight-.5)*4};
    if(!parallaxFrame)parallaxFrame=requestAnimationFrame(()=>{parallaxFrame=0;if(discovery())setScenePosition(pointer.x,pointer.y);});
  },{passive:true});
  document.documentElement.addEventListener("pointerleave",resetParallax);
  const nav=document.querySelector(".nav"),indicator=document.createElement("span");
  indicator.className="tn-nav-indicator";indicator.setAttribute("aria-hidden","true");nav?.prepend(indicator);
  function placeIndicator(){const selected=nav?.querySelector("button.active");if(!selected)return;indicator.style.setProperty("--nav-y",`${selected.offsetTop}px`);indicator.style.setProperty("--nav-height",`${selected.offsetHeight}px`);}
  function pageChanged(){
    const page=document.querySelector(".page.active");if(!page)return;
    const changed=page.id!==lastPage;lastPage=page.id;
    document.body.dataset.motionMode=["pageStudy","pageQuiz","pageAudio"].includes(lastPage)?"study":"discovery";
    if(!discovery())resetParallax();
    if(changed)enter(page,document.body.dataset.motionMode==="study");
    placeIndicator();
  }
  const observer=new MutationObserver(records=>{if(records.some(record=>record.target.classList.contains("page")))pageChanged();});
  document.querySelectorAll(".page").forEach(page=>observer.observe(page,{attributes:true,attributeFilter:["class"]}));
  const resize=new ResizeObserver(placeIndicator);if(nav)resize.observe(nav);
  document.addEventListener("visibilitychange",()=>{updateAtmosphere();if(document.hidden){resetParallax();document.body.classList.add("tn-background-paused");}else{document.body.classList.remove("tn-background-paused");pageChanged();}});
  reduced.addEventListener("change",()=>{resetParallax();if(reduced.matches)document.getAnimations().forEach(animation=>animation.cancel());});
  window.addEventListener("tn:locale",()=>{placeIndicator();});
  window.addEventListener("pagehide",()=>{clearTimeout(timer);resetParallax();});
  window.addEventListener("pageshow",updateAtmosphere);
  updateAtmosphere();pageChanged();
  window.TangoNestAtmosphere=Object.freeze({timeAtmosphere,get:()=>atmosphere});
})();
