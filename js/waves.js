// Wave spawning. Each wave = more enemies, faster spawns, more tanks, slightly faster walk.
// Boss waves (4, 8, 12, ...) bring only the Mathematician (and the minions it summons).
(function () {
  const TD = (window.TD = window.TD || {});

  const bossFor = (n) => (n >= 4 && n % 4 === 0 ? 'math' : null);

  class WaveManager {
    constructor() { this.wave = 0; this.total = 0; this.spawned = 0; this.boss = null; }

    start(n) {
      this.wave = n;
      this.boss = bossFor(n);
      this.bossPending = !!this.boss;
      this.bossTimer = 1.2;
      this.total = this.boss ? 0 : 6 + 2 * n; // boss waves: no runners or tanks
      this.spawned = 0;
      this.timer = this.boss ? 4 : 0.6;
      this.interval = Math.max(0.55, 2.3 - 0.13 * n) * (this.boss ? 2.5 : 1);
      this.tankChance = Math.min(0.45, 0.12 + 0.04 * n);
      this.speedMul = 1 + 0.04 * (n - 1);
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
        game.spawnEnemy(Math.random() < this.tankChance ? 'tank' : 'runner', this.speedMul);
      }
    }

    get done() { return this.spawned >= this.total && !this.bossPending; }
    get left() { return this.total - this.spawned + (this.bossPending ? 1 : 0); }
  }

  TD.WaveManager = WaveManager;
})();
