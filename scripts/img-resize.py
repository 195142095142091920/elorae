#!/usr/bin/env python3
"""Rewrite every static <img> on the site to Cloudflare-resized URLs (img-resize).

One source file per image; Cloudflare Image Transformations resize on request:
  /cdn-cgi/image/width=W,quality=82,format=auto,fit=scale-down,onerror=redirect/<path>
Each <img> gets src (sensible fallback width) + srcset (width ladder, capped at the
file's natural width) + sizes (matches its CSS display size per placement), plus
decoding="async" and loading="lazy" below the fold.

Left alone: article hero art (section.art-hero img outside .art-swap) and the
art-swap data-src originals; data:/external/svg images; images inside HTML comments.

Idempotent: already-rewritten tags are re-derived from their original path, so re-run
after adding content:  python3 scripts/img-resize.py   (from the repo root)
Use --check to list what would change without writing.
Runtime counterpart for JS-rendered images and the onerror fallback: /img.js.
"""
import html, math, os, re, subprocess, sys
from fractions import Fraction
from html.parser import HTMLParser
from urllib.parse import quote, unquote

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OPTS = "quality=82,format=auto,fit=scale-down,onerror=redirect"
LADDER = [160, 320, 480, 640, 960, 1280, 1600, 1920, 2560]
CDN_RE = re.compile(r'^((?:https?://(?:www\.)?elorae\.world)?)/cdn-cgi/image/[^/]+(/.*)$', re.I)
RASTER = re.compile(r'\.(png|jpe?g|webp|gif|avif)$', re.I)
MANAGED = {"src", "srcset", "sizes", "loading", "decoding", "data-eimg-fell", "data-eimg-orig"}
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

try:
    from PIL import Image
except ImportError:
    sys.exit("needs Pillow: pip install pillow")

_dims = {}
def dims(rel):
    if rel not in _dims:
        p = os.path.join(ROOT, rel)
        try:
            with Image.open(p) as im:
                _dims[rel] = im.size
        except Exception:
            _dims[rel] = None
    return _dims[rel]

def ladder(lo, hi, natural):
    ws = [w for w in LADDER if lo <= w <= hi and w < natural]
    top = min(hi, natural)
    if not ws or ws[-1] < top:
        ws.append(top)
    return ws

# --- placement rules: (sizes, min, max, fallback, lazy, width-attr) per image -----------
def placement(stack, attrs):
    classes = lambda t: [c for (tag, cl) in stack for c in cl if tag == t]
    allc = set(c for (_, cl) in stack for c in cl)
    tags = [t for (t, _) in stack]
    own = set((attrs.get("class") or "").split())
    if "art-swap-thumbs" in allc or "art-swap" in allc:
        return "swap-thumb"
    if "art-hero" in allc:
        return None  # article hero: full size, untouched
    if "journal-bg" in allc:
        return "bg"
    if "index-card" in allc:
        return "card"
    if "tile" in allc:
        return "tile"
    if "atlas-map" in own:
        return "map"
    if "art-body" in allc:
        return "inline"
    if "figure" in tags:
        return "figure"
    return "inline"

def rule(kind, w, h):
    a = w / h
    if kind == "page-wide":        # standalone full-width doc (foundry-welcome): 100vw
        return dict(sizes="100vw", lo=320, hi=1280, fb=960, lazy=True)
    if kind == "swap-thumb":       # 56x70 cover button (desktop); phone uses arrows
        need = math.ceil(max(56, 70 * a))
        return dict(sizes="%dpx" % need, lo=160, hi=480, fb=320, lazy=True)
    if kind in ("card", "tile"):   # 4:3 cover box; 4 cols >800px, 2 cols <=800px
        k = max(1.0, a / (4 / 3))
        return dict(sizes="(max-width: 800px) %dvw, %dvw" % (math.ceil(50 * k), math.ceil(25 * k)),
                    lo=320, hi=1280, fb=640, lazy=True)
    if kind == "bg":               # fixed full-viewport cover backdrop
        fr = Fraction(w, h).limit_denominator(50)
        return dict(sizes="(max-aspect-ratio: %d/%d) %dvh, 100vw" % (fr.numerator, fr.denominator, math.ceil(100 * a)),
                    lo=640, hi=2560, fb=1920, lazy=False)
    if kind == "map":              # Atlas map in the reading column; zoom loads the original
        return dict(sizes="(max-width: 800px) 100vw, 752px", lo=480, hi=1600, fb=1280, lazy=False)
    if kind == "figure":           # journal / lore figure: reading column (<=752px content)
        return dict(sizes="(max-width: 800px) 100vw, 752px", lo=320, hi=1280, fb=960, lazy=True)
    return dict(sizes="(max-width: 800px) 100vw, 720px", lo=320, hi=1280, fb=960, lazy=True, width=True)

# --- parsing ---------------------------------------------------------------------------
class Finder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.hits = [], []
    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == "img":
            self.hits.append((self.getpos(), self.get_starttag_text(), list(self.stack), d))
            return
        if tag in VOID:
            return
        self.stack.append((tag, (d.get("class") or "").split()))
    def handle_startendtag(self, tag, attrs):
        if tag == "img":
            self.handle_starttag(tag, attrs)
    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break

ATTR_RE = re.compile(r'(\s+)([^\s=/>]+)(\s*=\s*(?:"[^"]*"|\'[^\']*\'|[^\s>]+))?')

