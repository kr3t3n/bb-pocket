import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
await mkdir('test-results',{recursive:true});
const BASE=process.env.POCKET_TEST_URL||'http://127.0.0.1:8890';
const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(existsSync('/snap/bin/chromium')?'/snap/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
const context=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(BASE);await page.locator('[data-thread]').first().waitFor();
 assert(await page.getByText('Exclude: automation').isVisible());
 await page.screenshot({path:'test-results/threads.png',fullPage:false});
 await page.getByText('Exclude: automation').click();await page.waitForTimeout(500);await page.reload();await page.locator('[data-thread]').first().waitFor();assert.equal(await page.getByText('Exclude: automation').count(),0);
 await page.getByRole('button',{name:'Filters',exact:true}).click();await page.locator('#statusfilter').selectOption('running');await page.getByRole('button',{name:'Apply filters'}).click();await page.waitForTimeout(400);assert(await page.getByRole('button',{name:'running ×'}).isVisible());
 await page.getByRole('button',{name:'running ×'}).click();await page.locator('[data-thread]').first().waitFor();
 const first=page.locator('[data-thread]').first();const selectedId=await first.getAttribute('data-thread');const selectedTitle=await first.locator('.rowtitle').textContent();await page.getByRole('searchbox').fill(selectedTitle);await page.waitForTimeout(500);await page.locator(`[data-thread="${selectedId}"]`).click();await page.locator('.message').first().waitFor();
 await page.locator('#draft').fill('Draft persistence check — not sent');await page.screenshot({path:'test-results/conversation.png'});
 await page.reload();await page.locator('.message').first().waitFor();assert.equal(await page.locator('#draft').inputValue(),'Draft persistence check — not sent');
 await page.evaluate(async()=>await navigator.serviceWorker.ready);await context.setOffline(true);await page.reload();await page.locator('.message').first().waitFor();assert.equal(await page.locator('#draft').inputValue(),'Draft persistence check — not sent');await page.screenshot({path:'test-results/offline.png'});
 await context.setOffline(false);await page.waitForTimeout(1500);assert(await page.getByText('Connected',{exact:true}).isVisible());
 await page.route('**/api/thread/*/send',r=>r.fulfill({json:{state:'sent',result:{requestId:'mock-only'}}}));await page.getByRole('button',{name:'Send message',exact:true}).click();await page.waitForTimeout(500);assert.equal(await page.locator('#draft').inputValue(),'');await page.unroute('**/api/thread/*/send');
 await page.goto(BASE+'/#tasks');await page.locator('[data-task]').first().waitFor();await page.screenshot({path:'test-results/tasks.png'});await page.locator('[data-task]').first().click();await page.locator('#taskcontent h1').waitFor();
 await page.goto(BASE+'/#projects');await page.locator('.projectcard').first().waitFor();await page.screenshot({path:'test-results/projects.png'});await page.locator('[data-project-tasks]').first().click();await page.waitForTimeout(500);assert(await page.getByRole('heading',{name:'Tasks',exact:true}).isVisible());
 await page.route('**/api/usage',r=>r.fulfill({json:{providers:{test:{status:'ok',planLabel:'Test plan',windows:[{label:'Session',usedPercent:84,resetsAt:'2030-01-01T12:00:00Z'}]},expired:{status:'expired'}},stale:false,syncedAt:Date.now()}}));
 await page.locator('.usage summary').click();await page.getByRole('button',{name:'Refresh usage',exact:true}).click();await page.getByText('84% used',{exact:true}).waitFor();assert.equal(await page.locator('progress').getAttribute('value'),'84');assert(await page.getByText('Session expired — sign in through BB',{exact:true}).isVisible());assert(await page.getByText(/^Resets /).isVisible());
 await page.route('**/api/usage',r=>r.abort());await page.getByRole('button',{name:'Refresh usage',exact:true}).click();await page.getByText(/Saved usage/).waitFor();assert(await page.getByText('84% used',{exact:true}).isVisible());
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);console.log('PASS: mobile threads, persistent exclusions/status, search, conversation, drafts, offline reload/reconnect, tasks detail, projects, no overflow or JS errors');
}finally{await b.close()}
