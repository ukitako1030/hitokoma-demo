const CACHE = 'hitokoma-v1';
const SCOPE = new URL('./', self.location.href);
const cacheName = `${CACHE}:${SCOPE.pathname}`;
const assets = ['./','./index.html','./style.css','./app.js','./core.js','./manifest.webmanifest','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png','./assets/cafe.jpg','./assets/walk.jpg','./assets/lunch.jpg','./assets/flowers.jpg','./assets/sea.jpg','./assets/reading.jpg'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(assets.map(path=>new URL(path,SCOPE).href))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('hitokoma-')&&key.endsWith(`:${SCOPE.pathname}`)&&key!==cacheName).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==SCOPE.origin||!url.pathname.startsWith(SCOPE.pathname))return;
  event.respondWith((async()=>{
    const cache=await caches.open(cacheName);
    if(event.request.mode==='navigate'){
      try{const response=await fetch(event.request);if(response.ok)return response;}catch{}
      return (await cache.match(new URL('./index.html',SCOPE).href))||Response.error();
    }
    const cached=await cache.match(event.request);
    return cached||fetch(event.request);
  })());
});
