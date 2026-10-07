import http from 'node:http';
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {filterThreads,compactThread} from './src/domain.mjs';
export async function createPocketServer(options={}) {
const root=options.root||path.dirname(fileURLToPath(import.meta.url));
const port=Number(options.port??8890), upstream=options.upstream||'http://127.0.0.1:38886';
const publicBbUrl=options.bbUrl||upstream;
const publicHost=options.publicHost||'';
const dataDir=options.dataDir||path.join(root,'data');
if(!options.journalStore) await mkdir(dataDir,{recursive:true,mode:0o700});
const lifetime=new AbortController();
const cache=new Map();
async function bb(route,body){
 const res=await fetch(upstream+'/api/v1/'+route,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.any([lifetime.signal,AbortSignal.timeout(20000)])});
 const value=await res.json();if(!res.ok){const e=new Error(typeof value.error==='string'?value.error:value.error?.message||value.message||'BB request failed');e.status=res.status;throw e;}return value;
}
const rpc=async(plugin,method,input)=>(await bb(`plugins/${plugin}/rpc/${method}`,input)).result;
async function cached(key,ttl,fn){
 let c=cache.get(key);if(!c){c={at:0};cache.set(key,c)}
 if(Date.now()-c.at<ttl&&c.value)return {value:c.value,stale:false,at:c.at};
 if(!c.pending)c.pending=fn().then(value=>{c.value=value;c.at=Date.now();c.error=null;return value}).catch(e=>{c.error=e.message;throw e}).finally(()=>{c.pending=null});
 if(c.value){c.pending.catch(()=>{});return {value:c.value,stale:true,at:c.at,error:c.error}};
 return {value:await c.pending,stale:false,at:c.at};
}
async function labels(){return cached('labels',60000,async()=>{
 const {labels}=await rpc('labels-pro','listLabels',null);const memberships={};
 // Bounded concurrency keeps plugin reads from monopolising BB.
 for(let i=0;i<labels.length;i+=4)await Promise.all(labels.slice(i,i+4).map(async l=>{const r=await rpc('labels-pro','listThreadsByLabel',{labelId:l.id});for(const id of r.threadIds)(memberships[id]??=[]).push(l.slug)}));
 return {labels,memberships};
})}
async function index(){return cached('threads',15000,async()=>{
 const rows=[];for(let offset=0;;){const batch=await bb(`threads?limit=500&offset=${offset}`);rows.push(...batch);if(batch.length<500)break;offset+=batch.length;if(offset>100000)throw new Error('Thread index exceeds limit');}
 return [...new Map(rows.map(t=>[t.id,compactThread(t)])).values()];
})}
async function meta(){const [p,t,l]=await Promise.all([cached('projects',60000,()=>bb('projects')),cached('taskProjects',60000,()=>rpc('tasks','listProjects',{})),labels()]);return {bbUrl:publicBbUrl,projects:p.value,taskProjects:t.value.projects,labels:l.value.labels,stale:p.stale||t.stale||l.stale}}
async function tasks(){return cached('tasks',30000,async()=>{
 // Restart once if Tasks invalidates its cursor during pagination.
 for(let attempt=0;attempt<2;attempt++){try{let result=[],cursor;do{const r=await rpc('tasks','listTasks',{limit:500,...(cursor?{cursor}:{})});result.push(...r.tasks);cursor=r.nextCursor;}while(cursor);return result}catch(e){if(attempt||!/cursor/i.test(e.message))throw e}}
})}
const journalFile=path.join(dataDir,'sends.json');let journal={};try{journal=options.journalStore?await options.journalStore.load():JSON.parse(await readFile(journalFile,'utf8'))}catch(e){if(e.code!=='ENOENT')throw new Error('Cannot safely read send journal: '+e.message)}
for(const record of Object.values(journal))if(record.state==='sending')record.state='unknown';
let writing=Promise.resolve();function persist(){const snapshot=JSON.stringify(journal);writing=writing.catch(()=>{}).then(async()=>{if(options.journalStore){await options.journalStore.save(JSON.parse(snapshot))}else{await writeFile(journalFile+'.tmp',snapshot,{mode:0o600});await rename(journalFile+'.tmp',journalFile)}});return writing}
await persist();
async function sendOnce(threadId,input){
 if(!/^[a-f0-9-]{36}$/i.test(input.id||'')||typeof input.text!=='string'||input.text.length>100000)throw Object.assign(new Error('Invalid message'),{status:400});
 const attachmentIds=input.attachmentIds??[];
 if(!Array.isArray(attachmentIds)||attachmentIds.length>20||attachmentIds.some(id=>typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id))||(!input.text.trim()&&!attachmentIds.length))throw Object.assign(new Error('Invalid message attachments'),{status:400});
 const hash=createHash('sha256').update(threadId+'\0'+input.text+(attachmentIds.length?'\0'+JSON.stringify(attachmentIds):'')).digest('hex');
 if(journal[input.id]){if(journal[input.id].hash!==hash)throw Object.assign(new Error('Message identifier already used'),{status:409});return journal[input.id]}
 if(attachmentIds.length&&!options.attachments)throw Object.assign(new Error('Attachment sending requires the Pocket plugin'),{status:503});
 const files=attachmentIds.length?await options.attachments.resolve(threadId,attachmentIds):[];
 if(files.reduce((n,f)=>n+f.sizeBytes,0)>100*1024*1024)throw Object.assign(new Error('Maximum total attachment size is 100 MB'),{status:413});
 // Recheck after async resolution so concurrent retries still forward only once.
 if(journal[input.id]){if(journal[input.id].hash!==hash)throw Object.assign(new Error('Message identifier already used'),{status:409});return journal[input.id]}
 journal[input.id]={hash,threadId,state:'sending',at:Date.now()};await persist();
 try{const result=await bb(`threads/${threadId}/send`,{input:[...(input.text.trim()?[{type:'text',text:input.text}]:[]),...files.map(f=>f.type==='localImage'?{type:'localImage',path:f.path}:{type:'localFile',path:f.path,name:f.name,mimeType:f.mimeType,sizeBytes:f.sizeBytes})],mode:'auto'});journal[input.id]={...journal[input.id],state:'sent',result};}
 catch(e){journal[input.id]={...journal[input.id],state:'unknown',error:'Delivery could not be confirmed. Check the conversation before sending again.'};}
 await persist();cache.delete('threads');return journal[input.id];
}
async function createOnce(input){
 if(!options.newThread)throw Object.assign(new Error('New threads require the Pocket plugin'),{status:503});
 if(!input||!/^[a-f0-9-]{36}$/i.test(input.id||''))throw Object.assign(new Error('Invalid request ID'),{status:400});
 const key='create:'+input.id,hash=createHash('sha256').update(JSON.stringify(input)).digest('hex');
 const existing=()=>{const r=journal[key];if(r&&r.hash!==hash)throw Object.assign(new Error('Creation identifier already used'),{status:409});return r};
 if(existing())return existing();
 const args=await options.newThread.validate(input);
 if(existing())return existing();
 journal[key]={hash,state:'sending',at:Date.now()};await persist();
 try{const thread=await options.newThread.spawn(args);journal[key]={...journal[key],state:'sent',threadId:thread.id};}
 catch(e){journal[key]={...journal[key],state:'unknown',error:'Creation could not be confirmed. Check the thread list before starting another thread.'};}
 await persist();cache.delete('threads');return journal[key];
}
function json(res,value,status=200,req){const raw=Buffer.from(JSON.stringify(value));const gz=req?.headers['accept-encoding']?.includes('gzip')&&raw.length>1000;res.writeHead(status,{'content-type':'application/json','cache-control':'no-store',...(gz?{'content-encoding':'gzip','vary':'Accept-Encoding'}:{})});res.end(gz?gzipSync(raw):raw)}
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>150000)throw Object.assign(new Error('Request too large'),{status:413})}try{return JSON.parse(text)}catch{throw Object.assign(new Error('Invalid JSON'),{status:400})}}
const safeId=s=>/^[A-Za-z0-9_-]{1,100}$/.test(s);
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
 const host=req.headers.host;const allowed=new Set([`127.0.0.1:${port}`,`localhost:${port}`,publicHost]);
 if(!allowed.has(host)){json(res,{error:'Invalid host'},403);return}
 const url=new URL(req.url,'http://'+host),q=url.searchParams;
 // Local listener is exposed only through owner-authenticated BB Connect. No general proxy.
 if(url.pathname.startsWith('/api/') && (req.headers['sec-fetch-site']==='cross-site' || (req.headers.origin&&!['http://'+host,'https://'+host].includes(req.headers.origin)))){json(res,{error:'Cross-origin request rejected'},403);return}
 try{
 if(url.pathname.startsWith('/api/')){
 if(req.method==='POST'&&!/^\/api\/thread\/[A-Za-z0-9_-]+\/attachments$/.test(url.pathname)&&(req.headers['x-pocket-request']!=='1'||!req.headers['content-type']?.startsWith('application/json')))throw Object.assign(new Error('Invalid request'),{status:403});
 if(req.method==='GET'&&url.pathname==='/api/usage'){let u=await cached('usage',60000,()=>options.usageLimits?options.usageLimits():bb('system/usage-limits'));if(u.stale){try{await cache.get('usage').pending;const c=cache.get('usage');u={value:c.value,at:c.at,stale:false}}catch(e){u.error=e.message}}return json(res,{providers:u.value,stale:u.stale,warning:u.error||null,syncedAt:u.at},200,req)}
 if(url.pathname==='/api/new-thread/projects'&&req.method==='GET'){if(!options.newThread)throw Object.assign(new Error('New threads require the Pocket plugin'),{status:503});return json(res,{projects:await options.newThread.projects()},200,req)}
 if(url.pathname==='/api/new-thread/options'&&req.method==='GET'){if(!options.newThread)throw Object.assign(new Error('New threads require the Pocket plugin'),{status:503});return json(res,await options.newThread.catalog(Object.fromEntries(q)),200,req)}
 if(url.pathname==='/api/new-thread'&&req.method==='POST')return json(res,await createOnce(await body(req)),200,req);
 if(url.pathname==='/api/new-thread/receipt'&&req.method==='GET')return json(res,journal['create:'+q.get('id')]||{state:'missing'},200,req);
 if(req.method==='GET'&&url.pathname==='/api/meta')return json(res,await meta(),200,req);
 if(req.method==='GET'&&url.pathname==='/api/threads'){
 const [i,l]=await Promise.all([index(),labels()]);const rows=i.value.map(t=>({...t,labels:l.value.memberships[t.id]||[]}));const filtered=filterThreads(rows,Object.fromEntries(q));const offset=Math.max(0,Number(q.get('offset'))||0),limit=Math.min(1000,Math.max(60,Number(q.get('limit'))||60));return json(res,{threads:filtered.slice(offset,offset+limit),total:filtered.length,nextOffset:offset+limit<filtered.length?offset+limit:null,stale:i.stale||l.stale,warning:i.error||l.error||null,syncedAt:Math.min(i.at,l.at)},200,req);
 }
 if(req.method==='GET'&&url.pathname==='/api/tasks'){
 const t=await tasks();let rows=t.value;const search=(q.get('q')||'').toLowerCase();if(search)rows=rows.filter(t=>(t.key+' '+t.title+' '+t.description).toLowerCase().includes(search));if(q.get('project'))rows=rows.filter(t=>t.projectId===q.get('project'));if(q.get('status'))rows=rows.filter(t=>t.status===q.get('status'));rows=[...rows].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));const offset=Math.max(0,Number(q.get('offset'))||0),limit=Math.min(1000,Math.max(60,Number(q.get('limit'))||60));return json(res,{tasks:rows.slice(offset,offset+limit).map(({description,...t})=>t),total:rows.length,nextOffset:offset+limit<rows.length?offset+limit:null,stale:t.stale,warning:t.error||null,syncedAt:t.at},200,req);
 }
 const uploadRoute=url.pathname.match(/^\/api\/thread\/([A-Za-z0-9_-]+)\/attachments$/);
 if(uploadRoute&&req.method==='POST'){
 if(req.headers['x-pocket-request']!=='1')throw Object.assign(new Error('Invalid request'),{status:403});
 if(!options.attachments)throw Object.assign(new Error('Uploads require the Pocket plugin'),{status:503});
 const max=50*1024*1024;let total=0;const chunks=[];
 if(Number(req.headers['content-length'])>max)throw Object.assign(new Error('Maximum file size is 50 MB'),{status:413});
 for await(const chunk of req){total+=chunk.length;if(total>max)throw Object.assign(new Error('Maximum file size is 50 MB'),{status:413});chunks.push(chunk)}
 let name;try{name=decodeURIComponent(String(req.headers['x-pocket-filename']||'attachment'))}catch{throw Object.assign(new Error('Invalid filename'),{status:400})}
 name=name.replace(/[\/\\\x00-\x1f]/g,'_').slice(0,200)||'attachment';
 const mime=String(req.headers['content-type']||'application/octet-stream').split(';')[0].slice(0,150);
 return json(res,await options.attachments.upload(uploadRoute[1],Buffer.concat(chunks),name,mime),200,req);
 }
 const menuRoute=url.pathname.match(/^\/api\/thread\/([A-Za-z0-9_-]+)\/(menu|action)$/);
 if(menuRoute&&safeId(menuRoute[1])){
 const id=menuRoute[1],actions=options.threadActions;
 if(!actions)throw Object.assign(new Error('Thread menus require the Pocket plugin'),{status:503});
 if(req.method==='GET'&&menuRoute[2]==='menu'){
 const t=await actions.get(id);const project=(await cached('projects',60000,()=>bb('projects'))).value.find(p=>p.id===t.projectId);
 const threadPath=project?.isPersonal||t.projectId==='proj_personal'?`/threads/${id}`:`/projects/${t.projectId}/threads/${id}`;
 const cloud=new URL(publicBbUrl);return json(res,{thread:{...compactThread(t),archivedAt:t.archivedAt},localLink:new URL(threadPath,upstream).href,cloudLink:cloud.hostname==='localhost'||cloud.hostname==='127.0.0.1'?null:new URL(threadPath,cloud).href},200,req);
 }
 if(req.method==='POST'&&menuRoute[2]==='action'){
 const input=await body(req),allowed=['read','unread','pin','unpin','rename','archive','unarchive','delete','split','children'];
 if(!allowed.includes(input.action))throw Object.assign(new Error('Invalid thread action'),{status:400});
 if(input.action==='rename'&&(typeof input.title!=='string'||!input.title.trim()||input.title.length>500))throw Object.assign(new Error('Enter a title between 1 and 500 characters'),{status:400});
 if(input.action==='delete'&&(input.confirmed!==true||typeof input.childThreadsConfirmed!=='boolean'))throw Object.assign(new Error('Deletion must be confirmed'),{status:400});
 const result=await actions[input.action](id,input.action==='rename'?{title:input.title.trim()}:input.action==='delete'?{childThreadsConfirmed:input.childThreadsConfirmed}:{});
 if(!['children','split'].includes(input.action))cache.delete('threads');
 return json(res,{result},200,req);
 }
 }
 const m=url.pathname.match(/^\/api\/(thread|task)\/([A-Za-z0-9_-]+)(?:\/(timeline|send|stop|read|delivery))?$/);
 if(m&&safeId(m[2])){const [,kind,id,action]=m;
 if(kind==='task'&&req.method==='GET'){const [task,comments,threads]=await Promise.all([rpc('tasks','getTask',{taskId:id}),rpc('tasks','listComments',{taskId:id}),rpc('tasks','listTaskThreads',{taskId:id})]);return json(res,{...task,...comments,...threads},200,req)}
 if(kind==='thread'){
 if(req.method==='GET'&&action==='timeline'){
 const params=new URLSearchParams({segmentLimit:'8',includeNestedRows:'false'});for(const k of ['beforeAnchorSeq','beforeAnchorId'])if(q.has(k))params.set(k,q.get(k));
 const [timeline,thread,queue]=await Promise.all([bb(`threads/${id}/timeline?${params}`),bb(`threads/${id}`),bb(`threads/${id}/queued-messages`).catch(()=>null)]);const rows=timeline.rows.map(r=>r.kind==='work'?{id:r.id,kind:r.kind,workKind:r.workKind,status:r.status,sourceSeqStart:r.sourceSeqStart,sourceSeqEnd:r.sourceSeqEnd,createdAt:r.createdAt,title:r.title,command:r.command?.slice(0,500),output:r.output?.slice(0,4000)}:r);return json(res,{...timeline,rows,thread,queue},200,req);
 }
 if(req.method==='GET'&&action==='delivery')return json(res,journal[q.get('id')]||{state:'missing'},200,req);
 if(req.method==='POST'&&action==='send')return json(res,await sendOnce(id,await body(req)),200,req);
 if(req.method==='POST'&&action==='stop')return json(res,await bb(`threads/${id}/stop`,{}),200,req);
 if(req.method==='POST'&&action==='read')return json(res,await bb(`threads/${id}/read`,{}),200,req);
 }
 }
 return json(res,{error:'Not found'},404,req);
 }
 if(req.method!=='GET'&&req.method!=='HEAD')return json(res,{error:'Method not allowed'},405);
 const routes={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/style.css':'style.css','/sw.js':'sw.js','/manifest.webmanifest':'manifest.webmanifest','/logo.svg':'logo.svg','/apple-touch-icon.png':'apple-touch-icon.png','/favicon-32.png':'favicon-32.png','/icon.svg':'icon.svg','/icon-192.png':'icon-192.png','/icon-512.png':'icon-512.png'};
 const file=routes[url.pathname];if(!file)return json(res,{error:'Not found'},404);
 const bytes=options.assets?Buffer.from(options.assets[file],'base64'):await readFile(path.join(root,'public',file));const mime=file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':file.endsWith('webmanifest')?'application/manifest+json':'text/html';
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
 const zipped=req.headers['accept-encoding']?.includes('gzip');res.writeHead(200,{'content-type':mime,'cache-control':'no-cache',...(zipped?{'content-encoding':'gzip','vary':'Accept-Encoding'}:{})});res.end(req.method==='HEAD'?undefined:zipped?gzipSync(bytes):bytes);
 }catch(e){console.error(new Date().toISOString(),url.pathname,e.message);json(res,{error:e.message},e.status||502,req)}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>{server.removeListener('error',reject);resolve()})});
return {server,port,async close(){lifetime.abort();await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));await writing;}};
}

