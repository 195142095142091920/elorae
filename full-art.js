/* fa1 (2026-11-03): "View full art" on article pages. A small, faint expand icon in the hero's top
   right corner (clear of the title at the bottom left, the art-swap thumbnails / arrows at the
   bottom right, the Categories rail and the nav) opens the current hero art (the selected art-swap
   image when there are several) uncropped, object-fit: contain, in a fixed black overlay. Close with
   ✕, Esc, a click anywhere, or Back (the overlay pushes one history entry, like the peek panel).
   A plain fixed overlay, not the Fullscreen API: that would need its own exit handling, hides the
   browser chrome on phones and fights Back. Hidden in edit mode and on heroes without art. The hero
   size and crop are untouched. The button is runtime-only (the editor never saves it). */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement;
  if (!doc.body || !doc.body.classList.contains("article")) return;
  var btn = null, box = null, histOpen = false, lastFocus = null;
  function editing() { return root.classList.contains("ee-editing"); }
  function heroImg() { return doc.querySelector("section.art-hero > img"); }
  function orig(s) {
    s = String(s || "");
    try { var u = new URL(s, location.href); if (u.origin === location.origin) s = u.pathname + u.search; } catch (e) {}
    return s.replace(/^\/cdn-cgi\/image\/[^\/]+/, "");
  }
  function currentSrc() {
    var on = doc.querySelector(".art-swap-thumbs button.on[data-src]");
    if (on) return on.getAttribute("data-src");
    var im = heroImg(); if (!im) return "";
    return im.getAttribute("data-eimg-orig") || orig(im.currentSrc || im.getAttribute("src"));
  }
  function currentAlt() {
    var on = doc.querySelector(".art-swap-thumbs button.on");
    var im = heroImg();
    return (on && on.getAttribute("data-alt")) || (im && im.alt) || "";
  }
  function ensure() {
    var hero = doc.querySelector("section.art-hero"), im = heroImg();
    if (!hero || !im || !im.getAttribute("src")) { if (btn && btn.parentNode) btn.remove(); return; }
    if (btn && btn.parentNode === hero) return;
    if (!btn) {
      btn = doc.createElement("button");
      btn.type = "button"; btn.className = "art-full-btn"; btn.setAttribute("data-ee-ui", "1");
      btn.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" vector-effect="non-scaling-stroke"/></svg><span class="vh">View full art</span>';
      btn.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); open(); });
    }
    hero.appendChild(btn);
  }
  function build() {
    box = doc.createElement("div");
    box.className = "art-full"; box.id = "art-full";
    box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", "Full art");
    box.tabIndex = -1; box.hidden = true;
    box.innerHTML = '<img class="art-full-img" alt="" decoding="async"><button type="button" class="art-full-x" aria-label="Close full art">\u2715</button>';
    box.addEventListener("click", function () { close(); }); // anywhere, ✕ included
    box.addEventListener("wheel", function (e) { e.preventDefault(); }, { passive: false });
    box.addEventListener("touchmove", function (e) { e.preventDefault(); }, { passive: false });
    doc.body.appendChild(box);
  }
  function isOpen() { return !!(box && !box.hidden); }
  function open() {
    if (editing()) return;
    var src = currentSrc(); if (!src) return;
    if (!box) build();
    var im = box.querySelector("img");
    im.src = src; im.alt = currentAlt();
    lastFocus = doc.activeElement;
    box.hidden = false; root.classList.add("art-full-open");
    try { if (!histOpen) { history.pushState({ eloraeFullArt: 1 }, ""); histOpen = true; } } catch (e) {}
    box.focus({ preventScroll: true });
  }
  function close(fromPop) {
    if (!isOpen()) return;
    box.hidden = true; root.classList.remove("art-full-open");
    if (histOpen && !fromPop) { histOpen = false; try { history.back(); } catch (e) {} }
    histOpen = false;
    if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
  }
  window.addEventListener("popstate", function () { if (isOpen()) close(true); });
  // Back onto our entry after a reload: drop the stale state.
  try { if (history.state && history.state.eloraeFullArt) history.replaceState(null, ""); } catch (e) {}
  doc.addEventListener("keydown", function (e) {
    if (!isOpen()) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowRight") e.stopPropagation(); // the hero swap stays put behind
    else if (e.key === "Tab") { e.preventDefault(); box.querySelector(".art-full-x").focus(); }
  }, true);
  // Edit mode on: close; the hero can be rebuilt by the editor, so re-attach after.
  new MutationObserver(function () { if (editing()) close(); ensure(); }).observe(root, { attributes: true, attributeFilter: ["class"] });
  ensure();
  window.EloraeFullArt = { open: open, close: close, src: currentSrc };
})();
