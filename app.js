const $ = (sel, root = document) => root.querySelector(sel);

function route() {
  const hash = location.hash.replace(/^#\/?/, "");
  if (!hash) renderWall("all");
  else if (hash.startsWith("tag/")) renderWall(hash.slice(4));
  else renderEntry(hash);
}

function renderWall(tag) {
  const entries = window.ENTRIES.filter((e) =>
    tag === "all" ? true : e.tags.includes(tag)
  );

  document.title = "Elorae";
  document.body.className = "";
  document.body.innerHTML = `
    <header class="topbar">
      <a href="#/">Elorae</a>
      <nav class="filters">
        ${filterLink("all", tag)}
        ${filterLink("figures", tag)}
        ${filterLink("places", tag)}
        ${filterLink("relics", tag)}
      </nav>
    </header>
    <main class="wall">
      ${entries.map(tile).join("") || `<p class="empty">No pieces in this set yet.</p>`}
    </main>
  `;
}

function filterLink(name, current) {
  const href = name === "all" ? "#/" : `#/tag/${name}`;
  const on = current === name ? " active" : "";
  return `<a class="${on}" href="${href}">${name}</a>`;
}

function tile(entry) {
  return `
    <a class="tile" href="#/${entry.id}">
      <img src="${encodeURI(entry.image)}" alt="${escapeHtml(entry.title)}">
      <span class="label">${escapeHtml(entry.title)}</span>
    </a>
  `;
}

function neighbors(id) {
  const list = window.ENTRIES;
  const i = list.findIndex((e) => e.id === id);
  const prev = list[(i - 1 + list.length) % list.length];
  const next = list[(i + 1) % list.length];
  return { prev, next };
}

function renderEntry(id) {
  const entry = window.ENTRIES.find((e) => e.id === id);
  if (!entry) {
    location.hash = "#/";
    return;
  }

  const { prev, next } = neighbors(id);
  const hasLore = (entry.lore || []).length > 0;

  document.title = `${entry.title} — Elorae`;
  document.body.className = "entry";
  document.body.innerHTML = `
    <div class="hero">
      <img src="${encodeURI(entry.image)}" alt="${escapeHtml(entry.title)}"
           style="object-fit:${entry.fit || "cover"};object-position:${entry.position || "center"}">
    </div>
    <header class="topbar">
      <a href="#/">← Index</a>
    </header>
    <a class="arrow prev" href="#/${prev.id}" aria-label="Previous">‹</a>
    <a class="arrow next" href="#/${next.id}" aria-label="Next">›</a>
    <div class="dock" id="dock">
      <div class="title-block" id="titleblock">
        <div class="title-row">
          <h1>${escapeHtml(entry.title)}</h1>
          ${hasLore ? `<button class="toggle" id="toggle" type="button">Lore +</button>` : ""}
        </div>
        <p>${escapeHtml(entry.caption || "")}</p>
      </div>
    </div>
    <aside class="panel" id="panel">
      <header>
        <span>Lore</span>
        <button class="toggle" id="close" type="button">Close</button>
      </header>
      <h2>${escapeHtml(entry.title)}</h2>
      ${(entry.lore || []).map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
    </aside>
  `;

  const panel = $("#panel");
  const toggle = $("#toggle");
  const titleblock = $("#titleblock");
  const open = () => panel.classList.add("open");
  const shut = () => panel.classList.remove("open");

  if (toggle) {
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      panel.classList.contains("open") ? shut() : open();
    });
  }
  $("#close").addEventListener("click", shut);

  const hover = window.matchMedia("(hover: hover)").matches;
  if (hover && hasLore) {
    let leave;
    const cancel = () => { clearTimeout(leave); };
    const schedule = () => {
      leave = setTimeout(shut, 180);
    };
    titleblock.addEventListener("mouseenter", () => { cancel(); open(); });
    titleblock.addEventListener("mouseleave", schedule);
    panel.addEventListener("mouseenter", cancel);
    panel.addEventListener("mouseleave", schedule);
  }

  if (window._keys) document.removeEventListener("keydown", window._keys);
  window._keys = (e) => {
    if (e.key === "Escape") shut();
    if (e.key === "ArrowLeft") location.hash = "#/" + prev.id;
    if (e.key === "ArrowRight") location.hash = "#/" + next.id;
  };
  document.addEventListener("keydown", window._keys);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", route);
