import Matter from 'matter-js';
import {
  planRivalGrind,
  rivalGrindAngles,
  type RivalGrindPlan,
  type RivalSaw,
} from './interceptor-grindshot.ts';
import type { Enemy, Game } from './game.ts';
import type { Vec } from './rules.ts';
import { clamp, direction, distance } from './rules.ts';
import { bossPhase } from './enemies.ts';
import { bossHasLane, bossHuntTarget } from './boss-hunt.ts';
import {
  INTERCEPTOR_WEAPONS,
  weaponAngles,
  interceptorMove,
  fireWeapon,
  updateArsenal,
  clearArsenal,
  rivalCharge,
} from './interceptor-weapons.ts';
import type {
  InterceptorMove,
  RivalCharge,
  RivalEcho,
  RivalVolley,
} from './interceptor-weapons.ts';

export const INTERCEPTOR_LOCK = 0.36;
export const INTERCEPTOR_VAULT_LOCK = 0.24;
export const INTERCEPTOR_VAULT_TELL = 0.56;
export const INTERCEPTOR_VAULT_TIME = 0.38;
export const INTERCEPTOR_HEAVY_TELL = 1.1;
export interface InterceptorRig {
  origin: Vec;
  launch: Vec;
  relocate: boolean;
  volley: number;
  muzzle: number;
  move: InterceptorMove;
  caught: number;
  history: Vec[];
  grindPlans: RivalGrindPlan[];
  grindBullets: number[];
  saws: RivalSaw[];
  charges: RivalCharge[];
  echoes: RivalEcho[];
  queue: RivalVolley[];
  gate?: { entry: Vec; exit: Vec; flash: number };
}
export const createInterceptor = (): InterceptorRig => ({
  origin: { x: 0, y: 0 },
  launch: { x: 0, y: 0 },
  relocate: false,
  volley: 0,
  muzzle: 0,
  move: 'aimed',
  caught: 0,
  history: [],
  grindPlans: [],
  grindBullets: [],
  saws: [],
  charges: [],
  echoes: [],
  queue: [],
});
export const interceptorLock = (e: Enemy) =>
  e.attack === 'vault' ? INTERCEPTOR_VAULT_LOCK : INTERCEPTOR_WEAPONS[e.interceptor!.move].lock;
export const interceptorSpeed = (e: Enemy) =>
  e.attack === 'vault' ? 8 : INTERCEPTOR_WEAPONS[e.interceptor!.move].speed;
export function interceptorAngles(e: Enemy): number[] {
  if (e.attack !== 'vault' && e.interceptor!.move === 'grindshot') return rivalGrindAngles(e);
  return e.attack === 'vault'
    ? weaponAngles('aimed', e.aim, 0)
    : weaponAngles(e.interceptor!.move, e.aim, e.phase, e.interceptor!.caught);
}
export const interceptorOrigin = (e: Enemy): Vec =>
  e.interceptor!.move === 'fold' && e.attack !== 'vault' && e.interceptor!.gate
    ? e.interceptor!.gate.exit
    : e.interceptor!.origin;
