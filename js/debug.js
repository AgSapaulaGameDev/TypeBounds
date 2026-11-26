// TEMPORARY test panel: jump straight to any wave. Only shows when the URL has ?debug
// (e.g. index.html?debug). Runs started from here never post to the leaderboard.
(function () {
  if (!/[?&]debug\b/.test(location.search)) return;
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99;font:12px monospace;background:#1a1c2c;' +
    'color:#f4f4f4;border:1px solid #ffcd75;padding:4px 6px;display:flex;gap:4px;align-items:center';
  box.innerHTML = 'DEBUG wave <input type="number" min="1" value="10" style="width:44px">' +
    '<button>GO</button><button>+500 GOLD</button>';
  document.body.appendChild(box);
  const [input, go, gold] = box.querySelectorAll('input, button');
  // keep typing in the box from reaching the game
  input.addEventListener('keydown', (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') go.click(); });

  go.onclick = () => {
    const g = TD.game, n = Math.max(1, parseInt(input.value, 10) || 1);
    if (!g.playerName) g.playerName = 'DEBUG';
    g.reset();
    g.debugRun = true;
    g.startWave(n);
    go.blur();
  };
  gold.onclick = () => { const g = TD.game; if (g.state === 'play') g.addGold(500); gold.blur(); };
})();
