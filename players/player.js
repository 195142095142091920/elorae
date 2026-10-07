/* players/player.js (merged-signin). Player pages, built at runtime from the site's own files:
   - characters: mast marks (span.friend[data-owner]) as cards (hero art, name, epithet) at
     the top of the page — no "Characters" / "The party" heading. Game Master
     (edit/visibility.json "admins") sees the party;
   - combined: one card row of editable (profiles.json) + secret (visibility.json) articles
     below under a "My Articles" heading. Each card: image, title, and a type mark (edit / secret / both). No epithet.
     Subjects already in Characters are excluded. Secrets only when the viewer has unlocked
     them (this player or GM) and only those also open to the viewer — nothing private in
     static HTML.
   No "Plays …" subtitle. No Articles / separate Editor / Secrets sections.
   Renders inside <aside> (edit mode srcmap skips). Dashboard chrome CSS lives in html.css
   (body.player-page); card layout styles are injected here. */
(function () {
  "use strict";
  var root = document.getElementById("nt-player"); if (!root) return;
  var slug = root.getAttribute("data-person");
  var ROOT = new URL("../", document.currentScript.src).href;
  function url(p) { return new URL(p, ROOT).href; }
  function text(n) { return n ? n.textContent.replace(/\s+/g, " ").trim() : ""; }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function link(href, t) { var a = el("a", null, t); a.href = url(href); return a; }
  function doc(p) { return fetch(url(p)).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then(function (t) { return new DOMParser().parseFromString(t, "text/html"); }); }
  function viewer() { try { return localStorage.getItem("elorae-login") || localStorage.getItem("elorae-seal") || ""; } catch (e) { return ""; } }
  function prettyPath(p) {
    var m = /articles\/([^\/]+)\.html$/.exec(p);
    if (!m) return p;
    return m[1].split("-").map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(" ");
  }

  var css = document.createElement("style");
  css.id = "nt-player-css";
  css.textContent =
    "#nt-player h2{margin:36px 0 18px;padding:0;border:0;font-family:\"Helvetica Neue\",Helvetica,Arial,sans-serif;font-weight:400;font-style:normal;font-size:11px;letter-spacing:.28em;text-transform:uppercase;text-align:left;color:#8f8a82}" +
    ".nt-pl-chars{display:flex;flex-wrap:wrap;justify-content:flex-start;gap:22px;margin:0}" +
    ".nt-pl-chars+.nt-pl-chars{margin-top:36px;padding-top:36px;border-top:1px solid rgba(243,238,230,.09)}" +
    ".nt-pl-char{width:150px;text-align:left;box-sizing:border-box;background:#0b0b0b;border:1px solid rgba(243,238,230,.09);border-radius:4px;overflow:hidden;padding:0 0 12px}" +
    ".nt-pl-char img,.nt-pl-char .ph{width:100%;height:200px;object-fit:cover;display:block;margin:0 0 10px;background:#070707}" +
    ".nt-pl-char .nm,.nt-pl-char .ep,.nt-pl-char .nt-pl-kind{padding:0 10px}" +
    ".nt-pl-char .nm{font-size:12px;letter-spacing:.14em;text-transform:uppercase}" +
    ".nt-pl-char .nm a{color:#f3eee6;text-decoration:none}" +
    ".nt-pl-char .ep{font-size:13px;line-height:1.45;color:#8f8a82;font-style:italic;margin-top:2px}" +
    ".nt-pl-char .nt-pl-kind{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#8f8a82;margin-top:6px;display:flex;align-items:center;gap:6px}" +
    ".nt-pl-char .nt-pl-kind .sy{font-size:13px;line-height:1;letter-spacing:0;text-transform:none}" +
    "@media (min-width:801px){.nt-pl-char .nm a:hover{color:#fff}}" +
    ".nt-pl-keytip{margin:28px 0 0;max-width:42ch;font-size:13px;line-height:1.5;color:#8f8a82}.nt-pl-keytip a{color:#cfc6b8;text-decoration:underline}@media (min-width:801px){.nt-pl-keytip a:hover{color:#fff}}@media (max-width:800px){#nt-player h2{margin-top:28px;margin-bottom:14px;font-size:10px;letter-spacing:.22em}" +
    ".nt-pl-chars{gap:12px;justify-content:space-between}" +
    ".nt-pl-char{width:calc(50% - 6px)}.nt-pl-char img,.nt-pl-char .ph{height:calc((50vw - 22px) * 4 / 3)}" +
    ".nt-pl-chars+.nt-pl-chars{margin-top:28px;padding-top:28px}}";
  document.head.appendChild(css);

  function characters(who) {
    var out = [];
    Array.prototype.forEach.call(document.querySelectorAll('.mast .friend[data-owner]'), function (s) {
      var o = s.getAttribute("data-owner"); if (who && o !== who) return;
      Array.prototype.forEach.call(s.querySelectorAll("a[href]"), function (a) {
        if (a.classList.contains("nt-pmark")) return;
        var h = new URL(a.getAttribute("href"), location.href).href, rel = h.replace(ROOT, "");
        if (/^articles\/[^\/]+\.html$/.test(rel)) out.push({ short: text(a), article: rel });
      });
    });
    return out;
  }
  function charPathSet(chars) {
    var set = {};
    chars.forEach(function (c) { if (c.article) set[c.article] = 1; });
    return set;
  }
  function secretsFor(vis, who) {
    return Object.keys(vis.secrets || {}).map(function (id) { var s = vis.secrets[id]; s.id = id; return s; }).filter(function (s) {
      return (vis.admins || []).indexOf(who) >= 0 || s.everyone || (s.allowed || []).indexOf(who) >= 0;
    });
  }
  function articlesFor(profiles, who) {
    var out = [], seen = {};
    var bag = (profiles && profiles.profiles) || {};
    Object.keys(bag).forEach(function (k) {
      if (k.charAt(0) === "_") return;
      var p = bag[k];
      if (!p || p.person !== who) return;
      var perms = p.permissions;
      if (perms === "view" || !perms) return;
      if (!Array.isArray(perms)) return;
      perms.forEach(function (path) {
        if (path === "**" || path === "articles/*.html") return;
        if (/^articles\/[^\/]+\.html$/.test(path) && !seen[path]) { seen[path] = 1; out.push(path); }
      });
    });
    out.sort();
    return out;
  }
  function kindLabel(edit, secret) {
    if (edit && secret) return { sy: "✎⚑", label: "Edit · Secret" };
    if (edit) return { sy: "✎", label: "Edit" };
    return { sy: "⚑", label: "Secret" };
  }
  /* Card: image + title + type mark only (no epithet).
     path = article for thumbnail; href overrides the click target (e.g. secret viewer). */
  function fillComboCard(box, path, fallbackName, doLink, kind, href) {
    var k = kindLabel(kind.edit, kind.secret);
    var go = href || path;
    function addKind() {
      var row = el("div", "nt-pl-kind");
      row.appendChild(el("span", "sy", k.sy));
      row.appendChild(el("span", null, k.label));
      box.appendChild(row);
    }
    if (!path && !go) {
      box.appendChild(el("div", "ph"));
      box.appendChild(el("div", "nm", fallbackName));
      addKind();
      return;
    }
    var fetchPath = path && path.indexOf("edit/secret.html") !== 0 ? path : "";
    function finish(title) {
      var nm = el("div", "nm");
      if (doLink && go) nm.appendChild(link(go, title));
      else nm.textContent = title;
      box.appendChild(nm);
      addKind();
    }
    if (!fetchPath) {
      box.appendChild(el("div", "ph"));
      finish(fallbackName);
      return;
    }
    doc(fetchPath).then(function (d) {
      var hero = d.querySelector(".art-hero img");
      if (hero) {
        var img = document.createElement("img");
        img.src = new URL(hero.getAttribute("src"), url(fetchPath)).href;
        img.alt = ""; img.loading = "lazy";
        if (doLink && go) {
          var ln = link(go, ""); ln.setAttribute("aria-hidden", "true"); ln.tabIndex = -1;
          ln.appendChild(img); box.appendChild(ln);
        } else box.appendChild(img);
      } else box.appendChild(el("div", "ph"));
      finish(text(d.querySelector(".art-title h1")) || text(d.querySelector("h1")) || fallbackName);
    }).catch(function () {
      box.appendChild(el("div", "ph"));
      finish(fallbackName);
    });
  }
  function fillCharCard(box, path, fallbackName) {
    doc(path).then(function (d) {
      var main = d.querySelector("main.art-body");
      if (main && main.classList.contains("private")) { box.remove(); return; }
      var hero = d.querySelector(".art-hero img");
      if (hero) {
        var ln = link(path, ""); ln.setAttribute("aria-hidden", "true"); ln.tabIndex = -1;
        var img = document.createElement("img");
        img.src = new URL(hero.getAttribute("src"), url(path)).href;
        img.alt = ""; img.loading = "lazy";
        ln.appendChild(img); box.appendChild(ln);
      } else box.appendChild(el("div", "ph"));
      var nm = el("div", "nm");
      nm.appendChild(link(path, text(d.querySelector(".art-title h1")) || fallbackName));
      box.appendChild(nm);
      var ep = text(d.querySelector(".art-title .art-epithet"));
      if (ep) box.appendChild(el("div", "ep", ep));
    }).catch(function () {
      var nm = el("div", "nm"); nm.appendChild(link(path, fallbackName)); box.appendChild(nm);
    });
  }

  Promise.all([
    fetch(url("edit/visibility.json")).then(function (r) { return r.json(); }),
    fetch(url("edit/profiles.json")).then(function (r) { return r.json(); })
  ]).then(function (r) {
    var vis = r[0], profiles = r[1], isGM = (vis.admins || []).indexOf(slug) >= 0;
    var chars = characters(isGM ? "" : slug);
    var inCharacters = charPathSet(chars);
    root.textContent = "";

    /* Character cards at top — no "Characters" / "The party" heading. No "Plays …" line. */
    var crow = el("div", "nt-pl-chars");
    crow.setAttribute("aria-label", isGM ? "The party" : "Characters");
    root.appendChild(crow);
    chars.forEach(function (c) {
      var box = el("div", "nt-pl-char"); crow.appendChild(box);
      fillCharCard(box, c.article, c.short);
    });

    /* Combined edit + secret cards (one section, no separate Editor/Secrets). */
    var bag = {}; /* path -> { path, title, edit, secret, link } */
    articlesFor(profiles, slug).forEach(function (path) {
      if (inCharacters[path]) return;
      bag[path] = { path: path, title: prettyPath(path), edit: true, secret: false, link: true };
    });
    var v = viewer(), vGM = (vis.admins || []).indexOf(v) >= 0;
    var vRec = v && vis.people && vis.people[v];
    var vEnrolled = !!(vRec && vRec.key);
    var myKey = null;
    try {
      var raw = sessionStorage.getItem("elorae-secret-key");
      myKey = raw ? JSON.parse(raw) : null;
      if (!(myKey && myKey.person && myKey.jwk)) myKey = null;
    } catch (e) { myKey = null; }

    if (v && (v === slug || vGM)) {
      var mine = secretsFor(vis, slug), theirs = {};
      secretsFor(vis, v).forEach(function (s) { theirs[s.id] = 1; });
      mine.forEach(function (s) {
        if (!theirs[s.id] || !s.title) return;
        var path = s.path || "";
        if (path && inCharacters[path]) return;
        var key = path || ("secret:" + s.id);
        var enc = s.status === "encrypted";
        /* Encrypted: open via secret viewer (uses unlocked myKey from merged sign-in). */
        var href = enc ? ("edit/secret.html?id=" + encodeURIComponent(s.id)) : "";
        var canLink = enc ? true : !!(path && (vGM || s.owner === v));
        if (bag[key]) {
          bag[key].secret = true;
          bag[key].title = s.title || bag[key].title;
          if (enc) { bag[key].href = href; bag[key].link = true; }
          else if (!canLink) bag[key].link = false;
        } else {
          bag[key] = { path: path, href: href || "", title: s.title, edit: false, secret: true, link: canLink };
        }
      });
    }
    var items = Object.keys(bag).map(function (k) { return bag[k]; });
    items.sort(function (a, b) { return (a.title || "").localeCompare(b.title || ""); });
    if (items.length) {
      root.appendChild(el("h2", null, "My Articles"));
      var row = el("div", "nt-pl-chars");
      row.setAttribute("aria-label", "My Articles");
      root.appendChild(row);
      items.forEach(function (it) {
        var box = el("div", "nt-pl-char"); row.appendChild(box);
        fillComboCard(box, it.path, it.title, it.link, { edit: it.edit, secret: it.secret }, it.href);
      });
    }
    /* Soft nudge: signed in as this player (or viewing own page) but no published key yet. */
    if (v && v === slug && !vEnrolled) {
      var tip = el("p", "nt-pl-keytip");
      tip.appendChild(document.createTextNode("Sign in with your phrase so Devin can publish your secrets key. "));
      tip.appendChild(link("login.html", "Sign in"));
      root.appendChild(tip);
    } else if (v && v === slug && vEnrolled && !myKey) {
      var tip2 = el("p", "nt-pl-keytip");
      tip2.appendChild(document.createTextNode("Sign in with your phrase to unlock secrets. "));
      tip2.appendChild(link("login.html", "Sign in"));
      root.appendChild(tip2);
    }
  }).catch(function () {});
})();
