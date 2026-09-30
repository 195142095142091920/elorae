(function () {
  function byId(id) {
    return (window.CODEX || []).find(function (c) { return c.id === id; });
  }

  function headingHtml(current) {
    if (!current.heading) return "";
    if (current.id === "lore") return "";
    return '<h2 class="codex-h">' + escapeHtml(current.heading) + '</h2>';
  }

  function articleHtml(current) {
    let blocks = current.blocks || [];
    if (current.id === "lore" && typeof window.prepareLoreBlocks !== "function") {
      /* fallback */
    }
    return headingHtml(current) + blocks.map(journalBlock).join("");
  }

  function setBanner(current) {
    const img = document.querySelector(".journal-bg img");
    if (img) img.src = current.banner || window.COVER || "assets/Godtree.png";
  }

  function markTabs(hrefPrefix, id) {
    const want = hrefPrefix + id;
    document.querySelectorAll(".chapter-tabs a, .atlas-tabs a, .subbar a").forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("href") === want);
    });
  }

  function softAtlas(id) {
    if (id === "eras" || id === "map") id = "world";
    const current = byId(id) || byId("world");
    const article = document.querySelector(".journal-read");
    if (!current || !article || !document.body.classList.contains("on-atlas")) return false;
    if (!document.querySelector(".topbar")) return false;
    if (window.place) window.place.hash = "#/atlas/" + current.id;
    document.title = (current.title || "Atlas") + " - Elorae";
    setBanner(current);
    article.innerHTML = articleHtml(current);
    document.querySelectorAll('.journal-read img[src*="EloraeLowRes"]').forEach(function (img) {
      const fig = img.closest("figure");
      if (fig) fig.classList.add("atlas-map");
    });
    markTabs("#/atlas/", current.id === "world" ? "world" : current.id);
    const sheet = document.querySelector(".sheet");
    if (sheet) sheet.scrollTop = 0;
    return true;
  }

  function softCodex(id) {
    const current = byId(id) || byId("calendar");
    const article = document.querySelector(".journal-read");
    if (!current || !article || !document.body.classList.contains("on-codex")) return false;
    if (!document.querySelector(".topbar")) return false;
    if (window.place) window.place.hash = "#/codex/" + current.id;
    document.title = (current.title || "Codex") + " - Elorae";
    document.body.classList.toggle("lore-page", current.id === "lore");
    setBanner(current);
    article.innerHTML = articleHtml(current);
    markTabs("#/codex/", current.id);
    const sheet = document.querySelector(".sheet");
    if (sheet) sheet.scrollTop = 0;
    return true;
  }

  const prevAtlas = window.renderAtlasWorld;
  window.renderAtlasWorld = function (id) {
    if (softAtlas(id)) return;
    if (typeof prevAtlas === "function") return prevAtlas(id);
  };

  const prevCodex = window.renderCodex;
  window.renderCodex = function (id) {
    if (softCodex(id)) return;
    if (typeof prevCodex === "function") return prevCodex(id);
  };
})();
