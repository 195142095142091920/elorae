var canvas = document.getElementById("friend-glow");
if (canvas) {
  var ctx = canvas.getContext("2d");
  /* Login / success tones: Jack yellow-gold, Julie pink, Sawyer red-orange,
     Jon green↔red alternate, Devin white. */
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
  function toneOf(name, t) {
    if (name !== "jon") return tones[name] || tones.devin;
    /* Jon: alternate green (Telorin) and red (Silar) every ~1.6s. */
    return (Math.floor(t / 1600) % 2 === 0) ? tones.jon : tones.jon2;
  }
  function frame(now) {
    var name = who();
    var link = name && (name === "devin"
      ? (document.getElementById("seal-name") || document.getElementById("seal-logout"))
      : (document.querySelector('.friend[data-owner="' + name + '"]') || document.getElementById("seal-name")));
    if (!name || !link || link.hidden || getComputedStyle(link).display === "none") {
      canvas.style.display = "none";
      var extra = document.getElementById("friend-glow-2");
      if (extra) extra.style.display = "none";
      requestAnimationFrame(frame);
      return;
    }
    var tone = toneOf(name, now || 0);
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

    paint(canvas, anchors[0], name === "jon" ? tones.jon : tone);
    var second = document.getElementById("friend-glow-2");
    if (anchors.length > 1) {
      if (!second) {
        second = document.createElement("canvas");
        second.id = "friend-glow-2";
        document.documentElement.appendChild(second);
      }
      paint(second, anchors[1], tones.jon2);
    } else if (second) {
      second.style.display = "none";
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
