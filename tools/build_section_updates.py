#!/usr/bin/env python3
"""Write data/section-updates.json, a per-section content version for Hub unread dots.

A section is "changed" when the SHA-256 of its visitor-facing bytes changes.
Those bytes are the section's pages, images, and data files, plus:

- the home-page This Sunday banner (the <!--TS--> block in index.html only)
- Bay 6 Calendar events, ignoring the sync timestamp and ICS DTSTAMP lines
- the org's own Church-calendar events (Young Women, Young Men, and so on)
- approved announcements shown on Upcoming Events

The "updated" time is the newest git commit that actually changed those bytes.
When the hash is unchanged, the previous time is kept, so a shallow checkout
cannot erase history. Run:

    python3 tools/build_section_updates.py          # rewrite the manifest
    python3 tools/build_section_updates.py --check  # exit 1 if it would change

GitHub Actions runs this on every push to main (see
.github/workflows/section-updates.yml), so the manifest stays current without
hand edits.
"""
import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "data" / "section-updates.json"
WINDOW_DAYS = 7
TS_RE = re.compile(r"<!--TS-->.*?<!--/TS-->", re.S)
SKIP_DIRS = {"apps-script", "migrations", "__pycache__"}
SKIP_NAMES = {"DEPLOY.txt", ".DS_Store"}

# Hub order. "calendars" is a set of Church calendar names whose events are part
# of that section. "*" means every event (the Bay 6 Calendar tile).
SECTIONS = [
    {"id": "this-sunday", "title": "This Sunday", "path": "this-sunday/", "roots": ["this-sunday"], "ts": True},
    {"id": "meet", "title": "Meet With The Bishop", "path": "meet/", "roots": ["meet"]},
    {"id": "calendar", "title": "Bay 6 Calendar", "path": "calendar/", "roots": ["calendar"], "calendars": "*"},
    {"id": "events", "title": "Upcoming Events", "path": "events/", "roots": ["events"], "announcements": True},
    {"id": "announce", "title": "Submit An Announcement", "path": "announce/", "roots": ["announce"]},
    {"id": "color", "title": "Crayons & Covenants", "path": "color/", "roots": ["color"]},
    {"id": "relief-society", "title": "Relief Society", "path": "orgs/relief-society/", "roots": ["orgs/relief-society"], "calendars": ["Relief Society"]},
    {"id": "elders-quorum", "title": "Elders Quorum", "path": "orgs/elders-quorum/", "roots": ["orgs/elders-quorum"], "calendars": ["Elders Quorum"]},
    {"id": "young-women", "title": "Young Women", "path": "orgs/young-women/", "roots": ["orgs/young-women"], "files": ["data/yw-birthdays.json", "data/yw-classes.json"], "calendars": ["Young Women"]},
    {"id": "young-men", "title": "Young Men", "path": "orgs/young-men/", "roots": ["orgs/young-men"], "files": ["data/ym-quorums.json"], "calendars": ["Young Men"]},
    {"id": "sunday-school", "title": "Sunday School", "path": "orgs/sunday-school/", "roots": ["orgs/sunday-school"]},
    {"id": "primary", "title": "Primary", "path": "orgs/primary/", "roots": ["orgs/primary"], "files": ["data/primary-birthdays.json", "data/primary-classes.json"], "calendars": ["Primary"]},
    {"id": "temple-and-family-history", "title": "Temple And Family History", "path": "orgs/temple-and-family-history/", "roots": ["orgs/temple-and-family-history"]},
    {"id": "ward-missionaries", "title": "Ward Missionaries", "path": "orgs/ward-missionaries/", "roots": ["orgs/ward-missionaries"]},
    {"id": "missionaries", "title": "Our Ward Missionaries", "path": "missionaries/", "roots": ["missionaries"]},
]


def to_z(dt):
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def file_bytes(path):
    data = path.read_bytes()
    if path.suffix.lower() == ".ics":
        text = data.decode("utf-8", "surrogateescape")
        text = re.sub(r"(?m)^DTSTAMP:[^\n]*\n?", "", text)
        return text.encode("utf-8", "surrogateescape")
    return data


