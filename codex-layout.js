/* codex-layout.js (cx3: plates as a slim side column): opt-in "Codex" article layout (body.article.art-codex).
   The hero, name and Dossier stay as they are. Below them, the page's own arts become framed
   plates in a horizontal snap row (tap one to fade the hero to it), and the lore gets a sticky
   side box (facts, quote, Related links) beside it.
   View only: everything added here is a generated copy (.cx-gen) — the page source is never
   moved or changed. The originals are only hidden by CSS while html.cx-on is set; the moment
   edit mode starts (html.ee-editing) the copies are removed and the classic layout is back,
   so the editor edits and saves the real sections exactly as before. Rebuilt on leaving edit. */
(function () {
  "use strict";
  var body = document.body, root = document.documentElement;
  if (!body || !body.classList.contains("article") || !body.classList.contains("art-codex")) return;
  var ROM = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];
  var hero = function () { return document.querySelector(".art-hero > img"); };
  function editing() { return root.classList.contains("ee-editing"); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function title() { var h = document.querySelector(".art-title h1"); return h ? h.textContent.trim() : ""; }
  // Caption from the art's file name: "Vaerek, At Ease.png" -> "At Ease"; otherwise its label.
  function caption(src, label) {
    var f = decodeURIComponent(String(src || "").split("?")[0].split("/").pop() || "").replace(/\.[a-z0-9]+$/i, "");
    var i = f.indexOf(", ");
    if (i > 0) return f.slice(i + 2);
    return label || f || title();
  }
  function arts() {
    var bs = Array.prototype.slice.call(document.querySelectorAll(".art-swap-thumbs button[data-src]"));
    if (bs.length) return bs.map(function (b) { return { src: b.getAttribute("data-src"), label: b.getAttribute("aria-label") || b.getAttribute("data-alt") || "", btn: b }; });
    var h = hero();
    return h && h.getAttribute("src") ? [{ src: h.getAttribute("src"), label: h.getAttribute("alt") || "", btn: null }] : [];
  }
  function heading(text) {
    var h = el("h2", "cx-orn"); var s = el("span", null, text);
    h.appendChild(el("i")); h.appendChild(s); h.appendChild(el("i"));
    return h;
  }
  function cssUrl(u) { return 'url("' + String(u).replace(/["\\]/g, "\\$&") + '")'; }

  var row = null;
  function mark(src) {
    if (!row) return;
    Array.prototype.forEach.call(row.children, function (f) { f.classList.toggle("on", f.getAttribute("data-src") === src); });
  }
  function fadeTo(a) {
    var h = hero(); if (!h || h.getAttribute("src") === a.src) return;
    h.style.transition = "opacity .35s ease"; h.style.opacity = "0";
    setTimeout(function () {
      if (a.btn) a.btn.click(); else h.src = a.src;
      h.style.opacity = "1";
    }, 350);
  }

  function buildPlates(lore) {
    var list = arts(); if (!list.length) return;
    // cx3: a slim column inside the lore grid (left of the text on desktop; a compact row on phones).
    var sec = el("aside", "cx-plates cx-gen"); sec.setAttribute("aria-label", "Plates");
    sec.appendChild(el("h3", null, "Plates"));
    row = el("div", "cx-row"); row.tabIndex = 0;
    var cur = (hero() || {}).getAttribute ? hero().getAttribute("src") : "";
    list.forEach(function (a, i) {
      var f = el("figure", "cx-plate" + (a.src === cur ? " on" : "")); f.setAttribute("data-src", a.src);
      var pic = el("span", "cx-pic"); pic.style.backgroundImage = cssUrl(a.src); pic.setAttribute("role", "img"); pic.setAttribute("aria-label", caption(a.src, a.label));
      var cap = el("figcaption"); cap.appendChild(el("span", "cx-cap", caption(a.src, a.label))); cap.appendChild(el("span", "cx-no", "Plate " + (ROM[i] || i + 1)));
      f.appendChild(pic); f.appendChild(cap);
      f.addEventListener("click", function () { if (row.__moved) return; mark(a.src); fadeTo(a); f.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" }); });
      row.appendChild(f);
    });
    if (list.length === 1) sec.classList.add("cx-one");
    sec.appendChild(row);
    var h2 = lore.querySelector(":scope > h2");
    lore.insertBefore(sec, h2 ? h2.nextSibling : lore.firstChild);
    drag(row);
  }
  // Mouse drag swipes the row on desktop (touch and trackpad scroll natively, with snap).
  function drag(r) {
    var down = false, x0 = 0, s0 = 0;
    r.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse" || e.button) return; down = true; r.__moved = false; x0 = e.clientX; s0 = r.scrollLeft; });
    window.addEventListener("pointermove", function (e) {
      if (!down) return; var dx = e.clientX - x0;
      if (!r.__moved && Math.abs(dx) > 5) { r.__moved = true; r.classList.add("cx-drag"); }
      if (r.__moved) r.scrollLeft = s0 - dx;
    });
    window.addEventListener("pointerup", function () {
      if (!down) return; down = false; r.classList.remove("cx-drag");
      setTimeout(function () { r.__moved = false; }, 0);
    });
  }

  function buildSide(lore) {
    var side = el("aside", "cx-side cx-gen"); side.setAttribute("aria-label", "Particulars");
    var facts = lore.querySelector(":scope > ul.art-facts");
    if (facts && facts.children.length) {
      side.appendChild(el("h3", null, "Particulars"));
      var ul = el("ul", "cx-facts");
      Array.prototype.forEach.call(facts.children, function (li) { var n = el("li"); n.innerHTML = li.innerHTML; ul.appendChild(n); });
      side.appendChild(ul);
    }
    var q = lore.querySelector(":scope > blockquote.art-quote");
    if (q) { var c = q.cloneNode(true); c.className = "cx-quote"; c.removeAttribute("id"); side.appendChild(c); }
    var rel = document.getElementById("related");
    if (rel) {
      var group = null;
      Array.prototype.forEach.call(rel.children, function (n) {
        if (n.matches("h2")) return;
        if (n.matches(".art-rel-head, .nt-rel-head, h3, h4, p")) {
          group = el("div", "cx-links"); var h = el("h4", null, n.textContent.trim()); group.appendChild(h); side.appendChild(group); return;
        }
        var links = n.querySelectorAll("a[href]"); if (!links.length) return;
        if (!group) { group = el("div", "cx-links"); group.appendChild(el("h4", null, "Related")); side.appendChild(group); }
        Array.prototype.forEach.call(links, function (a) { var c2 = el("a", null, a.textContent.trim()); c2.href = a.getAttribute("href"); group.appendChild(c2); });
      });
    }
    if (!side.children.length) return;
    var h2 = lore.querySelector(":scope > h2");
    lore.insertBefore(side, h2 ? h2.nextSibling : lore.firstChild);
  }

  function teardown() {
    Array.prototype.forEach.call(document.querySelectorAll(".cx-gen"), function (n) { n.remove(); });
    row = null; root.classList.remove("cx-on");
  }
  function build() {
    teardown();
    if (editing()) return;
    var lore = document.getElementById("lore");
    if (!lore || !document.querySelector("main.art-body")) return;
    buildSide(lore); buildPlates(lore);
    root.classList.add("cx-on");
  }

  build();
  // Edit mode on/off: drop the copies at once; rebuild (from the saved/edited page) when it ends.
  var was = editing();
  new MutationObserver(function () {
    var now = editing(); if (now === was) return; was = now;
    if (now) teardown(); else setTimeout(build, 60);
  }).observe(root, { attributes: true, attributeFilter: ["class"] });
  // Runtime additions to Related (related-articles.js) and hero arrows/keys keep the copies in step.
  var rel = document.getElementById("related");
  if (rel) { var t = 0; new MutationObserver(function () { if (editing()) return; clearTimeout(t); t = setTimeout(build, 120); }).observe(rel, { childList: true, subtree: true }); }
  var h = hero();
  if (h) new MutationObserver(function () { mark(h.getAttribute("src")); }).observe(h, { attributes: true, attributeFilter: ["src"] });
  window.EloraeCodexLayout = { build: build, teardown: teardown };
})();
