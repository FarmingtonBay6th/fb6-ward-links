#!/usr/bin/env python3
"""Render orgs/contacts.json into each org page's Presidency & Contact section."""
import json,os,re
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=json.load(open(f'{R}/orgs/contacts.json'))
CSS='  .pc li { display:flex; align-items:center; gap:10px; } .pc .who { flex:1; min-width:0; } .pc .who b { display:block; font-size:15.5px; } .pc .who span { font-size:13px; }\n  .pc .txt { margin:0; padding:8px 14px; font-size:14px; border-radius:10px; } .pc .gap { color:#8a6d22; font-style:italic; }\n'
# Never show phone numbers: Text button only; the number stays in the sms: link
def fmt(p): return f'({p[2:5]}) {p[5:8]}-{p[8:]}'
for slug,people in D.items():
    if slug.startswith('_'): continue
    p=f'{R}/orgs/{slug}/index.html'; s=open(p).read()
    full=all(n and ph for n,_,ph in people)
    lis=''
    for n,role,ph in people:
        name=f'<b>{n}</b>' if n else '<b class="gap">To be confirmed</b>'
        sub=role
        btn=f'<a class="btn txt" aria-label="Text {n or role}" href="sms:{ph}">Text</a>' if ph else ''
        lis+=f'\n      <li><div class="who">{name}<span>{sub}</span></div>{btn}</li>'
    head='Presidency &amp; Contact' if slug not in ('temple-and-family-history','ward-missionaries','young-men') else 'Leaders &amp; Contact'
    badge='' if full else ' <span class="ph">Gaps</span>'
    note='<p class="note">Tap <b>Text</b> to send a message.</p>' 
    sec=f'<section class="pc"><h2>{head}{badge}</h2>\n    {note}\n    <ul>{lis}\n    </ul></section>'
    s=re.sub(r'<section( class="pc")?><h2>(Presidency|Leaders) &amp; Contact.*?</section>',lambda m:sec,s,count=1,flags=re.S)
    if '.pc li' not in s: s=s.replace('</style>',CSS+'</style>',1)
    open(p,'w').write(s)

# Group "Text All" button on every card (also covers hand-built pages)
import importlib.util as _u, os as _o
_s=_u.spec_from_file_location("ata", _o.path.join(R,"tools","add_text_all.py")); _m=_u.module_from_spec(_s); _s.loader.exec_module(_m); _m.run()
