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
  var MAX_BYTES = 5 * 1024 * 1024; // 5 MB
  var OK_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/webp": "webp", "image/gif": "gif" };
  var PEOPLE = ["devin", "jack", "jon", "julie", "sawyer", "sylum"];

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

  function validateFile(file) {
    if (!file) return Promise.reject(new Error("No file chosen."));
    var ext = OK_TYPES[file.type];
    if (!ext) return Promise.reject(new Error("Use a PNG, JPEG, WebP or GIF."));
    if (file.size > MAX_BYTES) return Promise.reject(new Error("Image must be 5 MB or smaller."));
    return file.arrayBuffer().then(function (buf) {
      var u8 = stripMetadata(new Uint8Array(buf), file.type);
      return { bytes: u8, mime: file.type, ext: ext, name: file.name };
    });
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
