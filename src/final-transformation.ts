import Matter from 'matter-js';
import type { Enemy, Game, Input } from './game.ts';
import type { Level, Solid } from './levels.ts';
import { clamp, distance, type Vec } from './rules.ts';
import { clearArsenal } from './interceptor-weapons.ts';
import { finalePreview } from './final-arsenal.ts';

import { transformedFinale, cinematicFinale } from './boss-progression.ts';
import { FinaleDirector, cinemaSolids } from './finale-director.ts';
export { transformedFinale };
export const FINAL_FORMS = ['Mimic', 'Siege frame', 'Rupture core'] as const;
export const FINAL_THRESHOLDS = [0.68, 0.34, 0] as const;
export const FINAL_WARNING = 1.65;
export type ArenaStrike = {
  kind: 'floor' | 'column' | 'crosscut';
  rects: Solid[];
  left: number;
  fired: boolean;
};
const box = (x: number, y: number, w: number, h: number): Solid => ({ x, y, w, h });

export function transformedLevel(g: Game, level: Level): Level {
  if (
    !transformedFinale(g.seed) ||
    g.stage !== 19 ||
    g.escape ||
    g.detour ||
    !level.spawns.some((e) => e.kind === 'interceptor')
  )
    return level;
  // The finale's machinery replaces the patrol, rather than adding threats to it.
  return {
    ...level,
    ...(cinematicFinale(g.seed)
      ? { solids: cinemaSolids(0, level.mirrored, level.bossRemix) }
      : {}),
    spawns: level.spawns.filter((e) => e.kind === 'interceptor'),
    hazards: [],
    conductors: [],
    fans: [],
    setpiece: undefined,
  };
}

export function formSolids(phase: number, mirrored: boolean, skybridge: boolean): Solid[] {
  const result =
    phase === 1
      ? [
          box(70, 688, 150, 52),
          box(280, 610, 160, 22),
          box(510, 525, 250, 26),
          box(850, 420, 300, 28),
          box(1240, 525, 250, 26),
          box(1560, 610, 160, 22),
          box(1780, 688, 150, 52),
        ]
      : [
          box(90, 675, 180, 65),
          box(340, 565, 210, 24),
          box(650, skybridge ? 440 : 470, 240, 26),
          box(925, 620, 150, 22),
          box(1110, skybridge ? 470 : 440, 240, 26),
          box(1450, 565, 210, 24),
          box(1730, 675, 180, 65),
        ];
  return mirrored ? result.map((s) => ({ ...s, x: 2000 - s.x - s.w })) : result;
}

