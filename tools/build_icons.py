"""Standard navy/gold badge icons for every Ward Links section (2026-10-29, Adam: 'Each section needs its own icon').
Applies them to the home-page link cards and the organization pages' section headings, and can write an icon sheet."""
import re, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
RING = '<circle cx="60" cy="60" r="57" fill="#005175"/><circle cx="60" cy="60" r="51" fill="none" stroke="#c9a24a" stroke-width="2"/>'
G, C = "#c9a24a", "#f3d98b"
def B(label, body): return f'<svg class="badge" viewBox="0 0 120 120" role="img" aria-label="{label}">{RING}{body}</svg>'
ICONS = {
 "this-sunday": B("The Christus", '<path d="M73.97 103.37 L47.82 103.36 L49.09 101.64 L49.61 100.06 L49.83 97.91 L49.54 95.33 L49.83 91.46 L49.65 88.74 L50.35 81.71 L49.85 79.56 L50.72 77.13 L50.49 73.11 L50.04 72.63 L48.32 72.32 L46.76 71.54 L45.55 70.39 L44.30 68.61 L43.07 65.95 L42.34 63.65 L41.82 61.07 L41.52 57.49 L41.15 56.87 L40.44 56.95 L36.85 59.56 L33.84 60.32 L31.40 61.57 L30.83 61.47 L30.49 61.07 L30.40 59.27 L29.25 59.03 L29.25 58.49 L31.99 56.63 L32.55 55.33 L33.27 55.16 L36.85 55.25 L37.48 54.77 L38.66 53.19 L40.00 50.70 L42.45 47.03 L46.74 37.03 L47.75 35.09 L49.71 32.26 L52.86 30.11 L54.40 28.11 L54.88 26.82 L55.15 23.66 L56.01 20.22 L56.92 18.82 L58.56 17.50 L62.09 17.50 L63.56 18.65 L64.23 19.46 L64.99 21.37 L65.87 25.96 L66.38 27.61 L67.95 29.55 L70.55 31.40 L72.50 33.70 L74.69 39.01 L79.97 48.75 L82.05 53.76 L83.00 54.38 L85.01 54.36 L87.02 54.71 L89.45 56.18 L90.60 57.17 L90.60 58.06 L90.17 58.49 L89.88 59.50 L88.74 60.22 L88.17 60.20 L86.73 59.37 L85.59 59.05 L82.72 58.60 L82.29 58.76 L82.10 59.07 L82.64 71.11 L82.49 72.83 L81.91 74.98 L81.80 77.41 L82.37 88.59 L82.22 93.18 L81.72 94.19 L81.14 94.41 L80.57 94.27 L78.90 92.89 L78.24 91.03 L77.87 90.60 L75.41 89.56 L72.69 87.90 L72.25 87.84 L71.83 88.11 L71.58 88.74 L71.47 90.17 L71.82 98.48 L72.38 100.78 L73.89 102.93 L73.97 103.37Z" fill="#f3d98b" fill-rule="evenodd" stroke="#f3d98b" stroke-width="0.6" stroke-linejoin="round"/>'),   # 2026-10-29: Adam approved Christus v2-B (traced from the Thorvaldsen statue)
 "bishop": B("Conversation bubbles", f'<path d="M24 38h46a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H42l-12 10V70h-6a6 6 0 0 1-6-6V44a6 6 0 0 1 6-6z" fill="{C}" stroke="{G}" stroke-width="2.4" stroke-linejoin="round"/><path d="M82 52h12a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6h-4v8l-10-8H64a6 6 0 0 1-6-6v-2" fill="none" stroke="{C}" stroke-width="3" stroke-linejoin="round"/><g fill="#005175"><circle cx="35" cy="54" r="3.5"/><circle cx="47" cy="54" r="3.5"/><circle cx="59" cy="54" r="3.5"/></g>'),
 "temple-recommend": B("Temple with Angel Moroni", '<circle cx="60" cy="13" r="2.2" fill="#f3d98b"/><path d="M58.6 15h2.8l1 6h-4.8z" fill="#f3d98b"/><path d="M61 15l6-2" stroke="#f3d98b" stroke-width="1.6" stroke-linecap="round"/>\n<path d="M60 21l4 16h-8z" fill="#f3d98b" stroke="#c9a24a" stroke-width="1.4"/><rect x="54" y="37" width="12" height="10" fill="#f3d98b" stroke="#c9a24a" stroke-width="1.6"/><rect x="51" y="47" width="18" height="10" fill="#f3d98b" stroke="#c9a24a" stroke-width="1.6"/>\n<rect x="32" y="57" width="56" height="31" fill="#f3d98b" stroke="#c9a24a" stroke-width="2"/><path d="M30 57h60" stroke="#c9a24a" stroke-width="3"/>\n<g fill="#005175"><rect x="38" y="63" width="5" height="11" rx="2.5"/><rect x="47" y="63" width="5" height="11" rx="2.5"/><rect x="68" y="63" width="5" height="11" rx="2.5"/><rect x="77" y="63" width="5" height="11" rx="2.5"/><path d="M56 88V75a4 4 0 0 1 8 0v13z"/><rect x="58.5" y="40" width="3" height="5" rx="1.5"/></g>\n<path d="M24 88h72" stroke="#c9a24a" stroke-width="3" stroke-linecap="round"/>'),   # 2026-10-29: Adam picked Temple A
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
def apply_tfh():   # 2026-10-29: Temple A also replaces the Temple and Family History org logo (home tile + org page hero)
    t = ICONS["temple-recommend"]
    for f, cls, sz in ((ROOT / "index.html", "logo", 64), (ROOT / "orgs/temple-and-family-history/index.html", "hero", 120)):
        s = f.read_text(); new = t.replace('class="badge"', f'class="{cls}" width="{sz}" height="{sz}"', 1)
        if f.name == "index.html" and "orgs/temple" not in str(f):
            s = re.sub(r'(<a class="org" href="orgs/temple-and-family-history/">)<svg class="logo".*?</svg>', lambda m: m.group(1) + new, s, 1, flags=re.S)
        else:
            s = re.sub(r'<svg class="hero".*?</svg>', lambda m: new, s, 1, flags=re.S)
        f.write_text(s)
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
if __name__ == "__main__": apply(); apply_tfh(); print("icons applied")
