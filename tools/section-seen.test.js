const test = require("node:test");
const assert = require("node:assert/strict");
const seen = require("../section-seen.js");

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-11-09T12:00:00Z");

function manifest(extra) {
  const sections = Object.assign({
    events: { title: "Upcoming Events", path: "events/", hash: "events-1", updated: "2026-10-01T00:00:00Z" },
    calendar: { title: "Bay 6 Calendar", path: "calendar/", hash: "cal-1", updated: "2026-11-08T00:00:00Z" },
    "young-women": { title: "Young Women", path: "orgs/young-women/", hash: "yw-1", updated: "2026-09-01T00:00:00Z" },
    "this-sunday": { title: "This Sunday", path: "this-sunday/", hash: "sun-1", updated: "2026-11-08T18:00:00Z" }
  }, extra || {});
  return { windowDays: 7, sections };
}

test("first visit marks old sections seen and keeps the last 7 days unread", () => {
  const result = seen.apply(manifest(), null, NOW, null, 7);
  assert.equal(result.stored.init, true);
  assert.equal(result.stored.seen.events, "events-1");
  assert.equal(result.stored.seen["young-women"], "yw-1");
  assert.equal(result.stored.seen.calendar, null);
  assert.equal(result.stored.seen["this-sunday"], null);
  assert.deepEqual(Object.keys(result.unread).sort(), ["calendar", "this-sunday"]);
});

test("a section updated exactly 7 days ago still counts as new", () => {
  const doc = manifest({
    color: { title: "Crayons & Covenants", path: "color/", hash: "c1", updated: new Date(NOW - 7 * DAY).toISOString() }
  });
  const result = seen.apply(doc, null, NOW, null, 7);
  assert.equal(result.unread.color, true);
});

test("a section updated a millisecond earlier than 7 days is seen", () => {
  const doc = manifest({
    color: { title: "Crayons & Covenants", path: "color/", hash: "c1", updated: new Date(NOW - 7 * DAY - 1).toISOString() }
  });
  const result = seen.apply(doc, null, NOW, null, 7);
  assert.equal(result.unread.color, undefined);
  assert.equal(result.stored.seen.color, "c1");
});

test("opening a section clears only that dot", () => {
  const first = seen.apply(manifest(), null, NOW, null, 7);
  assert.equal(first.unread.calendar, true);
  assert.equal(first.unread["this-sunday"], true);
  const opened = seen.apply(manifest(), first.stored, NOW, "calendar", 7);
  assert.equal(opened.unread.calendar, undefined);
  assert.equal(opened.stored.seen.calendar, "cal-1");
  assert.equal(opened.unread["this-sunday"], true);
});

test("an unread first-visit section stays unread after the 7-day window", () => {
  const first = seen.apply(manifest(), null, NOW, null, 7);
  const later = seen.apply(manifest(), first.stored, NOW + 30 * DAY, null, 7);
  assert.equal(later.unread.calendar, true);
  assert.equal(later.unread["this-sunday"], true);
  assert.equal(later.unread.events, undefined);
});

test("a new hash lights only the section that changed", () => {
  const first = seen.apply(manifest(), null, NOW, "calendar", 7);
  const openedSunday = seen.apply(manifest(), first.stored, NOW, "this-sunday", 7);
  assert.deepEqual(openedSunday.unread, {});
  const doc = manifest();
  doc.sections.events = Object.assign({}, doc.sections.events, { hash: "events-2", updated: "2026-11-09T12:00:00Z" });
  const next = seen.apply(doc, openedSunday.stored, NOW, null, 7);
  assert.deepEqual(next.unread, { events: true });
});

test("a new section added later uses the 7-day rule once", () => {
  const first = seen.apply(manifest(), null, NOW, null, 7);
  const doc = manifest({
    meet: { title: "Meet With The Bishop", path: "meet/", hash: "m1", updated: "2026-01-01T00:00:00Z" },
    announce: { title: "Submit An Announcement", path: "announce/", hash: "a1", updated: "2026-11-09T00:00:00Z" }
  });
  const next = seen.apply(doc, first.stored, NOW, null, 7);
  assert.equal(next.unread.meet, undefined);
  assert.equal(next.stored.seen.meet, "m1");
  assert.equal(next.unread.announce, true);
});

test("a bad updated date does not light a dot on first visit", () => {
  const doc = manifest({
    color: { title: "Crayons & Covenants", path: "color/", hash: "c1", updated: "not-a-date" }
  });
  const result = seen.apply(doc, null, NOW, null, 7);
  assert.equal(result.unread.color, undefined);
});

test("apply does not mutate the stored object it was given", () => {
  const stored = { init: true, seen: { events: "events-1" } };
  const snapshot = JSON.stringify(stored);
  seen.apply(manifest(), stored, NOW, "calendar", 7);
  assert.equal(JSON.stringify(stored), snapshot);
});

const BASE = "https://farmingtonbay6th.github.io/fb6-ward-links/";
const SECTIONS = manifest().sections;

test("site paths map to the longest section, including subpages", () => {
  assert.equal(seen.sectionForPage(SECTIONS, seen.siteRel(BASE + "events/", BASE)), "events");
  assert.equal(seen.sectionForPage(SECTIONS, seen.siteRel(BASE + "events/index.html", BASE)), "events");
  assert.equal(seen.sectionForPage(SECTIONS, seen.siteRel(BASE + "orgs/young-women/chat/", BASE)), "young-women");
  assert.equal(seen.sectionForPage(SECTIONS, seen.siteRel(BASE + "this-sunday/program.html", BASE)), "this-sunday");
  assert.equal(seen.sectionForPage(SECTIONS, seen.siteRel(BASE, BASE)), null);
  assert.equal(seen.sectionForPage(SECTIONS, seen.siteRel(BASE + "index.html", BASE)), null);
  assert.equal(seen.sectionForPage(SECTIONS, seen.siteRel("https://calendly.com/example", BASE)), null);
});

test("section links get dots and flyer files do not", () => {
  assert.equal(seen.sectionForLink(SECTIONS, seen.siteRel("events/?v=1", "http://127.0.0.1:8765/")), "events");
  assert.equal(seen.sectionForLink(SECTIONS, "events/flyers/poster.jpg"), null);
  assert.equal(seen.sectionForLink(SECTIONS, "events/flyers/notes.pdf"), null);
  assert.equal(seen.sectionForLink(SECTIONS, "this-sunday/program.html"), "this-sunday");
  assert.equal(seen.sectionForLink(SECTIONS, "orgs/young-women/"), "young-women");
  assert.equal(seen.sectionForLink(SECTIONS, ""), null);
});
