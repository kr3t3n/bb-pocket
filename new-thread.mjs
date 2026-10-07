const fail=message=>{throw Object.assign(new Error(message),{status:400})};
export function newThreadApi(sdk){
 const projects=()=>sdk.projects.list({includePersonal:true});
 async function context(projectId,environmentId=''){
  const project=(await projects()).find(p=>p.id===projectId);if(!project)fail('Choose an existing project');
  const environments=(await sdk.environments.list({projectId,limit:500})).filter(e=>e.status==='ready'&&e.lifecycle.phase==='active'&&e.hostLifecycle==='active');
  if(environmentId&&!environments.some(e=>e.id===environmentId))fail('Choose an available workspace in this project');
  let routing=environmentId?{environmentId}:{};
  if(!environmentId&&project.kind==='standard'){const details=await sdk.projects.get({projectId});const source=details.sources.find(s=>s.isDefault)||details.sources[0];if(source)routing={hostId:source.hostId}}
  return {project,environments,routing};
 }
 return {
  projects,
  async catalog({projectId,environmentId='',providerId=''}){
   const c=await context(projectId,environmentId);
   const result=await sdk.providers.models({...c.routing,...(providerId?{providerId}:{})});
   return {...result,environments:c.environments.map(e=>({id:e.id,name:e.name||e.branchName||e.path||e.id})),project:c.project};
  },
  async validate(input){
   if(!input||typeof input!=='object')fail('Invalid new thread');
   if(typeof input.text!=='string'||!input.text.trim()||input.text.length>100000)fail('Enter a message up to 100,000 characters');
   if(typeof input.title!=='string'||input.title.length>500)fail('Title must be at most 500 characters');
   for(const key of ['projectId','providerId','model'])if(typeof input[key]!=='string'||!input[key])fail('Choose project, provider and model');
   const c=await context(input.projectId,input.environmentId||'');
   const catalog=await sdk.providers.models({...c.routing,providerId:input.providerId});
   const provider=catalog.providers.find(p=>p.id===input.providerId&&p.available);if(!provider)fail('Provider is unavailable in this workspace');
   if(catalog.modelLoadError)fail(catalog.modelLoadError.detail||'Cannot load models for this provider');
   const model=catalog.models.find(m=>m.model===input.model);if(!model)fail('Choose a model supported by this provider');
   const args={projectId:input.projectId,providerId:model.routeProviderId||input.providerId,model:model.model,prompt:input.text,title:input.title.trim()||undefined,environment:input.environmentId?{type:'reuse',environmentId:input.environmentId}:{type:'project-default'},origin:'app'};
   if(input.reasoningLevel){if(!model.supportedReasoningEfforts.some(e=>e.reasoningEffort===input.reasoningLevel))fail('Unsupported effort for this model');args.reasoningLevel=input.reasoningLevel}
   if(input.permissionMode){const ranks={'accept-edits':0,auto:1,full:2};if(!provider.capabilities.permissionModes.includes(input.permissionMode)||ranks[input.permissionMode]>ranks[catalog.permissionCeiling])fail('Unsupported permission mode');args.permissionMode=input.permissionMode}
   if(input.serviceTier){const tiers=model.supportedServiceTiers||provider.serviceTiers||[];if(!provider.capabilities.supportsServiceTier||!['default',...tiers.map(t=>t.id)].includes(input.serviceTier))fail('Unsupported service tier');args.serviceTier=input.serviceTier}
   return args;
  },
  spawn:args=>sdk.threads.spawn(args),
 };
}
