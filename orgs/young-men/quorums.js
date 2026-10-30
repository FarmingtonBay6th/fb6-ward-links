/* Young Men quorum tabs (mirrors orgs/young-women/classes.js). Data: ../../data/ym-quorums.json. Wraps the page's existing sections in an
   "All Young Men" tab, adds one tab per quorum, remembers the last tab, supports #quorum-id deep links. */
(function () {
  var KEY = 'fb6-ym-tab', main = document.querySelector('main'); if (!main) return;
  var css = document.createElement('style');
  css.textContent = '.ywtabs{position:sticky;top:calc(66px + env(safe-area-inset-top));z-index:50;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;max-width:560px;margin:14px auto 0;padding:10px 14px;background:var(--bg)}' +
    '.ywtabs button{min-height:62px;padding:6px 6px;border-radius:14px;border:2px solid #c9a24a;background:#fff;color:#005175;font:700 15px/1.15 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
    '.ywtabs button[aria-selected="true"]{background:#005175;color:#fff;box-shadow:inset 0 -4px 0 #c9a24a}' +
    '.ywtabs button.all{grid-column:1/-1;min-height:48px}' +
    '.ywpanel[hidden]{display:none}.cs{color:#8a6d22;font-style:italic}.ywinfo dt{font-weight:700;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--soft);margin-top:10px}.ywinfo dd{margin:2px 0 0;font-size:15px}' +
    '.ywleaders h3{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--soft);margin:12px 0 2px}.ywgh dd{line-height:1.45}' +
    '.ywhero{text-align:center;padding:18px 16px}.ywhero h2{justify-content:center;font-size:24px}' +
    '@media (prefers-color-scheme: dark){.ywtabs button{background:#27211d;color:#e2c47a}.ywtabs button[aria-selected="true"]{background:#005175;color:#fff}}';
  document.head.appendChild(css);
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
  function nice(d) { var p = d.split('-'); return new Date(Date.UTC(+p[0], p[1] - 1, +p[2], 12)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }); }
  var SOON = '<span class="cs">Coming soon</span>';

  var all = document.createElement('div'); all.className = 'ywpanel'; all.id = 'panel-all';
  while (main.firstChild) all.appendChild(main.firstChild);
  main.appendChild(all);
  var bar = document.createElement('div'); bar.className = 'ywtabs'; bar.setAttribute('role', 'tablist'); bar.setAttribute('aria-label', 'Young Men quorums');
  main.parentNode.insertBefore(bar, main);
  var tabs = [{ id: 'all', name: 'All Young Men' }];

  function act(a) {
    var f = a.flyer ? '../../' + a.flyer.replace(/^\/+/, '') : '';
    var acts = []; if (f) acts.push('<a class="btn" href="' + esc(f) + '">View flyer</a>');
    if (a.link && /^https:\/\//.test(a.link)) acts.push('<a class="btn alt" href="' + esc(a.link) + '">' + esc(a.linkLabel || 'More info') + '</a>');
    return '<article class="ev">' + (f ? '<a class="thumb" href="' + esc(f) + '"><img src="' + esc(f) + '" alt="Flyer: ' + esc(a.title) + '" loading="lazy"></a>' : '') +
      '<div class="evtx"><b>' + esc(a.title) + '</b>' + (a.details ? '<small>' + esc(a.details) + '</small>' : '') +
      '<p class="when">' + esc(nice(a.date)) + (a.endDate ? ' – ' + esc(nice(a.endDate)) : '') + (a.time ? ' · ' + esc(a.time) : '') + '</p>' +
      (a.place ? '<p class="where">' + esc(a.place) + '</p>' : '') + (acts.length ? '<div class="acts">' + acts.join(' ') + '</div>' : '') + '</div></article>';
  }
  function panel(c, acts) {
    var p = document.createElement('div'); p.className = 'ywpanel'; p.id = 'panel-' + c.id; p.hidden = true;
    var pres = (c.presidency || []).length ? '<ul>' + c.presidency.map(function (m) { return '<li><b>' + (m.name ? esc(m.name) : SOON) + '</b> <span>' + esc(m.role) + '</span></li>'; }).join('') + '</ul>' : SOON;
    var adv = (c.advisers || []).length ? c.advisers.map(function (n) { return n ? esc(n) : SOON; }).join(', ') : SOON;
    p.innerHTML = '<section class="ywhero"><h2>' + esc(c.name) + '</h2><p class="note">' + (c.info ? esc(c.info) : 'Quorum news, activities and info for ' + esc(c.name) + '.') + '</p></section>' +
      '<section><h2>Quorum Activities</h2>' + (acts.length ? acts.map(act).join('') : '<p class="empty">No quorum activities posted yet. ' + SOON + '. See the <a href="#all" data-tab="all">All Young Men</a> tab for ward-wide activities.</p>') + '</section>' +
      '<section class="ywinfo"><h2>Quorum Info</h2><dl><dt>Ages</dt><dd>' + (c.ages ? esc(c.ages) : SOON) + '</dd><dt>When We Meet</dt><dd>' + (c.meets ? esc(c.meets) : SOON) + '</dd>' +
      '<dt>' + esc(c.presidencyLabel || 'Quorum Presidency') + '</dt><dd>' + pres + '</dd>' + (c.duties ? '<dt>Duties</dt><dd>' + esc(c.duties) + '</dd>' : '') + '<dt>' + ((c.advisers || []).length > 1 ? 'Advisers' : 'Adviser') + '</dt><dd>' + adv + '</dd></dl></section>';
    main.appendChild(p);
  }
  function allExtras(a) {
    // Presidency: only add names the page's contact card doesn't already list (no duplicates).
    var onPage = [].map.call(all.querySelectorAll('.pc .who b'), function (b) { return b.textContent.trim(); });
    var extraPres = (a.presidency || []).filter(function (m) { return onPage.indexOf(m.name) < 0; });
    var li = function (n, r) { return '<li><b>' + esc(n) + '</b>' + (r ? ' <span>' + esc(r) + '</span>' : '') + '</li>'; };
    var s = document.createElement('section'); s.className = 'ywinfo ywleaders';
    var hasAdv = (a.advisers || []).length; // quorum advisers are listed on their quorum tabs
    s.innerHTML = '<h2>' + (hasAdv ? 'Advisers &amp; Specialists' : 'Specialists') + '</h2>' + (extraPres.length ? '<h3>Presidency</h3><ul>' + extraPres.map(function (m) { return li(m.name, m.role); }).join('') + '</ul>' : '') +
      (hasAdv ? '<h3>Advisers</h3><ul>' + a.advisers.map(function (n) { return li(n, 'Adviser'); }).join('') + '</ul>' : '') +
      (hasAdv ? '<h3>Specialists</h3>' : '') + ((a.specialists || []).length ? '<ul>' + a.specialists.map(function (m) { return li(m.name, m.role || 'Specialist'); }).join('') + '</ul>' : SOON);
    var pc = all.querySelector('.pc'); if (pc && pc.nextSibling) all.insertBefore(s, pc.nextSibling); else all.appendChild(s);
    var h = a.handbook; if (!h) return;
    var g = document.createElement('section'); g.className = 'ywinfo ywgh';
    g.innerHTML = '<h2>From the General Handbook</h2><dl>' + (h.points || []).map(function (p) { return '<dt>' + esc(p.h) + '</dt><dd>' + esc(p.t) + '</dd>'; }).join('') + '</dl>' +
      (/^https:\/\//.test(h.url) ? '<p><a class="btn alt" href="' + esc(h.url) + '" target="_blank" rel="noopener">' + esc(h.label || 'General Handbook') + ' ↗</a></p>' : '');
    all.appendChild(g);
  }
  function show(id, save) {
    if (!document.getElementById('panel-' + id)) id = 'all';
    [].forEach.call(main.querySelectorAll('.ywpanel'), function (p) { p.hidden = p.id !== 'panel-' + id; });
    [].forEach.call(bar.querySelectorAll('button'), function (b) { b.setAttribute('aria-selected', b.dataset.tab === id ? 'true' : 'false'); });
    if (save) { try { localStorage.setItem(KEY, id); } catch (e) {} history.replaceState(history.state, '', id === 'all' ? location.pathname + location.search : '#' + id); }
  }
  function drawTabs() {
    bar.innerHTML = tabs.map(function (t) { return '<button type="button" role="tab" data-tab="' + t.id + '" class="' + (t.id === 'all' ? 'all' : '') + '">' + esc(t.name) + '</button>'; }).join('');
  }
  bar.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { show(b.dataset.tab, true); scrollTo({ top: bar.offsetTop - 70, behavior: 'smooth' }); } });
  main.addEventListener('click', function (e) { var a = e.target.closest('a[data-tab]'); if (a) { e.preventDefault(); show(a.dataset.tab, true); } });
  addEventListener('hashchange', function () { var h = location.hash.slice(1); if (h) show(h, true); });
  drawTabs(); show('all');
  fetch('../../data/ym-quorums.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (j) {
    var t = today();
    if (j.all) allExtras(j.all);
    (j.classes || []).forEach(function (c) {
      tabs.push({ id: c.id, name: c.name });
      panel(c, (j.activities || []).filter(function (a) { return a && a.title && (a.class === c.id || a.class === 'all') && (a.endDate || a.date) >= t; })
        .sort(function (x, y) { return x.date < y.date ? -1 : 1; }));
    });
    drawTabs();
    var want = location.hash.slice(1); var saved = null; try { saved = localStorage.getItem(KEY); } catch (e) {}
    show(want || saved || 'all', !!want);
  }).catch(function () {});
})();
