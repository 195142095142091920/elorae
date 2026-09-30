(function () {
  if (!document.getElementById("drop-on-style")) {
    const s = document.createElement("style");
    s.id = "drop-on-style";
    s.textContent =
      "@media (min-width:801px){" +
      "body.on-codex .nav-drop:has(> a[href^=\"#/codex\"]):hover .nav-menu," +
      "body.on-codex .nav-drop:has(> a[href^=\"#/codex\"]).open .nav-menu," +
      "body.on-atlas .nav-drop:has(> a[href=\"#/atlas\"]):hover .nav-menu," +
      "body.on-atlas .nav-drop:has(> a[href=\"#/atlas\"]).open .nav-menu{" +
      "display:flex!important}" +
      "}";
    document.head.appendChild(s);
  }
  const old = window.pinChrome;
  window.pinChrome = function () {
    if (typeof old === "function") old();
    const sheet = document.querySelector(".sheet");
    const rail = document.querySelector(".lore-rail");
    const tabs = document.querySelector(".chapter-tabs, .atlas-tabs, .subbar");
    if (!sheet || !document.body.classList.contains("lore-page")) return;
    if (window.innerWidth > 980) {
      const top = tabs ? Math.round(tabs.getBoundingClientRect().bottom) : 96;
      sheet.style.setProperty("top", top + "px", "important");
      if (rail) rail.style.setProperty("top", top + "px", "important");
    }
  };
})();
