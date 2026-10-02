(function () {
  var phraseCss = ".seal-card input,#seal-code{caret-color:transparent!important}.seal-card input::placeholder,#seal-code::placeholder{color:#8f8a82;animation:phrase-pulse 2.6s ease-in-out infinite}@keyframes phrase-pulse{0%,100%{opacity:.28}50%{opacity:.9}}#phrase-caret{position:fixed;width:1px;height:18px;background:rgba(243,238,230,.45);pointer-events:none;z-index:30;display:none}.seal-greet{margin:0 0 10px;color:#8f8a82;letter-spacing:.22em;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;font-size:11px}#friend-glow{position:fixed!important;z-index:500!important;pointer-events:none;display:none}html,body,body.seal-page,body.seal-page .topbar,body.seal-page .mast{overflow:visible!important}body.seal-page #friend-link{position:fixed;right:28px;z-index:510;display:flex;align-items:center;gap:16px;height:22px}#friend-link a{color:#8f8a82;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;letter-spacing:.16em;text-transform:uppercase;line-height:1}#friend-link a:hover{color:#f3eee6}";
  var phrase = document.getElementById("phrase-pulse");
  if (!phrase) { phrase = document.createElement("style"); phrase.id = "phrase-pulse"; document.documentElement.appendChild(phrase); }
  phrase.textContent = phraseCss;
  var mark = document.getElementById("phrase-caret");
  if (!mark) { mark = document.createElement("i"); mark.id = "phrase-caret"; document.documentElement.appendChild(mark); }
  var glow = document.getElementById("friend-glow");
  if (!glow || glow.tagName !== "CANVAS") {
    if (glow) glow.remove();
    glow = document.createElement("canvas");
    glow.id = "friend-glow";
    document.documentElement.appendChild(glow);
  }
  var oldPick = document.getElementById("friend-pick");
  if (oldPick) oldPick.remove();
  var ctx = glow.getContext("2d");
  var W = 640;
  var H = 220;
  var tone = { wash: "18,78,48", mote: "186,236,206", shadow: "24,92,56" };
  var TONES = {
    "Telorin": { wash: "18,78,48", mote: "186,236,206", shadow: "24,92,56" },
    "Silar": { wash: "150,62,16", mote: "255,168,78", shadow: "150,70,18" },
    "Saoirse": { wash: "210,150,170", mote: "255,236,240", shadow: "190,130,150" },
    "Vaerek": { wash: "150,62,16", mote: "255,168,78", shadow: "150,70,18" },
    "Galand": { wash: "128,96,22", mote: "255,224,150", shadow: "130,100,24" }
  };
  function mote() {
    return { x: 80 + Math.random() * (W - 160), y: 40 + Math.random() * 90, vx: (Math.random() - 0.5) * 0.06, vy: -0.012 - Math.random() * 0.02, life: Math.random(), fade: 0.0012 + Math.random() * 0.0018, r: Math.random() < 0.2 ? 1.1 : 0.55 };
  }
  var bits = [];
  var n;
  for (n = 0; n < 16; n += 1) bits.push(mote());
  function drawBits() {
    if (glow.style.display !== "none") {
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W / 2, 78);
      ctx.scale(2.8, 1);
      var g = ctx.createRadialGradient(0, 0, 6, 0, 0, 120);
      g.addColorStop(0, "rgba(" + tone.wash + ",0.1)");
      g.addColorStop(0.28, "rgba(" + tone.wash + ",0.04)");
      g.addColorStop(0.62, "rgba(" + tone.wash + ",0.012)");
      g.addColorStop(1, "rgba(" + tone.wash + ",0)");
      ctx.fillStyle = g;
      ctx.fillRect(-W, -H, W * 2, H * 2);
      ctx.restore();
      bits.forEach(function (b) {
        b.life += b.fade;
        b.x += b.vx;
        b.y += b.vy;
        if (b.life > 1 || b.y < 12 || b.x < 24 || b.x > W - 24) {
          var next = mote();
          b.x = next.x; b.y = next.y; b.vx = next.vx; b.vy = next.vy; b.life = 0; b.fade = next.fade; b.r = next.r;
        }
        var alpha = Math.sin(b.life * Math.PI) * 0.4;
        ctx.beginPath();
        ctx.fillStyle = "rgba(" + tone.mote + "," + alpha + ")";
        ctx.arc(b.x, b.y, b.r, 0, 6.28);
        ctx.fill();
      });
    }
    requestAnimationFrame(drawBits);
  }
  requestAnimationFrame(drawBits);
  function placeCaret() {
    var input = document.getElementById("seal-code");
    if (!input || document.activeElement !== input || input.value) { mark.style.display = "none"; return; }
    var probe = document.getElementById("phrase-probe");
    if (!probe) {
      probe = document.createElement("span");
      probe.id = "phrase-probe";
      probe.textContent = input.getAttribute("placeholder") || "Phrase";
      probe.style.cssText = "position:fixed;left:-9999px;visibility:hidden;white-space:pre;font:inherit;font-size:18px;letter-spacing:.08em";
      document.documentElement.appendChild(probe);
    }
    var box = input.getBoundingClientRect();
    var word = probe.getBoundingClientRect().width;
    mark.style.display = "block";
    mark.style.left = Math.round(box.left + (box.width - word) / 2 - 1) + "px";
    mark.style.top = Math.round(box.top + (box.height - 18) / 2) + "px";
  }
  function greet() {
    var card = document.querySelector(".seal-card h1");
    if (!card || document.getElementById("seal-code") || document.querySelector(".seal-greet")) return;
    var line = document.createElement("p");
    line.className = "seal-greet";
    line.textContent = "Welcome,";
    card.parentNode.insertBefore(line, card);
  }
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var input = document.getElementById("seal-code");
    if (!input || document.activeElement !== input) return;
    input.blur();
    placeCaret();
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }, true);
  document.addEventListener("focusin", placeCaret, true);
  document.addEventListener("focusout", placeCaret, true);
  document.addEventListener("input", placeCaret, true);
  setInterval(function () { placeCaret(); greet(); }, 200);
  var FIGURE = {
    jack: [["Galand", "#/galand-helviath"]],
    jon: [["Telorin", "#/telorin"], ["Silar", "#/silar-scorria"]],
    julie: [["Saoirse", "#/saoirse"]],
    sawyer: [["Vaerek", "#/vaerek-at-ease"]]
  };
  function chosen(id) {
    var list = FIGURE[id];
    var saved = "";
    try { saved = localStorage.getItem("elorae-figure-" + id) || ""; } catch (e) {}
    var hit = list[0];
    list.forEach(function (item) { if (item[0] === saved) hit = item; });
    return hit;
  }
  var link = document.getElementById("friend-link");
  if (link && link.tagName !== "SPAN") link.remove();
  function paint() {
    var v = typeof vaultOf === "function" ? vaultOf() : null;
    link = document.getElementById("friend-link");
    var onSeal = document.body.classList.contains("seal-page") && !document.getElementById("seal-code");
    if (!v || !FIGURE[v.id]) { if (link) link.remove(); glow.style.display = "none"; return; }
    if (!link) {
      link = document.createElement("span");
      link.id = "friend-link";
      document.documentElement.appendChild(link);
    }
    var item = chosen(v.id);
    var list = FIGURE[v.id];
    if (link.getAttribute("data-built") !== v.id + item[0]) {
      link.innerHTML = list.map(function (row) {
        return "<a href=\"" + row[1] + "\" data-name=\"" + row[0] + "\">" + row[0] + "</a>";
      }).join("");
      link.setAttribute("data-built", v.id + item[0]);
      Array.prototype.forEach.call(link.querySelectorAll("a"), function (a) {
        a.addEventListener("click", function () {
          try { localStorage.setItem("elorae-figure-" + v.id, a.getAttribute("data-name")); } catch (err) {}
          paint();
        });
      });
    }
    Array.prototype.forEach.call(link.querySelectorAll("a"), function (a) {
      a.classList.toggle("on", a.getAttribute("data-name") === item[0]);
    });
    tone = TONES[item[0]] || TONES.Telorin;
    var active = link.querySelector("a.on");
    Array.prototype.forEach.call(link.querySelectorAll("a"), function (a) { a.style.textShadow = "none"; });
    var bar = document.querySelector(".topbar") || document.querySelector(".mast");
    if (bar) {
      var r = bar.getBoundingClientRect();
      link.style.top = Math.round(r.top + (r.height - link.offsetHeight) / 2) + "px";
      bar.style.overflow = "visible";
    }
    if (!onSeal || !active) { glow.style.display = "none"; return; }
    var box = active.getBoundingClientRect();
    glow.width = W;
    glow.height = H;
    glow.style.display = "block";
    glow.style.width = W + "px";
    glow.style.height = H + "px";
    glow.style.left = Math.round(box.left + box.width / 2 - W / 2) + "px";
    glow.style.top = Math.round(box.top + box.height / 2 - 70) + "px";
    document.documentElement.appendChild(glow);
  }
  window.paintFriend = paint;
  paint();
  window.addEventListener("hashchange", function () { setTimeout(paint, 40); setTimeout(greet, 60); });
  setInterval(paint, 300);
})();
