(function () {
  var phraseCss = "header.topbar > a:not([data-brand]),.topbar > a:not([data-brand]){color:transparent!important}.seal-card form{position:relative}.seal-card input,#seal-code{caret-color:transparent!important}.seal-card input::placeholder,#seal-code::placeholder{color:#8f8a82;animation:phrase-pulse 2.6s ease-in-out infinite}@keyframes phrase-pulse{0%,100%{opacity:.28}50%{opacity:.9}}#phrase-caret{position:absolute;width:1px;height:18px;background:rgba(243,238,230,.45);pointer-events:none;z-index:30;display:none}.seal-greet{margin:0 0 10px;color:#8f8a82;letter-spacing:.22em;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;font-size:11px}#friend-glow{position:fixed!important;z-index:500!important;pointer-events:none;display:none}html,body,body.seal-page,body.seal-page .topbar,body.seal-page .mast{overflow:visible!important}.subbar{display:none!important}@media (max-width:800px){#friend-link{display:none!important}body.seal-page #friend-link{display:flex!important;position:fixed;top:calc(env(safe-area-inset-top) + 10px);right:14px;z-index:640}}body.seal-page #friend-link{position:fixed;right:28px;z-index:510;display:flex;align-items:center;gap:42px;height:22px}#friend-link a + a{margin-left:42px!important}#friend-link a{color:#8f8a82;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;letter-spacing:.16em;text-transform:uppercase;line-height:1}#friend-link a:hover,#friend-link a.here{color:#f3eee6}";
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
    "Silar": { wash: "168,48,18", mote: "255,150,72", shadow: "160,46,16" },
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
      var firstTone = TONES[glow.getAttribute("data-tone")] || tone;
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W / 2, 78);
      ctx.scale(1.15, 0.45);
      var g = ctx.createRadialGradient(0, 0, 6, 0, 0, 120);
      g.addColorStop(0, "rgba(" + firstTone.wash + ",0.22)");
      g.addColorStop(0.4, "rgba(" + firstTone.wash + ",0.16)");
      g.addColorStop(0.72, "rgba(" + firstTone.wash + ",0)");
      g.addColorStop(1, "rgba(" + firstTone.wash + ",0)");
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
        var alpha = Math.sin(b.life * Math.PI) * 1;
        ctx.beginPath();
        ctx.fillStyle = "rgba(" + firstTone.mote + "," + alpha + ")";
        ctx.arc(b.x, b.y, b.r, 0, 6.28);
        ctx.fill();
      });
    }
    var second = document.getElementById("friend-glow-2");
    if (second && second.style.display !== "none") {
      var saved = tone;
      tone = TONES[second.getAttribute("data-tone")] || TONES.Silar;
      var ctx2 = second.getContext("2d");
      ctx2.clearRect(0, 0, W, H);
      ctx2.save();
      ctx2.translate(W / 2, 78);
      ctx2.scale(2.8, 1);
      var g2 = ctx2.createRadialGradient(0, 0, 6, 0, 0, 120);
      g2.addColorStop(0, "rgba(" + tone.wash + ",0.22)");
      g2.addColorStop(0.4, "rgba(" + tone.wash + ",0.16)");
      g2.addColorStop(0.72, "rgba(" + tone.wash + ",0)");
      g2.addColorStop(1, "rgba(" + tone.wash + ",0)");
      ctx2.fillStyle = g2;
      ctx2.fillRect(-W, -H, W * 2, H * 2);
      ctx2.restore();
      bits.forEach(function (b) {
        var alpha2 = Math.sin(b.life * Math.PI) * 0.85;
        ctx2.beginPath();
        ctx2.fillStyle = "rgba(" + tone.mote + "," + alpha2 + ")";
        ctx2.arc(b.x, b.y, b.r, 0, 6.28);
        ctx2.fill();
      });
      tone = saved;
    }
    requestAnimationFrame(drawBits);
  }
  requestAnimationFrame(drawBits);
  function placeCaret() {
    var input = document.getElementById("seal-code");
    if (!input || document.activeElement !== input || input.value) { mark.style.display = "none"; return; }
    var host = input.parentNode;
    if (host && mark.parentNode !== host) host.appendChild(mark);
    var probe = document.getElementById("phrase-probe");
    if (!probe) {
      probe = document.createElement("span");
      probe.id = "phrase-probe";
      probe.textContent = input.getAttribute("placeholder") || "Phrase";
      probe.style.cssText = "position:absolute;left:-9999px;visibility:hidden;white-space:pre;font:inherit;font-size:18px;letter-spacing:.08em";
      document.documentElement.appendChild(probe);
    }
    var word = probe.getBoundingClientRect().width;
    mark.style.position = "absolute";
    mark.style.display = "block";
    mark.style.left = Math.round(input.offsetLeft + (input.offsetWidth - word) / 2 - 1) + "px";
    mark.style.top = Math.round(input.offsetTop + (input.offsetHeight - 18) / 2) + "px";
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
    var brand = document.querySelector("header.topbar > a, .topbar > a");
    var onEntry = document.body.classList.contains("entry");
    if (brand && brand.id !== "seal-back") {
      var label = "Elorae";
      var href = "#/seal";
      if (onEntry) {
        label = "Back";
        href = (window.place && window.place.hash) || "#/gallery";
        if (!href || href.indexOf("#/") !== 0 || href === (location.hash || "").split("?")[0]) href = "#/gallery";
      } else if (v && FIGURE[v.id]) {
        var named = chosen(v.id);
        label = named[0];
        href = named[1];
      }
      if (brand.textContent !== label) brand.textContent = label;
      if (brand.getAttribute("href") !== href) brand.setAttribute("href", href);
      brand.setAttribute("data-brand", label);
    }
    if (!v || !FIGURE[v.id]) { if (link) link.remove(); glow.style.display = "none"; return; }
    if (!onSeal && link) link.style.display = "none";
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
    var here = (location.hash || "").split("?")[0];
    Array.prototype.forEach.call(link.querySelectorAll("a"), function (a) {
      var own = a.getAttribute("href") === here;
      a.style.display = own ? "none" : "";
      a.classList.toggle("on", a.getAttribute("data-name") === item[0]);
      a.classList.toggle("here", list.length < 2 || own);
    });
    var shown = Array.prototype.filter.call(link.querySelectorAll("a"), function (a) { return a.style.display !== "none"; });
    link.style.display = shown.length ? "" : "none";
    tone = TONES[item[0]] || TONES.Telorin;
    var active = link.querySelector("a.on");
    Array.prototype.forEach.call(link.querySelectorAll("a"), function (a) {
      if (onSeal) {
        var toneNow = TONES[a.getAttribute("data-name")] || tone;
        a.style.textShadow = "0 0 12px rgba(" + toneNow.mote + ",0.95), 0 0 28px rgba(" + toneNow.wash + ",0.85)";
      } else a.style.textShadow = "none";
    });
    document.body.classList.add("has-friend");
    link.style.top = "";
    link.style.right = "";
    link.style.fontSize = "";
    if (!document.getElementById("seal-code") && mark) mark.style.display = "none";
    var fit = document.querySelector("body.entry #fit, body.entry #fitmark, body.entry .fit-mark");
    if (fit) {
      var fb = fit.getBoundingClientRect();
      if (fb.width) {
        link.style.top = Math.round(fb.top + (fb.height - link.offsetHeight) / 2) + "px";
        link.style.right = Math.round(window.innerWidth - fb.left + 12) + "px";
      }
    }
    var names = Array.prototype.filter.call(link.querySelectorAll("a"), function (a) { return a.style.display !== "none"; });
    if (!onSeal || !names.length) { glow.style.display = "none"; var extra = document.getElementById("friend-glow-2"); if (extra) extra.style.display = "none"; return; }
    function place(canvas, el) {
      var box = el.getBoundingClientRect();
      canvas.setAttribute("data-tone", el.getAttribute("data-name"));
      if (canvas.width !== W) canvas.width = W;
      if (canvas.height !== H) canvas.height = H;
      canvas.style.position = "fixed";
      canvas.style.zIndex = "240";
      canvas.style.pointerEvents = "none";
      canvas.style.display = "block";
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      canvas.style.left = Math.round(box.left + box.width / 2 - W / 2) + "px";
      canvas.style.top = Math.round(box.top + box.height / 2 - 70) + "px";
    }
    place(glow, names[0]);
    var second = document.getElementById("friend-glow-2");
    if (names.length < 2) { if (second) second.style.display = "none"; }
    if (names.length > 1) {
      var second = document.getElementById("friend-glow-2");
      if (!second) {
        second = document.createElement("canvas");
        second.id = "friend-glow-2";
        second.className = "friend-glow";
        document.documentElement.appendChild(second);
      }
      place(second, names[1]);
      second.setAttribute("data-tone", names[1].getAttribute("data-name"));
    }
  }
  window.paintFriend = paint;
  paint();
  window.addEventListener("hashchange", function () { paint(); setTimeout(paint, 0); setTimeout(greet, 60); });
  if (!window.__brandWatch) {
    window.__brandWatch = 1;
    new MutationObserver(function () { paint(); }).observe(document.documentElement, { childList: true, subtree: true });
  }
  setInterval(paint, 1200);
})();
