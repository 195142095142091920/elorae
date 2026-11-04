/* al1 (2026-11-04): the auto-link map (/autolink.json at the site root) — which words link to which article.
   autolink.json = { version, articles: { "<slug>": { n: "<name>", o: "<private owner>"? } },
                     terms: { "<Word or Phrase>": "<slug>" }, skipped: { "<term>": [slugs] }, reserved: [names] }
   Terms, per article:
   - its full name (the article's h1);
   - each part of a plain two-to-four-word proper name ("Vaerek Rathkin" -> "Vaerek", "Rathkin")
     when the part is 4+ letters, capitalised, not a title/common word and no other article shares it;
   - every Capitalised gallery tag (edit/media/catalog.json) on an image used as that article's
     hero or Art-strip picture (edit/media/usage.json). Lowercase tags are filing tags and ignored.
   A term that would point at two articles is skipped (listed in "skipped"); names of Atlas places
   ("reserved") are never used as name parts. Tags win over automatic name parts.
   - tools/build-autolink.js builds it for the whole site (node, this file's pure helpers).
   - core.js commitFiles() refreshes it in the same commit whenever an admin save writes the
     catalog, usage.json or an article page — so a tag edit in the Gallery is live on the next deploy.
   The site script /autolink.js reads it on every page load. */
