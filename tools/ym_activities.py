#!/usr/bin/env python3
"""Young Men activity calendar.

The leaders' sheet (tab "YM Activities Calendar 2026") is the source.
This writes data/ym-activities.json and orgs/young-men/activities.ics.

    python3 tools/ym_activities.py path/to/sheet.txt
    python3 tools/ym_activities.py --ics          # rebuild the .ics from the JSON

Privacy: coordinator names, youth names, phone numbers, and home addresses
never land in the JSON or the .ics. A home ("Ian's House", "Hiller's") becomes
"Member Home (details from leaders)".

Dates: explicit dates are trusted. A 2026 date on a row whose other quorum has
the same month and day in 2027 is treated as a year typo. Priests dates written
as "Mon D" stay on that day; the year rolls forward only when their own column
goes backward (December, then January).
"""
import csv
import io
import json
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
JSON_PATH = ROOT / "data" / "ym-activities.json"
ICS_PATH = ROOT / "orgs" / "young-men" / "activities.ics"
MT = ZoneInfo("America/Denver")
UTC = ZoneInfo("UTC")

QUORUMS = ("deacons-quorum", "teachers-quorum", "priests-quorum")
QUORUM_LABEL = {
    "deacons-quorum": "Deacons",
    "teachers-quorum": "Teachers",
    "priests-quorum": "Priests",
}
ALL_QUORUMS = list(QUORUMS)
HOME_LOCATION = "Member Home (details from leaders)"
TBD = "To Be Determined"
CHURCH = "Ward Meetinghouse, 549 S 1525 W, Farmington"

MONTHS = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
    "aug": 8, "august": 8, "sep": 9, "sept": 9, "september": 9, "oct": 10,
    "october": 10, "nov": 11, "november": 11, "dec": 12, "december": 12,
}
WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
CATS = {"social": "Social", "intellectual": "Intellectual", "physical": "Physical", "spiritual": "Spiritual"}
STOP_TOKENS = {
    "combined", "young", "men", "women", "deacons", "deacon", "teachers", "teacher",
    "priests", "priest", "the", "and", "for", "of", "all", "with", "our", "this", "week",
    "night", "project",
}
HOME_RE = re.compile(
    r"\b(?:house|barn)\b|\bhome\b|christensen|hiller|\bloves\b|daily|haun|\bian(?:'s|s)?\b",
    re.I,
)
QUORUM_ONLY = re.compile(
    r"^(?:deacons?|teachers?|priests?|young women|young men|yw|ym|n/?a|hold|all|builders\??|gatherers|messengers|stake|unknown)$",
    re.I,
)
PHONE_RE = re.compile(r"(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}")
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")

# Longer / more specific places first.
PLACES = [
    (re.compile(r"food bank", re.I), "Utah Food Bank", "Utah Food Bank"),
    (re.compile(r"homeless", re.I), "Ogden Homeless Shelter", "Ogden Homeless Shelter"),
    (re.compile(r"church history museum|history museum", re.I), "Church History Museum", "Church History Museum, Salt Lake City UT"),
    (re.compile(r"temple square", re.I), "Temple Square", "Temple Square, Salt Lake City UT"),
    (re.compile(r"syracuse temple", re.I), "Syracuse Utah Temple", "Syracuse Utah Temple"),
    (re.compile(r"layton temple", re.I), "Layton Utah Temple", "Layton Utah Temple"),
    (re.compile(r"bountiful", re.I), "Bountiful Utah Temple", "Bountiful Utah Temple"),
    (re.compile(r"heber", re.I), "Heber Valley Camp", "Heber Valley Camp, Heber UT"),
    (re.compile(r"lyman", re.I), "Lyman Lake", "Lyman Lake"),
    (re.compile(r"willard", re.I), "Willard Bay", "Willard Bay State Park UT"),
    (re.compile(r"crystal hot", re.I), "Crystal Hot Springs", "Crystal Hot Springs, Honeyville UT"),
    (re.compile(r"station park|\blift\b", re.I), "Station Park", "Station Park, Farmington UT"),
    (re.compile(r"ranches", re.I), "Ranches Park", "Ranches Park, Farmington UT"),
    (re.compile(r"woodland", re.I), "Woodland Park", "Woodland Park, Farmington UT"),
    (re.compile(r"farmington (city )?park|park courts", re.I), "Farmington City Park", "Farmington City Park"),
    (re.compile(r"farmington pool", re.I), "Farmington Pool", "Farmington Pool, Farmington UT"),
    (re.compile(r"canyon creek", re.I), "Canyon Creek", ""),
    (re.compile(r"pavilion", re.I), "Ward Meetinghouse Pavilion", "549 S 1525 W, Farmington UT 84025"),
    (re.compile(r"\bchurch\b|meetinghouse", re.I), CHURCH, "549 S 1525 W, Farmington UT 84025"),
    (re.compile(r"neighborhood", re.I), "Ward Neighborhood", ""),
    (re.compile(r"\btemple\b", re.I), "Temple", ""),
    (re.compile(r"\bpool\b", re.I), "Pool", ""),
    (re.compile(r"\bpark\b", re.I), "Park", ""),
    (re.compile(r"\bcamp\b", re.I), "Camp", ""),
]


def clean(value):
    text = "" if value is None else str(value)
    text = text.replace("\u2019", "'").replace("\u2013", "-").replace("\u2014", "-")
    text = text.strip().strip('"').strip()
    text = re.sub(r"\s+", " ", text)
    return text


def squash(text):
    text = PHONE_RE.sub("", EMAIL_RE.sub("", text or ""))
    text = re.sub(r"\s{2,}", " ", text)
    text = re.sub(r"\s+([,.;:])", r"\1", text)
    text = re.sub(r"^[,:;.\-\s]+|[,:;.\-\s]+$", "", text)
    text = re.sub(r"\(\s*\)", "", text)
    return re.sub(r"\s{2,}", " ", text).strip(" -")


