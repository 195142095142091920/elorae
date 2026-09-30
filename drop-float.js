(function () {
  if (window.__dropFloat) return;
  window.__dropFloat = true;

  const ATLAS = [
    ["Overview", "#/atlas/world"],
    ["Cosm", "#/atlas/cosm"],
    ["Essen Revir", "#/atlas/essen-revir"],
    ["Far Nybei", "#/atlas/far-nybei"],
    ["Hesk", "#/atlas/hesk"]
  ];
  const CODEX = [
    ["Calendar", "#/codex/calendar"],
    ["Lore", "#/codex/lore"],
    ["Magics", "#/codex/magics"],
    ["Souls", "#/codex/souls"]
  ];

  const box = document.createElement("div");
  box.id = "drop-float";
  document.documentElement.appendChild(box);

  const css = document.createElement("style");
  css.textContent =
    "#drop-float{display:none;position:fixed;z-index:2147483647;min-width:168px;padding:12px 16px 14px;" +
    "background:#070707;flex-direction:column;align-items:center;gap:10px;text-align:center;" +
    "box-shadow:0 16px 40px rgba(0,0,0,.55)}" +
    "#drop-float.open{display:flex}" +
    "#drop-float a{display:block;padding:5px 0;white-space:nowrap;font:11px/1.3 Helvetica,Arial,sans-serif;" +
    "letter-spacing:.16em;text-transform:uppercase;color:#8f8a82;text-decoration:none}" +
    "#drop-float a:hover,#drop-float a.active{color:#f3eee6}" +
    "@media (max-width:800px){#drop-float{display:none!important}}";
  document.documentElement.appendChild(css);

  let kind = "";

  function desktop() { return window.innerWidth > 800; }

  function findTrigger(name) {
    const want = name.toLowerCase();
    return Array.from(document.querySelectorAll(".filters a, .topbar a, .mast a")).find(function (a) {
      if (a.closest(".nav-menu, .chapter-tabs, .atlas-tabs, .subbar, #drop-float")) return false;
      return a.textContent.replace(/\s+/g, " ").trim().toLowerCase() === want;
    });
  }

  function place() {
    const trigger = findTrigger(kind);
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    box.style.top = Math.round(r.bottom + 8) + "px";
    box.style.left = Math.round(r.left + r.width / 2) + "px";
    box.style.transform = "translateX(-50%)";
  }

  function draw(which) {
    if (!desktop()) { box.classList.remove("open"); return; }
    kind = which;
    const items = which === "codex" ? CODEX : ATLAS;
    const hash = location.hash || "";
    box.innerHTML = items.map(function (it) {
      const on = hash === it[1] ? " active" : "";
      return '<a class="' + on + '" href="' + it[1] + '">' + it[0] + '</a>';
    }).join("");
    box.classList.add("open");
    place();
  }

  function go(href) {
    if (href.indexOf("#/atlas/") === 0 && typeof window.renderAtlasWorld === "function") {
      history.replaceState(null, "", href);
      window.renderAtlasWorld(href.replace(/^#\/atlas\/?/, "") || "world");
      return;
    }
    if (href.indexOf("#/codex/") === 0 && typeof window.renderCodex === "function") {
      history.replaceState(null, "", href);
      window.renderCodex(href.replace(/^#\/codex\/?/, "") || "calendar");
      return;
    }
    location.hash = href;
  }

  document.addEventListener("mouseover", function (e) {
    if (!desktop()) return;
    const a = e.target.closest && e.target.closest(".filters a, .nav-drop > a");
    if (!a || a.closest("#drop-float, .nav-menu, .chapter-tabs")) return;
    const label = a.textContent.replace(/\s+/g, " ").trim().toLowerCase();
    if (label === "atlas") draw("atlas");
    if (label === "codex") draw("codex");
  });

  box.addEventListener("click", function (e) {
    const a = e.target.closest("a");
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    const href = a.getAttribute("href");
    const stay = kind;
    go(href);
    setTimeout(function () { draw(stay); }, 0);
    setTimeout(function () { draw(stay); }, 50);
    setTimeout(function () { draw(stay); }, 200);
  });

  document.addEventListener("click", function (e) {
    if (e.target.closest("#drop-float")) return;
    const a = e.target.closest && e.target.closest("a");
    const label = a ? a.textContent.replace(/\s+/g, " ").trim().toLowerCase() : "";
    if (label === "atlas" || label === "codex") {
      draw(label);
      return;
    }
    box.classList.remove("open");
    kind = "";
  }, true);

  setInterval(function () { if (box.classList.contains("open")) place(); }, 80);
})();
