/* Secret viewer: edit/secret.html?id=<secret> opens an encrypted page for people it is shared
   with; edit/secret.html?enroll sets up a personal passphrase key. */
(function () {
  "use strict";
  var E = window.EloraeEdit, K = window.EloraeCrypto, V = window.EloraeVis;
  var q = new URLSearchParams(location.search);
  var card = document.getElementById("ee-card");
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function show(html) { card.innerHTML = '<p class="ee-k">Elorae</p>' + html; }
  function people(man, onlyEnrolled) {
    return Object.keys(man.people || {}).filter(function (k) { return !onlyEnrolled || man.people[k].key; });
  }
  function options(man, list, sel) {
    return list.map(function (k) { return '<option value="' + esc(k) + '"' + (k === sel ? " selected" : "") + '>' + esc(man.people[k].name || k) + '</option>'; }).join("");
  }

  function enrollView(man) {
    var seal = E.sealWho();
    show('<p class="ee-who">Set up your key</p>' +
      '<form id="ee-f" autocomplete="off"><select id="ee-person" aria-label="Your name">' + options(man, people(man), seal) + '</select>' +
      '<input type="password" id="ee-p1" placeholder="New passphrase" autocomplete="new-password">' +
      '<input type="password" id="ee-p2" placeholder="Repeat passphrase" autocomplete="new-password">' +
      '<div class="ee-row"><button class="ee-btn ee-primary" type="submit">Create</button></div>' +
      '<p class="ee-err" id="ee-err" hidden></p>' +
      '<p class="ee-note">Use four or more random words. Your passphrase never leaves this browser and can\'t be recovered; if you lose it, make a new key and Devin re-shares.</p></form>');
    document.getElementById("ee-f").onsubmit = function (e) {
      e.preventDefault();
      var err = document.getElementById("ee-err");
      var who = document.getElementById("ee-person").value, a = document.getElementById("ee-p1").value, b = document.getElementById("ee-p2").value;
      if (a !== b) { err.textContent = "The passphrases don't match."; err.hidden = false; return; }
      err.textContent = "Creating…"; err.hidden = false;
      K.enroll(who, a).then(function (rec) {
        var code = JSON.stringify(rec);
        show('<p class="ee-who">Your enrollment code</p>' +
          '<textarea class="ee-code" readonly id="ee-code">' + esc(code) + '</textarea>' +
          '<div class="ee-row"><button class="ee-btn ee-primary" type="button" id="ee-copy">Copy</button></div>' +
          '<p class="ee-note">Send this code to Devin. It holds only your public key and a passphrase-locked private key, so it is safe to send. Never send the passphrase itself.</p>');
        document.getElementById("ee-copy").onclick = function () {
          var t = document.getElementById("ee-code"); t.select();
          try { navigator.clipboard.writeText(code); } catch (x) { document.execCommand("copy"); }
          this.textContent = "Copied";
        };
      }, function (x) { err.textContent = x.message; err.hidden = false; });
    };
  }

  function unlockView(man, id, msg) {
    var enrolled = people(man, true);
    var mine = V.myKey.get();
    show('<p class="ee-who">' + esc(man.secrets[id].title) + '</p>' +
      (enrolled.length ? '<form id="ee-f" autocomplete="off"><select id="ee-person" aria-label="Your name">' + options(man, enrolled, (mine && mine.person) || E.sealWho()) + '</select>' +
        '<input type="password" id="ee-pass" placeholder="Passphrase" autocomplete="current-password">' +
        '<div class="ee-row"><button class="ee-btn ee-primary" type="submit">Open</button></div>' +
        '<p class="ee-err" id="ee-err"' + (msg ? "" : " hidden") + '>' + esc(msg || "") + '</p></form>'
        : '<p class="ee-note">No one has a key yet.</p>') +
      '<p class="ee-note"><a href="secret.html?enroll">Set up your key</a></p>');
    var f = document.getElementById("ee-f");
    if (f) f.onsubmit = function (e) {
      e.preventDefault();
      var err = document.getElementById("ee-err");
      err.textContent = "Opening…"; err.hidden = false;
      V.unlockAs(man, document.getElementById("ee-person").value, document.getElementById("ee-pass").value)
        .then(function () { open(man, id); }, function (x) { err.textContent = x.message; err.hidden = false; });
    };
  }

  function open(man, id) {
    var sec = man.secrets[id];
    if (!sec) return show('<p class="ee-note">Nothing here.</p>');
    if (sec.status !== "encrypted") return show('<p class="ee-note">This page has not been moved into the encrypted vault yet.</p>');
    var mine = V.myKey.get();
    return V.myKey.privateKey().then(function (priv) {
      return V.contentKey(man, id, mine && mine.person, priv);
    }).then(function (ck) {
      if (!ck) {
        if (mine && !(sec.everyone && sec.openKey)) return unlockView(man, id, "This page isn't shared with " + ((man.people[mine.person] || {}).name || mine.person) + ".");
        return unlockView(man, id);
      }
      return V.secretFile(id).then(function (file) {
        if (file.epoch !== sec.epoch) throw new Error("This page is being re-shared. Try again in a minute.");
        return K.decryptSecret(file, ck);
      }).then(function (payload) { V.renderPage(payload); });
    }).catch(function (x) { show('<p class="ee-err">' + esc(x.message || "Could not open.") + '</p>'); });
  }

  V.manifest(false).then(function (man) {
    if (q.has("enroll")) return enrollView(man);
    var id = q.get("id");
    if (!id) return show('<p class="ee-note"><a href="secret.html?enroll">Set up your key</a></p>');
    return open(man, id);
  }).catch(function () { show('<p class="ee-err">Could not load.</p>'); });
})();