def spell(text):
    if not text:
        return ""
    if text.isupper() and re.search(r"[A-Z]", text) and len(text) > 3:
        text = text.title()
    reps = [
        (r"\bscave?n?ger\b", "Scavenger"),
        (r"\bscavanger\b", "Scavenger"),
        (r"\bpicklball\b", "Pickleball"),
        (r"\bhoe down\b", "Hoedown"),
        (r"\bvball\b", "Volleyball"),
        (r"\bflow[\s-]?rider\b", "FlowRider"),
        (r"\bym/yw\b", "Young Men and Young Women"),
        (r"\byw/ym\b", "Young Men and Young Women"),
        (r"\bym\b", "Young Men"),
        (r"\byw\b", "Young Women"),
    ]
    # Spell fixes run on a working copy. Acronyms YM/YW are expanded only when
    # they are the whole remaining token soup handled by polish_title.
    for pattern, repl in reps[:6]:
        text = re.sub(pattern, repl, text, flags=re.I)
    text = re.sub(r"\s{2,}", " ", text).strip(" -:")
    return text


def parse_date_token(text):
    """Return (month, day, end_day or None, year or None) or None."""
    raw = clean(text)
    if not raw:
        return None
    match = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{2,4})$", raw)
    if match:
        month, day, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
        if year < 100:
            year += 2000
        return (month, day, None, year)
    match = re.match(r"^([A-Za-z]+)\.?\s+(\d{1,2})(?:\s*-\s*(\d{1,2}))?(?:,?\s*(\d{4}))?$", raw)
    if match and match.group(1).lower() in MONTHS:
        end = int(match.group(3)) if match.group(3) else None
        year = int(match.group(4)) if match.group(4) else None
        return (MONTHS[match.group(1).lower()], int(match.group(2)), end, year)
    return None


def safe_date(year, month, day):
    try:
        return datetime(year, month, day).date()
    except ValueError:
        return None


def assign_missing_years(cells):
    """Fill Mon-D dates from the column's own order. A backward month bumps the year."""
    year = 2026
    prev = None
    for cell in cells:
        if cell.get("year") is not None:
            year = cell["year"]
            prev = (cell["year"], cell["month"], cell["day"])
            continue
        if prev is not None and (cell["month"], cell["day"]) < (prev[1], prev[2]) and cell["month"] < prev[1]:
            year += 1
        cell["year"] = year
        prev = (year, cell["month"], cell["day"])


def fix_year_typos(rows):
    """A 2026 month/day sitting beside the same month/day in 2027 is a typo."""
    corrections = []
    for row in rows:
        later = [cell for cell in row if cell and cell.get("year") == 2027]
        for cell in row:
            if not cell:
                continue
            if cell.get("explicit_year") != 2026 or cell.get("year") != 2026:
                continue
            for other in later:
                if other["month"] == cell["month"] and other["day"] == cell["day"] and other is not cell:
                    corrections.append({
                        "quorum": cell["quorum"],
                        "from": f"{cell['month']}/{cell['day']}/2026",
                        "to": f"2027-{cell['month']:02d}-{cell['day']:02d}",
                        "reason": "Year typed as 2026 on a 2027 row with the same month and day",
                    })
                    cell["year"] = 2027
                    cell["corrected"] = True
                    break
    return corrections


def _clock(hour, minute, ampm):
    if ampm:
        mark = ampm.upper()
        if mark == "PM" and hour < 12:
            hour += 12
        if mark == "AM" and hour == 12:
            hour = 0
        return hour, minute
    if 1 <= hour <= 7:
        return hour + 12, minute
    return hour, minute


def parse_clock(text):
    match = re.match(r"^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(AM|PM)?$", clean(text), re.I)
    if not match:
        return None
    hour, minute = _clock(int(match.group(1)), int(match.group(2) or 0), match.group(4))
    if hour > 23 or minute > 59:
        return None
    return hour, minute


def format_clock(hour, minute):
    mark = "AM" if hour < 12 else "PM"
    show = hour % 12 or 12
    return f"{show}:{minute:02d} {mark}"


def parse_time(text):
    """Return (start, end or None, label note). Bare hours before 8 are PM."""
    raw = clean(text)
    if not raw:
        return None, None, ""
    note = ""
    paren = re.search(r"\(([^)]*)\)", raw)
    main = raw
    if paren:
        note = clean(paren.group(1))
        main = clean(raw[:paren.start()] + " " + raw[paren.end():])
    start = parse_clock(main) if main else None
    leave = None
    leave_match = re.search(
        r"(?:meet|leave)\s+at\s+(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)",
        note,
        re.I,
    )
    if leave_match:
        leave = parse_clock(leave_match.group(1))
        if leave and leave[0] <= 7 and not re.search(r"AM|PM", leave_match.group(1), re.I) and start and start[0] < 12:
            leave = (leave[0], leave[1])  # already morning if start is morning
        elif leave and leave[0] < 12 and start and start[0] >= 12 and not re.search(r"AM|PM", leave_match.group(1), re.I):
            leave = (leave[0] + 12 if leave[0] <= 7 else leave[0], leave[1])
    if leave and start:
        return leave, start, note
    if leave and not start:
        return leave, None, note
    return start, None, note


def find_time_range(text):
    match = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\b", text or "", re.I)
    if not match:
        return None
    start_mark = match.group(3) or match.group(6)
    end_mark = match.group(6) or match.group(3)
    if not match.group(3) and not match.group(6):
        # "7-10" on a mutual night is evening, including an end hour of 8, 9, or 10.
        start_mark = end_mark = "PM"
    start = _clock(int(match.group(1)), int(match.group(2) or 0), start_mark)
    end = _clock(int(match.group(4)), int(match.group(5) or 0), end_mark)
    if end <= start:
        return None
    return start, end


def explicit_clocks(text):
    found = []
    for match in re.finditer(r"\b(\d{1,2})(?::(\d{2}))\s*(AM|PM)\b", text or "", re.I):
        found.append(_clock(int(match.group(1)), int(match.group(2)), match.group(3)))
    return found


GENERIC_PLACES = {"camp", "temple", "church", "park", "pool", "meetinghouse", "ward"}
ACTIVITY_WORD = re.compile(
    r"\b(walk|party|night|game|shoot|tour|lunch|service|cleanup|frisbee|basketball|challenge|race|hunt|survival|fugitive|engineering|relay|scavenger|pizza|career|kickball|trek|hoedown|fireside|planning|training|baptism|dodgeball|ultimate|pickle|swim|boating|nerf|jazz|gameshow|cooking|glow|volleyball|magazine|slip|hatchet|scripture|trade|wilderness|trunk|dutch|orbi|black|activity|campout|camp out|skills|open|lights|planning)\b",
    re.I,
)


