import Matter from 'matter-js';
import type { Enemy, Game } from './game.ts';
import { direction, distance, type Vec } from './rules.ts';

const { Body } = Matter;
export const CALLER = {
  sample: 0.35,
  lock: 0.75,
  gap: 0.22,
  recovery: 2.4,
  speed: 9.4,
  damage: 14,
  range: 1200,
};
export interface CallerRig {
  phase: 'ready' | 'recording' | 'locked' | 'firing';
  clock: number;
  marks: Vec[];
  next: number;
  target: Matter.Body | null;
  allied: boolean;
  origin: Vec | null;
}
export function clearCaller(e: Enemy) {
  e.caller = undefined;
}
function reset(e: Enemy) {
  const rig = e.caller!;
  rig.phase = 'ready';
  rig.clock = 0;
  rig.marks = [];
  rig.next = 0;
  rig.target = null;
  rig.origin = null;
  rig.allied = !!e.allied;
  e.timer = CALLER.recovery;
}
function targetBody(g: Game, e: Enemy): Matter.Body | null {
  const p = g.factions.combatTarget(e);
  if (!e.allied && p === g.player.position) return g.player;
  return (
    (e.allied ? g.enemies : g.factions.allies).find((a) => a.body.position === p)?.body ?? null
  );
}
function validTarget(g: Game, e: Enemy, body: Matter.Body) {
  if (body === g.player) return !e.allied && g.hp > 0;
  return (e.allied ? g.enemies : g.factions.allies).some(
    (a) => a.body === body && (e.allied ? g.factions.targetable(a) : a.hp > 0 && a.spawn <= 0),
  );
}
export function updateCaller(g: Game, e: Enemy, dt: number) {
  const r = (e.caller ??= {
    phase: 'ready',
    clock: 0,
    marks: [],
    next: 0,
    target: null,
    allied: !!e.allied,
    origin: null,
  });
  // The speaker braces to record, but remains a physical body that can be pushed.
  Body.setVelocity(e.body, {
    x: e.body.velocity.x * (r.phase === 'ready' ? 0.96 : 0.8),
    y: e.body.velocity.y,
  });
  if (
    r.allied !== !!e.allied ||
    (r.target && !validTarget(g, e, r.target)) ||
    (r.origin && distance(r.origin, e.body.position) > 40)
  ) {
    reset(e);
    return;
  }
  if (r.phase === 'ready') {
    if (e.timer > 0) return;
    const target = targetBody(g, e);
    if (
      !target ||
      !validTarget(g, e, target) ||
      distance(e.body.position, target.position) > CALLER.range ||
      distance(g.lineEnd(e.body.position, target.position, 5), target.position) > 1
    )
      return;
    r.target = target;
    r.marks = [{ ...target.position }];
    r.phase = 'recording';
    r.clock = CALLER.sample;
    g.onSound(e.allied ? 'signal-friendly' : 'caller-record');
  } else {
    r.clock -= dt;
    if (r.clock <= 0) {
      if (r.phase === 'recording') {
        r.marks.push({ ...r.target!.position });
        r.clock = CALLER.sample;
        if (r.marks.length === 3) {
          r.phase = 'locked';
          r.origin = { ...e.body.position };
          r.clock = CALLER.lock;
          g.onSound(e.allied ? 'signal-friendly' : 'caller-lock');
        }
      } else {
        const aim = direction(e.body.position, r.marks[r.next]);
        g.enemyShot(e, Math.atan2(aim.y, aim.x), CALLER.speed, CALLER.damage);
        g.onSound('enemy');
        e.attacks++;
        r.next++;
        if (r.next === 3) reset(e);
        else {
          r.phase = 'firing';
          r.clock = CALLER.gap;
        }
      }
    }
  }
  const mark = r.marks[r.next];
  if (mark) e.aim = direction(e.body.position, mark);
  e.facing = Math.sign(e.aim.x) || e.facing;
}
