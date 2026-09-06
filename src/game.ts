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
import { dailyFromSeed } from './daily.ts';
import { getLevel } from './levels.ts';
import type { Level, EnemyKind } from './levels.ts';
import {
  ENEMY_STATS,
  ELITE_HP,
  SHIELD_TURN,
  TWIN_TELL,
  TWIN_LOCK,
  VOLATILE_TELL,
  VOLATILE_RADIUS,
  CHARGE_TELL,
  SNIPER_TELL,
  HOP_TELL,
  LOADER_TELL,
  PRESS_TELL,
  PRESS_LOCK,
  isBoss,
  bossPhase,
  bossAttack,
  attackTell,
  attackAngles,
} from './enemies.ts';
import type { EnemyState, Attack, EliteKind } from './enemies.ts';
import { PropSystem, traceProp } from './props.ts';
import type { Prop } from './props.ts';
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
  elite?: EliteKind;
  facing: number;
  shieldFlash: number;
  hp: number;
  maxHp: number;
  timer: number;
  flash: number;
  spawn: number;
  phase: number;
  aim: Vec;
  state: EnemyState;
  target: Vec;
  attacks: number;
  attack: Attack;
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
  banks: number;
  bankGrowth: number;
  charged: boolean;
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
  props = new PropSystem(this);
  get solidBodies() {
    return [...this.terrain, ...this.props.bodies];
  }
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
  landingSpeed = 0;
  landingReady = false;
  chargedFlash = false;
  burstRemaining = 0;
  burstAt = 0;
  blast = { pos: { x: 0, y: 0 }, dir: { x: -1, y: 0 }, life: 0 };
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
    if (mode !== 'playing') this.burstRemaining = 0;
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
    this.landingSpeed = 0;
    this.landingReady = false;
    this.chargedFlash = false;
    this.burstRemaining = 0;
    this.burstAt = 0;
    this.blast.life = 0;
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
    for (const spawn of this.level.spawns)
      this.spawnEnemy(spawn.kind, spawn.x, spawn.y, spawn.elite);
    this.props.reset(this.level);
  }
  spawnEnemy(kind: EnemyKind, x: number, y: number, elite?: EliteKind) {
    if (this.enemies.length >= 14) return;
    const { w, h } = ENEMY_STATS[kind];
    const hp = elite ? ELITE_HP[elite] : ENEMY_STATS[kind].hp;
    const body =
      kind === 'flyer'
        ? Bodies.circle(x, y, 19, { frictionAir: 0.035, inertia: Infinity, label: 'enemy' })
        : Bodies.rectangle(x, y, w, h, {
            friction: 0.05,
            frictionAir: kind === 'hopper' ? 0.008 : 0.03,
            inertia: Infinity,
            chamfer: { radius: 3 },
            label: 'enemy',
          });
    if (kind === 'shooter' || kind === 'sniper') Body.setStatic(body, true);
    Composite.add(this.engine.world, body);
    this.enemies.push({
      id: ++this.id,
      body,
      kind,
      elite,
      facing: Math.sign(this.player.position.x - x) || -1,
      shieldFlash: 0,
      hp,
      maxHp: hp,
      timer: 1.1 + this.rng(),
      flash: 0,
      spawn: 0.65,
      phase: 0,
      aim: { x: -1, y: 0 },
      state: 'idle',
      target: { x, y },
      attacks: 0,
      attack: 'aimed',
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
    this.blast.life = Math.max(0, this.blast.life - dt);
    this.aim = { ...input.aim };
    const wasGrounded = this.grounded,
      vy = this.player.velocity.y;
    this.grounded =
      vy >= -1 &&
      Query.ray(
        this.solidBodies,
        { x: this.player.position.x, y: this.player.bounds.max.y - 2 },
        { x: this.player.position.x, y: this.player.bounds.max.y + 5 },
        18,
      ).length > 0;
    if (this.grounded && !wasGrounded) {
      const impact = Math.max(vy, this.landingSpeed);
      if (impact > 2) {
        this.land = 0.13;
        this.feedback(Math.min(3, impact * 0.15));
        this.burst({ x: this.player.position.x, y: this.player.bounds.max.y }, 8, '#697477', 2);
        this.onSound('land');
      }
      if (this.gun.landing && impact >= 7 && !this.landingReady) {
        this.landingReady = true;
        this.burst(this.player.position, 7, '#d7ebac', 2.5);
        this.onSound('loaded');
      }
      this.landingSpeed = 0;
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
    if (this.burstRemaining > 0 && this.time >= this.burstAt) {
      this.burstRemaining--;
      this.burstAt = this.time + this.gun.interval * 0.3;
      this.fireRound();
    } else if (
      (input.fire || this.fireBuffer > 0) &&
      this.time >= this.shootAt &&
      this.burstRemaining === 0
    ) {
      this.fire();
      this.fireBuffer = 0;
    }
    for (const e of [...this.enemies]) {
      this.updateEnemy(e, dt);
      if (this.mode !== 'playing') return;
    }
    // Capture descent before Matter resolves the landing collision and zeros velocity.
    if (!this.grounded) this.landingSpeed = this.player.velocity.y;
    this.props.beforeStep();
    Engine.update(this.engine, 1000 / 60);
    this.props.afterStep(dt);
    if (this.mode !== 'playing') return;
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
    if (this.burstRemaining > 0) return;
    this.shootAt = this.time + this.gun.interval * (this.gun.burstCount === 3 ? 3.1 : 1);
    this.burstRemaining = this.gun.burstCount - 1;
    this.burstAt = this.time + this.gun.interval * 0.3;
    this.fireRound();
  }
  fireRound() {
    const charged = this.gun.landing && this.landingReady;
    this.landingReady = false;
    this.chargedFlash = charged;
    this.lastShot = this.time;
    this.shotCount++;
    this.muzzle = 0.065;
    const d = direction(this.player.position, this.aim);
    if (d.x === 0 && d.y === 0) d.x = 1;
    const impulse = this.gun.recoil * (this.grounded ? 0.21 : 1) * (charged ? 1.25 : 1);
    Body.setVelocity(this.player, {
      x: clamp(this.player.velocity.x - d.x * impulse, -23, 23),
      y: clamp(this.player.velocity.y - d.y * impulse, -21, 20),
    });
    this.feedback((this.grounded ? 2.2 : 3.8) * (charged ? 1.3 : 1), d);
    this.onSound(
      charged
        ? 'charged'
        : this.mods.includes('magnum')
          ? 'heavy'
          : this.mods.includes('scatter')
            ? 'scatter'
            : 'shot',
    );
    const damage = this.gun.damage * (this.grounded ? 1 : this.gun.airDamage) * (charged ? 2 : 1);
    const pos = { x: this.player.position.x + d.x * 26, y: this.player.position.y - 3 + d.y * 26 };
    const radius = this.mods.includes('magnum') ? 4 : 2.5;
    const spawn = this.lineEnd(
      { x: this.player.position.x, y: this.player.position.y - 3 },
      pos,
      radius,
    );
    if (distance(spawn, pos) > 0.01) {
      spawn.x -= d.x * 0.5;
      spawn.y -= d.y * 0.5;
    }
    for (let i = 0; i < this.gun.pellets; i++) {
      const a = Math.atan2(d.y, d.x) + (i - (this.gun.pellets - 1) / 2) * this.gun.spread;
      this.addShot({
        pos: { ...spawn },
        vel: { x: Math.cos(a) * 30, y: Math.sin(a) * 30 },
        damage,
        life: 1.4,
        friendly: true,
        radius,
        bounces: this.gun.bounces,
        pierce: this.gun.pierce,
        fragment: false,
        split: false,
        bankGrowth: this.gun.bankGrowth,
        charged,
      });
    }
    this.burst(pos, 4, '#ffcc84', 3, d);
    if (this.gun.backblast) this.fireBackblast(d, damage * this.gun.pellets * 0.8);
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
  fireBackblast(forward: Vec, damage: number) {
    const p = { ...this.player.position },
      rear = { x: -forward.x, y: -forward.y };
    this.blast = { pos: p, dir: rear, life: 0.1 };
    this.burst(p, 8, '#e3b47a', 4.5, rear);
    for (const e of [...this.enemies]) {
      if (e.spawn > 0 || e.hp <= 0) continue;
      const target = e.body.position,
        d = direction(p, target);
      if (distance(p, target) > 130 || rear.x * d.x + rear.y * d.y < Math.SQRT1_2) continue;
      if (distance(this.lineEnd(p, target), target) > 0.1) continue;
      this.hitEnemy(e, damage, p);
      if (e.hp > 0 && !e.body.isStatic)
        Body.setVelocity(e.body, {
          x: e.body.velocity.x + rear.x * 3.5,
          y: e.body.velocity.y + rear.y * 3.5,
        });
    }
    const targets = this.props.items.filter((prop) => {
      const target = prop.body.position,
        d = direction(p, target);
      return (
        distance(p, target) <= 130 &&
        rear.x * d.x + rear.y * d.y >= Math.SQRT1_2 &&
        distance(this.lineEnd(p, target, 0, prop), target) < 0.1
      );
    });
    for (const prop of targets) this.props.hit(prop, damage, rear);
  }
  addShot(
    data: Omit<Shot, 'id' | 'prev' | 'hits' | 'banks' | 'bankGrowth' | 'charged'> &
      Partial<Pick<Shot, 'banks' | 'bankGrowth' | 'charged'>>,
  ) {
    if (this.shots.length >= 180) return;
    this.shots.push({
      banks: 0,
      bankGrowth: 0,
      charged: false,
      ...data,
      id: ++this.id,
      prev: { ...data.pos },
      hits: new Set(),
    });
  }
  updateEnemy(e: Enemy, dt: number) {
    if (e.hp <= 0 || !this.enemies.includes(e)) return;
    e.flash = Math.max(0, e.flash - dt);
    e.shieldFlash = Math.max(0, e.shieldFlash - dt);
    e.spawn = Math.max(0, e.spawn - dt);
    if (e.spawn > 0) return;
    e.timer -= dt;
    const p = e.body.position,
      d = direction(p, this.player.position),
      dist = distance(p, this.player.position);
    if (e.elite === 'volatile') {
      this.updateVolatile(e);
      // A volatile flyer only harms the player through its warned explosion.
      return;
    }
    if (e.kind === 'charger') this.updateCharger(e);
    else if (e.kind === 'loader') this.updateLoader(e);
    else if (e.kind === 'press') this.updatePress(e);
    else if (e.kind === 'hopper') this.updateHopper(e);
    else if (e.kind === 'sniper') this.updateSniper(e);
    else if (e.kind === 'boss') this.updateBoss(e);
    else if (e.kind === 'runner') {
      const turning = e.elite === 'shielded' && this.updateShield(e);
      if (!turning) this.updateRunner(e, d, dist);
    } else if (e.kind === 'flyer') {
      Body.applyForce(e.body, p, { x: 0, y: -e.body.mass * 0.001 });
      const height = clamp(this.player.position.y - 190, 220, 500);
      Body.setVelocity(e.body, {
        x: clamp((this.player.position.x - d.x * 350 - p.x) * 0.009, -2.4, 2.4),
        y: clamp((height - p.y) * 0.04, -3, 3),
      });
    }
    if (e.kind === 'shooter' || e.kind === 'flyer') {
      if (e.timer > 0.35) e.aim = d;
      if (e.timer <= 0 && dist < 1450) {
        const base = Math.atan2(e.aim.y, e.aim.x);
        const count = e.kind === 'flyer' ? 3 : 1;
        for (let i = 0; i < count; i++) this.enemyShot(e, base + (i - (count - 1) / 2) * 0.18);
        e.timer = e.kind === 'flyer' ? 2.3 : 1.8;
        this.onSound('enemy');
      } else if (e.timer <= 0) e.timer = 0.8;
    }
    if (
      !((e.kind === 'charger' || e.kind === 'loader') && e.state === 'recover') &&
      (e.kind !== 'press' || e.state === 'rush') &&
      Query.collides(this.player, [e.body]).length
    )
      this.damagePlayer(
        isBoss(e.kind)
          ? e.kind === 'loader'
            ? 22
            : 25
          : e.kind === 'charger' && e.state === 'rush'
            ? 22
            : 15,
        p,
      );
    if (p.y > 900) this.hitEnemy(e, 9999);
  }
  updateRunner(e: Enemy, d: Vec, dist: number) {
    const p = e.body.position;
    Body.setVelocity(e.body, {
      x: e.body.velocity.x + (d.x * 2.5 - e.body.velocity.x) * 0.08,
      y: e.body.velocity.y,
    });
    const grounded =
      Query.ray(
        this.solidBodies,
        { x: p.x, y: e.body.bounds.max.y - 2 },
        { x: p.x, y: e.body.bounds.max.y + 5 },
        20,
      ).length > 0;
    const blocked =
      Query.ray(
        this.solidBodies,
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
  }
  updateShield(e: Enemy): boolean {
    if (e.state === 'windup') {
      Body.setVelocity(e.body, { x: e.body.velocity.x * 0.65, y: e.body.velocity.y });
      if (e.timer <= 0) {
        e.facing = e.target.x;
        e.state = 'recover';
        e.timer = 0.25;
      }
      return true;
    }
    if (e.state === 'recover') {
      if (e.timer <= 0) e.state = 'idle';
      return true;
    }
    const dx = this.player.position.x - e.body.position.x;
    if (Math.abs(dx) > 18 && Math.sign(dx) !== e.facing) {
      e.target = { x: Math.sign(dx), y: 0 };
      e.state = 'windup';
      e.timer = SHIELD_TURN;
      return true;
    }
    return false;
  }
  updateVolatile(e: Enemy) {
    const p = e.body.position;
    if (e.state === 'windup') {
      if (e.timer <= 0) this.detonateVolatile(e);
      return;
    }
    const target = this.player.position;
    Body.applyForce(e.body, p, { x: 0, y: -e.body.mass * 0.001 });
    Body.setVelocity(e.body, {
      x: clamp((target.x - p.x) * 0.012, -2.7, 2.7),
      y: clamp((target.y - 22 - p.y) * 0.016, -2.5, 2.5),
    });
    if (distance(p, target) <= 120 && distance(this.lineEnd(p, target), target) < 0.1) {
      Body.setVelocity(e.body, { x: 0, y: 0 });
      Body.setStatic(e.body, true);
      e.state = 'windup';
      e.timer = VOLATILE_TELL;
      e.target = { ...p };
      this.onSound('lock');
    }
  }
  detonateVolatile(e: Enemy) {
    if (this.mode !== 'playing' || e.hp <= 0 || !this.enemies.includes(e)) return;
    const p = { ...e.body.position };
    e.hp = 0;
    Composite.remove(this.engine.world, e.body);
    this.enemies = this.enemies.filter((other) => other !== e);
    // Snapshot all blast cover before any prop can be broken or set off.
    const visible = (target: Vec, ignored?: Prop) =>
      distance(p, target) < VOLATILE_RADIUS &&
      distance(this.lineEnd(p, target, 0, ignored), target) < 0.1;
    const hurtsPlayer = visible(this.player.position);
    const enemies = this.enemies.filter(
      (other) => other.spawn <= 0 && visible(other.body.position),
    );
    const props = this.props.items.filter((prop) => visible(prop.body.position, prop));
    this.burst(p, 26, '#ffd28a', 6);
    if (this.particles.length < 220)
      this.particles.push({
        pos: p,
        vel: { x: 0, y: 0 },
        life: 0.22,
        max: 0.22,
        size: VOLATILE_RADIUS,
        color: '#f5b96e',
        kind: 'ring',
      });
    this.feedback(6);
    this.onSound('explode');
    if (hurtsPlayer)
      this.damagePlayer(
        Math.ceil(24 * (1 - distance(p, this.player.position) / (VOLATILE_RADIUS * 2))),
        p,
      );
    if (this.mode !== 'playing') return;
    for (const other of enemies)
      this.hitEnemy(other, 55 * (1 - distance(p, other.body.position) / (VOLATILE_RADIUS * 2)));
    for (const prop of props) {
      if (prop.kind === 'canister') this.props.explode(prop);
      else this.props.hit(prop, 65, direction(p, prop.body.position));
      if (this.mode !== 'playing') return;
    }
  }
  enemyGrounded(e: Enemy) {
    const p = e.body.position;
    return (
      e.body.velocity.y >= -1 &&
      Query.ray(
        this.solidBodies,
        { x: p.x, y: e.body.bounds.max.y - 2 },
        { x: p.x, y: e.body.bounds.max.y + 5 },
        20,
      ).length > 0
    );
  }
  lineEnd(start: Vec, end: Vec, padding = 0, ignore?: Prop): Vec {
    let t = 1;
    for (const b of this.terrain) {
      const hit = segmentBox(
        start,
        end,
        { x: b.bounds.min.x - padding, y: b.bounds.min.y - padding },
        { x: b.bounds.max.x + padding, y: b.bounds.max.y + padding },
      );
      if (hit) t = Math.min(t, hit.t);
    }
    for (const prop of this.props.items) {
      if (prop === ignore) continue;
      const hit = traceProp(prop, start, end, padding);
      if (hit) t = Math.min(t, hit.t);
    }
    return { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
  }
  updateCharger(e: Enemy) {
    const p = e.body.position,
      v = e.body.velocity,
      dx = this.player.position.x - p.x;
    const grounded = this.enemyGrounded(e),
      sign = Math.sign(dx) || 1;
    if (e.state === 'rush') {
      const end = this.lineEnd(p, { x: p.x + e.aim.x * 35, y: p.y });
      if (Math.abs(end.x - p.x) < 34 || e.timer <= 0) {
        const crashed = e.timer > 0;
        e.state = 'recover';
        e.timer = crashed ? 1.1 : 0.6;
        Body.setVelocity(e.body, { x: 0, y: v.y });
        if (crashed) {
          this.burst(end, 12, '#ffc07a', 3.5);
          this.feedback(2);
          this.onSound('crash');
        }
      } else Body.setVelocity(e.body, { x: e.aim.x * 14, y: v.y });
    } else if (e.state === 'windup') {
      Body.setVelocity(e.body, { x: v.x * 0.65, y: v.y });
      if (e.timer <= 0) {
        e.state = 'rush';
        e.timer = 0.62;
        this.onSound('rush');
      }
    } else if (e.state === 'recover') {
      Body.setVelocity(e.body, { x: v.x * 0.75, y: v.y });
      if (e.timer <= 0) {
        e.state = 'idle';
        e.timer = 0.8;
      }
    } else {
      e.aim = { x: sign, y: 0 };
      Body.setVelocity(e.body, { x: v.x + (sign * 2.1 - v.x) * 0.08, y: v.y });
      if (grounded && e.timer <= 0) {
        if (Math.abs(dx) < 680 && Math.abs(this.player.position.y - p.y) < 80) {
          e.state = 'windup';
          e.timer = CHARGE_TELL;
          this.onSound('charge');
        } else if (
          Math.abs(v.x) < 0.7 ||
          this.player.position.y < p.y - 55 ||
          Query.ray(this.solidBodies, p, { x: p.x + sign * 45, y: p.y }, 12).length
        ) {
          Body.setVelocity(e.body, { x: sign * 4.5, y: -12.3 });
          e.timer = 0.7;
        }
      }
    }
  }
  updateLoader(e: Enemy) {
    const p = e.body.position,
      v = e.body.velocity;
    const sign = Math.sign(this.player.position.x - p.x) || e.aim.x || -1;
    const grounded = this.enemyGrounded(e);
    const nose = ENEMY_STATS.loader.w / 2 + 24;
    if (e.state === 'rush') {
      const end = this.lineEnd(p, { x: p.x + e.aim.x * nose, y: p.y });
      if (Math.abs(end.x - p.x) < nose - 1 || e.timer <= 0) {
        const crashed = e.timer > 0;
        e.state = 'recover';
        e.timer = crashed ? 1.7 : 0.9;
        Body.setVelocity(e.body, { x: 0, y: v.y });
        if (crashed) {
          this.burst(end, 22, '#ffcf93', 5);
          this.feedback(5);
          this.onSound('crash');
        }
      } else Body.setVelocity(e.body, { x: e.aim.x * 15, y: v.y });
    } else if (e.state === 'windup') {
      Body.setVelocity(e.body, { x: v.x * 0.55, y: v.y });
      if (e.timer <= 0) {
        e.state = 'rush';
        e.timer = 1.3;
        this.onSound('loader');
      }
    } else if (e.state === 'recover') {
      Body.setVelocity(e.body, { x: v.x * 0.7, y: v.y });
      if (e.timer <= 0) {
        e.state = 'idle';
        e.timer = 0.9;
      }
    } else {
      e.aim = { x: sign, y: 0 };
      Body.setVelocity(e.body, { x: v.x + (sign * 2.8 - v.x) * 0.1, y: v.y });
      const blocked =
        Math.abs(this.lineEnd(p, { x: p.x + sign * nose, y: p.y }).x - p.x) < nose - 1;
      if (grounded && blocked) {
        Body.setVelocity(e.body, { x: sign * 5.5, y: -12.5 });
        e.timer = Math.max(e.timer, 0.6);
      } else if (grounded && e.timer <= 0 && Math.abs(this.player.position.y - p.y) < 180) {
        e.state = 'windup';
        e.timer = LOADER_TELL;
        this.onSound('charge');
      }
    }
  }
  pressSurface(x: number, bottom: number) {
    const half = ENEMY_STATS.press.w / 2;
    return Math.min(
      WORLD.floor,
      ...this.terrain
        .filter(
          (b) =>
            b.bounds.min.y >= bottom - 1 &&
            b.bounds.min.y <= WORLD.floor &&
            b.bounds.min.x < x + half &&
            b.bounds.max.x > x - half,
        )
        .map((b) => b.bounds.min.y),
    );
  }
  updatePress(e: Enemy) {
    const p = e.body.position,
      v = e.body.velocity;
    const half = ENEMY_STATS.press.h / 2;
    Body.applyForce(e.body, p, { x: 0, y: -e.body.mass * 0.001 });
    if (e.state === 'windup') {
      if (e.timer > PRESS_LOCK)
        e.target.x = clamp(
          this.player.position.x,
          ENEMY_STATS.press.w / 2,
          WORLD.width - ENEMY_STATS.press.w / 2,
        );
      e.target.y = this.pressSurface(e.target.x, 260 + half);
      Body.setVelocity(e.body, {
        x: clamp((e.target.x - p.x) * 0.25, -12, 12),
        y: (260 - p.y) * 0.15,
      });
      if (e.timer <= 0) {
        // The marked column is locked before descent, including its supporting ledge.
        Body.setPosition(e.body, { x: e.target.x, y: p.y });
        Body.setVelocity(e.body, { x: 0, y: 0 });
        e.state = 'rush';
        e.timer = 0.9;
        this.onSound('press');
      }
    } else if (e.state === 'rush') {
      const floor = this.pressSurface(p.x, p.y + half);
      const nextY = Math.min(p.y + 20, floor - half);
      const player = this.player.position;
      if (
        segmentBox(
          p,
          { x: p.x, y: nextY },
          { x: player.x - 13 - ENEMY_STATS.press.w / 2, y: player.y - 18 - half },
          { x: player.x + 13 + ENEMY_STATS.press.w / 2, y: player.y + 18 + half },
        )
      ) {
        this.damagePlayer(25, p);
        if (this.mode !== 'playing') return;
      }
      for (const prop of [...this.props.items]) {
        if (
          prop.body.bounds.min.x < p.x + 60 &&
          prop.body.bounds.max.x > p.x - 60 &&
          prop.body.bounds.min.y < nextY + half + 2 &&
          prop.body.bounds.max.y > p.y - half
        ) {
          this.props.hit(prop, 144, { x: 0, y: 1 });
        }
      }
      if (p.y + half + 20 >= floor || e.timer <= 0) {
        if (p.y + half + 20 >= floor) Body.setPosition(e.body, { x: p.x, y: floor - half });
        Body.setVelocity(e.body, { x: 0, y: 0 });
        e.state = 'recover';
        e.timer = 1.15;
        this.burst({ x: p.x, y: p.y + half }, 24, '#ffcb90', 5);
        this.feedback(6);
        this.onSound('slam');
      } else Body.setVelocity(e.body, { x: 0, y: 20 });
    } else if (e.state === 'recover') {
      Body.setVelocity(e.body, { x: 0, y: 0 });
      if (e.timer <= 0) {
        e.state = 'return';
        e.timer = 2;
      }
    } else if (e.state === 'return') {
      Body.setVelocity(e.body, { x: 0, y: -7 });
      if (p.y <= 263 || e.timer <= 0) {
        Body.setPosition(e.body, { x: p.x, y: 260 });
        Body.setVelocity(e.body, { x: 0, y: 0 });
        e.state = 'idle';
        e.timer = 0.65;
      }
    } else {
      e.aim = { x: 0, y: 1 };
      Body.setVelocity(e.body, {
        x: clamp((this.player.position.x - p.x) * 0.02, -6, 6),
        y: (260 - p.y) * 0.15,
      });
      if (e.timer <= 0 && Math.abs(this.player.position.x - p.x) < 180) {
        e.target = {
          x: clamp(
            this.player.position.x,
            ENEMY_STATS.press.w / 2,
            WORLD.width - ENEMY_STATS.press.w / 2,
          ),
          y: WORLD.floor,
        };
        e.state = 'windup';
        e.timer = PRESS_TELL;
        this.onSound('lock');
      }
    }
  }
  hopperTarget(e: Enemy): Vec {
    const p = e.body.position,
      player = this.player.position;
    const candidates: Vec[] = [];
    for (const b of this.terrain) {
      const min = b.bounds.min,
        max = b.bounds.max;
      if (
        min.y < 0 ||
        min.y > WORLD.floor ||
        max.x <= 0 ||
        min.x >= WORLD.width ||
        max.x - min.x < 48
      )
        continue;
      const target = {
        x: clamp(player.x, Math.max(35, min.x + 23), Math.min(1965, max.x - 23)),
        y: min.y - 17,
      };
      if (Math.abs(target.x - p.x) > 390) target.x = clamp(target.x, p.x - 390, p.x + 390);
      if (
        target.x < min.x + 23 ||
        target.x > max.x - 23 ||
        p.y - target.y > 225 ||
        target.y - p.y > 400
      )
        continue;
      if (
        this.solidBodies.some(
          (other) =>
            other !== b &&
            target.x + 15 > other.bounds.min.x &&
            target.x - 15 < other.bounds.max.x &&
            target.y + 16 > other.bounds.min.y &&
            target.y - 16 < other.bounds.max.y,
        )
      )
        continue;
      candidates.push(target);
    }
    return (
      candidates.sort((a, b) => distance(a, player) - distance(b, player))[0] ?? {
        x: clamp(p.x + Math.sign(player.x - p.x) * 200, 35, 1965),
        y: p.y,
      }
    );
  }
  updateHopper(e: Enemy) {
    const p = e.body.position,
      v = e.body.velocity,
      grounded = this.enemyGrounded(e);
    if (e.state === 'airborne') {
      Body.setVelocity(e.body, { x: clamp((e.target.x - p.x) * 0.07, -6.5, 6.5), y: v.y });
      if (grounded && e.timer <= 0) {
        e.state = 'recover';
        e.timer = 0.5;
        this.burst({ x: p.x, y: p.y + 16 }, 7, '#bc9685', 2);
        this.onSound('land');
      }
    } else if (e.state === 'windup') {
      Body.setVelocity(e.body, { x: v.x * 0.65, y: v.y });
      if (e.timer <= 0 && grounded) {
        e.state = 'airborne';
        e.timer = 0.2;
        Body.setVelocity(e.body, {
          x: clamp((e.target.x - p.x) / 42, -6.5, 6.5),
          y: -13.5 - Math.max(0, p.y - e.target.y) * 0.009,
        });
        this.onSound('hop');
      } else if (e.timer < -0.5) {
        e.state = 'airborne';
        e.timer = 0.2;
      }
    } else {
      Body.setVelocity(e.body, { x: v.x * 0.8, y: v.y });
      if (e.timer <= 0 && grounded) {
        e.target = this.hopperTarget(e);
        e.aim = direction(p, e.target);
        e.state = 'windup';
        e.timer = HOP_TELL;
      }
    }
  }
  updateSniper(e: Enemy) {
    if (e.state === 'windup' || e.state === 'followup') {
      const second = e.state === 'followup';
      if (e.timer > (second ? TWIN_LOCK : 0.32))
        e.aim = direction(e.body.position, this.player.position);
      if (e.timer <= 0) {
        this.enemyShot(e, Math.atan2(e.aim.y, e.aim.x), 18, 20);
        this.onSound('snipe');
        if (e.elite === 'twin' && !second) {
          e.state = 'followup';
          e.timer = TWIN_TELL;
          e.aim = direction(e.body.position, this.player.position);
          this.onSound('lock');
        } else {
          e.state = 'recover';
          e.timer = e.elite === 'twin' ? 2.5 : 2.2;
        }
      }
    } else {
      e.aim = direction(e.body.position, this.player.position);
      if (e.timer <= 0 && distance(e.body.position, this.player.position) < 1450) {
        e.state = 'windup';
        e.timer = SNIPER_TELL;
        this.onSound('lock');
      }
    }
  }
  updateBoss(e: Enemy) {
    const p = e.body.position,
      d = direction(p, this.player.position);
    Body.applyForce(e.body, p, { x: 0, y: -e.body.mass * 0.001 });
    const phase = bossPhase(e.hp, e.maxHp);
    if (phase > e.phase) {
      e.phase = phase;
      e.state = 'transition';
      e.timer = 1.2;
      e.attacks = 0;
      this.burst(p, 25, '#ffd19b', 4);
      this.feedback(4);
      this.onSound('phase');
    }
    const resting = e.state === 'windup' || e.state === 'transition';
    Body.setVelocity(e.body, {
      x: resting
        ? e.body.velocity.x * 0.82
        : clamp((this.player.position.x - d.x * 350 - p.x) * 0.009, -2.4, 2.4),
      y: resting
        ? e.body.velocity.y * 0.82
        : clamp((290 + Math.sin(this.time) * 55 - p.y) * 0.04, -2.5, 2.5),
    });
    if (e.state === 'transition') {
      if (e.timer <= 0) {
        e.state = 'idle';
        e.timer = 0.4;
      }
    } else if (e.state === 'windup') {
      if (e.attack === 'aimed' && e.timer > 0.3) e.aim = d;
      if (e.timer <= 0) {
        for (const angle of attackAngles(e.attack, Math.atan2(e.aim.y, e.aim.x)))
          this.enemyShot(e, angle, e.attack === 'ring' ? 5 : 6.7, 16);
        e.attacks++;
        e.state = 'recover';
        e.timer = [1.35, 1.15, 0.95][e.phase];
        this.onSound(e.attack === 'ring' ? 'pulse' : 'enemy');
      }
    } else if (e.timer <= 0) {
      e.attack = bossAttack(e.phase, e.attacks);
      e.aim = d;
      e.state = 'windup';
      e.timer = attackTell(e.attack);
      this.onSound('lock');
    }
  }
  enemyShot(e: Enemy, a: number, speed = 6.7, damage = e.kind === 'boss' ? 16 : 12) {
    const d = { x: Math.cos(a), y: Math.sin(a) },
      radius = e.kind === 'boss' ? 55 : e.kind === 'sniper' ? 38 : 26;
    const muzzle = { x: e.body.position.x + d.x * radius, y: e.body.position.y + d.y * radius };
    const end = this.lineEnd(e.body.position, muzzle);
    if (distance(end, muzzle) > 0.01) {
      this.burst(end, 3, '#ef7264', 1.5);
      const prop = this.props.items.find((p) => {
        const hit = traceProp(p, e.body.position, muzzle);
        return (
          hit &&
          Math.abs(distance(e.body.position, end) - distance(e.body.position, muzzle) * hit.t) < 0.1
        );
      });
      if (prop) this.props.hit(prop, damage, d);
      return;
    }
    this.addShot({
      pos: muzzle,
      vel: { x: d.x * speed, y: d.y * speed },
      damage,
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
        let nearest: {
          t: number;
          normal: Vec;
          enemy?: Enemy;
          player?: boolean;
          prop?: Prop;
        } | null = null;
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
        for (const prop of this.props.items) {
          const h = traceProp(prop, s.pos, end, s.radius);
          if (h && (!nearest || h.t < nearest.t)) nearest = { ...h, prop };
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
          // Use this segment's incoming direction, including after a bank, rather
          // than the player's current position or the shot's original origin.
          const blocked = this.hitEnemy(e, s.damage, {
            x: e.body.position.x - s.vel.x,
            y: e.body.position.y - s.vel.y,
          });
          if (blocked) {
            s.life = 0;
            continue;
          }
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
          if (nearest.prop) this.props.hit(nearest.prop, s.damage, s.vel);
          this.burst(s.pos, 3, s.friendly ? '#bcbdb2' : '#ef7264', 1.5);
          this.splitShot(s);
          if (s.bounces > 0) {
            const dot = s.vel.x * nearest.normal.x + s.vel.y * nearest.normal.y;
            s.vel.x -= 2 * dot * nearest.normal.x;
            s.vel.y -= 2 * dot * nearest.normal.y;
            s.bounces--;
            s.banks++;
            s.damage *= 1 + s.bankGrowth;
            if (s.bankGrowth > 0) {
              this.burst(s.pos, 4, '#a1dbbf', 2);
              this.onSound('bank');
            }
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
  hitEnemy(e: Enemy, damage: number, from?: Vec): boolean {
    if (e.hp <= 0) return false;
    const blocked =
      e.elite === 'shielded' && !!from && direction(e.body.position, from).x * e.facing > 0.45;
    if (blocked) {
      damage *= 0.1;
      e.shieldFlash = 0.14;
      this.burst({ x: e.body.position.x + e.facing * 19, y: e.body.position.y }, 4, '#e7d6ac', 2);
      this.onSound('bank');
    }
    if (e.kind === 'charger' && e.state === 'recover') damage *= 1.4;
    if (e.kind === 'loader') damage *= e.state === 'recover' ? 1.5 : 0.85;
    if (e.kind === 'press' && e.state === 'recover') damage *= 1.35;
    e.hp -= damage;
    if (!blocked) {
      e.flash = 0.08;
      this.burst(e.body.position, 4, '#f28a79', 2.3);
      this.onSound('hit');
    }
    if (e.hp > 0) return blocked;
    this.kills++;
    this.hp = Math.min(100, this.hp + this.gun.heal);
    Composite.remove(this.engine.world, e.body);
    this.enemies = this.enemies.filter((x) => x !== e);
    this.feedback(isBoss(e.kind) ? 10 : 4);
    this.hitStop = Math.max(this.hitStop, isBoss(e.kind) ? 0.075 : 0.035);
    this.burst(e.body.position, isBoss(e.kind) ? 45 : 16, '#f28371', isBoss(e.kind) ? 8 : 4);
    if (this.particles.length < 220)
      this.particles.push({
        pos: { ...e.body.position },
        vel: { x: 0, y: 0 },
        life: 0.25,
        max: 0.25,
        size: isBoss(e.kind) ? 120 : 45,
        color: '#f28371',
        kind: 'ring',
      });
    this.onSound('kill');
    if (isBoss(e.kind)) for (const other of [...this.enemies]) this.hitEnemy(other, 9999);
    return blocked;
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
      dailyFromSeed(this.seed) ? 1 : 3,
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
