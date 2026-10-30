/* Elorae visibility layer: manifest + key helpers shared by secret.html and dashboard.html. */
(function () {
  "use strict";
  var E = window.EloraeEdit, K = window.EloraeCrypto;
  var MKEY = "elorae-secret-key";
  var MKEY_P = "elorae-secret-key-p"; // sign-in key (people.<p>.phraseKey), see hidden.js

  function sameOrigin(path) {
    return fetch(E.ROOT + path + "?t=" + Date.now(), { cache: "no-store" }).then(function (r) {
      if (!r.ok) { var e = new Error("Not found: " + path); e.status = r.status; throw e; }
      return r.json();
    });
  }
  // viaApi=true reads the authoritative copy from GitHub (dashboard); otherwise the deployed copy.
  function manifest(viaApi) {
    if (viaApi) return E.getFile("edit/visibility.json").then(function (f) { var d = JSON.parse(f.text); d.__sha = f.sha; return d; });
    return sameOrigin("edit/visibility.json");
  }
  function secretFile(id, viaApi) {
    if (viaApi) return E.getFile("edit/secrets/" + id + ".json").then(function (f) { return JSON.parse(f.text); });
    return sameOrigin("edit/secrets/" + id + ".json");
  }

  var myKey = {
    get: function () {
      try { var s = JSON.parse(sessionStorage.getItem(MKEY) || "null"); return s && s.person && s.jwk ? s : null; } catch (e) { return null; }
    },
    set: function (person, jwk) { try { sessionStorage.setItem(MKEY, JSON.stringify({ person: person, jwk: jwk })); } catch (e) {} },
    clear: function () { try { sessionStorage.removeItem(MKEY); } catch (e) {} },
    privateKey: function () { var s = myKey.get(); return s ? K.importPrivate(s.jwk) : Promise.resolve(null); }
  };

  // Sign-in key: a second key for someone whose main key has its own passphrase (Devin). It is
  // unlocked by the login phrase and opens only the secrets that carry a "pkeys" wrap for it.
  var viewKey = {
    get: function () {
      try { var s = JSON.parse(sessionStorage.getItem(MKEY_P) || "null"); return s && s.person && s.jwk ? s : null; } catch (e) { return null; }
    },
    set: function (person, jwk) { try { sessionStorage.setItem(MKEY_P, JSON.stringify({ person: person, jwk: jwk })); } catch (e) {} },
    clear: function () { try { sessionStorage.removeItem(MKEY_P); } catch (e) {} }
  };
  function unlockView(man, person, pass) {
    var p = man.people && man.people[person];
    if (!p || !p.phraseKey) return Promise.reject(new Error("No sign-in key for that name."));
    return K.unlock(p.phraseKey, pass).then(function (priv) {
      return K.exportPrivate(priv).then(function (jwk) { viewKey.set(person, jwk); return priv; });
    });
  }
  // Wraps for every sign-in key among "people" (used when a secret is (re)keyed).
  function wrapPhraseKeys(man, people, raw) {
    var out = {};
    return Promise.all((people || []).filter(function (p) { return man.people[p] && man.people[p].phraseKey; }).map(function (p) {
      return K.wrapFor(man.people[p].phraseKey, raw).then(function (w) { out[p] = w; });
    })).then(function () { return out; });
  }
  // Raw content key via the main key, else via the sign-in key (or null).
  function contentKeyAny(man, id, person) {
    var sec = man.secrets[id], m = myKey.get(), v = viewKey.get();
    var first = (m && m.person === person) ? myKey.privateKey().then(function (priv) { return contentKey(man, id, person, priv); }) : Promise.resolve(null);
    return first.then(function (raw) {
      if (raw || !v || v.person !== person || !sec || !sec.pkeys || !sec.pkeys[person]) return raw;
      return K.importPrivate(v.jwk).then(function (priv) { return K.unwrap(priv, sec.pkeys[person]); }).catch(function () { return null; });
    });
  }

  function unlockAs(man, person, pass) {
    var p = man.people && man.people[person];
    if (!p || !p.key) return Promise.reject(new Error("No key is set up for that name yet."));
    return K.unlock(p.key, pass).then(function (priv) {
      return K.exportPrivate(priv).then(function (jwk) { myKey.set(person, jwk); return priv; });
    });
  }

  function allowedList(sec) {
    var a = (sec.allowed || []).slice();
    if (a.indexOf("devin") < 0) a.unshift("devin");
    return a;
  }

  // Raw content key for a secret, or null if this person can't open it.
  function contentKey(man, id, person, priv) {
    var sec = man.secrets[id];
    if (!sec || sec.status !== "encrypted") return Promise.resolve(null);
    if (sec.everyone && sec.openKey) return Promise.resolve(K.unb64(sec.openKey));
    if (!person || !priv || !sec.keys || !sec.keys[person]) return Promise.resolve(null);
    return K.unwrap(priv, sec.keys[person]).catch(function () { return null; });
  }

  // Replace the current document with a decrypted page, exactly as the original rendered.
  function renderPage(payload) {
    var dir = payload.path.replace(/[^/]*$/, "");
    var inject = '<base href="' + E.ROOT + dir + '">';
    var html = payload.html.replace(/<head(\s[^>]*)?>/i, function (m) { return m + inject; });
    // A private article's hero and body are hidden by CSS unless the friend-door login matches.
    // Whoever decrypted this copy may read it, so drop that gate (the "private" class) on the
    // article's own hero/body only; navigation (e.g. the Private list) stays gated as on the original.
    html = html.replace(/(<(?:section|main)\b[^>]*\sclass=")([^"]*)(")/gi, function (m, a, cls, c) {
      var t = cls.split(/\s+/);
      if (t.indexOf("private") < 0 || (t.indexOf("art-hero") < 0 && t.indexOf("art-body") < 0)) return m;
      return a + t.filter(function (x) { return x && x !== "private"; }).join(" ") + c;
    });
    document.open();
    document.write(html);
    document.close();
  }

  window.EloraeVis = { viewKey: viewKey, unlockView: unlockView, wrapPhraseKeys: wrapPhraseKeys, contentKeyAny: contentKeyAny, manifest: manifest, secretFile: secretFile, myKey: myKey, unlockAs: unlockAs, allowedList: allowedList, contentKey: contentKey, renderPage: renderPage };
})();
