/* Old plaintext map (replaced by SHA-256 hashes below): var PHRASE = {light:"jack",arcana:"jon",succor:"julie",vigor:"sawyer",fatalis:"devin"}; */
var PHRASE_HASH = {
  "99a7026172d42714d0293e5598ec1c8e8260d7d0c4b8582ad002c1883494e216":"jack",
  "25f67f02357a90b9e703068227e71c7acb44b967da68cb69f039ba975be72fd2":"jon",
  "7d0823c4ca0c0bfefdc14e67786e5c6b41d517a36a8b1cce9e0bbaf1448ce0e5":"julie",
  "340bbcf62fb5b430085a948675b2b76a33f7eb855f94b538a077973a96571c61":"sawyer",
  "0eedbe39d20f666a54f9fd82e2a7b8c7673ade3d1f86f530d68b56d3e6500740":"devin"
};
/* Player names shown on the login welcome after a successful phrase. */
var NAMES = {jack:"Jack",jon:"Jon",julie:"Julie",sawyer:"Sawyer",devin:"Devin"};
var LOGIN_PLAYERS = {jack:1,jon:1,julie:1,sawyer:1,devin:1};
var GUEST_KEY = "elorae-guest";
var PENDING_ENROLL_KEY = "elorae-enroll-pending";
var PHRASE_MEMORY_KEY = "elorae-login-phrase";

