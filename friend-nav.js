(function () {
  var phraseCss = ".seal-card input,#seal-code{caret-color:transparent!important}.seal-card input::placeholder,#seal-code::placeholder{color:#8f8a82;animation:phrase-pulse 2.6s ease-in-out infinite}@keyframes phrase-pulse{0%,100%{opacity:.28}50%{opacity:.9}}#phrase-caret{position:fixed;width:1px;height:18px;background:rgba(243,238,230,.45);pointer-events:none;z-index:30;display:none}";
  var phrase = document.getElementById("phrase-pulse");
  if (!phrase) { phrase = document.createElement("style"); phrase.id = "phrase-pulse"; document.documentElement.appendChild(phrase); }
  phrase.textContent = phraseCss;
  var mark = document.getElementById("phrase-caret");
  if (!mark) { mark = document.createElement("i"); mark.id = "phrase-caret"; document.documentElement.appendChild(mark); }
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
  setInterval(placeCaret, 200);
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
    if (!v || !FIGURE[v.id]) { if (link) link.remove(); return; }
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
  }
  window.paintFriend = paint;
  paint();
  window.addEventListener("hashchange", function () { setTimeout(paint, 40); });
  setInterval(paint, 300);
})();