def is_blankish(text):
    return not clean(text) or bool(re.fullmatch(r"tbd|tba|n/?a|\?+|hold|to be determined", clean(text), re.I))


def looks_like_place(text):
    raw = clean(text)
    if is_blankish(raw):
        return False
    if ACTIVITY_WORD.search(raw) or re.search(r"\bopen house\b", raw, re.I):
        return False
    if HOME_RE.search(raw) and not re.search(r"homeless|food bank|open house", raw, re.I):
        return True
    return any(pattern.search(raw) for pattern, _label, _map in PLACES)


def bare_place(text):
    words = tokens(text)
    return bool(words) and all(word in GENERIC_PLACES or word in {"utah", "valley", "city", "the"} for word in words)


def sanitize_location(text):
    raw = clean(text)
    if not raw or re.fullmatch(r"tbd|tba|\?+|n/?a|hold", raw, re.I):
        return TBD, "tbd", ""
    if HOME_RE.search(raw) and not re.search(r"homeless|food bank", raw, re.I):
        return HOME_LOCATION, "home", ""
    for pattern, label, query in PLACES:
        if pattern.search(raw):
            return label, "public", query
    if re.search(r"\d{2,5}\s+\w+", raw) and not re.search(r"549\s+S", raw, re.I):
        return HOME_LOCATION, "home", ""
    return spell(raw), "public", ""


def strip_home_words(title):
    """Drop home nicknames. Leave 'at the Pavilion' and 'at Heber Valley' alone."""
    text = title or ""
    text = re.sub(
        r"\b(?:at|@)\s+(?:christensen'?s?|hiller'?s?|loves|daily'?s?(?:\s+barn)?|haun(?:\s+home)?|ian'?s?(?:\s+house)?)\b",
        "",
        text,
        flags=re.I,
    )
    text = re.sub(r"\b(?:christensen'?s?|hiller'?s?|\bloves\b|daily'?s?|haun|ian'?s?)\b", "", text, flags=re.I)
    text = re.sub(r"\bopen house\b", "Open House", text, flags=re.I)
    text = re.sub(r"\bopen house\b", "Open House", text)  # already normalized
    protected = text.replace("Open House", "\u0000")
    protected = re.sub(r"\b(?:house|barn)\b", "", protected, flags=re.I)
    return squash(protected.replace("\u0000", "Open House"))


def scrub_coordinator_words(text, coordinator):
    cleaned = text or ""
    for token in re.findall(r"[A-Za-z][A-Za-z']{2,}", coordinator or ""):
        if token.lower() in {"and", "the", "advisor", "brother", "sister", "young", "men", "activity"}:
            continue
        if QUORUM_ONLY.match(token):
            continue
        cleaned = re.sub(rf"\b{re.escape(token)}\b", "", cleaned, flags=re.I)
    cleaned = re.sub(r"\b(?:Brother|Sister|Bro|Sis)\.?\s+[A-Z][a-z]+\b", "", cleaned)
    return squash(cleaned)


def is_cancel(text):
    raw = clean(text)
    if not raw:
        return False
    return bool(re.search(r"\bno activity\b|\bno mutual\b|^off$|^\s*off\s*$", raw, re.I))


def cancel_status(text):
    low = clean(text).lower()
    if re.search(r"thanksgiving|christmas|new year|fall break", low):
        return "holiday"
    return "none"


def polish_cancel(text):
    low = clean(text).lower()
    if "thanksgiving" in low:
        return "No Activity — Thanksgiving"
    if "christmas" in low:
        return "No Activity — Christmas"
    if "new year" in low:
        return "No Activity — New Year's"
    if "fall break" in low:
        return "No Activity — Fall Break"
    if "school" in low:
        return "No Activity — School Starts"
    rest = re.sub(r"(?i)\bno activity\b|\bno mutual\b|\boff\b|\bbecause of\b|\bdue to\b|\bno\b", " ", text or "")
    rest = squash(spell(rest))
    if rest.islower():
        rest = rest.title()
    return f"No Activity — {rest}" if rest else "No Activity"


def combined_kind(*parts):
    blob = " ".join(clean(part) for part in parts if clean(part))
    if re.search(r"ym\s*/\s*yw|yw\s*/\s*ym|young men and young women|combined youth", blob, re.I):
        return "ymyw"
    if re.search(r"\bstake\b", blob, re.I) and re.search(r"youth|\bym\b|young men", blob, re.I):
        return "stake"
    if re.search(r"\bcombined\b", blob, re.I):
        return "ym"
    return ""


def specific_words(title):
    text = spell(title or "")
    text = re.sub(r"\b(ym|yw)\b", " ", text, flags=re.I)
    text = re.sub(
        r"\b(combined|young men|young women|deacons|teachers|priests|activity|all)\b",
        " ",
        text,
        flags=re.I,
    )
    text = re.sub(r"[:/\-]+", " ", text)
    text = re.sub(r"\b(on\s+)?\d{1,2}/\d{1,2}(/\d{2,4})?\b", " ", text)
    text = re.sub(r"\bthis week\b", " ", text, flags=re.I)
    return squash(text)


def polish_title(title, kind, status, blob):
    if status in {"holiday", "none"}:
        return polish_cancel(blob or title)
    title = spell(strip_home_words(title))
    title = title.replace('"', "").replace("?", "")
    title = re.sub(r"\bwith\s+[A-Z][a-z]+\b", "", title)
    title = re.sub(r"\b\d{1,2}(?::\d{2})?\s*(?:AM|PM)\b", "", title, flags=re.I)
    title = re.sub(r"\b\d{1,2}\s*-\s*\d{1,2}\b", "", title)
    title = re.sub(r"\bon\s+\d{1,2}/\d{1,2}(?:/\d{2,4})?\b", "", title, flags=re.I)
    title = re.sub(r"\bthis week\b", "", title, flags=re.I)
    title = re.sub(r"\btbd\b", "", title, flags=re.I)
    title = re.sub(r"^\(optional activity\)\s*", "", title, flags=re.I)
    if title.islower():
        title = title.title()
    title = squash(title)
    if status == "tbd":
        return "To Be Determined"
    if kind == "stake" and re.search(r"\bstake\b", title, re.I):
        return title or "Stake Activity"
    if kind:
        specific = specific_words(title)
        base = {
            "ymyw": "Combined Young Men and Young Women",
            "stake": "Stake Activity",
            "ym": "Combined Young Men",
        }[kind]
        if specific and specific.lower() not in {"men", "women", "young"}:
            return f"{base}: {specific}"
        return base
    return title or "Young Men Activity"


