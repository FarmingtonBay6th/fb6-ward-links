#!/usr/bin/env python3
"""Build this-sunday/index.html + the home-page 'This Sunday' banner from one week's program JSON.
Usage: python3 tools/build_this_sunday.py PROGRAM_JSON [--kids PAGE3_PNG] [--sample]
Only items printed on the paper program are used. Phone numbers are stripped."""
import json,os,re,sys,html,shutil,datetime,urllib.request
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
a=sys.argv[1:]; src=a[0]; sample='--sample' in a
kids=a[a.index('--kids')+1] if '--kids' in a else None
d=json.load(open(src)); E=lambda s:html.escape(str(s),quote=False)
BLOCK=('justin huff','cody sorenson')
PHONE=re.compile(r'[;,]?\s*(?:[A-Z][a-z]+ [A-Z][a-z]+,\s*)?\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}')
def clean(s): return PHONE.sub('',str(s)).strip(' ;,')
dt=datetime.date.fromisoformat(d['date'])
fast=dt.day<=7
label=f"{dt:%a}, {dt:%b} {dt.day}"
mtitle='Fast and Testimony Meeting' if fast else 'Sacrament Meeting'
def hymn(s):
    m=re.match(r'#?(\d+)\s*[—-]\s*(.+)',s or '')
    if not m: return E(s or ''),None
    n,t=m.groups(); slug=re.sub(r'[^a-z0-9]+','-',t.lower().replace('’','').replace("'",'')).strip('-')
    url=f'https://www.churchofjesuschrist.org/media/music/songs/{slug}?lang=eng'
    try:
        req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
        body=urllib.request.urlopen(req,timeout=20).read(200000).decode('utf8','ignore')
        ok=t.split('?')[0].lower() in html.unescape(body).lower()
    except Exception: ok=False
    return f'<span class="num">{n}</span> {E(t)}',(url if ok else None)
A=d['agenda']; C=d.get('conducting') or {}
rows=[]
def row(label,val,url=None,kind=''):
    v=f'<a href="{url}" rel="noopener">{val} <span class="ext">♪</span></a>' if url else val
    rows.append(f'<li class="{kind}"><span class="lab">{E(label)}</span><span class="val">{v}</span></li>')
h,u=hymn(C.get('opening_hymn')); row('Opening Hymn',h,u,'hy')
row('Invocation',E(A.get('invocation','')))
row('Ward and Stake Business','')
h,u=hymn(C.get('sacrament_hymn')); row('Sacrament Hymn',h,u,'hy')
for it in d.get('program',[]):
    if it[0]=='divider': rows.append(f'<li class="div"><span>{E(it[1])}</span></li>')
    elif it[0]=='row':
        lab=it[1]; val=it[2] if len(it)>2 else ''
        if 'hymn' in lab.lower(): h,u=hymn(val); row(lab,h,u,'hy')
        else: row(lab,E(val))
if fast and not d.get('program'): rows.append('<li class="div"><span>Bearing of Testimonies</span></li>')
if C.get('special'): row('Musical Number',E(C['special']))
h,u=hymn(C.get('closing_hymn')); row('Closing Hymn',h,u,'hy')
row('Benediction',E(A.get('benediction','')))
rows=[r for r in rows if '<span class="val"></span>' not in r or 'Business' in r]
rows=[r.replace('<span class="val"></span>','') for r in rows]
ann=[a for a in C.get('announcements',[]) if 'page 4' not in a]
up=[]
for x in d.get('upcoming',[]):
    when=x.get('weekly') or (lambda q:f"{q:%a}, {q:%b} {q.day}")(datetime.date.fromisoformat(x['date']))
    if x.get('date') and x['date']<d['date']: continue
    up.append(f'<li><b>{E(x["title"])}</b><span class="when">{E(when)}</span><span>{E(clean(x.get("short","")))}</span></li>')
cfm=d.get('come_follow_me') or {}
kc=d.get('kids_challenge') or {}; mem=d.get('kids_memory_scripture')
kimg=''
if kids:
    fn=f'little-disciples-{d["date"]}.png'; shutil.copy(kids,f'{R}/this-sunday/{fn}')
    kimg=f'<a class="kids" href="{fn}"><img src="{fn}" alt="Little Disciples kids page" loading="lazy"></a><a class="btn" href="{fn}" download>Download the kids page</a>'
