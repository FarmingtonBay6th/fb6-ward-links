"""Builds missionaries/index.html (own section: each serving member gets a 'Say hello' mailto button, no address text shown)
and swaps the home page's running list for one tappable missionary card. Emails come from the program builder's
MISSIONARIES list (build_program_4page.py); nothing is invented. 2026-10-29 (Adam)."""
import re, ast, urllib.parse
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
B = Path("/workspace/sacrament/program-4page/build_program_4page.py").read_text()
M = ast.literal_eval(re.search(r"^MISSIONARIES = (\[.*?^\])", B, re.S | re.M).group(1))
M = sorted(M, key=lambda m: (m[0].split()[-1].lower(), m[0].lower()))
SUBJ = "Hello from Farmington Bay 6th Ward!"
ICON = '''<svg class="badge" viewBox="0 0 120 120" role="img" aria-label="Missionary name tag with a globe">
<circle cx="60" cy="60" r="57" fill="#005175"/><circle cx="60" cy="60" r="51" fill="none" stroke="#c9a24a" stroke-width="2"/>
<rect x="22" y="36" width="76" height="48" rx="9" fill="#1d1d1f" stroke="#c9a24a" stroke-width="2.5"/>
<g fill="none" stroke="#f3d98b" stroke-width="2.2"><circle cx="43" cy="60" r="13"/><path d="M30 60h26M43 47c5 4 5 22 0 26M43 47c-5 4-5 22 0 26M32 53h22M32 67h22"/></g>
<path d="M63 52h26" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/><path d="M63 61h22M63 69h18" stroke="#c9c9c9" stroke-width="2.4" stroke-linecap="round"/>
<path d="M60 96l-7-4.5 7-4.5 7 4.5z" fill="#c9a24a"/></svg>'''
def enc(t):   # reversed + base64, so no address (and no '@') is ever in the HTML
    import base64
    return base64.b64encode(t[::-1].encode()).decode()
def card(m):
    name, email, place = m[0], m[1], m[2]
    user, dom = email.split("@")
    return (f'    <div class="mcard"><div class="who"><b>{name}</b><span>{place}</span></div>'
            f'<a class="hello" href="#write" data-u="{enc(user)}" data-d="{enc(dom)}" aria-label="Say hello to {name} by email"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M4 7l8 6 8-6"/></svg>Say hello</a></div>')
