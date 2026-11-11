/* Farmington Bay 6th Ward · Ward Links shared navigation (one file for every page).
   - Sticky "Back to Hub" bar on every sub-page (same place, size, wording, style).
   - In-site images and PDFs open in a full-screen viewer with the same Back button;
     the phone Back gesture / tapping outside closes it (history state).
   - External links open in a new tab so nobody gets stranded. */
(function () {
  var s = document.currentScript, base = new URL('./', s ? s.src : location.href); // site root
  var isHome = new URL('./', location.href).href === base.href;
  var NAVY = '#003a55', GOLD = '#c9a24a';
  var css = document.createElement('style');
  css.textContent =
    '.fbnav{position:sticky;top:0;z-index:900;display:flex;align-items:center;padding:calc(8px + env(safe-area-inset-top)) 12px 8px;background:' + NAVY + ';border-bottom:2px solid ' + GOLD + ';box-shadow:0 2px 10px rgba(0,0,0,.18)}' +
    '.fbback{display:inline-flex;align-items:center;gap:8px;min-height:48px;padding:0 18px 0 12px;border-radius:999px;background:' + GOLD + ';color:' + NAVY + ' !important;font:700 17px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-decoration:none !important;border:0;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
    '.fbback:active{transform:scale(.97)}.fbback svg{width:20px;height:20px}' +
    'a.back,.appbar>a[aria-label^="Back"]{display:none !important}' +
    '.fbview{position:fixed;inset:0;z-index:1000;display:flex;flex-direction:column;background:rgba(0,20,32,.94)}' +
    '.fbview .fbnav{position:static;justify-content:space-between;gap:10px}' +
    '.fbview .fbback{white-space:nowrap;font-size:16px;padding-right:14px}.fbfull{white-space:nowrap;color:#fff !important;font:600 14px system-ui,-apple-system,sans-serif;text-decoration:underline;padding:12px 6px}' +
    '.fbstage{flex:1;display:flex;align-items:center;justify-content:center;padding:14px;overflow:auto;padding-bottom:calc(14px + env(safe-area-inset-bottom))}' +
    '.fbstage img{max-width:100%;max-height:100%;object-fit:contain;border-radius:6px;box-shadow:0 8px 30px rgba(0,0,0,.5);background:#fff}' +
    '.fbstage iframe{width:100%;height:100%;border:0;background:#fff;border-radius:6px}' +
    'html.fbopen{overflow:hidden}' +
    '.fbback-foot{display:flex;justify-content:center;margin:0;padding:8px 16px 28px}';
  document.head.appendChild(css);

  var ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function sameSite(u) { return u.origin === base.origin && u.pathname.indexOf(base.pathname) === 0; }
  function cameFromSite() { try { return document.referrer && sameSite(new URL(document.referrer)) && history.length > 1; } catch (e) { return false; } }

  function samePage(a, b) {
    try {
      var ua = new URL(a), ub = new URL(b);
      var pa = ua.pathname.replace(/index\.html$/, ""), pb = ub.pathname.replace(/index\.html$/, "");
      return ua.origin === ub.origin && pa === pb;
    } catch (e) { return false; }
  }
  function backDest() {
    var href = base.href, aria = "Back to Hub";
    var link = document.querySelector("a.back[href]");
    if (link) {
      try {
        var u = new URL(link.getAttribute("href"), location.href);
        if (sameSite(u)) {
          href = u.href;
          var name = (link.textContent || "").replace(/^\s*‹\s*/, "").replace(/\s+/g, " ").trim();
          if (name && name.toLowerCase() !== "the bay 6 hub") aria = "Back to " + name;
        }
      } catch (e) {}
    }
    return { href: href, aria: aria };
  }
  function makeBack(dest) {
    var a = document.createElement("a");
    a.className = "fbback";
    a.href = dest.href;
    a.setAttribute("aria-label", dest.aria);
    a.innerHTML = ARROW + "Back";
    a.addEventListener("click", function (e) {
      if (cameFromSite() && samePage(document.referrer, dest.href)) { e.preventDefault(); history.back(); }
    });
    return a;
  }
  function addBar() {
    if (isHome || document.querySelector(".fbnav")) return;
    var dest = backDest();
    var bar = document.createElement("nav");
    bar.className = "fbnav";
    bar.setAttribute("aria-label", "Site");
    bar.appendChild(makeBack(dest));
    document.body.insertBefore(bar, document.body.firstChild);
    if (!document.querySelector(".fbback-foot")) {
      var wrap = document.createElement("p");
      wrap.className = "fbback-foot";
      wrap.appendChild(makeBack(dest));
      var footer = document.querySelector("footer");
      if (footer && footer.parentNode) footer.parentNode.insertBefore(wrap, footer);
      else document.body.appendChild(wrap);
    }
  }
  function armExternal() {
    var links = document.querySelectorAll("a[href]");
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.hasAttribute("download")) continue;
      var u;
      try { u = new URL(a.getAttribute("href"), location.href); } catch (e) { continue; }
      if (!/^https?:$/.test(u.protocol) || sameSite(u)) continue;
      if (!a.target || a.target === "_self") a.target = "_blank";
      var rel = a.getAttribute("rel") || "";
      if (rel.indexOf("noopener") === -1) a.setAttribute("rel", (rel + " noopener").trim());
    }
  }

  var viewer = null;
  function closeViewer() { if (!viewer) return; viewer.remove(); viewer = null; document.documentElement.classList.remove('fbopen'); }
  function openViewer(href, label, fullHref) {
    closeViewer();
    var pdf = /\.pdf(\?|#|$)/i.test(href);
    viewer = document.createElement('div'); viewer.className = 'fbview'; viewer.setAttribute('role', 'dialog'); viewer.setAttribute('aria-modal', 'true');
    viewer.innerHTML = '<div class="fbnav"><button type="button" class="fbback">' + ARROW + 'Back to ' + esc(pageName()) + '</button>' +
      '<a class="fbfull" target="_blank" rel="noopener">Full Size ↗</a></div><div class="fbstage">' + (pdf ? '<iframe title="Document"></iframe>' : '<img alt="">') + '</div>';
    var full = viewer.querySelector('.fbfull');
    full.href = fullHref || href;
    // A same-window app page keeps the Back control inside an installed app, where the browser toolbar is hidden.
    if (fullHref) full.removeAttribute('target');
    var m = viewer.querySelector(pdf ? 'iframe' : 'img'); m.src = href; if (!pdf) m.alt = label || 'Flyer';
    viewer.querySelector('.fbback').addEventListener('click', function () { history.back(); });
    viewer.querySelector('.fbstage').addEventListener('click', function (e) { if (e.target === this) history.back(); });
    document.body.appendChild(viewer); document.documentElement.classList.add('fbopen');
    history.pushState({ fbviewer: 1 }, ''); viewer.querySelector('.fbback').focus();
  }
  function pageName() { if (isHome) return 'Hub'; var t = (document.title.split(/\s[·|–—-]\s/)[0] || '').trim(); return t && t.length <= 22 ? t : 'Page'; }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  addEventListener('popstate', closeViewer);
  addEventListener('keydown', function (e) { if (e.key === 'Escape' && viewer) history.back(); });

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.closest('.fbview')) return;
    var u; try { u = new URL(a.getAttribute('href'), location.href); } catch (x) { return; }
    if (!/^https?:$/.test(u.protocol)) return;                 // tel:, mailto:, sms: stay as they are
    if (sameSite(u) && /\.(jpe?g|png|gif|webp|pdf)$/i.test(u.pathname)) {
      e.preventDefault(); var img = a.querySelector('img');
      var fullHref = '';
      var fullAttr = a.getAttribute('data-full');
      if (fullAttr) { try { var fu = new URL(fullAttr, u.href); if (sameSite(fu)) fullHref = fu.href; } catch (err) {} }
      openViewer(u.href, (img && img.alt) || a.textContent.trim(), fullHref); return;
    }
    if (!sameSite(u)) { a.target = '_blank'; a.rel = 'noopener'; }
  }, true);

  function boot() { addBar(); armExternal(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  // Unread dots: section-seen.js is the pure compare, updates.js paints and marks seen.
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var el = document.createElement('script');
      el.src = src;
      el.onload = function () { resolve(); };
      el.onerror = function () { reject(new Error(src)); };
      document.head.appendChild(el);
    });
  }
  if (!window.Fb6Seen) {
    loadScript(new URL('section-seen.js', base).href).then(function () {
      if (!window.__fb6UpdatesRan) return loadScript(new URL('updates.js', base).href);
    }).catch(function () {});
  }
})();
