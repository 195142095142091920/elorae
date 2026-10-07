/* Site-wide image sizing (img-resize). One source file per image; Cloudflare Image
   Transformations resize on request: /cdn-cgi/image/<opts>/<root-absolute path>.
   Static pages are rewritten by scripts/img-resize.py (src/srcset/sizes in the HTML, no JS
   needed). This file: (1) eloraeImg helper for JS-rendered images, (2) fallback - if a
   resized URL fails (e.g. a preview host without Cloudflare), swap to the original once.
   Only elorae.world / www.elorae.world resize; any other host gets originals.
   Article hero art is never resized. Load this in <head>, before any <img>. */
(function () {
  "use strict";
  var ON = /^(www\.)?elorae\.world$/i.test(location.hostname);
  var OPTS = "quality=82,format=auto,fit=scale-down,onerror=redirect";
  var CDN = /^((?:https?:\/\/(?:www\.)?elorae\.world)?)\/cdn-cgi\/image\/[^\/]+(\/.*)$/i;
  var LADDER = [160, 320, 480, 640, 960, 1280, 1600, 1920, 2560];

  /* Original URL for a (possibly resized) src. */
  function orig(src) {
    var s = String(src || "");
    var m = CDN.exec(s);
    return m ? m[1] + m[2] : s;
  }
  /* Root-absolute, percent-encoded path of a local raster asset, or "" if not resizable. */
  function localPath(src) {
    var s = orig(src).trim();
    if (!s || /^(data|blob):/i.test(s)) return "";
    var u;
    try { u = new URL(s, location.href); } catch (e) { return ""; }
    if (u.origin !== location.origin && !/^(www\.)?elorae\.world$/i.test(u.hostname)) return "";
    if (!/\.(png|jpe?g|webp|gif|avif)$/i.test(u.pathname)) return "";
    if (u.search || /^\/cdn-cgi\//.test(u.pathname)) return "";
    /* normalise encoding: decode then encode each segment (spaces, commas, quotes). */
    return u.pathname.split("/").map(function (seg) {
      try { seg = decodeURIComponent(seg); } catch (e) {}
      /* match scripts/img-resize.py (Python quote): also encode ! ' ( ) * */
      return encodeURIComponent(seg).replace(/[!'()*]/g, function (c) { return "%" + c.charCodeAt(0).toString(16).toUpperCase(); });
    }).join("/");
  }
  /* eloraeImg(src, width) -> resized URL on elorae.world, original elsewhere. */
  function eloraeImg(src, width) {
    var p = ON && localPath(src);
    if (!p || !width) return orig(src);
    return "/cdn-cgi/image/width=" + Math.round(width) + "," + OPTS + p;
  }
  function widths(min, max) {
    return LADDER.filter(function (w) { return w >= (min || 0) && w <= (max || 1920); });
  }
  function srcset(src, max, min) {
    if (!(ON && localPath(src))) return "";
    return widths(min, max).map(function (w) { return eloraeImg(src, w) + " " + w + "w"; }).join(", ");
  }
  /* Point an <img> at src with a srcset sized for its placement.
     o: { sizes: "...", max: 1280, min: 160, fallback: 640, lazy: true } */
  function set(img, src, o) {
    o = o || {};
    var ss = srcset(src, o.max, o.min);
    delete img.dataset.eimgFell;
    if (ss) {
      img.setAttribute("srcset", ss);
      img.setAttribute("sizes", o.sizes || "100vw");
      img.setAttribute("src", eloraeImg(src, o.fallback || Math.min(o.max || 960, 960)));
    } else {
      img.removeAttribute("srcset");
      img.removeAttribute("sizes");
      img.setAttribute("src", orig(src));
    }
    img.setAttribute("data-eimg-orig", orig(src));
    if (o.lazy) img.setAttribute("loading", "lazy");
    img.setAttribute("decoding", "async");
    return img;
  }
  /* Markup string for JS templates that build HTML. attrs: extra raw attributes. */
  function html(src, o, attrs) {
    o = o || {};
    var esc = function (v) { return String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); };
    var ss = srcset(src, o.max, o.min);
    var out = '<img src="' + esc(ss ? eloraeImg(src, o.fallback || Math.min(o.max || 960, 960)) : orig(src)) + '"';
    if (ss) out += ' srcset="' + esc(ss) + '" sizes="' + esc(o.sizes || "100vw") + '"';
    if (o.lazy) out += ' loading="lazy"';
    return out + ' decoding="async"' + (attrs ? " " + attrs : "") + ">";
  }

  /* Fallback: a resized URL failed -> original, once. Capture phase (error doesn't bubble). */
  document.addEventListener("error", function (e) {
    var t = e.target;
    if (!t || t.tagName !== "IMG" || t.dataset.eimgFell) return;
    var a = t.getAttribute("src") || "";
    var cur = t.currentSrc || a;
    if (!CDN.test(cur) && !CDN.test(a)) return;
    t.dataset.eimgFell = "1";
    t.removeAttribute("srcset");
    t.removeAttribute("sizes");
    t.setAttribute("src", t.getAttribute("data-eimg-orig") || orig(a));
  }, true);

  eloraeImg.on = ON;
  eloraeImg.orig = orig;
  eloraeImg.srcset = srcset;
  eloraeImg.set = set;
  eloraeImg.html = html;
  eloraeImg.ladder = LADDER;
  window.eloraeImg = eloraeImg;
})();
