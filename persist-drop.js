(function () {
  window.__keepDrop = window.__keepDrop || "";

  if (!document.getElementById("persist-drop-css")) {
    const s = document.createElement("style");
    s.id = "persist-drop-css";
    s.textContent =
      "@media (min-width:801px){" +
      "body .nav-drop.open > .nav-menu{" +
      "display:flex!important;visibility:visible!important;opacity:1!important;" +
      "position:fixed!important;z-index:9999!important;pointer-events:auto!important}" +
      "}";
    document.head.appendChild(s);
  }

  function labelOf(drop) {
    const head = drop && drop.querySelector(":scope > a");
    return head ? head.textContent.replace(/\s+/g, " ").trim().toLowerCase() : "";
  }

  function pin(drop) {
    const menu = drop.querySelector(":scope > .nav-menu");
    const head = drop.querySelector(":scope > a");
    if (!menu || !head) return;
    const r = head.getBoundingClientRect();
    menu.style.position = "fixed";
    menu.style.top = Math.round(r.bottom + 8) + "px";
    menu.style.left = Math.round(r.left + r.width / 2) + "px";
    menu.style.right = "auto";
    menu.style.transform = "translateX(-50%)";
    menu.style.zIndex = "9999";
    menu.style.display = "flex";
  }

  function apply() {
    if (window.innerWidth <= 800) return;
    const keep = window.__keepDrop;
    document.querySelectorAll(".nav-drop").forEach(function (drop) {
      const on = keep && labelOf(drop) === keep;
      drop.classList.toggle("open", on);
      if (on) pin(drop);
    });
  }

  document.addEventListener("click", function (e) {
    if (window.innerWidth <= 800) return;
    const item = e.target.closest(".nav-menu a");
    const drop = e.target.closest(".nav-drop");
    if (item || drop) {
      window.__keepDrop = labelOf(drop || (item && item.closest(".nav-drop")));
      setTimeout(apply, 0);
      setTimeout(apply, 30);
      setTimeout(apply, 120);
      setTimeout(apply, 280);
      return;
    }
    if (e.target && e.target.isConnected) {
      window.__keepDrop = "";
      document.querySelectorAll(".nav-drop.open").forEach(function (d) { d.classList.remove("open"); });
    }
  }, true);

  const obs = new MutationObserver(function () { if (window.__keepDrop) apply(); });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(function () { if (window.__keepDrop) apply(); }, 60);
})();