def stem(word):
    if len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
        return word[:-1]
    return word


def tokens(title):
    words = re.findall(r"[a-z0-9]+", (title or "").lower().replace("flowrider", "flo rider"))
    return [stem(word) for word in words if word not in STOP_TOKENS and word not in {"ym", "yw"} and len(word) > 2]


def similar_title(a, b):
    left, right = set(tokens(a)), set(tokens(b))
    if not left or not right:
        return False
    if left == right:
        return True
    smaller, larger = (left, right) if len(left) <= len(right) else (right, left)
    if smaller < larger and len(smaller) >= 2:
        return True
    overlap = len(left & right)
    return overlap >= 2 and overlap / len(left | right) >= 0.5


def weekday_conflict(note, day):
    match = re.search(r"\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b", note or "", re.I)
    if not match or day is None:
        return False
    return match.group(1).lower() != WEEKDAYS[day.weekday()].lower()


def extract_place(text):
    raw = clean(text)
    if not raw:
        return "", "", ""
    if is_blankish(raw):
        return TBD, "tbd", ""
    if re.search(r"\bopen house\b", raw, re.I):
        return "", "", ""
    if re.search(r"\btbd\b|\btba\b", raw, re.I) and not re.search(r"syracuse|layton|bountiful|square", raw, re.I):
        return TBD, "tbd", ""
    if HOME_RE.search(raw) and not re.search(r"homeless|food bank|open house", raw, re.I):
        return HOME_LOCATION, "home", ""
    for pattern, label, query in PLACES:
        if pattern.search(raw):
            if label in {"Temple", "Camp", "Park", "Pool"} and is_blankish(raw):
                continue
            return label, "public", query
    if re.search(r"\d{2,5}\s+[A-Za-z]", raw) and not re.search(r"549\s+S", raw, re.I):
        return HOME_LOCATION, "home", ""
    return "", "", ""


def pick_sources(location, description):
    """Choose a title source. A TBD location must not erase the description."""
    loc, desc = clean(location), clean(description)
    loc_text = "" if is_blankish(loc) else loc
    desc_text = "" if is_blankish(desc) else desc
    # A cancel note in the description is ignored when the location is a real activity.
    if is_cancel(desc_text) and loc_text and not is_cancel(loc_text) and not looks_like_place(loc_text):
        desc_text = ""
    if is_cancel(loc_text) and not (desc_text and not is_cancel(desc_text) and not looks_like_place(desc_text)):
        return loc_text, "", "cancel"
    if is_cancel(desc_text) and not loc_text:
        return desc_text, "", "cancel"
    place_source = ""
    if is_cancel(loc_text):
        return loc_text, "", "cancel"
    # A pure place ("Church", "Heber Valley Camp") is not the activity name.
    # "Pool Party at Loves" and "Walk to the Temple" stay the activity name.
    if loc_text and looks_like_place(loc_text):
        place_source = loc_text
        if desc_text or bare_place(loc_text):
            loc_text = ""
    if desc_text and looks_like_place(desc_text) and not place_source:
        place_source = desc_text
        if bare_place(desc_text):
            desc_text = ""
    if loc_text and desc_text:
        overlap = set(tokens(loc_text)) & set(tokens(desc_text))
        weak = {"campout", "camp", "shooting", "boat", "activity"}
        loc_tokens = tokens(loc_text)
        if (
            not overlap
            and len(loc_tokens) <= 1
            and loc_tokens
            and loc_tokens[0] in weak
            and len(tokens(desc_text)) > 1
        ):
            return desc_text, place_source or loc_text, "activity"
        if overlap and len(tokens(desc_text)) > len(loc_tokens):
            return desc_text, place_source, "activity"
        if weekday_conflict(desc_text, None):
            pass
        return loc_text, place_source, "activity"
    return loc_text or desc_text, place_source, "activity" if (loc_text or desc_text) else "tbd"


