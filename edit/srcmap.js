/* Elorae edit mode: a small, offset-preserving HTML tokenizer.
   It finds the exact byte range of each editable block in the RAW page source so a save
   can splice-replace only that range and leave the rest of the file byte-for-byte intact.
   Shared by the browser editor and the Node tests. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EloraeSrcMap = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VOID = { area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1, link: 1, meta: 1, param: 1, source: 1, track: 1, wbr: 1 };
  var RAW = { script: 1, style: 1, textarea: 1, title: 1, xmp: 1, noscript: 0 };
  // Optional end tags: opening X implicitly closes an open Y.
  var IMPLIES = {
    p: { p: 1 }, li: { li: 1 }, dt: { dd: 1, dt: 1 }, dd: { dd: 1, dt: 1 },
    tr: { tr: 1, td: 1, th: 1 }, td: { td: 1, th: 1 }, th: { td: 1, th: 1 },
    option: { option: 1 }, thead: { tbody: 1 }, tbody: { tbody: 1, thead: 1 }
  };
  var BLOCK_CLOSES_P = { address: 1, article: 1, aside: 1, blockquote: 1, details: 1, div: 1, dl: 1, fieldset: 1, figcaption: 1, figure: 1, footer: 1, form: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1, header: 1, hr: 1, main: 1, nav: 1, ol: 1, p: 1, pre: 1, section: 1, table: 1, ul: 1 };

  function parseAttrs(s) {
    var attrs = {};
    var re = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g, m;
    while ((m = re.exec(s))) {
      var k = m[1].toLowerCase();
      if (!(k in attrs)) attrs[k] = m[2] != null ? m[2] : m[3] != null ? m[3] : m[4] != null ? m[4] : "";
    }
    return attrs;
  }

  // Find the end of a start tag beginning at i ("<"), honoring quoted attribute values.
  function tagEnd(src, i) {
    var q = null;
    for (var j = i + 1; j < src.length; j++) {
      var c = src.charAt(j);
      if (q) { if (c === q) q = null; }
      else if (c === '"' || c === "'") q = c;
      else if (c === ">") return j + 1;
    }
    return -1;
  }

  function node(tag, attrs, start, openEnd, parent) {
    var cls = (attrs["class"] || "").split(/\s+/).filter(Boolean);
    return { tag: tag, attrs: attrs, id: attrs.id || "", classes: cls, start: start, openEnd: openEnd, closeStart: -1, end: -1, children: [], parent: parent, implicitClose: false };
  }

  function parse(src) {
    var root = node("#root", {}, 0, 0, null);
    root.closeStart = root.end = src.length;
    var stack = [root];
    var i = 0, n = src.length;
    function top() { return stack[stack.length - 1]; }
    function closeAt(idx, pos, endPos, implicit) {
      // Close stack[idx..] ; elements above idx are closed implicitly at pos.
      while (stack.length - 1 >= idx) {
        var el = stack.pop();
        var mine = stack.length === idx; // the one we were asked to close
        el.closeStart = pos;
        el.end = mine && !implicit ? endPos : pos;
        el.implicitClose = !mine || implicit;
      }
    }
    while (i < n) {
      var lt = src.indexOf("<", i);
      if (lt < 0) break;
      if (src.startsWith("<!--", lt)) {
        var ce = src.indexOf("-->", lt + 4);
        i = ce < 0 ? n : ce + 3; continue;
      }
      if (src.charAt(lt + 1) === "!" || src.charAt(lt + 1) === "?") {
        var de = src.indexOf(">", lt); i = de < 0 ? n : de + 1; continue;
      }
      if (src.charAt(lt + 1) === "/") {
        var m = /^<\/([a-zA-Z][a-zA-Z0-9-]*)\s*>/.exec(src.slice(lt, lt + 64));
        if (!m) { i = lt + 1; continue; }
        var ctag = m[1].toLowerCase();
        var endPos = lt + m[0].length;
        for (var k = stack.length - 1; k > 0; k--) {
          if (stack[k].tag === ctag) { closeAt(k, lt, endPos, false); break; }
        }
        i = endPos; continue;
      }
      var tm = /^<([a-zA-Z][a-zA-Z0-9-]*)/.exec(src.slice(lt, lt + 64));
      if (!tm) { i = lt + 1; continue; }
      var tag = tm[1].toLowerCase();
      var te = tagEnd(src, lt);
      if (te < 0) break;
      var attrs = parseAttrs(src.slice(lt + tm[0].length, te - 1));
      // implied end tags
      var imp = IMPLIES[tag];
      if (imp || BLOCK_CLOSES_P[tag]) {
        for (var s = stack.length - 1; s > 0; s--) {
          var t = stack[s].tag;
          if ((imp && imp[t]) || (BLOCK_CLOSES_P[tag] && t === "p")) { closeAt(s, lt, lt, true); break; }
          if (t === "ul" || t === "ol" || t === "dl" || t === "table" || t === "div" || t === "section" || t === "main" || t === "blockquote" || t === "body" || t === "td" || t === "th" || t === "li" || t === "dd") break;
        }
      }
      var el = node(tag, attrs, lt, te, top());
      top().children.push(el);
      if (VOID[tag] || /\/>$/.test(src.slice(te - 2, te)) && !RAW[tag]) {
        el.closeStart = el.end = te; i = te; continue;
      }
      if (RAW[tag]) {
        var re = new RegExp("</" + tag + "\\s*>", "ig");
        re.lastIndex = te;
        var rm = re.exec(src);
        el.closeStart = rm ? rm.index : n;
        el.end = rm ? rm.index + rm[0].length : n;
        i = el.end; continue;
      }
      stack.push(el);
      i = te;
    }
    while (stack.length > 1) { var e = stack.pop(); e.closeStart = e.end = n; e.implicitClose = true; }
    return root;
  }

  /* ---- Editable block selection, shared by the live DOM and the raw-source tree ---- */
  var BLOCK_TAGS = { p: 1, li: 1, dd: 1, blockquote: 1, cite: 1, figcaption: 1, td: 1, th: 1 };
  // Content-region roots (outermost match wins).
  function isRegionRoot(n) {
    var c = n.classes;
    if (n.tag === "main" && (c.indexOf("art-body") >= 0 || c.indexOf("read") >= 0)) return true;
    return false;
  }
  // Never editable inside these (navigation / chrome / link lists / structure).
  function isExcluded(n) {
    var c = n.classes;
    if ({ nav: 1, aside: 1, script: 1, style: 1, form: 1, button: 1, header: 1, details: 1, summary: 1, template: 1, svg: 1, canvas: 1, iframe: 1 }[n.tag]) return true;
    if (n.id === "related" || n.id === "section-bar") return true;
    if (c.indexOf("toc") >= 0 || c.indexOf("art-related") >= 0 || c.indexOf("art-rel-head") >= 0 || c.indexOf("art-swap") >= 0) return true;
    return false;
  }
  function hasBlockDescendant(n, A) {
    var kids = A.children(n);
    for (var i = 0; i < kids.length; i++) {
      if (BLOCK_TAGS[A.tag(kids[i])] || hasBlockDescendant(kids[i], A)) return true;
    }
    return false;
  }
  // A = adapter { tag(n), classes(n), id(n), children(n) }
  function collectBlocks(rootNode, A) {
    var out = [];
    function view(n) { return { tag: A.tag(n), classes: A.classes(n), id: A.id(n) }; }
    function walkRegion(n) {
      var kids = A.children(n);
      for (var i = 0; i < kids.length; i++) {
        var k = kids[i], v = view(k);
        if (isExcluded(v)) continue;
        if (BLOCK_TAGS[v.tag] && !hasBlockDescendant(k, A)) { out.push(k); continue; }
        walkRegion(k);
      }
    }
    function find(n) {
      var kids = A.children(n);
      for (var i = 0; i < kids.length; i++) {
        var v = view(kids[i]);
        if (isRegionRoot(v)) { walkRegion(kids[i]); continue; }
        if (v.tag === "script" || v.tag === "style" || v.tag === "template") continue;
        find(kids[i]);
      }
    }
    find(rootNode);
    return out;
  }
  var TREE = {
    tag: function (n) { return n.tag; },
    classes: function (n) { return n.classes; },
    id: function (n) { return n.id; },
    children: function (n) { return n.children; }
  };
  var DOM = {
    tag: function (n) { return n.tagName.toLowerCase(); },
    classes: function (n) { return Array.prototype.slice.call(n.classList || []); },
    id: function (n) { return n.id || ""; },
    children: function (n) { return Array.prototype.slice.call(n.children || []); }
  };

  function sourceBlocks(src) {
    return collectBlocks(parse(src), TREE).map(function (b) {
      return { tag: b.tag, start: b.openEnd, end: b.closeStart, inner: src.slice(b.openEnd, b.closeStart) };
    });
  }

  // Replace block inner ranges. edits: [{start, end, html}] (non-overlapping).
  function splice(src, edits) {
    var sorted = edits.slice().sort(function (a, b) { return b.start - a.start; });
    var out = src;
    for (var i = 0; i < sorted.length; i++) {
      var e = sorted[i];
      if (i > 0 && e.end > sorted[i - 1].start) throw new Error("overlapping edits");
      out = out.slice(0, e.start) + e.html + out.slice(e.end);
    }
    return out;
  }

  return { parse: parse, collectBlocks: collectBlocks, TREE: TREE, DOM: DOM, sourceBlocks: sourceBlocks, splice: splice, BLOCK_TAGS: BLOCK_TAGS };
});