function readLoginWho() {
  try {
    var m = document.cookie.match(/(?:^|;\s*)elorae-login=([a-z]+)/);
    if (m && LOGIN_PLAYERS[m[1]]) return m[1];
  } catch (e) {}
  try {
    var m2 = document.cookie.match(/(?:^|;\s*)elorae-seal=([a-z]+)/);
    if (m2 && LOGIN_PLAYERS[m2[1]]) return m2[1];
  } catch (e) {}
  try {
    var w = localStorage.getItem("elorae-login") || localStorage.getItem("elorae-seal") || "";
    if (LOGIN_PLAYERS[w]) return w;
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
function setLoginSession(who) {
  if (!LOGIN_PLAYERS[who]) return;
  clearGuest();
  try { localStorage.setItem("elorae-login", who); } catch (e) {}
  try { localStorage.removeItem("elorae-seal"); } catch (e) {}
  try {
    document.cookie = "elorae-login=" + who + "; path=/; max-age=31536000; SameSite=Lax";
  } catch (e) {}
  try {
    document.cookie = "elorae-seal=; path=/; max-age=0; SameSite=Lax";
  } catch (e) {}
}
function clearLoginSession() {
  try { localStorage.removeItem("elorae-login"); } catch (e) {}
  try { localStorage.removeItem("elorae-seal"); } catch (e) {}
  try { document.cookie = "elorae-login=; path=/; max-age=0; SameSite=Lax"; } catch (e) {}
  try { document.cookie = "elorae-seal=; path=/; max-age=0; SameSite=Lax"; } catch (e) {}
}

/* Access gate backup: unsigned + non-guest → login. Guests skip restricted edit pages. */
(function () {
  try {
    if (document.body && document.body.classList.contains("login-page")) return;
    var path = location.pathname || "";
    if (/(^|\/)(login|seal)(\.html)?\/?$/i.test(path)) return;
    if (readLoginWho()) return;
    var restricted = /(^|\/)edit\/(secret|dashboard)(\.html)?\/?$/i.test(path);
    if (isGuest() && !restricted) return;
    var s = document.querySelector('script[src*="login.js"]');
    var loginUrl = s ? new URL("login/", s.src).href : "/login/";
    location.replace(loginUrl);
  } catch (e) {}
})();

function readRememberedPhrase() {
  try { return String(localStorage.getItem(PHRASE_MEMORY_KEY) || localStorage.getItem("elorae-seal-phrase") || ""); } catch (e) { return ""; }
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

function loginScriptBase() {
  var s = document.querySelector('script[src*="login.js"]');
  return s ? s.src : location.href;
}

function indexHref() {
  /* Guest / quiet leave: root Index entry (no login gate, no login prompt). */
  return new URL("index.html", loginScriptBase()).href;
}

function loginHref() {
  return new URL("login/", loginScriptBase()).href;
}

function ensureLogout() {
  var mark = document.querySelector(".mast .topbar > .mark") || document.querySelector(".mast .mark");
  if (!mark) return null;
  var btn = document.getElementById("login-logout");
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.id = "login-logout";
    btn.className = "login-logout";
    btn.textContent = "Log out";
    mark.appendChild(btn);
    btn.addEventListener("click", function () {
      clearLoginSession();
      clearGuest();
      clearMyKey();
      if (document.body.classList.contains("login-page")) {
        applyLogin();
        showSignedOutUI();
      } else {
        location.href = loginHref();
      }
    });
  }
  return btn;
}

/* Quiet leave-guest: reuse logout slot as "Enter" when browsing as guest. */
function ensureGuestExit() {
  var mark = document.querySelector(".mast .topbar > .mark") || document.querySelector(".mast .mark");
  if (!mark) return null;
  var btn = document.getElementById("login-guest-exit");
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.id = "login-guest-exit";
    btn.className = "login-logout login-guest-exit";
    btn.textContent = "Enter";
    mark.appendChild(btn);
    btn.addEventListener("click", function () {
      clearGuest();
      location.href = loginHref();
    });
  }
  return btn;
}

function applyLogin() {
  var who = readLoginWho();
  var guest = !who && isGuest();
  if (who) setLoginSession(who); /* keep cookie in sync with existing localStorage sessions */
  ["login-jack","login-jon","login-julie","login-sawyer","login-devin","login-guest"].forEach(function (c) {
    document.body.classList.remove(c);
  });
  if (who) document.body.classList.add("login-" + who);
  if (guest) document.body.classList.add("login-guest");

  var form = document.getElementById("login-form");
  var welcome = document.getElementById("login-welcome");
  var nameEl = document.getElementById("login-name");
  var guestBtn = document.getElementById("login-guest");
  var connect = document.getElementById("login-connect");
  var welcomeStage = document.getElementById("login-welcome-stage");
  if (form) form.hidden = !!who;
  if (guestBtn) guestBtn.hidden = !!who;
  if (connect && !GH_CONNECTING) {
    connect.hidden = true;
    connect.innerHTML = "";
  }
  if (welcomeStage && who && (!connect || connect.hidden)) welcomeStage.hidden = false;
  if (welcome) {
    if (who) {
      welcome.textContent = "Welcome";
      welcome.hidden = false;
    } else {
      welcome.hidden = true;
    }
  }
  if (nameEl) {
    if (who) {
      nameEl.textContent = NAMES[who] || who;
      nameEl.hidden = false;
    } else {
      nameEl.hidden = true;
      nameEl.textContent = "";
    }
  }
  if (!who) document.body.classList.remove("login-connecting");

  var logout = ensureLogout();
  if (logout) logout.hidden = who !== "devin";
  var gExit = ensureGuestExit();
  if (gExit) gExit.hidden = !guest || document.body.classList.contains("login-page");

  hideGithubUI();
  if (who && !guest) syncGithubUI(who);

  /* Guests must not see owner-gated article bodies; leave quietly if they hit one. */
  if (guest) {
    var privateMain = document.querySelector("main.art-body.private[data-owner], section.art-hero.private[data-owner]");
    if (privateMain) {
      location.replace(indexHref());
      return who;
    }
  }

  return who;
}

function loginErr(msg) {
  var err = document.getElementById("login-err");
  if (!err) return;
  err.textContent = msg || "Try again.";
  err.hidden = false;
}
function loginClearErr() {
  var err = document.getElementById("login-err");
  if (err) { err.hidden = true; err.textContent = "Try again."; }
}

function hideGithubUI() {
  var actions = document.getElementById("login-gh-actions");
  var status = document.getElementById("login-gh-status");
  var btn = document.getElementById("login-github");
  if (actions) actions.hidden = true;
  if (btn) btn.hidden = true;
  if (status) { status.hidden = true; status.textContent = ""; status.removeAttribute("data-kind"); }
  var prof = document.getElementById("profile-gh-actions");
  if (prof) prof.hidden = true;
  var pstat = document.getElementById("profile-gh-status");
  if (pstat) { pstat.hidden = true; pstat.textContent = ""; pstat.removeAttribute("data-kind"); }
}

function setGhStatus(msg, kind) {
  var status = document.body.classList.contains("login-page")
    ? (document.getElementById("login-gh-status") || document.getElementById("profile-gh-status"))
    : (document.getElementById("profile-gh-status") || document.getElementById("login-gh-status"));
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
    wrap.className = "login-actions profile-gh-actions";
    wrap.hidden = true;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "profile-github";
    btn.textContent = "Connect to GitHub";
    wrap.appendChild(btn);
    var status = document.createElement("p");
    status.className = "login-gh-status";
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
      var w = readLoginWho();
      if (!w) { location.href = loginHref(); return; }
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

  /* Login page: Connect only under Welcome after phrase enter (never on phrase/guest/connect). */
  if (document.body.classList.contains("login-page")) {
    var loginActions = document.getElementById("login-gh-actions");
    var loginBtn = document.getElementById("login-github");
    var welcome = document.getElementById("login-welcome");
    var form = document.getElementById("login-form");
    var connect = document.getElementById("login-connect");
    var welcomeStage = document.getElementById("login-welcome-stage");
    var prof = document.getElementById("profile-gh-actions");
    if (prof) prof.hidden = true;
    if (!loginActions) return;
    var connecting = !!(connect && !connect.hidden);
    var onWelcome = !!(who && welcome && !welcome.hidden && form && form.hidden && !connecting);
    if (welcomeStage && !connecting) welcomeStage.hidden = false;
    if (!onWelcome || githubConnected()) {
      loginActions.hidden = true;
      if (loginBtn) loginBtn.hidden = true;
    } else {
      loginActions.hidden = false;
      if (loginBtn) loginBtn.hidden = false;
    }
    return;
  }

  var loginActionsOff = document.getElementById("login-gh-actions");
  if (loginActionsOff) loginActionsOff.hidden = true;

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
  var form = document.getElementById("login-form");
  var welcome = document.getElementById("login-welcome");
  var nameEl = document.getElementById("login-name");
  var guestBtn = document.getElementById("login-guest");
  var connect = document.getElementById("login-connect");
  var welcomeStage = document.getElementById("login-welcome-stage");
  if (form) form.hidden = false;
  if (guestBtn) guestBtn.hidden = false;
  if (welcome) welcome.hidden = true;
  if (nameEl) { nameEl.hidden = true; nameEl.textContent = ""; }
  clearConnectBack();
  if (connect) { connect.hidden = true; connect.innerHTML = ""; }
  if (welcomeStage) {
    welcomeStage.hidden = false;
    welcomeStage.style.opacity = "";
    welcomeStage.classList.remove("login-stage-abs");
  }
  document.body.classList.remove("login-connecting");
  hideGithubUI();
  GH_CONNECTING = false;
  loginClearErr();
}

function personHasKey(man, who) {
  return !!(man && man.people && man.people[who] && man.people[who].key);
}

function stashPendingEnroll(rec) {
  try { localStorage.setItem(PENDING_ENROLL_KEY, JSON.stringify(rec)); } catch (e) {}
}

/* Phrase → phraseMaterial (domain-separated SHA-256 hex) → PBKDF2 enroll/unlock.
   Short login phrases expand to 64 hex chars so enroll's length floor passes.
   Enrollment payload is stashed for Devin's dashboard path — never shown on login UI. */
function withPhraseMaterial(phrase, fn) {
  var K = window.EloraeCrypto;
  if (!K || !K.phraseMaterial) return Promise.reject(new Error("Crypto is not loaded."));
  return K.phraseMaterial(phrase).then(fn);
}

function silentEnroll(who, phrase) {
  var K = window.EloraeCrypto, V = window.EloraeVis;
  return withPhraseMaterial(phrase, function (material) {
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
  return withPhraseMaterial(phrase, function (material) {
    return V.unlockAs(man, who, material);
  });
}

function afterIdentity(who, phrase, man) {
  var K = window.EloraeCrypto, V = window.EloraeVis;
  var hasKey = personHasKey(man, who);

  applyLogin();

  if (!K || !V) return Promise.resolve();

  if (hasKey) {
    return unlockWithPhrase(man, who, phrase).then(function () {
      /* unlocked */
    }, function () {
      /* Old key wrapped with a different passphrase: leave dashboard path intact. */
    });
  }

  /* No published key yet: derive + stash locally for Devin; nothing shown on login. */
  return silentEnroll(who, phrase).catch(function () {
    /* Identity still sticks; key can be retried later. */
  });
}

function loadManifest() {
  var V = window.EloraeVis;
  if (!V) return Promise.resolve(null);
  return V.manifest(false).catch(function () { return null; });
}

function escHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function profileForGh(doc, login) {
  if (!login) return null;
  var src = (doc && doc.profiles) || {};
  var key = String(login).toLowerCase();
  if (src[key] && typeof src[key] === "object") return src[key];
  var keys = Object.keys(src);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (k.charAt(0) === "_" || k.indexOf("//") === 0) continue;
    if (k.toLowerCase() === key && src[k] && typeof src[k] === "object") return src[k];
  }
  return null;
}

function loginStageCrossfade(fromEl, toEl, done) {
  if (!toEl) { if (done) done(); return; }
  var ms = 420;
  toEl.hidden = false;
  toEl.style.opacity = "0";
  if (fromEl) {
    fromEl.classList.add("login-stage-abs");
    toEl.classList.add("login-stage-abs");
    fromEl.style.opacity = "1";
  }
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      if (fromEl) fromEl.style.opacity = "0";
      toEl.style.opacity = "1";
      setTimeout(function () {
        if (fromEl) {
          fromEl.hidden = true;
          fromEl.style.opacity = "";
          fromEl.classList.remove("login-stage-abs");
        }
        toEl.style.opacity = "";
        toEl.classList.remove("login-stage-abs");
        if (done) done();
      }, ms);
    });
  });
}

