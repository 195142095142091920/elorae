/* Devin's dashboard: who can see each secret, with one-click sharing.
   Every change is one atomic commit (visibility.json + re-wrapped keys / re-encrypted
   payload) to main with Devin's own token, message tagged [edit-mode]. */
(function () {
  "use strict";
  var E = window.EloraeEdit, P = window.EloraeEditPerms, K = window.EloraeCrypto, V = window.EloraeVis, Media = window.EloraeMedia;
  var main = document.getElementById("ee-dash-main");
  var st = { man: null, profile: null, priv: null, busy: false, msg: "", catalog: null, profilesDoc: null };
  var ME = "devin";

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function nameOf(p) { return (st.man.people[p] || {}).name || p; }
  function json(o) { var c = JSON.parse(JSON.stringify(o)); delete c.__sha; return JSON.stringify(c, null, 2) + "\n"; }

  function clearDashState() {
    // Drop session-bound dashboard data. Do NOT touch V.myKey (unlocked secrets key stays).
    st.man = null;
    st.profile = null;
    st.priv = null;
    st.catalog = null;
    st.profilesDoc = null;
    st.busy = false;
    st.msg = "";
  }

  function showSignedOut() {
    clearDashState();
    main.innerHTML = '<p class="ee-note">Sign in with your GitHub token to use the dashboard.</p><div class="ee-row"><button class="ee-btn ee-primary" id="ee-in">Sign in</button></div>';
    var btn = $("ee-in");
    if (btn) btn.onclick = function () { window.EloraeEditor.openPanel(); };
  }

  function gate() {
    var s = E.session.get();
    if (!s) {
      showSignedOut();
      return Promise.resolve(false);
    }
    return E.getFile("edit/profiles.json").then(function (f) {
      st.profile = P.profileFor(JSON.parse(f.text), s.login);
      if (!P.isAdmin(st.profile)) {
        clearDashState();
        main.innerHTML = '<p class="ee-note">The dashboard is only for admins.</p><div class="ee-row"><button class="ee-btn ee-primary" id="ee-in">Sign in</button></div>';
        var btn = $("ee-in");
        if (btn) btn.onclick = function () { window.EloraeEditor.openPanel(); };
        return false;
      }
      ME = st.profile.person || "devin";
      return true;
    });
  }

  // Activate (or re-activate) without a full page reload so the sign-in success
  // panel stays up and the dashboard is live on this same page immediately.
  // If boot is requested while one is in flight, queue a follow-up (e.g. sign-out
  // mid-load, then sign-in again).
  var booting = false, bootQueued = false;
  function boot() {
    if (booting) { bootQueued = true; return; }
    booting = true; bootQueued = false;
    gate().then(function (ok) {
      if (!ok) return;
      return load().then(function () {
        st.priv = null;
        var mine = V.myKey.get();
        if (mine && mine.person === ME) {
          return V.myKey.privateKey().then(function (k) { st.priv = k; }, function () { st.priv = null; });
        }
      }).then(render);
    }).catch(function (err) {
      main.innerHTML = '<p class="ee-err">' + esc(err.message || "Could not load the dashboard.") + '</p>';
    }).then(function () {
      booting = false;
      if (bootQueued) { bootQueued = false; boot(); }
    });
  }

  function load() {
    return V.manifest(true).then(function (m) { st.man = m; }).then(function () {
      return E.getFile("edit/profiles.json").then(function (f) {
        st.profilesDoc = JSON.parse(f.text); st.profilesDoc.__sha = f.sha;
      });
    }).then(function () {
      return E.getFile(Media.CATALOG).then(function (f) {
        st.catalog = JSON.parse(f.text); st.catalog.__sha = f.sha;
      }, function () {
        st.catalog = { version: 1, media: {} };
      });
    });
  }

  // Find profiles.json key + value for a person slug (sawyer/jon/…).
  function profileEntry(person) {
    var profiles = (st.profilesDoc && st.profilesDoc.profiles) || {};
    var keys = Object.keys(profiles);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k.charAt(0) === "_" || k.indexOf("//") === 0) continue;
      var pr = profiles[k];
      if (pr && pr.person === person) return { key: k, profile: pr };
    }
    return null;
  }
  function isPlaceholderLogin(k) {
    return typeof k === "string" && k.charAt(0) === "<" && k.charAt(k.length - 1) === ">";
  }

  function commit(files, message) {
    return E.commitFiles(files, message + " [edit-mode]", E.BRANCH).catch(function (err) {
      if (err.status === 422 || err.status === 409) { var e = new Error("Someone else just changed the site. Reloaded the latest; please try again."); e.reload = true; throw e; }
      throw err;
    });
  }

  function run(label, fn) {
    if (st.busy) return;
    st.busy = true; st.msg = label + "…"; render();
    Promise.resolve().then(fn).then(function (done) {
      st.msg = (done || "Saved") + ". Live in about 1–2 minutes.";
    }, function (err) {
      st.msg = err.message || "Failed.";
      if (err.reload) return load();
    }).then(function () { st.busy = false; render(); });
  }

  /* ---- key ---- */
  function myRecord() { return st.man.people[ME] && st.man.people[ME].key; }
  function ensureUnlocked() {
    if (st.priv) return Promise.resolve(st.priv);
    throw new Error("Unlock your key first.");
  }

  /* ---- operations ---- */
  function wrapAll(sec, raw) {
    var keys = {};
    var list = V.allowedList(sec).filter(function (p) { return st.man.people[p] && st.man.people[p].key; });
    return Promise.all(list.map(function (p) {
      return K.wrapFor(st.man.people[p].key, raw).then(function (w) { keys[p] = w; });
    })).then(function () { return keys; });
  }
  // Re-encrypt with a fresh key (used whenever someone loses access).
  function rotate(id, sec, payload) {
    var raw = K.newContentKey();
    sec.epoch = (sec.epoch || 0) + 1;
    return K.encryptSecret(id, sec.epoch, raw, payload).then(function (file) {
      return wrapAll(sec, raw).then(function (keys) {
        sec.keys = keys;
        sec.openKey = sec.everyone ? K.b64(raw) : null;
        return file;
      });
    });
  }
  function currentPayload(id, sec) {
    return ensureUnlocked().then(function (priv) {
      return V.contentKey(st.man, id, ME, priv);
    }).then(function (raw) {
      if (!raw) throw new Error("Your key can't open " + sec.title + ".");
      return V.secretFile(id, true).then(function (f) { return K.decryptSecret(f, raw).then(function (p) { return { raw: raw, payload: p }; }); });
    });
  }

  function toggle(id, who, on) {
    run((on ? "Sharing " : "Hiding ") + st.man.secrets[id].title, function () {
      var man = JSON.parse(JSON.stringify(st.man)), sec = man.secrets[id];
      var prev = st.man;
      st.man = man; // so helpers see the edited copy
      return currentPayload(id, sec).then(function (cur) {
        var files = [];
        if (who === "everyone") {
          sec.everyone = on;
          if (on) { sec.openKey = K.b64(cur.raw); return files; }
          return rotate(id, sec, cur.payload).then(function (f) { files.push({ path: "edit/secrets/" + id + ".json", text: JSON.stringify(f) + "\n" }); return files; });
        }
        var a = V.allowedList(sec);
        if (on) {
          if (a.indexOf(who) < 0) a.push(who);
          sec.allowed = a;
          return K.wrapFor(man.people[who].key, cur.raw).then(function (w) { sec.keys[who] = w; return files; });
        }
        sec.allowed = a.filter(function (p) { return p !== who || p === "devin"; });
        return rotate(id, sec, cur.payload).then(function (f) { files.push({ path: "edit/secrets/" + id + ".json", text: JSON.stringify(f) + "\n" }); return files; });
      }).then(function (files) {
        files.unshift({ path: "edit/visibility.json", text: json(man) });
        return commit(files, "Visibility: " + (on ? "show " : "hide ") + id + (who === "everyone" ? " for everyone" : " for " + who) + " via dashboard");
      }).then(function () { return "Saved"; }, function (e) { st.man = prev; throw e; });
    });
  }

  function inlineImages(html, path) {
    var base = E.ROOT + path;
    var re = /(<img\b[^>]*?\s(?:src|data-src)=")([^"]+)(")|(\sdata-src=")([^"]+\.(?:png|jpe?g|gif|webp|avif))(")/gi;
    var urls = {};
    html.replace(re, function (m, a, u1, c, d, u2) { var u = u1 || u2; if (!/^data:/.test(u)) urls[u] = 1; return m; });
    return Promise.all(Object.keys(urls).map(function (u) {
      return fetch(new URL(u.replace(/&amp;/g, "&"), base).href).then(function (r) {
        if (!r.ok) throw new Error("Image missing: " + u);
        return r.blob();
      }).then(function (b) {
        return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.readAsDataURL(b); });
      }).then(function (d) { urls[u] = d; });
    })).then(function () {
      return html.replace(re, function (m, a, u1, c, d, u2, f) {
        if (u1) return a + (urls[u1] || u1) + c;
        return d + (urls[u2] || u2) + f;
      });
    });
  }

  function encrypt(id) {
    run("Encrypting " + st.man.secrets[id].title, function () {
      ensureUnlocked();
      var man = JSON.parse(JSON.stringify(st.man)), sec = man.secrets[id];
      return E.getFile(sec.path).then(function (f) {
        return inlineImages(f.text, sec.path);
      }).then(function (html) {
        var prev = st.man; st.man = man;
        sec.status = "encrypted"; sec.epoch = 0; sec.everyone = false;
        return rotate(id, sec, { v: 1, path: sec.path, title: sec.title, html: html }).then(function (file) {
          st.man = prev;
          return commit([
            { path: "edit/visibility.json", text: json(man) },
            { path: "edit/secrets/" + id + ".json", text: JSON.stringify(file) + "\n" }
          ], "Visibility: encrypt " + id + " via dashboard");
        }, function (e) { st.man = prev; throw e; });
      }).then(function () { st.man = man; return "Encrypted (the plaintext page is still public until it is removed)"; });
    });
  }

  function addPerson(rec) {
    run("Adding " + rec.person + "'s key", function () {
      var man = JSON.parse(JSON.stringify(st.man));
      if (!man.people[rec.person]) throw new Error("Unknown person: " + rec.person);
      if (!rec.publicKey || !rec.privateKey || rec.alg !== "RSA-OAEP-3072-SHA256") throw new Error("That isn't an enrollment code.");
      man.people[rec.person].key = rec;
      var files = [];
      // Re-wrap any secrets already shared with them (their old key, if any, is replaced).
      var ids = Object.keys(man.secrets).filter(function (id) {
        var s = man.secrets[id]; return s.status === "encrypted" && V.allowedList(s).indexOf(rec.person) >= 0;
      });
      var chain = Promise.resolve();
      ids.forEach(function (id) {
        chain = chain.then(function () {
          return V.contentKey(st.man, id, ME, st.priv).then(function (raw) {
            if (!raw) return;
            return K.wrapFor(rec, raw).then(function (w) { man.secrets[id].keys[rec.person] = w; });
          });
        });
      });
      return (ids.length ? ensureUnlocked().then(function () { return chain; }) : chain).then(function () {
        files.push({ path: "edit/visibility.json", text: json(man) });
        return commit(files, "Visibility: set key for " + rec.person + " via dashboard");
      }).then(function () { st.man = man; return "Key saved for " + nameOf(rec.person); });
    });
  }


  function mediaSection() {
    if (!st.catalog) return '';
    var rows = Media.listVisible(st.catalog, ME, true).map(function (m) {
      var boxes = '<label class="ee-tog"><input type="checkbox" data-media="' + esc(m.id) + '" data-who="everyone"' + (m.everyone ? " checked" : "") + (st.busy ? " disabled" : "") + '> Everyone</label>' +
        Media.PEOPLE.filter(function (p) { return p !== "devin"; }).map(function (p) {
          var on = m.everyone || (m.allowed || []).indexOf(p) >= 0;
          return '<label class="ee-tog"><input type="checkbox" data-media="' + esc(m.id) + '" data-who="' + esc(p) + '"' + (on ? " checked" : "") + (m.everyone || st.busy ? " disabled" : "") + '> ' + esc(nameOf(p)) + '</label>';
        }).join("");
      return '<tr data-media-row="' + esc(m.id) + '"><td class="ee-t"><a href="../' + esc(m.path) + '" target="_blank" rel="noopener">' + esc(m.title) + '</a><span class="ee-sub">' + esc(m.path) + (m.tags && m.tags.length ? " · " + esc(m.tags.join(", ")) : "") + '</span></td><td>' + esc(nameOf(m.owner)) + '</td><td class="ee-togs">' + boxes + '</td></tr>';
    }).join("");
    return '<section class="ee-sec"><h2>Media</h2>' +
      '<p class="ee-note">Shared art catalog. Upload goes to <code>assets/</code> and <code>edit/media/catalog.json</code>. Visibility only gates the editor gallery — files under assets/ stay public URLs on Pages.</p>' +
      '<form id="ee-media-up" class="ee-media-up">' +
      '<input type="file" id="ee-media-file" accept="image/png,image/jpeg,image/webp,image/gif">' +
      '<input type="text" id="ee-media-title" placeholder="Title" autocomplete="off">' +
      '<input type="text" id="ee-media-tags" placeholder="Tags (comma-separated)" autocomplete="off">' +
      '<label class="ee-check"><input type="checkbox" id="ee-media-everyone"> Everyone can use in the editor</label>' +
      '<div class="ee-row"><button class="ee-btn ee-primary" type="submit"' + (st.busy ? " disabled" : "") + '>Upload</button></div></form>' +
      '<div class="ee-scroll"><table class="ee-table"><thead><tr><th>Title</th><th>Owner</th><th>Can see (editor)</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="3" class="ee-note">No uploads yet.</td></tr>') + '</tbody></table></div></section>';
  }

  /* ---- render ---- */
  function render() {
    // After sign-out (or before first load) there is no session data — show gate UI, don't crash.
    if (!E.session.get() || !st.man) {
      if (!E.session.get()) showSignedOut();
      else gate(); // session present but man not loaded yet / non-admin path
      return;
    }
    var man = st.man, rec = myRecord();
    var people = Object.keys(man.people);
    var keyBox = !rec
      ? '<form id="ee-enroll" autocomplete="off"><p class="ee-note">Create your secrets key. Every secret is always shared with you.</p>' +
        '<input type="password" id="ee-p1" placeholder="New passphrase" autocomplete="new-password"><input type="password" id="ee-p2" placeholder="Repeat passphrase" autocomplete="new-password">' +
        '<div class="ee-row"><button class="ee-btn ee-primary" type="submit">Create key</button></div></form>'
      : st.priv ? '<p class="ee-note">Your key is unlocked for this session.</p>'
      : '<form id="ee-unlock" autocomplete="off"><input type="password" id="ee-pass" placeholder="Passphrase" autocomplete="current-password"><div class="ee-row"><button class="ee-btn ee-primary" type="submit">Unlock</button></div></form>';
    var rows = Object.keys(man.secrets).map(function (id) {
      var s = man.secrets[id], enc = s.status === "encrypted";
      var allowed = V.allowedList(s);
      var sees = !enc ? "Anyone (not encrypted yet; hidden only by CSS)" : s.everyone ? "Everyone" : allowed.map(nameOf).join(", ");
      var dis = (!enc || !st.priv || st.busy) ? " disabled" : "";
      var boxes = '<label class="ee-tog"><input type="checkbox" data-id="' + esc(id) + '" data-who="everyone"' + (s.everyone ? " checked" : "") + dis + '> Everyone</label>' +
        people.map(function (p) {
          var locked = p === "devin";
          var noKey = !(man.people[p] && man.people[p].key);
          var on = allowed.indexOf(p) >= 0;
          return '<label class="ee-tog' + (noKey ? " ee-nokey" : "") + '" title="' + (noKey ? "No key yet" : "") + '"><input type="checkbox" data-id="' + esc(id) + '" data-who="' + esc(p) + '"' + (on ? " checked" : "") + ((locked || noKey) ? " disabled" : dis) + '> ' + esc(nameOf(p)) + '</label>';
        }).join("");
      var title = enc ? '<a href="secret.html?id=' + encodeURIComponent(id) + '">' + esc(s.title) + '</a>' : '<a href="../' + esc(s.path) + '">' + esc(s.title) + '</a>';
      return '<tr data-row="' + esc(id) + '"><td class="ee-t">' + title + '<span class="ee-sub">' + (enc ? "Encrypted" : "Plaintext") + '</span></td>' +
        '<td>' + esc(nameOf(s.owner)) + '</td><td class="ee-sees">' + esc(sees) + '</td><td class="ee-togs">' +
        (enc ? boxes : '<button class="ee-btn" data-encrypt="' + esc(id) + '"' + ((st.priv && !st.busy) ? "" : " disabled") + '>Encrypt</button>') + '</td></tr>';
    }).join("");
    var ppl = people.map(function (p) {
      var keyNote = man.people[p].key ? "key set" : "no key yet";
      if (p === "devin") {
        return '<li class="ee-person" data-person="devin"><span class="ee-person-name">' + esc(nameOf(p)) + '</span> <span class="ee-sub">admin · ' + keyNote + '</span></li>';
      }
      var ent = profileEntry(p);
      var bound = ent && !isPlaceholderLogin(ent.key) ? ent.key : "";
      var boundHtml = bound
        ? '<span class="ee-sub ee-bound">@' + esc(bound) + '</span>'
        : '<span class="ee-sub">not invited</span>';
      return '<li class="ee-person" data-person="' + esc(p) + '">' +
        '<div class="ee-person-head"><span class="ee-person-name">' + esc(nameOf(p)) + '</span> <span class="ee-sub">' + keyNote + '</span> ' + boundHtml + '</div>' +
        '<form class="ee-invite" data-invite="' + esc(p) + '" autocomplete="off">' +
        '<input type="text" class="ee-invite-user" name="username" placeholder="GitHub username" value="' + esc(bound) + '" spellcheck="false" autocomplete="off" aria-label="GitHub username for ' + esc(nameOf(p)) + '">' +
        '<button type="submit" class="ee-btn ee-primary"' + (st.busy ? " disabled" : "") + '>Invite</button></form></li>';
    }).join("");
    main.innerHTML =
      '<section class="ee-sec"><h2>Your key</h2>' + keyBox + '</section>' +
      (st.msg ? '<p class="ee-status" id="ee-msg">' + esc(st.msg) + '</p>' : '') +
      '<section class="ee-sec"><h2>Secrets</h2><div class="ee-scroll"><table class="ee-table"><thead><tr><th>Title</th><th>Owner</th><th>Can see</th><th>Share</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>' +
      mediaSection() +
      '<section class="ee-sec"><h2>People</h2><ul class="ee-people">' + ppl + '</ul>' +
      '<p class="ee-note">Invite each player with their GitHub username (Write access + bind <code>profiles.json</code>). Then they make a key at <a href="secret.html?enroll">secret.html?enroll</a> and send you the code. Paste it here.</p>' +
      '<form id="ee-add"><textarea class="ee-code" id="ee-addcode" placeholder="Enrollment code"></textarea><div class="ee-row"><button class="ee-btn ee-primary" type="submit"' + (st.busy ? " disabled" : "") + '>Add key</button></div></form></section>';
    bind();
  }

  function bind() {
    var en = $("ee-enroll");
    if (en) en.onsubmit = function (e) {
      e.preventDefault();
      if ($("ee-p1").value !== $("ee-p2").value) { st.msg = "The passphrases don't match."; return render(); }
      var pass = $("ee-p1").value;
      run("Creating your key", function () {
        return K.enroll(ME, pass).then(function (rec) {
          return K.unlock(rec, pass).then(function (priv) {
            st.priv = priv;
            return K.exportPrivate(priv).then(function (jwk) { V.myKey.set(ME, jwk); });
          }).then(function () {
            var man = JSON.parse(JSON.stringify(st.man));
            man.people[ME].key = rec;
            return commit([{ path: "edit/visibility.json", text: json(man) }], "Visibility: set key for " + ME + " via dashboard").then(function () { st.man = man; return "Key created"; });
          });
        });
      });
    };
    var un = $("ee-unlock");
    if (un) un.onsubmit = function (e) {
      e.preventDefault();
      run("Unlocking", function () {
        return V.unlockAs(st.man, ME, $("ee-pass").value).then(function (priv) { st.priv = priv; return "Unlocked"; });
      });
    };
    Array.prototype.forEach.call(main.querySelectorAll("input[data-id][data-who]"), function (cb) {
      cb.onchange = function () { toggle(cb.getAttribute("data-id"), cb.getAttribute("data-who"), cb.checked); };
    });
    Array.prototype.forEach.call(main.querySelectorAll("[data-encrypt]"), function (b) {
      b.onclick = function () { encrypt(b.getAttribute("data-encrypt")); };
    });
    var add = $("ee-add");
    if (add) add.onsubmit = function (e) {
      e.preventDefault();
      var rec;
      try { rec = JSON.parse($("ee-addcode").value.trim()); } catch (x) { st.msg = "That isn't an enrollment code."; return render(); }
      addPerson(rec);
    };
    var up = $("ee-media-up");
    if (up) up.onsubmit = function (e) {
      e.preventDefault();
      var fileEl = $("ee-media-file");
      var file = fileEl && fileEl.files && fileEl.files[0];
      var title = ($("ee-media-title") || {}).value || "";
      var tags = (($("ee-media-tags") || {}).value || "").split(",").map(function (t) { return t.trim(); }).filter(Boolean);
      var everyone = !!($("ee-media-everyone") && $("ee-media-everyone").checked);
      run("Uploading", function () {
        return Media.validateFile(file).then(function (info) {
          var prep = Media.prepareUpload(st.catalog, info, {
            title: title.trim() || info.name, tags: tags, owner: ME, uploadedBy: ME,
            everyone: everyone, allowed: everyone ? Media.PEOPLE.slice() : [ME, "devin"]
          });
          return commit(prep.files, "Media: upload " + prep.id + " via dashboard").then(function () {
            st.catalog = prep.catalog;
            return "Uploaded " + prep.entry.title;
          });
        });
      });
    };
    Array.prototype.forEach.call(main.querySelectorAll("input[data-media][data-who]"), function (inp) {
      inp.onchange = function () {
        var id = inp.getAttribute("data-media"), who = inp.getAttribute("data-who");
        run("Updating " + id, function () {
          var entry = st.catalog.media[id], patch = {};
          if (who === "everyone") patch.everyone = inp.checked;
          else {
            var a = (entry.allowed || []).slice();
            if (inp.checked && a.indexOf(who) < 0) a.push(who);
            if (!inp.checked) a = a.filter(function (p) { return p !== who; });
            patch.allowed = a;
            if (!inp.checked) patch.everyone = false;
          }
          var next = Media.setVisibility(st.catalog, id, patch);
          return commit([{ path: Media.CATALOG, text: json(next) }], "Media: visibility " + id + " via dashboard").then(function () {
            st.catalog = next;
            return "Saved";
          });
        });
      };
    });
    Array.prototype.forEach.call(main.querySelectorAll("form.ee-invite"), function (form) {
      form.onsubmit = function (e) {
        e.preventDefault();
        var person = form.getAttribute("data-invite");
        var user = ((form.querySelector(".ee-invite-user") || {}).value || "").trim();
        invitePlayer(person, user);
      };
    });
  }

  // Invite username as Write collaborator and bind profiles.json placeholder → real login.
  function invitePlayer(person, username) {
    username = String(username || "").trim().replace(/^@/, "");
    if (!person || person === "devin") { st.msg = "Devin is the admin already."; return render(); }
    if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(username)) {
      st.msg = "Enter a valid GitHub username."; return render();
    }
    run("Inviting @" + username, function () {
      return E.api(E.repoPath("/collaborators/" + encodeURIComponent(username)), {
        method: "PUT",
        body: { permission: "push" }
      }).catch(function (err) {
        if (err && err.status === 404) throw new Error("GitHub user @" + username + " was not found.");
        if (err && err.status === 422) throw new Error("Could not invite @" + username + " (blocked or invalid).");
        if (err && err.status === 403) throw new Error("Your token can't manage collaborators. Needs admin on this repo.");
        throw err;
      }).then(function () {
        return E.getFile("edit/profiles.json").then(function (f) {
          var doc = JSON.parse(f.text);
          var profiles = doc.profiles || {};
          var foundKey = null, foundVal = null;
          Object.keys(profiles).forEach(function (k) {
            if (k.charAt(0) === "_" || k.indexOf("//") === 0) return;
            var pr = profiles[k];
            if (pr && pr.person === person) { foundKey = k; foundVal = pr; }
          });
          if (!foundVal) throw new Error("No profile row for " + person + " in profiles.json.");
          if (foundKey !== username) {
            if (profiles[username] && profiles[username].person && profiles[username].person !== person) {
              throw new Error("@" + username + " is already bound to " + profiles[username].person + ".");
            }
            delete profiles[foundKey];
            profiles[username] = foundVal;
            doc.profiles = profiles;
            return commit([{ path: "edit/profiles.json", text: json(doc) }], "Profiles: bind " + person + " to @" + username + " via dashboard invite").then(function () {
              st.profilesDoc = doc;
              return "Invited @" + username + " (Write). Pending accept, or already a collaborator — profile updated";
            });
          }
          st.profilesDoc = doc;
          return "Invited @" + username + " (Write). Already bound in profiles — invite refreshed";
        });
      });
    });
  }

  window.addEventListener("elorae-edit-session", boot);
  boot();
})();
