// A companion to the native selection menu. Keep a snapshot: Safari may clear
// its selection while dismissing the native menu, before delivering our tap.
export function setupSelectionQuote(){
 const bar=document.createElement('div');bar.className='pocket-selection-bar';bar.hidden=true;
 const button=document.createElement('button');button.type='button';button.className='pocket-selection-action';button.textContent='Add to chat';
 const dismiss=document.createElement('button');dismiss.type='button';dismiss.className='pocket-selection-dismiss';dismiss.textContent='×';dismiss.setAttribute('aria-label','Dismiss selected quote');
 bar.append(button,dismiss);document.body.append(bar);
 let selected='',route='';
 const hide=()=>{bar.hidden=true;selected=''};
 function position(){const composer=document.querySelector('.composer');if(!composer)return;bar.style.bottom=Math.max(12,innerHeight-composer.getBoundingClientRect().top+8)+'px'}
 function update(){
  const selection=getSelection(),messages=document.querySelector('#messages'),draft=document.querySelector('#draft');
  if(!messages||!draft||document.querySelector('dialog[open]')||(selected&&route!==location.hash))return hide();
  // Collapsing the native highlight is not a cancellation. Keep the captured
  // quote until used, explicitly dismissed, or the user starts editing.
  if(!selection||selection.isCollapsed)return;
  if(!messages.contains(selection.anchorNode)||!messages.contains(selection.focusNode))return hide();
  const text=selection.toString().trim();if(!text)return;
  selected=text;route=location.hash;bar.hidden=false;button.title=text.slice(0,200);position();
 }
 function add(){
  const draft=document.querySelector('#draft');if(!draft||!selected||route!==location.hash||document.querySelector('dialog[open]'))return hide();
  const quote=selected.split(/\r?\n/).map(line=>'> '+line).join('\n');
  draft.value=(draft.value?draft.value.replace(/\s+$/,'')+'\n\n':'')+quote+'\n\n';
  hide();getSelection()?.removeAllRanges();draft.dispatchEvent(new Event('input',{bubbles:true}));draft.focus({preventScroll:true});draft.setSelectionRange(draft.value.length,draft.value.length);
 }
 // Handle touchend directly; do not depend on Safari synthesizing a click
 // after a tap dismisses its native callout. Clearing selected prevents doubles.
 for(const [control,action] of [[button,add],[dismiss,()=>{hide();getSelection()?.removeAllRanges()}]]){
  control.addEventListener('pointerdown',e=>e.preventDefault());
  control.addEventListener('touchend',e=>{e.preventDefault();action()},{passive:false});
  control.addEventListener('click',action);
 }
 document.addEventListener('selectionchange',update);
 document.addEventListener('touchend',()=>setTimeout(update,0),{passive:true});
 document.addEventListener('pointerup',()=>setTimeout(update,0));
 document.addEventListener('focusin',e=>{if(e.target.matches('input,textarea,[contenteditable=true]'))hide()});
 document.addEventListener('input',e=>{if(e.target.id==='draft')hide()});
 window.addEventListener('hashchange',hide);
 document.addEventListener('scroll',position,true);window.addEventListener('resize',position);window.visualViewport?.addEventListener('resize',position);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')hide()});
}