def choose_copy(location, category, description, day):
    loc, desc = clean(location), clean(description)
    cat = CATS.get((category or "").lower(), "")
    extra = "" if cat or not category or QUORUM_ONLY.match(category or "") else clean(category)
    if is_cancel(category or "") and not loc and not desc:
        title_source, place_source, mode = category, "", "cancel"
    else:
        title_source, place_source, mode = pick_sources(loc, desc)
        if not title_source and extra and not is_blankish(extra):
            title_source, mode = extra, "activity"
    if not clean(loc) and not clean(desc) and not extra:
        return {
            "title": "", "location": "", "map": "", "category": "", "status": "skip",
            "combined": "", "details": "", "blob": "",
        }
    kind = combined_kind(loc, desc, extra, title_source)
    blob = " ".join(part for part in (title_source, loc, desc) if part)
    if mode == "cancel":
        status = cancel_status(f"{category} {title_source} {blob}")
        title = polish_cancel(f"{category} {title_source}")
        place, place_kind, query = "", "", ""
    elif mode == "tbd" or not title_source:
        status, title = "tbd", "To Be Determined"
        place, place_kind, query = extract_place(place_source or loc)
        if not place:
            place, place_kind = TBD, "tbd"
    else:
        status = "activity"
        embedded, _kind, query = extract_place(title_source)
        place, place_kind, place_query = extract_place(place_source)
        if not place and embedded and embedded not in {TBD}:
            place, place_kind, place_query = embedded, "home" if embedded == HOME_LOCATION else "public", query
        # A named temple, park, or pool in the title beats a generic "Church" meeting spot.
        if embedded and embedded not in {TBD, "Temple", "Camp", "Park", "Pool", CHURCH} and place in {CHURCH, "Temple", "Camp", "Park", "Pool", TBD, ""}:
            place, place_kind, place_query = embedded, "public", query
        query = place_query
        title = polish_title(title_source, kind, status, blob)
        # "Service - Beth Jung, UT Food Bank" → drop the person's name, keep the activity.
        title = re.sub(r"(?:\s*-\s*|,\s*)[A-Z][a-z]+\s+[A-Z][a-z]+(?=\s*,|\s+-|$)", "", title)
        title = squash(title)
        if place and place not in {TBD, HOME_LOCATION, CHURCH, "Temple", "Camp", "Park", "Pool", ""}:
            without_place = squash(re.sub(re.escape(place), " ", title, flags=re.I))
            without_place = squash(re.sub(r"\bUT\b|\bfood bank\b", " ", without_place, flags=re.I))
            if len(tokens(without_place)) >= 2 and len(without_place) < len(title):
                title = without_place
        title = re.sub(r"(?:\s+\b(?:at|to|the)\b)+\s*$", "", title, flags=re.I)
        if place and re.search(r"\s(?:at|@)\s+", title, re.I):
            shortened = squash(re.sub(r"\s(?:at|@)\s+.*$", "", title, flags=re.I))
            if len(tokens(shortened)) >= 1 and shortened.lower() not in {"hang", "meet", "at"}:
                title = shortened
        if title.lower() in {"home", "house", "barn"}:
            title = "Activity"
        if not tokens(title) and kind:
            title = polish_title("Combined", kind, status, blob)
        if place and place not in {TBD, ""} and place.lower() in title.lower():
            if bare_place(place) or place in {"Temple", "Camp", "Park", "Pool"}:
                place, query = "", ""
        if title.islower():
            title = title.title()
        if re.search(r"food bank", title, re.I):
            title = squash(re.sub(r",?\s*\b(?:UT\s+)?food bank\b", "", title, flags=re.I)) or "Service"
    if place == TBD and status in {"none", "holiday"}:
        place = ""
    if status == "activity" and not place:
        place = TBD
    details = ""
    if extra and extra != title_source and not QUORUM_ONLY.match(extra):
        details = extra
    if details and (similar_title(details, title) or weekday_conflict(details, day)):
        details = ""
    return {
        "title": title or "Young Men Activity",
        "location": place or "",
        "map": "" if not place or place in {TBD, HOME_LOCATION} else query,
        "category": "" if status in {"none", "holiday", "tbd"} else cat,
        "status": status,
        "combined": "" if status in {"none", "holiday", "tbd"} else kind,
        "details": "" if status in {"none", "holiday", "tbd"} else details,
        "blob": blob,
    }


def parse_sheet(text):
    body = text
    marker = re.search(r"YM Activities Calendar 2026", text)
    if marker:
        body = text[marker.end():]
    stop = re.search(r"\n##\s+", body)
    if stop:
        # Keep the note that sits between the grid and the next tab.
        tail = body[stop.start():]
        body = body[:stop.start()]
    else:
        tail = ""
    uninterpreted = []
    reader = csv.reader(io.StringIO(body))
    rows = []
    corrections = []
    skipped_blank = 0
    parsed_rows = []
    for raw in reader:
        cells = [clean(cell) for cell in raw]
        if not any(cells):
            continue
        if cells[0].startswith("Activity Date") or cells[0] == "Deacons":
            continue
        while len(cells) < 18:
            cells.append("")
        groups = []
        ok = False
        for index, quorum in enumerate(QUORUMS):
            chunk = cells[index * 6:(index + 1) * 6]
            date_text, time_text, location, coordinator, category, description = chunk[:6]
            token = parse_date_token(date_text)
            if date_text and token is None and re.search(r"[A-Za-z0-9]", date_text):
                uninterpreted.append(squash(date_text))
            if token is None:
                groups.append(None)
                continue
            month, day, end_day, year = token
            groups.append({
                "quorum": quorum,
                "month": month,
                "day": day,
                "end_day": end_day,
                "year": year,
                "explicit_year": year,
                "time": time_text,
                "location": location,
                "coordinator": coordinator,
                "category": category,
                "description": description,
            })
            ok = True
        if ok:
            parsed_rows.append(groups)

    for quorum_index in range(3):
        assign_missing_years([row[quorum_index] for row in parsed_rows if row[quorum_index]])
    corrections.extend(fix_year_typos(parsed_rows))

    raw_events = []
    for groups in parsed_rows:
        for cell in groups:
            if not cell:
                continue
            start = safe_date(cell["year"], cell["month"], cell["day"])
            if start is None:
                uninterpreted.append(
                    f"{QUORUM_LABEL[cell['quorum']]} date not a real day: {cell['month']}/{cell['day']}/{cell['year']}"
                )
                continue
            end = start
            if cell["end_day"]:
                end_guess = safe_date(cell["year"], cell["month"], cell["end_day"])
                if end_guess is None or end_guess < start:
                    uninterpreted.append(
                        f"{QUORUM_LABEL[cell['quorum']]} end day not understood: {cell['month']}/{cell['day']}-{cell['end_day']}/{cell['year']}"
                    )
                else:
                    end = end_guess
            copy = choose_copy(cell["location"], cell["category"], cell["description"], start)
            for field in ("title", "location", "details"):
                copy[field] = scrub_coordinator_words(copy[field], cell["coordinator"])
            if copy["title"].islower():
                copy["title"] = copy["title"].title()
            if copy["status"] == "skip":
                skipped_blank += 1
                continue
            if copy["status"] == "activity" and copy["title"] in {"", "Young Men Activity"} and not clean(cell["location"]) and not clean(cell["description"]):
                skipped_blank += 1
                continue
            if not any(clean(cell[key]) for key in ("location", "category", "description")):
                skipped_blank += 1
                continue
            start_clock, end_clock, time_note = parse_time(cell["time"])
            # Clocks written on the activity itself ("6:30pm", "7-10") override the
            # default mutual time. A discarded description must not move the clock.
            body_text = " ".join(part for part in (cell["description"], cell["location"], copy["title"]) if part)
            if weekday_conflict(cell["description"], start):
                body_text = " ".join(part for part in (cell["location"], copy["title"]) if part)
            ranged = find_time_range(body_text) if not time_note else None
            clocks = explicit_clocks(body_text)
            if ranged:
                start_clock, end_clock = ranged
            elif clocks and not time_note:
                start_clock = clocks[0]
                end_clock = None
            if time_note and not weekday_conflict(time_note, start):
                copy["details"] = squash(" ".join(part for part in (copy["details"], time_note) if part))
            all_day = start != end and not start_clock
            assumed = False
            if not all_day and not start_clock:
                start_clock = (19, 0)
                assumed = True
            if start_clock and not end_clock and not all_day:
                end_hour = start_clock[0] + 1
                end_clock = (end_hour, start_clock[1]) if end_hour < 24 else (23, 59)
            label = ""
            if all_day:
                label = ""
            elif start_clock and end_clock and (end_clock[0] != start_clock[0] + 1 or end_clock[1] != start_clock[1] or ranged):
                label = f"{format_clock(*start_clock)} – {format_clock(*end_clock)}"
            elif start_clock:
                label = format_clock(*start_clock)
                if assumed:
                    label += " (Usual Mutual Time)"
            if cell.get("corrected"):
                pass
            raw_events.append({
                "date": start.isoformat(),
                "endDate": end.isoformat() if end != start else "",
                "quorums": [cell["quorum"]],
                "allDay": all_day,
                "startClock": start_clock,
                "endClock": end_clock,
                "time": label,
                "timeAssumed": assumed,
                "corrected": bool(cell.get("corrected")),
                **{key: copy[key] for key in ("title", "location", "map", "category", "status", "combined", "details")},
            })

    events = combine_events(raw_events)
    for event in events:
        event["id"] = make_id(event)
        stamp_span(event)
        event.pop("startClock", None)
        event.pop("endClock", None)
        event.pop("corrected", None)
    events.sort(key=lambda event: (event["date"], event.get("start") or "", event["title"], event["id"]))
    # De-duplicate ids after the sort.
    seen = {}
    for event in events:
        base = event["id"]
        if base not in seen:
            seen[base] = 1
            continue
        seen[base] += 1
        event["id"] = f"{base}-{seen[base]}"
    return {
        "events": events,
        "corrections": corrections,
        "uninterpreted": list(dict.fromkeys(item for item in uninterpreted if item)),
        "skippedBlank": skipped_blank,
    }


