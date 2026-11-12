#!/usr/bin/env python3
"""Write data/usage-links.json: every link written into the Hub's pages, keyed by the
same link id that usage.js sends when someone taps it.

The Command Center dashboard uses this list for "Never Opened" (known links with zero
clicks in 30 days) and for readable labels on "Top Links". It only lists links that are
already in the public pages. Query strings and #fragments are dropped, tel:/sms:/mailto:
links are listed by type and page only, long opaque path tokens become "~", and the
unlisted private page is skipped.

    python3 tools/build_usage_links.py          # rewrite the list
    python3 tools/build_usage_links.py --check  # exit 1 if it would change
"""
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit, quote

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "data" / "usage-links.json"
BASE = "https://farmingtonbay6th.github.io/fb6-ward-links/"
BAD = re.compile(r"[^A-Za-z0-9._~/-]")
SKIP_PREFIXES = ("preview-shots/", "sp-")


def page_url(rel):
    rel = rel.as_posix()
    if rel.endswith("index.html"):
        rel = rel[: -len("index.html")]
    return BASE + rel


def hub_path(path):
    base_path = urlsplit(BASE).path
    if path.startswith(base_path):
        path = "/" + path[len(base_path):]
    path = re.sub(r"index\.html$", "", path)
    path = BAD.sub("", path)[:150]
    if path.startswith("/sp-"):
        path = "/private-page/"
    return path or "/"


def external(u):
    path = quote(u.path or "/", safe="/:@!$&'()*+,;=-._~%")
    segs = ["~" if len(s) >= 16 and re.search(r"\d", s) and re.fullmatch(r"[A-Za-z0-9_-]+", s) else s for s in path.split("/")]
    out = (u.hostname or "") + "/".join(segs)
    out = re.sub(r"[^A-Za-z0-9._~/:-]", "", out)
    return re.sub(r"/+$", "", out)[:110]


def link_id(href, here_url, usage_id=None, classes=""):
    if usage_id:
        return re.sub(r"[^A-Za-z0-9._~:/-]", "", usage_id)[:110]
    if "fbback" in classes.split():
        return "nav:back"
    if not href or re.match(r"\s*(javascript:|#)", href, re.I):
        return ""
    here = hub_path(urlsplit(here_url).path)
    u = urlsplit(urljoin(here_url, href.strip()))
    scheme = u.scheme.lower()
    if scheme in ("tel", "sms", "mailto"):
        return f"{scheme}:{here}"
    if scheme not in ("http", "https"):
        return ""
    b = urlsplit(BASE)
    if u.netloc.lower() == b.netloc and u.path.startswith(b.path):
        return hub_path(u.path)
    return external(u)


class Links(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.cur, self.depth = [], None, 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if self.cur is not None:
            if tag == "a":
                self._end()
            else:
                return
        if (tag == "a" and a.get("href")) or a.get("data-usage-id"):
            self.cur = {"tag": tag, "href": a.get("href") or "", "usage": a.get("data-usage-id"),
                        "cls": a.get("class") or "", "label": a.get("aria-label") or a.get("title") or "", "text": []}

    def handle_data(self, data):
        if self.cur is not None:
            self.cur["text"].append(data)

    def handle_endtag(self, tag):
        if self.cur is not None and tag == self.cur["tag"]:
            self._end()

    def _end(self):
        c, self.cur = self.cur, None
        chunks = [re.sub(r"\s+", " ", t).strip() for t in c["text"]]
        words = [t for t in chunks if len(re.findall(r"[A-Za-z]", t)) >= 3]
        text = words[0] if words else " ".join(t for t in chunks if t)
        c["label"] = (c["label"] if len(re.findall(r"[A-Za-z]", text)) < 3 and c["label"] else text or c["label"]).strip()[:70]
        self.out.append(c)


def build(pairs=None):
    links = {}
    for f in sorted(ROOT.rglob("*.html")):
        rel = f.relative_to(ROOT)
        if rel.as_posix().startswith(SKIP_PREFIXES):
            continue
        here = page_url(rel)
        p = Links()
        p.feed(f.read_text(encoding="utf-8", errors="replace"))
        page = hub_path(urlsplit(here).path)
        for c in p.out:
            lid = link_id(c["href"], here, c["usage"], c["cls"])
            if pairs is not None:
                pairs.append({"page": here, "href": c["href"], "usage": c["usage"], "cls": c["cls"], "id": lid})
            if not lid or lid in ("nav:back", "/private-page/"):
                continue
            item = links.setdefault(lid, {"id": lid, "label": "", "pages": []})
            if not item["label"] and c["label"]:
                item["label"] = c["label"]
            if page not in item["pages"]:
                item["pages"].append(page)
    out = sorted(links.values(), key=lambda x: x["id"])
    for item in out:
        if item["id"] == "/":
            item["label"] = "Hub Home"
        item["label"] = item["label"] or item["id"]
    return {"note": "Public Hub links by usage.js link id. Generated by tools/build_usage_links.py.", "links": out}


def main():
    if "--pairs" in sys.argv:  # for tools/usage.test.js: the JS beacon must produce the same ids
        pairs = []
        build(pairs)
        print(json.dumps(pairs))
        return
    text = json.dumps(build(), indent=1, ensure_ascii=False) + "\n"
    if "--check" in sys.argv:
        if not DEST.exists() or DEST.read_text() != text:
            print("data/usage-links.json is out of date. Run python3 tools/build_usage_links.py")
            sys.exit(1)
        print("usage links are current")
        return
    DEST.write_text(text)
    print(f"wrote {DEST.relative_to(ROOT)} ({text.count(chr(10) + '  \"id\"') or len(json.loads(text)['links'])} links)")


if __name__ == "__main__":
    main()
