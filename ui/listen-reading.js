(function(){
  "use strict";
  const $=id=>document.getElementById(id),t=key=>window.TNI18n.t(key);
  const player=document.querySelector("#pageAudio .audio-player");
  const status=document.createElement("p");status.className="listen-state";status.setAttribute("role","status");
  player.querySelector(".tn-player-controls").before(status);
  const section=document.createElement("details");section.className="listen-reading";
  const title=document.createElement("summary");title.textContent=t("ui.words");section.appendChild(title);
  const follow=document.createElement("button");follow.type="button";follow.hidden=true;follow.textContent=t("listen.followCurrent");section.appendChild(follow);
  const list=document.createElement("ol");section.appendChild(list);player.appendChild(section);
  let following=true,queueSignature="",currentState="idle";
  function state(value){
    currentState=value;
    const keys={idle:"ui.choose_a_playlist_and_press_play",preparing:"listen.preparing",playing:"ui.now_playing",waiting:"listen.waiting",completed:"listen.completed",paused:"listen.resumeHint",error:"ui.voice_playback_failed_try_another_voice_in_settings",unavailable:"ui.voice_playback_failed_try_another_voice_in_settings"};
    const errors=typeof listenRun!=="undefined"?listenRun.errors:[];
    status.textContent=t(keys[value]||keys.idle)+(errors.length?" · "+t("listen.failedParts")+": "+errors.length+" ("+errors.at(-1).reason+")":"");
    const play=document.querySelector('[onclick="startAudio()"]');
    if(play)window.TNI18n.bindText(play,()=>t(["paused","error","unavailable"].includes(currentState)?"quiz.resumeAdvance":"listen.play"));
    if(value==="idle"){list.replaceChildren();queueSignature="";follow.hidden=true;following=true}
  }
  function track(){
    const row=list.querySelector("[aria-current='true']");
    if(row&&section.open){list.scrollTo({top:row.offsetTop-list.offsetTop,behavior:"instant"})}
  }
  function update(){
    const signature=JSON.stringify(audioQueue.map(word=>[word.id,word.front,word.back]));
    if(signature!==queueSignature){
      queueSignature=signature;list.replaceChildren();
      for(const [index,word]of audioQueue.entries()){
        const row=document.createElement("li"),button=document.createElement("button");button.type="button";
        const front=document.createElement("bdi"),back=document.createElement("bdi");front.textContent=word.front;back.textContent=word.back;
        button.append(front,back);button.onclick=()=>selectAudioItem(index);
        row.appendChild(button);list.appendChild(row);
      }
    }
    [...list.children].forEach((row,index)=>row.setAttribute("aria-current",String(index===audioIndex-1)));
    if(following)track();
  }
  const browse=()=>{following=false;follow.hidden=false};
  list.addEventListener("wheel",browse,{passive:true});list.addEventListener("touchmove",browse,{passive:true});
  list.addEventListener("keydown",event=>{if(["ArrowDown","ArrowUp","PageDown","PageUp","Home","End","Tab"].includes(event.key))browse()});
  follow.onclick=()=>{following=true;follow.hidden=true;track()};
  section.addEventListener("toggle",()=>{if(following)track()});
  window.addEventListener("tn:locale",()=>{title.textContent=t("ui.words");follow.textContent=t("listen.followCurrent");state(currentState)});
  window.tnListenReading={state,update};state("idle");
})();
