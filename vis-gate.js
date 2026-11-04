/* Visibility among friends (edit/visibility.json; no encryption, see edit/README.md).
   A secret is a normal page or element in the repo, shown only to the players it is shared with
   ("allowed"), plus Devin, or to everyone when "everyone" is on. The signed-in player comes from
   the usual elorae-login cookie / localStorage.
   - Page: <html data-secret-page="<id>" data-owner="<owner>"> (load this in <head>). The owner and
     Devin see it at once; anyone else waits for the manifest and either sees it or gets the site's
     Not found page at the same URL. data-secret-go="<url>" redirects allowed viewers there.
   - Elements: class "private" + data-owner hides them by CSS (html.css) for all but the owner and
     Devin. For anyone else the manifest allows, this script removes "private" from elements with
     data-secret="<id>" and from links to / the page of a secret's "path" (private articles). */
(function () {
  "use strict";
  if (window.__visGate) return; window.__visGate = 1;
  var PLAYERS = { jack: 1, jon: 1, julie: 1, sawyer: 1, sylum: 1, jason: 1, devin: 1 };
  function who() {
    try { var m = document.cookie.match(/(?:^|;\s*)elorae-(?:login|seal)=([a-z]+)/); if (m && PLAYERS[m[1]]) return m[1]; } catch (e) {}
    try { var w = localStorage.getItem("elorae-login") || localStorage.getItem("elorae-seal") || ""; if (PLAYERS[w]) return w; } catch (e) {}
    return "";
  }
  var me = who();
  var CK = "elorae-vis-man";
  function sees(sec) {
    if (!sec) return false;
    if (me === "devin" || sec.everyone) return true;
    return !!me && (sec.owner === me || (sec.allowed || []).indexOf(me) >= 0);
  }
  var man = null;
  try { man = JSON.parse(sessionStorage.getItem(CK) || "null"); } catch (e) {}
  // Only signed-in players other than Devin need the manifest to reveal shared links (Devin sees
  // every link already; guests are never shown private links), so no request otherwise.
  var fresh = (!me || me === "devin") ? Promise.resolve(null) : fetch("/edit/visibility.json", { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (m) { try { sessionStorage.setItem(CK, JSON.stringify({ secrets: m.secrets })); } catch (e) {} return m; });

  /* ---- page gate ---- */
  var root = document.documentElement;
  var pid = root.getAttribute("data-secret-page"), owner = root.getAttribute("data-owner") || "";
  if (pid) {
    var go = root.getAttribute("data-secret-go");
    // Decided while <head> is still parsing (synchronous for the rare non-owner visitor), so a
    // refused visitor never runs any of the page's scripts: the Not found page is written in place
    // and <plaintext> swallows the rest of this file unseen.
    var getSync = function (u) { try { var x = new XMLHttpRequest(); x.open("GET", u, false); x.send(); return x.status === 200 ? x.responseText : null; } catch (e) { return null; } };
    var ok = me === "devin" || (me && me === owner);
    if (!ok) {
      var m0 = null;
      try { m0 = JSON.parse(getSync("/edit/visibility.json?t=" + Date.now()) || "null"); } catch (e) {}
      m0 = m0 || man;
      ok = !!(m0 && sees((m0.secrets || {})[pid]));
    }
    if (ok) { if (go) location.replace(go); }
    else {
      var nf = getSync("/404.html") || "<!doctype html><title>Not found - Elorae</title><h1>Not found</h1>";
      document.write(nf.replace(/^\s*<!doctype[^>]*>/i, "").replace(/<\/body>\s*<\/html>\s*$/i, "") + '<plaintext style="display:none">');
      return;
    }
  }

  /* ---- element reveal (shared with someone other than the owner, or everyone) ---- */
  function slugOf(path) { var m = /^articles\/([^\/]+?)(?:\.html|\/index\.html)$/.exec(path || ""); return m && m[1]; }
  function reveal(m) {
    if (!m || me === "devin") return;
    var ids = Object.keys(m.secrets || {}).filter(function (id) { var s = m.secrets[id]; return s.owner !== me && sees(s); });
    if (!ids.length) return;
    var sel = [], here = location.pathname.replace(/\/index\.html$/, "/").replace(/\.html$/, "/");
    ids.forEach(function (id) {
      sel.push('.private[data-secret="' + id + '"]');
      var slug = slugOf(m.secrets[id].path);
      if (slug) {
        sel.push('a.private[href$="/articles/' + slug + '/"]', 'a.private[href$="/articles/' + slug + '.html"]', '.private[data-slug="' + slug + '"]');
        if (here === "/articles/" + slug + "/") sel.push("main.art-body.private", "section.art-hero.private");
      }
    });
    var q = sel.join(",");
    /* vt1: a revealed Index card also reveals its Categories entry (href="#<card id>");
       "elorae-vis" tells the empty-section hiding and the rails to look again. (pr1: the Private
       section and its vis-shared opening are gone.) */
    var run = function () {
      var hit = Array.prototype.slice.call(document.querySelectorAll(q));
      if (!hit.length) return;
      hit.forEach(function (n) { n.classList.remove("private"); });
      hit.forEach(function (n) {
        if (n.matches("a.index-card") && n.id) Array.prototype.forEach.call(document.querySelectorAll('a.private[href="#' + n.id + '"]'), function (a) { a.classList.remove("private"); });
      });
      try { document.dispatchEvent(new CustomEvent("elorae-vis")); } catch (e) {}
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
    if (window.MutationObserver) new MutationObserver(function () { if (document.querySelector(q)) run(); }).observe(document.documentElement, { childList: true, subtree: true });
  }
  if (man) reveal(man);
  fresh.then(function (m) { if (m && !man) reveal(m); }).catch(function () {});
})();
