const COVER = "assets/Godtree.png";
const ATLAS = "assets/EloraeLowRes.png";

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
  else if (hash === "atlas") renderAtlas();
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
      return '<a class="' + on + '" href="#/' + id + '">' + label + '</a>';
    })
    .join('<span class="dot">&middot;</span>');
}

function onPlaceScroll() {
  place.scroll = window.scrollY;
}

function bindPlaceScroll() {
  window.removeEventListener("scroll", onPlaceScroll);
  window.addEventListener("scroll", onPlaceScroll, { passive: true });
}

function dropPlaceScroll() {
  window.removeEventListener("scroll", onPlaceScroll);
}

function renderCover() {
  dropPlaceScroll();
  document.title = "Elorae";
  document.body.className = "cover";
  document.body.innerHTML =
    '<div class="hero cover-hero"><img src="' + encodeURI(COVER) + '" alt="Elorae"></div>' +
    '<p class="cover-mark">Elorae</p>' +
    '<nav class="cover-nav">' + rooms("") + '</nav>';
}

function matchesTag(entry, tag) {
  if (tag === "all") return true;
  if (tag === "scenes") return entry.tags.includes("scenes") || entry.tags.includes("relics");
  return entry.tags.includes(tag);
}

function renderWall(tag) {
  const entries = window.ENTRIES.filter((e) => matchesTag(e, tag));
  document.title = "Gallery - Elorae";
  document.body.className = "";
  document.body.innerHTML =
    '<div class="mast">' +
    '<header class="topbar"><a href="#/">Elorae</a><nav class="filters">' +
    rooms("gallery") + '</nav></header>' +
    '<nav class="subbar">' + galleryFilters(tag) + '</nav></div>' +
    '<main class="wall">' +
    (entries.map(tile).join("") || '<p class="empty">No pieces in this set yet.</p>') +
    '</main>';

  const backTo = tag === "all" ? "#/gallery" : "#/gallery/" + tag;
  const keepScroll = place.hash === backTo;
  place.tag = tag;
  place.hash = backTo;
  bindPlaceScroll();
  requestAnimationFrame(() => {
    window.scrollTo(0, keepScroll ? place.scroll : 0);
    if (!keepScroll) place.scroll = 0;
  });
}

function galleryFilters(current) {
  return ["all", "figures", "places", "scenes"]
    .map((name) => filterLink(name, current))
    .join('<span class="dot">&middot;</span>');
}

function filterLink(name, current) {
  const on = current === name ? " active" : "";
  const href = name === "all" ? "#/gallery" : "#/gallery/" + name;
  return '<a class="' + on + '" href="' + href + '">' + name + '</a>';
}

function tile(entry) {
  return '<a class="tile" href="#/' + entry.id + '">' +
    '<img src="' + encodeURI(entry.image) + '" alt="' + escapeHtml(entry.title) + '">' +
    '<span class="label">' + escapeHtml(entry.title) + '</span></a>';
}

function renderIndex() {
  dropPlaceScroll();
  place.hash = "#/index";
  place.scroll = 0;
  const list = [...window.ENTRIES].sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
  );
  document.title = "Index - Elorae";
  document.body.className = "room";
  document.body.innerHTML =
    '<header class="topbar"><a href="#/">Elorae</a><nav class="filters">' + rooms("index") +
    '</nav></header><main class="index-list">' +
    list.map((e) =>
      '<a class="index-row" href="#/' + e.id + '">' +
      '<span class="index-name">' + escapeHtml(e.title) + '</span>' +
      '<span class="index-cap">' + escapeHtml(e.caption || "") + '</span></a>'
    ).join("") +
    '</main>';
}

function renderAtlas() {
  dropPlaceScroll();
  place.hash = "#/atlas";
  place.scroll = 0;
  document.title = "Atlas - Elorae";
  document.body.className = "atlas-page";
  document.body.innerHTML =
    '<header class="topbar"><a href="#/">Elorae</a><nav class="filters">' +
    rooms("atlas") + '</nav></header>' +
    '<main class="atlas-stage"><img src="' + encodeURI(ATLAS) + '" alt="Elorae"></main>';
}

function renderRoom(id, title, empty) {
  dropPlaceScroll();
  place.hash = "#/" + id;
  place.scroll = 0;
  document.title = title + " - Elorae";
  document.body.className = "room";
  document.body.innerHTML =
    '<header class="topbar"><a href="#/">Elorae</a><nav class="filters">' + rooms(id) +
    '</nav></header><main class="room-body"><p class="empty">' + escapeHtml(empty) + '</p></main>';
}

function flattenJournal() {
  return window.JOURNAL || [];
}

