import Matter from 'matter-js';
import type { Enemy, Game } from './game.ts';
import type { Solid } from './levels.ts';
import { clamp, direction, distance, segmentBox, type Vec } from './rules.ts';
import { firstSolid } from './collisions.ts';
import { finalePending } from './final-arsenal.ts';
import { reclaimerArsenalSeed } from './boss-progression.ts';

export interface ArsenalDash {
  state: 'warning' | 'dash' | 'recover';
  left: number;
  duration: number;
  from: Vec;
  to: Vec;
  trail: Vec[];
}
export interface ArsenalBomb {
  pos: Vec;
  target: Vec;
  radius: number;
  left: number;
  duration: number;
  state: 'warning' | 'falling' | 'blast';
  age: number;
  releaseAt: number;
}
export interface ArsenalCore {
  angle: number;
  left: number;
  duration: number;
  state: 'warning' | 'active';
  origin: Vec;
  segments: { from: Vec; to: Vec }[];
  direction: number;
  sweep: number;
}
export interface ArsenalCollapse {
  rect: Solid;
  left: number;
  duration: number;
  fallen: boolean;
  age: number;
}
export const ARSENAL_DASH_WARNING = 0.95;
export const ARSENAL_CORE_WARNING = 1.5;
export const ARSENAL_COLLAPSE_WARNING = 3.2;
export const ARSENAL_BEAM_WIDTH = 10;

