/* Shared anonymous totals for one month. This browser remembers only its own
   numbers so a second tap replaces them instead of counting the household twice.
   Storage: the Bay 6 Hub's private Google Sheet (scriptUrl) once it reports live.
   Until then, the older crudcrud address (base) keeps working. Once this browser
   has seen the Sheet live it never writes to crudcrud again. */
(function (global) {
  var GROUPS = ["adults", "youth", "kids"];
  var KEY = "fb6-fh-tally";
  var STORE_KEY = "fb6-fh-store";
  var chosen = null;

  function base() {
    var cfg = global.FH_COUNTS_CONFIG || {};
    var url = String(cfg.base || "");
    return /^https:\/\/crudcrud\.com\/api\/[a-f0-9]{32}\/counts$/.test(url) ? url : "";
  }
  function scriptUrl() {
    var cfg = global.FH_COUNTS_CONFIG || {};
    var url = String(cfg.scriptUrl || "");
    return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url) ? url : "";
  }
  function sawSheet() {
    try { return localStorage.getItem(STORE_KEY) === "sheet"; } catch (e) { return false; }
  }
  function markSheet() {
    try { localStorage.setItem(STORE_KEY, "sheet"); } catch (e) {}
  }
  function sheetTotals() {
    return fetch(scriptUrl() + "?fh=totals", { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("load");
      return res.json();
    }).then(function (data) {
      if (!data || data.ok !== true || !data.totals || typeof data.totals !== "object") throw new Error("load");
      return data;
    });
  }
  /* Resolves "sheet" or "crud". */
  function store() {
    if (chosen) return Promise.resolve(chosen);
    if (!scriptUrl()) {
      if (!base()) return Promise.reject(new Error("missing"));
      return Promise.resolve(chosen = "crud");
    }
    if (sawSheet() || !base()) return Promise.resolve(chosen = "sheet");
    return sheetTotals().then(function (data) {
      if (data.live === true) { markSheet(); return (chosen = "sheet"); }
      return (chosen = "crud");
    }, function () { return (chosen = "crud"); });
  }
  function sheetPost(body) {
    return fetch(scriptUrl(), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) throw new Error("save");
      return res.json();
    });
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
  function householdPlan(counts) {
    var out = {};
    if (!counts || typeof counts !== "object") throw new Error("validation");
    GROUPS.forEach(function (group) {
      var raw = counts[group];
      if (raw === "" || raw === null || typeof raw === "undefined") raw = 0;
      var n = Number(raw);
      if (!isFinite(n) || Math.floor(n) !== n || n < 0 || n > 20) throw new Error("validation");
      out[group] = n;
    });
    return out;
  }
  function list() {
    return store().then(function (kind) {
      if (kind === "sheet") {
        return sheetTotals().then(function (data) {
          if (data.live === true) markSheet();
          var rows = [];
          Object.keys(data.totals).forEach(function (month) {
            var t = data.totals[month] || {};
            GROUPS.forEach(function (group) { rows.push({ month: month, group: group, n: t[group] }); });
          });
          return rows;
        });
      }
      return fetch(base(), { cache: "no-store" }).then(function (res) {
        if (!res.ok) throw new Error("load");
        return res.json();
      });
    });
  }
  function save(month, group, n) {
    n = Math.floor(Number(n));
    if (!/^\d{4}-\d{2}$/.test(month) || GROUPS.indexOf(group) < 0 || n < 1 || n > 20) {
      return Promise.reject(new Error("validation"));
    }
    return store().then(function (kind) {
      return kind === "sheet" ? saveSheet(month, group, n) : saveCrud(month, group, n);
    });
  }
  function saveSheet(month, group, n) {
    var existing = local(month)[group];
    function add() {
      return sheetPost({ fh: "add", month: month, group: group, n: n }).then(function (r) {
        if (!r || r.ok !== true || typeof r.id !== "string") throw new Error("save");
        remember(month, group, r.id, n);
        return { id: r.id, n: n };
      });
    }
    if (!existing) return add();
    return sheetPost({ fh: "set", id: existing.id, n: n }).then(function (r) {
      if (r && r.ok === true) {
        remember(month, group, existing.id, n);
        return { id: existing.id, n: n };
      }
      if (r && (r.error === "missing" || r.error === "validation")) return add();
      throw new Error("save");
    });
  }
  function saveCrud(month, group, n) {
    var url = base();
    if (!url) return Promise.reject(new Error("validation"));
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
    var existing = local(month)[group];
    if (!existing) return Promise.resolve();
    return store().then(function (kind) {
      if (kind === "sheet") {
        return sheetPost({ fh: "del", id: existing.id }).then(function (r) {
          if (!r || r.ok !== true) throw new Error("undo");
          remember(month, group, "", 0);
        });
      }
      return fetch(base() + "/" + existing.id, { method: "DELETE" }).then(function (res) {
        if (!res.ok && res.status !== 404) throw new Error("undo");
        remember(month, group, "", 0);
      });
    });
  }
  function saveHousehold(month, counts) {
    var plan;
    try { plan = householdPlan(counts); }
    catch (err) { return Promise.reject(err); }
    if (!/^\d{4}-\d{2}$/.test(month)) return Promise.reject(new Error("validation"));
    if (!GROUPS.some(function (group) { return plan[group] > 0; })) return Promise.reject(new Error("empty"));
    var chain = Promise.resolve();
    GROUPS.forEach(function (group) {
      chain = chain.then(function () {
        if (plan[group] > 0) return save(month, group, plan[group]);
        if (local(month)[group]) return remove(month, group);
      });
    });
    return chain.then(function () { return plan; });
  }
  function removeHousehold(month) {
    var chain = Promise.resolve();
    GROUPS.forEach(function (group) {
      chain = chain.then(function () { return remove(month, group); });
    });
    return chain;
  }

  global.FhCounts = {
    store: store,
    local: local,
    totals: totals,
    householdPlan: householdPlan,
    list: list,
    save: save,
    remove: remove,
    saveHousehold: saveHousehold,
    removeHousehold: removeHousehold
  };
})(typeof window !== "undefined" ? window : globalThis);
