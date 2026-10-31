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
      '<span class="ee-msg">' + esc(msg || "Index organizer · drag cards or select + Categories") + '</span>' +
      '<button type="button" class="ee-btn" id="ee-idx-add">Add card</button>' +
      '<button type="button" class="ee-btn" id="ee-idx-art" title="Art for the selected card (or drop an image file on a card)">Art</button>' +
      '<button type="button" class="ee-btn" id="ee-idx-cancel">Cancel</button>' +
      '<button type="button" class="ee-btn ee-primary" id="ee-idx-save">Save</button>';
    $("ee-idx-save").onclick = function () { saveIndex(); };
    $("ee-idx-cancel").onclick = function () {
      if (state.dirty && !window.confirm("Discard your unsaved changes to the Index?")) return;
      cancelOrg();
    };
    $("ee-idx-add").onclick = addCardPrompt;
    $("ee-idx-art").onclick = openCardArt;
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
    state.tocRebuilt = true;
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
  function articleFromTemplate(tpl, name, catId) {
    var title = esc(name), T = tpl;
    var root = M.parse(T);
    var hero = findSrc(root, function (n) { return n.tag === "section" && cls(n, "art-hero"); });
    var main = findSrc(root, function (n) { return n.tag === "main" && cls(n, "art-body"); });
    var head = findSrc(root, function (n) { return n.tag === "head"; });
    if (!hero || !main || !head || main.start < hero.end) throw new Error("template");
    var mainOut = T.slice(main.start, main.openEnd) + '\n<section class="art-sec" id="lore"><h2>Lore</h2><p class="art-life"></p></section>\n' + T.slice(main.closeStart, main.end);
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
      return nav.replace(new RegExp('<a class="" href="/index/ancients/#' + catId.replace(/[^\w-]/g, "") + '"'), '<a class="on" href="/index/ancients/#' + esc(catId) + '"');
    });
    return T;
  }
  function articleFallback(name, catId) {
    var title = esc(name);
    return '<!doctype html>\n<html lang="en">\n<head>\n<script src="/session-gate.js?v=jason-ghost"><\/script>\n\n<meta charset="utf-8">\n' +
      '<script src="/img.js?v=img-resize"><\/script>\n<script src="/cats-rail-boot.js?v=art74"><\/script>\n' +
      '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<title>' + title + ' - Elorae</title>\n' +
      '<meta name="description" content="' + title + '">\n<link rel="stylesheet" href="/styles.css?v=wide1">\n<link rel="stylesheet" href="/html.css?v=nojr1">\n' +
      '<script src="/rail-toggle.js?v=nojr1"><\/script>\n<script src="/skip-link.js?v=fs12"><\/script>\n<link rel="icon" href="/favicon.svg">\n</head>\n<body class="article">\n' +
      '<div class="mast"><header class="topbar"><span class="mark"></span><form action="/search/"><input id="seek" name="q" type="search" placeholder="Search" aria-label="Search"></form><nav class="filters"><a class="" href="/atlas/">Atlas</a><a class="" href="/codex/lore/">Codex</a><a class="active" href="/index/ancients/">Index</a><a class="" href="/journal/">Journal</a></nav></header></div>\n' +
      '<a class="art-back" href="/index/ancients/#' + esc(catId) + '">Index</a>\n' +
      '<section class="art-hero no-art"><div class="art-title"><h1>' + title + '</h1><p class="art-epithet"></p></div></section>\n' +
      '<main class="art-body">\n<section class="art-sec" id="lore"><h2>Lore</h2><p class="art-life"></p></section>\n</main>\n' +
      '<script src="/search.js?v=fs12"><\/script><script src="/login.js?v=jason-ghost"><\/script><script src="/player-mark.js?v=pretty-urls"><\/script>\n' +
      '<canvas id="friend-glow"></canvas>\n<script src="/glow.js?v=jason-ghost"><\/script>\n<script src="/art-index.js?v=art87"><\/script>\n' +
      '<script src="/article-siblings.js?v=fs12"><\/script>\n<script src="/related-articles.js?v=editor-batch2"><\/script>\n' +
      '<script src="/edit/edit.js?v=' + EDIT_V + '" defer><\/script>\n</body>\n</html>\n';
  }
  var EDIT_V = (function () { var s = document.querySelector('script[src*="edit/edit.js"]'); var m = s && /[?&]v=([\w-]+)/.exec(s.getAttribute("src")); return m ? m[1] : "idxart1"; })();
  function newArticle(name, catId) {
    return E.getFile(TEMPLATE_ARTICLE).then(function (f) {
      try { return articleFromTemplate(f.text, name, catId); } catch (e) { return articleFallback(name, catId); }
    }, function () { return articleFallback(name, catId); });
  }

  function addCardPrompt() {
    if (state.busy) return;
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
      return newArticle(name, catId).then(function (html) {
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
  var RUNTIME_CLASS = /^(nav-fade[\w-]*|ee-index-[\w-]+|is-lore-flipped)$/;
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
  /* One commit for everything: both Index copies, new card articles (opts.extra), new art
     (image + catalog) and the articles' hero art. Resolves false when nothing was saved. */
  function saveIndex(opts) {
    opts = opts || {};
    if (state.busy) return Promise.resolve(false);
    if (state.artBusy) { barMsg("Still preparing an image… try Save again in a moment."); return Promise.resolve(false); }
    if (!state.dirty && !opts.extra) { barMsg("No changes to save."); return Promise.resolve(false); }
    state.busy = true;
    barMsg(opts.extra ? "Creating…" : "Saving Index…", "ee-busy");
    var mp = P.mirrorPath ? P.mirrorPath(PATH) : null;
    var art = state.art, slugs = Object.keys(art);
    var remembered = [], images = [], assetFor = {};
    var who = (state.profile && state.profile.person) || "devin";
    return E.getFile(PATH).then(function (f) {
      var html = buildIndexHtml(f.text);
      var catalogP = slugs.some(function (k) { return art[k].file; })
        ? E.getFile(Media.CATALOG).then(function (c) { return JSON.parse(c.text); }, function () { return { version: 1, media: {} }; })
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
            var made = (opts.extra || []).filter(function (x) { return x.path === p; })[0];
            if (made) { made.text = Media.setHeroArt(made.text, assetFor[k], art[k].name) || made.text; return null; }
            return E.getFile(p).then(function (af) {
              var out = Media.setHeroArt(af.text, assetFor[k], art[k].name);
              return out && out !== af.text ? { path: p, text: out, base: af.text } : null;
            }, function () { return null; });
          }));
        });
        var mirrorP = mp ? E.getFile(mp).then(function (m) { return m; }, function () { return null; }) : Promise.resolve(null);
        return Promise.all([mirrorP, Promise.all(arts)]).then(function (res) {
          var m = res[0];
          var changed = html !== f.text;
          var out = [];
          if (changed) { out.push({ path: PATH, text: html }); remembered.push({ path: PATH, text: html, base: f.text }); }
          // The other Index copy always gets the very same file (they must never drift apart).
          if (m && m.text !== html) { out.push({ path: mp, text: html }); remembered.push({ path: mp, text: html, base: m.text }); }
          (opts.extra || []).forEach(function (x) { out.push({ path: x.path, text: x.text }); });
          res[1].forEach(function (pair) { pair.forEach(function (x) { if (x) { out.push({ path: x.path, text: x.text }); remembered.push(x); } }); });
          out = out.concat(files);
          if (!out.length) return "none";
          return E.commitFiles(out, opts.message || (slugs.length ? "Index: card art + reorganize [edit-mode]" : "Index: reorganize cards [edit-mode]"), E.BRANCH);
        });
      });
    }).then(function (res) {
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
    window.removeEventListener("beforeunload", onUnload);
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
