// Between-wave shop. You buy by TYPING the item's word. Enter starts the next wave.
(function () {
  const TD = (window.TD = window.TD || {});
  const F = TD.Font, A = TD.Audio;
  const COL = { gold: '#ffcd75', coin: '#e8d27a', white: '#f4f4f4', dim: '#94b0c2', red: '#ef7d57', green: '#a7f070', ink: '#1a1c2c' };
  const ARMOR_MAX = 8;

  // Words must start with different letters.
  const ITEMS = [
    {
      word: 'armor',
      info: (g) => 'LV ' + g.armorLv + (g.armorLv >= ARMOR_MAX ? '  MAXED' : '  +5 MAX HP'),
      cost: (g) => (g.armorLv >= ARMOR_MAX ? null : 30 + 20 * g.armorLv),
      ok: () => true,
      buy: (g) => { g.armorLv++; g.maxHp += 5; g.hp += 5; },
    },
    {
      word: 'repair',
      info: () => '+10 HP AND FIX WALL',
      cost: () => 20,
      ok: (g) => g.hp < g.maxHp || (g.wall.level > 0 && g.wall.hp < g.wall.max),
      why: 'NOTHING TO REPAIR',
      buy: (g) => { g.hp = Math.min(g.maxHp, g.hp + 10); g.wall.repair(); },
    },
    {
      word: 'barricade',
      info: (g) =>
        g.wall.maxed ? 'WALL HP ' + g.wall.max + '  MAXED'
        : g.wall.level === 0 ? 'BUILD WALL  HP ' + g.wall.nextMax()
        : 'WALL HP ' + g.wall.max + ' TO ' + g.wall.nextMax(),
      cost: (g) => (g.wall.maxed ? null : 40 + 35 * g.wall.level),
      ok: () => true,
      buy: (g) => g.wall.upgrade(),
    },
    {
      word: 'fight',
      info: (g) => 'START WAVE ' + (g.waves.wave + 1),
      cost: () => 0,
      ok: () => true,
      free: true,
      buy: (g) => g.startWave(g.waves.wave + 1),
    },
  ];

  TD.Shop = {
    buf: '', msg: '', msgCol: COL.white, msgT: 0,

    open() { this.buf = ''; this.msg = ''; this.msgT = 0; },

    onChar(g, ch) {
      const next = this.buf + ch;
      if (!ITEMS.some((it) => it.word.startsWith(next))) {
        this.buf = '';
        this.say('TYPO - START THE WORD AGAIN', COL.red);
        A.typo();
        return;
      }
      this.buf = next;
      A.type(next.length);
      const it = ITEMS.find((i) => i.word === next);
      if (it) { this.buf = ''; this.tryBuy(g, it); }
    },

    back() { this.buf = this.buf.slice(0, -1); },
    clear() { this.buf = ''; },
    startNext(g) { this.buf = ''; this.tryBuy(g, ITEMS[ITEMS.length - 1]); },

    tryBuy(g, it) {
      const c = it.cost(g);
      if (c == null) { this.say('ALREADY MAXED', COL.red); A.typo(); return; }
      if (!it.ok(g)) { this.say(it.why || 'CANNOT BUY', COL.red); A.typo(); return; }
      if (g.gold < c) { this.say('NOT ENOUGH GOLD', COL.red); A.typo(); return; }
      g.gold -= c;
      it.buy(g);
      if (!it.free) { this.say('BOUGHT ' + it.word.toUpperCase() + '!', COL.green); A.clear(); }
    },

    say(t, c) { this.msg = t; this.msgCol = c; this.msgT = 1.6; },
    update(dt) { if (this.msgT > 0) this.msgT -= dt; },

    draw(ctx, g) {
      const x = 40, y = 28, w = 240, h = 124;
      ctx.fillStyle = 'rgba(10,14,22,0.93)';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#333c57';
      ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h); ctx.fillRect(x + 4, y + 30, w - 8, 1);
      ctx.fillStyle = COL.gold;
      ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);

      F.draw(ctx, 'SHOP', x + 8, y + 6, COL.gold, 2, 'left', COL.ink);
      F.draw(ctx, 'GOLD ' + g.gold, x + w - 8, y + 9, COL.coin, 1, 'right', COL.ink);
      const wallTxt = g.wall.level ? g.wall.hp + '/' + g.wall.max : 'NONE';
      F.draw(ctx, 'TOWER ' + g.hp + '/' + g.maxHp + '    WALL ' + wallTxt, x + 8, y + 22, COL.dim);

      ITEMS.forEach((it, i) => {
        const ry = y + 38 + i * 14;
        const typed = this.buf && it.word.startsWith(this.buf) ? this.buf.length : 0;
        if (typed) { ctx.fillStyle = '#2e2414'; ctx.fillRect(x + 4, ry - 3, w - 8, 11); }
        const wx = x + 10;
        if (typed) F.draw(ctx, it.word.slice(0, typed), wx, ry, COL.gold);
        F.draw(ctx, it.word.slice(typed), wx + typed * 4, ry, COL.white);
        F.draw(ctx, it.info(g), x + 58, ry, COL.dim);
        if (!it.free) {
          const c = it.cost(g);
          const txt = c == null ? 'MAX' : c + 'G';
          const col = c == null ? COL.dim : g.gold >= c && it.ok(g) ? COL.coin : COL.red;
          F.draw(ctx, txt, x + w - 8, ry, col, 1, 'right');
        }
      });

      if (this.msgT > 0) F.draw(ctx, this.msg, x + w / 2, y + h - 22, this.msgCol, 1, 'center');
      F.draw(ctx, 'TYPE A WORD TO BUY - ENTER STARTS THE WAVE', x + w / 2, y + h - 11, COL.dim, 1, 'center');
    },
  };
})();
