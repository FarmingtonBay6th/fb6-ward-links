#!/usr/bin/env python3
"""Young Men roster privacy and page wiring. Run: python3 tools/test_ym_roster.py

Public site: youth are first name + last initial, birthdays are month and day
only. No birth years, ages, full last names, or contact info.
"""
import json
import re
import subprocess
import unittest
from pathlib import Path

import build_section_updates as build

ROOT = Path(__file__).resolve().parents[1]
YOUTH = re.compile(r"^[A-Z][a-zA-Z'’-]* [A-Z]\.$")
FIRST = re.compile(r"^[A-Z][a-zA-Z'’-]*$")
PHONE = re.compile(r"(?:\+?\d[\d\s().-]{8,}\d)|(?:\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b)")
EMAIL = re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}")
YEAR = re.compile(r"\b(?:19|20)\d{2}\b")
ADULT = "Bishop Drommond"

PRESIDENCY = {
    "deacons-quorum": ["Henry J.", "Mark G.", "Grant F.", "William T."],
    "teachers-quorum": ["Ezra B.", "Jed B.", "Graham J.", "Xander D."],
    "priests-quorum": [ADULT, "Charlie C.", None, "Cole T."],
}
MEMBER_COUNTS = {"deacons-quorum": 11, "teachers-quorum": 16, "priests-quorum": 17}


