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
    try { s = decodeURI(s); } catch (e) {}
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
    (paths || []).forEach(function (path) {
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
