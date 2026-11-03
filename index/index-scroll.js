/* Index rail: Chromium-style category sidebar.
   Desktop (art87): the top-left nav glyph (rail-toggle.js -> window.__railToggle) is the only
   open/close toggle (the left-edge cue arrow is gone) — closed: click opens and it stays open;
   open: click closes. No hover open/close/peek. Open state pushes the
   card grid (body.index-toc-open). Pin sticks the rail open; unpin collapses.
   Pinned / phone-open state persists in localStorage (elorae-cats-rail); default open.
   Clicking a category/subject link does not change open/pinned state.
   Phone: Categories opens from #section-bar .sec-toggle (regular secondary nav); pin hidden;
   tap-outside / Escape closes (and persists).
   Nests stay closed until the chevron is tapped; no card highlight while scrolling. */
(function () {
  var toc = document.querySelector("aside.toc");
  if (!toc) return;
  var panel = toc.querySelector(".index-toc-panel") || toc;
  var pin = toc.querySelector(".index-toc-pin");
  var secToggle = document.querySelector('#section-bar .sec-toggle[data-sec-for="index-toc"]');
  var desk = window.matchMedia("(min-width: 801px)");
  function byHref(a) { return document.getElementById(a.getAttribute("href").slice(1)); }
  var cats = Array.prototype.map.call(toc.querySelectorAll(".toc-cat"), function (box) {
    var link = box.querySelector(".toc-row > a");
    return {
      box: box, link: link, el: link && byHref(link), tog: box.querySelector(".toc-tog")
    };
  }).filter(function (c) { return c.el; });
  if (!cats.length) return;
  var current = null, jump = "";
  /* jump: the section a link or hash just sent the reader to. Near the page bottom the last
     sections can never reach the highlight line, so the jumped-to one wins there until the
     reader scrolls by hand (end1). */
  function dropJump() { jump = ""; }
  ["wheel", "touchstart", "keydown", "mousedown"].forEach(function (t) {
    window.addEventListener(t, function (e) {
      if (t === "mousedown" && e.target.closest && e.target.closest("aside.toc a")) return;
      dropJump();
    }, { passive: true });
  });
  function jumpCat() {
    if (!jump) return null;
    var el = document.getElementById(jump);
    var sec = el && el.closest && el.closest(".index-cat");
    for (var i = 0; i < cats.length; i++) if (cats[i].el === sec) return cats[i];
    return null;
  }

  var boot = window.__catsRail || { key: "elorae-cats-rail", pinned: true, phoneOpen: true };
  var pinned = !!boot.pinned, phoneOpen = !!boot.phoneOpen;

  function persist() {
    try {
      localStorage.setItem(boot.key || "elorae-cats-rail", JSON.stringify({
        pinned: pinned, phoneOpen: phoneOpen
      }));
    } catch (e) {}
    var h = document.documentElement;
    h.classList.toggle("cats-rail-pinned", pinned);
    h.classList.toggle("cats-rail-phone-open", phoneOpen);
    if (window.__catsRail) {
      window.__catsRail.pinned = pinned;
      window.__catsRail.phoneOpen = phoneOpen;
    }
  }

  function setOpen(on) {
    toc.classList.toggle("open", !!on);
    document.body.classList.toggle("index-toc-open", !!on);
    if (secToggle) secToggle.setAttribute("aria-expanded", on ? "true" : "false");
  }
  function setPinned(on) {
    pinned = !!on;
    toc.classList.toggle("pinned", pinned);
    if (pin) {
      pin.setAttribute("aria-pressed", pinned ? "true" : "false");
      pin.setAttribute("aria-label", pinned ? "Unpin categories" : "Pin categories open");
    }
  }
  function focused() {
    var a = document.activeElement;
    /* Keyboard focus inside the panel still reveals it (art79). */
    if (!a || !toc.contains(a)) return false;
    try { return a.matches(":focus-visible"); } catch (e) { return true; }
  }
  function sync() {
    if (pinned) { setOpen(true); return; }
    if (desk.matches) setOpen(focused());
    else setOpen(phoneOpen);
  }
  /* Section open / closed belongs to rail-sections.js (rd1, shared with article pages: the title
     row and the arrow both toggle). Scrolling never opens or closes a section. */
  function layout() {}
  if (pin) {
    pin.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      setPinned(!pinned);
      if (!desk.matches) phoneOpen = pinned;
      sync();
      persist();
    });
  }
  /* Desktop toggle for the top-left nav glyph (rail-toggle.js): same pinned state + persistence
     as before (elorae-cats-rail); returns the new open state. */
  window.__railToggle = function () {
    if (!desk.matches) return null;
    setPinned(!pinned);
    sync();
    persist();
    return pinned;
  };
  window.__railIsOpen = function () { return pinned; };

  if (secToggle) {
    secToggle.addEventListener("click", function (e) {
      if (desk.matches) return;
      e.preventDefault();
      e.stopPropagation();
      phoneOpen = !phoneOpen;
      if (pinned && !phoneOpen) setPinned(false);
      sync();
      persist();
    });
  }

  /* Desktop: open while pinned (nav glyph / pin click) or keyboard-focused inside the panel. */
  toc.addEventListener("focusin", sync);
  toc.addEventListener("focusout", function () { window.setTimeout(sync, 0); });
  document.addEventListener("click", function (e) {
    if (desk.matches) return;
    if (pinned) return;
    if (!toc.classList.contains("open")) return;
    if (e.target.closest && (e.target.closest("aside.toc") || e.target.closest("#section-bar .sec-toggle"))) return;
    phoneOpen = false;
    sync();
    persist();
  }, true);
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var held = toc.contains(document.activeElement);
    if (!toc.classList.contains("open") && !held && !pinned) return;
    phoneOpen = false;
    setPinned(false);
    sync();
    persist();
    if (held && document.activeElement.blur) document.activeElement.blur();
  });
  function keepInView(a) {
    if (!desk.matches || panel.scrollHeight <= panel.clientHeight) return;
    var t = a.getBoundingClientRect(), r = panel.getBoundingClientRect();
    if (t.top < r.top + 24) panel.scrollTop -= r.top + 24 - t.top;
    else if (t.bottom > r.bottom - 24) panel.scrollTop += t.bottom - (r.bottom - 24);
  }
  function update() {
    var mast = document.querySelector(".mast");
    var line = mast ? mast.getBoundingClientRect().bottom + 72 : 180;
    var cat = cats[0];
    var atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    cats.forEach(function (c) {
      var h = c.el.querySelector("h2");
      if (!h) return;
      var top = h.getBoundingClientRect().top;
      if (top <= line || (atEnd && top < window.innerHeight)) cat = c;
    });
    var jc = atEnd && jumpCat();
    if (jc && jc.el.getBoundingClientRect().bottom > 0 && jc.el.getBoundingClientRect().top < window.innerHeight) cat = jc;
    if (cat !== current) {
      current = cat;
      cats.forEach(function (c) { c.link.classList.toggle("on", c === cat); });
      layout();
      if (cat && cat.link) keepInView(cat.link);
    }
  }
  layout();
  /* Restore saved / default state immediately (boot already painted via html classes). */
  setPinned(pinned);
  if (!desk.matches) phoneOpen = !!boot.phoneOpen;
  sync();
  persist();
  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  if (desk.addEventListener) desk.addEventListener("change", function () {
    layout(); update();
    /* Keep persisted pinned/phoneOpen across breakpoint; just re-sync presentation. */
    sync();
  });
  toc.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href^='#']");
    if (a && a.getAttribute("role") === "button") return; // section title: toggles, no jump (rd1)
    if (a) {
      jump = a.getAttribute("href").slice(1);
      window.setTimeout(update, 0);
      /* Do not close or change pinned/phoneOpen on item click — state persists (art74). */
    }
  });
  window.addEventListener("hashchange", function () { jump = location.hash.slice(1); window.setTimeout(update, 0); });
  window.addEventListener("load", function () { if (location.hash) jump = location.hash.slice(1); update(); });
  /* End boot no-animation after first paint. */
  window.requestAnimationFrame(function () {
    window.requestAnimationFrame(function () {
      document.documentElement.classList.remove("cats-rail-boot");
    });
  });
})();

