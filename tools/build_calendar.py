#!/usr/bin/env python3
"""Build data/calendar.json + calendar/ward.ics from a Church calendar ICS feed (URL or file).

Keeps only ALLOWED calendars (CATEGORIES / X-WR-CALNAME), drops sensitive events
(interviews, tithing, bishopric, recommends, settings apart, PEC, private), and strips
emails / phone numbers / descriptions so no contact info is ever published.
Usage: python3 tools/build_calendar.py SOURCE [--preview]
"""
import json, re, sys, urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
MT = ZoneInfo("America/Denver")
# Church sync feeds name the calendar as a SUMMARY suffix: "<title> - Farmington Bay 6th Ward - <calendar>"
UNIT = "Farmington Bay 6th Ward"
ALLOWED = {"elders quorum", "farmington 6th ward activities", "farmington 6th ward meetings", "farmington 6th ward",
           "primary", "relief society", "young men", "young women"}
SUFFIX = re.compile(r"\s+[-–]\s+" + re.escape(UNIT) + r"\s+[-–]\s+(?P<cal>[^-–]+?)\s*$")
# Stake and Churchwide calendars in the same sync group use different suffixes.
STAKE = "Farmington Utah Farmington Bay Stake"
OTHER_SUFFIXES = [(re.compile(r"\s+[-–]\s+" + re.escape(STAKE) + r"\s+[-–]\s+" + re.escape(STAKE) + r" Activities\s*$"), "Stake Activities"),
                  (re.compile(r"\s+[-–]\s+" + re.escape(STAKE) + r"\s+[-–]\s+" + re.escape(STAKE) + r" Meetings\s*$"), "Stake Meetings"),
                  (re.compile(r"\s+[-–]\s+Churchwide Events\s*$"), "Churchwide")]
ALLOWED |= {"stake activities", "churchwide"}
HARD_EXCLUDE = {"stake meetings", "bishop interviews (private)"}  # never publish, even if allowed elsewhere
# Adam-approved exact titles that bypass the title/description filters (titles only; descriptions never published).
ALLOW_TITLES = {"Ward Temple Night", "Temple and Family History Leadership Instruction"}
# Stake building calendar also holds other wards' bookings; they aren't Bay 6 events.
OTHER_WARD = re.compile(r"\b(?:1st|2nd|3rd|4th|5th|7th|8th|9th|1\dth)\s+ward\b|spring creek ward", re.I)
# Personal / family events that may sneak onto ward calendars, plus names that must never be published.
PERSONAL = re.compile(r"birthday|bday|anniversary|baby shower|bridal|wedding|reception|funeral|\b\w+(?:'s|s'| family)\s+(?:party|home|house|bbq|open house)|\bfamily party|\b\w+\s+family\b|^[A-Z][a-z]+\s+[A-Z][a-z]+\s+baptism$|justin\s+huff|cody\s+sorenson", re.I)
STREET = re.compile(r"\b\d{2,5}\s+(?:[NSEW]\.?|North|South|East|West)?\s*\d{0,5}\s*(?:[NSEW]\.?|North|South|East|West|St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Way|Cir|Circle|Ct|Court)\b", re.I)
CHURCH_ADDR = re.compile(r"549\s+s(outh)?\.?\s+1525\s+w", re.I)  # meetinghouse; any other street address is treated as a private home
BLOCK = re.compile(r"interview|tithing|bishopric|recommend|setting[ -]?apart|\bpec\b|private|confidential|welfare", re.I)
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE = re.compile(r"(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}")

# Title corrections for typos / odd casing in the source calendars (exact titles, applied before dedupe).
FIX_TITLES = {
    "Sake YM Basketball": "Stake YM Basketball",
    "Stake YW's Pickleball": "Stake YW Pickleball",
    "Stake Relief Society Activiy": "Stake Relief Society Activity",
    "Stake relief society training dinner": "Stake Relief Society Training Dinner",
    "Pre-thanksgiving activities": "Pre-Thanksgiving Activities",
    "Set up for Ward Christmas Party": "Set Up for Ward Christmas Party",
    "Set Up For 6th Ward Christmas Party on 12/5/26": "Set Up for 6th Ward Christmas Party",
    "Post Trek Fireside": "Post-Trek Fireside",
    "Annual stake young women activity": "Annual Stake Young Women Activity",
}

# Public subscribable feeds (same filtered/deduped list). Slug -> (calendar name, source calendars or None = all).
FEEDS = {
    "all": ("Bay 6 – All Events", None),
    "ward": ("Bay 6 – Ward", {"Farmington 6th Ward", "Farmington 6th Ward Activities", "Farmington 6th Ward Meetings"}),
    "relief-society": ("Bay 6 – Relief Society", {"Relief Society"}),
    "elders-quorum": ("Bay 6 – Elders Quorum", {"Elders Quorum"}),
    "primary": ("Bay 6 – Primary", {"Primary"}),
    "young-men": ("Bay 6 – Young Men", {"Young Men"}),
    "young-women": ("Bay 6 – Young Women", {"Young Women"}),
    "stake-activities": ("Bay 6 – Stake Activities", {"Stake Activities"}),
    "churchwide": ("Bay 6 – Churchwide", {"Churchwide"}),
}

