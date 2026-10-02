(function () {
  var SECTIONS = [
    ["ancients", "Ancients"],
    ["divines", "Divines"],
    ["demonic", "Demonic Lords"],
    ["ascendants", "Ascendants"],
    ["power", "Figures of Power"],
    ["heroes", "Heroes"],
    ["factions", "Factions"],
    ["locations", "Locations"],
    ["armaments", "Armaments"],
    ["vignettes", "Vignettes"]
  ];
  var FACTIONS = [
    ["kindred", "Draconic Kindred", ["galand-helviath"]],
    ["heartroot", "Heartroot", ["saoirse", "vaerek-at-ease"]],
    ["mano", "Mano", ["mano", "galand-helviath"]]
  ];
  var HOME = {
    aghor: "ancients",
    mano: "divines",
    "galand-helviath": "heroes",
    "vaerek-at-ease": "heroes",
    saoirse: "heroes",
    filibeth: "heroes"
  };
  var PLACES = { "ashforge-kuroishi": 1, auralon: 1, "cadarinost-falls": 1, caurobor: 1, "hanto-han": 1, "perstrin-naba": 1, "phantom-cavern": 1 };
  var VIGNETTES = { "heldranc-flies": 1, "montmorian-rages": 1, "montmorian-chamber": 1, "montmorian-alabaster": 1, "kojin-redroot": 1, "saoirse-canyon": 1, "pethengorom-fate": 1 };
  var HIDE = { "aszurithice-human": 1, "heldranc-human": 1, "nyralshirad-human": 1, "pethengorom-human": 1, "vaerek-heldranc": 1 };
  var open = "ancients";
  var faction = "";

  if (!document.getElementById("index-section-css")) {
    var css = document.createElement("style");
    css.id = "index-section-css";
    css.textContent = "body.index-sorted #index-rail{position:fixed;top:102px;left:0;bottom:0;width:232px;z-index:6;padding:36px 28px 40px;background:#070707;overflow:auto;scrollbar-width:none}body.index-sorted #index-rail button{display:block;width:100%;margin:0 0 14px;padding:0;border:0;background:none;text-align:left;cursor:pointer;font-family:\"Helvetica Neue\",Helvetica,Arial,sans-serif;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#8f8a82}body.index-sorted #index-rail button.on,body.index-sorted #index-rail button:hover{color:#f3eee6}body.index-sorted #index-rail .sub{display:none;margin:0 0 16px 14px}body.index-sorted #index-rail .sub.open{display:block}body.index-sorted #index-rail .sub button{font-size:12px;letter-spacing:.1em;margin-bottom:10px}body.index-sorted .index-list{left:248px!important;right:0!important;top:102px!important}body.index-sorted .index-row.is-hidden{display:none}body.index-sorted .index-empty{padding:28px 0;color:#8f8a82;font-family:\"Helvetica Neue\",Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:.14em;text-transform:uppercase}@media (max-width:800px){body.index-sorted #index-rail{position:fixed;top:96px;left:0;right:0;bottom:auto;width:auto;max-height:46vh;padding:18px 16px 8px}body.index-sorted .index-list{left:0!important;top:168px!important}}";
    document.documentElement.appendChild(css);
  }

  function idOf(row) {
    return ((row.getAttribute("href") || "").split("/").pop() || "").split("?")[0];
  }
  function sectionOf(id) {
    if (HOME[id]) return HOME[id];
    if (PLACES[id]) return "locations";
    if (VIGNETTES[id]) return "vignettes";
    return "power";
  }
  function onIndex() {
    return (location.hash || "").indexOf("#/index") === 0;
  }
  function paint() {
    var list = document.querySelector(".index-list");
    if (!onIndex() || !list) {
      document.body.classList.remove("index-sorted");
      var old = document.getElementById("index-rail");
      if (old) old.remove();
      return;
    }
    document.body.classList.add("index-sorted");
    var rail = document.getElementById("index-rail");
    if (!rail) {
      rail = document.createElement("aside");
      rail.id = "index-rail";
      rail.innerHTML = SECTIONS.map(function (s) {
        return "<button type=\"button\" data-sec=\"" + s[0] + "\">" + s[1] + "</button>";
      }).join("") + "<div class=\"sub\" id=\"index-factions\">" + FACTIONS.map(function (f) {
        return "<button type=\"button\" data-fac=\"" + f[0] + "\">" + f[1] + "</button>";
      }).join("") + "</div>";
      rail.addEventListener("click", function (e) {
        var sec = e.target.getAttribute("data-sec");
        var fac = e.target.getAttribute("data-fac");
        if (sec) {
          open = sec;
          faction = "";
          if (sec !== "factions") document.getElementById("index-factions").classList.remove("open");
        }
        if (fac) faction = fac;
        if (sec === "factions") document.getElementById("index-factions").classList.add("open");
        paint();
      });
      document.body.appendChild(rail);
    }
    rail.querySelectorAll("[data-sec]").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-sec") === open);
    });
    rail.querySelectorAll("[data-fac]").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-fac") === faction);
    });
    var members = null;
    if (open === "factions" && faction) {
      FACTIONS.forEach(function (f) { if (f[0] === faction) members = f[2]; });
    }
    var shown = 0;
    list.querySelectorAll(".index-row").forEach(function (row) {
      var id = idOf(row);
      var hide = HIDE[id] || (open === "factions" ? !members || members.indexOf(id) === -1 : sectionOf(id) !== open);
      row.classList.toggle("is-hidden", hide);
      if (!hide) shown += 1;
    });
    var empty = list.querySelector(".index-empty");
    if (!shown) {
      if (!empty) {
        empty = document.createElement("p");
        empty.className = "index-empty";
        empty.textContent = "None filed here yet";
        list.appendChild(empty);
      }
    } else if (empty) empty.remove();
  }
  window.addEventListener("hashchange", function () { setTimeout(paint, 60); });
  setTimeout(paint, 80);
  setTimeout(paint, 400);
})();
