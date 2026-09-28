const $ = (sel, root = document) => root.querySelector(sel);

const COVER = "assets/Godtree.png";

const place = {
  hash: "#/gallery",
  scroll: 0,
  tag: "all",
};

function route() {
  const hash = location.hash.replace(/^#\/?/, "");
  if (!hash) renderCover();
  else if (hash === "gallery") renderWall("all");
  else if (hash.startsWith("gallery/")) renderWall(hash.slice(8));
  else if (hash === "atlas") renderRoom("atlas", "Atlas", "Not yet drawn.");
  else if (hash === "index") renderIndex();
  else if (hash === "journal") renderJournal();
  else if (hash.startsWith("journal/")) renderJournal(hash.slice(8));
  else renderEntry(hash);
}

function rooms(current) {
  const items = [
    ["atlas", "Atlas"],
    ["gallery", "Gallery"],
    ["index", "Index"],
    ["journal", "Journal"],
  ];
  return items
    .map(([id, label]) => {
      const on = current === id ? " active" : "";
      return `<a class="${on}" href="#/${id}">${label}</a>`;
    })
    .join(`<span class="dot">\u00b7</span>`);
}

function renderCover() {
  window.removeEventListener("scroll", onWallScroll);
  document.title = "Elorae";
  document.body.className = "cover";
  document.body.innerHTML = `
    <div class="hero cover-hero">
      <img src="${encodeURI(COVER)}" alt="Elorae">
    </div>
    <p class="cover-mark">Elorae</p>
    <nav class="cover-nav">${rooms("")}</nav>
  `;
}

function onWallScroll() {
  place.scroll = window.scrollY;
  place.hash = place.tag === "all" ? "#/gallery" : `#/gallery/${place.tag}`;
}

function matchesTag(entry, tag) {
  if (tag === "all") return true;
  if (tag === "scenes") return entry.tags.includes("scenes") || entry.tags.includes("relics");
  return entry.tags.includes(tag);
}

function renderWall(tag) {
  const entries = window.ENTRIES.filter((e) => matchesTag(e, tag));

  document.title = "Gallery \u2014 Elorae";
  document.body.className = "";
  document.body.innerHTML = `
    <header class="topbar">
      <a href="#/">Elorae</a>
      <nav class="filters">
        ${filterLink("figures", tag)}
        ${filterLink("places", tag)}
        ${filterLink("scenes", tag)}
      </nav>
    </header>
    <main class="wall">
      ${entries.map(tile).join("") || `<p class="empty">No pieces in this set yet.</p>`}
    </main>
  `;

  const backTo = tag === "all" ? "#/gallery" : `#/gallery/${tag}`;
  const keepScroll = place.hash === backTo;
  place.tag = tag;
  place.hash = backTo;

  window.removeEventListener("scroll", onWallScroll);
  window.addEventListener("scroll", onWallScroll, { passive: true });

  requestAnimationFrame(() => {
    window.scrollTo(0, keepScroll ? place.scroll : 0);
    if (!keepScroll) place.scroll = 0;
  });
}

function filterLink(name, current) {
  const on = current === name ? " active" : "";
  return `<a class="${on}" href="#/gallery/${name}">${name}</a>`;
}

function tile(entry) {
  return `
    <a class="tile" href="#/${entry.id}">
      <img src="${encodeURI(entry.image)}" alt="${escapeHtml(entry.title)}">
      <span class="label">${escapeHtml(entry.title)}</span>
    </a>
  `;
}

function renderIndex() {
  window.removeEventListener("scroll", onWallScroll);
  place.hash = "#/index";
  place.scroll = 0;

  const list = [...window.ENTRIES].sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
  );

  document.title = "Index \u2014 Elorae";
  document.body.className = "room";
  document.body.innerHTML = `
    <header class="topbar">
      <a href="#/">Elorae</a>
      <nav class="filters">${rooms("index")}</nav>
    </header>
    <main class="index-list">
      ${list
        .map(
          (e) => `
        <a class="index-row" href="#/${e.id}">
          <span class="index-name">${escapeHtml(e.title)}</span>
          <span class="index-cap">${escapeHtml(e.caption || "")}</span>
        </a>`
        )
        .join("")}
    </main>
  `;
}

