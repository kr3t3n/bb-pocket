export function setupThreadSwipe({markRead,toast}){
 let gesture=null,blockUntil=0,busy=new Set();
 function reset(){if(gesture){gesture.row.classList.remove('pocket-swiping','pocket-swipe-ready');gesture.content.style.transform=''}gesture=null}
 document.addEventListener('pointerdown',e=>{
  if(e.button!==0||!e.isPrimary||document.querySelector('dialog[open]'))return;
  const row=e.target.closest('[data-thread-card]');if(!row||e.target.closest('[data-thread-menu]')||busy.has(row.dataset.threadCard))return;
  reset();gesture={row,content:row.querySelector('[data-thread]'),id:row.dataset.threadCard,pointer:e.pointerId,x:e.clientX,y:e.clientY,dx:0,swiping:false};
 });
 document.addEventListener('pointermove',e=>{
  const g=gesture;if(!g||e.pointerId!==g.pointer)return;const dx=e.clientX-g.x,dy=e.clientY-g.y;
  if(!g.swiping){if(Math.abs(dy)>10&&Math.abs(dy)>=Math.abs(dx)){reset();return}if(Math.abs(dx)<14)return;g.swiping=true;g.row.setPointerCapture?.(e.pointerId)}
  g.dx=dx;blockUntil=Date.now()+700;e.preventDefault();g.row.classList.toggle('pocket-swiping',dx>0);g.row.classList.toggle('pocket-swipe-ready',dx>=80);g.content.style.transform=`translateX(${Math.min(112,Math.max(0,dx))}px)`;
 },{passive:false});
 document.addEventListener('pointerup',async e=>{
  const g=gesture;if(!g||e.pointerId!==g.pointer)return;const commit=g.swiping&&g.dx>=80;if(g.swiping)blockUntil=Date.now()+700;reset();if(!commit)return;
  busy.add(g.id);try{await markRead(g.id);toast('Marked as read')}catch(e){toast(e.message||'Could not mark thread as read')}finally{busy.delete(g.id)}
 });
 document.addEventListener('pointercancel',reset);window.addEventListener('hashchange',reset);
 document.addEventListener('click',e=>{if(Date.now()<blockUntil&&e.target.closest('[data-thread-card]')){e.preventDefault();e.stopImmediatePropagation()}},true);
}
