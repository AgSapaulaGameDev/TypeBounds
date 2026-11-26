// Game state, update and render.
(function () {
  'use strict';
  const TD = window.TD;
  const W = 320, H = 180;
  const F = TD.Font, S = TD.Sprites, B = TD.BASE, A = TD.Audio;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // ---- integer pixel scaling ----
  const bar = document.getElementById('bar');
  function fit() {
    const availH = window.innerHeight - (bar ? bar.offsetHeight : 0) - 16;
    const s = Math.min((window.innerWidth - 8) / W, availH / H);
    const k = s >= 1 ? Math.floor(s) : s;
    canvas.style.width = W * k + 'px';
    canvas.style.height = H * k + 'px';
  }
  window.addEventListener('resize', fit);
  fit();

  const C = {
    white: '#f4f4f4', gold: '#ffcd75', orange: '#f4a640', red: '#ef7d57', blood: '#b13e53',
    dim: '#94b0c2', ink: '#1a1c2c', green: '#38b764', lime: '#a7f070',
  };

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const distToBase = (e) => Math.hypot(e.x - B.cx, e.y - B.cy);

  // ---- loading ----
  let bg = null;
  const LOAD_STEPS = [
    { label: 'DRAWING THE FOREST', run: () => { bg = S.buildBackground(7); } },
    { label: 'CARVING LETTERS', run: () => F.prewarm(['#f4f4f4', '#ffcd75', '#94b0c2', '#ef7d57', '#1a1c2c', '#e8d27a', '#a7f070']) },
    { label: 'WAKING THE MONSTERS', run: () => {} },
    { label: 'RAISING THE TOWER', run: () => {} },
  ];
  const LOAD_MIN = 1.8; // seconds; keeps the bar visible even though building is fast
  const TIPS = [
    'A TYPO NEVER HURTS A MONSTER',
    'BACKSPACE OR ESC DROPS YOUR TARGET',
    'EVERY 10 COMBO RAISES YOUR MULTIPLIER',
    'A WAVE WITH NO TYPOS GIVES BONUS GOLD',
    'A BARRICADE MAKES MONSTERS STOP AND CHEW',
  ];
  const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
  const fireflies = Array.from({ length: 14 }, () => ({
    x: rand(10, 310), y: rand(20, 170), p: rand(0, 6.28), vx: rand(-4, 4), vy: rand(-3, 3),
  }));

  // Spawn point on the screen edge, along a random ray from the base.
  function edgePoint() {
    const a = Math.random() * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
    const x0 = 10, x1 = W - 10, y0 = 28, y1 = H - 14;
    let t = Infinity;
    if (dx > 0) t = Math.min(t, (x1 - B.cx) / dx); else if (dx < 0) t = Math.min(t, (x0 - B.cx) / dx);
    if (dy > 0) t = Math.min(t, (y1 - B.cy) / dy); else if (dy < 0) t = Math.min(t, (y0 - B.cy) / dy);
    return { x: B.cx + dx * t, y: B.cy + dy * t };
  }

  const game = {
    state: 'loading', // loading | title | play | paused | over
    time: 0, loadT: 0, loadStep: 0, loadReady: false,
    gold: 0, armorLv: 0, wall: new TD.Barricade(),
    best: parseInt(store.get('td_best', '0'), 10) || 0,
    enemies: [], particles: [], bolts: [], floats: [],
    hp: 20, maxHp: 20, score: 0, combo: 0, locked: null,
    shake: 0, baseFlash: 0, typoFlash: 0,
    phase: 'banner', banner: 0, bannerText: '', bannerSub: '',
    waves: new TD.WaveManager(),

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

    leaveLoading() { if (this.loadReady) this.state = 'title'; },

    updateLoading(dt) {
      this.loadT += dt;
      const target = Math.floor((this.loadT / LOAD_MIN) * LOAD_STEPS.length);
      while (this.loadStep < LOAD_STEPS.length && this.loadStep <= target) LOAD_STEPS[this.loadStep++].run();
      if (this.loadStep >= LOAD_STEPS.length && this.loadT >= LOAD_MIN) this.loadReady = true;
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
      if (this.state === 'loading') return this.leaveLoading();
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
      if (this.state === 'loading') return this.leaveLoading();
      if (this.state === 'play' && this.phase === 'shop') {
        if (key === 'Backspace') TD.Shop.back(); else TD.Shop.clear();
        return;
      }
      if (this.state !== 'play' || !this.locked) return;
      this.locked.progress = 0;
      this.locked = null;
      A.cancel();
    },

    onEnter() {
      if (this.state === 'loading') this.leaveLoading();
      else if (this.state === 'play' && this.phase === 'shop') TD.Shop.startNext(this);
      else if (this.state === 'title') this.reset();
      else if (this.state === 'over' && this.time - this.overAt > 0.8) this.reset();
      else if (this.state === 'paused') this.state = 'play';
    },

    onBlur() { if (this.state === 'play') this.state = 'paused'; },

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
      if (this.combo >= 5) this.floats.push({ x: 4, y: 25, text: 'COMBO LOST', color: C.red, life: 1, align: 'left' });
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
      this.floats.push({ x: e.x, y: e.y - fh + 3, text: '+' + e.t.gold + 'G', color: '#e8d27a', life: 0.9, align: 'center' });
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
      for (const f of fireflies) {
        f.x += f.vx * dt; f.y += f.vy * dt;
        if (f.x < 0) f.x += W; if (f.x > W) f.x -= W;
        if (f.y < 16) f.vy = Math.abs(f.vy); if (f.y > H) f.vy = -Math.abs(f.vy);
      }
      if (this.state === 'loading') return this.updateLoading(dt);
      if (this.state === 'paused') return;
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
      const Ls = this.enemies.map((e) => {
        const w = F.width(e.word) + 4, h = 9;
        return { e, w, h, x: clamp(Math.round(e.x - w / 2), 1, W - w - 1), y: clamp(e.y + 2, 14, H - h - 1) };
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
      ctx.fillStyle = '#06121a';
      ctx.fillRect(0, 0, W, H);
      if (this.state === 'loading' || !bg) return this.drawLoading();
      ctx.save();
      if (this.shake > 0) ctx.translate(Math.round(rand(-this.shake, this.shake)), Math.round(rand(-this.shake, this.shake)));
      ctx.drawImage(bg, 0, 0);
      this.drawFireflies();

      // shadows
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      for (const e of this.enemies) { const f = e.frames[0]; ctx.fillRect(Math.round(e.x - f.w / 2) + 2, Math.round(e.y) - 1, f.w - 4, 2); }

      // depth-sorted sprites
      const items = [{ y: B.sortY, draw: () => this.drawCastle() }];
      for (const e of this.enemies) items.push({ y: e.y, draw: () => this.drawEnemy(e) });
      if (this.state !== 'title') items.push(...this.wall.items(ctx));
      items.sort((a, b) => a.y - b.y).forEach((i) => i.draw());

      this.drawBolts();
      for (const p of this.particles) { ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size); }

      if (this.state !== 'title') {
        for (const e of this.enemies) if (e !== this.locked) this.drawLabel(e);
        if (this.locked) { this.drawReticle(this.locked); this.drawLabel(this.locked); }
      }
      for (const f of this.floats) F.draw(ctx, f.text, f.x, f.y, f.color, 1, f.align, C.ink);
      ctx.restore();

      if (this.state !== 'title') this.drawHUD();
      if (this.typoFlash > 0) {
        ctx.fillStyle = 'rgba(239,125,87,' + (this.typoFlash * 3).toFixed(2) + ')';
        ctx.fillRect(0, 0, W, 2); ctx.fillRect(0, H - 2, W, 2); ctx.fillRect(0, 0, 2, H); ctx.fillRect(W - 2, 0, 2, H);
      }
      if (this.state === 'play') { if (this.phase === 'shop') TD.Shop.draw(ctx, this); else this.drawBanner(); }
      else if (this.state === 'title') this.drawTitle();
      else if (this.state === 'paused') this.drawPaused();
      else if (this.state === 'over') this.drawGameOver();
    },

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
      // window glow
      const fl = Math.sin(this.time * 7) + (Math.random() < 0.05 ? -1 : 0);
      ctx.fillStyle = fl > -0.3 ? C.gold : C.orange;
      ctx.fillRect(ox + 12, oy + 15, 3, 4);
      // flag
      ctx.fillStyle = C.blood;
      if (Math.floor(this.time * 4) % 2) {
        ctx.fillRect(ox + 14, oy, 5, 1); ctx.fillRect(ox + 14, oy + 1, 6, 1); ctx.fillRect(ox + 14, oy + 2, 5, 1);
      } else {
        ctx.fillRect(ox + 14, oy, 6, 1); ctx.fillRect(ox + 14, oy + 1, 5, 1); ctx.fillRect(ox + 14, oy + 2, 6, 1);
      }
      // cracks as HP drops
      const r = this.hp / this.maxHp;
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

    drawHUD() {
      F.draw(ctx, 'SCORE ' + this.score, 4, 3, C.white, 1, 'left', C.ink);
      F.draw(ctx, 'GOLD ' + this.gold, 4, 10, '#e8d27a', 1, 'left', C.ink);
      if (this.combo > 0) {
        const m = this.mult;
        F.draw(ctx, 'COMBO ' + this.combo + (m > 1 ? ' X' + m : ''), 4, 17, C.gold, 1, 'left', C.ink);
      }
      if (this.wall.level > 0) {
        const ww = 70, wx = (W - ww) / 2, wy = 12, wr = this.wall.hp / this.wall.max;
        ctx.fillStyle = C.ink; ctx.fillRect(wx - 1, wy - 1, ww + 2, 5);
        ctx.fillStyle = '#333c57'; ctx.fillRect(wx, wy, ww, 3);
        ctx.fillStyle = '#b07a45'; ctx.fillRect(wx, wy, Math.ceil(ww * wr), 3);
      }
      F.draw(ctx, 'WAVE ' + this.waves.wave, W - 4, 3, C.white, 1, 'right', C.ink);
      F.draw(ctx, 'LEFT ' + (this.waves.left + this.enemies.length), W - 4, 10, C.dim, 1, 'right', C.ink);

      const bw = 70, bx = (W - bw) / 2, by = 3, r = this.hp / this.maxHp;
      ctx.fillStyle = C.ink; ctx.fillRect(bx - 1, by - 1, bw + 2, 9);
      ctx.fillStyle = '#333c57'; ctx.fillRect(bx, by, bw, 7);
      ctx.fillStyle = r > 0.5 ? C.green : r > 0.25 ? C.orange : C.red;
      ctx.fillRect(bx, by, Math.ceil(bw * r), 7);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(bx, by, Math.ceil(bw * r), 1);
      F.draw(ctx, this.hp + '/' + this.maxHp, W / 2, by + 1, C.white, 1, 'center', C.ink);
    },

    panel(x, y, w, h) {
      ctx.fillStyle = 'rgba(10,14,22,0.88)';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = C.gold;
      ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
    },

    drawBanner() {
      if (this.phase === 'fight') return;
      const w = Math.max(F.width(this.bannerText, 2), F.width(this.bannerSub)) + 16;
      this.panel(Math.round((W - w) / 2), 36, w, 28);
      F.draw(ctx, this.bannerText, W / 2, 41, C.gold, 2, 'center', C.ink);
      F.draw(ctx, this.bannerSub, W / 2, 55, C.dim, 1, 'center');
    },

    drawTitle() {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, 0, W, H);
      F.draw(ctx, 'TYPING DEFENSE', W / 2, 22, C.gold, 3, 'center', C.ink);
      F.draw(ctx, 'PROTECT THE TOWER', W / 2, 44, C.dim, 1, 'center', C.ink);
      this.panel(60, 112, 200, 32);
      F.draw(ctx, 'TYPE A WORD TO ATTACK ITS MONSTER', W / 2, 117, C.white, 1, 'center');
      F.draw(ctx, 'A TYPO BREAKS YOUR COMBO', W / 2, 125, C.white, 1, 'center');
      F.draw(ctx, 'BACKSPACE OR ESC DROPS YOUR TARGET', W / 2, 133, C.white, 1, 'center');
      if (Math.floor(this.time * 2) % 2 === 0) F.draw(ctx, 'PRESS ENTER TO START', W / 2, 152, C.gold, 2, 'center', C.ink);
      if (this.best > 0) F.draw(ctx, 'BEST ' + this.best, W / 2, 170, C.dim, 1, 'center', C.ink);
    },

    drawLoading() {
      const p = Math.min(1, this.loadT / LOAD_MIN);
      // castle at 2x
      const cs = S.castle;
      ctx.drawImage(cs.canvas, W / 2 - cs.w, 40, cs.w * 2, cs.h * 2);
      ctx.fillStyle = Math.sin(this.time * 7) > -0.3 ? C.gold : C.orange;
      ctx.fillRect(W / 2 - cs.w + 24, 70, 6, 8);
      F.draw(ctx, 'TYPING DEFENSE', W / 2, 18, C.gold, 2, 'center', C.ink);

      const bw = 140, bx = (W - bw) / 2, by = 128;
      ctx.fillStyle = C.ink; ctx.fillRect(bx - 2, by - 2, bw + 4, 10);
      ctx.fillStyle = '#333c57'; ctx.fillRect(bx, by, bw, 6);
      // chunky segmented fill
      const segs = Math.floor((bw / 5) * p);
      ctx.fillStyle = C.gold;
      for (let i = 0; i < segs; i++) ctx.fillRect(bx + i * 5, by, 4, 6);

      if (this.loadReady) {
        if (Math.floor(this.time * 2) % 2 === 0) F.draw(ctx, 'PRESS ANY KEY', W / 2, 142, C.white, 1, 'center', C.ink);
      } else {
        const step = LOAD_STEPS[Math.min(LOAD_STEPS.length - 1, Math.floor(p * LOAD_STEPS.length))];
        const dots = '...'.slice(0, 1 + (Math.floor(this.time * 3) % 3));
        F.draw(ctx, step.label + dots, bx, 142, C.dim, 1, 'left', C.ink);
        F.draw(ctx, Math.floor(p * 100) + '%', bx + bw, 142, C.dim, 1, 'right', C.ink);
      }
      F.draw(ctx, 'TIP: ' + tip, W / 2, 164, '#566c86', 1, 'center');
    },

    drawPaused() {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, W, H);
      F.draw(ctx, 'PAUSED', W / 2, 70, C.gold, 3, 'center', C.ink);
      F.draw(ctx, 'PRESS ENTER TO RESUME', W / 2, 96, C.white, 1, 'center', C.ink);
    },

    drawGameOver() {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, W, H);
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
      if (this.newBest) F.draw(ctx, 'NEW BEST!', W / 2, 135, C.gold, 1, 'center', C.ink);
      if (this.time - this.overAt > 0.8 && Math.floor(this.time * 2) % 2 === 0)
        F.draw(ctx, 'PRESS ENTER TO RETRY', W / 2, 150, C.white, 2, 'center', C.ink);
    },
  };

  TD.Input.attach(game);
  TD.game = game; // handy for debugging in the console

  // ---- sound toggle ----
  const muteBtn = document.getElementById('mute');
  const muteLabel = () => { muteBtn.textContent = A.muted ? 'SOUND: OFF' : 'SOUND: ON'; };
  muteBtn.addEventListener('click', () => { A.unlock(); A.toggle(); muteLabel(); muteBtn.blur(); });
  muteLabel();

  // ---- loop ----
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.update(dt);
    game.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