function renderRoom(id, title, empty) {
  window.removeEventListener("scroll", onWallScroll);
  place.hash = `#/${id}`;
  place.scroll = 0;

  document.title = `${title} \u2014 Elorae`;
  document.body.className = "room";
  document.body.innerHTML = `
    <header class="topbar">
      <a href="#/">Elorae</a>
      <nav class="filters">${rooms(id)}</nav>
    </header>
    <main class="room-body">
      <p class="empty">${escapeHtml(empty)}</p>
    </main>
  `;
}

function flattenJournal() {
  return window.JOURNAL || [];
}

function renderJournal(id) {
  window.removeEventListener("scroll", onWallScroll);
  const chapters = flattenJournal();
  const current = chapters.find((c) => c.id === id) || chapters[0];
  if (!current) {
    renderRoom("journal", "Journal", "No entries yet.");
    return;
  }

  place.hash = `#/journal/${current.id}`;
  place.scroll = 0;
  window.scrollTo(0, 0);

  document.title = `${current.title} \u2014 Elorae`;
  document.body.className = "room journal-page";
  document.body.innerHTML = `
    <header class="topbar">
      <a href="#/">Elorae</a>
      <nav class="filters">${rooms("journal")}</nav>
    </header>
    <div class="journal-banner">
      <img src="${encodeURI(current.banner || COVER)}" alt="">
      <h1>Journal</h1>
    </div>
    <nav class="chapter-tabs">
      ${chapters
        .map((c) => {
          const on = c.id === current.id ? " active" : "";
          return `<a class="${on}" href="#/journal/${c.id}">${escapeHtml(c.act)}, ${escapeHtml(c.chapter)}</a>`;
        })
        .join("")}
    </nav>
    <article class="journal-read">
      <h2>${escapeHtml(current.title)}</h2>
      ${current.blocks.map(journalBlock).join("")}
    </article>
  `;

  if (window._keys) document.removeEventListener("keydown", window._keys);
  const i = chapters.findIndex((c) => c.id === current.id);
  window._keys = (e) => {
    if (e.key === "Escape") location.hash = "#/";
    if (e.key === "ArrowLeft" && i > 0) location.hash = "#/journal/" + chapters[i - 1].id;
    if (e.key === "ArrowRight" && i < chapters.length - 1) location.hash = "#/journal/" + chapters[i + 1].id;
  };
  document.addEventListener("keydown", window._keys);
}

function journalBlock(block) {
  if (block.type === "image") {
    return `
      <figure class="journal-fig">
        <img src="${encodeURI(block.src)}" alt="${escapeHtml(block.cap || "")}">
        <figcaption>${escapeHtml(block.cap || "")}</figcaption>
      </figure>`;
  }
  return `<p>${escapeHtml(block.text || "")}</p>`;
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
    location.hash = place.hash || "#/gallery";
    return;
  }

  window.removeEventListener("scroll", onWallScroll);

  const { prev, next } = neighbors(id);
  const hasLore = (entry.lore || []).length > 0;

  document.title = `${entry.title} \u2014 Elorae`;
  document.body.className = "entry";
  document.body.innerHTML = `
    <div class="hero">
      <img src="${encodeURI(entry.image)}" alt="${escapeHtml(entry.title)}"
           style="object-fit:${entry.fit || "cover"};object-position:${entry.position || "center"}">
    </div>
    <header class="topbar">
      <a href="${place.hash || "#/gallery"}">\u2190 Back</a>
    </header>
    <a class="arrow prev" href="#/${prev.id}" aria-label="Previous">\u2039</a>
    <a class="arrow next" href="#/${next.id}" aria-label="Next">\u203a</a>
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

  const lore = document.querySelector("#lore");
  const toggle = document.querySelector("#toggle");
  const titleblock = document.querySelector("#titleblock");
  const open = () => {
    if (!lore) return;
    lore.classList.add("open");
    if (toggle) toggle.textContent = "\u2212";
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
    if (e.key === "Escape") {
      e.preventDefault();
      location.hash = place.hash || "#/gallery";
      return;
    }
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
