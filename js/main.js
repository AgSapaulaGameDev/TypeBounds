// Game state, update and render.
(function () {
  'use strict';
  const TD = window.TD;
  const W = 320, H = 180; // the play area; everything gameplay uses these coords
  const F = TD.Font, S = TD.Sprites, B = TD.BASE, A = TD.Audio;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // ---- view: fill the whole window ----
  // The canvas is always 180 px tall. Its width follows the window's shape (320 to 640),
  // so wide screens show more forest at the sides instead of black bars.
  // OX = how far the 320-wide play area is shifted right to sit in the middle.
  let VW = W, OX = 0, bg = null, bgMenu = null;
  const VW_MIN = W, VW_MAX = 640;

  function fit() {
    const iw = window.innerWidth, ih = window.innerHeight;
    const raw = (H * iw) / ih;
    const vw = Math.max(VW_MIN, Math.min(VW_MAX, Math.round(raw)));
    if (vw !== canvas.width || !bg) {
      canvas.width = vw;
      canvas.height = H;
      VW = vw;
      OX = Math.floor((VW - W) / 2);
      TD.view = { OX, VW, W, H }; // the HTML menu overlay lines itself up with the play area
      bg = S.buildBackground(7, VW);
      bgMenu = S.buildBackground(7, VW, true); // same forest, no stone plaza: the menu logo has its own tower
    }
    ctx.imageSmoothingEnabled = false;
    if (raw >= VW_MIN && raw <= VW_MAX) {
      canvas.style.width = iw + 'px';
      canvas.style.height = ih + 'px';
    } else {
      const s = Math.min(iw / VW, ih / H);
      canvas.style.width = Math.floor(VW * s) + 'px';
      canvas.style.height = Math.floor(H * s) + 'px';
    }
  }
  let fitQueued = false;
  const queueFit = () => { if (!fitQueued) { fitQueued = true; requestAnimationFrame(() => { fitQueued = false; fit(); }); } };
  window.addEventListener('resize', queueFit);
  document.addEventListener('fullscreenchange', queueFit);
  fit();

  const C = {
    white: '#f4f4f4', gold: '#ffcd75', orange: '#f4a640', red: '#ef7d57', blood: '#b13e53',
    dim: '#94b0c2', ink: '#1a1c2c', green: '#38b764', lime: '#a7f070', faint: '#566c86', coin: '#e8d27a',
  };

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  // 7x8 pixel eyedropper (colour picker) used to mark "type the ink colour" slimes:
  // gold bulb top-right, grey collar, white glass tube down to the tip, then a drip
  const DROPPER = ['.....BB', '....CBB', '...WC..', '..WW...', '.WW....', '.W.....', '.......', '.D.....'];
  const DROPPER_COL = { B: '#ffcd75', C: '#94b0c2', W: '#f4f4f4' };
  function drawDropper(x, y, t) {
    DROPPER.forEach((row, py) => {
      for (let px = 0; px < row.length; px++) {
        const ch = row[px];
        if (ch === '.') continue;
        ctx.fillStyle = ch === 'D' ? 'hsl(' + Math.floor(t * 120) % 360 + ',90%,62%)' : DROPPER_COL[ch]; // drip cycles colours
        ctx.fillRect(x + px, y + py, 1, 1);
      }
    });
  }

  const distToBase = (e) => Math.hypot(e.x - B.cx, e.y - B.cy);
  const inRect = (x, y, r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

  const fireflies = Array.from({ length: 24 }, () => ({
    x: rand(-160, 480), y: rand(20, 170), p: rand(0, 6.28), vx: rand(-4, 4), vy: rand(-3, 3),
  }));

  // Spawn point on the visible screen edge, along a random ray from the base.
  function edgePoint() {
    const a = Math.random() * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
    const x0 = -OX + 10, x1 = W + OX - 10, y0 = 28, y1 = H - 14;
    let t = Infinity;
    if (dx > 0) t = Math.min(t, (x1 - B.cx) / dx); else if (dx < 0) t = Math.min(t, (x0 - B.cx) / dx);
    if (dy > 0) t = Math.min(t, (y1 - B.cy) / dy); else if (dy < 0) t = Math.min(t, (y0 - B.cy) / dy);
    return { x: B.cx + dx * t, y: B.cy + dy * t };
  }

  // ---- menus (play-area coords) ----
  const canFullscreen = !!document.documentElement.requestFullscreen;
  const MENUS = {
    main: { x: 104, y: 113, w: 112, h: 15, gap: 17, items: () => [
      { id: 'play', label: 'PLAY', key: 'p' },
      { id: 'board', label: 'LEADERBOARD', key: 'l' },
      { id: 'settings', label: 'SETTINGS', key: 's' },
    ] },
    pause: { x: 100, y: 66, w: 120, h: 16, gap: 20, items: () => [
      { id: 'resume', label: 'RESUME', key: 'r' },
      { id: 'restart', label: 'RESTART', key: 't' },
      { id: 'settings', label: 'SETTINGS', key: 's' },
      { id: 'quit', label: 'MAIN MENU', key: 'm' },
    ] },
    // game over: PLAY AGAIN / MAIN MENU side by side (drawn by the HTML overlay)
    over: { x: 75, y: 149, w: 81, h: 21, gap: 0, items: () => [
      { id: 'again', label: 'PLAY AGAIN', key: 'p', x: 75, y: 149, w: 81, h: 21 },
      { id: 'quit', label: 'MAIN MENU', key: 'm', x: 167, y: 149, w: 84, h: 21 },
    ] },
    // MUSIC / SFX are volume sliders: label on top, [-] [##########] [+] below.
    // Settings = compact rows: label on the left, control on the right. BACK is a normal button.
    settings: { x: 120, y: 0, w: 80, h: 16, gap: 0, items: () => {
      const rows = [
        { id: 'music', slider: true, label: 'MUSIC' },
        { id: 'sfx', slider: true, label: 'SFX' },
        ...(canFullscreen ? [{ id: 'fs', toggle: true, label: 'FULLSCREEN', on: !!document.fullscreenElement }] : []),
      ];
      rows.forEach((r, i) => Object.assign(r, { x: 80, y: 60 + i * 17, w: 160, h: 14 }));
      return [...rows, { id: 'back', label: 'BACK', x: 120, y: 64 + rows.length * 17, w: 80, h: 16 }];
    } },
  };
  function buttons(name) {
    const m = MENUS[name];
    let row = 0; // only plain buttons use the column layout
    return m.items().map((it) => (it.x != null ? it : Object.assign({ x: m.x, y: m.y + row++ * m.gap, w: m.w, h: m.h }, it)));
  }
  // slider pieces, right-aligned in the row: [-] [segments] [+]
  const SEG = 10, SEG_W = 6, SEG_GAP = 1;
  function sliderParts(b) {
    const y = b.y + 2, h = 10;
    const plus = { x: b.x + b.w - 4 - 10, y, w: 10, h };
    const bw = SEG * (SEG_W + SEG_GAP) + 1;
    const bar = { x: plus.x - 2 - bw, y, w: bw, h };
    return { minus: { x: bar.x - 2 - 10, y, w: 10, h }, bar, plus };
  }
  // ON / OFF pill, right-aligned in the row
  function toggleParts(b) {
    const y = b.y + 2, x = b.x + b.w - 4 - 40;
    return { on: { x, y, w: 20, h: 10 }, off: { x: x + 20, y, w: 20, h: 10 } };
  }
  TD.menuButtons = buttons; // the HTML overlay maps its buttons onto these indices (game.sel)
  const levelOf = (id) => (id === 'music' ? A.musicLevel : A.sfxLevel);
  const setLevel = (id, n) => (id === 'music' ? A.setMusicLevel(n) : A.setSfxLevel(n));

  const NAME_MAX = 10;

  const game = {
    state: 'menu', // menu | name | board | settings | play | paused | spam | over
    time: 0,
    sel: 0, settingsFrom: 'menu',
    playerName: '', nameErrT: 0, lastRank: 0,
    gold: 0, armorLv: 0, wall: new TD.Barricade(), buffs: {},
    best: parseInt(store.get('td_best', '0'), 10) || 0,
    enemies: [], particles: [], bolts: [], floats: [],
    hp: 20, maxHp: 20, score: 0, combo: 0, locked: null,
    shake: 0, baseFlash: 0, typoFlash: 0,
    phase: 'banner', banner: 0, bannerText: '', bannerSub: '',
    waves: new TD.WaveManager(),

    // A run is on screen (playing, paused, its settings, or its game-over screen).
    get inGame() {
      return this.state === 'play' || this.state === 'paused' || this.state === 'spam' || this.state === 'over' ||
        (this.state === 'settings' && this.settingsFrom === 'paused');
    },
    get frozen() { return this.state === 'paused' || this.state === 'spam' || (this.state === 'settings' && this.settingsFrom === 'paused'); },
    get menuName() {
      return this.state === 'menu' ? 'main' : this.state === 'paused' ? 'pause' : this.state === 'settings' ? 'settings'
        : this.state === 'over' ? 'over' : null;
    },

    get mult() { return Math.min(3, 1 + Math.floor(this.combo / 10) * 0.25); },

    reset() {
      Object.assign(this, {
        enemies: [], particles: [], bolts: [], floats: [],
        hp: 20, maxHp: 20, score: 0, combo: 0, bestCombo: 0, kills: 0,
        correct: 0, typos: 0, waveTypos: 0, locked: null, splitFrom: null, throws: [],
        shake: 0, baseFlash: 0, typoFlash: 0, newBest: false,
        gold: 0, goldEarned: 0, armorLv: 0, wall: new TD.Barricade(),
        buffs: {}, // one-wave shop buffs: frost
        tipsSeen: {}, // tip cards already shown this run
      });
      this.waves = new TD.WaveManager();
      this.state = 'play';
      this.startWave(1);
    },

    startWave(n) {
      // snapshot for "No Spamming!": a keyboard smash restarts the wave from exactly here
      this.waveStart = {
        hp: this.hp, maxHp: this.maxHp, gold: this.gold, goldEarned: this.goldEarned, score: this.score,
        armorLv: this.armorLv, kills: this.kills, correct: this.correct, typos: this.typos, bestCombo: this.bestCombo,
        wall: { level: this.wall.level, max: this.wall.max, hp: this.wall.hp }, buffs: { ...this.buffs },
      };
      this.missTimes = [];
      this.waves.start(n);
      this.waveTypos = 0;
      this.phase = 'banner';
      this.banner = 2.2;
      this.bannerText = 'WAVE ' + n;
      this.bannerSub = n === 1 ? 'TYPE THE WORDS!' : 'GET READY';
      if (this.waves.boss) { this.bannerText = 'BOSS WAVE ' + n; this.bannerSub = 'THE ' + TD.EnemyTypes[this.waves.boss].name + ' APPROACHES'; }
      const pos = TD.wavePos(n); // theme hints on the first wave of each new enemy mix
      if (pos === 3) this.bannerSub = 'MATHS IMPS: TYPE THE ANSWER!';
      if (pos === 6) this.bannerSub = 'COLOUR SLIMES: TYPE THE WORD!';
      if (pos === 8) this.bannerSub = 'EYEDROPPER = TYPE THE INK COLOUR!';
      if (pos === 11) this.bannerSub = 'ANIMALS: RABBITS HOP FAST!';
      if (pos === 13) this.bannerSub = 'CHAMELEONS: TYPE THEM WHILE YOU CAN SEE THEM!';
      // first time a wave brings new enemies: show their tip card until Enter
      if (TD.Tips[n] && !this.tipsSeen[n]) { this.tipsSeen[n] = true; this.phase = 'tips'; this.tipsAt = this.time; }
      if (this.waves.boss === 'rainbow') this.bannerSub = 'EYEDROPPER = TYPE THE INK COLOUR!';
      if (this.waves.boss === 'goose') this.bannerSub = 'GOLDEN EGGS ARE YOUR AMMO!';
      A.wave();
    },

    clearWave() {
      this.buffs = {}; // one-wave buffs run out
      this.phase = 'clear';
      this.banner = 2.4;
      this.bannerText = 'WAVE ' + this.waves.wave + ' CLEAR';
      let goldBonus = 5 + this.waves.wave * 2;
      if (this.waveTypos === 0) {
        this.score += 50 * this.waves.wave;
        goldBonus += 10;
        this.bannerSub = 'PERFECT! +' + goldBonus + ' GOLD';
      } else {
        this.bannerSub = '+' + goldBonus + ' GOLD';
      }
      this.addGold(goldBonus);
      A.clear();
    },

    addGold(n) { this.gold += n; this.goldEarned += n; },

    // ---- screens ----
    toMenu() { this.state = 'menu'; this.sel = 0; this.locked = null; this.enemies = []; this.particles = []; this.floats = []; this.bolts = []; },
    pause() { if (this.state === 'play') { this.state = 'paused'; this.sel = 0; A.lock(); } },
    resume() { this.state = 'play'; },
    openSettings(from) { this.settingsFrom = from; this.state = 'settings'; this.sel = 0; },
    closeSettings() {
      const from = this.settingsFrom;
      this.state = from;
      this.sel = buttons(from === 'paused' ? 'pause' : 'main').findIndex((b) => b.id === 'settings');
    },

    activate(id) {
      if (this.state === 'over' && this.time - this.overAt < 0.8) return; // don't skip game over by accident
      A.lock();
      switch (id) {
        case 'play':
          this.state = 'name';
          this.playerName = this.playerName || TD.Leaderboard.lastName();
          this.nameErrT = 0;
          break;
        case 'board': this.state = 'board'; TD.Leaderboard.refresh(); break;
        case 'settings': this.openSettings(this.state); break;
        case 'resume': this.resume(); break;
        case 'restart': this.reset(); break; // fresh run, same name (the abandoned run is not posted)
        case 'again': this.reset(); break;
        case 'quit': this.toMenu(); break;
        case 'sfx': case 'music': { // Enter = mute / unmute
          const lv = levelOf(id);
          if (lv > 0) { this.unmuted[id] = lv; setLevel(id, 0); } else setLevel(id, this.unmuted[id] || 8);
          A.hover();
          break;
        }
        case 'fs': this.setFullscreen(!document.fullscreenElement); break;
        case 'back': this.closeSettings(); break;
      }
    },

    unmuted: {},
    onAdjust(dir) { this.adjust(dir); },
    // Left/Right arrows (or -/+ clicks) on a volume slider
    adjust(dir) {
      if (this.state !== 'settings') return;
      const b = buttons('settings')[this.sel];
      if (!b) return;
      if (b.toggle) { this.setFullscreen(dir < 0); return; } // Left = ON, Right = OFF (as drawn)
      if (!b.slider) return;
      setLevel(b.id, levelOf(b.id) + dir);
      A.hover(); // doubles as a preview of the new SFX volume
    },
    setFullscreen(on) {
      if (on === !!document.fullscreenElement) return;
      A.hover();
      if (on) document.documentElement.requestFullscreen().catch(() => {});
      else document.exitFullscreen();
    },

    confirmName() {
      const n = this.playerName.trim();
      if (!n) { this.nameErrT = 1.2; A.typo(); return; }
      this.playerName = n;
      TD.Leaderboard.setName(n);
      this.reset();
    },

    // Prefer words whose first letter is not already on screen, so lock-on is never ambiguous.
    pickWord(listName, self) {
      const list = TD.Words[listName];
      const others = this.enemies.filter((e) => e !== self);
      const usedFirst = new Set(others.map((e) => e.word[0]));
      const usedWord = new Set(others.map((e) => e.word));
      let pool = list.filter((w) => !usedFirst.has(w[0]));
      if (!pool.length) pool = list.filter((w) => !usedWord.has(w));
      if (!pool.length) pool = list;
      return pick(pool);
    },

    spawnEnemy(kind, speedMul) {
      const p = edgePoint();
      if (kind === 'minion') {
        // maths minion on a normal wave (3-4): type the answer to its sum
        const [q, ans] = this.makeSum();
        const m = new TD.Enemy('minion', ans, p.x, p.y, speedMul * (this.buffs.frost ? 0.8 : 1));
        m.prefix = q + '=';
        this.enemies.push(m);
        this.burst(p.x, p.y - 4, m.t.gore, 8, 20, 0);
        return m;
      }
      if (kind === 'cdrop') {
        // eyedropper slime on a normal wave: type its ink colour
        const m = this.spawnSlime(p.x, p.y, speedMul * 0.75 * (this.buffs.frost ? 0.8 : 1), null, true); // a bit slower
        this.burst(p.x, p.y - 4, ['#1a1c2c', '#333c57', '#566c86'], 8, 20, 0);
        return m;
      }
      const list = TD.EnemyTypes[kind].list;
      const e = new TD.Enemy(kind, list ? this.pickWord(list) : '', p.x, p.y, speedMul * (this.buffs.frost ? 0.8 : 1));
      if (kind === 'color' || kind === 'ctank') e.ink = pick(Object.keys(TD.Inks).filter((c) => c !== e.word)); // never its own colour
      this.enemies.push(e);
      this.burst(p.x, p.y - 4, ['#1a1c2c', '#333c57', '#566c86'], 8, 20, 0);
      return e;
    },

    // Word Color slime for the Rainbow Slime fight. inkRule = drop-tagged: shows a decoy colour
    // word drawn in an ink, and you must type the INK colour instead of the word.
    spawnSlime(x, y, mul, owner, inkRule) {
      let m;
      if (inkRule) {
        const used = new Set(this.enemies.filter((e) => !e.hidden).map((e) => e.word[0]));
        let pool = TD.ClearInks.filter((c) => !used.has(c[0]));
        if (!pool.length) pool = TD.ClearInks;
        const ink = pick(pool);
        m = new TD.Enemy('color', ink, x, y, mul);
        m.inkRule = true;
        m.ink = ink;
        m.shown = pick(TD.Words.colors.filter((c) => c !== ink));
      } else {
        m = new TD.Enemy('color', this.pickWord('colors'), x, y, mul);
        m.ink = pick(Object.keys(TD.Inks).filter((col) => col !== m.word));
      }
      m.owner = owner;
      this.enemies.push(m);
      return m;
    },

    // re-ink one slime; for ink-rule slimes the answer changes with it (not while you're typing it)
    reInk(m) {
      if (m.inkRule) {
        if (m.progress) return;
        const used = new Set(this.enemies.filter((e) => e !== m && !e.hidden).map((e) => e.word[0]));
        const opts = TD.ClearInks.filter((c) => c !== m.ink);
        const fresh = opts.filter((c) => !used.has(c[0])); // keep first letters unique when possible
        m.ink = m.word = pick(fresh.length ? fresh : opts);
        if (m.shown === m.ink) m.shown = pick(TD.Words.colors.filter((c) => c !== m.ink));
      } else {
        const pool = Object.keys(m.kind === 'medslime' ? TD.TertiaryInks : TD.Inks);
        m.ink = pick(pool.filter((col) => col !== m.word && col !== m.ink));
      }
      m.flash = 0.1;
    },

    // Bosses enter from the far left or right edge, on the side they will roam.
    spawnBoss(kind, speedMul) {
      const e = this.spawnEnemy(kind, speedMul);
      const side = e.dest.x < B.cx ? -1 : 1; // enter on the side of its first roam point
      e.x = B.cx + side * 158;
      e.y = rand(70, 115);
      this.floats.push({ x: e.x, y: e.y - 26, text: e.t.name + '!', color: C.red, life: 1.6, align: 'center' });
      A.wave();
    },

    // a + or - question whose answer starts with a digit no other enemy on screen starts with
    makeSum() {
      const used = new Set(this.enemies.filter((e) => !e.hidden).map((e) => e.word[0]));
      let q, ans;
      for (let tries = 0; tries < 40; tries++) {
        const big = this.waves.wave >= 10 ? 20 : 12;
        if (Math.random() < 0.5) {
          const a = 1 + Math.floor(Math.random() * big), b = 1 + Math.floor(Math.random() * big);
          q = a + '+' + b; ans = String(a + b);
        } else {
          const a = 4 + Math.floor(Math.random() * (big + 6)), b = 1 + Math.floor(Math.random() * (a - 1));
          q = a + '-' + b; ans = String(a - b);
        }
        if (!used.has(ans[0])) break;
      }
      return [q, ans];
    },

    // Mathematician summons: each minion carries a sum; its "word" is the answer.
    // Answers start with a digit no other enemy on screen starts with.
    spawnMinions(boss) {
      const n = boss.minionCount;
      // split between the left and right edges of the field; each side is a spread-out column
      const first = Math.random() < 0.5 ? -1 : 1;
      const sides = Array.from({ length: n }, (_, i) => (i % 2 ? -first : first));
      const count = { '-1': sides.filter((s) => s < 0).length, '1': sides.filter((s) => s > 0).length };
      const seen = { '-1': 0, '1': 0 };
      const mul = this.waves.speedMul * (this.buffs.frost ? 0.8 : 1);
      for (let i = 0; i < n; i++) {
        const side = sides[i], k = seen[side]++, c = count[side];
        const x = clamp(B.cx + side * (126 + k * 10), 8, W - 8);
        const y = clamp(B.cy + (k - (c - 1) / 2) * 34, 30, H - 14);
        if (boss.t.minion === 'color') {
          // Rainbow Slime: Word Color slimes
          // slower than normal slimes; the first one (and ~35% of the rest) are drop-tagged ink-rule slimes
          const m = this.spawnSlime(x, y, mul * 0.6, boss, i === 0 || Math.random() < 0.35);
          this.burst(x, y - 4, m.gore, 8, 25, 0);
          continue;
        }
        const [q, ans] = this.makeSum();
        const m = new TD.Enemy('minion', ans, x, y, mul);
        m.prefix = q + '=';
        m.owner = boss;
        this.enemies.push(m);
        this.burst(x, y - 4, m.t.gore, 8, 25, 0);
      }
      A.lock();
    },

    // ---- input ----
    onChar(ch) {
      const mn = this.menuName;
      if (mn) {
        const b = buttons(mn).find((it) => it.key === ch);
        if (b) this.activate(b.id);
        return;
      }
      if (this.state === 'name') {
        if (this.playerName.length < NAME_MAX) { this.playerName += ch.toUpperCase(); A.type(this.playerName.length); }
        return;
      }
      if (this.state !== 'play') return;
      if (this.phase === 'shop') return TD.Shop.onChar(this, ch);
      if (this.phase === 'tips') return;
      let e = this.locked;
      if (e && e.hidden) return; // locked tortoise is hiding in its shell: keys do nothing until it comes out
      if (!e) {
        const cands = this.enemies.filter((en) => !en.hidden && en.word[0] === ch);
        // a camouflaged chameleon can't be locked onto, but aiming at it isn't a typo either
        if (!cands.length && this.enemies.some((en) => en.camo && en.hidden && en.word[0] === ch)) return;
        if (!cands.length) return this.miss(null);
        cands.sort((a, b) => distToBase(a) - distToBase(b));
        e = this.locked = cands[0];
        A.lock();
      } else if (e.word[e.progress] !== ch) {
        // words that share a start (REDORANGE / REDVIOLET): switch to the one that matches what you typed
        const typed = e.word.slice(0, e.progress) + ch;
        const alt = this.enemies.find((o) => o !== e && !o.hidden && !o.progress && o.word.startsWith(typed));
        if (alt) {
          alt.progress = e.progress; e.progress = 0;
          this.locked = alt;
          return this.hitLetter(alt);
        }
        if (e.kind === 'rainbow') e.scramble(this); // Rainbow Slime: wrong letter = new colour + new word
        return this.miss(e); // typo: lock stays, no damage until the right letter
      }
      this.hitLetter(e);
    },

    onCancel(key) {
      switch (this.state) {
        case 'name':
          if (key === 'Backspace') this.playerName = this.playerName.slice(0, -1);
          else this.toMenu();
          return;
        case 'board': return this.toMenu();
        case 'settings': return this.closeSettings();
        case 'paused': return this.resume();
        case 'over':
          if (key === 'Escape' && this.time - this.overAt > 0.8) this.toMenu();
          return;
        case 'play':
          if (key === 'Escape') return this.pause();
          if (this.phase === 'shop') return TD.Shop.back();
          if (this.locked) { this.locked.progress = 0; this.locked = null; A.cancel(); }
          return;
      }
    },

    onEnter() {
      const mn = this.menuName;
      if (mn) { const b = buttons(mn)[this.sel]; if (b) this.activate(b.id); return; }
      if (this.state === 'play' && this.phase === 'shop') TD.Shop.startNext(this);
      else if (this.state === 'play' && this.phase === 'tips' && this.time - this.tipsAt > 0.4) this.phase = 'banner';
      else if (this.state === 'spam' && this.time - this.spamAt > 1.5) this.retryWave();
      else if (this.state === 'name') this.confirmName();
      else if (this.state === 'board') this.toMenu();
      else if (this.state === 'over' && this.time - this.overAt > 0.8) this.reset(); // same name, play again
    },

    onNav(dir) {
      const mn = this.menuName;
      if (!mn) return;
      const n = buttons(mn).length;
      this.sel = (this.sel + dir + n) % n;
      A.hover();
    },

    // x, y arrive in canvas (view) coords; convert to play-area coords.
    // Plays the hover sound once each time the mouse moves onto a button.
    onHover(x, y) {
      const mn = this.menuName;
      if (mn && TD.Overlay) return; // the HTML overlay handles its own buttons
      const i = mn ? buttons(mn).findIndex((b) => inRect(x - OX, y, b)) : -1;
      const key = i >= 0 ? mn + ':' + i : null;
      if (key && key !== this.hoverKey) { this.sel = i; A.hover(); }
      this.hoverKey = key;
    },

    onClick(x, y) {
      A.unlock();
      if (this.state === 'play' && this.phase === 'shop') { TD.Shop.click(x - OX, y); return; } // cards are bought by typing
      const mn = this.menuName;
      if (mn && TD.Overlay) return;
      if (mn) {
        const list = buttons(mn), px = x - OX;
        const i = list.findIndex((it) => inRect(px, y, it));
        const b = list[i];
        if (b && b.slider) {
          // only the -, + and bar parts do something; clicking the label just selects the row
          this.sel = i;
          const p = sliderParts(b);
          if (inRect(px, y, p.minus)) this.adjust(-1);
          else if (inRect(px, y, p.plus)) this.adjust(1);
          else if (inRect(px, y, p.bar)) { setLevel(b.id, Math.min(SEG, Math.floor((px - p.bar.x) / (SEG_W + SEG_GAP)) + 1)); A.hover(); }
        } else if (b && b.toggle) {
          this.sel = i;
          const p = toggleParts(b);
          if (inRect(px, y, p.on)) this.setFullscreen(true);
          else if (inRect(px, y, p.off)) this.setFullscreen(false);
          else this.setFullscreen(!document.fullscreenElement);
        } else if (b) this.activate(b.id);
      } else if (this.state === 'board') this.toMenu();
    },

    onBlur() { this.pause(); },

    // ---- combat ----
    hitLetter(e) {
      e.progress++;
      e.flash = 0.07;
      this.correct++;
      this.combo++;
      if (this.combo > this.bestCombo) this.bestCombo = this.combo;
      const fh = e.frames[0].h;
      this.bolts.push({ x0: B.boltX, y0: B.boltY, x1: e.x, y1: e.y - fh / 2, t: 0, dur: 0.08 });
      A.type(e.progress);
      if (e.progress < e.word.length) return;
      if (e.t.boss) this.hitBoss(e);
      else this.kill(e);
    },

    hitBoss(e) {
      if (this.locked === e) this.locked = null;
      const pts = Math.round(e.word.length * 10 * this.mult);
      this.score += pts;
      const fh = e.frames[0].h;
      if (e.bossHit(this)) return this.kill(e);
      if (e.splitting) return this.splitBoss(e, pts);
      this.addGold(e.t.hitGold);
      this.floats.push({ x: e.x, y: e.y - fh - 4, text: '+' + pts, color: C.gold, life: 0.9, align: 'center' });
      this.floats.push({ x: e.x, y: e.y - fh + 3, text: e.hp === 1 ? 'HE CHARGES!' : '-1 HP', color: C.red, life: 1.1, align: 'center' });
      this.burst(e.x, e.y - fh / 2, e.gore, 18, 50, 80);
      e.flash = 0.2;
      this.shake = Math.max(this.shake, 3);
      A.kill();
    },

    // Rainbow Slime's last life: it bursts into 6 Word Color slimes that rush the tower.
    // Killing one re-inks the others; killing all 6 defeats the boss.
    splitBoss(e, pts) {
      this.enemies.splice(this.enemies.indexOf(e), 1);
      this.splitFrom = e;
      const fh = e.frames[0].h;
      this.floats.push({ x: e.x, y: e.y - fh - 4, text: '+' + pts, color: C.gold, life: 0.9, align: 'center' });
      this.floats.push({ x: e.x, y: e.y - fh + 3, text: 'IT SPLITS!', color: C.red, life: 1.4, align: 'center' });
      this.burst(e.x, e.y - fh / 2, e.gore, 40, 70, 80);
      this.shake = Math.max(this.shake, 5);
      const mul = this.waves.speedMul * (this.buffs.frost ? 0.8 : 1);
      // 4 medium slimes named after tertiary colours (REDORANGE, BLUEVIOLET...), a little slower:
      // 2 burst out to the far left, 2 to the far right. Each is drawn in a different tertiary ink.
      const names = TD.Words.tertiary.slice().sort(() => Math.random() - 0.5).slice(0, 4);
      names.forEach((word, i) => {
        const side = i % 2 ? -1 : 1, k = Math.floor(i / 2);
        const x = clamp(B.cx + side * (126 + k * 10), 8, W - 8);
        const y = clamp(B.cy + (k - 0.5) * 40, 30, H - 14);
        this.burst(x, y - 4, e.gore, 12, 30, 0); // slime splash where each one lands
        const m = new TD.Enemy('medslime', word, x, y, mul);
        m.ink = pick(TD.Words.tertiary.filter((c) => c !== word));
        m.owner = e;
        this.enemies.push(m);
      });
      A.kill();
    },

    // Keyboard smash = 6+ wrong keys within 1.5 s during a fight
    checkSpam() {
      if (this.state !== 'play' || this.phase !== 'fight') return false;
      this.missTimes = (this.missTimes || []).filter((t) => this.time - t < 1.5);
      this.missTimes.push(this.time);
      if (this.missTimes.length < 6) return false;
      this.state = 'spam';
      this.spamAt = this.time;
      this.locked = null;
      this.typoFlash = 0; // no red frame or COMBO LOST / +score floats behind the No Spamming window
      this.floats = [];
      A.typo(); A.typo();
      return true;
    },

    // after "No Spamming!": put everything back as it was when the wave began and play it again
    retryWave() {
      const s = this.waveStart, n = this.waves.wave;
      Object.assign(this, {
        hp: s.hp, maxHp: s.maxHp, gold: s.gold, goldEarned: s.goldEarned, score: s.score, armorLv: s.armorLv,
        kills: s.kills, correct: s.correct, typos: s.typos, bestCombo: s.bestCombo, buffs: { ...s.buffs },
        combo: 0, enemies: [], bolts: [], floats: [], particles: [], locked: null, splitFrom: null, throws: [],
      });
      Object.assign(this.wall, s.wall, { flash: 0 });
      this.state = 'play';
      this.startWave(n);
      this.bannerSub = 'NO SPAMMING THIS TIME!';
    },

    miss(e) {
      if (this.checkSpam()) return;
      this.typos++;
      this.waveTypos++;
      if (this.combo >= 5) this.floats.push({ x: 4 - OX, y: 25, text: 'COMBO LOST', color: C.red, life: 1, align: 'left' });
      this.combo = 0;
      this.typoFlash = 0.2;
      this.shake = Math.max(this.shake, 1.5);
      if (e) e.shake = 0.25;
      if (e && e.kind === 'tortoise') { e.shell = 1; e.hidden = true; } // pulls into its shell, word hidden ~1 s
      A.typo();
    },

    kill(e) {
      this.enemies.splice(this.enemies.indexOf(e), 1);
      if (this.locked === e) this.locked = null;
      this.kills++;
      if (e.owner && e.owner === this.splitFrom) {
        const sibs = this.enemies.filter((m) => m.owner === e.owner);
        // every split slime killed: the others swap to new ink colours; last one = boss defeated
        for (const m of sibs) this.reInk(m);
        if (!sibs.length) {
          const b = this.splitFrom;
          this.splitFrom = null;
          b.hp = 0;
          this.score += 500;
          this.addGold(b.t.gold);
          this.floats.push({ x: e.x, y: e.y - 22, text: 'BOSS DEFEATED!', color: C.gold, life: 1.8, align: 'center' });
          this.burst(e.x, e.y - 6, b.t.gore, 60, 80, 80);
          this.shake = Math.max(this.shake, 6);
          A.clear();
        }
      }
      const pts = Math.round((e.word.length + e.prefix.length) * 10 * this.mult) + (e.t.boss ? 500 : 0);
      this.score += pts;
      const fh = e.frames[0].h;
      const big = e.kind === 'tank' || e.t.heavy || e.t.boss;
      this.burst(e.x, e.y - fh / 2, e.gore, e.t.boss ? 60 : big ? 26 : 14, e.t.boss ? 80 : big ? 55 : 45, 80);
      if (e.t.boss) this.floats.push({ x: e.x, y: e.y - fh - 12, text: 'BOSS DEFEATED!', color: C.gold, life: 1.8, align: 'center' });
      this.floats.push({ x: e.x, y: e.y - fh - 4, text: '+' + pts, color: C.gold, life: 0.9, align: 'center' });
      const gold = e.t.gold;
      this.addGold(gold);
      this.floats.push({ x: e.x, y: e.y - fh + 3, text: '+' + gold + 'G', color: C.coin, life: 0.9, align: 'center' });
      this.shake = Math.max(this.shake, e.t.boss ? 6 : e.kind === 'tank' || e.t.heavy ? 3 : 1.5);
      A.kill();
      if (e.t.boss) A.clear();
      if (e.kind === 'gegg' && e.owner) this.throws.push({ x0: B.boltX, y0: B.boltY, t: 0, dur: 0.5, goose: e.owner, final: e.final });
    },

    // ---- Golden Goose ----
    layEgg(g, golden) {
      const x = clamp(g.x - g.face * 6, 10, W - 10), y = clamp(g.y, 30, H - 12);
      const e = new TD.Enemy(golden ? 'gegg' : 'egg', this.pickWord(golden ? 'goldWords' : 'eggWords'), x, y, this.waves.speedMul);
      e.owner = g;
      e.life = e.lifeMax = golden ? 4 : 6; // golden: snatched back after 4 s; white: hatches after 6 s
      this.enemies.push(e);
      this.burst(x, y - 3, golden ? e.t.gore : ['#f4f4f4', '#c2c3c7'], golden ? 10 : 5, 20, 40);
      if (golden) this.floats.push({ x, y: y - 14, text: 'GOLDEN EGG!', color: C.gold, life: 1, align: 'center' });
      A.lock();
    },

    // last life: 3 golden eggs fall at once, spread round the field
    dropFinalEggs(g) {
      const spots = [[B.cx - 95, 60], [B.cx + 95, 60], [B.cx, 150]].sort(() => Math.random() - 0.5);
      for (const [x, y] of spots) {
        const e = new TD.Enemy('gegg', this.pickWord('goldWords'), x + rand(-10, 10), y + rand(-8, 8), this.waves.speedMul);
        e.owner = g; e.final = true; e.drop = 0.5;
        e.life = e.lifeMax = 7;
        this.enemies.push(e);
      }
      g.finalHits = 0;
      this.floats.push({ x: g.x, y: g.y - 26, text: 'TYPE ALL 3!', color: C.gold, life: 1.6, align: 'center' });
      A.wave();
    },

    eggExpire(e) {
      if (e.kind === 'egg') {
        // hatches: same word (and typed letters), now a fast chick running at the tower
        e.kind = 'chick'; e.t = TD.EnemyTypes.chick; e.speed = e.t.speed * e.mul * (this.buffs.frost ? 0.8 : 1);
        e.life = null; e.state = 'walk'; e.flash = 0.15;
        this.burst(e.x, e.y - 3, ['#f4f4f4', '#c2c3c7'], 10, 30, 80);
        this.floats.push({ x: e.x, y: e.y - 14, text: 'HATCHED!', color: C.red, life: 0.9, align: 'center' });
        return;
      }
      // golden egg not typed in time: the goose snatches it back
      this.enemies.splice(this.enemies.indexOf(e), 1);
      if (this.locked === e) this.locked = null;
      this.burst(e.x, e.y - 3, e.t.gore, 10, 30, 0);
      this.floats.push({ x: e.x, y: e.y - 14, text: 'SNATCHED!', color: C.red, life: 1, align: 'center' });
      const g = e.owner;
      if (e.final && g && g.mode === 'drop') {
        // missed one of the final 3: the rest vanish too and the goose lands to try again
        for (const o of this.enemies.filter((m) => m.final && m.owner === g)) {
          this.enemies.splice(this.enemies.indexOf(o), 1);
          if (this.locked === o) this.locked = null;
          this.burst(o.x, o.y - 3, o.t.gore, 8, 30, 0);
        }
        g.mode = 'down';
        this.floats.push({ x: g.x, y: g.y - 26, text: 'MISSED! IT LANDS', color: C.red, life: 1.6, align: 'center' });
      }
    },

    // a chick reached the tower (or wall): one peck, and the goose steals 5 gold
    chickHit(c) {
      this.enemies.splice(this.enemies.indexOf(c), 1);
      if (this.locked === c) this.locked = null;
      if (c.target === 'wall') this.damageWall(c.t.dmg, c); else this.damageBase(c.t.dmg, c);
      this.burst(c.x, c.y - 3, c.t.gore, 8, 30, 80);
      const steal = Math.min(5, this.gold);
      if (steal > 0) {
        this.gold -= steal;
        const g = c.owner && this.enemies.includes(c.owner) ? c.owner : c;
        this.floats.push({ x: g.x, y: g.y - 26, text: 'GOOSE STOLE ' + steal + 'G', color: C.red, life: 1.4, align: 'center' });
      }
    },

    // a thrown golden egg hits the goose
    gooseHit(g, final) {
      if (!this.enemies.includes(g)) return;
      const fh = g.frames[0].h;
      this.burst(g.x, g.y - fh / 2, g.t.gore, 18, 50, 80);
      g.flash = 0.2;
      this.shake = Math.max(this.shake, 3);
      A.kill();
      if (final) {
        if (g.mode !== 'drop') return;
        g.finalHits++;
        if (g.finalHits < 3) { this.floats.push({ x: g.x, y: g.y - fh - 4, text: g.finalHits + '/3', color: C.gold, life: 0.9, align: 'center' }); return; }
        // all 3 hit: the goose is done. Its eggs and chicks go with it.
        for (const o of this.enemies.filter((m) => m.owner === g)) {
          this.enemies.splice(this.enemies.indexOf(o), 1);
          this.burst(o.x, o.y - 3, o.t.gore, 6, 25, 60);
        }
        g.hp = 0;
        return this.kill(g);
      }
      g.hp--;
      g.anger++; // angrier: faster, lays more eggs
      this.addGold(g.t.hitGold);
      const pts = Math.round(100 * this.mult);
      this.score += pts;
      this.floats.push({ x: g.x, y: g.y - fh - 4, text: '+' + pts, color: C.gold, life: 0.9, align: 'center' });
      this.floats.push({ x: g.x, y: g.y - fh + 3, text: g.hp === 1 ? 'LAST LIFE!' : 'HONK! -1 HP', color: C.red, life: 1.1, align: 'center' });
      if (g.hp === 1) g.finalCd = 2.5;
    },

    damageBase(dmg, e) {
      if (this.state !== 'play') return;
      this.hp = Math.max(0, this.hp - dmg);
      this.baseFlash = 0.12;
      this.shake = Math.max(this.shake, 3);
      this.burst((e.x + B.cx) / 2, (e.y + B.cy) / 2, ['#5d6b7d', '#7d8ca0', '#3f4a59'], 6, 35, 90);
      this.floats.push({ x: B.cx, y: B.drawY - 6, text: '-' + dmg, color: C.red, life: 0.8, align: 'center' });
      A.hit();
      if (this.hp <= 0) this.gameOver();
    },

    damageWall(dmg, e) {
      if (this.state !== 'play') return;
      const broke = this.wall.damage(dmg);
      this.burst(e.x, e.y - 4, ['#8a5a32', '#b07a45', '#5a3a22'], 5, 30, 90);
      A.wood();
      if (broke) {
        this.burst(TD.RING.cx, TD.RING.cy, ['#8a5a32', '#b07a45', '#5a3a22', '#c2a36b'], 40, 80, 90);
        this.floats.push({ x: B.cx, y: B.drawY - 14, text: 'WALL BROKEN!', color: C.red, life: 1.4, align: 'center' });
        this.shake = Math.max(this.shake, 4);
        A.kill();
      }
    },

    gameOver() {
      this.state = 'over';
      this.sel = 0;
      this.overAt = this.time;
      this.locked = null;
      this.lastRank = null; // null = still saving
      if (this.debugRun) this.lastRank = 0; // debug-panel runs never post scores
      else TD.Leaderboard.submit(this.playerName || 'PLAYER', this.score, this.waves.wave)
        .then((rank) => { this.lastRank = rank; })
        .catch(() => { this.lastRank = 0; });
      if (this.score > this.best && !this.debugRun) {
        this.best = this.score;
        this.newBest = true;
        store.set('td_best', String(this.best));
      }
      this.burst(B.cx, B.cy, ['#5d6b7d', '#7d8ca0', '#ef7d57', '#ffcd75'], 40, 70, 60);
      A.over();
    },

    burst(x, y, colors, n, speed, g) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = speed * rand(0.3, 1);
        this.particles.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - speed * 0.3,
          life: rand(0.3, 0.7), color: pick(colors), size: Math.random() < 0.3 ? 2 : 1, g,
        });
      }
    },

    // ---- update ----
    update(dt) {
      this.time += dt;
      A.setTrack(this.inGame && this.state !== 'over' ? 'battle' : 'menu');
      if (this.nameErrT > 0) this.nameErrT -= dt;
      for (const f of fireflies) {
        f.x += f.vx * dt; f.y += f.vy * dt;
        if (f.x < -OX) f.x += VW; if (f.x > W + OX) f.x -= VW;
        if (f.y < 16) f.vy = Math.abs(f.vy); if (f.y > H) f.vy = -Math.abs(f.vy);
      }
      if (this.frozen) return;
      this.updateFx(dt);
      if (this.state !== 'play') return;
      this.wall.update(dt);
      TD.Shop.update(dt);

      if (this.phase === 'banner') {
        this.banner -= dt;
        if (this.banner <= 0) this.phase = 'fight';
      } else if (this.phase === 'fight') {
        this.waves.update(dt, this);
        if (this.waves.done && this.enemies.length === 0) this.clearWave();
      } else if (this.phase === 'clear') {
        this.banner -= dt;
        if (this.banner <= 0) { this.phase = 'shop'; TD.Shop.open(this); }
      }

      for (const e of this.enemies.slice()) if (this.enemies.includes(e)) e.update(dt, this);
      if (this.state !== 'play') return;
      for (const t of this.throws) { t.t += dt; if (t.t >= t.dur) this.gooseHit(t.goose, t.final); }
      this.throws = this.throws.filter((t) => t.t < t.dur);
      this.layoutLabels(dt);

      // smoke when the tower is badly hurt
      if (this.hp / this.maxHp < 0.35 && Math.random() < dt * 6) {
        this.particles.push({ x: B.cx + rand(-8, 8), y: B.drawY + 4, vx: rand(-3, 3), vy: -12,
          life: 1.2, color: pick(['#333c57', '#566c86']), size: 2, g: 0 });
      }
    },

    updateFx(dt) {
      for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.life -= dt; }
      this.particles = this.particles.filter((p) => p.life > 0);
      for (const b of this.bolts) {
        b.t += dt;
        if (b.t >= b.dur) this.burst(b.x1, b.y1, [C.gold, C.white], 3, 30, 0);
      }
      this.bolts = this.bolts.filter((b) => b.t < b.dur);
      for (const f of this.floats) { f.y -= 12 * dt; f.life -= dt; }
      this.floats = this.floats.filter((f) => f.life > 0);
      this.shake = Math.max(0, this.shake - dt * 12);
      this.baseFlash = Math.max(0, this.baseFlash - dt);
      this.typoFlash = Math.max(0, this.typoFlash - dt);
    },

    // Place word plates under enemies and push overlapping plates apart vertically.
    layoutLabels(dt) {
      const xMin = -OX + 1, xMax = W + OX - 1;
      const Ls = this.enemies.filter((e) => !e.t.noLabel).map((e) => {
        const w = F.width(e.labelText()) + 4, h = 9;
        return { e, w, h, x: clamp(Math.round(e.x - w / 2), xMin, xMax - w), y: clamp(e.y + 2, 14, H - h - 1) };
      });
      Ls.sort((a, b) => a.y - b.y);
      for (let it = 0; it < 8; it++) {
        let moved = false;
        for (let i = 0; i < Ls.length; i++) {
          for (let j = i + 1; j < Ls.length; j++) {
            const a = Ls[i], b = Ls[j];
            if (a.x < b.x + b.w + 1 && b.x < a.x + a.w + 1 && a.y < b.y + b.h + 1 && b.y < a.y + a.h + 1) {
              const up = a.y <= b.y ? a : b, dn = up === a ? b : a;
              const ov = up.y + up.h + 1 - dn.y;
              up.y -= ov / 2; dn.y += ov / 2;
              moved = true;
            }
          }
        }
        for (const l of Ls) l.y = clamp(l.y, 14, H - l.h - 1);
        if (!moved) break;
      }
      const k = Math.min(1, dt * 14);
      for (const l of Ls) {
        const e = l.e;
        e.lx = l.x; e.lw = l.w;
        e.ly = e.ly == null ? l.y : e.ly + (l.y - e.ly) * k;
      }
    },

    // ---- render ----
    render() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#06121a';
      ctx.fillRect(0, 0, VW, H);

      // world (shakes)
      ctx.save();
      const shaking = this.shake > 0 && !this.frozen; // a paused game holds still
      const sx = shaking ? Math.round(rand(-this.shake, this.shake)) : 0;
      const sy = shaking ? Math.round(rand(-this.shake, this.shake)) : 0;
      ctx.translate(OX + sx, sy);
      ctx.drawImage(this.state === 'menu' && TD.Overlay ? bgMenu : bg, -OX, 0);
      this.drawFireflies();

      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      for (const e of this.enemies) { const f = e.frames[0]; ctx.fillRect(Math.round(e.x - f.w / 2) + 2, Math.round(e.y) - 1, f.w - 4, 2); }

      // the HTML main menu has its own tower in the logo, so the world one stays hidden there
      const items = this.state === 'menu' && TD.Overlay ? [] : [{ y: B.sortY, draw: () => this.drawCastle() }];
      for (const e of this.enemies) items.push({ y: e.y, draw: () => this.drawEnemy(e) });
      if (this.inGame) items.push(...this.wall.items(ctx));
      items.sort((a, b) => a.y - b.y).forEach((i) => i.draw());

      this.drawBolts();
      this.drawThrows();
      for (const p of this.particles) { ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size); }

      if (this.inGame) {
        if (this.state !== 'over') for (const e of this.enemies) if (e !== this.locked) this.drawLabel(e);
        if (this.locked) { this.drawReticle(this.locked); this.drawLabel(this.locked); }
      }
      for (const f of this.floats) F.draw(ctx, f.text, f.x, f.y, f.color, 1, f.align, C.ink);
      ctx.restore();

      // HUD pinned to the real screen corners
      if (this.inGame) this.drawHUD();
      if (this.typoFlash > 0 && this.state === 'play') {
        // wrong key: red frame round the screen, 2 px solid + 1 px soft edge, sides never overlap at the corners
        const a = Math.min(1, this.typoFlash * 4);
        const band = (inset, th, alpha) => {
          ctx.fillStyle = 'rgba(224,64,72,' + alpha.toFixed(2) + ')';
          ctx.fillRect(inset, inset, VW - inset * 2, th); ctx.fillRect(inset, H - inset - th, VW - inset * 2, th);
          ctx.fillRect(inset, inset + th, th, H - (inset + th) * 2); ctx.fillRect(VW - inset - th, inset + th, th, H - (inset + th) * 2);
        };
        band(0, 2, 0.85 * a); band(2, 1, 0.35 * a);
      }

      // overlays, laid out in play-area coords
      ctx.save();
      ctx.translate(OX, 0);
      if (this.state === 'play') {
        if (this.phase === 'shop') TD.Shop.draw(ctx, this);
        else if (this.phase === 'tips') this.drawTips();
        else this.drawBanner();
      }
      else if (this.state === 'menu') this.drawMenu();
      else if (this.state === 'name') this.drawName();
      else if (this.state === 'board') this.drawBoard();
      else if (this.state === 'paused') this.drawPause();
      else if (this.state === 'spam') this.drawSpam();
      else if (this.state === 'settings') this.drawSettings();
      else if (this.state === 'over') this.drawGameOver();
      ctx.restore();
    },

    dim(alpha) { ctx.fillStyle = 'rgba(0,0,0,' + alpha + ')'; ctx.fillRect(-OX, 0, VW, H); },

    drawFireflies() {
      for (const f of fireflies) {
        const b = Math.sin(this.time * 2 + f.p);
        if (b < 0.2) continue;
        const x = Math.round(f.x), y = Math.round(f.y);
        if (b > 0.75) { ctx.fillStyle = 'rgba(232,245,154,0.25)'; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
        ctx.fillStyle = '#e8f59a';
        ctx.fillRect(x, y, 1, 1);
      }
    },

    drawCastle() {
      const cs = S.castle;
      ctx.drawImage(this.baseFlash > 0 ? cs.white : cs.canvas, B.drawX, B.drawY);
      if (this.baseFlash > 0) return;
      const ox = B.drawX, oy = B.drawY;
      const fl = Math.sin(this.time * 7) + (Math.random() < 0.05 ? -1 : 0);
      ctx.fillStyle = fl > -0.3 ? C.gold : C.orange;
      ctx.fillRect(ox + 12, oy + 15, 3, 4);
      ctx.fillStyle = C.blood;
      if (Math.floor(this.time * 4) % 2) {
        ctx.fillRect(ox + 14, oy, 5, 1); ctx.fillRect(ox + 14, oy + 1, 6, 1); ctx.fillRect(ox + 14, oy + 2, 5, 1);
      } else {
        ctx.fillRect(ox + 14, oy, 6, 1); ctx.fillRect(ox + 14, oy + 1, 5, 1); ctx.fillRect(ox + 14, oy + 2, 6, 1);
      }
      const r = this.inGame ? this.hp / this.maxHp : 1;
      ctx.fillStyle = C.ink;
      if (r < 0.66) for (const [x, y] of [[6, 20], [7, 21], [7, 22], [8, 23], [8, 24]]) ctx.fillRect(ox + x, oy + y, 1, 1);
      if (r < 0.33) for (const [x, y] of [[19, 12], [18, 13], [18, 14], [19, 15], [20, 16], [16, 24], [17, 25]]) ctx.fillRect(ox + x, oy + y, 1, 1);
    },

    drawEnemy(e) {
      const fs = e.frames;
      let fi = e.state === 'walk' ? Math.floor(e.anim * e.t.animFps) % 2 : 0;
      let ox = 0, oy = e.hop > 0 ? -2 : 0;
      if (e.kind === 'rabbit') { fi = e.air ? 1 : 0; oy = -Math.round(e.lift); }
      if (e.kind === 'tortoise' && e.shell > 0) { fi = 2; ox = e.shell > 0.8 ? Math.round(Math.sin(e.shell * 60)) : 0; }
      if (e.kind === 'goose' && e.mode !== 'walk') fi = 2;
      if (e.kind === 'egg' || e.kind === 'gegg') {
        fi = 0;
        if (e.drop > 0) oy = -Math.round(e.drop * 120); // falling from the flying goose
        else if (e.kind === 'egg' && e.life < 2) { fi = 1; ox = Math.round(Math.sin(this.time * 30) * (e.life < 1 ? 1 : 0.6)); } // about to hatch: cracked, wobbling
      }
      const f = fs[fi], left = e.face < 0;
      const img = e.flash > 0 ? (left ? f.wl : f.wr) : left ? f.l : f.r;
      const x = Math.round(e.x - f.w / 2) + ox, y = Math.round(e.y - f.h) + oy;
      ctx.globalAlpha = Math.min(1, e.age / 0.35);
      if (e.kind === 'gegg') {
        // golden glow ring that pulses
        const on = Math.floor(this.time * 5) % 2, rx = 6 + on, ry = 2 + on;
        ctx.fillStyle = on ? C.gold : '#f9a31b';
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          ctx.fillRect(Math.round(e.x + Math.cos(a) * rx), Math.round(e.y - 1 + Math.sin(a) * ry), 1, 1);
        }
        if (Math.floor(this.time * 3 + e.id) % 3 === 0) { ctx.fillStyle = '#fff4a3'; ctx.fillRect(x + 4, y + 1, 1, 1); }
      }
      if (e.kind === 'chameleon' && e.camo) {
        // camouflaged: faded into the grass, a faint shimmer of leaves gives it away
        ctx.globalAlpha *= 0.55;
        ctx.fillStyle = '#5ac54f';
        for (let i = 0; i < 3; i++) {
          const a = this.time * 2 + i * 2.1 + e.id;
          if (Math.sin(a * 3) > 0.2) ctx.fillRect(Math.round(e.x + Math.cos(a) * 8), Math.round(e.y - 2 + Math.sin(a * 1.7) * 2), 1, 1);
        }
      }
      if (e.inkRule) {
        // ink-rule slime: pulsing gold ring on the ground around it
        const on = Math.floor(this.time * 4) % 2, rx = f.w / 2 + 3 + on, ry = 3 + on;
        ctx.fillStyle = C.gold;
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          ctx.fillRect(Math.round(e.x + Math.cos(a) * rx), Math.round(e.y - 1 + Math.sin(a) * ry), 1, 1);
        }
      }
      ctx.drawImage(img, x, y);
      ctx.globalAlpha = 1;
    },

    drawReticle(e) {
      if (Math.floor(this.time * 6) % 2) return;
      const f = e.frames[0];
      const x = Math.round(e.x - f.w / 2) - 2, y = Math.round(e.y - f.h) - 2, w = f.w + 4, h = f.h + 4;
      ctx.fillStyle = C.gold;
      for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w - 1, y, -1, 1], [x, y + h - 1, 1, -1], [x + w - 1, y + h - 1, -1, -1]]) {
        ctx.fillRect(cx, cy, 1, 1); ctx.fillRect(cx + dx, cy, 1, 1); ctx.fillRect(cx, cy + dy, 1, 1);
      }
    },

    drawLabel(e) {
      if (e.ly == null) return;
      const locked = e === this.locked;
      const sx = e.shake > 0 ? Math.round(Math.sin(e.shake * 80) * 2) : 0;
      const x = e.lx + sx, y = Math.round(e.ly), w = e.lw;
      ctx.globalAlpha = Math.min(1, e.age / 0.35);
      ctx.fillStyle = locked ? '#2e2414' : 'rgba(10,14,22,0.85)';
      ctx.fillRect(x, y, w, 9);
      if (locked) {
        ctx.fillStyle = C.gold;
        ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + 8, w, 1); ctx.fillRect(x, y, 1, 9); ctx.fillRect(x + w - 1, y, 1, 9);
      }
      const p = e.progress, ty = y + 2;
      let tx = x + 2;
      if (e.hidden) F.draw(ctx, '???', tx, ty, C.faint);
      else if (e.camo && p > 0) {
        // camouflaged but already started: your letters + blanks (type it blind)
        F.draw(ctx, e.word.slice(0, p), tx, ty, C.gold);
        F.draw(ctx, '_'.repeat(e.word.length - p), tx + F.advance(e.word.slice(0, p)), ty, locked && this.typoFlash > 0 ? C.red : C.dim);
      }
      else if (e.inkRule) {
        // eyedropper icon, then the decoy word in its ink; once you start typing, your letters + blanks
        if (!locked) { ctx.fillStyle = C.gold; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + 8, w, 1); ctx.fillRect(x + w - 1, y, 1, 9); }
        drawDropper(x + 2, y + 1, this.time); // drawn after the border so the drip hangs over its edge
        tx = x + 11;
        if (p > 0) {
          F.draw(ctx, e.word.slice(0, p), tx, ty, C.gold);
          F.draw(ctx, '_'.repeat(e.word.length - p), tx + F.advance(e.word.slice(0, p)), ty, locked && this.typoFlash > 0 ? C.red : C.dim);
        } else F.draw(ctx, e.shown, tx, ty, locked && this.typoFlash > 0 ? C.red : TD.inkHex(e.ink));
      } else {
        if (e.prefix) { F.draw(ctx, e.prefix, tx, ty, C.dim); tx += F.advance(e.prefix); }
        if (p > 0) F.draw(ctx, e.word.slice(0, p), tx, ty, C.gold);
        const restCol = locked && this.typoFlash > 0 ? C.red : e.ink ? TD.inkHex(e.ink) : C.white;
        // minion answers stay secret: one _ per digit still to type
        const rest = e.prefix ? '_'.repeat(e.word.length - p) : e.word.slice(p);
        F.draw(ctx, rest, tx + F.advance(e.word.slice(0, p)), ty, restCol);
      }
      // eggs: time left before it hatches (white) or the goose snatches it back (golden)
      if (e.life != null && !(e.drop > 0)) {
        const r = Math.max(0, e.life) / e.lifeMax;
        ctx.fillStyle = C.ink; ctx.fillRect(x, y + 9, w, 2);
        ctx.fillStyle = e.kind === 'gegg' ? C.gold : r < 0.34 ? C.red : C.white;
        ctx.fillRect(x, y + 9, Math.ceil(w * r), 2);
      }
      // boss: countdown until it summons again
      if (e.t.boss && !e.hidden && !e.charging) {
        ctx.fillStyle = C.ink; ctx.fillRect(x, y + 9, w, 2);
        ctx.fillStyle = C.red; ctx.fillRect(x, y + 9, Math.ceil(w * Math.max(0, e.cd) / e.t.summonEvery), 2);
      }
      ctx.globalAlpha = 1;
    },

    // golden eggs thrown from the tower at the goose (arc, homing on where it is now)
    drawThrows() {
      const img = S.gegg[0].r;
      for (const t of this.throws) {
        const p = Math.min(1, t.t / t.dur), g = t.goose;
        const x = t.x0 + (g.x - t.x0) * p, y = t.y0 + (g.y - 10 - t.y0) * p - Math.sin(p * Math.PI) * 26;
        ctx.drawImage(img, Math.round(x - 3), Math.round(y - 3));
      }
    },

    drawBolts() {
      for (const b of this.bolts) {
        const p = b.t / b.dur;
        const at = (q) => [Math.round(b.x0 + (b.x1 - b.x0) * q), Math.round(b.y0 + (b.y1 - b.y0) * q)];
        ctx.fillStyle = C.orange;
        for (const q of [p - 0.3, p - 0.15]) if (q > 0) { const [x, y] = at(q); ctx.fillRect(x, y, 1, 1); }
        const [x, y] = at(p);
        ctx.fillStyle = C.gold;
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    },

    // Screen coords (no OX shift): left block at the left edge, right block at the right edge.
    drawHUD() {
      const mid = Math.round(VW / 2);
      if (!TD.Overlay) { // without the HTML overlay (js/overlay.js) the HUD is drawn here
      F.draw(ctx, 'SCORE ' + this.score, 4, 3, C.white, 1, 'left', C.ink);
      F.draw(ctx, 'GOLD ' + this.gold, 4, 10, C.coin, 1, 'left', C.ink);
      if (this.combo > 0) {
        const m = this.mult;
        F.draw(ctx, 'COMBO ' + this.combo + (m > 1 ? ' X' + m : ''), 4, 17, C.gold, 1, 'left', C.ink);
      }
      if (this.wall.level > 0) {
        const ww = 70, wx = mid - 35, wy = 12, wr = this.wall.hp / this.wall.max;
        ctx.fillStyle = C.ink; ctx.fillRect(wx - 1, wy - 1, ww + 2, 5);
        ctx.fillStyle = '#333c57'; ctx.fillRect(wx, wy, ww, 3);
        ctx.fillStyle = '#b07a45'; ctx.fillRect(wx, wy, Math.ceil(ww * wr), 3);
      }
      F.draw(ctx, 'WAVE ' + this.waves.wave, VW - 4, 3, C.white, 1, 'right', C.ink);
      F.draw(ctx, 'LEFT ' + (this.waves.left + this.enemies.length), VW - 4, 10, C.dim, 1, 'right', C.ink);
      if (this.phase !== 'shop') {
        const active = [['frost', 'FROST', '#73eff7']].filter((b) => this.buffs[b[0]]);
        active.forEach(([, txt, col], i) => F.draw(ctx, txt, VW - 4, 17 + i * 7, col, 1, 'right', C.ink));
      }
      if (this.state !== 'over') F.draw(ctx, 'ESC: PAUSE', VW - 4, H - 8, C.faint, 1, 'right');

      const bw = 70, bx = mid - 35, by = 3, r = this.hp / this.maxHp;
      ctx.fillStyle = C.ink; ctx.fillRect(bx - 1, by - 1, bw + 2, 9);
      ctx.fillStyle = '#333c57'; ctx.fillRect(bx, by, bw, 7);
      ctx.fillStyle = r > 0.5 ? C.green : r > 0.25 ? C.orange : C.red;
      ctx.fillRect(bx, by, Math.ceil(bw * r), 7);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(bx, by, Math.ceil(bw * r), 1);
      F.draw(ctx, this.hp + '/' + this.maxHp, mid, by + 1, C.white, 1, 'center', C.ink);
      }
      // boss health bar, bottom centre
      const boss = this.enemies.find((e) => e.t.boss) || this.splitFrom;
      if (boss) {
        const segs = boss.t.maxHp, sw = 14, bw = segs * (sw + 1) - 1, bx = mid - Math.floor(bw / 2), by = H - 9;
        F.draw(ctx, boss.t.name, mid, by - 8, C.red, 1, 'center', C.ink);
        ctx.fillStyle = C.ink; ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
        for (let i = 0; i < segs; i++) {
          ctx.fillStyle = i < boss.hp ? (boss.hp === 1 ? C.red : '#b13e53') : '#333c57';
          ctx.fillRect(bx + i * (sw + 1), by, sw, 4);
          if (i < boss.hp) { ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(bx + i * (sw + 1), by, sw, 1); }
        }
      }

    },

    panel(x, y, w, h) {
      ctx.fillStyle = 'rgba(10,14,22,0.9)';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = C.gold;
      ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
    },

    // Settings row: label on the left, slider or ON/OFF pill on the right.
    drawRow(b, sel) {
      const r = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
      if (sel) {
        r(b.x, b.y, b.w, b.h, 'rgba(255,205,117,0.08)');
        r(b.x, b.y, 1, b.h, C.gold);
        F.draw(ctx, '>', b.x - 6 - (Math.floor(this.time * 4) % 2), b.y + 5, C.gold, 1, 'left', C.ink);
      }
      F.draw(ctx, b.label, b.x + 5, b.y + 5, sel ? C.gold : C.white, 1, 'left', C.ink);

      if (b.toggle) {
        const p = toggleParts(b);
        r(p.on.x - 1, p.on.y - 1, 42, 12, C.ink);
        for (const [box, txt, active] of [[p.on, 'ON', b.on], [p.off, 'OFF', !b.on]]) {
          r(box.x, box.y, box.w, box.h, active ? '#f4a640' : '#2a3148');
          r(box.x, box.y, box.w, 1, active ? '#ffcd75' : '#3d4b6b');
          r(box.x, box.y + box.h - 1, box.w, 1, active ? '#c86a1e' : '#1e2436');
          F.draw(ctx, txt, box.x + box.w / 2, box.y + 3, active ? C.ink : C.faint, 1, 'center');
        }
        return;
      }

      const p = sliderParts(b), lv = levelOf(b.id), bar = p.bar;
      r(bar.x - 1, bar.y - 1, bar.w + 2, bar.h + 2, C.ink);
      r(bar.x, bar.y, bar.w, bar.h, '#2a3148');
      for (let i = 0; i < SEG; i++) {
        const sx = bar.x + 1 + i * (SEG_W + SEG_GAP), sy = bar.y + 2;
        if (i < lv) { r(sx, sy, SEG_W, 6, '#f4a640'); r(sx, sy, SEG_W, 1, '#ffcd75'); r(sx, sy + 5, SEG_W, 1, '#c86a1e'); }
        else r(sx, sy + 2, SEG_W, 2, '#333c57');
      }
      for (const [box, sign] of [[p.minus, '-'], [p.plus, '+']]) {
        r(box.x - 1, box.y - 1, box.w + 2, box.h + 2, C.ink);
        r(box.x, box.y, box.w, box.h, '#f4a640');
        r(box.x, box.y, box.w, 1, '#ffcd75');
        r(box.x, box.y + box.h - 1, box.w, 1, '#c86a1e');
        F.draw(ctx, sign, box.x + 4, box.y + 3, C.ink, 1, 'left');
      }
      if (lv === 0) F.draw(ctx, 'OFF', p.minus.x - 4, b.y + 5, C.red, 1, 'right', C.ink);
    },

    drawButtons(list) {
      list.forEach((b, i) => {
        const sel = i === this.sel;
        if (b.slider || b.toggle) { this.drawRow(b, sel); return; }
        const ty = b.y + Math.floor((b.h - 10) / 2);
        ctx.fillStyle = C.ink;
        ctx.fillRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2);
        ctx.fillStyle = sel ? '#3b2a12' : '#16202e';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = sel ? C.gold : '#333c57';
        ctx.fillRect(b.x, b.y, b.w, 1); ctx.fillRect(b.x, b.y + b.h - 1, b.w, 1);
        ctx.fillRect(b.x, b.y, 1, b.h); ctx.fillRect(b.x + b.w - 1, b.y, 1, b.h);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(b.x + 1, b.y + 1, b.w - 2, 1);
        F.draw(ctx, b.label, b.x + b.w / 2, ty, sel ? C.gold : C.white, 2, 'center', C.ink);
        if (sel) {
          const bob = Math.floor(this.time * 4) % 2;
          F.draw(ctx, '>', b.x - 8 - bob, ty, C.gold, 2, 'left', C.ink);
          F.draw(ctx, '<', b.x + b.w + 3 + bob, ty, C.gold, 2, 'left', C.ink);
        }
      });
    },

    // tip card: title, then one block per new enemy (sprite at 2x + name + rules + example)
    drawTips() {
      const tip = TD.Tips[this.waves.wave];
      if (!tip) return;
      this.dim(0.55);
      if (TD.Overlay) return; // the card is HTML (js/overlay.js)
      const blocks = tip.enemies.map((en) => {
        const f = en.sprite();
        return { en, f, h: Math.max(f.h * 2, 9 + en.lines.length * 7) + 4 };
      });
      const h = 24 + blocks.reduce((a, b) => a + b.h, 0) + (tip.foot ? 9 : 0) + 12;
      const x = 14, w = W - 28, y = Math.max(2, Math.round((H - h) / 2));
      this.panel(x, y, w, h);
      F.draw(ctx, tip.title, W / 2, y + 5, this.waves.boss ? C.red : C.gold, 2, 'center', C.ink);
      let by = y + 22;
      for (const { en, f, h: bh } of blocks) {
        // sprite in a little box on the left
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(x + 6, by, 40, bh - 4);
        ctx.drawImage(f.r, x + 26 - f.w, by + Math.round((bh - 4 - f.h * 2) / 2), f.w * 2, f.h * 2);
        const tx = x + 52;
        let nx = tx;
        if (en.dropper) { drawDropper(nx, by, this.time); nx += 10; }
        F.draw(ctx, en.name, nx, by + 1, C.gold);
        if (en.tag) F.draw(ctx, en.tag, nx + F.advance(en.name) + 6, by + 1, C.red);
        en.lines.forEach((ln, i) => {
          let lx = tx;
          const parts = typeof ln === 'string' ? [[ln, C.dim]] : ln;
          for (const [t, col] of parts) { F.draw(ctx, t, lx, by + 10 + i * 7, col); lx += F.advance(t); }
        });
        by += bh;
      }
      if (tip.foot) { F.draw(ctx, tip.foot, W / 2, by, C.faint, 1, 'center'); by += 9; }
      if (Math.floor(this.time * 2) % 2 === 0) F.draw(ctx, 'PRESS ENTER TO START WAVE ' + this.waves.wave, W / 2, by + 1, C.white, 1, 'center');
    },

    drawBanner() {
      if (this.phase === 'fight' || TD.Overlay) return; // HTML royal-red banner (js/overlay.js)
      const w = Math.max(F.width(this.bannerText, 2), F.width(this.bannerSub)) + 16;
      this.panel(Math.round((W - w) / 2), 36, w, 28);
      F.draw(ctx, this.bannerText, W / 2, 41, C.gold, 2, 'center', C.ink);
      F.draw(ctx, this.bannerSub, W / 2, 55, C.dim, 1, 'center');
    },

    drawMenu() {
      if (TD.Overlay) { // logo, title, buttons and banners are HTML (js/overlay.js); the logo has its own tower
        this.dim(0.45);
        if (A.blocked && Math.floor(this.time * 2) % 2 === 0) F.draw(ctx, 'CLICK OR PRESS ANY KEY FOR SOUND', W / 2, 173, C.gold, 1, 'center', C.ink);
        return;
      }
      this.dim(0.35);
      // the castle stands out: warm torch glow behind it, drawn again on top of the dim
      const gx = B.cx, gy = B.drawY + 26;
      for (const [rx, ry, a] of [[46, 32, 0.05], [36, 25, 0.06], [26, 18, 0.08]]) {
        ctx.fillStyle = 'rgba(255,190,100,' + a + ')';
        for (let dy = -ry; dy <= ry; dy += 2) {
          const hw = Math.round(rx * Math.sqrt(1 - (dy / ry) * (dy / ry)));
          ctx.fillRect(gx - hw, gy + dy, hw * 2, 2);
        }
      }
      this.drawCastle();
      TD.Title.draw(ctx, W / 2, 14);
      F.draw(ctx, 'PROTECT THE TOWER', W / 2, 42, C.dim, 1, 'center', C.ink);
      this.drawButtons(buttons('main'));

      if (A.blocked) {
        if (Math.floor(this.time * 2) % 2 === 0) F.draw(ctx, 'CLICK OR PRESS ANY KEY FOR SOUND', W / 2, 168, C.gold, 1, 'center', C.ink);
      } else {
        F.draw(ctx, 'ARROWS + ENTER  /  CLICK', W / 2, 168, C.faint, 1, 'center');
      }
    },

    drawSpam() {
      this.dim(0.65);
      if (TD.Art) { // royal-red window with a ribbon title, same art as the HTML menus
        ctx.drawImage(TD.Art.get('panel', 185, 88), 68, 38);
        ctx.drawImage(TD.Art.get('ribbon', 140, 24), 90, 27);
        F.draw(ctx, 'NO SPAMMING!', W / 2, 31, '#fff4dc', 2, 'center', '#2a0a10');
        F.draw(ctx, 'KEYBOARD SMASH DETECTED', W / 2, 62, '#ff6a5a', 1, 'center', '#140508');
        F.draw(ctx, 'TYPE THE WORDS - DONT MASH KEYS', W / 2, 72, '#d9b98a', 1, 'center', '#140508');
        ctx.drawImage(TD.Art.get('plaque', 104, 13), 108, 84);
        F.draw(ctx, 'WAVE ' + this.waves.wave + ' STARTS OVER', W / 2, 88, '#ffcd4a', 1, 'center', '#140508');
        const ready = this.time - this.spamAt > 1.5;
        if (ready && Math.floor(this.time * 2) % 2 === 0) F.draw(ctx, 'PRESS ENTER TO TRY AGAIN', W / 2, 108, '#fff4dc', 1, 'center', '#140508');
        else if (!ready) F.draw(ctx, '...', W / 2, 108, '#a0806c', 1, 'center');
        return;
      }
      this.panel(70, 40, 180, 96);
      F.draw(ctx, 'NO SPAMMING!', W / 2, 50, C.red, 2, 'center', C.ink);
      F.draw(ctx, 'KEYBOARD SMASH DETECTED', W / 2, 72, C.white, 1, 'center');
      F.draw(ctx, 'TYPE THE WORDS - DONT MASH KEYS', W / 2, 82, C.dim, 1, 'center');
      F.draw(ctx, 'WAVE ' + this.waves.wave + ' STARTS OVER', W / 2, 98, C.gold, 1, 'center');
      const ready = this.time - this.spamAt > 1.5;
      if (ready && Math.floor(this.time * 2) % 2 === 0) F.draw(ctx, 'PRESS ENTER TO TRY AGAIN', W / 2, 118, C.white, 1, 'center');
      else if (!ready) F.draw(ctx, '...', W / 2, 118, C.faint, 1, 'center');
    },

    drawPause() {
      this.dim(0.55);
      if (TD.Overlay) return;
      this.panel(88, 38, 144, 104);
      F.draw(ctx, 'PAUSED', W / 2, 45, C.gold, 2, 'center', C.ink);
      this.drawButtons(buttons('pause'));
      F.draw(ctx, 'ESC TO RESUME', W / 2, 128, C.faint, 1, 'center');
    },

    drawSettings() {
      this.dim(this.settingsFrom === 'paused' ? 0.55 : 0.45);
      if (TD.Overlay) return;
      const list = buttons('settings');
      const last = list[list.length - 1];
      const top = 30, h = last.y + last.h + 18 - top;
      this.panel(66, top, 188, h);
      F.draw(ctx, 'SETTINGS', W / 2, top + 8, C.gold, 2, 'center', C.ink);
      this.drawButtons(list);
      F.draw(ctx, 'ARROWS: CHOOSE / CHANGE   ESC: BACK', W / 2, top + h - 10, C.faint, 1, 'center');
    },

    drawName() {
      this.dim(0.5);
      if (TD.Overlay) return; // drawn by js/overlay.js
      F.draw(ctx, 'WHO IS DEFENDING?', W / 2, 40, C.gold, 2, 'center', C.ink);
      this.panel(60, 62, 200, 62);
      F.draw(ctx, 'ENTER YOUR NAME', W / 2, 68, C.dim, 1, 'center');
      const bx = 80, by = 78, bw = 160, bh = 18;
      ctx.fillStyle = C.ink; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = C.gold;
      ctx.fillRect(bx, by, bw, 1); ctx.fillRect(bx, by + bh - 1, bw, 1); ctx.fillRect(bx, by, 1, bh); ctx.fillRect(bx + bw - 1, by, 1, bh);
      const cursor = this.playerName.length < NAME_MAX && Math.floor(this.time * 3) % 2 === 0 ? '_' : ' ';
      F.draw(ctx, this.playerName + cursor, W / 2, by + 4, C.white, 2, 'center');
      F.draw(ctx, this.playerName.length + '/' + NAME_MAX, bx + bw - 3, by + bh + 3, C.faint, 1, 'right');
      if (this.nameErrT > 0) F.draw(ctx, 'TYPE A NAME FIRST', W / 2, 108, C.red, 1, 'center');
      F.draw(ctx, 'ENTER TO START - ESC TO GO BACK', W / 2, 115, C.dim, 1, 'center');
    },

    drawBoard() {
      this.dim(0.55);
      if (TD.Overlay) return; // drawn by js/overlay.js
      this.panel(56, 14, 208, 152);
      F.draw(ctx, 'LEADERBOARD', W / 2, 20, C.gold, 2, 'center', C.ink);
      const cols = { rank: 70, name: 86, wave: 196, score: 250 };
      const hy = 38;
      F.draw(ctx, '#', cols.rank, hy, C.faint);
      F.draw(ctx, 'NAME', cols.name, hy, C.faint);
      F.draw(ctx, 'WAVE', cols.wave, hy, C.faint, 1, 'right');
      F.draw(ctx, 'SCORE', cols.score, hy, C.faint, 1, 'right');
      ctx.fillStyle = '#333c57'; ctx.fillRect(64, hy + 7, 192, 1);

      const LB = TD.Leaderboard, list = LB.list();
      if (!list.length) {
        const msg = LB.status === 'loading' ? 'LOADING...' : 'NO SCORES YET - GO PLAY!';
        F.draw(ctx, msg, W / 2, 90, C.dim, 1, 'center');
      }
      list.forEach((e, i) => {
        const y = 50 + i * 10;
        const mine = LB.isMine(e);
        if (mine) { ctx.fillStyle = '#3b2a12'; ctx.fillRect(64, y - 2, 192, 9); }
        const col = mine ? C.gold : i === 0 ? C.coin : C.white;
        F.draw(ctx, String(i + 1), cols.rank, y, col);
        F.draw(ctx, e.name, cols.name, y, col);
        F.draw(ctx, String(e.wave), cols.wave, y, col, 1, 'right');
        F.draw(ctx, String(e.score), cols.score, y, col, 1, 'right');
      });
      const st = LB.status === 'online' ? ['ONLINE - ALL PLAYERS', C.green]
        : LB.status === 'offline' ? ['OFFLINE - SHOWING THIS DEVICE ONLY', C.red]
        : ['LOADING...', C.faint];
      F.draw(ctx, st[0], W / 2, 150, st[1], 1, 'center');
      F.draw(ctx, 'ENTER / ESC / CLICK TO GO BACK', W / 2, 158, C.dim, 1, 'center');
    },

    drawGameOver() {
      this.dim(0.55);
      if (TD.Overlay) return;
      F.draw(ctx, 'GAME OVER', W / 2, 30, C.red, 3, 'center', C.ink);
      const acc = this.correct + this.typos ? Math.round((this.correct / (this.correct + this.typos)) * 100) : 0;
      this.panel(90, 58, 140, 72);
      const rows = [
        ['SCORE', this.score], ['WAVE', this.waves.wave], ['WORDS', this.kills], ['GOLD EARNED', this.goldEarned],
        ['ACCURACY', acc + '%'], ['BEST COMBO', this.bestCombo], ['BEST SCORE', this.best],
      ];
      rows.forEach(([k, v], i) => {
        F.draw(ctx, k, 100, 63 + i * 9, C.dim);
        F.draw(ctx, v, 220, 63 + i * 9, C.white, 1, 'right');
      });
      const LB = TD.Leaderboard;
      const note = this.lastRank === null ? 'SAVING SCORE...'
        : !this.lastRank ? 'NOT IN THE TOP 10 THIS TIME'
        : LB.improved ? 'RANK #' + this.lastRank + ' ON THE LEADERBOARD' + (this.newBest ? ' - NEW BEST!' : '')
        : 'YOUR BEST ' + LB.bestScore + ' STAYS AT RANK #' + this.lastRank;
      F.draw(ctx, note, W / 2, 135, this.lastRank ? C.gold : C.dim, 1, 'center', C.ink);
      if (this.time - this.overAt > 0.8) {
        if (Math.floor(this.time * 2) % 2 === 0) F.draw(ctx, 'ENTER: PLAY AGAIN', W / 2, 148, C.white, 2, 'center', C.ink);
        F.draw(ctx, 'ESC: MAIN MENU', W / 2, 164, C.dim, 1, 'center', C.ink);
      }
    },
  };

  TD.Input.attach(game);
  TD.game = game; // handy for debugging in the console

  // ---- loop ----
  let last = performance.now();
  function frame(now) {
    // rAF's first timestamp can be slightly earlier than `last`, so never allow a negative dt.
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    game.update(dt);
    game.render();
    if (TD.Overlay) TD.Overlay.sync(game);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
