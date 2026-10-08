// Shared UI primitives: icons, escaping, bottom sheets and toasts.
export const $=s=>document.querySelector(s);
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const paths={
 threads:'M20 11.5a8 8 0 0 1-11.8 7L4 20l1.3-3.9A8 8 0 1 1 20 11.5Z',
 tasks:'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM8 12l3 3 5-6',
 projects:'M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z',
 search:'m21 21-4.6-4.6M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0',
 filter:'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
 back:'m15 5-7 7 7 7',
 send:'M12 19V5m-6 6 6-6 6 6',
 refresh:'M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 2M18 18a8 8 0 0 1-13-2',
 close:'m6 6 12 12M6 18 18 6',
 more:'M12 5h.01M12 12h.01M12 19h.01',
 plus:'M12 5v14M5 12h14',
 clip:'M20.5 11.5 12.4 19.6a5.3 5.3 0 0 1-7.5-7.5l8.2-8.2a3.6 3.6 0 0 1 5 5l-8.2 8.2a1.8 1.8 0 0 1-2.5-2.5l7.6-7.6',
 chevron:'m9 6 6 6-6 6',
 down:'m6 9 6 6 6-6',
 pin:'M12 16v5M9 3h6l-1 6 4 4v3H6v-3l4-4-1-6Z',
 stop:'M8 8h8v8H8Z',
 share:'M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
 external:'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
 copy:'M9 9h10v10H9ZM15 9V5H5v10h4',
 link:'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
 check:'m5 12 5 5 9-10',
 edit:'M4 20h4L19 9l-4-4L4 16v4ZM13 7l4 4',
 archive:'M3 5h18v4H3ZM5 9v10h14V9M10 13h4',
 trash:'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
 eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
 dot:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
 split:'M4 4h16v16H4ZM12 4v16',
 bolt:'M13 2 4 14h7l-1 8 9-12h-7l1-8Z',
 alert:'M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
 file:'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8ZM14 3v5h5',
 arrowdown:'M12 5v14m-6-6 6 6 6-6',
 gauge:'M12 14l4-4M3.5 18a9 9 0 1 1 17 0',
 tool:'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4Z',
 draft:'M4 20h4L19 9l-4-4L4 16v4Z',
 inbox:'M3 13h5l1 3h6l1-3h5M5 5h14l2 8v6H3v-6Z'
};
export function icon(name,width=1.7){return `<svg class="i i-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${name==='more'?3:width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.threads}"/></svg>`}

let toastTimer;
export function toast(text){const el=$('#toast');el.textContent=text;el.classList.remove('show');void el.offsetWidth;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3600)}

// Bottom sheet built on the single #sheet dialog. Variants set a class name.
export const sheet=$('#sheet');
export function openSheet(html,variant=''){sheet.className=variant;sheet.innerHTML=html;sheet.style.transform='';if(!sheet.open)sheet.showModal()}
export function sheetHead(title,{sub='',left=''}={}){return `<div class="grabber" aria-hidden="true"></div><header class="sheethead">${left}<div class="sheettitle"><h2>${esc(title)}</h2>${sub?`<small>${sub}</small>`:''}</div><button type="button" class="iconbtn ghost" data-action="close" aria-label="Close">${icon('close')}</button></header>`}

// Tap the backdrop to close; drag the grabber or header down to dismiss.
sheet.addEventListener('click',e=>{if(e.target===sheet&&!sheet.classList.contains('newthreadsheet'))sheet.close()});
let drag=null;
sheet.addEventListener('pointerdown',e=>{if(sheet.classList.contains('newthreadsheet')||!e.target.closest('.grabber,.sheethead')||e.target.closest('button,input,select,a'))return;drag={y:e.clientY,dy:0,id:e.pointerId};sheet.style.transition='none'});
sheet.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;drag.dy=Math.max(0,e.clientY-drag.y);sheet.style.transform=`translateY(${drag.dy}px)`},{passive:true});
function endDrag(){if(!drag)return;const dy=drag.dy;drag=null;sheet.style.transition='';if(dy>90){sheet.style.transform='translateY(100%)';setTimeout(()=>{sheet.close();sheet.style.transform=''},160)}else sheet.style.transform=''}
sheet.addEventListener('pointerup',endDrag);sheet.addEventListener('pointercancel',endDrag);
