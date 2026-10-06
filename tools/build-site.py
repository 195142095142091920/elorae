#!/usr/bin/env python3
"""Site build helper (nt23). Not part of the deploy: GitHub Pages serves the files as they
are; run this by hand from the repo root, review the diff, then commit.

  python3 tools/build-site.py sitemap          rewrite sitemap.xml (public pages; sealed
                                               articles, redirects and players/ left out)
  python3 tools/build-site.py meta [--write]   list pages missing description / Open Graph
                                               tags; --write adds them to articles (from the
                                               title, epithet and first Lore sentences)
  python3 tools/build-site.py search [--write] rebuild the search index from the pages and
                                               report how it differs from search-index.js;
                                               --write replaces search-index.js
  python3 tools/build-site.py all              sitemap + meta (report) + search (report)

Sealed articles (main.art-body.sealed / data-owner) keep "private": true and their owner in
the index and are never put in the sitemap or given public meta. No network access.
"""
import glob, html, json, os, re, subprocess, sys, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://elorae.world/"
os.chdir(ROOT)

def read(p): return open(p, encoding="utf8").read()
def strip_comments(t): return re.sub(r"<!--.*?-->", "", t, flags=re.S)
def text(s): return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()
def tidy(s): return re.sub(r"\s+([,.;:!?])", r"\1", s)
def esc(s): return html.escape(s, quote=True)
def is_redirect(t): return 'http-equiv="refresh"' in t
def sealed_owner(t):
    m = re.search(r'<main class="art-body sealed"(?: data-owner="([a-z]+)")?', t)
    return (True, m.group(1) or "") if m else (False, "")

def articles(): return sorted(glob.glob("articles/*.html"))

# ---------------------------------------------------------------- sitemap
def sitemap():
    pages = [p for p in articles() if not sealed_owner(read(p))[0]]
    pages += ["index/ancients.html"] + sorted(glob.glob("codex/*.html")) + ["atlas.html"] + sorted(glob.glob("atlas/*.html")) + ["journal.html"]
    out = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for p in pages:
        if not os.path.exists(p) or is_redirect(read(p)): continue
        d = subprocess.run(["git", "log", "-1", "--format=%cs", "--", p], capture_output=True, text=True).stdout.strip()
        out.append(f"  <url><loc>{SITE}{p}</loc>" + (f"<lastmod>{d}</lastmod>" if d else "") + "</url>")
    out.append("</urlset>")
    open("sitemap.xml", "w", encoding="utf8").write("\n".join(out) + "\n")
    print("sitemap.xml:", len(out) - 3, "urls")

# ---------------------------------------------------------------- meta
def sentences(s, maxc=200):
    parts = re.findall(r'[^.!?]+[.!?]+(?:["\u201d\u2019])?\s*', s); out = ""
    for p in parts:
        if len(out) + len(p) > maxc and out: break
        out += p
    return out.strip() or s[:maxc].rsplit(" ", 1)[0]

def article_meta(p, t):
    b = strip_comments(t)
    name = text(re.search(r"<h1>(.*?)</h1>", b, re.S).group(1))
    ep = re.search(r'<p class="art-epithet">(.*?)</p>', b, re.S); ep = text(ep.group(1)) if ep else ""
    life = re.search(r'<p class="art-life">(.*?)</p>', b, re.S); life = text(life.group(1)) if life else ""
    img = re.search(r'<section class="art-hero[^"]*"><img src="([^"]+)"', b)
    desc = name + (", " + ep if ep else "") + (". " + sentences(life) if life else "")
    tags = [f'<meta name="description" content="{esc(desc)}">', '<meta property="og:site_name" content="Elorae">',
            '<meta property="og:type" content="article">', f'<meta property="og:title" content="{esc(name)}">',
            f'<meta property="og:description" content="{esc(desc)}">', f'<meta property="og:url" content="{SITE}{p}">']
    if img:
        absu = urllib.parse.urljoin(SITE + p, urllib.parse.quote(html.unescape(img.group(1))))
        tags += [f'<meta property="og:image" content="{esc(absu)}">', '<meta name="twitter:card" content="summary_large_image">']
    else: tags.append('<meta name="twitter:card" content="summary">')
    return tags

def meta(write=False):
    pages = sorted(set(glob.glob("*.html") + glob.glob("*/*.html")))
    missing = 0
    for p in pages:
        if p.startswith(("edit/", "_verify/", "node_modules/")): continue
        t = read(p)
        if is_redirect(t) or p == "404.html": continue
        lack = [k for k, pat in (("description", 'name="description"'), ("og:title", 'property="og:title"'), ("og:url", 'property="og:url"')) if pat not in t]
        if not lack: continue
        missing += 1
        sealed = sealed_owner(t)[0]
        fix = p.startswith("articles/") and not sealed and write
        if fix:
            m = re.search(r"<title>[^<]*</title>\n", t)
            t = t[:m.end()] + "\n".join(article_meta(p, t)) + "\n" + t[m.end():]
            open(p, "w", encoding="utf8").write(t)
        print(f"  {p}: missing {', '.join(lack)}" + (" (sealed: left alone)" if sealed else "") + (" -> added" if fix else ""))
    print("meta:", missing, "page(s) missing tags" if missing else "all pages have description and Open Graph tags")