JS = """<script>
// addresses are assembled only when a button is tapped (spam bots reading the HTML never see one)
document.addEventListener('click', function (e) {
  var a = e.target.closest('a.hello[data-u]'); if (!a) return;
  e.preventDefault();
  var dec = function (s) { return atob(s).split('').reverse().join(''); };
  window.location.href = 'mailto:' + dec(a.dataset.u) + String.fromCharCode(64) + dec(a.dataset.d);
});
</script>
<noscript><p style="text-align:center;color:#6d625a;font-size:14px;margin:0 16px 20px">The Say hello buttons need JavaScript. You can also find missionary addresses in the Member Tools app or ask the ward mission leader.</p></noscript>"""
page = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow"><title>Our Ward Missionaries · Farmington Bay 6th Ward</title><meta name="theme-color" content="#005175">
<link rel="icon" type="image/png" sizes="32x32" href="../icons/cover-favicon-32.png?v=cover1">
<style>
 :root{{--ink:#2b2420;--soft:#6d625a;--bg:#faf6f0;--card:#fff;--line:#e8dfd3;--accent:#005175}}
 *{{box-sizing:border-box}} html,body{{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}}
 header{{background:linear-gradient(160deg,#005175,#003a55);color:#fff;padding:22px 20px 26px;text-align:center;border-bottom-left-radius:22px;border-bottom-right-radius:22px}}
 header a.back{{position:absolute;left:14px;top:14px;color:#fff;opacity:.85;text-decoration:none;font-size:15px}}
 header .badge{{width:96px;height:96px;display:block;margin:4px auto 8px;filter:drop-shadow(0 4px 10px rgba(0,0,0,.25))}}
 header h1{{font:italic 400 27px/1.15 Georgia,serif;margin:4px 0 8px}} header p{{margin:0 auto;max-width:28em;font:italic 15px/1.45 Georgia,serif;opacity:.92}}
 main{{max-width:560px;margin:0 auto;padding:16px 14px 30px}} .note{{color:var(--soft);font-size:14px;margin:4px 2px 10px}}
 .mcard{{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px 12px 12px 16px;margin:9px 0;box-shadow:0 1px 2px rgba(59,47,42,.06)}}
 .who{{flex:1;min-width:0}} .who b{{display:block;font-size:16.5px}} .who span{{display:block;color:var(--soft);font-size:13.5px}}
 .hello{{flex:0 0 auto;display:inline-flex;align-items:center;gap:7px;background:var(--accent);color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:10px 14px;border-radius:12px;min-height:44px}}
 .hello:active{{transform:scale(.97)}} .hello svg{{width:19px;height:19px;fill:none;stroke:#fff;stroke-width:1.9;stroke-linejoin:round}}
 footer{{text-align:center;color:var(--soft);font-size:12px;padding:8px 20px 30px}}
 @media (prefers-color-scheme:dark){{:root{{--ink:#f3ece4;--soft:#bfb2a5;--bg:#1d1916;--card:#27211d;--line:#3a312a}}}}
</style></head><body>
<header style="position:relative"><a class="back" href="../">‹ Ward Links</a>{ICON}
<h1>Our Ward Missionaries</h1><p>They love hearing from home! Tap <b>Say hello</b> to send a quick note of love and encouragement.</p></header>
<main>
  <div class="note">Each button opens your email app addressed to that missionary. A–Z by last name.</div>
{chr(10).join(card(m) for m in M)}
</main>
<div id="write"></div>
{JS}
<footer>This is not an official website of The Church of Jesus Christ of Latter-day Saints.</footer>
</body></html>
'''
(ROOT / "missionaries" / "index.html").write_text(page)
# home page: replace the running list with one big tappable card
H = (ROOT / "index.html").read_text()
home = f'''  <section id="serving" class="miss misscard">
    <a class="misslink" href="missionaries/" aria-label="Our Ward Missionaries: tap to say hello">{ICON}
      <span class="mt"><b>Our Ward Missionaries</b><small>{len(M)} ward members serving the Savior. Tap to say hello by email!</small><em>Say hello ›</em></span></a>
  </section>
'''
H = re.sub(r'  <section id="serving" class="miss">.*?</section>\n', lambda _: home, H, count=1, flags=re.S)
css = ('  .misscard { padding:0; overflow:hidden; } .misslink { display:flex; align-items:center; gap:14px; padding:16px; text-decoration:none; color:inherit; }\n'
       '  .misslink:active { background:#f3f8fb; } .misslink .badge { flex:0 0 84px; width:84px; height:84px; }\n'
       '  .misslink .mt b { display:block; font:italic 400 21px/1.2 Georgia, serif; } .misslink .mt small { display:block; color:var(--soft); font-size:14px; margin-top:3px; }\n'
       '  .misslink .mt em { display:inline-block; margin-top:8px; font-style:normal; font-weight:600; font-size:15px; background:var(--accent2); color:#fff; padding:8px 13px; border-radius:11px; }\n')
if ".misscard" not in H: H = H.replace("  section h2 {", css + "  section h2 {", 1)
LOCAL_ICON = '''<svg class="badge" viewBox="0 0 120 120" role="img" aria-label="Two missionary name tags with a map pin">
<circle cx="60" cy="60" r="57" fill="#005175"/><circle cx="60" cy="60" r="51" fill="none" stroke="#c9a24a" stroke-width="2"/>
<g transform="rotate(-8 46 66)"><rect x="18" y="52" width="54" height="32" rx="6" fill="#1d1d1f" stroke="#c9a24a" stroke-width="2.2"/><path d="M27 63h34" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M27 72h24" stroke="#c9c9c9" stroke-width="2.2" stroke-linecap="round"/></g>
<g transform="rotate(7 74 72)"><rect x="48" y="58" width="54" height="32" rx="6" fill="#1d1d1f" stroke="#c9a24a" stroke-width="2.2"/><path d="M57 69h34" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M57 78h24" stroke="#c9c9c9" stroke-width="2.2" stroke-linecap="round"/></g>
<path d="M60 47c-8-9-13-14-13-21a13 13 0 0 1 26 0c0 7-5 12-13 21z" fill="#f3d98b" stroke="#c9a24a" stroke-width="2"/><circle cx="60" cy="26" r="4.6" fill="#005175"/></svg>'''
H = re.sub(r'  <section id="missionaries" class="miss">\n    <h2>Our Local Missionaries</h2>',
           lambda _: '  <section id="missionaries" class="miss">\n    <div class="lochead">' + LOCAL_ICON + '<h2>Our Local Missionaries</h2></div>', H, count=1)
if ".lochead" not in H.split("</style>")[0]:
    H = H.replace("  section h2 {", "  .lochead { display:flex; align-items:center; gap:14px; } .lochead .badge { flex:0 0 72px; width:72px; height:72px; } .lochead h2 { margin:0; }\n  section h2 {", 1)
(ROOT / "index.html").write_text(H)
print(len(M), "missionaries")
