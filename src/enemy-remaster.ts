import Matter from 'matter-js';
import type { Enemy, Game } from './game.ts';
import { clamp, direction, distance, type Vec } from './rules.ts';
import { firstSolid } from './collisions.ts';

const { Body } = Matter;
export type RemasteredEnemy = 'runner' | 'shooter' | 'flyer';
export const REMASTER_TELL = { runner: 0.5, shooter: 0.55, flyer: 0.7 } as const;
export const REMASTER_START = { runner: 2, shooter: 5, flyer: 8 } as const;
export interface EnemyRemasterRig {
  homeX: number;
  goalX: number;
  scanAt: number;
  side: number;
  turnUsed: boolean;
  support?: Matter.Body;
}
export const enemyRemasterSeed = (seed: string) => Number(/^RF-C(\d+)-/.exec(seed)?.[1] ?? 0) >= 93;
export function remasterKind(e: Enemy): RemasteredEnemy | undefined {
  return e.kind === 'runner' || e.kind === 'shooter' || e.kind === 'flyer' ? e.kind : undefined;
}
export function remasterEligible(g: Game, e: Enemy) {
  const kind = remasterKind(e);
  return (
    !!kind &&
    enemyRemasterSeed(g.seed) &&
    g.stage >= REMASTER_START[kind] &&
    !g.overtime &&
    !g.practice &&
    !g.workshop.active &&
    !g.detour &&
    !g.escape &&
    !g.level.boss &&
    !g.level.annex &&
    !g.level.uprising &&
    !g.level.story &&
    !g.level.shutdown &&
    !g.level.courier &&
    !g.level.floodgate &&
    !g.level.sortingPit &&
    !g.level.freight &&
    !g.level.crossing &&
    !g.areaEvents.encounter &&
    !e.elite &&
    !e.mutation &&
    !e.splitChild &&
    !e.squad &&
    !e.eventRole &&
    !e.courier &&
    !e.allied &&
    !e.workshopTarget &&
    e.recoilTarget === undefined
  );
}

// Use real terrain under the entire foot, never an assumed floor or a prop which may move.
export function standingSurface(g: Game, e: Enemy, x = e.body.position.x) {
  const bottom = e.body.bounds.max.y;
  return g.terrain.find(
    (b) =>
      b.isStatic &&
      Math.abs(b.angle) < 0.01 &&
      x - 13 >= b.bounds.min.x &&
      x + 13 <= b.bounds.max.x &&
      Math.abs(bottom - b.bounds.min.y) < 9,
  );
}
function clearStep(g: Game, e: Enemy, x: number) {
  const p = e.body.position;
  return !firstSolid(p, { x, y: p.y }, { x: 13, y: 12 }, g.solidBodies);
}
function brake(e: Enemy) {
  Body.setVelocity(e.body, { x: 0, y: e.body.velocity.y });
}
function recover(e: Enemy, seconds: number) {
  e.state = 'recover';
  e.timer = seconds;
  brake(e);
}

