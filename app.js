const COVER = "assets/Godtree.png";
const ATLAS = "assets/EloraeLowRes.png";
const ATLAS_BG = "assets/Cartographer.png";
const SEAL_KEY = "elorae-seal";

const ALIASES = { "galands-first-flight": "galand-helviath", "vaerek": "vaerek-at-ease" };

const FIT_OUT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/></svg>';
const FIT_IN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8H3M8 8V3M16 8h5M16 8V3M8 16H3M8 16v5M16 16h5M16 16v5"/></svg>';

const place = { hash: "#/gallery", scroll: 0, tag: "all" };

function route() {
  const hash = location.hash.replace(/^#\/?/, "");
  if (!hash || hash === "cover") { location.replace("#/gallery"); return; }
  if (hash === "gallery") renderWall("all");
  else if (hash.startsWith("gallery/")) renderWall(hash.slice(8));
  else if (hash === "atlas" || hash.startsWith("atlas/")) { if (window.renderAtlasWorld) window.renderAtlasWorld(hash === "atlas" ? "world" : hash.slice(6)); }
  else if (hash === "index") renderIndex();
  else if (hash === "journal" || hash.startsWith("journal/")) { if (window.renderJournalEntry) window.renderJournalEntry(hash === "journal" ? "" : hash.slice(8)); }
  else if (hash === "codex" || hash.startsWith("codex/")) { if (window.renderCodex) window.renderCodex(hash === "codex" ? "calendar" : hash.slice(6)); }
  else if (hash === "seal") renderSeal();
  else renderEntry(hash);
}

function rooms(current) {
  return [["atlas","Atlas"],["gallery","Gallery"],["index","Index"],["journal","Journal"]]
    .map(([id, label]) => '<a class="' + (current === id ? " active" : "") + '" href="#/' + id + '">' + label + '</a>')
    .join('<span class="dot">&middot;</span>');
}

function brand() {
  // old left-hand brand, painted then hidden by friend-nav:
  // return '<a href="#/seal">Elorae</a>';
  return '<span id="friend-link" data-built="elorae"><a href="#/seal" data-name="Elorae">Elorae</a></span>';
}

function normCode(s) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}
function sealId() {
  try { return localStorage.getItem(SEAL_KEY) || ""; } catch (e) { return ""; }
}
function vaultOf() {
  const id = sealId();
  return (window.VAULT || []).find((v) => v.id === id) || null;
}
function catalog() {
  const base = window.ENTRIES || [];
  const v = vaultOf();
  if (!v) return base;
  if (v.id === "devin") {
    const extra = (window.VAULT || []).flatMap((x) => x.entries || []);
    return extra.length ? base.concat(extra) : base;
  }
  return v.entries && v.entries.length ? base.concat(v.entries) : base;
}
function hiddenEntry(id) {
  return (window.VAULT || []).some((v) => (v.entries || []).some((e) => e.id === id));
}
function openSeal(id) { try { localStorage.setItem(SEAL_KEY, id); } catch (e) {} }
function closeSeal() { try { localStorage.removeItem(SEAL_KEY); } catch (e) {} }
function matchSeal(code) {
  const needle = normCode(code);
  if (!needle) return null;
  return (window.VAULT || []).find((v) => (v.codes || []).some((c) => normCode(c) === needle)) || null;
}
function scroller() {
  return document.querySelector(".wall") || document.querySelector(".sheet") || document.querySelector(".index-list") || window;
}
function onPlaceScroll() {
  const el = window._scrollEl || scroller();
  place.scroll = el === window ? window.scrollY : el.scrollTop;
}
function bindPlaceScroll() {
  dropPlaceScroll();
  const el = scroller();
  window._scrollEl = el;
  el.addEventListener("scroll", onPlaceScroll, { passive: true });
}
function dropPlaceScroll() {
  if (window._scrollEl) {
    window._scrollEl.removeEventListener("scroll", onPlaceScroll);
    window._scrollEl = null;
  }
  window.removeEventListener("scroll", onPlaceScroll);
}
function restoreScroll(keep) {
  const el = scroller();
  const y = keep ? place.scroll : 0;
  if (el === window) window.scrollTo(0, y);
  else el.scrollTop = y;
  if (!keep) place.scroll = 0;
}
function zoneOpen(lore, life) {
  return (lore && lore.classList.contains("open")) || (life && life.classList.contains("open"));
}

