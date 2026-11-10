#!/usr/bin/env python3
"""Tests for tools/prune_events.py. Run: python3 tools/test_prune_events.py"""
import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

import prune_events as prune


TODAY = "2026-11-10"

EVENTS_HTML = """<!doctype html>
<html><body>
<main>
  <p class="note">Past events hide automatically.</p>
  <article class="ev" data-end="2026-11-07T13:30:00-07:00">
    <div class="evtx"><b>Utah Coalition Against Pornography</b></div>
  </article>
  <article class="ev" data-end="2026-11-05T17:00:00-07:00">
    <div class="evtx"><b>Primary Program Practice</b>
      <div class="acts"><a href="flyers/2026-11-05-primary-practice.png">View flyer</a></div></div>
  </article>
  <article class="ev" data-end="2026-11-10T14:00:00-07:00">
    <div class="evtx"><b>RS Temple &amp; Table</b></div>
  </article>
  <article class="ev" data-end="2026-11-10T06:30:00Z">
    <div class="evtx"><b>Late UTC stamp that is still Nov 9 in Denver</b></div>
  </article>
  <article class="ev" data-end="2026-11-12T21:00:00-07:00">
    <div class="evtx"><b>Sawubona Friendsgiving</b></div>
  </article>
  <article class="card" data-end="2020-01-01T00:00:00-07:00">
    <b>Not an event card</b>
  </article>
  <p class="empty" id="empty" hidden>No upcoming events right now.</p>
</main>
</body></html>
"""

ORG_HTML = """<!doctype html>
<html><body>
<!--EV-->
  <article class="ev" data-end="2026-11-05T20:00:00-07:00">
    <div class="evtx"><b>Relief Society Training Dinner</b></div>
  </article>
  <article class="ev" data-end="2026-11-10T14:00:00-07:00">
    <div class="evtx"><b>RS Temple &amp; Table</b></div>
  </article>
  <article class="ev" data-end="2026-11-12T21:00:00-07:00">
    <div class="evtx"><b>Sawubona Friendsgiving</b></div>
  </article>
<!--/EV-->
</body></html>
"""

CHAT_HTML = """<!doctype html>
<html><body>
  <article class="ev" data-end="2026-11-01T12:00:00-07:00">
    <div class="evtx"><b>Do not touch Young Women chat</b></div>
  </article>
</body></html>
"""


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


class PruneTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        write(self.root / "events" / "index.html", EVENTS_HTML)
        write(self.root / "orgs" / "relief-society" / "index.html", ORG_HTML)
        write(self.root / "orgs" / "young-women" / "chat" / "index.html", CHAT_HTML)
        write(self.root / "events" / "events.json", json.dumps({
            "_readme": "keep me",
            "events": [
                {"title": "Primary Program Practice", "end": "2026-11-05T17:00:00-07:00", "flyer": "flyers/2026-11-05-primary-practice.png"},
                {"title": "Sawubona Friendsgiving", "end": "2026-11-12T21:00:00-07:00", "flyer": "flyers/2026-11-12-rs-friendsgiving.jpg"},
                {"title": "Jr. SNAP", "end": "2026-12-14T17:45:00-07:00", "flyer": "flyers/jr-snap.jpg"},
                {"title": "No end yet"},
                {"title": "Bad end", "end": "not-a-date"},
            ],
        }, indent=2) + "\n")
        # Middle dot is stored escaped, matching events.json in this repo.
        announcements = (
            '{\n'
            '  "_readme": "Ward choir \\u00b7 practice",\n'
            '  "announcements": [\n'
            '    {"id": "choir", "title": "Ward Choir Practice", "date": "2026-11-01", "endDate": "2026-12-13", "flyer": "flyers/choir.jpg"},\n'
            '    {"id": "anchor", "title": "Young Women: News Anchor Night", "date": "2026-11-04", "flyer": "flyers/anchor.jpg"},\n'
            '    {"id": "search", "title": "Family Search Invitations", "date": "2026-11-01", "endDate": "2026-11-29", "flyer": "flyers/search.jpg?v=1"},\n'
            '    {"id": "ball", "title": "Stake Young Men Basketball Season", "date": "2027-01-07", "endDate": "2027-02-18", "flyer": "flyers/ball.jpg"},\n'
            '    {"id": "today", "title": "Happening Today", "date": "2026-11-10"},\n'
            '    {"id": "soon", "title": "Neighborhood-Giving", "date": "2026-11-20", "flyer": "flyers/giving.png"},\n'
            '    {"id": "odd", "title": "Missing date"}\n'
            '  ]\n'
            '}\n'
        )
        write(self.root / "data" / "approved-announcements.json", announcements)
        write(self.root / "data" / "yw-classes.json", json.dumps({
            "_readme": "Items hide after their date/endDate (America/Denver).",
            "activities": [
                {"class": "builders", "title": "News Anchor Night", "date": "2026-11-04", "flyer": "events/flyers/anchor.jpg"},
                {"class": "all", "title": "Future Class Night", "date": "2026-11-18"},
            ],
        }, indent=2, ensure_ascii=False) + "\n")
        write(self.root / "data" / "ym-quorums.json", json.dumps({"activities": []}, indent=2) + "\n")
        write(self.root / "data" / "primary-classes.json", json.dumps({
            "activities": [
                {"title": "Past Primary Activity", "date": "2026-11-02", "flyer": "events/flyers/primary-old.png"},
                {"title": "Future Primary Activity", "date": "2026-12-01", "endDate": "2026-12-02"},
            ],
        }, indent=2) + "\n")
        for name in (
            "2026-11-05-primary-practice.png",
            "2026-11-12-rs-friendsgiving.jpg",
            "jr-snap.jpg",
            "anchor.jpg",
            "search.jpg",
            "choir.jpg",
            "ball.jpg",
            "giving.png",
            "primary-old.png",
            "orphan-summit.jpg",
            "notes.txt",
        ):
            write(self.root / "events" / "flyers" / name, "flyer-bytes-" + name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_denver_date_crosses_midnight_not_utc(self):
        just_before = datetime(2026, 11, 10, 6, 59, tzinfo=timezone.utc)
        just_after = datetime(2026, 11, 10, 7, 15, tzinfo=timezone.utc)
        self.assertEqual(prune.denver_today(just_before).isoformat(), "2026-11-09")
        self.assertEqual(prune.denver_today(just_after).isoformat(), "2026-11-10")
        summer_before = datetime(2026, 7, 10, 5, 59, tzinfo=timezone.utc)
        summer_after = datetime(2026, 7, 10, 7, 15, tzinfo=timezone.utc)
        self.assertEqual(prune.denver_today(summer_before).isoformat(), "2026-07-09")
        self.assertEqual(prune.denver_today(summer_after).isoformat(), "2026-07-10")
        self.assertEqual(prune.instant_last_day("2026-11-10T06:30:00Z").isoformat(), "2026-11-09")
        self.assertEqual(prune.instant_last_day("2026-11-12T21:00:00-07:00").isoformat(), "2026-11-12")

    def test_prune_removes_only_expired_records_and_orphans(self):
        removed = prune.prune(self.root, today=TODAY)
        labels = {label for _, label in removed}
        self.assertIn("Utah Coalition Against Pornography", labels)
        self.assertIn("Primary Program Practice", labels)
        self.assertIn("Late UTC stamp that is still Nov 9 in Denver", labels)
        self.assertIn("Relief Society Training Dinner", labels)
        self.assertIn("Young Women: News Anchor Night", labels)
        self.assertIn("News Anchor Night", labels)
        self.assertIn("Past Primary Activity", labels)
        self.assertIn("anchor.jpg", labels)
        self.assertIn("orphan-summit.jpg", labels)
        self.assertIn("primary-old.png", labels)
        self.assertNotIn("Sawubona Friendsgiving", labels)
        self.assertNotIn("Ward Choir Practice", labels)
        self.assertNotIn("Family Search Invitations", labels)
        self.assertNotIn("Stake Young Men Basketball Season", labels)
        self.assertNotIn("Jr. SNAP", labels)
        self.assertNotIn("Happening Today", labels)
        self.assertNotIn("Neighborhood-Giving", labels)
        self.assertNotIn("Do not touch Young Women chat", labels)

        events = (self.root / "events" / "index.html").read_text(encoding="utf-8")
        self.assertNotIn("Utah Coalition Against Pornography", events)
        self.assertNotIn("Primary Program Practice", events)
        self.assertIn("Sawubona Friendsgiving", events)
        self.assertIn("RS Temple &amp; Table", events)
        self.assertIn("Not an event card", events)
        self.assertIn("Past events hide automatically.", events)

        org = (self.root / "orgs" / "relief-society" / "index.html").read_text(encoding="utf-8")
        self.assertNotIn("Relief Society Training Dinner", org)
        self.assertIn("RS Temple &amp; Table", org)
        self.assertIn("Sawubona Friendsgiving", org)
        self.assertIn("<!--EV-->", org)
        self.assertIn("<!--/EV-->", org)

        chat = (self.root / "orgs" / "young-women" / "chat" / "index.html").read_text(encoding="utf-8")
        self.assertEqual(chat, CHAT_HTML)

        catalog = json.loads((self.root / "events" / "events.json").read_text(encoding="utf-8"))
        titles = [item.get("title") for item in catalog["events"]]
        self.assertEqual(titles, ["Sawubona Friendsgiving", "Jr. SNAP", "No end yet", "Bad end"])
        self.assertEqual(catalog["_readme"], "keep me")

        announcements = json.loads((self.root / "data" / "approved-announcements.json").read_text(encoding="utf-8"))
        ids = [item["id"] for item in announcements["announcements"]]
        self.assertEqual(ids, ["choir", "search", "ball", "today", "soon", "odd"])
        raw_announcements = (self.root / "data" / "approved-announcements.json").read_text(encoding="utf-8")
        self.assertIn("\\u00b7", raw_announcements)

        activities = json.loads((self.root / "data" / "yw-classes.json").read_text(encoding="utf-8"))
        self.assertEqual([item["title"] for item in activities["activities"]], ["Future Class Night"])
        primary = json.loads((self.root / "data" / "primary-classes.json").read_text(encoding="utf-8"))
        self.assertEqual([item["title"] for item in primary["activities"]], ["Future Primary Activity"])

        flyers = {path.name for path in (self.root / "events" / "flyers").iterdir()}
        self.assertIn("2026-11-12-rs-friendsgiving.jpg", flyers)
        self.assertIn("jr-snap.jpg", flyers)
        self.assertIn("search.jpg", flyers)
        self.assertIn("choir.jpg", flyers)
        self.assertIn("ball.jpg", flyers)
        self.assertIn("giving.png", flyers)
        self.assertIn("notes.txt", flyers)
        self.assertNotIn("anchor.jpg", flyers)
        self.assertNotIn("2026-11-05-primary-practice.png", flyers)
        self.assertNotIn("orphan-summit.jpg", flyers)
        self.assertNotIn("primary-old.png", flyers)

    def test_second_run_is_a_noop(self):
        prune.prune(self.root, today=TODAY)
        snapshot = {
            path.relative_to(self.root).as_posix(): path.read_bytes()
            for path in self.root.rglob("*") if path.is_file()
        }
        again = prune.prune(self.root, today=TODAY)
        self.assertEqual(again, [])
        after = {
            path.relative_to(self.root).as_posix(): path.read_bytes()
            for path in self.root.rglob("*") if path.is_file()
        }
        self.assertEqual(snapshot, after)

    def test_dry_run_writes_nothing(self):
        before = {
            path.relative_to(self.root).as_posix(): path.read_bytes()
            for path in self.root.rglob("*") if path.is_file()
        }
        removed = prune.prune(self.root, today=TODAY, dry_run=True)
        self.assertTrue(removed)
        after = {
            path.relative_to(self.root).as_posix(): path.read_bytes()
            for path in self.root.rglob("*") if path.is_file()
        }
        self.assertEqual(before, after)

    def test_nothing_expired_keeps_bytes(self):
        root = Path(tempfile.mkdtemp())
        self.addCleanup(lambda: __import__("shutil").rmtree(root))
        page = '<article class="ev" data-end="2026-11-12T21:00:00-07:00"><b>Sawubona Friendsgiving</b></article>\n'
        write(root / "events" / "index.html", page)
        payload = json.dumps({"announcements": [{"title": "Soon", "date": "2026-11-12"}]}, indent=2) + "\n"
        write(root / "data" / "approved-announcements.json", payload)
        write(root / "events" / "flyers" / "kept.jpg", "x")
        write(root / "data" / "extra.json", '{"flyer": "kept.jpg"}\n')
        removed = prune.prune(root, today=TODAY)
        self.assertEqual(removed, [])
        self.assertEqual((root / "events" / "index.html").read_text(encoding="utf-8"), page)
        self.assertEqual((root / "data" / "approved-announcements.json").read_text(encoding="utf-8"), payload)
        self.assertTrue((root / "events" / "flyers" / "kept.jpg").is_file())

    def test_cli_reports_a_clean_day(self):
        code = prune.main(["--root", str(self.root), "--today", "2020-01-01", "--dry-run"])
        self.assertEqual(code, 0)
        code = prune.main(["--today", "tomorrow"])
        self.assertEqual(code, 2)

    def test_event_stays_through_its_last_day(self):
        root = Path(tempfile.mkdtemp())
        self.addCleanup(lambda: __import__("shutil").rmtree(root))
        page = (
            '<p class="note">n</p>\n'
            '  <article class="ev" data-end="2026-11-12T21:00:00-07:00">\n'
            '    <div class="evtx"><b>Sawubona Friendsgiving</b></div>\n'
            '  </article>\n'
            '  <p class="empty" id="empty" hidden></p>\n'
        )
        write(root / "events" / "index.html", page)
        write(root / "data" / "approved-announcements.json", json.dumps({
            "announcements": [
                {"id": "give", "title": "Neighborhood-Giving", "date": "2026-11-12"},
                {"id": "choir", "title": "Ward Choir Practice", "date": "2026-11-01", "endDate": "2026-12-13"},
            ],
        }, indent=2) + "\n")
        self.assertEqual(prune.prune(root, today="2026-11-12"), [])
        self.assertIn("Sawubona Friendsgiving", (root / "events" / "index.html").read_text(encoding="utf-8"))
        gone = prune.prune(root, today="2026-11-13")
        labels = {label for _, label in gone}
        self.assertIn("Sawubona Friendsgiving", labels)
        self.assertIn("Neighborhood-Giving", labels)
        self.assertNotIn("Ward Choir Practice", labels)
        self.assertNotIn("Sawubona Friendsgiving", (root / "events" / "index.html").read_text(encoding="utf-8"))

    def test_builder_uses_the_denver_calendar_day(self):
        src = (Path(__file__).resolve().parents[1] / "tools" / "build_events.py").read_text(encoding="utf-8")
        self.assertIn("still_current_instant", src)
        self.assertNotIn("datetime.now", src)


if __name__ == "__main__":
    unittest.main()
