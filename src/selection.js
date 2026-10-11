// Web apps cannot extend iOS's native selection menu. Keep a companion action
// above the composer, away from the selection handles and native Copy menu.
export function setupSelectionQuote(){
 const button=document.createElement('button');button.type='button';button.className='pocket-selection-action';button.textContent='Add to chat';button.hidden=true;document.body.append(button);
 let selected='',route='';
 const hide=()=>{button.hidden=true;selected=''};
 function position(){const composer=document.querySelector('.composer');if(!composer)return;button.style.bottom=Math.max(12,innerHeight-composer.getBoundingClientRect().top+8)+'px'}
 function update(){
  const selection=getSelection(),messages=document.querySelector('#messages'),draft=document.querySelector('#draft');
  if(!selection||selection.isCollapsed||!messages||!draft||document.querySelector('dialog[open]'))return hide();
  if(!messages.contains(selection.anchorNode)||!messages.contains(selection.focusNode))return hide();
  selected=selection.toString().trim();route=location.hash;button.hidden=!selected;position();
 }
 // Keep the selection intact until the click has consumed it (mouse and touch).
 button.addEventListener('pointerdown',e=>e.preventDefault());
 button.addEventListener('click',()=>{
  const draft=document.querySelector('#draft');if(!draft||!selected||route!==location.hash)return hide();
  const quote=selected.split(/\r?\n/).map(line=>'> '+line).join('\n');
  draft.value=(draft.value?draft.value.replace(/\s+$/,'')+'\n\n':'')+quote+'\n\n';
  draft.dispatchEvent(new Event('input',{bubbles:true}));hide();getSelection()?.removeAllRanges();draft.focus();draft.setSelectionRange(draft.value.length,draft.value.length);
 });
 document.addEventListener('selectionchange',update);window.addEventListener('hashchange',hide);
 document.addEventListener('scroll',position,true);window.addEventListener('resize',position);window.visualViewport?.addEventListener('resize',position);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')hide()});
}