function renderSeal() {
  dropPlaceScroll();
  document.title = "Seal - Elorae";
  document.body.className = "seal-page";
  document.body.style.backgroundImage = "";
  document.body.style.backgroundColor = "";
  const v = vaultOf();
  if (v) {
    document.body.innerHTML =
      '<header class="topbar">' + brand() + '<nav class="filters">' + rooms("") + '</nav></header>' +
      '<main class="seal-card"><p class="seal-kicker">Unsealed</p><h1>' + escapeHtml(v.name) + '</h1>' +
      '<p class="seal-note">Private pieces and letters for this name now sit in Gallery and Journal.</p>' +
      '<button class="seal-leave" id="leave" type="button">Close the seal</button></main>';
    document.querySelector("#leave").addEventListener("click", (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      closeSeal();
      renderSeal();
    });
    return;
  }
  document.body.innerHTML =
    '<header class="topbar">' + brand() + '<nav class="filters">' + rooms("") + '</nav></header>' +
    '<main class="seal-card"><p class="seal-kicker">Seal</p><form id="seal-form">' +
    '<input id="seal-code" type="password" autocomplete="off" spellcheck="false" placeholder="Phrase">' +
    '<button type="submit">Enter</button></form>' +
    '<p class="seal-err" id="seal-err" hidden>Try again.</p></main>';
  const form = document.querySelector("#seal-form");
  const input = document.querySelector("#seal-code");
  const err = document.querySelector("#seal-err");
  input.focus();
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const hit = matchSeal(input.value);
    if (!hit) { err.hidden = false; input.value = ""; input.focus(); return; }
    openSeal(hit.id);
    location.hash = "#/gallery";
  });
}

function matchesTag(entry, tag) {
  if (tag === "all") return true;
  if (tag === "scenes") return entry.tags.includes("scenes") || entry.tags.includes("relics");
  return entry.tags.includes(tag);
}

function renderWall(tag) {
  document.body.style.backgroundImage = "";
  document.body.style.backgroundColor = "";
  const entries = catalog().filter((e) => matchesTag(e, tag));
  document.title = "Gallery - Elorae";
  document.body.className = "";
  document.body.innerHTML =
    '<div class="mast"><header class="topbar">' + brand() + '<nav class="filters">' +
    rooms("gallery") + '</nav></header><nav class="subbar">' + galleryFilters(tag) + '</nav></div>' +
    '<main class="wall">' + (entries.map(tile).join("") || '<p class="empty">No pieces in this set yet.</p>') + '</main>';
  const backTo = tag === "all" ? "#/gallery" : "#/gallery/" + tag;
  const keepScroll = place.hash === backTo;
  place.tag = tag;
  place.hash = backTo;
  bindPlaceScroll();
  requestAnimationFrame(() => restoreScroll(keepScroll));
}

function galleryFilters(current) {
  const names = ["all", "figures", "places", "scenes"];
  const v = vaultOf();
  const hasPrivate = v && (v.id === "devin"
    ? (window.VAULT || []).some((x) => (x.entries || []).length)
    : (v.entries || []).length);
  if (hasPrivate) names.push("sealed");
  return names.map((name) => filterLink(name, current)).join('<span class="dot">&middot;</span>');
}
function filterLink(name, current) {
  const on = current === name ? " active" : "";
  const href = name === "all" ? "#/gallery" : "#/gallery/" + name;
  const label = name === "sealed" ? "Private" : name;
  return '<a class="' + on + '" href="' + href + '">' + label + '</a>';
}
function tile(entry) {
  return '<a class="tile" href="#/' + entry.id + '"><img src="' + encodeURI(entry.image) + '" alt="' +
    escapeHtml(entry.title) + '"><span class="label">' + escapeHtml(entry.title) + '</span></a>';
}

function renderIndex() {
  dropPlaceScroll();
  place.hash = "#/index";
  place.scroll = 0;
  const list = [...catalog()].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
  document.title = "Index - Elorae";
  document.body.className = "room";
  document.body.innerHTML =
    '<header class="topbar">' + brand() + '<nav class="filters">' + rooms("index") + '</nav></header>' +
    '<main class="index-list">' +
    list.map((e) => '<a class="index-row" href="#/' + e.id + '"><span class="index-name">' +
      escapeHtml(e.title) + '</span><span class="index-cap">' + escapeHtml(e.caption || "") + '</span></a>').join("") +
    '</main>';
  bindIdleScrollbar(document.querySelector(".index-list"));
}

