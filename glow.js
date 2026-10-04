var canvas = document.getElementById("friend-glow");
if (canvas) {
  var ctx = canvas.getContext("2d");
  var tones = {jack:[230,190,80],julie:[255,210,220],sawyer:[230,120,40],jon:[80,180,90],devin:[190,190,190]};
  var bits = [];
  function who() {
    var c = document.body.className;
    var m = c.match(/seal-(jack|jon|julie|sawyer|devin)/);
    return m ? m[1] : "";
  }
  function frame() {
    var name = who();
    var link = name && (document.querySelector('.friend[data-owner="' + name + '"]') || document.getElementById("seal-name"));
    if (!name || !link || link.hidden || getComputedStyle(link).display === "none") {
      canvas.style.display = "none";
      requestAnimationFrame(frame);
      return;
    }
    canvas.style.display = "block";
    var r = link.getBoundingClientRect();
    canvas.width = 220; canvas.height = 80;
    canvas.style.position = "fixed";
    canvas.style.left = (r.left + r.width / 2 - 110) + "px";
    canvas.style.top = (r.top + r.height / 2 - 40) + "px";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "4";
    ctx.clearRect(0, 0, 220, 80);
    var tone = tones[name] || tones.devin;
    if (bits.length < 18) bits.push({x:110,y:40,vx:(Math.random()-.5)*.4,vy:(Math.random()-.5)*.3,a:Math.random()});
    bits.forEach(function (b) {
      b.x += b.vx; b.y += b.vy; b.a -= 0.004;
      if (b.a <= 0) { b.x = 110; b.y = 40; b.a = 1; }
      ctx.fillStyle = "rgba(" + tone[0] + "," + tone[1] + "," + tone[2] + "," + (b.a * .45) + ")";
      ctx.fillRect(b.x, b.y, 1.5, 1.5);
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
