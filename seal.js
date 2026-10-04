var PHRASE = {light:'jack',arcana:'jon',succor:'julie',vigor:'sawyer',fatalis:'devin'};
document.getElementById('seal').addEventListener('submit', function (e) {
  e.preventDefault();
  var key = (new FormData(e.target).get('phrase')||'').trim().toLowerCase();
  var who = PHRASE[key];
  var msg = document.getElementById('seal-msg');
  if (!who) { msg.textContent = 'Try again.'; return; }
  try { localStorage.setItem('elorae-seal', who); } catch (err) {}
  msg.textContent = 'You may now view your private material.';
});
