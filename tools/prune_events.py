#!/usr/bin/env python3
"""Delete event flyers the calendar day after they end, in America/Denver.

An item's last day is its endDate when that is YYYY-MM-DD, otherwise its date.
Hardcoded cards use the America/Denver calendar date of data-end / events.json
"end". The item is removed when last_day < today, so it stays through the
ending day and is gone the next morning.

Writes nothing when nothing is expired. Flyer images and PDFs under
events/flyers/ are deleted only when no HTML or JSON file still names them.

  python3 tools/prune_events.py
  python3 tools/prune_events.py --dry-run
  python3 tools/prune_events.py --today 2026-11-10
"""
import argparse
import json
import re
import sys
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

DENVER = ZoneInfo("America/Denver")
YMD = re.compile(r"^\d{4}-\d{2}-\d{2}$")
ARTICLE_RE = re.compile(
    r"[ \t]*<article\b([^>]*)>.*?</article>[ \t]*\r?\n?",
    re.DOTALL,
)
FLYER_SUFFIXES = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".svg"}
# Class and quorum lists use the same date fields as announcements and already
# hide past rows in the browser. Deleting the rows lets the flyer file go too.
JSON_LISTS = (
    ("events/events.json", "events", "event"),
    ("data/approved-announcements.json", "announcements", "announcement"),
    ("data/yw-classes.json", "activities", "activity"),
    ("data/ym-quorums.json", "activities", "activity"),
    ("data/primary-classes.json", "activities", "activity"),
)


def denver_today(now=None):
    if now is None:
        now = datetime.now(DENVER)
    elif now.tzinfo is None:
        now = now.replace(tzinfo=DENVER)
    else:
        now = now.astimezone(DENVER)
    return now.date()


def instant_last_day(value):
    """Calendar date of an ISO timestamp in America/Denver."""
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=DENVER)
    return parsed.astimezone(DENVER).date()


def still_current_instant(end, today):
    """True when a hardcoded card's ending day is today or later, or unknown."""
    if not isinstance(end, str) or not end.strip():
        return True
    try:
        return instant_last_day(end) >= today
    except ValueError:
        return True


def ymd_last_day(item):
    """endDate if it is YYYY-MM-DD, otherwise date. None when neither is usable."""
    if not isinstance(item, dict):
        return None
    end = item.get("endDate")
    if isinstance(end, str) and YMD.fullmatch(end):
        return date.fromisoformat(end)
    start = item.get("date")
    if isinstance(start, str) and YMD.fullmatch(start):
        return date.fromisoformat(start)
    return None


def attr(attrs, name):
    match = re.search(rf'\b{name}\s*=\s*"([^"]*)"', attrs)
    if match:
        return match.group(1)
    match = re.search(rf"\b{name}\s*=\s*'([^']*)'", attrs)
    return match.group(1) if match else None


def article_label(html):
    match = re.search(r"<b>(.*?)</b>", html, re.DOTALL)
    if not match:
        return "event"
    text = re.sub(r"\s+", " ", match.group(1)).strip()
    return text or "event"


def item_label(item):
    if isinstance(item, dict):
        for key in ("title", "id"):
            value = item.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return "event"


def prune_html(text, today):
    labels = []

    def replace(match):
        attrs = match.group(1)
        classes = attr(attrs, "class")
        if classes is None or "ev" not in classes.split():
            return match.group(0)
        end = attr(attrs, "data-end")
        if not still_current_instant(end, today) and isinstance(end, str) and end.strip():
            try:
                instant_last_day(end)
            except ValueError:
                return match.group(0)
            labels.append(article_label(match.group(0)))
            return ""
        return match.group(0)

    return ARTICLE_RE.sub(replace, text), labels


def dumps_like(original, data):
    """Rewrite JSON with the file's existing escaping so an unchanged list is stable."""
    ensure_ascii = "\\u" in original
    dumped = json.dumps(data, indent=2, ensure_ascii=ensure_ascii) + "\n"
    if "\r\n" in original:
        dumped = dumped.replace("\n", "\r\n")
    return dumped


