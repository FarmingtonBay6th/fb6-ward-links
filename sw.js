// Farmington Bay 6th Ward: offline copy of the page only.
// Network-first for the page; every non-navigation request (icons, images,
// manifest, cross-origin links) goes straight to the network so iOS can always
// fetch the home-screen icon.
const CACHE = "fb6-christus-v4";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("fb6-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || req.mode !== "navigate") return;
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put("./", copy)); return res; })
      .catch(() => caches.match("./"))
  );
});
