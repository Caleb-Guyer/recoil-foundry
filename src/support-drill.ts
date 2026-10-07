import Matter from 'matter-js';
import type { Enemy, Input } from './game.ts';
import type { Prop } from './props.ts';
import { createUpgradeDemo, destroyUpgradeDemo } from './upgrade-demo.ts';
import { SUPPORT_DRILLS, supportDrillMastery, type SupportDrillId } from './support-drill-info.ts';

const { Body, Bodies, Composite } = Matter;
// The range owns its Game, random stream, physics and counters. Its test flag
// prohibits awards; no callbacks connect it to a Campaign or saved profile.
export class SupportDrill {
  readonly id: SupportDrillId;
  readonly game;
  private mounts: { x: number; y: number; hp: number; enemy?: Enemy; returnAt: number }[] = [];
  private cover?: Prop;
  private emitter?: Enemy;
  private attackAt = 2.5;
  private disposed = false;
  constructor(id: SupportDrillId) {
    this.id = id;
    const g = (this.game = createUpgradeDemo(
      SUPPORT_DRILLS[id].mods,
      'pistol',
      'SUPPORT-DRILL-' + id,
    ));
    // Workshop normally ignores damage before testing armor. Test isolation is
    // sufficient here; keep the ordinary collision, hurt and plate paths active.
    g.workshop.active = false;
    g.clear = true;
    for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
    g.enemies = [];
    for (const p of [...g.props.items]) g.props.remove(p);
    for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
    g.terrain = g.terrain.slice(0, 4);
    g.hazards.clear();
    g.breaches.clear();
    g.destruction.clear();
    g.conveyors.clear();
    g.pressure.clear();
    g.crossing.clear();
    g.freight.clear();
    g.counterweights.clear();
    g.loaderArena.clear();
    g.level = {
      ...g.level,
      name: 'Support training',
      solids: [],
      route: [],
      spawns: [],
      hazards: [],
      setpiece: { rosters: [[]], weak: [0, 0], props: [] },
    };
    const solids = [
      { x: 40, y: 430, w: 20, h: 310 },
      { x: 880, y: 430, w: 20, h: 310 },
      { x: 40, y: 500, w: 860, h: 20 },
    ];
    const placements =
      id === 'heat'
        ? [
            { x: 430, y: 693, hp: 90 },
            { x: 610, y: 603, hp: 90 },
            { x: 790, y: 693, hp: 90 },
          ]
        : id === 'overkill'
          ? [
              { x: 490, y: 693, hp: 10 },
              { x: 750, y: 693, hp: 60 },
            ]
          : [];
    for (const p of placements) {
      solids.push({ x: p.x - 42, y: p.y + 17, w: 84, h: 22 });
      this.mounts.push({ ...p, returnAt: 0 });
    }
    g.level.solids = solids;
    for (const s of solids) {
      const b = Bodies.rectangle(s.x + s.w / 2, s.y + s.h / 2, s.w, s.h, {
        isStatic: true,
        label: 'terrain',
      });
      g.terrain.push(b);
      Composite.add(g.engine.world, b);
    }
    this.refreshTargets();
    if (id === 'armor') {
      this.emitter = this.target(820, 723, 100000, 'shooter');
      this.refreshCover();
    }
    g.combatReport.reset();
  }
  private target(x: number, y: number, hp: number, kind: 'runner' | 'shooter' = 'runner') {
    const e = this.game.spawnEnemy(kind, x, y)!;
    e.workshopTarget = { home: { x, y }, moving: false };
    e.spawn = 0;
    e.hp = e.maxHp = hp;
    e.facing = -1;
    Body.setStatic(e.body, true);
    return e;
  }
  private refreshTargets() {
    const g = this.game;
    for (const mount of this.mounts) {
      if (mount.enemy && mount.enemy.hp <= 0) {
        mount.enemy = undefined;
        mount.returnAt = g.time + 1.4;
      }
      if (!mount.enemy && g.time >= mount.returnAt)
        mount.enemy = this.target(mount.x, mount.y, mount.hp);
    }
  }
  private refreshCover() {
    const g = this.game;
    if (this.cover && !g.props.items.includes(this.cover)) this.cover = undefined;
    if (!this.cover && !g.support.plate && g.time >= g.support.plateReadyAt) {
      this.cover = g.props.spawn('cover', 350, 697);
      Body.setStatic(this.cover.body, true);
    }
  }
  get current() {
    const mastery = supportDrillMastery(this.id);
    return Math.min(mastery.target, this.game.combatReport.snapshot()[mastery.counter]);
  }
  get complete() {
    return this.current >= supportDrillMastery(this.id).target;
  }
  get failed() {
    return this.game.mode === 'dead';
  }
  get cue() {
    const g = this.game;
    if (this.complete) return 'Drill complete. Take this technique into your next run.';
    if (this.failed) return 'Range attempt ended. Retry for a fresh start.';
    if (this.id === 'heat')
      return g.support.relay > 0 && g.time <= g.support.relayUntil
        ? 'Heat stored — switch targets now!'
        : 'Build heat on one target, then hand it over when the target falls.';
    if (this.id === 'overkill')
      return g.support.reserve > 0
        ? 'Charge stored — fire at the right target.'
        : 'Finish the weak left target to store a charge.';
    const seconds = Math.max(0, this.attackAt - g.time);
    return g.support.plate
      ? 'Plate ready. Intercept the small bullet before it expires.'
      : g.time < g.support.plateReadyAt
        ? 'Plate recharging · ' + Math.ceil(g.support.plateReadyAt - g.time) + ' seconds.'
        : 'Break the cover · next shot in ' + seconds.toFixed(1) + ' seconds.';
  }
  tick(dt: number, input: Input) {
    if (this.disposed || this.complete || this.failed) return;
    const g = this.game;
    this.refreshTargets();
    if (this.id === 'armor') {
      this.refreshCover();
      if (this.emitter) {
        this.emitter.timer = Math.max(0, this.attackAt - g.time);
        const p = g.player.position,
          from = this.emitter.body.position;
        const length = Math.hypot(p.x - from.x, p.y - from.y) || 1;
        this.emitter.aim = { x: (p.x - from.x) / length, y: (p.y - from.y) / length };
      }
      if (g.time >= this.attackAt && this.emitter) {
        const from = this.emitter.body.position,
          p = g.player.position;
        g.enemyShot(this.emitter, Math.atan2(p.y - from.y, p.x - from.x), 8, 14);
        this.emitter.flash = 0.12;
        this.attackAt = g.time + 6;
      }
    }
    g.tick(dt, input);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    destroyUpgradeDemo(this.game);
  }
}
