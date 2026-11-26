// All art drawn in code: enemy sprites, castle, background (grass, plaza, trees).
(function () {
  const TD = (window.TD = window.TD || {});

  // ---- Base (castle) placement on the 320x180 screen ----
  TD.BASE = {
    cx: 160, cy: 90,          // point enemies walk toward
    drawX: 147, drawY: 67,    // castle canvas top-left
    sortY: 104,               // castle "feet" for draw ordering
    boltX: 160, boltY: 83,    // where letter bolts fire from (window)
    zone: { x0: 141, x1: 179, y0: 64, y1: 110 }, // enemies stop when their feet enter this
  };
  TD.inBaseZone = function (x, y) {
    const z = TD.BASE.zone;
    return x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1;
  };

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function fromRows(rows, pal) {
    const h = rows.length, w = rows[0].length;
    const c = makeCanvas(w, h), x = c.getContext('2d');
    for (let r = 0; r < h; r++) {
      if (rows[r].length !== w) console.warn('Sprite row width mismatch', r, rows[r]);
      for (let i = 0; i < w; i++) {
        const col = pal[rows[r][i]];
        if (col) { x.fillStyle = col; x.fillRect(i, r, 1, 1); }
      }
    }
    return c;
  }

  function flip(src) {
    const c = makeCanvas(src.width, src.height), x = c.getContext('2d');
    x.translate(src.width, 0);
    x.scale(-1, 1);
    x.drawImage(src, 0, 0);
    return c;
  }

  function silhouette(src, color) {
    const c = makeCanvas(src.width, src.height), x = c.getContext('2d');
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    return c;
  }

  // r/l = facing right/left, wr/wl = white hit-flash versions
  function frameSet(rows, pal) {
    const r = fromRows(rows, pal), l = flip(r);
    return { r, l, wr: silhouette(r, '#ffffff'), wl: silhouette(l, '#ffffff'), w: r.width, h: r.height };
  }

  // ---- Runner: small fast imp ----
  const RUNNER_PAL = { k: '#1a1c2c', g: '#38b764', d: '#257179', y: '#ffcd75' };
  const runnerTop = [
    '..k....k..',
    '.kgk..kgk.',
    '.kggggggk.',
    'kgyyggyygk',
    'kggggggggk',
    '.kgkkkkgk.',
    '..kggggk..',
    '.kgddddgk.',
  ];
  const runnerA = runnerTop.concat(['.kgk..kgk.', '.kk....kk.']);
  const runnerB = runnerTop.concat(['..kgkkgk..', '..kk..kk..']);

  // ---- Tank: slow stone golem ----
  const TANK_PAL = { k: '#1a1c2c', s: '#8b9bb4', d: '#566c86', r: '#ef7d57' };
  const tankTop = [
    '....kkkkkkkk....',
    '...kssssssssk...',
    '..kssssssssssk..',
    '..ksrrssssrrsk..',
    '..kssssssssssk..',
    '.kkssddddddsskk.',
    'kssskssssssksssk',
    'kssskddddddksssk',
    'kssskssssssksssk',
    'kddk.kssssk.kddk',
    '.kk..kssssk..kk.',
    '.....kddddk.....',
  ];
  const tankA = tankTop.concat(['...kssk..kssk...', '...kssk..kssk...', '..kdddk..kdddk..', '..kkkkk..kkkkk..']);
  const tankB = tankTop.concat(['...kssk..kssk...', '..kssk....kssk..', '.kdddk....kdddk.', '.kkkkk....kkkkk.']);

  // ---- Barricade stakes (5x8), anchored bottom-centre ----
  const POST_ROWS = ['..k..', '.klk.', '.kwk.', '.kwk.', '.krk.', '.kwk.', '.kwk.', '.kdk.'];
  const POST_BROKEN = ['.....', '.....', '.....', '.....', '.k.k.', '.kwk.', '.kwk.', '.kdk.'];
  const WOOD_PAL = { k: '#1a1c2c', w: '#8a5a32', l: '#b07a45', d: '#5a3a22', r: '#c2a36b' };
  const IRON_PAL = { k: '#1a1c2c', w: '#566c86', l: '#c2c3c7', d: '#333c57', r: '#ffcd75' };
  function postSet(rows, pal) {
    const img = fromRows(rows, pal);
    return { img, white: silhouette(img, '#ffffff') };
  }

  // ---- Castle (27x38), anchored bottom-centre ----
  function buildCastle() {
    const c = makeCanvas(27, 38), x = c.getContext('2d');
    const px = (col, X, Y, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(X, Y, w, h); };
    const OUT = '#1a1c2c', ST = '#5d6b7d', STL = '#7d8ca0', STD = '#3f4a59';

    // body
    px(OUT, 3, 9, 21, 29);
    px(ST, 4, 10, 19, 28);
    for (let y = 10; y < 38; y++) {
      const row = Math.floor((y - 10) / 3);
      if ((y - 10) % 3 === 2) px(STD, 4, y, 19, 1);
      else for (let bx = 4 + (row % 2 ? 2 : 0); bx < 23; bx += 5) px(STD, bx, y, 1, 1);
    }
    px(STL, 4, 10, 1, 28);
    px(STD, 22, 10, 1, 28);

    // ledge + merlons
    px(OUT, 2, 8, 23, 3);
    px(STL, 3, 9, 21, 1);
    for (const mx of [3, 9, 15, 21]) {
      px(OUT, mx - 1, 3, 5, 6);
      px(ST, mx, 4, 3, 4);
      px(STL, mx, 4, 1, 4);
    }

    // door
    px(OUT, 10, 27, 7, 1);
    px(OUT, 9, 28, 9, 10);
    px('#5a3a22', 11, 28, 5, 1);
    px('#5a3a22', 10, 29, 7, 9);
    px('#3e2716', 12, 29, 1, 9);
    px('#3e2716', 14, 29, 1, 9);
    px('#ffcd75', 15, 33);

    // window frame (glow drawn per frame) + arrow slits
    px(OUT, 11, 14, 5, 6);
    px('#2a2030', 12, 15, 3, 4);
    px(OUT, 7, 17, 1, 4);
    px(OUT, 19, 17, 1, 4);

    // moss
    for (const [mx, my] of [[4, 36], [5, 37], [6, 37], [20, 37], [21, 36], [22, 37], [4, 30], [22, 24]]) px('#3b5d38', mx, my);

    // flag pole
    px('#94b0c2', 13, 0, 1, 8);

    return { canvas: c, white: silhouette(c, '#ffffff'), w: 27, h: 38 };
  }

  // ---- Background ----
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hexRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function drawPine(x, cx, by, h, rnd) {
    const DARK = '#06121a', MID = '#103036', LIT = '#1a4745', HI = '#2a6457';
    x.fillStyle = '#24160f';
    x.fillRect(cx - 1, by - 3, 2, 3);
    const tiers = 3, tierH = Math.round(h * 0.5);
    for (let t = 0; t < tiers; t++) {
      const top = by - 3 - h + Math.round(t * h * 0.26);
      const maxHw = Math.round(h * 0.22 + t * h * 0.06);
      for (let r = 0; r < tierH; r++) {
        const hw = Math.max(0, Math.round((maxHw * (r + 1)) / tierH));
        const y = top + r;
        x.fillStyle = DARK; x.fillRect(cx - hw - 1, y, hw * 2 + 3, 1);
        x.fillStyle = MID; x.fillRect(cx - hw, y, hw * 2 + 1, 1);
        x.fillStyle = LIT; x.fillRect(cx - hw, y, hw + 1, 1);
        if (hw > 1 && rnd() < 0.25) { x.fillStyle = HI; x.fillRect(cx - hw + Math.floor(rnd() * hw), y, 1, 1); }
      }
    }
  }

  // width = view width in pixels (320 for 16:9, wider on wide screens). The clearing, plaza
  // and castle area stay centred; extra width is filled with forest.
  function buildBackground(seed, width) {
    const W = Math.round(width || 320), H = 180, cx = W / 2, wk = W / 320;
    const c = makeCanvas(W, H), x = c.getContext('2d');
    const rnd = mulberry32(seed || 7);
    const GRASS = ['#0a171e', '#0e2028', '#122a31', '#16343a', '#1b3f43', '#214a4c', '#28564f'].map(hexRgb);
    const STONE = ['#3a4450', '#434e5b', '#4c5866'].map(hexRgb);
    const MORTAR = hexRgb('#1f262e');

    const GS = 16, gw = Math.ceil(W / GS) + 3, gh = Math.ceil(H / GS) + 3;
    const grid = [];
    for (let i = 0; i < gw * gh; i++) grid.push(rnd());
    const noise = (px, py) => {
      const gx = px / GS, gy = py / GS, x0 = Math.floor(gx), y0 = Math.floor(gy);
      const fx = gx - x0, fy = gy - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const g = (i, j) => grid[(j % gh) * gw + (i % gw)];
      const a = g(x0, y0) + (g(x0 + 1, y0) - g(x0, y0)) * sx;
      const b = g(x0, y0 + 1) + (g(x0 + 1, y0 + 1) - g(x0, y0 + 1)) * sx;
      return a + (b - a) * sy;
    };

    const img = x.createImageData(W, H), d = img.data;
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const ex = (px - cx) / 150, ey = (py - 96) / 85;
        const dist = Math.sqrt(ex * ex + ey * ey);
        const v = noise(px, py) * 0.35 + noise(px * 2.3 + 50, py * 2.3) * 0.15 + (1 - dist) * 0.6 + (rnd() - 0.5) * 0.12;
        let col = GRASS[Math.max(0, Math.min(GRASS.length - 1, Math.floor(v * GRASS.length)))];

        // cobblestone plaza around the castle
        const qx = (px - cx) / 32, qy = (py - 100) / 19, pd = qx * qx + qy * qy;
        if (pd < 1 && !(pd > 0.7 && rnd() < 0.35)) {
          const row = Math.floor(py / 3), off = row % 2 ? 2 : 0;
          const cell = Math.floor((px + off) / 4);
          if (py % 3 === 2 || (px + off) % 4 === 3) col = MORTAR;
          else col = STONE[(((cell * 73856093) ^ (row * 19349663)) >>> 0) % 3];
        }
        const o = (py * W + px) * 4;
        d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);

    const insideClearing = (px, py) => {
      const ex = (px - cx) / 140, ey = (py - 96) / 78;
      return ex * ex + ey * ey < 1;
    };
    const onPlaza = (px, py) => {
      const qx = (px - cx) / 34, qy = (py - 100) / 21;
      return qx * qx + qy * qy < 1;
    };

    // castle shadow
    x.fillStyle = 'rgba(0,0,0,0.35)';
    x.fillRect(Math.round(cx) - 14, 103, 29, 3);

    // grass tufts
    for (let i = 0; i < 240 * wk; i++) {
      const tx = Math.floor(rnd() * W), ty = Math.floor(rnd() * H);
      if (!insideClearing(tx, ty) || onPlaza(tx, ty)) continue;
      x.fillStyle = '#2b5e52';
      x.fillRect(tx - 1, ty, 1, 1); x.fillRect(tx + 1, ty, 1, 1); x.fillRect(tx, ty - 1, 1, 2);
      if (rnd() < 0.4) { x.fillStyle = '#3d7a63'; x.fillRect(tx, ty - 1, 1, 1); }
    }
    // flowers
    const FLOWERS = ['#c26b9a', '#e8d27a', '#c7d2de', '#73eff7'];
    for (let i = 0; i < 40; i++) {
      const fx = Math.floor(rnd() * W), fy = Math.floor(rnd() * H);
      if (!insideClearing(fx, fy) || onPlaza(fx, fy)) continue;
      x.fillStyle = FLOWERS[Math.floor(rnd() * FLOWERS.length)];
      x.fillRect(fx, fy, 1, 1);
    }
    // rocks
    for (let i = 0; i < 18; i++) {
      const rx = Math.floor(rnd() * W), ry = Math.floor(rnd() * H);
      if (!insideClearing(rx, ry) || onPlaza(rx, ry)) continue;
      x.fillStyle = '#1a1c2c'; x.fillRect(rx - 1, ry, 5, 2);
      x.fillStyle = '#566c86'; x.fillRect(rx, ry - 1, 3, 2);
      x.fillStyle = '#8b9bb4'; x.fillRect(rx, ry - 1, 1, 1);
    }

    // trees ring the clearing
    const trees = [];
    for (let i = 0; i < 900 * wk && trees.length < 90 * wk; i++) {
      const tx = Math.floor(rnd() * (W + 20)) - 10, ty = Math.floor(rnd() * 200) + 2;
      const ex = (tx - cx) / 138, ey = (ty - 98) / 80;
      if (ex * ex + ey * ey < 1) continue;
      if (trees.some((t) => Math.abs(t.x - tx) < 9 && Math.abs(t.y - ty) < 6)) continue;
      trees.push({ x: tx, y: ty, h: 14 + Math.floor(rnd() * 12) });
    }
    trees.sort((a, b) => a.y - b.y).forEach((t) => drawPine(x, t.x, t.y, t.h, rnd));

    // dithered vignette
    const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const img2 = x.getImageData(0, 0, W, H), d2 = img2.data;
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const ex = (px - cx) / (165 * wk), ey = (py - 92) / 95;
        const dist = Math.sqrt(ex * ex + ey * ey);
        const shade = Math.max(0, Math.min(1, (dist - 0.75) / 0.55));
        const lvl = Math.floor(shade * 4 + bayer[(py & 3) * 4 + (px & 3)] / 16) / 4;
        if (lvl <= 0) continue;
        const f = 1 - lvl * 0.6, o = (py * W + px) * 4;
        d2[o] *= f; d2[o + 1] *= f; d2[o + 2] *= f;
      }
    }
    x.putImageData(img2, 0, 0);
    return c;
  }

  TD.Sprites = {
    runner: [frameSet(runnerA, RUNNER_PAL), frameSet(runnerB, RUNNER_PAL)],
    tank: [frameSet(tankA, TANK_PAL), frameSet(tankB, TANK_PAL)],
    castle: buildCastle(),
    postWood: postSet(POST_ROWS, WOOD_PAL),
    postIron: postSet(POST_ROWS, IRON_PAL),
    postBroken: postSet(POST_BROKEN, WOOD_PAL),
    buildBackground,
  };
})();
