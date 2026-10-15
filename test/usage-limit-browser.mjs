import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import {existsSync} from 'node:fs';import {createPocketServer} from '../bridge.mjs';
const server=await createPocketServer({port:18909,journalStore:{load:async()=>({}),save:async()=>{}}});
const base='http://127.0.0.1:18909';let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(existsSync('/snap/bin/chromium')?'/snap/bin/chromium':undefined),args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'}),page=await context.newPage(),errors=[],writes=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 const now=Date.now(),future=new Date(now+86400000).toISOString(),past=new Date(now-1000).toISOString();
 const row=(id,providerId,environmentHostId,extra={})=>({id,title:'Thread '+id,providerId,environmentHostId,updatedAt:now,status:'idle',labels:[],...extra});
 const threads=[row('blocked','claude-code','host-a',{unread:true,status:'active'}),row('rounded','codex','host-a'),row('model-match','claude-code','host-b',{model:'known-model'}),row('other-model','claude-code','host-b',{model:'another-model'}),row('unknown-model','claude-code','host-b'),row('expired','claude-code','host-c'),row('unknown-host','claude-code',null)];
 let usageMode='ok',holdHosts=false,pending=[];
 const usage=hostId=>({hostId,providers:{'claude-code':{status:'ok',windows:[{label:'Weekly limit',usedPercent:100,resetsAt:hostId==='host-c'?past:future,...(hostId==='host-b'?{model:'known-model'}:{})}]},codex:{status:'ok',windows:[{label:'Session',usedPercent:99.9,resetsAt:future}]}},syncedAt:Date.now(),stale:usageMode==='stale'});
 await page.route('**/api/**',async r=>{
  const u=new URL(r.request().url());if(r.request().method()!=='GET'){writes.push(u.pathname);throw Error('Unexpected write '+u.pathname)}
  if(u.pathname==='/api/usage'){
   const host=u.searchParams.get('hostId');if(host&&holdHosts){pending.push({r,host});return}
   if(host&&usageMode==='error')return r.abort();return r.fulfill({json:usage(host)});
  }
  if(u.pathname==='/api/meta')return r.fulfill({json:{projects:[],taskProjects:[],labels:[]}});
  if(u.pathname==='/api/threads')return r.fulfill({json:{threads,total:threads.length,nextOffset:null}});
  throw Error('Unexpected API '+u.pathname);
 });
 await page.addInitScript(()=>{const theme=new URL(location.href).searchParams.get('theme');if(theme)localStorage.setItem('pocket:theme',JSON.stringify(theme))});
 const expectChips=async count=>page.waitForFunction(n=>document.querySelectorAll('.usage-limit-chip').length===n,count);
 const refresh=async()=>{await page.locator('[data-action="refresh"]').first().click()};
 for(const theme of ['opus','sol','astra','grok']){
  usageMode='ok';holdHosts=true;await page.goto(base+'/?theme='+theme+'#threads');await page.locator('[data-thread="blocked"]').waitFor();assert.equal(await page.locator('.usage-limit-chip').count(),0,theme+' hides saved counters until scoped refresh');
  await page.waitForFunction(()=>document.querySelectorAll('[data-thread]').length===7);
  for(let i=0;i<40&&pending.length<3;i++)await new Promise(r=>setTimeout(r,25));assert.equal(pending.length,3);assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
  holdHosts=false;await Promise.all(pending.splice(0).map(({r,host})=>r.fulfill({json:usage(host)})));await expectChips(2);
  for(const id of ['blocked','model-match'])assert.equal(await page.locator(`[data-thread="${id}"] .usage-limit-chip`).count(),1,theme+' '+id);
  for(const id of ['rounded','other-model','unknown-model','expired','unknown-host'])assert.equal(await page.locator(`[data-thread="${id}"] .usage-limit-chip`).count(),0,theme+' '+id);
  const chip=page.locator('[data-thread="blocked"] .usage-limit-chip');assert.match(await chip.getAttribute('title'),/Claude usage limit reached\. Resets/);assert.equal(await chip.getAttribute('aria-label'),await chip.getAttribute('title'));
  await chip.hover();await page.locator('#pocket-usage-tooltip:not([hidden])').waitFor();assert.match(await page.locator('#pocket-usage-tooltip').innerText(),/usage limit reached/);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#pocket-usage-tooltip').isVisible(),false);
  await page.locator('[data-thread="blocked"]').focus();assert.equal(await page.locator('[data-thread="blocked"]').getAttribute('aria-describedby'),'pocket-usage-tooltip');assert(await page.locator('#pocket-usage-tooltip').isVisible());
  await chip.tap();assert.equal(new URL(page.url()).hash,'#threads');assert(await page.locator('#pocket-usage-tooltip').isVisible());
  const tipBox=await page.locator('#pocket-usage-tooltip').boundingBox();assert(tipBox.x>=0&&tipBox.y>=0&&tipBox.x+tipBox.width<=390&&tipBox.y+tipBox.height<=844);
  await page.locator('h1').click();assert.equal(await page.locator('#pocket-usage-tooltip').isVisible(),false);
  assert.equal(await page.locator('[data-thread-card="blocked"]').getAttribute('data-unread'),'true');assert.equal(await page.locator('[data-thread="blocked"] .unreadmark').count(),1);assert(await page.locator('[data-thread="blocked"] .st-running,[data-thread="blocked"] .threadstatus.active,[data-thread="blocked"] .statusdot.active').count()>0,theme+' preserves active status');
  await page.setViewportSize({width:320,height:700});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,theme+' no horizontal overflow');
  const visible=await chip.evaluate(el=>{const r=el.getBoundingClientRect(),parent=el.parentElement.getBoundingClientRect();return r.width>0&&r.right<=parent.right+1});assert(visible,theme+' chip visible in compact row');await page.setViewportSize({width:390,height:844});
  usageMode='stale';await refresh();await expectChips(0);
  usageMode='ok';await refresh();await expectChips(2);
  usageMode='error';await refresh();await expectChips(0);
  console.log('PASS '+theme+': exact limit, model/host scope, reset expiry, accessible labels, unread/status, stale/error reads, 320px layout');
 }
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);console.log('PASS: every API mocked; zero agent writes');
}finally{if(browser)await browser.close();await server.close()}
