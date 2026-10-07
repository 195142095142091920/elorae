/* Secret viewer: edit/secret.html?id=<secret> opens an encrypted page for people it is shared
   with. Enroll + unlock live on seal.html (phrase-is-key). ?enroll redirects there.
   If V.myKey is already unlocked from seal, open without a second passphrase prompt.
   Pending enrollment codes (for Devin) live in localStorage — not on the seal welcome. */
(function () {
  "use strict";
  var E = window.EloraeEdit, K = window.EloraeCrypto, V = window.EloraeVis;
  var q = new URLSearchParams(location.search);
  var card = document.getElementById("ee-card");
  var PENDING_ENROLL_KEY = "elorae-enroll-pending";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function show(html) { card.innerHTML = '<p class="ee-k">Elorae</p>' + html; }
  function sealEnrollHref() { return E.ROOT + "seal.html?enroll"; }
  function sealHref() { return E.ROOT + "seal.html"; }

  function readPendingEnroll() {
    try {
      var raw = localStorage.getItem(PENDING_ENROLL_KEY);
      if (!raw) return null;
      var rec = JSON.parse(raw);
      return rec && rec.person && rec.publicKey ? rec : null;
    } catch (e) { return null; }
  }

  function finishKeySetup(extra) {
    var pending = readPendingEnroll();
    var seal = E.sealWho();
    if (pending && (!seal || pending.person === seal)) {
      var code = JSON.stringify(pending);
      show((extra ? '<p class="ee-note">' + esc(extra) + '</p>' : '') +
        '<p class="ee-who">Send this to Devin</p>' +
        '<p class="ee-note">Your secrets key is ready on this device. Paste the code below to Devin so encrypted pages can open.</p>' +
        '<textarea class="ee-code" id="ee-pending-enroll" readonly rows="6"></textarea>' +
        '<div class="ee-row"><button type="button" class="ee-btn ee-primary" id="ee-copy-enroll">Copy</button></div>');
      var ta = document.getElementById("ee-pending-enroll");
      if (ta) ta.value = code;
      var copy = document.getElementById("ee-copy-enroll");
      if (copy) copy.onclick = function () {
        if (ta) ta.select();
        try { navigator.clipboard.writeText(code); } catch (x) { try { document.execCommand("copy"); } catch (y) {} }
        copy.textContent = "Copied";
      };
      return;
    }
    show((extra ? '<p class="ee-note">' + esc(extra) + '</p>' : '') +
      '<p class="ee-who">Secrets key</p>' +
      '<p class="ee-note">Sign in with your phrase. Your secrets key is derived automatically; Devin still needs to publish it before encrypted pages open.</p>' +
      '<p class="ee-note"><a href="' + esc(sealHref()) + '">Sign in</a></p>');
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
      return finishKeySetup(sec.title ? ("“" + sec.title + "” needs your secrets key published.") : "");
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
      return needSignIn("", "Sign in with your phrase to unlock your secrets key.");
    }
    return open(man, id);
  }).catch(function () { show('<p class="ee-err">Could not load.</p>'); });
})();