def fold(line):
    """RFC 5545 line folding at 75 octets (never splitting a UTF-8 character)."""
    b, parts = line.encode(), []
    while len(b) > 75:
        cut = 75 if not parts else 74
        while (b[cut] & 0xC0) == 0x80: cut -= 1
        parts.append(b[:cut].decode()); b = b[cut:]
    parts.append(b.decode())
    return "\r\n ".join(parts)

def write_ics(evs, name):
    esc = lambda s: s.replace("\\", "\\\\").replace(",", "\\,").replace(";", "\\;").replace("\n", " ")
    utc = lambda d: d.astimezone(ZoneInfo("UTC")).strftime("%Y%m%dT%H%M%SZ")
    stamp = datetime.now(ZoneInfo("UTC")).strftime("%Y%m%dT%H%M%SZ")
    ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//The Bay 6 Hub//Ward Calendar//EN", "CALSCALE:GREGORIAN",
           "METHOD:PUBLISH", "X-WR-CALNAME:" + esc(name), "NAME:" + esc(name), "X-WR-TIMEZONE:America/Denver",
           "REFRESH-INTERVAL;VALUE=DURATION:PT8H", "X-PUBLISHED-TTL:PT8H"]
    for x in evs:
        s, f = datetime.fromisoformat(x["start"]), datetime.fromisoformat(x["end"])
        if x["allDay"]:
            ds, de = s.strftime("%Y%m%d"), f.strftime("%Y%m%d")
            if de <= ds: de = (s + timedelta(days=1)).strftime("%Y%m%d")
            times = ["DTSTART;VALUE=DATE:" + ds, "DTEND;VALUE=DATE:" + de]
        else:
            times = ["DTSTART:" + utc(s), "DTEND:" + utc(max(f, s))]
        ics += ["BEGIN:VEVENT", f"UID:{x['id']}@bay6hub", "DTSTAMP:" + stamp, *times,
                "SUMMARY:" + esc(x["title"])] + (["LOCATION:" + esc(x["location"])] if x["location"] else []) + ["END:VEVENT"]
    ics.append("END:VCALENDAR")
    return "\r\n".join(fold(l) for l in ics) + "\r\n"

def dedupe(evs):
    """Collapse same-day, time-overlapping events whose titles match after normalizing ('6th', 'on 12/5/26', case)."""
    norm = lambda t: re.sub(r"\s+", " ", re.sub(r"\b6th\b|\bon \d+/\d+(/\d+)?|[^a-z0-9 ]", " ", t.lower())).strip()
    rank = lambda x: (x["calendar"] not in ("Stake Activities", "Churchwide"), "6th Ward" in x["title"], bool(x["location"]), len(x["title"]))
    out, merged = [], []
    for x in sorted(evs, key=rank, reverse=True):
        dup = next((k for k in out if k["start"][:10] == x["start"][:10] and norm(k["title"]) == norm(x["title"])
                    and k["start"] < x["end"] and x["start"] < k["end"] or (k["start"] == x["start"] == x["end"] and norm(k["title"]) == norm(x["title"]))), None)
        if dup: merged.append(f'{x["start"][:16]} "{x["title"]}" [{x["calendar"]}] -> "{dup["title"]}" [{dup["calendar"]}]')
        else: out.append(x)
    return out, merged

def read(src):
    if re.match(r"https?://|webcal://", src):
        src = src.replace("webcal://", "https://", 1)
        with urllib.request.urlopen(src, timeout=30) as r:
            return r.read().decode("utf-8", "replace")
    return Path(src).read_text(encoding="utf-8")

def unfold(text):
    return re.sub(r"\r?\n[ \t]", "", text).splitlines()

def parse_dt(key, val):
    params = dict(p.split("=", 1) for p in key.split(";")[1:] if "=" in p)
    if params.get("VALUE") == "DATE" or len(val) == 8:
        return datetime.strptime(val[:8], "%Y%m%d").replace(tzinfo=MT), True
    if val.endswith("Z"):
        return datetime.strptime(val, "%Y%m%dT%H%M%SZ").replace(tzinfo=ZoneInfo("UTC")).astimezone(MT), False
    tz = ZoneInfo(params.get("TZID", "America/Denver"))
    return datetime.strptime(val[:15], "%Y%m%dT%H%M%S").replace(tzinfo=tz).astimezone(MT), False

def clean(s):
    s = s.replace("\\,", ",").replace("\\;", ";").replace("\\n", " ").strip()
    return re.sub(r"\s{2,}", " ", PHONE.sub("", EMAIL.sub("", s))).strip(" ,;-")

def events(lines, calname):
    ev = None
    for ln in lines:
        if ln == "BEGIN:VEVENT": ev = {}
        elif ln == "END:VEVENT" and ev is not None: yield ev; ev = None
        elif ev is not None and ":" in ln:
            k, v = ln.split(":", 1); name = k.split(";")[0]
            if name in ("DTSTART", "DTEND"): ev[name] = parse_dt(k, v)
            elif name in ("SUMMARY", "LOCATION", "CATEGORIES", "UID", "CLASS", "DESCRIPTION"): ev[name] = v
    return

