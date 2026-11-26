// "TYPEBOUNDS" logo: each letter is a little keyboard key that gets "typed" in a ripple.
// Keys are pre-drawn once (up + pressed) into small canvases, then just blitted.
(function () {
  const TD = (window.TD = window.TD || {});

  // 5x7 bold letters used only by the logo
  const GLYPHS = {
    T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
    P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
    B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
    O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    N: ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
    D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
    S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  };

  const S = 3;                 // letter pixel size
  const KW = 25, FACE = 27;    // key width, key face height
  const DEPTH = 4;             // key side height when up
  const PRESS = 3;             // how far a key sinks when typed
  const KH = FACE + DEPTH + 2; // canvas height incl. outline
  const GAP = 3, WORD_GAP = 10;

  const WORDS = [
    { text: 'TYPE', top: '#fff4b8', bot: '#f4a640', glow: 'rgba(255,205,117,' },
    { text: 'BOUNDS', top: '#e6fdff', bot: '#41a6f6', glow: 'rgba(115,239,247,' },
  ];

  const lerp = (a, b, t) => {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (s) => Math.round(((pa >> s) & 255) + (((pb >> s) & 255) - ((pa >> s) & 255)) * t);
    return 'rgb(' + ch(16) + ',' + ch(8) + ',' + ch(0) + ')';
  };

  function makeKey(ch, word, pressed) {
    const c = document.createElement('canvas');
    c.width = KW + 2; c.height = KH + 2;
    const g = c.getContext('2d');
    const top = pressed ? PRESS : 0;          // face moves down when pressed
    const depth = pressed ? DEPTH - PRESS : DEPTH;
    const x0 = 1, y0 = 1 + top;
    const px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };

    // outline (rounded: skip corners)
    px(x0, y0 - 1, KW, FACE + depth + 2, '#0a0c14');
    px(x0 - 1, y0, KW + 2, FACE + depth, '#0a0c14');
    // side
    px(x0, y0 + FACE - 2, KW, depth + 2, pressed ? '#1b2234' : '#121726');
    px(x0 + 1, y0 + FACE + depth - 1, KW - 2, 1, '#0d1019');
    // face
    px(x0 + 1, y0, KW - 2, FACE, pressed ? '#34425f' : '#26304a');
    px(x0, y0 + 1, KW, FACE - 2, pressed ? '#34425f' : '#26304a');
    px(x0 + 1, y0, KW - 2, 1, pressed ? '#56688e' : '#3d4b6b'); // top light
    px(x0, y0 + 1, 1, FACE - 3, pressed ? '#47577a' : '#323e5a'); // left light
    px(x0 + KW - 1, y0 + 2, 1, FACE - 3, '#1b2234');               // right shade

    // letter: glow (pressed), drop shadow, gradient fill, top shine
    const lx = x0 + Math.floor((KW - 5 * S) / 2), ly = y0 + 3;
    const rows = GLYPHS[ch];
    const each = (fn) => rows.forEach((r, ry) => { for (let rx = 0; rx < 5; rx++) if (r[rx] === '#') fn(rx, ry); });
    if (pressed) {
      g.fillStyle = word.glow + '0.35)';
      each((rx, ry) => g.fillRect(lx + rx * S - 1, ly + ry * S - 1, S + 2, S + 2));
    }
    g.fillStyle = '#0a0c14';
    each((rx, ry) => g.fillRect(lx + rx * S + 1, ly + ry * S + 1, S, S));
    each((rx, ry) => {
      for (let sy = 0; sy < S; sy++) {
        const t = (ry * S + sy) / (7 * S - 1);
        g.fillStyle = pressed ? lerp('#ffffff', word.top, t) : lerp(word.top, word.bot, t);
        g.fillRect(lx + rx * S, ly + ry * S + sy, S, 1);
      }
    });
    g.fillStyle = 'rgba(255,255,255,0.55)';
    each((rx, ry) => { if (ry === 0 || rows[ry - 1][rx] !== '#') g.fillRect(lx + rx * S, ly + ry * S, S, 1); });
    return c;
  }

  let keys = null;
  function build() {
    keys = [];
    let x = 0;
    WORDS.forEach((w, wi) => {
      if (wi) x += WORD_GAP - GAP;
      for (const ch of w.text) {
        keys.push({ x, up: makeKey(ch, w, false), down: makeKey(ch, w, true) });
        x += KW + GAP;
      }
    });
    TD.Title.width = x - GAP;
  }

  TD.Title = {
    width: 0,
    height: KH,
    // t = seconds since the menu opened (drives the typing ripple + shine)
    draw(ctx, cx, y, t) {
      if (!keys) build();
      const x0 = Math.round(cx - this.width / 2);
      const n = keys.length;
      const cycle = 5.5;                       // a typing ripple every few seconds
      const ct = t < cycle ? t : (t - 0.6) % cycle + 0.6;
      const shine = ((t * 70) % 520) - 100;    // shine sweep x
      keys.forEach((k, i) => {
        const at = 0.3 + i * 0.08;             // when this key gets typed
        const pressed = ct >= at && ct < at + 0.11;
        const bob = pressed ? 0 : Math.round(Math.sin(t * 2.2 - i * 0.55) * 0.6);
        const kx = x0 + k.x, ky = y + bob;
        ctx.drawImage(pressed ? k.down : k.up, kx - 1, ky - 1);
        const d = shine - k.x;
        if (d >= 0 && d < KW) {
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.fillRect(kx + d, ky + 1 + (pressed ? PRESS : 0), Math.min(3, KW - d), FACE - 2);
        }
      });
      // blinking text cursor after the last key
      if (Math.floor(t * 2) % 2 === 0) {
        ctx.fillStyle = '#ffcd75';
        ctx.fillRect(x0 + this.width + 4, y + FACE - 5, 6, 3);
      }
    },
  };
})();
