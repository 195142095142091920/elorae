/* invite.js (inv1): player Invite on Devin's own player page (moved from the retired Dashboard).
   Only with Devin's admin edit session. Invites a GitHub username as a Write collaborator and
   binds profiles.json (placeholder -> real login). Lazy-loads edit/core.js. */
(function () {
  "use strict";
  var host = document.getElementById("nt-player");
  if (!host || host.getAttribute("data-person") !== "devin") return;
  var ROOT = new URL("../", document.currentScript.src).href;
  var st = { doc: null, busy: false, msg: "" }, box = null;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function sess() { try { return JSON.parse(localStorage.getItem("elorae-edit-session") || sessionStorage.getItem("elorae-edit-session") || "null"); } catch (e) { return null; } }
  function isAdmin() { var s = sess(); return !!(s && s.token && (s.role === "admin" || s.person === "devin")); }
  function loadCore() {
    if (window.EloraeEdit) return Promise.resolve(window.EloraeEdit);
    return new Promise(function (res, rej) { var sc = document.createElement("script"); sc.src = ROOT + "edit/core.js?v=edsave1"; sc.onload = function () { res(window.EloraeEdit); }; sc.onerror = rej; document.head.appendChild(sc); });
  }
  function json(o) { return JSON.stringify(o, null, 2) + "\n"; }
  function placeholder(k) { return typeof k === "string" && k.charAt(0) === "<" && k.charAt(k.length - 1) === ">"; }
  function rows() {
    var pr = (st.doc && st.doc.profiles) || {}, out = [];
    Object.keys(pr).forEach(function (k) {
      if (k.charAt(0) === "_" || k.indexOf("//") === 0) return;
      var p = pr[k]; if (!p || !p.person || p.person === "devin") return;
      out.push({ person: p.person, name: p.name || p.person, bound: placeholder(k) ? "" : k });
    });
    return out;
  }
  function render() {
    if (!isAdmin()) { if (box) { box.remove(); box = null; } return; }
    if (!box) {
      box = document.createElement("section"); box.id = "pl-invite"; box.className = "pl-invite";
      host.parentNode.insertBefore(box, host.nextSibling);
      var css = document.createElement("style");
      css.textContent = ".pl-invite{max-width:1040px;margin:48px auto 64px;padding:0 24px;font-family:\"Helvetica Neue\",Helvetica,Arial,sans-serif;color:#d8d2c8}" +
        ".pl-invite h2{font-size:calc(11px * var(--fs,1.5094));font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#f3eee6;margin:0 0 14px}" +
        ".pl-invite ul{list-style:none;margin:0;padding:0}.pl-invite li{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:8px 0;border-top:1px solid #1c1b19}" +
        ".pl-invite .n{min-width:110px;color:#f3eee6}.pl-invite .s{color:#8f8a82;font-size:.85em;min-width:110px}" +
        ".pl-invite input{background:#0b0b0a;border:1px solid #2a2926;color:#eee;padding:6px 8px;font:inherit;min-width:0;width:200px}" +
        ".pl-invite button{background:none;border:1px solid #3a3833;color:#f3eee6;padding:6px 12px;font:inherit;font-size:.8em;letter-spacing:.12em;text-transform:uppercase;cursor:pointer}" +
        ".pl-invite button:hover{border-color:#f3eee6}.pl-invite .m{color:#b9b2a6;font-size:.9em;margin:10px 0 0}";
      document.head.appendChild(css);
    }
    if (!st.doc) { box.innerHTML = '<h2>Invite players</h2><p class="m">Loading…</p>'; return; }
    box.innerHTML = '<h2>Invite players</h2><ul>' + rows().map(function (r) {
      return '<li data-person="' + esc(r.person) + '"><span class="n">' + esc(r.name) + '</span><span class="s">' + (r.bound ? "@" + esc(r.bound) : "not invited") + '</span>' +
        '<form class="ee-invite" data-invite="' + esc(r.person) + '" autocomplete="off"><input class="ee-invite-user" placeholder="GitHub username" value="' + esc(r.bound) + '" spellcheck="false" aria-label="GitHub username for ' + esc(r.name) + '"> ' +
        '<button type="submit"' + (st.busy ? " disabled" : "") + '>Invite</button></form></li>';
    }).join("") + '</ul>' + (st.msg ? '<p class="m" id="pl-invite-msg">' + esc(st.msg) + '</p>' : "");
    Array.prototype.forEach.call(box.querySelectorAll("form.ee-invite"), function (f) {
      f.onsubmit = function (e) { e.preventDefault(); invite(f.getAttribute("data-invite"), f.querySelector("input").value); };
    });
  }
  function run(label, fn) {
    if (st.busy) return; st.busy = true; st.msg = label + "…"; render();
    Promise.resolve().then(fn).then(function (m) { st.msg = m; }, function (e) { st.msg = (e && e.message) || "Failed."; })
      .then(function () { st.busy = false; render(); });
  }
  function invite(person, user) {
    user = String(user || "").trim().replace(/^@/, "");
    if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(user)) { st.msg = "Enter a valid GitHub username."; return render(); }
    run("Inviting @" + user, function () {
      return loadCore().then(function (E) {
        return E.api(E.repoPath("/collaborators/" + encodeURIComponent(user)), { method: "PUT", body: { permission: "push" } }).catch(function (err) {
          if (err && err.status === 404) throw new Error("GitHub user @" + user + " was not found.");
          if (err && err.status === 422) throw new Error("Could not invite @" + user + " (blocked or invalid).");
          if (err && err.status === 403) throw new Error("Your token can't manage collaborators. Needs admin on this repo.");
          throw err;
        }).then(function () { return E.getFile("edit/profiles.json"); }).then(function (f) {
          var doc = JSON.parse(f.text), pr = doc.profiles || {}, fk = null;
          Object.keys(pr).forEach(function (k) { if (pr[k] && pr[k].person === person && k.charAt(0) !== "_") fk = k; });
          if (!fk) throw new Error("No profile row for " + person + " in profiles.json.");
          if (fk === user) { st.doc = doc; return "Invited @" + user + " (Write). Already bound — invite refreshed."; }
          if (pr[user] && pr[user].person && pr[user].person !== person) throw new Error("@" + user + " is already bound to " + pr[user].person + ".");
          var v = pr[fk]; delete pr[fk]; pr[user] = v; doc.profiles = pr;
          var go = function () { return E.commitFiles([{ path: "edit/profiles.json", text: json(doc) }], "Profiles: bind " + person + " to @" + user + " via player-page invite [edit-mode]", E.BRANCH); };
          return (E.retrySave ? E.retrySave(go) : go()).then(function () { st.doc = doc; return "Invited @" + user + " (Write). Profile updated."; });
        });
      });
    });
  }
  function boot() {
    if (!isAdmin()) return render();
    render();
    loadCore().then(function (E) { return E.getFile("edit/profiles.json"); }).then(function (f) { st.doc = JSON.parse(f.text); render(); },
      function () { st.doc = { profiles: {} }; st.msg = "Couldn't load profiles."; render(); });
  }
  window.addEventListener("elorae-edit-session", boot);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
