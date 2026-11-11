"""Refreshes the Say Hello list on Our Missionaries Serving Worldwide (missionaries/index.html).
Emails come from the program builder's MISSIONARIES list (build_program_4page.py); nothing is invented.
Does not change Missionaries in Our Area or who gets texted. 2026-10-29 (Adam)."""
import re, ast
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
B = Path("/workspace/sacrament/program-4page/build_program_4page.py").read_text()
M = ast.literal_eval(re.search(r"^MISSIONARIES = (\[.*?^\])", B, re.S | re.M).group(1))
M = sorted(M, key=lambda m: (m[0].split()[-1].lower(), m[0].lower()))
def enc(t):   # reversed + base64, so no address (and no '@') is ever in the HTML
    import base64
    return base64.b64encode(t[::-1].encode()).decode()
def card(m):
    name, email, place = m[0], m[1], m[2]
    user, dom = email.split("@")
    return (f'    <div class="mcard"><div class="who"><b>{name}</b><span>{place}</span></div>'
            f'<a class="hello" href="#write" data-u="{enc(user)}" data-d="{enc(dom)}" aria-label="Say hello to {name} by email"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M4 7l8 6 8-6"/></svg>Say hello</a></div>')
page_path = ROOT / "missionaries" / "index.html"
page = page_path.read_text()
block = "<!--SERVING-->\n" + "\n".join(card(m) for m in M) + "\n<!--/SERVING-->"
page2, n = re.subn(r"<!--SERVING-->.*?<!--/SERVING-->", block, page, count=1, flags=re.S)
if n != 1:
    raise SystemExit("serving list markers are missing from missionaries/index.html")
page_path.write_text(page2)
print(len(M), "missionaries")
