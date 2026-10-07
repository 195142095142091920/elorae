/* Old plaintext map (replaced by SHA-256 hashes below): var PHRASE = {light:"jack",arcana:"jon",succor:"julie",vigor:"sawyer",fatalis:"devin"}; */
var PHRASE_HASH = {
  "99a7026172d42714d0293e5598ec1c8e8260d7d0c4b8582ad002c1883494e216":"jack",
  "25f67f02357a90b9e703068227e71c7acb44b967da68cb69f039ba975be72fd2":"jon",
  "7d0823c4ca0c0bfefdc14e67786e5c6b41d517a36a8b1cce9e0bbaf1448ce0e5":"julie",
  "340bbcf62fb5b430085a948675b2b76a33f7eb855f94b538a077973a96571c61":"sawyer",
  "0eedbe39d20f666a54f9fd82e2a7b8c7673ade3d1f86f530d68b56d3e6500740":"devin"
};
/* Figure links for the top-nav friend marks (not the welcome line). */
var FRIENDS = {jack:[["Galand","articles/galand-helviath.html"]],jon:[["Telorin","articles/telorin.html"],["Silar","articles/silar-scorria.html"]],julie:[["Saoirse","articles/saoirse.html"]],sawyer:[["Vaerek","articles/vaerek.html"]]};
/* Player names shown on the seal welcome after a successful phrase. */
var NAMES = {jack:"Jack",jon:"Jon",julie:"Julie",sawyer:"Sawyer",devin:"Devin"};
function hexDigest(buf) {
  return Array.prototype.map.call(new Uint8Array(buf), function (b) {
    return (b < 16 ? "0" : "") + b.toString(16);
  }).join("");
}
function hashPhrase(text) {
  var data = new TextEncoder().encode(text);
  return crypto.subtle.digest("SHA-256", data).then(hexDigest);
}

function clearMyKey() {
  try {
    if (window.EloraeVis && EloraeVis.myKey) EloraeVis.myKey.clear();
    else sessionStorage.removeItem("elorae-secret-key");
  } catch (e) {}
}

function ensureLogout() {
  var mark = document.querySelector(".mast .topbar > .mark") || document.querySelector(".mast .mark");
  if (!mark) return null;
  var btn = document.getElementById("seal-logout");
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.id = "seal-logout";
    btn.className = "seal-logout";
    btn.textContent = "Log out";
    mark.appendChild(btn);
    btn.addEventListener("click", function () {
      try { localStorage.removeItem("elorae-seal"); } catch (e) {}
      clearMyKey();
      applySeal();
      if (document.body.classList.contains("seal-page")) showSignedOutUI();
      else location.reload();
    });
  }
  return btn;
}

function applySeal() {
  var who = "";
  try { who = localStorage.getItem("elorae-seal") || ""; } catch (e) {}
  ["seal-jack","seal-jon","seal-julie","seal-sawyer","seal-devin"].forEach(function (c) { document.body.classList.remove(c); });
  if (who) document.body.classList.add("seal-" + who);
  var note = document.getElementById("seal-note");
  var form = document.getElementById("seal-form");
  var welcome = document.getElementById("seal-welcome");
  var name = document.getElementById("seal-name");
  if (note && form) {
    note.hidden = !who;
    form.hidden = !!who;
  }
  if (welcome) welcome.hidden = !who;
  if (name) {
    name.hidden = !who;
    /* Welcome shows the player's name (Jack / Jon / …), not their figure (seal4).
       Old figure-link welcome (seal2): built FRIENDS[who] anchors into #seal-name. */
    name.textContent = NAMES[who] || "";
  }
  /* Devin: no profile mark — only a Log out control in the mast. */
  var logout = ensureLogout();
  if (logout) logout.hidden = who !== "devin";
  return who;
}

function sealErr(msg) {
  var err = document.getElementById("seal-err");
  if (!err) return;
  err.textContent = msg || "Try again.";
  err.hidden = false;
}
function sealClearErr() {
  var err = document.getElementById("seal-err");
  if (err) { err.hidden = true; err.textContent = "Try again."; }
}

function showSignedOutUI() {
  var form = document.getElementById("seal-form");
  var welcome = document.getElementById("seal-welcome");
  var name = document.getElementById("seal-name");
  var note = document.getElementById("seal-note");
  var enrollBox = document.getElementById("seal-enroll");
  var codeBox = document.getElementById("seal-code-box");
  if (form) form.hidden = false;
  if (welcome) welcome.hidden = true;
  if (name) name.hidden = true;
  if (note) note.hidden = true;
  if (enrollBox) enrollBox.hidden = true;
  if (codeBox) { codeBox.hidden = true; codeBox.innerHTML = ""; }
  updateSealButtons();
}