def split_attrs(raw):
    body = raw[4:-1]  # strip "<img" and ">"
    selfclose = body.rstrip().endswith("/")
    if selfclose:
        body = body.rstrip()[:-1]
    out = []
    for m in ATTR_RE.finditer(body):
        name = m.group(2).lower()
        val = m.group(3)
        v = None
        if val is not None:
            v = val.split("=", 1)[1].strip()
            if v[:1] in "\"'":
                v = v[1:-1]
            v = html.unescape(v)
        out.append((name, m.group(0), v))
    return out, selfclose

def esc(v):
    return v.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")

def resolve(src, page_rel):
    """-> (prefix, url_path_decoded) for a local raster asset, else None."""
    s = src.strip()
    m = CDN_RE.match(s)
    if m:
        s = m.group(1) + m.group(2)
    prefix = ""
    am = re.match(r'^https?://(?:www\.)?elorae\.world(/.*)$', s, re.I)
    if am:
        prefix, s = "https://elorae.world", am.group(1)
    elif re.match(r'^[a-z][a-z0-9+.-]*:', s, re.I) or s.startswith("//"):
        return None
    s = s.split("#")[0]
    if "?" in s:
        return None
    if not s.startswith("/"):
        base = "/" + os.path.dirname(page_rel)
        if page_rel.endswith("/index.html") or page_rel == "index.html":
            base = "/" + os.path.dirname(page_rel)
        s = os.path.normpath(os.path.join(base, s)).replace("\\", "/")
    path = unquote(s)
    if not RASTER.search(path) or path.startswith("/cdn-cgi/"):
        return None
    return prefix, path

def cdn(prefix, path, w):
    return "%s/cdn-cgi/image/width=%d,%s%s" % (prefix, w, OPTS, quote(path, safe="/"))

def rewrite_tag(raw, stack, d, page_rel, counters):
    kind = placement(stack, d)
    if not kind:
        return None
    if kind in ("figure", "inline") and page_rel.startswith("foundry-welcome"):
        kind = "page-wide"
    attrs, selfclose = split_attrs(raw)
    src = next((v for (n, _, v) in attrs if n == "src"), None)
    if not src:
        return None
    r = resolve(src, page_rel)
    if not r:
        return None
    prefix, path = r
    wh = dims(path.lstrip("/"))
    if not wh:
        print("  ! missing file for", page_rel, path, file=sys.stderr)
        return None
    w, h = wh
    R = rule(kind, w, h)
    ws = ladder(R["lo"], R["hi"], w)
    fb = min(R["fb"], ws[-1])
    fb = max([x for x in ws if x <= fb] or [ws[0]])
    counters[kind] = counters.get(kind, 0) + 1
    lazy = R["lazy"] and not (kind in ("card", "tile") and counters[kind] <= 4)
    parts = ['<img src="%s"' % esc(cdn(prefix, path, fb))]
    if len(ws) > 1 or ws[0] < w:
        parts.append(' srcset="%s"' % esc(", ".join("%s %dw" % (cdn(prefix, path, x), x) for x in ws)))
        parts.append(' sizes="%s"' % esc(R["sizes"]))
    keep = [(n, rawa) for (n, rawa, _) in attrs if n not in MANAGED]
    has_width = any(n == "width" for (n, _) in keep)
    for n, rawa in keep:
        parts.append(rawa)
    if R.get("width") and not has_width:
        parts.append(' width="%d"' % w)
    if lazy:
        parts.append(' loading="lazy"')
    parts.append(' decoding="async"')
    parts.append(" />" if selfclose else ">")
    return "".join(parts)

IMGJS = '<script src="/img.js?v=img-resize"></script>'
IMGJS_RE = re.compile(r'<script src="/img\.js(\?v=[^"]*)?"></script>')

def ensure_imgjs(text):
    """Load /img.js (fallback + helper) right after <meta charset>, before any <img>."""
    if IMGJS_RE.search(text):
        return IMGJS_RE.sub(IMGJS, text, count=1)
    m = re.search(r'<meta charset="?utf-8"?\s*/?>', text, re.I)
    if not m:
        return text
    return text[:m.end()] + "\n" + IMGJS + text[m.end():]

def process(rel, write=True):
    p = os.path.join(ROOT, rel)
    text = open(p, encoding="utf-8").read()
    before = text
    text = ensure_imgjs(text)
    n = process_text(rel, text)
    if n[1] != before:
        if write:
            open(p, "w", encoding="utf-8").write(n[1])
        return max(n[0], 1)
    return 0

def process_text(rel, text):
    f = Finder()
    f.feed(text)
    f.close()
    if not f.hits:
        return 0, text
    lines = text.split("\n")
    offs, o = [], 0
    for ln in lines:
        offs.append(o)
        o += len(ln) + 1
    counters, edits = {}, []
    for (ln, col), raw, stack, d in f.hits:
        start = offs[ln - 1] + col
        if text[start:start + len(raw)] != raw:
            print("  ! offset mismatch", rel, ln, col, file=sys.stderr)
            continue
        new = rewrite_tag(raw, stack, d, rel, counters)
        if new and new != raw:
            edits.append((start, start + len(raw), new))
    for s, e, new in reversed(edits):
        text = text[:s] + new + text[e:]
    return len(edits), text

def main():
    write = "--check" not in sys.argv
    files = subprocess.check_output(["git", "ls-files", "*.html"], cwd=ROOT, text=True).split()
    skip = re.compile(r'^(edit/test/|_verify/|docs/|tools/|saved/)')
    total = 0
    for rel in files:
        if skip.match(rel):
            continue
        n = process(rel, write)
        if n:
            total += n
            print("%4d  %s" % (n, rel))  # n = img tags rewritten (1 if only the img.js tag was added)
    print("%s %d change(s)" % ("made" if write else "would make", total))

if __name__ == "__main__":
    main()
