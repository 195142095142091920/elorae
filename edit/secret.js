/* Secret viewer: edit/secret.html?id=<secret> opens an encrypted page for people it is shared
   with. Enroll + unlock live on seal.html (merged sign-in). ?enroll redirects there.
   If V.myKey is already unlocked from seal, open without a second passphrase prompt. */
(function () {
  "use strict";
  var E = window.EloraeEdit, K = window.EloraeCrypto, V = window.EloraeVis;
  var q = new URLSearchParams(location.search);
  var card = document.getElementById("ee-card");
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function show(html) { card.innerHTML = '<p class="ee-k">Elorae</p>' + html; }
  function sealEnrollHref() { return E.ROOT + "seal.html?enroll"; }
  function sealHref() { return E.ROOT + "seal.html"; }

  function finishKeySetup(extra) {
    show((extra ? '<p class="ee-note">' + esc(extra) + '</p>' : '') +
      '<p class="ee-who">Finish key setup</p>' +
      '<p class="ee-note">Create your secrets key on the sign-in page (same phrase), then send the enrollment code to Devin. Until your key is added, identity still works; encrypted pages wait.</p>' +
      '<p class="ee-note"><a href="' + esc(sealEnrollHref()) + '">Finish key setup</a></p>');
  }

  function needSignIn(title, msg) {
    show((title ? '<p class="ee-who">' + esc(title) + '</p>' : '') +
      '<p class="ee-note">' + esc(msg || "Sign in with your phrase to open this.") + '</p>' +
      '<p class="ee-note"><a href="' + esc(sealHref()) + '">Sign in</a></p>');
  }

  function open(man, id) {
    var sec = man.secrets[id];
    if (!sec) return show('<p class="ee-note">Nothing here.</p>');
    if (sec.status !== "encrypted") return show('<p class="ee-note">This page has not been encrypted yet.</p>');

    var seal = E.sealWho();
    var personRec = seal && man.people && man.people[seal];
    if (seal && personRec && !personRec.key) {
      return finishKeySetup(sec.title ? ("“" + sec.title + "” needs your secrets key.") : "");
    }

    var mine = V.myKey.get();
    if (!mine) {
      return needSignIn(sec.title, "Sign in with your phrase to unlock your secrets key, then open this page.");
    }

    return V.myKey.privateKey().then(function (priv) {
      return V.contentKey(man, id, mine && mine.person, priv);
    }).then(function (ck) {
      if (!ck) {
        if (mine && !(sec.everyone && sec.openKey)) {
          return needSignIn(sec.title, "This page isn't shared with " + ((man.people[mine.person] || {}).name || mine.person) + ".");
        }
        return needSignIn(sec.title);
      }
      return V.secretFile(id).then(function (file) {
        if (file.epoch !== sec.epoch) throw new Error("This page is being re-shared. Try again in a minute.");
        return K.decryptSecret(file, ck);
      }).then(function (payload) { V.renderPage(payload); });
    }).catch(function (x) { show('<p class="ee-err">' + esc(x.message || "Could not open.") + '</p>'); });
  }

  if (q.has("enroll")) {
    location.replace(sealEnrollHref());
    return;
  }

  V.manifest(false).then(function (man) {
    var id = q.get("id");
    if (!id) {
      var seal = E.sealWho();
      var personRec = seal && man.people && man.people[seal];
      if (seal && personRec && !personRec.key) return finishKeySetup();
      if (V.myKey.get()) return show('<p class="ee-note">Your secrets key is unlocked. Open a shared link to read a page.</p>');
      return needSignIn("", "Sign in with your phrase, or finish key setup if you do not have a key yet.");
    }
    return open(man, id);
  }).catch(function () { show('<p class="ee-err">Could not load.</p>'); });
})();
