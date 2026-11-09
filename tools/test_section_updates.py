#!/usr/bin/env python3
"""Tests for the Hub section manifest. Run: python3 tools/test_section_updates.py"""
import json
import subprocess
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

import build_section_updates as build

NOW = datetime(2026, 11, 9, 12, 0, tzinfo=timezone.utc)


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def init_repo(root):
    subprocess.run(["git", "init", "-q"], cwd=root, check=True)
    subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=root, check=True)
    subprocess.run(["git", "config", "user.name", "Test"], cwd=root, check=True)


def commit(root, message, when):
    env = dict(**subprocess.os.environ)
    stamp = when.strftime("%Y-%m-%dT%H:%M:%S+00:00")
    env["GIT_AUTHOR_DATE"] = stamp
    env["GIT_COMMITTER_DATE"] = stamp
    subprocess.run(["git", "add", "-A"], cwd=root, check=True)
    subprocess.run(["git", "commit", "-q", "-m", message], cwd=root, check=True, env=env)


class ManifestTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        init_repo(self.root)

    def tearDown(self):
        self.tmp.cleanup()

    def seed(self):
        write(self.root / "events" / "events.json", '{"events":[{"title":"Choir"}]}\n')
        write(self.root / "events" / "flyers" / "note.txt", "flyer")
        write(self.root / "calendar" / "index.html", "<h1>Calendar</h1>\n")
        write(self.root / "calendar" / "ward.ics", "BEGIN:VCALENDAR\nDTSTAMP:20260101T000000Z\nEND:VCALENDAR\n")
        write(self.root / "meet" / "index.html", "<h1>Meet</h1>\n")
        write(self.root / "orgs" / "young-women" / "index.html", "<h1>Young Women</h1>\n")
        write(self.root / "orgs" / "young-women" / "chat" / "signups.test.js", "ignored")
        write(self.root / "orgs" / "primary" / "index.html", "<h1>Primary</h1>\n")
        write(self.root / "index.html", "<p>hub</p><!--TS--><b>Sun, Nov 8</b><!--/TS--><p>rest</p>\n")
        events = [
            {"id": "1", "title": "Class", "calendar": "Young Women", "start": "2026-11-11T19:00:00-07:00"},
            {"id": "2", "title": "Singing", "calendar": "Primary", "start": "2026-11-12T19:00:00-07:00"},
        ]
        write(self.root / "data" / "calendar.json", json.dumps({
            "generated": "2026-11-01T00:00:00-07:00",
            "events": events,
        }))
        commit(self.root, "seed", datetime(2026, 11, 1, tzinfo=timezone.utc))

    def manifest(self, prev=None):
        return build.build_manifest(self.root, prev=prev if prev is not None else {}, now=NOW)

    def test_one_section_change_touches_only_that_hash(self):
        self.seed()
        first = self.manifest()
        write(self.root / "events" / "events.json", '{"events":[{"title":"Choir practice"}]}\n')
        commit(self.root, "events", datetime(2026, 11, 9, 15, tzinfo=timezone.utc))
        second = self.manifest(first["sections"])
        self.assertNotEqual(first["sections"]["events"]["hash"], second["sections"]["events"]["hash"])
        self.assertEqual(second["sections"]["events"]["updated"], "2026-11-09T15:00:00Z")
        for key, section in second["sections"].items():
            if key == "events":
                continue
            self.assertEqual(section["hash"], first["sections"][key]["hash"], key)
            self.assertEqual(section["updated"], first["sections"][key]["updated"], key)

    def test_calendar_timestamp_is_not_a_content_change(self):
        self.seed()
        first = self.manifest()
        raw = json.loads((self.root / "data" / "calendar.json").read_text())
        raw["generated"] = "2026-11-09T21:00:00-07:00"
        write(self.root / "data" / "calendar.json", json.dumps(raw))
        ics = (self.root / "calendar" / "ward.ics").read_text()
        write(self.root / "calendar" / "ward.ics", ics.replace("20260101T000000Z", "20261109T210000Z"))
        commit(self.root, "stamp", datetime(2026, 11, 9, 21, tzinfo=timezone.utc))
        second = self.manifest(first["sections"])
        self.assertEqual(first["sections"]["calendar"]["hash"], second["sections"]["calendar"]["hash"])
        self.assertEqual(first["sections"]["young-women"]["hash"], second["sections"]["young-women"]["hash"])
        self.assertEqual(second["sections"]["calendar"]["updated"], first["sections"]["calendar"]["updated"])

    def test_org_calendar_slice_does_not_light_other_orgs(self):
        self.seed()
        first = self.manifest()
        raw = json.loads((self.root / "data" / "calendar.json").read_text())
        raw["events"][0]["title"] = "Class night"
        write(self.root / "data" / "calendar.json", json.dumps(raw))
        commit(self.root, "yw", datetime(2026, 11, 9, 16, tzinfo=timezone.utc))
        second = self.manifest(first["sections"])
        self.assertNotEqual(first["sections"]["young-women"]["hash"], second["sections"]["young-women"]["hash"])
        self.assertNotEqual(first["sections"]["calendar"]["hash"], second["sections"]["calendar"]["hash"])
        self.assertEqual(first["sections"]["primary"]["hash"], second["sections"]["primary"]["hash"])
        self.assertEqual(first["sections"]["events"]["hash"], second["sections"]["events"]["hash"])

    def test_another_orgs_calendar_edit_does_not_refresh_this_org(self):
        self.seed()
        raw = json.loads((self.root / "data" / "calendar.json").read_text())
        raw["events"][1]["title"] = "Primary singing time"
        raw["generated"] = "2026-11-09T16:00:00-07:00"
        write(self.root / "data" / "calendar.json", json.dumps(raw))
        commit(self.root, "primary event", datetime(2026, 11, 9, 16, tzinfo=timezone.utc))
        doc = self.manifest()
        self.assertEqual(doc["sections"]["young-women"]["updated"], "2026-11-01T00:00:00Z")
        self.assertEqual(doc["sections"]["primary"]["updated"], "2026-11-09T16:00:00Z")
        self.assertEqual(doc["sections"]["events"]["updated"], "2026-11-01T00:00:00Z")

    def test_this_sunday_banner_change_is_its_own_section(self):
        self.seed()
        first = self.manifest()
        text = (self.root / "index.html").read_text()
        write(self.root / "index.html", text.replace("Sun, Nov 8", "Sun, Nov 15"))
        commit(self.root, "banner", datetime(2026, 11, 9, 18, tzinfo=timezone.utc))
        second = self.manifest(first["sections"])
        self.assertNotEqual(first["sections"]["this-sunday"]["hash"], second["sections"]["this-sunday"]["hash"])
        self.assertEqual(second["sections"]["this-sunday"]["updated"], "2026-11-09T18:00:00Z")
        self.assertEqual(first["sections"]["events"]["hash"], second["sections"]["events"]["hash"])

    def test_unrelated_home_page_edit_does_not_change_this_sunday(self):
        self.seed()
        first = self.manifest()
        text = (self.root / "index.html").read_text()
        write(self.root / "index.html", text.replace("<p>hub</p>", "<p>hub home</p>"))
        commit(self.root, "footer", datetime(2026, 11, 9, 19, tzinfo=timezone.utc))
        second = self.manifest(first["sections"])
        self.assertEqual(first["sections"]["this-sunday"]["hash"], second["sections"]["this-sunday"]["hash"])
        self.assertEqual(first["sections"]["this-sunday"]["updated"], second["sections"]["this-sunday"]["updated"])

    def test_render_is_stable(self):
        self.seed()
        doc = self.manifest()
        self.assertEqual(build.render(doc), build.render(doc))
        self.assertEqual(list(doc["sections"]), [spec["id"] for spec in build.SECTIONS])
        self.assertEqual(doc["windowDays"], 7)


class RealRepoTests(unittest.TestCase):
    def test_real_manifest_is_stable_and_complete(self):
        first = build.build_manifest(build.ROOT)
        second = build.build_manifest(build.ROOT)
        self.assertEqual(build.render(first), build.render(second))
        self.assertEqual(set(first["sections"]), {spec["id"] for spec in build.SECTIONS})
        for section in first["sections"].values():
            self.assertEqual(len(section["hash"]), 64)
            self.assertRegex(section["updated"], r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")


if __name__ == "__main__":
    unittest.main()
