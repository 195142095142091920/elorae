/* Article Index: desktop slide-in rail (JS-driven like Index); phone Categories from #section-bar.
   Hover/focus peeks and pushes (body.art-index-open); pin sticks open. State shared with Index
   via localStorage (elorae-cats-rail); default open. Link clicks do not change open/pinned state.
   Current article is marked .on in HTML; keep it in view when the panel is used. */
(function () {
  var root = document.getElementById("art-index");
  if (!root) return;
  var cue = root.querySelector(".art-index-cue");
  var panel = root.querySelector(".art-index-panel");
  var secToggle = document.querySelector('#section-bar .sec-toggle[data-sec-for="art-index"]');
  var desk = window.matchMedia("(min-width: 801px)");

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
    root.classList.toggle("open", !!on);
    document.body.classList.toggle("art-index-open", !!on);
    if (cue) cue.setAttribute("aria-expanded", on ? "true" : "false");
    if (secToggle) secToggle.setAttribute("aria-expanded", on ? "true" : "false");
    if (on) keepCurrentInView();
  }

  function setPinned(on) {
    pinned = !!on;
    root.classList.toggle("pinned", pinned);
  }

  function focused() {
    var a = document.activeElement;
    if (!a || !root.contains(a)) return false;
    try { return a.matches(":focus-visible"); } catch (e) { return true; }
  }

  function sync() {
    if (pinned) { setOpen(true); return; }
    if (desk.matches) setOpen(hover || focused());
    else setOpen(phoneOpen);
  }

  function keepCurrentInView() {
    if (!panel) return;
    var on = panel.querySelector(".toc-name.on");
    if (!on) return;
    var t = on.getBoundingClientRect(), r = panel.getBoundingClientRect();
    if (t.top < r.top + 24) panel.scrollTop -= r.top + 24 - t.top;
    else if (t.bottom > r.bottom - 24) panel.scrollTop += t.bottom - (r.bottom - 24);
  }

  if (cue) {
    cue.addEventListener("click", function (e) {
      if (desk.matches) {
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

  root.addEventListener("mouseenter", function () { hover = true; sync(); });
  root.addEventListener("mouseleave", function () { hover = false; sync(); });
  root.addEventListener("focusin", sync);
  root.addEventListener("focusout", function () { window.setTimeout(sync, 0); });

  document.addEventListener("click", function (e) {
    if (desk.matches) return;
    if (pinned) return;
    if (!root.classList.contains("open")) return;
    if (e.target.closest && (e.target.closest("#art-index") || e.target.closest("#section-bar .sec-toggle"))) return;
    phoneOpen = false;
    sync();
    persist();
  }, true);

  root.querySelectorAll(".toc-tog").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var box = btn.closest(".toc-cat");
      if (!box) return;
      var on = !box.classList.contains("open");
      box.classList.toggle("open", on);
      btn.setAttribute("aria-expanded", on ? "true" : "false");
      if (on) keepCurrentInView();
    });
  });

  /* Esc closes; clears pin and persists (esc1). */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var held = root.contains(document.activeElement);
    if (!root.classList.contains("open") && !held && !pinned) return;
    hover = false;
    phoneOpen = false;
    setPinned(false);
    sync();
    persist();
    if (held && document.activeElement.blur) document.activeElement.blur();
  });

  if (desk.addEventListener) {
    desk.addEventListener("change", function () {
      hover = false;
      sync();
    });
  }

  /* Link clicks: keep rail state (do not close). Persist already holds pinned/phoneOpen. */
  root.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    /* state unchanged — navigation carries localStorage to the next page */
  });

  setPinned(pinned);
  if (!desk.matches) phoneOpen = !!boot.phoneOpen;
  sync();
  persist();
  keepCurrentInView();
  window.addEventListener("load", keepCurrentInView);
  window.requestAnimationFrame(function () {
    window.requestAnimationFrame(function () {
      document.documentElement.classList.remove("cats-rail-boot");
    });
  });
})();
