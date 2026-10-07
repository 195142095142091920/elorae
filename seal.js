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
var GUEST_KEY = "elorae-guest";
var PENDING_ENROLL_KEY = "elorae-enroll-pending";
var PHRASE_MEMORY_KEY = "elorae-seal-phrase";

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
function isGuest() {
  try { return localStorage.getItem(GUEST_KEY) === "1"; } catch (e) { return false; }
}
function setGuest() {
  try { localStorage.setItem(GUEST_KEY, "1"); } catch (e) {}
}
function clearGuest() {
  try { localStorage.removeItem(GUEST_KEY); } catch (e) {}
}
function setSealSession(who) {
  if (!SEAL_PLAYERS[who]) return;
  clearGuest();
  try { localStorage.setItem("elorae-seal", who); } catch (e) {}
  try {
    document.cookie = "elorae-seal=" + who + "; path=/; max-age=31536000; SameSite=Lax";
  } catch (e) {}
}
function clearSealSession() {
  try { localStorage.removeItem("elorae-seal"); } catch (e) {}
  try { document.cookie = "elorae-seal=; path=/; max-age=0; SameSite=Lax"; } catch (e) {}
}

/* Access gate backup: unsigned + non-guest → seal. Guests skip restricted edit pages. */
(function () {
  try {
    if (document.body && document.body.classList.contains("seal-page")) return;
    var path = location.pathname || "";
    if (/(^|\/)seal\.html$/i.test(path)) return;
    if (readSealWho()) return;
    var restricted = /(^|\/)edit\/(secret|dashboard)\.html$/i.test(path);
    if (isGuest() && !restricted) return;
    var s = document.querySelector('script[src*="seal.js"]');
    var seal = s ? new URL("seal.html", s.src).href : "seal.html";
    location.replace(seal);
  } catch (e) {}
})();

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

function sealScriptBase() {
  var s = document.querySelector('script[src*="seal.js"]');
  return s ? s.src : location.href;
}

function indexHref() {
  /* Guest / quiet leave: root Index entry (no seal, no login prompt). */
  return new URL("index.html", sealScriptBase()).href;
}

function sealHref() {
  return new URL("seal.html", sealScriptBase()).href;
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
      clearGuest();
      clearMyKey();
      if (document.body.classList.contains("seal-page")) {
        applySeal();
        showSignedOutUI();
      } else {
        location.href = sealHref();
      }
    });
  }
  return btn;
}

/* Quiet leave-guest: reuse logout slot as "Sign in" when browsing as guest. */
function ensureGuestExit() {
  var mark = document.querySelector(".mast .topbar > .mark") || document.querySelector(".mast .mark");
  if (!mark) return null;
  var btn = document.getElementById("seal-guest-exit");
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.id = "seal-guest-exit";
    btn.className = "seal-logout seal-guest-exit";
    btn.textContent = "Sign in";
    mark.appendChild(btn);
    btn.addEventListener("click", function () {
      clearGuest();
      location.href = sealHref();
    });
  }
  return btn;
}

