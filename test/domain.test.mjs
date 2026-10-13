import test from 'node:test';import assert from 'node:assert/strict';import {filterThreads} from '../src/domain.mjs';
const rows=[{id:'a',title:'One',labels:['automation','bug'],projectId:'p',status:'active',unread:true,updatedAt:3},{id:'b',title:'Two',labels:['bug'],projectId:'p',status:'idle',unread:false,updatedAt:1},{id:'c',title:'Three',labels:[],projectId:'q',status:'error',hasPendingInteraction:true,unread:true,updatedAt:2}];
test('automation excluded by default; explicit empty exclusion includes it',()=>{assert.deepEqual(filterThreads(rows).map(t=>t.id),['c','b']);assert.equal(filterThreads(rows,{exclude:''}).length,3)});
test('combines include, exclude, project, status, unread and query',()=>{assert.deepEqual(filterThreads(rows,{include:'bug',exclude:'',project:'p',status:'running',unread:'true',q:'one'}).map(t=>t.id),['a']);assert.deepEqual(filterThreads(rows,{include:'bug',exclude:'automation'}).map(t=>t.id),['b'])});
test('attention and oldest sorts',()=>{assert.equal(filterThreads(rows,{status:'attention'})[0].id,'c');assert.deepEqual(filterThreads(rows,{exclude:'',sort:'oldest'}).map(t=>t.id),['b','c','a'])});

test('only unanswered blocking interactions need input',async()=>{
 const {requiresUserInput}=await import('../src/domain.mjs');const now=1000;
 const question={status:'pending',payload:{kind:'user_question'},expiresAt:2000};
 const optional={status:'pending',origin:{pluginId:'provider-codex',rendererId:'async-question'},payload:{kind:'plugin'}};
 assert.equal(requiresUserInput([optional],now),false);
 assert.equal(requiresUserInput([{status:'pending',payload:{kind:'provider-codex/async-question'}}],now),false);
 assert.equal(requiresUserInput([{...question,status:'resolving'}],now),false);
 assert.equal(requiresUserInput([{...question,expiresAt:500}],now),false);
 assert.equal(requiresUserInput([question],now),true);
 assert.equal(requiresUserInput([optional,{status:'pending',payload:{kind:'approval'}}],now),true);
 assert.equal(requiresUserInput([{status:'pending',origin:{pluginId:'secrets',rendererId:'secret-request'},payload:{kind:'plugin'}}],now),true);
 assert.equal(requiresUserInput([],now),false);
});
