const CACHE='network-inspector-static-v2014';
const ASSETS=['./','./index.html','./styles.css','./app.js','./guide.html','./terms.html','./terms-gate.js','./manifest.webmanifest','./icons/app.svg','./icons/app-192.png','./icons/app-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin!==location.origin || u.pathname.startsWith('/api/'))return;
if(u.pathname.endsWith('/guide.html'))return;
if(e.request.method==='GET')e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));});