// Barricade: a ring of stakes around the tower. Enemies must break it before reaching the tower.
(function () {
  const TD = (window.TD = window.TD || {});

  // Centred on the castle + plaza group (castle spans y 67-104, plaza reaches y 119).
  const RING = { cx: 160, cy: 95, rx: 58, ry: 42 };
  TD.RING = RING;
  TD.inRing = function (x, y) {
    const a = (x - RING.cx) / RING.rx, b = (y - RING.cy) / RING.ry;
    return a * a + b * b <= 1;
  };

  const HP_BY_LEVEL = [0, 12, 20, 30, 42, 56];
  const N = 32;
  const posts = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    posts.push({
      x: Math.round(RING.cx + Math.cos(a) * RING.rx),
      y: Math.round(RING.cy + Math.sin(a) * RING.ry),
      breakAt: ((i * 37) % 100) / 100, // order in which stakes look broken as HP drops
    });
  }

  class Barricade {
    constructor() { this.level = 0; this.max = 0; this.hp = 0; this.flash = 0; }
    get alive() { return this.level > 0 && this.hp > 0; }
    get maxed() { return this.level >= HP_BY_LEVEL.length - 1; }
    nextMax() { return HP_BY_LEVEL[this.level + 1]; }
    upgrade() { this.level++; this.max = HP_BY_LEVEL[this.level]; this.hp = this.max; }
    repair() { this.hp = this.max; }
    damage(d) { this.hp = Math.max(0, this.hp - d); this.flash = 0.1; return this.hp <= 0; }
    update(dt) { if (this.flash > 0) this.flash -= dt; }

    // depth-sortable draw items (one per stake)
    items(ctx) {
      if (!this.level) return [];
      const S = TD.Sprites, ratio = this.max ? this.hp / this.max : 0, iron = this.level >= 3;
      return posts.map((p) => ({
        y: p.y,
        draw: () => {
          const broken = !this.alive || p.breakAt > ratio + 0.15;
          const set = broken ? S.postBroken : iron ? S.postIron : S.postWood;
          ctx.drawImage(this.flash > 0 && !broken ? set.white : set.img, p.x - 2, p.y - 8);
        },
      }));
    }
  }

  TD.Barricade = Barricade;
})();
