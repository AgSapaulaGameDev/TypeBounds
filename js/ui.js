// UI kit: ornate gold-framed panels, crimson ribbons, chunky buttons, pixel icons,
// sliders and toggles. Everything draws straight onto the 2D canvas in pixel units.
(function () {
  const TD = (window.TD = window.TD || {});
  const F = TD.Font;

  const COL = {
    ink: '#1a1c2c', panel: 'rgba(20,18,30,0.94)', panelLine: '#2c2838',
    gold: '#ffcd75', goldMid: '#f4a640', goldDark: '#b0702a', goldText: '#ffd98a',
    crimson: '#7a2236', crimsonTop: '#a3324b', crimsonDark: '#4e1424',
    green: '#2f8a4a', greenTop: '#5ac54f', greenDark: '#1d5a32',
    white: '#f4f4f4', dim: '#94b0c2', faint: '#566c86',
  };

  // 7x7-ish pixel icons. '#' = main colour, 'o' = second colour, '.' = empty
  const ICONS = {
    gear: ['..#.#..', '.#####.', '##...##', '.#...#.', '##...##', '.#####.', '..#.#..'],
    speaker: ['..#....', '.##..#.', '###.#.#', '###.#.#', '###.#.#', '.##..#.', '..#....'],
    mute: ['..#....', '.##....', '###.#.#', '###..#.', '###.#.#', '.##....', '..#....'],
    monitor: ['#######', '#ooooo#', '#ooooo#', '#ooooo#', '#######', '...#...', '..###..'],
    play: ['#......', '###....', '#####..', '#######', '#####..', '###....', '#......'],
    restart: ['..###.#', '.#...##', '#...###', '#......', '#.....#', '.#...#.', '..###..'],
    home: ['...#...', '..###..', '.#####.', '#######', '.##.##.', '.##.##.', '.##.##.'],
    pause: ['##.##', '##.##', '##.##', '##.##', '##.##', '##.##', '##.##'],
    skull: ['.#####.', '#######', '#..#..#', '#######', '.##.##.', '..###..', '..#.#..'],
    trophy: ['#######', '#.###.#', '.#####.', '..###..', '...#...', '..###..', '.#####.'],
    flag: ['#####..', '######.', '#####..', '#......', '#......', '#......', '#......'],
    letters: ['.#.....', '#.#....', '###.##.', '#.#..#.', '#.#.##.', '....#.#', '....##.'],
    coin: ['..###..', '.#ooo#.', '#oo#oo#', '#oo#oo#', '#oo#oo#', '.#ooo#.', '..###..'],
    target: ['..###..', '.#...#.', '#.ooo.#', '#.o#o.#', '#.ooo.#', '.#...#.', '..###..'],
    star: ['...#...', '...#...', '#######', '.#####.', '..###..', '.##.##.', '#.....#'],
    crown: ['#..#..#', '##.#.##', '#######', '#######'],
    heart: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'],
    clock: ['..###..', '.#ooo#.', '#oo#oo#', '#oo##o#', '#ooooo#', '.#ooo#.', '..###..'],
    left: ['...#', '..##', '.###', '####', '.###', '..##', '...#'],
    shield: ['#######', '#ooooo#', '#ooooo#', '#ooooo#', '.#ooo#.', '..#o#..', '...#...'],
    snow: ['...#...', '.#.#.#.', '..###..', '#######', '..###..', '.#.#.#.', '...#...'],
    fence: ['.#...#.', '###.###', '#######', '.#...#.', '#######', '.#...#.', '.#...#.'],
  };

  function icon(ctx, name, x, y, col, col2) {
    const rows = ICONS[name];
    if (!rows) return;
    rows.forEach((row, py) => {
      for (let px = 0; px < row.length; px++) {
        const ch = row[px];
        if (ch === '.') continue;
        ctx.fillStyle = ch === 'o' ? (col2 || col) : col;
        ctx.fillRect(x + px, y + py, 1, 1);
      }
    });
  }
  const iconW = (name) => (ICONS[name] ? ICONS[name][0].length : 0);
  const iconH = (name) => (ICONS[name] ? ICONS[name].length : 0);

  const rect = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

  // Dark panel with a gold border and chunky gold corner brackets sticking out of each corner.
  function frame(ctx, x, y, w, h, opts = {}) {
    rect(ctx, x, y, w, h, opts.fill || COL.panel);
    rect(ctx, x - 1, y - 1, w + 2, 1, COL.ink); rect(ctx, x - 1, y + h, w + 2, 1, COL.ink);
    rect(ctx, x - 1, y, 1, h, COL.ink); rect(ctx, x + w, y, 1, h, COL.ink);
    // gold outline + dim inner line
    rect(ctx, x, y, w, 1, COL.gold); rect(ctx, x, y + h - 1, w, 1, COL.goldDark);
    rect(ctx, x, y, 1, h, COL.goldMid); rect(ctx, x + w - 1, y, 1, h, COL.goldMid);
    rect(ctx, x + 2, y + 2, w - 4, 1, COL.panelLine); rect(ctx, x + 2, y + h - 3, w - 4, 1, COL.panelLine);
    if (opts.corners === false) return;
    // corner brackets: 2px thick L shapes, 6 px long, 1px outside the border
    const L = 6;
    for (const [cx, cy, dx, dy] of [[x - 2, y - 2, 1, 1], [x + w + 1, y - 2, -1, 1], [x - 2, y + h + 1, 1, -1], [x + w + 1, y + h + 1, -1, -1]]) {
      const hx = dx > 0 ? cx : cx - L + 1, vy = dy > 0 ? cy : cy - L + 1;
      rect(ctx, hx, cy - (dy > 0 ? 0 : 1), L, 2, COL.gold);
      rect(ctx, cx - (dx > 0 ? 0 : 1), vy, 2, L, COL.gold);
      rect(ctx, cx + (dx > 0 ? 2 : -2), cy + (dy > 0 ? 2 : -2), 1, 1, COL.goldDark);
    }
  }

  // Crimson banner with gold edges and forked tails, centred on cx. Returns its box.
  function ribbon(ctx, cx, y, text, opts = {}) {
    const s = opts.scale || 2, ic = opts.icon;
    const tw = F.width(text, s), iw = ic ? iconW(ic) + 5 : 0;
    const w = tw + iw * 2 + 14, h = opts.h || (s === 2 ? 16 : 11), x = Math.round(cx - w / 2);
    // tails: darker crimson strips poking out of both sides, with a V notch at the end
    const th = h - 4, tl = 8;
    for (const side of [-1, 1]) {
      const ex = side < 0 ? x - tl : x + w;
      for (let r = 0; r < th; r++) {
        const notch = Math.max(0, 3 - Math.abs(r - (th - 1) / 2) * 1.2) | 0;
        const rx = side < 0 ? ex + notch : ex, rw = tl - notch;
        rect(ctx, rx, y + 4 + r, rw, 1, r === 0 || r === th - 1 ? COL.goldDark : COL.crimsonDark);
      }
    }
    rect(ctx, x - 1, y - 1, w + 2, h + 2, COL.ink);
    rect(ctx, x, y, w, h, COL.crimson);
    rect(ctx, x, y + 1, w, Math.floor(h / 2) - 1, COL.crimsonTop);
    rect(ctx, x, y, w, 1, COL.gold); rect(ctx, x, y + h - 1, w, 1, COL.goldDark);
    rect(ctx, x, y, 1, h, COL.gold); rect(ctx, x + w - 1, y, 1, h, COL.gold);
    const ty = y + Math.round((h - 5 * s) / 2);
    F.draw(ctx, text, cx, ty, opts.color || COL.goldText, s, 'center', COL.ink);
    if (ic) {
      const iy = y + Math.round((h - iconH(ic)) / 2);
      icon(ctx, ic, x + 5, iy, COL.gold, COL.goldDark);
      icon(ctx, ic, x + w - 5 - iconW(ic), iy, COL.gold, COL.goldDark);
    }
    return { x, y, w, h };
  }

  // Chunky button. style: 'gold' | 'red' | 'green'. sel = keyboard/mouse focus.
  const STYLES = {
    gold: { fill: '#f4b41b', top: '#ffd541', bot: '#b86f12', edge: '#7a4410', text: COL.ink, iconCol: '#3a2410' },
    red: { fill: COL.crimson, top: COL.crimsonTop, bot: COL.crimsonDark, edge: COL.goldDark, text: COL.white, iconCol: COL.gold },
    green: { fill: COL.green, top: COL.greenTop, bot: COL.greenDark, edge: '#c9a24a', text: COL.white, iconCol: '#ffffff' },
  };
  function button(ctx, b, opts = {}) {
    const st = STYLES[opts.style || 'red'], sel = !!opts.sel, s = opts.scale || 2;
    const { x, y, w, h } = b;
    if (sel) rect(ctx, x - 2, y - 2, w + 4, h + 4, 'rgba(255,205,117,0.35)');
    rect(ctx, x - 1, y - 1, w + 2, h + 2, COL.ink);
    rect(ctx, x, y, w, h, st.fill);
    rect(ctx, x, y, w, Math.max(2, Math.floor(h / 2) - 1), st.top);
    rect(ctx, x, y + h - 2, w, 2, st.bot);
    const edge = sel ? COL.gold : st.edge;
    rect(ctx, x, y, w, 1, edge); rect(ctx, x, y + h - 1, w, 1, edge);
    rect(ctx, x, y, 1, h, edge); rect(ctx, x + w - 1, y, 1, h, edge);
    rect(ctx, x + 1, y + 1, w - 2, 1, 'rgba(255,255,255,0.25)');
    let cx = x + w / 2;
    if (opts.icon) {
      const iw = iconW(opts.icon), ih = iconH(opts.icon);
      icon(ctx, opts.icon, x + 6, y + Math.round((h - ih) / 2), st.iconCol, st.iconCol);
      cx = x + 6 + iw + (w - 6 - iw) / 2;
    }
    const txt = sel && opts.style !== 'gold' ? COL.goldText : st.text;
    F.draw(ctx, opts.label || b.label, cx, y + Math.round((h - 5 * s) / 2), txt, s, 'center', opts.style === 'gold' ? null : COL.ink);
  }

  // Gold-filled track with a knob. level 0..max
  function slider(ctx, bar, level, max, sel) {
    const { x, y, w } = bar, ty = y + 3, th = 4;
    rect(ctx, x - 1, ty - 1, w + 2, th + 2, COL.ink);
    rect(ctx, x, ty, w, th, '#2a2838');
    rect(ctx, x, ty, w, 1, '#1d1b28');
    const fw = Math.round((w * level) / max);
    if (fw > 0) { rect(ctx, x, ty, fw, th, COL.goldMid); rect(ctx, x, ty, fw, 1, COL.gold); rect(ctx, x, ty + th - 1, fw, 1, COL.goldDark); }
    const kx = Math.max(x, Math.min(x + w - 5, x + fw - 2));
    rect(ctx, kx - 1, y - 1, 7, 12, COL.ink);
    rect(ctx, kx, y, 5, 10, sel ? '#fff1c9' : '#ffe2a0');
    rect(ctx, kx, y + 8, 5, 2, COL.goldMid);
    rect(ctx, kx + 2, y + 3, 1, 4, COL.goldDark);
  }

  // ON / OFF segmented pill
  function toggle(ctx, parts, on) {
    const all = { x: parts.on.x, y: parts.on.y, w: parts.on.w + parts.off.w, h: parts.on.h };
    rect(ctx, all.x - 1, all.y - 1, all.w + 2, all.h + 2, COL.ink);
    for (const [box, txt, active] of [[parts.on, 'ON', on], [parts.off, 'OFF', !on]]) {
      rect(ctx, box.x, box.y, box.w, box.h, active ? '#f4b41b' : '#22283a');
      rect(ctx, box.x, box.y, box.w, 1, active ? '#ffd541' : '#323a52');
      rect(ctx, box.x, box.y + box.h - 1, box.w, 1, active ? '#b86f12' : '#151a28');
      F.draw(ctx, txt, box.x + box.w / 2, box.y + Math.round((box.h - 5) / 2), active ? COL.ink : COL.dim, 1, 'center');
    }
    rect(ctx, parts.off.x, parts.off.y, 1, parts.off.h, COL.ink);
  }

  // Hanging crimson pennant with a gold crown (main menu decoration)
  function pennant(ctx, x, y, w, h) {
    for (let r = 0; r < h; r++) {
      const tail = r >= h - 6 ? r - (h - 6) : -1; // V cut at the bottom
      if (tail < 0) {
        rect(ctx, x, y + r, w, 1, COL.crimson);
        rect(ctx, x + 2, y + r, 1, 1, COL.gold); rect(ctx, x + w - 3, y + r, 1, 1, COL.gold);
      } else {
        const half = Math.floor(w / 2), cut = tail + 1;
        rect(ctx, x, y + r, half - cut, 1, COL.crimsonDark);
        rect(ctx, x + half + cut, y + r, w - half - cut, 1, COL.crimsonDark);
      }
      rect(ctx, x - 1, y + r, 1, 1, COL.ink); rect(ctx, x + w, y + r, 1, 1, COL.ink);
    }
    icon(ctx, 'crown', x + Math.round((w - 7) / 2), y + h - 14, COL.gold);
  }

  // Little knight portrait for the bottom bar
  const KNIGHT = [
    '...kkkk...', '..kwwwwk..', '.kwwwwwwk.', '.kwkkkkwk.', '.kwkyykwk.', '.kwwwwwwk.',
    'rrkkddkk..', 'rrkdbbdkr.', 'r.kdbbdk.r', '..kddddk..', '..kk..kk..', '..kk..kk..',
  ];
  const KNIGHT_COL = { k: '#1a1c2c', w: '#e0e4ea', y: '#73eff7', d: '#3b5dc9', b: '#ffcd75', r: '#b13e53' };
  function knight(ctx, x, y) {
    KNIGHT.forEach((row, py) => {
      for (let px = 0; px < row.length; px++) {
        const c = KNIGHT_COL[row[px]];
        if (c) { ctx.fillStyle = c; ctx.fillRect(x + px, y + py, 1, 1); }
      }
    });
  }

  TD.UI = { COL, icon, iconW, iconH, frame, ribbon, button, slider, toggle, pennant, knight, rect };
})();
