var canvas = document.getElementById("friend-glow");
if (canvas) {
  var ctx = canvas.getContext("2d");
  /* Login / success tones: Jack yellow-gold, Julie pink, Sawyer red-orange,
     Jon Telorin green / Silar red (marks stay fixed; ambient blends), Devin white. */
  var tones = {
    jack: [230, 190, 80],
    julie: [255, 210, 220],
    sawyer: [230, 120, 40],
    jon: [80, 180, 90],
    jon2: [230, 90, 40],
    devin: [243, 238, 230]
  };
  var bits = [];
  function who() {
    var c = document.body.className;
    var m = c.match(/seal-(jack|jon|julie|sawyer|devin)/);
    return m ? m[1] : "";
  }
  function lerpTone(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t)
    ];
  }
  /* Ambient blend only — ~6.4s full cycle (matches CSS 3.2s ease-in-out alternate). */
  function jonAmbient(t) {
    var u = (Math.sin((t / 6400) * Math.PI * 2) + 1) / 2;
    return lerpTone(tones.jon, tones.jon2, u);
  }
  function toneOf(name) {
    return tones[name] || tones.devin;
  }
  function frame(now) {
    var name = who();
    var link = name && (name === "devin"
      ? (document.getElementById("seal-name") || document.getElementById("seal-logout"))
      : (document.querySelector('.friend[data-owner="' + name + '"]') || document.getElementById("seal-name")));

    /* Seal welcome-box ambient: concrete --seal-glow each frame (continuous; no blink). */
    var card = document.querySelector("body.seal-page.seal-jon .seal-card");
    if (card) {
      var amb = jonAmbient(now || 0);
      card.style.setProperty("--seal-glow", "rgba(" + amb[0] + "," + amb[1] + "," + amb[2] + ",.55)");
    }

    if (!name || !link || link.hidden || getComputedStyle(link).display === "none") {
      /* art73: only mutate when visible — rewriting style every rAF can flash chrome. */
      if (canvas.style.display !== "none") canvas.style.display = "none";
      var extra = document.getElementById("friend-glow-2");
      if (extra && extra.style.display !== "none") extra.style.display = "none";
      requestAnimationFrame(frame);
      return;
    }
    var anchors = name === "jon" ? Array.prototype.slice.call(link.querySelectorAll("a")) : [link];
    if (!anchors.length) anchors = [link];

    function paint(cv, el, rgb) {
      var r = el.getBoundingClientRect();
      cv.style.display = "block";
      cv.width = 220; cv.height = 80;
      cv.style.position = "fixed";
      cv.style.left = (r.left + r.width / 2 - 110) + "px";
      cv.style.top = (r.top + r.height / 2 - 40) + "px";
      cv.style.pointerEvents = "none";
      cv.style.zIndex = "4";
      var c = cv.getContext("2d");
      c.clearRect(0, 0, 220, 80);
      if (bits.length < 18) bits.push({x:110,y:40,vx:(Math.random()-.5)*.4,vy:(Math.random()-.5)*.3,a:Math.random()});
      bits.forEach(function (b) {
        b.x += b.vx; b.y += b.vy; b.a -= 0.004;
        if (b.a <= 0) { b.x = 110; b.y = 40; b.a = 1; }
        c.fillStyle = "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + (b.a * .45) + ")";
        c.fillRect(b.x, b.y, 1.5, 1.5);
      });
    }

    /* Character-mark particles stay per-figure (Telorin green, Silar red) — not the ambient blend. */
    if (name === "jon" && anchors.length > 1) {
      paint(canvas, anchors[0], tones.jon);
      var second = document.getElementById("friend-glow-2");
      if (!second) {
        second = document.createElement("canvas");
        second.id = "friend-glow-2";
        document.documentElement.appendChild(second);
      }
      paint(second, anchors[1], tones.jon2);
    } else {
      paint(canvas, anchors[0], toneOf(name));
      var second2 = document.getElementById("friend-glow-2");
      if (second2) second2.style.display = "none";
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
