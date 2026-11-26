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
  let VW = W, OX = 0, bg = null;
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
      bg = S.buildBackground(7, VW);
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
  const onOff = (b) => (b ? 'ON' : 'OFF');
  const MENUS = {
    main: { x: 100, y: 106, w: 120, h: 16, gap: 19, items: () => [
      { id: 'play', label: 'PLAY', key: 'p' },
      { id: 'board', label: 'LEADERBOARD', key: 'l' },
      { id: 'settings', label: 'SETTINGS', key: 's' },
    ] },
    pause: { x: 100, y: 66, w: 120, h: 16, gap: 20, items: () => [
      { id: 'resume', label: 'RESUME', key: 'r' },
      { id: 'settings', label: 'SETTINGS', key: 's' },
      { id: 'quit', label: 'MAIN MENU', key: 'm' },
    ] },
    settings: { x: 90, y: 58, w: 140, h: 16, gap: 20, items: () => [
      { id: 'sfx', label: 'SFX ' + onOff(A.sfxOn) },
      { id: 'music', label: 'MUSIC ' + onOff(A.musicOn) },
      ...(canFullscreen ? [{ id: 'fs', label: 'FULLSCREEN ' + onOff(!!document.fullscreenElement) }] : []),
      { id: 'back', label: 'BACK' },
    ] },
  };
  function buttons(name) {
    const m = MENUS[name];
    return m.items().map((it, i) => Object.assign(it, { x: m.x, y: m.y + i * m.gap, w: m.w, h: m.h }));
  }

  const NAME_MAX = 10;

  const game = {
    state: 'menu', // menu | name | board | settings | play | paused | over
    time: 0,
    sel: 0, settingsFrom: 'menu',
    playerName: '', nameErrT: 0, lastRank: 0,
    gold: 0, armorLv: 0, wall: new TD.Barricade(),
    best: parseInt(store.get('td_best', '0'), 10) || 0,
    enemies: [], particles: [], bolts: [], floats: [],
    hp: 20, maxHp: 20, score: 0, combo: 0, locked: null,
    shake: 0, baseFlash: 0, typoFlash: 0,
    phase: 'banner', banner: 0, bannerText: '', bannerSub: '',
    waves: new TD.WaveManager(),

    // A run is on screen (playing, paused, its settings, or its game-over screen).
    get inGame() {
      return this.state === 'play' || this.state === 'paused' || this.state === 'over' ||
        (this.state === 'settings' && this.settingsFrom === 'paused');
    },
    get frozen() { return this.state === 'paused' || (this.state === 'settings' && this.settingsFrom === 'paused'); },
    get menuName() {
      return this.state === 'menu' ? 'main' : this.state === 'paused' ? 'pause' : this.state === 'settings' ? 'settings' : null;
    },

    get mult() { return Math.min(3, 1 + Math.floor(this.combo / 10) * 0.25); },

    reset() {
      Object.assign(this, {
        enemies: [], particles: [], bolts: [], floats: [],
        hp: 20, maxHp: 20, score: 0, combo: 0, bestCombo: 0, kills: 0,
        correct: 0, typos: 0, waveTypos: 0, locked: null,
        shake: 0, baseFlash: 0, typoFlash: 0, newBest: false,
        gold: 0, goldEarned: 0, armorLv: 0, wall: new TD.Barricade(),
      });
      this.waves = new TD.WaveManager();
      this.state = 'play';
      this.startWave(1);
    },

    startWave(n) {
      this.waves.start(n);
      this.waveTypos = 0;
      this.phase = 'banner';
      this.banner = 2.2;
      this.bannerText = 'WAVE ' + n;
      this.bannerSub = n === 1 ? 'TYPE THE WORDS!' : 'GET READY';
      A.wave();
    },

    clearWave() {
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
        case 'quit': this.toMenu(); break;
        case 'sfx': A.setSfx(!A.sfxOn); break;
        case 'music': A.setMusic(!A.musicOn); break;
        case 'fs':
          if (document.fullscreenElement) document.exitFullscreen();
          else document.documentElement.requestFullscreen().catch(() => {});
          break;
        case 'back': this.closeSettings(); break;
      }
    },

    confirmName() {
      const n = this.playerName.trim();
      if (!n) { this.nameErrT = 1.2; A.typo(); return; }
      this.playerName = n;
      TD.Leaderboard.setName(n);
      this.reset();
    },

    spawnEnemy(kind, speedMul) {
      const list = TD.Words[TD.EnemyTypes[kind].list];
      // Prefer words whose first letter is not already on screen, so lock-on is never ambiguous.
      const usedFirst = new Set(this.enemies.map((e) => e.word[0]));
      const usedWord = new Set(this.enemies.map((e) => e.word));
      let pool = list.filter((w) => !usedFirst.has(w[0]));
      if (!pool.length) pool = list.filter((w) => !usedWord.has(w));
      if (!pool.length) pool = list;
      const p = edgePoint();
      const e = new TD.Enemy(kind, pick(pool), p.x, p.y, speedMul);
      this.enemies.push(e);
      this.burst(p.x, p.y - 4, ['#1a1c2c', '#333c57', '#566c86'], 8, 20, 0);
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
      let e = this.locked;
      if (!e) {
        const cands = this.enemies.filter((en) => en.word[0] === ch);
        if (!cands.length) return this.miss(null);
        cands.sort((a, b) => distToBase(a) - distToBase(b));
        e = this.locked = cands[0];
        A.lock();
      } else if (e.word[e.progress] !== ch) {
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
      const i = mn ? buttons(mn).findIndex((b) => inRect(x - OX, y, b)) : -1;
      const key = i >= 0 ? mn + ':' + i : null;
      if (key && key !== this.hoverKey) { this.sel = i; A.hover(); }
      this.hoverKey = key;
    },

    onClick(x, y) {
      A.unlock();
      const mn = this.menuName;
      if (mn) {
        const b = buttons(mn).find((it) => inRect(x - OX, y, it));
        if (b) this.activate(b.id);
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
      if (e.progress >= e.word.length) this.kill(e);
    },

    miss(e) {
      this.typos++;
      this.waveTypos++;
      if (this.combo >= 5) this.floats.push({ x: 4 - OX, y: 25, text: 'COMBO LOST', color: C.red, life: 1, align: 'left' });
      this.combo = 0;
      this.typoFlash = 0.2;
      this.shake = Math.max(this.shake, 1.5);
      if (e) e.shake = 0.25;
      A.typo();
    },

    kill(e) {
      this.enemies.splice(this.enemies.indexOf(e), 1);
      if (this.locked === e) this.locked = null;
      this.kills++;
      const pts = Math.round(e.word.length * 10 * this.mult);
      this.score += pts;
      const fh = e.frames[0].h;
      this.burst(e.x, e.y - fh / 2, e.t.gore, e.kind === 'tank' ? 26 : 14, e.kind === 'tank' ? 55 : 45, 80);
      this.floats.push({ x: e.x, y: e.y - fh - 4, text: '+' + pts, color: C.gold, life: 0.9, align: 'center' });
      this.addGold(e.t.gold);
      this.floats.push({ x: e.x, y: e.y - fh + 3, text: '+' + e.t.gold + 'G', color: C.coin, life: 0.9, align: 'center' });
      this.shake = Math.max(this.shake, e.kind === 'tank' ? 3 : 1.5);
      A.kill();
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
      this.overAt = this.time;
      this.locked = null;
      this.lastRank = null; // null = still saving
      TD.Leaderboard.submit(this.playerName || 'PLAYER', this.score, this.waves.wave)
        .then((rank) => { this.lastRank = rank; })
        .catch(() => { this.lastRank = 0; });
      if (this.score > this.best) {
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
        if (this.banner <= 0) { this.phase = 'shop'; TD.Shop.open(); }
      }

      for (const e of this.enemies) e.update(dt, this);
      if (this.state !== 'play') return;
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
      const Ls = this.enemies.map((e) => {
        const w = F.width(e.word) + 4, h = 9;
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
      const sx = this.shake > 0 ? Math.round(rand(-this.shake, this.shake)) : 0;
      const sy = this.shake > 0 ? Math.round(rand(-this.shake, this.shake)) : 0;
      ctx.translate(OX + sx, sy);
      ctx.drawImage(bg, -OX, 0);
      this.drawFireflies();

      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      for (const e of this.enemies) { const f = e.frames[0]; ctx.fillRect(Math.round(e.x - f.w / 2) + 2, Math.round(e.y) - 1, f.w - 4, 2); }

      const items = [{ y: B.sortY, draw: () => this.drawCastle() }];
      for (const e of this.enemies) items.push({ y: e.y, draw: () => this.drawEnemy(e) });
      if (this.inGame) items.push(...this.wall.items(ctx));
      items.sort((a, b) => a.y - b.y).forEach((i) => i.draw());

      this.drawBolts();
      for (const p of this.particles) { ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size); }

      if (this.inGame) {
        for (const e of this.enemies) if (e !== this.locked) this.drawLabel(e);
        if (this.locked) { this.drawReticle(this.locked); this.drawLabel(this.locked); }
      }
      for (const f of this.floats) F.draw(ctx, f.text, f.x, f.y, f.color, 1, f.align, C.ink);
      ctx.restore();

      // HUD pinned to the real screen corners
      if (this.inGame) this.drawHUD();
      if (this.typoFlash > 0) {
        ctx.fillStyle = 'rgba(239,125,87,' + (this.typoFlash * 3).toFixed(2) + ')';
        ctx.fillRect(0, 0, VW, 2); ctx.fillRect(0, H - 2, VW, 2); ctx.fillRect(0, 0, 2, H); ctx.fillRect(VW - 2, 0, 2, H);
      }

      // overlays, laid out in play-area coords
      ctx.save();
      ctx.translate(OX, 0);
      if (this.state === 'play') { if (this.phase === 'shop') TD.Shop.draw(ctx, this); else this.drawBanner(); }
      else if (this.state === 'menu') this.drawMenu();
      else if (this.state === 'name') this.drawName();
      else if (this.state === 'board') this.drawBoard();
      else if (this.state === 'paused') this.drawPause();
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
      const fi = e.state === 'walk' ? Math.floor(e.anim * e.t.animFps) % fs.length : 0;
      const f = fs[fi], left = e.face < 0;
      const img = e.flash > 0 ? (left ? f.wl : f.wr) : left ? f.l : f.r;
      const x = Math.round(e.x - f.w / 2), y = Math.round(e.y - f.h) + (e.hop > 0 ? -2 : 0);
      ctx.globalAlpha = Math.min(1, e.age / 0.35);
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
      const p = e.progress, tx = x + 2, ty = y + 2;
      if (p > 0) F.draw(ctx, e.word.slice(0, p), tx, ty, C.gold);
      const restCol = locked && this.typoFlash > 0 ? C.red : C.white;
      F.draw(ctx, e.word.slice(p), tx + p * 4, ty, restCol);
      ctx.globalAlpha = 1;
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
      F.draw(ctx, 'SCORE ' + this.score, 4, 3, C.white, 1, 'left', C.ink);
      F.draw(ctx, 'GOLD ' + this.gold, 4, 10, C.coin, 1, 'left', C.ink);
      if (this.combo > 0) {
        const m = this.mult;
        F.draw(ctx, 'COMBO ' + this.combo + (m > 1 ? ' X' + m : ''), 4, 17, C.gold, 1, 'left', C.ink);
      }
      const mid = Math.round(VW / 2);
      if (this.wall.level > 0) {
        const ww = 70, wx = mid - 35, wy = 12, wr = this.wall.hp / this.wall.max;
        ctx.fillStyle = C.ink; ctx.fillRect(wx - 1, wy - 1, ww + 2, 5);
        ctx.fillStyle = '#333c57'; ctx.fillRect(wx, wy, ww, 3);
        ctx.fillStyle = '#b07a45'; ctx.fillRect(wx, wy, Math.ceil(ww * wr), 3);
      }
      F.draw(ctx, 'WAVE ' + this.waves.wave, VW - 4, 3, C.white, 1, 'right', C.ink);
      F.draw(ctx, 'LEFT ' + (this.waves.left + this.enemies.length), VW - 4, 10, C.dim, 1, 'right', C.ink);
      F.draw(ctx, 'ESC: PAUSE', VW - 4, H - 8, C.faint, 1, 'right');

      const bw = 70, bx = mid - 35, by = 3, r = this.hp / this.maxHp;
      ctx.fillStyle = C.ink; ctx.fillRect(bx - 1, by - 1, bw + 2, 9);
      ctx.fillStyle = '#333c57'; ctx.fillRect(bx, by, bw, 7);
      ctx.fillStyle = r > 0.5 ? C.green : r > 0.25 ? C.orange : C.red;
      ctx.fillRect(bx, by, Math.ceil(bw * r), 7);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(bx, by, Math.ceil(bw * r), 1);
      F.draw(ctx, this.hp + '/' + this.maxHp, mid, by + 1, C.white, 1, 'center', C.ink);
    },

    panel(x, y, w, h) {
      ctx.fillStyle = 'rgba(10,14,22,0.9)';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = C.gold;
      ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
    },

    drawButtons(list) {
      list.forEach((b, i) => {
        const sel = i === this.sel;
        ctx.fillStyle = C.ink;
        ctx.fillRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2);
        ctx.fillStyle = sel ? '#3b2a12' : '#16202e';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = sel ? C.gold : '#333c57';
        ctx.fillRect(b.x, b.y, b.w, 1); ctx.fillRect(b.x, b.y + b.h - 1, b.w, 1);
        ctx.fillRect(b.x, b.y, 1, b.h); ctx.fillRect(b.x + b.w - 1, b.y, 1, b.h);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(b.x + 1, b.y + 1, b.w - 2, 1);
        F.draw(ctx, b.label, b.x + b.w / 2, b.y + 3, sel ? C.gold : C.white, 2, 'center', C.ink);
        if (sel) {
          const bob = Math.floor(this.time * 4) % 2;
          F.draw(ctx, '>', b.x - 8 - bob, b.y + 3, C.gold, 2, 'left', C.ink);
          F.draw(ctx, '<', b.x + b.w + 3 + bob, b.y + 3, C.gold, 2, 'left', C.ink);
        }
      });
    },

    drawBanner() {
      if (this.phase === 'fight') return;
      const w = Math.max(F.width(this.bannerText, 2), F.width(this.bannerSub)) + 16;
      this.panel(Math.round((W - w) / 2), 36, w, 28);
      F.draw(ctx, this.bannerText, W / 2, 41, C.gold, 2, 'center', C.ink);
      F.draw(ctx, this.bannerSub, W / 2, 55, C.dim, 1, 'center');
    },

    drawMenu() {
      this.dim(0.35);
      TD.Title.draw(ctx, W / 2, 14);
      F.draw(ctx, 'PROTECT THE TOWER', W / 2, 42, C.dim, 1, 'center', C.ink);
      this.drawButtons(buttons('main'));

      if (A.blocked) {
        if (Math.floor(this.time * 2) % 2 === 0) F.draw(ctx, 'CLICK OR PRESS ANY KEY FOR SOUND', W / 2, 166, C.gold, 1, 'center', C.ink);
      } else {
        F.draw(ctx, 'ARROWS + ENTER  /  CLICK  /  P L S', W / 2, 166, C.faint, 1, 'center');
      }
      const top = TD.Leaderboard.top();
      if (top) F.draw(ctx, 'TOP: ' + top.name + '  ' + top.score, W / 2, 174, C.dim, 1, 'center', C.ink);
    },

    drawPause() {
      this.dim(0.55);
      this.panel(88, 38, 144, 104);
      F.draw(ctx, 'PAUSED', W / 2, 45, C.gold, 2, 'center', C.ink);
      this.drawButtons(buttons('pause'));
      F.draw(ctx, 'ESC TO RESUME', W / 2, 128, C.faint, 1, 'center');
    },

    drawSettings() {
      this.dim(this.settingsFrom === 'paused' ? 0.55 : 0.45);
      const list = buttons('settings');
      const h = 40 + list.length * 20;
      this.panel(78, 30, 164, h);
      F.draw(ctx, 'SETTINGS', W / 2, 37, C.gold, 2, 'center', C.ink);
      this.drawButtons(list);
      F.draw(ctx, 'ENTER TOGGLES - ESC GOES BACK', W / 2, 30 + h - 10, C.faint, 1, 'center');
    },

    drawName() {
      this.dim(0.5);
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
      F.draw(ctx, 'ENTER, ESC OR CLICK TO GO BACK', W / 2, 158, C.dim, 1, 'center');
    },

    drawGameOver() {
      this.dim(0.55);
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
      const note = this.lastRank === null ? 'SAVING SCORE...'
        : this.lastRank ? 'RANK #' + this.lastRank + ' ON THE LEADERBOARD' + (this.newBest ? ' - NEW BEST!' : '')
        : 'NOT IN THE TOP 10 THIS TIME';
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
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
