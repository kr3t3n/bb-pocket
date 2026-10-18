import {chromium} from '@playwright/test';import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/snap/bin/chromium',args:['--no-sandbox']});
const base=process.env.POCKET_TEST_URL||'http://127.0.0.1:8911';
try{for(const theme of ['opus','sol','astra','grok']){
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();const errors=[],sends=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(t=>localStorage.setItem('pocket:theme',JSON.stringify(t)),theme);
 const thread={id:'test',title:'Question test',status:'idle',hasPendingInteraction:true,hasUiQuestion:true,labels:[],providerId:'codex'};
 await page.route('**/api/**',async r=>{const path=new URL(r.request().url()).pathname;let json={};
 if(path==='/api/meta')json={projects:[],taskProjects:[],labels:[]};
 else if(path==='/api/threads')json={threads:[thread],total:1,nextOffset:null};
 else if(path==='/api/usage')json={providers:{}};
 else if(path.endsWith('/timeline'))json={thread,rows:[{id:'question',kind:'conversation',role:'assistant',text:'**Start date**\n\nWhen should Example start?',hasGenerativeUi:true,uiReplies:[{label:'January',text:'Start in January.'},{label:'Other date',text:'A different date.'}],createdAt:Date.now()}]};
 else if(path.endsWith('/send')){sends.push(r.request().postDataJSON());json={state:'sent'}}
 else if(path.endsWith('/delivery'))json={state:'sent'};
 else if(!path.endsWith('/read'))throw Error(path);
 await r.fulfill({json});});
 await page.goto(base+'/#threads');await page.locator('[data-thread]').waitFor();assert.match(await page.locator('[data-thread]').innerText(),/Needs input/);
 await page.locator('[data-thread]').click();await page.locator('#draft').fill('My note');await page.getByRole('button',{name:'January',exact:true}).click();assert.equal(await page.locator('#draft').inputValue(),'My note\n\nStart in January.');assert.equal(sends.length,0);
 await page.reload();await page.locator('#draft').waitFor();assert.equal(await page.locator('#draft').inputValue(),'My note\n\nStart in January.');
 await page.setViewportSize({width:320,height:700});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.locator('#compose button[type="submit"]').click();await page.waitForFunction(()=>document.querySelector('#draft').value==='');assert.equal(sends.length,1);assert.equal(sends[0].text,'My note\n\nStart in January.');assert.deepEqual(errors,[]);
 console.log('PASS '+theme+': question status, reply buttons, preserved draft, explicit mocked send, narrow layout');await context.close();
}}finally{await browser.close()}
