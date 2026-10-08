import {build} from 'esbuild';import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const themeNames=['opus','sol','astra','grok'];
await build({entryPoints:['src/bootstrap.js'],bundle:true,minify:true,outfile:'public/app.js'});
for(const name of themeNames){const source=name==='opus'?'src':'src/themes/'+name;await mkdir('public/themes/'+name,{recursive:true});await build({entryPoints:[source+'/app.js'],bundle:true,minify:true,outfile:'public/themes/'+name+'/app.js'});if(name!=='opus')await copyFile(source+'/style.css','public/themes/'+name+'/style.css')}
const files=['index.html','app.js','style.css','theme-init.js','themes.css','manifest.webmanifest','logo.svg','icon.svg','icon-192.png','icon-512.png','apple-touch-icon.png','favicon-32.png',...themeNames.flatMap(n=>['themes/'+n+'/app.js',...(n==='opus'?[]:['themes/'+n+'/style.css'])])];
const hash=createHash('sha256');for(const file of files)hash.update(await readFile('public/'+file));
let sw=await readFile('public/sw.js','utf8');sw=sw.replace(/const CACHE='[^']+';/,`const CACHE='pocket-shell-${hash.digest('hex').slice(0,12)}';`).replace(/const ASSETS=\[[^\]]*\];/,`const ASSETS=${JSON.stringify(['/',...files.map(f=>'/'+f)])};`);await writeFile('public/sw.js',sw);
const assets={};for(const file of [...files,'sw.js'])assets[file]=(await readFile('public/'+file)).toString('base64');await writeFile('plugin-assets.json',JSON.stringify(assets)+'\n');
