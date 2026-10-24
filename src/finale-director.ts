import Matter from 'matter-js';
import { REMIX_LAYOUTS } from './boss-remix-layout.ts';
import type { BossRemixId } from './boss-remix-rules.ts';
import type { Enemy, Game, Input } from './game.ts';
import type { FinalTransformation } from './final-transformation.ts';
import type { Solid } from './levels.ts';
import { finalePreview } from './final-arsenal.ts';
import { clamp } from './rules.ts';

export type FinaleScene =
  | 'off'
  | 'approach'
  | 'boarding'
  | 'duel'
  | 'airlift'
  | 'siege'
  | 'core-opening'
  | 'rupture'
  | 'escape'
  | 'destruction'
  | 'complete';
export const FINALE_DURATIONS = {
  boarding: 6,
  airlift: 8,
  'core-opening': 8,
  escape: 5,
  destruction: 7,
} as const;
export const finaleFormHealth = (base: number, phase: number, overtime: boolean) =>
  Math.round(base * (overtime ? [1, 1.2, 1.4] : [1, 1.12, 1.25])[phase]);
export function cinemaSolids(phase: number, mirrored: boolean, remix?: BossRemixId): Solid[] {
  if (phase === 0 && remix)
    return REMIX_LAYOUTS[remix].solids.map((s) => ({ ...s, x: mirrored ? 2000 - s.x - s.w : s.x }));
  const values =
    phase === 0
      ? [
          [510, 500, 260, 22],
          [1110, 470, 240, 22],
        ]
      : phase === 1
        ? [
            [220, 568, 220, 22],
            [570, 427, 240, 22],
            [990, 457, 250, 22],
            [1550, 553, 220, 22],
          ]
        : [
            [180, 620, 220, 24],
            [520, 470, 240, 24],
            [900, 585, 200, 24],
            [1240, 465, 240, 24],
            [1600, 620, 220, 24],
          ];
  return values.map(([x, y, w, h]) => ({ x: mirrored ? 2000 - x - w : x, y, w, h }));
}

