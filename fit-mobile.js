(function () {
  if (!document.getElementById("fit-style")) {
    const s = document.createElement("style");
    s.id = "fit-style";
    s.textContent =
      ".hero.full{background:#000}" +
      ".hero.full img{object-fit:contain!important;object-position:center!important;background:#000}" +
      "@media (max-width:800px){" +
      ".entry .topbar #fit{z-index:40;pointer-events:auto;color:#efe8dc;position:relative}" +
      ".entry .topbar #fit svg{pointer-events:none;width:18px;height:18px;display:block}" +
      "}";
    document.head.appendChild(s);
  }
  const OUT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="square" d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/></svg>';
  const IN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="square" d="M8 8H3M8 8V3M16 8h5M16 8V3M8 16H3M8 16v5M16 16h5M16 16v5"/></svg>';
  function setGlyphs(on) {
    const fit = document.querySelector("#fit");
    const mark = document.querySelector("#fitmark");
    if (fit && window.innerWidth <= 800) {
      fit.innerHTML = on ? IN : OUT;
      fit.dataset.glyph = on ? "in" : "out";
      fit.setAttribute("aria-label", on ? "Crop" : "Full");
    }
    if (mark) mark.innerHTML = on ? IN : OUT;
  }
  function toggle(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const hero = document.querySelector(".hero");
    if (!hero) return;
    const on = hero.classList.toggle("full");
    setGlyphs(on);
  }
  function bind() {
    if (!document.body.classList.contains("entry")) return;
    const hero = document.querySelector(".hero");
    const on = !!(hero && hero.classList.contains("full"));
    const fit = document.querySelector("#fit");
    const mark = document.querySelector("#fitmark");
    [fit, mark].forEach(function (el) {
      if (!el || el.dataset.fitBound) return;
      el.dataset.fitBound = "1";
      el.addEventListener("click", toggle);
    });
    if (fit && window.innerWidth <= 800 && (fit.dataset.glyph !== (on ? "in" : "out") || !fit.querySelector("svg"))) {
      setGlyphs(on);
    }
  }
  setInterval(bind, 250);
})();