function renderAtlas() {
  // old atlas page had no secondary tabs. Replaced by renderAtlasWorld.
  if (window.renderAtlasWorld) window.renderAtlasWorld("world");
}

function renderRoom(id, title, empty) {
  dropPlaceScroll();
  place.hash = "#/" + id;
  place.scroll = 0;
  document.title = title + " - Elorae";
  document.body.className = "room";
  document.body.innerHTML =
    '<header class="topbar">' + brand() + '<nav class="filters">' + rooms(id) + '</nav></header>' +
    '<main class="room-body"><p class="empty">' + escapeHtml(empty) + '</p></main>';
}

function flattenJournal() {
  const pub = window.JOURNAL || [];
  const v = vaultOf();
  if (!v) return pub;
  if (v.id === "devin") {
    const extra = (window.VAULT || []).flatMap((x) => x.journal || []);
    return extra.length ? pub.concat(extra) : pub;
  }
  return v.journal && v.journal.length ? pub.concat(v.journal) : pub;
}

function renderJournal(id) {
  const chapters = flattenJournal();
  const current = chapters.find((c) => c.id === id) || chapters[0];
  if (!current) { renderRoom("journal", "Journal", "No entries yet."); return; }
  const backTo = "#/journal/" + current.id;
  const keepScroll = place.hash === backTo;
  place.hash = backTo;
  document.title = current.title + " - Elorae";
  document.body.className = "room journal-page";
  // old sheet tabs replaced by renderJournalEntry
  if (window.renderJournalEntry) { window.renderJournalEntry(current.id); return; }
  document.body.innerHTML =
    '<div class="journal-bg"><img src="' + encodeURI(current.banner || COVER) + '" alt=""></div>' +
    '<header class="topbar journal-bar">' + brand() + '<nav class="filters">' + rooms("journal") + '</nav></header>' +
    '<div class="sheet"><nav class="chapter-tabs">' +
    chapters.map((c) => '<a class="' + (c.id === current.id ? " active" : "") + '" href="#/journal/' + c.id + '">' +
      escapeHtml(c.act) + ', ' + escapeHtml(c.chapter) + '</a>').join("") +
    '</nav><article class="journal-read"><h2>' + escapeHtml(current.title) + '</h2>' +
    current.blocks.map(journalBlock).join("") + '</article></div>';
  bindPlaceScroll();
  bindIdleScrollbar(document.querySelector(".sheet"));
  requestAnimationFrame(() => restoreScroll(keepScroll));
  if (window._keys) document.removeEventListener("keydown", window._keys);
  const i = chapters.findIndex((c) => c.id === current.id);
  window._keys = (e) => {
    if (e.key === "Escape") location.hash = "#/gallery";
    if (e.key === "ArrowLeft" && i > 0) location.hash = "#/journal/" + chapters[i - 1].id;
    if (e.key === "ArrowRight" && i < chapters.length - 1) location.hash = "#/journal/" + chapters[i + 1].id;
  };
  document.addEventListener("keydown", window._keys);
}

