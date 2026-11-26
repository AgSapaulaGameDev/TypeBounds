// Enemy types and behaviour. Most enemies walk to the base, then attack it on a timer.
// The Mathematician is a boss: it roams, summons math minions, and only shows its word
// once all its minions are dead.
(function () {
  const TD = (window.TD = window.TD || {});

  TD.EnemyTypes = {
    runner: { sprite: 'runner', speed: 24, dmg: 1, atkEvery: 1.0, list: 'short', animFps: 10, gold: 2,
      gore: ['#38b764', '#a7f070', '#257179', '#ffcd75'] },
    tank: { sprite: 'tank', speed: 7, dmg: 3, atkEvery: 1.6, list: 'long', animFps: 4, gold: 5,
      gore: ['#8b9bb4', '#566c86', '#c2c3c7', '#ef7d57'] },
    // Word Color: word is a colour name drawn in a DIFFERENT ink colour; you type the word
    color: { sprite: 'slime', speed: 15, dmg: 2, atkEvery: 1.2, list: 'colors', animFps: 6, gold: 3,
      gore: ['#f4f4f4'] },
    // word = the answer, prefix = the question ("7+5=")
    minion: { sprite: 'minion', speed: 9, dmg: 1, atkEvery: 1.1, animFps: 8, gold: 1,
      gore: ['#5d275d', '#b13e53', '#ffcd75'] },
    math: { sprite: 'math', name: 'MATHEMATICIAN', boss: true, speed: 12, chargeSpeed: 14, dmg: 4, atkEvery: 1.5,
      list: 'long', animFps: 3, gold: 25, hitGold: 5, maxHp: 5, summonEvery: 5,
      gore: ['#3b5dc9', '#29366f', '#f4f4f4', '#ffcd75'] },
    // Rainbow Slime: summons Word Color slimes; its word is a long colour name.
    // A typo on its word makes it change colour and swap to a new word.
    rainbow: { sprite: 'bigSlime', name: 'RAINBOW SLIME', boss: true, minion: 'color', speed: 11, chargeSpeed: 13, dmg: 4,
      atkEvery: 1.5, list: 'longColors', animFps: 3, gold: 25, hitGold: 5, maxHp: 5, summonEvery: 5,
      gore: ['#e83b3b', '#f9a31b', '#ffd541', '#5ac54f', '#4d9be6', '#a884f3'] },
  };
  const RAINBOW = TD.EnemyTypes.rainbow.gore;

  // The boss wanders along a wide oval around the tower (left side -> over the top/bottom ->
  // right side and back), so it visits both sides and never walks through the middle.
  const ORBIT = { rx: 125, ry: 56 };
  function roamPoint(ang) {
    return { x: TD.BASE.cx + Math.cos(ang) * ORBIT.rx, y: TD.BASE.cy + 2 + Math.sin(ang) * ORBIT.ry, ang };
  }

  let nextId = 1;

  class Enemy {
    constructor(kind, word, x, y, speedMul) {
      this.id = nextId++;
      this.kind = kind;
      this.t = TD.EnemyTypes[kind];
      this.word = word;
      this.prefix = '';      // shown before the typed part (math minion question)
      this.hidden = false;   // true = word not shown / cannot be targeted
      this.progress = 0;     // letters typed correctly
      this.x = x;            // feet position
      this.y = y;
      this.mul = speedMul;
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
      if (this.t.boss) {
        this.hp = this.t.maxHp;
        this.hidden = true;  // starts hidden: it summons minions first
        this.cd = 1.5;       // first summon shortly after it arrives
        this.charging = false;
        this.dir = Math.random() < 0.5 ? -1 : 1; // which way round the oval it walks
        this.dest = roamPoint(Math.random() < 0.5 ? 0 : Math.PI);
        this.hue = 0; this.hueT = 0;
      }
    }

    get frames() {
      if (this.kind === 'rainbow') return TD.Sprites.bigSlime(RAINBOW[this.hue]);
      return this.ink ? TD.Sprites.slime(TD.Inks[this.ink]) : TD.Sprites[this.t.sprite];
    }
    get gore() { return this.ink ? [TD.Inks[this.ink], '#f4f4f4'] : this.t.gore; }
    // ink-rule slimes (drop tag): the label shows a decoy colour word, but the answer is the ink
    labelText() {
      if (this.hidden) return '???';
      if (this.inkRule) return '  ' + (this.progress ? this.word : this.shown); // room for the hue-wheel icon
      return this.prefix + this.word;
    }

    update(dt, game) {
      this.age += dt;
      this.anim += dt;
      if (this.flash > 0) this.flash -= dt;
      if (this.hop > 0) this.hop -= dt;
      if (this.shake > 0) this.shake -= dt;
      // Rainbow Slime shimmers through the rainbow while its word is hidden, holds still while you type
      if (this.kind === 'rainbow' && this.hidden && (this.hueT += dt) > 0.35) { this.hueT = 0; this.hue = (this.hue + 1) % RAINBOW.length; }
      if (this.t.boss && !this.charging) return this.roam(dt, game);
      this.walkAttack(dt, game);
    }

    walkAttack(dt, game) {
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

    // Boss: wander around. While any of its minions live, its word is hidden.
    // Once they are all dead the word shows and a 5 s countdown runs; at 0 it summons again.
    roam(dt, game) {
      const dx = this.dest.x - this.x, dy = this.dest.y - this.y, d = Math.hypot(dx, dy);
      if (d < 2) {
        if (Math.random() < 0.08) this.dir = -this.dir; // now and then turns back
        this.dest = roamPoint(this.dest.ang + this.dir * (0.35 + Math.random() * 0.35));
      }
      else {
        if (Math.abs(dx) > 0.5) this.face = dx < 0 ? -1 : 1;
        this.x += (dx / d) * this.speed * dt;
        this.y += (dy / d) * this.speed * dt;
      }
      const minionsAlive = game.enemies.some((m) => m.owner === this);
      if (minionsAlive) return;
      if (this.summoned && this.hidden) { this.hidden = false; this.progress = 0; this.cd = this.t.summonEvery; }
      this.cd -= dt;
      if (this.cd <= 0) this.summon(game);
    }

    // minions per summon: 3 on its 1st and 2nd life, 5 on its 3rd and 4th
    // Rainbow Slime: 3 on its 1st and 2nd life, 4 on its 3rd and 4th
    get minionCount() { return this.hp >= this.t.maxHp - 1 ? 3 : this.kind === 'rainbow' ? 4 : 5; }

    // Rainbow Slime: wrong letter -> new colour, new word, start over
    scramble(game) {
      this.hue = (this.hue + 1 + Math.floor(Math.random() * (RAINBOW.length - 1))) % RAINBOW.length;
      this.word = game.pickWord(this.t.list, this);
      this.progress = 0;
      this.flash = 0.15;
      if (game.locked === this) game.locked = null;
    }

    summon(game) {
      this.summoned = true;
      if (game.locked === this) game.locked = null;
      this.progress = 0;
      this.hidden = true;
      this.hop = 0.3;
      game.spawnMinions(this);
    }

    // Called when the boss's word is typed. Returns true if the boss died.
    bossHit(game) {
      this.hp--;
      this.progress = 0;
      if (this.hp <= 0) return true;
      if (this.hp === 1 && this.kind === 'rainbow') {
        this.splitting = true; // last life: bursts into 6 Word Color slimes (handled by the game)
      } else if (this.hp === 1) {
        // last stand: charges the tower, word is a long string of numbers
        this.charging = true;
        this.hidden = false;
        this.state = 'walk';
        this.speed = this.t.chargeSpeed * this.mul;
        if (this.kind === 'rainbow') {
          this.word = game.pickWord(this.t.list, this);
        } else {
          let n = '';
          for (let i = 0; i < 10; i++) n += Math.floor(Math.random() * 10);
          this.word = n;
        }
      } else {
        this.word = game.pickWord(this.t.list, this);
        this.summon(game);
      }
      return false;
    }
  }

  TD.Enemy = Enemy;
})();
