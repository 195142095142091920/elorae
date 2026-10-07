/* Index drag-and-drop organizer (admin + edit mode only).
   Loaded after editor.js. Does not run for players or anonymous visitors. */
(function () {
  "use strict";
  var E = window.EloraeEdit, P = window.EloraeEditPerms;
  if (!E || !P || window.EloraeIndexOrg) return;

  var PATH = E.pagePath();
  var state = {
    active: false,
    selected: null,
    busy: false,
    dirty: false,
    profile: null
  };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  }); }
  function isIndexPage() {
    return !!(document.body && document.body.classList.contains("index-page") &&
      document.querySelector("main.index-flow section.index-cat"));
  }
  function slugify(name) {
    return String(name || "entry").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "entry";
  }
  function cardsRoot() { return document.querySelector("main.index-flow"); }
  function allCards() { return Array.prototype.slice.call(document.querySelectorAll("main.index-flow a.index-card")); }
  function catSections() { return Array.prototype.slice.call(document.querySelectorAll("main.index-flow section.index-cat")); }

  function categoryOf(card) {
    var sub = card.closest && card.closest(".index-cards");
    if (!sub) return null;
    var prev = sub.previousElementSibling;
    if (prev && prev.classList && prev.classList.contains("index-sub")) return prev.id;
    var sec = card.closest("section.index-cat");
    return sec ? sec.id : null;
  }
  function cardsContainerFor(catId) {
    var sub = document.getElementById(catId);
    if (sub && sub.classList.contains("index-sub")) {
      var n = sub.nextElementSibling;
      if (n && n.classList.contains("index-cards")) return n;
    }
    var sec = document.getElementById(catId);
    if (sec && sec.classList.contains("index-cat")) {
      var direct = null;
      Array.prototype.forEach.call(sec.children, function (ch) {
        if (ch.classList.contains("index-cards") && !direct) direct = ch;
      });
      // Prefer the first .index-cards that is not under a prior index-sub... 
      // For top-level cats, first index-cards child after h2.
      var afterH2 = false;
      for (var i = 0; i < sec.children.length; i++) {
        var c = sec.children[i];
        if (c.tagName === "H2") { afterH2 = true; continue; }
        if (afterH2 && c.classList.contains("index-sub")) break;
        if (afterH2 && c.classList.contains("index-cards")) return c;
      }
      return direct;
    }
    return null;
  }

  function stripLore(card) {
    card.classList.remove("is-lore-flipped");
    card.setAttribute("aria-expanded", "false");
    var back = card.querySelector(".card-lore-back");
    if (back) back.remove();
  }

  function setSelected(card) {
    allCards().forEach(function (c) { c.classList.remove("ee-index-selected"); });
    state.selected = card || null;
    if (card) card.classList.add("ee-index-selected");
  }

  function markDirty() {
    state.dirty = true;
    barMsg("Index changed · Save to commit");
  }

  function barMsg(msg, cls) {
    var Ed = window.EloraeEditor;
    if (Ed && typeof Ed.openPanel === "function" && $( "ee-bar")) {
      /* reuse editor bar chrome if present */
    }
    var b = $("ee-bar");
    if (!b) {
      b = document.createElement("div");
      b.id = "ee-bar";
      b.setAttribute("role", "region");
      b.setAttribute("aria-label", "Index organizer");
      document.body.appendChild(b);
    }
    b.className = cls || "";
    b.innerHTML =
      '<span class="ee-msg">' + esc(msg || "Index organizer · drag cards or select + Categories") + '</span>' +
      '<button type="button" class="ee-btn" id="ee-idx-add">Add card</button>' +
      '<button type="button" class="ee-btn" id="ee-idx-cancel">Cancel</button>' +
      '<button type="button" class="ee-btn ee-primary" id="ee-idx-save">Save</button>';
    $("ee-idx-save").onclick = saveIndex;
    $("ee-idx-cancel").onclick = cancelOrg;
    $("ee-idx-add").onclick = addCardPrompt;
  }

  function enableDrag() {
    allCards().forEach(function (card) {
      card.setAttribute("draggable", "true");
      card.classList.add("ee-index-draggable");
    });
    catSections().forEach(function (sec) {
      Array.prototype.forEach.call(sec.querySelectorAll(".index-cards"), function (box) {
        box.classList.add("ee-index-drop");
      });
    });
  }
  function disableDrag() {
    allCards().forEach(function (card) {
      card.removeAttribute("draggable");
      card.classList.remove("ee-index-draggable", "ee-index-selected");
    });
    Array.prototype.forEach.call(document.querySelectorAll(".ee-index-drop"), function (b) { b.classList.remove("ee-index-drop", "ee-index-dragover"); });
  }

  function moveCardToCategory(card, catId, beforeCard) {
    if (!card || !catId) return;
    var box = cardsContainerFor(catId);
    if (!box) return;
    stripLore(card);
    // Remove empty placeholder
    var empty = box.querySelector("p.index-empty");
    if (empty) empty.remove();
    // Update id prefix
    var slug = (card.id || "").replace(/^.*?-/, "") || slugify((card.querySelector("span") || {}).textContent || "card");
    // Better: derive slug from href
    var hm = /\/articles\/([^\/?#]+)\.html/.exec(card.getAttribute("href") || "");
    if (hm) slug = hm[1];
    var oldId = card.id;
    card.id = catId + "-" + slug;
    if (beforeCard && beforeCard.parentNode === box) box.insertBefore(card, beforeCard);
    else box.appendChild(card);
    // If old container emptied, restore empty note
    catSections().forEach(function (sec) {
      Array.prototype.forEach.call(sec.querySelectorAll(".index-cards"), function (b) {
        if (!b.querySelector("a.index-card") && !b.querySelector("p.index-empty")) {
          var p = document.createElement("p");
          p.className = "index-empty";
          p.textContent = "None filed here yet";
          b.appendChild(p);
        }
      });
    });
    rebuildTocFromDom();
    if (oldId !== card.id) markDirty();
    else markDirty();
  }

  function rebuildTocFromDom() {
    var panel = document.querySelector("#index-toc-panel");
    if (!panel) return;
    // Keep head; rebuild toc-cat blocks from main
    var head = panel.querySelector(".index-toc-head");
    var html = head ? head.outerHTML : '<div class="index-toc-head"><h3>Categories</h3></div>';
    catSections().forEach(function (sec) {
      var id = sec.id;
      var title = (sec.querySelector("h2") || {}).textContent || id;
      var isPrivate = sec.classList.contains("private-group");
      var subs = Array.prototype.slice.call(sec.querySelectorAll("h3.index-sub"));
      var togBtn = '<button type="button" class="toc-tog" aria-expanded="false" aria-label="' + esc(title) + '"><svg viewBox="0 0 6 10" aria-hidden="true"><polyline points="1,1 5,5 1,9" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg></button>';
      if (subs.length) {
        // Factions-style: nest groups
        var nest = '<div class="toc-nest">';
        // Cards directly under section before first sub? rare
        subs.forEach(function (sub) {
          var sid = sub.id;
          var st = sub.textContent || sid;
          var box = sub.nextElementSibling;
          nest += '<div class="toc-group"><a class="toc-sub" href="#' + esc(sid) + '">' + esc(st) + '</a>';
          if (box && box.classList.contains("index-cards")) {
            Array.prototype.forEach.call(box.querySelectorAll("a.index-card"), function (card) {
              var name = (card.querySelector("span") || {}).textContent || card.id;
              var priv = card.classList.contains("private") ? ' private" data-owner="' + esc(card.getAttribute("data-owner") || "") + '"' : '"';
              nest += '<a class="toc-name' + priv + ' href="#' + esc(card.id) + '">' + esc(name) + '</a>';
            });
          }
          nest += '</div>';
        });
        nest += '</div>';
        html += '<div class="toc-cat' + (isPrivate ? " private-group" : "") + '"><div class="toc-row"><a class="" href="#' + esc(id) + '">' + esc(title) + '</a>' + togBtn + '</div>' + nest + '</div>';
      } else {
        var box = (function(){for(var i=0,c;i<sec.children.length;i++){c=sec.children[i];if(c.classList.contains("index-cards"))return c;if(c.classList.contains("index-sub"))return null;}return null;})();
        var cards = box ? Array.prototype.slice.call(box.querySelectorAll("a.index-card")) : [];
        var nest = "";
        if (cards.length) {
          nest = '<div class="toc-nest">';
          cards.forEach(function (card) {
            var name = (card.querySelector("span") || {}).textContent || card.id;
            var priv = card.classList.contains("private") ? ' private" data-owner="' + esc(card.getAttribute("data-owner") || "") + '"' : '"';
            nest += '<a class="toc-name' + priv + ' href="#' + esc(card.id) + '">' + esc(name) + '</a>';
          });
          nest += '</div>';
        }
        html += '<div class="toc-cat' + (isPrivate ? " private-group" : "") + '"><div class="toc-row"><a class="" href="#' + esc(id) + '">' + esc(title) + '</a>' +
          (cards.length ? togBtn : "") + '</div>' + nest + '</div>';
      }
    });
    panel.innerHTML = html;
    // Mark current hash category as .on
    var hash = (location.hash || "").replace(/^#/, "");
    var on = panel.querySelector('a[href="#' + hash + '"]') || panel.querySelector(".toc-row > a");
    if (on) on.classList.add("on");
  }

  function enableHeaderEdit() {
    Array.prototype.forEach.call(document.querySelectorAll("main.index-flow section.index-cat > h2, main.index-flow h3.index-sub"), function (h) {
      h.setAttribute("contenteditable", "true");
      h.setAttribute("spellcheck", "true");
      h.classList.add("ee-index-heading");
      h.addEventListener("keydown", onHeadingKey);
      h.addEventListener("blur", onHeadingBlur);
    });
  }
  function disableHeaderEdit() {
    Array.prototype.forEach.call(document.querySelectorAll(".ee-index-heading"), function (h) {
      h.removeAttribute("contenteditable");
      h.removeAttribute("spellcheck");
      h.classList.remove("ee-index-heading");
      h.removeEventListener("keydown", onHeadingKey);
      h.removeEventListener("blur", onHeadingBlur);
    });
  }
  function onHeadingKey(e) {
    if (e.key === "Enter") { e.preventDefault(); e.target.blur(); }
  }
  function onHeadingBlur(e) {
    var h = e.target;
    var text = (h.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) { h.textContent = h.id || "Category"; return; }
    h.textContent = text;
    rebuildTocFromDom();
    markDirty();
  }

  function onDragStart(e) {
    var card = e.target.closest && e.target.closest("a.index-card");
    if (!card || !state.active) return;
    stripLore(card);
    setSelected(card);
    e.dataTransfer.setData("text/ee-card-id", card.id);
    e.dataTransfer.effectAllowed = "move";
    card.classList.add("ee-index-dragging");
  }
  function onDragEnd(e) {
    var card = e.target.closest && e.target.closest("a.index-card");
    if (card) card.classList.remove("ee-index-dragging");
    Array.prototype.forEach.call(document.querySelectorAll(".ee-index-dragover"), function (n) { n.classList.remove("ee-index-dragover"); });
  }
  function onDragOver(e) {
    if (!state.active) return;
    var box = e.target.closest && e.target.closest(".index-cards");
    var card = e.target.closest && e.target.closest("a.index-card");
    if (!box && !card) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    Array.prototype.forEach.call(document.querySelectorAll(".ee-index-dragover"), function (n) { n.classList.remove("ee-index-dragover"); });
    (box || card).classList.add("ee-index-dragover");
  }
  function onDrop(e) {
    if (!state.active) return;
    var id = e.dataTransfer.getData("text/ee-card-id");
    var card = id && document.getElementById(id);
    if (!card) return;
    e.preventDefault();
    var before = e.target.closest && e.target.closest("a.index-card");
    if (before === card) before = before.nextElementSibling;
    var box = (before && before.parentElement) || (e.target.closest && e.target.closest(".index-cards"));
    if (!box) return;
    var catId = null;
    var prev = box.previousElementSibling;
    if (prev && prev.classList.contains("index-sub")) catId = prev.id;
    else {
      var sec = box.closest("section.index-cat");
      catId = sec && sec.id;
    }
    if (!catId) return;
    moveCardToCategory(card, catId, before && before.classList && before.classList.contains("index-card") ? before : null);
    Array.prototype.forEach.call(document.querySelectorAll(".ee-index-dragover"), function (n) { n.classList.remove("ee-index-dragover"); });
  }

  function onCardClick(e) {
    if (!state.active) return;
    var card = e.target.closest && e.target.closest("a.index-card");
    if (!card || !cardsRoot().contains(card)) return;
    // Allow heading edits etc.
    if (e.target.closest && e.target.closest(".ee-index-heading")) return;
    e.preventDefault();
    e.stopPropagation();
    setSelected(card);
    barMsg("Selected “" + ((card.querySelector("span") || {}).textContent || card.id) + "” · click a category to move");
  }

  function onTocClick(e) {
    if (!state.active) return;
    var a = e.target.closest && e.target.closest("#index-toc-panel a");
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (href.charAt(0) !== "#") return;
    var catId = href.slice(1);
    // If it's a card id and we have selection intending move to that card's category — skip
    if (!state.selected) return; // let normal hash nav happen? prevent and scroll
    // Category / sub targets: toc-row > a, toc-sub
    var isCat = a.matches(".toc-row > a, a.toc-sub");
    if (!isCat) {
      // clicking a name while selected: move into that name's category
      var targetCard = document.getElementById(catId);
      if (targetCard && targetCard.classList.contains("index-card")) {
        e.preventDefault();
        e.stopPropagation();
        moveCardToCategory(state.selected, categoryOf(targetCard), targetCard);
        return;
      }
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (!document.getElementById(catId) && !cardsContainerFor(catId)) return;
    moveCardToCategory(state.selected, catId, null);
    var el = document.getElementById(catId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function articleTemplate(name, slug, catId) {
    var title = name;
    var vEdit = "index-dnd";
    // Minimal article; art-index stub — Category rail still works for chrome.
    return '<!doctype html>\n<html lang="en">\n<head>\n' +
      '<script src="../session-gate.js?v=guest-browse"><\/script>\n\n' +
      '<meta charset="utf-8">\n' +
      '<script src="../cats-rail-boot.js?v=art74"><\/script>\n' +
      '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' +
      '<title>' + esc(title) + ' - Elorae</title>\n' +
      '<link rel="stylesheet" href="/styles.css?v=art96">\n' +
      '<link rel="stylesheet" href="/html.css?v=rich-paste">\n' +
      '<script src="../rail-toggle.js?v=nt26-veil"><\/script>\n' +
      '<script src="../skip-link.js?v=nt11-skip"><\/script>\n' +
      '<link rel="icon" href="/favicon.svg">\n' +
      '</head>\n<body class="article">\n' +
      '<div class="mast"><header class="topbar"><span class="mark"><span class="friend" data-owner="jack"><a href="/articles/galand-helviath/">Galand</a></span><span class="friend" data-owner="jon"><a href="/articles/telorin/">Telorin</a><a href="/articles/silar-scorria/">Silar</a></span><span class="friend" data-owner="julie"><a href="/articles/saoirse/">Saoirse</a></span><span class="friend" data-owner="sawyer"><a href="/articles/vaerek/">Vaerek</a></span><a href="/login/">Elorae</a></span><form action="/search/"><input id="seek" name="q" type="search" placeholder="Search" aria-label="Search"></form><nav class="filters"><a class="" href="/atlas/">Atlas</a><a class="" href="/codex/lore/">Codex</a><a class="active" href="/index/ancients/">Index</a><a class="" href="/journal/">Journal</a></nav></header></div>\n' +
      '<nav id="section-bar"><button type="button" class="sec-toggle" data-sec-for="art-index" aria-controls="art-index-panel" aria-expanded="false">Categories</button></nav>\n' +
      '<aside class="art-index" id="art-index"><button type="button" class="art-index-cue" aria-controls="art-index-panel" aria-expanded="false" aria-label="Index categories"><svg viewBox="0 0 6 10" aria-hidden="true"><polyline points="1,1 5,5 1,9" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg></button><nav class="art-index-panel" id="art-index-panel" aria-label="Index categories"><h3>Categories</h3><p class="ee-note" style="font-size:12px;color:#8f8a82;margin:12px 0">See the <a href="/index/ancients/#' + esc(catId) + '">Index</a> for the full list.</p></nav></aside>\n' +
      '<a class="art-back" href="/index/ancients/#' + esc(catId) + '">Index</a>\n' +
      '<!-- Chosen background art: swap the img src below to change it. -->\n' +
      '<section class="art-hero no-art"><div class="art-title"><h1>' + esc(title) + '</h1><p class="art-epithet"></p></div></section>\n' +
      '<main class="art-body">\n' +
      '<section class="art-sec" id="dossier"><h2>Dossier</h2><dl class="art-dossier"><dt>Name</dt><dd>' + esc(title) + '</dd></dl></section>\n' +
      '<section class="art-sec" id="description"><h2>Description</h2><p class="art-line"></p></section>\n' +
      '</main>\n' +
      '<script src="../search.js?v=pretty-urls"><\/script><script src="../login.js?v=login-elorae-18px"><\/script><script src="../player-mark.js?v=pretty-urls"><\/script>\n' +
      '<canvas id="friend-glow"></canvas>\n' +
      '<script src="../glow.js?v=nt32-ambient"><\/script>\n' +
      '<script src="../art-index.js?v=art87"><\/script>\n' +
      '<script src="../article-siblings.js?v=nt10-sib"><\/script>\n' +
      '<script src="../related-articles.js?v=nt16-rel"><\/script>\n' +
      '<script src="../edit/edit.js?v=' + vEdit + '" defer><\/script>\n' +
      '</body>\n</html>\n';
  }

  function addCardPrompt() {
    var name = window.prompt("New card name");
    if (name == null) return;
    name = String(name).replace(/\s+/g, " ").trim();
    if (!name) return;
    var slug = slugify(name);
    var catId = (state.selected && categoryOf(state.selected)) ||
      ((location.hash || "").replace(/^#/, "")) ||
      (catSections()[0] && catSections()[0].id) || "ancients";
    if (!cardsContainerFor(catId)) {
      // hash might be a card id
      var maybe = document.getElementById(catId);
      if (maybe && maybe.classList.contains("index-card")) catId = categoryOf(maybe);
      if (!cardsContainerFor(catId)) catId = catSections()[0].id;
    }
    var artPath = "articles/" + slug + ".html";
    // Ensure unique slug
    var n = 2, base = slug;
    while (document.querySelector('a.index-card[href$="/' + slug + '.html"]') || document.getElementById(catId + "-" + slug)) {
      slug = base + "-" + n; n++;
      artPath = "articles/" + slug + ".html";
    }
    barMsg("Creating “" + name + "”…", "ee-busy");
    state.busy = true;
    E.getFile(artPath).then(function () {
      state.busy = false;
      barMsg("articles/" + slug + ".html already exists. Pick another name.", "ee-bad-bar");
    }, function (err) {
      if (err && err.status && err.status !== 404) throw err;
      var box = cardsContainerFor(catId);
      var empty = box.querySelector("p.index-empty");
      if (empty) empty.remove();
      var a = document.createElement("a");
      a.className = "index-card no-art";
      a.id = catId + "-" + slug;
      a.href = "/" + artPath.replace(/\.html$/, "/");
      a.innerHTML = "<span>" + esc(name) + "</span>";
      a.setAttribute("draggable", "true");
      a.classList.add("ee-index-draggable");
      box.appendChild(a);
      setSelected(a);
      rebuildTocFromDom();
      var files = [
        { path: artPath, text: articleTemplate(name, slug, catId) }
      ];
      // Also persist index in same commit
      return serializeIndex().then(function (indexHtml) {
        files.push({ path: PATH, text: indexHtml });
        return E.commitFiles(files, "Index: add card “" + name + "” + scaffold " + artPath + " [edit-mode]", E.BRANCH);
      }).then(function () {
        state.busy = false;
        state.dirty = false;
        barMsg("Added “" + name + "” · live in about 1–2 minutes", "ee-done");
        var b = $("ee-bar");
        if (b && !b.querySelector("#ee-x")) {
          b.insertAdjacentHTML("beforeend", '<button type="button" class="ee-btn" id="ee-x">Close</button>');
          $("ee-x").onclick = function () { barMsg("Index organizer"); };
        }
      });
    }).catch(function (err) {
      state.busy = false;
      barMsg(err.message || "Add card failed.", "ee-bad-bar");
    });
  }

  function cleanCloneForSave(node) {
    var c = node.cloneNode(true);
    Array.prototype.forEach.call(c.querySelectorAll(".card-lore-back"), function (n) { n.remove(); });
    Array.prototype.forEach.call(c.querySelectorAll(".is-lore-flipped"), function (n) {
      n.classList.remove("is-lore-flipped");
      n.setAttribute("aria-expanded", "false");
    });
    Array.prototype.forEach.call(c.querySelectorAll(".ee-index-selected,.ee-index-dragging,.ee-index-dragover,.ee-index-draggable,.ee-index-drop,.ee-index-heading"), function (n) {
      n.classList.remove("ee-index-selected", "ee-index-dragging", "ee-index-dragover", "ee-index-draggable", "ee-index-drop", "ee-index-heading");
    });
    Array.prototype.forEach.call(c.querySelectorAll("[draggable],[contenteditable],[spellcheck]"), function (n) {
      n.removeAttribute("draggable");
      n.removeAttribute("contenteditable");
      n.removeAttribute("spellcheck");
    });
    return c;
  }

  function serializeIndex() {
    return E.getFile(PATH).then(function (f) {
      var html = f.text;
      var main = cleanCloneForSave(document.querySelector("main.index-flow"));
      var toc = cleanCloneForSave(document.querySelector("#index-toc-panel"));
      if (!main || !toc) throw new Error("Could not find Index markup to save.");
      if (!/<main class="with-toc index-flow">[\s\S]*?<\/main>/.test(html)) throw new Error("Index main landmark missing in source.");
      if (!/<nav class="index-toc-panel"[^>]*>[\s\S]*?<\/nav>/.test(html)) throw new Error("Index TOC missing in source.");
      html = html.replace(/<main class="with-toc index-flow">[\s\S]*?<\/main>/, main.outerHTML);
      html = html.replace(/<nav class="index-toc-panel"[^>]*>[\s\S]*?<\/nav>/, toc.outerHTML);
      return html;
    });
  }

  function saveIndex() {
    if (state.busy) return;
    state.busy = true;
    barMsg("Saving Index…", "ee-busy");
    serializeIndex().then(function (html) {
      return E.commitFiles([{ path: PATH, text: html }], "Index: reorganize cards [edit-mode]", E.BRANCH);
    }).then(function () {
      state.busy = false;
      state.dirty = false;
      barMsg("Index saved · live in about 1–2 minutes", "ee-done");
      var b = $("ee-bar");
      if (b && !b.querySelector("#ee-x")) {
        b.insertAdjacentHTML("beforeend", '<button type="button" class="ee-btn" id="ee-x">Close</button>');
        $("ee-x").onclick = function () { barMsg("Index organizer"); };
      }
    }).catch(function (err) {
      state.busy = false;
      barMsg(err.message || "Save failed.", "ee-bad-bar");
    });
  }

  var snapshot = null;
  function start() {
    if (state.active || !isIndexPage()) return false;
    if (!state.profile || !P.isAdmin(state.profile) || !P.canEdit(state.profile, PATH)) return false;
    snapshot = {
      main: document.querySelector("main.index-flow").innerHTML,
      toc: document.querySelector("#index-toc-panel").innerHTML
    };
    state.active = true;
    state.dirty = false;
    document.documentElement.classList.add("ee-editing", "ee-index-org");
    enableDrag();
    enableHeaderEdit();
    document.addEventListener("dragstart", onDragStart, true);
    document.addEventListener("dragend", onDragEnd, true);
    document.addEventListener("dragover", onDragOver, true);
    document.addEventListener("drop", onDrop, true);
    document.addEventListener("click", onCardClick, true);
    document.addEventListener("click", onTocClick, true);
    barMsg("Index organizer · drag cards between categories, or select + Categories");
    var g = $("ee-glyph");
    if (g) g.style.display = "none";
    return true;
  }

  function stop() {
    if (!state.active) return;
    document.removeEventListener("dragstart", onDragStart, true);
    document.removeEventListener("dragend", onDragEnd, true);
    document.removeEventListener("dragover", onDragOver, true);
    document.removeEventListener("drop", onDrop, true);
    document.removeEventListener("click", onCardClick, true);
    document.removeEventListener("click", onTocClick, true);
    disableHeaderEdit();
    disableDrag();
    setSelected(null);
    document.documentElement.classList.remove("ee-editing", "ee-index-org");
    state.active = false;
    var b = $("ee-bar");
    if (b) b.remove();
    var g = $("ee-glyph");
    if (g) g.style.display = "";
  }

  function cancelOrg() {
    if (snapshot) {
      document.querySelector("main.index-flow").innerHTML = snapshot.main;
      document.querySelector("#index-toc-panel").innerHTML = snapshot.toc;
    }
    stop();
  }

  function setProfile(pr) { state.profile = pr; }

  window.EloraeIndexOrg = {
    isIndexPage: isIndexPage,
    start: start,
    stop: stop,
    cancel: cancelOrg,
    setProfile: setProfile,
    active: function () { return state.active; }
  };

  // Editor may have resolved profile before this file loaded — refresh glyph.
  setTimeout(function () {
    var Ed = window.EloraeEditor;
    if (Ed && Ed.state && Ed.state.profile) {
      setProfile(Ed.state.profile);
      if (typeof Ed.glyph === "function") Ed.glyph();
    }
  }, 0);

})();
