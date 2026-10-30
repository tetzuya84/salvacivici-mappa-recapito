/* Beta 0.6.19 — cache aggiornata, navigazione sempre network-first. */
const CACHE='salvacivici-v0.6.19';
const CACHE_PREFIX='salvacivici-v';
const ASSETS=['./','./index.html','./styles.css','./core.js','./comuni-mantova.js','./app.js','./updates.js','./map-review.js','./map-overview.js','./cloud-merge.js','./cloud-sync.js','./cloud-google.js','./manifest.webmanifest',
'./assets/salvacivici-v06515.svg','./assets/favicon-16-v06515.png','./assets/favicon-32-v06515.png','./assets/apple-touch-180-v06515.png','./assets/icon-192-v06515.png','./assets/icon-512-v06515.png','./assets/icon-maskable-512-v06515.png'];
self.addEventListener('install',event=>{
  // Compatibilità con le versioni precedenti, che rilevano l'update al controllerchange.
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
  const navigation=request.mode==='navigate';
  event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{
    if(response.ok){
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(navigation?'./index.html':request,copy)).catch(()=>{});
    }
    return response;
  }).catch(()=>caches.match(navigation?'./index.html':request).then(cached=>cached||(navigation?caches.match('./'):undefined)).then(cached=>cached||Response.error())));
});
