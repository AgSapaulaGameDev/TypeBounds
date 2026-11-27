// Enemy types and behaviour. Most enemies walk to the base, then attack it on a timer.
// The Mathematician is a boss: it roams, summons math minions, and only shows its word
// once all its minions are dead.
(function () {
  const TD = (window.TD = window.TD || {});

  TD.EnemyTypes = {
    // ARCHIVED for now (not spawned): original runner and tank, kept for later
    runner: { sprite: 'runner', speed: 24, dmg: 1, atkEvery: 1.0, list: 'short', animFps: 10, gold: 2,
      gore: ['#38b764', '#a7f070', '#257179', '#ffcd75'] },
    tank: { sprite: 'tank', speed: 7, dmg: 3, atkEvery: 1.6, list: 'long', animFps: 4, gold: 5,
      gore: ['#8b9bb4', '#566c86', '#c2c3c7', '#ef7d57'] },
    // Math theme (waves 1-4): fast Calculator (short number words), slow Chalkboard tank (long number words)
    mfast: { sprite: 'calc', speed: 24, dmg: 1, atkEvery: 1.0, list: 'numShort', animFps: 10, gold: 2,
      gore: ['#a7f070', '#566c86', '#f4f4f4', '#e83b3b'] },
    mtank: { sprite: 'board', heavy: true, speed: 7, dmg: 3, atkEvery: 1.6, list: 'numLong', animFps: 4, gold: 5,
      gore: ['#2b5e48', '#8a5a32', '#f4f4f4'] },
    // Colour theme (waves 6-9): tank colour slime = medium slime with a long colour word, slower
    ctank: { sprite: 'medSlime', heavy: true, speed: 8, dmg: 3, atkEvery: 1.6, list: 'longColors', animFps: 4, gold: 5,
      gore: ['#f4f4f4'] },
    // Word Color: word is a colour name drawn in a DIFFERENT ink colour; you type the word
    color: { sprite: 'slime', speed: 15, dmg: 2, atkEvery: 1.2, list: 'colors', animFps: 6, gold: 3,
      gore: ['#f4f4f4'] },
    // word = the answer, prefix = the question ("7+5=")
    minion: { sprite: 'minion', speed: 9, dmg: 1, atkEvery: 1.1, animFps: 8, gold: 1,
      gore: ['#5d275d', '#b13e53', '#ffcd75'] },
    math: { sprite: 'math', name: 'MATHEMATICIAN', boss: true, speed: 12, chargeSpeed: 14, dmg: 4, atkEvery: 1.5,
      list: 'mathTerms', animFps: 3, gold: 25, hitGold: 5, maxHp: 5, summonEvery: 5,
      gore: ['#3b5dc9', '#29366f', '#f4f4f4', '#ffcd75'] },
    // medium slime from the Rainbow Slime's last life: word is a tertiary colour (e.g. redorange)
    medslime: { sprite: 'medSlime', speed: 9, dmg: 2, atkEvery: 1.2, list: 'tertiary', animFps: 5, gold: 4,
      gore: ['#f4f4f4'] },
    // Rainbow Slime: summons Word Color slimes; its word is a long colour name.
    // A typo on its word makes it change colour and swap to a new word.
    rainbow: { sprite: 'bigSlime', name: 'RAINBOW SLIME', boss: true, minion: 'color', speed: 11, chargeSpeed: 13, dmg: 4,
      atkEvery: 1.5, list: 'longColors', animFps: 3, gold: 25, hitGold: 5, maxHp: 5, summonEvery: 5,
      gore: ['#e83b3b', '#f9a31b', '#ffd541', '#5ac54f', '#4d9be6', '#a884f3'] },
    // Animal theme (waves 11-14): Rabbit hops fast (short animals), Tortoise tank hides in its shell
    // on a typo (long animals), Chameleon camouflages every few seconds (medium animals)
    rabbit: { sprite: 'rabbit', speed: 17, dmg: 1, atkEvery: 1.0, list: 'animalShort', animFps: 0, gold: 2,
      gore: ['#c2c3c7', '#f4f4f4', '#f5a097'] },
    tortoise: { sprite: 'tortoise', heavy: true, speed: 5.5, dmg: 3, atkEvery: 1.8, list: 'animalLong', animFps: 3, gold: 6,
      gore: ['#4f7a3a', '#c2a36b', '#a7c06a'] },
    chameleon: { sprite: 'chameleon', speed: 11, dmg: 2, atkEvery: 1.2, list: 'animalMed', animFps: 5, gold: 4,
      gore: ['#ef7d57', '#ffcd75', '#5ac54f'] },
    // Golden Goose (wave 15): no word, can't be typed. Runs around laying eggs; golden eggs are your ammo.
    goose: { sprite: 'goose', name: 'GOLDEN GOOSE', boss: true, noLabel: true, speed: 26, dmg: 0, atkEvery: 1,
      animFps: 8, gold: 25, hitGold: 5, maxHp: 5, gore: ['#ffd541', '#f9a31b', '#fff4a3', '#f4f4f4'] },
    egg: { sprite: 'egg', speed: 0, dmg: 0, atkEvery: 1, list: 'eggWords', animFps: 0, gold: 1,
      gore: ['#f4f4f4', '#c2c3c7', '#ffe762'] },
    gegg: { sprite: 'gegg', speed: 0, dmg: 0, atkEvery: 1, list: 'goldWords', animFps: 0, gold: 2,
      gore: ['#ffd541', '#f9a31b', '#fff4a3'] },
    chick: { sprite: 'chick', speed: 22, dmg: 2, atkEvery: 1, list: 'eggWords', animFps: 10, gold: 1,
      gore: ['#ffe762', '#ef7d57'] },
  };
  const RAINBOW = TD.EnemyTypes.rainbow.gore;

  // The boss wanders along a wide oval around the tower (left side -> over the top/bottom ->
  // right side and back), so it visits both sides and never walks through the middle.
  const ORBIT = { rx: 125, ry: 56 };
  function roamPoint(ang) {
    return { x: TD.BASE.cx + Math.cos(ang) * ORBIT.rx, y: TD.BASE.cy + 2 + Math.sin(ang) * ORBIT.ry, ang };
  }

  const HOP = { every: 0.62, air: 0.32, height: 5 }; // rabbit: hop for 0.32 s, sit for 0.3 s
  const CAMO = { seen: 3.0, period: 4.2 };            // chameleon: visible 3 s, camouflaged 1.2 s
  const clampField = (e) => { e.x = Math.max(10, Math.min(310, e.x)); e.y = Math.max(28, Math.min(170, e.y)); };

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
      if (kind === 'goose') { this.mode = 'walk'; this.layCd = 1.2; this.layN = 0; this.anger = 0; this.finalCd = 0; }
      if (kind === 'chameleon') { this.camoT = Math.random() * 2.8; this.camo = false; }
      if (kind === 'rabbit') this.hopT = Math.random() * HOP.every;
      this.shell = 0; this.lift = 0;
    }

    get frames() {
      if (this.kind === 'rainbow') return TD.Sprites.bigSlime(RAINBOW[this.hue]);
      if (this.kind === 'chameleon' && this.camo) return TD.Sprites.chameleonCamo;
      if (this.ink) return this.t.sprite === 'medSlime' ? TD.Sprites.medSlime(TD.inkHex(this.ink)) : TD.Sprites.slime(TD.inkHex(this.ink));
      return TD.Sprites[this.t.sprite];
    }
    get gore() { return this.ink ? [TD.inkHex(this.ink), '#f4f4f4'] : this.t.gore; }
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
      if (this.kind === 'goose') return this.gooseUpdate(dt, game);
      if (this.kind === 'egg' || this.kind === 'gegg') return this.eggUpdate(dt, game);
      if (this.kind === 'chameleon') {
        // camouflaged: an untouched chameleon can't be targeted; one you started stays typeable (blind)
        this.camoT += dt;
        this.camo = this.camoT % CAMO.period > CAMO.seen;
        this.hidden = this.camo && this.progress === 0;
      }
      if (this.shell > 0) { // tortoise hiding in its shell after a typo: word hidden, doesn't move
        this.shell -= dt;
        if (this.shell <= 0) { this.shell = 0; this.hidden = false; }
        return;
      }
      if (this.t.boss && !this.charging) return this.roam(dt, game);
      this.walkAttack(dt, game);
    }

    // rabbit: quick hops with pauses in between; returns how much of this frame it moves
    hopStep(dt) {
      this.hopT = (this.hopT + dt) % HOP.every;
      const air = this.hopT < HOP.air;
      this.lift = air ? Math.sin((this.hopT / HOP.air) * Math.PI) * HOP.height : 0;
      this.air = air;
      return air ? 1 : 0;
    }

    // white egg: hatches into a chick when its timer runs out. golden egg: the goose snatches it back.
    eggUpdate(dt, game) {
      if (this.drop > 0) this.drop = Math.max(0, this.drop - dt);
      if (this.drop > 0) return;
      this.life -= dt;
      if (this.life <= 0) game.eggExpire(this);
    }

    // Golden Goose: runs fast round the tower zig-zagging and laying eggs. On its last life it flies up
    // and drops 3 golden eggs; type all 3 before they vanish or it lands and tries again.
    gooseUpdate(dt, game) {
      const sp = this.t.speed * this.mul * (1 + 0.10 * this.anger);
      const fly = (tx, ty, v) => {
        const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
        if (Math.abs(dx) > 0.5) this.face = dx < 0 ? -1 : 1;
        if (d < 2) return true;
        const k = Math.min(d, v * dt) / d;
        this.x += dx * k; this.y += dy * k;
        return false;
      };
      if (this.mode === 'up') { if (fly(TD.BASE.cx, 34, 60)) { this.mode = 'drop'; game.dropFinalEggs(this); } return; }
      if (this.mode === 'drop') { this.y = 34 + Math.sin(this.age * 3) * 2; return; }
      if (this.mode === 'down') { if (fly(this.dest.x, this.dest.y, 60)) { this.mode = 'walk'; this.finalCd = 6; } return; }
      // walk: roam the oval, zig-zagging across the path
      const dx = this.dest.x - this.x, dy = this.dest.y - this.y, d = Math.hypot(dx, dy);
      if (d < 3) {
        if (Math.random() < 0.15) this.dir = -this.dir;
        this.dest = roamPoint(this.dest.ang + this.dir * (0.4 + Math.random() * 0.4));
      } else {
        if (Math.abs(dx) > 0.5) this.face = dx < 0 ? -1 : 1;
        const zig = Math.sin(this.age * 7) * 0.8;
        this.x += ((dx - dy * zig) / d) * sp * dt;
        this.y += ((dy + dx * zig) / d) * sp * dt;
        clampField(this);
      }
      if (this.hp === 1) { // last life: lay white eggs for a bit, then fly up for the final drop
        this.finalCd -= dt;
        if (this.finalCd <= 0) { this.mode = 'up'; return; }
      }
      this.layCd -= dt;
      if (this.layCd > 0) return;
      this.layCd = Math.max(1.0, 2.3 - 0.3 * this.anger);
      const mine = game.enemies.filter((m) => m.owner === this);
      if (mine.length >= 3 + this.anger) return;
      const hasGold = mine.some((m) => m.kind === 'gegg');
      const golden = this.hp > 1 && !hasGold && (this.layN % 3 === 2 || Math.random() < 0.3);
      this.layN++;
      this.hop = 0.2;
      game.layEgg(this, golden);
    }

    walkAttack(dt, game) {
      if (this.state === 'walk') {
        const dx = TD.BASE.cx - this.x, dy = TD.BASE.cy - this.y;
        const d = Math.hypot(dx, dy) || 1;
        if (Math.abs(dx) > 0.5) this.face = dx < 0 ? -1 : 1;
        const mv = this.kind === 'rabbit' ? this.hopStep(dt) * 1.9 : 1;
        this.x += (dx / d) * this.speed * dt * mv;
        this.y += (dy / d) * this.speed * dt * mv;
        if (game.wall.alive && TD.inRing(this.x, this.y)) {
          this.state = 'attack'; this.target = 'wall'; this.atkTimer = 0.3;
        } else if (TD.inBaseZone(this.x, this.y)) {
          this.state = 'attack'; this.target = 'base';
        }
      } else {
        if (this.target === 'wall' && !game.wall.alive) { this.state = 'walk'; return; }
        this.atkTimer -= dt;
        if (this.kind === 'rabbit') this.lift = 0;
        if (this.atkTimer <= 0) {
          if (this.kind === 'chick') return game.chickHit(this); // one peck, then the goose robs you
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
