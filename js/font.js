// 5px-tall pixel font drawn in code. Text is always rendered uppercase.
// Most glyphs are 3 wide; M and W are 5 wide and N is 4 wide so M / W / H / N never look alike.
(function () {
  const TD = (window.TD = window.TD || {});

  const G = {
    A: ['.#.', '#.#', '###', '#.#', '#.#'],
    B: ['##.', '#.#', '##.', '#.#', '##.'],
    C: ['.##', '#..', '#..', '#..', '.##'],
    D: ['##.', '#.#', '#.#', '#.#', '##.'],
    E: ['###', '#..', '##.', '#..', '###'],
    F: ['###', '#..', '##.', '#..', '#..'],
    G: ['.##', '#..', '#.#', '#.#', '.##'],
    H: ['#.#', '#.#', '###', '#.#', '#.#'],
    I: ['###', '.#.', '.#.', '.#.', '###'],
    J: ['..#', '..#', '..#', '#.#', '.#.'],
    K: ['#.#', '#.#', '##.', '#.#', '#.#'],
    L: ['#..', '#..', '#..', '#..', '###'],
    M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
    N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
    O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
    P: ['##.', '#.#', '##.', '#..', '#..'],
    Q: ['.#.', '#.#', '#.#', '##.', '.##'],
    R: ['##.', '#.#', '##.', '#.#', '#.#'],
    S: ['.##', '#..', '.#.', '..#', '##.'],
    T: ['###', '.#.', '.#.', '.#.', '.#.'],
    U: ['#.#', '#.#', '#.#', '#.#', '###'],
    V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
    W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
    X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
    Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
    Z: ['###', '..#', '.#.', '#..', '###'],
    0: ['###', '#.#', '#.#', '#.#', '###'],
    1: ['.#.', '##.', '.#.', '.#.', '###'],
    2: ['##.', '..#', '.#.', '#..', '###'],
    3: ['##.', '..#', '.#.', '..#', '##.'],
    4: ['#.#', '#.#', '###', '..#', '..#'],
    5: ['###', '#..', '##.', '..#', '##.'],
    6: ['.##', '#..', '###', '#.#', '###'],
    7: ['###', '..#', '.#.', '.#.', '.#.'],
    8: ['###', '#.#', '###', '#.#', '###'],
    9: ['###', '#.#', '###', '..#', '##.'],
    '+': ['...', '.#.', '###', '.#.', '...'],
    '-': ['...', '...', '###', '...', '...'],
    '=': ['...', '###', '...', '###', '...'],
    '.': ['...', '...', '...', '...', '.#.'],
    ':': ['...', '.#.', '...', '.#.', '...'],
    '!': ['.#.', '.#.', '.#.', '...', '.#.'],
    '?': ['##.', '..#', '.#.', '...', '.#.'],
    '%': ['#.#', '..#', '.#.', '#..', '#.#'],
    '/': ['..#', '..#', '.#.', '#..', '#..'],
    '#': ['#.#', '###', '#.#', '###', '#.#'],
    '>': ['#..', '.#.', '..#', '.#.', '#..'],
    '<': ['..#', '.#.', '#..', '.#.', '..#'],
    '_': ['...', '...', '...', '...', '###'],
  };

  const gw = (ch) => (G[ch] ? G[ch][0].length : 3); // glyph width (space and unknown = 3)
  // horizontal space a string takes including the 1px gap after every glyph
  const adv = (text) => { let w = 0; for (const ch of text) w += gw(ch) + 1; return w; };

  const cache = new Map();
  function glyph(ch, color) {
    const key = ch + color;
    let c = cache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    const rows = G[ch];
    c.width = gw(ch);
    c.height = 5;
    const x = c.getContext('2d');
    x.fillStyle = color;
    if (rows) {
      for (let r = 0; r < 5; r++)
        for (let i = 0; i < rows[r].length; i++) if (rows[r][i] === '#') x.fillRect(i, r, 1, 1);
    }
    cache.set(key, c);
    return c;
  }

  TD.Font = {
    H: 5,
    prewarm(colors) { for (const c of colors) for (const ch in G) glyph(ch, c); },
    width(text, s = 1) {
      const t = String(text).toUpperCase();
      return t.length ? (adv(t) - 1) * s : 0;
    },
    // like width() but includes the gap after the last letter: where the next letter starts
    advance(text, s = 1) { return adv(String(text).toUpperCase()) * s; },
    // align: 'left' | 'center' | 'right'. shadow: colour drawn 1px (scaled) below.
    draw(ctx, text, x, y, color = '#fff', s = 1, align = 'left', shadow = null) {
      text = String(text).toUpperCase();
      const w = this.width(text, s);
      if (align === 'center') x -= Math.floor(w / 2);
      else if (align === 'right') x -= w;
      x = Math.round(x);
      y = Math.round(y);
      let gx = x;
      for (const ch of text) {
        const cw = gw(ch) * s;
        if (ch !== ' ') {
          if (shadow) ctx.drawImage(glyph(ch, shadow), gx, y + s, cw, 5 * s);
          ctx.drawImage(glyph(ch, color), gx, y, cw, 5 * s);
        }
        gx += cw + s;
      }
      return w;
    },
  };
})();
