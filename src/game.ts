import Matter from 'matter-js';
import {
  clamp,
  direction,
  distance,
  seeded,
  sample,
  getGun,
  MODS,
  STAGES,
  segmentBox,
} from './rules.ts';
import type { Vec, Gun, Mod, Checkpoint } from './rules.ts';
import { getLevel } from './levels.ts';
import type { Level, EnemyKind } from './levels.ts';
export type { EnemyKind } from './levels.ts';
const { Engine, Bodies, Body, Composite, Query } = Matter;
export type Mode = 'title' | 'playing' | 'paused' | 'upgrade' | 'dead' | 'won';
export interface Input {
  left: boolean;
  right: boolean;
  jump: boolean;
  jumpHeld: boolean;
  fire: boolean;
  firePressed?: boolean;
  aim: Vec;
}
export interface Enemy {
  id: number;
  body: Matter.Body;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  timer: number;
  flash: number;
  spawn: number;
  phase: number;
  aim: Vec;
}
export interface Shot {
  id: number;
  pos: Vec;
  prev: Vec;
  vel: Vec;
  damage: number;
  life: number;
  friendly: boolean;
  radius: number;
  bounces: number;
  pierce: number;
  fragment: boolean;
  split: boolean;
  hits: Set<number>;
}
export interface Particle {
  pos: Vec;
  vel: Vec;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: 'spark' | 'ring' | 'shell';
}
export const WORLD = { width: 2000, height: 840, floor: 740 };
export class Game {
  engine = Engine.create({ gravity: { x: 0, y: 1, scale: 0.001 } });
  player!: Matter.Body;
  level!: Level;
  terrain: Matter.Body[] = [];
  enemies: Enemy[] = [];
  shots: Shot[] = [];
  particles: Particle[] = [];
  trail: Vec[] = [];
  mode: Mode = 'title';
  seed = '';
  stage = 0;
  hp = 100;
  mods: string[] = [];
  gun: Gun = getGun([]);
  elapsed = 0;
  time = 0;
  kills = 0;
  shotCount = 0;
  id = 0;
  grounded = false;
  clear = false;
  clearAt = 0;
  aim: Vec = { x: 650, y: 550 };
  shootAt = 0;
  hurtAt = -100;
  jumpAt = -100;
  lastShot = -100;
  coyote = 0;
  jumpBuffer = 0;
  fireBuffer = 0;
  jumpCut = false;
  shake = 0;
  kick: Vec = { x: 0, y: 0 };
  hitStop = 0;
  muzzle = 0;
  land = 0;
  offers: Mod[] = [];
  rng = seeded('run');
  rewardTaken = false;
  onChange: () => void = () => {};
  onSound: (kind: string) => void = () => {};
  onCheckpoint: (save: Checkpoint | null) => void = () => {};
  constructor() {
    this.loadRoom();
  }
  setMode(mode: Mode) {
    this.mode = mode;
    this.onChange();
  }
  start(seed: string, save?: Checkpoint) {
    this.seed = seed.slice(0, 40) || 'RECOIL';
    this.stage = save?.stage ?? 0;
    this.hp = save?.hp ?? 100;
    this.mods = save ? [...save.mods] : [];
    this.gun = getGun(this.mods);
    this.elapsed = save?.elapsed ?? 0;
    this.kills = save?.kills ?? 0;
    this.time = 0;
    this.shotCount = 0;
    this.shootAt = 0;
    this.hurtAt = -100;
    this.lastShot = -100;
    this.loadRoom();
    this.setMode('playing');
    this.save();
  }
  save() {
    this.onCheckpoint({
      version: 3,
      seed: this.seed,
      stage: this.stage,
      hp: this.hp,
      mods: [...this.mods],
      kills: this.kills,
      elapsed: this.elapsed,
    });
  }
  loadRoom() {
    Composite.clear(this.engine.world, false);
    Engine.clear(this.engine);
    this.terrain = [];
    this.enemies = [];
    this.shots = [];
    this.particles = [];
    this.trail = [];
    this.clear = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.fireBuffer = 0;
    this.jumpCut = false;
    this.jumpAt = -100;
    this.grounded = false;
    this.rewardTaken = false;
    this.shake = 0;
    this.kick = { x: 0, y: 0 };
    this.hitStop = 0;
    this.muzzle = 0;
    this.land = 0;
    this.shootAt = this.time;
    this.rng = seeded(this.seed + ':' + this.stage);
    const wall = (x: number, y: number, w: number, h: number) => {
      const b = Bodies.rectangle(x, y, w, h, { isStatic: true, friction: 0, label: 'terrain' });
      this.terrain.push(b);
      Composite.add(this.engine.world, b);
    };
    wall(1000, 790, 2000, 100);
    wall(-30, 400, 60, 900);
    wall(2030, 400, 60, 900);
    wall(1000, -40, 2000, 80);
    this.level = getLevel(this.seed, this.stage);
    for (const solid of this.level.solids)
      wall(solid.x + solid.w / 2, solid.y + solid.h / 2, solid.w, solid.h);
    this.player = Bodies.rectangle(140, 680, 26, 36, {
      inertia: Infinity,
      friction: 0,
      frictionAir: 0.008,
      restitution: 0,
      chamfer: { radius: 4 },
      label: 'player',
    });
    Composite.add(this.engine.world, this.player);
    for (const spawn of this.level.spawns) this.spawnEnemy(spawn.kind, spawn.x, spawn.y);
  }
  spawnEnemy(kind: EnemyKind, x: number, y: number) {
    if (this.enemies.length >= 14) return;
    const size = kind === 'boss' ? 90 : kind === 'runner' ? 30 : 36;
    const body =
      kind === 'flyer'
        ? Bodies.circle(x, y, 19, { frictionAir: 0.035, inertia: Infinity, label: 'enemy' })
        : Bodies.rectangle(x, y, size, kind === 'boss' ? 76 : 32, {
            friction: 0.05,
            frictionAir: 0.03,
            inertia: Infinity,
            chamfer: { radius: 3 },
            label: 'enemy',
          });
    const hp = kind === 'boss' ? 850 : kind === 'runner' ? 52 : kind === 'flyer' ? 48 : 70;
    if (kind === 'shooter') Body.setStatic(body, true);
    Composite.add(this.engine.world, body);
    this.enemies.push({
      id: ++this.id,
      body,
      kind,
      hp,
      maxHp: hp,
      timer: 1.1 + this.rng(),
      flash: 0,
      spawn: 0.65,
      phase: 0,
      aim: { x: -1, y: 0 },
    });
  }
  feedback(amount: number, dir: Vec = { x: 0, y: 0 }) {
    this.shake = Math.min(12, this.shake + amount);
    this.kick.x = clamp(this.kick.x - dir.x * amount * 0.65, -10, 10);
    this.kick.y = clamp(this.kick.y - dir.y * amount * 0.65, -10, 10);
  }
  tick(dt: number, input: Input) {
    if (this.mode !== 'playing') return;
    this.shake *= 0.8;
    this.kick.x *= 0.72;
    this.kick.y *= 0.72;
    this.muzzle = Math.max(0, this.muzzle - dt);
    this.land = Math.max(0, this.land - dt);
    // Keep jump taps through the tiny impact pause.
    if (input.jump) this.jumpBuffer = 0.12;
    if (input.firePressed) this.fireBuffer = 0.12;
    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - dt);
      return;
    }
    this.time += dt;
    this.elapsed += dt;
    this.aim = { ...input.aim };
    const wasGrounded = this.grounded,
      vy = this.player.velocity.y;
    this.grounded =
      vy >= -1 &&
      Query.ray(
        this.terrain,
        { x: this.player.position.x, y: this.player.bounds.max.y - 2 },
        { x: this.player.position.x, y: this.player.bounds.max.y + 5 },
        18,
      ).length > 0;
    if (this.grounded && !wasGrounded && vy > 2) {
      this.land = 0.13;
      this.feedback(Math.min(3, vy * 0.15));
      this.burst({ x: this.player.position.x, y: this.player.bounds.max.y }, 8, '#697477', 2);
      this.onSound('land');
    }
    this.coyote = this.grounded ? 0.1 : Math.max(0, this.coyote - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.fireBuffer = Math.max(0, this.fireBuffer - dt);
    const move = Number(input.right) - Number(input.left),
      max = 7.3 * this.gun.speed;
    let vx = this.player.velocity.x;
    // Steering never clamps a recoil boost back to walking speed.
    if (move && (Math.sign(vx) !== move || Math.abs(vx) < max))
      vx += move * (this.grounded ? 1.05 : 0.42) * this.gun.speed;
    if (this.grounded && !move) vx *= 0.72;
    Body.setVelocity(this.player, { x: clamp(vx, -23, 23), y: clamp(vy, -21, 20) });
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      Body.setVelocity(this.player, { x: this.player.velocity.x, y: -11.6 });
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.grounded = false;
      this.jumpAt = this.time;
      this.jumpCut = false;
      this.onSound('jump');
      this.burst({ x: this.player.position.x, y: this.player.bounds.max.y }, 7, '#818d90', 1.8);
    }
    if (
      !input.jumpHeld &&
      !this.jumpCut &&
      this.time - this.jumpAt >= 0 &&
      this.time - this.jumpAt < 0.25 &&
      this.player.velocity.y < -3
    ) {
      // A shot takes ownership of flight; releasing jump must not erase its impulse.
      if (this.lastShot < this.jumpAt)
        Body.setVelocity(this.player, {
          x: this.player.velocity.x,
          y: this.player.velocity.y * 0.55,
        });
      this.jumpCut = true;
    }
    if ((input.fire || this.fireBuffer > 0) && this.time >= this.shootAt) {
      this.fire();
      this.fireBuffer = 0;
    }
    for (const e of [...this.enemies]) {
      this.updateEnemy(e, dt);
      if (this.mode !== 'playing') return;
    }
    Engine.update(this.engine, 1000 / 60);
    this.containPlayer();
    this.updateShots(dt);
    if (this.mode !== 'playing') return;
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      p.pos.x += p.vel.x * dt * 60;
      p.pos.y += p.vel.y * dt * 60;
      p.vel.y += p.kind === 'shell' ? 0.15 : 0.035;
      return p.life > 0;
    });
    this.trail.unshift({ ...this.player.position });
    if (this.trail.length > 9) this.trail.pop();
    if (this.player.position.y > 900 || !Number.isFinite(this.player.position.x)) {
      this.hp = 0;
      this.die();
      return;
    }
    if (!this.enemies.length && !this.clear) {
      this.clear = true;
      this.clearAt = this.time;
      this.shots = this.shots.filter((s) => s.friendly);
      this.onSound('clear');
      this.onChange();
    }
    if (
      this.clear &&
      this.time - this.clearAt > 0.4 &&
      this.player.position.x > 1870 &&
      this.player.position.y > 590
    ) {
      if (this.stage === STAGES - 1) {
        this.setMode('won');
        this.onCheckpoint(null);
        this.onSound('win');
      } else this.openReward();
    }
  }
  containPlayer() {
    const p = this.player.position,
      v = this.player.velocity;
    // Matter's broad-phase bounds include velocity; use the actual hull extents here.
    const halfW = Math.max(...this.player.vertices.map((v) => Math.abs(v.x - p.x))),
      halfH = Math.max(...this.player.vertices.map((v) => Math.abs(v.y - p.y)));
    const x = clamp(p.x, halfW, WORLD.width - halfW),
      y = clamp(p.y, halfH, WORLD.floor - halfH);
    if (x === p.x && y === p.y) return;
    // Keep tangential momentum when a boosted shot hits an arena boundary.
    const vx = x !== p.x && ((p.x < x && v.x < 0) || (p.x > x && v.x > 0)) ? 0 : v.x;
    const vy = y !== p.y && ((p.y < y && v.y < 0) || (p.y > y && v.y > 0)) ? 0 : v.y;
    Body.setPosition(this.player, { x, y });
    Body.setVelocity(this.player, { x: vx, y: vy });
  }
  fire() {
    this.shootAt = this.time + this.gun.interval;
    this.lastShot = this.time;
    this.shotCount++;
    this.muzzle = 0.065;
    const d = direction(this.player.position, this.aim);
    if (d.x === 0 && d.y === 0) d.x = 1;
    const impulse = this.gun.recoil * (this.grounded ? 0.21 : 1);
    Body.setVelocity(this.player, {
      x: clamp(this.player.velocity.x - d.x * impulse, -23, 23),
      y: clamp(this.player.velocity.y - d.y * impulse, -21, 20),
    });
    this.feedback(this.grounded ? 2.2 : 3.8, d);
    this.onSound(
      this.mods.includes('magnum') ? 'heavy' : this.mods.includes('scatter') ? 'scatter' : 'shot',
    );
    const pos = { x: this.player.position.x + d.x * 26, y: this.player.position.y - 3 + d.y * 26 };
    for (let i = 0; i < this.gun.pellets; i++) {
      const a = Math.atan2(d.y, d.x) + (i - (this.gun.pellets - 1) / 2) * this.gun.spread;
      this.addShot({
        pos: { ...pos },
        vel: { x: Math.cos(a) * 30, y: Math.sin(a) * 30 },
        damage: this.gun.damage * (this.grounded ? 1 : this.gun.airDamage),
        life: 1.4,
        friendly: true,
        radius: this.mods.includes('magnum') ? 4 : 2.5,
        bounces: this.gun.bounces,
        pierce: this.gun.pierce,
        fragment: false,
        split: false,
      });
    }
    this.burst(pos, 4, '#ffcc84', 3, d);
    if (this.particles.length < 220)
      this.particles.push({
        pos: { ...this.player.position },
        vel: { x: -d.x * 2 + (this.rng() - 0.5), y: -2.8 },
        life: 0.6,
        max: 0.6,
        size: 2,
        color: '#bdae84',
        kind: 'shell',
      });
  }
  addShot(data: Omit<Shot, 'id' | 'prev' | 'hits'>) {
    if (this.shots.length >= 180) return;
    this.shots.push({ ...data, id: ++this.id, prev: { ...data.pos }, hits: new Set() });
  }
  updateEnemy(e: Enemy, dt: number) {
    e.flash = Math.max(0, e.flash - dt);
    e.spawn = Math.max(0, e.spawn - dt);
    if (e.spawn > 0) return;
    e.timer -= dt;
    const p = e.body.position,
      d = direction(p, this.player.position),
      dist = distance(p, this.player.position);
    if (e.kind === 'runner') {
      Body.setVelocity(e.body, {
        x: e.body.velocity.x + (d.x * 2.5 - e.body.velocity.x) * 0.08,
        y: e.body.velocity.y,
      });
      const grounded =
        Query.ray(
          this.terrain,
          { x: p.x, y: e.body.bounds.max.y - 2 },
          { x: p.x, y: e.body.bounds.max.y + 5 },
          20,
        ).length > 0;
      const blocked =
        Query.ray(
          this.terrain,
          { x: p.x, y: p.y + 8 },
          { x: p.x + Math.sign(d.x) * 45, y: p.y + 8 },
          12,
        ).length > 0;
      if (
        e.timer <= 0 &&
        grounded &&
        dist > 60 &&
        (blocked ||
          Math.abs(e.body.velocity.x) < 0.7 ||
          (this.player.position.y < p.y - 60 && dist < 280))
      ) {
        Body.setVelocity(e.body, { x: d.x * 4.5, y: -11.8 });
        e.timer = 0.9;
      }
    } else if (e.kind === 'flyer' || e.kind === 'boss') {
      Body.applyForce(e.body, p, { x: 0, y: -e.body.mass * 0.001 });
      const height =
        e.kind === 'boss'
          ? 310 + Math.sin(this.time) * 60
          : clamp(this.player.position.y - 190, 220, 500);
      Body.setVelocity(e.body, {
        x: clamp((this.player.position.x - d.x * 350 - p.x) * 0.009, -2.4, 2.4),
        y: clamp((height - p.y) * 0.04, -3, 3),
      });
    }
    if (e.kind !== 'runner') {
      if (e.timer > 0.35) e.aim = d;
      if (e.timer <= 0 && dist < 1450) {
        const base = Math.atan2(e.aim.y, e.aim.x);
        const count = e.kind === 'boss' ? 5 : e.kind === 'flyer' ? 3 : 1;
        for (let i = 0; i < count; i++)
          this.enemyShot(e, base + (i - (count - 1) / 2) * (e.kind === 'boss' ? 0.17 : 0.18));
        e.phase++;
        e.timer = e.kind === 'boss' ? 1.6 : e.kind === 'flyer' ? 2.3 : 1.8;
        this.onSound('enemy');
        if (e.kind === 'boss' && e.phase % 5 === 0 && this.enemies.length < 4)
          this.spawnEnemy('flyer', clamp(p.x + 200, 450, 1700), 280);
      } else if (e.timer <= 0) e.timer = 0.8;
    }
    if (Query.collides(this.player, [e.body]).length)
      this.damagePlayer(e.kind === 'boss' ? 25 : 15, p);
    if (p.y > 900) this.hitEnemy(e, 9999);
  }
  enemyShot(e: Enemy, a: number) {
    const d = { x: Math.cos(a), y: Math.sin(a) },
      radius = e.kind === 'boss' ? 55 : 26;
    this.addShot({
      pos: { x: e.body.position.x + d.x * radius, y: e.body.position.y + d.y * radius },
      vel: { x: d.x * 6.7, y: d.y * 6.7 },
      damage: e.kind === 'boss' ? 16 : 12,
      life: 4,
      friendly: false,
      radius: 5,
      bounces: 0,
      pierce: 0,
      fragment: false,
      split: true,
    });
  }
  updateShots(dt: number) {
    for (const s of [...this.shots]) {
      s.life -= dt;
      s.prev = { ...s.pos };
      let remaining = dt * 60;
      for (let attempt = 0; attempt < 4 && remaining > 0.001 && s.life > 0; attempt++) {
        const end = { x: s.pos.x + s.vel.x * remaining, y: s.pos.y + s.vel.y * remaining };
        let nearest: { t: number; normal: Vec; enemy?: Enemy; player?: boolean } | null = null;
        const targets: [Matter.Body, Enemy?, boolean?][] = this.terrain.map((b) => [b]);
        if (s.friendly) {
          for (const e of this.enemies)
            if (!s.hits.has(e.id) && e.spawn <= 0) targets.push([e.body, e]);
        } else targets.push([this.player, undefined, true]);
        for (const [body, enemy, player] of targets) {
          const h = segmentBox(
            s.pos,
            end,
            { x: body.bounds.min.x - s.radius, y: body.bounds.min.y - s.radius },
            { x: body.bounds.max.x + s.radius, y: body.bounds.max.y + s.radius },
          );
          if (h && (!nearest || h.t < nearest.t)) nearest = { ...h, enemy, player };
        }
        if (!nearest) {
          s.pos = end;
          break;
        }
        s.pos = {
          x: s.pos.x + (end.x - s.pos.x) * nearest.t,
          y: s.pos.y + (end.y - s.pos.y) * nearest.t,
        };
        remaining *= 1 - nearest.t;
        if (nearest.enemy) {
          const e = nearest.enemy;
          s.hits.add(e.id);
          this.hitEnemy(e, s.damage);
          this.splitShot(s);
          if (!e.body.isStatic)
            Body.setVelocity(e.body, {
              x: e.body.velocity.x + s.vel.x * 0.12,
              y: e.body.velocity.y + s.vel.y * 0.09,
            });
          if (s.pierce > 0) {
            s.pierce--;
            s.damage *= 0.8;
            const d = direction({ x: 0, y: 0 }, s.vel);
            s.pos.x += d.x;
            s.pos.y += d.y;
          } else s.life = 0;
        } else if (nearest.player) {
          this.damagePlayer(s.damage, s.pos);
          s.life = 0;
          if (this.mode !== 'playing') return;
        } else {
          this.burst(s.pos, 3, s.friendly ? '#bcbdb2' : '#ef7264', 1.5);
          this.splitShot(s);
          if (s.bounces > 0) {
            const dot = s.vel.x * nearest.normal.x + s.vel.y * nearest.normal.y;
            s.vel.x -= 2 * dot * nearest.normal.x;
            s.vel.y -= 2 * dot * nearest.normal.y;
            s.bounces--;
            s.pos.x += nearest.normal.x;
            s.pos.y += nearest.normal.y;
          } else s.life = 0;
        }
      }
      if (s.pos.x < -50 || s.pos.x > 2050 || s.pos.y < -100 || s.pos.y > 900) s.life = 0;
    }
    this.shots = this.shots.filter((s) => s.life > 0);
  }
  splitShot(s: Shot) {
    if (!this.gun.fragments || s.split || !s.friendly || s.fragment) return;
    s.split = true;
    for (let i = 0; i < 3; i++) {
      const a = this.rng() * Math.PI * 2;
      this.addShot({
        pos: { ...s.pos },
        vel: { x: Math.cos(a) * 16, y: Math.sin(a) * 16 },
        damage: s.damage * 0.2,
        life: 0.4,
        friendly: true,
        radius: 2,
        bounces: 0,
        pierce: 0,
        fragment: true,
        split: true,
      });
    }
  }
  hitEnemy(e: Enemy, damage: number) {
    if (e.hp <= 0) return;
    e.hp -= damage;
    e.flash = 0.08;
    this.burst(e.body.position, 4, '#f28a79', 2.3);
    this.onSound('hit');
    if (e.hp > 0) return;
    this.kills++;
    this.hp = Math.min(100, this.hp + this.gun.heal);
    Composite.remove(this.engine.world, e.body);
    this.enemies = this.enemies.filter((x) => x !== e);
    this.feedback(e.kind === 'boss' ? 10 : 4);
    this.hitStop = Math.max(this.hitStop, e.kind === 'boss' ? 0.075 : 0.035);
    this.burst(e.body.position, e.kind === 'boss' ? 45 : 16, '#f28371', e.kind === 'boss' ? 8 : 4);
    if (this.particles.length < 220)
      this.particles.push({
        pos: { ...e.body.position },
        vel: { x: 0, y: 0 },
        life: 0.25,
        max: 0.25,
        size: e.kind === 'boss' ? 120 : 45,
        color: '#f28371',
        kind: 'ring',
      });
    this.onSound('kill');
    if (e.kind === 'boss') for (const other of [...this.enemies]) this.hitEnemy(other, 9999);
  }
  damagePlayer(amount: number, from?: Vec) {
    if (this.mode !== 'playing' || this.time - this.hurtAt < 0.75) return;
    this.hp = Math.max(0, this.hp - amount);
    this.hurtAt = this.time;
    this.feedback(8);
    this.hitStop = 0.045;
    this.burst(this.player.position, 12, '#f5eee1', 3);
    this.onSound('hurt');
    if (from) {
      const d = direction(from, this.player.position);
      Body.setVelocity(this.player, { x: clamp(this.player.velocity.x + d.x * 4, -23, 23), y: -5 });
    }
    if (this.hp <= 0) this.die();
  }
  die() {
    this.setMode('dead');
    this.onCheckpoint(null);
    this.onSound('dead');
  }
  burst(pos: Vec, count: number, color: string, speed: number, dir?: Vec) {
    for (let i = 0; i < count && this.particles.length < 220; i++) {
      const angle = dir
        ? Math.atan2(dir.y, dir.x) + (Math.random() - 0.5) * 1.4
        : Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random()),
        life = 0.12 + Math.random() * 0.22;
      this.particles.push({
        pos: { ...pos },
        vel: { x: Math.cos(angle) * v, y: Math.sin(angle) * v },
        life,
        max: life,
        size: 1 + Math.random() * 2,
        color,
        kind: 'spark',
      });
    }
  }
  openReward() {
    this.offers = sample(
      MODS.filter((m) => !this.mods.includes(m.id)),
      3,
      seeded(this.seed + ':rewards:' + this.stage),
    );
    this.rewardTaken = false;
    this.setMode('upgrade');
  }
  chooseMod(id: string) {
    if (this.mode !== 'upgrade' || this.rewardTaken || !this.offers.some((m) => m.id === id))
      return;
    this.rewardTaken = true;
    this.mods.push(id);
    this.gun = getGun(this.mods);
    this.hp = Math.min(100, this.hp + 20);
    this.stage++;
    this.loadRoom();
    this.setMode('playing');
    this.save();
    this.onSound('upgrade');
  }
}
