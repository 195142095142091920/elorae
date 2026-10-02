(function () {
  var phraseCss = ".seal-card input,#seal-code{caret-color:transparent!important}.seal-card input::placeholder,#seal-code::placeholder{color:#8f8a82;animation:phrase-pulse 2.6s ease-in-out infinite}@keyframes phrase-pulse{0%,100%{opacity:.28}50%{opacity:.9}}#phrase-caret{position:fixed;width:1px;height:18px;background:rgba(243,238,230,.45);pointer-events:none;z-index:30;display:none}.seal-greet{margin:0 0 10px;color:#8f8a82;letter-spacing:.22em;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;font-size:11px}#friend-glow{position:fixed!important;z-index:400!important;pointer-events:none;display:none}body.seal-page .topbar,body.seal-page .mast{overflow:visible!important}body.seal-page #friend-link{color:#e7f6ee!important;text-shadow:0 0 6px rgba(16,54,36,.35)!important;z-index:410!important}";
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
  var ctx = glow.getContext("2d");
  var W = 420;
  var H = 220;
  function mote() {
    return { x: 50 + Math.random() * (W - 100), y: 40 + Math.random() * 120, vx: (Math.random() - 0.5) * 0.1, vy: -0.03 - Math.random() * 0.06, life: Math.random(), fade: 0.0016 + Math.random() * 0.0024, r: Math.random() < 0.2 ? 1.1 : 0.55 };
  }
  var bits = [];
  var n;
  for (n = 0; n < 22; n += 1) bits.push(mote());
  function drawBits() {
    if (glow.style.display !== "none") {
      ctx.clearRect(0, 0, W, H);
      var g = ctx.createRadialGradient(W / 2, 78, 4, W / 2, 90, 170);
      g.addColorStop(0, "rgba(10,36,24,0.16)");
      g.addColorStop(0.5, "rgba(10,36,24,0.05)");
      g.addColorStop(1, "rgba(10,36,24,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      bits.forEach(function (b) {
        b.life += b.fade;
        b.x += b.vx;
        b.y += b.vy;
        if (b.life > 1 || b.y < 12 || b.x < 18 || b.x > W - 18) {
          var next = mote();
          b.x = next.x; b.y = next.y; b.vx = next.vx; b.vy = next.vy; b.life = 0; b.fade = next.fade; b.r = next.r;
        }
        var alpha = Math.sin(b.life * Math.PI) * 0.5;
        ctx.beginPath();
        ctx.fillStyle = "rgba(214,236,222," + alpha + ")";
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
    jack: ["Galand Helviath", "#/galand-helviath"],
    jon: ["Telorin", "#/telorin"],
    julie: ["Saoirse", "#/saoirse"],
    sawyer: ["Vaerek Rathkin", "#/vaerek-at-ease"]
  };
  if (!document.getElementById("friend-nav-css")) {
    var css = document.createElement("style");
    css.id = "friend-nav-css";
    css.textContent = "#friend-link{position:fixed;right:28px;z-index:410;display:flex;align-items:center;height:22px;line-height:1;color:#8f8a82;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;letter-spacing:.16em;text-transform:uppercase}";
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
