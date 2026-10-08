import {providerIcons} from './provider-icons.js';
import {icon} from './ui.js';

// Full-screen New thread sheet. Settings are grouped rows; the first message is pinned above the keyboard.
export function setupNewThread({api,esc,read,save,sheet,navigate,toast}){
 let draft=read('newThreadDraft',{}),catalog=null,projects=[],serial=0,busy=false;
 const $=s=>sheet.querySelector(s),opt=(id,label,value)=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(label)}</option>`;
 const pick=(name,label,options,valueLabel,mark='')=>`<div class="pickrow"><span class="pk">${label}</span><span class="pv">${mark}<span>${esc(valueLabel)}</span></span>${icon('chevron',2)}<select id="new-${name}" name="${name}" aria-label="${label}">${options}</select></div>`;
 const seg=(name,label,items,value)=>`<div class="segrow"><span class="pk" id="new-${name}-label">${label}</span><div class="seg wrap" role="radiogroup" aria-labelledby="new-${name}-label" id="new-${name}">${items.map(([id,text,mark])=>`<label class="segopt"><input type="radio" name="${name}" value="${esc(id)}" ${id===value?'checked':''}><span>${mark||''}${esc(text)}</span></label>`).join('')}</div></div>`;
 const store=()=>save('newThreadDraft',draft);
 function message(text,tone=''){const el=$('#new-status');if(el){el.textContent=text;el.className=tone;el.hidden=!text}}
 function pending(){return read('newThreadPending',null)}
 function state(){const p=pending();for(const el of sheet.querySelectorAll('#new-thread-form input,#new-thread-form select,#new-thread-form textarea'))el.disabled=busy||!!p;if($('#new-start')){$('#new-start').disabled=busy||!!p||!catalog?.models?.length;$('#new-start').classList.toggle('busy',busy);$('#new-pending').hidden=!p}}
 function summary(){const el=$('#new-summary');if(!el||!catalog)return;const m=catalog.models.find(x=>x.model===draft.model),p=catalog.providers.find(x=>x.id===draft.providerId);el.innerHTML=`${providerIcons[draft.providerId]||''}<span>${esc(m?.displayName||'')}${draft.reasoningLevel?' · '+esc(draft.reasoningLevel):''}</span>`;el.title=p?.displayName||''}
 function modelFields(){
  if(!catalog)return;
  const model=catalog.models.find(m=>m.model===draft.model),provider=catalog.providers.find(p=>p.id===draft.providerId);
  if(!model)return;
  const efforts=model.supportedReasoningEfforts||[];if(!efforts.some(e=>e.reasoningEffort===draft.reasoningLevel))draft.reasoningLevel=efforts.some(e=>e.reasoningEffort===model.defaultReasoningEffort)?model.defaultReasoningEffort:'';
  const ranks={'accept-edits':0,auto:1,full:2},permissions=(provider?.capabilities.permissionModes||[]).filter(p=>ranks[p]<=ranks[catalog.permissionCeiling]);
  if(!permissions.includes(draft.permissionMode))draft.permissionMode='';
  const tiers=provider?.capabilities.supportsServiceTier?(model.supportedServiceTiers||provider.serviceTiers||[]).filter(t=>t.id!=='default'):[];
  if(!tiers.some(t=>t.id===draft.serviceTier))draft.serviceTier='';
  $('#new-model-options').innerHTML=(efforts.length?seg('reasoningLevel','Effort',[['','Default'],...efforts.map(e=>[e.reasoningEffort,e.reasoningEffort])],draft.reasoningLevel||''):'<p class="rowhint">This model does not expose an effort setting.</p>')+seg('permissionMode','Permissions',[['','Default'],...permissions.map(p=>[p,{'accept-edits':'Accept edits',auto:'Auto',full:'Full access'}[p]])],draft.permissionMode||'')+(tiers.length?seg('serviceTier','Service tier',[['','Default'],...tiers.map(t=>[t.id,t.label])],draft.serviceTier||''):'');store();summary();
 }
 async function loadOptions(resetProvider=false){
  const ticket=++serial;catalog=null;state();message('Loading available models…');
  $('#new-model-options').innerHTML='<div class="skeletonline"></div>';$('#new-model-field').innerHTML='';
  try{
   const params=new URLSearchParams({projectId:draft.projectId,environmentId:draft.environmentId||'',providerId:resetProvider?'':draft.providerId||''});
   let c=await api('new-thread/options?'+params,undefined,60000);if(ticket!==serial||!sheet.classList.contains('newthreadsheet'))return;
   const providers=c.providers.filter(p=>p.available);if(!providers.length)throw Error('No providers available for this workspace');
   if(resetProvider||!providers.some(p=>p.id===draft.providerId)){draft.providerId=providers[0].id;params.set('providerId',draft.providerId);c=await api('new-thread/options?'+params,undefined,60000);if(ticket!==serial||!sheet.classList.contains('newthreadsheet'))return}
   const env=c.environments.find(e=>e.id===draft.environmentId);
   $('#new-environment-field').innerHTML=pick('environmentId','Workspace',opt('','Project default',draft.environmentId||'')+c.environments.map(e=>opt(e.id,e.name,draft.environmentId)).join(''),env?.name||'Project default');
   $('#new-provider-field').innerHTML=seg('providerId','Provider',providers.map(p=>[p.id,p.displayName,providerIcons[p.id]||'']),draft.providerId);
   if(c.modelLoadError)throw Error(c.modelLoadError.detail||'Models unavailable. Check provider sign-in in BB.');
   if(!c.models.length)throw Error('No models available for this provider');
   if(!c.models.some(m=>m.model===draft.model))draft.model=(c.models.find(m=>m.isDefault)||c.models[0]).model;
   catalog=c;$('#new-model-field').innerHTML=pick('model','Model',c.models.map(m=>opt(m.model,m.displayName,draft.model)).join(''),c.models.find(m=>m.model===draft.model)?.displayName||draft.model);modelFields();message(pending()?'A creation request is pending. Check its status before you start another.':'',pending()?'warn':'');state();
  }catch(e){if(ticket!==serial)return;$('#new-model-options').innerHTML='';message(e.message,'warn');state()}
 }
 async function open(){
  sheet.className='newthreadsheet';sheet.innerHTML=`<form id="new-thread-form" class="newthreadform"><header class="nthead"><button type="button" class="textbtn" data-action="close">Cancel</button><h2>New thread</h2><button type="button" class="iconbtn ghost" id="new-reload" aria-label="Reload options">${icon('refresh')}</button></header>
  <div class="newthreadsettings"><p class="grouplabel">Where</p><div class="group"><div id="new-project-field"><div class="skeletonline"></div></div><div id="new-environment-field"></div></div>
  <p class="grouplabel">Agent</p><div class="group"><div id="new-provider-field"></div><div id="new-model-field"></div><div id="new-model-options"></div></div>
  <p class="grouplabel">Title</p><div class="group"><input id="new-title" name="title" maxlength="500" placeholder="Optional. BB names the thread if empty." aria-label="Title (optional)" value="${esc(draft.title||'')}"></div>
  <p id="new-status" role="status">Loading projects…</p>
  <div id="new-pending" class="pendingbox" hidden><p>Pocket cannot confirm the last creation request. Check it before you start another thread.</p><button type="button" id="new-check" class="secondary">Check creation</button><button type="button" id="new-dismiss" class="textbtn danger">Clear request after checking threads</button></div></div>
  <div class="newthreadcomposer"><div class="ntmeta" id="new-summary"></div><div class="ntbox"><textarea id="new-text" name="text" rows="2" maxlength="100000" required aria-label="First message" placeholder="What should the agent do?">${esc(draft.text||'')}</textarea><button type="submit" id="new-start" class="sendbtn ready" aria-label="Start thread" disabled>${icon('send',2.4)}</button></div></div></form>`;
  if(!sheet.open)sheet.showModal();state();
  const form=$('#new-thread-form'),text=$('#new-text'),grow=()=>{text.style.height='auto';text.style.height=Math.min(text.scrollHeight,150)+'px'};requestAnimationFrame(grow);
  form.addEventListener('input',e=>{if(e.target.name){draft[e.target.name]=e.target.value;store()}if(e.target===text)grow()});
  form.addEventListener('change',e=>{const key=e.target.name;if(!key)return;draft[key]=e.target.value;store();if(key==='projectId'){draft.environmentId='';loadOptions(true)}else if(key==='environmentId')loadOptions(true);else if(key==='providerId')loadOptions();else if(key==='model')modelFields();else summary()});
  form.addEventListener('submit',e=>{e.preventDefault();start()});
  $('#new-reload').onclick=()=>loadOptions();$('#new-check').onclick=check;$('#new-dismiss').onclick=()=>{if(confirm('Check the thread list first: a thread may already have started. Clear this request so you can start another?')){save('newThreadPending',null);message('Request cleared. Your draft is retained.');state()}};
  try{projects=(await api('new-thread/projects')).projects;if(!sheet.classList.contains('newthreadsheet'))return;if(!projects.some(p=>p.id===draft.projectId))draft.projectId=(projects.find(p=>p.kind==='personal')||projects[0])?.id;if(!draft.projectId)throw Error('Create a project in BB first');$('#new-project-field').innerHTML=pick('projectId','Project',projects.map(p=>opt(p.id,p.name,draft.projectId)).join(''),projects.find(p=>p.id===draft.projectId)?.name||'');await loadOptions()}catch(e){message(e.message,'warn')}
 }
 function finish(r){if(r.state==='sent'&&r.threadId){save('newThreadPending',null);draft={...draft,text:'',title:''};store();sheet.close();navigate('thread/'+r.threadId);toast('Thread started');return}message(r.state==='missing'?'Request was not recorded. You may clear it and try again.':r.error||'Creation is still unconfirmed. Check the thread list before you start another.','warn');state()}
 async function start(){if(busy||pending()||!catalog)return;if(!draft.text?.trim()){message('Enter a first message','warn');$('#new-text').focus();return}const payload={id:crypto.randomUUID(),projectId:draft.projectId,environmentId:draft.environmentId||'',providerId:draft.providerId,model:draft.model,reasoningLevel:draft.reasoningLevel||'',permissionMode:draft.permissionMode||'',serviceTier:draft.serviceTier||'',title:draft.title||'',text:draft.text};if(!save('newThreadPending',payload)){message('Device storage is full. Cannot safely start a thread.','warn');return}busy=true;state();message('Starting thread…');try{finish(await api('new-thread',payload,60000))}catch(e){if(e.status>=400&&e.status<500)save('newThreadPending',null);message(e.status>=400&&e.status<500?e.message:'Creation unconfirmed. Use Check creation before you start another thread.','warn')}finally{busy=false;state()}}
 async function check(){const p=pending();if(!p||busy)return;busy=true;state();try{finish(await api('new-thread/receipt?id='+encodeURIComponent(p.id)))}catch(e){message(e.message,'warn')}finally{busy=false;state()}}
 sheet.addEventListener('close',()=>{serial++;sheet.classList.remove('newthreadsheet')});
 return open;
}
