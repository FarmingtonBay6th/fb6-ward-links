/* Bay 6 Hub · private usage counter (one file for every page).
   Sends only four things: the event type (view or click), a link id, the page path,
   and a timestamp. No names, phone numbers, cookies, local storage, IP lookups, or
   device details. Query strings and #fragments are always dropped, and tel:, sms:,
   and mailto: links are counted by type only, never by number or address.
   Counts go to a private Google Sheet that only the Bishop can see. */
(function () {
  var ENDPOINT = "https://script.google.com/macros/s/AKfycbxr5GFPfuj7TLPKwM--a15B7Rt7sOzPAWhEkPPCU9HW0IlAroqTX0MqcvXwGc0LWUFK/exec";
  var HOST = "farmingtonbay6th.github.io";
  if (location.hostname !== HOST || !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(ENDPOINT)) return;
  var s = document.currentScript;
  var base = new URL("./", s ? s.src : location.href);
  var BAD = /[^A-Za-z0-9._~\/-]/g;

  function hubPath(u) {
    var p = u.pathname;
    if (p.indexOf(base.pathname) === 0) p = "/" + p.slice(base.pathname.length);
    p = p.replace(/index\.html$/, "").replace(BAD, "").slice(0, 150);
    if (/^\/sp-/.test(p)) p = "/private-page/";
    return p || "/";
  }
  function external(u) {
    var segs = u.pathname.split("/").map(function (seg) {
      // Long opaque tokens (document ids, deployment ids) are replaced so nothing private is stored.
      return seg.length >= 16 && /\d/.test(seg) && /^[A-Za-z0-9_-]+$/.test(seg) ? "~" : seg;
    });
    return (u.hostname + segs.join("/")).replace(/[^A-Za-z0-9._~\/:-]/g, "").replace(/\/+$/, "").slice(0, 110);
  }
  function linkId(el, here) {
    var tag = el.getAttribute("data-usage-id");
    if (tag) return String(tag).replace(/[^A-Za-z0-9._~:\/-]/g, "").slice(0, 110);
    if (el.classList && el.classList.contains("fbback")) return "nav:back";
    var href = el.getAttribute("href");
    if (!href || /^\s*(javascript:|#)/i.test(href)) return "";
    var u;
    try { u = new URL(href, location.href); } catch (e) { return ""; }
    var proto = u.protocol.replace(":", "");
    if (proto === "tel" || proto === "sms" || proto === "mailto") return proto + ":" + here;
    if (proto !== "http" && proto !== "https") return "";
    if (u.origin === base.origin && u.pathname.indexOf(base.pathname) === 0) return hubPath(u);
    return external(u);
  }
  function send(t, id) {
    var body = JSON.stringify({ t: t, id: id || "", p: hubPath(location), ts: Date.now() });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, body)) return;
    } catch (e) {}
    try { fetch(ENDPOINT, { method: "POST", mode: "no-cors", keepalive: true, body: body }); } catch (e) {}
  }

  send("view", "");
  document.addEventListener("click", function (e) {
    var el = e.target && e.target.closest ? e.target.closest("a[href],[data-usage-id]") : null;
    if (!el) return;
    var id = linkId(el, hubPath(location));
    if (id) send("click", id);
  }, true);
})();