# Young Women class tags. Type one in the Church calendar title or description:
# [Gatherers] [Messengers] [Builders] [All YW]. Fallback (Young Women calendar only): the class name word in the title/description.
# Untagged Young Women "Combined"/"Class Activities" items show on every class tab.
YW_TAG = re.compile(r"\[\s*(gatherers?|messengers?|builders?|all\s*yw)\s*\]", re.I)
YW_IDS = {"gatherer": "gatherers-of-light", "messenger": "messengers-of-hope", "builder": "builders-of-faith"}
def yw_class(title, desc, cal):
    m = YW_TAG.search(title) or YW_TAG.search(desc)
    w = (m.group(1) if m else "").lower()
    if not w and cal == "Young Women":
        m2 = re.search(r"\b(gatherers?|messengers?|builders?)\b", f"{title} {desc}", re.I)
        w = m2.group(1).lower() if m2 else ""
    if w.startswith("all"): return "all"
    for k, v in YW_IDS.items():
        if w.startswith(k): return v
    if cal == "Young Women" and re.search(r"combined|class activit", title, re.I): return "all"
    return None

def main():
    if len(sys.argv) < 2: sys.exit(__doc__)
    text = read(sys.argv[1]); lines = unfold(text)
    calname = next((l.split(":", 1)[1] for l in lines if l.startswith("X-WR-CALNAME:")), "Ward")
    out, dropped = [], []
    for e in events(lines, calname):
        title = clean(e.get("SUMMARY", "")); m = SUFFIX.search(title)
        cal = m.group("cal").strip() if m else None
        if m: title = title[:m.start()].strip(" -")
        else:
            for rx, label in OTHER_SUFFIXES:
                m2 = rx.search(title)
                if m2: cal, title = label, title[:m2.start()].strip(" -"); break
        if cal is None: cal = clean(e.get("CATEGORIES", calname))
        title = FIX_TITLES.get(re.sub(r"\s{2,}", " ", title).strip(), title)
        if cal.lower() in HARD_EXCLUDE:
            dropped.append(f"(hard-excluded) [{cal}]"); continue
        if cal == "Stake Activities" and OTHER_WARD.search(title):
            dropped.append(f"{title} [{cal}] other ward"); continue
        loc = clean(e.get("LOCATION", ""))
        if CHURCH_ADDR.search(loc): loc = "Eagle Shore Meetinghouse, 549 S 1525 W, Farmington"
        elif re.search(r"\d", loc): loc = ""  # possible home address -> drop
        e["LOCATION"] = loc
        desc = e.get("DESCRIPTION", "").replace("\\,", ",")
        home_addr = bool(STREET.search(CHURCH_ADDR.sub("", desc)))  # e.g. "at the Bishop's home...1266 W 475 S"
        if cal.lower() not in ALLOWED or (title not in ALLOW_TITLES and (BLOCK.search(title) or PERSONAL.search(title) or home_addr or e.get("CLASS", "").upper() in ("PRIVATE", "CONFIDENTIAL"))):
            dropped.append(f"{title} [{cal}]"); continue
        st, allday = e["DTSTART"]; en = e.get("DTEND", (st, allday))[0]
        ywc = yw_class(title, desc, cal); title = YW_TAG.sub("", title).strip(" -")
        out.append({"id": re.sub(r"\W", "", e.get("UID", title))[:40], "title": title, "calendar": cal,
                    "location": e["LOCATION"], "allDay": allday,
                    "start": st.isoformat(), "end": en.isoformat(), **({"ywClass": ywc} if ywc else {})})
    preview = "--preview" in sys.argv
    if not preview:  # upcoming only
        now = datetime.now(MT); past = [x for x in out if datetime.fromisoformat(x["end"]) < now]
        out = [x for x in out if x not in past]
    else: past = []
    out, merged = dedupe(out)
    out.sort(key=lambda x: x["start"])
    (ROOT / "data").mkdir(exist_ok=True); (ROOT / "calendar").mkdir(exist_ok=True)
    json.dump({"generated": datetime.now(MT).isoformat(timespec="seconds"), "timezone": "America/Denver",
               "preview": preview, "events": out}, open(ROOT / "data/calendar.json", "w"), indent=1)
    (ROOT / "calendar/feeds").mkdir(exist_ok=True)
    counts = {}
    for slug, (name, cals) in FEEDS.items():
        sel = [x for x in out if cals is None or x["calendar"] in cals]
        counts[slug] = len(sel)
        path = ROOT / "calendar" / ("ward.ics" if slug == "all" else f"feeds/{slug}.ics")
        path.write_text(write_ics(sel, name))
        if slug == "all": (ROOT / "calendar/feeds/all.ics").write_text(write_ics(sel, name))
    print(f"kept {len(out)} upcoming, dropped {len(dropped)} by filters, skipped {len(past)} past")
    print("feeds:", ", ".join(f"{k}={v}" for k, v in counts.items()))
    for d in dropped: print("  dropped:", d)
    for d in merged: print("  merged:", d)

if __name__ == "__main__":
    main()
