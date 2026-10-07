import Matter from 'matter-js';
import type { Game, Enemy } from './game.ts';
import { clamp, direction, distance, segmentBox, type Vec } from './rules.ts';
import { firstSolid } from './collisions.ts';
import { isPatrolMachine, type MachineVariant } from './patrol-machines.ts';

export interface MortarArc {
  from: Vec;
  to: Vec;
  height: number;
  duration: number;
  radius: number;
  damage: number;
}
export interface PatrolRig {
  variant?: MachineVariant;
  home: Vec;
  walk: number;
  turnAt: number;
  arcs: MortarArc[];
}
export interface PatrolShell {
  owner: number;
  arc: MortarArc;
  age: number;
  pos: Vec;
  previous: Vec;
}
export const createPatrolRig = (e: Enemy, variant?: MachineVariant): PatrolRig => ({
  variant,
  home: { ...e.body.position },
  walk: -1,
  turnAt: 0,
  arcs: [],
});
export function machineAngles(e: Enemy) {
  const a = Math.atan2(e.aim.y, e.aim.x),
    variant = e.patrol?.variant;
  const count =
    variant === 'shutter-fan' || variant === 'strider-volley'
      ? 3
      : e.kind === 'strider' && variant !== 'strider-survey'
        ? 2
        : 1;
  const spacing = count === 3 ? 0.2 : 0.13;
  return Array.from({ length: count }, (_, i) => a + (i - (count - 1) / 2) * spacing);
}
export const machineTell = (e: Enemy) =>
  e.patrol?.variant === 'strider-survey' || e.patrol?.variant === 'mortar-slow'
    ? 1.4
    : e.kind === 'mortar'
      ? 1.2
      : 0.95;
