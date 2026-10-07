/* Atlas map lightbox: click the map to open it full screen; wheel/pinch zoom, drag to pan,
   double-click/tap toggles zoom, Esc or a click outside the map closes. */
(function () {
  var src = document.querySelector("main.read figure img.atlas-map");
  if (!src) return;
  var box = document.createElement("div");
  box.id = "map-zoom";
  box.hidden = true;
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "Map of Elorae");
  box.innerHTML = '<button type="button" class="map-zoom-close" aria-label="Close"><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M1 1L13 13M13 1L1 13" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg></button><img alt="Map of Elorae" draggable="false">';
  document.body.appendChild(box);
  var img = box.querySelector("img");
  var s = 1, x = 0, y = 0, MAX = 6;
  var pts = {}, last = null, pinch = null, moved = false, lastTap = 0, lastType = "mouse";
  function apply() { img.style.transform = "translate(" + x + "px," + y + "px) scale(" + s + ")"; box.classList.toggle("zoomed", s > 1.01); }
  function clamp() {
    if (s <= 1) { s = 1; x = 0; y = 0; return; }
    var w = img.offsetWidth * s, h = img.offsetHeight * s;
    var mx = Math.max(0, (w - innerWidth) / 2), my = Math.max(0, (h - innerHeight) / 2);
    x = Math.min(mx, Math.max(-mx, x)); y = Math.min(my, Math.max(-my, y));
  }
  function zoomAt(ns, cx, cy) {
    ns = Math.min(MAX, Math.max(1, ns));
    var ox = cx - innerWidth / 2, oy = cy - innerHeight / 2;
    x = ox - (ox - x) * ns / s; y = oy - (oy - y) * ns / s; s = ns;
    clamp(); apply();
  }
  function open() { img.src = window.eloraeImg ? window.eloraeImg.orig(src.getAttribute("src")) : (src.currentSrc || src.src); /* zoom: full-res original */ s = 1; x = 0; y = 0; apply(); box.hidden = false; document.documentElement.classList.add("map-zoom-open"); }
  function close() { box.hidden = true; document.documentElement.classList.remove("map-zoom-open"); }
  src.addEventListener("click", open);
  var shut = box.querySelector(".map-zoom-close");
  shut.addEventListener("click", function (e) { e.stopPropagation(); close(); });
  shut.addEventListener("pointerup", function (e) { e.stopPropagation(); close(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !box.hidden) close(); });
  var downOnBox = false;
  box.addEventListener("pointerdown", function (e) { downOnBox = e.target === box; });
  box.addEventListener("pointerup", function (e) { if (downOnBox && e.target === box) close(); downOnBox = false; });
  box.addEventListener("wheel", function (e) { e.preventDefault(); zoomAt(s * Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); }, { passive: false });
  img.addEventListener("dblclick", function (e) { e.preventDefault(); if (lastType === "touch") return; zoomAt(s > 1.01 ? 1 : 2.5, e.clientX, e.clientY); });
  img.addEventListener("pointerdown", function (e) {
    lastType = e.pointerType;
    img.setPointerCapture(e.pointerId);
    pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    moved = false;
    var ids = Object.keys(pts);
    if (ids.length === 2) {
      var a = pts[ids[0]], b = pts[ids[1]];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: s };
    } else { last = { x: e.clientX, y: e.clientY }; }
  });
  img.addEventListener("pointermove", function (e) {
    if (!pts[e.pointerId]) return;
    pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pts);
    if (ids.length === 2 && pinch) {
      var a = pts[ids[0]], b = pts[ids[1]];
      zoomAt(pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, (a.x + b.x) / 2, (a.y + b.y) / 2);
      moved = true;
    } else if (last && s > 1) {
      x += e.clientX - last.x; y += e.clientY - last.y; last = { x: e.clientX, y: e.clientY };
      if (Math.abs(x) + Math.abs(y) > 0) moved = true;
      clamp(); apply();
    }
  });
  function up(e) {
    delete pts[e.pointerId];
    if (Object.keys(pts).length < 2) pinch = null;
    if (!Object.keys(pts).length) last = null;
    if (e.type === "pointerup" && e.pointerType === "touch" && !moved) {
      var now = Date.now();
      if (now - lastTap < 300) { zoomAt(s > 1.01 ? 1 : 2.5, e.clientX, e.clientY); lastTap = 0; } else lastTap = now;
    }
  }
  img.addEventListener("pointerup", up);
  img.addEventListener("pointercancel", up);
})();
