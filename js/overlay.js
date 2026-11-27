// HTML menu overlay: main menu, settings, pause and game over sit on top of the canvas.
// Art (buttons, panels, ribbons, pennants, icons, sliders) is real pixel art: small canvases drawn at
// 1 pixel per play unit and scaled up with no smoothing. Text is the Pixelify Sans web font.
// Layout is in play units (320 x 180); the #ui box is scaled onto the canvas play area.
// Keyboard stays with the game (game.sel / Enter); the mouse sets game.sel and calls game.activate.
(function () {
  const TD = (window.TD = window.TD || {});
  const root = document.getElementById('ui');
  if (!root) return;

  // ---- DOM + pixel helpers ----
  function el(tag, cls, parent, css) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (css) Object.assign(e.style, css);
    if (parent) parent.appendChild(e);
    return e;
  }
  const at = (x, y, w, h) => ({ left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
  function art(w, h, parent, cls) {
    const c = el('canvas', 'art ' + (cls || ''), parent, { width: w + 'px', height: h + 'px' });
    c.width = w; c.height = h;
    return c;
  }
  const R = (x, c, X, Y, W, H) => { x.fillStyle = c; x.fillRect(X, Y, W, H); };
  // rectangle with stair-stepped corners (r pixels)
  function step(x, c, X, Y, W, H, r) {
    x.fillStyle = c;
    for (let i = 0; i < r; i++) {
      const cut = r - i;
      x.fillRect(X + cut, Y + i, W - cut * 2, 1);
      x.fillRect(X + cut, Y + H - 1 - i, W - cut * 2, 1);
    }
    x.fillRect(X, Y + r, W, H - r * 2);
  }
  // fill a shape by how deep each pixel sits inside it (0 = edge): outlines and borders for free
  function shape(x, w, h, inside, colorAt, maxK) {
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      if (!inside(px, py)) continue;
      let n = 0;
      for (let k = 1; k <= (maxK || 3); k++) {
        let ok = true;
        for (let dy = -k; dy <= k && ok; dy++) for (let dx = -k; dx <= k; dx++) if (!inside(px + dx, py + dy)) { ok = false; break; }
        if (!ok) break;
        n = k;
      }
      R(x, colorAt(n, px, py), px, py, 1, 1);
    }
  }

  // ---- sprites: '#' = main colour, '+' = shade, '*' = highlight; auto dark outline ----
  const SPR = {
    speaker: ['...#...#..', '..##.#..#.', '####..#.#.', '####..#.#.', '..##.#..#.', '...#...#..'],
    monitor: ['##########', '#********#', '#*++++++*#', '#*++++++*#', '##########', '....##....', '..######..'],
    gear: ['....#....', '.#.###.#.', '..#####..', '.##...##.', '###...###', '.##...##.', '..#####..', '.#.###.#.', '....#....'],
    pause: ['##.##', '##.##', '##.##', '##.##', '##.##', '##.##', '##.##'],
    play: ['#....', '##...', '###..', '####.', '#####', '####.', '###..', '##...', '#....'],
    back: ['....#', '...##', '..###', '.####', '#####', '.####', '..###', '...##', '....#'],
    restart: ['..####.#', '.#....##', '#....###', '#.......', '#.......', '#......#', '.#....#.', '..####..'],
    home: ['....#....', '...###...', '..#####..', '.#######.', '#########', '.##...##.', '.##...##.', '.##...##.'],
    skull: ['..####..', '.######.', '########', '#..##..#', '#..##..#', '###..###', '.######.', '.#.##.#.'],
    trophy: ['#.#####.#', '#.#####.#', '.#######.', '..#####..', '...###...', '....#....', '...###...', '..#####..'],
    flag: ['##......', '######..', '#######.', '######..', '##......', '#.......', '#.......', '#.......', '#.......'],
    coin: ['..####..', '.##++##.', '##+**+##', '##+*#+##', '##+*#+##', '##+##+##', '.##++##.', '..####..'],
    target: (() => { // dartboard: orange / red rings with a dart stuck in the middle
      const rows = [];
      for (let y = 0; y < 10; y++) {
        let r = '';
        for (let x = 0; x < 11; x++) {
          const d = Math.hypot(x - 4, y - 5);
          r += d < 1.5 ? '+' : d < 2.6 ? '#' : d < 3.6 ? '+' : d < 4.7 ? '#' : '.';
        }
        rows.push(r.split(''));
      }
      for (let i = 1; i <= 4; i++) rows[5 - i][4 + i] = 'd'; // shaft
      rows[0][9] = '*'; rows[0][10] = '*'; rows[1][10] = '*'; // fletching
      rows[5][4] = 'd'; // tip
      return rows.map((r) => r.join(''));
    })(),
    star: ['....#....', '...###...', '...###...', '#########', '.#######.', '..#####..', '..##.##..', '.##...##.', '##.....##'],
    aa: ['.##......', '#..#.###.', '#..#....#', '####.####', '#..#.#..#', '#..#..###'],
    crown: ['#...#...#', '##.###.##', '#########', '#*#*#*#*#', '#########'],
    heart: ['.##.##.', '#*#####', '#*#####', '#######', '.#####.', '..###..', '...#...'],
    swords: ['*.......*', '.*.....*.', '..*...*..', '...*.*...', '....*....', '...#.#...', '..#...#..', '+#.....#+', '+.......+'],
    dropper: ['.....##', '....###', '...###.', '..#*#..', '.#*#...', '#*#....', '#......'],
    chev: ['##....', '###...', '.###..', '..###.', '...###', '..###.', '.###..', '###...', '##....'],
  };
  const flipX = (rows) => rows.map((r) => r.split('').reverse().join(''));
  SPR.chevL = SPR.chev; SPR.chevR = flipX(SPR.chev);
  // draw a sprite into its own canvas: { main, shade, hi, ol } colours, ol = outline (or null)
  function sprite(name, pal, parent, cls, scale) {
    const rows = SPR[name], o = pal.ol ? 1 : 0;
    const w = rows[0].length + o * 2, h = rows.length + o * 2;
    const c = art(w, h, parent, 'ic ' + (cls || '')), x = c.getContext('2d');
    if (scale) Object.assign(c.style, { width: w * scale + 'px', height: h * scale + 'px' });
    const filled = (px, py) => py >= 0 && py < rows.length && px >= 0 && px < rows[0].length && rows[py][px] !== '.';
    if (o) for (let py = -1; py <= rows.length; py++) for (let px = -1; px <= rows[0].length; px++) {
      if (filled(px, py)) continue;
      if (filled(px - 1, py) || filled(px + 1, py) || filled(px, py - 1) || filled(px, py + 1)) R(x, pal.ol, px + o, py + o, 1, 1);
    }
    rows.forEach((r, py) => r.split('').forEach((ch, px) => {
      if (ch === '.') return;
      R(x, ch === '+' ? pal.shade || pal.main : ch === '*' ? pal.hi || pal.main : ch === 'd' ? pal.d || pal.main : pal.main, px + o, py + o, 1, 1);
    }));
    return c;
  }
  const GOLD_IC = { main: '#ffcd4a', shade: '#d98a1c', hi: '#fff3b0', ol: '#2a1404' };

  // ---- button themes ----
  const THEME = {
    gold:    { o: '#2a1404', b: '#a8640c', hi: '#fff3a0', f: ['#ffe066', '#fbcd3a', '#eaa82a'], sh: '#b8700f', rv: '#c98a1c', tx: '#3a1e06', ts: 'rgba(255,243,176,.7)', ic: { main: '#4a2a08' } },
    crimson: { o: '#1e0a06', b: '#e0a640', hi: '#c4495c', f: ['#a93248', '#8e2639', '#721c2e'], sh: '#4e1220', rv: '#ffd36a', tx: '#fbe9d0', ts: '#2a0a10', ic: { main: '#fbe9d0', ol: '#2a0a10' } },
    green:   { o: '#0e2210', b: '#e0a640', hi: '#8fe486', f: ['#62c75c', '#45a842', '#348a34'], sh: '#1f5e22', rv: '#ffd36a', tx: '#fbfff0', ts: '#174a1e', ic: { main: '#fbfff0', ol: '#174a1e' } },
    brown:   { o: '#1a0e04', b: '#e0a640', hi: '#a88040', f: ['#8e6428', '#7a5420', '#5e3e16'], sh: '#3e2808', rv: '#ffd36a', tx: '#ffe9b0', ts: '#2a1a06', ic: { main: '#ffe9b0', ol: '#2a1a06' } },
    navy:    { o: '#0a0a10', b: '#4a4658', hi: '#46434f', f: ['#34323e', '#2b2933', '#232129'], sh: '#18161d', rv: '#4a4658', tx: '#d8d2e4', ts: '#000', ic: { main: '#d8d2e4' } },
  };
  function drawButton(c, t, sel) { // sel: bright outline (main menu uses chevrons instead)
    const x = c.getContext('2d'), w = c.width, h = c.height;
    x.clearRect(0, 0, w, h);
    step(x, 'rgba(0,0,0,.55)', 0, 1, w, h - 1, 2); // drop shadow
    step(x, sel ? '#fff1b0' : t.o, 0, 0, w, h - 1, 2); // outline (bright when selected)
    step(x, t.b, 1, 1, w - 2, h - 3, 1); // border
    const ix = 2, iy = 2, iw = w - 4, ih = h - 5;
    step(x, t.f[1], ix, iy, iw, ih, 1);
    const band = Math.max(2, Math.round(ih * 0.3));
    R(x, t.f[0], ix + 1, iy + 1, iw - 2, band);
    R(x, t.f[2], ix + 1, iy + ih - 1 - band, iw - 2, band);
    R(x, t.hi, ix + 1, iy, iw - 2, 1); // top highlight
    R(x, t.sh, ix + 1, iy + ih - 1, iw - 2, 1); // bottom shade
    for (const [px, py] of [[ix + 1, iy + 1], [ix + iw - 2, iy + 1], [ix + 1, iy + ih - 2], [ix + iw - 2, iy + ih - 2]]) R(x, t.rv, px, py, 1, 1); // rivets
  }

  // ---- panel, ribbon, pennant ----
  // pause / leaderboard frame: gold border with chunky stair-notched corners and an inner echo step
  function drawNotchPanel(c, dark) { // dark: charcoal fill (game over) instead of maroon
    const x = c.getContext('2d'), w = c.width - 1, h = c.height - 2; // room for the drop shadow
    const corner = (px, py) => [Math.min(px, w - 1 - px), Math.min(py, h - 1 - py)];
    const inside = (px, py) => {
      if (px < 0 || py < 0 || px >= w || py >= h) return false;
      const [dx, dy] = corner(px, py);
      return !(dx < 9 && dy < 9 && Math.floor(dx / 3) + Math.floor(dy / 3) < 2);
    };
    shape(x, w + 1, h + 2, (px, py) => inside(px - 1, py - 2), () => 'rgba(0,0,0,.5)', 0);
    shape(x, w, h, inside, (n, px, py) => {
      const [dx, dy] = corner(px, py);
      if (n >= 3 && dx < 13 && dy < 13 && Math.floor(dx / 3) + Math.floor(dy / 3) === 3) return '#e0a640'; // echo step
      if (n === 0) return '#140a04';
      if (n === 1) return (px < w / 2 && dx === 1) || (py < h / 2 && dy === 1) ? '#ffe27a' : '#c98a2a';
      if (n === 2) return '#e0a640';
      if (n === 3) return dark ? '#3a2410' : '#3a1408';
      if (dark) return py < 6 ? '#26232c' : '#1c1a22';
      return py < 6 ? '#36141e' : '#2a0f16';
    }, 4);
  }
  function drawPanel(c, maroon) { // maroon: notched dark red frame (pause, leaderboard)
    if (maroon) return drawNotchPanel(c, maroon === 'dark');
    const x = c.getContext('2d'), w = c.width, h = c.height;
    step(x, 'rgba(0,0,0,.5)', 1, 2, w - 1, h - 2, 3);
    step(x, '#140a04', 0, 0, w - 1, h - 1, 3);
    step(x, '#e0a640', 1, 1, w - 3, h - 3, 2);
    R(x, '#ffe27a', 3, 1, w - 7, 1); R(x, '#ffe27a', 1, 3, 1, h - 7);
    R(x, '#a86a14', 3, h - 3, w - 7, 1); R(x, '#a86a14', w - 3, 3, 1, h - 7);
    step(x, '#3a2410', 3, 3, w - 7, h - 7, 1);
    step(x, maroon ? '#2a0f16' : '#1c1a22', 4, 4, w - 9, h - 9, 1);
    R(x, maroon ? '#36141e' : '#24212b', 5, 4, w - 11, 2);
    // gold corner pieces
    const corner = (cx, cy, sx, sy) => {
      const p = (dx, dy, col) => R(x, col, cx + sx * dx, cy + sy * dy, 1, 1);
      for (let i = 0; i < 9; i++) { p(i, 0, '#140a04'); p(0, i, '#140a04'); }
      for (let i = 0; i < 8; i++) { p(i + 1, 1, '#ffd36a'); p(1, i + 1, '#ffd36a'); p(i + 1, 2, '#c98a2a'); p(2, i + 1, '#c98a2a'); }
      p(1, 1, '#fff3b0');
      // little diamond stud
      p(5, 5, '#fff3b0'); p(4, 5, '#e0a640'); p(6, 5, '#e0a640'); p(5, 4, '#e0a640'); p(5, 6, '#e0a640');
      p(3, 5, '#140a04'); p(7, 5, '#140a04'); p(5, 3, '#140a04'); p(5, 7, '#140a04');
      p(4, 4, '#140a04'); p(6, 4, '#140a04'); p(4, 6, '#140a04'); p(6, 6, '#140a04');
    };
    corner(0, 0, 1, 1); corner(w - 2, 0, -1, 1); corner(0, h - 2, 1, -1); corner(w - 2, h - 2, -1, -1);
  }
  function drawRibbon(c) {
    const x = c.getContext('2d'), w = c.width, h = c.height, bh = h - 5, m = (4 + h - 1) / 2;
    const cut = (py) => Math.max(0, Math.round(5 - Math.abs(py - m)));
    shape(x, w, h, (px, py) => py >= 4 && py < h && px >= 0 && px < w && ((px < 15 && px >= cut(py)) || (px >= w - 15 && px < w - cut(py))),
      (n) => (n === 0 ? '#1e0a06' : n === 1 ? '#c98a2a' : '#6a1b2b'));
    R(x, '#2a0810', 9, bh, 6, 3); R(x, '#2a0810', w - 15, bh, 6, 3); // folds
    step(x, '#1e0a06', 9, 0, w - 18, bh, 1);
    R(x, '#e0a640', 10, 1, w - 20, bh - 2);
    R(x, '#ffe27a', 10, 1, w - 20, 1);
    R(x, '#9c2b3f', 11, 2, w - 22, bh - 4);
    R(x, '#b8394c', 11, 2, w - 22, 2);
    R(x, '#7a2032', 11, bh - 4, w - 22, 2);
    R(x, '#c98a2a', 11, bh - 2, w - 22, 1);
  }
  function drawPennant(c) {
    const x = c.getContext('2d'), w = c.width, h = c.height;
    shape(x, w, h, (px, py) => px >= 2 && px < w - 2 && py >= 2 && py < h && !(py >= h - 12 && Math.abs(px - (w - 1) / 2) < (py - (h - 12)) * 0.9),
      (n, px) => (n === 0 ? '#1e0a06' : n === 1 ? '#e0a640' : n === 2 ? '#5e1624'
        : px < 8 ? '#7a1f30' : px > w - 9 ? '#651a2a' : px === 9 ? '#b8394c' : '#9c2b3f'));
    step(x, '#1e0a06', 0, 0, w, 5, 1);
    R(x, '#e0a640', 1, 1, w - 2, 3); R(x, '#ffe27a', 1, 1, w - 2, 1); R(x, '#a86a14', 1, 3, w - 2, 1);
  }

  // ---- screens ----
  const screens = {}, buttons = [];
  const scr = (name) => { const e = (screens[name] = el('div', 'scr', root)); e.dataset.s = name; return e; };
  // leftIc: icon palette -> big icon pinned to the left edge, label centred (pause style)
  function button(s, id, theme, X, Y, W, H, label, ic, size, leftIc) {
    const wrap = el('div', 'btn', s, at(X, Y, W, H));
    wrap.dataset.id = id;
    const cv = art(W, H, wrap);
    const t = THEME[theme];
    const lab = el('span', 'lbl', wrap, { fontSize: (size || 9) + 'px', color: t.tx, textShadow: '0 1px 0 ' + t.ts });
    if (ic && leftIc) {
      const c = sprite(ic, leftIc, wrap, 'lic', 1.25);
      Object.assign(c.style, { position: 'absolute', left: '11px', top: (H - 1 - parseFloat(c.style.height)) / 2 + 'px' });
      lab.style.paddingLeft = '12px'; // centre the label in the space right of the icon
    } else if (ic) sprite(ic, t.ic, lab, '', H >= 22 ? 1.25 : 1);
    lab.appendChild(document.createTextNode(label));
    const b = { wrap, cv, theme, sel: null, id };
    buttons.push(b);
    return b;
  }
  function panel(s, X, Y, W, H, maroon) { const c = art(W, H, s, 'pnl'); Object.assign(c.style, at(X, Y, W, H)); drawPanel(c, maroon); }
  function ribbon(s, X, Y, W, H, text, icL, icR, size) {
    const r = el('div', 'ribbon', s, at(X, Y, W, H));
    drawRibbon(art(W, H, r));
    const t = el('div', 'rib-txt', r, { height: (H - 5) + 'px', fontSize: (size || 11) + 'px' });
    if (icL) sprite(icL, GOLD_IC, t, '', 1.5);
    el('span', '', t).textContent = text;
    if (icR) sprite(icR, GOLD_IC, t, '', 1.5);
  }

  // MAIN MENU
  {
    const s = scr('menu');
    for (const px of [14, 280]) drawPennant(art(26, 66, el('div', 'pennant', s, at(px, 0, 26, 66))));
    s.querySelectorAll('.pennant').forEach((p) => { const c = sprite('crown', { main: '#ffcd4a', shade: '#d98a1c', hi: '#fff3b0', ol: '#1e0a06' }, p); Object.assign(c.style, { position: 'absolute', left: '7px', top: '38px' }); });
    el('div', 'title', s).textContent = 'TYPEBOUNDS';
    const sub = el('div', 'subtitle', s);
    el('i', '', sub); el('span', '', sub).textContent = 'PROTECT THE TOWER'; el('i', '', sub);
    button(s, 'play', 'gold', 95, 99, 131, 23, 'PLAY', null, 12.5);
    button(s, 'board', 'crimson', 95, 126, 131, 20, 'LEADERBOARD', null, 10);
    button(s, 'settings', 'crimson', 95, 150, 131, 20, 'SETTINGS', null, 10);
    for (const side of ['L', 'R']) {
      const ch = el('div', 'chev', s); ch.dataset.side = side;
      sprite('chev' + side, { main: '#ffcd4a', shade: '#d98a1c', ol: '#2a1404' }, ch);
    }
  }

  // SETTINGS
  const rows = {};
  {
    const s = scr('settings');
    panel(s, 39, 28, 245, 98);
    ribbon(s, 82, 11, 159, 28, 'SETTINGS', 'gear', 'gear', 13);
    ['music', 'sfx', 'fs'].forEach((id, i) => {
      const Y = 49 + i * 24;
      const row = el('div', 'row', s, at(52, Y, 219, 21));
      row.dataset.id = id;
      const cv = art(219, 21, row);
      const ib = el('div', 'ibox', row, at(4, 2, 25, 17));
      sprite(id === 'fs' ? 'monitor' : 'speaker', GOLD_IC, ib, '', 1.5);
      el('div', 'rlab', row, { left: '33px' }).textContent = id === 'music' ? 'MUSIC' : id === 'sfx' ? 'SFX' : 'FULLSCREEN';
      rows[id] = { row, cv, sel: null };
      if (id === 'fs') {
        for (const [v, X, W, lab] of [['1', 183, 42, 'ON'], ['0', 226, 43, 'OFF']]) {
          const t = el('div', 'tog', s, at(X, Y + 2, W, 18));
          t.dataset.v = v; t.dataset.row = 'fs';
          const c = art(W, 18, t);
          el('span', 'lbl', t, { fontSize: '8.5px' }).textContent = lab;
          rows['tog' + v] = { t, c, act: null };
        }
      } else {
        const tr = el('div', 'track', s, at(146, Y + 6, 123, 9));
        tr.dataset.row = id;
        rows[id].track = art(123, 9, tr);
        rows[id].lv = null;
      }
    });
    button(s, 'back', 'crimson', 111, 129, 102, 25, 'BACK', 'back', 12);
  }
  function drawRow(c, sel) {
    const x = c.getContext('2d'), w = c.width, h = c.height;
    x.clearRect(0, 0, w, h);
    step(x, sel ? '#e0a640' : '#2e2a36', 0, 0, w, h, 2);
    step(x, sel ? '#2a2430' : '#1a1720', 1, 1, w - 2, h - 2, 1);
    step(x, '#2e2a36', 4, 2, 25, 17, 1);
    step(x, '#121017', 5, 3, 23, 15, 1);
  }
  function drawTrack(c, lv, max) {
    const x = c.getContext('2d'), w = c.width;
    x.clearRect(0, 0, w, 9);
    step(x, '#0c0a10', 0, 2, w, 5, 1);
    R(x, '#2b2733', 1, 3, w - 2, 3);
    R(x, '#3a3542', 1, 5, w - 2, 1);
    const k = 3 + Math.round((lv / max) * (w - 7)); // knob centre
    R(x, '#f6c12f', 1, 3, k - 1, 3); R(x, '#ffe27a', 1, 3, k - 1, 1); R(x, '#c98a1c', 1, 5, k - 1, 1);
    step(x, '#2a1404', k - 3, 0, 7, 9, 1);
    R(x, '#f0dfbc', k - 2, 1, 5, 7); R(x, '#fffaf0', k - 2, 1, 5, 2); R(x, '#c8ac7a', k - 2, 6, 5, 1);
  }

  // PAUSE: maroon panel, big gold icons on the left of each button
  {
    const s = scr('paused');
    panel(s, 77, 27, 170, 135, true); // sits ~10 units higher than centre so it doesn't look low
    ribbon(s, 102, 13, 120, 28, 'PAUSED', 'pause', null, 13);
    const PLAY_IC = { main: '#ffb02e', shade: '#d9801a', ol: '#2a1404' };
    button(s, 'resume', 'green', 107, 51, 111, 22, 'RESUME', 'play', 10, PLAY_IC);
    button(s, 'restart', 'brown', 107, 78, 111, 22, 'RESTART', 'restart', 10, GOLD_IC);
    button(s, 'settings', 'crimson', 107, 105, 111, 22, 'SETTINGS', 'gear', 10, GOLD_IC);
    button(s, 'quit', 'crimson', 107, 132, 111, 22, 'MAIN MENU', 'home', 10, GOLD_IC);
  }

  // NAME ENTRY ("WHO IS DEFENDING?"): typing stays with the game; START / BACK buttons for the mouse
  const nameUI = {};
  {
    const s = scr('name');
    panel(s, 60, 46, 200, 96, true);
    ribbon(s, 68, 31, 184, 27, 'WHO IS DEFENDING?', null, null, 11);
    el('div', 'nm-label', s).textContent = 'ENTER YOUR NAME';
    const box = el('div', 'nm-box', s, at(78, 73, 164, 23));
    const c = art(164, 23, box), x = c.getContext('2d');
    step(x, '#140a04', 0, 0, 164, 23, 2);
    step(x, '#e0a640', 1, 1, 162, 21, 1);
    R(x, '#ffe27a', 2, 1, 160, 1);
    step(x, '#120408', 2, 2, 160, 19, 1);
    R(x, '#1e0a12', 3, 2, 158, 2);
    nameUI.text = el('div', 'nm-text', box);
    nameUI.count = el('div', 'nm-count', s);
    nameUI.err = el('div', 'nm-err', s);
    nameUI.err.textContent = 'TYPE A NAME FIRST';
    for (const [id, theme, X, label, ic] of [['namego', 'gold', 84, 'START', 'play'], ['nameback', 'crimson', 164, 'BACK', 'back']]) {
      const b = button(s, id, theme, X, 112, 72, 20, label, ic, 9);
      buttons.pop(); // not a game menu: drawn once here
      drawButton(b.cv, THEME[theme], false);
      b.wrap.classList.add('xbtn');
    }
  }
  function syncName(g) {
    const n = g.playerName || '', cur = n.length < 10 && Math.floor(g.time * 3) % 2 === 0 ? '_' : ' ';
    setText(nameUI.text, n + cur);
    setText(nameUI.count, n.length + '/10');
    nameUI.err.style.visibility = g.nameErrT > 0 ? 'visible' : 'hidden';
  }

  // TIP CARDS (before a wave with new enemies): built per wave by syncTips
  const tips = { scr: scr('tips'), wave: null };
  const TIP_COL = { '#94b0c2': '#cdbca6', '#f4f4f4': '#fff4dc', '#ffcd75': '#ffcd4a', '#e83b3b': '#ff5a4a' };
  function buildTips(g) {
    const s = tips.scr, tip = TD.Tips[g.waves.wave];
    s.textContent = '';
    if (!tip) return;
    const X = 46, W = 228;
    const card = el('div', 'tipcard', s, { left: X + 'px', width: W + 'px' });
    const pc = art(W, 10, card, 'pnl');
    const body = el('div', 'tip-body', card);
    for (const en of tip.enemies) {
      const blk = el('div', 'tblk', body);
      const box = el('div', 'tspr', blk);
      const f = en.sprite();
      const sc = f.w * 2 <= 30 && f.h * 2 <= 30 ? 2 : Math.min(1, 30 / f.w, 30 / f.h); // fit the 32px box
      const c = art(f.w, f.h, box, 'ic');
      Object.assign(c.style, { width: f.w * sc + 'px', height: f.h * sc + 'px' });
      c.getContext('2d').drawImage(f.r, 0, 0);
      const txt = el('div', 'ttxt', blk);
      const nm = el('div', 'tname', txt);
      if (en.dropper) sprite('dropper', GOLD_IC, nm);
      el('span', '', nm).textContent = en.name;
      if (en.tag) el('span', 'ttag', nm).textContent = en.tag;
      for (const ln of en.lines) {
        const row = el('div', 'tline', txt);
        for (const [t, col] of typeof ln === 'string' ? [[ln, '#94b0c2']] : ln) el('span', '', row, { color: TIP_COL[col] || col }).textContent = t;
      }
    }
    if (tip.foot) el('div', 'tfoot', body).textContent = tip.foot;
    el('div', 'tgo-space', body);
    const h = Math.ceil(body.offsetHeight);
    pc.height = h; pc.style.height = h + 'px';
    drawPanel(pc, true);
    const top = Math.max(14, Math.round((180 - h) / 2) + 5);
    card.style.top = top + 'px'; card.style.height = h + 'px';
    ribbon(s, 160 - 60, top - 13, 120, 24, tip.title, g.waves.boss ? 'skull' : null, g.waves.boss ? 'skull' : null, 11);
    const go = button(card, 'tipgo', 'gold', W / 2 - 50, h - 25, 100, 18, 'START WAVE ' + g.waves.wave, 'play', 8);
    drawButton(go.cv, THEME.gold, false);
    go.wrap.classList.add('tipgo');
    buttons.pop(); // drawn once here, not by the menu selection loop
  }
  function syncTips(g) {
    if (tips.wave !== g.waves.wave) { tips.wave = g.waves.wave; buildTips(g); }
  }

  // LEADERBOARD (rows filled in by sync; any click / Enter / Esc goes back, handled by the game)
  const board = {};
  {
    const s = scr('board');
    panel(s, 52, 7, 216, 160, true);
    el('div', 'lb-title', s).textContent = 'LEADERBOARD';
    const head = el('div', 'lb-row lb-head', s, { top: '33px' });
    for (const [c, t] of [['n', '#'], ['nm', 'NAME'], ['w', 'WAVE'], ['sc', 'SCORE']]) el('span', c, head).textContent = t;
    el('div', 'lb-line', s, at(62, 42, 196, 1));
    board.rows = el('div', 'lb-rows', s, at(0, 45, 320, 100));
    board.msg = el('div', 'lb-msg', s);
    board.status = el('div', 'lb-status', s);
    el('div', 'lb-hint', s).textContent = 'ENTER / ESC / CLICK TO GO BACK';
    board.key = null;
  }

  // GAME OVER
  const vals = {};
  let rankEl;
  {
    const s = scr('over');
    panel(s, 62, 27, 198, 110, 'dark');
    ribbon(s, 83, 9, 156, 27, 'GAME OVER', 'skull', 'skull', 12);
    const STAT = [['score', 'trophy', 'SCORE'], ['wave', 'flag', 'WAVE'], ['words', 'aa', 'WORDS'],
      ['gold', 'coin', 'GOLD EARNED'], ['acc', 'target', 'ACCURACY'], ['best', 'star', 'BEST SCORE']];
    const PAL = { target: { main: '#f5a23a', shade: '#e0403a', hi: '#fff3d0', d: '#6a3a14', ol: '#2a0a08' }, aa: { main: '#f3e2c0', ol: '#1e140a' } };
    STAT.forEach(([k, ic, lab], i) => {
      const Y = 43 + i * 15;
      const r = el('div', 'stat', s, at(78, Y, 166, 12));
      sprite(ic, PAL[ic] || GOLD_IC, el('div', 'sic', r));
      el('span', 'sl', r).textContent = lab;
      (vals[k] = el('span', 'sv', r)).textContent = '0';
      if (i < STAT.length - 1) el('div', 'sep', s, at(80, Y + 13, 162, 1));
    });
    rankEl = el('div', 'rank', s);
    button(s, 'again', 'gold', 70, 147, 88, 23, 'PLAY AGAIN', 'restart', 9);
    button(s, 'quit', 'crimson', 164, 147, 88, 23, 'MAIN MENU', 'home', 9);
  }

  const SCREEN_MENU = { menu: 'main', settings: 'settings', paused: 'pause', over: 'over' };
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
    const e = ev.target.closest('[data-id],[data-row]');
    if (e) select(e.dataset.id || e.dataset.row);
  });
  root.addEventListener('pointerdown', (ev) => {
    const g = TD.game;
    TD.Audio.unlock();
    if (ev.target.closest('[data-id="namego"]')) { ev.preventDefault(); if (g.state === 'name') g.confirmName(); return; }
    if (ev.target.closest('[data-id="nameback"]')) { ev.preventDefault(); if (g.state === 'name') g.toMenu(); return; }
    if (ev.target.closest('.tipgo')) { // same as Enter on a tip card
      ev.preventDefault();
      if (g.state === 'play' && g.phase === 'tips' && g.time - g.tipsAt > 0.4) { g.phase = 'banner'; TD.Audio.hover(); }
      return;
    }
    const b = ev.target.closest('.btn');
    if (b) { ev.preventDefault(); select(b.dataset.id); g.activate(b.dataset.id); return; }
    const tog = ev.target.closest('.tog');
    if (tog) { select('fs'); g.setFullscreen(tog.dataset.v === '1'); return; } // inside the click gesture
    const tr = ev.target.closest('.track');
    if (tr) { select(tr.dataset.row); dragTrack(tr, ev); return; }
    const row = ev.target.closest('.row');
    if (row) select(row.dataset.id);
  });
  function dragTrack(tr, ev) {
    const id = tr.dataset.row, A = TD.Audio;
    const set = (e) => {
      const r = tr.getBoundingClientRect();
      const lv = Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * A.MAX_LEVEL);
      if (lv === (id === 'music' ? A.musicLevel : A.sfxLevel)) return;
      if (id === 'music') A.setMusicLevel(lv); else A.setSfxLevel(lv);
      A.hover();
    };
    set(ev);
    const up = () => { window.removeEventListener('pointermove', set); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', set);
    window.addEventListener('pointerup', up);
  }

  // ---- per-frame sync ----
  let lastState = null, lastBox = '';
  const setText = (e, t) => { t = String(t); if (e.textContent !== t) e.textContent = t; };
  function syncBoard() {
    const LB = TD.Leaderboard, list = LB.list();
    const key = LB.status + '|' + list.map((e) => e.name + ':' + e.wave + ':' + e.score + ':' + (LB.isMine(e) ? 1 : 0)).join(',');
    if (key === board.key) return;
    board.key = key;
    board.rows.textContent = '';
    list.forEach((e, i) => {
      const r = el('div', 'lb-row' + (i === 0 ? ' first' : '') + (LB.isMine(e) ? ' mine' : ''), board.rows, { top: i * 10 + 'px' });
      for (const [c, t] of [['n', i + 1], ['nm', e.name], ['w', e.wave], ['sc', e.score]]) el('span', c, r).textContent = String(t);
    });
    board.msg.textContent = list.length ? '' : LB.status === 'loading' ? 'LOADING...' : 'NO SCORES YET - GO PLAY!';
    const st = LB.status === 'online' ? ['', 'on'] : LB.status === 'offline' ? ['OFFLINE - SHOWING THIS DEVICE ONLY', 'off'] : ['LOADING...', 'wait'];
    board.status.textContent = st[0];
    board.status.className = 'lb-status ' + st[1];
  }

  // ---- in-game HUD (full canvas width, not just the play area) ----
  const hud = el('div', '', document.body);
  hud.id = 'hud';
  // two-row stat box: gold frame, maroon inside, a dark icon well per row and a divider between rows
  function drawHudBox(c) {
    const x = c.getContext('2d'), w = c.width, h = c.height;
    step(x, 'rgba(0,0,0,.45)', 1, 1, w - 1, h - 1, 2);
    step(x, '#140a04', 0, 0, w - 1, h - 1, 2);
    step(x, '#e0a640', 1, 1, w - 3, h - 3, 1);
    R(x, '#ffe27a', 2, 1, w - 5, 1); R(x, '#a86a14', 2, h - 3, w - 5, 1);
    step(x, '#2a0a10', 2, 2, w - 5, h - 5, 1);
    R(x, '#4e1420', 3, 3, w - 7, h - 7);
    R(x, '#5e1a28', 3, 3, w - 7, 1);
    const mid = Math.floor((h - 1) / 2);
    R(x, '#2a0a10', 3, mid, w - 7, 1); R(x, '#7a3a24', 3, mid + 1, w - 7, 1); // divider
    for (const wy of [3, mid + 2]) { // icon wells
      const wh = (wy === 3 ? mid : h - 4) - wy;
      R(x, '#22080e', 3, wy, 11, wh);
      R(x, '#140508', 14, wy, 1, wh);
    }
  }
  // heart badge that caps the left end of the HP bar
  function drawBadge(c) {
    const x = c.getContext('2d'), w = c.width, h = c.height;
    step(x, 'rgba(0,0,0,.45)', 1, 1, w - 1, h - 1, 3);
    step(x, '#140a04', 0, 0, w - 1, h - 1, 3);
    step(x, '#e0a640', 1, 1, w - 3, h - 3, 2);
    R(x, '#ffe27a', 3, 1, w - 7, 1);
    step(x, '#2a0a10', 2, 2, w - 5, h - 5, 2);
    step(x, '#4e1420', 3, 3, w - 7, h - 7, 1);
  }
  function drawHpBar(c, ratio) {
    const x = c.getContext('2d'), w = c.width, h = c.height;
    x.clearRect(0, 0, w, h);
    step(x, 'rgba(0,0,0,.5)', 1, 1, w - 1, h - 1, 2);
    step(x, '#140a04', 0, 0, w - 1, h - 1, 2);
    step(x, '#e0a640', 1, 1, w - 3, h - 3, 1);
    R(x, '#ffe27a', 2, 1, w - 5, 1); R(x, '#a86a14', 2, h - 3, w - 5, 1);
    step(x, '#140a04', 2, 2, w - 5, h - 5, 1);
    const ix = 3, iy = 3, iw = w - 7, ih = h - 7;
    R(x, '#2a2430', ix, iy, iw, ih);
    const col = ratio > 0.5 ? ['#7ee084', '#3fae50', '#2a8a3a'] : ratio > 0.25 ? ['#ffd070', '#f4a640', '#c87a20'] : ['#ff8a7a', '#e83b3b', '#a82424'];
    const fw = Math.ceil(iw * Math.max(0, Math.min(1, ratio)));
    if (fw > 0) {
      R(x, col[1], ix, iy, fw, ih);
      R(x, col[0], ix, iy, fw, Math.max(1, Math.round(ih * 0.35)));
      R(x, col[2], ix, iy + ih - 2, fw, 2);
      R(x, 'rgba(255,255,255,.35)', ix, iy, fw, 1);
    }
    for (let q = 1; q < 4; q++) R(x, 'rgba(0,0,0,.35)', ix + Math.round((iw * q) / 4), iy + 1, 1, ih - 1); // quarter ticks
  }
  function drawWallBar(c, ratio) {
    const x = c.getContext('2d'), w = c.width, h = c.height;
    x.clearRect(0, 0, w, h);
    step(x, '#140a04', 0, 0, w, h, 1);
    R(x, '#2a2430', 1, 1, w - 2, h - 2);
    R(x, '#b07a45', 1, 1, Math.ceil((w - 2) * ratio), h - 2);
    R(x, '#d8a066', 1, 1, Math.ceil((w - 2) * ratio), 1);
  }
  // HUD icons have no outline so they fit inside the 10px rows of the boxes
  const H_IC = { trophy: { main: '#ffcd4a', shade: '#d98a1c', hi: '#fff3b0' }, coin: { main: '#ffcd4a', shade: '#d98a1c', hi: '#fff3b0' },
    swords: { main: '#ffcd4a', hi: '#e8eef4', shade: '#8a5a2a' }, skull: { main: '#f3e2c0' },
    heart: { main: '#c0182e', hi: '#f0607a', ol: '#2a0508' } };
  function hudBox(css, rows) {
    const b = el('div', 'hbox', hud, css);
    drawHudBox(art(66, 25, b));
    return rows.map(([ic, lab, cls], i) => {
      const r = el('div', 'hrow ' + (cls || ''), b, { top: (i ? 13 : 3) + 'px' });
      sprite(ic, H_IC[ic], el('div', 'hic', r));
      el('span', 'hl', r).textContent = lab;
      return el('span', 'hv', r);
    });
  }
  const HUD = {};
  [HUD.score, HUD.gold] = hudBox({ left: '3px', top: '2px' }, [['trophy', 'SCORE'], ['coin', 'GOLD', 'gold']]);
  [HUD.wave, HUD.left] = hudBox({ right: '3px', top: '2px' }, [['swords', 'WAVE'], ['skull', 'LEFT']]);
  HUD.combo = el('div', 'hcombo', hud);
  HUD.frost = el('div', 'hfrost', hud);
  HUD.frost.textContent = 'FROST';
  HUD.esc = el('div', 'hesc', hud);
  HUD.esc.textContent = 'ESC: PAUSE';
  HUD.bar = el('div', 'hbar', hud);
  HUD.barCv = art(100, 13, HUD.bar);
  HUD.barCv.style.left = '9px'; HUD.barCv.style.top = '2px';
  const badge = el('div', 'hbadge', HUD.bar);
  drawBadge(art(17, 17, badge));
  sprite('heart', H_IC.heart, badge);
  HUD.hp = el('div', 'hhp', HUD.bar);
  HUD.wall = el('div', 'hwall', hud);
  HUD.wallCv = art(70, 4, HUD.wall);
  HUD.last = {};
  function syncHud(g, r, u, v) {
    const show = g.state === 'play' && g.phase !== 'tips'; // only while playing: tip cards, pause, settings, game over get a clean screen
    hud.style.display = show ? '' : 'none';
    if (!show) return;
    const t = 'translate(' + r.left + 'px,' + r.top + 'px) scale(' + u + ')';
    if (HUD.last.t !== t) { HUD.last.t = t; hud.style.transform = t; hud.style.width = v.VW + 'px'; }
    if (HUD.last.vw !== v.VW) { HUD.last.vw = v.VW; HUD.bar.style.left = Math.round(v.VW / 2 - 55) + 'px'; HUD.wall.style.left = Math.round(v.VW / 2 - 35) + 'px'; }
    setText(HUD.score, g.score);
    setText(HUD.gold, g.gold);
    setText(HUD.wave, g.waves.wave);
    setText(HUD.left, g.waves.left + g.enemies.length);
    setText(HUD.hp, g.hp + '/' + g.maxHp);
    const ratio = g.maxHp ? g.hp / g.maxHp : 0;
    if (HUD.last.hp !== ratio) { HUD.last.hp = ratio; drawHpBar(HUD.barCv, ratio); }
    const wr = g.wall.level > 0 ? g.wall.hp / g.wall.max : -1;
    HUD.wall.style.display = wr >= 0 ? '' : 'none';
    if (wr >= 0 && HUD.last.wall !== wr) { HUD.last.wall = wr; drawWallBar(HUD.wallCv, wr); }
    const m = g.mult;
    setText(HUD.combo, g.combo > 0 ? 'COMBO ' + g.combo + (m > 1 ? ' X' + m : '') : '');
    HUD.frost.style.display = g.phase !== 'shop' && g.buffs && g.buffs.frost ? '' : 'none';
    HUD.esc.style.display = g.state === 'over' ? 'none' : '';
  }

  TD.Overlay = {
    sync(g) {
      const c = document.getElementById('game'), r = c.getBoundingClientRect(), v = TD.view;
      const u = r.width / v.VW;
      const box = (r.left + v.OX * u).toFixed(2) + ',' + r.top.toFixed(2) + ',' + u.toFixed(4);
      if (box !== lastBox) {
        lastBox = box;
        root.style.transform = 'translate(' + (r.left + v.OX * u) + 'px,' + r.top + 'px) scale(' + u + ')';
      }
      syncHud(g, r, u, v);

      const key = g.state === 'play' && g.phase === 'tips' && TD.Tips[g.waves.wave] ? 'tips' : g.state;
      const s = screens[key] ? key : null;
      if (s !== 'tips') tips.wave = null; // rebuild next time a card shows
      if (s !== lastState) {
        for (const k in screens) screens[k].classList.toggle('on', k === s);
        lastState = s;
      }
      if (!s) return;
      if (s === 'board') return syncBoard();
      if (s === 'tips') return syncTips(g);
      if (s === 'name') return syncName(g);
      const list = TD.menuButtons(SCREEN_MENU[s]);
      const selId = list[g.sel] && list[g.sel].id;
      for (const b of buttons) {
        if (!screens[s].contains(b.wrap)) continue;
        const on = b.id === selId;
        if (b.sel !== on) { b.sel = on; b.wrap.classList.toggle('sel', on); drawButton(b.cv, THEME[b.theme], on && s !== 'menu' && s !== 'over'); /* game over: hover-only */ }
      }

      if (s === 'menu') {
        const b = screens.menu.querySelector('.btn.sel');
        screens.menu.querySelectorAll('.chev').forEach((ch) => {
          ch.style.display = b ? '' : 'none';
          if (!b) return;
          const top = parseFloat(b.style.top) + (parseFloat(b.style.height) - 1) / 2 - 5.5;
          ch.style.top = top + 'px';
          ch.style.left = (ch.dataset.side === 'L' ? parseFloat(b.style.left) - 13 : parseFloat(b.style.left) + parseFloat(b.style.width) + 5) + 'px';
        });
      } else if (s === 'settings') {
        const A = TD.Audio;
        for (const id of ['music', 'sfx', 'fs']) {
          const rw = rows[id], on = id === selId;
          if (rw.sel !== on) { rw.sel = on; rw.row.classList.toggle('sel', on); drawRow(rw.cv, on); }
          if (rw.track) {
            const lv = id === 'music' ? A.musicLevel : A.sfxLevel;
            if (rw.lv !== lv) { rw.lv = lv; drawTrack(rw.track, lv, A.MAX_LEVEL); }
          }
        }
        const fsOn = !!document.fullscreenElement, canFs = !!document.documentElement.requestFullscreen;
        for (const v of ['1', '0']) {
          const t = rows['tog' + v], act = (v === '1') === fsOn;
          if (t.act !== act) {
            t.act = act;
            const th = THEME[act ? 'gold' : 'navy'];
            drawButton(t.c, th, false);
            Object.assign(t.t.lastChild.style, { color: th.tx, textShadow: '0 1px 0 ' + th.ts });
          }
          t.t.style.display = canFs ? '' : 'none';
        }
        rows.fs.row.style.display = canFs ? '' : 'none';
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
        screens.over.classList.toggle('over-wait', g.time - g.overAt <= 0.8);
      }
    },
  };
})();
