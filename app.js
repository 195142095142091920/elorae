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
        <h1>${escapeHtml(entry.title)}</h1>
        <p class="caption">
          ${escapeHtml(entry.caption || "")}${hasLore ? ` <button class="more" id="toggle" type="button" aria-label="Expand">+</button>` : ""}
        </p>
        ${hasLore ? `<div class="lore" id="lore">${(entry.lore || []).map((p) => `<p>${escapeHtml(p)}</p>`).join("")}</div>` : ""}
      </div>
    </div>
  `;

  const lore = $("#lore");
  const toggle = $("#toggle");
  const titleblock = $("#titleblock");
  const open = () => {
    if (!lore) return;
    lore.classList.add("open");
    if (toggle) toggle.textContent = "−";
  };
  const shut = () => {
    if (!lore) return;
    lore.classList.remove("open");
    if (toggle) toggle.textContent = "+";
  };

  if (toggle) {
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      lore.classList.contains("open") ? shut() : open();
    });
  }

  const hover = window.matchMedia("(hover: hover)").matches;
  if (hover && hasLore) {
    let leave;
    titleblock.addEventListener("mouseenter", () => {
      clearTimeout(leave);
      open();
    });
    titleblock.addEventListener("mouseleave", () => {
      leave = setTimeout(shut, 180);
    });
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
