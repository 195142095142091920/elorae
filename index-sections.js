(function () {
  var SECTIONS = [["ancients", "Ancients"], ["divines", "Divines"], ["demonic", "Demonic Lords"], ["ascendants", "Ascendants"], ["power", "Figures of Power"], ["heroes", "Heroes"], ["factions", "Factions"], ["locations", "Locations"], ["armaments", "Armaments"], ["vignettes", "Vignettes"]];
  var FACTIONS = [["kindred", "Draconic Kindred", ["galand-helviath"]], ["heartroot", "Heartroot", ["saoirse", "vaerek-at-ease"]], ["mano", "Mano", ["mano", "galand-helviath"]]];
  var HOME = { aghor: "ancients", mano: "divines", "galand-helviath": "heroes", "vaerek-at-ease": "heroes", saoirse: "heroes", filibeth: "heroes" };
  var PLACES = { "ashforge-kuroishi": 1, auralon: 1, "cadarinost-falls": 1, caurobor: 1, "hanto-han": 1, "perstrin-naba": 1, "phantom-cavern": 1 };
  var VIGNETTES = { "heldranc-flies": 1, "montmorian-rages": 1, "montmorian-chamber": 1, "montmorian-alabaster": 1, "kojin-redroot": 1, "saoirse-canyon": 1, "pethengorom-fate": 1 };
  var HIDE = { "aszurithice-human": 1, "heldranc-human": 1, "nyralshirad-human": 1, "pethengorom-human": 1, "vaerek-heldranc": 1 };
  var open = "ancients";
  var faction = "";
  if (!document.getElementById("index-section-css")) {
    var css = document.createElement("style");
    css.id = "index-section-css";
    css.textContent = "body.index-sorted #index-rail{position:fixed;top:102px;left:0;bottom:0;width:240px;z-index:6;padding:28px 26px 40px;background:#070707;overflow:auto;scrollbar-width:none}body.index-sorted #index-rail button{display:block;width:100%;margin:0 0 13px;padding:0;border:0;background:none;text-align:left;cursor:pointer;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#8f8a82}body.index-sorted #index-rail button.on,body.index-sorted #index-rail button:hover{color:#f3eee6}body.index-sorted #index-rail .sub{display:none;margin:-4px 0 14px 16px}body.index-sorted #index-rail .sub.open{display:block}body.index-sorted #index-rail .sub button{font-size:11px;letter-spacing:.08em;margin-bottom:9px}body.index-sorted .index-list{left:240px!important;right:0!important;top:102px!important;padding:8px 48px 48px 28px!important;box-sizing:border-box}body.index-sorted .index-row.is-hidden{display:none!important}body.index-sorted .index-empty{margin:8px 0 0;color:#8f8a82;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:.14em;text-transform:uppercase}.journal-rail{display:none!important}body.journal-page .journal-rail{display:block!important}";
    document.documentElement.appendChild(css);
  }
  function idOf(row) { return ((row.getAttribute("href") || "").split("/").pop() || "").split("?")[0]; }
  function sectionOf(id) { if (HOME[id]) return HOME[id]; if (PLACES[id]) return "locations"; if (VIGNETTES[id]) return "vignettes"; return "power"; }
  function onIndex() { return (location.hash || "").indexOf("#/index") === 0; }
  function railHtml() {
    return SECTIONS.map(function (s) {
      var button = '<button type="button" data-sec="' + s[0] + '">' + s[1] + "</button>";
      if (s[0] !== "factions") return button;
      return button + '<div class="sub" id="index-factions">' + FACTIONS.map(function (f) {
        return '<button type="button" data-fac="' + f[0] + '">' + f[1] + "</button>";
      }).join("") + "</div>";
    }).join("");
  }
  function paint() {
    var list = document.querySelector(".index-list");
    var stray = document.getElementById("journal-rail");
    if (!onIndex() || !list) {
      document.body.classList.remove("index-sorted");
      var old = document.getElementById("index-rail");
      if (old) old.remove();
      return;
    }
    if (stray) stray.remove();
    document.body.classList.add("index-sorted");
    list.style.setProperty("left", "240px", "important");
    list.style.setProperty("right", "0", "important");
    list.style.setProperty("top", "102px", "important");
    list.style.setProperty("padding", "8px 48px 48px 28px", "important");
    var rail = document.getElementById("index-rail");
    if (!rail) {
      rail = document.createElement("aside");
      rail.id = "index-rail";
      rail.innerHTML = railHtml();
      rail.addEventListener("click", function (e) {
        var sec = e.target.getAttribute("data-sec");
        var fac = e.target.getAttribute("data-fac");
        if (sec) { open = sec; faction = ""; }
        if (fac) { open = "factions"; faction = fac; }
        paint();
      });
      document.body.appendChild(rail);
    }
    var sub = document.getElementById("index-factions");
    if (sub) sub.classList.toggle("open", open === "factions");
    rail.querySelectorAll("[data-sec]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-sec") === open); });
    rail.querySelectorAll("[data-fac]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-fac") === faction); });
    var members = null;
    if (open === "factions" && faction) FACTIONS.forEach(function (f) { if (f[0] === faction) members = f[2]; });
    var shown = 0;
    list.querySelectorAll(".index-row").forEach(function (row) {
      var id = idOf(row);
      var hide = !!HIDE[id] || (open === "factions" ? !members || members.indexOf(id) === -1 : sectionOf(id) !== open);
      row.classList.toggle("is-hidden", hide);
      if (!hide) shown += 1;
    });
    var empty = list.querySelector(".index-empty");
    if (!shown) {
      if (!empty) { empty = document.createElement("p"); empty.className = "index-empty"; list.insertBefore(empty, list.firstChild); }
      empty.textContent = open === "factions" && !faction ? "Choose a faction" : "None filed here yet";
    } else if (empty) empty.remove();
  }
  window.addEventListener("hashchange", paint);
  paint();
  setTimeout(paint, 50);
  setTimeout(paint, 300);
})();
