"""Weekly printable coloring page (letter size) for the Ward Links 'Print & Color' page.
Usage: make_coloring_page.py DATE DATA_JSON ART_IMAGE [--title T] [--ref R]
ART_IMAGE = one black-and-white line-art scene for that week's Come, Follow Me lesson / Scripture Hero (generated line art is OK
for this extra page). Title/ref default to data kids_coloring_page {title, ref}, then kids_hero {name, ref}.
Writes color/coloring-DATE.png (300 dpi) + color/coloring-DATE.pdf and rebuilds color/index.html for that week."""
import sys, json, argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
ap = argparse.ArgumentParser(); ap.add_argument("date"); ap.add_argument("data"); ap.add_argument("art"); ap.add_argument("--title"); ap.add_argument("--ref")
a = ap.parse_args(); D = json.loads(Path(a.data).read_text()); ROOT = Path(__file__).resolve().parents[1]; OUT = ROOT / "color"; OUT.mkdir(exist_ok=True)
cp, hero = D.get("kids_coloring_page") or {}, D.get("kids_hero") or {}
title = a.title or cp.get("title") or hero.get("name") or "Color and Remember Jesus"; ref = a.ref or cp.get("ref") or hero.get("ref", "")
for b in ("justin huff", "cody sorenson"): assert b not in (title + ref).lower()
W, H, M = 2550, 3300, 150
pg = Image.new("L", (W, H), 255); d = ImageDraw.Draw(pg)
SER = "/usr/share/fonts/truetype/sand-box/google/Noto Serif/NotoSerif-VariableFont_wdth,wght.ttf"; SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
ft = ImageFont.truetype(SER, 112); ft.set_variation_by_name("Bold") if hasattr(ft, "set_variation_by_name") else None
fr = ImageFont.truetype(SER, 62); fs = ImageFont.truetype(SANS, 40)
def ctr(y, t, f): w = d.textlength(t, font=f); d.text(((W - w) / 2, y), t, font=f, fill=0)
ctr(M, title, ft); ctr(M + 150, ref, fr)
d.line([(M + 500, M + 245), (W - M - 500, M + 245)], fill=0, width=4)
art = ImageOps.grayscale(Image.open(a.art)); art = art.point(lambda v: 0 if v < 150 else 255)      # pure black outlines, no gray fill
box_t, box_b = M + 300, H - M - 140; aw, ah = W - 2 * M, box_b - box_t; s = min(aw / art.width, ah / art.height)
art = art.resize((int(art.width * s), int(art.height * s)), Image.LANCZOS).point(lambda v: 0 if v < 160 else 255)
x0 = (W - art.width) // 2; pg.paste(art, (x0, box_t)); d.rounded_rectangle([x0 - 14, box_t - 14, x0 + art.width + 14, box_t + art.height + 14], 30, outline=0, width=6)
ctr(H - M - 80, "Farmington Bay 6th Ward  ·  Little Disciples  ·  Color and remember Jesus Christ", fs)
png = OUT / f"coloring-{a.date}.png"; pdf = OUT / f"coloring-{a.date}.pdf"
pg.save(png, dpi=(300, 300)); pg.convert("RGB").save(pdf, "PDF", resolution=300)
thumb = pg.copy(); thumb.thumbnail((900, 1200)); thumb.save(OUT / f"coloring-{a.date}-preview.png")
html = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow"><title>Print &amp; Color · Farmington Bay 6th Ward</title><meta name="theme-color" content="#005175">
<style>:root{{--ink:#2b2420;--soft:#6d625a;--bg:#faf6f0;--card:#fff;--line:#e8dfd3;--accent:#005175;--gold:#c9a24a}}*{{box-sizing:border-box}}
html,body{{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}}
header{{position:relative;background:linear-gradient(160deg,#005175,#003a55);color:#fff;padding:20px 20px 24px;text-align:center;border-bottom-left-radius:22px;border-bottom-right-radius:22px;border-bottom:4px solid var(--gold)}}
header a.back{{position:absolute;left:14px;top:12px;color:#fff;opacity:.85;text-decoration:none;font-size:15px}} header h1{{font:italic 400 28px/1.15 Georgia,serif;margin:18px 0 6px}} header p{{margin:0 auto;max-width:28em;font:italic 15px/1.45 Georgia,serif;opacity:.92}}
main{{max-width:560px;margin:0 auto;padding:16px 14px 30px;text-align:center}} .sheet{{display:block;width:100%;max-width:420px;margin:6px auto 14px;border:1px solid var(--line);border-radius:12px;box-shadow:0 4px 14px rgba(0,0,0,.08);background:#fff}}
.big{{display:block;background:var(--accent);color:#fff;text-decoration:none;font-weight:700;font-size:19px;padding:16px 18px;border-radius:16px;margin:10px 0;border:2px solid var(--gold)}}
.alt{{display:block;background:#e3eef4;color:var(--accent);text-decoration:none;font-weight:600;padding:12px;border-radius:14px}} .soft{{color:var(--soft);font-size:14px}}
footer{{text-align:center;color:var(--soft);font-size:12px;padding:8px 20px 30px}}</style></head><body>
<header><a class="back" href="../">‹ Ward Links</a><h1>Print &amp; Color</h1><p>A new coloring page each week to go with what we are learning about Jesus Christ.</p></header>
<main><h2 style="font:italic 400 22px Georgia,serif;margin:6px 0 2px;color:var(--accent)">{title}</h2><div class="soft">{ref}</div>
<img class="sheet" src="coloring-{a.date}-preview.png" alt="Coloring page: {title}">
<a class="big" href="coloring-{a.date}.pdf" download>⬇ Download &amp; Print (PDF)</a><a class="alt" href="coloring-{a.date}.png" download>Download picture (PNG)</a>
<p class="soft">Letter size (8.5 × 11 in). Optional, just for fun at home.</p></main>
<footer>This is not an official website of The Church of Jesus Christ of Latter-day Saints.</footer></body></html>'''
(OUT / "index.html").write_text(html); print(png, pdf)