function setConnectErr(msg) {
  var err = document.getElementById("login-connect-err");
  if (!err) return;
  if (!msg) { err.hidden = true; err.textContent = ""; return; }
  err.textContent = msg;
  err.hidden = false;
}


function clearConnectBack() {
  var back = document.getElementById("login-connect-back");
  if (back) back.remove();
}

function pinConnectBack() {
  var back = document.getElementById("login-connect-back");
  var box = document.querySelector("body.login-page .login-box");
  if (!back || !box) return;
  box.appendChild(back);
}

function renderLoginConnect() {
  var box = document.getElementById("login-connect");
  var E = window.EloraeEdit;
  if (!box || !E) return false;
  var L = E.TOKEN_LINKS || {};
  box.innerHTML =
    '<div class="login-connect-hero">' +
    '<a class="login-connect-btn login-connect-primary" id="login-mint" href="' + escHtml(L.classic || "#") + '" target="_blank" rel="noopener">Connect</a>' +
    '<p class="login-connect-hint">Opens GitHub with public_repo filled in. Generate a key, then copy it here.</p>' +
    '</div>' +
    '<form id="login-connect-form" class="login-connect-form" autocomplete="off">' +
    '<input id="login-connect-token" type="password" placeholder="ghp_…" spellcheck="false" autocomplete="off" aria-label="GitHub token">' +
    '<div class="login-actions" id="login-connect-enter-actions" hidden><button type="submit" class="login-connect-submit">Enter</button></div>' +
    '<p class="login-err" id="login-connect-err" hidden></p></form>' +
    '<button type="button" class="login-connect-back" id="login-connect-back">Back</button>';
  function syncConnectEnter() {
    var actions = document.getElementById("login-connect-enter-actions");
    var input = document.getElementById("login-connect-token");
    if (!actions) return;
    var has = !!(input && String(input.value || "").replace(/\s+/g, ""));
    if (has) actions.removeAttribute("hidden");
    else actions.setAttribute("hidden", "");
  }
  var form = document.getElementById("login-connect-form");
  if (form) form.addEventListener("submit", function (e) {
    e.preventDefault();
    submitLoginConnect();
  });
  var tokenInput = document.getElementById("login-connect-token");
  if (tokenInput) {
    syncConnectEnter();
    tokenInput.addEventListener("input", syncConnectEnter);
    tokenInput.addEventListener("change", syncConnectEnter);
  }
  var back = document.getElementById("login-connect-back");
  if (back) back.addEventListener("click", function (e) {
    e.preventDefault();
    leaveLoginConnect();
  });
  pinConnectBack();
  return true;
}