// Signature attacks share the real enemy, collision world and damage pipeline.
// Rendering only reads this state; no attack advances on a rendered frame.
export class ReclaimerArsenal {
  readonly game: Game;
  constructor(game: Game) {
    this.game = game;
  }
  dash: ArsenalDash | null = null;
  flight: { x: number; y: number; direction: number; time: number } | null = null;
  bombs: ArsenalBomb[] = [];
  armor = { hp: 0, maxHp: 0, plates: 0, exposedLeft: 0, exposedDuration: 4, flash: 0 };
  core: ArsenalCore | null = null;
  collapses: ArsenalCollapse[] = [];
  clock = 0;
  nextSpecial = 2.8;
  specials = 0;
  collapsed = 0;
  private dashHit = false;
  private dashLast: Vec | null = null;
  private dashStall = 0;
  get enabled() {
    return reclaimerArsenalSeed(this.game.seed);
  }
  get active() {
    return this.enabled && !!this.game.finale.cinema?.combat;
  }
  get isolated() {
    return this.game.uprising.finale === 'isolated';
  }
  get ownsGun() {
    return (
      !!this.dash ||
      !!this.core ||
      !!this.flight ||
      this.bombs.length > 0 ||
      this.armor.exposedLeft > 0
    );
  }
  reset() {
    this.dash = null;
    this.flight = null;
    this.bombs = [];
    this.core = null;
    this.collapses = [];
    this.armor = { hp: 0, maxHp: 0, plates: 0, exposedLeft: 0, exposedDuration: 4, flash: 0 };
    this.clock = this.specials = this.collapsed = 0;
    this.nextSpecial = 2.8;
    this.dashHit = false;
    this.dashLast = null;
    this.dashStall = 0;
  }
  startForm(phase: number) {
    this.reset();
    if (!this.enabled) return;
    if (phase === 1) {
      const hp = Math.round(
        this.game.finale.enemy!.maxHp *
          (this.game.overtime ? 0.043 : this.isolated ? 0.028 : 0.035),
      );
      this.armor = {
        hp,
        maxHp: hp,
        plates: 3,
        exposedLeft: 0,
        exposedDuration: this.game.overtime ? 3.2 : this.isolated ? 4.8 : 4,
        flash: 0,
      };
      this.nextSpecial = 2.5;
    }
  }
  private hold(e: Enemy, state: 'windup' | 'rush' | 'recover') {
    e.state = state;
    e.timer = 0.2;
    e.interceptor!.relocate = false;
    e.hunt = undefined;
    Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
    Matter.Body.applyForce(e.body, e.body.position, {
      x: 0,
      y: -e.body.mass * this.game.engine.gravity.y * this.game.engine.gravity.scale,
    });
  }
  private ready(e: Enemy) {
    return (
      e.state === 'idle' &&
      e.timer <= 0 &&
      !finalePending(e) &&
      !this.game.finale.cinema!.pursuit.route.length
    );
  }
  private half(e: Enemy) {
    const xs = e.body.vertices.map((v) => v.x),
      ys = e.body.vertices.map((v) => v.y);
    return {
      x: (Math.max(...xs) - Math.min(...xs)) / 2,
      y: (Math.max(...ys) - Math.min(...ys)) / 2,
    };
  }
  /** A snapshot dash can be baited; the destination never follows the player. */
  beginDash(e: Enemy): boolean {
    if (!this.active || this.game.finale.phase !== 0 || this.dash || this.core) return false;
    const g = this.game,
      from = { ...e.body.position },
      half = this.half(e);
    const d = direction(from, g.player.position);
    const length = Math.min(g.overtime ? 760 : 640, distance(from, g.player.position) + 120);
    const far = {
      x: clamp(from.x + d.x * length, half.x + 8, g.worldWidth - half.x - 8),
      y: clamp(from.y + d.y * length, half.y + 12, 740 - half.y - 3),
    };
    const hit = firstSolid(from, far, { x: half.x + 2, y: half.y + 2 }, g.solidBodies);
    const t = hit ? Math.max(0, hit.t - 4 / Math.max(1, distance(from, far))) : 1;
    const to = { x: from.x + (far.x - from.x) * t, y: from.y + (far.y - from.y) * t };
    if (distance(from, to) < 180) return false;
    this.dash = {
      state: 'warning',
      left: ARSENAL_DASH_WARNING * (this.isolated ? 1.2 : 1),
      duration: ARSENAL_DASH_WARNING * (this.isolated ? 1.2 : 1),
      from,
      to,
      trail: [],
    };
    this.dashHit = false;
    this.dashLast = null;
    this.dashStall = 0;
    this.hold(e, 'windup');
    // Native gun telegraphs must not pretend this body attack fires a rifle.
    e.attack = 'vault';
    e.interceptor!.move = 'aimed';
    e.interceptor!.origin = { ...from };
    e.aim = direction(from, to);
    this.game.onSound('arsenal-dash-warn');
    return true;
  }
  private dashRecovery(e: Enemy) {
    if (!this.dash) return;
    this.dash.state = 'recover';
    this.dash.left = this.game.overtime ? 1.05 : this.isolated ? 1.65 : 1.4;
    this.dash.duration = this.dash.left;
    this.hold(e, 'recover');
    e.attacks++;
    this.game.soundAt('interceptor-open', e.body.position, `enemy:${e.id}`);
  }
  private dashStep(e: Enemy, dt: number) {
    const dash = this.dash!;
    if (dash.state !== 'dash') {
      this.hold(e, dash.state === 'recover' ? 'recover' : 'windup');
      return;
    }
    const pos = e.body.position;
    const d = direction(pos, dash.to),
      length = distance(pos, dash.to);
    const speed = Math.min(this.game.overtime ? 21 : 18, length);
    const next = { x: pos.x + d.x * speed, y: pos.y + d.y * speed };
    const half = this.half(e);
    const hit = firstSolid(pos, next, { x: half.x + 1, y: half.y + 1 }, this.game.solidBodies);
    if (this.dashLast && distance(pos, this.dashLast) < 0.2) this.dashStall += dt;
    else this.dashStall = 0;
    this.dashLast = { ...pos };
    if (length < 6 || dash.left <= 0 || this.dashStall > 0.15 || (hit && hit.t < 1)) {
      this.dashRecovery(e);
      return;
    }
    const contact = segmentBox(
      pos,
      next,
      { x: this.game.player.bounds.min.x - half.x, y: this.game.player.bounds.min.y - half.y },
      { x: this.game.player.bounds.max.x + half.x, y: this.game.player.bounds.max.y + half.y },
    );
    if (contact && !this.dashHit) {
      this.dashHit = true;
      this.game.damagePlayer(this.game.overtime ? 34 : 30, pos, {
        type: 'contact',
        enemy: 'interceptor',
      });
    }
    e.state = 'rush';
    e.timer = 0.2;
    Matter.Body.applyForce(e.body, pos, {
      x: 0,
      y: -e.body.mass * this.game.engine.gravity.y * this.game.engine.gravity.scale,
    });
    Matter.Body.setVelocity(e.body, { x: d.x * speed, y: d.y * speed });
    dash.trail.push({ ...pos });
    if (dash.trail.length > 9) dash.trail.shift();
  }
  beginFlight() {
    if (!this.active || this.game.finale.phase !== 1 || this.flight || this.bombs.length) return;
    const g = this.game;
    const direction = (this.specials % 2 === 0 ? 1 : -1) * (g.level.mirrored ? -1 : 1);
    this.flight = { x: direction > 0 ? -240 : 2240, y: 152, direction, time: 0 };
    const target = clamp(g.player.position.x, 180, 1820);
    const count = g.overtime ? 6 : this.isolated ? 3 : 4;
    const xs = Array.from({ length: count }, (_, i) =>
      clamp(target + (i - (count - 1) / 2) * 230, 100, 1900),
    );
    const unique = [...new Set(xs)];
    for (const x of unique) {
      // A roof catches a falling bomb. There is no invisible blast below it.
      const target = g.lineEnd({ x, y: 170 }, { x, y: 740 }, 8);
      const releaseAt = Math.abs(x - this.flight.x) / 480;
      const fallTime = (target.y - 152) / 640;
      const duration = releaseAt + fallTime;
      this.bombs.push({
        pos: { x, y: 152 },
        target,
        radius: g.overtime ? 93 : this.isolated ? 72 : 82,
        left: duration,
        duration,
        state: 'warning',
        age: 0,
        releaseAt,
      });
    }
    this.specials++;
    this.nextSpecial = g.overtime ? 4 : 5;
    g.onSound('arsenal-plane');
  }
  beginCore() {
    const g = this.game,
      e = g.finale.enemy;
    if (!this.active || g.finale.phase !== 2 || !e || this.core) return;
    const d = g.level.mirrored ? -1 : 1;
    const angle =
      Math.atan2(g.player.position.y - e.body.position.y, g.player.position.x - e.body.position.x) -
      d * 0.52;
    this.core = {
      angle,
      left: ARSENAL_CORE_WARNING * (this.isolated ? 1.2 : 1),
      duration: ARSENAL_CORE_WARNING * (this.isolated ? 1.2 : 1),
      state: 'warning',
      origin: { ...e.body.position },
      segments: [],
      direction: d,
      sweep: g.overtime ? 1.8 : this.isolated ? 1.25 : 1.45,
    };
    this.coreSegments();
    this.specials++;
    this.nextSpecial = g.overtime ? 3.5 : 4.8;
    this.hold(e, 'windup');
    g.onSound('arsenal-core-warn');
  }
  private coreSegments() {
    const core = this.core;
    if (!core) return;
    const count = this.game.overtime ? 2 : 1;
    core.segments = Array.from({ length: count }, (_, i) => {
      const a = core.angle + i * Math.PI;
      const from = { x: core.origin.x + Math.cos(a) * 57, y: core.origin.y + Math.sin(a) * 57 };
      // Trace from the actual core so neither a protruding barrel nor a new
      // piece of cover can project a damaging ray through a nearby platform.
      const to = this.game.lineEnd(
        core.origin,
        { x: core.origin.x + Math.cos(a) * 2200, y: core.origin.y + Math.sin(a) * 2200 },
        ARSENAL_BEAM_WIDTH / 2,
      );
      return { from: distance(core.origin, to) < 57 ? { ...to } : from, to };
    });
  }
  planCollapse(): boolean {
    const g = this.game;
    if (
      !this.active ||
      g.finale.phase !== 2 ||
      this.collapsed >= 3 ||
      this.collapses.some((c) => !c.fallen)
    )
      return false;
    const choices = g.level.solids.filter((s) => !this.collapses.some((c) => c.rect === s));
    // Three removals leave two real shelves and the full floor as escape space.
    if (choices.length <= 2) return false;
    choices.sort(
      (a, b) =>
        Math.abs(a.x + a.w / 2 - g.player.position.x) -
        Math.abs(b.x + b.w / 2 - g.player.position.x),
    );
    const rect = choices[0];
    const duration = ARSENAL_COLLAPSE_WARNING * (this.isolated ? 1.2 : 1);
    this.collapses.push({ rect, left: duration, duration, fallen: false, age: 0 });
    g.onSound('arsenal-collapse-warn');
    return true;
  }
  private collapse(c: ArsenalCollapse) {
    const g = this.game;
    const body = g.terrain
      .slice(4)
      .find(
        (b) =>
          Math.abs(b.position.x - c.rect.x - c.rect.w / 2) < 0.1 &&
          Math.abs(b.position.y - c.rect.y - c.rect.h / 2) < 0.1,
      );
    if (body) {
      // The exact terrain body leaves Matter and both terrain query lists.
      Matter.Composite.remove(g.engine.world, body);
      g.terrain = g.terrain.filter((b) => b !== body);
      g.level.solids = g.level.solids.filter((s) => s !== c.rect);
    }
    c.fallen = true;
    c.age = 0;
    this.collapsed++;
    g.burst({ x: c.rect.x + c.rect.w / 2, y: c.rect.y + 12 }, 18, '#cc9075', 4);
    g.feedback(4);
    g.onSound('arsenal-collapse');
  }
  /** Called at the common finale damage boundary, including beams and DoT. */
  damage(amount: number): number {
    if (!this.active || this.game.finale.phase !== 1 || !(amount > 0)) return amount;
    const a = this.armor;
    if (a.exposedLeft > 0 || a.plates === 0) return amount * 1.5;
    a.hp = Math.max(0, a.hp - amount);
    a.flash = 0.12;
    if (a.hp === 0) {
      a.plates--;
      a.exposedLeft = a.exposedDuration;
      this.game.finale.enemy!.state = 'recover';
      this.game.onSound('arsenal-armor-break');
      this.game.feedback(4);
    }
    // Armor never deletes a hit or requires a particular weapon family.
    return amount * 0.75;
  }
  beforeEnemy(e: Enemy, dt: number): boolean {
    if (!this.active || !(dt > 0)) return false;
    if (this.dash) {
      this.dashStep(e, dt);
      return true;
    }
    if (this.core && distance(this.core.origin, e.body.position) > 12) {
      // A displacement cancels the committed muzzle instead of leaving a
      // damaging beam behind the visible core or moving a locked warning.
      this.core = null;
      this.finish(e, 0.6);
      return true;
    }
    if (this.core || this.flight || this.bombs.length || this.armor.exposedLeft > 0) {
      this.hold(
        e,
        this.armor.exposedLeft > 0
          ? 'recover'
          : this.core?.state === 'warning'
            ? 'windup'
            : 'recover',
      );
      return true;
    }
    if (this.nextSpecial > 0 || !this.ready(e)) return false;
    const phase = this.game.finale.phase;
    if (phase === 0) {
      if (!this.beginDash(e)) this.nextSpecial = 0.6;
    } else if (phase === 1) this.beginFlight();
    else this.beginCore();
    return this.ownsGun;
  }
  update(dt: number) {
    if (!this.active || !(dt > 0) || !Number.isFinite(dt) || this.game.mode !== 'playing') return;
    const g = this.game,
      e = g.finale.enemy!;
    if (e.hp <= 0) return;
    this.clock += dt;
    this.armor.flash = Math.max(0, this.armor.flash - dt);
    if (this.armor.exposedLeft > 0) {
      this.armor.exposedLeft = Math.max(0, this.armor.exposedLeft - dt);
      if (this.armor.exposedLeft === 0) {
        if (this.armor.plates > 0) this.armor.hp = this.armor.maxHp;
        this.finish(e, 0.35);
        if (this.armor.plates > 0) g.onSound('arsenal-armor-close');
      }
    }
    if (this.dash) {
      const dash = this.dash;
      dash.left = Math.max(0, dash.left - dt);
      if (!dash.left) {
        if (dash.state === 'warning') {
          dash.state = 'dash';
          dash.left = dash.duration =
            distance(e.body.position, dash.to) / ((g.overtime ? 21 : 18) * 60) + 0.15;
          g.onSound('arsenal-dash');
        } else if (dash.state === 'recover') {
          this.dash = null;
          this.nextSpecial = g.overtime ? 4.5 : this.isolated ? 7.2 : 6;
          this.specials++;
          this.finish(e, 0.25);
        }
      }
    }
    if (this.flight) {
      this.flight.time += dt;
      this.flight.x += this.flight.direction * 480 * dt;
      if (this.flight.x < -280 || this.flight.x > 2280) this.flight = null;
    }
    for (const bomb of this.bombs) {
      bomb.age += dt;
      if (bomb.state === 'blast') continue;
      bomb.left = Math.max(0, bomb.duration - bomb.age);
      if (bomb.age >= bomb.releaseAt) {
        bomb.state = 'falling';
        const end = { x: bomb.pos.x, y: Math.min(760, bomb.pos.y + 640 * dt) };
        const impact = g.lineEnd(bomb.pos, end, 8);
        bomb.pos = impact;
        if (distance(impact, end) > 0.01 || bomb.pos.y >= 732) {
          bomb.state = 'blast';
          bomb.age = 0;
          bomb.target = { ...bomb.pos };
          if (
            distance(g.player.position, bomb.target) <= bomb.radius + 12 &&
            distance(g.lineEnd(bomb.target, g.player.position, 0), g.player.position) < 1
          )
            g.damagePlayer(g.overtime ? 30 : 25, bomb.target, {
              type: 'blast',
              enemy: 'interceptor',
            });
          g.burst(bomb.target, 14, '#f7b07e', 5);
          g.feedback(3);
          g.onSound('arsenal-bomb');
        }
      }
    }
    const hadBombs = this.bombs.length > 0;
    this.bombs = this.bombs.filter((b) => b.state !== 'blast' || b.age < 0.32);
    if (hadBombs && !this.bombs.length && !this.flight && this.armor.exposedLeft === 0)
      this.finish(e, 0.5);
    if (this.core) {
      const core = this.core;
      core.left = Math.max(0, core.left - dt);
      if (core.state === 'warning') {
        if (!core.left) {
          core.state = 'active';
          core.left = core.duration = g.overtime ? 3.6 : 3;
          g.onSound('arsenal-core-fire');
        }
      } else {
        core.angle += ((core.direction * core.sweep) / core.duration) * dt;
        this.coreSegments();
        if (
          core.segments.some((s) =>
            segmentBox(
              s.from,
              s.to,
              {
                x: g.player.bounds.min.x - ARSENAL_BEAM_WIDTH / 2,
                y: g.player.bounds.min.y - ARSENAL_BEAM_WIDTH / 2,
              },
              {
                x: g.player.bounds.max.x + ARSENAL_BEAM_WIDTH / 2,
                y: g.player.bounds.max.y + ARSENAL_BEAM_WIDTH / 2,
              },
            ),
          )
        )
          g.damagePlayer(g.overtime ? 28 : 23, core.origin, {
            type: 'induction',
            enemy: 'interceptor',
          });
        if (!core.left) {
          this.core = null;
          this.finish(e, g.overtime ? 1.1 : 1.5);
        }
      }
    }
    for (const c of this.collapses) {
      c.age += dt;
      if (!c.fallen) {
        c.left = Math.max(0, c.left - dt);
        if (!c.left) this.collapse(c);
      }
    }
    if (g.finale.phase === 2) {
      const thresholds = [0.82, 0.58, 0.32];
      const times = g.overtime ? [9, 21, 33] : this.isolated ? [16, 32, 48] : [12, 28, 44];
      if (
        this.collapsed < 3 &&
        (e.hp / e.maxHp <= thresholds[this.collapsed] || this.clock >= times[this.collapsed])
      )
        this.planCollapse();
    }
    if (!this.ownsGun) this.nextSpecial -= dt;
  }
  private finish(e: Enemy, recovery: number) {
    e.state = 'recover';
    e.timer = recovery;
    e.attack = 'aimed';
    e.interceptor!.origin = { ...e.body.position };
    e.interceptor!.relocate = true;
    this.game.finale.cinema!.pursuit.reset();
  }
}
