/* Hidden secret pages (visibility layer, see edit/README.md). A secret in edit/visibility.json may carry
   "routes": [sha256("elorae-route:" + path)], so the path itself is never published.
   - On the 404 page: if the signed-in person's secrets key opens the secret routed at this
     path, the decrypted page replaces the 404 at the same URL. Everyone else keeps the 404.
   - On a page with a "nav" secret (kind "nav", payload.nav = links + "where" selector):
     the links are decrypted and added for the people the secret is shared with.
   Nothing about these pages exists in static HTML, search or the sitemap. The secrets key
   comes from the merged sign-in (sessionStorage "elorae-secret-key"); if this tab has none,
   the remembered login phrase (login.js, same browser) unlocks it again. */
(function () {
  "use strict";
  var PLAYERS = { jack: 1, jon: 1, julie: 1, sawyer: 1, sylum: 1, jason: 1, devin: 1 };
  var MKEY = "elorae-secret-key";
  var CRYPTO_SRC = "/edit/crypto.js?v=hidden1";
  var mode = (document.currentScript && document.currentScript.getAttribute("data-mode")) || "route";

  function who() {
    try {
      var m = document.cookie.match(/(?:^|;\s*)elorae-(?:login|seal)=([a-z]+)/);
      if (m && PLAYERS[m[1]]) return m[1];
    } catch (e) {}
    try {
      var w = localStorage.getItem("elorae-login") || localStorage.getItem("elorae-seal") || "";
      if (PLAYERS[w]) return w;
    } catch (e) {}
    return "";
  }
  var me = who();
  if (!me) return;

  function loadCrypto() {
    if (window.EloraeCrypto) return Promise.resolve(window.EloraeCrypto);
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = CRYPTO_SRC; s.onload = function () { res(window.EloraeCrypto); }; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  function json(p) {
    return fetch(p + (p.indexOf("?") < 0 ? "?" : "&") + "t=" + Date.now(), { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error(r.status); return r.json();
    });
  }
  function hex(buf) { var u = new Uint8Array(buf), s = ""; for (var i = 0; i < u.length; i++) s += (u[i] < 16 ? "0" : "") + u[i].toString(16); return s; }
  function routeHash(path) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode("elorae-route:" + path)).then(hex);
  }
  function normPath(p) {
    try { p = decodeURI(p); } catch (e) {}
    p = p.replace(/\/index\.html$/i, "/").replace(/\.html$/i, "/");
    if (p.charAt(p.length - 1) !== "/") p += "/";
    return p;
  }
  function allowed(sec) {
    var a = (sec.allowed || []).slice(); if (a.indexOf("devin") < 0) a.push("devin"); return a;
  }
  // This person's unlocked private key, or null.
  function privateKey(K, man) {
    var rec = man.people && man.people[me] && man.people[me].key;
    if (!rec) return Promise.resolve(null);
    try {
      var s = JSON.parse(sessionStorage.getItem(MKEY) || "null");
      if (s && s.person === me && s.jwk) return K.importPrivate(s.jwk).catch(function () { return null; });
    } catch (e) {}
    var phrase = "";
    try { phrase = String(localStorage.getItem("elorae-login-phrase") || "").trim().toLowerCase(); } catch (e) {}
    if (!phrase) return Promise.resolve(null);
    return K.phraseMaterial(phrase).then(function (m) { return K.unlock(rec, m); }).then(function (priv) {
      return K.exportPrivate(priv).then(function (jwk) {
        try { sessionStorage.setItem(MKEY, JSON.stringify({ person: me, jwk: jwk })); } catch (e) {}
        return priv;
      });
    }).catch(function () { return null; });
  }
  function open(K, man, id, priv) {
    var sec = man.secrets[id];
    var w = sec.keys && sec.keys[me];
    if (!priv || !w) return Promise.resolve(null);
    return K.unwrap(priv, w).then(function (raw) {
      return json("/edit/secrets/" + id + ".json").then(function (file) {
        if (file.epoch !== sec.epoch) return null;
        return K.decryptSecret(file, raw);
      });
    }).catch(function () { return null; });
  }

  if (mode === "route") {
    var veil = document.createElement("style");
    veil.textContent = "body{visibility:hidden}";
    document.head.appendChild(veil);
    var shown = false;
    var reveal = function (hint) {
      if (shown) return; shown = true;
      if (veil.parentNode) veil.parentNode.removeChild(veil);
      if (hint) {
        // Only reached by someone the page is shared with: say it is locked instead of missing.
        var go = function () {
          var h = document.querySelector("h1"), p = h && h.nextElementSibling;
          if (h) h.textContent = "Locked";
          if (p) p.innerHTML = hint; else document.body.insertAdjacentHTML("beforeend", "<p>" + hint + "</p>");
        };
        if (document.body) go(); else document.addEventListener("DOMContentLoaded", go);
      }
    };
    setTimeout(function () { reveal(); }, 8000);
    Promise.all([loadCrypto(), json("/edit/visibility.json"), routeHash(normPath(location.pathname))]).then(function (r) {
      var K = r[0], man = r[1], h = r[2];
      var id = Object.keys(man.secrets || {}).filter(function (k) {
        var s = man.secrets[k];
        return s.status === "encrypted" && (s.routes || []).indexOf(h) >= 0 && allowed(s).indexOf(me) >= 0;
      })[0];
      if (!id) return reveal();
      return privateKey(K, man).then(function (priv) {
        if (!priv) {
          return reveal(me === "devin"
            ? 'This page is locked. Unlock your secrets key on the <a href="/edit/dashboard/">Dashboard</a>, then open it again.'
            : 'This page is locked. <a href="/login/">Enter</a> again with your phrase, then open it again.');
        }
        return open(K, man, id, priv).then(function (payload) {
          if (!payload || !payload.html) return reveal();
          shown = true;
          var dir = String(payload.path || "").replace(/[^/]*$/, "");
          var html = payload.html.replace(/<head(\s[^>]*)?>/i, function (m) { return m + '<base href="/' + dir + '">'; });
          document.open(); document.write(html); document.close();
        });
      });
    }).catch(function () { reveal(); });
    return;
  }

  // mode "nav": add decrypted links for the people a nav secret is shared with.
  Promise.all([loadCrypto(), json("/edit/visibility.json")]).then(function (r) {
    var K = r[0], man = r[1];
    var ids = Object.keys(man.secrets || {}).filter(function (k) {
      var s = man.secrets[k];
      return s.kind === "nav" && s.status === "encrypted" && allowed(s).indexOf(me) >= 0 && s.keys && s.keys[me];
    });
    if (!ids.length) return;
    return privateKey(K, man).then(function (priv) {
      if (!priv) return;
      ids.forEach(function (id) {
        open(K, man, id, priv).then(function (payload) {
          var nav = payload && payload.nav;
          if (!nav || !nav.where || !nav.html) return;
          var add = function () {
            var box = document.querySelector(nav.where);
            if (!box || box.querySelector('[data-hidden-nav="' + id + '"]')) return;
            var t = document.createElement("template");
            t.innerHTML = nav.html;
            Array.prototype.forEach.call(t.content.children, function (n) { n.setAttribute("data-hidden-nav", id); });
            box.appendChild(t.content);
          };
          if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", add); else add();
        });
      });
    });
  }).catch(function () {});
})();
