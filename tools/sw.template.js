// Dostlar Kahvehanesi servis işçisi: oyunu cihaza indirir, internetsiz de açılır.
// Bu dosya tools/build-sw.mjs ile üretilir; elle düzenleme (tools/sw.template.js'i düzenle).
const VERSION = '__VERSION__';
const CACHE = `kahvehane-${VERSION}`;
const FILES = __FILES__;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('kahvehane-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Önce önbellek (anında açılır); yoksa ağ. Yeni sürüm arka planda iner, bir sonraki açılışta devreye girer
// (oyun ortasında sayfa yenilenmez).
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html'))),
  );
});