function galleryIdFor(src) {
  const hit = catalog().find((e) => e.image === src);
  return hit ? hit.id : "";
}
function journalBlock(block) {
  if (block.type === "image") {
    const id = galleryIdFor(block.src);
    const img = '<img src="' + encodeURI(block.src) + '" alt="' + escapeHtml(block.cap || "") + '">';
    const cap = '<figcaption>' + escapeHtml(block.cap || "") + '</figcaption>';
    if (id) return '<figure class="journal-fig"><a href="#/' + id + '">' + img + '</a>' + cap + '</figure>';
    return '<figure class="journal-fig">' + img + cap + '</figure>';
  }
  return '<p>' + escapeHtml(block.text || "") + '</p>';
}
function neighbors(id) {
  const list = catalog();
  const i = list.findIndex((e) => e.id === id);
  return { prev: list[(i - 1 + list.length) % list.length], next: list[(i + 1) % list.length] };
}
function canHover() { return window.matchMedia("(hover: hover)").matches; }
function bindHover(el, openFn, shutFn, pinnedFn) {
  if (!el || !canHover()) return;
  let leave;
  el.addEventListener("mouseenter", () => { clearTimeout(leave); openFn(); });
  el.addEventListener("mouseleave", () => {
    leave = setTimeout(() => { if (pinnedFn && pinnedFn()) return; shutFn(); }, 180);
  });
}
function bindTap(el, toggleFn) {
  if (!el || canHover()) return;
  el.addEventListener("click", (e) => { if (e.target.closest("button")) return; toggleFn(); });
}
function bindIdleScrollbar(el) {
  if (!el) return;
  let hide;
  const show = () => {
    el.classList.add("show-bar");
    clearTimeout(hide);
  };
  const later = () => {
    clearTimeout(hide);
    hide = setTimeout(() => el.classList.remove("show-bar"), 700);
  };
  el.addEventListener("scroll", () => { show(); later(); }, { passive: true });
  el.addEventListener("mouseenter", show);
  el.addEventListener("mouseleave", later);
}
function paintFit(on) {
  const word = document.querySelector("#fit");
  const mark = document.querySelector("#fitmark");
  if (word) word.textContent = on ? "Crop" : "Full";
  if (mark) mark.innerHTML = on ? FIT_IN : FIT_OUT;
}