# ---------------------------------------------------------------- search index
def sections(body, level="h2"):
    """Split HTML at <h2 id=...> into (id, title, html)."""
    out = []
    for m in re.finditer(rf'<{level} id="([^"]+)"[^>]*>(.*?)</{level}>(.*?)(?=<{level} id=|</main>|$)', body, re.S):
        out.append((m.group(1), text(m.group(2)), m.group(3)))
    return out

def search_entries():
    E = []
    def add(title, href, kind, txt, image="", private=False, owner=""):
        E.append({"title": title, "href": href, "kind": kind, "text": tidy(txt), "image": image, "private": private, "owner": owner})
    for p in articles():
        t = strip_comments(read(p)); sealed, owner = sealed_owner(t)
        name = text(re.search(r"<h1>(.*?)</h1>", t, re.S).group(1))
        ep = re.search(r'<p class="art-epithet">(.*?)</p>', t, re.S)
        main = re.search(r"<main[^>]*>(.*?)</main>", t, re.S).group(1)
        main = re.sub(r'<section class="art-sec" id="related">.*?</section>', "", main, flags=re.S)
        main = re.sub(r"<h2>.*?</h2>", " ", main, flags=re.S)
        img = re.search(r'<section class="art-hero[^"]*"[^>]*><img src="\.\./([^"]+)"', t)
        epi = text(ep.group(1)) if ep else ""
        body = epi if sealed else (epi + " " if epi else "") + text(main)   # sealed: epithet only, never the body
        add(name, p, "article", body, html.unescape(img.group(1)) if img else "", sealed, owner)
    for p in sorted(glob.glob("codex/*.html")):
        t = strip_comments(read(p)); page = text(re.search(r"<title>(.*?) - Elorae</title>", t).group(1))
        body = re.search(r"<main[^>]*>(.*?)</main>", t, re.S).group(1)
        for sid, st, sh in sections(body):
            add(f"{page}: {st}", f"{p}#{sid}", "codex", text(sh))
    j = strip_comments(read("journal.html")); body = re.search(r"<main[^>]*>(.*?)</main>", j, re.S).group(1)
    for sid, st, sh in sections(body, "h1"):
        img = re.search(r'<img[^>]*src="([^"]+)"', sh)
        add(st, f"journal.html#{sid}", "journal", text(re.sub(r"<figure>.*?</figure>", " ", sh, flags=re.S)), html.unescape(img.group(1)) if img else "")
    for p in ["atlas.html"] + sorted(glob.glob("atlas/*.html")):
        t = strip_comments(read(p)); page = text(re.search(r"<title>(.*?) - Elorae</title>", t).group(1))
        body = re.search(r"<main[^>]*>(.*?)</main>", t, re.S).group(1)
        add(page, p, "atlas", text(body))
    return E

def search(write=False):
    new = search_entries()
    cur_t = read("search-index.js"); cur = json.loads(cur_t[cur_t.index("["): cur_t.rindex("]") + 1])
    ck = {e["href"]: e for e in cur}; nk = {e["href"]: e for e in new}
    added = [h for h in nk if h not in ck]; gone = [h for h in ck if h not in nk]
    changed = [h for h in nk if h in ck and any(nk[h][k] != ck[h][k] for k in ("title", "kind", "image", "private", "owner"))]
    textdiff = [h for h in nk if h in ck and nk[h]["text"] != ck[h]["text"]]
    print(f"search: {len(new)} entries built, {len(cur)} in search-index.js")
    for lab, xs in (("new", added), ("missing from build", gone), ("title/image/private/owner differ", changed), ("text differs", textdiff)):
        if xs: print(f"  {lab} ({len(xs)}): " + ", ".join(xs[:12]) + (" ..." if len(xs) > 12 else ""))
    sealed_ok = all(nk[h]["private"] == ck[h]["private"] for h in nk if h in ck)
    print("  sealed flags match:", sealed_ok)
    if write:
        open("search-index.js", "w", encoding="utf8").write("window.SEARCH_INDEX = " + json.dumps(new, ensure_ascii=False, separators=(",", ":")) + ";\n")
        print("  search-index.js written")

if __name__ == "__main__":
    a = sys.argv[1:] or ["all"]; w = "--write" in a
    if a[0] == "sitemap": sitemap()
    elif a[0] == "meta": meta(w)
    elif a[0] == "search": search(w)
    elif a[0] == "all": sitemap(); meta(False); search(False)
    else: print(__doc__); sys.exit(2)
