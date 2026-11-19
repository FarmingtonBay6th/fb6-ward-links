// Family History Challenge: month order, adult goals, and anonymous household counts.
// Run: node --test tools/fh-challenge.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");

function load(file, context) {
  const src = fs.readFileSync(path.join(ROOT, file), "utf8");
  vm.runInNewContext(src, context, { filename: file });
  return context;
}

const ADULT_TITLES = {
  "2027-01": "5th Sunday Lesson",
  "2027-02": "Login & Recommend Check",
  "2027-03": "Upload a Photo",
  "2027-04": "Find 1 Name",
  "2027-05": "Submit Names to the Temple",
  "2027-06": "4 Generations Check",
  "2027-07": "Salt Lake Temple Open House",
  "2027-08": "Upload a Story or Document",
  "2027-09": "Ward Temple Day",
  "2027-10": "Temple Preparation Focus",
  "2027-11": "Submit 5 Names",
  "2027-12": "Record a Family Tradition"
};

test("button order puts the current month first and keeps the whole year", () => {
  const context = {};
  load("fh-challenges.js", context);
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data/fh-challenges.json"), "utf8"));
  const march = context.Fb6Fh.buttonOrder(data.challenges, "2027-03-15");
  assert.equal(march.active.id, "2027-03");
  assert.equal(march.current.id, "2027-03");
  assert.equal(march.months.map((item) => item.id).join(","), [
    "2027-03", "2027-04", "2027-05", "2027-06", "2027-07", "2027-08",
    "2027-09", "2027-10", "2027-11", "2027-12", "2026-12", "2027-01", "2027-02"
  ].join(","));

  const before = context.Fb6Fh.buttonOrder(data.challenges, "2026-11-19");
  assert.equal(before.current, null);
  assert.equal(before.active.id, "2026-12");
  assert.equal(before.months[0].id, "2026-12");
  assert.equal(before.months.length, 13);
  assert.equal(before.months[before.months.length - 1].id, "2027-12");

  const after = context.Fb6Fh.buttonOrder(data.challenges, "2028-01-02");
  assert.equal(after.active.id, "2027-12");
  assert.equal(after.months[0].id, "2027-12");
  assert.equal(after.months.length, 13);
});

test("2027 adult goals stay the plan titles, and December 2026 stays the warm-up", () => {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data/fh-challenges.json"), "utf8"));
  const byId = {};
  data.challenges.forEach((item) => { byId[item.id] = item; });
  assert.equal(byId["2026-12"].title, "Record a Family Tradition");
  assert.equal(byId["2026-12"].kids.title, "Share a Family Tradition");
  assert.equal(byId["2026-12"].dateNote, "Warm-Up Month");
  Object.keys(ADULT_TITLES).forEach((id) => {
    const item = byId[id];
    assert.equal(item.parents.title, ADULT_TITLES[id], id);
    assert.equal(item.title, ADULT_TITLES[id], id);
    assert.ok(item.kids && item.kids.title && item.kids.steps.length >= 2, id + " kids");
    assert.ok(item.together && item.together.title && item.together.steps.length >= 2, id + " together");
    assert.match(item.print, /^sheets\/2027-\d{2}\.html$/);
    assert.equal(fs.existsSync(path.join(ROOT, "orgs/temple-and-family-history/quest", item.print)), true, item.print);
  });
});

test("the challenge page labels Adult/Youth and never Parents", () => {
  const html = fs.readFileSync(path.join(ROOT, "orgs/temple-and-family-history/quest/index.html"), "utf8");
  assert.match(html, /Adult\/Youth Goal/);
  assert.match(html, /Adult\/Youth Did It/);
  assert.doesNotMatch(html, /Parents/);
  assert.doesNotMatch(html, /Together Did It/);
});

test("a household count saves adults, youth, and kids in one step and stores no names", async () => {
  const calls = [];
  const store = {};
  const context = {
    localStorage: {
      getItem: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
      setItem: (key, value) => { store[key] = String(value); },
      removeItem: (key) => { delete store[key]; }
    },
    fetch: (url, opts) => {
      const method = (opts && opts.method) || "GET";
      const body = opts && opts.body ? JSON.parse(opts.body) : null;
      calls.push({ url, method, body });
      if (method === "POST") {
        return Promise.resolve({ ok: true, json: async () => ({ _id: "id-" + calls.length, ...body }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => body || [] });
    }
  };
  context.window = context;
  load("orgs/temple-and-family-history/quest/fh-counts.js", context);
  context.FH_COUNTS_CONFIG = { base: "https://crudcrud.com/api/0123456789abcdef0123456789abcdef/counts" };
  const plan = await context.FhCounts.saveHousehold("2027-03", { adults: 2, youth: 1, kids: 3 });
  assert.equal(JSON.stringify(plan), JSON.stringify({ adults: 2, youth: 1, kids: 3 }));
  assert.equal(calls.length, 3);
  calls.forEach((call) => {
    assert.equal(call.method, "POST");
    assert.deepEqual(Object.keys(call.body).sort(), ["group", "month", "n"]);
    assert.equal(call.body.month, "2027-03");
    assert.equal(JSON.stringify(call.body).includes("name"), false);
  });
  const again = [];
  context.fetch = (url, opts) => {
    again.push({ url, method: opts.method, body: opts.body ? JSON.parse(opts.body) : null });
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  };
  await context.FhCounts.saveHousehold("2027-03", { adults: 2, youth: 0, kids: 4 });
  assert.deepEqual(again.map((call) => call.method), ["PUT", "DELETE", "PUT"]);
  assert.equal(again[1].url.endsWith("/id-2"), true);
  await assert.rejects(context.FhCounts.saveHousehold("2027-03", { adults: 0, youth: 0, kids: 0 }), /empty/);
  await assert.rejects(context.FhCounts.saveHousehold("2027-03", { adults: 1.5, youth: 0, kids: 0 }), /validation/);
});

test("ward totals are percents of membership and ignore other months", () => {
  const context = {};
  load("orgs/temple-and-family-history/quest/fh-counts.js", context);
  const rows = [
    { month: "2027-03", group: "adults", n: 28 },
    { month: "2027-03", group: "kids", n: 7 },
    { month: "2027-04", group: "adults", n: 100 },
    { month: "2027-03", group: "youth", n: 0 },
    { month: "2027-03", group: "name", n: 9 }
  ];
  assert.equal(JSON.stringify(context.FhCounts.totals(rows, "2027-03")), JSON.stringify({ adults: 28, youth: 0, kids: 7 }));
  const counts = JSON.parse(fs.readFileSync(path.join(ROOT, "data/ward-counts.json"), "utf8"));
  assert.equal(Math.round((28 / counts.adults) * 100), 10);
  assert.ok(counts.adults > 0 && counts.youth > 0 && counts.kids > 0);
});
