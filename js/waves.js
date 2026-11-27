// Wave spawning. Each wave = more enemies, faster spawns, more tanks, slightly faster walk.
// Boss waves (every 5th) bring only the boss and the minions it summons.
(function () {
  const TD = (window.TD = window.TD || {});

  // Themes loop every 15 waves: 1-5 maths, 6-10 colour, 11-15 animals (then again, faster)
  const LOOP = 15;
  TD.wavePos = (n) => ((n - 1) % LOOP) + 1;
  const BOSSES = { 5: 'math', 10: 'rainbow', 15: 'goose' };
  const bossFor = (n) => BOSSES[TD.wavePos(n)] || null;

  class WaveManager {
    constructor() { this.wave = 0; this.total = 0; this.spawned = 0; this.boss = null; }

    start(n) {
      this.wave = n;
      this.boss = bossFor(n);
      this.bossPending = !!this.boss;
      this.bossTimer = 1.2;
      this.total = this.boss ? 0 : Math.min(18, 6 + 2 * n); // boss waves: no runners or tanks. Never more than 18
      this.spawned = 0;
      this.timer = this.boss ? 4 : 0.6;
      this.interval = Math.max(1.0, 2.3 - 0.13 * n) * (this.boss ? 2.5 : 1); // at least 1 s between spawns
      this.tankChance = Math.min(0.35, 0.12 + 0.04 * n);
      // 1-2 Calculator + Chalkboard, 3-4 Chalkboard + maths imps, 5 Mathematician,
      // 6-7 colour (Word Color slime + tank colour slime), 8-9 tank colour slime + eyedropper slime, 10 Rainbow Slime,
      // 11-12 Rabbit + Tortoise, 13-14 Chameleon + Tortoise, 15 Golden Goose
      const pos = TD.wavePos(n);
      // eyedropper waves (8-9) make you think, so they bring ~40% fewer enemies, spaced further apart
      if ((pos === 8 || pos === 9) && !this.boss) { this.total = Math.round(this.total * 0.6); this.interval *= 1.4; }
      // chameleon waves (13-14): ~20% fewer, a little more space between them
      if ((pos === 13 || pos === 14) && !this.boss) { this.total = Math.round(this.total * 0.8); this.interval *= 1.15; }
      const MIX = { 1: ['mfast', 'mtank'], 3: ['minion', 'mtank'], 6: ['color', 'ctank'], 8: ['cdrop', 'ctank'],
        11: ['rabbit', 'tortoise'], 13: ['chameleon', 'tortoise'] };
      const key = [13, 11, 8, 6, 3, 1].find((k) => pos >= k);
      [this.light, this.heavy] = MIX[key];
      this.speedMul = 1 + 0.02 * (n - 1); // +2% speed per wave
    }

    update(dt, game) {
      if (this.bossPending) {
        this.bossTimer -= dt;
        if (this.bossTimer <= 0) { this.bossPending = false; game.spawnBoss(this.boss, this.speedMul); }
      }
      if (this.spawned >= this.total) return;
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = this.interval * (0.7 + Math.random() * 0.6);
        this.spawned++;
        const r = Math.random();
        const kind = r < this.tankChance ? this.heavy : this.light;
        game.spawnEnemy(kind, this.speedMul);
      }
    }

    get done() { return this.spawned >= this.total && !this.bossPending; }
    get left() { return this.total - this.spawned + (this.bossPending ? 1 : 0); }
  }

  TD.WaveManager = WaveManager;
})();
