import os,re,html
R='/workspace/fb6-ward-links'
N='#005175'; G='#c9a24a'
HB='https://www.churchofjesuschrist.org/study/manual/general-handbook/'
# symbol paths drawn in 100x100 box, gold strokes
S={
'rs':'<path d="M30 62h40l-6 8H36z" fill="G"/><path d="M34 62c0-8 6-14 16-14h6c8 0 14 6 14 14" fill="none" stroke="G" stroke-width="4"/><path d="M70 56l10-6" stroke="G" stroke-width="4" stroke-linecap="round"/><path d="M50 46c-6-6-6-12 0-20 6 8 6 14 0 20z" fill="#f3d98b"/>',
'eq':'<path d="M36 82V36c0-9 5-14 12-14s12 5 12 12c0 6-4 9-8 9" fill="none" stroke="G" stroke-width="4.5" stroke-linecap="round"/><g fill="#f3d98b"><circle cx="54" cy="64" r="7"/><circle cx="62" cy="60" r="7"/><circle cx="70" cy="64" r="7"/><circle cx="58" cy="70" r="7"/><circle cx="67" cy="71" r="7"/></g><ellipse cx="73" cy="56" rx="6" ry="5" fill="G"/><path d="M69 53l-4-3M77 53l3-3" stroke="G" stroke-width="3" stroke-linecap="round"/><circle cx="75" cy="56" r="1.2" fill="#005175"/><path d="M55 76v7M60 77v6M65 77v6M70 76v7" stroke="G" stroke-width="3" stroke-linecap="round"/>',
'yw':'<path d="M22 70a28 28 0 0 1 56 0z" fill="G"/><path d="M50 28v-8M30 36l-5-5M70 36l5-5M18 54h-6M82 54h6" stroke="G" stroke-width="4" stroke-linecap="round"/><path d="M50 30l3 7 7 .5-5.5 4.5 2 7-6.5-4-6.5 4 2-7-5.5-4.5 7-.5z" fill="#f3d98b" transform="translate(0,-14) scale(1)"/><path d="M16 76h68" stroke="G" stroke-width="4" stroke-linecap="round"/>',
'ym':'<path d="M50 18l26 9v18c0 18-12 29-26 35-14-6-26-17-26-35V27z" fill="none" stroke="G" stroke-width="5" stroke-linejoin="round"/><path d="M32 60l12-16 7 9 5-6 12 13z" fill="G"/>',
'ss':'<path d="M50 34c-10-6-20-7-30-5v40c10-2 20-1 30 5 10-6 20-7 30-5V29c-10-2-20-1-30 5z" fill="none" stroke="G" stroke-width="4.5" stroke-linejoin="round"/><path d="M50 34v40" stroke="G" stroke-width="4"/><path d="M28 40c6-1 11 0 16 2M28 50c6-1 11 0 16 2M56 42c5-2 10-3 16-2M56 52c5-2 10-3 16-2" stroke="#f3d98b" stroke-width="2.5" stroke-linecap="round"/>',
'pr':'<circle cx="50" cy="27" r="7" fill="G"/><path d="M50 15v-3M41 18l-2-2M59 18l2-2M37 27h-3M63 27h3M41 36l-2 2M59 36l2 2" stroke="G" stroke-width="2.6" stroke-linecap="round"/><g fill="#f3d98b"><circle cx="31" cy="50" r="5.5"/><circle cx="50" cy="48" r="5.5"/><circle cx="69" cy="50" r="5.5"/></g><g fill="G"><path d="M25 74l3-17h6l3 17z"/><path d="M45 56h10v14h-10z"/><path d="M63 74l3-17h6l3 17z"/></g><path d="M36 62l9-2M55 60l9 2" stroke="G" stroke-width="3.2" stroke-linecap="round"/><path d="M26 62l-4 6M74 62l4 6" stroke="G" stroke-width="3.2" stroke-linecap="round"/><path d="M29 74v8M33 74v8M47 70v12M53 70v12M67 74v8M71 74v8" stroke="G" stroke-width="3" stroke-linecap="round"/>',
'tfh':'<path d="M58 13l2.2 12h-4.4z" fill="G"/><path d="M55 25h6v6h-6zM53 31h10v8H53zM50 39h16v10H50z" fill="G"/><path d="M40 49h36v31H40z" fill="G"/><path d="M40 49l4-6 4 6zM68 49l4-6 4 6z" fill="G"/><g fill="#005175"><path d="M55.5 80V71a2.5 2.5 0 0 1 5 0v9z"/><rect x="44" y="56" width="3" height="8" rx="1.5"/><rect x="51" y="56" width="3" height="8" rx="1.5"/><rect x="62" y="56" width="3" height="8" rx="1.5"/><rect x="69" y="56" width="3" height="8" rx="1.5"/><rect x="56.8" y="42" width="2.4" height="5" rx="1.2"/></g><path d="M26 80V58M26 66l-6-6M26 62l5-6M26 70l6-4" stroke="#f3d98b" stroke-width="2.6" stroke-linecap="round"/><g fill="#f3d98b"><circle cx="26" cy="52" r="4"/><circle cx="19" cy="58" r="3.5"/><circle cx="32" cy="54" r="3.5"/><circle cx="33" cy="65" r="3"/></g><path d="M18 80h64" stroke="G" stroke-width="4" stroke-linecap="round"/>',
'mi':'<circle cx="50" cy="46" r="24" fill="none" stroke="G" stroke-width="4.5"/><path d="M26 46h48M50 22c9 7 9 41 0 48M50 22c-9 7-9 41 0 48M30 34h40M30 58h40" fill="none" stroke="G" stroke-width="2.5"/><rect x="30" y="72" width="40" height="12" rx="3" fill="#f3d98b"/><path d="M37 78h26" stroke="'+N+'" stroke-width="2.5" stroke-linecap="round"/>',
'eqb':'<path d="M16 50h18v14H16z" fill="G"/><path d="M84 54H66v14h18z" fill="#f3d98b"/><rect x="33" y="48" width="4" height="18" rx="1.5" fill="#f3d98b"/><rect x="63" y="52" width="4" height="18" rx="1.5" fill="G"/><path d="M37 50h14c4 0 6 2 9 4l3 2v12H50c-5 0-13-4-13-9z" fill="G"/><path d="M63 54H52c-5 0-8 3-8 6s3 4 6 4h4l-2 3c-1 2 1 4 3 3l8-5z" fill="#f3d98b"/><path d="M44 60c4 0 8-1 11-3" stroke="#005175" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M50 64h7M51 68h6" stroke="#005175" stroke-width="1.6" stroke-linecap="round"/>',
'ywb':'<path d="M36.6 36.8L31.3 39.5" stroke="#f3d98b" stroke-width="1.8" stroke-linecap="round"/><path d="M35.0 29.4L29.0 29.2" stroke="#f3d98b" stroke-width="1.8" stroke-linecap="round"/><path d="M37.2 22.2L32.1 19.0" stroke="#f3d98b" stroke-width="1.8" stroke-linecap="round"/><path d="M42.7 16.9L39.7 11.7" stroke="#f3d98b" stroke-width="1.8" stroke-linecap="round"/><path d="M50.0 15.0L50.0 9.0" stroke="#f3d98b" stroke-width="1.8" stroke-linecap="round"/><path d="M57.3 16.9L60.3 11.7" stroke="#f3d98b" stroke-width="1.8" stroke-linecap="round"/><path d="M62.8 22.2L67.9 19.0" stroke="#f3d98b" stroke-width="1.8" stroke-linecap="round"/><path d="M65.0 29.4L71.0 29.2" stroke="#f3d98b" stroke-width="1.8" stroke-linecap="round"/><path d="M63.4 36.8L68.7 39.5" stroke="#f3d98b" stroke-width="1.8" stroke-linecap="round"/><path d="M50 14C59 24 61 33 50 41C39 33 41 24 50 14z" fill="#f3d98b"/><path d="M50 25C54 30 54 35 50 39C46 35 46 30 50 25z" fill="G"/><path d="M42 43H58L55.5 50H44.5z" fill="G"/><path d="M46.5 50H53.5L51.5 84H48.5z" fill="G"/><path d="M43.5 46.5H56.5" stroke="#005175" stroke-width="1.2"/>',
'ywc':'<path d="M20 80L38 58 46 66 56 52 80 80z" fill="G"/><path d="M50 58l6-6 5 6-5-2z" fill="#f3d98b"/><path d="M56 52V20" stroke="G" stroke-width="2.8" stroke-linecap="round"/><path d="M56 21C63 18 68 25 76 22V36C68 39 63 32 56 35z" fill="#f3d98b"/><path d="M40.0 22.0 L41.5 26.0 L45.7 26.1 L42.4 28.8 L43.5 32.9 L40.0 30.5 L36.5 32.9 L37.6 28.8 L34.3 26.1 L38.5 26.0z" fill="#f3d98b"/>',
}
S['yw']=S['ywb']
def logo(k,size=64,cls='logo'):
    return (f'<svg class="{cls}" width="{size}" height="{size}" viewBox="0 0 100 100" role="img" aria-hidden="true">'
      f'<circle cx="50" cy="50" r="48" fill="{N}"/><circle cx="50" cy="50" r="43" fill="none" stroke="{G}" stroke-width="2"/>'
      f'<circle cx="50" cy="50" r="40" fill="none" stroke="{G}" stroke-width=".8" opacity=".6"/>'
      +S[k].replace('"G"',f'"{G}"')+'</svg>')
