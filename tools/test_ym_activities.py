#!/usr/bin/env python3
"""Young Men sheet dates, privacy, and quorum filtering. Run: python3 tools/test_ym_activities.py"""
import json
import unittest
from datetime import date
from pathlib import Path

import ym_activities as ym

ROOT = Path(__file__).resolve().parents[1]
SHEET = """Activity Date,Time,Location,Coordinators (YM/Advisor),Category,Activity Description,Activity Date,Time,Location,Coordinators (YM/Advisor),Category,Activity Description,Activity Date,Time,Location,Coordinators (YM/Advisor),Category,Activity Description
1/28/2026,7:00:00 PM,Daily's Barn,Alex and Jordan,Social,Nerf Gun Black Light,1/21/26,7:00 PM,,Sam,,Winter Lodge,Jan 29,7:00 PM,Church,"Pat, Quinn",Physical,Basketball 6:30pm
2/4/2026,7:00:00 PM,TBD,Alex and Jordan,Intellectual,Combined Deacons Gameshow,2/4/26,7:00 PM,,Sam,,Combined YM Deacons,Feb 4,7:00 PM,Church,,,Combined YM:
5/27/2026,7:00:00 PM,Christensen's,Wes,Intellectual,Backpacking Preparation,,,,,
11/25/2026,7:00:00 PM,No Activity - Thanksgiving,,,Note,11/25/2026,,Off,,,,Nov 25,7:00 PM,,THANKSGIVING,,NO ACTIVITY
12/30/2026,7:00:00 PM,No Activity,,,,,,12/30/2026,,,,,,Dec 30,7:00 PM,,NEW YEAR'S,,NO ACTIVITY
1/6/2027,7:00:00 PM,Winter Camp,Alex,Physical,,1/6/2026,,Glow in the Dark Vball,Jordan,,Combined YM,Jan 7,,,,,Basketball
"""


class DateNormalizationTests(unittest.TestCase):
    def setUp(self):
        self.result = ym.parse_sheet(SHEET)
        self.events = self.result["events"]

    def by_date(self, day):
        return [event for event in self.events if event["date"] == day]

    def test_explicit_2026_date_stays(self):
        lodge = self.by_date("2026-01-21")
        self.assertEqual(len(lodge), 1)
        self.assertEqual(lodge[0]["quorums"], ["teachers-quorum"])
        self.assertEqual(lodge[0]["title"], "Winter Lodge")

    def test_priests_month_day_keeps_its_own_date(self):
        # The row's Deacons date is Jan 28. Priests wrote Jan 29 and stay there.
        priests = [event for event in self.events if event["date"] == "2026-01-29"]
        self.assertEqual(len(priests), 1)
        self.assertIn("priests-quorum", priests[0]["quorums"])
        self.assertNotIn("deacons-quorum", priests[0]["quorums"])
        self.assertEqual(priests[0]["time"], "6:30 PM")

    def test_year_typo_beside_2027_row_becomes_2027(self):
        fixed = [item for item in self.result["corrections"] if item["from"] == "1/6/2026"]
        self.assertEqual(fixed[0]["to"], "2027-01-06")
        self.assertEqual(fixed[0]["quorum"], "teachers-quorum")
        glow = [event for event in self.events if "Glow" in event["title"] or "Volleyball" in event["title"]]
        self.assertTrue(any(event["date"] == "2027-01-06" for event in glow))
        self.assertFalse(any(event["date"] == "2026-01-06" for event in self.events))

    def test_priests_january_after_december_is_2027(self):
        basketball = [event for event in self.events if event["date"] == "2027-01-07"]
        self.assertEqual(len(basketball), 1)
        self.assertEqual(basketball[0]["quorums"], ["priests-quorum"])
        self.assertEqual(basketball[0]["title"], "Basketball")

    def test_combined_night_is_one_event(self):
        combined = self.by_date("2026-02-04")
        self.assertEqual(len(combined), 1)
        self.assertEqual(combined[0]["quorums"], list(ym.ALL_QUORUMS))
        self.assertEqual(combined[0]["combined"], "ym")
        self.assertIn("Gameshow", combined[0]["title"])

    def test_holiday_no_activity_is_one_event(self):
        day = self.by_date("2026-11-25")
        self.assertEqual(len(day), 1)
        self.assertEqual(day[0]["status"], "holiday")
        self.assertIn("Thanksgiving", day[0]["title"])
        self.assertEqual(day[0]["quorums"], list(ym.ALL_QUORUMS))


class PrivacyTests(unittest.TestCase):
    def setUp(self):
        self.events = ym.parse_sheet(SHEET)["events"]
        self.blob = json.dumps(self.events)

    def test_coordinators_and_homes_are_not_published(self):
        for secret in ("Alex", "Jordan", "Sam", "Pat", "Quinn", "Wes", "Daily", "Christensen", "Barn", "House"):
            self.assertNotIn(secret, self.blob)
        self.assertNotIn("phone", self.blob.lower())
        homes = [event for event in self.events if event["location"] == ym.HOME_LOCATION]
        self.assertGreaterEqual(len(homes), 2)
        self.assertIn("Nerf Gun Black Light", self.blob)
        self.assertIn("Backpacking Preparation", self.blob)

    def test_published_file_has_no_home_nicknames(self):
        text = (ROOT / "data" / "ym-activities.json").read_text(encoding="utf-8")
        for secret in ("Ian's", "Hiller", "Christensen", "Haun", "Daily's", "Loves", "Beth Jung", "Jenkins", "Hyatt"):
            self.assertNotIn(secret, text)
        events = json.dumps(json.loads(text)["events"])
        self.assertNotIn("Coordinator", events)
        self.assertNotRegex(events, r"\b\d{3}[-.)]\d{3}[-.]\d{4}\b")