function personHasKey(man, who) {
  return !!(man && man.people && man.people[who] && man.people[who].key);
}

function updateSealButtons() {
  var submit = document.getElementById("seal-submit");
  var create = document.getElementById("seal-create");
  if (!submit && !create) return;
  var wantEnroll = /(?:\?|&)enroll(?:&|=|$)/.test(location.search) || location.search.indexOf("enroll") >= 0;
  try { wantEnroll = new URLSearchParams(location.search).has("enroll"); } catch (e) {}
  var who = "";
  try { who = localStorage.getItem("elorae-seal") || ""; } catch (e) {}
  /* Default: one Sign in button. Create key shown when ?enroll or after identity with no key. */
  if (submit) submit.hidden = false;
  if (create) create.hidden = !wantEnroll;
}

function setWelcomeNote(text) {
  var note = document.getElementById("seal-note");
  if (!note) return;
  note.textContent = text;
  note.hidden = false;
}

function showEnrollmentCode(rec) {
  var code = JSON.stringify(rec);
  var box = document.getElementById("seal-code-box");
  if (!box) return;
  box.hidden = false;
  box.innerHTML =
    '<p class="seal-welcome">Your enrollment code</p>' +
    '<textarea class="seal-enroll-code" readonly id="seal-enroll-code" rows="6"></textarea>' +
    '<div class="seal-actions"><button type="button" id="seal-copy" class="seal-copy">Copy</button></div>' +
    '<p class="seal-note">Send this code to Devin. It holds only your public key and a passphrase-locked private key, so it is safe to send. Never send the phrase itself. Until Devin adds your key, your identity still works; encrypted pages wait.</p>';
  var ta = document.getElementById("seal-enroll-code");
  if (ta) ta.value = code;
  var copy = document.getElementById("seal-copy");
  if (copy) copy.onclick = function () {
    if (ta) ta.select();
    try { navigator.clipboard.writeText(code); } catch (x) { try { document.execCommand("copy"); } catch (y) {} }
    copy.textContent = "Copied";
  };
  var form = document.getElementById("seal-form");
  var enrollBox = document.getElementById("seal-enroll");
  if (form) form.hidden = true;
  if (enrollBox) enrollBox.hidden = true;
}

function afterIdentity(who, phrase, man) {
  var K = window.EloraeCrypto, V = window.EloraeVis;
  var hasKey = personHasKey(man, who);
  var enrollBox = document.getElementById("seal-enroll");
  var create = document.getElementById("seal-create");
  var wantEnroll = false;
  try { wantEnroll = new URLSearchParams(location.search).has("enroll"); } catch (e) {}

  applySeal();

  if (!K || !V) {
    setWelcomeNote("You may now view your private material.");
    return Promise.resolve();
  }

  if (hasKey) {
    return V.unlockAs(man, who, phrase).then(function () {
      setWelcomeNote("You may now view your private material.");
      if (enrollBox) enrollBox.hidden = true;
    }, function (x) {
      /* Identity still sticks; key unlock failed (wrong wrap or not yet the merged phrase). */
      setWelcomeNote("Signed in. Your secrets key did not unlock — try again, or finish key setup if this is a new key.");
      sealErr(x.message || "Could not unlock your key.");
    });
  }

  /* No key published yet: identity works; offer Create key / enroll. Keep phrase form visible. */
  setWelcomeNote("Signed in. Create your secrets key with the same phrase, then send the code to Devin. Encrypted pages wait until your key is added.");
  var form = document.getElementById("seal-form");
  if (form) form.hidden = false;
  if (enrollBox) enrollBox.hidden = false;
  if (create) create.hidden = false;
  if (wantEnroll) {
    return runEnroll(who, phrase);
  }
  return Promise.resolve();
}

function runEnroll(who, phrase) {
  var K = window.EloraeCrypto, V = window.EloraeVis;
  if (!K) return Promise.reject(new Error("Crypto is not loaded."));
  sealClearErr();
  sealErr("Creating…");
  return K.enroll(who, phrase).then(function (rec) {
    sealClearErr();
    /* Unlock locally so this session can use the key once Devin publishes it;
       until then encrypted bodies still wait (no wrapped content keys yet). */
    return K.unlock(rec, phrase).then(function (priv) {
      return K.exportPrivate(priv).then(function (jwk) {
        if (V && V.myKey) V.myKey.set(who, jwk);
        showEnrollmentCode(rec);
        applySeal();
        setWelcomeNote("Send the enrollment code to Devin. Until your key is added, identity works; encrypted pages wait.");
      });
    });
  }, function (x) {
    sealErr(x.message || "Could not create key.");
  });
}

