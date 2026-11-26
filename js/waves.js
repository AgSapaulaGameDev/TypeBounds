// Wave spawning. Each wave = more enemies, faster spawns, more tanks, slightly faster walk.
(function () {
  const TD = (window.TD = window.TD || {});

  class WaveManager {
    constructor() { this.wave = 0; this.total = 0; this.spawned = 0; }

    start(n) {
      this.wave = n;
      this.total = 6 + 2 * n;
      this.spawned = 0;
      this.timer = 0.6;
      this.interval = Math.max(0.55, 2.3 - 0.13 * n);
      this.tankChance = Math.min(0.45, 0.12 + 0.04 * n);
      this.speedMul = 1 + 0.04 * (n - 1);
    }

    update(dt, game) {
      if (this.done) return;
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = this.interval * (0.7 + Math.random() * 0.6);
        this.spawned++;
        game.spawnEnemy(Math.random() < this.tankChance ? 'tank' : 'runner', this.speedMul);
      }
    }

    get done() { return this.spawned >= this.total; }
    get left() { return this.total - this.spawned; }
  }

  TD.WaveManager = WaveManager;
})();