def make_id(event):
    slug = re.sub(r"[^a-z0-9]+", "-", event["title"].lower()).strip("-")
    slug = slug[:48] or "activity"
    return f"ym-{event['date']}-{slug}"


def stamp_span(event):
    if event["allDay"]:
        start = datetime.fromisoformat(event["date"]).replace(tzinfo=MT)
        end_day = datetime.fromisoformat(event["endDate"] or event["date"]).date() + timedelta(days=1)
        end = datetime(end_day.year, end_day.month, end_day.day, tzinfo=MT)
        event["start"] = start.isoformat()
        event["end"] = end.isoformat()
        return
    hour, minute = (19, 0)
    # Recover from the display label when clocks were dropped. Callers set clocks before pop.
    # stamp_span is called before pop in parse_sheet, so clocks still exist.
    start_clock = event.get("startClock") or (19, 0)
    end_clock = event.get("endClock") or (start_clock[0] + 1, start_clock[1])
    start_day = datetime.fromisoformat(event["date"])
    end_day = datetime.fromisoformat(event["endDate"] or event["date"])
    start = start_day.replace(hour=start_clock[0], minute=start_clock[1], tzinfo=MT)
    end = end_day.replace(hour=min(end_clock[0], 23), minute=end_clock[1], tzinfo=MT)
    if end <= start:
        end = start + timedelta(hours=1)
    event["start"] = start.isoformat()
    event["end"] = end.isoformat()


def best_title(group):
    ranked = sorted(group, key=lambda event: (len(tokens(event["title"])), len(event["title"])), reverse=True)
    return ranked[0]["title"]


def combine_events(raw_events):
    """One card for a combined night, and one card when quorums repeat the same activity."""
    by_date = {}
    for event in raw_events:
        by_date.setdefault(event["date"], []).append(event)
    combined = []
    for date, group in by_date.items():
        buckets = []
        for event in group:
            placed = False
            for bucket in buckets:
                if same_activity(bucket[0], event):
                    bucket.append(event)
                    placed = True
                    break
            if not placed:
                buckets.append([event])
        for bucket in buckets:
            combined.append(merge_bucket(bucket))
        blocked = set()
        busy = set()
        for event in combined:
            if event["date"] != date:
                continue
            if event["status"] in {"none", "holiday"} and set(event["quorums"]) != set(ALL_QUORUMS):
                blocked.update(event["quorums"])
            if event["status"] == "activity":
                busy.update(event["quorums"])
        for event in combined:
            if event["date"] != date:
                continue
            if event["status"] == "activity" and blocked and set(event["quorums"]) == set(ALL_QUORUMS):
                remain = [quorum for quorum in event["quorums"] if quorum not in blocked]
                if remain:
                    event["quorums"] = remain
            if event["status"] in {"none", "holiday"} and busy and set(event["quorums"]) == set(ALL_QUORUMS):
                remain = [quorum for quorum in ALL_QUORUMS if quorum not in busy]
                if remain:
                    event["quorums"] = remain
    kept = []
    for event in combined:
        if event["status"] == "tbd" and any(
            other["date"] == event["date"] and other["status"] != "tbd"
            and all(quorum in other["quorums"] for quorum in event["quorums"])
            for other in combined
        ):
            continue
        kept.append(event)
    return kept


GENERIC_LOCATIONS = {TBD, HOME_LOCATION, CHURCH, "Temple", "Camp", "Park", "Pool", "Ward Meetinghouse Pavilion", ""}


def same_place(left, right):
    place = left.get("location") or ""
    if not place or place != right.get("location") or place in GENERIC_LOCATIONS:
        return False
    if left["status"] in {"none", "holiday", "tbd"} or right["status"] in {"none", "holiday", "tbd"}:
        return False
    return True


def same_activity(left, right):
    statuses = {left["status"], right["status"]}
    if statuses <= {"none", "holiday"}:
        if "holiday" in statuses:
            return True
        return left["title"] == right["title"] or similar_title(left["title"], right["title"])
    if left["combined"] and left["combined"] == right["combined"]:
        return True
    if (left.get("combined") or right.get("combined")) and "service" in set(tokens(left["title"])) & set(tokens(right["title"])):
        return True
    if "tbd" in statuses:
        return False
    if statuses & {"none", "holiday"}:
        return False
    if same_place(left, right):
        return True
    return similar_title(left["title"], right["title"])


