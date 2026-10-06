/* Index rail: Chromium-style category sidebar.
   Collapsed strip stays hoverable; hover/focus peeks the panel and pushes the
   card grid (body.index-toc-open). Pin sticks the rail open; unpin collapses.
   Pinned / phone-open state persists in localStorage (elorae-cats-rail); default open.
   Clicking a category/subject link does not change open/pinned state.
   Phone: Categories opens from #section-bar .sec-toggle (regular secondary nav); pin/cue hidden;
   tap-outside / Escape closes (and persists).
   Nests stay closed until the chevron is tapped; no card highlight while scrolling. */
(function () {
  var toc = document.querySelector("aside.toc");
  if (!toc) return;
  var panel = toc.querySelector(".index-toc-panel") || toc;
  var cue = toc.querySelector(".index-toc-cue");
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
  var current = null, manual = {}, jump = "";
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
  var hover = false, pinned = !!boot.pinned, phoneOpen = !!boot.phoneOpen;

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
    if (cue) cue.setAttribute("aria-expanded", on ? "true" : "false");
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
    if (!a || !toc.contains(a)) return false;
    try { return a.matches(":focus-visible"); } catch (e) { return true; }
  }
  function sync() {
    if (pinned) { setOpen(true); return; }
    if (desk.matches) setOpen(hover || focused());
    else setOpen(phoneOpen);
  }
  function layout() {
    cats.forEach(function (c) {
      if (!c.tog) return;
      var id = c.el.id;
      /* Categories-only on scroll: open only from the chevron (manual), never from scroll. */
      var open = id in manual ? manual[id] : false;
      c.box.classList.toggle("open", open);
      c.tog.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
  cats.forEach(function (c) {
    if (!c.tog) return;
    c.tog.addEventListener("click", function () {
      manual[c.el.id] = !c.box.classList.contains("open");
      layout();
    });
  });
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
  if (cue) {
    cue.addEventListener("click", function (e) {
      if (desk.matches) {
        /* Desktop cue: pin/unpin (hover already peeks). */
        e.preventDefault();
        e.stopPropagation();
        setPinned(!pinned);
        sync();
        persist();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (pinned) {
        setPinned(false);
        phoneOpen = false;
      } else {
        phoneOpen = !phoneOpen;
      }
      sync();
      persist();
    });
  }

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

  /* Desktop: open while hovered, focused, or pinned. */
  toc.addEventListener("mouseenter", function () { hover = true; sync(); });
  toc.addEventListener("mouseleave", function () { hover = false; sync(); });
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
    hover = false;
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
    hover = false;
    /* Keep persisted pinned/phoneOpen across breakpoint; just re-sync presentation. */
    sync();
  });
  toc.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href^='#']");
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
