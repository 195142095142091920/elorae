(function () {
  function pages() {
    (window.CODEX || []).forEach(function (p) {
      if (p.section) return;
      if (p.id === "souls") { p.section = "souls"; p.sectionTitle = "Souls"; }
      else if (p.id === "magics") { p.section = "magics"; p.sectionTitle = "Magics"; }
      else if (p.id === "lore") { p.section = "lore"; p.sectionTitle = "Lore"; }
      else { p.section = "world"; p.sectionTitle = p.sectionTitle || "World"; }
    });
    return window.CODEX || [];
  }
  function sectionOf(page) { return (page && page.section) || "world"; }
  function roots() {
    const seen = {};
    const out = [];
    pages().forEach(function (c) {
      const s = sectionOf(c);
      if (seen[s]) return;
      seen[s] = true;
      const first = pages().find(function (p) { return sectionOf(p) === s; });
      out.push({ section: s, id: first.id, title: first.sectionTitle || first.title });
    });
    return out;
  }
  function inSection(sec) {
    return pages().filter(function (c) { return sectionOf(c) === sec; });
  }

  window.journalBlock = function (block) {
    if (!block) return "";
    if (block.type === "h2") return '<h2 class="codex-h">' + escapeHtml(block.text || "") + '</h2>';
    if (block.type === "h3") return '<h3 class="codex-h3">' + escapeHtml(block.text || "") + '</h3>';
    if (block.type === "by") return '<p class="codex-by">' + escapeHtml(block.text || "") + '</p>';
    if (block.type === "quote") {
      return '<blockquote class="codex-quote"><p>' + escapeHtml(block.text || "") + '</p>' +
        (block.by ? '<cite>' + escapeHtml(block.by) + '</cite>' : '') + '</blockquote>';
    }
    if (block.type === "caption") return '<p class="codex-cap">' + escapeHtml(block.text || "") + '</p>';
    if (block.type === "image") {
      const id = galleryIdFor(block.src);
      const img = '<img src="' + encodeURI(block.src) + '" alt="' + escapeHtml(block.cap || "") + '">';
      const cap = block.cap ? '<figcaption>' + escapeHtml(block.cap) + '</figcaption>' : "";
      if (id) return '<figure class="journal-fig"><a href="#/' + id + '">' + img + '</a>' + cap + '</figure>';
      return '<figure class="journal-fig">' + img + cap + '</figure>';
    }
    return '<p>' + escapeHtml(block.text || "") + '</p>';
  };

  function codexMenu(currentId) {
    const current = pages().find(function (c) { return c.id === currentId; });
    const sec = sectionOf(current);
    return roots().map(function (r) {
      const on = r.section === sec ? " active" : "";
      return '<a class="' + on + '" href="#/codex/' + r.id + '">' + escapeHtml(r.title) + '</a>';
    }).join("");
  }

  window.renderCodex = function (id) {
    const all = pages();
    const current = all.find(function (c) { return c.id === id; }) || all[0];
    if (!current) return;
    const group = inSection(sectionOf(current));
    place.hash = "#/codex/" + current.id;
    document.title = current.title + " - Elorae";
    document.body.className = "room journal-page";
    const tabs = group.length > 1
      ? '<nav class="chapter-tabs">' + group.map(function (c) {
          return '<a class="' + (c.id === current.id ? " active" : "") + '" href="#/codex/' + c.id + '">' +
            escapeHtml(c.tab || c.title) + '</a>';
        }).join("") + '</nav>'
      : "";
    document.body.innerHTML =
      '<div class="journal-bg"><img src="' + encodeURI(current.banner || COVER) + '" alt=""></div>' +
      '<header class="topbar journal-bar">' + brand() + '<nav class="filters">' + rooms("codex") + '</nav></header>' +
      '<div class="sheet">' + tabs +
      '<article class="journal-read">' +
      (current.heading ? '<h2 class="codex-h">' + escapeHtml(current.heading) + '</h2>' : "") +
      (current.blocks || []).map(journalBlock).join("") +
      '</article></div>';
    bindPlaceScroll();
    bindIdleScrollbar(document.querySelector(".sheet"));
  };

  rooms = function (current) {
    const hash = (location.hash || "").replace(/^#\/?/, "");
    const pageId = hash.indexOf("codex/") === 0 ? hash.slice(6) : "";
    const main = [["atlas","Atlas"],["gallery","Gallery"],["index","Index"],["journal","Journal"]]
      .map(function (pair) {
        return '<a class="' + (current === pair[0] ? " active" : "") + '" href="#/' + pair[0] + '">' + pair[1] + '</a>';
      })
      .join('<span class="dot">&middot;</span>');
    const on = current === "codex" ? " active" : "";
    return main +
      '<span class="dot">&middot;</span>' +
      '<span class="nav-drop">' +
        '<a class="' + on + '" href="#/codex">Codex</a>' +
        '<span class="nav-menu">' + codexMenu(pageId) + '</span>' +
      '</span>';
  };

  document.addEventListener("click", function (e) {
    const drop = e.target.closest(".nav-drop");
    const a = e.target.closest('a[href^="#/codex"]');
    const touch = !window.matchMedia("(hover: hover)").matches;
    if (a && a.getAttribute("href") === "#/codex" && touch) {
      e.preventDefault();
      e.stopImmediatePropagation();
      document.querySelectorAll(".nav-drop.open").forEach(function (el) {
        if (el !== drop) el.classList.remove("open");
      });
      if (drop) drop.classList.toggle("open");
      return;
    }
    if (!drop) document.querySelectorAll(".nav-drop.open").forEach(function (el) { el.classList.remove("open"); });
    if (!a) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const href = a.getAttribute("href") || "#/codex";
    history.replaceState(null, "", href);
    const nid = href === "#/codex" ? "" : href.replace(/^#\/codex\/?/, "");
    window.renderCodex(nid);
  }, true);

  function paintNav() {
    const nav = document.querySelector(".filters");
    if (!nav || nav.querySelector(".nav-drop")) return;
    const lone = nav.querySelector('a[href="#/codex"]');
    if (lone) lone.remove();
    nav.insertAdjacentHTML("beforeend",
      '<span class="dot">&middot;</span><span class="nav-drop"><a href="#/codex">Codex</a><span class="nav-menu">' +
      codexMenu("") + '</span></span>');
  }
  paintNav();
  setInterval(paintNav, 400);

  const boot = location.hash.replace(/^#\/?/, "");
  if (boot === "codex" || boot.startsWith("codex/")) {
    window.renderCodex(boot === "codex" ? "" : boot.slice(6));
  }
})();
