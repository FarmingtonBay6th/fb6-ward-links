"""Standard navy/gold badge icons for every Ward Links section (2026-10-29, Adam: 'Each section needs its own icon').
Applies them to the home-page link cards and the organization pages' section headings, and can write an icon sheet."""
import re, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
RING = '<circle cx="60" cy="60" r="57" fill="#005175"/><circle cx="60" cy="60" r="51" fill="none" stroke="#c9a24a" stroke-width="2"/>'
G, C = "#c9a24a", "#f3d98b"
def B(label, body): return f'<svg class="badge" viewBox="0 0 120 120" role="img" aria-label="{label}">{RING}{body}</svg>'
ICONS = {
 "this-sunday": B("Chapel", f'<path d="M50 50l10-30 10 30z" fill="{C}" stroke="{G}" stroke-width="2"/><rect x="50" y="50" width="20" height="38" fill="{C}" stroke="{G}" stroke-width="2"/><path d="M30 88V64l20-10v34M90 88V64L70 54v34" fill="{C}" stroke="{G}" stroke-width="2" stroke-linejoin="round"/><path d="M56 88V76a4 4 0 0 1 8 0v12" fill="#005175"/><path d="M26 88h68" stroke="{G}" stroke-width="3" stroke-linecap="round"/>'),
 "bishop": B("Conversation bubbles", f'<path d="M24 38h46a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H42l-12 10V70h-6a6 6 0 0 1-6-6V44a6 6 0 0 1 6-6z" fill="{C}" stroke="{G}" stroke-width="2.4" stroke-linejoin="round"/><path d="M82 52h12a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6h-4v8l-10-8H64a6 6 0 0 1-6-6v-2" fill="none" stroke="{C}" stroke-width="3" stroke-linejoin="round"/><g fill="#005175"><circle cx="35" cy="54" r="3.5"/><circle cx="47" cy="54" r="3.5"/><circle cx="59" cy="54" r="3.5"/></g>'),
 "temple-recommend": B("Temple and recommend card", f'<path d="M54 18l2 10h-4z" fill="{C}"/><path d="M50 28h8v8h-8zM46 36h16v10H46zM38 46h32v34H38z" fill="{C}" stroke="{G}" stroke-width="1.8"/><path d="M51 80v-9a3 3 0 0 1 6 0v9" fill="#005175"/><rect x="66" y="64" width="34" height="24" rx="4" fill="#1d1d1f" stroke="{G}" stroke-width="2.2"/><path d="M72 72h22" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><path d="M72 80h14" stroke="#c9c9c9" stroke-width="2" stroke-linecap="round"/><path d="M26 88h44" stroke="{G}" stroke-width="3" stroke-linecap="round"/>'),
 "tithing": B("Windows of heaven", f'<rect x="38" y="44" width="44" height="40" rx="3" fill="{C}" stroke="{G}" stroke-width="2.4"/><path d="M60 44v40M38 64h44" stroke="{G}" stroke-width="2.4"/><path d="M38 44a22 18 0 0 1 44 0" fill="{C}" stroke="{G}" stroke-width="2.4"/><path d="M60 18v10M40 24l5 8M80 24l-5 8M28 36l8 4M92 36l-8 4" stroke="{C}" stroke-width="3" stroke-linecap="round"/><path d="M60 90c-6-4-10-7-10-11a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 4-4 7-10 11z" fill="{G}"/>'),
 "calendar": B("Calendar", f'<rect x="30" y="34" width="60" height="54" rx="7" fill="{C}" stroke="{G}" stroke-width="2.4"/><path d="M30 50h60" stroke="{G}" stroke-width="2.4"/><rect x="30" y="34" width="60" height="16" rx="7" fill="{G}"/><path d="M44 28v12M76 28v12" stroke="{C}" stroke-width="4" stroke-linecap="round"/><g fill="#005175"><rect x="38" y="57" width="8" height="7" rx="1.5"/><rect x="52" y="57" width="8" height="7" rx="1.5"/><rect x="66" y="57" width="8" height="7" rx="1.5"/><rect x="38" y="70" width="8" height="7" rx="1.5"/><rect x="52" y="70" width="8" height="7" rx="1.5"/></g><path d="M70 74l3 3 6-7" stroke="#005175" stroke-width="2.6" fill="none" stroke-linecap="round"/>'),
 "events": B("Event flyer", f'<path d="M34 26h40l12 12v54H34z" fill="{C}" stroke="{G}" stroke-width="2.4" stroke-linejoin="round"/><path d="M74 26v12h12" fill="none" stroke="{G}" stroke-width="2.4"/><path d="M60 42l4 9 10 1-7.5 6.5 2.5 9.5-9-5-9 5 2.5-9.5L46 52l10-1z" fill="#005175"/><path d="M44 76h32M44 84h22" stroke="#005175" stroke-width="2.6" stroke-linecap="round"/>'),
 "announce": B("Announcement megaphone", f'<path d="M30 52h12l34-18v52L42 68H30z" fill="{C}" stroke="{G}" stroke-width="2.4" stroke-linejoin="round"/><path d="M42 68l5 18h9l-4-17" fill="{C}" stroke="{G}" stroke-width="2.2" stroke-linejoin="round"/><path d="M84 48c5 3 5 21 0 24M90 42c9 6 9 30 0 36" fill="none" stroke="{C}" stroke-width="3" stroke-linecap="round"/>'),
 "organizations": B("Ward family", f'<g fill="{C}" stroke="{G}" stroke-width="2"><circle cx="40" cy="48" r="9"/><circle cx="80" cy="48" r="9"/><circle cx="60" cy="40" r="10"/><path d="M26 86c0-14 6-24 14-24s14 10 14 24z"/><path d="M66 86c0-14 6-24 14-24s14 10 14 24z"/><path d="M44 88c0-18 7-30 16-30s16 12 16 30z"/></g>'),
 "leaders": B("Leader contact card", f'<rect x="24" y="36" width="72" height="50" rx="8" fill="{C}" stroke="{G}" stroke-width="2.4"/><circle cx="46" cy="56" r="8" fill="#005175"/><path d="M34 76c2-8 7-11 12-11s10 3 12 11" fill="#005175"/><path d="M64 52h22M64 62h18M64 72h14" stroke="#005175" stroke-width="3" stroke-linecap="round"/>'),
 "activities": B("Activity calendar", f'<rect x="30" y="34" width="60" height="54" rx="7" fill="{C}" stroke="{G}" stroke-width="2.4"/><rect x="30" y="34" width="60" height="16" rx="7" fill="{G}"/><path d="M44 28v12M76 28v12" stroke="{C}" stroke-width="4" stroke-linecap="round"/><path d="M60 56l4 8 9 1-6.5 6 2 9-8.5-4.5-8.5 4.5 2-9-6.5-6 9-1z" fill="#005175"/>'),
 "signups": B("Sign-up clipboard", f'<rect x="34" y="30" width="52" height="62" rx="6" fill="{C}" stroke="{G}" stroke-width="2.4"/><rect x="48" y="24" width="24" height="12" rx="4" fill="{G}"/><path d="M44 52l4 4 7-8M44 68l4 4 7-8" stroke="#005175" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M62 52h16M62 68h16M44 82h34" stroke="#005175" stroke-width="2.6" stroke-linecap="round"/>'),
 "resources": B("Open book", f'<path d="M60 38c-10-6-22-7-34-5v48c12-2 24-1 34 5 10-6 22-7 34-5V33c-12-2-24-1-34 5z" fill="{C}" stroke="{G}" stroke-width="2.4" stroke-linejoin="round"/><path d="M60 38v48" stroke="{G}" stroke-width="2.4"/><path d="M34 46c6-1 12 0 18 2M34 56c6-1 12 0 18 2M68 48c6-2 12-3 18-2M68 58c6-2 12-3 18-2" stroke="#005175" stroke-width="2.2" stroke-linecap="round"/>'),
}
CARD_MAP = {"Meet with the Bishop": "bishop", "Stake Temple Recommend": "temple-recommend", "Tithing Declaration": "tithing", "Ward Calendar": "calendar",
            "Upcoming Events": "events", "Submit an Announcement": "announce"}
