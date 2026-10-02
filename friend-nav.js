(function () {
  var phraseCss = ".seal-card input,#seal-code{caret-color:transparent!important}.seal-card input::placeholder,#seal-code::placeholder{color:#8f8a82;animation:phrase-pulse 2.6s ease-in-out infinite}@keyframes phrase-pulse{0%,100%{opacity:.28}50%{opacity:.9}}#phrase-caret{position:fixed;width:1px;height:18px;background:rgba(243,238,230,.45);pointer-events:none;z-index:30;display:none}.seal-greet{margin:0 0 10px;color:#8f8a82;letter-spacing:.22em;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;font-size:11px}#friend-glow{position:fixed;z-index:250;pointer-events:none;display:none}body.seal-page #friend-link{color:#e7f6ee!important;text-shadow:0 0 8px rgba(18,72,46,.45)!important}";
  var phrase = document.getElementById("phrase-pulse");
  if (!phrase) { phrase = document.createElement("style"); phrase.id = "phrase-pulse"; document.documentElement.appendChild(phrase); }
  phrase.textContent = phraseCss;
  var mark = document.getElementById("phrase-caret");
  if (!mark) { mark = document.createElement("i"); mark.id = "phrase-caret"; document.documentElement.appendChild(mark); }
  var glow = document.getElementById("friend-glow");
  if (!glow) { glow = document.createElement("canvas"); glow.id = "friend-glow"; document.documentElement.appendChild(glow); }
  var ctx = glow.getContext("2d");
  var bits = [];
  var i;
  for (i = 0; i < 28; i += 1) bits.push({ a: Math.random() * 6.28, r: 18 + Math.random() * 54, s: 0.002 + Math.random() * 0.004, o: 0.15 + Math.random() * 0.45, w: Math.random() < 0.3 ? 1.4 : 0.7 });
  function drawBits() {
    if (glow.style.display === "none") return;
    var w = glow.width;
    var h = glow.height;
    ctx.clearRect(0, 0, w, h);
    var g = ctx.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, 70);
    g.addColorStop(0, "rgba(12,48,30,0.22)");
    g.addColorStop(1, "rgba(12,48,30,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    bits.forEach(function (b) {
      b.a += b.s;
      var x = w / 2 + Math.cos(b.a) * b.r;
      var y = h / 2 + Math.sin(b.a * 0.72) * (b.r * 0.28);
      ctx.globalAlpha = b.o * (0.65 + 0.35 * Math.sin(b.a * 2));
      ctx.fillStyle = "#d7f3e4";
      ctx.fillRect(x, y, b.w, b.w);
    });
    ctx.globalAlpha = 1;
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
    jack: ["Galand Helviath", "#/galand-helviath"],
    jon: ["Telorin", "#/telorin"],
    julie: ["Saoirse", "#/saoirse"],
    sawyer: ["Vaerek Rathkin", "#/vaerek-at-ease"]
  };
  if (!document.getElementById("friend-nav-css")) {
    var css = document.createElement("style");
    css.id = "friend-nav-css";
    css.textContent = "#friend-link{position:fixed;right:28px;z-index:260;display:flex;align-items:center;height:22px;line-height:1;color:#8f8a82;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;letter-spacing:.16em;text-transform:uppercase}";
    document.documentElement.appendChild(css);
  }
  function paint() {
    var v = typeof vaultOf === "function" ? vaultOf() : null;
    var link = document.getElementById("friend-link");
    var onSeal = document.body.classList.contains("seal-page") && !document.getElementById("seal-code");
    if (!v || !FIGURE[v.id]) { if (link) link.remove(); glow.style.display = "none"; return; }
    if (!link) {
      link = document.createElement("a");
      link.id = "friend-link";
      document.documentElement.appendChild(link);
    }
    link.href = FIGURE[v.id][1];
    link.textContent = FIGURE[v.id][0];
    var bar = document.querySelector(".topbar") || document.querySelector(".mast");
    if (bar) {
      var r = bar.getBoundingClientRect();
      link.style.top = Math.round(r.top + (r.height - link.offsetHeight) / 2) + "px";
    }
    if (!onSeal) { glow.style.display = "none"; return; }
    var box = link.getBoundingClientRect();
    glow.width = 240;
    glow.height = 90;
    glow.style.display = "block";
    glow.style.width = "240px";
    glow.style.height = "90px";
    glow.style.left = Math.round(box.left + box.width / 2 - 120) + "px";
    glow.style.top = Math.round(box.top + box.height / 2 - 45) + "px";
  }
  window.paintFriend = paint;
  paint();
  window.addEventListener("hashchange", function () { setTimeout(paint, 40); setTimeout(greet, 60); });
  setInterval(paint, 300);
})();
