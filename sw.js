const CACHE = 'salvacivici-v0.6.14';
const CACHE_PREFIX = 'salvacivici-v';
const ASSETS = ['./', './index.html','./styles.css','./core.js','./comuni-mantova.js','./app.js','./map-review.js','./cloud-merge.js','./cloud-sync.js','./cloud-google.js','./manifest.webmanifest','./assets/icon-home-192-v068.png','./assets/icon-home-512-v068.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{if(response.ok){const clone=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,clone));}return response;}).catch(()=>caches.match(event.request).then(cached=>cached||caches.match('./index.html'))));});