O=[('rs','relief-society','Relief Society','Charity Never Faileth','“Willing to bear one another’s burdens, that they may be light; yea, and … to mourn with those that mourn; yea, and comfort those that stand in need of comfort.”','Mosiah 18:8–9','9-relief-society'),
('eq','elders-quorum','Elders Quorum','Brethren of the Covenant','“Feed my sheep.”','John 21:17','8-elders-quorum'),
('yw','young-women','Young Women','Beloved Daughters','“Arise and shine forth, that thy light may be a standard for the nations.”','D&amp;C 115:5','11-young-women'),
('ym','young-men','Young Men','Sons of God','“Be thou an example of the believers.”','1 Timothy 4:12','10-aaronic-priesthood'),
('ss','sunday-school','Sunday School','Come, Follow Me','“Search the scriptures; … they are they which testify of me.”','John 5:39','13-sunday-school'),
('pr','primary','Primary','I Am a Child of God','“Suffer the little children to come unto me.”','Mark 10:14','12-primary'),
('tfh','temple-and-family-history','Temple and Family History','Holiness to the Lord','“He shall turn the heart of the fathers to the children.”','Malachi 4:6','25-temple-and-family-history-work-in-the-ward-and-stake'),
('mi','ward-missionaries','Ward Missionaries','Preach My Gospel','“Go ye into all the world, and preach the gospel.”','Mark 16:15','23-sharing-the-gospel-and-strengthening-new-members')]
# home section
css='''
  .orgs { margin-top:22px; } .orgs h2 { font:italic 400 21px/1.2 Georgia, serif; margin:0 0 4px; }
  .orgs .sub { color:var(--soft); font-size:14px; margin:0 0 10px; }
  .org-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .org { display:flex; flex-direction:column; align-items:center; text-align:center; gap:8px; background:var(--card); border:1px solid var(--line);
    border-top:4px solid #c9a24a; border-radius:16px; padding:16px 10px 14px; text-decoration:none; color:inherit; box-shadow:0 1px 2px rgba(59,47,42,.06); }
  .org:active { transform:scale(.99); background:#f3f8fb; }
  .org svg { width:64px; height:64px; filter:drop-shadow(0 2px 4px rgba(0,48,87,.25)); }
  .org b { font-size:15.5px; line-height:1.2; } .org i { font:italic 14px/1.3 Georgia, serif; color:#8a6d22; }
  @media (prefers-color-scheme: dark) { .org i { color:#e2c47a; } }
'''
cards=''.join(f'\n      <a class="org" href="orgs/{sl}/">{logo(k)}<b>{nm}</b><i>{th}</i></a>' for k,sl,nm,th,*_ in O)
sec=f'''  <section class="orgs" id="organizations">
    <h2>Our Organizations</h2>
    <p class="sub">Presidencies, activities, and resources for each Ward organization.</p>
    <div class="org-grid">{cards}
    </div>
  </section>
'''
p=f'{R}/index.html'; s=open(p).read()
exec(open('/workspace/cover.py').read())
s=re.sub(r'\n  <svg class="cover".*?</svg>','',s,flags=re.S)
s=s.replace('  <div class="ward">Farmington Bay 6th Ward</div>\n','',1)
s=s.replace('<header>\n','<header>\n  '+badge('icons/christus-512.png',150)+'\n',1)
if '.cover {' not in s: s=s.replace('</style>\n</head>','  header .cover { display:block; margin:2px auto 14px; filter:drop-shadow(0 8px 18px rgba(0,0,0,.35)); }\n  @media (min-width:700px) { header .cover { width:180px; height:180px; } }\n</style>\n</head>',1)
s=s if 'class="orgs"' in s else s.replace('</style>\n</head>',css+'</style>\n</head>',1)
s=re.sub(r'  <section class="orgs" id="organizations">.*?</section>\n','',s,flags=re.S)
s=s.replace('  <section id="missionaries" class="miss">',sec+'  <section id="missionaries" class="miss">',1)
open(p,'w').write(s)
PH='<span class="ph">Placeholder</span>'
# Adam 2026-10-30: YW class tabs
YWCSS='''  .yt {{ padding:14px 14px 16px; }} .yt input {{ position:absolute; opacity:0; pointer-events:none; }}
  .yt .tabs {{ display:flex; gap:6px; background:#eef4f7; border-radius:12px; padding:4px; }}
  .yt label {{ flex:1; text-align:center; padding:9px 4px; border-radius:9px; font:600 13px/1.2 -apple-system, sans-serif; color:var(--navy); cursor:pointer; }}
  .yt .pane {{ display:none; padding:14px 2px 0; }} .yt .pane h3 {{ font:italic 400 19px/1.2 Georgia, serif; margin:0 0 6px; color:var(--accent); }}
  #yt1:checked ~ .tabs [for=yt1], #yt2:checked ~ .tabs [for=yt2], #yt3:checked ~ .tabs [for=yt3] {{ background:var(--navy); color:#fff; box-shadow:inset 0 -3px 0 var(--gold); }}
  #yt1:checked ~ .p1, #yt2:checked ~ .p2, #yt3:checked ~ .p3 {{ display:block; }}
  @media (prefers-color-scheme: dark) {{ .yt .tabs {{ background:#1d1916; }} .yt label {{ color:#8cc8e6; }} }}
'''
YWTABS='''  <section class="yt" aria-label="Young Women classes">
    <input type="radio" name="yt" id="yt1" checked><input type="radio" name="yt" id="yt2"><input type="radio" name="yt" id="yt3">
    <div class="tabs"><label for="yt1">Gatherers of Light</label><label for="yt2">Messengers of Hope</label><label for="yt3">Builders of Faith</label></div>
    <div class="pane p1"><h3>Gatherers of Light</h3><p class="note">Class info, activities and announcements coming soon.</p></div>
    <div class="pane p2"><h3>Messengers of Hope</h3><p class="note">Class info, activities and announcements coming soon.</p></div>
    <div class="pane p3"><h3>Builders of Faith</h3><p class="note">Class info, activities and announcements coming soon.</p></div>
  </section>
'''
for k,sl,nm,th,q,ref,hb in O:
    d=f'{R}/orgs/{sl}'; os.makedirs(d,exist_ok=True)
    open(d+'/index.html','w').write(f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>{nm} · Farmington Bay 6th Ward</title>
<meta name="theme-color" content="#005175">
<link rel="icon" type="image/png" sizes="32x32" href="../../icons/christus-favicon-32.png?v=christus2">
<style>
  :root {{ --ink:#2b2420; --soft:#6d625a; --bg:#faf6f0; --card:#fff; --line:#e8dfd3; --accent:#005175; --navy:#005175; --gold:#c9a24a; }}
  * {{ box-sizing:border-box; }}
  html,body {{ margin:0; background:var(--bg); color:var(--ink); font:16px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }}
  header {{ background:linear-gradient(160deg,#005175,#003a55); color:#fff; padding:18px 20px 30px; text-align:center; border-bottom-left-radius:22px; border-bottom-right-radius:22px; border-bottom:4px solid var(--gold); }}
  header .back {{ display:block; text-align:left; color:#e2c47a; text-decoration:none; font-size:14px; margin-bottom:10px; }}
  header svg {{ width:120px; height:120px; filter:drop-shadow(0 6px 14px rgba(0,0,0,.35)); }}
  header .ward {{ font:600 13px/1 Georgia, serif; letter-spacing:.14em; text-transform:uppercase; opacity:.85; margin-top:12px; }}
  header h1 {{ font:400 28px/1.15 Georgia, serif; margin:8px 0 4px; }}
  header .theme {{ font:italic 20px/1.3 Georgia, serif; color:#e2c47a; }}
  header p {{ margin:12px auto 0; max-width:30em; font:italic 15px/1.45 Georgia, serif; opacity:.92; }}
  header cite {{ display:block; font-style:normal; font-size:12px; opacity:.75; margin-top:4px; }}
  main {{ max-width:560px; margin:0 auto; padding:18px 14px 30px; }}
  section {{ background:var(--card); border:1px solid var(--line); border-radius:16px; padding:16px; margin:12px 0; box-shadow:0 1px 2px rgba(59,47,42,.06); }}
  section h2 {{ font:italic 400 21px/1.2 Georgia, serif; margin:0 0 8px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }}
  .ph {{ font:700 10.5px/1 -apple-system, sans-serif; letter-spacing:.08em; text-transform:uppercase; color:#8a6d22; background:#f6ecd2; border:1px dashed #c9a24a; border-radius:999px; padding:4px 8px; }}
  .note {{ color:var(--soft); font-size:14px; margin:0 0 6px; }}
  ul {{ list-style:none; padding:0; margin:0; }} li {{ padding:9px 0; border-top:1px solid var(--line); font-size:14.5px; }}
  li span {{ color:var(--soft); }} .dim {{ color:#b3a89d; }}
  .btn {{ display:inline-block; padding:10px 14px; border-radius:12px; background:var(--navy); color:#fff; text-decoration:none; font-weight:600; font-size:15px; margin:6px 6px 0 0; }}
  .btn.off {{ background:#e6e1da; color:#8b8178; }}
  a.res {{ display:block; color:var(--accent); text-decoration:none; padding:9px 0; border-top:1px solid var(--line); font-size:15px; }}
  .ev {{ display:flex; gap:12px; border-top:1px solid var(--line); padding:12px 0; }} .ev[hidden] {{ display:none; }}
  .thumb {{ flex:0 0 84px; }} .thumb img {{ width:84px; height:110px; object-fit:cover; border-radius:10px; border:1px solid var(--line); display:block; }}
  .evtx {{ flex:1; min-width:0; }} .evtx b {{ display:block; font-size:16px; line-height:1.25; }} .evtx small {{ display:block; color:var(--soft); font-size:13px; margin-top:2px; }}
  .when {{ margin:6px 0 0; font-weight:600; color:var(--accent); font-size:14px; }} .where {{ margin:2px 0 8px; font-size:13.5px; }}
  .acts {{ display:flex; flex-wrap:wrap; gap:6px; }} .acts .btn {{ margin:0; padding:7px 11px; font-size:13.5px; border-radius:10px; }} .btn.alt {{ background:#e3eef4; color:var(--navy); }}
  .empty, .more {{ color:var(--soft); font-size:14px; margin:8px 0 0; }} .empty a, .more a {{ color:var(--accent); }}
  footer {{ text-align:center; color:var(--soft); font-size:11.5px; padding:8px 20px 36px; }}
  @media (prefers-color-scheme: dark) {{ :root {{ --ink:#f3ece4; --soft:#bfb2a5; --bg:#1d1916; --card:#27211d; --line:#3a312a; --accent:#8cc8e6; }} .ph {{ background:#3a301c; color:#e2c47a; }} }}
{YWCSS if k=='yw' else ''}</style><script src="../../nav.js" defer></script></head><body>
<header>
  <a class="back" href="../../">‹ The Bay 6 Hub</a>
  {logo(k,120,'hero')}
  <div class="ward">Farmington Bay 6th Ward</div>
  <h1>{nm}</h1><div class="theme">{th}</div>
  <p>{q}<cite>{ref}</cite></p>
</header>
<main>
  <section><h2>Presidency &amp; Contact {PH}</h2>
    <p class="note">Names and contact details will be added once approved.</p>
    <ul><li><b class="dim">[Name]</b> <span>President</span></li><li><b class="dim">[Name]</b> <span>Counselor</span></li>
    <li><b class="dim">[Name]</b> <span>Counselor</span></li><li><b class="dim">[Name]</b> <span>Secretary</span></li></ul>
    <span class="btn off">Text the Presidency</span></section>
{YWTABS if k=='yw' else ''}  <section><h2>Upcoming Activities</h2>
<!--EV-->
<!--/EV-->
    <p class="empty" id="empty" hidden>No upcoming activities right now. See all <a href="../../events/">Upcoming Events</a>.</p>
    <p class="more" id="more">See all <a href="../../events/">Upcoming Events</a> for the Ward and Stake.</p></section>
  <section><h2>Sign-ups {PH}</h2>
    <p class="note">Service, meals, rides, and assignments sign-up links will go here.</p><span class="btn off">[Sign-up link]</span></section>
  <section><h2>Resources</h2>
    <a class="res" href="{HB}{hb}?lang=eng" rel="noopener">General Handbook: {html.escape(nm) if k not in ('ym','mi','tfh') else {'ym':'Aaronic Priesthood','mi':'Sharing the Gospel','tfh':'Temple and Family History Work'}[k]} ›</a>
    <a class="res" href="https://www.churchofjesuschrist.org/calendar" rel="noopener">Ward Calendar ›</a>
    <p class="note" style="margin-top:8px">{PH} More resources to be added.</p></section>
</main>
<footer>This is not an official website of The Church of Jesus Christ of Latter-day Saints.</footer>
<script>(function(){{var n=Date.now(),k=0;document.querySelectorAll('.ev').forEach(function(e){{var d=Date.parse(e.dataset.end);if(d&&d<n)e.hidden=true;else k++;}});
if(!k){{document.getElementById('empty').hidden=false;document.getElementById('more').hidden=true;}}}})();</script>
</body></html>''')
# logos sheet
t=''.join(f'<div style="text-align:center;width:220px;margin:16px">{logo(k,160)}<div style="font:600 17px Georgia,serif;margin-top:8px">{nm}</div><div style="font:italic 15px Georgia,serif;color:#8a6d22">{th}</div></div>' for k,sl,nm,th,*_ in O)
open('/workspace/orgs-preview/logos.html','w').write(f'<html><body style="margin:0;background:#faf6f0;color:#2b2420;display:flex;flex-wrap:wrap;justify-content:center;padding:20px">{t}</body></html>')