function loadManifest() {
  var V = window.EloraeVis;
  if (!V) return Promise.resolve(null);
  return V.manifest(false).catch(function () { return null; });
}

applySeal();

/* Seal page only: merged identity + secrets unlock / enroll. Other pages keep applySeal only. */
if (document.body.classList.contains("seal-page")) {
  var form = document.getElementById("seal-form");
  var phraseInput = document.getElementById("seal-code");
  var pendingPhrase = "";

  function readPhrase() {
    var raw = phraseInput ? phraseInput.value : "";
    if (form) {
      try { raw = new FormData(form).get("phrase") || raw; } catch (e) {}
    }
    return String(raw || "").trim().toLowerCase();
  }

  function signIn(e) {
    if (e) e.preventDefault();
    sealClearErr();
    var key = readPhrase();
    if (!key) { sealErr("Enter your phrase."); return; }
    pendingPhrase = key;
    hashPhrase(key).then(function (digest) {
      var who = PHRASE_HASH[digest];
      if (!who) { sealErr("Try again."); return; }
      try { localStorage.setItem("elorae-seal", who); } catch (err2) {}
      return loadManifest().then(function (man) {
        return afterIdentity(who, key, man);
      });
    }).catch(function () {
      sealErr("Try again.");
    });
  }

  if (form) form.addEventListener("submit", signIn);

  var createBtn = document.getElementById("seal-create");
  if (createBtn) createBtn.addEventListener("click", function (e) {
    e.preventDefault();
    sealClearErr();
    var key = pendingPhrase || readPhrase();
    var who = "";
    try { who = localStorage.getItem("elorae-seal") || ""; } catch (err) {}
    if (!who) {
      /* Identify first, then enroll. */
      if (!key) { sealErr("Enter your phrase."); return; }
      pendingPhrase = key;
      hashPhrase(key).then(function (digest) {
        who = PHRASE_HASH[digest];
        if (!who) { sealErr("Try again."); return; }
        try { localStorage.setItem("elorae-seal", who); } catch (err2) {}
        applySeal();
        return runEnroll(who, key);
      }).catch(function () { sealErr("Try again."); });
      return;
    }
    if (!key) { sealErr("Enter the same phrase you signed in with."); return; }
    runEnroll(who, key);
  });

  updateSealButtons();

  /* Returning visit already sealed: refresh welcome; try unlock if deps + key exist (needs phrase again). */
  var whoNow = "";
  try { whoNow = localStorage.getItem("elorae-seal") || ""; } catch (e) {}
  if (whoNow) {
    loadManifest().then(function (man) {
      if (!man) return;
      var hasKey = personHasKey(man, whoNow);
      var mine = window.EloraeVis && EloraeVis.myKey && EloraeVis.myKey.get();
      var enrollBox = document.getElementById("seal-enroll");
      var create = document.getElementById("seal-create");
      var wantEnroll = false;
      try { wantEnroll = new URLSearchParams(location.search).has("enroll"); } catch (e) {}
      if (mine && mine.person === whoNow) {
        setWelcomeNote("You may now view your private material.");
      } else if (hasKey) {
        setWelcomeNote("Signed in. Enter your phrase again to unlock your secrets key.");
        var f = document.getElementById("seal-form");
        if (f) f.hidden = false;
      } else {
        setWelcomeNote("Signed in. Create your secrets key with your phrase, then send the code to Devin.");
        if (enrollBox) enrollBox.hidden = false;
        if (create) create.hidden = false;
      }
      if (wantEnroll && !hasKey) {
        if (enrollBox) enrollBox.hidden = false;
        if (create) create.hidden = false;
      }
    });
  } else {
    var wantEnroll0 = false;
    try { wantEnroll0 = new URLSearchParams(location.search).has("enroll"); } catch (e) {}
    if (wantEnroll0) {
      setWelcomeNote("Enter your phrase to create your secrets key. The same phrase signs you in.");
      var note0 = document.getElementById("seal-note");
      if (note0) note0.hidden = false;
      var create0 = document.getElementById("seal-create");
      if (create0) create0.hidden = false;
    }
  }
}

var back = document.getElementById("seal-back");
if (back) back.addEventListener("click", function (e) {
  if (history.length > 1) { e.preventDefault(); history.back(); }
});
