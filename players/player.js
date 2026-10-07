/* players/player.js (nt33). Player pages, built at runtime from the site's own files:
   - characters: this page's own mast marks (span.friend[data-owner]), each with its article's
     hero art, name and epithet; the Game Master (edit/visibility.json "admins") sees the party;
   - secrets: titles from edit/visibility.json that this player can see — rendered ONLY when the
     viewer has unlocked them (signed in as this player, or as the GM) and only those also opened
     to the viewer. Nothing sealed is in the static HTML (titles come from the manifest at runtime);
   - articles: paths this player may edit, from edit/profiles.json permissions (public list).
   Chapters are not listed. Everything renders inside an <aside>, which edit mode's srcmap skips. */
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
  function viewer() { try { return localStorage.getItem("elorae-seal") || ""; } catch (e) { return ""; } }
  function prettyPath(p) {
    var m = /articles\/([^\/]+)\.html$/.exec(p);
    if (!m) return p;
    return m[1].split("-").map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(" ");
  }

  var css = document.createElement("style");
  css.id = "nt-player-css";
  css.textContent =
    "#nt-player h2{margin-top:48px}" +
    "#nt-player .nt-pl-sub{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#8f8a82;text-align:center;margin:-8px 0 0}" +
    ".nt-pl-chars{display:flex;flex-wrap:wrap;justify-content:center;gap:26px;margin:18px 0 0}" +
    ".nt-pl-char{width:150px;text-align:left}" +
    ".nt-pl-char img,.nt-pl-char .ph{width:150px;height:200px;object-fit:cover;display:block;margin:0 0 8px}" +
    ".nt-pl-char .nm{font-size:12px;letter-spacing:.14em;text-transform:uppercase}" +
    ".nt-pl-char .nm a{color:#f3eee6;text-decoration:none}" +
    ".nt-pl-char .ep{font-size:13px;line-height:1.45;color:#8f8a82;font-style:italic;margin-top:2px}" +
    ".nt-pl-list{list-style:none;padding:0;margin:14px 0 0}" +
    ".nt-pl-list li{display:flex;gap:14px;align-items:baseline;padding:5px 0;font-size:16px}" +
    ".nt-pl-list a{color:#cfc6b8}" +
    ".nt-pl-list .m{margin-left:auto;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#8f8a82}" +
    "@media (min-width:801px){.nt-pl-list a:hover,.nt-pl-char .nm a:hover{color:#fff}}" +
    "@media (max-width:800px){.nt-pl-chars{gap:16px}.nt-pl-char,.nt-pl-char img{width:calc(50vw - 30px)}" +
    ".nt-pl-char .ph{width:calc(50vw - 30px)}.nt-pl-char img,.nt-pl-char .ph{height:calc((50vw - 30px) * 4 / 3)}.nt-pl-list li{flex-wrap:wrap;gap:2px 10px}.nt-pl-list .m{margin-left:0}}";
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
  function secretsFor(vis, who) {
    return Object.keys(vis.secrets || {}).map(function (id) { var s = vis.secrets[id]; s.id = id; return s; }).filter(function (s) {
      return (vis.admins || []).indexOf(who) >= 0 || s.everyone || (s.allowed || []).indexOf(who) >= 0;
    });
  }
  function articlesFor(profiles, who) {
    var out = [], seen = {}, all = false, full = false;
    var bag = (profiles && profiles.profiles) || {};
    Object.keys(bag).forEach(function (k) {
      if (k.charAt(0) === "_") return;
      var p = bag[k];
      if (!p || p.person !== who) return;
      var perms = p.permissions;
      if (perms === "view" || !perms) return;
      if (!Array.isArray(perms)) return;
      perms.forEach(function (path) {
        if (path === "**") { full = true; return; }
        if (path === "articles/*.html") { all = true; return; }
        if (/^articles\/[^\/]+\.html$/.test(path) && !seen[path]) { seen[path] = 1; out.push(path); }
      });
    });
    out.sort();
    return { paths: out, allArticles: all, fullSite: full };
  }

  Promise.all([
    fetch(url("edit/visibility.json")).then(function (r) { return r.json(); }),
    fetch(url("edit/profiles.json")).then(function (r) { return r.json(); })
  ]).then(function (r) {
    var vis = r[0], profiles = r[1], isGM = (vis.admins || []).indexOf(slug) >= 0;
    var chars = characters(isGM ? "" : slug);
    root.textContent = "";
    if (isGM) root.appendChild(el("div", "nt-pl-sub", "Game Master"));
    else if (chars.length) root.appendChild(el("div", "nt-pl-sub", "Plays " + chars.map(function (c) { return c.short; }).join(" and ")));

    root.appendChild(el("h2", null, isGM ? "The party" : "Characters"));
    var row = el("div", "nt-pl-chars"); root.appendChild(row);
    chars.forEach(function (c) {
      var box = el("div", "nt-pl-char"); row.appendChild(box);
      doc(c.article).then(function (d) {
        var main = d.querySelector("main.art-body");
        if (main && main.classList.contains("sealed")) { box.remove(); return; }
        var hero = d.querySelector(".art-hero img");
        if (hero) { var ln = link(c.article, ""); ln.setAttribute("aria-hidden", "true"); ln.tabIndex = -1;
          var img = document.createElement("img"); img.src = new URL(hero.getAttribute("src"), url(c.article)).href; img.alt = ""; img.loading = "lazy";
          ln.appendChild(img); box.appendChild(ln); }
        else box.appendChild(el("div", "ph"));
        var nm = el("div", "nm"); nm.appendChild(link(c.article, text(d.querySelector(".art-title h1")) || c.short)); box.appendChild(nm);
        var ep = text(d.querySelector(".art-title .art-epithet")); if (ep) box.appendChild(el("div", "ep", ep));
      }).catch(function () { var nm = el("div", "nm"); nm.appendChild(link(c.article, c.short)); box.appendChild(nm); });
    });

    /* Articles this player owns/edits (profiles.json) — public, not seal-gated. */
    var arts = articlesFor(profiles, slug);
    if (arts.fullSite || arts.allArticles || arts.paths.length) {
      root.appendChild(el("h2", null, "Articles"));
      var au = el("ul", "nt-pl-list"); root.appendChild(au);
      if (arts.fullSite) {
        var li = el("li"); li.appendChild(el("span", null, "Full site")); au.appendChild(li);
      } else if (arts.allArticles) {
        var li2 = el("li"); li2.appendChild(link("index/ancients.html", "All articles")); au.appendChild(li2);
      } else {
        arts.paths.forEach(function (path) {
          var li = el("li");
          var a = link(path, prettyPath(path));
          li.appendChild(a);
          au.appendChild(li);
          doc(path).then(function (d) {
            var t = text(d.querySelector(".art-title h1")) || text(d.querySelector("h1"));
            if (t) a.textContent = t;
          }).catch(function () {});
        });
      }
    }

    /* Secrets: only for a viewer who has unlocked this player's seal (the player, or the GM).
       Titles from visibility.json at runtime — never static plaintext of sealed content. */
    var v = viewer(), vGM = (vis.admins || []).indexOf(v) >= 0;
    if (v && (v === slug || vGM)) {
      var mine = secretsFor(vis, slug), theirs = {};
      secretsFor(vis, v).forEach(function (s) { theirs[s.id] = 1; });
      mine = mine.filter(function (s) { return theirs[s.id] && s.title; });
      if (mine.length) {
        root.appendChild(el("h2", null, "Secrets"));
        var su = el("ul", "nt-pl-list"); root.appendChild(su);
        mine.forEach(function (s) {
          var li = el("li");
          li.appendChild((vGM || s.owner === v) && s.path ? link(s.path, s.title) : el("span", null, s.title));
          su.appendChild(li);
        });
      }
    }
  }).catch(function () {});
})();
