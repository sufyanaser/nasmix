const CACHE_NAME = "nasmix-shell-v9";
const APP_SHELL = [
  "./","./index.html","./ui/styles.css","./ui/prompt-safety.css","./ui/compact-brief.css","./ui/projects-library.css","./ui/prompt-library.css","./ui/app.js",
  "./ui/project-store.js","./ui/song-brief.js","./ui/project-workspace.js","./ui/project-bootstrap.js","./ui/projects-library.js","./ui/prompt-library.js",
  "./data/catalog.json","./data/presets-acoustic.json","./data/presets-modern.json","./data/project-schema.json",
  "./data/knowledge/manifest.json","./data/knowledge/reliability.json","./data/knowledge/evidence-registry.json",
  "./data/knowledge/workflow-stages.json","./data/knowledge/musical-roles.json","./manifest.webmanifest","./assets/icon.svg"
];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  const request=event.request;if(request.method!=="GET")return;const url=new URL(request.url);
  if(url.pathname.includes("/data/")){event.respondWith(fetch(request,{cache:"no-store"}).then(response=>{const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));return response;}).catch(()=>caches.match(request)));return;}
  if(request.mode==="navigate"){event.respondWith(fetch(request).then(response=>{const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put("./index.html",copy));return response;}).catch(()=>caches.match("./index.html")));return;}
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));return response;})));
});