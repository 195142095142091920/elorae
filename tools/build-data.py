#!/usr/bin/env python3
"""Build machine-readable Foundry/site data for elorae.world (hand-run, like build-site.py).

Reads the static HTML the site already publishes. By default **reports only** (no writes).
Pass `--write` to emit files under --out (default: repo root):

  data/lore.json      every PUBLIC article / figure / codex / atlas page (schema elorae.lore/1)
  data/journal.json   journal chapters, newest first                     (schema elorae.journal/1)
  data/version.json   one hash per file, so consumers can poll cheaply
  foundry-welcome.html  the Foundry join-screen recap for the newest chapter

Secrets: anything not explicitly public is EXCLUDED, never obfuscated:
  * pages whose <body> has class "private" or a data-owner attribute (sealed)
  * search-index entries with "private": true, and everything in vault.js (never read)
  * any element with data-visibility other than "public", data-encrypted, class "secret"/"sealed",
    or <template> (reserved for the upcoming encrypted visibility layer)

Run from the repo root:
  python3 tools/build-data.py                 # report counts + sample hashes
  python3 tools/build-data.py --write         # write JSON + welcome (review diff, then commit)
  python3 tools/build-data.py --write --out /tmp/elorae-data-preview

Requires: beautifulsoup4. No network access.
"""
import argparse, hashlib, html, json, os, re, sys
from datetime import datetime, timezone
from urllib.parse import urljoin, quote
from bs4 import BeautifulSoup

SITE = "https://elorae.world/"
SCHEMA_LORE, SCHEMA_JOURNAL = "elorae.lore/1", "elorae.journal/1"
SECRET_SELECTORS = ['[data-visibility]:not([data-visibility="public"])', "[data-encrypted]",
                    ".secret", ".sealed", "template", "script", "style", "noscript"]


def soup_of(path):
    with open(path, encoding="utf-8") as f:
        return BeautifulSoup(f.read(), "html.parser")


def is_private_page(s):
    """True for sealed/private articles. Match site markup + build-site.py:
    <main class="art-body private|sealed" data-owner="..."> (data-owner also appears in
    the friend masthead on public pages — only trust it on main / art-hero.)
    """
    main = s.find("main", class_=lambda c: c and "art-body" in c.split())
    if main is not None:
        classes = set(main.get("class") or [])
        if classes & {"private", "sealed"} or main.has_attr("data-owner"):
            return True
    hero = s.find("section", class_=lambda c: c and "art-hero" in c.split())
    if hero is not None:
        classes = set(hero.get("class") or [])
        if classes & {"private", "sealed"} or hero.has_attr("data-owner"):
            return True
    b = s.body
    return bool(b and ("private" in (b.get("class") or []) or b.has_attr("data-owner")))


def strip_secrets(node):
    for sel in SECRET_SELECTORS:
        for el in node.select(sel):
            el.decompose()
    return node


def abs_url(page_url, ref):
    if not ref:
        return None
    u = urljoin(page_url, ref)
    return quote(u, safe=":/#?&=%~'()!,;@+$")      # encode spaces etc., keep URL syntax


def text(el):
    return re.sub(r"\s+", " ", el.get_text()).strip() if el else ""


def clean_fragment(el, page_url):
    """Return safe-ish HTML for a content element: absolute URLs, no scripts/handlers/styles."""
    el = strip_secrets(BeautifulSoup(str(el), "html.parser"))
    for t in el.find_all(True):
        for a in list(t.attrs):
            if a.startswith("on") or a in ("style", "class", "id", "srcset", "data-src", "data-alt"):
                del t[a]
        if t.name == "img" and t.get("src"):
            t["src"] = abs_url(page_url, t["src"])
        if t.name == "a" and t.get("href"):
            t["href"] = abs_url(page_url, t["href"])
            t["target"], t["rel"] = "_blank", "noopener"
    return str(el).strip()


