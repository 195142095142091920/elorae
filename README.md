# Elorae

Visual encyclopedia of the world away.



## Images (img-resize)

elorae.world sits behind Cloudflare with Image Transformations on. Every image except
article hero art is served resized via `/cdn-cgi/image/width=W,quality=82,format=auto,fit=scale-down,onerror=redirect/<path>`
with `srcset` + `sizes` matched to its display size. One source file per image in `assets/`.

- Static pages: `python3 scripts/img-resize.py` rewrites every `<img>` (idempotent; re-run after
  adding pages, cards, journal art or editor saves) and adds `/img.js` to each page head.
- JS-rendered images (search, player cards, Edit gallery, journal backdrop) use `window.eloraeImg`
  from `/img.js`, which also swaps a failed resized URL back to the original once.
- Off elorae.world (localhost/file previews) originals are used.
