// Between-wave shop: 3 random upgrade cards spin like a slot machine, then stop one by one.
// You buy a card by TYPING its word. "reroll" spins new cards for gold. Enter or "fight" starts
// the next wave.
(function () {
  const TD = (window.TD = window.TD || {});
  const F = TD.Font, A = TD.Audio;
  const COL = { gold: '#ffcd75', coin: '#e8d27a', white: '#f4f4f4', dim: '#94b0c2', faint: '#566c86', red: '#ef7d57', green: '#a7f070', ink: '#1a1c2c', cyan: '#73eff7' };
  const ARMOR_MAX = 8;

  // ---- 12x12 icons drawn from strings ----
  const PAL = {
    o: '#1a1c2c', s: '#94b0c2', h: '#f4f4f4', b: '#3b5dc9', w: '#b07a45', d: '#6e4a2a',
    y: '#ffcd75', g: '#f4a640', c: '#73eff7', r: '#ef7d57', k: '#b13e53', l: '#a7f070',
  };
  const ICONS = {
    armor: ['..oooooooo..', '.ohhhhhhsso.', '.ohssbbbsso.', '.ohsbbbbbso.', '.ohsbbbbbso.', '.ohsbbbbbso.',
      '.ohssbbbsso.', '..ohsssssoo.', '..ohsssso...', '...ohssso...', '....ohso....', '.....oo.....'],
    repair: ['..oooooo....', '.ohhssssso..', '.ohsssssso..', '..ooooooo...', '....owo.....', '....owo.....',
      '....owo.....', '....odo.....', '....owo.....', '....owo.....', '....odo.....', '.....o......'],
    barricade: ['..o...o...o.', '.owo.owo.owo', '.owo.owo.owo', 'oooooooooooo', 'oddddddddddo', 'oooooooooooo',
      '.owo.owo.owo', '.owo.owo.owo', '.owo.owo.owo', 'oooooooooooo', 'oddddddddddo', 'oooooooooooo'],
    frost: ['.....cc.....', '...c.cc.c...', '....cccc....', '.c...cc...c.', '..c..cc..c..', 'ccccchhccccc',
      'ccccchhccccc', '..c..cc..c..', '.c...cc...c.', '....cccc....', '...c.cc.c...', '.....cc.....'],
  };
  const iconCache = {};
  function icon(name) {
    if (iconCache[name]) return iconCache[name];
    const c = document.createElement('canvas');
    c.width = 12; c.height = 12;
    const x = c.getContext('2d');
    ICONS[name].forEach((row, ry) => {
      for (let rx = 0; rx < 12; rx++) {
        const col = PAL[row[rx]];
        if (col) { x.fillStyle = col; x.fillRect(rx, ry, 1, 1); }
      }
    });
    return (iconCache[name] = c);
  }

  // ---- item pool. avail = can it be offered right now; ok = can it be bought right now ----
  const ITEMS = [
    {
      word: 'armor',
      info: (g) => ['+5 MAX HP', 'LEVEL ' + g.armorLv + '/' + ARMOR_MAX],
      cost: (g) => 30 + 20 * g.armorLv,
      avail: (g) => g.armorLv < ARMOR_MAX,
      buy: (g) => { g.armorLv++; g.maxHp += 5; g.hp += 5; },
    },
    {
      word: 'repair',
      info: () => ['+10 HP', 'FIX THE WALL'],
      cost: () => 20,
      avail: (g) => g.hp < g.maxHp || (g.wall.level > 0 && g.wall.hp < g.wall.max),
      buy: (g) => { g.hp = Math.min(g.maxHp, g.hp + 10); g.wall.repair(); },
    },
    {
      word: 'barricade',
      info: (g) => (g.wall.level === 0 ? ['BUILD A WALL', 'HP ' + g.wall.nextMax()] : ['WALL HP', g.wall.max + ' TO ' + g.wall.nextMax()]),
      cost: (g) => 40 + 35 * g.wall.level,
      avail: (g) => !g.wall.maxed,
      buy: (g) => g.wall.upgrade(),
    },
    {
      word: 'frost',
      info: () => ['ENEMIES 20%', 'SLOWER 1 WAVE'],
      cost: () => 25,
      avail: (g) => !g.buffs.frost,
      buy: (g) => { g.buffs.frost = true; },
    },
  ];

  const CARD_W = 74, CARD_H = 74, GAP = 8, CARD_Y = 34;
  const cardX = (i) => Math.round(160 - (3 * CARD_W + 2 * GAP) / 2) + i * (CARD_W + GAP);
  const SPIN = 0.75, STAGGER = 0.38, TICK = 0.07; // card i stops at SPIN + i * STAGGER seconds

  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  TD.Shop = {
    buf: '', msg: '', msgCol: COL.white, msgT: 0,
    cards: [], t: 0, rerolls: 0, lastTick: 0,

    open(g) { this.rerolls = 0; this.roll(g); },

    roll(g) {
      const avail = shuffle(ITEMS.filter((it) => it.avail(g)));
      const rest = shuffle(ITEMS.filter((it) => !avail.includes(it)));
      this.cards = avail.concat(rest).slice(0, 3).map((item) => ({ item, sold: false }));
      this.t = 0; this.lastTick = 0;
      this.buf = ''; this.msg = ''; this.msgT = 0;
    },

    get spinning() { return this.t < SPIN + 2 * STAGGER; },
    rerollCost() { return 10 + 5 * this.rerolls; },

    // every word you can type right now
    words() {
      return this.cards.filter((c) => !c.sold).map((c) => c.item.word).concat(['reroll', 'fight']);
    },

    onChar(g, ch) {
      if (this.spinning) return;
      const next = this.buf + ch;
      const words = this.words();
      if (!words.some((w) => w.startsWith(next))) {
        this.buf = '';
        this.say('TYPO - START THE WORD AGAIN', COL.red);
        A.typo();
        return;
      }
      this.buf = next;
      A.type(next.length);
      if (!words.includes(next)) return;
      this.buf = '';
      if (next === 'fight') return this.fight(g);
      if (next === 'reroll') return this.reroll(g);
      this.tryBuy(g, this.cards.find((c) => !c.sold && c.item.word === next));
    },

    back() { this.buf = this.buf.slice(0, -1); },
    clear() { this.buf = ''; },
    // Enter: skip the spin if it is still going, otherwise start the next wave
    startNext(g) {
      if (this.spinning) { this.t = SPIN + 2 * STAGGER; A.lock(); return; }
      this.buf = '';
      this.fight(g);
    },
    fight(g) { g.startWave(g.waves.wave + 1); },

    reroll(g) {
      const c = this.rerollCost();
      if (g.gold < c) { this.say('NOT ENOUGH GOLD', COL.red); A.typo(); return; }
      g.gold -= c;
      this.rerolls++;
      this.roll(g);
      A.lock();
    },

    tryBuy(g, card) {
      const it = card.item;
      if (!it.avail(g)) { this.say(it.word === 'repair' ? 'NOTHING TO REPAIR' : 'ALREADY HAVE IT', COL.red); A.typo(); return; }
      const c = it.cost(g);
      if (g.gold < c) { this.say('NOT ENOUGH GOLD', COL.red); A.typo(); return; }
      g.gold -= c;
      it.buy(g);
      card.sold = true;
      card.soldT = this.t;
      this.say('BOUGHT ' + it.word.toUpperCase() + '!', COL.green);
      A.clear();
    },

    say(t, c) { this.msg = t; this.msgCol = c; this.msgT = 1.6; },

    update(dt) {
      if (this.msgT > 0) this.msgT -= dt;
      const was = this.spinning;
      this.t += dt;
      if (this.spinning && this.t - this.lastTick >= TICK) { this.lastTick = this.t; A.hover(); }
      // a thunk as each card lands
      for (let i = 0; i < 3; i++) { const at = SPIN + i * STAGGER; if (this.t - dt < at && this.t >= at) A.lock(); }
      if (was && !this.spinning) A.wave();
    },

    // typed-prefix highlight: draws `word` centered at cx with the typed part in gold
    drawWord(ctx, word, cx, y, s, baseCol, live = true) {
      const typed = live && this.buf && word.startsWith(this.buf) ? this.buf.length : 0;
      const x = Math.round(cx - F.width(word, s) / 2);
      if (typed) F.draw(ctx, word.slice(0, typed), x, y, COL.gold, s, 'left', COL.ink);
      F.draw(ctx, word.slice(typed), x + F.advance(word.slice(0, typed), s), y, baseCol, s, 'left', COL.ink);
      return typed;
    },

    drawCard(ctx, g, i) {
      const card = this.cards[i], x = cardX(i), y = CARD_Y, w = CARD_W, h = CARD_H;
      const stopAt = SPIN + i * STAGGER, rolling = this.t < stopAt;
      // while rolling, show a different random item every tick
      const it = rolling ? ITEMS[Math.floor(this.t / TICK + i * 2) % ITEMS.length] : card.item;
      const r = (rx, ry, rw, rh, col) => { ctx.fillStyle = col; ctx.fillRect(rx, ry, rw, rh); };

      const typed = !rolling && !card.sold && this.buf && it.word.startsWith(this.buf);
      // frame
      r(x - 1, y - 1, w + 2, h + 2, COL.ink);
      r(x, y, w, h, typed ? '#5a4520' : '#333c57');
      r(x + 1, y + 1, w - 2, h - 2, '#1c2435');
      r(x + 1, y + 1, w - 2, 1, typed ? COL.gold : '#46506e');
      for (const [bx, by] of [[x + 2, y + 2], [x + w - 4, y + 2], [x + 2, y + h - 4], [x + w - 4, y + h - 4]]) r(bx, by, 2, 2, '#46506e');

      // title (the word you type)
      this.drawWord(ctx, it.word, x + w / 2, y + 5, 1, card.sold ? COL.faint : COL.white, !card.sold && !rolling);
      // icon box
      const ix = x + 5, iy = y + 13, iw = w - 10, ih = 28;
      r(ix, iy, iw, ih, '#0a0d14');
      const bob = rolling ? Math.round(((this.t / TICK) % 1) * 8) - 4 : 0;
      ctx.save();
      ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip();
      ctx.drawImage(icon(it.word), Math.round(ix + iw / 2 - 12), iy + 2 + bob, 24, 24);
      ctx.restore();
      if (rolling) { r(ix, iy + 4, iw, 1, 'rgba(255,255,255,0.08)'); r(ix, iy + ih - 5, iw, 1, 'rgba(255,255,255,0.08)'); }
      // land flash
      const since = this.t - stopAt;
      if (since >= 0 && since < 0.15) r(x + 1, y + 1, w - 2, h - 2, 'rgba(255,255,255,' + (0.35 * (1 - since / 0.15)).toFixed(2) + ')');

      if (rolling) {
        F.draw(ctx, '? ? ?', x + w / 2, y + 47, COL.faint, 1, 'center');
        return;
      }
      const lines = it.info(g);
      lines.forEach((ln, li) => F.draw(ctx, ln, x + w / 2, y + 45 + li * 8, COL.dim, 1, 'center'));
      const c = it.cost(g), can = it.avail(g) && g.gold >= c;
      F.draw(ctx, c + 'G', x + w / 2, y + h - 10, card.sold ? COL.faint : can ? COL.coin : COL.red, 1, 'center', COL.ink);

      if (card.sold) {
        r(x + 1, y + 1, w - 2, h - 2, 'rgba(10,13,20,0.55)');
        const sy = iy + 11;
        r(x + 12, sy - 3, w - 24, 12, COL.ink);
        r(x + 13, sy - 2, w - 26, 10, '#2a4a24');
        F.draw(ctx, 'SOLD', x + w / 2, sy, COL.green, 1, 'center', COL.ink);
      }
    },

    draw(ctx, g) {
      g.dim(0.55);
      F.draw(ctx, this.spinning ? 'SPINNING...' : 'TYPE A CARD TO BUY IT', 160, 25, COL.gold, 1, 'center', COL.ink);
      for (let i = 0; i < 3; i++) this.drawCard(ctx, g, i);

      const by = CARD_Y + CARD_H + 6;
      const x0 = cardX(0), x1 = cardX(2) + CARD_W;
      F.draw(ctx, 'GOLD ' + g.gold, x0, by, COL.coin, 1, 'left', COL.ink);
      const wallTxt = g.wall.level ? g.wall.hp + '/' + g.wall.max : 'NONE';
      F.draw(ctx, 'TOWER ' + g.hp + '/' + g.maxHp + '   WALL ' + wallTxt, x1, by, COL.dim, 1, 'right', COL.ink);

      if (this.msgT > 0) F.draw(ctx, this.msg, 160, by + 10, this.msgCol, 1, 'center', COL.ink);

      // the two always-there words
      const ry = by + 19;
      const rc = this.rerollCost();
      const rw = F.width('REROLL') + 4 + F.width(rc + 'G');
      this.drawWord(ctx, 'reroll', x0 + F.width('REROLL') / 2, ry, 1, COL.white);
      F.draw(ctx, rc + 'G', x0 + rw, ry, g.gold >= rc ? COL.coin : COL.red, 1, 'right');
      const fw = F.width('FIGHT') + 4 + F.width('OR ENTER');
      this.drawWord(ctx, 'fight', x1 - fw + F.width('FIGHT') / 2, ry, 1, COL.white);
      F.draw(ctx, 'OR ENTER', x1, ry, COL.faint, 1, 'right');
    },
  };
})();
