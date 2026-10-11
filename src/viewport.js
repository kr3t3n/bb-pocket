// The outer conversation page is locked. Only the message list scrolls.
// Never feed document scrollY back into layout: Safari focus scrolling can
// otherwise move the input again and cause a repeating scroll/layout loop.
export function setupViewport(){
 const root=document.documentElement;
 function update(){
  const v=window.visualViewport,height=v?.height||innerHeight,offset=v?.offsetTop||0;
  const set=(key,value)=>{if(root.style.getPropertyValue(key)!==value)root.style.setProperty(key,value)};
  set('--app-height',height+'px');
  set('--app-top',offset+'px');
  const keyboard=innerHeight-height>120;
  set('--keyboard-inset',keyboard?'0px':'env(safe-area-inset-bottom)');
  document.body.classList.toggle('keyboard',keyboard);root.classList.toggle('keyboard',keyboard);
 }
 let timers=[];
 function settle(){timers.forEach(clearTimeout);update();timers=[120,350,700].map(delay=>setTimeout(update,delay))}
 window.visualViewport?.addEventListener('resize',update);window.visualViewport?.addEventListener('scroll',update);
 window.addEventListener('resize',update);
 document.addEventListener('focusin',settle);document.addEventListener('focusout',settle);window.addEventListener('pageshow',settle);update();
}
