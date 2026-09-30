(function () {
  const OUT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="square" d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/></svg>';
  const IN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="square" d="M8 8H3M8 8V3M16 8h5M16 8V3M8 16H3M8 16v5M16 16h5M16 16v5"/></svg>';
  function paint(fit, on) {
    fit.innerHTML = on ? IN : OUT;
    fit.dataset.glyph = on ? "in" : "out";
    fit.setAttribute("aria-label", on ? "Crop" : "Full");
    const svg = fit.querySelector("svg");
    if (svg) svg.style.pointerEvents = "none";
  }
  function bind(fit) {
    if (fit.dataset.fitBound) return;
    fit.dataset.fitBound = "1";
    fit.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      const hero = document.querySelector(".hero");
      if (!hero) return;
      const on = hero.classList.toggle("full");
      paint(fit, on);
      const mark = document.querySelector("#fitmark");
      if (mark) mark.innerHTML = on ? IN : OUT;
    });
  }
  function apply() {
    if (window.innerWidth > 800) return;
    if (!document.body.classList.contains("entry")) return;
    const hero = document.querySelector(".hero");
    const fit = document.querySelector("#fit");
    if (!fit) return;
    bind(fit);
    const on = !!(hero && hero.classList.contains("full"));
    if (fit.dataset.glyph !== (on ? "in" : "out") || !fit.querySelector("svg")) paint(fit, on);
  }
  setInterval(apply, 200);
  document.addEventListener("click", function () { requestAnimationFrame(apply); });
})();
