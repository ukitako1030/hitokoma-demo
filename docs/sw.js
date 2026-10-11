const CACHE = 'hitokoma-v2.1';
const SCOPE = new URL('./', self.location.href);
const cacheName = `${CACHE}:${SCOPE.pathname}`;
const assets = ['./','./index.html','./style.css?v=2','./app.js?v=2','./core.js?v=2','./exif.js?v=2','./print.js?v=2','./studio.js?v=2','./manifest.webmanifest','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png','./assets/cafe.jpg','./assets/walk.jpg','./assets/lunch.jpg','./assets/flowers.jpg','./assets/sea.jpg','./assets/reading.jpg'];
self.addEventListener('install',event=>{
  // Bypass the browser's HTTP cache so an older index.html is never installed
  // into the new offline cache during an upgrade from a previous release.
  event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(assets.map(path=>new Request(new URL(path,SCOPE).href,{cache:'reload'})))).then(()=>self.skipWaiting()));
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
