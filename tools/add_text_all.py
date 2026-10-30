#!/usr/bin/env python3
"""Add a "Text All" group-text button to every org Presidency/Leaders card with 2+ Text buttons.
Idempotent. Numbers live only in sms: links (never visible). iOS gets sms:/open?addresses=a,b,c; others sms:a,b,c."""
import glob, os, re
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSS = '  .pc .txtall { display:flex; align-items:center; justify-content:center; gap:8px; min-height:48px; margin:12px 0 2px; font-size:16px; }\n'
JS = ('<script>/*textall*/(function(){var a=document.getElementById("text-all");if(!a)return;'
      'var ios=/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);'
      'if(ios)a.href="sms:/open?addresses="+a.dataset.n;})();</script>\n')
def run():
    for p in sorted(glob.glob(f'{R}/orgs/*/index.html')):
        s = open(p).read()
        m = re.search(r'<section class="pc">.*?</section>', s, re.S)
        if not m: continue
        sec = re.sub(r'\s*<a class="btn txtall".*?</a>', '', m.group(0), flags=re.S)
        nums = re.findall(r'class="btn txt"[^>]*href="sms:(\+\d+)"', sec)
        if len(nums) >= 2:
            n = ",".join(nums)
            btn = f'\n    <a class="btn txtall" id="text-all" data-n="{n}" href="sms:{n}" aria-label="Text the whole group at once">💬 Text All</a>'
            sec = sec.replace('</ul>', '</ul>' + btn, 1)
            sec = sec.replace('Tap <b>Text</b> to send a message.', 'Tap <b>Text</b> to message one person, or <b>Text All</b> for a group text.')
        s = s[:m.start()] + sec + s[m.end():]
        if len(nums) >= 2:
            if '.pc .txtall' not in s: s = s.replace('</style>', CSS + '</style>', 1)
            if '/*textall*/' not in s: s = s.replace('</body>', JS + '</body>', 1)
        open(p, 'w').write(s)
        print(os.path.relpath(p, R), len(nums))
if __name__ == '__main__': run()