SEC_MAP = {"Presidency &amp; Contact": "leaders", "Leaders &amp; Contact": "leaders", "Upcoming Activities": "activities", "Sign-ups": "signups", "Resources": "resources"}
CSS_HOME = "  .ic { flex:0 0 52px; height:52px; border-radius:50%; background:none; display:grid; place-items:center; } .ic .badge { width:52px; height:52px; display:block; }\n"
def apply():
    p = ROOT / "index.html"; s = p.read_text()
    def card(m):
        blk = m.group(0); t = re.search(r"<b>([^<]*)</b>", blk).group(1)
        key = next((v for k, v in CARD_MAP.items() if t.startswith(k)), None)
        return re.sub(r'<span class="ic">.*?</span>', f'<span class="ic">{ICONS[key]}</span>', blk, count=1, flags=re.S) if key else blk
    s = re.sub(r'<a class="card".*?</a>', card, s, flags=re.S)
    s = re.sub(r"  \.ic \{[^\n]*\n  \.ic svg \{[^\n]*\n", CSS_HOME, s)
    s = re.sub(r"  \.ic \{ flex:0 0 52px[^\n]*\n", CSS_HOME, s)
    s = s.replace("    .ic { background:#33291f; } ", "    ")
    if 'class="sechead"' not in s:
        s = s.replace("    <h2>Our Organizations</h2>", f'    <div class="sechead">{ICONS["organizations"]}<h2>Our Organizations</h2></div>', 1)
        s = s.replace("  section h2 {", "  .sechead { display:flex; align-items:center; gap:12px; } .sechead .badge { flex:0 0 56px; width:56px; height:56px; } .sechead h2 { margin:0; }\n  section h2 {", 1)
    p.write_text(s)
    for o in (ROOT / "orgs").glob("*/index.html"):
        t = o.read_text()
        def h(m):
            name = re.sub(r"<span.*", "", m.group(1)).strip(); key = SEC_MAP.get(name)
            return f'<h2 class="ih">{ICONS[key]}{m.group(1)}</h2>' if key else m.group(0)
        t = re.sub(r'<h2>(.*?)</h2>', h, t)
        if ".ih " not in t: t = t.replace("</style>", "h2.ih{display:flex;align-items:center;gap:10px} h2.ih .badge{flex:0 0 40px;width:40px;height:40px}\n</style>", 1)
        o.write_text(t)
if __name__ == "__main__": apply(); print("icons applied")
