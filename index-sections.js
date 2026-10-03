(function () {
  var SECTIONS = [["ancients","Ancients"],["divines","Divines"],["demonic","Demonic Lords"],["ascendants","Ascendants"],["power","Figures of Power"],["heroes","Heroes"],["factions","Factions"],["locations","Locations"],["armaments","Armaments"],["vignettes","Vignettes"]];
  /* replaced: kindred/heartroot/mano dropdowns.
  var FACTIONS = [["kindred","Draconic Kindred",["galand-helviath"]],["heartroot","Heartroot",["saoirse","vaerek-at-ease"]],["mano","Mano",["mano","galand-helviath"]]];
  */
  /* replaced: kindred without Vaerek, Saoirse, Montmorian, Filibeth; armies without Revenant Host. */
var FACTIONS = [["kindred","Draconic Kindred",["galand-helviath","aszurithice","nyralshirad","pethengorom","heldranc-flies","vaerek-at-ease","saoirse","montmorian-chamber","filibeth"]],["armies","Demonic Armies",["mano","mintas-fae","vehem-adahr","vorn","revenant-host"]],["heartroot","Druids of Heartroot Sanctuary",["saoirse"]]];
  var HOME = {aghor:"ancients",auralon:"ancients",caurobor:"ancients",hesk:"ancients",maegoroth:"ancients","salaseth-ii":"ancients",sthistu:"ancients",mano:"demonic","mintas-fae":"demonic","vehem-adahr":"demonic",vorn:"demonic",aszurithice:"power","nyralshirad":"power",pethengorom:"power","heldranc-flies":"power","montmorian-chamber":"power","vaerek-at-ease":"heroes",saoirse:"heroes","galand-helviath":"heroes","perstrin-naba":"heroes","silar-scorria":"heroes","yuo-nanaga":"heroes",kojin:"heroes",baiji:"heroes","hanto-han":"heroes"};
  var PLACES = {"ashforge-kuroishi":1,"phantom-cavern":1};
  var VIGNETTES = {"cadarinost-falls":1};
  var HIDE = {"aszurithice-human":1,"heldranc-human":1,"nyralshirad-human":1,"pethengorom-human":1,"vaerek-heldranc":1};
  var open = "ancients";
  var faction = "";
  if (!document.getElementById("index-section-css")) {
    var css = document.createElement("style");
    css.id = "index-section-css";
    css.textContent = "body.index-sorted{background:#070707}body.index-sorted #index-rail h3{margin:0 0 16px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#8f8a82;font-weight:400}body.index-sorted #index-rail{position:fixed;top:102px;left:0;bottom:0;width:240px;z-index:6;padding:28px 26px 40px;background:#070707;overflow:auto;scrollbar-width:none}body.index-sorted #index-rail button{display:block;width:100%;margin:0 0 13px;padding:0;border:0;background:none;text-align:left;cursor:pointer;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#8f8a82}body.index-sorted #index-rail button.on,body.index-sorted #index-rail button:hover{color:#f3eee6}body.index-sorted #index-rail .sub{display:none;margin:-4px 0 14px 16px}body.index-sorted #index-rail .sub.open{display:block}body.index-sorted #index-rail .sub button{font-size:11px;letter-spacing:.08em;margin-bottom:9px}body.index-sorted #index-rail h3{margin:0 0 16px;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#f3eee6;font-weight:400}body.index-sorted #index-flow{position:fixed;top:102px;left:240px;right:0;bottom:0;z-index:5;overflow:auto;display:flex;flex-wrap:wrap;align-content:flex-start;justify-content:center;gap:34px 26px;padding:32px 40px 72px;background:#070707;scrollbar-width:none}@media (max-width:800px){body.index-sorted #index-flow{position:static!important;left:0!important;right:0!important;top:auto!important;width:100%!important;display:flex!important;flex-direction:column;align-items:center!important;justify-content:flex-start;padding:96px 18px 80px 18px!important}body.index-sorted .index-card{width:min(280px,78vw)!important;margin:0 auto!important}body.index-sorted .index-card img{width:100%!important;height:auto!important;margin:0 auto}}body.index-sorted .index-card{width:220px;color:#f3eee6;text-decoration:none}body.index-sorted .index-card span{display:block;height:2.7em;margin:0 0 12px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.35;letter-spacing:.14em;text-transform:uppercase}body.index-sorted .index-card img{display:block;width:220px;height:300px;object-fit:cover}@media (max-width:800px){body.index-sorted .index-card{width:calc(100vw - 28px)!important;max-width:none!important;margin:0 auto 22px!important;text-align:center!important}body.index-sorted .index-card span{height:auto!important;margin:0 0 8px!important;text-align:center!important}body.index-sorted .index-card img{width:100%!important;height:auto!important;aspect-ratio:16/9!important;object-fit:cover!important}}body.index-sorted .index-empty{color:#8f8a82;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:.14em;text-transform:uppercase}";
    document.documentElement.appendChild(css);
  }
  /* replaced: unlisted entries fell into Figures of Power. */
  function sectionOf(id) { if (HOME[id]) return HOME[id]; if (PLACES[id]) return "locations"; if (VIGNETTES[id]) return "vignettes"; return ""; }
  function railHtml() {
    return '<h3>Categories</h3>' + SECTIONS.map(function (s) {
      var button = '<button type="button" data-sec="' + s[0] + '">' + s[1] + "</button>";
      if (s[0] !== "factions") return button;
      return button + '<div class="sub" id="index-factions">' + FACTIONS.map(function (f) { return '<button type="button" data-fac="' + f[0] + '">' + f[1] + "</button>"; }).join("") + "</div>";
    }).join("");
  }
  function chosen(id) {
    if (HIDE[id]) return false;
    if (open === "factions") {
      if (!faction) return false;
      var members = [];
      FACTIONS.forEach(function (f) { if (f[0] === faction) members = f[2]; });
      return members.indexOf(id) !== -1;
    }
    return sectionOf(id) === open;
  }
  function clearPage() {
    Array.prototype.slice.call(document.body.children).forEach(function (el) {
      if (el.id === "index-rail" || el.id === "index-flow" || el.id === "section-bar" || el.id === "friend-link") return;
      var tag = el.tagName;
      if (tag === "HEADER" || tag === "NAV" || tag === "SCRIPT" || tag === "STYLE" || tag === "LINK" || tag === "CANVAS") return;
      if (el.classList.contains("topbar") || el.classList.contains("mast")) return;
      el.remove();
    });
  }
  function markIndex() {
    document.querySelectorAll(".filters > a, .filters > .nav-drop > a").forEach(function (a) {
      a.classList.toggle("active", (a.getAttribute("href") || "") === "#/index");
    });
  }
  function paintIndex() {
    markIndex();
    document.title = "Index - Elorae";
    document.body.className = "room index-sorted" + (open === "factions" ? " factions-open" : "");
    document.body.style.backgroundImage = "";
    clearPage();
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
        paintIndex();
      });
      document.body.appendChild(rail);
    }
    var sub = document.getElementById("index-factions");
    if (sub) sub.classList.toggle("open", open === "factions");
    rail.querySelectorAll("[data-sec]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-sec") === open); });
    rail.querySelectorAll("[data-fac]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-fac") === faction); });
    var flow = document.getElementById("index-flow");
    if (!flow) { flow = document.createElement("div"); flow.id = "index-flow"; document.body.appendChild(flow); }
    var items = (window.ENTRIES || []).filter(function (e) { return chosen(e.id); });
    items.sort(function (a, b) { return a.title.localeCompare(b.title); });
    var tertiary = document.getElementById("index-tertiary");
    if (open === "factions") {
      if (!tertiary) { tertiary = document.createElement("nav"); tertiary.id = "index-tertiary"; document.body.appendChild(tertiary); }
      tertiary.innerHTML = FACTIONS.map(function (f) { return '<button type="button" data-fac="' + f[0] + '"' + (f[0] === faction ? ' class="on"' : '') + '>' + f[1] + '</button>'; }).join("");
      tertiary.onclick = function (e) { var fac = e.target.getAttribute("data-fac"); if (!fac) return; open = "factions"; faction = fac; paintIndex(); };
    } else if (tertiary) tertiary.remove();
    if (!items.length) { flow.innerHTML = '<p class="index-empty">' + (open === "factions" && !faction ? "Choose a faction" : "None filed here yet") + "</p>"; return; }
    /* replaced: card used e.image, which was the dragon art for these five.
    flow.innerHTML = items.map(function (e) { return '<a class="index-card" href="#/' + e.id + '"><span>' + e.title + '</span><img src="' + e.image + '" alt=""></a>'; }).join("");
    */
    var CARD = {"aszurithice":"assets/Aszurithice, Human Form.png","nyralshirad":"assets/Nyralshirad Human Form.png","pethengorom":"assets/Pethengorom, Human Form.png","heldranc-flies":"assets/Heldranc, Human Form.webp","montmorian-chamber":"assets/Montmorian in his Chamber .png"};
    flow.innerHTML = items.map(function (e) { var src = CARD[e.id] || e.image; return '<a class="index-card" href="#/' + e.id + '"><span>' + e.title + '</span><img src="' + src + '" alt=""></a>'; }).join("");
  }
  function clearIndex() {
    document.body.classList.remove("index-sorted");
    var rail = document.getElementById("index-rail");
    var flow = document.getElementById("index-flow");
    if (rail) rail.remove();
    if (flow) flow.remove();
    var tertiary = document.getElementById("index-tertiary");
    if (tertiary) tertiary.remove();
  }
  window.paintIndex = paintIndex;
  window.renderIndex = paintIndex;
  window.addEventListener("hashchange", function () {
    if ((location.hash || "").indexOf("#/index") === 0) paintIndex();
    else clearIndex();
  });
  if ((location.hash || "").indexOf("#/index") === 0) paintIndex();
})();
