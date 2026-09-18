import Matter from 'matter-js';
import type { Game, Enemy } from './game.ts';
import type { Vec, Checkpoint } from './rules.ts';
import { clamp, distance } from './rules.ts';
import { courierLevel, courierEligible, planCourier, type CourierSave } from './courier-layout.ts';
import type { Level } from './levels.ts';

const { Bodies, Body, Composite, Query } = Matter;
export const COURIER_DOOR = { x: 1760, y: 740 };
export const COURIER_DOOR_TIME = 3;
export class CourierSystem {
  game: Game;
  state: CourierSave | null = null;
  enemy: Enemy | null = null;
  cargo: Matter.Body | null = null;
  running = false;
  age = 0;
  jumpAt = 0;
  boost = 0;
  boostAt = 0;
  opening = 0;
  resting = 0;
  nextCover = 0;
  lastSafe: Vec = { x: 390, y: 720 };
  constructor(game: Game) {
    this.game = game;
  }
  start(save?: Checkpoint) {
    this.state = save?.courier
      ? { ...save.courier }
      : save
        ? null
        : planCourier(this.game.seed, this.game.areaEvents.state);
  }
  clear() {
    const g = this.game;
    if (this.enemy) {
      g.tethers.disrupt(this.enemy.body);
      g.harpoons.disrupt(this.enemy.body);
      Composite.remove(g.engine.world, this.enemy.body);
      g.enemies = g.enemies.filter((e) => e !== this.enemy);
    }
    if (this.cargo) Composite.remove(g.engine.world, this.cargo);
    this.enemy = null;
    this.cargo = null;
    this.running = false;
    this.age = this.opening = this.boost = this.resting = this.nextCover = 0;
  }
  level(source: Level): Level {
    const g = this.game;
    if (
      !this.state ||
      this.state.stage !== g.stage ||
      g.practice ||
      g.workshop.active ||
      g.detour ||
      g.escape ||
      g.overtime ||
      (g.testRun && !g.seed.startsWith('COURIER-')) ||
      (g.areaEvents.state && g.areaEvents.state.area === Math.floor(g.stage / 4))
    )
      return source;
    if (!g.testRun && !courierEligible(source)) return source;
    return courierLevel(source, g.seed);
  }
  reset(cleared: boolean) {
    const g = this.game;
    if (
      this.state?.stage === g.stage &&
      this.state.status === 'pending' &&
      !g.level.courier &&
      !g.detour &&
      !g.overtime
    )
      this.state.status = 'lost';
    if (!g.level.courier || cleared || this.state?.status !== 'pending') return;
    const e = g.spawnEnemy('runner', 410, 720);
    if (!e) return;
    e.courier = true;
    e.hp = e.maxHp = 150 + Math.floor(g.stage / 4) * 20;
    e.spawn = 0.65;
    e.body.frictionAir = 0.008;
    this.enemy = e;
    this.lastSafe = { ...e.body.position };
    this.jumpAt = this.boostAt = g.time + 0.85;
  }
  updateEnemy(e: Enemy, dt: number) {
    if (!e.courier) return false;
    const g = this.game,
      p = e.body.position;
    if (!this.running) {
      if (distance(g.player.position, p) < 430 || e.hp < e.maxHp) {
        this.running = true;
        this.resting = 0.15;
        g.onSound('courier-start');
      }
      return true;
    }
    this.resting = Math.max(0, this.resting - dt);
    this.boost = Math.max(0, this.boost - dt);
    const grounded =
      e.body.velocity.y >= -1 &&
      Query.ray(
        g.solidBodies,
        { x: p.x, y: e.body.bounds.max.y - 2 },
        { x: p.x, y: e.body.bounds.max.y + 5 },
        22,
      ).length > 0;
    const atDoor = Math.abs(p.x - COURIER_DOOR.x) < 26 && p.y > 700;
    if (atDoor) {
      Body.setVelocity(e.body, { x: e.body.velocity.x * 0.65, y: e.body.velocity.y });
      if (this.opening === 0) g.onSound('courier-door');
      this.opening += dt;
      if (this.opening >= COURIER_DOOR_TIME) this.escape();
      return true;
    }
    // Blocking, portals and knockback can pull it away from the hatch; it must
    // physically return and spend the full opening time beside the door.
    this.opening = 0;
    const covers = g.level.solids.filter((s) => s.h > 28).sort((a, b) => a.x - b.x);
    const cover = covers[this.nextCover];
    if (cover && p.x > cover.x + cover.w + 22 && grounded) {
      this.nextCover++;
      this.resting = 0.65;
    }
    const sign = Math.sign(COURIER_DOOR.x - p.x) || 1;
    const blocked =
      Query.ray(
        [...g.solidBodies, ...g.enemies.filter((other) => other !== e).map((other) => other.body)],
        { x: p.x, y: p.y + 8 },
        { x: p.x + sign * 65, y: p.y + 8 },
        16,
      ).length > 0;
    if (grounded && blocked && g.time >= this.jumpAt && this.resting <= 0) {
      Body.setVelocity(e.body, { x: sign * 5.6, y: -12 });
      this.jumpAt = g.time + 0.7;
      this.boost = 0.3;
      g.onSound('courier-boost');
    } else if (grounded && !blocked && this.resting <= 0 && g.time >= this.boostAt) {
      this.boost = 0.3;
      this.boostAt = g.time + 2.2;
      g.onSound('courier-boost');
    }
    const speed = this.resting > 0 ? 0 : this.boost > 0 ? 7 : 4.8;
    Body.setVelocity(e.body, {
      x: e.body.velocity.x + (sign * speed - e.body.velocity.x) * 0.09,
      y: clamp(e.body.velocity.y, -18, 16),
    });
    e.facing = sign;
    return true;
  }
  update(dt: number) {
    const g = this.game;
    if (g.mode !== 'playing') return;
    if (this.enemy && this.running) {
      this.age += dt;
      const p = this.enemy.body.position;
      if (
        p.x > 30 &&
        p.x < g.worldWidth - 30 &&
        p.y > g.worldTop + 30 &&
        p.y < 725 &&
        !Query.collides(this.enemy.body, g.terrain).length
      )
        this.lastSafe = { ...p };
      // A physics accident never holds the exit shut or creates a free case.
      if (!Number.isFinite(p.x) || p.y > 850) this.escape();
    }
    if (this.cargo) {
      const p = this.cargo.position;
      if (p.y > 790 || !Number.isFinite(p.x)) {
        Body.setPosition(this.cargo, this.lastSafe);
        Body.setVelocity(this.cargo, { x: 0, y: 0 });
      }
      if (
        distance(g.player.position, this.cargo.position) < 40 &&
        distance(g.lineEnd(g.player.position, this.cargo.position), this.cargo.position) < 1
      ) {
        Composite.remove(g.engine.world, this.cargo);
        this.cargo = null;
        if (this.state) this.state.status = 'collected';
        g.onSound('courier-pickup');
        g.burst(g.player.position, 10, '#edc486', 2);
      }
    }
  }
  killed(e: Enemy) {
    if (!e.courier || e !== this.enemy) return;
    this.enemy = null;
    const g = this.game;
    if (g.mode !== 'playing' || g.hp <= 0) return;
    const pos = {
      x: clamp(e.body.position.x, 25, g.worldWidth - 25),
      y: clamp(e.body.position.y, g.worldTop + 25, 720),
    };
    this.cargo = Bodies.rectangle(pos.x, pos.y, 26, 20, {
      label: 'courier-case',
      friction: 0.8,
      frictionAir: 0.04,
      restitution: 0.15,
      // Physical against the world, but cannot pin the player or an enemy.
      collisionFilter: { category: 0x8000, mask: 0x0001 },
    });
    if (Query.collides(this.cargo, g.solidBodies).length)
      Body.setPosition(this.cargo, this.lastSafe);
    Composite.add(g.engine.world, this.cargo);
    Body.setVelocity(this.cargo, { x: clamp(e.body.velocity.x * 0.2, -2, 2), y: -2 });
    this.opening = 0;
    g.onSound('courier-drop');
  }
  escape() {
    if (!this.enemy) return;
    const g = this.game;
    const p = { ...this.enemy.body.position };
    this.clear();
    if (this.state) this.state.status = 'lost';
    g.burst(p, 8, '#847260', 2);
    g.onSound('courier-exit');
  }
  leave() {
    if (this.state?.stage === this.game.stage && this.state.status === 'pending')
      this.state.status = 'lost';
    this.clear();
  }
}