export class FinalTransformation {
  readonly game: Game;
  constructor(game: Game) {
    this.game = game;
  }
  cinema: FinaleDirector | null = null;
  enemy: Enemy | null = null;
  phase = 0;
  hullScale = 1;
  state: 'off' | 'intro' | 'transform' | 'combat' | 'defeat' | 'complete' = 'off';
  clock = 0;
  changed = false;
  nextStrike = 4;
  cycle = 0;
  strike: ArenaStrike | null = null;
  oldSolids: Solid[] = [];
  wreck: Vec = { x: 0, y: 0 };
  cleared = false;
  get active() {
    return this.state !== 'off';
  }
  get presenting() {
    return this.cinema ? this.cinema.locked : ['intro', 'transform', 'defeat'].includes(this.state);
  }
  get waiting() {
    return this.cinema ? this.cinema.waiting : this.presenting;
  }
  get safe() {
    return this.cinema ? !this.cinema.combat && this.cinema.state !== 'complete' : this.presenting;
  }
  owns(e: Enemy) {
    return this.active && this.enemy === e;
  }
  phaseFor(e: Enemy) {
    if (this.cinema) return e.phase;
    return e.hp <= e.maxHp * 0.34 + 1e-7 ? 2 : e.hp <= e.maxHp * 0.68 + 1e-7 ? 1 : 0;
  }
  reset() {
    const g = this.game;
    this.cinema = null;
    this.enemy = null;
    this.state = 'off';
    this.clock = 0;
    this.phase = 0;
    this.hullScale = 1;
    this.strike = null;
    this.cycle = 0;
    this.nextStrike = 4;
    this.cleared = false;
    this.oldSolids = [];
    if (!transformedFinale(g.seed) || g.stage !== 19 || g.escape || g.detour) return;
    const e = g.enemies.find((e) => e.kind === 'interceptor');
    if (!e?.interceptor?.finale) return;
    this.enemy = e;
    if (cinematicFinale(g.seed)) {
      this.cinema = new FinaleDirector(g, this, e);
      this.cinema.reset();
      return;
    }
    const preview = g.testRun && finalePreview(g.testRun.seed);
    this.phase = preview ? preview.phase : 0;
    e.phase = this.phase;
    if (this.phase) this.rebuild();
    this.state = 'intro';
    e.spawn = 0;
    e.state = 'idle';
    e.timer = 0.8;
    g.onSound('finale-arrival');
  }
  limitDamage(e: Enemy, amount: number) {
    if (!this.owns(e)) return amount;
    if (this.cinema) return this.cinema.combat ? Math.max(0, Math.min(amount, e.hp)) : 0;
    if (this.presenting || e.phase < this.phaseFor(e)) return 0;
    return Math.max(0, Math.min(amount, e.hp - e.maxHp * FINAL_THRESHOLDS[e.phase]));
  }
  transform(e: Enemy, phase: number) {
    if (!this.owns(e)) return false;
    this.phase = Math.min(e.phase + 1, phase);
    e.phase = this.phase;
    this.state = 'transform';
    this.clock = 0;
    this.changed = false;
    this.oldSolids = structuredClone(this.game.level.solids);
    this.quiet();
    e.state = 'transition';
    e.timer = 0;
    e.interceptor!.finale!.chain = 0;
    e.interceptor!.relocate = true;
    e.hunt = undefined;
    this.game.onSound('finale-transform');
    return true;
  }
  quiet() {
    const g = this.game;
    if (this.enemy) clearArsenal(g, this.enemy);
    g.shots = [];
    this.strike = null;
    g.stormfront.clear();
    // Clear held bursts too: nothing delayed may fire through a transformation.
    g.burstRemaining = 0;
    g.fireBuffer = 0;
    if (this.cinema) {
      g.arcs.reset();
      g.grind.reset();
      g.tripwires.reset();
      g.torch.reset();
      g.portals.reset();
      g.tethers.reset();
      g.muzzle = 0;
      g.trail = [];
    }
  }
  rebuild() {
    const g = this.game,
      e = this.enemy;
    for (const b of g.terrain.slice(4)) Matter.Composite.remove(g.engine.world, b);
    g.terrain = g.terrain.slice(0, 4);
    g.hazards.clear();
    g.breaches.clear();
    g.pressure.clear();
    g.crosswind.clear();
    g.conveyors.clear();
    g.magnets.items = [];
    for (const prop of [...g.props.items]) g.props.remove(prop);
    if (g.uprising.finale === 'mutiny')
      for (const x of [650, 1250]) {
        const cover = g.props.spawn('cover', x, 697);
        cover.hp = cover.maxHp = 150;
      }
    g.arcs.reset();
    g.grind.reset();
    g.tripwires.reset();
    g.torch.reset();
    g.portals.reset();
    g.tethers.reset();
    const solids = this.cinema
      ? cinemaSolids(this.phase, g.level.mirrored, g.level.bossRemix)
      : formSolids(this.phase, g.level.mirrored, g.level.bossRemix === 'boss-skybridge');
    g.level.solids = solids;
    for (const s of solids) {
      const b = Matter.Bodies.rectangle(s.x + s.w / 2, s.y + s.h / 2, s.w, s.h, {
        isStatic: true,
        friction: 0,
        label: 'terrain',
      });
      g.terrain.push(b);
      Matter.Composite.add(g.engine.world, b);
    }
    // The world is paused. Move only an intersecting hull to the top of its new
    // support, never into a wall or through an active attack.
    for (const body of [g.player, ...(e ? [e.body] : [])]) {
      for (const s of [...solids].sort((a, b) => b.y - a.y)) {
        const b = body.bounds;
        if (b.max.x > s.x && b.min.x < s.x + s.w && b.max.y > s.y && b.min.y < s.y + s.h) {
          Matter.Body.setPosition(body, {
            x: body.position.x,
            y: s.y - (b.max.y - b.min.y) / 2 - 3,
          });
          Matter.Body.setVelocity(body, { x: 0, y: 0 });
        }
      }
    }
    if (e && !this.cinema) {
      const scale = this.phase === 2 ? 1.4 : 1.25;
      Matter.Body.scale(e.body, scale / this.hullScale, scale / this.hullScale);
      Matter.Body.setInertia(e.body, Infinity);
      this.hullScale = scale;
      const anchors = [
        { x: 1000, y: 245 },
        { x: 550, y: 310 },
        { x: 1450, y: 310 },
      ];
      const p = anchors.find((p) => distance(p, g.player.position) > 240)!;
      Matter.Body.setPosition(e.body, p);
      Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
      e.interceptor!.origin = { ...p };
    }
    this.nextStrike = this.game.overtime ? 2.4 : 3.4;
    this.cycle = 0;
  }
  beforeTick(dt: number, input: Input) {
    if (this.cinema) return this.cinema.beforeTick(dt);
    if (!this.presenting) return false;
    if (!(dt > 0) || !Number.isFinite(dt)) return true;
    this.clock += Math.min(dt, 0.05);
    const g = this.game,
      e = this.enemy;
    if (this.state === 'intro') {
      if (e) e.aim = { x: -1, y: 0 };
      if (this.clock >= 2.2 || (this.clock > 0.25 && (input.jump || input.firePressed))) {
        this.state = 'combat';
        this.clock = 0;
      }
    } else if (this.state === 'transform') {
      if (this.clock >= 0.95 && !this.changed) {
        this.rebuild();
        this.changed = true;
        g.feedback(5);
      }
      if (this.clock >= 2.5) {
        this.state = 'combat';
        this.clock = 0;
        if (e) {
          e.state = 'idle';
          e.timer = 0.6;
        }
      }
    } else if (this.state === 'defeat' && this.clock >= 3.2) {
      this.state = 'complete';
      this.cleared = true;
      g.onSound('finale-release');
    }
    return true;
  }
  planStrike(): ArenaStrike {
    const g = this.game,
      i = this.cycle++,
      plus = !!g.overtime;
    let kind: ArenaStrike['kind'], rects: Solid[];
    if (this.phase === 1) {
      kind = 'floor';
      const x = [260, 820, 1380][i % 3];
      rects = [box(x, 662, 360, 78)];
      if (plus) rects.push(box([1380, 260, 820][i % 3], 662, 250, 78));
    } else if (i % 2 === 0) {
      kind = 'column';
      // Mark one snapshot of the player's position; an edge cannot remain
      // permanently safe. Both columns lock now and never chase the player.
      const width = plus ? 150 : 120;
      const target = g.level.mirrored ? 2000 - g.player.position.x : g.player.position.x;
      rects = [clamp(target - width / 2, 24, 1976 - width), target < 1000 ? 1470 : 380].map((x) =>
        box(x, 12, width, 728),
      );
    } else {
      kind = 'crosscut';
      const y = i % 4 === 1 ? 560 : 345;
      const gap = plus ? 320 : 440;
      rects = [box(24, y, 976 - gap / 2, 44), box(1000 + gap / 2, y, 976 - gap / 2, 44)];
    }
    if (g.level.mirrored) rects = rects.map((s) => ({ ...s, x: 2000 - s.x - s.w }));
    return { kind, rects, left: FINAL_WARNING, fired: false };
  }
  update(dt: number) {
    this.cinema?.update(dt);
    if (this.cinema && !this.cinema.combat) return;
    if (this.state !== 'combat' || !this.enemy || this.enemy.hp <= 0 || this.phase === 0) return;
    const g = this.game;
    if (this.strike) {
      this.strike.left = Math.max(0, this.strike.left - dt);
      if (this.strike.left > 1e-8) return;
      if (!this.strike.fired) {
        this.strike.fired = true;
        this.strike.left = 0.28;
        const b = g.player.bounds;
        if (
          this.strike.rects.some(
            (s) => b.max.x > s.x && b.min.x < s.x + s.w && b.max.y > s.y && b.min.y < s.y + s.h,
          )
        )
          g.damagePlayer(g.overtime ? 24 : 20, undefined, {
            type: 'induction',
            enemy: 'interceptor',
          });
        g.onSound('finale-arena-fire');
      } else {
        this.strike = null;
        this.nextStrike = this.cinema
          ? g.overtime
            ? 1.3
            : this.phase === 2
              ? 1.8
              : 2.2
          : g.overtime
            ? 2.1
            : this.phase === 2
              ? 3
              : 4;
      }
    } else {
      this.nextStrike -= dt;
      if (this.nextStrike <= 0 && g.uprising.finale !== 'isolated') {
        this.strike = this.planStrike();
        g.onSound('finale-arena-warn');
      }
    }
  }
  defeated(e: Enemy) {
    if (!this.owns(e)) return;
    if (this.cinema) {
      this.cinema.defeated(e);
      return;
    }
    this.wreck = { ...e.body.position };
    this.state = 'defeat';
    this.clock = 0;
    this.quiet();
    this.game.onSound('finale-shutdown');
  }
}
