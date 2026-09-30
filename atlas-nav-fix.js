(function () {
  if (!document.getElementById("atlas-nav-fix-css")) {
    const s = document.createElement("style");
    s.id = "atlas-nav-fix-css";
    s.textContent =
      '.nav-menu a[href="#/atlas"],.nav-menu a[href="#/atlas/eras"],.chapter-tabs a[href="#/atlas"],.atlas-tabs a[href="#/atlas"]{display:none!important}' +
      '@media (min-width:801px){' +
      'body.room:has(.index-list){overflow:auto!important;height:auto!important;min-height:100dvh;}' +
      'body.room:has(.index-list) .topbar{position:sticky!important;top:0;}' +
      'body.room:has(.index-list) .index-list{position:relative!important;top:auto!important;bottom:auto!important;left:auto!important;right:auto!important;overflow:visible!important;padding-top:12px;min-height:calc(100dvh - 72px);}' +
      '}';
    document.head.appendChild(s);
  }
  function strip(root) {
    (root || document).querySelectorAll("a").forEach(function (a) {
      if (!a.closest(".nav-menu, .chapter-tabs, .atlas-tabs, .subbar")) return;
      const t = (a.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      const href = a.getAttribute("href") || "";
      if (t === "map" || t === "eras" || href === "#/atlas" || href === "#/atlas/eras") a.remove();
    });
  }
  function wrapRooms() {
    if (typeof rooms !== "function" || rooms.__noMap) return;
    const orig = rooms;
    rooms = function (current) {
      return String(orig(current) || "")
        .replace(/<a[^>]*>\s*Map\s*<\/a>/gi, "")
        .replace(/<a[^>]*>\s*Eras\s*<\/a>/gi, "")
        .replace(/<a[^>]*href=["']#\/atlas["'][^>]*>\s*Map\s*<\/a>/gi, "");
    };
    rooms.__noMap = true;
    window.rooms = rooms;
  }
  wrapRooms();
  strip();
  const obs = new MutationObserver(function () { wrapRooms(); strip(); });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
