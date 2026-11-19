// Family History counts on the Hub's private Google Sheet (Apps Script) backend.
// Runs the real Apps Script files against a small in-memory Google stand-in, and the
// real page client against that server.
// Run: node --test tools/fh-counts-sheet.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const KEY = "owner-test-key";

function fakeGoogle() {
  const props = {};
  const cache = {};
  const sheets = {};
  let created = 0;
  function makeSheet(title) {
    const rows = [];
    const sheet = {
      title, rows,
      setName(n) { this.name = n; return this; },
      getName() { return this.name; },
      getLastRow: () => rows.length,
      appendRow(r) { rows.push(r.map(String)); },
      deleteRow(i) { rows.splice(i - 1, 1); },
      setFrozenRows() {},
      getRange(a, b, c, d) {
        if (typeof a === "string") return { setNumberFormat() { return this; } };
        const r0 = a, c0 = b, nr = c || 1, nc = d || 1;
        return {
          setValues(v) { v.forEach((row, i) => { rows[r0 - 1 + i] = rows[r0 - 1 + i] || []; row.forEach((x, j) => { rows[r0 - 1 + i][c0 - 1 + j] = String(x); }); }); return this; },
          setValue(x) { rows[r0 - 1][c0 - 1] = String(x); return this; },
          getDisplayValues() { const out = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) row.push((rows[r0 - 1 + i] || [])[c0 - 1 + j] || ""); out.push(row); } return out; },
          setFontWeight() { return this; },
          setNumberFormat() { return this; }
        };
      }
    };
    return sheet;
  }
  const g = {
    props, sheets, createdCount: () => created,
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (k in props ? props[k] : null),
      setProperty: (k, v) => { props[k] = String(v); },
      deleteProperty: (k) => { delete props[k]; },
      getKeys: () => Object.keys(props)
    }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    SpreadsheetApp: {
      create(title) {
        created++;
        const id = "ss" + created;
        const sh = makeSheet(title);
        sheets[id] = { getId: () => id, title, tab: sh, getSheets: () => [sh], getSheetByName: (n) => (sh.name === n ? sh : null) };
        return sheets[id];
      },
      openById(id) { if (!sheets[id]) throw new Error("no sheet"); return sheets[id]; }
    },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      computeDigest: (_a, s) => Array.from(crypto.createHash("sha256").update(s).digest()).map((b) => (b > 127 ? b - 256 : b)),
      DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 },
      formatDate: (d) => d.toISOString()
    },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: (s) => ({ text: s, setMimeType() { return this; } }) },
    Logger: { log() {} }
  };
  g.SUMMARY_KEY_SHA256 = crypto.createHash("sha256").update(KEY).digest("hex");
  vm.createContext(g);
  for (const f of ["tools/apps-script/hub-usage/Code.js", "tools/apps-script/hub-usage/FhCounts.js"]) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), g, { filename: f });
  }
  g.post = (body) => JSON.parse(g.doPost({ postData: { contents: JSON.stringify(body) } }).text);
  g.get = (params) => JSON.parse(g.doGet({ parameter: params }).text);
  return g;
}

function client(server, cfg, store = {}) {
  const calls = [];
  const ctx = {
    localStorage: {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; }
    },
    fetch: (url, opts) => {
      const method = (opts && opts.method) || "GET";
      calls.push({ url, method, body: opts && opts.body });
      if (url.startsWith("https://script.google.com/")) {
        const out = method === "GET" ? server.get({ fh: new URL(url).searchParams.get("fh") }) : server.post(JSON.parse(opts.body));
        return Promise.resolve({ ok: true, status: 200, json: async () => out });
      }
      if (method === "POST") return Promise.resolve({ ok: true, json: async () => ({ _id: ("crud" + calls.length).padEnd(24, "0") }) });
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    }
  };
  ctx.window = ctx;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "orgs/temple-and-family-history/quest/fh-counts.js"), "utf8"), ctx);
  ctx.FH_COUNTS_CONFIG = cfg;
  return { ctx, calls, store };
}
const CFG = {
  scriptUrl: "https://script.google.com/macros/s/AKfycbTEST_abc-123/exec",
  base: "https://crudcrud.com/api/0123456789abcdef0123456789abcdef/counts"
};

