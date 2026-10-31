/* Elorae edit mode: your own just-saved pages, right away.
   A save is live about 30 s later (Cloudflare Pages rebuild). Until then a reload would show the
   old page, and editing that old page could save the old text back over the new. So after a
   direct save the editor keeps the saved file text here, in THIS browser only (localStorage
   "elorae-edit-recent"), stamped with the GitHub login and the signed-in player who saved it,
   for 3 minutes. On a page load (or an in-place tab swap) it compares the HTML the browser was
   actually served (fetch with cache "force-cache" returns the copy the page was built from):
   - served == saved: the deploy is live, the copy is dropped;
   - served == a version from before the save: the saved content is put in place of the stale
     main body / titles / hero art / blocks (same swap as ghostly-swap.js, then the usual
     "elorae-content-swapped" event), and the live page is checked every few seconds until it
     matches, then the copy is dropped;
   - anything else (someone changed it since): the copy is dropped, the served page stays.
   Nothing is ever shown to anyone else: a different GitHub login or player, or no edit session,
   drops the copy unread (and signing out of edit mode clears it, core.js). Edit mode waits for
   this check (EloraeRecent.ready) and refuses to start on a page that is still out of date and
   could not be fully patched (EloraeRecent.blocked), so stale text is never re-saved. */
(function () {
  "use strict";
  if (window.EloraeRecent) return;
  var E = window.EloraeEdit, M = window.EloraeSrcMap;
  var KEY = "elorae-edit-recent", TTL = 180000, POLL = 5000, MAX_STALE = 12;

  function hash(str) { // cyrb53
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(36) + "." + (h1 >>> 0).toString(36) + "." + str.length;
  }
  function me() {
    var s = null;
    try { s = E && E.session && E.session.get(); } catch (e) {}
    var login = s && s.login ? String(s.login).toLowerCase() : "";
    var who = "";
    try { who = String((E && E.loginWho && E.loginWho()) || "").toLowerCase(); } catch (e2) {}
    return { login: login, who: who };
  }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} clearImages(); }

  /* Pictures uploaded with a save: kept as files in this browser (IndexedDB, too big for
     localStorage) for the same 3 minutes, and shown in place of their /assets/ URLs until the
     site has them. */
  var DB = "elorae-edit-recent-img";
  function idb() {
    return new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error("no idb"));
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("img"); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function clearImages() { try { if (window.indexedDB) indexedDB.deleteDatabase(DB); } catch (e) {} }
  function rememberImages(list) {
    var id = me();
    if (!id.login || !list || !list.length) return Promise.resolve();
    return idb().then(function (db) {
      return new Promise(function (res) {
        var tx = db.transaction("img", "readwrite"), st = tx.objectStore("img");
        list.forEach(function (x) { if (x && x.path && x.blob) st.put({ blob: x.blob, at: Date.now(), login: id.login, who: id.who }, x.path); });
        tx.oncomplete = tx.onerror = tx.onabort = function () { db.close(); res(); };
      });
    }).catch(function () {});
  }
  function loadImages() {
    var id = me();
    if (!id.login || !window.indexedDB) return Promise.resolve({});
    return idb().then(function (db) {
      return new Promise(function (res) {
        var out = {}, tx = db.transaction("img", "readwrite"), st = tx.objectStore("img"), now = Date.now();
        var cur = st.openCursor();
        cur.onsuccess = function () {
          var c = cur.result;
          if (!c) return;
          var v = c.value;
          if (!v || v.login !== id.login || v.who !== id.who || !(now - v.at < TTL)) c.delete();
          else out[c.key] = v.blob;
          c.continue();
        };
        tx.oncomplete = tx.onerror = tx.onabort = function () { db.close(); res(out); };
      });
    }).catch(function () { return {}; });
  }
  function imgPath(src) {
    var s = String(src || "").trim().replace(/^https?:\/\/[^\/]+/i, "").replace(/^\/cdn-cgi\/image\/[^\/]+/i, "");
    try { s = decodeURI(s); } catch (e) {}
    try { s = new URL(s, location.href).pathname; s = decodeURI(s); } catch (e2) {}
    return s.replace(/^\//, "");
  }
  var shownUrls = {};
  function swapImages() {
    return loadImages().then(function (map) {
      var keys = Object.keys(map);
      if (!keys.length) return 0;
      var n = 0;
      Array.prototype.forEach.call(document.querySelectorAll("img"), function (im) {
        if (im.closest("#ee-panel")) return;
        var orig = im.getAttribute("data-eimg-orig") || im.getAttribute("src");
        if (/^blob:/.test(orig || "")) return;
        var k = imgPath(orig);
        if (!map[k]) return;
        if (!shownUrls[k]) shownUrls[k] = URL.createObjectURL(map[k]);
        im.setAttribute("data-eimg-orig", "/" + k);
        im.setAttribute("data-eimg-fell", "1");
        im.removeAttribute("srcset"); im.removeAttribute("sizes");
        im.setAttribute("src", shownUrls[k]);
        n++;
      });
      return n;
    });
  }
  function read() {
    var o = null;
    try { o = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { o = null; }
    if (!o || o.v !== 1 || !o.files) { if (o) clear(); return null; }
    var id = me();
    if (!id.login || o.login !== id.login || o.who !== id.who) { clear(); return null; }
    var now = Date.now(), live = 0;
    Object.keys(o.files).forEach(function (p) { if (!(now - o.files[p].at < TTL)) delete o.files[p]; else live++; });
    if (!live) { clear(); return null; }
    return o;
  }
  function write(o) {
    if (!Object.keys(o.files).length) return clear();
    try { localStorage.setItem(KEY, JSON.stringify(o)); }
    catch (e) { clear(); } // quota: better nothing than a half copy
  }
  function mirrorOf(p) {
    var m;
    if ((m = /^(.+)\/index\.html$/.exec(p))) return m[1] + ".html";
    if ((m = /^(.+)\.html$/.exec(p)) && !/(^|\/)index$/.test(m[1])) return m[1] + "/index.html";
    return null;
  }

  /* files: [{ path, text (saved file), base (the file it replaced) }] */
  function remember(files) {
    var id = me();
    if (!id.login) return;
    var o = read() || { v: 1, login: id.login, who: id.who, files: {} };
    var now = Date.now();
    (files || []).forEach(function (f) {
      if (!f || !f.path || typeof f.text !== "string" || typeof f.base !== "string" || !/\.html$/.test(f.path)) return;
      var h = hash(f.text), prev = o.files[f.path], stale = [hash(f.base)];
      if (prev) stale = stale.concat(prev.stale || [], [prev.h]);
      var seen = {};
      stale = stale.filter(function (x) { if (x === h || seen[x]) return false; seen[x] = 1; return true; }).slice(0, MAX_STALE);
      o.files[f.path] = { h: h, text: f.text, stale: stale, at: now };
    });
    write(o);
  }
  function drop(paths) {
    var o = read(); if (!o) return;
    paths.forEach(function (p) { if (p) delete o.files[p]; });
    write(o);
  }
  function candidates(path) {
    var o = read(); if (!o) return [];
    return [path, mirrorOf(path)].filter(function (p) { return p && o.files[p]; }).map(function (p) { return { path: p, e: o.files[p] }; });
  }
  function has(path) { return candidates(path).length > 0; }

  /* ---------- putting the saved content in place ---------- */
  function parse(t) { return new DOMParser().parseFromString(t, "text/html"); }
  function liveQ(sel) {
    var all = document.querySelectorAll(sel);
    for (var i = 0; i < all.length; i++) if (!all[i].closest("#ee-panel,#ee-bar")) return all[i];
    return null;
  }
  function byId(root) {
    var o = {};
    Array.prototype.forEach.call(root.querySelectorAll("[id]"), function (n) { if (!(n.id in o)) o[n.id] = n; });
    return o;
  }
  // Rebuild s's children for the live page; live elements whose source is unchanged (same id,
  // same HTML in the served copy) are moved over as they are, keeping what page scripts added.
  function build(sParent, fIds, lIds) {
    var out = [];
    Array.prototype.forEach.call(sParent.childNodes, function (c) {
      if (c.nodeType === 1 && c.id && fIds[c.id] && lIds[c.id] && fIds[c.id].outerHTML === c.outerHTML) { out.push(lIds[c.id]); return; }
      if (c.nodeType === 1 && c.querySelector("[id]")) {
        var n = document.importNode(c, false);
        build(c, fIds, lIds).forEach(function (k) { n.appendChild(k); });
        out.push(n); return;
      }
      out.push(document.importNode(c, true));
    });
    return out;
  }
  function syncAttrs(l, s, f) {
    Array.prototype.forEach.call(f.attributes, function (a) { if (!s.hasAttribute(a.name) && a.name !== "class") l.removeAttribute(a.name); });
    Array.prototype.forEach.call(s.attributes, function (a) {
      if (a.name === "class") return;
      if (f.getAttribute(a.name) !== a.value) l.setAttribute(a.name, a.value);
    });
    if (s.getAttribute("class") !== f.getAttribute("class")) {
      var fc = Array.prototype.slice.call(f.classList), extra = Array.prototype.filter.call(l.classList, function (c) { return fc.indexOf(c) < 0; });
      l.className = Array.prototype.slice.call(s.classList).concat(extra.filter(function (c) { return !s.classList.contains(c); })).join(" ");
    }
  }
  function swapRegion(l, s, f) {
    syncAttrs(l, s, f);
    if (s.innerHTML === f.innerHTML) return;
    var kids = build(s, byId(f), byId(l));
    l.replaceChildren.apply(l, kids);
  }
  function blank(n) { n.innerHTML = ""; Array.prototype.slice.call(n.attributes).forEach(function (a) { n.removeAttribute(a.name); }); }
  var REGIONS = ["main.art-body, main.read", "main.index-flow", "#index-toc-panel"];
  function heroParts(h) {
    return { h1: h.querySelector(".art-title h1"), ep: h.querySelector(".art-title .art-epithet"), img: h.querySelector("img") };
  }
  function hero(lh, sh, fh) {
    var s = heroParts(sh), f = heroParts(fh), l = heroParts(lh), ok = true;
    // Art added to (or removed from) a hero: rebuild the hero from the saved copy.
    if (!s.img !== !f.img || !s.h1 !== !f.h1 || !s.ep !== !f.ep) { swapRegion(lh, sh, fh); return true; }
    ["h1", "ep"].forEach(function (k) {
      if (!s[k] && !f[k]) return;
      if (!s[k] || !f[k] || !l[k]) { ok = false; return; }
      if (s[k].innerHTML !== f[k].innerHTML) l[k].innerHTML = s[k].innerHTML;
    });
    if (s.img || f.img) {
      if (!s.img || !f.img || !l.img) ok = false;
      else ["src", "alt", "srcset", "sizes"].forEach(function (a) {
        if (s.img.getAttribute(a) === f.img.getAttribute(a)) return;
        if (s.img.hasAttribute(a)) l.img.setAttribute(a, s.img.getAttribute(a)); else l.img.removeAttribute(a);
      });
    }
    // Anything else in the hero that differs cannot be patched safely.
    var a = sh.cloneNode(true), b = fh.cloneNode(true);
    [a, b].forEach(function (h) {
      var p = heroParts(h);
      if (p.h1) p.h1.innerHTML = ""; if (p.ep) p.ep.innerHTML = "";
      if (p.img) ["src", "alt", "srcset", "sizes"].forEach(function (x) { p.img.removeAttribute(x); });
    });
    return ok && a.outerHTML === b.outerHTML;
  }
  function blocks(S, F) {
    if (!M) return false;
    var o = { includeTitles: true };
    var sb = M.collectBlocks(S.body, M.DOM, o), fb = M.collectBlocks(F.body, M.DOM, o);
    var lb = M.collectBlocks(document.body, M.DOM, o).filter(function (n) { return !n.closest("#ee-panel,#ee-bar"); });
    if (sb.length !== fb.length) return false;
    var ok = true, norm = function (x) { return String(x || "").replace(/\s+/g, " ").trim(); };
    for (var i = 0; i < sb.length; i++) {
      if (sb[i].outerHTML === fb[i].outerHTML) continue;
      var l = lb[i];
      if (!l || l.tagName !== sb[i].tagName || norm(l.textContent) !== norm(fb[i].textContent)) { ok = false; continue; }
      syncAttrs(l, sb[i], fb[i]);
      if (sb[i].innerHTML !== fb[i].innerHTML) l.innerHTML = sb[i].innerHTML;
    }
    sb.forEach(blank); fb.forEach(blank);
    return ok;
  }
  // Returns true when everything that differs was put in place.
  function apply(sText, fText) {
    var S = parse(sText), F = parse(fText), ok = true, any = false, done = [];
    REGIONS.forEach(function (sel) {
      var s = S.querySelector(sel), f = F.querySelector(sel);
      if (!s && !f) return;
      if (done.some(function (d) { return d.s.contains(s); })) return;
      var l = liveQ(sel);
      if (!s || !f || !l) { ok = false; return; }
      any = true;
      swapRegion(l, s, f);
      done.push({ s: s, f: f });
    });
    var sh = S.querySelector("section.art-hero"), fh = F.querySelector("section.art-hero");
    if (sh || fh) {
      var lh = liveQ("section.art-hero");
      if (!sh || !fh || !lh) ok = false;
      else if (sh.outerHTML !== fh.outerHTML) ok = hero(lh, sh, fh) && ok;
      if (sh && fh) done.push({ s: sh, f: fh });
    }
    if (!any) ok = blocks(S, F) && ok;
    if (S.title !== F.title) document.title = S.title;
    done.forEach(function (d) { blank(d.s); blank(d.f); });
    [S, F].forEach(function (D) { var t = D.querySelector("title"); if (t) t.textContent = ""; });
    return ok && S.documentElement.outerHTML === F.documentElement.outerHTML;
  }

  /* ---------- checking ---------- */
  var status = {}, polls = {};
  function current() { return E && E.pagePath ? E.pagePath() : ""; }
  function url() { return location.pathname + location.search; }
  function served(mode) {
    return fetch(url(), { cache: mode, credentials: "same-origin" }).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      return r.text();
    });
  }
  function done() { document.documentElement.classList.remove("ee-recent-wait"); }
  function check(path) {
    path = path || current();
    var cands = candidates(path);
    if (!cands.length) { status[path] = "none"; done(); return Promise.resolve("none"); }
    status[path] = "pending";
    return served("force-cache").then(function (text) {
      var h = hash(text);
      for (var i = 0; i < cands.length; i++) {
        var c = cands[i];
        if (h === c.e.h) { drop(cands.map(function (x) { return x.path; })); return (status[path] = "live"); }
        if ((c.e.stale || []).indexOf(h) >= 0) {
          var full = false;
          try { full = apply(c.e.text, text); } catch (e) { full = false; }
          status[path] = full ? "shown" : "partial";
          var swapped = swapImages().catch(function () {});
          try { window.dispatchEvent(new CustomEvent("elorae-content-swapped", { detail: { path: path, recent: true } })); } catch (e2) {}
          if (window.gwLightboxMark) try { window.gwLightboxMark(); } catch (e3) {}
          poll(path, c, cands);
          var st = status[path];
          return swapped.then(function () { return st; });
        }
      }
      drop(cands.map(function (x) { return x.path; }));
      return (status[path] = "none");
    }).catch(function () { return (status[path] = "none"); }).then(function (s) { done(); return s; });
  }
  function poll(path, c, cands) {
    clearTimeout(polls[path]);
    polls[path] = setTimeout(function tick() {
      if (current() !== path) return;
      if (!(Date.now() - c.e.at < TTL)) { drop(cands.map(function (x) { return x.path; })); if (status[path] === "partial") status[path] = "reload"; return; }
      served("no-store").then(function (text) {
        var h = hash(text);
        if (h === c.e.h) {
          drop(cands.map(function (x) { return x.path; }));
          status[path] = status[path] === "shown" ? "live" : "reload";
        } else if ((c.e.stale || []).indexOf(h) >= 0) {
          polls[path] = setTimeout(tick, POLL);
        } else {
          drop(cands.map(function (x) { return x.path; }));
          status[path] = "reload";
        }
      }, function () { polls[path] = setTimeout(tick, POLL); });
    }, POLL);
  }
  function blocked(path) {
    var s = status[path || current()];
    if (s === "pending") return "This page is still loading your last save. Try again in a moment.";
    if (s === "partial") return "This page is still updating with your last save (about 30 seconds). Try again in a moment.";
    if (s === "reload") return "This page has changed since it loaded. Reload it, then edit.";
    return "";
  }

  var ready = check();
  window.addEventListener("elorae-content-swapped", function (e) {
    if (e && e.detail && e.detail.recent) return;
    var p = current();
    if (has(p)) R.ready = check(p);
  });
  var R = window.EloraeRecent = { ready: ready, remember: remember, rememberImages: rememberImages, swapImages: swapImages, check: check, blocked: blocked, clear: clear, has: has, hash: hash, KEY: KEY, status: status };
})();