def merge_bucket(bucket):
    quorums = []
    for event in bucket:
        for quorum in event["quorums"]:
            if quorum not in quorums:
                quorums.append(quorum)
    kind = next((event["combined"] for event in bucket if event["combined"]), "")
    status = "activity"
    if any(event["status"] == "holiday" for event in bucket):
        status = "holiday"
    elif all(event["status"] == "none" for event in bucket):
        status = "none"
    elif any(event["status"] == "activity" for event in bucket):
        status = "activity"
    else:
        status = bucket[0]["status"]
    title = best_title([event for event in bucket if event["status"] == status] or bucket)
    if status == "holiday":
        title = best_title(bucket)
    location, map_query = pick_location(bucket)
    category = next((event["category"] for event in bucket if event["category"]), "")
    details = next((event["details"] for event in bucket if event["details"]), "")
    timed = [event for event in bucket if not event["allDay"] and not event["timeAssumed"]]
    ranged = [event for event in timed if event.get("endClock") and event.get("startClock") and event["endClock"] != (event["startClock"][0] + 1, event["startClock"][1])]
    chosen = ranged[0] if ranged else (timed[0] if timed else bucket[0])
    if kind in {"ym", "ymyw", "stake"} or status == "holiday":
        quorums = list(ALL_QUORUMS)
    if re.search(r"stake\s+(youth|young men)", title, re.I):
        kind = kind or "stake"
        quorums = list(ALL_QUORUMS)
    return {
        "date": chosen["date"],
        "endDate": chosen["endDate"],
        "quorums": quorums,
        "combined": kind,
        "title": title,
        "location": location,
        "map": map_query,
        "category": "" if status in {"none", "holiday", "tbd"} else category,
        "status": status,
        "details": "" if status in {"none", "holiday", "tbd"} else details,
        "allDay": chosen["allDay"],
        "time": "" if chosen["allDay"] else chosen["time"],
        "timeAssumed": False if chosen["allDay"] else chosen["timeAssumed"],
        "startClock": chosen.get("startClock"),
        "endClock": chosen.get("endClock"),
    }


def pick_location(bucket):
    ranked = sorted(bucket, key=lambda event: (event["location"] in {"", TBD, HOME_LOCATION}, len(event["location"])))
    for event in ranked:
        if event["location"] and event["location"] not in {TBD}:
            return event["location"], event.get("map") or ""
    if any(event["location"] == TBD for event in bucket):
        return TBD, ""
    return "", ""


def filter_events(events, quorum="all", today="0000-01-01", include_past=False):
    """Upcoming events for one quorum. Combined nights stay a single event."""
    chosen = []
    for event in events:
        last = event.get("endDate") or event["date"]
        if not include_past and last < today:
            continue
        if quorum not in ("all", "", None) and quorum not in event.get("quorums", []):
            continue
        chosen.append(event)
    return sorted(chosen, key=lambda event: (event["date"], event.get("start") or "", event["title"]))


def week_start(date_text):
    day = datetime.fromisoformat(date_text).date()
    start = day - timedelta(days=(day.weekday() + 1) % 7)
    return start.isoformat()


def highlight_label(event, today):
    if not event:
        return ""
    day = datetime.fromisoformat(event["date"]).date()
    now = datetime.fromisoformat(today).date()
    if day.weekday() == 2 and week_start(day.isoformat()) == week_start(now.isoformat()) and day >= now:
        return "This Wednesday"
    if day.weekday() == 2 and day > now:
        return "Next Wednesday"
    return "Up Next"


def infer_quorums(title):
    """Church-calendar titles, the same idea as Young Women class tags."""
    text = title or ""
    kind = combined_kind(text)
    found = []
    if re.search(r"\bdeacons?\b", text, re.I):
        found.append("deacons-quorum")
    if re.search(r"\bteachers?\b", text, re.I):
        found.append("teachers-quorum")
    if re.search(r"\bpriests?\b", text, re.I):
        found.append("priests-quorum")
    if kind or re.search(r"\ball ym\b|\byoung men\b", text, re.I):
        return list(ALL_QUORUMS), kind or ("ym" if re.search(r"combined|all ym", text, re.I) else "")
    if found:
        return found, ""
    return [], ""


def calendar_event(event):
    """A Bay 6 Calendar row. TBD placeholders stay off the ward-wide calendar."""
    if event.get("status") == "tbd":
        return None
    quorums, _kind = event.get("quorums") or [], event.get("combined") or ""
    if len(quorums) == 1:
        ym = quorums[0]
        prefix = QUORUM_LABEL.get(ym, "Young Men")
        title = event["title"] if event["title"].lower().startswith(prefix.lower()) else f"{prefix}: {event['title']}"
    elif event.get("combined") == "ymyw":
        ym = "all"
        title = event["title"]
    elif event.get("status") in {"none", "holiday"}:
        ym = "all"
        title = event["title"] if event["title"].lower().startswith("all") else f"All Young Men: {event['title']}"
    else:
        ym = "all"
        title = event["title"]
    location = event.get("location") or ""
    if location in {TBD, ""}:
        location = ""
    return {
        "id": re.sub(r"\W", "", event["id"])[:40],
        "title": title,
        "calendar": "Young Men",
        "location": location,
        "allDay": bool(event.get("allDay")),
        "start": event["start"],
        "end": event["end"],
        "ymQuorum": ym,
    }


def merge_calendar(church_events, sheet_events):
    """Add sheet activities the Church calendar does not already list."""
    merged = []
    for event in church_events:
        item = dict(event)
        if item.get("calendar") == "Young Men" and not item.get("ymQuorum"):
            quorums, kind = infer_quorums(item.get("title", ""))
            if quorums:
                item["ymQuorum"] = quorums[0] if len(quorums) == 1 else "all"
            elif kind:
                item["ymQuorum"] = "all"
        merged.append(item)
    for sheet in sheet_events:
        row = calendar_event(sheet)
        if row is None:
            continue
        day = row["start"][:10]
        if any(existing["start"][:10] == day and similar_title(existing.get("title", ""), row["title"]) for existing in merged):
            continue
        merged.append(row)
    merged.sort(key=lambda event: event.get("start") or "")
    return merged


def fold(line):
    data = line.encode()
    parts = []
    while len(data) > 75:
        cut = 75 if not parts else 74
        while cut > 0 and (data[cut] & 0xC0) == 0x80:
            cut -= 1
        parts.append(data[:cut].decode())
        data = data[cut:]
    parts.append(data.decode())
    return "\r\n ".join(parts)


