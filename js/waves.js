// Wave spawning. Each wave = more enemies, faster spawns, more tanks, slightly faster walk.
// Boss waves (every 5th) bring only the boss and the minions it summons.
(function () {
  const TD = (window.TD = window.TD || {});

  // waves 5, 15, 25 = Mathematician; 10, 20, 30 = Rainbow Slime
  const bossFor = (n) => (n % 10 === 0 ? 'rainbow' : n % 5 === 0 ? 'math' : null);

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
      // Word Color slimes join normal waves after the first boss (wave 6+)
      this.colorChance = n >= 6 ? Math.min(0.3, 0.15 + 0.02 * (n - 6)) : 0;
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
        const r = Math.random();
        const kind = r < this.tankChance ? 'tank' : r < this.tankChance + this.colorChance ? 'color' : 'runner';
        game.spawnEnemy(kind, this.speedMul);
      }
    }

    get done() { return this.spawned >= this.total && !this.bossPending; }
    get left() { return this.total - this.spawned + (this.bossPending ? 1 : 0); }
  }

  TD.WaveManager = WaveManager;
})();
