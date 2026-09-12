import Matter from 'matter-js';
import type { Enemy, Game, Shot } from './game.ts';
import type { Vec } from './rules.ts';
import { direction, distance, seeded, sample } from './rules.ts';

export type InterceptorMove =
  | 'aimed'
  | 'heavy'
  | 'ricochet'
  | 'burst'
  | 'crossfire'
  | 'precision'
  | 'scatter'
  | 'fuse'
  | 'recall'
  | 'afterimage'
  | 'countershot'
  | 'capacitor'
  | 'shatter'
  | 'fold'
  | 'shockwave';
export interface Weapon {
  tell: number;
  lock: number;
  speed: number;
  damage: number;
  recover: number;
  color: string;
}
export const INTERCEPTOR_WEAPONS: Record<InterceptorMove, Weapon> = {
  aimed: { tell: 0.92, lock: 0.36, speed: 11.5, damage: 20, recover: 1.05, color: '#f5b583' },
  heavy: { tell: 1.1, lock: 0.36, speed: 16, damage: 24, recover: 1.5, color: '#f5b583' },
  ricochet: { tell: 1.1, lock: 0.5, speed: 9, damage: 18, recover: 1.3, color: '#aacfa7' },
  burst: { tell: 1, lock: 0.45, speed: 12, damage: 16, recover: 1.25, color: '#f5b583' },
  crossfire: { tell: 1.15, lock: 0.5, speed: 10, damage: 16, recover: 1.4, color: '#e6b89c' },
  precision: { tell: 1.25, lock: 0.5, speed: 22, damage: 26, recover: 1.45, color: '#f1cf9f' },
  scatter: { tell: 1.1, lock: 0.45, speed: 10.5, damage: 18, recover: 1.35, color: '#e6b89c' },
  fuse: { tell: 1.2, lock: 0.5, speed: 8, damage: 6, recover: 1.65, color: '#e8c16c' },
  recall: { tell: 1.1, lock: 0.45, speed: 9, damage: 18, recover: 1.6, color: '#9ddbd2' },
  afterimage: { tell: 1.15, lock: 0.45, speed: 11, damage: 18, recover: 1.7, color: '#c7b2e0' },
  countershot: { tell: 1.25, lock: 0.5, speed: 12, damage: 17, recover: 1.6, color: '#a9e0ce' },
  capacitor: { tell: 1.5, lock: 0.6, speed: 17, damage: 28, recover: 1.75, color: '#e5e3a8' },
  shatter: { tell: 1.2, lock: 0.5, speed: 8, damage: 10, recover: 1.5, color: '#e8b492' },
  fold: { tell: 1.35, lock: 0.5, speed: 11, damage: 20, recover: 1.55, color: '#9fcde0' },
  shockwave: { tell: 1.1, lock: 0.5, speed: 10, damage: 16, recover: 1.65, color: '#e8c16c' },
};
const DECKS: InterceptorMove[][] = [
  ['ricochet', 'burst', 'scatter', 'crossfire', 'recall'],
  ['afterimage', 'fuse', 'precision', 'countershot', 'shatter', 'recall', 'ricochet', 'crossfire'],
  [
    'fold',
    'shockwave',
    'capacitor',
    'afterimage',
    'countershot',
    'fuse',
    'shatter',
    'recall',
    'crossfire',
    'burst',
    'precision',
  ],
];
export function interceptorMove(e: Enemy, seed: string): InterceptorMove {
  // First two gun attacks establish recoil and the punish window. Later draws
  // are independent of combat randomness and cannot repeat within a deck.
  if (e.attacks < 2) return e.attacks === 0 ? 'aimed' : 'heavy';
  const deck = sample(DECKS[e.phase], DECKS[e.phase].length, seeded(seed + ':arsenal:' + e.phase));
  return deck[(e.attacks - 2) % deck.length];
}
export function weaponAngles(move: InterceptorMove, aim: Vec, phase: number, caught = 0): number[] {
  const a = Math.atan2(aim.y, aim.x);
  const fan = (count: number, spacing: number) =>
    Array.from({ length: count }, (_, i) => a + (i - (count - 1) / 2) * spacing);
  if (move === 'crossfire') return [...fan(5, 0.21), a + Math.PI - 0.18, a + Math.PI + 0.18];
  if (move === 'precision' || move === 'capacitor' || move === 'shatter' || move === 'burst')
    return [a];
  if (move === 'heavy') return fan(7, 0.1);
  if (move === 'scatter') return fan(9, 0.14);
  if (move === 'countershot') return fan(3 + Math.min(3, caught) * 2, 0.16);
  if (move === 'shockwave') return fan(5, 0.36);
  if (move === 'aimed') return fan(phase === 0 ? 3 : 5, 0.14);
  return fan(3, move === 'fuse' ? 0.24 : move === 'recall' ? 0.22 : 0.18);
}
export interface EnemyAmmo {
  owner: number;
  kind: InterceptorMove;
  age: number;
  returning?: boolean;
  reverse?: Vec;
}
export interface RivalCharge {
  pos: Vec;
  left: number;
  duration: number;
  radius: number;
  damage: number;
  repeat: boolean;
  body?: Matter.Body;
  local?: Vec;
}
export interface RivalEcho {
  origin: Vec;
  aim: Vec;
  left: number;
}
export interface RivalVolley {
  origin: Vec;
  angles: number[];
  left: number;
  move: InterceptorMove;
}