def iter_files(root, rel):
    base = root / rel
    if not base.is_dir():
        return
    for path in base.rglob("*"):
        if not path.is_file():
            continue
        parts = path.relative_to(base).parts
        if any(part in SKIP_DIRS for part in parts):
            continue
        if path.name in SKIP_NAMES or path.suffix == ".pyc" or path.name.endswith(".md") or path.name.endswith(".test.js"):
            continue
        yield path


def load_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def calendar_events(root):
    data = load_json(root / "data" / "calendar.json")
    if not isinstance(data, dict):
        return None
    events = data.get("events")
    return events if isinstance(events, list) else []


def events_blob(events, names):
    if names == "*":
        chosen = list(events)
    else:
        chosen = [event for event in events if event.get("calendar") in names]
    return json.dumps(chosen, sort_keys=True, separators=(",", ":")).encode("utf-8")


def announcements_blob(root):
    data = load_json(root / "data" / "approved-announcements.json")
    if not isinstance(data, dict) or not isinstance(data.get("announcements"), list):
        return None
    return json.dumps(data["announcements"], sort_keys=True, separators=(",", ":")).encode("utf-8")


def ts_bytes_from(text):
    if not text:
        return None
    match = TS_RE.search(text)
    return match.group(0).encode("utf-8") if match else None


def section_blobs(root, spec, events):
    """Return (blobs, git_paths). blobs are (name, bytes) pairs that define the hash."""
    blobs = []
    git_paths = []
    for rel in spec.get("roots") or []:
        for path in iter_files(root, rel):
            name = path.relative_to(root).as_posix()
            blobs.append((name, file_bytes(path)))
            git_paths.append(name)
    for rel in spec.get("files") or []:
        path = root / rel
        if path.is_file():
            blobs.append((rel, file_bytes(path)))
            git_paths.append(rel)
    names = spec.get("calendars")
    if names and events is not None:
        label = "all" if names == "*" else ",".join(names)
        blobs.append((f"data/calendar.json#{label}", events_blob(events, names)))
    if spec.get("announcements"):
        payload = announcements_blob(root)
        if payload is not None:
            blobs.append(("data/approved-announcements.json#announcements", payload))
    if spec.get("ts"):
        index = root / "index.html"
        if index.is_file():
            payload = ts_bytes_from(index.read_text(encoding="utf-8", errors="surrogateescape"))
            if payload is not None:
                blobs.append(("index.html#this-sunday", payload))
    return blobs, git_paths


def hash_blobs(blobs):
    digest = hashlib.sha256()
    for name, data in sorted(blobs, key=lambda item: item[0]):
        digest.update(name.encode("utf-8"))
        digest.update(b"\0")
        digest.update(str(len(data)).encode("ascii"))
        digest.update(b"\0")
        digest.update(data)
        digest.update(b"\0")
    return digest.hexdigest()


_SHOW_CACHE = {}


def git_show(root, rev, rel):
    key = (str(root), rev, rel)
    if key in _SHOW_CACHE:
        return _SHOW_CACHE[key]
    try:
        out = subprocess.run(
            ["git", "-C", str(root), "show", f"{rev}:{rel}"],
            check=False, capture_output=True,
        )
    except OSError:
        _SHOW_CACHE[key] = None
        return None
    text = out.stdout.decode("utf-8", "surrogateescape") if out.returncode == 0 else None
    _SHOW_CACHE[key] = text
    return text


def git_log_date(root, paths):
    paths = list(dict.fromkeys(paths))
    if not paths:
        return None
    try:
        out = subprocess.run(
            ["git", "-C", str(root), "log", "-1", "--format=%cI", "--", *paths],
            check=False, capture_output=True, text=True,
        )
    except OSError:
        return None
    if out.returncode != 0:
        return None
    return parse_iso(out.stdout.strip())


