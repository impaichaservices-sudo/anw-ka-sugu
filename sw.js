// Service worker : l'application s'ouvre même avec une connexion faible.
const CACHE = "anw-v1.1";
const SHELL = [
  "./", "index.html", "style.css", "manifest.webmanifest", "logo.png", "icon-48.png", "icon-192.png",
  "app.js", "lib.js", "icons.js", "config.js", "shop.js", "account.js", "rfq.js", "seller.js", "admin.js",
];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Photos des produits : gardées sur le téléphone (elles ne changent jamais)
  if (url.pathname.includes("/storage/v1/object/public/catalogue/")) {
    e.respondWith(caches.open("anw-photos").then(async (c) => (await c.match(e.request)) || fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; })));
    return;
  }
  if (url.origin !== location.origin) return;
  // Fichiers de l'application : réseau d'abord (toujours à jour), sinon la copie gardée.
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match("index.html"))));
});