test("server stores only id, month, group, and count, and totals by month", () => {
  const g = fakeGoogle();
  const a = g.post({ fh: "add", month: "2027-03", group: "adults", n: 3, name: "Someone", phone: "555" });
  assert.equal(a.ok, true);
  g.post({ fh: "add", month: "2027-03", group: "kids", n: 2 });
  g.post({ fh: "add", month: "2027-04", group: "youth", n: 1 });
  const sh = Object.values(g.sheets)[0];
  assert.equal(sh.title, "Bay 6 Family History Counts (Private)");
  assert.deepEqual(sh.tab.rows[0], ["Id", "Month", "Group", "Count"]);
  sh.tab.rows.slice(1).forEach((r) => assert.equal(r.length, 4));
  assert.equal(JSON.stringify(sh.tab.rows).includes("Someone"), false);
  assert.equal(JSON.stringify(sh.tab.rows).includes("555"), false);
  const t = g.get({ fh: "totals" });
  assert.deepEqual(JSON.parse(JSON.stringify(t.totals)), { "2027-03": { adults: 3, youth: 0, kids: 2 }, "2027-04": { adults: 0, youth: 1, kids: 0 } });
  assert.equal(t.live, false);
  assert.equal(g.post({ fh: "set", id: a.id, n: 5 }).ok, true);
  assert.equal(g.get({ fh: "totals" }).totals["2027-03"].adults, 5);
  assert.equal(g.post({ fh: "del", id: a.id }).ok, true);
  assert.equal(g.get({ fh: "totals" }).totals["2027-03"].adults, 0);
  assert.equal(g.createdCount(), 1);
});

test("server rejects junk and caps each entry at 20", () => {
  const g = fakeGoogle();
  const bad = [
    { fh: "add", month: "2027-3", group: "adults", n: 1 },
    { fh: "add", month: "1999-03", group: "adults", n: 1 },
    { fh: "add", month: "2027-03", group: "name", n: 1 },
    { fh: "add", month: "2027-03", group: "adults", n: 21 },
    { fh: "add", month: "2027-03", group: "adults", n: 0 },
    { fh: "add", month: "2027-03", group: "adults", n: 1.5 },
    { fh: "add", month: "2027-03", group: "adults", n: "<b>" },
    { fh: "set", id: "x", n: 2 },
    { fh: "del", id: "../../etc" },
    { fh: "drop" }
  ];
  bad.forEach((b) => assert.equal(g.post(b).ok, false, JSON.stringify(b)));
  assert.equal(g.post({ fh: "set", id: "abcdefgh12345678", n: 2 }).error, "missing");
  assert.deepEqual(JSON.parse(JSON.stringify(g.get({ fh: "totals" }).totals)), {});
});

test("server throttles writes per minute", () => {
  const g = fakeGoogle();
  let ok = 0;
  for (let i = 0; i < 130; i++) if (g.post({ fh: "add", month: "2027-03", group: "kids", n: 1 }).ok) ok++;
  assert.equal(ok, 120);
});

test("only the owner key can import or go live; import keeps ids and skips repeats", () => {
  const g = fakeGoogle();
  const rows = [{ id: "0123456789abcdef01234567", month: "2026-12", group: "adults", n: 4, _id: "x" }, { month: "2026-12", group: "kids", n: 2 }, { month: "bad", group: "kids", n: 2 }];
  assert.equal(g.post({ fh: "import", key: "wrong", rows }).error, "key");
  assert.equal(g.post({ fh: "live", key: "wrong", on: true }).error, "key");
  const r = g.post({ fh: "import", key: KEY, rows, live: true });
  assert.equal(r.added, 2);
  assert.equal(r.skipped, 1);
  assert.equal(r.live, true);
  assert.equal(g.post({ fh: "import", key: KEY, rows: rows.slice(0, 1) }).added, 0);
  assert.equal(g.post({ fh: "set", id: "0123456789abcdef01234567", n: 6 }).ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(g.get({ fh: "totals" }).totals["2026-12"])), { adults: 6, youth: 0, kids: 2 });
  assert.equal(g.post({ fh: "live", key: KEY, on: false }).live, false);
});

