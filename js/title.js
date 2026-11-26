// "TYPEBOUNDS" logo: plain chunky pixel letters (5x7 glyphs) in torch gold with a dark outline.
// Drawn once into a canvas, then just blitted.
(function () {
  const TD = (window.TD = window.TD || {});

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
  const TEXT = 'TYPEBOUNDS', S = 3, GAP = 1; // GAP in glyph pixels

  let img = null;
  function build() {
    const cols = TEXT.length * (5 + GAP) - GAP;
    const w = cols * S, h = 7 * S;
    img = document.createElement('canvas');
    img.width = w + 2; img.height = h + 4; // room for outline + drop shadow
    const g = img.getContext('2d');
    const cells = [];
    [...TEXT].forEach((ch, i) => GLYPHS[ch].forEach((row, ry) => {
      for (let rx = 0; rx < 5; rx++) if (row[rx] === '#') cells.push([(i * (5 + GAP) + rx) * S + 1, ry * S + 1]);
    }));
    const fill = (dx, dy, col) => { g.fillStyle = col; for (const [x, y] of cells) g.fillRect(x + dx, y + dy, S, S); };
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [0, 3]]) fill(dx, dy, '#1a1c2c'); // outline
    fill(0, 2, '#8a4f1c');                                        // thick bottom edge
    fill(0, 0, '#ffcd75');                                        // face
    g.fillStyle = '#f4a640';                                      // lower third darker
    for (const [x, y] of cells) if ((y - 1) / S >= 5) g.fillRect(x, y, S, S);
    g.fillStyle = '#fff1c2';                                      // top shine
    for (const [x, y] of cells) if (y === 1) g.fillRect(x, y, S, 1);
    TD.Title.width = img.width;
  }

  TD.Title = {
    width: 0,
    draw(ctx, cx, y) {
      if (!img) build();
      ctx.drawImage(img, Math.round(cx - img.width / 2), y);
    },
  };
})();
