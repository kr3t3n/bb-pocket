import {build} from 'esbuild';import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
await build({entryPoints:['src/app.js'],bundle:true,minify:true,outfile:'public/app.js'});
const hash=createHash('sha256');for(const file of ['app.js','style.css','index.html','manifest.webmanifest','logo.svg','icon.svg','icon-192.png','icon-512.png','apple-touch-icon.png','favicon-32.png'])hash.update(await readFile('public/'+file));
const sw=await readFile('public/sw.js','utf8');await writeFile('public/sw.js',sw.replace(/const CACHE='[^']+';/,`const CACHE='pocket-shell-${hash.digest('hex').slice(0,12)}';`));

const assets={};for(const file of ['index.html','app.js','style.css','sw.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','logo.svg','apple-touch-icon.png','favicon-32.png'])assets[file]=(await readFile('public/'+file)).toString('base64');await writeFile('plugin-assets.json',JSON.stringify(assets)+'\n');