export function fireWeapon(
  g: Game,
  e: Enemy,
  move: InterceptorMove,
  origin: Vec,
  angles: number[],
) {
  const spec = INTERCEPTOR_WEAPONS[move];
  for (const a of angles) {
    if (g.shots.filter((s) => !s.friendly && s.enemyAmmo?.owner === e.id).length >= 64) break;
    const previous = g.shots.at(-1)?.id;
    g.enemyShot(e, a, spec.speed, spec.damage, origin);
    const shot = g.shots.at(-1);
    if (!shot || shot.id === previous || shot.friendly) continue; // blocked muzzle
    shot.enemyAmmo = { owner: e.id, kind: move, age: 0 };
    if (move === 'ricochet') shot.bounces = 1;
    if (move === 'precision') shot.pierce = 1;
    if (move === 'capacitor') shot.radius = 10;
    if (move === 'fuse' || move === 'shatter') shot.radius = 7;
    shot.life = move === 'ricochet' ? 2.4 : move === 'recall' ? 2.1 : 3;
  }
}
export function rivalCharge(
  g: Game,
  e: Enemy,
  pos: Vec,
  radius: number,
  damage: number,
  delay: number,
  repeat = false,
  body?: Matter.Body,
) {
  const rig = e.interceptor!;
  if (rig.charges.length >= 8) return;
  const offset = body && { x: pos.x - body.position.x, y: pos.y - body.position.y };
  const local = offset &&
    body && {
      x: offset.x * Math.cos(body.angle) + offset.y * Math.sin(body.angle),
      y: -offset.x * Math.sin(body.angle) + offset.y * Math.cos(body.angle),
    };
  rig.charges.push({
    pos: { ...pos },
    radius,
    damage,
    left: delay,
    duration: delay,
    repeat,
    body,
    local,
  });
  g.onSound('lock');
}
export function rivalImpact(g: Game, s: Shot, body?: Matter.Body) {
  if (s.friendly || !s.enemyAmmo) return;
  const e = g.enemies.find((enemy) => enemy.id === s.enemyAmmo!.owner);
  if (!e?.interceptor || e.hp <= 0) return;
  if (s.enemyAmmo.kind === 'fuse') rivalCharge(g, e, s.pos, 105, 20, 0.9, true, body);
  if (s.enemyAmmo.kind === 'capacitor') rivalCharge(g, e, s.pos, 125, 18, 0.8, false, body);
}
export function updateRivalAmmo(g: Game, s: Shot, dt: number) {
  const ammo = s.enemyAmmo;
  if (!ammo || s.life <= 0) return;
  if (s.friendly) {
    s.enemyAmmo = undefined;
    return;
  }
  const e = g.enemies.find((enemy) => enemy.id === ammo.owner);
  if (!e?.interceptor || e.hp <= 0) {
    s.life = 0;
    return;
  }
  ammo.age += dt;
  if (ammo.kind === 'recall' && !ammo.returning && ammo.age >= 0.7) {
    if (!ammo.reverse) {
      ammo.reverse = { x: -s.vel.x, y: -s.vel.y };
      s.vel = { x: 0, y: 0 };
    }
    if (ammo.age >= 1.1) {
      s.vel = ammo.reverse;
      ammo.returning = true;
    }
  }
  if (ammo.kind === 'shatter' && ammo.age >= 0.75) {
    s.life = 0;
    const a = Math.atan2(s.vel.y, s.vel.x);
    // Children start at the actual travelled point and inherit its heading,
    // including any portal rotation. They cannot split a second time.
    for (let i = -2; i <= 2; i++) {
      const angle = a + i * 0.26;
      g.addShot({
        pos: { ...s.pos },
        vel: { x: Math.cos(angle) * 10, y: Math.sin(angle) * 10 },
        damage: 12,
        life: 1.3,
        friendly: false,
        radius: 4,
        bounces: 0,
        pierce: 0,
        fragment: false,
        split: true,
        source: { ...e.body.position },
        enemyAmmo: { owner: e.id, kind: 'scatter', age: 0 },
      });
    }
    g.burst(s.pos, 6, '#e8b492', 2);
  }
}
export function clearArsenal(g: Game, e: Enemy) {
  const rig = e.interceptor;
  if (!rig) return;
  rig.charges = [];
  rig.echoes = [];
  rig.queue = [];
  rig.gate = undefined;
  for (const s of g.shots) if (!s.friendly && s.enemyAmmo?.owner === e.id) s.life = 0;
}
export function updateArsenal(g: Game, e: Enemy, dt: number) {
  const rig = e.interceptor!;
  for (const shot of g.shots) {
    if (rig.move !== 'countershot' || e.state !== 'windup' || e.timer <= 0.5 || rig.caught >= 3)
      break;
    if (
      shot.life > 0 &&
      shot.friendly &&
      distance(shot.pos, e.body.position) < 86 &&
      distance(g.lineEnd(shot.pos, e.body.position), e.body.position) < 1
    ) {
      shot.life = 0;
      rig.caught++;
      g.burst(shot.pos, 4, '#a9e0ce', 2);
    }
  }
  for (const queued of [...rig.queue]) {
    queued.left -= dt;
    if (queued.left > 0) continue;
    rig.queue.splice(rig.queue.indexOf(queued), 1);
    fireWeapon(g, e, queued.move, queued.origin, queued.angles);
    rig.muzzle = 0.16;
    g.onSound('interceptor-shot');
  }
  for (const echo of [...rig.echoes]) {
    echo.left -= dt;
    if (echo.left > 0.45) echo.aim = direction(echo.origin, g.player.position);
    if (echo.left > 0) continue;
    rig.echoes.splice(rig.echoes.indexOf(echo), 1);
    if (!Matter.Query.point(g.solidBodies, echo.origin).length)
      fireWeapon(g, e, 'afterimage', echo.origin, weaponAngles('afterimage', echo.aim, e.phase));
    g.onSound('interceptor-shot');
  }
  for (const charge of [...rig.charges]) {
    if (charge.body && charge.local) {
      if (g.solidBodies.includes(charge.body)) {
        const p = charge.body.position,
          a = charge.body.angle,
          l = charge.local;
        charge.pos = {
          x: p.x + l.x * Math.cos(a) - l.y * Math.sin(a),
          y: p.y + l.x * Math.sin(a) + l.y * Math.cos(a),
        };
      } else {
        charge.body = undefined;
        charge.local = undefined;
      }
    }
    charge.left -= dt;
    if (charge.left > 0) continue;
    rig.charges.splice(rig.charges.indexOf(charge), 1);
    const terrain = g.destruction.targets(charge.pos, charge.radius);
    const visible = (p: Vec) => distance(g.lineEnd(charge.pos, p), p) < 1;
    if (distance(charge.pos, g.player.position) < charge.radius + 12 && visible(g.player.position))
      g.damagePlayer(charge.damage, charge.pos);
    for (const prop of [...g.props.items])
      if (
        distance(charge.pos, prop.body.position) < charge.radius &&
        !g.terrainBodies.some(
          (body) => Matter.Query.ray([body], charge.pos, prop.body.position).length,
        )
      )
        g.props.strike(prop, 45, direction(charge.pos, prop.body.position));
    for (const piece of terrain)
      g.destruction.hitBody(piece.body, 90, direction(charge.pos, piece.body.position));
    g.burst(charge.pos, 18, '#e8c16c', 4);
    g.onSound('slam');
    g.feedback(3);
    if (g.mode !== 'playing' || e.hp <= 0) return;
    if (charge.repeat) rivalCharge(g, e, charge.pos, charge.radius + 20, 14, 0.9, false);
  }
}