test("usage beacons and the usage summary still work beside the counts", () => {
  const g = fakeGoogle();
  assert.equal(g.get({}).service, "Bay 6 Hub Usage");
  assert.equal(g.post({ fh: "add", month: "2027-03", group: "kids", n: 1 }).ok, true);
  assert.equal(g.post({ t: "view", p: "/orgs/", ts: Date.now() }).ok, true);
  assert.equal(g.post({ action: "summary", key: "nope" }).error, "key");
});

test("the page keeps using crudcrud until the Sheet reports live", async () => {
  const g = fakeGoogle();
  const c = client(g, CFG);
  assert.equal(await c.ctx.FhCounts.store(), "crud");
  await c.ctx.FhCounts.saveHousehold("2027-03", { adults: 1, youth: 0, kids: 0 });
  assert.equal(c.calls.filter((x) => x.method === "POST")[0].url, CFG.base);
  assert.deepEqual(JSON.parse(JSON.stringify(g.get({ fh: "totals" }).totals)), {});
});

test("an older Hub script without counts keeps the page on crudcrud", async () => {
  const c = client({ get: () => ({ ok: true, service: "Bay 6 Hub Usage" }), post: () => ({ ok: true }) }, CFG);
  assert.equal(await c.ctx.FhCounts.store(), "crud");
});

test("once live, a household saves, edits, and undoes on the Sheet, never crudcrud", async () => {
  const g = fakeGoogle();
  g.post({ fh: "live", key: KEY, on: true });
  const c = client(g, CFG);
  assert.equal(await c.ctx.FhCounts.store(), "sheet");
  await c.ctx.FhCounts.saveHousehold("2027-03", { adults: 2, youth: 1, kids: 3 });
  let rows = await c.ctx.FhCounts.list();
  assert.deepEqual(JSON.parse(JSON.stringify(c.ctx.FhCounts.totals(rows, "2027-03"))), { adults: 2, youth: 1, kids: 3 });
  await c.ctx.FhCounts.saveHousehold("2027-03", { adults: 2, youth: 0, kids: 4 });
  rows = await c.ctx.FhCounts.list();
  assert.deepEqual(JSON.parse(JSON.stringify(c.ctx.FhCounts.totals(rows, "2027-03"))), { adults: 2, youth: 0, kids: 4 });
  await c.ctx.FhCounts.removeHousehold("2027-03");
  rows = await c.ctx.FhCounts.list();
  assert.deepEqual(JSON.parse(JSON.stringify(c.ctx.FhCounts.totals(rows, "2027-03"))), { adults: 0, youth: 0, kids: 0 });
  assert.equal(c.calls.some((x) => x.url.startsWith("https://crudcrud.com")), false);
  c.calls.filter((x) => x.method === "POST").forEach((x) => {
    assert.match(x.url, /^https:\/\/script\.google\.com\//);
    assert.equal(/name|phone|email/i.test(x.body), false);
  });
  // A new page load in the same browser never falls back, even if the Sheet hiccups.
  const again = client({ get: () => { throw new Error("down"); }, post: () => ({ ok: false }) }, CFG, c.store);
  assert.equal(await again.ctx.FhCounts.store(), "sheet");
});

test("a count saved on crudcrud before the move is edited in place after import", async () => {
  const g = fakeGoogle();
  const store = {};
  const before = client(g, CFG, store);
  await before.ctx.FhCounts.saveHousehold("2027-03", { adults: 2, youth: 0, kids: 0 });
  const id = before.ctx.FhCounts.local("2027-03").adults.id;
  g.post({ fh: "import", key: KEY, rows: [{ id, month: "2027-03", group: "adults", n: 2 }], live: true });
  const after = client(g, CFG, store);
  await after.ctx.FhCounts.saveHousehold("2027-03", { adults: 3, youth: 0, kids: 0 });
  assert.equal(g.get({ fh: "totals" }).totals["2027-03"].adults, 3);
});