(function (root) {
  "use strict";
  var PATH = "autolink.json";
  var CATALOG = "edit/media/catalog.json", USAGE = "edit/media/usage.json";
  var STOP = ("the of and a an in on at to from for by with into upon under over between beyond " +
    "king queen lord lady prince princess sir saint high great old new elder young first last " +
    "house order circle court church temple city empire kingdom realm council guard guild " +
    "god goddess divine ancient dragon dragons spirit spirits flame fire shadow light dark night day " +
    "dream dreams bell blade crown war age era cursed blessed true false black white red blue green gold " +
    "silver iron stone star stars starry sun moon sea sky storm wild free six seven five four three two one " +
    "falls fall fell cavern caverns phantom host revenant arrival tide tides basin forest river lake mount mountain " +
    "isle island sands peak vale keep tower gate hall coast bay reach wood woods tears fort hollow grove " +
    "will hope grace faith mark rose").split(" ");
  var STOPSET = {}; STOP.forEach(function (w) { STOPSET[w] = 1; });
  function unent(s) {
    return String(s).replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&rsquo;/g, "\u2019").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  }
  function clean(s) { return unent(String(s || "").replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim(); }
  // "articles/<slug>/index.html" | "articles/<slug>.html" -> slug, else null.
  function slugOf(path) { var m = /^\/?articles\/([^\/]+?)(?:\/index)?\.html$/.exec(String(path)) || /^\/?articles\/([^\/]+)\/?$/.exec(String(path)); return m ? m[1] : null; }
  // An article page -> { n, o } (or null when it has no title).
  function parseArticle(html) {
    html = String(html || "");
    var m = /<div class="art-title"[^>]*>\s*<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html) || /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
    var n = m ? clean(m[1]) : "";
    if (!n) return null;
    var out = { n: n };
    var mm = /<main\b[^>]*>/i.exec(html);
    if (mm && /\bclass="[^"]*\bprivate\b/.test(mm[0])) { var o = /data-owner="([a-z]+)"/.exec(mm[0]); out.o = o ? o[1] : "devin"; }
    return out;
  }
  function isProper(t) { return /^[A-Z\u00C0-\u00DE]/.test(t); }
  function parts(name) {
    var w = name.split(" ");
    if (w.length < 2 || w.length > 4) return [];
    if (!w.every(function (x) { return /^[A-Z\u00C0-\u00DE][\w\u00C0-\u017F'\u2019-]*$/.test(x); })) return [];
    if (w.some(function (x) { return STOPSET[x.toLowerCase()] || /['\u2019]/.test(x); })) return [];
    return w.filter(function (x) { return x.length >= 4; });
  }
  // articles: { slug: {n, o} }, catalog: catalog.json object, usage: usage.json object, reserved: [names]
  function compute(articles, catalog, usage, reserved) {
    var terms = {}, skipped = {}, res = {};
    (reserved || []).forEach(function (r) { res[r] = 1; });
    function claim(map, term, slug) { (map[term] = map[term] || []).indexOf(slug) < 0 && map[term].push(slug); }
    var full = {}, auto = {}, tags = {};
    Object.keys(articles).forEach(function (s) {
      var a = articles[s]; claim(full, a.n, s);
      parts(a.n).forEach(function (p) { claim(auto, p, s); });
    });
    // Gallery tags on each article's own pictures.
    var pages = (usage && usage.pages) || {}, used = {};
    Object.keys(pages).forEach(function (url) {
      var s = slugOf(url); if (!s || !articles[s]) return;
      var u = pages[url].u || {};
      Object.keys(u).forEach(function (img) { if (u[img].indexOf("hero") >= 0 || u[img].indexOf("art") >= 0) (used[img] = used[img] || []).indexOf(s) < 0 && used[img].push(s); });
    });
    var media = (catalog && catalog.media) || {};
    Object.keys(media).forEach(function (id) {
      var m = media[id], ss = used[m.path] || used[id];
      if (!ss || !m.tags) return;
      m.tags.forEach(function (t) {
        t = String(t || "").replace(/\s+/g, " ").trim();
        if (t.length < 3 || !isProper(t)) return;
        ss.forEach(function (s) { claim(tags, t, s); });
      });
    });
    function settle(map, allowReserved) {
      Object.keys(map).forEach(function (t) {
        if (terms[t] || skipped[t]) return;
        if (!allowReserved && res[t]) return;
        if (map[t].length === 1) terms[t] = map[t][0]; else skipped[t] = map[t].slice().sort();
      });
    }
    Object.keys(full).forEach(function (t) { if (res[t]) { skipped[t] = full[t].concat(["(atlas place)"]); delete full[t]; } });
    settle(full, true);
    // A tag that names another article's full title, or a name part, cannot override it.
    Object.keys(tags).forEach(function (t) { if (full[t] && tags[t].join() !== full[t].join()) { skipped[t] = tags[t].concat(full[t]).filter(function (x, i, a) { return a.indexOf(x) === i; }).sort(); delete tags[t]; } });
    settle(tags, false);
    Object.keys(auto).forEach(function (t) { if (full[t] && full[t].join() !== auto[t].join()) skipped[t] = auto[t].concat(full[t]).sort(); });
    settle(auto, false);
    return { terms: sortObj(terms), skipped: sortObj(skipped) };
  }
  function sortObj(o) { var r = {}; Object.keys(o).sort().forEach(function (k) { r[k] = o[k]; }); return r; }
  function empty() { return { _readme: "Auto-link map, built by edit/autolink.js (tools/build-autolink.js; refreshed by admin edit-mode saves). Words in 'terms' link to that article site-wide. Add a word: give one of the article's hero/Art images a Capitalised tag in the Gallery.", version: 1, articles: {}, terms: {}, skipped: {}, reserved: [] }; }
  function render(o) { return JSON.stringify(o, null, 1) + "\n"; }
  // oldText: current autolink.json; files: commit files [{path, text|delete}];
  // catalogText/usageText: the catalog and usage at the same parent (files win). -> new text or null.
  function update(oldText, files, catalogText, usageText) {
    var o; try { o = JSON.parse(oldText); } catch (e) { o = empty(); }
    if (!o || typeof o !== "object") o = empty();
    o.articles = o.articles || {};
    var cat = catalogText, use = usageText, touched = false;
    (files || []).forEach(function (f) {
      if (f.path === CATALOG && !f.delete) { cat = f.text; touched = true; }
      else if (f.path === USAGE && !f.delete) { use = f.text; touched = true; }
      else {
        var s = slugOf(f.path); if (!s) return;
        touched = true;
        if (f.delete) { if (/\/index\.html$/.test(f.path) || !(files || []).some(function (g) { return !g.delete && slugOf(g.path) === s; })) delete o.articles[s]; return; }
        var a = parseArticle(f.text); if (a) o.articles[s] = a;
      }
    });
    if (!touched) return null;
    var c, u; try { c = JSON.parse(cat || "{}"); } catch (e) { c = {}; } try { u = JSON.parse(use || "{}"); } catch (e) { u = {}; }
    o.articles = sortObj(o.articles);
    var r = compute(o.articles, c, u, o.reserved);
    o.terms = r.terms; o.skipped = r.skipped;
    var t = render(o);
    return t === oldText ? null : t;
  }
  var api = { PATH: PATH, CATALOG: CATALOG, USAGE: USAGE, slugOf: slugOf, parseArticle: parseArticle, parts: parts, compute: compute, update: update, empty: empty, render: render, admin: false };
  if (root) root.EloraeAutolinkMap = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : null);