function leaveLoginConnect() {
  GH_CONNECTING = false;
  var welcomeStage = document.getElementById("login-welcome-stage");
  var connect = document.getElementById("login-connect");
  document.body.classList.remove("login-connecting");
  loginStageCrossfade(connect, welcomeStage, function () {
    clearConnectBack();
    if (connect) { connect.innerHTML = ""; connect.hidden = true; }
    syncGithubUI(readLoginWho());
  });
}

function submitLoginConnect() {
  var E = window.EloraeEdit;
  var input = document.getElementById("login-connect-token");
  if (!E) { setConnectErr("GitHub helpers are not loaded."); return; }
  var token = String((input && input.value) || "").replace(/\s+/g, "");
  if (!token) { setConnectErr("Paste your token."); return; }
  var kind = E.tokenKind(token);
  if (kind === "unknown") {
    setConnectErr("That doesn't look like a GitHub token. It should start with ghp_ or github_pat_.");
    return;
  }
  var remember = true;
  var login, warn = "";
  setConnectErr("Checking…");
  E.api("/user", { token: token, withHeaders: true }).then(function (r) {
    login = r.data.login;
    var scopes = (r.scopes || "").split(/\s*,\s*/).filter(Boolean);
    if (kind === "classic" && scopes.indexOf("repo") >= 0) {
      warn = "This token can write to all your repositories. A token with only public_repo is enough.";
    }
    if (kind === "classic" && scopes.indexOf("repo") < 0 && scopes.indexOf("public_repo") < 0) {
      throw new Error("This token is missing the public_repo permission. Make a new one with public_repo.");
    }
    return E.api(E.repoPath(""), { token: token }).catch(function (err) {
      if (err.status === 404 || err.status === 403) {
        throw new Error(kind === "fine-grained"
          ? "GitHub doesn't let fine-grained tokens edit a repository owned by another person. Use a classic token with public_repo."
          : "This token can't reach " + E.REPO + ".");
      }
      throw err;
    });
  }).then(function (repo) {
    if (!repo.permissions || !repo.permissions.push) {
      throw new Error(kind === "fine-grained"
        ? "This fine-grained token can't write here. Use a classic public_repo token."
        : "@" + login + " isn't a collaborator on the site yet. Accept the invitation, then enter again.");
    }
    return E.api(E.repoPath("/contents/edit/profiles.json?ref=" + E.BRANCH), { token: token });
  }).then(function (d) {
    var raw = E.b64DecodeUtf8(d.content);
    var doc = JSON.parse(raw);
    var pr = profileForGh(doc, login);
    if (!pr) throw new Error("Connected to GitHub as @" + login + ", but there's no edit profile for you yet. Ask Devin to add @" + login + ".");
    E.session.set({
      token: token, login: login, remember: remember,
      person: pr.person || "", role: pr.role || "", kind: kind, warn: warn,
      since: new Date().toISOString()
    });
    try { window.dispatchEvent(new Event("elorae-edit-session")); } catch (e) {}
  }).catch(function (err) {
    setConnectErr(err.status === 401
      ? "GitHub didn't accept that token. It may be mistyped, expired or deleted."
      : (err.message || "Enter failed."));
  });
}

