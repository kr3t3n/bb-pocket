import test from 'node:test';import assert from 'node:assert/strict';
import {threadUsageLimit,createThreadUsage,threadLimitChip} from '../src/usage-limit.mjs';
import {compactThread} from '../src/domain.mjs';
const now=Date.parse('2030-01-01T12:00:00Z');
const thread={id:'thread',providerId:'claude-code',environmentHostId:'host-a',model:'known-model'};
const snapshot=(windows,extra={})=>({hostId:'host-a',providers:{'claude-code':{status:'ok',windows}},stale:false,...extra});
const window=(usedPercent=100,extra={})=>({label:'Weekly limit',usedPercent,resetsAt:'2030-01-02T12:00:00Z',...extra});

test('marks only an exhausted allowance, not a rounded zero remaining',()=>{
 for(const percent of [0,50,99,99.5,99.999,NaN,Infinity,null,undefined,'100'])assert.equal(threadUsageLimit(thread,snapshot([window(100,{usedPercent:percent})]),now),null,String(percent));
 for(const percent of [100,100.01,140])assert.deepEqual(threadUsageLimit(thread,snapshot([window(percent)]),now),{resetsAt:'2030-01-02T12:00:00.000Z'});
});
test('ignores unknown, stale, failed and unrelated provider or host usage',()=>{
 for(const usage of [null,{},snapshot([window()],{stale:true}),snapshot([window()],{warning:'offline'}),snapshot([window()],{hostId:'host-b'}),snapshot([window()],{providers:{codex:{status:'ok',windows:[window()]}}})])assert.equal(threadUsageLimit(thread,usage,now),null);
 for(const status of ['error','expired','unauthenticated','not_installed'])assert.equal(threadUsageLimit(thread,{...snapshot([]),providers:{'claude-code':{status,windows:[window()]}}},now),null);
 assert.equal(threadUsageLimit({...thread,environmentHostId:null},snapshot([window()]),now),null);
});
test('expires elapsed windows and waits for all exhausted windows to reset',()=>{
 assert.equal(threadUsageLimit(thread,snapshot([window(100,{resetsAt:'2030-01-01T11:59:59Z'})]),now),null);
 assert.equal(threadUsageLimit(thread,snapshot([window(100,{resetsAt:new Date(now).toISOString()})]),now),null);
 const active=window(100,{resetsAt:'2030-01-03T12:00:00Z'});
 assert.equal(threadUsageLimit(thread,snapshot([window(),active]),now).resetsAt,'2030-01-03T12:00:00.000Z');
 for(const resetsAt of [null,'not-a-date'])assert.equal(threadUsageLimit(thread,snapshot([window(),window(100,{resetsAt})]),now).resetsAt,null);
 assert.equal(threadUsageLimit(thread,snapshot([window(100,{resetsAt:'2029-01-01T00:00:00Z'}),active]),now).resetsAt,active.resetsAt.replace('Z','.000Z'));
});
test('scopes model windows exactly and keeps shared windows provider-wide',()=>{
 const scoped=snapshot([window(100,{model:'known-model'})]);
 assert(threadUsageLimit(thread,scoped,now));
 for(const model of ['other-model','known-model-preview',null,undefined])assert.equal(threadUsageLimit({...thread,model},scoped,now),null);
 assert(threadUsageLimit({...thread,model:null},snapshot([window(),window(100,{model:'other-model'})]),now));
 for(const extra of [{model:''},{label:'Weekly Sonnet limit'},{label:'Opus'},{label:'Fable'},{label:'Haiku'}])assert.equal(threadUsageLimit(thread,snapshot([window(100,extra)]),now),null);
 assert.equal(compactThread(thread).model,'known-model');assert.equal(compactThread(thread).environmentHostId,'host-a');
});
test('loads and caches usage separately by host and never guesses an unknown host',async()=>{
 let clock=now;const calls=[];
 const usage=createThreadUsage({now:()=>clock,api:async path=>{calls.push(path);const hostId=new URL(path,'http://test/').searchParams.get('hostId');return snapshot([window(hostId==='host-a'?100:50)],{hostId})}});
 const other={...thread,environmentHostId:'host-b'};
 assert.equal(usage.limit(thread),null);
 await usage.refresh([thread,thread,other,{...thread,environmentHostId:null}]);
 assert.deepEqual(calls,['usage?hostId=host-a','usage?hostId=host-b']);assert(usage.limit(thread));assert.equal(usage.limit(other),null);
 await usage.refresh([thread]);assert.equal(calls.length,2);
 clock+=60001;assert.equal(usage.limit(thread),null);
 await usage.refresh([thread]);assert.equal(calls.length,3);assert(usage.limit(thread));
});
test('hides saved, stale and failed reads and restores after a successful refresh',async()=>{
 let clock=now,mode='ok',release;let changes=0;
 const usage=createThreadUsage({now:()=>clock,onChange:()=>changes++,api:async()=>{
  if(mode==='pending')await new Promise(resolve=>release=resolve);
  if(mode==='error')throw Error('offline');
  return snapshot([window()],{stale:mode==='stale'});
 }});
 await usage.refresh([thread]);assert(usage.limit(thread));
 mode='pending';clock+=60001;const pending=usage.refresh([thread]);assert.equal(usage.limit(thread),null);release();await pending;assert(usage.limit(thread));
 mode='stale';await usage.refresh([thread],true);assert.equal(usage.limit(thread),null);
 mode='error';await usage.refresh([thread],true);assert.equal(usage.limit(thread),null);
 mode='ok';await usage.refresh([thread],true);assert(usage.limit(thread));assert.equal(changes,5);
 const esc=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
 const chip=threadLimitChip(thread,usage,'Claude',esc);assert.match(chip,/role="img"/);assert.match(chip,/aria-label="Claude usage limit reached\. Resets/);assert.match(chip,/>Limit<\/span>/);
});
