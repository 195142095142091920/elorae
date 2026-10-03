(function () {
  const OUT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="square" d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/></svg>';
  const IN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="square" d="M8 8H3M8 8V3M16 8h5M16 8V3M8 16H3M8 16v5M16 16h5M16 16v5"/></svg>';

  if (!document.getElementById("fit-style")) {
    const s = document.createElement("style");
    s.id = "fit-style";
    s.textContent =
      ".hero.full{background:#000}" +
      ".hero.full img{object-fit:contain!important;object-position:center!important;background:#000}" +
      ".fit-toggle,.fit-mark,#fit,#fitmark{" +
      "appearance:none;-webkit-appearance:none;background:none;border:0;color:#efe8dc;cursor:pointer;" +
      "pointer-events:auto;z-index:30}" +
      ".pager{z-index:18!important;pointer-events:none}" +
      ".pager .arrow,.pager .fit-toggle,.pager #fitmark{pointer-events:auto}" +
      ".fit-mark,#fitmark{" +
      "width:44px;height:44px;min-width:44px;min-height:44px;padding:0;" +
      "display:grid;place-items:center;color:#efe8dc;opacity:0.7}" +
      ".fit-mark:hover,#fitmark:hover{opacity:1}" +
      ".fit-mark svg,#fitmark svg{width:18px;height:18px;display:block;pointer-events:none}" +
      "body:not(.entry) #fit,body:not(.entry) #fitmark,body:not(.entry) .fit-toggle{display:none!important}" +      "@media (min-width:801px){.entry .topbar #fit{display:none!important}}" +
      "@media (max-width:800px){" +
      ".entry .topbar #fit{display:grid;place-items:center;width:44px;min-width:44px;min-height:44px;" +
      "padding:max(16px, env(safe-area-inset-top)) 14px 12px;font-size:0!important;line-height:0;" +
      "color:#efe8dc;background:none;border:0;z-index:40}" +
      ".entry .topbar #fit svg{width:18px;height:18px;display:block;pointer-events:none}" +
      ".pager #fitmark{display:none!important}" +
      "}";
    document.head.appendChild(s);
  }

  function heroOn() {
    const hero = document.querySelector(".entry .hero");
    return !!(hero && hero.classList.contains("full"));
  }

  function apply(on) {
    const hero = document.querySelector(".entry .hero");
    const img = hero && hero.querySelector("img");
    if (!hero) return;
    hero.classList.toggle("full", on);
    if (img) {
      img.style.setProperty("object-fit", on ? "contain" : "cover", "important");
      img.style.setProperty("object-position", "center", "important");
    }
    const fit = document.querySelector("#fit");
    const mark = document.querySelector("#fitmark");
    if (fit) {
      if (window.innerWidth <= 800) {
        fit.innerHTML = on ? IN : OUT;
        fit.dataset.glyph = on ? "in" : "out";
      } else {
        fit.textContent = on ? "Crop" : "Full";
      }
      fit.setAttribute("aria-label", on ? "Crop" : "Full");
    }
    if (mark) {
      mark.innerHTML = on ? IN : OUT;
      mark.setAttribute("aria-label", on ? "Crop" : "Full");
    }
  }

  function toggle(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }
    apply(!heroOn());
  }

  function isFitBtn(el) {
    return el && el.closest && el.closest("#fit, #fitmark, .fit-toggle, .fit-mark");
  }

  document.addEventListener("click", function (e) {
    if (!document.body.classList.contains("entry")) {
      document.querySelectorAll("#fit,#fitmark,.fit-toggle").forEach(function (el) { el.remove(); });
      return;
    }
    if (!isFitBtn(e.target)) return;
    toggle(e);
  }, true);

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || !document.body.classList.contains("entry")) return;
    if (!heroOn()) return;
    e.preventDefault();
    apply(false);
  }, true);

  function bind() {
    if (!document.body.classList.contains("entry")) return;
    const mark = document.querySelector("#fitmark");
    const fit = document.querySelector("#fit");
    if (mark && !mark.querySelector("svg")) mark.innerHTML = heroOn() ? IN : OUT;
    if (fit && window.innerWidth <= 800 && !fit.querySelector("svg")) {
      fit.innerHTML = heroOn() ? IN : OUT;
    }
    apply(heroOn());
  }

  setInterval(bind, 400);
  window.addEventListener("hashchange", function () { setTimeout(bind, 30); });
})();
