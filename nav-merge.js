(function () {
  if (!document.getElementById("nav-merge-style")) {
    const s = document.createElement("style");
    s.id = "nav-merge-style";
    s.textContent =
      "@media (min-width:801px){" +
      ".topbar,.mast .topbar,.journal-page .topbar,.atlas-page .topbar{" +
      "display:grid!important;grid-template-columns:auto 1fr auto;align-items:center;gap:12px}" +
      ".topbar > a:first-child,.mast .topbar > a:first-child{grid-column:1;justify-self:start}" +
      ".topbar .filters,.mast .topbar .filters{grid-column:3;justify-self:end}" +
      ".topbar .chapter-tabs,.topbar .atlas-tabs,.topbar .subbar," +
      ".mast .topbar .chapter-tabs,.mast .topbar .subbar{" +
      "grid-column:2;position:static!important;top:auto!important;left:auto!important;right:auto!important;" +
      "justify-self:center;width:auto;max-width:none;background:transparent!important;" +
      "min-height:0!important;padding:0!important;margin:0!important}" +
      ".journal-page:has(.chapter-tabs) .sheet," +
      ".atlas-page:has(.atlas-tabs) .atlas-stage," +
      "body:has(.mast .subbar) .wall{top:var(--nav-h,56px)!important}" +
      "}";
    document.head.appendChild(s);
  }

  function desktop() { return window.innerWidth > 800; }

  function merge() {
    const bar = document.querySelector(".mast .topbar") || document.querySelector(".topbar");
    const tabs = document.querySelector(".chapter-tabs, .atlas-tabs, .subbar");
    if (!bar || !tabs) return;
    const filters = bar.querySelector(".filters");
    if (desktop()) {
      if (tabs.parentElement !== bar) {
        if (filters) bar.insertBefore(tabs, filters);
        else bar.appendChild(tabs);
      }
    } else if (tabs.parentElement === bar && bar.parentElement) {
      bar.insertAdjacentElement("afterend", tabs);
    }
  }

  const prev = window.pinChrome;
  window.pinChrome = function () {
    merge();
    if (typeof prev === "function") prev();
    if (!desktop()) return;
    const tabs = document.querySelector(".topbar .chapter-tabs, .topbar .atlas-tabs, .topbar .subbar, .mast .topbar .subbar");
    if (tabs) tabs.style.removeProperty("top");
  };

  merge();
  setInterval(merge, 250);
  window.addEventListener("hashchange", function () { setTimeout(merge, 40); });
})();
