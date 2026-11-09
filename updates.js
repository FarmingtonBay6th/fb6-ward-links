/* Unread dots for Hub section tiles and in-page links to those sections.
   Loaded by nav.js (and by the few pages that do not use the shared bar).
   Compares data/section-updates.json with localStorage key fb6-section-seen. */
(function () {
  if (window.__fb6UpdatesRan) return;
  window.__fb6UpdatesRan = true;
  var api = window.Fb6Seen;
  if (!api) return;

  var script = document.currentScript;
  var base = new URL("./", script ? script.src : location.href);
  var KEY = "fb6-section-seen";

  var css = document.createElement("style");
  css.textContent =
    ".fb-new{position:absolute;top:12px;right:12px;width:12px;height:12px;border-radius:50%;background:#0a84ff;box-shadow:0 0 0 2px #fff;pointer-events:none;z-index:3}" +
    ".fb-new-icon{position:relative}" +
    ".fb-new-icon>.fb-new{top:-3px;right:-3px}" +
    "a.ts>.fb-new{top:10px;right:14px;box-shadow:0 0 0 2px #fff}" +
    "a.fb-unseen{position:relative}" +
    ".fb-new-inline{position:static;display:inline-block;width:10px;height:10px;margin:0 0 2px 6px;vertical-align:middle;box-shadow:0 0 0 2px var(--card,#fff)}" +
    "@keyframes fb-new-pulse{0%,100%{opacity:1}50%{opacity:.45}}" +
    ".fb-new{animation:fb-new-pulse 2.4s ease-in-out infinite}" +
    "@media (pointer:coarse){.fb-new{width:14px;height:14px}.fb-new-inline{width:11px;height:11px}}" +
    "@media (prefers-color-scheme:dark){.fb-new{box-shadow:0 0 0 2px #27211d}a.ts>.fb-new,.fb-new-icon>.fb-new{box-shadow:0 0 0 2px #fff}}" +
    "@media (prefers-contrast:more){.fb-new{box-shadow:0 0 0 2px #fff,0 0 0 4px #003a55}}" +
    "@media (prefers-reduced-motion:reduce){.fb-new{animation:none}}";
  document.head.appendChild(css);

  function loadState() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { init: false, seen: {} };
      return raw;
    } catch (e) {
      return { init: false, seen: {} };
    }
  }

  function saveState(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  function clearMarks() {
    var dots = document.querySelectorAll(".fb-new");
    for (var i = 0; i < dots.length; i++) dots[i].remove();
    var labeled = document.querySelectorAll("[data-fb-label]");
    for (var j = 0; j < labeled.length; j++) labeled[j].setAttribute("aria-label", labeled[j].getAttribute("data-fb-label"));
    var hosts = document.querySelectorAll(".fb-unseen, .fb-new-icon");
    for (var k = 0; k < hosts.length; k++) hosts[k].classList.remove("fb-unseen", "fb-new-icon");
  }

  function iconHost(anchor) {
    var kids = anchor.children;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].classList && kids[i].classList.contains("ic")) return kids[i];
    }
    return null;
  }

  function isTile(anchor) {
    var display = window.getComputedStyle(anchor).display;
    return display === "flex" || display === "grid" || display === "block";
  }

  function paint(sections, unread) {
    clearMarks();
    var links = document.querySelectorAll("a[href]");
    for (var i = 0; i < links.length; i++) {
      var anchor = links[i];
      if (anchor.hasAttribute("download")) continue;
      var url;
      try { url = new URL(anchor.getAttribute("href"), location.href); } catch (e) { continue; }
      var id = api.sectionForLink(sections, api.siteRel(url.href, base.href));
      if (!id || !unread[id]) continue;
      var dot = document.createElement("span");
      dot.className = "fb-new";
      dot.setAttribute("role", "img");
      dot.setAttribute("aria-label", "New updates");
      dot.setAttribute("data-fb-section", id);
      if (anchor.hasAttribute("aria-label")) {
        if (!anchor.hasAttribute("data-fb-label")) anchor.setAttribute("data-fb-label", anchor.getAttribute("aria-label"));
        var baseLabel = anchor.getAttribute("data-fb-label");
        if (baseLabel.indexOf("New updates") === -1) anchor.setAttribute("aria-label", baseLabel + ", New updates");
      }
      if (isTile(anchor)) {
        anchor.classList.add("fb-unseen");
        var host = iconHost(anchor);
        if (host) { host.classList.add("fb-new-icon"); host.appendChild(dot); }
        else anchor.appendChild(dot);
      } else {
        dot.classList.add("fb-new-inline");
        anchor.appendChild(dot);
      }
    }
  }

  function run() {
    fetch(new URL("data/section-updates.json", base).href, { cache: "no-store" })
      .then(function (res) { if (!res.ok) throw new Error("manifest"); return res.json(); })
      .then(function (manifest) {
        var sections = manifest.sections || {};
        var here = api.sectionForPage(sections, api.siteRel(location.href, base.href));
        var result = api.apply(manifest, loadState(), Date.now(), here, manifest.windowDays);
        saveState(result.stored);
        paint(sections, result.unread);
      })
      .catch(function () {});
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
  // Phone Back restores the Hub from memory, still wearing the old dot. Repaint from storage.
  window.addEventListener("pageshow", function (event) {
    if (event.persisted) run();
  });
})();