function renderEntry(id) {
  if (ALIASES[id]) { location.hash = "#/" + ALIASES[id]; return; }
  const entry = catalog().find((e) => e.id === id);
  if (!entry) {
    location.hash = hiddenEntry(id) ? "#/seal" : (place.hash || "#/gallery");
    return;
  }
  onPlaceScroll();
  dropPlaceScroll();
  const { prev, next } = neighbors(id);
  const loreBits = (entry.lore || []).filter(function (line, i) {
    if (i === 0) return true;
    var cap = String(entry.caption || "").replace(/[.\s]+$/g, "").toLowerCase();
    return String(line || "").replace(/[.\s]+$/g, "").toLowerCase() !== cap;
  });
  const bioBits = entry.bio || [];
  const quote = entry.quote || "";
  const quoteBy = entry.quoteBy || "";
  const facts = entry.facts || [];
  const isFigure = (entry.tags || []).includes("figures");
  const hasLore = loreBits.length > 0 || isFigure;
  const hasLife = bioBits.length > 0 || !!quote || facts.length > 0 || isFigure;
  document.title = entry.title + " - Elorae";
  document.body.className = "entry";
  const loreBtn = hasLore ? '<button class="more" id="toggle" type="button">+</button>' : "";
  const loreBox = hasLore ? '<div class="lore" id="lore">' + loreBits.map((p, i) =>
    '<p' + (i === 0 ? ' class="say"' : '') + '>' + escapeHtml(p) + '</p>').join("") + '</div>' : "";
  const quoteHtml = quote
    ? '<blockquote class="life-quote"><p>' + escapeHtml(quote) + '</p>' +
      (quoteBy ? '<cite>' + escapeHtml(quoteBy) + '</cite>' : '') + '</blockquote>'
    : "";
  const factsHtml = facts.length
    ? '<ul class="life-facts">' + facts.map((f) => '<li>' + escapeHtml(f) + '</li>').join("") + '</ul>'
    : "";
  const lifeUi = hasLife
    ? '<div class="life-dock" id="lifedock"><button class="life-toggle" id="life-toggle" type="button">+ Lore</button>' +
      '<aside class="life-sheet" id="life">' + quoteHtml + factsHtml +
      bioBits.map((p) => '<p>' + escapeHtml(p) + '</p>').join("") + '</aside></div>'
    : "";
  document.body.innerHTML =
    '<div class="hero"><img src="' + encodeURI(entry.image) + '" alt="' + escapeHtml(entry.title) +
    '" style="object-fit:' + (entry.fit || "cover") + ';object-position:' + (entry.position || "center") + '"></div>' +
    '<header class="topbar"><a href="' + (place.hash || "#/gallery") + '">Back</a>' +
    '<button class="fit-toggle" id="fit" type="button">Full</button></header>' +
    '<nav class="pager"><a class="arrow prev" href="#/' + prev.id + '">&#8249;</a>' +
    '<button class="fit-toggle fit-mark" id="fitmark" type="button" aria-label="Full">' + FIT_OUT + '</button>' +
    '<a class="arrow next" href="#/' + next.id + '">&#8250;</a></nav>' +
    '<div class="dock" id="dock"><div class="title-block" id="titleblock"><h1>' + escapeHtml(entry.title) + '</h1>' +
    '<p class="caption">' + escapeHtml(entry.caption || "") + ' ' + loreBtn + '</p>' + loreBox + '</div></div>' + lifeUi;
  const lore = document.querySelector("#lore");
  const toggle = document.querySelector("#toggle");
  const dock = document.querySelector("#dock");
  const titleblock = document.querySelector("#titleblock");
  const life = document.querySelector("#life");
  const lifeToggle = document.querySelector("#life-toggle");
  const lifedock = document.querySelector("#lifedock");
  const hero = document.querySelector(".hero");
  const flipFit = (e) => { if (e) e.stopPropagation(); if (!hero) return; paintFit(hero.classList.toggle("full")); };
  let pinLore = false, pinLife = false;
  const open = () => { if (!lore) return; lore.classList.add("open"); if (toggle) toggle.textContent = "-"; };
  const shut = () => { if (!lore) return; pinLore = false; lore.classList.remove("open"); if (toggle) toggle.textContent = "+"; };
  const openLife = () => { if (!life) return; life.classList.add("open"); if (lifeToggle) lifeToggle.textContent = "- Lore"; };
  const shutLife = () => { if (!life) return; pinLife = false; life.classList.remove("open"); life.classList.remove("show-bar"); if (lifeToggle) lifeToggle.textContent = "+ Lore"; };
  const flipLore = () => {
    if (!lore) return;
    if (lore.classList.contains("open") && (pinLore || !canHover())) shut();
    else { if (!canHover()) shutLife(); pinLore = canHover(); pinLife = false; open(); }
  };
  const flipLife = () => {
    if (!life) return;
    if (life.classList.contains("open") && (pinLife || !canHover())) shutLife();
    else { if (!canHover()) shut(); pinLife = canHover(); pinLore = false; openLife(); }
  };
  if (toggle) toggle.addEventListener("click", (e) => { e.stopPropagation(); flipLore(); });
  if (lifeToggle) lifeToggle.addEventListener("click", (e) => { e.stopPropagation(); flipLife(); });
  document.querySelectorAll(".fit-toggle").forEach((btn) => btn.addEventListener("click", flipFit));
  bindHover(titleblock, open, shut, () => pinLore);
  bindHover(lifedock, openLife, shutLife, () => pinLife);
  if (canHover()) {
    if (titleblock) titleblock.addEventListener("click", (e) => { e.stopPropagation(); flipLore(); });
    if (lifedock) lifedock.addEventListener("click", (e) => { e.stopPropagation(); flipLife(); });
  }
  bindTap(dock, flipLore);
  bindTap(lifedock, flipLife);
  bindIdleScrollbar(life);
  bindIdleScrollbar(lore);
  document.querySelectorAll(".arrow").forEach((a) => {
    a.addEventListener("click", (e) => {
      var phone = window.matchMedia("(max-width:800px)").matches;
      if ((phone && zoneOpen(lore, life)) || (hero && hero.classList.contains("full"))) { e.preventDefault(); e.stopPropagation(); }
    });
  });
  if (window._keys) document.removeEventListener("keydown", window._keys);
  window._keys = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (hero && hero.classList.contains("full")) { hero.classList.remove("full"); paintFit(false); return; }
      if (life && life.classList.contains("open")) { shutLife(); return; }
      if (lore && lore.classList.contains("open")) { shut(); return; }
      location.hash = place.hash || "#/gallery";
      return;
    }
    if ((window.matchMedia("(max-width:800px)").matches && zoneOpen(lore, life)) || (hero && hero.classList.contains("full"))) return;
    if (e.key === "ArrowLeft") location.hash = "#/" + prev.id;
    if (e.key === "ArrowRight") location.hash = "#/" + next.id;
  };
  document.addEventListener("keydown", window._keys);
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "\u0026amp;").replace(/</g, "\u0026lt;").replace(/>/g, "\u0026gt;").replace(/"/g, "\u0026quot;");
}

window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", route);
