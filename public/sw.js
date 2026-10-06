const CACHE='pocket-shell-08c4b8878f53';
const ASSETS=['/','/index.html','/app.js','/style.css','/logo.svg','/apple-touch-icon.png','/favicon-32.png','/icon.svg','/icon-192.png','/icon-512.png','/manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('pocket-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin!==location.origin||e.request.method!=='GET'||u.pathname.startsWith('/api/'))return;
 if(ASSETS.includes(u.pathname))e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request)));
});
