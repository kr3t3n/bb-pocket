const CACHE='pocket-shell-d276ce5d5c6e';
const ASSETS=["/","/index.html","/app.js","/style.css","/theme-init.js","/themes.css","/manifest.webmanifest","/logo.svg","/icon.svg","/icon-192.png","/icon-512.png","/apple-touch-icon.png","/favicon-32.png","/themes/opus/app.js","/themes/sol/app.js","/themes/sol/style.css","/themes/astra/app.js","/themes/astra/style.css","/themes/grok/app.js","/themes/grok/style.css"];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('pocket-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin!==location.origin||e.request.method!=='GET'||u.pathname.startsWith('/api/'))return;
 if(ASSETS.includes(u.pathname))e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request)));
});
