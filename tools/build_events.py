#!/usr/bin/env python3
"""Render events/events.json into events/index.html and each orgs/<slug>/index.html.
Edit events.json (add an entry with an "orgs" list), then run: python3 tools/build_events.py

Cards stay through the America/Denver calendar day of "end" and are left out of
the render starting the next day. tools/prune_events.py is what deletes the
record and the flyer file; this script only skips expired rows. It still
replaces each organization's <!--EV--> block, so hand-added cards in that block
are not preserved here. The daily prune edits those pages in place instead.
"""
import json,re,os,sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from prune_events import denver_today, still_current_instant
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
E=json.load(open(f'{R}/events/events.json'))['events']
TODAY=denver_today()
E=[e for e in E if still_current_instant(e.get('end'), TODAY)]
def art(e,pre):
    f=pre+e['flyer']
    def button(x):
        href=x['href'] if re.match(r'[a-z]+:', x['href']) else pre+x['href']
        extra='' if x['primary'] else ' rel="noopener"'
        dl=x.get('download')
        if dl:
            extra += ' download' if dl is True else f' download="{dl}"'
        cls='btn' if x['primary'] else 'btn alt'
        return f'<a class="{cls}" href="{href}"{extra}>{x["label"]}</a>'
    b=' '.join(button(x) for x in e['buttons'])
    return (f'  <article class="ev" data-end="{e["end"]}">\n    <a class="thumb" href="{f}"><img src="{f}" alt="Flyer: {e["alt"]}" loading="lazy"></a>\n'
      f'    <div class="evtx"><b>{e["title"]}</b><small>{e["subtitle"]}</small>\n      <p class="when">{e["when"]}</p><p class="where">{e["where"]}</p>\n'
      f'      <div class="acts">{b}</div></div>\n  </article>\n')
p=f'{R}/events/index.html'; s=open(p).read()
s=re.sub(r'(<p class="note">.*?</p>\n).*?(  <p class="empty")',lambda m:m.group(1)+''.join(art(e,'') for e in E)+m.group(2),s,count=1,flags=re.S)
open(p,'w').write(s)
for slug in sorted(d for d in os.listdir(f'{R}/orgs') if os.path.isdir(f'{R}/orgs/{d}')):
    p=f'{R}/orgs/{slug}/index.html'; s=open(p).read()
    mine=''.join(art(e,'../../events/') for e in E if slug in e['orgs'])
    s=re.sub(r'<!--EV-->.*?<!--/EV-->',lambda m:'<!--EV-->\n'+mine+'<!--/EV-->',s,flags=re.S)
    open(p,'w').write(s)