export function mortarPoint(arc: MortarArc, progress: number): Vec {
  const t = clamp(progress, 0, 1);
  return {
    x: arc.from.x + (arc.to.x - arc.from.x) * t,
    y: arc.from.y + (arc.to.y - arc.from.y) * t - 4 * arc.height * t * (1 - t),
  };
}
export function mortarImpact(g: Game, arc: MortarArc, start = 0): Vec {
  let previous = mortarPoint(arc, start);
  for (let i = 1; i <= 120; i++) {
    const point = mortarPoint(arc, start + ((1 - start) * i) / 120);
    const hit = firstSolid(previous, point, { x: 7, y: 7 }, g.solidBodies);
    if (hit)
      return {
        x: previous.x + (point.x - previous.x) * hit.t,
        y: previous.y + (point.y - previous.y) * hit.t,
      };
    previous = point;
  }
  return previous;
}
function planMortar(g: Game, e: Enemy): MortarArc[] {
  const variant = e.patrol?.variant;
  const offsets = variant === 'mortar-twin' ? [-85, 85] : [0];
  return offsets.map((offset) => {
    const x = clamp(g.player.position.x + offset, 90, g.worldWidth - 90);
    const floor = Math.min(
      740,
      ...g.terrainBodies
        .filter(
          (b) =>
            b.bounds.min.x < x && b.bounds.max.x > x && b.bounds.min.y >= g.player.bounds.max.y - 4,
        )
        .map((b) => b.bounds.min.y),
    );
    const from = { x: e.body.position.x, y: e.body.position.y - 26 },
      to = { x, y: floor - 7 };
    return {
      from,
      to,
      height: Math.min(230, Math.max(80, from.y - g.worldTop - 70)),
      duration: variant === 'mortar-slow' ? 1.75 : 1.15 + Math.abs(x - from.x) / 2600,
      radius: variant === 'mortar-twin' ? 54 : variant === 'mortar-slow' ? 86 : 66,
      damage: variant === 'mortar-twin' ? 16 : variant === 'mortar-slow' ? 23 : 18,
    };
  });
}
export class PatrolMachineSystem {
  game: Game;
  shells: PatrolShell[] = [];
  blasts: { pos: Vec; radius: number; until: number }[] = [];
  constructor(game: Game) {
    this.game = game;
  }
  clear() {
    this.shells = [];
    this.blasts = [];
  }
  remove(e: Enemy) {
    this.shells = this.shells.filter((s) => s.owner !== e.id);
  }
  trace(from: Vec, to: Vec, radius: number, damage: number) {
    if (!(damage > 0) || !this.shells.length) return;
    this.shells = this.shells.filter((s) => {
      const hit = segmentBox(
        from,
        to,
        { x: s.pos.x - 7 - radius, y: s.pos.y - 7 - radius },
        { x: s.pos.x + 7 + radius, y: s.pos.y + 7 + radius },
      );
      if (hit) {
        this.game.burst(s.pos, 6, '#d9c18d', 2);
        this.game.onSound('armor');
      }
      return !hit;
    });
  }
  tick(dt: number) {
    const g = this.game;
    this.blasts = this.blasts.filter((b) => b.until > g.time);
    for (const shell of [...this.shells]) {
      if (!g.enemies.some((e) => e.id === shell.owner && e.hp > 0)) {
        this.shells = this.shells.filter((s) => s !== shell);
        continue;
      }
      shell.previous = { ...shell.pos };
      shell.age += dt;
      shell.pos = mortarPoint(shell.arc, shell.age / shell.arc.duration);
      const hit = firstSolid(shell.previous, shell.pos, { x: 7, y: 7 }, g.solidBodies);
      if (!hit && shell.age < shell.arc.duration) continue;
      const pos = hit
        ? {
            x: shell.previous.x + (shell.pos.x - shell.previous.x) * hit.t + hit.normal.x * 0.5,
            y: shell.previous.y + (shell.pos.y - shell.previous.y) * hit.t + hit.normal.y * 0.5,
          }
        : shell.pos;
      this.shells = this.shells.filter((s) => s !== shell);
      this.blasts.push({ pos, radius: shell.arc.radius, until: g.time + 0.2 });
      if (this.blasts.length > 12) this.blasts.shift();
      g.burst(pos, 12, '#e4ad75', 3.5);
      g.onSound('forge-impact');
      if (
        distance(pos, g.player.position) <= shell.arc.radius + 12 &&
        distance(g.lineEnd(pos, g.player.position), g.player.position) < 1
      )
        g.damagePlayer(shell.arc.damage, pos, { type: 'blast', enemy: 'mortar' });
    }
  }
  updateEnemy(e: Enemy) {
    if (!isPatrolMachine(e.kind) || !e.patrol) return false;
    const g = this.game,
      rig = e.patrol,
      p = e.body.position,
      target = g.player.position;
    const telling = e.state === 'windup' || e.state === 'followup';
    if (e.kind !== 'mortar') {
      let vx = 0;
      if (!telling && e.state !== 'recover') {
        if (e.kind === 'strider') {
          if (p.x <= rig.home.x - 135) rig.walk = 1;
          if (p.x >= rig.home.x + 135) rig.walk = -1;
          vx = rig.walk * (rig.variant === 'strider-volley' ? 1.2 : 1.7);
        } else if (Math.abs(target.x - p.x) > 380) vx = Math.sign(target.x - p.x) * 0.9;
        const support = Matter.Query.ray(
          g.solidBodies,
          { x: p.x + Math.sign(vx) * 28, y: e.body.bounds.max.y - 3 },
          { x: p.x + Math.sign(vx) * 28, y: e.body.bounds.max.y + 16 },
          4,
        );
        if (vx && !support.length) {
          vx = 0;
          rig.walk *= -1;
        }
        const facing = Math.sign(target.x - p.x) || e.facing;
        if (facing !== e.facing && g.time >= rig.turnAt) {
          e.facing = facing;
          rig.turnAt = g.time + 0.55;
        }
      }
      Matter.Body.setVelocity(e.body, { x: vx, y: e.body.velocity.y });
    }
    if (telling) {
      if (e.timer > 0.4) {
        e.aim = direction(p, target);
        if (e.kind === 'mortar') rig.arcs = planMortar(g, e);
      }
      if (e.timer > 0) return true;
      if (e.kind === 'mortar') {
        if (this.shells.length + rig.arcs.length <= 12)
          for (const arc of rig.arcs)
            this.shells.push({
              owner: e.id,
              arc: structuredClone(arc),
              age: 0,
              pos: { ...arc.from },
              previous: { ...arc.from },
            });
        rig.arcs = [];
      } else {
        const speed =
          rig.variant === 'strider-survey' ? 13 : rig.variant === 'shutter-fan' ? 7.5 : 9;
        for (const angle of machineAngles(e)) g.enemyShot(e, angle, speed, 15);
      }
      g.onSound('enemy');
      if (rig.variant === 'shutter-burst' && e.state !== 'followup') {
        e.state = 'followup';
        e.timer = 0.95;
        e.aim = direction(p, target);
        g.onSound('aim-warn');
      } else {
        e.state = 'recover';
        e.timer = e.kind === 'mortar' ? 2.7 : rig.variant === 'shutter-burst' ? 1.6 : 1.3;
        e.attacks++;
      }
      return true;
    }
    if (e.state === 'recover' && e.timer <= 0) {
      e.state = 'idle';
      e.timer = 0.65;
    }
    if (e.state !== 'idle' || e.timer > 0 || distance(p, target) > 1400) return true;
    if (e.kind !== 'mortar' && distance(g.lineEnd(p, target), target) > 1) {
      e.timer = 0.15;
      return true;
    }
    if (e.kind === 'mortar' && this.shells.some((s) => s.owner === e.id)) {
      e.timer = 0.2;
      return true;
    }
    const tell = machineTell(e);
    if (!g.encounterPacer.request(e, e.kind === 'mortar', tell + 0.1)) {
      e.timer = 0.05;
      return true;
    }
    e.state = 'windup';
    e.timer = tell;
    e.aim = direction(p, target);
    if (e.kind === 'mortar') rig.arcs = planMortar(g, e);
    g.onSound(e.kind === 'mortar' ? 'kiln-wind' : 'aim-warn');
    return true;
  }
}
