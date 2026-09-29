(function () {
  window.renderCodex = function (id) {
    const pages = window.CODEX || [];
    const current = pages.find(function (c) { return c.id === id; }) || pages[0];
    if (!current) return;
    place.hash = "#/codex/" + current.id;
    document.title = current.title + " - Elorae";
    document.body.className = "room journal-page";
    document.body.innerHTML =
      '<div class="journal-bg"><img src="' + encodeURI(current.banner || COVER) + '" alt=""></div>' +
      '<header class="topbar journal-bar">' + brand() + '<nav class="filters">' + rooms("codex") + '</nav></header>' +
      '<div class="sheet"><nav class="chapter-tabs">' +
      pages.map(function (c) {
        return '<a class="' + (c.id === current.id ? " active" : "") + '" href="#/codex/' + c.id + '">' +
          escapeHtml(c.title) + '</a>';
      }).join("") +
      '</nav><article class="journal-read"><h2>' + escapeHtml(current.heading || current.title) + '</h2>' +
      (current.blocks || []).map(journalBlock).join("") + '</article></div>';
    bindPlaceScroll();
    bindIdleScrollbar(document.querySelector(".sheet"));
  };

  rooms = function (current) {
    return [["atlas","Atlas"],["gallery","Gallery"],["index","Index"],["journal","Journal"],["codex","Codex"]]
      .map(function (pair) {
        return '<a class="' + (current === pair[0] ? " active" : "") + '" href="#/' + pair[0] + '">' + pair[1] + '</a>';
      })
      .join('<span class="dot">&middot;</span>');
  };

  document.addEventListener("click", function (e) {
    const a = e.target.closest('a[href^="#/codex"]');
    if (!a) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const href = a.getAttribute("href") || "#/codex";
    history.replaceState(null, "", href);
    const id = href === "#/codex" ? "" : href.replace(/^#\/codex\/?/, "");
    window.renderCodex(id);
  }, true);

  function paintNav() {
    const nav = document.querySelector(".filters");
    if (!nav || nav.querySelector('a[href="#/codex"]')) return;
    nav.insertAdjacentHTML("beforeend", '<span class="dot">&middot;</span><a href="#/codex">Codex</a>');
  }
  paintNav();
  setInterval(paintNav, 400);

  const boot = location.hash.replace(/^#\/?/, "");
  if (boot === "codex" || boot.startsWith("codex/")) {
    window.renderCodex(boot === "codex" ? "" : boot.slice(6));
  }
})();
