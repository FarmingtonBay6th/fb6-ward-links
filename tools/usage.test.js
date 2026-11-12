// usage.js: privacy and link ids. Run: node --test tools/usage.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "usage.js"), "utf8");
const BASE = "https://farmingtonbay6th.github.io/fb6-ward-links/";

function load(pageUrl, opts = {}) {
  const sent = [];
  let clickHandler = null;
  const loc = new URL(pageUrl);
  const document = {
    currentScript: { src: BASE + "usage.js" },
    addEventListener: (type, fn) => { if (type === "click") clickHandler = fn; },
    get cookie() { throw new Error("usage.js must not read cookies"); },
    set cookie(v) { throw new Error("usage.js must not set cookies"); },
  };
  const navigator = {
    sendBeacon: (url, body) => { sent.push({ url, body: JSON.parse(body) }); return true; },
    get userAgent() { throw new Error("usage.js must not read the user agent"); },
  };
  const ctx = {
    location: opts.location || loc, document, navigator, URL, JSON, Date,
    fetch: () => { throw new Error("fetch should not be needed when sendBeacon works"); },
    get localStorage() { throw new Error("no storage"); },
    get sessionStorage() { throw new Error("no storage"); },
  };
  vm.runInNewContext(SRC, ctx);
  function click(href, attrs = {}) {
    const el = {
      getAttribute: (k) => (k === "href" ? href : k === "data-usage-id" ? attrs.usage || null : null),
      classList: { contains: (c) => (attrs.cls || "").split(/\s+/).includes(c) },
    };
    el.closest = () => el;
    clickHandler({ target: el });
  }
  return { sent, click };
}

test("a page view sends only type, link id, path, and timestamp", () => {
  const { sent } = load(BASE + "orgs/primary/?k=secret#frag");
  assert.equal(sent.length, 1);
  assert.deepEqual(Object.keys(sent[0].body).sort(), ["id", "p", "t", "ts"]);
  assert.equal(sent[0].body.t, "view");
  assert.equal(sent[0].body.p, "/orgs/primary/");
  assert.match(sent[0].url, /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/);
});

test("phone numbers, emails, query strings, and private pages never leave the page", () => {
  const { sent, click } = load(BASE + "meet/");
  click("sms:+18015551234&body=Hi%20Bishop");
  click("tel:+1 801 555 1234");
  click("mailto:someone@example.com?subject=x");
  click("https://docs.google.com/forms/d/e/1FAIpQLSdAbCdEf1234567890/viewform?usp=sf_link&entry.1=Jane");
  click("../orgs/young-women/chat/?leader=abc123#key");
  click("../sp-r5xrl3socb/");
  const ids = sent.slice(1).map((s) => s.body.id);
  assert.deepEqual(ids, ["sms:/meet/", "tel:/meet/", "mailto:/meet/", "docs.google.com/forms/d/e/~/viewform", "/orgs/young-women/chat/", "/private-page/"]);
  const all = JSON.stringify(sent);
  for (const bad of ["555", "example.com", "Jane", "abc123", "leader", "key", "r5xrl3socb", "1FAIpQL"]) assert.equal(all.includes(bad), false, bad);
});

test("the Back button and javascript links are handled", () => {
  const { sent, click } = load(BASE + "events/");
  click(BASE, { cls: "fbback" });
  click("javascript:void(0)");
  click("#top");
  click("", { usage: "fh-quest:print" });
  assert.deepEqual(sent.slice(1).map((s) => s.body.id), ["nav:back", "fh-quest:print"]);
});

test("nothing is sent from local previews or other hosts", () => {
  const { sent } = load("http://localhost:8000/fb6-ward-links/");
  assert.equal(sent.length, 0);
});

test("link ids match data/usage-links.json for every link in the Hub pages", () => {
  const pairs = JSON.parse(execFileSync("python3", [path.join(ROOT, "tools/build_usage_links.py"), "--pairs"], { encoding: "utf8" }));
  assert.ok(pairs.length > 50);
  const byPage = new Map();
  for (const p of pairs) {
    if (!byPage.has(p.page)) byPage.set(p.page, load(p.page));
    const page = byPage.get(p.page);
    const before = page.sent.length;
    page.click(p.href, { usage: p.usage, cls: p.cls });
    const got = page.sent.length > before ? page.sent[page.sent.length - 1].body.id : "";
    assert.equal(got, p.id, `${p.page} ${p.href}`);
  }
});

test("usage-links.json has no phone numbers, query strings, or private pages", () => {
  const text = fs.readFileSync(path.join(ROOT, "data/usage-links.json"), "utf8");
  assert.equal(/\+1\d{10}|\b1?(801|385|435)\d{7}\b/.test(text), false);
  for (const l of JSON.parse(text).links) if (/^(sms|tel|mailto):/.test(l.id)) assert.equal(/\d/.test(l.id), false, l.id);
  for (const l of JSON.parse(text).links) {
    assert.equal(/[?#&=]/.test(l.id), false, l.id);
    assert.equal(l.id.includes("sp-") || l.pages.some((p) => p.startsWith("/sp-")), false, l.id);
  }
});
