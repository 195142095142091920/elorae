/* Elorae visibility layer: manifest + key helpers shared by secret.html and dashboard.html. */
(function () {
  "use strict";
  var E = window.EloraeEdit, K = window.EloraeCrypto;
  var MKEY = "elorae-secret-key";

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
    document.open();
    document.write(html);
    document.close();
  }

  window.EloraeVis = { manifest: manifest, secretFile: secretFile, myKey: myKey, unlockAs: unlockAs, allowedList: allowedList, contentKey: contentKey, renderPage: renderPage };
})();
