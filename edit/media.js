/* Shared art catalog: upload, visibility, browse helpers (admin-first).
   Catalog: edit/media/catalog.json. Files: assets/<clean-name>.
   Visibility gates the editor gallery only — assets/ URLs stay public on Pages. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EloraeMedia = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var CATALOG = "edit/media/catalog.json";
  var ASSET_DIR = "assets";
  var MAX_BYTES = 5 * 1024 * 1024; // 5 MB: the most a stored image may be (after resizing)
  var MAX_INPUT = 60 * 1024 * 1024; // what you may pick: big PNG art is resized on upload
  /* Upload size policy: art is stored at most 2400 px on its long edge (the site shows it at up
     to ~1920 px wide; Cloudflare makes the smaller copies on request), as WebP at quality 0.9
     (alpha kept). A file that is already that small and under 1.5 MB is kept as it is, and so
     are GIFs (they may be animated). If the browser cannot write WebP, JPEG 0.9 is used (PNG
     when the art has transparency). */
  var MAX_EDGE = 2400, KEEP_BYTES = 1.5 * 1024 * 1024, QUALITY = 0.9;
  var OK_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/webp": "webp", "image/gif": "gif" };
  var PEOPLE = ["devin", "jack", "jon", "julie", "sawyer", "sylum", "jason"];

  function slugify(name) {
    return String(name || "image")
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[^\w\s\-]+/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .toLowerCase()
      .slice(0, 80) || "image";
  }
  function cleanFilename(name, ext) {
    var base = slugify(name);
    ext = String(ext || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    return base + "." + ext;
  }
  function idFromPath(path) {
    var base = String(path || "").split("/").pop() || "image";
    return slugify(base);
  }

  // Strip JPEG EXIF (APP1) and PNG tEXt/iTXt/zTXt; leave pixels alone.
  function stripMetadata(u8, mime) {
    if (!u8 || !u8.length) return u8;
    if (mime === "image/jpeg" || mime === "image/jpg") return stripJpegExif(u8);
    if (mime === "image/png") return stripPngText(u8);
    return u8;
  }
  function stripJpegExif(u8) {
    if (u8[0] !== 0xff || u8[1] !== 0xd8) return u8;
    var out = [0xff, 0xd8], i = 2;
    while (i + 3 < u8.length) {
      if (u8[i] !== 0xff) break;
      var marker = u8[i + 1], len = (u8[i + 2] << 8) | u8[i + 3];
      if (marker === 0xda) { // SOS — copy rest
        for (; i < u8.length; i++) out.push(u8[i]);
        return Uint8Array.from(out);
      }
      if (marker === 0xe1) { i += 2 + len; continue; } // skip APP1 (EXIF)
      for (var j = 0; j < 2 + len && i + j < u8.length; j++) out.push(u8[i + j]);
      i += 2 + len;
    }
    for (; i < u8.length; i++) out.push(u8[i]);
    return Uint8Array.from(out);
  }
  function stripPngText(u8) {
    if (u8.length < 8 || u8[0] !== 0x89) return u8;
    var out = Array.prototype.slice.call(u8.subarray(0, 8)), i = 8;
    while (i + 8 <= u8.length) {
      var len = (u8[i] << 24) | (u8[i + 1] << 16) | (u8[i + 2] << 8) | u8[i + 3];
      var type = String.fromCharCode(u8[i + 4], u8[i + 5], u8[i + 6], u8[i + 7]);
      var total = 12 + len;
      if (i + total > u8.length) break;
      if (type !== "tEXt" && type !== "iTXt" && type !== "zTXt") {
        for (var j = 0; j < total; j++) out.push(u8[i + j]);
      }
      i += total;
      if (type === "IEND") break;
    }
    return Uint8Array.from(out);
  }

  function toBlob(canvas, type, q) {
    if (canvas.convertToBlob) return canvas.convertToBlob({ type: type, quality: q });
    return new Promise(function (res, rej) { canvas.toBlob(function (b) { if (b) res(b); else rej(new Error("Could not encode the image.")); }, type, q); });
  }
  function hasAlpha(ctx, w, h) {
    try {
      var step = Math.max(1, Math.floor(Math.sqrt((w * h) / 250000))); // sample ~250k pixels
      var d = ctx.getImageData(0, 0, w, h).data;
      for (var y = 0; y < h; y += step) for (var x = 0; x < w; x += step) if (d[(y * w + x) * 4 + 3] < 255) return true;
    } catch (e) {}
    return false;
  }
  // Resize/compress a picked image to the policy above. Resolves { blob, mime, ext, width, height, resized }.
  function shrink(file) {
    var mime = file.type;
    if (mime === "image/gif" || typeof createImageBitmap !== "function") return Promise.resolve({ blob: file, mime: mime, ext: OK_TYPES[mime], resized: false });
    return createImageBitmap(file).then(function (bmp) {
      var w = bmp.width, h = bmp.height, k = Math.min(1, MAX_EDGE / Math.max(w, h));
      if (k === 1 && file.size <= KEEP_BYTES) { if (bmp.close) bmp.close(); return { blob: file, mime: mime, ext: OK_TYPES[mime], width: w, height: h, resized: false }; }
      var W = Math.max(1, Math.round(w * k)), H = Math.max(1, Math.round(h * k));
      var c = typeof OffscreenCanvas === "function" ? new OffscreenCanvas(W, H) : Object.assign(document.createElement("canvas"), { width: W, height: H });
      var ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bmp, 0, 0, W, H);
      if (bmp.close) bmp.close();
      return toBlob(c, "image/webp", QUALITY).then(function (b) {
        if (b && b.type === "image/webp") return b;
        return toBlob(c, hasAlpha(ctx, W, H) ? "image/png" : "image/jpeg", QUALITY);
      }).then(function (b) {
        // Never store a bigger file than the one picked when nothing needed resizing.
        if (k === 1 && b.size >= file.size) return { blob: file, mime: mime, ext: OK_TYPES[mime], width: w, height: h, resized: false };
        return { blob: b, mime: b.type, ext: OK_TYPES[b.type] || "webp", width: W, height: H, resized: true };
      });
    });
  }
  function validateFile(file) {
    if (!file) return Promise.reject(new Error("No file chosen."));
    if (file.__eeReady) return Promise.resolve(file.__eeReady);
    var ext = OK_TYPES[file.type];
    if (!ext) return Promise.reject(new Error("Use a PNG, JPEG, WebP or GIF."));
    if (file.size > MAX_INPUT) return Promise.reject(new Error("Image must be 60 MB or smaller."));
    return shrink(file).catch(function () { return { blob: file, mime: file.type, ext: ext, resized: false }; }).then(function (r) {
      if (r.blob.size > MAX_BYTES) throw new Error(r.mime === "image/gif" ? "GIFs must be 5 MB or smaller." : "This image is still over 5 MB after resizing; please export a smaller copy.");
      return r.blob.arrayBuffer().then(function (buf) {
        var u8 = stripMetadata(new Uint8Array(buf), r.mime);
        var info = { bytes: u8, mime: r.mime, ext: r.ext, name: file.name, width: r.width, height: r.height, resized: r.resized, blob: r.blob };
        try { Object.defineProperty(file, "__eeReady", { value: info, configurable: true }); } catch (e) {}
        return info;
      });
    });
  }

  /* ---- Card + hero art in page sources (shared by the Index organizer and the editor) ---- */
  var CDN_OPTS = "quality=82,format=auto,fit=scale-down,onerror=redirect";
  function encPath(p) {
    return String(p).split("/").map(function (seg) {
      try { seg = decodeURIComponent(seg); } catch (e) {}
      return encodeURIComponent(seg).replace(/[!'()*]/g, function (c) { return "%" + c.charCodeAt(0).toString(16).toUpperCase(); });
    }).join("/");
  }
  function attrEsc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
  // The same markup scripts/img-resize.py writes for Index card art.
  function cardImgHtml(assetPath) {
    var p = "/" + encPath(String(assetPath).replace(/^\/+/, ""));
    var u = function (w) { return "/cdn-cgi/image/width=" + w + "," + CDN_OPTS + p; };
    return '<img src="' + u(640) + '" srcset="' + [320, 480, 640, 960, 1280].map(function (w) { return u(w) + " " + w + "w"; }).join(", ") +
      '" sizes="(max-width: 800px) 88vw, 44vw" alt="" decoding="async">';
  }
  function artKey(src) {
    var s = String(src || "").trim().replace(/^https?:\/\/[^\/]+/i, "").replace(/^\/cdn-cgi\/image\/[^\/]+/i, "");
    try { s = decodeURIComponent(s); } catch (e) { try { s = decodeURI(s); } catch (e2) {} }
    return s.replace(/^\.\.\//, "/");
  }
  function parseTree(text) {
    var S = (typeof self !== "undefined" && self.EloraeSrcMap) || null;
    if (!S) throw new Error("Source map helpers not loaded.");
    return S.parse(text);
  }
  function findNode(n, test) {
    if (test(n)) return n;
    var k = n.children || [];
    for (var i = 0; i < k.length; i++) { var d = findNode(k[i], test); if (d) return d; }
    return null;
  }
  function hasCls(n, c) { return (n.classes || []).indexOf(c) >= 0; }
  function articleSlug(href) { var m = /\/articles\/([^\/?#]+?)(?:\.html|\/)?(?:[?#]|$)/.exec(href || ""); return m ? m[1] : null; }
  /* Index source: give every card linking to the article <slug> this art (replacing its old art,
     or turning a "no-art" card into an art card). onlyIf(oldKey): optional filter. Returns the
     new text (unchanged text when no card matched). */
  function setCardArt(text, slug, assetPath, onlyIf) {
    var root = parseTree(text), hits = [];
    (function walk(n) {
      if (n.tag === "a" && hasCls(n, "index-card") && n.attrs && articleSlug(n.attrs.href) === slug) hits.push(n);
      else (n.children || []).forEach(walk);
    })(root);
    hits.sort(function (a, b) { return b.start - a.start; });
    hits.forEach(function (a) {
      var img = findNode(a, function (n) { return n.tag === "img"; });
      if (onlyIf && !onlyIf(img ? artKey(img.attrs.src) : null)) return;
      var html = cardImgHtml(assetPath);
      if (img) { text = text.slice(0, img.start) + html + text.slice(img.end); }
      else { text = text.slice(0, a.closeStart) + html + text.slice(a.closeStart); }
      var open = text.slice(a.start, a.openEnd), open2 = open.replace(/(\sclass\s*=\s*")([^"]*)(")/i, function (m, x, c, y) {
        return x + c.split(/\s+/).filter(function (k) { return k && k !== "no-art"; }).join(" ") + y;
      });
      text = text.slice(0, a.start) + open2 + text.slice(a.openEnd);
    });
    return text;
  }
  /* Article source: hero art = assetPath (adds the <img> to a "no-art" hero). Returns new text,
     or null when the page has no hero. */
  function setHeroArt(text, assetPath, alt) {
    // A page with an art switcher: the new art replaces its main art (thumbnail included).
    var hp = heroParts(text);
    if (hp && hp.hasSwap && hp.arts.length > 1) {
      var arts = hp.arts.map(function (a) { return a; });
      var m0 = arts[hp.main];
      arts[hp.main] = { src: "/" + String(assetPath).replace(/^\/+/, ""), alt: alt != null ? alt : m0.alt, pos: null, raw: null };
      return setHeroArts(text, { arts: arts, main: hp.main });
    }
    var root = parseTree(text);
    var hero = findNode(root, function (n) { return n.tag === "section" && hasCls(n, "art-hero"); });
    if (!hero) return null;
    var src = "/" + encPath(String(assetPath).replace(/^\/+/, ""));
    var img = findNode(hero, function (n) { return n.tag === "img"; });
    if (img) {
      var raw = text.slice(img.start, img.end).replace(/(\ssrc\s*=\s*")[^"]*(")/i, function (m, a, b) { return a + src + b; });
      if (alt != null) raw = /\salt\s*=/.test(raw) ? raw.replace(/(\salt\s*=\s*")[^"]*(")/i, function (m, a, b) { return a + attrEsc(alt) + b; }) : raw.replace(/<img\b/i, '<img alt="' + attrEsc(alt) + '"');
      return text.slice(0, img.start) + raw + text.slice(img.end);
    }
    var tag = '<img src="' + src + '" alt="' + attrEsc(alt || "") + '">';
    var open = text.slice(hero.start, hero.openEnd).replace(/(\sclass\s*=\s*")([^"]*)(")/i, function (m, x, c, y) {
      return x + c.split(/\s+/).filter(function (k) { return k && k !== "no-art"; }).join(" ") + y;
    });
    return text.slice(0, hero.start) + open + tag + text.slice(hero.openEnd);
  }
  function heroArtKey(text) {
    var root = parseTree(text);
    var hero = findNode(root, function (n) { return n.tag === "section" && hasCls(n, "art-hero"); });
    var img = hero && findNode(hero, function (n) { return n.tag === "img"; });
    return img && img.attrs ? artKey(img.attrs.src) : null;
  }

  /* ---- Hero art sets (the article switcher, art-swap.js) ----
     Markup (articles/vaerek.html): <section class="art-hero has-swap"><img src alt> … art-title …
     <div class="art-swap" role="group" aria-label="Arts"><div class="art-swap-thumbs"><button …
     data-src data-alt>thumb</button>…</div><div class="art-swap-nav">‹ ›</div></div></section>,
     plus <script src="/art-swap.js?v=…"></script> after </main>. One art = a plain hero. */
  var ART_SWAP_V = "art9";
  var SWAP_NAV = '<div class="art-swap-nav"><button type="button" class="art-prev" aria-label="Previous art"><svg viewBox="0 0 8 14" aria-hidden="true"><polyline points="7,1 1,7 7,13" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg></button><button type="button" class="art-next" aria-label="Next art"><svg viewBox="0 0 8 14" aria-hidden="true"><polyline points="1,1 7,7 1,13" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg></button></div>';
  function decAttr(s) {
    return String(s == null ? "" : s).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  }
  function rootSrc(p) { return "/" + String(p || "").replace(/^(\.\.\/)+|^\/+/, ""); }
  /* Where the hero-art pieces sit in a page source (null when the page has no hero):
     head = the hero open tag (+ its picture), swap = the switcher (or the empty spot for one,
     just before </section>), script = the art-swap.js line (or the spot after </main>). */
  function heroParts(text) {
    var root = parseTree(text);
    var hero = findNode(root, function (n) { return n.tag === "section" && hasCls(n, "art-hero"); });
    if (!hero) return null;
    var img = null, swap = null;
    (hero.children || []).forEach(function (c) {
      if (!img && c.tag === "img" && !swap) img = c;
      if (!swap && c.tag === "div" && hasCls(c, "art-swap")) swap = c;
    });
    var headEnd = hero.openEnd, ws = "";
    if (img) { ws = text.slice(hero.openEnd, img.start); if (/^\s*$/.test(ws)) headEnd = img.end; else img = null; }
    var arts = [], main = 0, nav = null;
    if (swap) {
      var thumbs = findNode(swap, function (n) { return n.tag === "div" && hasCls(n, "art-swap-thumbs"); });
      (thumbs ? thumbs.children : []).forEach(function (b) {
        if (b.tag !== "button" || !b.attrs || b.attrs["data-src"] == null) return;
        if (hasCls(b, "on")) main = arts.length;
        arts.push({ src: decAttr(b.attrs["data-src"]), alt: decAttr(b.attrs["data-alt"] != null ? b.attrs["data-alt"] : b.attrs["aria-label"] || ""),
          pos: b.attrs["data-pos"] != null ? decAttr(b.attrs["data-pos"]) : null, raw: text.slice(b.start, b.end) });
      });
      var nv = findNode(swap, function (n) { return n.tag === "div" && hasCls(n, "art-swap-nav"); });
      if (nv) nav = text.slice(nv.start, nv.end);
    }
    if (!arts.length && img && img.attrs && img.attrs.src) arts.push({ src: decAttr(img.attrs.src), alt: decAttr(img.attrs.alt || ""), pos: null, raw: null });
    var sw = swap ? { start: swap.start - (text.charAt(swap.start - 1) === "\n" ? 1 : 0), end: swap.end } : { start: hero.closeStart, end: hero.closeStart };
    var sm = /<script src="\/art-swap\.js(?:\?v=[^"]*)?"><\/script>\n?/.exec(text), sc;
    if (sm) sc = { start: sm.index, end: sm.index + sm[0].length };
    else {
      var me = text.indexOf("</main>\n"), at = me >= 0 ? me + 8 : text.lastIndexOf("</body>");
      if (at < 0) at = text.length;
      sc = { start: at, end: at };
    }
    return {
      section: { start: hero.start, end: hero.end }, head: { start: hero.start, end: headEnd }, openRaw: text.slice(hero.start, hero.openEnd), ws: ws,
      imgRaw: img ? text.slice(img.start, img.end) : null, swap: sw, swapRaw: text.slice(sw.start, sw.end), hasSwap: !!swap,
      script: sc, scriptRaw: text.slice(sc.start, sc.end), arts: arts, main: Math.min(main, Math.max(0, arts.length - 1)), nav: nav
    };
  }
  function setAttr(tag, name, val) {
    var re = new RegExp("(\\s" + name + '\\s*=\\s*")[^"]*(")', "i");
    return re.test(tag) ? tag.replace(re, function (m, a, b) { return a + val + b; }) : tag.replace(/^<(\w+)/, function (m) { return m + " " + name + '="' + val + '"'; });
  }
  function setClass(tag, add, drop) {
    var has = /\sclass\s*=\s*"/i.test(tag);
    if (!has) tag = tag.replace(/^<(\w+)/, function (m) { return m + ' class=""'; });
    return tag.replace(/(\sclass\s*=\s*")([^"]*)(")/i, function (m, a, c, b) {
      var list = c.split(/\s+/).filter(function (k) { return k && drop.indexOf(k) < 0 && add.indexOf(k) < 0; });
      return a + list.concat(add).join(" ") + b;
    });
  }
  function thumbHtml(src) {
    var p = "/" + encPath(rootSrc(src).slice(1));
    var u = function (w) { return "/cdn-cgi/image/width=" + w + "," + CDN_OPTS + p; };
    return '<img src="' + u(320) + '" srcset="' + [160, 320, 480].map(function (w) { return u(w) + " " + w + "w"; }).join(", ") + '" sizes="164px" alt="" loading="lazy" decoding="async">';
  }
  function swapButton(a, on) {
    var src = attrEsc(a.src), alt = attrEsc(a.alt || "");
    if (a.raw && !a.changed) {
      var t = a.raw, open = /^<button\b[^>]*>/i.exec(t)[0], o2 = open;
      o2 = o2.replace(/(\sclass\s*=\s*")([^"]*)(")/i, function (m, x, c, y) {
        var l = c.split(/\s+/).filter(function (k) { return k && k !== "on"; }); if (on) l.unshift("on"); return x + l.join(" ") + y;
      });
      o2 = setAttr(o2, "aria-pressed", on ? "true" : "false");
      if (a.altChanged) { o2 = setAttr(o2, "aria-label", alt); o2 = setAttr(o2, "data-alt", alt); }
      return o2 + t.slice(open.length);
    }
    return '<button type="button" class="' + (on ? "on" : "") + '" aria-pressed="' + (on ? "true" : "false") + '" aria-label="' + alt + '" data-src="' + src + '" data-alt="' + alt + '"' +
      (a.pos ? ' data-pos="' + attrEsc(a.pos) + '"' : "") + ">" + thumbHtml(a.src) + "</button>";
  }
  /* The three replacement strings for an art set {arts:[{src,alt,pos,raw,changed,altChanged}], main}. */
  function heroArtsHtml(parts, set) {
    var arts = set.arts, main = Math.max(0, Math.min(set.main || 0, arts.length - 1)), m = arts[main];
    var multi = arts.length > 1;
    var cls0 = (/\sclass\s*=\s*"([^"]*)"/i.exec(parts.openRaw) || [])[1] || "";
    var hasSw = /(^|\s)has-swap(\s|$)/.test(cls0), noArt = /(^|\s)no-art(\s|$)/.test(cls0);
    var open = (hasSw === multi && !(noArt && m)) ? parts.openRaw : setClass(parts.openRaw, multi ? ["has-swap"] : [], m ? ["has-swap", "no-art"] : ["has-swap"]);
    var img = "";
    if (m) {
      var src = rootSrc(m.src).replace(/"/g, "%22");
      img = parts.imgRaw ? setAttr(setAttr(parts.imgRaw, "src", src), "alt", attrEsc(m.alt || "")) : '<img src="' + src + '" alt="' + attrEsc(m.alt || "") + '">';
      if (parts.imgRaw && decAttr((/\ssrc\s*=\s*"([^"]*)"/i.exec(parts.imgRaw) || [])[1]) === m.src && decAttr((/\salt\s*=\s*"([^"]*)"/i.exec(parts.imgRaw) || [])[1] || "") === (m.alt || "")) img = parts.imgRaw;
    } else if (parts.imgRaw) img = parts.imgRaw;
    var head = open + parts.ws + img;
    var swap = multi ? "\n" + '<div class="art-swap" role="group" aria-label="Arts"><div class="art-swap-thumbs">' +
      arts.map(function (a, i) { return swapButton(a, i === main); }).join("") + "</div>" + (parts.nav || SWAP_NAV) + "</div>" : "";
    if (multi && parts.hasSwap) {
      // Keep the switcher's own wrapper bytes when it was there already.
      var raw = parts.swapRaw, ts = raw.indexOf('<div class="art-swap-thumbs">');
      var te = parts.nav ? raw.indexOf(parts.nav) : -1;
      if (ts >= 0 && te > ts) swap = raw.slice(0, ts) + '<div class="art-swap-thumbs">' + arts.map(function (a, i) { return swapButton(a, i === main); }).join("") + "</div>" + raw.slice(te);
    }
    var script = multi ? (parts.scriptRaw && /art-swap\.js/.test(parts.scriptRaw) ? parts.scriptRaw : '<script src="/art-swap.js?v=' + ART_SWAP_V + '"></script>\n') : "";
    return { head: head, swap: swap, script: script };
  }
  /* Whole-file helper (Index organizer, tests): apply an art set to a page source. */
  function setHeroArts(text, set) {
    var parts = heroParts(text);
    if (!parts) return null;
    var h = heroArtsHtml(parts, set);
    var edits = [{ r: parts.head, html: h.head }, { r: parts.swap, html: h.swap }, { r: parts.script, html: h.script }].sort(function (a, b) { return b.r.start - a.r.start; });
    edits.forEach(function (e) { text = text.slice(0, e.r.start) + e.html + text.slice(e.r.end); });
    return text;
  }

  /* ---- A renamed article: its name everywhere it is written out (not lore text) ---- */
  function escTextHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function decText(s) { return decAttr(String(s).replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(+n); }).replace(/&nbsp;/g, "\u00a0")); }
  /* Index source: the cards of <slug> named oldName get newName (every copy of the card), and so
     do their entries in the Index's category panel. */
  /* The card's epithet (epi1): data-epithet="…" on the card link, right after href; dropped when empty. */
  function setCardEpithet(card, ep) {
    ep = String(ep == null ? "" : ep).replace(/\s+/g, " ").trim().replace(/\.$/, "");
    var open = /^<a\b[^>]*>/.exec(card); if (!open) return card;
    var tag = open[0].replace(/\sdata-epithet="[^"]*"/, "");
    if (ep) tag = /\shref="[^"]*"/.test(tag) ? tag.replace(/(\shref="[^"]*")/, '$1 data-epithet="' + epAttr(ep) + '"') : tag.replace(/>$/, ' data-epithet="' + epAttr(ep) + '">');
    return tag + card.slice(open[0].length);
  }
  function epAttr(v) { return String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;"); }
  /* force (every admin save of the article): the cards always end up showing the article's own
     name and epithet, whatever they said before (an earlier save that never reached the Index, a
     card typed differently, quotes ' vs \u2019 …). */
  function renameIndexCards(text, slug, oldName, newName, oldEp, newEp, force) {
    var ids = [], epi = newEp != null && (force || oldEp !== newEp);
    var same = function (t) { return force || decText(t) === oldName; };
    text = text.replace(/<a\b[^>]*\bclass="index-card\b[^"]*"[^>]*>[\s\S]*?<\/a>/g, function (card) {
      var h = /\shref="([^"]*)"/.exec(card);
      if (!h || articleSlug(h[1]) !== slug) return card;
      var id = /\sid="([^"]*)"/.exec(card); if (id) ids.push(id[1]);
      if (newName && (force || oldName !== newName)) card = card.replace(/<span>([^<]*)<\/span>/, function (m, t) { return same(t) && decText(t) !== newName ? "<span>" + escTextHtml(newName) + "</span>" : m; });
      if (epi) {
        var cur = (/^<a\b[^>]*\sdata-epithet="([^"]*)"/.exec(card) || [])[1];
        var want = String(newEp).replace(/\s+/g, " ").trim().replace(/\.$/, "");
        if (decText(cur || "") !== want) card = setCardEpithet(card, newEp);
      }
      return card;
    });
    if (ids.length && newName && (force || oldName !== newName)) text = text.replace(/(<a class="toc-name[^"]*" href="#)([^"]+)(">)([^<]*)(<\/a>)/g, function (m, a, id, b, t, c) {
      return ids.indexOf(id) >= 0 && same(t) && decText(t) !== newName ? a + id + b + escTextHtml(newName) + c : m;
    });
    return text;
  }
  /* slug -> { name, ep } for every Index card in an Index source (first card of a slug wins). */
  function cardNames(text) {
    var out = {};
    String(text).replace(/<a\b[^>]*\bclass="index-card\b[^"]*"[^>]*>[\s\S]*?<\/a>/g, function (card) {
      var h = /\shref="([^"]*)"/.exec(card), k = h && articleSlug(h[1]);
      if (!k || out[k]) return card;
      var sp = /<span>([^<]*)<\/span>/.exec(card), ep = /^<a\b[^>]*\sdata-epithet="([^"]*)"/.exec(card);
      out[k] = { name: sp ? decText(sp[1]) : null, ep: ep ? decText(ep[1]) : "" };
      return card;
    });
    return out;
  }
  /* Article sources: the category rail (toc-name links) and "related" lists naming <slug>. */
  function renameArticleLinks(text, slug, oldName, newName) {
    return text.replace(/(<li>)?<a\b([^>]*)>([^<]*)<\/a>/g, function (m, li, attrs, t) {
      var h = /\shref="([^"]*)"/.exec(attrs);
      if (!h || articleSlug(h[1]) !== slug || decText(t) !== oldName) return m;
      if (!li && !/\sclass="toc-name\b/.test(attrs)) return m;
      return (li || "") + "<a" + attrs + ">" + escTextHtml(newName) + "</a>";
    });
  }
  /* The article's own head: <title>, og/twitter titles, and descriptions that start with
     "Name, Epithet". Also og:image when the main art changed. */
  function renameHead(text, o) {
    var he = text.indexOf("</head>"); if (he < 0) return text;
    var head = text.slice(0, he), rest = text.slice(he);
    if (o.oldName && o.newName && o.oldName !== o.newName) {
      head = head.replace(/(<title>)([^<]*)( - Elorae<\/title>)/, function (m, a, t, b) { return decText(t) === o.oldName ? a + escTextHtml(o.newName) + b : m; });
      head = head.replace(/(<meta (?:property|name)="(?:og:title|twitter:title)" content=")([^"]*)(")/g, function (m, a, t, b) { return decText(t) === o.oldName ? a + attrEsc(o.newName) + b : m; });
    }
    var on = o.oldName || "", nn = o.newName || on, oe = o.oldEpithet, ne = o.newEpithet;
    if (on) head = head.replace(/(<meta (?:property|name)="(?:og:description|description|twitter:description)" content=")([^"]*)(")/g, function (m, a, t, b) {
      var d = decText(t), out = d;
      if (oe != null && ne != null && oe !== ne && oe && d.indexOf(on + ", " + oe) === 0) out = nn + ", " + ne + d.slice((on + ", " + oe).length);
      else if (nn !== on && d.indexOf(on) === 0 && /^[,.\s]/.test(d.slice(on.length))) out = nn + d.slice(on.length);
      return out === d ? m : a + attrEsc(out) + b;
    });
    if (o.oldArt && o.newArt) head = head.replace(/(<meta property="og:image" content=")([^"]*)(")/, function (m, a, u, b) {
      var k = function (x) { x = artKey(x); try { x = decodeURIComponent(x); } catch (e) {} return x; };
      return k(u) === k(o.oldArt) ? a + "https://elorae.world/" + encPath(String(o.newArt).replace(/^\/+/, "")) + b : m;
    });
    return head + rest;
  }
  /* search-index.js: the entry for articles/<slug>.html gets the new title (and image). */
  function renameSearchEntry(text, slug, o) {
    var key = '"href":"articles/' + slug + '.html"', i = text.indexOf(key);
    if (i < 0) return text;
    var s0 = text.lastIndexOf('{"title":', i), e0 = text.indexOf('"owner":', i);
    if (s0 < 0 || e0 < 0) return text;
    var e1 = text.indexOf("}", e0); if (e1 < 0) return text;
    var ent = text.slice(s0, e1 + 1), out = ent;
    if (o.newName && o.oldName && o.newName !== o.oldName) out = out.replace(/^\{"title":("(?:[^"\\]|\\.)*")/, function (m, q) { var t; try { t = JSON.parse(q); } catch (e) { return m; } return t === o.oldName ? '{"title":' + JSON.stringify(o.newName) : m; });
    if (o.newArt && o.oldArt) out = out.replace(/("image":)("(?:[^"\\]|\\.)*")/, function (m, a, q) { var t; try { t = JSON.parse(q); } catch (e) { return m; } return artKey("/" + t) === artKey(o.oldArt) ? a + JSON.stringify(String(o.newArt).replace(/^\/+/, "")) : m; });
    return out === ent ? text : text.slice(0, s0) + out + text.slice(e1 + 1);
  }

  /* ---------- Deleting an article: reference clean-up (pure text → text) ---------- */
  var EMPTY_CARDS = '<p class="index-empty">None filed here yet</p>';
  function reEsc(x) { return String(x).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  // href="…" pointing at the article (any of /articles/s/, /articles/s.html, ../articles/s/index.html, #hash).
  function slugHrefRe(slug) { return new RegExp('\\shref="(?:\\.\\./)*/?articles/' + reEsc(slug) + '(?:\\.html|/(?:index\\.html)?)?(?:#[^"]*)?"'); }
  function linksTo(text, slug) { return slugHrefRe(slug).test(String(text)); }
  // Balanced <div …>…</div> starting at i → end index (exclusive), or -1.
  function divEnd(text, i) {
    var re = /<div\b|<\/div>/g, depth = 0, m; re.lastIndex = i;
    while ((m = re.exec(text))) { if (m[0] === "</div>") { if (--depth === 0) return re.lastIndex; } else depth++; }
    return -1;
  }
  // A category rail / Index panel group whose every name was removed loses its toggle + empty list.
  function dropEmptyNests(text) {
    return text.replace(/<button type="button" class="toc-tog"[^>]*>(?:(?!<\/button>)[\s\S])*<\/button><\/div><div class="toc-nest"><\/div>/g, "</div>");
  }
  /* Other pages: rail entries, related-list items, mast character marks and search-page art
     tiles for the article go; any other link to it (prose mentions, timeline) becomes plain text. */
  function unlinkArticle(text, slug) {
    var re = slugHrefRe(slug), t = String(text);
    if (!re.test(t)) return t;
    var hit = function (tag) { return re.test(tag); };
    t = t.replace(/<a class="toc-name[^"]*"[^>]*>[^<]*<\/a>/g, function (m) { return hit(m) ? "" : m; });
    t = t.replace(/<li><a\b[^>]*>[^<]*<\/a><\/li>/g, function (m) { return hit(m) ? "" : m; });
    t = t.replace(/(<span class="friend"[^>]*>)((?:<a\b[^>]*>[^<]*<\/a>)*)(<\/span>)/g, function (m, a, inner, b) {
      var n = inner.replace(/<a\b[^>]*>[^<]*<\/a>/g, function (x) { return hit(x) ? "" : x; });
      return n === inner ? m : (n ? a + n + b : "");
    });
    t = t.replace(/<a class="tile"[^>]*>[\s\S]*?<\/a>/g, function (m) { return hit(/^<a[^>]*>/.exec(m)[0]) ? "" : m; });
    t = t.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/g, function (m, attrs, inner) { return re.test(attrs) && !/class="index-card/.test(attrs) ? inner : m; });
    return dropEmptyNests(t);
  }
  /* Index source: every card of these articles goes (all sections), with its panel entry; a box
     left with no cards gets the site's "None filed here yet". */
  function removeIndexCards(text, slugs) {
    var ids = [], set = {}; (slugs || []).forEach(function (x) { set[x] = 1; });
    var t = String(text).replace(/<a\b[^>]*\bclass="index-card\b[^"]*"[^>]*>[\s\S]*?<\/a>/g, function (card) {
      var h = /\shref="([^"]*)"/.exec(card), sl = h && articleSlug(h[1]);
      if (!sl || !set[sl]) return card;
      var id = /\sid="([^"]*)"/.exec(card); if (id) ids.push(id[1]);
      return "";
    });
    t = t.replace(/<div class="index-cards">\s*<\/div>/g, '<div class="index-cards">' + EMPTY_CARDS + "</div>");
    if (ids.length) t = t.replace(/<a class="toc-name[^"]*" href="#([^"]+)">[^<]*<\/a>/g, function (m, id) { return ids.indexOf(id) >= 0 ? "" : m; });
    return dropEmptyNests(t);
  }
  // Category rails (articles) / Index panel: the group for a removed top-level section.
  function removeRailSection(text, secId) {
    var t = String(text), re = new RegExp('<div class="toc-cat[^"]*"><div class="toc-row"><a class="[^"]*" href="(?:/index/ancients/)?#' + reEsc(secId) + '">', "g"), m, out = "", last = 0;
    while ((m = re.exec(t))) { var e = divEnd(t, m.index); if (e < 0) break; out += t.slice(last, m.index); last = e; re.lastIndex = e; }
    return last ? out + t.slice(last) : t;
  }
  function setArtBack(text, href) {
    return String(text).replace(/(<a class="art-back" href=")([^"]*)(")/, function (m, a, h, b) { return a + attrEsc(href) + b; });
  }
  function artBackOf(text) { var m = /<a class="art-back" href="([^"]*)"/.exec(String(text)); return m ? m[1] : null; }
  function removeSearchEntry(text, slug) {
    var m = /^([\s\S]*?=\s*)(\[[\s\S]*\])(;?\s*)$/.exec(String(text)); if (!m) return text;
    var arr; try { arr = JSON.parse(m[2]); } catch (e) { return text; }
    var href = "articles/" + slug + ".html", keep = arr.filter(function (e) { return !e || e.href !== href; });
    return keep.length === arr.length ? text : m[1] + JSON.stringify(keep) + m[3];
  }
  function removeSitemap(text, slug) {
    return String(text).replace(new RegExp('[ \\t]*<url><loc>[^<]*/articles/' + reEsc(slug) + '(?:\\.html|/)</loc>[\\s\\S]*?</url>\\r?\\n?', "g"), "");
  }
  function jsonOut(obj) { return JSON.stringify(obj, null, 2) + "\n"; }
  // profiles.json: the article leaves every player's editable list (and its name their characters).
  function pruneProfiles(text, slug, name) {
    var o; try { o = JSON.parse(text); } catch (e) { return text; }
    var path = "articles/" + slug + ".html", changed = false;
    Object.keys(o.profiles || {}).forEach(function (k) {
      var pr = o.profiles[k];
      if (Array.isArray(pr.permissions) && pr.permissions.indexOf(path) >= 0) {
        pr.permissions = pr.permissions.filter(function (x) { return x !== path; }); changed = true;
        if (name && Array.isArray(pr.characters)) pr.characters = pr.characters.filter(function (c) { return c !== name; });
      }
    });
    return changed ? jsonOut(o) : text;
  }
  // Who owns it (a player's character): from profiles.json → [person].
  function ownersOf(profilesText, slug) {
    var o; try { o = JSON.parse(profilesText); } catch (e) { return []; }
    var path = "articles/" + slug + ".html", out = [];
    Object.keys(o.profiles || {}).forEach(function (k) { var pr = o.profiles[k]; if (pr.role !== "admin" && Array.isArray(pr.permissions) && pr.permissions.indexOf(path) >= 0) out.push(pr.person || pr.name || k); });
    return out;
  }
  function pruneVisibility(text, slug) {
    var o; try { o = JSON.parse(text); } catch (e) { return text; }
    var path = "articles/" + slug + ".html", changed = false;
    Object.keys(o.secrets || {}).forEach(function (k) { var e = o.secrets[k]; if (e && (e.path === path || e.path === "articles/" + slug + "/index.html")) { delete o.secrets[k]; changed = true; } });
    return changed ? jsonOut(o) : text;
  }
  function pruneCatalog(text, paths) {
    var o; try { o = JSON.parse(text); } catch (e) { return text; }
    var keys = (paths || []).map(function (p) { return artKey("/" + String(p).replace(/^\/+/, "")); }), changed = false;
    Object.keys(o.media || {}).forEach(function (k) { var e = o.media[k]; if (e && keys.indexOf(artKey("/" + String(e.path || "").replace(/^\/+/, ""))) >= 0) { delete o.media[k]; changed = true; } });
    return changed ? jsonOut(o) : text;
  }
  // Does this page use the image (src/srcset/data-src/og:image, raw or URL-encoded)?
  function usesImage(text, assetPath) {
    var p = String(assetPath).replace(/^\/+/, ""), t = String(text);
    return t.indexOf(p) >= 0 || t.indexOf(encPath(p)) >= 0 || t.indexOf(encodeURI(p)) >= 0;
  }
  // Images an article page shows: hero (every art of a switcher) + og:image.
  function articleImages(text) {
    var out = [], add = function (u) { if (!u) return; var k = artKey(u).replace(/^\/+/, ""); if (k && /^assets\//.test(k) && out.indexOf(k) < 0) out.push(k); };
    var parts = heroParts(text);
    if (parts && parts.arts) parts.arts.forEach(function (a) { add(a.src); });
    var h = /<section class="art-hero[^"]*"[\s\S]*?<\/section>/.exec(text);
    if (h) (h[0].match(/\s(?:src|data-src)="([^"]*)"/g) || []).forEach(function (x) { add(/"([^"]*)"/.exec(x)[1]); });
    var og = /<meta property="og:image" content="([^"]*)"/.exec(text); if (og) add(og[1]);
    return out;
  }

  function canSee(entry, person, isAdmin) {
    if (!entry) return false;
    if (isAdmin || person === "devin") return true;
    if (entry.everyone) return true;
    var a = entry.allowed || [];
    return !!(person && a.indexOf(person) >= 0);
  }

  function listVisible(catalog, person, isAdmin) {
    var out = [], media = (catalog && catalog.media) || {};
    Object.keys(media).forEach(function (id) {
      if (canSee(media[id], person, isAdmin)) out.push(Object.assign({ id: id }, media[id]));
    });
    out.sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")); });
    return out;
  }

  function uniqueId(catalog, base) {
    var id = base, n = 2, media = (catalog && catalog.media) || {};
    while (media[id]) { id = base + "-" + n; n++; }
    return id;
  }
  function uniquePath(catalog, filename) {
    var path = ASSET_DIR + "/" + filename, media = (catalog && catalog.media) || {}, n = 2;
    var used = {};
    Object.keys(media).forEach(function (id) { used[media[id].path] = 1; });
    var stem = filename.replace(/\.[^.]+$/, ""), ext = (filename.match(/\.[^.]+$/) || [".png"])[0];
    while (used[path]) { path = ASSET_DIR + "/" + stem + "-" + n + ext; n++; }
    return path;
  }

  // Build a new catalog entry + file payload for commitFiles.
  // opts: { title, tags, owner, allowed, everyone, uploadedBy }
  function prepareUpload(catalog, fileInfo, opts) {
    opts = opts || {};
    var title = (opts.title || fileInfo.name || "Image").replace(/\.[a-z0-9]+$/i, "").trim() || "Image";
    var filename = cleanFilename(title, fileInfo.ext);
    var path = uniquePath(catalog, filename);
    var id = uniqueId(catalog, idFromPath(path));
    var owner = opts.owner || opts.uploadedBy || "devin";
    var allowed = Array.isArray(opts.allowed) ? opts.allowed.slice() : [owner];
    if (allowed.indexOf("devin") < 0) allowed.unshift("devin");
    if (allowed.indexOf(owner) < 0) allowed.push(owner);
    allowed = allowed.filter(function (p, i, a) { return a.indexOf(p) === i; });
    var entry = {
      path: path,
      title: title,
      tags: Array.isArray(opts.tags) ? opts.tags.filter(Boolean) : [],
      uploadedBy: opts.uploadedBy || owner,
      date: new Date().toISOString(),
      owner: owner,
      allowed: allowed,
      everyone: !!opts.everyone
    };
    var next = JSON.parse(JSON.stringify(catalog));
    next.media = next.media || {};
    next.media[id] = entry;
    return {
      id: id,
      entry: entry,
      catalog: next,
      files: [
        { path: CATALOG, text: JSON.stringify(next, null, 2) + "\n" },
        { path: path, binary: true, bytes: fileInfo.bytes }
      ]
    };
  }

  function setVisibility(catalog, id, patch) {
    var next = JSON.parse(JSON.stringify(catalog));
    var e = next.media && next.media[id];
    if (!e) throw new Error("Unknown image.");
    if (patch.everyone != null) e.everyone = !!patch.everyone;
    if (patch.allowed) {
      e.allowed = patch.allowed.slice();
      if (e.allowed.indexOf("devin") < 0) e.allowed.unshift("devin");
      if (e.allowed.indexOf(e.owner) < 0) e.allowed.push(e.owner);
    }
    if (patch.title != null) e.title = String(patch.title);
    if (patch.tags) e.tags = patch.tags.filter(Boolean);
    return next;
  }

  // Relative src from an article HTML path to an assets/ file.
  function srcFromArticle(articlePath, assetPath) {
    var depth = String(articlePath || "").split("/").length - 1;
    var prefix = depth > 0 ? new Array(depth + 1).join("../") : "";
    return prefix + assetPath;
  }

  var IMG_EXT = { png: 1, jpg: 1, jpeg: 1, webp: 1, gif: 1 };

  function isAssetImagePath(path) {
    var p = String(path || "");
    if (p.indexOf(ASSET_DIR + "/") !== 0) return false;
    // Top-level assets only (skip lore-blur/ and other subfolders).
    var rest = p.slice(ASSET_DIR.length + 1);
    if (!rest || rest.indexOf("/") >= 0) return false;
    var ext = (rest.match(/\.([a-z0-9]+)$/i) || [])[1];
    return !!(ext && IMG_EXT[ext.toLowerCase()]);
  }

  function titleFromPath(path) {
    var base = String(path || "").split("/").pop() || "Image";
    return base.replace(/\.[a-z0-9]+$/i, "").trim() || "Image";
  }

  // Merge existing on-disk assets into a catalog without re-upload.
  // paths: ["assets/Foo.png", ...] (from GitHub contents listing or a seed list).
  // Returns { catalog, added: [{id,path}], skipped: n }. Does not mutate input.
  function seedFromAssetPaths(catalog, paths, opts) {
    opts = opts || {};
    var next = JSON.parse(JSON.stringify(catalog && catalog.media ? catalog : { version: 1, media: {} }));
    next.version = next.version || 1;
    next.media = next.media || {};
    if (catalog && catalog._readme && !next._readme) next._readme = catalog._readme;
    var usedPaths = {};
    Object.keys(next.media).forEach(function (id) {
      if (next.media[id] && next.media[id].path) usedPaths[next.media[id].path] = id;
    });
    var added = [];
    var skipped = 0;
    var owner = opts.owner || "devin";
    var everyone = opts.everyone !== false;
    var allowed = Array.isArray(opts.allowed) ? opts.allowed.slice() : PEOPLE.slice();
    if (allowed.indexOf("devin") < 0) allowed.unshift("devin");
    // Removed from the gallery (gallery manager): an assets/ file listed in catalog.hidden is not re-seeded.
    var hidden = {}; ((catalog && catalog.hidden) || []).forEach(function (x) { hidden[x] = 1; });
    (paths || []).forEach(function (path) {
      if (hidden[path]) return;
      path = String(path || "");
      if (!isAssetImagePath(path)) { skipped++; return; }
      if (usedPaths[path]) { skipped++; return; }
      var id = uniqueId(next, idFromPath(path));
      var entry = {
        path: path,
        title: titleFromPath(path),
        tags: Array.isArray(opts.tags) ? opts.tags.filter(Boolean) : ["site", "seed"],
        uploadedBy: opts.uploadedBy || "seed",
        date: opts.date || "2026-10-07T00:00:00.000Z",
        owner: owner,
        allowed: allowed.slice(),
        everyone: !!everyone
      };
      next.media[id] = entry;
      usedPaths[path] = id;
      added.push({ id: id, path: path });
    });
    return { catalog: next, added: added, skipped: skipped };
  }

  return {
    CATALOG: CATALOG,
    ASSET_DIR: ASSET_DIR,
    MAX_BYTES: MAX_BYTES,
    MAX_EDGE: MAX_EDGE,
    shrink: shrink,
    cardImgHtml: cardImgHtml,
    setCardArt: setCardArt,
    setHeroArt: setHeroArt,
    heroArtKey: heroArtKey,
    heroParts: heroParts,
    renameIndexCards: renameIndexCards, cardNames: cardNames,
    setCardEpithet: setCardEpithet,
    linksTo: linksTo, unlinkArticle: unlinkArticle, removeIndexCards: removeIndexCards, removeRailSection: removeRailSection,
    setArtBack: setArtBack, artBackOf: artBackOf, removeSearchEntry: removeSearchEntry, removeSitemap: removeSitemap,
    pruneProfiles: pruneProfiles, ownersOf: ownersOf, pruneVisibility: pruneVisibility, pruneCatalog: pruneCatalog,
    usesImage: usesImage, articleImages: articleImages,
    renameArticleLinks: renameArticleLinks,
    renameHead: renameHead,
    renameSearchEntry: renameSearchEntry,
    heroArtsHtml: heroArtsHtml,
    setHeroArts: setHeroArts,
    thumbHtml: thumbHtml,
    ART_SWAP_V: ART_SWAP_V,
    encPath: encPath,
    artKey: artKey,
    articleSlug: articleSlug,
    PEOPLE: PEOPLE,
    slugify: slugify,
    cleanFilename: cleanFilename,
    validateFile: validateFile,
    stripMetadata: stripMetadata,
    canSee: canSee,
    listVisible: listVisible,
    prepareUpload: prepareUpload,
    setVisibility: setVisibility,
    srcFromArticle: srcFromArticle,
    idFromPath: idFromPath,
    isAssetImagePath: isAssetImagePath,
    titleFromPath: titleFromPath,
    seedFromAssetPaths: seedFromAssetPaths
  };
});
