(function () {
  window.renderCodex = function (id) {
    const pages = window.CODEX || [];
    const current = pages.find((c) => c.id === id) || pages[0];
    if (!current) {
      document.title = "Codex - Elorae";
      document.body.className = "room journal-page";
      document.body.innerHTML =
        '<header class="topbar">' + brand() + '<nav class="filters">' + rooms("codex") + '</nav></header>' +
        '<main class="room-body"><p class="empty">No pages yet.</p></main>';
      return;
    }
    const backTo = "#/codex/" + current.id;
    const keepScroll = place.hash === backTo;
    place.hash = backTo;
    document.title = current.title + " - Elorae";
    document.body.className = "room journal-page";
    document.body.innerHTML =
      '<div class="journal-bg"><img src="' + encodeURI(current.banner || COVER) + '" alt=""></div>' +
      '<header class="topbar journal-bar">' + brand() + '<nav class="filters">' + rooms("codex") + '</nav></header>' +
      '<div class="sheet"><nav class="chapter-tabs">' +
      pages.map((c) => '<a class="' + (c.id === current.id ? " active" : "") + '" href="#/codex/' + c.id + '">' +
        escapeHtml(c.title) + '</a>').join("") +
      '</nav><article class="journal-read"><h2>' + escapeHtml(current.heading || current.title) + '</h2>' +
      (current.blocks || []).map(journalBlock).join("") + '</article></div>';
    bindPlaceScroll();
    bindIdleScrollbar(document.querySelector(".sheet"));
    requestAnimationFrame(function () { restoreScroll(keepScroll); });
  };

  const oldRooms = rooms;
  rooms = function (current) {
    return [["atlas","Atlas"],["gallery","Gallery"],["index","Index"],["journal","Journal"],["codex","Codex"]]
      .map(function (pair) {
        const id = pair[0], label = pair[1];
        return '<a class="' + (current === id ? " active" : "") + '" href="#/' + id + '">' + label + '</a>';
      })
      .join('<span class="dot">&middot;</span>');
  };
  if (!oldRooms) return;

  window.addEventListener("hashchange", function (e) {
    const hash = location.hash.replace(/^#\/?/, "");
    if (hash === "codex" || hash.startsWith("codex/")) {
      e.stopImmediatePropagation();
      window.renderCodex(hash === "codex" ? "" : hash.slice(6));
    }
  }, true);

  function paintNav() {
    const nav = document.querySelector(".filters");
    if (!nav || nav.querySelector('a[href="#/codex"]')) return;
    nav.insertAdjacentHTML("beforeend", '<span class="dot">&middot;</span><a href="#/codex">Codex</a>');
  }
  paintNav();
  setInterval(paintNav, 500);
  const boot = location.hash.replace(/^#\/?/, "");
  if (boot === "codex" || boot.startsWith("codex/")) {
    window.renderCodex(boot === "codex" ? "" : boot.slice(6));
  }
})();
