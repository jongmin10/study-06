const CACHE = 'jangbaguni-v1';
const SHELL = ['/mobile/index.html', '/mobile/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Supabase API 호출은 캐시하지 않음 (항상 네트워크)
  if (url.hostname.includes('supabase.co')) return;
  // 앱 셸은 캐시 우선
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request))
  );
});