// This director owns only revision 97. Old checkpoints keep their original
// threshold transitions, timelines and damage rules.
export class FinaleDirector {
  game: Game;
  finale: FinalTransformation;
  active = true;
  state: FinaleScene = 'approach';
  clock = 0;
  elapsed = 0;
  firstClear: boolean;
  baseHp: number;
  collisionMask: number;
  cues = new Set<string>();
  constructor(game: Game, finale: FinalTransformation, enemy: Enemy) {
    this.game = game;
    this.finale = finale;
    this.firstClear = game.finaleFirstClear;
    this.baseHp = enemy.maxHp;
    this.collisionMask = enemy.body.collisionFilter.mask!;
  }
  get phase() {
    return this.finale.phase;
  }
  get locked() {
    return ['boarding', 'airlift', 'escape', 'destruction'].includes(this.state);
  }
  get combat() {
    return ['duel', 'siege', 'rupture'].includes(this.state);
  }
  get waiting() {
    return this.state !== 'complete';
  }
  get anchored() {
    return this.phase > 0;
  }
  x(x: number) {
    return this.game.level.mirrored ? 2000 - x : x;
  }
  reset() {
    const g = this.game,
      e = this.finale.enemy!;
    const preview = g.testRun && finalePreview(g.testRun.seed);
    this.finale.phase = preview?.scene
      ? ['approach', 'boarding', 'airlift'].includes(preview.scene)
        ? 0
        : preview.scene === 'core-opening'
          ? 1
          : 2
      : preview
        ? preview.phase
        : 0;
    e.phase = this.phase;
    this.finale.state = 'combat';
    this.finale.rebuild();
    if (preview?.scene) {
      this.state = preview.scene;
      if (this.state === 'airlift') this.finale.phase = e.phase = 0;
      if (this.state === 'core-opening') this.finale.phase = e.phase = 1;
      if (this.state === 'destruction' || this.state === 'escape') this.finale.phase = e.phase = 2;
      this.finale.wreck = {
        x: this.x(this.phase === 0 ? 1450 : this.phase === 2 ? 1240 : 1300),
        y: this.phase === 2 ? 360 : 665,
      };
      if (this.state !== 'approach' && this.state !== 'boarding') e.hp = 0;
      this.hideEnemy();
      if (this.state === 'approach') Matter.Body.setPosition(g.player, { x: this.x(140), y: 718 });
      else Matter.Body.setPosition(g.player, { x: this.x(1030), y: 718 });
      this.change(this.state);
      if (this.state === 'destruction' || this.state === 'escape') {
        Matter.Composite.remove(g.engine.world, e.body);
        g.enemies = g.enemies.filter((q) => q !== e);
      }
    } else if (preview && (preview.phase > 0 || preview.attack)) this.enterForm(preview.phase);
    else {
      this.state = 'approach';
      this.hideEnemy();
      Matter.Body.setPosition(g.player, { x: this.x(140), y: 718 });
      Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
    }
    e.spawn = 0;
    g.shake = 0;
  }
  filterInput(input: Input): Input {
    if (this.combat || this.state === 'complete') return input;
    return { ...input, fire: false, firePressed: false, portal: undefined };
  }
  cue(name: string, at: number) {
    if (this.clock >= at && !this.cues.has(name)) {
      this.cues.add(name);
      this.game.onSound(name);
    }
  }
  change(state: FinaleScene) {
    this.state = state;
    this.clock = 0;
    this.cues.clear();
    this.finale.state = 'combat';
    this.finale.quiet();
    this.game.shake = 0;
  }
  hideEnemy() {
    const e = this.finale.enemy!;
    e.body.isSensor = true;
    e.body.collisionFilter.mask = 0;
    Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
    Matter.Body.setPosition(e.body, { x: this.x(1450), y: 680 });
    e.state = 'transition';
    e.timer = 0;
  }
  enterForm(phase: number) {
    const f = this.finale,
      e = f.enemy!,
      g = this.game;
    f.phase = e.phase = phase;
    g.reachedFinalePhase = Math.max(g.reachedFinalePhase, phase) as 0 | 1 | 2;
    f.rebuild();
    const [w, h] = [
      [66, 74],
      [110, 105],
      [110, 120],
    ][phase];
    // Matter bounds include velocity padding. Size the actual vertices so a
    // moving or previously hidden hull cannot shrink the next form's hitbox.
    const xs = e.body.vertices.map((v) => v.x),
      ys = e.body.vertices.map((v) => v.y);
    Matter.Body.scale(
      e.body,
      w / (Math.max(...xs) - Math.min(...xs)),
      h / (Math.max(...ys) - Math.min(...ys)),
    );
    Matter.Body.setInertia(e.body, Infinity);
    Matter.Body.setMass(e.body, g.player.mass * (phase === 0 ? 8 : 20));
    e.body.isSensor = false;
    e.body.collisionFilter.mask = this.collisionMask;
    const p = {
      x: this.x(phase === 0 ? 1450 : phase === 1 ? 1300 : 1240),
      y: phase === 0 ? 680 : phase === 1 ? 666 : 360,
    };
    Matter.Body.setPosition(e.body, p);
    Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
    e.hp = e.maxHp = finaleFormHealth(this.baseHp, phase, !!g.overtime);
    e.state = 'idle';
    e.timer = 1.15;
    e.attack = 'aimed';
    e.interceptor!.origin = { ...p };
    e.interceptor!.relocate = false;
    e.interceptor!.finale!.chain = 0;
    e.hunt = undefined;
    const previous = this.state;
    this.change((['duel', 'siege', 'rupture'] as const)[phase]);
    f.nextStrike = g.overtime ? 1.8 : 2.5;
    g.feedback(phase ? 7 : 3);
    if (!((phase === 0 && previous === 'boarding') || (phase === 1 && previous === 'airlift')))
      g.onSound(phase === 0 ? 'cinema-start' : phase === 1 ? 'cinema-impact' : 'cinema-rupture');
  }
  breakForm(e: Enemy) {
    if (!this.finale.owns(e) || !this.combat || this.phase >= 2) return false;
    this.finale.wreck = { ...e.body.position };
    e.hp = 0;
    this.hideEnemy();
    this.change(this.phase === 0 ? 'airlift' : 'core-opening');
    return true;
  }
  defeated(e: Enemy) {
    this.finale.wreck = { ...e.body.position };
    this.change(this.firstClear || this.game.overtime ? 'destruction' : 'escape');
  }
  advance(dt: number) {
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    dt = Math.min(dt, 0.05);
    this.clock += dt;
    this.elapsed += dt;
    const g = this.game;
    if (this.state === 'approach') {
      if ((g.level.mirrored ? 2000 - g.player.position.x : g.player.position.x) >= 1110) {
        Matter.Body.setPosition(g.player, { x: this.x(1110), y: 718 });
        Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
        this.change('boarding');
      }
    } else if (this.state === 'boarding') {
      this.cue('cinema-start', 4);
      if (this.clock >= FINALE_DURATIONS.boarding) this.enterForm(0);
    } else if (this.state === 'airlift') {
      this.cue('cinema-plane', 0.2);
      this.cue('cinema-cable', 2.5);
      this.cue('cinema-impact', 7.3);
      if (this.clock >= FINALE_DURATIONS.airlift) this.enterForm(1);
    } else if (this.state === 'core-opening') {
      this.cue('cinema-core', 1.7);
      if (this.clock >= FINALE_DURATIONS['core-opening']) this.enterForm(2);
    } else if (this.state === 'escape' || this.state === 'destruction') {
      if (this.state === 'escape') this.cue('cinema-escape', 0.2);
      else this.cue('cinema-explosion', 2.65);
      const length = FINALE_DURATIONS[this.state];
      if (this.clock >= length) {
        this.state = 'complete';
        this.clock = 0;
        this.finale.state = 'complete';
        this.finale.cleared = true;
        // Rain carries the aftermath without a second legacy stinger.
      }
    }
  }
  beforeTick(dt: number) {
    if (!this.combat && this.state !== 'complete') {
      // Attacks can finish their callback after the chassis breaks. Discard
      // those leftovers before any movie frame or movable background step.
      this.finale.clearCinemaAttacks();
      // Orbit rounds are already earned ammunition. Firing is disabled during
      // every scene, so its short release allowance must wait with the player.
      const step =
        dt > 0 && Number.isFinite(dt)
          ? this.locked
            ? Math.min(dt, 0.05)
            : this.game.hitStop > 0
              ? 0
              : dt
          : 0;
      for (const round of this.game.fusions.orbit) round.at += step;
    }
    if (!this.locked) return false;
    if (dt > 0 && Number.isFinite(dt)) this.game.time += Math.min(dt, 0.05);
    this.advance(dt);
    return true;
  }
  update(dt: number) {
    if (!this.locked) this.advance(dt);
    if (!this.combat) {
      const e = this.finale.enemy;
      if (e && this.game.enemies.includes(e)) {
        Matter.Body.setPosition(e.body, { x: this.x(1450), y: 680 });
        Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
        e.body.force.x = 0;
        e.body.force.y = -e.body.mass * this.game.engine.gravity.y * this.game.engine.gravity.scale;
      }
    }
  }
  beforeEnemy(e: Enemy) {
    if (!this.finale.owns(e)) return false;
    if (!this.combat) return true;
    if (this.anchored) {
      // Stabilize the giant chassis through Matter, without teleporting an
      // active muzzle after its warning locks. The floor and shelves still
      // intercept its real hull and all projectiles.
      e.interceptor!.relocate = false;
      if (e.state === 'recover') Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
      if (this.phase === 2 && e.state === 'idle' && e.timer > 0) {
        const targetY = 340 + Math.sin(this.elapsed * 0.36) * 65;
        Matter.Body.setVelocity(e.body, {
          x: clamp((this.x(1240) - e.body.position.x) * 0.025, -2, 2),
          y: clamp((targetY - e.body.position.y) * 0.025, -1.5, 1.5),
        });
      }
    }
    return false;
  }
}
