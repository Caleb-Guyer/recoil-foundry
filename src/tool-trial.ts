import Matter from 'matter-js';
import type { Enemy, Input } from './game.ts';
import { MELEE_FITTINGS } from './melee-fittings.ts';
import { isMeleeWeapon, type StartingGun } from './starting-guns.ts';
import { createUpgradeDemo, destroyUpgradeDemo } from './upgrade-demo.ts';
import { TOOL_TRIAL_CONVERTED_MODS } from './tools-of-trade-test.ts';

export type ToolTrialScene = 'range' | 'converted';
export const TOOL_TRIAL_TARGETS = [430, 590, 750] as const;
const MELEE_DRILLS = {
  katana: {
    targets: [350],
    goal: 'Face the firing dummy and slash as its round comes within reach.',
    success: 'Parry complete. You sent a round back at the firing dummy.',
  },
  hammer: {
    targets: [219, 510],
    goal: 'Hit a loose dummy from the side to send it sliding.',
    success: 'Knockback complete. Your swing sent the dummy sliding.',
  },
  spear: {
    targets: [217, 289],
    goal: 'Line up both dummies. Hold until the charge bar is full, then release to pierce both.',
    success: 'Pierce complete. One fully charged thrust struck both dummies.',
  },
} as const;
const { Bodies, Body, Composite, Query } = Matter;
/** A detached native physics world. No Campaign, profile or reward callback is connected. */
export class ToolTrial {
  readonly game;
  readonly gun: StartingGun;
  readonly scene: ToolTrialScene;
  private stopped = false;
  private mounts: { x: number; enemy?: Enemy; returnAt: number }[] = [];
  private complete = false;
  get drillMessage() {
    if (!isMeleeWeapon(this.gun)) return '';
    if (this.gun === 'katana' && this.game.mods.includes('second-beat'))
      return this.complete
        ? 'Double parry complete. One slash returned both rounds.'
        : 'Two dummies fire together. Time one slash to return both rounds.';
    const drill = MELEE_DRILLS[this.gun];
    return this.complete ? drill.success : drill.goal;
  }
  constructor(gun: StartingGun, scene: ToolTrialScene = 'range', fittings: readonly string[] = []) {
    this.gun = gun;
    this.scene = scene;
    const mods: readonly string[] = isMeleeWeapon(gun)
      ? MELEE_FITTINGS.filter((f) => f.weapon === gun && fittings.includes(f.id)).map((f) => f.id)
      : scene === 'converted'
        ? TOOL_TRIAL_CONVERTED_MODS
        : [];
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
    const targets =
      gun === 'katana' && mods.includes('second-beat')
        ? [350, 415]
        : isMeleeWeapon(gun)
          ? MELEE_DRILLS[gun].targets
          : TOOL_TRIAL_TARGETS;
    this.mounts = targets.map((x) => ({ x, returnAt: 0 }));
    this.refreshTargets();
    g.combatReport.reset();
  }
  private refreshTargets() {
    const g = this.game;
    let spawnedEmitter = false;
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
      const firing = this.gun === 'katana';
      const enemy = g.spawnEnemy(firing ? 'shooter' : 'runner', mount.x, 723);
      if (!enemy) continue;
      enemy.workshopTarget = { home: { x: mount.x, y: 723 }, moving: false, firing };
      enemy.hp = enemy.maxHp = 160;
      enemy.spawn = 0;
      enemy.facing = -1;
      enemy.aim = { x: -1, y: 0 };
      enemy.timer = 0;
      if (firing) spawnedEmitter = true;
      if (this.gun !== 'hammer') Body.setStatic(enemy.body, true);
      mount.enemy = enemy;
    }
    // Restart the shared warning when either dummy returns. A partial parry
    // can destroy just one emitter; the next pair must still arrive together.
    if (spawnedEmitter)
      for (const { x, enemy } of this.mounts) {
        if (!enemy) continue;
        enemy.state = 'idle';
        enemy.timer = 0.75 - (x - MELEE_DRILLS.katana.targets[0]) / (8 * 60);
      }
  }
  tick(dt: number, input: Input) {
    if (this.stopped || !Number.isFinite(dt) || dt <= 0 || this.game.mode !== 'playing') return;
    this.refreshTargets();
    this.game.tick(Math.min(dt, 1 / 30), input);
    const strike = this.game.melee.activeStrike;
    if (this.complete || !strike) return;
    if (strike.weapon === 'katana')
      this.complete = strike.parries >= (this.game.mods.includes('second-beat') ? 2 : 1);
    if (strike.weapon === 'hammer')
      this.complete = this.mounts.some(
        ({ enemy }) =>
          enemy && strike.struck.has(enemy.body) && Math.abs(enemy.body.velocity.x) >= 4,
      );
    if (strike.weapon === 'spear' && strike.charge >= 1) this.complete = strike.enemiesHit >= 2;
  }
  dispose() {
    if (this.stopped) return;
    this.stopped = true;
    destroyUpgradeDemo(this.game);
    this.mounts = [];
  }
}
