(function () {
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
