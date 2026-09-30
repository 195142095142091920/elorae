(function () {
  if (!document.getElementById("persist-drop-css")) {
    const s = document.createElement("style");
    s.id = "persist-drop-css";
    s.textContent =
      "@media (min-width:801px){" +
      ".nav-drop.open .nav-menu,.nav-drop:hover .nav-menu{display:flex!important}" +
      "}";
    document.head.appendChild(s);
  }

  let keep = "";

  document.addEventListener("click", function (e) {
    const item = e.target.closest(".nav-menu a");
    if (!item) {
      if (!e.target.closest(".nav-drop")) {
        keep = "";
        document.querySelectorAll(".nav-drop.open").forEach(function (d) { d.classList.remove("open"); });
      }
      return;
    }
    const drop = item.closest(".nav-drop");
    const head = drop && drop.querySelector(":scope > a");
    keep = head ? head.textContent.replace(/\s+/g, " ").trim().toLowerCase() : "";
  }, true);

  function apply() {
    if (!keep || window.innerWidth <= 800) return;
    document.querySelectorAll(".nav-drop").forEach(function (drop) {
      const head = drop.querySelector(":scope > a");
      if (!head) return;
      const label = head.textContent.replace(/\s+/g, " ").trim().toLowerCase();
      if (label === keep) drop.classList.add("open");
    });
  }

  document.addEventListener("mouseout", function (e) {
    const drop = e.target.closest && e.target.closest(".nav-drop");
    if (!drop) return;
    const next = e.relatedTarget;
    if (next && drop.contains(next)) return;
    keep = "";
    drop.classList.remove("open");
  });

  apply();
  setInterval(apply, 120);
})();
