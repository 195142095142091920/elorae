/* Old plaintext map (replaced by SHA-256 hashes below): var PHRASE = {light:"jack",arcana:"jon",succor:"julie",vigor:"sawyer",fatalis:"devin"}; */
var PHRASE_HASH = {
  "99a7026172d42714d0293e5598ec1c8e8260d7d0c4b8582ad002c1883494e216":"jack",
  "25f67f02357a90b9e703068227e71c7acb44b967da68cb69f039ba975be72fd2":"jon",
  "7d0823c4ca0c0bfefdc14e67786e5c6b41d517a36a8b1cce9e0bbaf1448ce0e5":"julie",
  "340bbcf62fb5b430085a948675b2b76a33f7eb855f94b538a077973a96571c61":"sawyer",
  "0eedbe39d20f666a54f9fd82e2a7b8c7673ade3d1f86f530d68b56d3e6500740":"devin"
};
/* Player names shown on the seal welcome after a successful phrase. */
var NAMES = {jack:"Jack",jon:"Jon",julie:"Julie",sawyer:"Sawyer",devin:"Devin"};
var SEAL_PLAYERS = {jack:1,jon:1,julie:1,sawyer:1,devin:1};
function readSealWho() {
  try {
    var m = document.cookie.match(/(?:^|;\s*)elorae-seal=([a-z]+)/);
    if (m && SEAL_PLAYERS[m[1]]) return m[1];
  } catch (e) {}
  try {
    var w = localStorage.getItem("elorae-seal") || "";
    if (SEAL_PLAYERS[w]) return w;
  } catch (e) {}
  return "";
}
function setSealSession(who) {
  if (!SEAL_PLAYERS[who]) return;
  try { localStorage.setItem("elorae-seal", who); } catch (e) {}
  try {
    document.cookie = "elorae-seal=" + who + "; path=/; max-age=31536000; SameSite=Lax";
  } catch (e) {}
}
function clearSealSession() {
  try { localStorage.removeItem("elorae-seal"); } catch (e) {}
  try { document.cookie = "elorae-seal=; path=/; max-age=0; SameSite=Lax"; } catch (e) {}
}

/* Access gate (backup): any non-seal page without a valid session → phrase sign-in.
   Valid session does NOT force profile; Connect-to-GitHub success still does. */
(function () {
  try {
    if (document.body && document.body.classList.contains("seal-page")) return;
    var path = location.pathname || "";
    if (/(^|\/)seal\.html$/i.test(path)) return;
    if (readSealWho()) return;
    var s = document.querySelector('script[src*="seal.js"]');
    var seal = s ? new URL("seal.html", s.src).href : "seal.html";
    location.replace(seal);
  } catch (e) {}
})();

var PENDING_ENROLL_KEY = "elorae-enroll-pending";
var PHRASE_MEMORY_KEY = "elorae-seal-phrase";

function readRememberedPhrase() {
  try { return String(localStorage.getItem(PHRASE_MEMORY_KEY) || ""); } catch (e) { return ""; }
}
function rememberPhrase(phrase) {
  var p = String(phrase || "").trim().toLowerCase();
  try {
    if (p) localStorage.setItem(PHRASE_MEMORY_KEY, p);
  } catch (e) {}
}

var GH_CONNECTING = false;
var GH_STATUS_TIMER = null;

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

function githubConnected() {
  try {
    if (window.EloraeEdit && EloraeEdit.session) {
      var s0 = EloraeEdit.session.get();
      if (s0 && s0.token && s0.login) return true;
    }
    var raw = sessionStorage.getItem("elorae-edit-session") || localStorage.getItem("elorae-edit-session");
    if (!raw) return false;
    var s = JSON.parse(raw);
    return !!(s && s.token && s.login);
  } catch (e) { return false; }
}

function profileHref(who) {
  var root = (window.EloraeEdit && EloraeEdit.ROOT) || "";
  return root + "players/" + who + ".html";
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
      clearSealSession();
      clearMyKey();
      applySeal();
      if (document.body.classList.contains("seal-page")) showSignedOutUI();
      else location.reload();
    });
  }
  return btn;
}

