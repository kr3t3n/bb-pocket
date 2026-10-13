// Mail-style gestures: a short swipe reveals a persistent action; a full
// swipe performs it. Keep the row in the list when marking it as read.
export function setupThreadSwipe({markRead,toast}){
 const reveal=108,busy=new Set();let gesture=null,opened=null,blockedRow=null,blockUntil=0;
 function move(row,x,dragging=false){row.classList.toggle('pocket-swipe-dragging',dragging);row.style.setProperty('--swipe-x',x+'px');row.classList.toggle('pocket-swipe-visible',x>0)}
 function close(row=opened){if(!row)return;move(row,0);row.classList.remove('pocket-swipe-ready');const action=row.querySelector('[data-swipe-read]');if(action)action.tabIndex=-1;if(opened===row)opened=null;document.dispatchEvent(new Event('pocket:swipe-close'))}
 function block(row){blockedRow=row;blockUntil=Date.now()+700}
 function prepare(row){
  if(row.querySelector('[data-swipe-read]'))return;
  const surface=getComputedStyle(row).backgroundColor;row.style.setProperty('--swipe-surface',surface==='rgba(0, 0, 0, 0)'?getComputedStyle(document.body).backgroundColor:surface);row.classList.add('pocket-swipe-host');
  const action=document.createElement('button');action.type='button';action.dataset.swipeRead=row.dataset.threadCard;action.className='pocket-swipe-read';action.tabIndex=-1;action.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 7h18v13H3zM3 7l9 7 9-7M7 3l3 3 5-5"/></svg><span>Mark as read</span>';row.prepend(action);
 }
 async function commit(row){const id=row.dataset.threadCard;if(busy.has(id))return;busy.add(id);block(row);row.querySelector('[data-swipe-read]').disabled=true;move(row,row.clientWidth);row.classList.remove('pocket-swipe-ready');if(opened===row)opened=null;
  try{await markRead(id);toast('Marked as read')}catch(e){toast(e.message||'Could not mark thread as read')}finally{busy.delete(id);close(row);const action=row.querySelector('[data-swipe-read]');if(action)action.disabled=false}
 }
 document.addEventListener('pointerdown',e=>{
  if(e.target.closest('[data-swipe-read]')){blockedRow=null;blockUntil=0;gesture=null;e.stopImmediatePropagation();return}
  if(e.button!==0||!e.isPrimary||document.querySelector('dialog[open]'))return;
  const target=e.target.closest('[data-thread-card]');if(opened&&opened!==target)close();
  const row=target?document.querySelector(`[data-thread-card="${CSS.escape(target.dataset.threadCard)}"]`):null;
  if(!row||e.target.closest('[data-thread-menu]')||busy.has(row.dataset.threadCard))return;
  prepare(row);gesture={row,pointer:e.pointerId,x:e.clientX,y:e.clientY,offset:opened===row?reveal:0,position:opened===row?reveal:0,swiping:false};
 },true);
 document.addEventListener('pointermove',e=>{
  const g=gesture;if(!g||e.pointerId!==g.pointer)return;if(document.querySelector('dialog[open]')){close(g.row);gesture=null;return}
  const dx=e.clientX-g.x,dy=e.clientY-g.y;
  if(!g.swiping){if(Math.abs(dy)>10&&Math.abs(dy)>=Math.abs(dx)){close(g.row);gesture=null;return}if(Math.abs(dx)<14)return;g.swiping=true;g.row.setPointerCapture?.(e.pointerId)}
  block(g.row);e.preventDefault();g.position=Math.max(0,Math.min(g.row.clientWidth,g.offset+dx));move(g.row,g.position,true);g.row.classList.toggle('pocket-swipe-ready',g.position>=g.row.clientWidth*.7);
 },{passive:false});
 document.addEventListener('pointerup',e=>{
  const g=gesture;if(!g||e.pointerId!==g.pointer)return;gesture=null;if(!g.swiping)return;
  block(g.row);if(g.position>=g.row.clientWidth*.7){commit(g.row);return}
  if(g.position>=48){opened=g.row;move(g.row,reveal);g.row.classList.remove('pocket-swipe-ready');g.row.querySelector('[data-swipe-read]').tabIndex=0}else close(g.row);
 });
 function cancel(){if(gesture)close(gesture.row);gesture=null;close()}
 document.addEventListener('pointercancel',cancel);window.addEventListener('hashchange',cancel);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')cancel()});
 document.addEventListener('click',e=>{
  const row=e.target.closest('[data-thread-card]');if(row&&row.dataset.threadCard===blockedRow?.dataset.threadCard&&Date.now()<blockUntil){e.preventDefault();e.stopImmediatePropagation();return}
  const action=e.target.closest('[data-swipe-read]');if(action){e.preventDefault();e.stopImmediatePropagation();commit(action.closest('[data-thread-card]'));return}
  if(row&&row===opened){e.preventDefault();e.stopImmediatePropagation();close(row)}
 },true);
}
