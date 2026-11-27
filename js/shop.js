// Between-wave shop: 3 random upgrade cards spin like a slot machine, then stop one by one.
// You buy a card by TYPING its word. "reroll" spins new cards for gold. Enter or "fight" starts
// the next wave.
(function () {
  const TD = (window.TD = window.TD || {});
  const F = TD.Font, A = TD.Audio;
  const COL = { gold: '#ffcd4a', coin: '#ffd65a', white: '#fff4dc', dim: '#d9b98a', faint: '#a0806c', red: '#ff6a5a', green: '#a7f070', ink: '#140508', cyan: '#73eff7' }; // royal-red theme
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

  const CARD_W = 62, CARD_H = 65, GAP = 6, CARD_Y = 44;
  const cardX = (i) => Math.round(160 - (3 * CARD_W + 2 * GAP) / 2) + i * (CARD_W + GAP);
  const SPIN = 0.75, STAGGER = 0.38, TICK = 0.07; // card i stops at SPIN + i * STAGGER seconds

  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  TD.Shop = {
    buf: '', msg: '', msgCol: COL.white, msgT: 0,
    cards: [], t: 0, rerolls: 0, lastTick: 0,

    open(g) { this.rerolls = 0; this.nudge = 0; this.roll(g); },

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

    // clicking a card does not buy it: flash the "type a card" hint so the player knows what to do
    click(x, y) {
      for (let i = 0; i < 3; i++) {
        const cx = cardX(i);
        if (x >= cx && x < cx + CARD_W && y >= CARD_Y && y < CARD_Y + CARD_H) {
          this.msgT = 0; this.nudge = 1.6; this.nudgeCard = i; A.hover();
          return;
        }
      }
    },

    update(dt) {
      if (this.msgT > 0) this.msgT -= dt;
      if (this.nudge > 0) this.nudge -= dt;
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
      // frame: gold-trimmed maroon card with stepped corners (brighter gold while you type its word)
      r(x, y - 1, w, h + 2, COL.ink); r(x - 1, y, w + 2, h, COL.ink);
      r(x + 1, y, w - 2, h, typed ? '#ffe27a' : '#c98a2a'); r(x, y + 1, w, h - 2, typed ? '#ffe27a' : '#c98a2a');
      r(x + 1, y + 1, w - 2, h - 2, typed ? '#5a1a26' : '#3a1218');
      r(x + 2, y + 2, w - 4, h - 4, typed ? '#4a1620' : '#2a0f16');
      r(x + 2, y + 2, w - 4, 1, typed ? '#7a2a36' : '#45161f');
      r(x + 1, y, w - 2, 1, typed ? '#fff3b0' : '#e0a640');
      for (const [bx, by] of [[x + 3, y + 3], [x + w - 4, y + 3], [x + 3, y + h - 4], [x + w - 4, y + h - 4]]) r(bx, by, 1, 1, '#e0a640');

      // title (the word you type)
      this.drawWord(ctx, it.word, x + w / 2, y + 4, 1, card.sold ? COL.faint : COL.white, !card.sold && !rolling);
      // icon box
      const ix = x + 4, iy = y + 11, iw = w - 8, ih = 26;
      r(ix, iy, iw, ih, '#1a080e'); r(ix, iy, iw, 1, '#0e0306'); r(ix, iy + ih - 1, iw, 1, '#5a2418');
      const bob = rolling ? Math.round(((this.t / TICK) % 1) * 8) - 4 : 0;
      ctx.save();
      ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip();
      ctx.drawImage(icon(it.word), Math.round(ix + iw / 2 - 12), iy + 1 + bob, 24, 24);
      ctx.restore();
      if (rolling) { r(ix, iy + 4, iw, 1, 'rgba(255,255,255,0.08)'); r(ix, iy + ih - 5, iw, 1, 'rgba(255,255,255,0.08)'); }
      // land flash
      const since = this.t - stopAt;
      if (since >= 0 && since < 0.15) r(x + 1, y + 1, w - 2, h - 2, 'rgba(255,255,255,' + (0.35 * (1 - since / 0.15)).toFixed(2) + ')');

      if (rolling) {
        F.draw(ctx, '? ? ?', x + w / 2, y + 41, COL.faint, 1, 'center');
        return;
      }
      const lines = it.info(g);
      lines.forEach((ln, li) => F.draw(ctx, ln, x + w / 2, y + 40 + li * 7, COL.dim, 1, 'center'));
      const c = it.cost(g), can = it.avail(g) && g.gold >= c;
      F.draw(ctx, c + 'G', x + w / 2, y + h - 9, card.sold ? COL.faint : can ? COL.coin : COL.red, 1, 'center', COL.ink);

      if (card.sold) {
        r(x + 1, y + 1, w - 2, h - 2, 'rgba(20,5,8,0.55)');
        const sy = iy + 10;
        r(x + 10, sy - 3, w - 20, 12, COL.ink);
        r(x + 11, sy - 2, w - 22, 10, '#2a4a24');
        F.draw(ctx, 'SOLD', x + w / 2, sy, COL.green, 1, 'center', COL.ink);
      }
    },

    // Everything sits in one window with a "SHOP" tab on top. Fixed rows, top to bottom:
    // gold/tower info, cards, message line (hint when idle), reroll / fight.
    draw(ctx, g) {
      g.dim(0.55);
      const x0 = cardX(0), x1 = cardX(2) + CARD_W;
      const px = x0 - 8, pw = x1 - x0 + 16, py = 30, ph = 106;
      const r = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };

      // window: the royal-red notched panel with a SHOP ribbon on top (same art as the HTML menus)
      if (TD.Art) {
        ctx.drawImage(TD.Art.get('panel', pw + 5, ph + 6), px - 2, py - 2);
        const rw = 74;
        ctx.drawImage(TD.Art.get('ribbon', rw, 19), 160 - rw / 2, py - 15);
        F.draw(ctx, 'SHOP', 160, py - 11, '#fff4dc', 1, 'center', '#2a0a10');
      } else {
        r(px - 1, py - 1, pw + 2, ph + 2, COL.ink); r(px, py, pw, ph, '#2a0f16');
        F.draw(ctx, 'SHOP', 160, py - 8, COL.gold, 1, 'center');
      }

      // info row
      const iy = py + 7;
      // label: value pairs, labels in tan, each value in its own colour
      const pair = (x, label, val, col) => {
        F.draw(ctx, label, x, iy, COL.dim, 1, 'left', COL.ink);
        x += F.advance(label) + 3;
        F.draw(ctx, val, x, iy, col, 1, 'left', COL.ink);
        return x + F.advance(val);
      };
      pair(x0, 'GOLD:', String(g.gold), COL.coin);
      const towerTxt = g.hp + '/' + g.maxHp, wallTxt = g.wall.level ? g.wall.hp + '/' + g.wall.max : 'NONE';
      const r1 = g.hp / g.maxHp, towerCol = r1 > 0.6 ? '#7ee06a' : r1 > 0.3 ? '#ffa040' : '#ff5a5a'; // matches the HP bar
      const wallCol = g.wall.level ? '#e0a060' : COL.faint; // wood brown, or faded when there is no wall
      const rowW = F.advance('TOWER:') + 3 + F.advance(towerTxt) + 8 + F.advance('WALL:') + 3 + F.width(wallTxt);
      const tx = pair(x1 - rowW, 'TOWER:', towerTxt, towerCol);
      pair(tx + 8, 'WALL:', wallTxt, wallCol);

      for (let i = 0; i < 3; i++) this.drawCard(ctx, g, i);

      // message line: shows the last message, or the hint
      const my = CARD_Y + CARD_H + 5;
      if (this.msgT > 0) F.draw(ctx, this.msg, 160, my, this.msgCol, 1, 'center');
      else if (this.nudge > 0 && !this.spinning) {
        // after a click on a card: the hint lights up gold and blinks, with arrows pointing at it
        const on = Math.floor(this.nudge * 6) % 2 === 0;
        const txt = 'TYPE ' + this.cards[this.nudgeCard].item.word.toUpperCase() + ' TO BUY IT';
        const hw = Math.ceil(F.width(txt) / 2) + 6;
        r(160 - hw, my - 2, hw * 2, 9, on ? '#5a1a26' : '#3a1218');
        r(160 - hw, my - 2, hw * 2, 1, '#e0a640'); r(160 - hw, my + 6, hw * 2, 1, '#a86a14');
        F.draw(ctx, txt, 160, my, on ? '#fff3b0' : COL.gold, 1, 'center', COL.ink);
        F.draw(ctx, '>', 160 - hw - 5 + (on ? 1 : 0), my, COL.gold, 1, 'center', COL.ink);
        F.draw(ctx, '<', 160 + hw + 4 - (on ? 1 : 0), my, COL.gold, 1, 'center', COL.ink);
      }
      else F.draw(ctx, this.spinning ? 'SPINNING...' : 'TYPE A CARD TO BUY IT', 160, my, COL.faint, 1, 'center');

      // bottom row: the two always-there words
      const ry = my + 11;
      r(px + 5, ry - 4, pw - 10, 1, '#5a2418'); r(px + 5, ry - 3, pw - 10, 1, '#140508');
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
