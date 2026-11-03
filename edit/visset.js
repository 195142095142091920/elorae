/* vt1 (2026-11-03): quick visibility control for an article and its Index cards (admin only).
   One model, the one the site already uses (see edit/README.md "Visibility layer" and vis-gate.js):
   - In the HTML, a hidden piece carries class "private" + data-owner="<person>": html.css hides it
     for everyone but that person and Devin.
   - edit/visibility.json secrets.<id> { owner, path, allowed, everyone }: vis-gate.js reveals the
     piece for the other signed-in players listed in "allowed".
   Three choices:
     Everyone        -> no "private" anywhere, the article's secrets entry removed (public, guests too)
     Devin only      -> private, data-owner="devin", allowed ["devin"]
     Chosen players  -> private, data-owner = the current owner if still chosen, else "devin";
                        allowed ["devin", ...chosen]
   One save (one commit, E.retrySave on clashes) writes every gated copy: the article (both copies:
   hero + body + its own rail entry), both Index copies (every card for it, duplicates included, and
   their Categories entries), edit/visibility.json and the search-index.js entry. Other article
   pages' Categories rails follow the Index at runtime (rail-sections.js rd2).
   Pure text helpers are exported for tests (node: require this file with a fake window). */
(function (root) {
  "use strict";
  var W = root || {};
  var INDEX_FILES = ["index/ancients.html", "index/ancients/index.html"];
  var PEOPLE = ["jack", "jon", "julie", "sawyer", "sylum", "jason"];
  var NAMES = { devin: "Devin", jack: "Jack", jon: "Jon", julie: "Julie", sawyer: "Sawyer", sylum: "Sylum", jason: "Jason" };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function attr(tag, name) { var m = new RegExp("\\s" + name + '\\s*=\\s*"([^"]*)"', "i").exec(tag); return m ? m[1] : null; }
  function classes(tag) { return (attr(tag, "class") || "").split(/\s+/).filter(Boolean); }
  // Opening tag -> same tag with "private" (after the first class) + data-owner, or without both.
  function setPriv(tag, owner) {
    var cl = classes(tag).filter(function (c) { return c !== "private"; });
    if (owner) cl.splice(cl.length ? 1 : 0, 0, "private");
    var had = /\sclass\s*=\s*"/i.test(tag);
    tag = tag.replace(/\s+data-owner\s*=\s*"[^"]*"/gi, "");
    var own = owner ? ' data-owner="' + owner + '"' : "";
    if (had) return tag.replace(/(\sclass\s*=\s*")[^"]*(")/i, function (m, a, b) { return a + cl.join(" ") + b + own; });
    return owner ? tag.replace(/^(<[a-z0-9]+)/i, '$1 class="private"' + own) : tag;
  }
  function hrefsFor(slug) { var h = {}; h["/articles/" + slug + "/"] = 1; h["/articles/" + slug + ".html"] = 1; h["/articles/" + slug + "/index.html"] = 1; return h; }
  // Both Index copies: every card for the article, and the Categories entries that point at them.
  function applyIndex(text, slug, owner) {
    var hrefs = hrefsFor(slug), ids = {}, cards = 0, rail = 0;
    text = text.replace(/<a\b[^>]*>/gi, function (tag) {
      if (classes(tag).indexOf("index-card") < 0 || !hrefs[attr(tag, "href")]) return tag;
      var id = attr(tag, "id"); if (id) ids[id] = 1; cards++;
      return setPriv(tag, owner);
    });
    text = text.replace(/<a\b[^>]*>/gi, function (tag) {
      if (classes(tag).indexOf("toc-name") < 0) return tag;
      var h = attr(tag, "href") || "";
      if (!(h.charAt(0) === "#" && ids[h.slice(1)]) && !hrefs[h]) return tag;
      rail++;
      return setPriv(tag, owner);
    });
    return { text: text, cards: cards, rail: rail };
  }
  // Article copy: hero, body and its own Categories entry.
  function applyArticle(text, slug, owner) {
    var hero = 0, body = 0, hrefs = hrefsFor(slug);
    text = text.replace(/<section\b[^>]*>/gi, function (tag) { if (hero || classes(tag).indexOf("art-hero") < 0) return tag; hero++; return setPriv(tag, owner); });
    text = text.replace(/<main\b[^>]*>/gi, function (tag) { if (body || classes(tag).indexOf("art-body") < 0) return tag; body++; return setPriv(tag, owner); });
    text = text.replace(/<a\b[^>]*>/gi, function (tag) { return classes(tag).indexOf("toc-name") >= 0 && hrefs[attr(tag, "href")] ? setPriv(tag, owner) : tag; });
    return { text: text, hero: hero, body: body };
  }
  function pathMatches(p, slug) { return p === "articles/" + slug + ".html" || p === "articles/" + slug + "/index.html"; }
  function entryFor(man, slug) {
    var s = (man && man.secrets) || {};
    for (var id in s) if (s[id] && pathMatches(s[id].path, slug)) return { id: id, sec: s[id] };
    return null;
  }
  function applyManifest(text, slug, title, owner, allowed) {
    var o = JSON.parse(text); o.secrets = o.secrets || {};
    var hit = entryFor(o, slug);
    if (!owner) {
      Object.keys(o.secrets).forEach(function (k) { if (o.secrets[k] && pathMatches(o.secrets[k].path, slug)) delete o.secrets[k]; });
    } else {
      var id = hit ? hit.id : slug, prev = hit ? hit.sec : {};
      o.secrets[id] = Object.assign({}, prev, { title: prev.title || title || slug, owner: owner, path: prev.path || ("articles/" + slug + ".html"),
        status: "plaintext", everyone: false, allowed: allowed.slice(), epoch: prev.epoch || 0, keys: prev.keys || {}, openKey: null });
    }
    return JSON.stringify(o, null, 2) + "\n";
  }
  function applySearch(text, slug, owner) {
    var a = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1)), n = 0;
    a.forEach(function (e) {
      if (!e || e.href !== "articles/" + slug + ".html") return;
      n++;
      if (owner) { e.private = true; e.owner = owner; }
      else if ("private" in e || "owner" in e) { e.private = false; e.owner = ""; }
    });
    return n ? text.slice(0, text.indexOf("[")) + JSON.stringify(a) + text.slice(text.lastIndexOf("]") + 1) : text;
  }
  /* Current state: from the page's own mark (owner) + its secrets entry. */
  function stateOf(owner, entry) {
    if (!owner) return { mode: "everyone", people: [], owner: "" };
    var people = [];
    if (owner !== "devin") people.push(owner);
    ((entry && entry.allowed) || []).forEach(function (p) { if (p !== "devin" && people.indexOf(p) < 0) people.push(p); });
    if (entry && entry.everyone) PEOPLE.forEach(function (p) { if (people.indexOf(p) < 0) people.push(p); });
    return { mode: people.length ? "players" : "devin", people: people, owner: owner };
  }
  /* Choice -> { owner, allowed } (owner null = Everyone). */
  function resolve(choice, prevOwner) {
    if (choice.mode === "everyone") return { owner: null, allowed: [] };
    var people = choice.mode === "players" ? (choice.people || []).filter(function (p) { return p && p !== "devin"; }) : [];
    if (!people.length) return { owner: "devin", allowed: ["devin"] };
    var owner = prevOwner && prevOwner !== "devin" && people.indexOf(prevOwner) >= 0 ? prevOwner : "devin";
    return { owner: owner, allowed: ["devin"].concat(people) };
  }
  function label(st) {
    if (!st || st.mode === "everyone") return "Everyone";
    if (st.mode === "devin") return "Devin only";
    return st.people.map(function (p) { return NAMES[p] || p; }).join(", ") + " + Devin";
  }
  function shortLabel(st) {
    if (!st || st.mode === "everyone") return "Everyone";
    if (st.mode === "devin") return "Private";
    return st.people.length === 1 ? (NAMES[st.people[0]] || st.people[0]) : st.people.length + " players";
  }
  var ICON = {
    everyone: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    devin: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><rect x="5" y="11" width="14" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    players: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><circle cx="9" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17" cy="9" r="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M17.5 14.2c2.3.3 3.6 2 4 4.3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>'
  };

  var pure = { setPriv: setPriv, applyIndex: applyIndex, applyArticle: applyArticle, applyManifest: applyManifest, applySearch: applySearch,
    stateOf: stateOf, resolve: resolve, entryFor: entryFor, label: label, shortLabel: shortLabel, PEOPLE: PEOPLE, NAMES: NAMES, INDEX_FILES: INDEX_FILES };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ---------------- browser ---------------- */
  var E = W.EloraeEdit, P = W.EloraeEditPerms, doc = W.document;
  if (!E || !P || W.EloraeVisSet) return;
  var man = null, manP = null;
  function loadManifest(force) {
    if (manP && !force) return manP;
    manP = E.getFile("edit/visibility.json").then(function (f) { man = JSON.parse(f.text); return man; })
      .catch(function (e) { manP = null; throw e; });
    return manP;
  }
  function people() {
    var p = man && man.people ? Object.keys(man.people).filter(function (k) { return k !== "devin" && k.charAt(0) !== "_"; }) : PEOPLE.slice();
    return p.length ? p : PEOPLE.slice();
  }
  function nameOf(p) { return (man && man.people && man.people[p] && man.people[p].name) || NAMES[p] || p; }
  function slugOfHref(h) { var m = /\/articles\/([^\/?#]+?)(?:\.html|\/(?:index\.html)?)?(?:[?#]|$)/.exec(h || ""); return m ? m[1] : null; }
  function pageSlug() { return slugOfHref(location.pathname); }
  function isArticlePage() { return !!(doc.body && doc.body.classList.contains("article") && doc.querySelector("main.art-body")); }
  // The owner mark shown for this article right now (live page).
  function domOwner(slug) {
    var n = null;
    if (isArticlePage() && pageSlug() === slug) n = doc.querySelector("main.art-body") || doc.querySelector("section.art-hero");
    if (!n) {
      var cards = doc.querySelectorAll("main.index-flow a.index-card");
      for (var i = 0; i < cards.length; i++) if (slugOfHref(cards[i].getAttribute("href")) === slug) { n = cards[i]; break; }
    }
    return n && n.classList.contains("private") ? (n.getAttribute("data-owner") || "devin") : "";
  }
  function current(slug) { var hit = man && entryFor(man, slug); return stateOf(domOwner(slug), hit && hit.sec); }

  // Same change on the live page (so the editor, the organizer's next save and the marks agree).
  function setNode(n, owner) {
    n.classList.remove("private"); n.removeAttribute("data-owner");
    if (owner) { n.classList.add("private"); n.setAttribute("data-owner", owner); }
  }
  function applyDom(slug, owner) {
    var hrefs = hrefsFor(slug), ids = {};
    Array.prototype.forEach.call(doc.querySelectorAll("a.index-card"), function (c) {
      if (!hrefs[c.getAttribute("href")]) return; if (c.id) ids[c.id] = 1; setNode(c, owner);
    });
    Array.prototype.forEach.call(doc.querySelectorAll("a.toc-name"), function (a) {
      var h = a.getAttribute("href") || "";
      if ((h.charAt(0) === "#" && ids[h.slice(1)]) || hrefs[h]) setNode(a, owner);
    });
    if (isArticlePage() && pageSlug() === slug) {
      var hero = doc.querySelector("section.art-hero"), body = doc.querySelector("main.art-body");
      if (hero) setNode(hero, owner); if (body) setNode(body, owner);
    }
    var O = W.EloraeIndexOrg;
    if (O && O.visApplied) O.visApplied(function (t) { return applyIndex(t, slug, owner).text; });
    try { doc.dispatchEvent(new CustomEvent("elorae-vis", { detail: { slug: slug } })); } catch (e) {}
  }

  function titleOf(text, slug) {
    var m = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(text || "");
    var t = m ? m[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ").trim() : "";
    return t || slug;
  }
  /* One save: read every gated file at the same main, rewrite, one commit; re-run on a clash. */
  function save(slug, choice, onRetry) {
    var art = ["articles/" + slug + ".html", "articles/" + slug + "/index.html"];
    var paths = INDEX_FILES.concat(art, ["edit/visibility.json", "search-index.js"]);
    var res = null;
    return E.retrySave(function () {
      var ref;
      return E.headSha(E.BRANCH).then(function (sha) {
        ref = sha;
        return Promise.all(paths.map(function (p) {
          return E.getFile(p, ref).then(function (f) { return f; }, function (err) { if (err && err.status === 404) return null; throw err; });
        }));
      }).then(function (fs) {
        var byPath = {}; paths.forEach(function (p, i) { byPath[p] = fs[i]; });
        if (!byPath[art[0]] && !byPath[art[1]]) throw new Error("No article page for " + slug + ".");
        var mf = byPath["edit/visibility.json"], m0 = mf ? JSON.parse(mf.text) : { secrets: {} };
        var hit = entryFor(m0, slug);
        var prevOwner = hit ? hit.sec.owner : "";
        art.forEach(function (p) { var f = byPath[p]; if (!prevOwner && f) { var mm = /<main\b[^>]*>/i.exec(f.text); if (mm && classes(mm[0]).indexOf("private") >= 0) prevOwner = attr(mm[0], "data-owner") || ""; } });
        var r = resolve(choice, prevOwner);
        var out = [], counts = { cards: 0, rail: 0, pages: 0 };
        INDEX_FILES.forEach(function (p) {
          var f = byPath[p]; if (!f) return;
          var x = applyIndex(f.text, slug, r.owner); counts.cards += x.cards; counts.rail += x.rail;
          if (x.text !== f.text) out.push({ path: p, text: x.text });
        });
        art.forEach(function (p) {
          var f = byPath[p]; if (!f) return;
          var x = applyArticle(f.text, slug, r.owner); counts.pages++;
          if (x.text !== f.text) out.push({ path: p, text: x.text });
        });
        var title = titleOf((byPath[art[1]] || byPath[art[0]]).text, slug);
        if (mf) { var mt = applyManifest(mf.text, slug, title, r.owner, r.allowed); if (mt !== mf.text) out.push({ path: "edit/visibility.json", text: mt }); }
        var sf = byPath["search-index.js"];
        if (sf) { var st = applySearch(sf.text, slug, r.owner); if (st !== sf.text) out.push({ path: "search-index.js", text: st }); }
        res = { slug: slug, owner: r.owner, allowed: r.allowed, files: out, counts: counts, title: title };
        if (!out.length) return null;
        var what = r.owner ? (r.allowed.length > 1 ? "shown to " + r.allowed.join(", ") : "Devin only") : "everyone";
        return E.commitFiles(out, "Visibility: " + title + " \u2192 " + what + " via edit mode [edit-mode]", E.BRANCH, ref);
      });
    }, onRetry).then(function (commit) {
      res.commit = commit && commit.sha;
      if (man) { // keep the local manifest in step
        try { var mtx = res.files.filter(function (f) { return f.path === "edit/visibility.json"; })[0]; if (mtx) man = JSON.parse(mtx.text); } catch (e) {}
      }
      applyDom(slug, res.owner);
      var R = W.EloraeRecent; if (R && R.remember && res.files.length) { try { R.remember(res.files); } catch (e) {} }
      return res;
    });
  }

  /* ---------------- popover ---------------- */
  var pop = null;
  function close() {
    if (!pop) return;
    pop.el.remove(); doc.removeEventListener("mousedown", outside, true); doc.removeEventListener("keydown", onKey, true);
    if (pop.anchor) { pop.anchor.setAttribute("aria-expanded", "false"); try { pop.anchor.focus({ preventScroll: true }); } catch (e) {} }
    pop = null;
  }
  function outside(e) { if (pop && !pop.el.contains(e.target) && !(pop.anchor && pop.anchor.contains(e.target))) close(); }
  function onKey(e) { if (e.key === "Escape" && pop) { e.preventDefault(); e.stopPropagation(); close(); } }
  function place(el, anchor) {
    var r = anchor.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight, vw = W.innerWidth, vh = W.innerHeight;
    var left = Math.max(8, Math.min(vw - w - 8, r.left + r.width / 2 - w / 2));
    var top = r.bottom + 8; if (top + h > vh - 8) top = Math.max(8, r.top - h - 8);
    el.style.left = Math.round(left) + "px"; el.style.top = Math.round(top) + "px";
  }
  /* open(anchor, slug, { name, onSaved(res), onState(st) }) */
  function open(anchor, slug, opts) {
    opts = opts || {};
    if (pop && pop.anchor === anchor) { close(); return; }
    close();
    var el = doc.createElement("div");
    el.id = "ee-vis-pop"; el.className = "ee-vis-pop"; el.setAttribute("role", "dialog"); el.setAttribute("data-ee-ui", "1");
    el.setAttribute("aria-label", "Who can see " + (opts.name || slug));
    el.innerHTML = '<div class="ee-vis-head">Who can see</div><div class="ee-vis-name">' + esc(opts.name || slug) + '</div><p class="ee-vis-note">Loading\u2026</p>';
    doc.body.appendChild(el);
    pop = { el: el, anchor: anchor, slug: slug };
    anchor.setAttribute("aria-expanded", "true");
    place(el, anchor);
    setTimeout(function () { doc.addEventListener("mousedown", outside, true); doc.addEventListener("keydown", onKey, true); }, 0);
    var ownersP = E.getFile("edit/profiles.json").then(function (f) { return W.EloraeMedia && W.EloraeMedia.ownersOf ? W.EloraeMedia.ownersOf(f.text, slug) : []; }, function () { return []; });
    Promise.all([loadManifest(true), ownersP]).then(function (r) {
      if (!pop || pop.el !== el) return;
      render(el, slug, current(slug), r[1], opts);
      place(el, anchor);
    }).catch(function (e) {
      if (!pop || pop.el !== el) return;
      el.querySelector(".ee-vis-note").textContent = (e && e.message) || "Could not load visibility.";
    });
  }
  function render(el, slug, st, owners, opts) {
    var ps = people();
    var inPrivateGroup = Array.prototype.some.call(doc.querySelectorAll("main.index-flow a.index-card"), function (c) { return slugOfHref(c.getAttribute("href")) === slug && c.closest(".private-group"); });
    var radio = function (v, txt, sub) {
      return '<label class="ee-vis-opt"><input type="radio" name="ee-vis-mode" value="' + v + '"' + (st.mode === v ? " checked" : "") + '><span class="ee-vis-ic">' + ICON[v] + '</span><span>' + txt + (sub ? ' <em>' + sub + '</em>' : "") + "</span></label>";
    };
    el.innerHTML = '<div class="ee-vis-head">Who can see</div><div class="ee-vis-name">' + esc(opts.name || slug) + "</div>" +
      '<div class="ee-vis-opts">' + radio("everyone", "Everyone", "guests too") + radio("devin", "Devin only") + radio("players", "Chosen players") + "</div>" +
      '<div class="ee-vis-people">' + ps.map(function (p) {
        return '<label class="ee-vis-p"><input type="checkbox" value="' + esc(p) + '"' + (st.people.indexOf(p) >= 0 ? " checked" : "") + "> " + esc(nameOf(p)) +
          (owners.indexOf(p) >= 0 ? ' <em title="Plays this character">\u2605</em>' : "") + "</label>";
      }).join("") + "</div>" +
      (owners.length ? '<p class="ee-vis-note">' + esc(owners.map(nameOf).join(" and ")) + "\u2019s character (\u2605). Only you can change who sees it.</p>" : "") +
      (inPrivateGroup ? '<p class="ee-vis-note">This card sits in the Private section, which only Devin, Jack and the people it is shared with see.</p>' : "") +
      '<p class="ee-vis-err" hidden></p>' +
      '<div class="ee-vis-row"><button type="button" class="ee-btn" data-vis-act="cancel">Cancel</button><button type="button" class="ee-btn ee-primary" data-vis-act="save">Save</button></div>';
    var boxes = el.querySelectorAll(".ee-vis-people input");
    function mode() { var r = el.querySelector('input[name="ee-vis-mode"]:checked'); return r ? r.value : "everyone"; }
    function sync() {
      var m = mode();
      el.classList.toggle("ee-vis-pick", m === "players");
    }
    Array.prototype.forEach.call(el.querySelectorAll('input[name="ee-vis-mode"]'), function (r) { r.onchange = sync; });
    Array.prototype.forEach.call(boxes, function (b) { b.onchange = function () { if (b.checked && mode() !== "players") el.querySelector('input[value="players"]').checked = true; sync(); }; });
    sync();
    var err = el.querySelector(".ee-vis-err");
    el.querySelector('[data-vis-act="cancel"]').onclick = close;
    el.querySelector('[data-vis-act="save"]').onclick = function () {
      var choice = { mode: mode(), people: Array.prototype.filter.call(boxes, function (b) { return b.checked; }).map(function (b) { return b.value; }) };
      if (choice.mode === "players" && !choice.people.length) choice.mode = "devin";
      var btns = el.querySelectorAll("button, input");
      Array.prototype.forEach.call(btns, function (b) { b.disabled = true; });
      err.hidden = false; err.className = "ee-vis-err ee-vis-busy"; err.textContent = "Saving\u2026";
      save(slug, choice, function (n) { err.textContent = "Someone else saved at the same time \u2014 retrying (" + n + "/3)\u2026"; }).then(function (res) {
        var ns = current(slug);
        close();
        if (opts.onSaved) opts.onSaved(res, ns);
      }).catch(function (e) {
        Array.prototype.forEach.call(btns, function (b) { b.disabled = false; }); sync();
        err.className = "ee-vis-err"; err.textContent = (e && e.message) || "Save failed.";
      });
    };
    var first = el.querySelector('input[name="ee-vis-mode"]:checked'); if (first) try { first.focus({ preventScroll: true }); } catch (e) {}
  }
  function canChange(profile) { return !!(profile && P.isAdmin(profile)); }

  W.EloraeVisSet = Object.assign({ open: open, close: close, save: save, current: current, loadManifest: loadManifest, applyDom: applyDom,
    canChange: canChange, slugOfHref: slugOfHref, ICON: ICON, manifest: function () { return man; } }, pure);
})(typeof window !== "undefined" ? window : null);