def load(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


class YoungMenRosterTests(unittest.TestCase):
    def setUp(self):
        self.doc = load("data/ym-quorums.json")
        self.birthdays = load("data/ym-birthdays.json")
        self.page = (ROOT / "orgs/young-men/index.html").read_text(encoding="utf-8")
        self.script = (ROOT / "orgs/young-men/quorums.js").read_text(encoding="utf-8")

    def youth_in(self, quorum):
        names = []
        for person in quorum["presidency"]:
            if person["name"] and person["name"] != ADULT:
                names.append(person["name"])
        names.extend(quorum["members"])
        return names

    def test_presidencies_and_member_lists(self):
        classes = {c["id"]: c for c in self.doc["classes"]}
        self.assertEqual(set(classes), set(PRESIDENCY))
        youth = []
        for qid, expected in PRESIDENCY.items():
            quorum = classes[qid]
            self.assertEqual([p["name"] for p in quorum["presidency"]], expected)
            members = quorum["members"]
            self.assertEqual(members, sorted(members, key=str.casefold))
            self.assertEqual(len(members), len(set(members)))
            self.assertEqual(len(members), MEMBER_COUNTS[qid])
            pres = {name for name in expected if name}
            self.assertTrue(pres.isdisjoint(members))
            # Charles C. on the roster is the assistant shown as Charlie C.
            self.assertNotIn("Charles C.", members)
            for name in members:
                self.assertRegex(name, YOUTH)
            youth.extend(self.youth_in(quorum))
        self.assertEqual(len(youth), 54)
        self.assertEqual([len(self.youth_in(classes[qid])) for qid in ("deacons-quorum", "teachers-quorum", "priests-quorum")], [15, 20, 19])
        self.assertTrue(all(YOUTH.match(name) for name in youth))
        deacons = classes["deacons-quorum"]["members"]
        teachers = classes["teachers-quorum"]["members"]
        priests = classes["priests-quorum"]["members"]
        self.assertIn("Grayson H.", deacons)
        self.assertIn("Grayson Z.", deacons)
        self.assertNotIn("Grayson W.", teachers)
        self.assertTrue(all(not name.startswith("Grayson") for name in teachers))
        self.assertIn("Jackson W.", teachers)
        self.assertIn("Wyatt B.", teachers)
        self.assertIn("Wyatt O.", priests)
        self.assertNotIn("Williams", " ".join(youth))

    def test_birthdays_are_month_and_day_only(self):
        self.assertEqual(len(self.birthdays), 54)
        months = []
        for entry in self.birthdays:
            self.assertEqual(set(entry), {"name", "month", "day"})
            self.assertRegex(entry["name"], FIRST)
            self.assertIsInstance(entry["month"], int)
            self.assertIsInstance(entry["day"], int)
            self.assertIn(entry["month"], range(1, 13))
            self.assertIn(entry["day"], range(1, 32))
            months.append(entry["month"])
        self.assertEqual(months, sorted(months))
        # Preferred name Charlie is stored as Charles on the birthday list.
        shown = []
        for quorum in self.doc["classes"]:
            for name in self.youth_in(quorum):
                first = name.split()[0]
                shown.append("Charles" if first == "Charlie" else first)
        self.assertEqual(sorted(shown), sorted(entry["name"] for entry in self.birthdays))
        graysons = [(b["month"], b["day"]) for b in self.birthdays if b["name"] == "Grayson"]
        self.assertEqual(graysons, [(5, 17), (9, 12)])
        self.assertFalse(any(b["month"] == 5 and b["day"] == 13 for b in self.birthdays))

    def test_no_years_ages_or_contact_info(self):
        for name in ("data/ym-quorums.json", "data/ym-birthdays.json"):
            text = (ROOT / name).read_text(encoding="utf-8")
            self.assertIsNone(EMAIL.search(text), name)
            self.assertIsNone(PHONE.search(text), name)
            self.assertIsNone(YEAR.search(text), name)
        banned = {"age", "phone", "email", "address", "birthyear", "birth_year", "lastname", "last_name"}

        def walk(value, where):
            if isinstance(value, dict):
                for key, item in value.items():
                    self.assertNotIn(str(key).lower(), banned, where)
                    walk(item, where)
            elif isinstance(value, list):
                for item in value:
                    walk(item, where)

        walk(self.doc, "ym-quorums")
        walk(self.birthdays, "ym-birthdays")

    def test_readme_matches_young_women_privacy_wording(self):
        note = self.doc["_readme"]
        self.assertIn("NO phone numbers or other personal info for youth.", note)
        self.assertIn("YOUTH: FIRST NAMES ONLY; you may store a last initial", note)
        self.assertIn("The page shows the initial only when two young men's first names are alike", note)
        self.assertIn("otherwise it shows the first name alone.", note)
        self.assertIn("not in the presidency", note)

    def test_page_matches_the_young_women_birthday_section(self):
        self.assertIn("Happy Birthday This Month", self.page)
        self.assertIn("No Young Men birthdays this month.", self.page)
        self.assertIn('fetch("../../data/ym-birthdays.json"', self.page)
        self.assertIn("Quorum Members", self.script)
        self.assertIn("function youth(", self.script)
        self.assertIn("data-ymcal", self.script)
        self.assertIn('id="ym-cal"', self.page)
        self.assertIn('id="youth-program"', self.page)
        self.assertIn("activities.js?v=20261110", self.page)
        nov = [b for b in self.birthdays if b["month"] == 11]
        self.assertEqual([(b["name"], b["day"]) for b in nov], [
            ("Wyatt", 2), ("Henry", 8), ("Costin", 9), ("Kamden", 14),
        ])

    def test_unread_dot_includes_roster_and_birthdays(self):
        spec = next(item for item in build.SECTIONS if item["id"] == "young-men")
        self.assertEqual(spec["files"], ["data/ym-birthdays.json", "data/ym-quorums.json", "data/ym-activities.json"])
        blobs, paths = build.section_blobs(build.ROOT, spec, build.calendar_events(build.ROOT))
        names = [name for name, _data in blobs]
        self.assertIn("data/ym-birthdays.json", names)
        self.assertIn("data/ym-quorums.json", names)
        self.assertIn("data/ym-activities.json", names)
        self.assertIn("orgs/young-men/index.html", names)
        self.assertIn("orgs/young-men/quorums.js", names)
        self.assertIn("data/ym-birthdays.json", paths)
        # Someone who already opened Young Men still gets a dot when this roster lands.
        previous = "19293554cc6c17fd08d52bd959ea2fce83851e93f3ec00c327312e7e219006cf"
        manifest = load("data/section-updates.json")
        current = manifest["sections"]["young-men"]["hash"]
        self.assertNotEqual(current, previous)
        self.assertEqual(current, build.build_manifest(ROOT)["sections"]["young-men"]["hash"])
        probe = r"""
const seen = require("./section-seen.js");
const fs = require("fs");
const manifest = JSON.parse(fs.readFileSync("data/section-updates.json", "utf8"));
const previous = process.argv[1];
const stored = { init: true, seen: { "young-men": previous } };
const now = Date.parse(manifest.sections["young-men"].updated);
const result = seen.apply(manifest, stored, now, null, manifest.windowDays);
if (!result.unread["young-men"]) process.exit(2);
const opened = seen.apply(manifest, result.stored, now, "young-men", manifest.windowDays);
if (opened.unread["young-men"]) process.exit(3);
"""
        run = subprocess.run(
            ["node", "-e", probe, previous],
            cwd=ROOT, check=False, capture_output=True, text=True,
        )
        self.assertEqual(run.returncode, 0, run.stderr or run.stdout)


if __name__ == "__main__":
    unittest.main()
