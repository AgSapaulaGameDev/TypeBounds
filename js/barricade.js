// Barricade: a fence ring around the tower (posts joined by plank rails). Enemies must break it
// before reaching the tower. Level 1-2 = wooden fence, 3-5 = iron fence with gold bands.
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
  const RAILS_BY_LEVEL = [[], [3, 7], [2, 5, 8], [3, 7], [2, 5, 8], [2, 5, 8]]; // rail heights above ground
  const N = 28;
  const posts = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    posts.push({
      x: Math.round(RING.cx + Math.cos(a) * RING.rx),
      y: Math.round(RING.cy + Math.sin(a) * RING.ry),
      breakAt: ((i * 37) % 100) / 100, // order in which sections look broken as HP drops
    });
  }

  const WOOD = { ink: '#1a1c2c', top: '#b07a45', bot: '#6e4a2a' };
  const IRON = { ink: '#1a1c2c', top: '#8b9bb4', bot: '#333c57' };
  const WHITE = { ink: '#ffffff', top: '#ffffff', bot: '#ffffff' };

  // one plank from post p to post q at height h: ink outline, light top, dark bottom
  function rail(ctx, p, q, h, col) {
    const dx = q.x - p.x, dy = q.y - p.y, n = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
    for (let t = 0; t <= n; t++) {
      const x = Math.round(p.x + (dx * t) / n), y = Math.round(p.y + (dy * t) / n) - h;
      ctx.fillStyle = col.ink; ctx.fillRect(x, y - 1, 1, 4);
      ctx.fillStyle = col.top; ctx.fillRect(x, y, 1, 1);
      ctx.fillStyle = col.bot; ctx.fillRect(x, y + 1, 1, 1);
    }
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

    // depth-sortable draw items: one per fence section (rails to the next post, then the post)
    items(ctx) {
      if (!this.level) return [];
      const S = TD.Sprites, ratio = this.max ? this.hp / this.max : 0, iron = this.level >= 3;
      const flash = this.flash > 0;
      const heights = RAILS_BY_LEVEL[this.level];
      const isBroken = (p) => !this.alive || p.breakAt > ratio + 0.3;
      return posts.map((p, i) => {
        const q = posts[(i + 1) % N];
        return {
          y: Math.max(p.y, q.y),
          draw: () => {
            const broken = isBroken(p);
            // rails only between two standing posts
            if (!broken && !isBroken(q)) for (const h of heights) rail(ctx, p, q, h, flash ? WHITE : iron ? IRON : WOOD);
            else if (broken) {
              // a fallen plank lying on the ground
              ctx.fillStyle = iron ? IRON.bot : WOOD.bot;
              ctx.fillRect(Math.round((p.x + q.x) / 2) - 2, Math.round((p.y + q.y) / 2), 4, 1);
            }
            const set = broken ? S.postBroken : iron ? S.postIron : S.postWood;
            ctx.drawImage(flash && !broken ? set.white : set.img, p.x - 2, p.y - 10);
            // level 5: gold spike on every post
            if (this.level >= 5 && !broken) { ctx.fillStyle = '#ffcd75'; ctx.fillRect(p.x, p.y - 12, 1, 2); }
          },
        };
      });
    }
  }

  TD.Barricade = Barricade;
})();
