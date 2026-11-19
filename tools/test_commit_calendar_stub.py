#!/usr/bin/env python3
"""Stand-in for tools/build_calendar.py used by tools/test_commit_calendar.sh.

Writes deterministic calendar files and records the source URL it was given.
It must not print that URL.
"""
import os
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
marker = os.environ.get("STUB_CALENDAR_BODY", "regenerated")
url = sys.argv[1] if len(sys.argv) > 1 else ""
(root / "rebuild-url.txt").write_text(url, encoding="utf-8")
(root / "data").mkdir(exist_ok=True)
(root / "calendar" / "feeds").mkdir(parents=True, exist_ok=True)
(root / "data" / "calendar.json").write_text(
    '{\n "generated": "rebuilt",\n "events": ["%s"]\n}\n' % marker,
    encoding="utf-8",
)
(root / "calendar" / "ward.ics").write_text(
    "DTSTAMP:REBUILT\nSUMMARY:%s\n" % marker,
    encoding="utf-8",
)
(root / "calendar" / "feeds" / "all.ics").write_text(
    "DTSTAMP:REBUILT\nSUMMARY:%s\n" % marker,
    encoding="utf-8",
)