function aim(g: Game, e: Enemy) {
  const plan = e.interceptor!.grindPlans[0];
  if (e.attack !== 'vault' && e.interceptor!.move === 'grindshot' && plan) {
    e.aim = direction(plan.origin, plan.impact);
    return;
  }
  e.interceptor!.origin = { ...e.body.position };
  e.aim =
    e.interceptor!.move === 'shockwave' && e.attack !== 'vault'
      ? { x: 0, y: -1 }
      : direction(interceptorOrigin(e), g.player.position);
}
function recoil(e: Enemy, impulse: Vec) {
  Matter.Body.setVelocity(e.body, {
    x: clamp(e.body.velocity.x + impulse.x, -14, 14),
    y: clamp(e.body.velocity.y + impulse.y, -14, 14),
  });
}
export function clearRivalHull(g: Game, pos: Vec) {
  return (
    pos.x >= 40 &&
    pos.x <= g.worldWidth - 40 &&
    pos.y >= 45 &&
    pos.y <= 700 &&
    !g.solidBodies.some(
      (b) =>
        pos.x + 32 > b.bounds.min.x &&
        pos.x - 32 < b.bounds.max.x &&
        pos.y + 36 > b.bounds.min.y &&
        pos.y - 36 < b.bounds.max.y,
    ) &&
    distance(pos, g.player.position) >= 180
  );
}
function foldExit(g: Game, e: Enemy): Vec | undefined {
  const p = g.player.position,
    side = Math.sign(e.body.position.x - p.x) || 1;
  return [-side * 340, side * 340, -side * 480, side * 480]
    .flatMap((dx) =>
      [-140, -260, -60].map((dy) => ({
        x: clamp(p.x + dx, 70, 1930),
        y: clamp(p.y + dy, 80, 650),
      })),
    )
    .find(
      (pos) =>
        clearRivalHull(g, pos) &&
        distance(pos, e.body.position) > 180 &&
        distance(g.lineEnd(pos, p, 9), p) < 1,
    );
}
export function beginInterceptorAttack(g: Game, e: Enemy, move: InterceptorMove) {
  const rig = e.interceptor!;
  rig.move = move;
  rig.caught = 0;
  rig.volley = 0;
  rig.gate = undefined;
  rig.grindPlans = [];
  rig.grindBullets = [];
  rig.origin = { ...e.body.position };
  if (move === 'grindshot') {
    rig.grindPlans = planRivalGrind(g, e);
    if (!rig.grindPlans.length) rig.move = 'aimed';
    else if (e.phase > 0)
      rig.grindBullets = weaponAngles('aimed', direction(rig.origin, g.player.position), 0);
  }
  e.attack = move === 'heavy' ? 'heavy' : move === 'shockwave' ? 'slam' : 'aimed';
  if (move === 'fold') {
    const exit = foldExit(g, e);
    if (!exit) {
      rig.move = 'ricochet';
      e.attack = 'aimed';
    } else rig.gate = { entry: { ...e.body.position }, exit, flash: 0 };
  }
  if (move === 'shockwave')
    e.target = {
      x: e.body.position.x,
      y: g.pressSurface(e.body.position.x, e.body.position.y + 32),
    };
  aim(g, e);
  e.state = 'windup';
  e.timer = INTERCEPTOR_WEAPONS[rig.move].tell;
  g.onSound('interceptor-lock');
}
function recover(g: Game, e: Enemy) {
  const rig = e.interceptor!;
  e.state = 'recover';
  e.timer = INTERCEPTOR_WEAPONS[rig.move].recover - (rig.move === 'heavy' ? e.phase * 0.1 : 0);
  e.attacks++;
  rig.relocate = true;
  rig.history.push({ ...rig.origin });
  rig.history = rig.history.slice(-3);
  g.onSound('interceptor-open');
}
export function updateInterceptor(g: Game, e: Enemy, dt: number) {
  const rig = e.interceptor!;
  rig.muzzle = Math.max(0, rig.muzzle - dt);
  if (rig.gate?.flash) {
    rig.gate.flash = Math.max(0, rig.gate.flash - dt);
    if (!rig.gate.flash) rig.gate = undefined;
  }
  // Stabilizers hold an aimed shot; the short travel arc retains gravity and
  // recoil momentum. Every movement impulse still goes through Matter contacts.
  Matter.Body.applyForce(e.body, e.body.position, {
    x: 0,
    y: -e.body.mass * (e.state === 'airborne' ? 0.00075 : 0.001),
  });
  const phase = bossPhase(e.hp, e.maxHp, !!g.overtime);
  if (phase > e.phase) {
    clearArsenal(g, e);
    e.phase = phase;
    e.state = 'transition';
    e.timer = 0.75;
    rig.volley = 0;
    rig.launch = { x: 0, y: 0 };
    rig.relocate = true;
    e.hunt = undefined;
    g.feedback(3);
    g.onSound('phase');
  }
  updateArsenal(g, e, dt);
  if (g.mode !== 'playing' || e.hp <= 0) return;
  if (['windup', 'followup', 'transition', 'idle'].includes(e.state))
    Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
  else if (e.state === 'recover')
    Matter.Body.setVelocity(
      e.body,
      rig.queue.length
        ? { x: 0, y: 0 }
        : { x: e.body.velocity.x * 0.94, y: e.body.velocity.y * 0.94 },
    );

  if (e.state === 'rush' && rig.move === 'shockwave') {
    const foot = Math.max(...e.body.vertices.map((v) => v.y));
    const landed =
      Matter.Query.ray(
        g.solidBodies,
        { x: e.body.position.x, y: foot - 1 },
        { x: e.body.position.x, y: foot + 2 },
        48,
      ).length > 0;
    if (landed) {
      // Damage originates at the actual landing, with a second warning on the
      // ground. A shelf or crate can intercept the dive normally.
      rivalCharge(g, e, e.body.position, 145, 22, 0.65, true);
      e.aim = { x: 0, y: -1 };
      fireWeapon(g, e, 'shockwave', e.body.position, interceptorAngles(e));
      Matter.Body.setVelocity(e.body, { x: 0, y: -8 });
      recover(g, e);
    } else if (e.timer <= 0) recover(g, e);
    else Matter.Body.setVelocity(e.body, { x: 0, y: 14 });
    return;
  }

  if (e.state === 'transition' || e.state === 'recover' || e.state === 'airborne') {
    if (e.timer <= 0) {
      e.state = 'idle';
      e.timer = 0.1;
      e.hunt = undefined;
    }
    return;
  }
  if (e.state === 'windup' || e.state === 'followup') {
    if (
      distance(e.body.position, rig.origin) > 10 &&
      (e.attack === 'vault' || e.timer <= interceptorLock(e))
    ) {
      // A crate can move the gun during its commitment. Cancel the stale lanes
      // and give a fresh warning from the new position instead of a ghost shot.
      e.state = 'idle';
      e.timer = 0.2;
      rig.volley = 0;
      rig.gate = undefined;
      rig.grindPlans = [];
      rig.grindBullets = [];
      e.hunt = undefined;
      return;
    }
    if (e.timer > interceptorLock(e) && e.attack !== 'vault') aim(g, e);
    if (e.timer > 0) return;
    if (e.attack !== 'vault' && rig.move === 'fold' && rig.gate) {
      if (!clearRivalHull(g, rig.gate.exit)) {
        rig.gate = undefined;
        e.state = 'idle';
        e.timer = 0.3;
        rig.relocate = true;
        return;
      }
      Matter.Body.setPosition(e.body, rig.gate.exit);
      Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
      rig.origin = { ...rig.gate.exit };
      rig.gate.flash = 0.35;
      e.hunt = undefined;
    }
    if (e.attack !== 'vault' && rig.move === 'shockwave') {
      e.state = 'rush';
      e.timer = 1.2;
      Matter.Body.setVelocity(e.body, { x: 0, y: 14 });
      return;
    }
    const angles = interceptorAngles(e);
    if (e.attack === 'vault') {
      for (const a of angles) {
        const before = g.shots.at(-1)?.id;
        g.enemyShot(e, a, 8, 12, rig.origin);
        const s = g.shots.at(-1);
        if (s && s.id !== before) s.enemyAmmo = { owner: e.id, kind: 'aimed', age: 0 };
      }
    } else fireWeapon(g, e, rig.move, rig.origin, angles);
    rig.muzzle = 0.16;
    if (e.attack === 'vault') {
      recoil(e, rig.launch);
      e.state = 'airborne';
      e.timer = INTERCEPTOR_VAULT_TIME;
      rig.relocate = false;
      g.onSound('interceptor-vault');
    } else {
      const kick = rig.move === 'capacitor' ? 14 : e.attack === 'heavy' ? 12 : 4;
      recoil(e, { x: -e.aim.x * kick, y: -e.aim.y * kick });
      g.onSound(e.attack === 'heavy' ? 'interceptor-heavy' : 'interceptor-shot');
      if (rig.move === 'aimed' && rig.volley < Math.max(1, e.phase)) {
        rig.volley++;
        e.state = 'followup';
        e.timer = 0.78 - e.phase * 0.04;
        aim(g, e);
        g.onSound('interceptor-lock');
      } else {
        if (rig.move === 'burst') {
          for (let n = 1; n < 4; n++)
            rig.queue.push({
              origin: { ...rig.origin },
              angles: [...angles],
              left: n * 0.14,
              move: 'burst',
            });
        }
        if (rig.move === 'afterimage') {
          const origins = rig.history.filter((p) => distance(p, rig.origin) > 120).slice(-2);
          if (!origins.length) origins.push({ ...rig.origin });
          for (const [i, origin] of origins.entries())
            rig.echoes.push({
              origin: { ...origin },
              aim: direction(origin, g.player.position),
              left: 0.95 + i * 0.3,
            });
        }
        recover(g, e);
      }
    }
    return;
  }
  if (e.timer > 0) return;
  const hasLane = bossHasLane(g, e);
  const overhead = g.player.position.y < e.body.position.y - 140;
  if (rig.relocate || !hasLane || overhead || distance(e.body.position, g.player.position) < 180) {
    const target = bossHuntTarget(g, e, hasLane);
    const length = distance(e.body.position, target);
    if (length > 8) {
      const d = direction(e.body.position, target),
        power = Math.min(12, length * 0.068);
      rig.launch = { x: d.x * power, y: d.y * power - 0.8 };
      // Compensate for gravity on short hops so the hull can clear a nearby lip.
      e.aim = direction(rig.launch, { x: 0, y: 0 });
      rig.origin = { ...e.body.position };
      e.attack = 'vault';
      e.state = 'windup';
      e.timer = INTERCEPTOR_VAULT_TELL;
      g.onSound('interceptor-lock');
      return;
    }
  }
  if (!hasLane) return;
  beginInterceptorAttack(
    g,
    e,
    g.testRun?.seed.startsWith('SAW-BOSS-53-') ? 'grindshot' : interceptorMove(e, g.seed),
  );
}
