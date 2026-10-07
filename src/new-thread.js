export function setupNewThread({api,esc,read,save,sheet,navigate,toast}){
 let draft=read('newThreadDraft',{}),catalog=null,projects=[],serial=0,busy=false;
 const $=s=>sheet.querySelector(s),opt=(id,label,value)=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(label)}</option>`;
 const field=(name,label,options)=>`<div class="field"><label for="new-${name}">${label}</label><select id="new-${name}" name="${name}">${options}</select></div>`;
 const store=()=>save('newThreadDraft',draft);
 function message(text){if($('#new-status'))$('#new-status').textContent=text}
 function pending(){return read('newThreadPending',null)}
 function state(){const p=pending();for(const el of sheet.querySelectorAll('#new-thread-form input,#new-thread-form select,#new-thread-form textarea'))el.disabled=busy||!!p;if($('#new-start')){$('#new-start').disabled=busy||!!p||!catalog?.models?.length;$('#new-check').hidden=!p;$('#new-dismiss').hidden=!p}}
 function modelFields(){
  if(!catalog)return;
  const model=catalog.models.find(m=>m.model===draft.model),provider=catalog.providers.find(p=>p.id===draft.providerId);
  if(!model)return;
  const efforts=model.supportedReasoningEfforts||[];if(!efforts.some(e=>e.reasoningEffort===draft.reasoningLevel))draft.reasoningLevel=efforts.some(e=>e.reasoningEffort===model.defaultReasoningEffort)?model.defaultReasoningEffort:'';
  const ranks={'accept-edits':0,auto:1,full:2},permissions=(provider?.capabilities.permissionModes||[]).filter(p=>ranks[p]<=ranks[catalog.permissionCeiling]);
  if(!permissions.includes(draft.permissionMode))draft.permissionMode='';
  const tiers=provider?.capabilities.supportsServiceTier?(model.supportedServiceTiers||provider.serviceTiers||[]).filter(t=>t.id!=='default'):[];
  if(!tiers.some(t=>t.id===draft.serviceTier))draft.serviceTier='';
  $('#new-model-options').innerHTML=(efforts.length?field('reasoningLevel','Effort',opt('','BB default',draft.reasoningLevel)+efforts.map(e=>opt(e.reasoningEffort,e.reasoningEffort,draft.reasoningLevel)).join('')):'<p class="muted">This model does not expose an effort setting.</p>')+field('permissionMode','Permissions',opt('','BB default',draft.permissionMode)+permissions.map(p=>opt(p,{'accept-edits':'Accept edits',auto:'Auto',full:'Full access'}[p],draft.permissionMode)).join(''))+(tiers.length?field('serviceTier','Service tier',opt('','BB default',draft.serviceTier)+tiers.map(t=>opt(t.id,t.label,draft.serviceTier)).join('')):'');store();
 }
 async function loadOptions(resetProvider=false){
  const ticket=++serial;catalog=null;state();message('Loading available models…');
  $('#new-model-options').innerHTML='';$('#new-model-field').innerHTML='';
  try{
   const params=new URLSearchParams({projectId:draft.projectId,environmentId:draft.environmentId||'',providerId:resetProvider?'':draft.providerId||''});
   let c=await api('new-thread/options?'+params,undefined,60000);if(ticket!==serial||!sheet.classList.contains('newthreadsheet'))return;
   const providers=c.providers.filter(p=>p.available);if(!providers.length)throw Error('No providers available for this workspace');
   if(resetProvider||!providers.some(p=>p.id===draft.providerId)){draft.providerId=providers[0].id;params.set('providerId',draft.providerId);c=await api('new-thread/options?'+params,undefined,60000);if(ticket!==serial||!sheet.classList.contains('newthreadsheet'))return}
   $('#new-environment-field').innerHTML=field('environmentId','Workspace',opt('','Project default',draft.environmentId||'')+c.environments.map(e=>opt(e.id,e.name,draft.environmentId)).join(''));
   $('#new-provider-field').innerHTML=field('providerId','Provider',providers.map(p=>opt(p.id,p.displayName,draft.providerId)).join(''));
   if(c.modelLoadError)throw Error(c.modelLoadError.detail||'Models unavailable. Check provider sign-in in BB.');
   if(!c.models.length)throw Error('No models available for this provider');
   if(!c.models.some(m=>m.model===draft.model))draft.model=(c.models.find(m=>m.isDefault)||c.models[0]).model;
   catalog=c;$('#new-model-field').innerHTML=field('model','Model',c.models.map(m=>opt(m.model,m.displayName,draft.model)).join(''));modelFields();message(pending()?'A creation request is pending. Check its status before starting another.':'');state();
  }catch(e){if(ticket!==serial)return;message(e.message);state()}
 }
 async function open(){
  sheet.classList.add('newthreadsheet');sheet.innerHTML=`<form id="new-thread-form" class="newthreadform"><header class="sheethead"><h2>New thread</h2><button type="button" class="iconbtn" data-action="close" aria-label="Close">×</button></header><div class="newthreadsettings"><div id="new-project-field"></div><div id="new-environment-field"></div><div id="new-provider-field"></div><div id="new-model-field"></div><div id="new-model-options"></div><div class="field"><label for="new-title">Title (optional)</label><input id="new-title" name="title" maxlength="500" value="${esc(draft.title||'')}"></div></div><div class="newthreadcomposer"><p id="new-status" role="status">Loading projects…</p><label for="new-text">First message</label><textarea id="new-text" name="text" rows="3" maxlength="100000" required placeholder="What would you like to do?">${esc(draft.text||'')}</textarea><div class="sheetfooter"><button type="button" class="secondary" id="new-reload">Reload options</button><button type="submit" id="new-start" class="primary" disabled>Start thread</button></div><button type="button" id="new-check" class="secondary" hidden>Check creation</button><button type="button" id="new-dismiss" hidden>Clear request after checking threads</button></div></form>`;if(!sheet.open)sheet.showModal();state();
  $('#new-thread-form').addEventListener('input',e=>{if(e.target.name){draft[e.target.name]=e.target.value;store()}});
  $('#new-thread-form').addEventListener('change',e=>{const key=e.target.name;if(!key)return;draft[key]=e.target.value;store();if(key==='projectId'){draft.environmentId='';loadOptions(true)}else if(key==='environmentId')loadOptions(true);else if(key==='providerId')loadOptions();else if(key==='model')modelFields()});
  $('#new-thread-form').addEventListener('submit',e=>{e.preventDefault();start()});
  $('#new-reload').onclick=()=>loadOptions();$('#new-check').onclick=check;$('#new-dismiss').onclick=()=>{if(confirm('Check the thread list first: a thread may already have started. Clear this request so you can start another?')){save('newThreadPending',null);message('Request cleared. Your draft is retained.');state()}};
  try{projects=(await api('new-thread/projects')).projects;if(!sheet.classList.contains('newthreadsheet'))return;if(!projects.some(p=>p.id===draft.projectId))draft.projectId=(projects.find(p=>p.kind==='personal')||projects[0])?.id;if(!draft.projectId)throw Error('Create a project in BB first');$('#new-project-field').innerHTML=field('projectId','Project',projects.map(p=>opt(p.id,p.name,draft.projectId)).join(''));await loadOptions()}catch(e){message(e.message)}
 }
 function finish(r){if(r.state==='sent'&&r.threadId){save('newThreadPending',null);draft={...draft,text:'',title:''};store();sheet.close();navigate('thread/'+r.threadId);toast('Thread started');return}message(r.state==='missing'?'Request was not recorded. You may clear it and try again.':r.error||'Creation is still unconfirmed. Check the thread list before starting another.');state()}
 async function start(){if(busy||pending()||!catalog)return;if(!draft.text?.trim()){message('Enter a first message');return}const payload={id:crypto.randomUUID(),projectId:draft.projectId,environmentId:draft.environmentId||'',providerId:draft.providerId,model:draft.model,reasoningLevel:draft.reasoningLevel||'',permissionMode:draft.permissionMode||'',serviceTier:draft.serviceTier||'',title:draft.title||'',text:draft.text};if(!save('newThreadPending',payload)){message('Device storage is full. Cannot safely start a thread.');return}busy=true;state();message('Starting thread…');try{finish(await api('new-thread',payload,60000))}catch(e){if(e.status>=400&&e.status<500)save('newThreadPending',null);message(e.status>=400&&e.status<500?e.message:'Creation unconfirmed. Use Check creation before starting another thread.')}finally{busy=false;state()}}
 async function check(){const p=pending();if(!p||busy)return;busy=true;state();try{finish(await api('new-thread/receipt?id='+encodeURIComponent(p.id)))}catch(e){message(e.message)}finally{busy=false;state()}}
 sheet.addEventListener('close',()=>{serial++;sheet.classList.remove('newthreadsheet')});
 return open;
}