def newest_text_change(root, rel, extract):
    """Commit time of the newest edit where extract(file text) changed.

    extract(None) is None. An empty extracted value appearing from a missing
    parent is not a change (no events before the file existed, and none after).
    """
    try:
        out = subprocess.run(
            ["git", "-C", str(root), "log", "--format=%H%x09%cI", "--", rel],
            check=False, capture_output=True, text=True,
        )
    except OSError:
        return None
    if out.returncode != 0 or not out.stdout.strip():
        return None
    for line in out.stdout.splitlines():
        commit, _, date = line.partition("\t")
        current = extract(git_show(root, commit, rel))
        parent_text = git_show(root, commit + "^", rel)
        parent = extract(parent_text) if parent_text is not None else None
        if current == parent:
            continue
        if parent is None and current in (None, b"[]"):
            continue
        return parse_iso(date)
    return None


def newest_ts_change(root):
    """Commit time of the newest index.html edit that changed the This Sunday banner."""
    if not (root / ".git").exists() and not (root / "index.html").is_file():
        return None
    return newest_text_change(root, "index.html", lambda text: ts_bytes_from(text or ""))


def extract_calendar(names):
    def extract(text):
        if not text:
            return None
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            return None
        events = data.get("events") if isinstance(data, dict) else None
        if not isinstance(events, list):
            return None
        return events_blob(events, names)
    return extract


def extract_announcements(text):
    if not text:
        return None
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict) or not isinstance(data.get("announcements"), list):
        return None
    return json.dumps(data["announcements"], sort_keys=True, separators=(",", ":")).encode("utf-8")


def pick_updated(prev, new_hash, candidates, now):
    if prev and prev.get("hash") == new_hash and prev.get("updated"):
        return prev["updated"]
    dates = [item for item in candidates if item is not None]
    if not dates:
        return to_z(now)
    best = max(dates)
    prev_dt = parse_iso(prev.get("updated")) if prev else None
    if prev_dt and best < prev_dt:
        # The hash moved, but git still points at an older commit (a shared file
        # whose own date did not). The change is this build.
        return to_z(now)
    return to_z(best)


def load_prev(root):
    data = load_json(root / "data" / "section-updates.json")
    if not isinstance(data, dict):
        return {}
    sections = data.get("sections")
    return sections if isinstance(sections, dict) else {}


def build_manifest(root, prev=None, now=None, sections=None):
    now = now or datetime.now(timezone.utc)
    prev = prev if prev is not None else load_prev(root)
    specs = sections if sections is not None else SECTIONS
    events = calendar_events(root)
    ts_date = newest_ts_change(root) if any(spec.get("ts") for spec in specs) else None
    announcements_date = newest_text_change(root, "data/approved-announcements.json", extract_announcements) if any(spec.get("announcements") for spec in specs) else None
    slice_dates = {}
    for spec in specs:
        names = spec.get("calendars")
        if not names:
            continue
        key = "*" if names == "*" else tuple(names)
        if key in slice_dates:
            continue
        slice_dates[key] = newest_text_change(root, "data/calendar.json", extract_calendar(names))
    out = {}
    for spec in specs:
        blobs, git_paths = section_blobs(root, spec, events)
        new_hash = hash_blobs(blobs)
        candidates = [git_log_date(root, git_paths)]
        if spec.get("ts"):
            candidates.append(ts_date)
        if spec.get("announcements"):
            candidates.append(announcements_date)
        names = spec.get("calendars")
        if names:
            key = "*" if names == "*" else tuple(names)
            candidates.append(slice_dates.get(key))
        updated = pick_updated(prev.get(spec["id"]) if isinstance(prev, dict) else None, new_hash, candidates, now)
        out[spec["id"]] = {
            "title": spec["title"],
            "path": spec["path"],
            "hash": new_hash,
            "updated": updated,
        }
    return {
        "note": "Generated by tools/build_section_updates.py. Do not edit by hand.",
        "windowDays": WINDOW_DAYS,
        "sections": out,
    }


def render(doc):
    return json.dumps(doc, indent=2, ensure_ascii=False) + "\n"


def main(argv):
    check = "--check" in argv
    text = render(build_manifest(ROOT))
    if check:
        current = DEST.read_text(encoding="utf-8") if DEST.exists() else ""
        if current != text:
            print("data/section-updates.json is out of date. Run python3 tools/build_section_updates.py", file=sys.stderr)
            return 1
        print("section manifest is current")
        return 0
    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(text, encoding="utf-8")
    print(f"wrote {DEST.relative_to(ROOT)} ({len(json.loads(text)['sections'])} sections)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
