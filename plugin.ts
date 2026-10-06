import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import type {BbPluginApi} from '@get-bb/plugin-sdk';
import {z} from 'zod';
import {createPocketServer} from './bridge.mjs';
import assets from './plugin-assets.json';

export default function pocketPlugin(bb:BbPluginApi) {
 const settings=bb.settings.define({
  port:{type:'number',label:'Pocket port',default:8890,experimental_schema:z.number().int().min(1024).max(65535)},
  share:{type:'boolean',label:'Share through owner-authenticated BB Connect',default:true},
  bbUrl:{type:'string',label:'Full BB URL (optional override)',default:''},
 });
 const db=bb.storage.database();
 bb.storage.migrate(db,[`CREATE TABLE IF NOT EXISTS sends (id TEXT PRIMARY KEY, record TEXT NOT NULL)`]);
 const journalStore={
  load:()=>Object.fromEntries((db.prepare('SELECT id, record FROM sends').all() as {id:string,record:string}[]).map(r=>[r.id,JSON.parse(r.record)])),
  save:(records:Record<string,unknown>)=>db.transaction(()=>{const put=db.prepare('INSERT OR REPLACE INTO sends (id,record) VALUES (?,?)');for(const [id,record]of Object.entries(records))put.run(id,JSON.stringify(record));})(),
 };
 const connect=async(args:string[])=>{const {stdout}=await promisify(execFile)(process.env.BB_CLI||'bb',['connect',...args,'--json'],{env:{...process.env,BB_SERVER_URL:bb.server.loopbackBaseUrl},timeout:20000,maxBuffer:1024*1024});return JSON.parse(stdout)};
 let current={running:false,port:8890,url:'',warning:''};
 let restart:(()=>void)|undefined;
 settings.onChange(()=>restart?.());
 bb.cli.register({name:'pocket',summary:'Open the Pocket mobile PWA',commands:[{name:'status',summary:'Show the Pocket URL and service state',usage:'bb pocket status [--json]'}],async run(argv){
  if(argv[0]==='import-journal'){
   if(argv.length!==2)return {exitCode:1,stderr:'Usage: bb pocket import-journal <server-local-json-path>'};
   const contents=await readFile(argv[1],'utf8');if(contents.length>10000000)throw new Error('Journal exceeds 10 MB');
   const records=JSON.parse(contents);if(!records||Array.isArray(records)||typeof records!=='object')throw new Error('Invalid journal');
   const existing=journalStore.load();let count=0;
   for(const [id,value]of Object.entries(records)){const r=value as any;if(!/^[a-f0-9-]{36}$/i.test(id)||typeof r?.hash!=='string'||typeof r?.threadId!=='string'||!['sent','sending','unknown'].includes(r?.state))throw new Error('Invalid send receipt');if(existing[id]&&existing[id].hash!==r.hash)throw new Error('Conflicting send receipt');if(!existing[id]){existing[id]={...r,state:r.state==='sending'?'unknown':r.state};count++}}
   journalStore.save(existing);restart?.();return {exitCode:0,stdout:`Imported ${count} send receipts; Pocket is restarting.`};
  }
  if(argv.some(a=>!['status','--json'].includes(a)))return {exitCode:1,stderr:'Usage: bb pocket status [--json]'};
  return {exitCode:0,stdout:argv.includes('--json')?JSON.stringify(current):`${current.running?'Pocket is running':'Pocket is starting'}\n${current.url}\n${current.warning}`.trim()};
 }});
 bb.background.service('pocket-web', {async start(signal){
  while(!signal.aborted){
   const config=await settings.get();
   let hostId:string|null=null,cliShared=false,ownsCliShare=false,publicHost='',url=`http://127.0.0.1:${config.port}`,bbUrl=config.bbUrl||bb.server.experimental_appUrl||bb.server.loopbackBaseUrl,warning='';
   if(config.share){try{
    hostId=(await bb.sdk.system.config()).primaryHostId;
    if(!hostId)throw new Error('BB has no primary host');
    const tunnel=await bb.hosts.ensureSharedPortTunnel(hostId);
    publicHost=`${tunnel.label}--${config.port}.${tunnel.baseDomain}`;
    url=`https://${publicHost}`;
    if(!config.bbUrl&&!bb.server.experimental_appUrl)bbUrl=`https://${tunnel.label}.${tunnel.baseDomain}`;
   }catch(e){
    try{
     if(!hostId)throw e;
     const shares=await connect(['shares','--host',hostId]);
     ownsCliShare=!shares.shares.some((s:{port:number})=>s.port===config.port);
     const share=await connect(['expose',String(config.port),'--host',hostId]);
     url=share.url;publicHost=new URL(url).host;cliShared=true;
     if(!config.bbUrl)bbUrl=url.replace(`--${config.port}.`,'.');
    }catch(f){hostId=null;warning=`BB Connect share unavailable: ${f instanceof Error?f.message:String(f)}. Pocket is available on loopback only.`;bb.log.warn(warning)}
   }}
   let server:Awaited<ReturnType<typeof createPocketServer>>|undefined;
   try{
    server=await createPocketServer({port:config.port,upstream:bb.server.loopbackBaseUrl,bbUrl,publicHost,assets,journalStore});
    if(signal.aborted)break;
    if(hostId&&!cliShared)await bb.hosts.declareSharedPorts(hostId,[config.port]);
    current={running:true,port:config.port,url,warning};bb.log.info(`Pocket ready: ${url}`);
    await new Promise<void>(resolve=>{const wake=()=>{signal.removeEventListener('abort',wake);resolve()};restart=wake;signal.addEventListener('abort',wake,{once:true});if(signal.aborted)wake();}).finally(()=>{restart=undefined;});
   }finally{
    current={...current,running:false};await server?.close();
    if(hostId){if(cliShared&&ownsCliShare)await connect(['unexpose',String(config.port),'--host',hostId]).catch(()=>{});else if(!cliShared)await bb.hosts.declareSharedPorts(hostId,[]).catch(()=>{});}
   }
  }
 }});
}
