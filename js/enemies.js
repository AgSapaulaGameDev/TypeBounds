// Enemy types and behaviour. Enemies walk to the base, then attack it on a timer.
(function () {
  const TD = (window.TD = window.TD || {});

  TD.EnemyTypes = {
    runner: { sprite: 'runner', speed: 24, dmg: 1, atkEvery: 1.0, list: 'short', animFps: 10, gold: 2,
      gore: ['#38b764', '#a7f070', '#257179', '#ffcd75'] },
    tank: { sprite: 'tank', speed: 7, dmg: 3, atkEvery: 1.6, list: 'long', animFps: 4, gold: 5,
      gore: ['#8b9bb4', '#566c86', '#c2c3c7', '#ef7d57'] },
  };

  let nextId = 1;

  class Enemy {
    constructor(kind, word, x, y, speedMul) {
      this.id = nextId++;
      this.kind = kind;
      this.t = TD.EnemyTypes[kind];
      this.word = word;
      this.progress = 0;     // letters typed correctly
      this.x = x;            // feet position
      this.y = y;
      this.speed = this.t.speed * speedMul;
      this.state = 'walk';   // walk | attack
      this.atkTimer = 0.4;
      this.anim = Math.random() * 10;
      this.age = 0;
      this.flash = 0;        // white hit flash
      this.hop = 0;          // attack hop
      this.shake = 0;        // label shake on typo
      this.face = 1;
      this.lx = 0; this.ly = null; this.lw = 0; // label layout
    }

    get frames() { return TD.Sprites[this.t.sprite]; }

    update(dt, game) {
      this.age += dt;
      this.anim += dt;
      if (this.flash > 0) this.flash -= dt;
      if (this.hop > 0) this.hop -= dt;
      if (this.shake > 0) this.shake -= dt;

      if (this.state === 'walk') {
        const dx = TD.BASE.cx - this.x, dy = TD.BASE.cy - this.y;
        const d = Math.hypot(dx, dy) || 1;
        if (Math.abs(dx) > 0.5) this.face = dx < 0 ? -1 : 1;
        this.x += (dx / d) * this.speed * dt;
        this.y += (dy / d) * this.speed * dt;
        if (game.wall.alive && TD.inRing(this.x, this.y)) {
          this.state = 'attack'; this.target = 'wall'; this.atkTimer = 0.3;
        } else if (TD.inBaseZone(this.x, this.y)) {
          this.state = 'attack'; this.target = 'base';
        }
      } else {
        if (this.target === 'wall' && !game.wall.alive) { this.state = 'walk'; return; }
        this.atkTimer -= dt;
        if (this.atkTimer <= 0) {
          this.atkTimer = this.t.atkEvery;
          this.hop = 0.15;
          if (this.target === 'wall') game.damageWall(this.t.dmg, this);
          else game.damageBase(this.t.dmg, this);
        }
      }
    }
  }

  TD.Enemy = Enemy;
})();