hs=d.get('hymn_spotlight')
S='<div class="sample">SAMPLE · built from the Oct 25 program for preview</div>' if sample else ''
page=f'''<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="robots" content="noindex, nofollow">
<title>This Sunday · Farmington Bay 6th Ward</title><meta name="theme-color" content="#005175">
<link rel="icon" type="image/png" sizes="32x32" href="../icons/cover-favicon-32.png?v=cover1">
<style>
:root{{--ink:#2b2420;--soft:#6d625a;--bg:#faf6f0;--card:#fff;--line:#e8dfd3;--blue:#005175;--gold:#c9a24a;--goldt:#8a6d22}}
*{{box-sizing:border-box}} html,body{{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}}
header{{background:linear-gradient(160deg,#005175,#003a55);color:#fff;text-align:center;padding:16px 20px 26px;border-bottom:4px solid var(--gold);border-radius:0 0 22px 22px}}
header .back{{display:block;text-align:left;color:#e2c47a;text-decoration:none;font-size:14px;margin-bottom:8px}}
.kicker{{font:600 12.5px/1 Georgia,serif;letter-spacing:.16em;text-transform:uppercase;color:#e2c47a}}
h1{{font:italic 400 32px/1.1 Georgia,serif;margin:10px 0 4px}} .mt{{font:400 19px Georgia,serif}} .meta{{margin-top:10px;font-size:14.5px;opacity:.92}}
.sample{{display:inline-block;margin-top:12px;background:#f6ecd2;color:var(--goldt);border:1px dashed var(--gold);border-radius:999px;padding:5px 12px;font:700 11px/1.2 -apple-system,sans-serif;letter-spacing:.06em}}
main{{max-width:600px;margin:0 auto;padding:16px 14px 30px}}
.lead{{display:grid;grid-template-columns:1fr 1fr;gap:8px;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px 14px}}
.lead div span{{display:block;font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--soft)}} .lead div b{{font-size:15.5px}}
details{{background:var(--card);border:1px solid var(--line);border-radius:16px;margin:12px 0;box-shadow:0 1px 2px rgba(59,47,42,.06)}}
summary{{list-style:none;cursor:pointer;padding:14px 16px;font:italic 400 21px/1.2 Georgia,serif;display:flex;align-items:center;gap:10px}}
summary::-webkit-details-marker{{display:none}} summary::after{{content:"›";margin-left:auto;color:var(--gold);font:400 26px/1 sans-serif;transform:rotate(90deg);transition:.2s}}
details:not([open]) summary::after{{transform:none}} .in{{padding:0 16px 14px}}
ol.order{{list-style:none;margin:0;padding:0}} .order li{{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid var(--line)}}
.order .lab{{color:var(--soft);font-size:14px;flex:0 0 auto}} .order .val{{text-align:right;font-weight:600}} .order a{{color:var(--blue);text-decoration:none}}
li.hy{{flex-direction:column;gap:3px}} li.hy .val{{text-align:left}}
.num{{display:inline-block;min-width:34px;padding:1px 6px;margin-right:4px;border-radius:7px;background:#e3eef4;color:var(--blue);font-size:13px;text-align:center}} .ext{{color:var(--gold)}}
.order li.div{{justify-content:center;font:italic 16px Georgia,serif;color:var(--goldt);background:#fbf6ea;border-radius:10px;margin:6px 0;border-top:0}}
ul.list{{list-style:none;margin:0;padding:0}} .list li{{padding:10px 0;border-top:1px solid var(--line);font-size:14.5px}} .list b{{display:block}} .list .when{{display:block;color:var(--blue);font-weight:600;font-size:13.5px}}
.btn{{display:inline-block;margin-top:10px;padding:10px 14px;border-radius:12px;background:var(--blue);color:#fff;text-decoration:none;font-weight:600;font-size:15px}}
.kids img{{display:block;width:100%;max-width:340px;margin:4px auto 0;border:1px solid var(--line);border-radius:10px}}
.steps{{margin:8px 0 0;padding-left:20px}} .steps li{{margin:5px 0}} .q{{font:italic 15px/1.45 Georgia,serif}} .note{{color:var(--soft);font-size:13.5px}}
footer{{text-align:center;color:var(--soft);font-size:11.5px;padding:8px 20px 36px}}
@media(min-width:760px){{main{{max-width:720px}} h1{{font-size:40px}}}}
</style></head><body>
<header><a class="back" href="../">‹ Ward Links</a><div class="kicker">Farmington Bay 6th Ward · This Sunday</div>
<h1>{E(f"{dt:%A}, {dt:%B} {dt.day}")}</h1><div class="mt">{mtitle}</div>
<div class="meta">12:00 PM · Stake Center chapel (Eagle Shore building)</div>{S}</header>
<main>
<div class="lead"><div><span>Presiding</span><b>{E(A.get("presiding",""))}</b></div><div><span>Conducting</span><b>{E(A.get("conducting",""))}</b></div>
<div><span>Chorister</span><b>{E(C.get("chorister",""))}</b></div><div><span>Organist</span><b>{E(C.get("organist",""))}</b></div></div>
<details open><summary>Order of Meeting</summary><div class="in"><ol class="order">{"".join(rows)}</ol><p class="note">Tap a hymn to open it in the Church’s music library.</p></div></details>
<details open><summary>Announcements</summary><div class="in"><ul class="list">{"".join(up)}</ul><a class="btn" href="../events/">See all Upcoming Events</a></div></details>
<details open><summary>Little Disciples</summary><div class="in"><p class="note">A page for children. Think about Jesus as you solve each puzzle.</p>
{"<ol class='steps'>"+"".join(f"<li>{E(s)}</li>" for s in kc.get("steps",[]))+"</ol>" if kc.get("steps") else ""}
{f'<p class="q">Scripture to Remember: “{E(mem[0])}” {E(mem[1])}</p>' if mem else ""}{kimg}</div></details>
<details><summary>Come, Follow Me</summary><div class="in"><p><b>{E(cfm.get("title",""))}</b><br><span class="note">{E(cfm.get("dates",""))} · {E(cfm.get("scriptures",""))}</span></p>
{f'<p class="q">{E(cfm["question"])}</p>' if cfm.get("question") else ""}<a class="btn" href="{cfm.get("url","https://www.churchofjesuschrist.org/study/come-follow-me")}" rel="noopener">Open this week’s lesson</a></div></details>
{f'<details><summary>Hymn Spotlight</summary><div class="in"><p><b><span class="num">{E(hs["hymn"])}</span> {E(hs["title"])}</b></p><p>{E(hs.get("text",""))}</p><p class="q">{E(hs.get("points_to_christ",""))}</p></div></details>' if hs else ""}
</main><footer>This is not an official website of The Church of Jesus Christ of Latter-day Saints.</footer></body></html>'''
low=page.lower(); assert not any(b in low for b in BLOCK), 'blocked name present'
assert not re.search(r'\d{3}[-. ]\d{3}[-. ]\d{4}',re.sub(r'<[^>]+>','',page)), 'phone number present'
open(f'{R}/this-sunday/index.html','w').write(page)
# home banner
p=f'{R}/index.html'; s=open(p).read()
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); from build_icons import ICONS
ban=(f'<!--TS--><a class="ts" href="this-sunday/">{ICONS["this-sunday"]}<span class="ts-k">This Sunday{" · SAMPLE" if sample else ""}</span>'
     f'<b>{E(label)} · {mtitle}</b><small>12:00 PM · Program, hymns, announcements, and the kids page</small><span class="ts-go">›</span></a><!--/TS-->')