function goConnectGithub() {
  loginClearErr();
  GH_CONNECTING = true;
  /* Login page: fade Welcome → Connect inside the same box (no #edit popup). */
  if (document.body.classList.contains("login-page")) {
    setGhStatus("");
    document.body.classList.add("login-connecting");
    if (!renderLoginConnect()) {
      GH_CONNECTING = false;
      document.body.classList.remove("login-connecting");
      setGhStatus("GitHub helpers are not loaded.", "err");
      return;
    }
    var welcomeStage = document.getElementById("login-welcome-stage");
    var connect = document.getElementById("login-connect");
    loginStageCrossfade(welcomeStage, connect, function () {
      var t = document.getElementById("login-connect-token");
      if (t) try { t.focus(); } catch (e) {}
    });
    return;
  }
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
  document.body.classList.remove("login-connecting");
  var connect = document.getElementById("login-connect");
  var welcomeStage = document.getElementById("login-welcome-stage");
  if (connect && !connect.hidden) {
    clearConnectBack();
    connect.hidden = true;
    connect.innerHTML = "";
  }
  if (welcomeStage) welcomeStage.hidden = false;
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
  syncGithubUI(readLoginWho());
}

applyLogin();

/* Login page: phrase enter, welcome + optional Connect (in-box), guest browse. */
if (document.body.classList.contains("login-page")) {
  var form = document.getElementById("login-form");
  var phraseInput = document.getElementById("login-code");
  var guestBtn = document.getElementById("login-guest");

  function readPhrase() {
    var raw = phraseInput ? phraseInput.value : "";
    if (form) {
      try { raw = new FormData(form).get("phrase") || raw; } catch (e) {}
    }
    return String(raw || "").trim().toLowerCase();
  }

  function syncEnterVisibility() {
    var actions = document.getElementById("login-enter-actions");
    if (!actions) return;
    var has = !!(phraseInput && String(phraseInput.value || "").trim());
    if (has) actions.removeAttribute("hidden");
    else actions.setAttribute("hidden", "");
  }

  if (phraseInput) {
    var remembered = readRememberedPhrase();
    if (remembered && !phraseInput.value) phraseInput.value = remembered;
    syncEnterVisibility();
    phraseInput.addEventListener("input", syncEnterVisibility);
    phraseInput.addEventListener("change", function () { rememberPhrase(readPhrase()); syncEnterVisibility(); });
    phraseInput.addEventListener("blur", function () { rememberPhrase(readPhrase()); syncEnterVisibility(); });
  }

  function signIn(e) {
    if (e) e.preventDefault();
    loginClearErr();
    setGhStatus("");
    var key = readPhrase();
    if (!key) { loginErr("Enter your phrase."); return; }
    rememberPhrase(key);
    hashPhrase(key).then(function (digest) {
      var who = PHRASE_HASH[digest];
      if (!who) { loginErr("Try again."); return; }
      setLoginSession(who);
      return loadManifest().then(function (man) {
        return afterIdentity(who, key, man);
      });
    }).catch(function () {
      loginErr("Try again.");
    });
  }

  if (form) form.addEventListener("submit", signIn);

  if (guestBtn) guestBtn.addEventListener("click", function (e) {
    e.preventDefault();
    loginClearErr();
    clearLoginSession();
    clearMyKey();
    setGuest();
    location.href = indexHref();
  });

  var ghBtn = document.getElementById("login-github");
  if (ghBtn) ghBtn.addEventListener("click", function (e) {
    e.preventDefault();
    var who = readLoginWho();
    if (!who) { loginErr("Enter with your phrase first."); return; }
    if (githubConnected()) {
      syncGithubUI(who);
      return;
    }
    goConnectGithub();
  });

  window.addEventListener("elorae-edit-session", function () {
    var who = readLoginWho();
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

  /* In-box Connect: no #edit popup, so hash cancel does not apply on the login page. */

  /* Already entered on login → Welcome (+ Connect if needed); guest/unsigned see phrase form. */
} else {
  /* Non-login pages: GitHub connect on own profile + OAuth result handling. */
  var whoElse = readLoginWho();
  if (whoElse) syncGithubUI(whoElse);

  window.addEventListener("elorae-edit-session", function () {
    var who = readLoginWho();
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

