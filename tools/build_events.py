#!/usr/bin/env python3
"""Render events/events.json into events/index.html and each orgs/<slug>/index.html.
Edit events.json (add an entry with an "orgs" list), then run: python3 tools/build_events.py"""
import json,re,os
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
E=json.load(open(f'{R}/events/events.json'))['events']
def art(e,pre):
    f=pre+e['flyer']
    b=' '.join(f'<a class="btn" href="{pre+x["href"] if not re.match(r"[a-z]+:",x["href"]) else x["href"]}">{x["label"]}</a>' if x['primary'] else
      f'<a class="btn alt" href="{pre+x["href"] if not re.match(r"[a-z]+:",x["href"]) else x["href"]}" rel="noopener">{x["label"]}</a>' for x in e['buttons'])
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