def digest(obj):
    return hashlib.sha256(json.dumps(obj, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:16]


# ---------- categories from the Index pages ----------
def load_categories(root):
    cats = {}
    for fn in sorted(os.listdir(os.path.join(root, "index"))):
        if not fn.endswith(".html"):
            continue
        s = soup_of(os.path.join(root, "index", fn))
        for sec in s.select("section.index-cat"):
            label = text(sec.find("h2"))
            for a in sec.select("a.index-card[href]"):
                slug = os.path.splitext(os.path.basename(a["href"]))[0]
                cats.setdefault(slug, set()).add(label)
    return {k: sorted(v) for k, v in cats.items()}


# ---------- page parsers ----------
def parse_article(path, url, cats):
    s = soup_of(path)
    if is_private_page(s):
        return None
    hero = s.select_one("section.art-hero > img")
    dossier = []
    dl = s.select_one("dl.art-dossier")
    if dl:
        for dt in dl.find_all("dt"):
            dd = dt.find_next_sibling("dd")
            dossier.append({"label": text(dt), "value": text(dd)})
    q = s.select_one("blockquote.art-quote")
    lore = [text(p) for p in s.select("p.art-life") if text(p)]
    slug = os.path.splitext(os.path.basename(path))[0]
    return {
        "id": f"article:{slug}", "slug": slug, "kind": "article",
        "title": text(s.select_one(".art-title h1")),
        "epithet": text(s.select_one(".art-epithet")) or None,
        "url": url, "image": abs_url(url, hero.get("src")) if hero else None,
        "categories": cats.get(slug, []),
        "dossier": dossier,
        "quote": {"text": text(q.find("p")) if q else "", "cite": text(q.find("cite")) if q else ""} if q else None,
        "facts": [text(li) for li in s.select("ul.art-facts li")],
        "summary": lore[0] if lore else "",
        "lore": lore,
    }


def parse_figure(path, url, cats):
    s = soup_of(path)
    if is_private_page(s):
        return None
    hero = s.select_one(".hero img")
    lore = [text(p) for p in s.select("aside.life-sheet p") if text(p)]
    slug = os.path.splitext(os.path.basename(path))[0]
    return {
        "id": f"figure:{slug}", "slug": slug, "kind": "figure",
        "title": text(s.select_one(".dock h1")) or text(s.find("h1")),
        "epithet": text(s.select_one(".dock .caption")) or None,
        "url": url, "image": abs_url(url, hero.get("src")) if hero else None,
        "categories": cats.get(slug, []),
        "dossier": [], "quote": None, "facts": [],
        "summary": lore[-1] if lore else "", "lore": lore,
    }


def parse_sections(path, url, kind):
    """Codex / Atlas pages: <main> with <h2 id> sections."""
    s = soup_of(path)
    if is_private_page(s):
        return None
    main = s.find("main")
    if not main:
        return None
    strip_secrets(main)
    sections, cur = [], None
    for el in main.find_all(recursive=False):
        if el.name == "h2":
            cur = {"id": el.get("id") or "", "heading": text(el), "html": []}
            sections.append(cur)
        elif el.name in ("p", "figure", "blockquote", "ul", "ol", "table", "h3", "dl", "div", "section"):
            if cur is None:
                cur = {"id": "", "heading": "", "html": []}
                sections.append(cur)
            cur["html"].append(clean_fragment(el, url))
    for sec in sections:
        sec["html"] = "\n".join(h for h in sec["html"] if h)
    slug = os.path.splitext(os.path.basename(path))[0]
    title = (s.title.string or slug).split(" - ")[0].strip() if s.title else slug
    first_p = main.find("p")
    return {
        "id": f"{kind}:{slug}", "slug": slug, "kind": kind, "title": title, "epithet": None,
        "url": url, "image": None, "categories": [kind.capitalize()],
        "dossier": [], "quote": None, "facts": [],
        "summary": text(first_p), "lore": [], "sections": sections,
    }


def parse_journal(path):
    url = urljoin(SITE, "journal.html")
    s = soup_of(path)
    main = s.find("main")
    strip_secrets(main)
    chapters = []
    for order, h1 in enumerate(main.find_all("h1", id=True)):
        blocks, frags = [], []
        for el in h1.find_next_siblings():
            if el.name == "h1":
                break
            if el.name == "p" and text(el):
                blocks.append({"type": "p", "text": text(el)})
            elif el.name == "figure":
                img = el.find("img")
                blocks.append({"type": "image", "src": abs_url(url, img.get("src")) if img else None,
                               "caption": text(el.find("figcaption"))})
            else:
                continue
            frags.append(clean_fragment(el, url))
        m = re.match(r"Act ([IVXLC]+), Chapter ([IVXLC]+)", text(h1))
        ch = {"id": h1["id"], "order": order, "title": text(h1),
              "act": m.group(1) if m else None, "chapter": m.group(2) if m else None,
              "url": f"{url}#{h1['id']}", "blocks": blocks, "html": "\n".join(frags)}
        ch["hash"] = digest(ch)
        chapters.append(ch)
    return chapters


# ---------- Foundry join fragment ----------
WELCOME = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Elorae — {title}</title>
  <!-- GENERATED by tools/build-data.py from journal.html ({id}). Do not edit by hand. -->
</head>
<body style="margin:0;background:#12100e;color:#efe8dc;overflow:hidden;">
  <div style="background:#12100e;color:#efe8dc;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.5;padding:16px 16px 18px;">
{paras}{figure}  </div>
</body>
</html>
"""


def build_welcome(ch, n_paras=2):
    esc = lambda t: html.escape(t, quote=False)
    ps = [b for b in ch["blocks"] if b["type"] == "p"][:n_paras]
    img = next((b for b in ch["blocks"] if b["type"] == "image" and b.get("src")), None)
    paras = "".join(f'    <p style="margin:0 0 12px;color:#efe8dc;">{esc(p["text"])}</p>\n' for p in ps)
    fig = ""
    if img:
        fig = ('    <figure style="margin:0;">\n'
               f'      <img src="{html.escape(img["src"])}" alt="{html.escape(img.get("caption") or "")}" style="display:block;width:100%;height:auto;border:1px solid #000;">\n'
               + (f'      <figcaption style="margin-top:8px;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.06em;color:#cfc6b8;">{esc(img["caption"])}</figcaption>\n' if img.get("caption") else "")
               + '    </figure>\n')
    return WELCOME.format(title=html.escape(ch["title"]), id=ch["id"], paras=paras, figure=fig)


def main():
    ap = argparse.ArgumentParser(description="Emit lore/journal JSON for Foundry (report by default).")
    ap.add_argument("--root", default=".")
    ap.add_argument("--out", default=None, help="output dir (default: same as --root)")
    ap.add_argument("--write", action="store_true",
                    help="write data/*.json and foundry-welcome.html (default: report only)")
    ap.add_argument("--no-welcome", action="store_true",
                    help="with --write, skip regenerating foundry-welcome.html")
    a = ap.parse_args()
    root, out = os.path.abspath(a.root), os.path.abspath(a.out or a.root)
    cats = load_categories(root)
    entries, skipped = [], []
    for folder, kind, parser in (("articles", "article", parse_article), ("figures", "figure", parse_figure),
                                 ("codex", "codex", None), ("atlas", "atlas", None)):
        d = os.path.join(root, folder)
        for fn in sorted(os.listdir(d)) if os.path.isdir(d) else []:
            if not fn.endswith(".html"):
                continue
            path, url = os.path.join(d, fn), urljoin(SITE, f"{folder}/{fn}")
            e = parser(path, url, cats) if parser else parse_sections(path, url, kind)
            if e is None:
                skipped.append(f"{folder}/{fn}")
                continue
            e["hash"] = digest(e)
            entries.append(e)
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    lore = {"schema": SCHEMA_LORE, "generated": now, "site": SITE, "count": len(entries), "entries": entries}
    chapters = parse_journal(os.path.join(root, "journal.html"))
    journal = {"schema": SCHEMA_JOURNAL, "generated": now, "site": SITE,
               "latest": chapters[0]["id"] if chapters else None, "chapters": chapters}
    version = {"generated": now,
               "lore": digest([e["hash"] for e in entries]),
               "journal": digest([c["hash"] for c in chapters]),
               "latestChapter": journal["latest"]}
    print(f"lore: {len(entries)} public entries ({len(skipped)} private/unparseable skipped: {', '.join(skipped) or 'none'})")
    print(f"journal: {len(chapters)} chapters, latest={journal['latest']}")
    print(f"version: {version}")
    titles = [e["title"] for e in entries[:5]]
    print(f"sample titles: {titles}")
    if any("bel harath" in (e.get("title") or "").lower() for e in entries):
        print("ERROR: sealed title leaked into lore entries", file=sys.stderr)
        return 1
    if not a.write:
        print("(report only; pass --write to emit data/lore.json, data/journal.json, data/version.json"
              + ("" if a.no_welcome else ", foundry-welcome.html") + ")")
        return 0
    os.makedirs(os.path.join(out, "data"), exist_ok=True)
    for rel, obj in (("data/lore.json", lore), ("data/journal.json", journal), ("data/version.json", version)):
        path = os.path.join(out, rel)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, indent=1)
            f.write("\n")
        print(f"wrote {path}")
    if chapters and not a.no_welcome:
        path = os.path.join(out, "foundry-welcome.html")
        with open(path, "w", encoding="utf-8") as f:
            f.write(build_welcome(chapters[0]))
        print(f"wrote {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
