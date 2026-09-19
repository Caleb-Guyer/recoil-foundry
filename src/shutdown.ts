import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Level, Spawn } from './levels.ts';
import { distance, segmentBox, type Checkpoint, type Vec } from './rules.ts';
import {
  DISCONNECT,
  DISCONNECT_STAGES,
  SHUTDOWN_PANELS,
  shutdownLevel,
  type ShutdownSave,
} from './shutdown-layout.ts';

const { Body } = Matter;
export class ShutdownSystem {
  game: Game;
  state: ShutdownSave | null = null;
  finishTime = 0;
  flash = 0;
  constructor(game: Game) {
    this.game = game;
  }
  start(save?: Checkpoint) {
    this.state = save ? (save.shutdown ? structuredClone(save.shutdown) : null) : { disabled: [] };
    this.finishTime = this.flash = 0;
  }
  get eligible() {
    const g = this.game;
    return (
      !!this.state &&
      !g.practice &&
      !g.workshop.active &&
      !g.overtime &&
      !g.detour &&
      !g.escape &&
      (!g.testRun || !!g.testRun.shutdown)
    );
  }
  get chamber() {
    return this.eligible && this.state?.chamber === true;
  }
  get complete() {
    return this.chamber && this.state!.cycle === 3;
  }
  get entrance() {
    const g = this.game;
    return (
      this.eligible &&
      !this.chamber &&
      this.state!.disabled.length === 3 &&
      g.stage === 19 &&
      g.clear &&
      !g.combatEnemyCount &&
      !g.waves.pending
    );
  }
  get cabinet() {
    return (
      this.eligible &&
      !this.chamber &&
      (DISCONNECT_STAGES as readonly number[]).includes(this.game.stage)
    );
  }
  get target(): Vec | null {
    const g = this.game;
    if (!this.eligible || !g.clear || g.combatEnemyCount || g.waves.pending) return null;
    if (this.chamber) return SHUTDOWN_PANELS[this.state!.cycle!] ?? null;
    return this.cabinet && !this.state!.disabled.includes(g.stage) ? DISCONNECT : null;
  }
  reset() {
    this.finishTime = this.flash = 0;
  }
  level(source: Level) {
    return this.chamber ? shutdownLevel(this.state!.cycle!) : source;
  }
  reinforcements(level: Level): Spawn[] {
    const g = this.game;
    if (
      !this.eligible ||
      this.chamber ||
      !this.state!.disabled.length ||
      g.auditor.scheduled ||
      level.boss ||
      level.freight ||
      g.areaEvents.encounter ||
      level.story ||
      level.courier ||
      level.floodgate ||
      level.fabricatorIntro
    )
      return [];
    // Reuse supported anchors in the later wave; doors handle warning, occupancy
    // and relocation. Extra security never materializes through the player.
    return level.spawns
      .filter((s) => ['runner', 'hopper', 'flyer', 'shooter', 'skimmer'].includes(s.kind))
      .slice(-this.state!.disabled.length)
      .map((s, i) => ({
        kind: s.kind,
        x: s.x,
        y: s.y,
        elite: i === 1 ? ('twin' as const) : ('shielded' as const),
      }));
  }
  trace(from: Vec, to: Vec, radius = 0) {
    const p = this.target;
    if (!p || distance(this.game.player.position, p) > 190) return null;
    return segmentBox(
      from,
      to,
      { x: p.x - 17 - radius, y: p.y - 22 - radius },
      { x: p.x + 17 + radius, y: p.y + 22 + radius },
    );
  }
  trigger() {
    const g = this.game,
      p = this.target;
    if (g.mode !== 'playing' || g.hp <= 0 || !p || distance(g.player.position, p) > 190)
      return false;
    this.flash = 0.45;
    g.burst(p, 14, '#b9e4cb', 3);
    g.onSound('shutdown-break');
    g.feedback(2.8);
    if (this.chamber) {
      this.state!.cycle!++;
      if (!this.complete) {
        g.clear = false;
        const next = shutdownLevel(this.state!.cycle!);
        // Hold every arrival behind a warned door, including the opening group.
        g.level.spawns = next.spawns;
        const opening = g.waves.reset(g.level);
        g.waves.doors.push(
          ...opening.map((spawn) => ({
            spawn,
            state: 'sealed' as const,
            timer: 0,
            blocked: 0,
            attackDelay: 1,
          })),
        );
        g.waves.phase = 'opening';
        g.waves.openingCount = 0;
      } else {
        g.shots = [];
        g.burstRemaining = 0;
        g.fireBuffer = g.jumpBuffer = 0;
        g.torch.stop();
        g.onSound('shutdown-stop');
      }
    } else {
      this.state!.disabled.push(g.stage);
      this.state!.disabled.sort((a, b) => a - b);
    }
    g.save();
    g.onChange();
    return true;
  }
  blast(origin: Vec, radius: number) {
    const p = this.target;
    if (p && distance(origin, p) < radius && distance(this.game.lineEnd(origin, p), p) < 1)
      return this.trigger();
    return false;
  }
  enter() {
    const g = this.game;
    if (!this.entrance || g.mode !== 'playing' || g.hp <= 0) return false;
    this.state!.chamber = true;
    this.state!.cycle = 0;
    g.loadRoom();
    g.save();
    g.onSound('evacuate');
    g.onChange();
    return true;
  }
  update(dt: number) {
    const g = this.game;
    if (!this.eligible || g.mode !== 'playing' || g.hp <= 0 || dt <= 0) return;
    this.flash = Math.max(0, this.flash - dt);
    if (this.entrance && g.grounded && g.player.position.x < 66 && g.player.position.y > 680) {
      this.enter();
      return;
    }
    const p = this.target;
    if (
      p &&
      distance(g.player.position, p) <= 190 &&
      g.props.items.some(
        (prop) =>
          !prop.body.isStatic &&
          prop.body.speed > 4 &&
          distance(prop.body.position, p) < 42 &&
          distance(g.lineEnd(prop.body.position, p, 0, prop), p) < 1,
      )
    )
      this.trigger();
    if (this.complete) {
      this.finishTime += dt;
      if (this.finishTime >= 4.5) {
        Body.setVelocity(g.player, { x: 0, y: 0 });
        g.setMode('won');
        if (!g.testRun) g.onCheckpoint(null);
        g.onSound('win');
      }
    }
  }
}
