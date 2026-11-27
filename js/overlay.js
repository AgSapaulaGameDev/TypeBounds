// HTML menu overlay: main menu, settings, pause and game over are drawn as crisp DOM (Pixelify Sans)
// on top of the canvas. The canvas still draws the world, the castle and the dim behind them.
// Layout is in play-area units (320 x 180) and the whole box is scaled to sit on the canvas play area.
// Keyboard stays with the game (game.sel / Enter); the mouse here sets game.sel and calls game.activate.
(function () {
  const TD = (window.TD = window.TD || {});
  const root = document.getElementById('ui');
  if (!root) return;

  // ---- tiny SVG icon set (16x16, currentColor) ----
  function gearPath() {
    let d = '';
    const n = 8, R = 7.6, r = 5.6;
    for (let i = 0; i < n * 4; i++) {
      const a = (i / (n * 4)) * Math.PI * 2 - Math.PI / 2;
      const rad = i % 4 < 2 ? R : r;
      d += (i ? 'L' : 'M') + (8 + Math.cos(a) * rad).toFixed(2) + ' ' + (8 + Math.sin(a) * rad).toFixed(2);
    }
    return d + 'Z M8 5.6 A2.4 2.4 0 1 0 8 10.4 A2.4 2.4 0 1 0 8 5.6Z';
  }
  function starPath(cx, cy, R, r) {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rad = i % 2 ? r : R;
      d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rad).toFixed(2) + ' ' + (cy + Math.sin(a) * rad).toFixed(2);
    }
    return d + 'Z';
  }
  const ICON = {
    gear: '<path fill-rule="evenodd" d="' + gearPath() + '"/>',
    pause: '<rect x="3.5" y="2.5" width="3.5" height="11" rx=".6"/><rect x="9" y="2.5" width="3.5" height="11" rx=".6"/>',
    play: '<path d="M4 2.2 L13.5 8 L4 13.8Z"/>',
    back: '<path d="M12 2.2 L2.5 8 L12 13.8Z"/>',
    restart: '<path d="M8 2.2a5.8 5.8 0 1 1-5.5 4h2.2A3.7 3.7 0 1 0 8 4.3V6.6L4.4 3.3 8 0Z"/>',
    home: '<path d="M8 1.6 L15 8 H12.8 V14.4 H9.6 V10.4 H6.4 V14.4 H3.2 V8 H1Z"/>',
    skull: '<path fill-rule="evenodd" d="M8 1.2C4.2 1.2 1.8 3.8 1.8 7.2c0 2 1 3.3 2.4 4.1V14h1.6v-1.4h1.4V14h1.6v-1.4h1.4V14h1.6v-2.7c1.4-.8 2.4-2.1 2.4-4.1 0-3.4-2.4-6-6.2-6ZM5.3 6.2a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 1 0 0-3.2Zm5.4 0a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 1 0 0-3.2ZM8 9.6l-1 1.6h2Z"/>',
    trophy: '<path d="M4 1.5h8v1.3h2.6v1.6c0 2-1.3 3.4-3.1 3.6-.6 1.2-1.6 2-2.7 2.2V12h2.4v2.5H4.8V12h2.4V10.2C6.1 10 5.1 9.2 4.5 8 2.7 7.8 1.4 6.4 1.4 4.4V2.8H4Zm-1.2 2.6v.4c0 1 .5 1.8 1.3 2.1-.1-.5-.1-1-.1-1.5v-1Zm10.4 0h-1.2v1c0 .5 0 1-.1 1.5.8-.3 1.3-1.1 1.3-2.1Z"/>',
    flag: '<path d="M3 1.2h1.6v13.6H3Z"/><path d="M5.2 2h8.6l-2.2 3.2 2.2 3.2H5.2Z"/>',
    coin: '<circle cx="8" cy="8" r="6.6"/><circle cx="8" cy="8" r="4.4" fill="rgba(0,0,0,.28)"/><rect x="7.1" y="5" width="1.8" height="6" fill="rgba(255,255,255,.55)"/>',
    target: '<path fill-rule="evenodd" d="M8 1.2a6.8 6.8 0 1 0 0 13.6A6.8 6.8 0 1 0 8 1.2Zm0 2.2a4.6 4.6 0 1 1 0 9.2 4.6 4.6 0 1 1 0-9.2Zm0 2.1a2.5 2.5 0 1 0 0 5 2.5 2.5 0 1 0 0-5Z"/>',
    star: '<path d="' + starPath(8, 8.5, 7.2, 3) + '"/>',
    music: '<path d="M6 2.4 14 1v9.6a2.2 2.2 0 1 1-1.6-2.1V4.2L7.6 5v7.2a2.2 2.2 0 1 1-1.6-2.1Z"/>',
    sfx: '<path d="M1.5 5.6h3L8.6 2v12L4.5 10.4h-3Z"/><path d="M10.4 5a3.6 3.6 0 0 1 0 6l-.9-1.2a2.1 2.1 0 0 0 0-3.6Zm1.8-2.4a6.6 6.6 0 0 1 0 10.8l-.9-1.2a5 5 0 0 0 0-8.4Z"/>',
    fs: '<path d="M1.5 1.5h5v2h-3v3h-2Zm8 0h5v5h-2v-3h-3Zm-8 8h2v3h3v2h-5Zm11 0h2v5h-5v-2h3Z"/>',
    aa: '<text x="8" y="12.6" text-anchor="middle" font-family="Pixelify Sans, monospace" font-weight="700" font-size="11">Aa</text>',
  };
  const icon = (n, cls) => '<svg class="ic ' + (cls || '') + '" viewBox="0 0 16 16" fill="currentColor">' + ICON[n] + '</svg>';

  // Crimson ribbon banner with folded tails, w x h in units
  function ribbon(w, h, text, left, right) {
    const t = Math.round(h * 0.55), tailY = h * 0.22, mh = h - 5; // main body height
    const svg =
      '<svg class="rib-bg" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' +
      // tails (behind), with a V notch
      '<path d="M0 ' + (tailY) + 'H' + t + 'V' + (h) + 'H0L' + (t * 0.45) + ' ' + ((tailY + h) / 2) + 'Z" fill="#5a1422" stroke="#c9893a" stroke-width=".8"/>' +
      '<path d="M' + w + ' ' + (tailY) + 'H' + (w - t) + 'V' + (h) + 'H' + w + 'L' + (w - t * 0.45) + ' ' + ((tailY + h) / 2) + 'Z" fill="#5a1422" stroke="#c9893a" stroke-width=".8"/>' +
      // fold shadows
      '<path d="M' + (t * 0.7) + ' ' + (mh) + 'L' + t + ' ' + h + 'V' + (mh) + 'Z" fill="#2e0910"/>' +
      '<path d="M' + (w - t * 0.7) + ' ' + (mh) + 'L' + (w - t) + ' ' + h + 'V' + (mh) + 'Z" fill="#2e0910"/>' +
      // body
      '<defs><linearGradient id="rg' + w + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c23a50"/><stop offset=".5" stop-color="#9c2b3f"/><stop offset="1" stop-color="#6a1b2b"/></linearGradient></defs>' +
      '<rect x="' + (t * 0.7) + '" y=".6" width="' + (w - t * 1.4) + '" height="' + (mh - 0.6) + '" fill="url(#rg' + w + ')" stroke="#e0a640" stroke-width="1.2"/>' +
      '<rect x="' + (t * 0.7 + 2) + '" y="2.4" width="' + (w - t * 1.4 - 4) + '" height="' + (mh - 4.4) + '" fill="none" stroke="#f0c46a" stroke-opacity=".45" stroke-width=".5"/>' +
      '</svg>';
    return svg + '<div class="rib-txt" style="height:' + mh + 'px">' + (left || '') + '<span>' + text + '</span>' + (right || '') + '</div>';
  }

  // hanging pennant: rod, crimson cloth with gold edge, crown, V notch
  const PENNANT =
    '<svg viewBox="0 0 21 65"><defs><linearGradient id="pg" x1="0" x2="1"><stop offset="0" stop-color="#7a1e30"/><stop offset=".5" stop-color="#a8304a"/><stop offset="1" stop-color="#6a1b2b"/></linearGradient></defs>' +
    '<path d="M1.5 0H19.5V64L10.5 55.5 1.5 64Z" fill="url(#pg)" stroke="#e0a640" stroke-width="1.2"/>' +
    '<path d="M4 0V58.5L10.5 52.6 17 58.5V0" fill="none" stroke="#f0c46a" stroke-opacity=".5" stroke-width=".6"/>' +
    '<path d="M5 40.5 6.2 33.5 8.4 37 10.5 31.8 12.6 37 14.8 33.5 16 40.5Z" fill="#ffcd4a" stroke="#7a4a10" stroke-width=".5"/>' +
    '<rect x="5" y="41.2" width="11" height="1.6" fill="#e09a1c"/>' +
    '<rect x="0" y="0" width="21" height="3" rx="1" fill="#e0a640" stroke="#7a4a10" stroke-width=".5"/></svg>';

  // ---- screens ----
  const btn = (id, cls, x, y, w, h, label, ic) =>
    '<div class="btn ' + cls + '" data-id="' + id + '" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px">' +
    '<div class="face"><span>' + (ic ? icon(ic) : '') + label + '</span></div></div>';
  const panel = (x, y, w, h) =>
    '<div class="panel" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px">' +
    '<i class="orn tl"></i><i class="orn tr"></i><i class="orn bl"></i><i class="orn br"></i></div>';

  const statRows = [
    ['score', 'trophy', 'SCORE'], ['wave', 'flag', 'WAVE'], ['words', 'aa', 'WORDS'],
    ['gold', 'coin', 'GOLD EARNED'], ['acc', 'target', 'ACCURACY'], ['best', 'star', 'BEST SCORE'],
  ];
  const STAT_Y = [49, 64, 78, 93, 108, 122];

  root.innerHTML =
    // MAIN MENU
    '<div class="scr" data-s="menu">' +
      '<div class="pennant" style="left:39px">' + PENNANT + '</div>' +
      '<div class="pennant" style="left:265px">' + PENNANT + '</div>' +
      '<div class="title">TYPEBOUNDS</div>' +
      '<div class="subtitle"><i></i>PROTECT THE TOWER<i></i></div>' +
      btn('play', 'gold big', 104, 101, 112, 20, 'PLAY') +
      btn('board', 'crimson', 104, 127, 112, 18, 'LEADERBOARD') +
      btn('settings', 'crimson', 104, 151, 112, 18, 'SETTINGS') +
      '<div class="chev l">&#9654;</div><div class="chev r">&#9664;</div>' +
    '</div>' +
    // SETTINGS
    '<div class="scr" data-s="settings">' +
      panel(58, 31, 206, 118) +
      '<div class="ribbon" style="left:96px;top:16px;width:129px;height:24px">' +
        ribbon(129, 24, 'SETTINGS', icon('gear', 'ri'), icon('gear', 'ri')) + '</div>' +
      ['music', 'sfx', 'fs'].map((id, i) => {
        const y = 60 + i * 24;
        const lab = id === 'music' ? 'MUSIC' : id === 'sfx' ? 'SFX' : 'FULLSCREEN';
        const ctl = id === 'fs'
          ? '<div class="tog on" data-v="1" style="left:178px;top:' + (y - 8.5) + 'px">ON</div>' +
            '<div class="tog off" data-v="0" style="left:216px;top:' + (y - 8.5) + 'px">OFF</div>'
          : '<div class="track" style="left:147px;top:' + (y - 3) + 'px"><b></b><i></i></div>';
        return '<div class="row" data-id="' + id + '" style="top:' + (y - 10) + 'px">' +
          '<div class="rowhit"></div>' +
          '<div class="ricon" style="left:68px">' + icon(id) + '</div>' +
          '<div class="rlab" style="left:96px">' + lab + '</div></div>' + ctl.replace(/class="(tog|track)/g, 'data-row="' + id + '" class="$1');
      }).join('') +
      btn('back', 'crimson', 118, 129, 86, 24, 'BACK', 'back') +
    '</div>' +
    // PAUSE
    '<div class="scr" data-s="paused">' +
      panel(89, 40, 145, 130) +
      '<div class="ribbon" style="left:103px;top:26px;width:116px;height:28px">' + ribbon(116, 28, 'PAUSED', icon('pause', 'ri')) + '</div>' +
      btn('resume', 'green', 115, 62, 95, 21, 'RESUME', 'play') +
      btn('restart', 'brown', 115, 88, 95, 21, 'RESTART', 'restart') +
      btn('settings', 'crimson', 115, 115, 95, 20, 'SETTINGS', 'gear') +
      btn('quit', 'crimson', 115, 142, 95, 19, 'MAIN MENU', 'home') +
    '</div>' +
    // GAME OVER
    '<div class="scr" data-s="over">' +
      panel(64, 27, 194, 110) +
      '<div class="ribbon" style="left:89px;top:10px;width:147px;height:25px">' +
        ribbon(147, 25, 'GAME OVER', icon('skull', 'ri'), icon('skull', 'ri')) + '</div>' +
      statRows.map(([k, ic, lab], i) =>
        '<div class="stat" style="top:' + (STAT_Y[i] - 6) + 'px">' + icon(ic, 'st-' + k) +
        '<span class="sl">' + lab + '</span><span class="sv" data-k="' + k + '">0</span></div>' +
        (i < statRows.length - 1 ? '<div class="sep" style="top:' + ((STAT_Y[i] + STAT_Y[i + 1]) / 2) + 'px"></div>' : '')).join('') +
      '<div class="rank"></div>' +
      btn('again', 'gold', 75, 149, 81, 21, 'PLAY AGAIN', 'restart') +
      btn('quit', 'crimson', 167, 149, 84, 21, 'MAIN MENU', 'home') +
    '</div>';

  const SCREEN_MENU = { menu: 'main', settings: 'settings', paused: 'pause', over: 'over' };
  const scr = {};
  root.querySelectorAll('.scr').forEach((el) => (scr[el.dataset.s] = el));
  const vals = {};
  root.querySelectorAll('.sv').forEach((el) => (vals[el.dataset.k] = el));
  const rankEl = root.querySelector('.rank');

  // index of an id in the game's current menu (so keyboard and mouse share game.sel)
  const indexOf = (g, id) => {
    const mn = SCREEN_MENU[g.state];
    return mn ? TD.menuButtons(mn).findIndex((b) => b.id === id) : -1;
  };
  function select(id) {
    const g = TD.game, i = indexOf(g, id);
    if (i >= 0 && i !== g.sel) { g.sel = i; TD.Audio.hover(); }
  }

  // ---- mouse ----
  root.addEventListener('pointerover', (ev) => {
    const el = ev.target.closest('[data-id],[data-row]');
    if (el) select(el.dataset.id || el.dataset.row);
  });
  root.addEventListener('pointerdown', (ev) => {
    const g = TD.game;
    TD.Audio.unlock();
    const b = ev.target.closest('.btn');
    if (b) { ev.preventDefault(); select(b.dataset.id); g.activate(b.dataset.id); return; }
    const tog = ev.target.closest('.tog');
    if (tog) { select('fs'); g.setFullscreen(tog.dataset.v === '1'); return; } // inside the gesture
    const tr = ev.target.closest('.track');
    if (tr) { select(tr.dataset.row); dragTrack(tr, ev); return; }
    const row = ev.target.closest('.row');
    if (row) select(row.dataset.id);
  });
  function dragTrack(tr, ev) {
    const id = tr.dataset.row;
    const set = (e) => {
      const r = tr.getBoundingClientRect();
      const lv = Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * TD.Audio.MAX_LEVEL);
      const cur = id === 'music' ? TD.Audio.musicLevel : TD.Audio.sfxLevel;
      if (lv === cur) return;
      if (id === 'music') TD.Audio.setMusicLevel(lv); else TD.Audio.setSfxLevel(lv);
      TD.Audio.hover();
    };
    set(ev);
    const move = (e) => set(e);
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // ---- per-frame sync ----
  let lastState = null, lastBox = '';
  const setText = (el, t) => { t = String(t); if (el.textContent !== t) el.textContent = t; };
  TD.Overlay = {
    sync(g) {
      // place the 320x180 box over the canvas play area
      const c = document.getElementById('game'), r = c.getBoundingClientRect(), v = TD.view;
      const u = r.width / v.VW;
      const box = (r.left + v.OX * u).toFixed(2) + ',' + r.top.toFixed(2) + ',' + u.toFixed(4);
      if (box !== lastBox) {
        lastBox = box;
        root.style.transform = 'translate(' + (r.left + v.OX * u) + 'px,' + r.top + 'px) scale(' + u + ')';
      }

      const s = scr[g.state] ? g.state : null;
      if (s !== lastState) {
        for (const k in scr) scr[k].classList.toggle('on', k === s);
        lastState = s;
      }
      if (!s) return;
      const el = scr[s];
      const list = TD.menuButtons(SCREEN_MENU[s]);
      const selId = list[g.sel] && list[g.sel].id;
      el.querySelectorAll('[data-id]').forEach((b) => b.classList.toggle('sel', b.dataset.id === selId));

      if (s === 'menu') {
        // the chevrons follow the selected button
        const b = el.querySelector('.btn.sel');
        el.querySelectorAll('.chev').forEach((ch) => {
          ch.style.display = b ? '' : 'none';
          if (b) ch.style.top = (parseFloat(b.style.top) + parseFloat(b.style.height) / 2) + 'px';
        });
      } else if (s === 'settings') {
        const A = TD.Audio, M = A.MAX_LEVEL;
        el.querySelectorAll('.track').forEach((tr) => {
          const lv = tr.dataset.row === 'music' ? A.musicLevel : A.sfxLevel, pct = (lv / M) * 100 + '%';
          tr.children[0].style.width = pct; tr.children[1].style.left = pct;
        });
        const fsOn = !!document.fullscreenElement, canFs = !!document.documentElement.requestFullscreen;
        el.querySelectorAll('.tog').forEach((t) => t.classList.toggle('act', (t.dataset.v === '1') === fsOn));
        el.querySelectorAll('[data-row="fs"],.row[data-id="fs"]').forEach((t) => (t.style.display = canFs ? '' : 'none'));
      } else if (s === 'over') {
        const acc = g.correct + g.typos ? Math.round((g.correct / (g.correct + g.typos)) * 100) : 0;
        setText(vals.score, g.score); setText(vals.wave, g.waves.wave); setText(vals.words, g.kills);
        setText(vals.gold, g.goldEarned); setText(vals.acc, acc + '%'); setText(vals.best, g.best);
        const LB = TD.Leaderboard;
        setText(rankEl, g.lastRank === null ? 'SAVING SCORE...'
          : !g.lastRank ? (g.debugRun ? 'DEBUG RUN - NOT POSTED' : 'NOT IN THE TOP 10 THIS TIME')
          : LB.improved ? 'RANK #' + g.lastRank + ' ON THE LEADERBOARD' + (g.newBest ? ' - NEW BEST!' : '')
          : 'YOUR BEST ' + LB.bestScore + ' STAYS AT RANK #' + g.lastRank);
        rankEl.classList.toggle('good', !!g.lastRank);
        el.classList.toggle('ready', g.time - g.overAt > 0.8);
      }
    },
  };
})();