class FilterTests(unittest.TestCase):
    def setUp(self):
        self.events = ym.parse_sheet(SHEET)["events"]

    def test_filter_hides_past_and_other_quorums(self):
        deacons = ym.filter_events(self.events, "deacons-quorum", "2026-11-10")
        self.assertTrue(all("deacons-quorum" in event["quorums"] for event in deacons))
        self.assertTrue(all(event["date"] >= "2026-11-10" for event in deacons))
        self.assertFalse(any(event["date"] == "2026-01-28" for event in deacons))
        priests = ym.filter_events(self.events, "priests-quorum", "2027-01-01")
        self.assertTrue(any(event["date"] == "2027-01-07" for event in priests))
        self.assertFalse(any(event["date"] == "2026-01-21" for event in priests))

    def test_all_filter_does_not_repeat_a_combined_night(self):
        upcoming = ym.filter_events(self.events, "all", "2026-02-01")
        feb4 = [event for event in upcoming if event["date"] == "2026-02-04"]
        self.assertEqual(len(feb4), 1)

    def test_highlight_labels_this_wednesday(self):
        event = {"date": "2026-11-11"}
        self.assertEqual(ym.highlight_label(event, "2026-11-10"), "This Wednesday")
        self.assertEqual(ym.highlight_label({"date": "2026-11-18"}, "2026-11-12"), "Next Wednesday")
        self.assertEqual(ym.highlight_label({"date": "2026-11-14"}, "2026-11-10"), "Up Next")
        self.assertEqual(ym.week_start("2026-11-11"), "2026-11-08")


class CalendarFeedTests(unittest.TestCase):
    def test_ics_matches_json_and_validates(self):
        document = json.loads((ROOT / "data" / "ym-activities.json").read_text(encoding="utf-8"))
        text = ym.to_ics(document["events"])
        self.assertEqual(ym.validate_ics(text), [])
        saved = (ROOT / "orgs" / "young-men" / "activities.ics").read_bytes().decode("utf-8")
        self.assertEqual(ym.validate_ics(saved), [])
        self.assertEqual(saved.count("BEGIN:VEVENT"), len(document["events"]))

    def test_sheet_merges_into_church_calendar_without_duplicating(self):
        church = [{
            "id": "church1",
            "title": "Deacons: Engineering Challenge",
            "calendar": "Young Men",
            "location": "",
            "allDay": False,
            "start": "2026-11-11T19:00:00-07:00",
            "end": "2026-11-11T20:00:00-07:00",
        }]
        sheet = [{
            "id": "ym-2026-11-11-engineering-challenge",
            "title": "Engineering Challenge",
            "date": "2026-11-11",
            "endDate": "",
            "quorums": ["deacons-quorum"],
            "combined": "",
            "status": "activity",
            "location": "To Be Determined",
            "allDay": False,
            "start": "2026-11-11T19:00:00-07:00",
            "end": "2026-11-11T20:00:00-07:00",
        }, {
            "id": "ym-2026-11-11-volleyball",
            "title": "Volleyball",
            "date": "2026-11-11",
            "endDate": "",
            "quorums": ["teachers-quorum"],
            "combined": "",
            "status": "activity",
            "location": "To Be Determined",
            "allDay": False,
            "start": "2026-11-11T19:00:00-07:00",
            "end": "2026-11-11T20:00:00-07:00",
        }, {
            "id": "ym-tbd",
            "title": "To Be Determined",
            "date": "2026-11-18",
            "endDate": "",
            "quorums": ["deacons-quorum"],
            "combined": "",
            "status": "tbd",
            "location": "To Be Determined",
            "allDay": False,
            "start": "2026-11-18T19:00:00-07:00",
            "end": "2026-11-18T20:00:00-07:00",
        }]
        merged = ym.merge_calendar(church, sheet)
        titles = [event["title"] for event in merged]
        self.assertIn("Deacons: Engineering Challenge", titles)
        self.assertNotIn("Engineering Challenge", titles)
        self.assertIn("Teachers: Volleyball", titles)
        self.assertNotIn("To Be Determined", titles)
        self.assertEqual(church[0].get("ymQuorum") or merged[0].get("ymQuorum"), "deacons-quorum")


class RealSheetShapeTests(unittest.TestCase):
    def test_every_event_is_ready_to_show(self):
        document = json.loads((ROOT / "data" / "ym-activities.json").read_text(encoding="utf-8"))
        ids = set()
        for event in document["events"]:
            self.assertNotIn(event["id"], ids)
            ids.add(event["id"])
            date.fromisoformat(event["date"])
            self.assertIn(event["status"], {"activity", "tbd", "none", "holiday"})
            self.assertTrue(event["quorums"])
            self.assertTrue(set(event["quorums"]) <= set(ym.QUORUMS))
            if event["combined"]:
                self.assertGreaterEqual(len(event["quorums"]), 2)


if __name__ == "__main__":
    unittest.main()
