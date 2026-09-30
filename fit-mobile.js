(function () {
  const OUT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="square" d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/></svg>';
  const IN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="square" d="M8 8H3M8 8V3M16 8h5M16 8V3M8 16H3M8 16v5M16 16h5M16 16v5"/></svg>';
  function apply() {
    if (window.innerWidth > 800) return;
    if (!document.body.classList.contains("entry")) return;
    const hero = document.querySelector(".hero");
    const fit = document.querySelector("#fit");
    if (!fit) return;
    const on = !!(hero && hero.classList.contains("full"));
    const mark = on ? "in" : "out";
    if (fit.dataset.glyph === mark && fit.querySelector("svg")) return;
    fit.innerHTML = on ? IN : OUT;
    fit.dataset.glyph = mark;
    fit.setAttribute("aria-label", on ? "Crop" : "Full");
  }
  setInterval(apply, 200);
  document.addEventListener("click", function () { requestAnimationFrame(apply); });
})();
