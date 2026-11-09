/* Per-section unread state for The Bay 6 Hub.
   The manifest (data/section-updates.json) is the content version.
   localStorage remembers the hash each visitor last opened.
   First visit marks older sections seen so the home page is not a wall of dots.
   A section updated within windowDays (default 7) still shows as new. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.Fb6Seen = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var DAY = 24 * 60 * 60 * 1000;
  var WINDOW_DAYS = 7;

  function windowMs(days) {
    var n = Number(days);
    if (!isFinite(n) || n <= 0) n = WINDOW_DAYS;
    if (n > 30) n = 30;
    return n * DAY;
  }

  function cloneSeen(seen) {
    var out = {};
    if (!seen || typeof seen !== "object" || Array.isArray(seen)) return out;
    Object.keys(seen).forEach(function (key) { out[key] = seen[key]; });
    return out;
  }

  function normalizeStored(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { init: false, seen: {} };
    return { init: raw.init === true, seen: cloneSeen(raw.seen) };
  }

  function isRecent(updated, now, span) {
    var t = Date.parse(updated);
    if (isNaN(t)) return false;
    if (t > now + DAY) return false;
    return t >= now - span;
  }

  function sectionsOf(manifest) {
    var sections = manifest && manifest.sections;
    if (!sections || typeof sections !== "object" || Array.isArray(sections)) return {};
    return sections;
  }

  /* stored.seen[id] is the hash last opened, or null when the section is known
     unread (so a later visit does not quietly mark it seen after the 7 days). */
  function apply(manifest, stored, now, currentId, windowDays) {
    var sections = sectionsOf(manifest);
    var state = normalizeStored(stored);
    var seen = state.seen;
    var span = windowMs(windowDays != null ? windowDays : manifest && manifest.windowDays);
    var ids = Object.keys(sections);

    function baseline(id) {
      var sec = sections[id];
      if (!sec || typeof sec.hash !== "string" || !sec.hash) return;
      if (isRecent(sec.updated, now, span)) seen[id] = null;
      else seen[id] = sec.hash;
    }

    if (!state.init) {
      ids.forEach(baseline);
    } else {
      ids.forEach(function (id) {
        if (!Object.prototype.hasOwnProperty.call(seen, id)) baseline(id);
      });
    }

    if (currentId && sections[currentId] && typeof sections[currentId].hash === "string") {
      seen[currentId] = sections[currentId].hash;
    }

    var unread = {};
    ids.forEach(function (id) {
      var sec = sections[id];
      if (!sec || typeof sec.hash !== "string" || !sec.hash) return;
      if (seen[id] !== sec.hash) unread[id] = true;
    });

    return { stored: { init: true, seen: seen }, unread: unread };
  }

  function siteRel(url, base) {
    var b = new URL(base, "http://local.invalid/");
    var u = new URL(url, b);
    if (u.origin !== b.origin) return "";
    var bp = b.pathname;
    if (bp.charAt(bp.length - 1) !== "/") bp += "/";
    if (u.pathname.indexOf(bp) !== 0) return "";
    var rel = u.pathname.slice(bp.length);
    if (rel.charAt(0) === "/") rel = rel.slice(1);
    try { rel = decodeURIComponent(rel); } catch (e) {}
    return rel;
  }

  function sectionForPage(sections, rel) {
    if (!rel) return null;
    var path = String(rel).replace(/^\/+/, "");
    var best = null;
    var bestLen = -1;
    Object.keys(sections || {}).forEach(function (id) {
      var p = sections[id] && sections[id].path;
      if (!p) return;
      var dir = p.charAt(p.length - 1) === "/" ? p : p + "/";
      if (path === dir || path === dir.slice(0, -1) || path.indexOf(dir) === 0) {
        if (dir.length > bestLen) { best = id; bestLen = dir.length; }
      }
    });
    return best;
  }

  /* Directory and page links count. Flyer images, PDFs, and other files do not,
     so a new events page does not put a dot on every thumbnail. */
  function sectionForLink(sections, rel) {
    if (!rel) return null;
    var path = String(rel).replace(/^\/+/, "").replace(/[?#].*$/, "");
    var last = path.split("/").pop();
    if (last && last.indexOf(".") !== -1 && !/\.html?$/i.test(last)) return null;
    if (/\.html?$/i.test(last || "")) return sectionForPage(sections, path.replace(/index\.html$/i, ""));
    return sectionForPage(sections, path);
  }

  return {
    WINDOW_DAYS: WINDOW_DAYS,
    apply: apply,
    siteRel: siteRel,
    sectionForPage: sectionForPage,
    sectionForLink: sectionForLink
  };
});