s=re.sub(r'<!--TS-->.*?<!--/TS-->\n?','',s,flags=re.S)
s=s.replace('<main>\n','<main>\n  '+ban+'\n',1)
if '.ts .badge' not in s: s=s.replace('  .ts-k {','  .ts .badge { position:absolute; left:14px; top:50%; transform:translateY(-50%); width:54px; height:54px; } .ts { padding-left:80px !important; }\n  .ts-k {',1)
if '.ts {' not in s: s=s.replace('</style>\n</head>','''  .ts { position:relative; display:block; text-decoration:none; color:#fff; background:linear-gradient(150deg,#005175,#003a55); border:1px solid #c9a24a;
    border-left:6px solid #c9a24a; border-radius:16px; padding:14px 40px 14px 16px; margin:0 0 12px; box-shadow:0 4px 14px rgba(0,58,85,.25); }
  .ts-k { display:block; font:600 11.5px/1 Georgia, serif; letter-spacing:.16em; text-transform:uppercase; color:#e2c47a; }
  .ts b { display:block; font:italic 400 21px/1.25 Georgia, serif; margin:6px 0 3px; } .ts small { display:block; font-size:13.5px; opacity:.9; }
  .ts-go { position:absolute; right:14px; top:50%; transform:translateY(-50%); color:#e2c47a; font-size:30px; }
</style>
</head>''',1)
open(p,'w').write(s)
print('built',d['date'],mtitle)
