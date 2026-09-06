import Matter from 'matter-js';
import {
  clamp,
  direction,
  distance,
  seeded,
  sample,
  getStats,
  eligibleTechs,
  WEAPONS,
  STAGES,
  enemyTypes,
  segmentBox,
} from './rules.ts';
import type { Vec, WeaponId, FieldId, Stats, Tech, Checkpoint } from './rules.ts';
const { Engine, Bodies, Body, Composite, Query } = Matter;
export type Mode = 'title' | 'playing' | 'paused' | 'upgrade' | 'dead' | 'won';
export interface Input {
  left: boolean;
  right: boolean;
  crouch: boolean;
  jump: boolean;
  fire: boolean;
  field: boolean;
  interact: boolean;
  aim: Vec;
}
export interface Enemy {
  id: number;
  body: Matter.Body;
  type: string;
  hp: number;
  maxHp: number;
  timer: number;
  flash: number;
  phase: number;
}
export interface Shot {
  id: number;
  pos: Vec;
  prev: Vec;
  vel: Vec;
  damage: number;
  life: number;
  radius: number;
  friendly: boolean;
  kind: 'bullet' | 'grenade' | 'fragment';
  bounces: number;
  split: boolean;
  root: number;
  hits: Set<number>;
  color: string;
}
export interface Particle {
  pos: Vec;
  vel: Vec;
  life: number;
  max: number;
  color: string;
  size: number;
}
export interface Beam {
  from: Vec;
  to: Vec;
  life: number;
  color: string;
  width: number;
}
export interface Drop {
  pos: Vec;
  type: 'health' | 'energy';
  phase: number;
}
export interface Prop {
  body: Matter.Body;
  launched: boolean;
  hitAt: Map<number, number>;
  impactSpeed?: number;
}
const ENEMY_STATS: Record<string, { hp: number; size: number; color: string }> = {
  crawler: { hp: 38, size: 19, color: '#ff7f75' },
  sentry: { hp: 45, size: 22, color: '#ffb864' },
  hopper: { hp: 56, size: 23, color: '#e9a1ed' },
  drone: { hp: 34, size: 19, color: '#ffb864' },
  bulwark: { hp: 135, size: 35, color: '#ff8178' },
  boss: { hp: 950, size: 70, color: '#f8a362' },
};
export const ENEMY_COLORS = Object.fromEntries(
  Object.entries(ENEMY_STATS).map(([k, v]) => [k, v.color]),
);
export const WORLD = { width: 2300, height: 950, floor: 810 };
export class Game {
  engine = Engine.create({ gravity: { x: 0, y: 1, scale: 0.001 } });
  player!: Matter.Body;
  terrain: Matter.Body[] = [];
  props: Prop[] = [];
  enemies: Enemy[] = [];
  shots: Shot[] = [];
  particles: Particle[] = [];
  beams: Beam[] = [];
  drops: Drop[] = [];
  mode: Mode = 'title';
  seed = '';
  stage = 0;
  hp = 100;
  energy = 100;
  techs: string[] = [];
  weapons: WeaponId[] = ['coil'];
  weapon: WeaponId = 'coil';
  field: FieldId = 'repulsor';
  stats: Stats = getStats([]);
  time = 0;
  elapsed = 0;
  kills = 0;
  shotCount = 0;
  clear = false;
  grounded = false;
  crouching = false;
  fieldActive = false;
  held: Prop | null = null;
  feedbackAt = -100;
  shootAt = 0;
  hurtAt = -100;
  spendAt = -100;
  coyote = 0;
  jumpBuffer = 0;
  airJumps = 0;
  notice = '';
  noticeTime = 0;
  shake = 0;
  aim: Vec = { x: 500, y: 600 };
  offers: Tech[] = [];
  weaponReward: WeaponId | null = null;
  rewardTaken = false;
  id = 0;
  rootCredit = new Map<number, number>();
  rng = seeded('combat');
  lootRng = seeded('loot');
  onChange: () => void = () => {};
  onSound: (kind: string) => void = () => {};
  onCheckpoint: (save: Checkpoint | null) => void = () => {};
  constructor() {
    this.loadRoom(true);
  }
  start(seed: string, field: FieldId, save?: Checkpoint) {
    this.seed = seed.slice(0, 40) || 'FOUNDRY';
    this.stage = save?.stage ?? 0;
    this.field = save?.field ?? field;
    this.techs = save ? [...save.techs] : [];
    this.weapons = save ? [...save.weapons] : ['coil'];
    this.weapon = save?.weapon ?? 'coil';
    this.stats = getStats(this.techs);
    this.hp = save?.hp ?? 100;
    this.energy = save?.energy ?? 100;
    this.kills = save?.kills ?? 0;
    this.elapsed = save?.elapsed ?? 0;
    this.time = 0;
    this.shootAt = 0;
    this.hurtAt = -100;
    this.spendAt = -100;
    this.feedbackAt = -100;
    this.shotCount = 0;
    this.loadRoom();
    this.setMode('playing');
    this.toast(STAGES[this.stage].name, 2);
    this.save();
  }
  setMode(mode: Mode) {
    this.mode = mode;
    this.onChange();
  }
  toast(text: string, seconds = 2) {
    this.notice = text;
    this.noticeTime = seconds;
  }
  save() {
    this.onCheckpoint({
      version: 1,
      seed: this.seed,
      stage: this.stage,
      hp: this.hp,
      energy: this.energy,
      techs: [...this.techs],
      weapons: [...this.weapons],
      weapon: this.weapon,
      field: this.field,
      kills: this.kills,
      elapsed: this.elapsed,
    });
  }
  loadRoom(demo = false) {
    Composite.clear(this.engine.world, false);
    Engine.clear(this.engine);
    this.terrain = [];
    this.props = [];
    this.enemies = [];
    this.shots = [];
    this.particles = [];
    this.beams = [];
    this.drops = [];
    this.held = null;
    this.clear = false;
    this.fieldActive = false;
    this.crouching = false;
    this.grounded = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.airJumps = 0;
    this.rewardTaken = false;
    this.rootCredit.clear();
    this.rng = seeded(this.seed + ':combat:' + this.stage);
    this.lootRng = seeded(this.seed + ':loot:' + this.stage);
    const roomRng = seeded(this.seed + ':room:' + this.stage);
    const wall = (x: number, y: number, w: number, h: number) => {
      const b = Bodies.rectangle(x, y, w, h, { isStatic: true, friction: 0.7, label: 'terrain' });
      this.terrain.push(b);
      Composite.add(this.engine.world, b);
    };
    wall(WORLD.width / 2, 850, WORLD.width, 80);
    wall(-35, 460, 70, 1000);
    wall(WORLD.width + 35, 460, 70, 1000);
    wall(WORLD.width / 2, -50, WORLD.width, 100);
    const variants = [
      [
        [530, 665, 250],
        [1030, 540, 280],
        [1570, 660, 290],
        [1880, 460, 210],
      ],
      [
        [570, 650, 330],
        [1080, 500, 220],
        [1540, 625, 310],
        [1930, 450, 220],
      ],
      [
        [480, 650, 220],
        [900, 490, 260],
        [1330, 655, 320],
        [1770, 505, 300],
      ],
    ];
    const layout = variants[Math.floor(roomRng() * variants.length)];
    if (this.stage !== 5) for (const [x, y, w] of layout) wall(x, y, w, 24);
    else {
      wall(540, 660, 270, 24);
      wall(1750, 660, 270, 24);
    }
    for (let i = 0; i < (this.stage === 5 ? 5 : 9); i++) {
      const x = 360 + roomRng() * 1650;
      const size = 28 + roomRng() * 22;
      const body = Bodies.rectangle(x, 750 - roomRng() * 35, size, size, {
        density: 0.0018,
        friction: 0.5,
        restitution: 0.25,
        label: 'prop',
      });
      this.props.push({ body, launched: false, hitAt: new Map() });
      Composite.add(this.engine.world, body);
    }
    this.player = Bodies.rectangle(demo ? 320 : 150, 735, 30, 46, {
      inertia: Infinity,
      friction: 0,
      frictionAir: 0.022,
      restitution: 0,
      density: 0.002,
      label: 'player',
    });
    Composite.add(this.engine.world, this.player);
    const types = enemyTypes(this.stage, roomRng);
    types.forEach((type, i) => {
      const x =
        type === 'boss' ? 1650 : 680 + (i % (this.stage > 2 ? 7 : 5)) * 210 + roomRng() * 90;
      const y = type === 'drone' ? 340 + roomRng() * 140 : type === 'boss' ? 400 : 760;
      this.spawnEnemy(type, x, y);
    });
    if (!demo) {
      this.drops.push({ pos: { x: 400, y: 765 }, type: 'energy', phase: 0 });
      if (this.stage > 0) this.drops.push({ pos: { x: 270, y: 765 }, type: 'health', phase: 1 });
    }
  }
  spawnEnemy(type: string, x: number, y: number) {
    if (this.enemies.length >= 36) return;
    const s = ENEMY_STATS[type];
    const body = Bodies.polygon(
      x,
      y,
      type === 'sentry' ? 3 : type === 'bulwark' ? 6 : type === 'boss' ? 8 : 5,
      s.size,
      {
        density: type === 'boss' ? 0.008 : 0.002,
        friction: 0.3,
        frictionAir: type === 'drone' ? 0.06 : 0.025,
        inertia: Infinity,
        restitution: 0.05,
        label: 'enemy',
      },
    );
    if (type === 'sentry') Body.setStatic(body, true);
    this.enemies.push({
      id: ++this.id,
      body,
      type,
      hp: s.hp,
      maxHp: s.hp,
      timer: 1 + this.rng(),
      flash: 0,
      phase: 0,
    });
    Composite.add(this.engine.world, body);
  }
  equip(id: WeaponId) {
    if (this.weapons.includes(id)) {
      this.weapon = id;
      this.onSound('switch');
      this.onChange();
    }
  }
  cycleWeapon() {
    this.equip(this.weapons[(this.weapons.indexOf(this.weapon) + 1) % this.weapons.length]);
  }
  tick(dt: number, input: Input) {
    if (this.mode !== 'playing') return;
    this.time += dt;
    this.elapsed += dt;
    this.aim = { ...input.aim };
    this.noticeTime = Math.max(0, this.noticeTime - dt);
    this.shake *= 0.86;
    this.grounded =
      Query.ray(
        [...this.terrain, ...this.props.filter((p) => p !== this.held).map((p) => p.body)],
        { x: this.player.position.x, y: this.player.bounds.max.y - 1 },
        { x: this.player.position.x, y: this.player.bounds.max.y + 7 },
        20,
      ).length > 0;
    this.coyote = this.grounded ? 0.1 : Math.max(0, this.coyote - dt);
    if (this.grounded) this.airJumps = 0;
    if (input.jump) this.jumpBuffer = 0.12;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (input.crouch !== this.crouching) {
      if (input.crouch) {
        Body.scale(this.player, 1, 0.62);
        Body.setInertia(this.player, Infinity);
        Body.translate(this.player, { x: 0, y: 8.74 });
        this.crouching = true;
      } else {
        const check = {
          min: { x: this.player.position.x - 14, y: this.player.bounds.min.y - 18 },
          max: { x: this.player.position.x + 14, y: this.player.bounds.min.y },
        };
        if (!Query.region([...this.terrain, ...this.props.map((p) => p.body)], check).length) {
          Body.scale(this.player, 1, 1 / 0.62);
          Body.setInertia(this.player, Infinity);
          Body.translate(this.player, { x: 0, y: -8.74 });
          this.crouching = false;
        }
      }
    }
    const move = Number(input.right) - Number(input.left);
    const acceleration = this.grounded ? 0.75 : this.stats.airJump ? 0.62 : 0.39;
    let vx = this.player.velocity.x;
    if (move) vx += move * acceleration;
    else if (this.grounded) vx *= 0.77;
    const max = this.crouching ? 3 : 6.2;
    if (move && Math.sign(vx) === move && Math.abs(vx) > max) vx += (move * max - vx) * 0.16;
    Body.setVelocity(this.player, {
      x: clamp(vx, -17, 17),
      y: clamp(this.player.velocity.y, -21, 20),
    });
    if (this.jumpBuffer > 0 && (this.coyote > 0 || (this.stats.airJump && this.airJumps < 1))) {
      if (this.coyote <= 0) this.airJumps++;
      Body.setVelocity(this.player, { x: this.player.velocity.x, y: -11.8 });
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.grounded = false;
      this.onSound('jump');
      this.burst(this.player.position, 8, '#8af4d3', 2);
    }
    this.updateField(input.field, dt);
    if (input.fire && !input.field && this.time >= this.shootAt) this.fire();
    if (this.time - this.spendAt > 0.55 && !this.fieldActive) {
      const extra = this.stats.emergency && this.hp < this.stats.maxHp * 0.35 ? 14 : 0;
      this.energy = clamp(this.energy + (this.stats.regen + extra) * dt, 0, this.stats.maxEnergy);
    }
    for (const e of [...this.enemies]) {
      this.updateEnemy(e, dt);
      if (this.mode !== 'playing') return;
    }
    for (const p of this.props) p.impactSpeed = p.body.speed;
    Engine.update(this.engine, 1000 / 60);
    this.updateProps();
    this.updateShots(dt);
    if (this.mode !== 'playing') return;
    this.updateDrops(dt);
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      p.pos.x += p.vel.x * dt * 60;
      p.pos.y += p.vel.y * dt * 60;
      p.vel.y += 0.02;
      return p.life > 0;
    });
    this.beams = this.beams.filter((b) => (b.life -= dt) > 0);
    if (this.player.position.y > 1000) this.damagePlayer(999);
    if (this.mode !== 'playing') return;
    if (this.enemies.length === 0 && !this.clear) {
      this.clear = true;
      this.shots = this.shots.filter((s) => s.friendly);
      this.toast('Exit open →', 2);
      this.onSound('clear');
      this.onChange();
    }
    if (this.clear && input.interact && distance(this.player.position, { x: 2190, y: 750 }) < 115) {
      if (this.stage === 5) {
        this.setMode('won');
        this.onCheckpoint(null);
        this.onSound('win');
      } else this.openReward();
    }
  }
  spend(amount: number) {
    if (amount <= 0) return true;
    if (this.energy < amount) return false;
    this.energy = Math.max(0, this.energy - amount);
    this.spendAt = this.time;
    return true;
  }
  fire() {
    const w = WEAPONS[this.weapon];
    if (!this.spend(w.cost * this.stats.cost)) {
      this.shootAt = this.time + 0.15;
      this.toast('Low energy · press 1 for coil driver', 1);
      return;
    }
    this.shootAt = this.time + w.interval * this.stats.interval;
    this.shotCount++;
    const root = ++this.id;
    this.rootCredit.set(root, 0);
    if (this.rootCredit.size > 250) this.rootCredit.delete(this.rootCredit.keys().next().value!);
    const dir = direction(this.player.position, this.aim),
      origin = {
        x: this.player.position.x + dir.x * 29,
        y: this.player.position.y - 3 + dir.y * 29,
      };
    Body.setVelocity(this.player, {
      x: this.player.velocity.x - dir.x * w.recoil * this.stats.recoil,
      y: this.player.velocity.y - dir.y * w.recoil * this.stats.recoil,
    });
    this.shake += this.weapon === 'mortar' ? 4 : this.weapon === 'scatter' ? 2 : 0.5;
    this.onSound(this.weapon);
    if (this.weapon === 'lance') {
      this.laser(origin, dir, w.damage * this.stats.damage, root);
      return;
    }
    const count = this.weapon === 'scatter' ? 7 : 1;
    for (let i = 0; i < count; i++) {
      const angle =
        Math.atan2(dir.y, dir.x) + (count > 1 ? (i - 3) * 0.065 + (this.rng() - 0.5) * 0.022 : 0);
      this.addShot({
        pos: { ...origin },
        vel: { x: Math.cos(angle) * w.speed, y: Math.sin(angle) * w.speed },
        damage: w.damage * this.stats.damage,
        life: this.weapon === 'scatter' ? 0.7 : this.weapon === 'mortar' ? 1.15 : 1.7,
        radius: this.weapon === 'mortar' ? 7 : 3,
        friendly: true,
        kind: this.weapon === 'mortar' ? 'grenade' : 'bullet',
        bounces: this.weapon === 'mortar' ? 20 : this.stats.bounce,
        split: false,
        root,
        color: w.color,
      });
    }
    this.burst(origin, 4, w.color, 1.7);
  }
  addShot(data: Omit<Shot, 'id' | 'prev' | 'hits'>) {
    if (this.shots.length >= 220) return;
    this.shots.push({ ...data, id: ++this.id, prev: { ...data.pos }, hits: new Set() });
  }
  laser(origin: Vec, dir: Vec, damage: number, root: number) {
    const end = { x: origin.x + dir.x * 1300, y: origin.y + dir.y * 1300 };
    let wallT = 1;
    for (const body of [...this.terrain, ...this.props.map((p) => p.body)]) {
      const hit = segmentBox(origin, end, body.bounds.min, body.bounds.max);
      if (hit) wallT = Math.min(wallT, hit.t);
    }
    const hits = this.enemies
      .map((e) => ({ e, hit: segmentBox(origin, end, e.body.bounds.min, e.body.bounds.max) }))
      .filter((x) => x.hit && x.hit.t < wallT)
      .sort((a, b) => a.hit!.t - b.hit!.t);
    let endT = wallT;
    for (let i = 0; i < hits.length && i <= this.stats.pierce; i++) {
      const { e, hit } = hits[i];
      this.hitEnemy(e, damage * Math.pow(0.7, i), 'direct', root);
      if (i === this.stats.pierce) endT = hit!.t;
    }
    const target = {
      x: origin.x + (end.x - origin.x) * endT,
      y: origin.y + (end.y - origin.y) * endT,
    };
    this.beams.push({ from: origin, to: target, life: 0.12, color: '#8df7dc', width: 3 });
    this.burst(target, 5, '#8df7dc', 2);
  }
  updateField(active: boolean, dt: number) {
    const was = this.fieldActive;
    this.fieldActive = active && this.energy > 0.8;
    if (!this.fieldActive) {
      if (this.held) this.releaseProp();
      return;
    }
    this.spend((this.field === 'repulsor' ? 22 : 10) * this.stats.fieldCost * dt);
    const center = this.player.position;
    if (this.field === 'repulsor') {
      for (const e of this.enemies) {
        const d = distance(center, e.body.position);
        if (d < 175 && e.type !== 'boss' && !e.body.isStatic) {
          const n = direction(center, e.body.position);
          Body.applyForce(e.body, e.body.position, {
            x: n.x * 0.005 * e.body.mass,
            y: n.y * 0.004 * e.body.mass,
          });
        }
      }
      for (const p of this.props) {
        if (distance(center, p.body.position) < 165) {
          const n = direction(center, p.body.position);
          Body.applyForce(p.body, p.body.position, {
            x: n.x * 0.004 * p.body.mass,
            y: n.y * 0.003 * p.body.mass,
          });
          p.launched = true;
        }
      }
      for (const s of this.shots) {
        if (!s.friendly && distance(center, s.pos) < 175 && this.spend(3 * this.stats.fieldCost)) {
          s.friendly = true;
          s.root = ++this.id;
          s.kind = 'fragment';
          s.color = '#8df7dc';
          const d = direction(center, s.pos);
          s.vel = { x: d.x * 14, y: d.y * 14 };
          s.damage *= 1.5;
          s.life = 2;
          if (this.stats.feedback && this.time - this.feedbackAt >= 3) {
            this.hp = Math.min(this.stats.maxHp, this.hp + 5);
            this.feedbackAt = this.time;
          }
          this.burst(s.pos, 4, '#8df7dc', 1);
        }
      }
    } else {
      if (!this.held) {
        this.held =
          this.props
            .filter((p) => distance(center, p.body.position) < 200)
            .sort(
              (a, b) => distance(a.body.position, this.aim) - distance(b.body.position, this.aim),
            )[0] ?? null;
      }
      if (this.held) {
        const d = direction(center, this.aim),
          target = { x: center.x + d.x * 85, y: center.y + d.y * 85 };
        const body = this.held.body;
        Body.setVelocity(body, {
          x: (target.x - body.position.x) * 0.2,
          y: (target.y - body.position.y) * 0.2 - 0.27,
        });
        Body.setAngularVelocity(body, 0.025);
        this.held.launched = false;
      } else
        for (const e of this.enemies) {
          if (!e.body.isStatic && e.type !== 'boss' && distance(center, e.body.position) < 240) {
            const n = direction(e.body.position, center);
            Body.applyForce(e.body, e.body.position, {
              x: n.x * 0.001 * e.body.mass,
              y: n.y * 0.001 * e.body.mass,
            });
          }
        }
    }
    if (!was) this.onSound('field');
  }
  releaseProp() {
    if (!this.held) return;
    const p = this.held;
    this.held = null;
    if (this.spend(8 * this.stats.fieldCost)) {
      const d = direction(this.player.position, this.aim);
      Body.setVelocity(p.body, { x: d.x * 20, y: d.y * 20 });
      p.launched = true;
      p.hitAt.clear();
      this.onSound('scatter');
      this.burst(p.body.position, 8, '#8df7dc', 2);
    }
  }
  updateProps() {
    for (const p of this.props) {
      if (p.body.position.y > 1000) {
        Composite.remove(this.engine.world, p.body);
        continue;
      }
      const speed = p.impactSpeed ?? p.body.speed;
      if (p === this.held || !p.launched || speed < 3.5) continue;
      const collisions = Query.collides(
        p.body,
        this.enemies.map((e) => e.body),
      );
      for (const c of collisions) {
        const body = c.bodyA === p.body ? c.bodyB : c.bodyA,
          e = this.enemies.find((x) => x.body === body);
        if (!e || this.time - (p.hitAt.get(e.id) ?? -100) < 0.4) continue;
        p.hitAt.set(e.id, this.time);
        const dmg = clamp(speed * p.body.mass * 1.8, 6, 50);
        this.hitEnemy(e, dmg, 'prop', 0);
        if (this.stats.conductive)
          for (const other of this.enemies
            .filter((x) => x.id !== e.id && distance(x.body.position, e.body.position) < 180)
            .slice(0, 2)) {
            this.beams.push({
              from: { ...e.body.position },
              to: { ...other.body.position },
              life: 0.2,
              color: '#a7d4ff',
              width: 2,
            });
            this.hitEnemy(other, 12, 'chain', 0);
          }
      }
    }
    this.props = this.props.filter((p) => p.body.position.y <= 1000);
  }
  updateEnemy(e: Enemy, dt: number) {
    if (e.hp <= 0) return;
    e.timer -= dt;
    e.flash = Math.max(0, e.flash - dt);
    const p = e.body.position,
      delta = direction(p, this.player.position),
      dist = distance(p, this.player.position);
    if (e.type === 'drone' || e.type === 'boss') {
      Body.applyForce(e.body, p, { x: 0, y: -e.body.mass * 0.001 });
      const desiredY =
        e.type === 'boss'
          ? 380 + Math.sin(this.time * 0.8) * 90
          : this.player.position.y - 170 + Math.sin(this.time + e.id) * 60;
      Body.setVelocity(e.body, {
        x: clamp((this.player.position.x + (delta.x > 0 ? -340 : 340) - p.x) * 0.007, -2.5, 2.5),
        y: clamp((desiredY - p.y) * 0.025, -3, 3),
      });
    } else if (e.type !== 'sentry') {
      const speed = e.type === 'bulwark' ? 1.25 : e.type === 'hopper' ? 2 : 2.6;
      Body.setVelocity(e.body, {
        x: e.body.velocity.x + (delta.x * speed - e.body.velocity.x) * 0.07,
        y: e.body.velocity.y,
      });
      if (e.type === 'hopper' && e.timer <= 0) {
        Body.setVelocity(e.body, { x: delta.x * 5, y: -10 });
        e.timer = 1.5;
      } else if (
        e.type !== 'hopper' &&
        Math.abs(e.body.velocity.x) < 0.5 &&
        dist > 75 &&
        e.timer <= 0
      ) {
        Body.setVelocity(e.body, { x: delta.x * 5, y: -9 });
        e.timer = 2;
      }
    }
    if (e.type === 'sentry' || e.type === 'drone') {
      if (e.timer < 0.35 && dist < 1200) e.flash = 0.08;
      if (e.timer <= 0) {
        if (dist < 1200) {
          const count = e.type === 'drone' ? 3 : 1;
          for (let i = 0; i < count; i++)
            this.enemyShot(e, Math.atan2(delta.y, delta.x) + (i - (count - 1) / 2) * 0.16, 7, 9);
          this.onSound('enemy');
        }
        e.timer = e.type === 'drone' ? 2.3 : 1.65;
      }
    }
    if (e.type === 'boss') {
      if (e.timer < 0.55) e.flash = 0.1;
      if (e.timer <= 0) {
        e.phase++;
        const angle = Math.atan2(delta.y, delta.x);
        if (e.phase % 3 === 0) {
          for (let i = 0; i < 14; i++)
            this.enemyShot(e, (i * Math.PI) / 7 + this.time * 0.1, 6, 12);
          if (this.enemies.length < 5) {
            this.spawnEnemy('drone', p.x - 100, p.y + 60);
            this.spawnEnemy('drone', p.x + 100, p.y + 60);
          }
        } else {
          for (let i = -2; i <= 2; i++) this.enemyShot(e, angle + i * 0.15, 8.5, 13);
        }
        e.timer = e.hp < e.maxHp / 2 ? 1.6 : 2.15;
        this.onSound('boss');
        this.shake += 2;
      }
    }
    if (Query.collides(this.player, [e.body]).length)
      this.damagePlayer(e.type === 'boss' ? 22 : e.type === 'bulwark' ? 18 : 10, e.body.position);
    if (p.y > 1000) this.hitEnemy(e, 999, 'fall', 0);
  }
  enemyShot(e: Enemy, angle: number, speed: number, damage: number) {
    const d = { x: Math.cos(angle), y: Math.sin(angle) };
    this.addShot({
      pos: {
        x: e.body.position.x + d.x * (ENEMY_STATS[e.type].size + 10),
        y: e.body.position.y + d.y * (ENEMY_STATS[e.type].size + 10),
      },
      vel: { x: d.x * speed, y: d.y * speed },
      damage,
      life: 4,
      radius: 5,
      friendly: false,
      kind: 'bullet',
      bounces: 0,
      split: true,
      root: 0,
      color: '#ff7975',
    });
  }
  updateShots(dt: number) {
    const current = [...this.shots];
    for (const s of current) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.prev = { ...s.pos };
      if (s.kind === 'grenade') s.vel.y += 0.19;
      const next = { x: s.pos.x + s.vel.x * dt * 60, y: s.pos.y + s.vel.y * dt * 60 };
      let nearest: { t: number; normal: Vec; body: Matter.Body; enemy?: Enemy } | null = null;
      const targets: [Matter.Body, Enemy?][] = [
        ...this.terrain.map((b) => [b] as [Matter.Body]),
        ...this.props.map((p) => [p.body] as [Matter.Body]),
      ];
      if (s.friendly) {
        for (const e of this.enemies) if (!s.hits.has(e.id)) targets.push([e.body, e]);
      } else targets.push([this.player]);
      for (const [body, enemy] of targets) {
        const hit = segmentBox(
          s.pos,
          next,
          { x: body.bounds.min.x - s.radius, y: body.bounds.min.y - s.radius },
          { x: body.bounds.max.x + s.radius, y: body.bounds.max.y + s.radius },
        );
        if (hit && (!nearest || hit.t < nearest.t)) nearest = { ...hit, body, enemy };
      }
      if (nearest) {
        s.pos = {
          x: s.pos.x + (next.x - s.pos.x) * nearest.t,
          y: s.pos.y + (next.y - s.pos.y) * nearest.t,
        };
        if (nearest.enemy) {
          if (s.kind === 'grenade') {
            this.explode(s);
            s.life = 0;
          } else {
            this.hitEnemy(
              nearest.enemy,
              s.damage,
              s.kind === 'fragment' ? 'secondary' : 'direct',
              s.root,
            );
            s.hits.add(nearest.enemy.id);
            Body.applyForce(nearest.enemy.body, nearest.enemy.body.position, {
              x: s.vel.x * 0.00012 * this.stats.recoil,
              y: s.vel.y * 0.00012 * this.stats.recoil,
            });
            this.fragment(s);
            s.life = 0;
          }
        } else if (nearest.body === this.player) {
          this.damagePlayer(s.damage, s.pos);
          s.life = 0;
          if (this.mode !== 'playing') return;
        } else {
          const prop = this.props.find((p) => p.body === nearest!.body);
          if (prop) {
            Body.applyForce(prop.body, prop.body.position, {
              x: s.vel.x * 0.0004,
              y: s.vel.y * 0.0004,
            });
            if (s.friendly) prop.launched = true;
          }
          if (s.kind !== 'grenade') this.fragment(s);
          if (s.bounces > 0) {
            const dot = s.vel.x * nearest.normal.x + s.vel.y * nearest.normal.y;
            s.vel.x -= 2 * dot * nearest.normal.x;
            s.vel.y -= 2 * dot * nearest.normal.y;
            if (s.kind === 'grenade') {
              s.vel.x *= 0.75;
              s.vel.y *= 0.75;
            }
            s.bounces--;
            s.pos.x += nearest.normal.x * (s.radius + 1);
            s.pos.y += nearest.normal.y * (s.radius + 1);
          } else s.life = 0;
          this.burst(s.pos, 3, s.color, 1.4);
        }
      } else s.pos = next;
      if (s.life <= 0 && s.kind === 'grenade') this.explode(s);
      if (s.pos.x < -60 || s.pos.x > WORLD.width + 60 || s.pos.y > 1050 || s.pos.y < -300)
        s.life = 0;
    }
    this.shots = this.shots.filter((s) => s.life > 0);
  }
  fragment(s: Shot) {
    if (!this.stats.fragments || !s.friendly || s.split || s.kind === 'fragment') return;
    s.split = true;
    const count = s.kind === 'grenade' ? 8 : 3;
    for (let i = 0; i < count; i++) {
      const a = this.rng() * Math.PI * 2;
      this.addShot({
        pos: { ...s.pos },
        vel: { x: Math.cos(a) * 10, y: Math.sin(a) * 10 },
        damage: 5 * this.stats.damage,
        life: 0.65,
        radius: 2,
        friendly: true,
        kind: 'fragment',
        bounces: 0,
        split: true,
        root: s.root,
        color: '#ffcb94',
      });
    }
  }
  explode(s: Shot) {
    if (s.damage === 0) return;
    const damage = s.damage;
    s.damage = 0;
    const radius = 130 * this.stats.blast;
    for (const e of [...this.enemies]) {
      const d = distance(s.pos, e.body.position);
      if (d < radius + 25) {
        this.hitEnemy(
          e,
          damage *
            (this.techs.includes('cluster') ? 1.15 : 1) *
            (1 - 0.65 * clamp(d / radius, 0, 1)),
          'explosion',
          s.root,
        );
        const n = direction(s.pos, e.body.position);
        Body.setVelocity(e.body, { x: n.x * 10, y: n.y * 10 - 3 });
      }
    }
    for (const body of [this.player, ...this.props.map((p) => p.body)]) {
      const d = distance(s.pos, body.position);
      if (d < radius) {
        const n = direction(s.pos, body.position);
        Body.setVelocity(body, {
          x: body.velocity.x + n.x * 10 * (1 - d / radius),
          y: body.velocity.y + n.y * 13 * (1 - d / radius) - 3,
        });
      }
    }
    for (const p of this.props) if (distance(p.body.position, s.pos) < radius) p.launched = true;
    this.fragment(s);
    this.burst(s.pos, 32, '#e5b1ff', 7);
    this.beams.push({
      from: { ...s.pos },
      to: { x: radius, y: 0 },
      life: 0.3,
      color: 'explosion',
      width: radius,
    });
    this.shake += 7;
    this.onSound('explosion');
  }
  hitEnemy(e: Enemy, damage: number, source: string, root: number) {
    if (e.hp <= 0) return;
    e.hp -= damage;
    e.flash = 0.11;
    if (source === 'direct' && this.stats.induction) {
      const credited = this.rootCredit.get(root) ?? 0;
      if (credited < 4) {
        this.energy = Math.min(this.stats.maxEnergy, this.energy + 1);
        this.rootCredit.set(root, credited + 1);
      }
    }
    this.burst(e.body.position, 3, ENEMY_COLORS[e.type], 2);
    if (e.hp <= 0) {
      this.kills++;
      this.burst(
        e.body.position,
        e.type === 'boss' ? 70 : 18,
        ENEMY_COLORS[e.type],
        e.type === 'boss' ? 9 : 4,
      );
      Composite.remove(this.engine.world, e.body);
      this.enemies = this.enemies.filter((x) => x !== e);
      this.onSound('kill');
      this.shake += 1;
      const roll = this.lootRng();
      this.drops.push({
        pos: { ...e.body.position },
        type: roll < 0.2 ? 'health' : 'energy',
        phase: roll * 10,
      });
      if (this.stats.salvage && this.lootRng() < 0.3)
        this.drops.push({
          pos: { x: e.body.position.x + 15, y: e.body.position.y },
          type: 'health',
          phase: 0,
        });
      if (e.type === 'boss') {
        for (const other of [...this.enemies]) this.hitEnemy(other, 9999, 'reactor', 0);
      }
    }
  }
  damagePlayer(amount: number, from?: Vec) {
    if (this.mode !== 'playing' || this.time - this.hurtAt < 0.6) return;
    this.hp = Math.max(0, this.hp - amount);
    this.hurtAt = this.time;
    this.shake += 7;
    this.burst(this.player.position, 16, '#ff7f75', 3);
    this.onSound('hurt');
    if (from) {
      const d = direction(from, this.player.position);
      Body.setVelocity(this.player, { x: this.player.velocity.x + d.x * 5, y: -4 });
    }
    if (this.hp <= 0) {
      this.setMode('dead');
      this.onCheckpoint(null);
      this.onSound('dead');
    }
  }
  updateDrops(dt: number) {
    this.drops = this.drops.filter((d) => {
      d.phase += dt;
      const dist = distance(d.pos, this.player.position);
      if (dist < 160) {
        const dir = direction(d.pos, this.player.position);
        d.pos.x += dir.x * dt * 360;
        d.pos.y += dir.y * dt * 360;
      } else d.pos.y = Math.min(780, d.pos.y + dt * 80);
      if (dist < 30) {
        if (d.type === 'health') this.hp = Math.min(this.stats.maxHp, this.hp + 18);
        else this.energy = Math.min(this.stats.maxEnergy, this.energy + 25);
        this.onSound('pickup');
        this.burst(d.pos, 7, d.type === 'health' ? '#a1f0ab' : '#8df7dc', 2);
        return false;
      }
      return true;
    });
  }
  burst(pos: Vec, count: number, color: string, speed: number) {
    for (let i = 0; i < count && this.particles.length < 450; i++) {
      const a = Math.random() * Math.PI * 2,
        v = Math.random() * speed,
        life = 0.2 + Math.random() * 0.4;
      this.particles.push({
        pos: { ...pos },
        vel: { x: Math.cos(a) * v, y: Math.sin(a) * v },
        life,
        max: life,
        color,
        size: 1 + Math.random() * 2,
      });
    }
  }
  openReward() {
    this.offers = sample(eligibleTechs(this.techs, this.weapons, this.field), 3, this.lootRng);
    const next: WeaponId[] = ['scatter', 'lance', 'mortar'];
    this.weaponReward = next[this.stage] ?? null;
    this.setMode('upgrade');
    this.onSound('clear');
  }
  chooseTech(id: string) {
    if (this.mode !== 'upgrade' || this.rewardTaken || !this.offers.some((t) => t.id === id))
      return;
    this.rewardTaken = true;
    this.techs.push(id);
    this.stats = getStats(this.techs);
    if (id === 'armor') this.hp = Math.min(this.stats.maxHp, this.hp + 30);
    if (this.weaponReward && !this.weapons.includes(this.weaponReward)) {
      this.weapons.push(this.weaponReward);
      this.weapon = this.weaponReward;
    }
    this.hp = Math.min(this.stats.maxHp, this.hp + 12);
    this.energy = this.stats.maxEnergy;
    this.stage++;
    this.loadRoom();
    this.setMode('playing');
    this.toast(STAGES[this.stage].name, 2);
    this.save();
    this.onSound('upgrade');
  }
}
