(function () {
  function fix() {
    const hash = (location.hash || "").replace(/^#\/?/, "");
    if (hash !== "atlas" && hash.indexOf("atlas/") !== 0) return;
    const tabs = document.querySelector(".atlas-tabs") ||
      document.querySelector("body.atlas-page .chapter-tabs") ||
      document.querySelector("body.on-atlas .chapter-tabs");
    if (!tabs) return;
    const links = Array.from(tabs.querySelectorAll("a")).filter(function (a) {
      const href = a.getAttribute("href") || "";
      const text = a.textContent.replace(/\s+/g, " ").trim().toLowerCase();
      return href === "#/atlas" || href === "#/atlas/" || text === "map" || text === "overview";
    });
    let keep = links[0];
    if (!keep) {
      keep = document.createElement("a");
      keep.setAttribute("href", "#/atlas");
      tabs.insertBefore(keep, tabs.firstChild);
    }
    links.slice(1).forEach(function (a) { a.remove(); });
    keep.setAttribute("href", "#/atlas");
    keep.textContent = "Overview";
    if (tabs.firstElementChild !== keep) tabs.insertBefore(keep, tabs.firstChild);
    keep.classList.toggle("active", hash === "atlas");
  }
  setInterval(fix, 150);
  document.addEventListener("click", function () { requestAnimationFrame(fix); });
  window.addEventListener("hashchange", function () { requestAnimationFrame(fix); });
})();
