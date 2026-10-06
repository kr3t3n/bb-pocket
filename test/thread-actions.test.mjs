import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import {createPocketServer} from '../bridge.mjs';
test('thread menu uses fresh state and restricts actions, origins and deletion confirmation',async()=>{
 const calls=[];const fake=http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify([{id:'p',isPersonal:false}]))});await new Promise(r=>fake.listen(18893,'127.0.0.1',r));
 const t={id:'thread-1',projectId:'p',title:'Thread',latestAttentionAt:2,lastReadAt:1,pinnedAt:123};
 const actions={get:async()=>t};for(const a of ['pin','unpin','read','unread','rename','archive','unarchive','delete','split','children'])actions[a]=async(id,input)=>{calls.push({a,id,input});return {ok:true}};
 const server=await createPocketServer({port:18892,upstream:'http://127.0.0.1:18893',bbUrl:'https://owner.example',journalStore:{load:async()=>({}),save:async()=>{}},threadActions:actions});
 const post=(input,extra={})=>fetch('http://127.0.0.1:18892/api/thread/thread-1/action',{method:'POST',headers:{'content-type':'application/json','x-pocket-request':'1',...extra},body:JSON.stringify(input)});
 try{
 const menu=await fetch('http://127.0.0.1:18892/api/thread/thread-1/menu').then(r=>r.json());assert.equal(menu.thread.unread,true);assert.equal(menu.cloudLink,'https://owner.example/projects/p/threads/thread-1');assert.equal(menu.localLink,'http://127.0.0.1:18893/projects/p/threads/thread-1');
 assert.equal((await post({action:'spawn'})).status,400);assert.equal((await post({action:'rename',title:' '})).status,400);assert.equal((await post({action:'delete',childThreadsConfirmed:true})).status,400);assert.equal((await post({action:'pin'},{origin:'https://evil.example'})).status,403);assert.equal(calls.length,0);
 for(const action of ['read','unread','pin','unpin','archive','unarchive','split','children'])assert.equal((await post({action})).status,200);
 assert.equal((await post({action:'rename',title:'  Better name  ',model:'ignored'})).status,200);assert.deepEqual(calls.at(-1),{a:'rename',id:'thread-1',input:{title:'Better name'}});
 assert.equal((await post({action:'delete',confirmed:true,childThreadsConfirmed:false})).status,200);assert.deepEqual(calls.at(-1),{a:'delete',id:'thread-1',input:{childThreadsConfirmed:false}});
 }finally{await server.close();await new Promise(r=>fake.close(r))}
});