function renderJournal(id) {
  const chapters = flattenJournal();
  const current = chapters.find((c) => c.id === id) || chapters[0];
  if (!current) {
    renderRoom("journal", "Journal", "No entries yet.");
    return;
  }
  const backTo = "#/journal/" + current.id;
  const keepScroll = place.hash === backTo;
  place.hash = backTo;

  document.title = current.title + " - Elorae";
  document.body.className = "room journal-page";
  document.body.innerHTML =
    '<div class="journal-bg"><img src="' + encodeURI(current.banner || COVER) + '" alt=""></div>' +
    '<header class="topbar journal-bar"><a href="#/">Elorae</a><nav class="filters">' +
    rooms("journal") + '</nav></header>' +
    '<nav class="chapter-tabs">' +
    chapters.map((c) => {
      const on = c.id === current.id ? " active" : "";
      return '<a class="' + on + '" href="#/journal/' + c.id + '">' +
        escapeHtml(c.act) + ', ' + escapeHtml(c.chapter) + '</a>';
    }).join("") +
    '</nav><article class="journal-read">' +
    '<h2>' + escapeHtml(current.title) + '</h2>' +
    current.blocks.map(journalBlock).join("") +
    '</article>';

  bindPlaceScroll();
  requestAnimationFrame(() => {
    window.scrollTo(0, keepScroll ? place.scroll : 0);
    if (!keepScroll) place.scroll = 0;
  });

  if (window._keys) document.removeEventListener("keydown", window._keys);
  const i = chapters.findIndex((c) => c.id === current.id);
  window._keys = (e) => {
    if (e.key === "Escape") location.hash = "#/";
    if (e.key === "ArrowLeft" && i > 0) location.hash = "#/journal/" + chapters[i - 1].id;
    if (e.key === "ArrowRight" && i < chapters.length - 1) location.hash = "#/journal/" + chapters[i + 1].id;
  };
  document.addEventListener("keydown", window._keys);
}

function galleryIdFor(src) {
  const hit = (window.ENTRIES || []).find((e) => e.image === src);
  return hit ? hit.id : "";
}

function journalBlock(block) {
  if (block.type === "image") {
    const id = galleryIdFor(block.src);
    const img = '<img src="' + encodeURI(block.src) + '" alt="' + escapeHtml(block.cap || "") + '">';
    const cap = '<figcaption>' + escapeHtml(block.cap || "") + '</figcaption>';
    if (id) {
      return '<figure class="journal-fig"><a href="#/' + id + '">' + img + '</a>' + cap + '</figure>';
    }
    return '<figure class="journal-fig">' + img + cap + '</figure>';
  }
  return '<p>' + escapeHtml(block.text || "") + '</p>';
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
  place.scroll = window.scrollY || place.scroll;
  dropPlaceScroll();
  const { prev, next } = neighbors(id);
  const hasLore = (entry.lore || []).length > 0;
  document.title = entry.title + " - Elorae";
  document.body.className = "entry";
  const loreBtn = hasLore ? ' <button class="more" id="toggle" type="button">+</button>' : "";
  const loreBox = hasLore
    ? '<div class="lore" id="lore">' + (entry.lore || []).map((p) => '<p>' + escapeHtml(p) + '</p>').join("") + '</div>'
    : "";
  document.body.innerHTML =
    '<div class="hero"><img src="' + encodeURI(entry.image) + '" alt="' + escapeHtml(entry.title) +
    '" style="object-fit:' + (entry.fit || "cover") + ';object-position:' + (entry.position || "center") + '"></div>' +
    '<header class="topbar"><a href="' + (place.hash || "#/gallery") + '">Back</a></header>' +
    '<a class="arrow prev" href="#/' + prev.id + '">&#8249;</a>' +
    '<a class="arrow next" href="#/' + next.id + '">&#8250;</a>' +
    '<div class="dock"><div class="title-block" id="titleblock">' +
    '<h1>' + escapeHtml(entry.title) + '</h1>' +
    '<p class="caption">' + escapeHtml(entry.caption || "") + loreBtn + '</p>' +
    loreBox + '</div></div>';

  const lore = document.querySelector("#lore");
  const toggle = document.querySelector("#toggle");
  const titleblock = document.querySelector("#titleblock");
  const open = () => { if (!lore) return; lore.classList.add("open"); if (toggle) toggle.textContent = "-"; };
  const shut = () => { if (!lore) return; lore.classList.remove("open"); if (toggle) toggle.textContent = "+"; };
  if (toggle) {
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      lore.classList.contains("open") ? shut() : open();
    });
  }
  if (window.matchMedia("(hover: hover)").matches && hasLore) {
    let leave;
    titleblock.addEventListener("mouseenter", () => { clearTimeout(leave); open(); });
    titleblock.addEventListener("mouseleave", () => { leave = setTimeout(shut, 180); });
  }
  if (window._keys) document.removeEventListener("keydown", window._keys);
  window._keys = (e) => {
    if (e.key === "Escape") { e.preventDefault(); location.hash = place.hash || "#/gallery"; return; }
    if (e.key === "ArrowLeft") location.hash = "#/" + prev.id;
    if (e.key === "ArrowRight") location.hash = "#/" + next.id;
  };
  document.addEventListener("keydown", window._keys);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;")
    .replace(/"/g, "\u0026quot;");
}

window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", route);
