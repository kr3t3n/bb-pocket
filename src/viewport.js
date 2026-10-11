// Keep the conversation in document coordinates. iOS can scroll the document
// while focusing a textarea even when body overflow is hidden; fixed-position
// keyboard compensation alone then leaves a gap or clips the header.
export function setupViewport(){
 const root=document.documentElement;
 function update(){
  const v=window.visualViewport,height=v?.height||innerHeight,offset=v?.offsetTop||0;
  root.style.setProperty('--app-height',height+'px');
  root.style.setProperty('--app-top',offset+'px');
  root.style.setProperty('--app-page-top',(window.scrollY+offset)+'px');
  const keyboard=innerHeight-height>120;
  root.style.setProperty('--keyboard-inset',keyboard?'0px':'env(safe-area-inset-bottom)');
  document.body.classList.toggle('keyboard',keyboard);root.classList.toggle('keyboard',keyboard);
 }
 let frame=0;
 function settle(){cancelAnimationFrame(frame);const until=performance.now()+700;const tick=()=>{update();if(performance.now()<until)frame=requestAnimationFrame(tick)};tick()}
 window.visualViewport?.addEventListener('resize',update);window.visualViewport?.addEventListener('scroll',update);
 window.addEventListener('resize',update);window.addEventListener('scroll',update,{passive:true});
 document.addEventListener('focusin',settle);document.addEventListener('focusout',settle);window.addEventListener('pageshow',settle);update();
}
