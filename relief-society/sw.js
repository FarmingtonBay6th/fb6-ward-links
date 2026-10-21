// FB6 Relief Society page (DRAFT): offline copy of this page only.
// Page and data.json are network-first with a cached fallback. The Google Sheet
// CSVs are not touched here; the page keeps its own last-good copy in localStorage.
const CACHE = "fb6-rs-v2";
const SHELL = ["./", "data.json", "rs-emblem.png", "manifest.webmanifest", "icons/rs-180.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith("fb6-rs-") && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope).pathname;
  const isPage = req.mode === "navigate" && (url.pathname === scope || url.pathname === scope + "index.html");
  const isData = url.pathname === scope + "data.json";
  if (!isPage && !isData) return;
  const key = isPage ? "./" : "data.json";
  e.respondWith(
    fetch(req)
      .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); } return res; })
      .catch(() => caches.match(key))
  );
});
