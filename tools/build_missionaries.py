"""Refreshes the Say Hello list on the Ward Missionaries page and keeps missionaries/index.html
as a redirect to that page. Emails come from the program builder's MISSIONARIES list
(build_program_4page.py); nothing is invented. 2026-10-29 (Adam)."""
import re, ast, urllib.parse
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
REDIRECT = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0; url=../orgs/ward-missionaries/#our-missionaries">
<link rel="canonical" href="../orgs/ward-missionaries/#our-missionaries">
<title>Our Missionaries · Farmington Bay 6th Ward</title>
<script>location.replace("../orgs/ward-missionaries/#our-missionaries");</script>
</head>
<body>
<p><a href="../orgs/ward-missionaries/#our-missionaries">Our Missionaries</a></p>
</body>
</html>
"""
(ROOT / "missionaries" / "index.html").write_text(REDIRECT)
ward_path = ROOT / "orgs" / "ward-missionaries" / "index.html"
ward = ward_path.read_text()
block = "<!--SERVING-->\n" + "\n".join(card(m) for m in M) + "\n<!--/SERVING-->"
ward2, n = re.subn(r"<!--SERVING-->.*?<!--/SERVING-->", block, ward, count=1, flags=re.S)
if n != 1:
    raise SystemExit("serving list markers are missing from orgs/ward-missionaries/index.html")
ward_path.write_text(ward2)
print(len(M), "missionaries")
