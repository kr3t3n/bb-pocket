// Usage is scoped to the thread's execution host and provider. Model windows
// apply only to an exact known model; no provider-family aliases are inferred.
export function threadUsageLimit(thread, usage, now=Date.now()) {
 if(!thread?.environmentHostId||usage?.hostId!==thread.environmentHostId||usage.stale||usage.warning)return null;
 const provider=usage.providers?.[thread.providerId];
 if(provider?.status!=='ok'||!Array.isArray(provider.windows))return null;
 const exhausted=provider.windows.filter(w=>{
  if(!w||!Number.isFinite(w.usedPercent)||w.usedPercent<100)return false;
  if(w.model!=null&&(!thread.model||w.model!==thread.model))return false;
  if(w.model==null&&/\b(fable|sonnet|opus|haiku)\b/i.test(w.label||''))return false;
  const reset=w.resetsAt?Date.parse(w.resetsAt):NaN;
  return !Number.isFinite(reset)||reset>now;
 });
 if(!exhausted.length)return null;
 // All exhausted windows must reset before allowance is available again.
 const resets=exhausted.map(w=>w.resetsAt?Date.parse(w.resetsAt):NaN);
 return {resetsAt:resets.every(Number.isFinite)?new Date(Math.max(...resets)).toISOString():null};
}

export function threadUsageBadge(thread, usage, name, esc) {
 const limit=usage.limit(thread);if(!limit)return '';
 const reset=limit.resetsAt?' Resets '+new Date(limit.resetsAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})+'.':'';
 const label=name+' usage limit reached.'+reset;
 return `<span class="usage-badge" role="img" aria-label="${esc(label)}" title="${esc(label)}"><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 2h8M4 14h8M5 2v3l3 3-3 3v3M11 2v3L8 8l3 3v3" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
}

// Keep per-host reads in memory only. Device-cached counters never mark rows.
export function createThreadUsage({api,onChange=()=>{},now=()=>Date.now()}) {
 const hosts=new Map();
 return {
  limit(thread){const state=hosts.get(thread.environmentHostId);return state&&!state.error&&now()-state.refreshed<60000?threadUsageLimit(thread,state.usage,now()):null},
  async refresh(threads=[],force=false){
   const ids=[...new Set(threads.map(t=>t.environmentHostId).filter(id=>typeof id==='string'&&id))];
   await Promise.all(ids.map(async hostId=>{
    let state=hosts.get(hostId);if(!state){state={checked:0,refreshed:0,pending:false,usage:null,error:false};hosts.set(hostId,state)}
    if(state.pending||(!force&&state.checked&&now()-state.checked<(state.error?15000:60000)))return;
    state.pending=true;state.checked=now();
    try{const usage=await api('usage?hostId='+encodeURIComponent(hostId),undefined,12000);state.usage=usage;state.refreshed=now();state.error=!!(usage.stale||usage.warning)}catch{state.usage=null;state.error=true}
    finally{state.pending=false;onChange()}
   }));
  },
 };
}

// Keep the row's existing activation behavior. Only tapping the badge opens details.
export function setupUsageBadgeTooltip() {
 if(document.getElementById('pocket-usage-tooltip'))return;
 const tip=document.createElement('div');tip.id='pocket-usage-tooltip';tip.className='pocket-usage-tooltip';tip.role='tooltip';tip.hidden=true;document.body.append(tip);
 let activeBadge=null,describedRow=null;
 const hide=()=>{
  tip.hidden=true;activeBadge=null;
  if(describedRow){const ids=(describedRow.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!==tip.id);if(ids.length)describedRow.setAttribute('aria-describedby',ids.join(' '));else describedRow.removeAttribute('aria-describedby');describedRow=null}
 };
 const show=badge=>{
  hide();activeBadge=badge;tip.textContent=badge.getAttribute('aria-label');tip.hidden=false;
  const row=badge.closest('[data-thread]');if(row&&document.activeElement===row){describedRow=row;row.setAttribute('aria-describedby',[(row.getAttribute('aria-describedby')||''),tip.id].filter(Boolean).join(' '))}
  const r=badge.getBoundingClientRect(),box=tip.getBoundingClientRect();
  tip.style.left=Math.max(8,Math.min(r.left,innerWidth-box.width-8))+'px';
  tip.style.top=Math.max(8,Math.min(r.top>=box.height+16?r.top-box.height-8:r.bottom+8,innerHeight-box.height-8))+'px';
 };
 document.addEventListener('pointerover',e=>{const badge=e.target.closest?.('.usage-badge');if(badge)show(badge)});
 document.addEventListener('pointerout',e=>{if(activeBadge&&e.target.closest?.('.usage-badge')===activeBadge&&!activeBadge.contains(e.relatedTarget)&&document.activeElement!==activeBadge.closest('[data-thread]'))hide()});
 document.addEventListener('focusin',e=>{const badge=e.target.closest?.('[data-thread]')?.querySelector('.usage-badge');if(badge)show(badge);else hide()});
 document.addEventListener('focusout',e=>{if(e.target===describedRow)hide()});
 document.addEventListener('click',e=>{const badge=e.target.closest?.('.usage-badge');if(!badge)return;e.preventDefault();e.stopImmediatePropagation();show(badge)},true);
 document.addEventListener('pointerdown',e=>{if(!e.target.closest?.('.usage-badge'))hide()},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')hide()});
 document.addEventListener('scroll',hide,true);window.addEventListener('resize',hide);
 new MutationObserver(()=>{if(activeBadge&&!activeBadge.isConnected)hide()}).observe(document.body,{childList:true,subtree:true});
}
