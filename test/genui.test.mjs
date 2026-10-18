import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';
import {renderGenui,uiFences} from '../src/genui.mjs';import {createPocketServer} from '../bridge.mjs';
const spec='```ui\nr = Load("/question.json")\nCard("Start date", [Text("When should " + r.name + " start?"), Button("January", Send("Start in January.")), Button("Other date")])\n```';
test('GenUI safely renders loaded values and extracts explicit/default replies',async()=>{
 const calls=[];const r=await renderGenui(spec,async req=>{calls.push(req);return {ok:true,value:{name:'Example'}}});
 assert.match(r.text,/When should Example start/);assert(!r.text.includes('```ui'));assert.deepEqual(r.replies,[{label:'January',text:'Start in January.'},{label:'Other date',text:'Other date'}]);assert.equal(calls[0].path,'/question.json');
 const nonReply=await renderGenui('```ui\nCard("Actions", [Text("Working"), Button("Visit", OpenUrl("https://example.com"))])\n```',async()=>({ok:false}));assert.deepEqual(nonReply.replies,[]);
 assert.deepEqual(uiFences('````text\n```ui\nButton("quoted")\n```\n````'),[]);
 const bad=await renderGenui('```ui\nprocess.exit()\n```',async()=>{throw Error('must not load')});assert.deepEqual(bad.replies,[]);
});
test('GenUI questions appear in Needs input, clear after a reply, and old pages have no active buttons',async()=>{
 let answered=false;const calls=[];
 const question={id:'question',kind:'conversation',role:'assistant',text:spec,createdAt:10};
 const user={id:'answer',kind:'conversation',role:'user',text:'January',createdAt:20};
 const thread={id:'t',title:'Question',status:'idle',updatedAt:1,hasPendingInteraction:false};
 const upstream=http.createServer(async(req,res)=>{calls.push(req.url);let body='';for await(const c of req)body+=c;const u=new URL(req.url,'http://local');let data;
  if(u.pathname.endsWith('/interactions'))data=[];
  else if(u.pathname.endsWith('/queued-messages'))data=[];
  else if(u.pathname.endsWith('/timeline'))data={rows:answered&&!u.searchParams.has('beforeAnchorSeq')?[question,user]:[question]};
  else if(u.pathname.endsWith('/listLabels'))data={result:{labels:[]}};
  else if(u.pathname.endsWith('/load_data')){assert.equal(JSON.parse(body).threadId,'t');data={result:{ok:true,value:{name:'Example'}}}}
  else if(u.pathname.endsWith('/threads/t'))data={...thread,updatedAt:answered?2:1};
  else if(u.pathname.endsWith('/threads'))data=[thread];
  else throw Error(req.url);
  res.setHeader('content-type','application/json');res.end(JSON.stringify(data));
 });await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
 const server=await createPocketServer({port:18915,upstream:`http://127.0.0.1:${upstream.address().port}`,journalStore:{load:async()=>({}),save:async()=>{}}});
 const get=path=>fetch(`http://127.0.0.1:${server.server.address().port}/api/${path}`).then(r=>r.json());
 try{
  const list=await get('threads?status=attention');assert.equal(list.total,1);assert.equal(list.threads[0].hasUiQuestion,true);
  const open=await get('thread/t/timeline');assert.equal(open.thread.hasPendingInteraction,true);assert.equal(open.rows[0].uiReplies.length,2);assert.match(open.rows[0].text,/Example/);
  const count=calls.filter(p=>p.includes('segmentLimit=2')).length;await get('threads');assert.equal(calls.filter(p=>p.includes('segmentLimit=2')).length,count);
  answered=true;const after=await get('thread/t/timeline');assert.equal(after.thread.hasPendingInteraction,false);assert.deepEqual(after.rows[0].uiReplies,[]);
  const older=await get('thread/t/timeline?beforeAnchorSeq=10');assert.deepEqual(older.rows[0].uiReplies,[]);
 }finally{await server.close();await new Promise(r=>upstream.close(r))}
});