function applySeal() {
  var who = readSealWho();
  var guest = !who && isGuest();
  if (who) setSealSession(who); /* keep cookie in sync with existing localStorage sessions */
  ["seal-jack","seal-jon","seal-julie","seal-sawyer","seal-devin","seal-guest"].forEach(function (c) {
    document.body.classList.remove(c);
  });
  if (who) document.body.classList.add("seal-" + who);
  if (guest) document.body.classList.add("seal-guest");

  var form = document.getElementById("seal-form");
  var welcome = document.getElementById("seal-welcome");
  var guestBtn = document.getElementById("seal-guest");
  if (form) form.hidden = !!who;
  if (guestBtn) guestBtn.hidden = !!who;
  if (welcome) {
    if (who) {
      welcome.textContent = "Welcome, " + (NAMES[who] || who);
      welcome.hidden = false;
    } else {
      welcome.hidden = true;
      welcome.textContent = "";
    }
  }

  var logout = ensureLogout();
  if (logout) logout.hidden = who !== "devin";
  var gExit = ensureGuestExit();
  if (gExit) gExit.hidden = !guest || document.body.classList.contains("seal-page");

  hideGithubUI();
  if (who && !guest) syncGithubUI(who);

  /* Guests must not see owner-gated article bodies; leave quietly if they hit one. */
  if (guest) {
    var sealedMain = document.querySelector("main.art-body.sealed[data-owner], section.art-hero.sealed[data-owner]");
    if (sealedMain) {
      location.replace(indexHref());
      return who;
    }
  }

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
  if (status) { status.hidden = true; status.textContent = ""; status.removeAttribute("data-kind"); }
  var prof = document.getElementById("profile-gh-actions");
  if (prof) prof.hidden = true;
  var pstat = document.getElementById("profile-gh-status");
  if (pstat) { pstat.hidden = true; pstat.textContent = ""; pstat.removeAttribute("data-kind"); }
}

function setGhStatus(msg, kind) {
  var status = document.body.classList.contains("seal-page")
    ? (document.getElementById("seal-gh-status") || document.getElementById("profile-gh-status"))
    : (document.getElementById("profile-gh-status") || document.getElementById("seal-gh-status"));
  if (!status) return;
  if (GH_STATUS_TIMER) { clearTimeout(GH_STATUS_TIMER); GH_STATUS_TIMER = null; }
  if (!msg) { status.hidden = true; status.textContent = ""; status.removeAttribute("data-kind"); return; }
  status.textContent = msg;
  status.hidden = false;
  status.setAttribute("data-kind", kind || "info");
}

function ensureProfileGithub(who) {
  if (!document.body.classList.contains("player-page")) return null;
  var aside = document.getElementById("nt-player");
  var main = document.querySelector("main.read") || document.querySelector("main");
  if (!main && !aside) return null;
  var host = aside || main;
  var wrap = document.getElementById("profile-gh-actions");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "profile-gh-actions";
    wrap.className = "seal-actions profile-gh-actions";
    wrap.hidden = true;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "profile-github";
    btn.textContent = "Connect to GitHub";
    wrap.appendChild(btn);
    var status = document.createElement("p");
    status.className = "seal-gh-status";
    status.id = "profile-gh-status";
    status.hidden = true;
    var h1 = main && main.querySelector(":scope > h1");
    if (h1 && h1.parentNode) {
      h1.parentNode.insertBefore(wrap, h1.nextSibling);
      h1.parentNode.insertBefore(status, wrap.nextSibling);
    } else {
      host.insertBefore(wrap, host.firstChild);
      host.insertBefore(status, wrap.nextSibling);
    }
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      var w = readSealWho();
      if (!w) { location.href = sealHref(); return; }
      if (githubConnected()) { syncGithubUI(w); return; }
      goConnectGithub();
    });
  }
  /* Only on the signed-in player's own profile. */
  var slug = "";
  if (aside) slug = aside.getAttribute("data-person") || "";
  if (slug && slug !== who) {
    wrap.hidden = true;
    return wrap;
  }
  return wrap;
}