/* ix1: empty Index sections are hidden for everyone but Devin.
   A section / subsection with no card this viewer can see (after the private / owner gating in
   html.css, so a group holding only someone else's private cards counts as empty) is hidden with
   its Categories entry (desktop rail and the phone dropdown are the same panel); a section whose
   subsections are all empty goes too. Devin, and the Index organizer (html.ee-index-org), see every
   section with its "None filed here yet" note. Recomputed on sign-in/out (body class), when the
   organizer opens or closes, and when the cards change (organizer saves, recent.js copy). */
(function () {
  var main = document.querySelector("main.index-flow");
  if (!main) return;
  var toc = document.getElementById("index-toc-panel");
  var HIDE = "ix-hide";
  var st = document.createElement("style");
  st.textContent = "." + HIDE + "{display:none!important}";
  document.head.appendChild(st);
  function seesAll() {
    return document.body.classList.contains("login-devin") || document.documentElement.classList.contains("ee-index-org") || document.documentElement.classList.contains("ee-editing");
  }
  function visible(card) { return card.getClientRects().length > 0; }
  function tocFor(id) {
    if (!toc) return null;
    var a = toc.querySelector('a[href="#' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
    return a ? (a.closest(".toc-group") || a.closest(".toc-cat")) : null;
  }
  var busy = false;
  function run() {
    busy = true;
    try {
      Array.prototype.forEach.call(document.querySelectorAll("." + HIDE), function (n) { n.classList.remove(HIDE); });
      if (seesAll()) return;
      var hide = [];
      Array.prototype.forEach.call(main.querySelectorAll("section.index-cat"), function (sec) {
        var total = 0, groups = [], cur = null;
        Array.prototype.forEach.call(sec.children, function (ch) {
          if (ch.matches("h3.index-sub")) { cur = { h: ch, boxes: [], n: 0 }; groups.push(cur); return; }
          if (ch.matches(".index-cards")) {
            var n = Array.prototype.filter.call(ch.querySelectorAll("a.index-card"), visible).length;
            total += n;
            if (cur) { cur.boxes.push(ch); cur.n += n; }
            else if (!n && groups.length === 0 && sec.querySelector("h3.index-sub")) hide.push(ch); // empty lead-in box above subsections
          }
        });
        if (!total) { hide.push(sec); var t = tocFor(sec.id); if (t) hide.push(t); return; }
        groups.forEach(function (g) {
          if (g.n) return;
          hide.push(g.h); g.boxes.forEach(function (b) { hide.push(b); });
          var t = g.h.id && tocFor(g.h.id); if (t) hide.push(t);
        });
      });
      hide.forEach(function (n) { n.classList.add(HIDE); });
    } finally { setTimeout(function () { busy = false; }, 0); }
  }
  var queued = false;
  function soon() { if (queued || busy) return; queued = true; requestAnimationFrame(function () { queued = false; run(); }); }
  run();
  window.addEventListener("load", soon);
  new MutationObserver(soon).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  new MutationObserver(soon).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  new MutationObserver(function () { if (!busy) soon(); }).observe(main, { childList: true, subtree: true });
  window.addEventListener("elorae-edit-session", soon);
})();