export class EnemyRemaster {
  readonly game: Game;
  constructor(game: Game) {
    this.game = game;
  }
  update(e: Enemy, target: Vec): boolean {
    const g = this.game;
    if (!remasterEligible(g, e)) return false;
    const kind = remasterKind(e)!;
    if (!e.remaster) {
      e.remaster = {
        homeX: e.body.position.x,
        goalX: e.body.position.x,
        scanAt: 0,
        side: Math.sign(e.body.position.x - target.x) || 1,
        turnUsed: false,
      };
      if (kind === 'runner') e.timer = Math.min(e.timer, 0.35);
      if (kind === 'shooter') {
        // Convert only a supported fixed perch. Unsupported/moving perches keep their old rules.
        const support = standingSurface(g, e);
        if (!support || g.counterweights.movingPerch(e.body)) {
          e.remaster = undefined;
          return false;
        }
        e.remaster.support = support;
        Body.setStatic(e.body, false);
      }
    }
    if (kind === 'runner') this.runner(e, target);
    else this.ranged(e, target, kind);
    return true;
  }
  runner(e: Enemy, target: Vec) {
    const g = this.game,
      p = e.body.position;
    if (e.state === 'windup') {
      brake(e);
      if (e.timer <= 0) {
        e.state = 'rush';
        e.timer = 0.34;
      }
      return;
    }
    if (e.state === 'rush') {
      const next = p.x + e.aim.x * 27;
      if (e.timer <= 0 || !standingSurface(g, e, next) || !clearStep(g, e, next)) recover(e, 0.65);
      else Body.setVelocity(e.body, { x: e.aim.x * 6.2, y: e.body.velocity.y });
      return;
    }
    if (e.state === 'recover') {
      brake(e);
      if (e.timer <= 0) {
        e.state = 'idle';
        e.timer = 0.9;
      }
      return;
    }
    const d = direction(p, target),
      dist = distance(p, target);
    if (
      e.timer <= 0 &&
      dist > 65 &&
      dist < 235 &&
      Math.abs(p.y - target.y) < 45 &&
      standingSurface(g, e) &&
      clearStep(g, e, p.x + Math.sign(d.x) * 65) &&
      distance(g.lineEnd(p, target, 4), target) < 1 &&
      g.encounterPacer.request(e, true, REMASTER_TELL.runner + 0.34, target)
    ) {
      e.state = 'windup';
      e.timer = REMASTER_TELL.runner;
      e.aim = { x: Math.sign(d.x) || 1, y: 0 };
      e.target = { ...target };
      e.attacks++;
      brake(e);
      g.onSound('charge');
    } else g.updateRunner(e, d, dist, target);
  }
  ranged(e: Enemy, target: Vec, kind: 'shooter' | 'flyer') {
    const g = this.game,
      p = e.body.position;
    if (kind === 'flyer') Body.applyForce(e.body, p, { x: 0, y: -e.body.mass * 0.001 });
    if (e.state === 'windup') {
      if (kind === 'flyer') Body.setVelocity(e.body, { x: 0, y: 0 });
      else brake(e);
      if (e.timer <= 0) {
        const base = Math.atan2(e.aim.y, e.aim.x);
        for (const offset of kind === 'flyer' ? [-0.18, 0, 0.18] : [0])
          g.enemyShot(e, base + offset);
        e.attacks++;
        g.onSound('enemy');
        recover(e, kind === 'flyer' ? 0.65 : 0.5);
        e.remaster!.side *= -1;
        e.remaster!.turnUsed = false;
        e.remaster!.scanAt = 0;
      }
      return;
    }
    if (e.state === 'recover') {
      if (kind === 'flyer') Body.setVelocity(e.body, { x: 0, y: 0 });
      else brake(e);
      if (e.timer <= 0) {
        e.state = 'idle';
        e.timer = kind === 'flyer' ? 1.1 : 0.95;
      }
      return;
    }
    if (kind === 'shooter') this.walk(e, target);
    else this.fly(e, target);
    e.aim = direction(p, target);
    if (
      e.timer <= 0 &&
      distance(p, target) < 1450 &&
      distance(g.lineEnd(p, target, 5), target) < 1 &&
      g.encounterPacer.request(e, false, REMASTER_TELL[kind] + 0.15, target)
    ) {
      e.state = 'windup';
      e.timer = REMASTER_TELL[kind];
      e.target = { ...target };
      if (kind === 'flyer') Body.setVelocity(e.body, { x: 0, y: 0 });
      else brake(e);
      g.onSound('aim-warn');
    }
  }
  walk(e: Enemy, target: Vec) {
    const g = this.game,
      rig = e.remaster!,
      p = e.body.position;
    const support = standingSurface(g, e);
    // Falling, pushed or unsupported machines do not invent a new platform or snap to their perch.
    if (!support || support !== rig.support) {
      brake(e);
      return;
    }
    if (g.time >= rig.scanAt) {
      rig.scanAt = g.time + 0.6;
      let best = -Infinity;
      rig.goalX = p.x;
      for (const offset of [-180, -90, 0, 90, 180]) {
        const x = clamp(rig.homeX + offset, support.bounds.min.x + 20, support.bounds.max.x - 20);
        if (!clearStep(g, e, x)) continue;
        const point = { x, y: p.y };
        const visible = distance(g.lineEnd(point, target, 5), target) < 1;
        const crowded = g.enemies.some(
          (other) =>
            other !== e &&
            other.hp > 0 &&
            Math.abs(other.body.position.x - x) < 50 &&
            Math.abs(other.body.position.y - p.y) < 40,
        );
        const score =
          (visible ? 500 : 0) -
          Math.abs(distance(point, target) - 390) -
          Math.abs(x - p.x) * 0.15 -
          (crowded ? 500 : 0);
        if (score > best) {
          best = score;
          rig.goalX = x;
        }
      }
    }
    const delta = rig.goalX - p.x,
      sign = Math.sign(delta),
      next = p.x + sign * 22;
    if (Math.abs(delta) < 7 || !standingSurface(g, e, next) || !clearStep(g, e, next)) brake(e);
    else Body.setVelocity(e.body, { x: sign * 1.35, y: e.body.velocity.y });
  }
  fly(e: Enemy, target: Vec) {
    const g = this.game,
      rig = e.remaster!,
      p = e.body.position;
    const desired = {
      x: clamp(target.x + rig.side * 310, 65, g.worldWidth - 65),
      y: clamp(target.y - 190, g.worldTop + 150, 500),
    };
    let vx = clamp((desired.x - p.x) * 0.012, -2.7, 2.7);
    let vy = clamp((desired.y - p.y) * 0.035, -2.8, 2.8);
    if (firstSolid(p, { x: p.x + vx * 14, y: p.y }, { x: 20, y: 20 }, g.solidBodies)) {
      vx = 0;
      vy = -2.6;
      if (!rig.turnUsed && g.time >= rig.scanAt) {
        rig.side *= -1;
        rig.turnUsed = true;
        rig.scanAt = g.time + 1;
      }
    }
    if (firstSolid(p, { x: p.x, y: p.y + vy * 14 }, { x: 20, y: 20 }, g.solidBodies)) vy = 0;
    Body.setVelocity(e.body, { x: vx, y: vy });
  }
}
