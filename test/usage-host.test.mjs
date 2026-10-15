import test from 'node:test';import assert from 'node:assert/strict';import {createPocketServer} from '../bridge.mjs';
test('usage endpoint forwards host scope and isolates cache entries',async()=>{
 const calls=[];const server=await createPocketServer({port:18907,journalStore:{load:async()=>({}),save:async()=>{}},usageLimits:async hostId=>{calls.push(hostId);return {codex:{status:'ok',windows:[{label:'Session',usedPercent:hostId==='host-a'?100:20,resetsAt:null}]}}}});
 const port=server.server.address().port;
 const get=path=>fetch('http://127.0.0.1:'+port+path);
 try{
  const a=await(await get('/api/usage?hostId=host-a')).json(),b=await(await get('/api/usage?hostId=host-b')).json(),local=await(await get('/api/usage')).json();
  assert.equal(a.hostId,'host-a');assert.equal(a.providers.codex.windows[0].usedPercent,100);assert.equal(b.hostId,'host-b');assert.equal(b.providers.codex.windows[0].usedPercent,20);assert.equal(local.hostId,null);
  await get('/api/usage?hostId=host-a');assert.deepEqual(calls,['host-a','host-b',null]);
  assert.equal((await get('/api/usage?hostId=bad%2Fhost')).status,400);assert.equal(calls.length,3);
 }finally{await server.close()}
});
