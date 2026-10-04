document.addEventListener('click', function (e) {
  var life = e.target.closest('.life-toggle');
  if (!life) return;
  var sheet = document.getElementById('life');
  if (!sheet) return;
  var open = sheet.classList.toggle('open');
  life.textContent = open ? '- Lore' : '+ Lore';
});
