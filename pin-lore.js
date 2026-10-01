(function () {
  const old = window.pinChrome;
  window.pinChrome = function () {
    if (typeof old === "function") old();
    if (window.innerWidth <= 980 || !document.body.classList.contains("lore-page")) return;
    document.querySelectorAll(".sheet, .lore-rail").forEach(function (el) {
      el.style.setProperty("top", "102px", "important");
    });
  };
})();
