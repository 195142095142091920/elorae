(function () {
  function strip() {
    document.querySelectorAll(".nav-menu a, .chapter-tabs a, .atlas-tabs a, .subbar a").forEach(function (a) {
      const t = a.textContent.replace(/\s+/g, " ").trim();
      if (t === "Map" || t === "Eras") a.remove();
    });
  }
  document.addEventListener("click", strip, true);
  setInterval(strip, 250);
  strip();
})();
