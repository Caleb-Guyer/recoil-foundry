import Matter from 'matter-js';
import type { Enemy, Input } from './game.ts';
import type { StartingGun } from './starting-guns.ts';
import { createUpgradeDemo, destroyUpgradeDemo } from './upgrade-demo.ts';
import { TOOL_TRIAL_CONVERTED_MODS } from './tools-of-trade-test.ts';

export type ToolTrialScene = 'range' | 'converted';
export const TOOL_TRIAL_TARGETS = [430, 590, 750] as const;
const { Bodies, Body, Composite, Query } = Matter;
/** A detached native physics world. No Campaign, profile or reward callback is connected. */
export class ToolTrial {
  readonly game;
  readonly gun: StartingGun;
  readonly scene: ToolTrialScene;
  private stopped = false;
  private mounts: { x: number; enemy?: Enemy; returnAt: number }[] = [];
  constructor(gun: StartingGun, scene: ToolTrialScene = 'range') {
    this.gun = gun;
    this.scene = scene;
    const mods = scene === 'converted' ? TOOL_TRIAL_CONVERTED_MODS : [];
    const g = (this.game = createUpgradeDemo(mods, gun, `RF-C106-TOOLS-${gun}-${scene}`));
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
    g.crosswind.clear();
    g.magnets.items = [];
    g.level = {
      id: 'tool-trial',
      name: 'Tool range',
      area: 'docks',
      mirrored: false,
      boss: false,
      solids: [
        { x: 0, y: 420, w: 910, h: 20 },
        { x: 890, y: 440, w: 20, h: 300 },
      ],
      route: [],
      spawns: [],
      hazards: [],
      setpiece: { rosters: [[]], weak: [], props: [] },
    };
    for (const s of g.level.solids) {
      const body = Bodies.rectangle(s.x + s.w / 2, s.y + s.h / 2, s.w, s.h, {
        isStatic: true,
        label: 'terrain',
      });
      g.terrain.push(body);
      Composite.add(g.engine.world, body);
    }
    Body.setPosition(g.player, { x: 140, y: 721 });
    Body.setVelocity(g.player, { x: 0, y: 0 });
    g.workshop.slots = [];
    g.waves.clear();
    this.mounts = TOOL_TRIAL_TARGETS.map((x) => ({ x, returnAt: 0 }));
    this.refreshTargets();
    g.combatReport.reset();
  }
  private refreshTargets() {
    const g = this.game;
    for (const mount of this.mounts) {
      if (mount.enemy && (!g.enemies.includes(mount.enemy) || mount.enemy.hp <= 0)) {
        mount.enemy = undefined;
        mount.returnAt = g.time + 1.25;
      }
      if (mount.enemy || g.time < mount.returnAt) continue;
      const hull = { min: { x: mount.x - 18, y: 706 }, max: { x: mount.x + 18, y: 739 } };
      if (
        Query.region(
          [g.player, ...g.props.bodies, ...g.enemies.filter((e) => e.hp > 0).map((e) => e.body)],
          hull,
        ).length
      )
        continue;
      const enemy = g.spawnEnemy('runner', mount.x, 723);
      if (!enemy) continue;
      enemy.workshopTarget = { home: { x: mount.x, y: 723 }, moving: false };
      enemy.hp = enemy.maxHp = 160;
      enemy.spawn = 0;
      enemy.facing = -1;
      enemy.aim = { x: -1, y: 0 };
      enemy.timer = 0;
      Body.setStatic(enemy.body, true);
      mount.enemy = enemy;
    }
  }
  tick(dt: number, input: Input) {
    if (this.stopped || !Number.isFinite(dt) || dt <= 0 || this.game.mode !== 'playing') return;
    this.refreshTargets();
    this.game.tick(Math.min(dt, 1 / 30), input);
  }
  dispose() {
    if (this.stopped) return;
    this.stopped = true;
    destroyUpgradeDemo(this.game);
    this.mounts = [];
  }
}
