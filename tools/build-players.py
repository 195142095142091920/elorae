#!/usr/bin/env python3
"""Generate players/<slug>.html from the site's own chrome.

Shell (head, mast, scripts) is taken from codex/timeline.html (same folder depth), with
no section bar, no contents rail and no active nav item. People come from
edit/visibility.json "people" (names only). Nothing sealed is written into the HTML:
players/player.js renders characters, articles (profiles.json) and (for unlocked viewers
only) secret titles at runtime. Deterministic; run from the repo root:
  python3 tools/build-players.py
"""
import html, json, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
TPL = (ROOT / "codex/timeline.html").read_text()
vis = json.loads((ROOT / "edit/visibility.json").read_text())
admins = set(vis.get("admins", []))

head_end = TPL.index("</head>")
head = TPL[:head_end]
mast = re.search(r'<div class="mast">.*?</div>', TPL, re.S).group(0)
mast = mast.replace(' class="active"', ' class=""')
bg = re.search(r'<div class="journal-bg">.*?</div>', TPL, re.S).group(0)

# Keep chrome tokens aligned with the template; player.js + player-mark are the page tokens.
def tok(src, name, default):
    m = re.search(rf'{re.escape(name)}\?v=([^"\']+)', src)
    return m.group(1) if m else default

search_v = tok(TPL, "search.js", "nt28-eras")
glow_v = tok(TPL, "glow.js", "nt32-ambient")
scripts = (
    f'<script src="../search.js?v={search_v}"></script>'
    f'<script src="../seal.js?v=seal6"></script>'
    f'<script src="../player-mark.js?v=nt33-players"></script>\n'
    f'<canvas id="friend-glow"></canvas>\n'
    f'<script src="../glow.js?v={glow_v}"></script>\n'
    f'<script src="../back-to-top.js?v=nt5-top"></script>\n'
    f'<script src="player.js?v=nt33-players"></script>\n'
)

def page(slug, name):
    title = f"{name} - Elorae"
    desc = (f"{name}, Game Master of Elorae: the party, editable articles, and unlocked secrets"
            if slug in admins else
            f"{name}'s characters in Elorae, articles they edit, and secrets they can unlock")
    h = head
    h = re.sub(r"<title>.*?</title>", f"<title>{html.escape(title)}</title>", h)
    h = re.sub(r'(<meta name="description" content=")[^"]*', lambda m: m.group(1) + html.escape(desc, quote=True), h)
    h = re.sub(r'(<meta property="og:title" content=")[^"]*', lambda m: m.group(1) + html.escape(title, quote=True), h)
    h = re.sub(r'(<meta property="og:description" content=")[^"]*', lambda m: m.group(1) + html.escape(desc, quote=True), h)
    h = re.sub(r'(<meta property="og:url" content=")[^"]*', lambda m: m.group(1) + f"https://elorae.world/players/{slug}.html", h)
    return (h + "</head>\n<body class=\"journal-page lore-page player-page\">\n" + bg + "\n" + mast + "\n"
            f'<main class="read">\n<h1>{html.escape(name)}</h1>\n'
            f'<aside id="nt-player" data-person="{slug}" aria-label="{html.escape(name, quote=True)}"></aside>\n'
            "</main>\n" + scripts + "</body>\n</html>\n")

out = ROOT / "players"
out.mkdir(exist_ok=True)
for slug, p in sorted(vis["people"].items()):
    (out / f"{slug}.html").write_text(page(slug, p["name"]))
    print("players/%s.html" % slug)
