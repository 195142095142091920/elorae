/* bs1 (2026-11-03): Back / Forward always lands where you were.
   Saves scrollY per page (path + query) in sessionStorage when leaving (pagehide, and on a link
   click in case pagehide is skipped), and when this page is reached again by Back/Forward as a
   fresh load (not from the back-forward cache, which keeps the scroll itself) puts it back once
   the page's JS-gated content (private cards, empty-section hiding, rails, Journal order) has
   settled: retried for ~1.5s until the page is tall enough and stable, and given up as soon as the
   reader scrolls, so it never fights them. Skipped with a #target in the URL and in edit mode.
   Needed because pages that take over scrolling (ghostly-swap.js sets scrollRestoration =
   "manual" for its in-page tabs) and pages whose height changes after load could come back at
   the top. Load in <head>. */
(function () {
  "use strict";
  if (window.__backScroll) return; window.__backScroll = 1;
  var KEY = "elorae-scroll:" + location.pathname + location.search;
  function save() {
    try { sessionStorage.setItem(KEY, JSON.stringify({ y: Math.round(window.scrollY || 0), t: Date.now() })); } catch (e) {}
  }
  addEventListener("pagehide", save);
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest && e.target.closest("a[href]");
    if (a && !e.defaultPrevented) save();
  }, true);
  // Back-forward cache: the page and its scroll come back intact; nothing to do.
  var nav = null;
  try { nav = performance.getEntriesByType("navigation")[0]; } catch (e) {}
  var type = nav ? nav.type : (performance.navigation && performance.navigation.type === 2 ? "back_forward" : "");
  if (type !== "back_forward") return;
  var saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (e) {}
  if (!saved || !(saved.y > 0)) return;
  var Y = saved.y, root = document.documentElement;
  function hashTarget() {
    var h = location.hash && location.hash.length > 1 ? location.hash.slice(1) : "";
    if (!h || h.charAt(0) === "/") return false;
    try { return !!document.getElementById(decodeURIComponent(h)); } catch (e) { return false; }
  }
  var stop = false, start = Date.now(), lastH = -1, stableSince = 0, timer = 0;
  function quit() { stop = true; clearTimeout(timer); ["wheel", "touchstart", "keydown", "mousedown"].forEach(function (t) { removeEventListener(t, quit, true); }); }
  ["wheel", "touchstart", "keydown", "mousedown"].forEach(function (t) { addEventListener(t, quit, { capture: true, passive: true }); });
  function tick() {
    if (stop) return;
    if (hashTarget() || root.classList.contains("ee-editing") || root.classList.contains("ee-index-org")) { quit(); return; }
    var h = root.scrollHeight, max = h - innerHeight;
    if (h !== lastH) { lastH = h; stableSince = Date.now(); }
    var want = Math.min(Y, Math.max(0, max));
    if (Math.abs((window.scrollY || 0) - want) > 1) window.scrollTo(window.scrollX || 0, want);
    var done = max >= Y && Date.now() - stableSince > 250;
    if (done || Date.now() - start > 1600) { if (Math.abs((window.scrollY || 0) - Math.min(Y, Math.max(0, max))) > 1) window.scrollTo(window.scrollX || 0, Math.min(Y, Math.max(0, max))); quit(); return; }
    timer = setTimeout(tick, 80);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tick); else tick();
  addEventListener("load", function () { if (!stop) { clearTimeout(timer); tick(); } });
})();
