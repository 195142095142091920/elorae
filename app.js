const COVER = "assets/Godtree.png";
const ATLAS = "assets/EloraeLowRes.png";
const ATLAS_BG = "assets/Cartographer.png";
const SEAL_KEY = "elorae-seal";

const ALIASES = {
  "galands-first-flight": "galand-helviath",
};

const FIT_OUT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/></svg>';
const FIT_IN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8H3M8 8V3M16 8h5M16 8V3M8 16H3M8 16v5M16 16h5M16 16v5"/></svg>';

const place = {
  hash: "#/gallery",
  scroll: 0,
  tag: "all",
};

function route() {
  const hash = location.hash.replace(/^#\/?/, "");
  if (!hash) { location.replace("#/gallery"); return; }
  else if (hash === "gallery") renderWall("all");
  else if (hash.startsWith("gallery/")) renderWall(hash.slice(8));
  else if (hash === "atlas") renderAtlas();
  else if (hash === "index") renderIndex();
  else if (hash === "journal") renderJournal();
  else if (hash.startsWith("journal/")) renderJournal(hash.slice(8));
  else if (hash === "seal") renderSeal();
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
