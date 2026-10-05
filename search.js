var seek = document.getElementById("seek");
var show = document.getElementById("seek-show");
var hits = document.getElementById("search-hits");
var isSearchPage = document.body.classList.contains("search-page");

function sealWho() {
  try { return localStorage.getItem("elorae-seal") || ""; } catch (e) { return ""; }
}

function canSee(entry) {
  if (!entry.private) return true;
  var who = sealWho();
  if (who === "devin") return true;
  return !!(who && entry.owner && who === entry.owner);
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function makeSnippet(text, q) {
  var lower = text.toLowerCase();
  var i = lower.indexOf(q);
  if (i < 0) return "";
  var a = Math.max(0, i - 70);
  var b = Math.min(text.length, i + q.length + 70);
  var snip = text.slice(a, b).trim();
  if (a) snip = "\u2026" + snip;
  if (b < text.length) snip = snip + "\u2026";
  var qi = snip.toLowerCase().indexOf(q);
  if (qi < 0) return escapeHtml(snip);
  return escapeHtml(snip.slice(0, qi)) + "<mark>" + escapeHtml(snip.slice(qi, qi + q.length)) + "</mark>" + escapeHtml(snip.slice(qi + q.length));
}

function renderHits(q) {
  if (!hits || !isSearchPage) return;
  if (!q || !window.SEARCH_INDEX) {
    hits.hidden = true;
    hits.innerHTML = "";
    return;
  }
  var seen = {};
  var rows = [];
  window.SEARCH_INDEX.forEach(function (entry) {
    if (!canSee(entry)) return;
    var titleHit = entry.title.toLowerCase().indexOf(q) !== -1;
    var textHit = entry.text && entry.text.toLowerCase().indexOf(q) !== -1;
    if (!titleHit && !textHit) return;
    /* Prefer article/journal/codex over duplicate figure sheets for same title. */
    var key = entry.href.split("#")[0] + "::" + entry.title;
    if (seen[key]) return;
    seen[key] = true;
    var snip = textHit ? makeSnippet(entry.text, q) : "";
    rows.push({ entry: entry, snip: snip, titleHit: titleHit });
  });
  if (!rows.length) {
    hits.hidden = true;
    hits.innerHTML = "";
    return;
  }
  hits.hidden = false;
  hits.innerHTML = "<h2>Mentions</h2>" + rows.map(function (r) {
    var e = r.entry;
    var thumb = e.image
      ? '<img class="hit-art" src="' + escapeHtml(e.image) + '" alt="">'
      : '<span class="hit-art hit-art-empty" aria-hidden="true"></span>';
    var kind = e.kind ? '<span class="hit-kind">' + escapeHtml(e.kind) + "</span>" : "";
    var sn = r.snip ? '<p class="hit-snip">' + r.snip + "</p>" : "";
    return '<a class="hit" href="' + escapeHtml(e.href) + '">' + thumb +
      '<span class="hit-body"><span class="hit-title">' + escapeHtml(e.title) + "</span>" + kind + sn + "</span></a>";
  }).join("");
}

function applyQuery() {
  if (!seek) return;
  var q = seek.value.trim().toLowerCase();
  if (show) {
    if (q) {
      show.hidden = false;
      show.textContent = seek.value.trim();
    } else {
      show.hidden = true;
      show.textContent = "";
    }
  }
  document.querySelectorAll(".tile").forEach(function (tile) {
    var name = (tile.querySelector(".label") || {}).textContent || "";
    tile.classList.toggle("is-dim", q && name.toLowerCase().indexOf(q) === -1);
  });
  renderHits(q);
}

if (seek) seek.addEventListener("input", applyQuery);

var params = new URLSearchParams(location.search);
if (params.get("q") && seek) {
  seek.value = params.get("q");
  applyQuery();
}

if (seek) document.addEventListener("keydown", function (e) {
  var t = e.target;
  if (t && t !== seek && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  if (e.key === "Escape" && seek.value) {
    seek.value = "";
    seek.dispatchEvent(new Event("input"));
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  if (e.key === "Enter" && seek.value.trim()) {
    /* First match the reader can actually see; hidden private tiles are skipped (seek2).
    Old pick: var hit = document.querySelector(".tile:not(.is-dim)"); */
    var hit = Array.prototype.find.call(document.querySelectorAll(".tile:not(.is-dim)"), function (t) { return t.getClientRects().length > 0; });
    if (hit && hit.getAttribute("href")) {
      e.preventDefault();
      location.href = hit.getAttribute("href");
      return;
    }
    /* On search page, open first mention if no tile match. */
    if (isSearchPage && hits) {
      var ment = hits.querySelector("a.hit");
      if (ment && ment.getAttribute("href")) {
        e.preventDefault();
        location.href = ment.getAttribute("href");
        return;
      }
    }
    if (t !== seek && seek.form) {
      e.preventDefault();
      seek.form.submit();
    }
    return;
  }

  if (t === seek) return;
  if (e.key.length !== 1) return;
  if (e.key === " " && !seek.value) return;
  seek.focus();
  seek.value += e.key;
  seek.dispatchEvent(new Event("input"));
  e.preventDefault();
}, true);