function applySeal() {
  var who = readSealWho();
  if (who) setSealSession(who); /* keep cookie in sync with existing localStorage sessions */
  ["seal-jack","seal-jon","seal-julie","seal-sawyer","seal-devin"].forEach(function (c) { document.body.classList.remove(c); });
  if (who) document.body.classList.add("seal-" + who);
  var form = document.getElementById("seal-form");
  var welcome = document.getElementById("seal-welcome");
  if (form) form.hidden = !!who;
  if (welcome) {
    if (who) {
      welcome.textContent = "Welcome, " + (NAMES[who] || who);
      welcome.hidden = false;
    } else {
      welcome.hidden = true;
      welcome.textContent = "";
    }
  }
  /* Devin: no profile mark — only a Log out control in the mast. */
  var logout = ensureLogout();
  if (logout) logout.hidden = who !== "devin";
  if (document.body.classList.contains("seal-page") && who) syncGithubUI(who);
  else hideGithubUI();
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

function hideGithubUI() {
  var actions = document.getElementById("seal-gh-actions");
  var status = document.getElementById("seal-gh-status");
  if (actions) actions.hidden = true;
  if (status) { status.hidden = true; status.textContent = ""; }
}

function setGhStatus(msg, kind) {
  var status = document.getElementById("seal-gh-status");
  if (!status) return;
  if (GH_STATUS_TIMER) { clearTimeout(GH_STATUS_TIMER); GH_STATUS_TIMER = null; }
  if (!msg) { status.hidden = true; status.textContent = ""; status.removeAttribute("data-kind"); return; }
  status.textContent = msg;
  status.hidden = false;
  status.setAttribute("data-kind", kind || "info");
}

function syncGithubUI(who) {
  var actions = document.getElementById("seal-gh-actions");
  var btn = document.getElementById("seal-github");
  if (!actions) return;
  if (githubConnected()) {
    actions.hidden = true;
  } else {
    actions.hidden = false;
    if (btn) btn.hidden = false;
  }
}

function showSignedOutUI() {
  var form = document.getElementById("seal-form");
  var welcome = document.getElementById("seal-welcome");
  if (form) form.hidden = false;
  if (welcome) { welcome.hidden = true; welcome.textContent = ""; }
  hideGithubUI();
  GH_CONNECTING = false;
  sealClearErr();
}

function personHasKey(man, who) {
  return !!(man && man.people && man.people[who] && man.people[who].key);
}

function stashPendingEnroll(rec) {
  try { localStorage.setItem(PENDING_ENROLL_KEY, JSON.stringify(rec)); } catch (e) {}
}

/* Phrase → sealMaterial (domain-separated SHA-256 hex) → PBKDF2 enroll/unlock.
   Short seal phrases like "light" always expand to 64 chars, so K.enroll's length floor passes. */
function withSealMaterial(phrase, fn) {
  var K = window.EloraeCrypto;
  if (!K || !K.sealMaterial) return Promise.reject(new Error("Crypto is not loaded."));
  return K.sealMaterial(phrase).then(fn);
}

function silentEnroll(who, phrase) {
  var K = window.EloraeCrypto, V = window.EloraeVis;
  return withSealMaterial(phrase, function (material) {
    return K.enroll(who, material).then(function (rec) {
      stashPendingEnroll(rec);
      return K.unlock(rec, material).then(function (priv) {
        return K.exportPrivate(priv).then(function (jwk) {
          if (V && V.myKey) V.myKey.set(who, jwk);
          return rec;
        });
      });
    });
  });
}

function unlockWithPhrase(man, who, phrase) {
  var V = window.EloraeVis;
  if (!V) return Promise.resolve();
  return withSealMaterial(phrase, function (material) {
    return V.unlockAs(man, who, material);
  });
}

function afterIdentity(who, phrase, man) {
  var K = window.EloraeCrypto, V = window.EloraeVis;
  var hasKey = personHasKey(man, who);

  applySeal();

  if (!K || !V) return Promise.resolve();

  if (hasKey) {
    return unlockWithPhrase(man, who, phrase).then(function () {
      /* unlocked */
    }, function () {
      /* Old key wrapped with a different passphrase: leave Dashboard / paste-key path intact. */
    });
  }

  /* No published key yet: derive + enroll locally; enrollment code is NOT shown on seal. */
  return silentEnroll(who, phrase).catch(function () {
    /* Identity still sticks; key can be retried later. */
  });
}

function loadManifest() {
  var V = window.EloraeVis;
  if (!V) return Promise.resolve(null);
  return V.manifest(false).catch(function () { return null; });
}

function goConnectGithub() {
  sealClearErr();
  GH_CONNECTING = true;
  setGhStatus("Connect with the GitHub panel…", "info");
  try {
    if (location.hash === "#edit") {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } else {
      location.hash = "edit";
    }
  } catch (e) {
    location.hash = "edit";
  }
}

function onGithubConnected(who) {
  GH_CONNECTING = false;
  setGhStatus("GitHub connected", "ok");
  syncGithubUI(who);
  /* Brief confirmation, then profile page (where the connection lives). */
  GH_STATUS_TIMER = setTimeout(function () {
    location.href = profileHref(who);
  }, 900);
}

function onGithubFailed(msg) {
  GH_CONNECTING = false;
  setGhStatus(msg || "GitHub connection failed.", "err");
  syncGithubUI(readSealWho());
}

applySeal();

/* Seal page only: phrase-is-key identity + secrets + optional GitHub connect. */
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

  /* Browser-local phrase memory (localStorage only — not the session cookie). */
  if (phraseInput) {
    var remembered = readRememberedPhrase();
    if (remembered && !phraseInput.value) phraseInput.value = remembered;
    phraseInput.addEventListener("change", function () { rememberPhrase(readPhrase()); });
    phraseInput.addEventListener("blur", function () { rememberPhrase(readPhrase()); });
  }

  function signIn(e) {
    if (e) e.preventDefault();
    sealClearErr();
    setGhStatus("");
    var key = readPhrase();
    if (!key) { sealErr("Enter your phrase."); return; }
    pendingPhrase = key;
    rememberPhrase(key);
    hashPhrase(key).then(function (digest) {
      var who = PHRASE_HASH[digest];
      if (!who) { sealErr("Try again."); return; }
      setSealSession(who);
      return loadManifest().then(function (man) {
        return afterIdentity(who, key, man);
      });
    }).catch(function () {
      sealErr("Try again.");
    });
  }

  if (form) form.addEventListener("submit", signIn);

  var ghBtn = document.getElementById("seal-github");
  if (ghBtn) ghBtn.addEventListener("click", function (e) {
    e.preventDefault();
    var who = "";
    who = readSealWho();
    if (!who) { sealErr("Sign in with your phrase first."); return; }
    if (githubConnected()) {
      syncGithubUI(who);
      return;
    }
    goConnectGithub();
  });

  /* Existing edit gate notifies on session set / clear. */
  window.addEventListener("elorae-edit-session", function () {
    var who = "";
    who = readSealWho();
    if (!who || !document.body.classList.contains("seal-page")) return;
    if (githubConnected()) {
      if (GH_CONNECTING || !document.getElementById("seal-gh-actions") || !document.getElementById("seal-gh-actions").hidden) {
        onGithubConnected(who);
      } else {
        syncGithubUI(who);
      }
    } else if (GH_CONNECTING) {
      /* Session cleared mid-connect (expired / signed out) — treat as failure. */
      onGithubFailed("GitHub connection failed.");
    } else {
      syncGithubUI(who);
    }
  });

  /* Leaving #edit without a session after we started connect → cancelled / failed. */
  window.addEventListener("hashchange", function () {
    if (!GH_CONNECTING) return;
    if (location.hash === "#edit") return;
    if (githubConnected()) return;
    onGithubFailed("GitHub connection cancelled.");
  });

  /* Returning visit already sealed. */
  var whoNow = "";
  whoNow = readSealWho();
  if (whoNow) {
    applySeal();
    loadManifest().then(function (man) {
      var mine = window.EloraeVis && EloraeVis.myKey && EloraeVis.myKey.get();
      if (mine && mine.person === whoNow) return;
      /* Identity remembered; secrets key needs the phrase again this session. */
      var f = document.getElementById("seal-form");
      if (f) f.hidden = false;
    });
  }

  /* ?enroll: same as sign-in — phrase derives key; no separate Create-key UI. */
  try {
    if (new URLSearchParams(location.search).has("enroll") && !whoNow) {
      /* Form already visible when signed out. */
    }
  } catch (e) {}
}

var back = document.getElementById("seal-back");
if (back) back.addEventListener("click", function (e) {
  if (history.length > 1) { e.preventDefault(); history.back(); }
});