function syncGithubUI(who) {
  if (!who || isGuest()) { hideGithubUI(); return; }

  /* Seal page: Connect lives under Welcome when GitHub is not yet linked. */
  if (document.body.classList.contains("seal-page")) {
    var sealActions = document.getElementById("seal-gh-actions");
    var sealBtn = document.getElementById("seal-github");
    var prof = document.getElementById("profile-gh-actions");
    if (prof) prof.hidden = true;
    if (!sealActions) return;
    if (githubConnected()) {
      sealActions.hidden = true;
    } else {
      sealActions.hidden = false;
      if (sealBtn) sealBtn.hidden = false;
    }
    return;
  }

  var sealActionsOff = document.getElementById("seal-gh-actions");
  if (sealActionsOff) sealActionsOff.hidden = true;

  var actions = ensureProfileGithub(who);
  var btn = document.getElementById("profile-github");
  if (!actions) return;
  var aside = document.getElementById("nt-player");
  var slug = aside ? (aside.getAttribute("data-person") || "") : who;
  if (slug && slug !== who) { actions.hidden = true; return; }
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
  var guestBtn = document.getElementById("seal-guest");
  if (form) form.hidden = false;
  if (guestBtn) guestBtn.hidden = false;
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
   Short seal phrases expand to 64 hex chars so enroll's length floor passes.
   Enrollment payload is stashed for Devin's dashboard path — never shown on seal UI. */
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
      /* Old key wrapped with a different passphrase: leave dashboard path intact. */
    });
  }

  /* No published key yet: derive + stash locally for Devin; nothing shown on seal. */
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
  GH_STATUS_TIMER = setTimeout(function () {
    var dest = profileHref(who);
    if (location.pathname.indexOf("/players/" + who) >= 0) {
      setGhStatus("");
      syncGithubUI(who);
    } else {
      location.href = dest;
    }
  }, 900);
}

function onGithubFailed(msg) {
  GH_CONNECTING = false;
  setGhStatus(msg || "GitHub connection failed.", "err");
  syncGithubUI(readSealWho());
}

applySeal();

/* Seal page: phrase sign-in, welcome + optional Connect, guest browse. */
if (document.body.classList.contains("seal-page")) {
  var form = document.getElementById("seal-form");
  var phraseInput = document.getElementById("seal-code");
  var guestBtn = document.getElementById("seal-guest");

  function readPhrase() {
    var raw = phraseInput ? phraseInput.value : "";
    if (form) {
      try { raw = new FormData(form).get("phrase") || raw; } catch (e) {}
    }
    return String(raw || "").trim().toLowerCase();
  }

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

  if (guestBtn) guestBtn.addEventListener("click", function (e) {
    e.preventDefault();
    sealClearErr();
    clearSealSession();
    clearMyKey();
    setGuest();
    location.href = indexHref();
  });

  var ghBtn = document.getElementById("seal-github");
  if (ghBtn) ghBtn.addEventListener("click", function (e) {
    e.preventDefault();
    var who = readSealWho();
    if (!who) { sealErr("Sign in with your phrase first."); return; }
    if (githubConnected()) {
      syncGithubUI(who);
      return;
    }
    goConnectGithub();
  });

  window.addEventListener("elorae-edit-session", function () {
    var who = readSealWho();
    if (!who) return;
    if (githubConnected()) {
      if (GH_CONNECTING) onGithubConnected(who);
      else syncGithubUI(who);
    } else if (GH_CONNECTING) {
      onGithubFailed("GitHub connection failed.");
    } else {
      syncGithubUI(who);
    }
  });

  window.addEventListener("hashchange", function () {
    if (!GH_CONNECTING) return;
    if (location.hash === "#edit") return;
    if (githubConnected()) return;
    onGithubFailed("GitHub connection cancelled.");
  });

  /* Already signed in on seal → Welcome (+ Connect if needed); guest/unsigned see phrase form. */
} else {
  /* Non-seal pages: GitHub connect on own profile + OAuth result handling. */
  var whoElse = readSealWho();
  if (whoElse) syncGithubUI(whoElse);

  window.addEventListener("elorae-edit-session", function () {
    var who = readSealWho();
    if (!who) return;
    if (githubConnected()) {
      if (GH_CONNECTING) onGithubConnected(who);
      else syncGithubUI(who);
    } else if (GH_CONNECTING) {
      onGithubFailed("GitHub connection failed.");
    } else {
      syncGithubUI(who);
    }
  });

  window.addEventListener("hashchange", function () {
    if (!GH_CONNECTING) return;
    if (location.hash === "#edit") return;
    if (githubConnected()) return;
    onGithubFailed("GitHub connection cancelled.");
  });
}

