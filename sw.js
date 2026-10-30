// Farmington Bay 6th Ward: offline copy of the page only.
// Network-first for the page; every non-navigation request (icons, images,
// manifest, cross-origin links) goes straight to the network so iOS can always
// fetch the home-screen icon.
const CACHE = "fb6-cover-v9";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("fb6-") && !k.startsWith("fb6-rs-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope).pathname;
  // Network-first offline copies: the home page, the Bay 6 Calendar page, and its data.
  // Other sub-pages and all other requests go straight to the network.
  let key = null;
  if (req.mode === "navigate" && (url.pathname === scope || url.pathname === scope + "index.html")) key = "./";
  else if (req.mode === "navigate" && (url.pathname === scope + "calendar/" || url.pathname === scope + "calendar/index.html")) key = "./calendar/";
  else if (url.pathname === scope + "data/calendar.json") key = "./data/calendar.json";
  if (!key) return;
  e.respondWith(
    fetch(req)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); return res; })
      .catch(() => caches.match(key))
  );
});
