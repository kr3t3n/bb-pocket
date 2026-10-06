import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/snap/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({deviceScaleFactor:1});
const svg=await readFile(path.join(root,'public/icon.svg'),'utf8');
for(const [size,file] of [[512,'icon-512.png'],[192,'icon-192.png'],[180,'apple-touch-icon.png'],[32,'favicon-32.png']]){
 await page.setViewportSize({width:size,height:size});
 await page.setContent(`<style>html,body{margin:0;width:100%;height:100%}svg{display:block;width:100%;height:100%}</style>${size===32 ? svg : svg.replace('rx="112"','rx="0"')}`);
 await page.screenshot({path:path.join(root,'public',file),omitBackground:true});
}
await page.setViewportSize({width:920,height:660});
const logo=await readFile(path.join(root,'public/logo.svg'),'utf8');
await page.setContent(`<style>body{margin:0;background:#121615;color:#edf3ee;font-family:Arial;padding:58px}h1{font-size:14px;letter-spacing:2px;text-transform:uppercase;color:#95a79a;font-weight:500;margin:0 0 40px}.logo svg{height:80px;width:auto}.icons{margin-top:60px;display:flex;gap:36px;align-items:center}.icons svg{width:240px;height:240px}.icons img{display:block}.small{display:flex;align-items:center;gap:24px}.note{margin-top:44px;font-size:13px;color:#95a79a}</style><h1>BB Pocket · identity</h1><div class="logo">${logo}</div><div class="icons">${svg}<div class="small"><img width="80" src="data:image/png;base64,${(await readFile(path.join(root,'public/icon-192.png'))).toString('base64')}"><img width="32" src="data:image/png;base64,${(await readFile(path.join(root,'public/favicon-32.png'))).toString('base64')}"></div></div><div class="note">The original BB silhouette. A quiet pocket seam. Mint on forest.</div>`);
await page.screenshot({path:path.join(root,'design/brand-preview.png')});
await browser.close();
