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
    'html.fbopen{overflow:hidden}';
  document.head.appendChild(css);

  var ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function sameSite(u) { return u.origin === base.origin && u.pathname.indexOf(base.pathname) === 0; }
  function cameFromSite() { try { return document.referrer && sameSite(new URL(document.referrer)) && history.length > 1; } catch (e) { return false; } }

  function addBar() {
    if (isHome || document.querySelector('.fbnav')) return;
    var bar = document.createElement('nav'); bar.className = 'fbnav'; bar.setAttribute('aria-label', 'Site');
    var a = document.createElement('a'); a.className = 'fbback'; a.href = base.href; a.innerHTML = ARROW + 'Back to Hub';
    a.addEventListener('click', function (e) { if (cameFromSite() && new URL(document.referrer).href === base.href) { e.preventDefault(); history.back(); } });
    bar.appendChild(a); document.body.insertBefore(bar, document.body.firstChild);
  }

  var viewer = null;
  function closeViewer() { if (!viewer) return; viewer.remove(); viewer = null; document.documentElement.classList.remove('fbopen'); }
  function openViewer(href, label) {
    closeViewer();
    var pdf = /\.pdf(\?|#|$)/i.test(href);
    viewer = document.createElement('div'); viewer.className = 'fbview'; viewer.setAttribute('role', 'dialog'); viewer.setAttribute('aria-modal', 'true');
    viewer.innerHTML = '<div class="fbnav"><button type="button" class="fbback">' + ARROW + 'Back to ' + esc(pageName()) + '</button>' +
      '<a class="fbfull" target="_blank" rel="noopener">Full Size ↗</a></div><div class="fbstage">' + (pdf ? '<iframe title="Document"></iframe>' : '<img alt="">') + '</div>';
    viewer.querySelector('.fbfull').href = href;
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
      openViewer(u.href, (img && img.alt) || a.textContent.trim()); return;
    }
    if (!sameSite(u)) { a.target = '_blank'; a.rel = 'noopener'; }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addBar); else addBar();
})();
