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
    profile: null,
    art: {}
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
    if (card) setTarget(null);
    state.selected = card || null;
    if (card) card.classList.add("ee-index-selected");
  }

  function markDirty() {
    state.dirty = true;
    barMsg("Index changed · Save to commit");
  }

  function barMsg(msg, cls) {
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
      '<span class="ee-msg" title="' + esc(msg || "") + '">' + esc(msg || "Index organizer · drag cards or select + Categories") + '</span>' +
      '<button type="button" class="ee-btn" id="ee-idx-add">Add card</button>' +
      '<button type="button" class="ee-btn" id="ee-idx-subs-btn" aria-expanded="' + ($("ee-idx-subs") ? "true" : "false") + '">Sub<span class="ee-wide-only">section</span></button>' +
      '<button type="button" class="ee-btn" id="ee-idx-art" title="Art for the selected card (or drop an image file on a card)">Art</button>' +
      '<button type="button" class="ee-btn ee-danger" id="ee-idx-del" title="Delete the selected card">Del<span class="ee-wide-only">ete</span></button>' +
      '<button type="button" class="ee-btn" id="ee-idx-cancel">Cancel</button>' +
      '<button type="button" class="ee-btn ee-primary" id="ee-idx-save">Save</button>';
    $("ee-idx-save").onclick = function () { saveIndex(); };
    $("ee-idx-cancel").onclick = function () {
      if (state.dirty && !window.confirm("Discard your unsaved changes to the Index?")) return;
      cancelOrg();
    };
    $("ee-idx-add").onclick = addCardPrompt;
    $("ee-idx-art").onclick = openCardArt;
    $("ee-idx-del").onclick = function () {
      if (state.selected) return deleteCardFlow(state.selected);
      barMsg("Select a card to delete it (click it once). To delete a section or subsection, open Subsection.");
    };
    $("ee-idx-subs-btn").onclick = function () { if ($("ee-idx-subs")) closeSubs(); else openSubs(); barMsg(b.querySelector(".ee-msg").textContent, cls); };
    if ($("ee-idx-subs")) setTimeout(positionSubs, 0);
    if (state.busy) Array.prototype.forEach.call(b.querySelectorAll("button"), function (x) { x.disabled = true; });
  }
  function savedAt() { return "Saved at " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + "."; }
  function doneMsg(msg) {
    barMsg(msg, "ee-done");
  }
  function cardName(card) { return ((card.querySelector("span") || {}).textContent || card.id || "card").replace(/\s+/g, " ").trim(); }
  function cardSlug(card) { return Media && Media.articleSlug ? Media.articleSlug(card.getAttribute("href")) : null; }

  /* ---------- Card art ---------- */
  // state.art[slug] = { name, file?, info?, url?, asset?, hero }: shown on the card at once (from
  // memory for a new upload), written with the Index save: image + catalog + both Index copies +
  // the card's article (hero art, both copies).
  var Media = window.EloraeMedia;
  function previewOnCard(card, src) {
    var img = card.querySelector("img");
    if (!img) { img = document.createElement("img"); img.setAttribute("alt", ""); img.setAttribute("decoding", "async"); card.appendChild(img); }
    img.removeAttribute("srcset"); img.removeAttribute("sizes");
    img.setAttribute("src", src);
    img.setAttribute("data-ee-art", "1");
    card.classList.remove("no-art");
  }
  function setArtFile(card, file) {
    var slug = cardSlug(card);
    if (!slug) { barMsg("This card has no article to give art to.", "ee-bad-bar"); return Promise.resolve(false); }
    if (!Media) { barMsg("Media helpers not loaded.", "ee-bad-bar"); return Promise.resolve(false); }
    state.artBusy = (state.artBusy || 0) + 1;
    barMsg("Preparing “" + cardName(card) + "” art…", "ee-busy");
    return Media.validateFile(file).then(function (info) {
      var old = state.art[slug];
      if (old && old.url) { try { URL.revokeObjectURL(old.url); } catch (e) {} }
      var url = URL.createObjectURL(info.blob || file);
      state.art[slug] = { name: cardName(card), file: file, info: info, url: url, hero: true };
      allCards().forEach(function (c) { if (cardSlug(c) === slug) previewOnCard(c, url); });
      state.artBusy--;
      markDirty();
      barMsg("Art for “" + cardName(card) + "” ready (" + Math.round(info.bytes.length / 1024) + " KB" + (info.resized ? ", resized to " + info.width + "×" + info.height : "") + ") · Save to publish");
      return true;
    }, function (err) {
      state.artBusy--;
      barMsg(err.message || "Could not use that image.", "ee-bad-bar");
      return false;
    });
  }
  function setArtAsset(card, entry) {
    var slug = cardSlug(card);
    if (!slug) return;
    var old = state.art[slug];
    if (old && old.url) { try { URL.revokeObjectURL(old.url); } catch (e) {} }
    state.art[slug] = { name: cardName(card), asset: entry.path, title: entry.title, hero: true };
    allCards().forEach(function (c) { if (cardSlug(c) === slug) previewOnCard(c, "/" + entry.path); });
    markDirty();
    barMsg("Art for “" + cardName(card) + "”: " + (entry.title || entry.path) + " · Save to publish");
  }
  function openCardArt() {
    var card = state.selected;
    if (!card) { barMsg("Select a card first (click it), then Art. Or drop an image file on a card."); return; }
    var Ed = window.EloraeEditor;
    if (Ed && Ed.openArtPicker) {
      Ed.openArtPicker({
        title: "Art for “" + cardName(card) + "”",
        note: "Shown on the card and as its article's hero. Nothing is published until you press Save.",
        onFile: function (f) { return setArtFile(card, f); },
        onPick: function (entry) { setArtAsset(card, entry); }
      });
      return;
    }
    var inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/png,image/jpeg,image/webp,image/gif";
    inp.onchange = function () { if (inp.files[0]) setArtFile(card, inp.files[0]); };
    inp.click();
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
    var hm = /\/articles\/([^\/?#]+?)(?:\.html|\/)?(?:[?#]|$)/.exec(card.getAttribute("href") || "");
    if (hm) slug = hm[1];
    var oldId = card.id, oldParent = card.parentNode, oldNext = card.nextElementSibling;
    if (beforeCard === card) return;
    card.id = catId + "-" + slug;
    if (beforeCard && beforeCard.parentNode === box) box.insertBefore(card, beforeCard);
    else box.appendChild(card);
    if (oldParent === card.parentNode && oldNext === card.nextElementSibling && oldId === card.id) return;
    // If old container emptied, restore empty note
    catSections().forEach(function (sec) {
      Array.prototype.forEach.call(sec.querySelectorAll(".index-cards"), function (b) {
        if (b.querySelector("a.index-card")) { Array.prototype.forEach.call(b.querySelectorAll("p.index-empty"), function (x) { x.remove(); }); return; }
        if (!b.querySelector("p.index-empty")) {
          var p = document.createElement("p");
          p.className = "index-empty";
          p.textContent = "None filed here yet";
          b.appendChild(p);
        }
      });
    });
    rebuildTocFromDom();
    markDirty();
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
        // Cards filed directly in the section (before its first subsection) come first.
        for (var di = 0, dc; di < sec.children.length; di++) {
          dc = sec.children[di];
          if (dc.classList.contains("index-sub")) break;
          if (dc.classList.contains("index-cards")) Array.prototype.forEach.call(dc.querySelectorAll("a.index-card"), function (card) {
            var name = (card.querySelector("span") || {}).textContent || card.id;
            var priv = card.classList.contains("private") ? ' private" data-owner="' + esc(card.getAttribute("data-owner") || "") + '"' : '"';
            nest += '<a class="toc-name' + priv + ' href="#' + esc(card.id) + '">' + esc(name) + '</a>';
          });
        }
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
    state.tocRebuilt = true;
    // Mark current hash category as .on
    var hash = (location.hash || "").replace(/^#/, "");
    var on = panel.querySelector('a[href="#' + hash + '"]') || panel.querySelector(".toc-row > a");
    if (on) on.classList.add("on");
  }

  /* ---------- Subsections (h3.index-sub + its .index-cards box, e.g. Factions → Draconic Kindred) ---------- */
  var EMPTY_HTML = '<p class="index-empty">None filed here yet</p>';
  function subsOf(sec) { return Array.prototype.filter.call(sec.children, function (c) { return c.matches("h3.index-sub"); }); }
  function sectionOfId(id) { var n = id && document.getElementById(id); var sec = n && (n.matches("section.index-cat") ? n : n.closest("section.index-cat")); return sec || null; }
  function setTarget(catId) {
    Array.prototype.forEach.call(document.querySelectorAll(".ee-index-target"), function (n) { n.classList.remove("ee-index-target"); });
    state.targetCat = catId || null;
    var box = catId && cardsContainerFor(catId);
    if (box) box.classList.add("ee-index-target");
  }
  function uniqueId(base) {
    base = base || "section"; var id = base, n = 2;
    while (document.getElementById(id)) { id = base + "-" + n; n++; }
    return id;
  }
  function headingOn(h) {
    h.setAttribute("contenteditable", "true");
    h.setAttribute("spellcheck", "true");
    h.classList.add("ee-index-heading");
    h.setAttribute("data-ee-was", (h.textContent || "").replace(/\s+/g, " ").trim());
    h.addEventListener("keydown", onHeadingKey);
    h.addEventListener("blur", onHeadingBlur);
  }
  function addSubsection(secId, name) {
    var sec = document.getElementById(secId);
    name = String(name || "").replace(/\s+/g, " ").trim();
    if (!sec || !sec.matches("section.index-cat") || !name) return null;
    var id = uniqueId(slugify(name));
    var h = document.createElement("h3"); h.className = "index-sub"; h.id = id; h.textContent = name;
    var box = document.createElement("div"); box.className = "index-cards ee-index-drop"; box.innerHTML = EMPTY_HTML;
    sec.appendChild(h); sec.appendChild(box);
    headingOn(h);
    rebuildTocFromDom();
    setSelected(null);
    setTarget(id);
    markDirty();
    barMsg("Added subsection \u201c" + name + "\u201d \u00b7 Add card puts new cards in it, or drag cards in \u00b7 Save to commit");
    h.scrollIntoView({ block: "center" });
    return id;
  }
  function moveSubsection(id, dir) {
    var h = document.getElementById(id); if (!h) return;
    var sec = h.closest("section.index-cat"), list = subsOf(sec), i = list.indexOf(h), j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    var box = h.nextElementSibling && h.nextElementSibling.classList.contains("index-cards") ? h.nextElementSibling : null;
    var other = list[j], oBox = other.nextElementSibling && other.nextElementSibling.classList.contains("index-cards") ? other.nextElementSibling : null;
    if (dir < 0) { sec.insertBefore(h, other); if (box) sec.insertBefore(box, other); }
    else { var after = (oBox || other).nextSibling; sec.insertBefore(h, after); if (box) sec.insertBefore(box, h.nextSibling); }
    rebuildTocFromDom();
    markDirty();
  }
  function deleteSubsection(id) {
    var h = document.getElementById(id); if (!h) return false;
    var box = h.nextElementSibling && h.nextElementSibling.classList.contains("index-cards") ? h.nextElementSibling : null;
    var n = box ? box.querySelectorAll("a.index-card").length : 0;
    if (n) { barMsg("\u201c" + h.textContent.trim() + "\u201d still has " + n + " card" + (n > 1 ? "s" : "") + ". Move them out first, then delete it.", "ee-bad-bar"); return false; }
    if (!window.confirm("Delete the empty subsection \u201c" + h.textContent.trim() + "\u201d?")) return false;
    if (state.targetCat === id) setTarget(null);
    if (box) box.remove();
    h.remove();
    rebuildTocFromDom();
    markDirty();
    return true;
  }
  /* ---------- Deleting cards, subsections and sections (Devin) ---------- */
  function fixEmptyBoxes() {
    catSections().forEach(function (sec) {
      Array.prototype.forEach.call(sec.querySelectorAll(".index-cards"), function (b) {
        if (b.querySelector("a.index-card")) { Array.prototype.forEach.call(b.querySelectorAll("p.index-empty"), function (x) { x.remove(); }); return; }
        if (!b.querySelector("p.index-empty")) b.insertAdjacentHTML("beforeend", EMPTY_HTML);
      });
    });
  }
  function headText(n) { return ((n && n.textContent) || "").replace(/\s+/g, " ").trim(); }
  // "Factions › Draconic Kindred" / "Heroes" for the place a card (or box) sits.
  function placeOf(node) {
    var box = node.closest ? node.closest(".index-cards") : null, sec = node.closest ? node.closest("section.index-cat") : null;
    var h = box && box.previousElementSibling && box.previousElementSibling.matches("h3.index-sub") ? box.previousElementSibling : null;
    var s = headText(sec && sec.querySelector(":scope > h2"));
    return h ? s + " \u203a " + headText(h) : s;
  }
  function placeId(node) {
    var box = node.closest(".index-cards"), h = box && box.previousElementSibling && box.previousElementSibling.matches("h3.index-sub") ? box.previousElementSibling : null;
    return h ? h.id : (node.closest("section.index-cat") || {}).id;
  }
  function ownersP(slugs) {
    return E.getFile("edit/profiles.json").then(function (f) {
      var o = {}; slugs.forEach(function (s) { var w = Media.ownersOf(f.text, s); if (w.length) o[s] = w; }); return o;
    }, function () { return {}; });
  }
  function ownerLine(owners, names) {
    var ks = Object.keys(owners); if (!ks.length) return "";
    var cap = function (x) { return x.charAt(0).toUpperCase() + x.slice(1); };
    return "<strong>" + ks.map(function (s) { return esc(names[s] || s) + " is " + esc(owners[s].map(cap).join(" and ")) + "\u2019s character"; }).join("; ") + ".</strong> Deleting the page also removes it from their editable pages.";
  }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }
  /* One commit: the Index as on screen (both copies) + the article deletions and every clean-up. */
  function commitWithDeletes(o) {
    var Ed = window.EloraeEditor;
    return saveIndex({
      message: o.message, done: o.done, force: true,
      prepare: function (html, ref) {
        (o.slugs || []).forEach(function (s) { html = Media.unlinkArticle(html, s); });
        if (!(o.slugs || []).length && !(o.anchors || []).length && !(o.sections || []).length) return Promise.resolve({ html: html });
        barMsg((o.slugs || []).length ? "Deleting\u2026 (cleaning up links on other pages)" : "Saving\u2026", "ee-busy");
        return Ed.planDelete({ ref: ref, slugs: o.slugs || [], indexText: html, sections: o.sections, anchors: o.anchors, moveTo: o.moveTo, fallback: o.fallback }).then(function (plan) {
          state.lastPlan = plan;
          return { html: html, files: plan.files.concat(plan.deletes) };
        });
      }
    });
  }
  function deleteCardFlow(card) {
    var Ed = window.EloraeEditor;
    if (!card || !Ed || !Ed.deleteDialog || state.busy) return;
    var slug = cardSlug(card), name = cardName(card), names = {}; names[slug] = name;
    var copies = allCards().filter(function (c) { return cardSlug(c) === slug; }), where = placeOf(card), multi = copies.length > 1;
    return ownersP([slug]).then(function (owners) {
      return Ed.deleteDialog({
        title: "Delete \u201c" + name + "\u201d?",
        lines: [multi ? "This card is in " + copies.length + " places: " + copies.map(function (c) { return esc(placeOf(c)); }).join(", ") + "." : "", ownerLine(owners, names)].filter(Boolean),
        groups: [
          multi ? { name: "where", options: [{ value: "here", label: "Remove it from \u201c" + esc(where) + "\u201d only", checked: true }, { value: "all", label: "Delete it everywhere (all " + copies.length + " cards)" }] } : null,
          { name: "article", showIf: multi ? { where: "all" } : null, options: [{ value: "keep", label: "Keep the article page (just unlist the card)", checked: true }, { value: "delete", label: "Also delete its article page (both copies) and the links to it on other pages" }] }
        ].filter(Boolean),
        ok: "Delete"
      });
    }).then(function (v) {
      if (!v) return false;
      var everywhere = !multi || v.where === "all", delArt = everywhere && v.article === "delete";
      if (delArt) delete state.art[slug];
      (everywhere ? copies : [card]).forEach(function (c) { c.remove(); });
      setSelected(null); fixEmptyBoxes(); rebuildTocFromDom(); markDirty();
      var what = everywhere ? "" : " from \u201c" + where + "\u201d";
      if (!delArt) return saveIndex({ message: "Index: remove card \u201c" + name + "\u201d" + what + " [edit-mode]", done: "Removed \u201c" + name + "\u201d" + what + " (the article stays). " });
      return commitWithDeletes({ slugs: [slug], message: "Delete \u201c" + name + "\u201d: card + article (articles/" + slug + ") + clean-up [edit-mode]", done: "Deleted \u201c" + name + "\u201d and its article. " });
    });
  }
  function deleteSectionFlow(id) {
    var Ed = window.EloraeEditor, el = document.getElementById(id);
    if (!el || !Ed || !Ed.deleteDialog || state.busy) return;
    var isSub = el.matches("h3.index-sub"), sec = el.closest("section.index-cat");
    var box = isSub && el.nextElementSibling && el.nextElementSibling.classList.contains("index-cards") ? el.nextElementSibling : null;
    var cards = Array.prototype.slice.call((isSub ? box : el) ? (isSub ? box : el).querySelectorAll("a.index-card") : []);
    var label = isSub ? headText(el) : headText(el.querySelector(":scope > h2"));
    if (isSub && !cards.length) return deleteSubsection(id);
    closeSubs();
    var removedIds = isSub ? [id] : [id].concat(subsOf(el).map(function (h) { return h.id; }));
    // Where the cards can go: every other section / subsection.
    var targets = [];
    catSections().forEach(function (s) {
      if (!isSub && s === el) return;
      var sl = headText(s.querySelector(":scope > h2"));
      targets.push({ value: s.id, label: sl });
      subsOf(s).forEach(function (h) { if (h.id !== id) targets.push({ value: h.id, label: sl + " \u203a " + headText(h) }); });
    });
    if (isSub) targets.sort(function (a, b) { return (a.value === sec.id ? -1 : 0) - (b.value === sec.id ? -1 : 0); });
    var slugs = [], names = {};
    cards.forEach(function (c) { var s = cardSlug(c); if (s && slugs.indexOf(s) < 0) { slugs.push(s); names[s] = cardName(c); } });
    var n = cards.length;
    return ownersP(slugs).then(function (owners) {
      return Ed.deleteDialog({
        title: "Delete the " + (isSub ? "subsection" : "section") + " \u201c" + label + "\u201d?",
        lines: [n ? "It has " + plural(n, "card") + (isSub ? "" : (removedIds.length > 1 ? " (in " + plural(removedIds.length - 1, "subsection") + " too)" : "")) + ". Choose what happens to them:" : "It has no cards.",
          !isSub ? "Its heading also leaves the Categories lists on every article." : "",
          ownerLine(owners, names) ? ownerLine(owners, names).replace("Deleting the page", "If you delete their pages, that") : ""].filter(Boolean),
        groups: n ? [{ name: "cards", options: [{ value: "move", label: "Move the cards to another section", checked: true }, { value: "delete", label: "Delete the cards" }] }] : [],
        selects: n && targets.length ? [{ name: "to", label: "Move to", options: targets, showIf: { cards: "move" } }] : [],
        checks: n ? [{ name: "articles", label: "Also delete their article pages (" + slugs.length + ") and the links to them on other pages", showIf: { cards: "delete" } }] : [],
        ok: "Delete " + (isSub ? "subsection" : "section")
      });
    }).then(function (v) {
      if (!v) return false;
      var moveTo = {}, del = [], fallback = {}, toLabel = "";
      if (n && v.cards === "move") {
        if (!v.to) { barMsg("Pick where the cards go.", "ee-bad-bar"); return false; }
        var tb = cardsContainerFor(v.to);
        toLabel = (targets.filter(function (t) { return t.value === v.to; })[0] || {}).label || v.to;
        cards.forEach(function (c) {
          var s = cardSlug(c);
          if (tb && Array.prototype.some.call(tb.querySelectorAll("a.index-card"), function (x) { return x !== c && cardSlug(x) === s; })) { c.remove(); return; }
          moveCardToCategory(c, v.to); moveTo[s] = v.to;
        });
      } else if (n) {
        cards.forEach(function (c) { c.remove(); });
        if (v.articles) { del = slugs; del.forEach(function (s) { delete state.art[s]; }); allCards().forEach(function (c) { if (del.indexOf(cardSlug(c)) >= 0) c.remove(); }); }
        removedIds.forEach(function (r) { fallback[r] = isSub ? sec.id : ""; });
      }
      if (state.targetCat && removedIds.indexOf(state.targetCat) >= 0) setTarget(null);
      if (isSub) { if (box) box.remove(); el.remove(); } else el.remove();
      setSelected(null); fixEmptyBoxes(); rebuildTocFromDom(); markDirty(); closeSubs();
      var kind = isSub ? "subsection" : "section";
      var tail = !n ? "" : v.cards === "move" ? "; " + plural(n, "card") + " moved to \u201c" + toLabel + "\u201d" : "; " + plural(n, "card") + " deleted" + (del.length ? " with " + plural(del.length, "article") : "");
      return commitWithDeletes({ slugs: del, sections: isSub ? [] : [id], anchors: removedIds, moveTo: moveTo, fallback: fallback,
        message: "Index: delete " + kind + " \u201c" + label + "\u201d" + tail + " [edit-mode]", done: "Deleted the " + kind + " \u201c" + label + "\u201d" + tail + ". " });
    });
  }

  function closeSubs() { var p = $("ee-idx-subs"); if (p) p.remove(); }
  function positionSubs() {
    var p = $("ee-idx-subs"), b = $("ee-bar"); if (!p) return;
    var top = window.innerHeight;
    if (b && b.getClientRects().length) top = b.getBoundingClientRect().top;
    p.style.bottom = Math.max(8, Math.round(window.innerHeight - top + 10)) + "px";
  }
  function renderSubs(parent) {
    var p = $("ee-idx-subs"); if (!p) return;
    var secs = catSections();
    if (!parent || !document.getElementById(parent)) parent = (secs[0] || {}).id;
    p.setAttribute("data-parent", parent);
    var sec = document.getElementById(parent), list = sec ? subsOf(sec) : [];
    p.innerHTML = '<div class="ee-subs-row"><label class="ee-subs-l">Section <select id="ee-sub-parent" class="ee-field">' +
      secs.map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === parent ? " selected" : "") + '>' + esc(((s.querySelector(":scope > h2") || {}).textContent || s.id).trim()) + '</option>'; }).join("") +
      '</select></label><input type="text" id="ee-sub-name" class="ee-field" placeholder="New subsection name" autocomplete="off" spellcheck="true">' +
      '<button type="button" class="ee-btn ee-primary" id="ee-sub-add">Add</button><button type="button" class="ee-btn" id="ee-sub-close">Done</button></div>' +
      '<div class="ee-subs-row ee-subs-sec"><button type="button" class="ee-btn ee-danger" id="ee-sec-del">Delete this section\u2026</button></div>' +
      '<ul id="ee-sub-list">' + (list.length ? list.map(function (h, i) {
        var box = h.nextElementSibling, n = box && box.classList.contains("index-cards") ? box.querySelectorAll("a.index-card").length : 0;
        return '<li data-sub="' + esc(h.id) + '"><span class="ee-sub-name">' + esc(h.textContent.trim()) + '</span><span class="ee-sub-n">' + n + ' card' + (n === 1 ? "" : "s") + '</span>' +
          '<button type="button" class="ee-btn" data-act="go" aria-label="Show it">Show</button>' +
          '<button type="button" class="ee-btn" data-act="up" aria-label="Move up"' + (i === 0 ? " disabled" : "") + '>\u2191</button>' +
          '<button type="button" class="ee-btn" data-act="down" aria-label="Move down"' + (i === list.length - 1 ? " disabled" : "") + '>\u2193</button>' +
          '<button type="button" class="ee-btn" data-act="del" aria-label="Delete">\u2715</button></li>';
      }).join("") : '<li class="ee-sub-none">No subsections in this section yet.</li>') + '</ul>' +
      '<p class="ee-note">Rename a subsection by clicking its heading on the page.</p>';
    $("ee-sub-parent").onchange = function () { renderSubs(this.value); positionSubs(); };
    var add = function () {
      var v = $("ee-sub-name").value;
      if (!String(v || "").trim()) { $("ee-sub-name").focus(); return; }
      addSubsection(p.getAttribute("data-parent"), v);
      renderSubs(p.getAttribute("data-parent")); positionSubs();
    };
    $("ee-sub-add").onclick = add;
    $("ee-sec-del").onclick = function () { deleteSectionFlow(p.getAttribute("data-parent")); };
    $("ee-sub-name").onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); add(); } };
    $("ee-sub-close").onclick = function () { closeSubs(); barMsg(); };
    Array.prototype.forEach.call(p.querySelectorAll("#ee-sub-list [data-act]"), function (btn) {
      btn.onclick = function () {
        var id = btn.closest("li").getAttribute("data-sub"), act = btn.getAttribute("data-act");
        if (act === "up") moveSubsection(id, -1);
        else if (act === "down") moveSubsection(id, 1);
        else if (act === "del") { deleteSectionFlow(id); return; }
        else if (act === "go") { var h = document.getElementById(id); if (h) h.scrollIntoView({ block: "center" }); setSelected(null); setTarget(id); }
        renderSubs(p.getAttribute("data-parent")); positionSubs();
      };
    });
  }
  function openSubs() {
    if (!state.active) return;
    var p = $("ee-idx-subs");
    if (!p) { p = document.createElement("div"); p.id = "ee-idx-subs"; p.setAttribute("role", "region"); p.setAttribute("aria-label", "Subsections"); p.setAttribute("data-ee-ui", "1"); document.body.appendChild(p); }
    var from = state.targetCat || (state.selected && categoryOf(state.selected)) || (location.hash || "").slice(1);
    var sec = sectionOfId(from);
    renderSubs(sec ? sec.id : null);
    positionSubs();
  }
  // Clicking an empty subsection (or the empty space of a section's box) makes it the target for Add card.
  function onBoxClick(e) {
    if (!state.active) return;
    var t = e.target;
    if (!t.closest || t.closest("a.index-card") || t.closest(".ee-index-heading") || t.closest("#ee-bar,#ee-idx-subs")) return;
    var box = t.closest("main.index-flow .index-cards");
    if (!box) return;
    var prev = box.previousElementSibling, id = prev && prev.classList.contains("index-sub") ? prev.id : (box.closest("section.index-cat") || {}).id;
    if (!id) return;
    setSelected(null); setTarget(id);
    var h = document.getElementById(id), name = h ? (h.querySelector("h2") || h).textContent.trim() : id;
    barMsg("\u201c" + name + "\u201d selected \u00b7 Add card puts the new card here");
  }

  function enableHeaderEdit() {
    Array.prototype.forEach.call(document.querySelectorAll("main.index-flow section.index-cat > h2, main.index-flow h3.index-sub"), function (h) {
      h.setAttribute("contenteditable", "true");
      h.setAttribute("spellcheck", "true");
      h.classList.add("ee-index-heading");
      h.setAttribute("data-ee-was", (h.textContent || "").replace(/\s+/g, " ").trim());
      h.addEventListener("keydown", onHeadingKey);
      h.addEventListener("blur", onHeadingBlur);
    });
  }
  function disableHeaderEdit() {
    Array.prototype.forEach.call(document.querySelectorAll(".ee-index-heading"), function (h) {
      h.removeAttribute("contenteditable");
      h.removeAttribute("spellcheck");
      h.classList.remove("ee-index-heading");
      h.removeAttribute("data-ee-was");
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
    if (!text) { h.textContent = h.getAttribute("data-ee-was") || h.id || "Category"; return; }
    if (text === h.getAttribute("data-ee-was")) return; // focus/blur without a change
    h.textContent = text;
    h.setAttribute("data-ee-was", text);
    rebuildTocFromDom();
    markDirty();
  }

  function clearDragMarks() {
    document.documentElement.classList.remove("ee-idx-dragging");
    Array.prototype.forEach.call(document.querySelectorAll(".ee-index-dragover, .ee-index-dragging, .ee-index-before, .ee-index-after"), function (n) {
      n.classList.remove("ee-index-dragover", "ee-index-dragging", "ee-index-before", "ee-index-after");
    });
  }
  var dragCard = null;
  function hasFiles(e) { var t = e.dataTransfer && e.dataTransfer.types; return !!t && Array.prototype.indexOf.call(t, "Files") >= 0; }
  function onDragStart(e) {
    if (!state.active) return;
    var card = e.target.closest && e.target.closest("a.index-card");
    if (!card || !cardsRoot().contains(card) || state.busy) { if (state.active) e.preventDefault(); return; }
    stripLore(card);
    setSelected(card);
    dragCard = card;
    e.dataTransfer.setData("text/ee-card-id", card.id);
    e.dataTransfer.effectAllowed = "move";
    card.classList.add("ee-index-dragging");
    document.documentElement.classList.add("ee-idx-dragging");
  }
  function onDragEnd() { dragCard = null; scrollV = 0; clearDragMarks(); }
  // Where a drop at (x, y) lands: before/after the card under the pointer, or the end of a box.
  function dropTarget(e) {
    var t = e.target.nodeType === 1 ? e.target : e.target.parentElement;
    var card = t && t.closest && t.closest("a.index-card");
    var box = card ? card.parentElement : (t && t.closest && t.closest(".index-cards"));
    if (!box || !box.classList.contains("index-cards") || !cardsRoot().contains(box)) return null;
    var after = false;
    if (card) {
      var r = card.getBoundingClientRect();
      var next = card.nextElementSibling, sameRow = next && Math.abs(next.getBoundingClientRect().top - r.top) < 4;
      var prev = card.previousElementSibling, rowish = sameRow || (prev && Math.abs(prev.getBoundingClientRect().top - r.top) < 4);
      after = rowish ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2;
    }
    return { box: box, card: card, after: after };
  }
  // Scroll the page while a card is held near the top or bottom edge (long Index, far sections).
  var scrollT = 0, scrollV = 0;
  function edgeScroll(y) {
    var top = 140, bottom = window.innerHeight - 70;
    scrollV = y < top ? -Math.ceil((top - y) / 6) : y > bottom ? Math.ceil((y - bottom) / 4) : 0;
    if (scrollV && !scrollT) scrollT = setInterval(function () {
      if (!scrollV || !dragCard) { clearInterval(scrollT); scrollT = 0; return; }
      window.scrollBy(0, scrollV);
    }, 16);
  }
  function onDragOver(e) {
    if (!state.active) return;
    // Never let the browser handle a drop while organizing (it would open the link or file).
    e.preventDefault();
    if (dragCard) edgeScroll(e.clientY);
    var files = hasFiles(e);
    if (e.dataTransfer) e.dataTransfer.dropEffect = files || dragCard ? (files ? "copy" : "move") : "none";
    Array.prototype.forEach.call(document.querySelectorAll(".ee-index-dragover, .ee-index-before, .ee-index-after"), function (n) { n.classList.remove("ee-index-dragover", "ee-index-before", "ee-index-after"); });
    var d = dropTarget(e);
    if (!d) return;
    if (files) { if (d.card) d.card.classList.add("ee-index-dragover"); return; }
    if (!dragCard) return;
    if (d.card && d.card !== dragCard) d.card.classList.add(d.after ? "ee-index-after" : "ee-index-before");
    else if (!d.card) d.box.classList.add("ee-index-dragover");
  }
  function onDrop(e) {
    if (!state.active) return;
    e.preventDefault();
    e.stopPropagation();
    var d = dropTarget(e);
    if (hasFiles(e)) {
      var f = e.dataTransfer.files && e.dataTransfer.files[0];
      clearDragMarks();
      if (!d || !d.card) { barMsg("Drop the image on the card it is for."); return; }
      if (f) { setSelected(d.card); setArtFile(d.card, f); }
      return;
    }
    var id = e.dataTransfer.getData("text/ee-card-id");
    var card = dragCard || (id && document.getElementById(id));
    dragCard = null; scrollV = 0;
    clearDragMarks();
    if (!card || !d) return;
    if (d.card === card) return; // dropped on itself: stays where it was
    var before = d.card ? (d.after ? d.card.nextElementSibling : d.card) : null;
    if (before === card) return; // already right there
    while (before && !(before.matches && before.matches("a.index-card"))) before = before.nextElementSibling;
    var catId = null, box = d.box;
    var prev = box.previousElementSibling;
    if (prev && prev.classList.contains("index-sub")) catId = prev.id;
    else { var sec = box.closest("section.index-cat"); catId = sec && sec.id; }
    if (!catId) return;
    moveCardToCategory(card, catId, before);
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

  /* New article for a new card: built from a current article on the site (its chrome, scripts and
     their versions), with this card's name, an empty hero ("no-art", gets the card's art when you
     add some) and an empty Lore section. Both copies (articles/<slug>/index.html for the pretty
     URL and articles/<slug>.html) are written, like every other article. */
  var TEMPLATE_ARTICLE = "articles/aghor/index.html";
  function articleFromTemplate(tpl, name, catId, secId, artTpl) {
    var title = esc(name), T = tpl;
    var root = M.parse(T);
    var hero = findSrc(root, function (n) { return n.tag === "section" && cls(n, "art-hero"); });
    var main = findSrc(root, function (n) { return n.tag === "main" && cls(n, "art-body"); });
    var head = findSrc(root, function (n) { return n.tag === "head"; });
    if (!hero || !main || !head || main.start < hero.end) throw new Error("template");
    var dossier = artTpl && Media && Media.templateDossierHtml ? Media.templateDossierHtml(artTpl, name) : "";
    var mainOut = T.slice(main.start, main.openEnd) + (dossier ? "\n" + dossier : "") + '\n<section class="art-sec" id="lore"><h2>Lore</h2><p class="art-life"></p></section>\n' + T.slice(main.closeStart, main.end);
    var heroOut = '<section class="art-hero no-art"><div class="art-title"><h1>' + title + '</h1><p class="art-epithet"></p></div></section>';
    T = T.slice(0, hero.start) + heroOut + T.slice(hero.end, main.start) + mainOut + T.slice(main.end);
    var headEnd = T.indexOf("</head>");
    var headTxt = T.slice(0, headEnd)
      .replace(/<title>[\s\S]*?<\/title>/i, "<title>" + title + " - Elorae</title>")
      .replace(/\n?<meta\s+(?:name="(?:description|twitter:[^"]*)"|property="og:[^"]*")[^>]*>/gi, "")
      .replace(/(<title>[^<]*<\/title>)/i, '$1\n<meta name="description" content="' + title + '">');
    T = headTxt + T.slice(headEnd);
    T = T.replace(/(<a class="art-back" href=")[^"]*(")/, "$1/index/ancients/#" + esc(catId) + "$2");
    // Category rail: highlight this card's category.
    T = T.replace(/(<nav class="art-index-panel"[\s\S]*?<\/nav>)/, function (nav) {
      nav = nav.replace(/<a class="on" href=/g, '<a class="" href=').replace(/class="toc-name on"/g, 'class="toc-name"').replace(/class="toc-cat open"/g, 'class="toc-cat"').replace(/ aria-expanded="true"/g, ' aria-expanded="false"');
      var railId = String(secId || catId);
      return nav.replace(new RegExp('<a class="" href="/index/ancients/#' + railId.replace(/[^\w-]/g, "") + '"'), '<a class="on" href="/index/ancients/#' + esc(railId) + '"');
    });
    return T;
  }
  function articleFallback(name, catId, artTpl) {
    var dossier = artTpl && Media && Media.templateDossierHtml ? Media.templateDossierHtml(artTpl, name) + "\n" : "";
    var title = esc(name);
    return '<!doctype html>\n<html lang="en">\n<head>\n<script src="/session-gate.js?v=jason-ghost"><\/script>\n<script src="/back-scroll.js?v=bs1"><\/script>\n\n<meta charset="utf-8">\n' +
      '<script src="/img.js?v=img-resize"><\/script>\n<script src="/cats-rail-boot.js?v=art74"><\/script>\n' +
      '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<title>' + title + ' - Elorae</title>\n' +
      '<meta name="description" content="' + title + '">\n<link rel="stylesheet" href="/styles.css?v=wide1">\n<link rel="stylesheet" href="/html.css?v=af1">\n' +
      '<script src="/rail-toggle.js?v=nfs1"><\/script>\n<script src="/skip-link.js?v=fs12"><\/script>\n<link rel="icon" href="/favicon.svg">\n</head>\n<body class="article">\n' +
      '<div class="mast"><header class="topbar"><span class="mark"></span><form action="/search/"><input id="seek" name="q" type="search" placeholder="Search" aria-label="Search"></form><nav class="filters"><a class="" href="/atlas/">Atlas</a><a class="" href="/codex/lore/">Codex</a><a class="active" href="/index/ancients/">Index</a><a class="" href="/journal/">Journal</a></nav></header></div>\n' +
      '<a class="art-back" href="/index/ancients/#' + esc(catId) + '">Index</a>\n' +
      '<section class="art-hero no-art"><div class="art-title"><h1>' + title + '</h1><p class="art-epithet"></p></div></section>\n' +
      '<main class="art-body">\n' + dossier + '<section class="art-sec" id="lore"><h2>Lore</h2><p class="art-life"></p></section>\n</main>\n' +
      '<script src="/search.js?v=fs12"><\/script><script src="/login.js?v=jason-ghost"><\/script><script src="/player-mark.js?v=pretty-urls"><\/script>\n' +
      '<canvas id="friend-glow"></canvas>\n<script src="/glow.js?v=jason-ghost"><\/script>\n<script src="/art-index.js?v=rd1"><\/script>\n<script src="/rail-sections.js?v=rd2"><\/script>\n' +
      '<script src="/article-siblings.js?v=fs12"><\/script>\n<script src="/related-articles.js?v=editor-batch2"><\/script>\n' +
      '<script src="/peek.js?v=bs1" defer><\/script>\n<script src="/art-fit.js?v=af1" defer><\/script>\n<script src="/edit/edit.js?v=' + EDIT_V + '" defer><\/script>\n</body>\n</html>\n';
  }
  var EDIT_V = (function () { var s = document.querySelector('script[src*="edit/edit.js"]'); var m = s && /[?&]v=([\w-]+)/.exec(s.getAttribute("src")); return m ? m[1] : "af1"; })();
  function newArticle(name, catId, secId, artTpl) {
    return E.getFile(TEMPLATE_ARTICLE).then(function (f) {
      try { return articleFromTemplate(f.text, name, catId, secId, artTpl); } catch (e) { return articleFallback(name, catId, artTpl); }
    }, function () { return articleFallback(name, catId, artTpl); });
  }
  /* Add card: after the name, pick the new article's template (None or a type from
     Media.ART_TEMPLATES); the article then starts with that type's Dossier fields, empty. */
  function chooseTemplate(name) {
    var list = (Media && Media.ART_TEMPLATES) || [];
    if (!list.length) return Promise.resolve("");
    return new Promise(function (resolve) {
      var old = $("ee-tpl-pick"); if (old) old.remove();
      var box = document.createElement("div");
      box.id = "ee-tpl-pick"; box.className = "ee-tpl-pick"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Template");
      box.innerHTML = '<div class="ee-tpl-menu ee-tpl-pop"><div class="ee-tpl-head">Template for \u201c' + esc(name) + '\u201d</div>' +
        [{ id: "", label: "None" }].concat(list).map(function (t) {
          return '<button type="button" class="ee-tpl-item" data-tpl="' + esc(t.id) + '">' + esc(t.label) + "</button>";
        }).join("") + '<button type="button" class="ee-tpl-cancel" data-tpl-cancel="1">Cancel</button></div>';
      document.body.appendChild(box);
      function done(v) { box.remove(); document.removeEventListener("keydown", onKey, true); resolve(v); }
      function onKey(e) { if (e.key === "Escape") { e.preventDefault(); done(null); } }
      document.addEventListener("keydown", onKey, true);
      box.addEventListener("click", function (e) {
        if (e.target === box || e.target.closest("[data-tpl-cancel]")) { done(null); return; }
        var it = e.target.closest("[data-tpl]"); if (it) done(it.getAttribute("data-tpl"));
      });
      var first = box.querySelector("[data-tpl]"); if (first) first.focus();
    });
  }

  function addCardPrompt() {
    if (state.busy) return;
    var name = window.prompt("New card name");
    if (name == null) return;
    name = String(name).replace(/\s+/g, " ").trim();
    if (!name) return;
    chooseTemplate(name).then(function (artTpl) { if (artTpl != null) addCardNamed(name, artTpl); });
  }
  function addCardNamed(name, artTpl) {
    if (state.busy) return;
    var slug = slugify(name);
    var catId = state.targetCat || (state.selected && categoryOf(state.selected)) ||
      ((location.hash || "").replace(/^#/, "")) ||
      (catSections()[0] && catSections()[0].id) || "ancients";
    if (!cardsContainerFor(catId)) {
      // hash might be a card id
      var maybe = document.getElementById(catId);
      if (maybe && maybe.classList.contains("index-card")) catId = categoryOf(maybe);
      if (!cardsContainerFor(catId)) catId = catSections()[0].id;
    }
    function taken(sl) {
      return allCards().some(function (c) { return cardSlug(c) === sl; }) || !!document.getElementById(catId + "-" + sl);
    }
    var n = 2, base = slug;
    while (taken(slug)) { slug = base + "-" + n; n++; }
    var artPath = "articles/" + slug + "/index.html", artCopy = "articles/" + slug + ".html";
    barMsg("Creating “" + name + "”…", "ee-busy");
    state.busy = true;
    Promise.all([E.getFile(artPath).then(function () { return true; }, function (err) { if (err && err.status && err.status !== 404) throw err; return false; }),
                 E.getFile(artCopy).then(function () { return true; }, function (err) { if (err && err.status && err.status !== 404) throw err; return false; })])
    .then(function (ex) {
      if (ex[0] || ex[1]) { state.busy = false; barMsg("articles/" + slug + " already exists. Pick another name.", "ee-bad-bar"); return; }
      var secEl = sectionOfId(catId);
      return newArticle(name, catId, secEl && secEl.id, artTpl).then(function (html) {
        var box = cardsContainerFor(catId);
        Array.prototype.forEach.call(box.querySelectorAll("p.index-empty"), function (x) { x.remove(); });
        var a = document.createElement("a");
        a.className = "index-card no-art";
        a.id = catId + "-" + slug;
        a.href = "/articles/" + slug + "/";
        a.innerHTML = "<span>" + esc(name) + "</span>";
        a.setAttribute("draggable", "true");
        a.classList.add("ee-index-draggable");
        box.appendChild(a);
        setSelected(a);
        rebuildTocFromDom();
        state.dirty = true;
        state.busy = false;
        // One commit: the card (with any other Index changes so far) + both article copies.
        return saveIndex({ extra: [{ path: artPath, text: html }, { path: artCopy, text: html }], newSlug: slug,
          message: "Index: add card “" + name + "” + articles/" + slug + " [edit-mode]", done: "Added “" + name + "”. " }).then(function (ok) {
          if (ok === false) { a.remove(); rebuildTocFromDom(); setSelected(null); }
        });
      });
    }).catch(function (err) {
      state.busy = false;
      barMsg(err.message || "Add card failed.", "ee-bad-bar");
    });
  }

  /* Save hygiene: untouched sections/cards are copied byte-for-byte from the source;
     runtime state (nav-fade, inline styles, flipped cards, image fallbacks, TOC
     highlight/pin state, editing classes) never reaches the file. */
  var M = window.EloraeSrcMap;
  var RUNTIME_CLASS = /^(nav-fade[\w-]*|ee-index-[\w-]+|is-lore-flipped|ix-hide|peek-on)$/; // incl. ee-index-target / -drop
  function imgKey(src) {
    var s = String(src || "").trim().replace(/^https?:\/\/[^\/]+/i, "").replace(/^\/cdn-cgi\/image\/[^\/]+/i, "");
    try { s = decodeURI(s); } catch (e) {}
    return s;
  }
  function stripRuntime(root, mode) {
    Array.prototype.forEach.call(root.querySelectorAll(".card-lore-back"), function (n) { n.remove(); });
    [root].concat(Array.prototype.slice.call(root.querySelectorAll("*"))).forEach(function (n) {
      if (n.hasAttribute("class")) {
        var kc = Array.prototype.filter.call(n.classList, function (c) { return !RUNTIME_CLASS.test(c); });
        if (kc.length) n.setAttribute("class", kc.join(" ")); else if (!n.matches("a")) n.removeAttribute("class"); else n.setAttribute("class", "");
      }
      if (n.matches("a.index-card")) n.removeAttribute("aria-expanded");
      if (n.tagName === "IMG" && /^blob:/.test(n.getAttribute("src") || "")) {
        // A picture shown from memory: its real file, or nothing (card art is written separately).
        var real = n.getAttribute("data-eimg-orig");
        if (!real) { n.remove(); return; }
        n.setAttribute("src", real); n.removeAttribute("srcset"); n.removeAttribute("sizes");
      }
      if (n.tagName === "IMG" && mode === "canon") {
        n.setAttribute("src", imgKey(n.getAttribute("data-eimg-orig") || n.getAttribute("src")));
        n.removeAttribute("srcset"); n.removeAttribute("sizes");
      }
      Array.prototype.slice.call(n.attributes).forEach(function (a) {
        if (a.name === "style" || a.name === "draggable" || a.name === "contenteditable" || a.name === "spellcheck" || /^data-(ee|eimg)-/.test(a.name)) n.removeAttribute(a.name);
      });
    });
    return root;
  }
  function canonSection(sec) { return stripRuntime(sec.cloneNode(true), "canon").outerHTML.replace(/\s+/g, " "); }
  function fixSvg(html) {
    return html.replace(/<(polyline|path|line|circle|rect|polygon)(\b[^>]*?)><\/\1>/g, "<$1$2/>");
  }
  function findSrc(n, test) {
    if (test(n)) return n;
    var k = n.children || [];
    for (var i = 0; i < k.length; i++) { var d = findSrc(k[i], test); if (d) return d; }
    return null;
  }
  function eachSrc(n, fn) { fn(n); (n.children || []).forEach(function (c) { eachSrc(c, fn); }); }
  function cls(n, c) { return (n.classes || []).indexOf(c) >= 0; }
  function setRawId(raw, id) {
    return raw.replace(/^(<a\b[^>]*?\sid\s*=\s*")([^"]*)(")/i, function (m, a, _o, c) { return a + id + c; });
  }
  var sectionCanon0 = {};
  function rememberStart() {
    sectionCanon0 = {};
    catSections().forEach(function (sec) { if (sec.id) sectionCanon0[sec.id] = canonSection(sec); });
    state.tocRebuilt = false;
  }
  function buildIndexHtml(text) {
    var root = M.parse(text);
    var sMain = findSrc(root, function (n) { return n.tag === "main" && cls(n, "index-flow"); });
    var sToc = findSrc(root, function (n) { return n.tag === "nav" && n.id === "index-toc-panel"; });
    var liveMain = document.querySelector("main.index-flow"), liveToc = document.querySelector("#index-toc-panel");
    if (!sMain || !liveMain) throw new Error("Index main landmark missing in source.");
    if (!sToc || !liveToc) throw new Error("Index TOC missing in source.");
    var raw = function (n) { return text.slice(n.start, n.end); };
    var srcSecs = {}, srcCards = {}, srcImgs = {};
    eachSrc(sMain, function (n) {
      if (n.tag === "section" && cls(n, "index-cat") && n.id) srcSecs[n.id] = n;
      if (n.tag === "a" && cls(n, "index-card") && n.attrs && n.attrs.href) srcCards[n.attrs.href] = n;
      if (n.tag === "img" && n.attrs && n.attrs.src) srcImgs[imgKey(n.attrs.src)] = n.attrs;
    });
    var subs = [];
    function ph(str) { subs.push(str); return '<i data-ee-raw="' + (subs.length - 1) + '"></i>'; }
    var clone = stripRuntime(liveMain.cloneNode(true), "emit");
    var liveSecs = catSections();
    Array.prototype.slice.call(clone.querySelectorAll("section.index-cat")).forEach(function (sec, i) {
      var live = liveSecs[i], s = sec.id && srcSecs[sec.id];
      if (s && live && sectionCanon0[sec.id] && canonSection(live) === sectionCanon0[sec.id]) {
        sec.outerHTML = ph(raw(s));
        return;
      }
      Array.prototype.slice.call(sec.querySelectorAll("a.index-card")).forEach(function (card) {
        var sc = srcCards[card.getAttribute("href")];
        if (sc) { card.outerHTML = ph(setRawId(raw(sc), card.id)); return; }
        Array.prototype.forEach.call(card.querySelectorAll("img"), function (im) {
          var sa = srcImgs[imgKey(im.getAttribute("src"))];
          if (sa) ["src", "srcset", "sizes", "decoding", "loading"].forEach(function (a) { if (sa[a] != null) im.setAttribute(a, sa[a]); });
        });
      });
    });
    var inner = fixSvg(clone.innerHTML).replace(/<i data-ee-raw="(\d+)"><\/i>/g, function (_, k) { return subs[Number(k)]; });
    var mainOut = text.slice(sMain.start, sMain.openEnd) + inner + text.slice(sMain.closeStart, sMain.end);
    var tocOut = raw(sToc);
    if (state.tocRebuilt) {
      var tc = stripRuntime(liveToc.cloneNode(true), "emit");
      var sOn = findSrc(sToc, function (n) { return n.tag === "a" && cls(n, "on"); });
      Array.prototype.forEach.call(tc.querySelectorAll("a.on"), function (a) { a.classList.remove("on"); });
      if (sOn && sOn.attrs.href) {
        var want = tc.querySelector('a[href="' + sOn.attrs.href.replace(/"/g, "") + '"]');
        if (want) want.classList.add("on");
      }
      var sHead = findSrc(sToc, function (n) { return cls(n, "index-toc-head"); });
      var head = tc.querySelector(".index-toc-head");
      subs = [];
      if (sHead && head) head.outerHTML = ph(raw(sHead));
      tocOut = text.slice(sToc.start, sToc.openEnd) +
        fixSvg(tc.innerHTML).replace(/<i data-ee-raw="(\d+)"><\/i>/g, function (_, k) { return subs[Number(k)]; }) +
        text.slice(sToc.closeStart, sToc.end);
    }
    var edits = [{ start: sMain.start, end: sMain.end, html: mainOut }, { start: sToc.start, end: sToc.end, html: tocOut }]
      .sort(function (a, b) { return b.start - a.start; });
    var out = text;
    edits.forEach(function (e) { out = out.slice(0, e.start) + e.html + out.slice(e.end); });
    return out;
  }

  // Every card exactly once, in the order shown (guards against lost or doubled cards).
  function cardHrefs(root) { return Array.prototype.map.call(root.querySelectorAll("a.index-card"), function (a) { return a.getAttribute("href"); }); }
  function checkCards(html) {
    var d = new DOMParser().parseFromString(html, "text/html");
    var main = d.querySelector("main.index-flow");
    var want = cardHrefs(cardsRoot()), got = main ? cardHrefs(main) : [];
    if (want.join("\n") !== got.join("\n")) throw new Error("Safety check failed (the saved Index would not match the cards on screen). Nothing was saved.");
  }
  function isTwin(a, b) { return a === b; }
  /* The organizer writes the cards as they are on screen. A card's name/epithet the organizer did
     not touch (same as when it opened) keeps what main says now, so an article rename saved
     meanwhile (another tab, a player PR merged) is never reverted by an Index save. */
  function keepSavedNames(html, fresh) {
    if (!Media || !Media.cardNames || !snapshot || !snapshot.names) return html;
    var now = Media.cardNames(fresh), shown = Media.cardNames(html);
    Object.keys(now).forEach(function (k) {
      var was = snapshot.names[k], cur = shown[k], up = now[k];
      if (!was || !cur || !up) return;
      var nameOk = cur.name === was.name && up.name && up.name !== cur.name;
      var epOk = cur.ep === was.ep && up.ep !== cur.ep;
      if (nameOk || epOk) html = Media.renameIndexCards(html, k, cur.name, nameOk ? up.name : cur.name, cur.ep, epOk ? up.ep : cur.ep, true);
    });
    return html;
  }
  /* One commit for everything: both Index copies, new card articles (opts.extra), new art
     (image + catalog) and the articles' hero art. Resolves false when nothing was saved. */
  function saveIndex(opts) {
    opts = opts || {};
    if (state.busy) return Promise.resolve(false);
    if (state.artBusy) { barMsg("Still preparing an image… try Save again in a moment."); return Promise.resolve(false); }
    if (!state.dirty && !opts.extra && !opts.force) { barMsg("No changes to save."); return Promise.resolve(false); }
    state.busy = true;
    barMsg(opts.extra ? "Creating…" : "Saving Index…", "ee-busy");
    var mp = P.mirrorPath ? P.mirrorPath(PATH) : null;
    var art = state.art, slugs = Object.keys(art);
    var remembered = [], images = [], assetFor = {};
    var who = (state.profile && state.profile.person) || "devin";
    /* One try = read the latest main, rebuild both Index copies from it plus what is on screen,
       commit with that commit as parent. If someone else pushed in between, GitHub refuses the
       ref update and E.retrySave runs the try again on the new main (up to 3 more times). */
    var attemptOnce = function () {
    remembered = []; images = []; assetFor = {};
    var extra = (opts.extra || []).map(function (x) { return Object.assign({}, x); });
    var ref;
    return E.headSha(E.BRANCH).then(function (sha) { ref = sha; return E.getFile(PATH, ref); }).then(function (f) {
      var html = keepSavedNames(buildIndexHtml(f.text), f.text);
      return (opts.prepare ? opts.prepare(html, ref) : Promise.resolve(null)).then(function (pr) {
      if (pr && pr.html) html = pr.html;
      if (pr && pr.files) extra = extra.concat(pr.files);
      var catalogP = slugs.some(function (k) { return art[k].file; })
        ? E.getFile(Media.CATALOG, ref).then(function (c) { return JSON.parse(c.text); }, function () { return { version: 1, media: {} }; })
        : Promise.resolve(null);
      return catalogP.then(function (catalog) {
        var files = [];
        slugs.forEach(function (k) {
          var a = art[k];
          if (a.asset) { assetFor[k] = a.asset; return; }
          var prep = Media.prepareUpload(catalog, a.info, { title: a.name, tags: ["card"], owner: who, uploadedBy: who, everyone: true, allowed: Media.PEOPLE.slice() });
          catalog = prep.catalog;
          files.push(prep.files[1]);
          assetFor[k] = prep.entry.path;
          images.push({ path: prep.entry.path, blob: a.info.blob || a.file });
        });
        if (catalog) files.unshift({ path: Media.CATALOG, text: JSON.stringify(catalog, null, 2) + "\n" });
        slugs.forEach(function (k) { html = Media.setCardArt(html, k, assetFor[k]); });
        checkCards(html);
        var arts = slugs.filter(function (k) { return art[k].hero; }).map(function (k) {
          var paths = ["articles/" + k + "/index.html", "articles/" + k + ".html"];
          return Promise.all(paths.map(function (p) {
            var made = extra.filter(function (x) { return x.path === p; })[0];
            if (made) { made.text = Media.setHeroArt(made.text, assetFor[k], art[k].name) || made.text; return null; }
            return E.getFile(p, ref).then(function (af) {
              var out = Media.setHeroArt(af.text, assetFor[k], art[k].name);
              return out && out !== af.text ? { path: p, text: out, base: af.text } : null;
            }, function () { return null; });
          }));
        });
        var mirrorP = mp ? E.getFile(mp, ref).then(function (m) { return m; }, function () { return null; }) : Promise.resolve(null);
        return Promise.all([mirrorP, Promise.all(arts)]).then(function (res) {
          var m = res[0];
          var changed = html !== f.text;
          var out = [];
          if (changed) { out.push({ path: PATH, text: html }); remembered.push({ path: PATH, text: html, base: f.text }); }
          // The other Index copy always gets the very same file (they must never drift apart).
          if (m && m.text !== html) { out.push({ path: mp, text: html }); remembered.push({ path: mp, text: html, base: m.text }); }
          extra.forEach(function (x) { out.push(x.delete ? { path: x.path, delete: true } : { path: x.path, text: x.text }); });
          res[1].forEach(function (pair) { pair.forEach(function (x) { if (x) { out.push({ path: x.path, text: x.text }); remembered.push(x); } }); });
          out = out.concat(files);
          if (!out.length) return "none";
          return E.commitFiles(out, opts.message || (slugs.length ? "Index: card art + reorganize [edit-mode]" : "Index: reorganize cards [edit-mode]"), E.BRANCH, ref);
        });
      });
      });
    });
    };
    return E.retrySave(attemptOnce, function (n) { barMsg("Someone else saved at the same time \u2014 retrying (" + n + "/3)\u2026", "ee-busy"); }).then(function (res) {
      state.busy = false;
      if (res === "none") { state.dirty = false; barMsg("No changes to save."); return false; }
      state.dirty = false;
      // The new art is not on the site until it rebuilds: keep showing it from memory, but make
      // the page (and the next save) treat it as its real /assets/ file.
      allCards().forEach(function (c) {
        var im = c.querySelector("img[data-ee-art]"), k = cardSlug(c);
        if (!im) return;
        im.removeAttribute("data-ee-art");
        var path = assetFor[k];
        if (path) { im.setAttribute("data-eimg-orig", "/" + path); im.setAttribute("data-eimg-fell", "1"); }
      });
      state.art = {};
      var R = window.EloraeRecent;
      if (R) { R.remember(remembered); if (images.length && R.rememberImages) R.rememberImages(images); }
      rememberStart();
      doneMsg((opts.done || "") + savedAt());
      return true;
    }).catch(function (err) {
      state.busy = false;
      barMsg(err.message || "Save failed.", "ee-bad-bar");
      return false;
    });
  }

  var snapshot = null;
  function start() {
    if (state.active || !isIndexPage()) return false;
    if (!state.profile || !P.isAdmin(state.profile) || !P.canEdit(state.profile, PATH)) return false;
    var wait = window.EloraeRecent && window.EloraeRecent.blocked(PATH);
    if (wait) { barMsg(wait); return false; }
    snapshot = {
      main: document.querySelector("main.index-flow").innerHTML,
      toc: document.querySelector("#index-toc-panel").innerHTML
    };
    snapshot.names = Media && Media.cardNames ? Media.cardNames(snapshot.main) : null;
    state.active = true;
    state.dirty = false;
    rememberStart();
    // Phone: Categories starts closed (it covers the cards); open it from the bar to move a card.
    state.railRestore = E.closePhoneRail ? E.closePhoneRail() : null;
    document.documentElement.classList.add("ee-editing", "ee-index-org");
    enableDrag();
    enableHeaderEdit();
    document.addEventListener("dragstart", onDragStart, true);
    document.addEventListener("dragend", onDragEnd, true);
    document.addEventListener("dragover", onDragOver, true);
    document.addEventListener("drop", onDrop, true);
    document.addEventListener("click", onCardClick, true);
    document.addEventListener("click", onTocClick, true);
    document.addEventListener("click", onBoxClick, true);
    window.addEventListener("resize", positionSubs);
    window.addEventListener("beforeunload", onUnload);
    barMsg("Index organizer · drag cards between categories, or select + Categories");
    var g = $("ee-glyph");
    if (g) g.style.display = "none";
    return true;
  }

  function onUnload(e) {
    if (!state.active || !state.dirty) return;
    e.preventDefault(); e.returnValue = ""; return "";
  }
  function stop() {
    if (!state.active) return;
    document.removeEventListener("dragstart", onDragStart, true);
    document.removeEventListener("dragend", onDragEnd, true);
    document.removeEventListener("dragover", onDragOver, true);
    document.removeEventListener("drop", onDrop, true);
    document.removeEventListener("click", onCardClick, true);
    document.removeEventListener("click", onTocClick, true);
    document.removeEventListener("click", onBoxClick, true);
    window.removeEventListener("resize", positionSubs);
    window.removeEventListener("beforeunload", onUnload);
    closeSubs();
    setTarget(null);
    disableHeaderEdit();
    disableDrag();
    setSelected(null);
    document.documentElement.classList.remove("ee-editing", "ee-index-org");
    if (state.railRestore) { try { state.railRestore(); } catch (e) {} state.railRestore = null; }
    state.active = false;
    var b = $("ee-bar");
    if (b) b.remove();
    var g = $("ee-glyph");
    if (g) g.style.display = "";
  }

  function cancelOrg() {
    Object.keys(state.art || {}).forEach(function (k) { if (state.art[k].url) try { URL.revokeObjectURL(state.art[k].url); } catch (e) {} });
    state.art = {};
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
    active: function () { return state.active; },
    addSubsection: addSubsection,
    get lastPlan() { return state.lastPlan || null; }
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
