/* Shared anonymous totals for one month. This browser remembers only its own
   numbers so a second tap replaces them instead of counting the household twice. */
(function (global) {
  var GROUPS = ["adults", "youth", "kids"];
  var KEY = "fb6-fh-tally";

  function base() {
    var cfg = global.FH_COUNTS_CONFIG || {};
    var url = String(cfg.base || "");
    return /^https:\/\/crudcrud\.com\/api\/[a-f0-9]{32}\/counts$/.test(url) ? url : "";
  }
  function read() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || "{}");
      return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    } catch (e) { return {}; }
  }
  function write(map) {
    try { localStorage.setItem(KEY, JSON.stringify(map)); } catch (e) {}
  }
  function local(month) {
    var row = read()[month];
    var out = {};
    if (!row || typeof row !== "object") return out;
    GROUPS.forEach(function (group) {
      var item = row[group];
      var n = item && Math.floor(Number(item.n));
      if (item && typeof item.id === "string" && n > 0) out[group] = { id: item.id, n: n };
    });
    return out;
  }
  function remember(month, group, id, n) {
    var map = read();
    var row = map[month] && typeof map[month] === "object" ? map[month] : {};
    if (!n) delete row[group];
    else row[group] = { id: id, n: n };
    if (!Object.keys(row).length) delete map[month];
    else map[month] = row;
    write(map);
  }
  function cleanRows(rows) {
    var totals = { adults: 0, youth: 0, kids: 0 };
    (Array.isArray(rows) ? rows : []).forEach(function (row) {
      if (!row || GROUPS.indexOf(row.group) < 0) return;
      var n = Math.floor(Number(row.n));
      if (n > 0) totals[row.group] += n;
    });
    return totals;
  }
  function totals(rows, month) {
    return cleanRows((Array.isArray(rows) ? rows : []).filter(function (row) {
      return row && row.month === month;
    }));
  }
  function list() {
    var url = base();
    if (!url) return Promise.reject(new Error("missing"));
    return fetch(url, { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("load");
      return res.json();
    });
  }
  function save(month, group, n) {
    var url = base();
    n = Math.floor(Number(n));
    if (!url || !/^\d{4}-\d{2}$/.test(month) || GROUPS.indexOf(group) < 0 || n < 1 || n > 20) {
      return Promise.reject(new Error("validation"));
    }
    var existing = local(month)[group];
    var body = JSON.stringify({ month: month, group: group, n: n });
    var req = existing
      ? fetch(url + "/" + existing.id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: body })
      : fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body });
    return req.then(function (res) {
      if (!res.ok) throw new Error("save");
      if (existing) {
        remember(month, group, existing.id, n);
        return { id: existing.id, n: n };
      }
      return res.json().then(function (saved) {
        if (!saved || typeof saved._id !== "string") throw new Error("save");
        remember(month, group, saved._id, n);
        return { id: saved._id, n: n };
      });
    });
  }
  function remove(month, group) {
    var url = base();
    var existing = local(month)[group];
    if (!existing) return Promise.resolve();
    return fetch(url + "/" + existing.id, { method: "DELETE" }).then(function (res) {
      if (!res.ok && res.status !== 404) throw new Error("undo");
      remember(month, group, "", 0);
    });
  }

  global.FhCounts = { local: local, totals: totals, list: list, save: save, remove: remove };
})(window);