def prune_json_list(text, key, today, kind):
    data = json.loads(text)
    items = data.get(key) if isinstance(data, dict) else None
    if not isinstance(items, list):
        return text, []
    kept = []
    labels = []
    for item in items:
        if kind == "event":
            expired = isinstance(item, dict) and not still_current_instant(item.get("end"), today) and isinstance(item.get("end"), str) and item.get("end").strip()
            if expired:
                try:
                    instant_last_day(item.get("end"))
                except ValueError:
                    expired = False
        else:
            last = ymd_last_day(item)
            expired = last is not None and last < today
        if expired:
            labels.append(item_label(item))
        else:
            kept.append(item)
    if not labels:
        return text, []
    data[key] = kept
    return dumps_like(text, data), labels


def html_targets(root):
    paths = []
    events = root / "events" / "index.html"
    if events.is_file():
        paths.append(events)
    orgs = root / "orgs"
    if orgs.is_dir():
        for child in sorted(orgs.iterdir()):
            page = child / "index.html"
            if child.is_dir() and page.is_file():
                paths.append(page)
    return paths


def rel(root, path):
    return path.resolve().relative_to(root.resolve()).as_posix()


def reference_corpus(root, replacements):
    parts = []
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in {".html", ".json"}:
            continue
        text = replacements.get(path)
        if text is None:
            text = path.read_text(encoding="utf-8")
        parts.append(text)
    return "\n".join(parts)


def prune(root, today=None, dry_run=False):
    """Return (relative path, label) pairs for everything that expired.

    Files are left untouched when the list is empty, and a second run removes
    nothing. dry_run reports the same pairs without writing.
    """
    root = Path(root)
    today = denver_today() if today is None else today
    if isinstance(today, str):
        today = date.fromisoformat(today)
    removed = []
    replacements = {}

    for path in html_targets(root):
        original = path.read_text(encoding="utf-8")
        updated, labels = prune_html(original, today)
        if updated != original:
            replacements[path] = updated
            removed.extend((rel(root, path), label) for label in labels)

    for relpath, key, kind in JSON_LISTS:
        path = root / relpath
        if not path.is_file():
            continue
        original = path.read_text(encoding="utf-8")
        updated, labels = prune_json_list(original, key, today, kind)
        if updated != original:
            replacements[path] = updated
            removed.extend((relpath, label) for label in labels)

    corpus = reference_corpus(root, replacements)
    flyer_dir = root / "events" / "flyers"
    deletes = []
    if flyer_dir.is_dir():
        for path in sorted(flyer_dir.rglob("*")):
            if not path.is_file() or path.suffix.lower() not in FLYER_SUFFIXES:
                continue
            if path.name not in corpus:
                deletes.append(path)
                removed.append((rel(root, path), path.name))

    if not dry_run:
        for path, text in replacements.items():
            path.write_text(text, encoding="utf-8")
        for path in deletes:
            path.unlink()
    return removed


def main(argv=None):
    parser = argparse.ArgumentParser(description="Delete events whose last day is before today in America/Denver.")
    parser.add_argument("--root", default=None, help="Repository root (default: this repo)")
    parser.add_argument("--today", default=None, help="Compare against this YYYY-MM-DD instead of today in America/Denver")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be removed without writing")
    args = parser.parse_args(argv)
    root = Path(args.root) if args.root else Path(__file__).resolve().parents[1]
    if args.today:
        try:
            today = date.fromisoformat(args.today)
        except ValueError:
            print("today must be YYYY-MM-DD", file=sys.stderr)
            return 2
    else:
        today = denver_today()
    try:
        removed = prune(root, today=today, dry_run=args.dry_run)
    except (OSError, json.JSONDecodeError, UnicodeError) as err:
        print(f"prune failed: {err}", file=sys.stderr)
        return 1
    if not removed:
        print(f"No expired events as of {today.isoformat()} America/Denver.")
        return 0
    verb = "Would remove" if args.dry_run else "Removed"
    for path, label in removed:
        print(f"{verb} {path}: {label}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
