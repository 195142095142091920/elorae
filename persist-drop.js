(function () {
  window.__keepDrop = window.__keepDrop || "";

  if (!document.getElementById("persist-drop-css")) {
    const s = document.createElement("style");
    s.id = "persist-drop-css";
    s.textContent =
      "@media (min-width:801px){" +
      ".nav-drop.open .nav-menu,.nav-drop:hover .nav-menu{display:flex!important;pointer-events:auto}" +
      ".nav-drop.open{z-index:400}" +
      "}";
    document.head.appendChild(s);
  }

  function labelOf(el) {
    const head = el && el.querySelector(":scope > a");
    return head ? head.textContent.replace(/\s+/g, " ").trim().toLowerCase() : "";
  }

  function apply() {
    if (window.innerWidth <= 800) return;
    const keep = window.__keepDrop;
    if (!keep) return;
    document.querySelectorAll(".nav-drop").forEach(function (drop) {
      if (labelOf(drop) === keep) drop.classList.add("open");
    });
  }

  document.addEventListener("click", function (e) {
    const item = e.target.closest(".nav-menu a");
    if (item) {
      const drop = item.closest(".nav-drop");
      window.__keepDrop = labelOf(drop);
      setTimeout(apply, 0);
      setTimeout(apply, 40);
      setTimeout(apply, 160);
      return;
    }
    if (!e.target.closest(".nav-drop")) window.__keepDrop = "";
  }, true);

  document.addEventListener("pointerout", function (e) {
    if (!window.__keepDrop) return;
    const drop = e.target.closest && e.target.closest(".nav-drop");
    if (!drop) return;
    const next = e.relatedTarget;
    if (!next || !document.documentElement.contains(next)) return;
    if (drop.contains(next)) return;
    window.__keepDrop = "";
    drop.classList.remove("open");
  });

  const obs = new MutationObserver(function () { apply(); });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(apply, 80);
})();