def ics_escape(text):
    return (text or "").replace("\\", "\\\\").replace(",", "\\,").replace(";", "\\;").replace("\n", " ")


def to_ics(events, name="Bay 6 – Young Men Activities", stamp="20261110T160000Z"):
    lines = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//The Bay 6 Hub//Young Men Activities//EN",
        "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:" + ics_escape(name),
        "NAME:" + ics_escape(name), "X-WR-TIMEZONE:America/Denver",
    ]
    for event in events:
        start = datetime.fromisoformat(event["start"])
        end = datetime.fromisoformat(event["end"])
        if event.get("allDay"):
            times = [
                "DTSTART;VALUE=DATE:" + start.strftime("%Y%m%d"),
                "DTEND;VALUE=DATE:" + end.strftime("%Y%m%d"),
            ]
        else:
            times = [
                "DTSTART:" + start.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ"),
                "DTEND:" + end.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ"),
            ]
        summary = event["title"]
        if event.get("combined") == "ym" and not summary.lower().startswith("combined"):
            summary = "Combined Young Men: " + summary
        block = [
            "BEGIN:VEVENT",
            f"UID:{event['id']}@bay6hub",
            "DTSTAMP:" + stamp,
            *times,
            "SUMMARY:" + ics_escape(summary),
        ]
        location = event.get("location") or ""
        if location and location != TBD:
            block.append("LOCATION:" + ics_escape(location))
        details = event.get("details") or ""
        quorum_label = ", ".join(QUORUM_LABEL[item] for item in event.get("quorums", []) if item in QUORUM_LABEL)
        description = " · ".join(part for part in (quorum_label, event.get("category") or "", details) if part)
        if description:
            block.append("DESCRIPTION:" + ics_escape(description))
        block.append("END:VEVENT")
        lines.extend(block)
    lines.append("END:VCALENDAR")
    return "\r\n".join(fold(line) for line in lines) + "\r\n"


def validate_ics(text):
    errors = []
    if "\r\n" not in text:
        errors.append("ICS must use CRLF line breaks")
    physical = text.split("\r\n") if "\r\n" in text else text.split("\n")
    logical = re.sub(r"\n[ \t]", "", text.replace("\r\n", "\n"))
    if logical.count("BEGIN:VCALENDAR") != 1 or logical.count("END:VCALENDAR") != 1:
        errors.append("calendar wrapper")
    if logical.count("BEGIN:VEVENT") != logical.count("END:VEVENT"):
        errors.append("event wrapper mismatch")
    for line in physical:
        if line.startswith(" ") or line == "":
            continue
        if len(line.encode()) > 75:
            errors.append("line longer than 75 octets: " + line[:40])
            break
    for event in logical.split("BEGIN:VEVENT")[1:]:
        for key in ("UID:", "DTSTAMP:", "DTSTART", "SUMMARY:"):
            if key not in event:
                errors.append("missing " + key)
                break
    if PHONE_RE.search(logical) or EMAIL_RE.search(logical):
        errors.append("contact info in ICS")
    return errors


def document_from_result(result):
    return {
        "_readme": (
            "Young Men activity calendar, shown on orgs/young-men/. "
            "Edit this file, then run: python3 tools/ym_activities.py --ics. "
            "To rebuild it from the leaders' sheet (tab YM Activities Calendar 2026), run: "
            "python3 tools/ym_activities.py path/to/sheet.txt. "
            "Do not add youth names, the Coordinators column, phone numbers, or home addresses. "
            "A home is stored as \"Member Home (details from leaders)\". "
            "quorums use deacons-quorum, teachers-quorum, priests-quorum. "
            "combined is ym, ymyw, stake, or empty. status is activity, tbd, none, or holiday. "
            "Mutual with no time is stored as 7:00 PM (Usual Mutual Time). "
            "Combined nights are one event, not one copy per quorum."
        ),
        "timezone": "America/Denver",
        "defaultTime": "7:00 PM",
        "corrections": result["corrections"],
        "uninterpreted": result["uninterpreted"],
        "events": result["events"],
    }


def write_outputs(document):
    JSON_PATH.write_text(json.dumps(document, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    ICS_PATH.parent.mkdir(parents=True, exist_ok=True)
    ICS_PATH.write_text(to_ics(document["events"]), encoding="utf-8")


def load_document():
    return json.loads(JSON_PATH.read_text(encoding="utf-8"))


def load_sheet_text(path):
    """Plain CSV, or a JSON export wrapper with a fileContent string."""
    raw = Path(path).read_text(encoding="utf-8")
    start, end = raw.find("{"), raw.rfind("}")
    if start >= 0 and end > start and "fileContent" in raw[start:start + 400]:
        payload = json.loads(raw[start:end + 1])
        if isinstance(payload, dict) and isinstance(payload.get("fileContent"), str):
            return payload["fileContent"]
    return raw


def main(argv):
    if len(argv) < 2:
        print(__doc__.strip())
        return 2
    if argv[1] == "--ics":
        document = load_document()
        ICS_PATH.write_text(to_ics(document["events"]), encoding="utf-8")
        errors = validate_ics(ICS_PATH.read_text(encoding="utf-8"))
        if errors:
            print("\n".join(errors), file=sys.stderr)
            return 1
        print(f"wrote {ICS_PATH.relative_to(ROOT)} ({len(document['events'])} events)")
        return 0
    text = load_sheet_text(argv[1])
    result = parse_sheet(text)
    document = document_from_result(result)
    if "--print" in argv:
        for event in document["events"]:
            who = ",".join(QUORUM_LABEL[item] for item in event["quorums"])
            print(f"{event['date']} {event['time'] or 'all-day':<28} {event['status']:<8} {who:<32} {event['title']} @ {event['location']}")
        print("--- corrections", len(document["corrections"]))
        for item in document["corrections"]:
            print(item)
        print("--- uninterpreted", document["uninterpreted"])
        return 0
    write_outputs(document)
    counts = {quorum: sum(1 for event in document["events"] if quorum in event["quorums"]) for quorum in QUORUMS}
    print(f"wrote {len(document['events'])} events; per quorum {counts}")
    print(f"corrections {len(document['corrections'])}; uninterpreted {len(document['uninterpreted'])}; blank rows skipped {result['skippedBlank']}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
