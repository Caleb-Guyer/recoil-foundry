import Matter from 'matter-js';
import type { Enemy, Game } from './game.ts';
import type { Vec } from './rules.ts';
import { clamp, direction, distance } from './rules.ts';
import { bossPhase } from './enemies.ts';
import { bossHasLane, bossHuntTarget } from './boss-hunt.ts';

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
}
export const createInterceptor = (): InterceptorRig => ({
  origin: { x: 0, y: 0 },
  launch: { x: 0, y: 0 },
  relocate: false,
  volley: 0,
  muzzle: 0,
});
export const interceptorLock = (e: Enemy) =>
  e.attack === 'vault' ? INTERCEPTOR_VAULT_LOCK : INTERCEPTOR_LOCK;
export const interceptorSpeed = (e: Enemy) =>
  e.attack === 'heavy' ? 16 : e.attack === 'vault' ? 8 : 11.5;
export function interceptorAngles(e: Enemy): number[] {
  const count = e.attack === 'heavy' ? 7 : e.attack === 'vault' || e.phase === 0 ? 3 : 5;
  const spacing = e.attack === 'heavy' ? 0.1 : 0.14;
  const angle = Math.atan2(e.aim.y, e.aim.x);
  return Array.from({ length: count }, (_, i) => angle + (i - (count - 1) / 2) * spacing);
}
function aim(g: Game, e: Enemy) {
  e.aim = direction(e.body.position, g.player.position);
  e.interceptor!.origin = { ...e.body.position };
}
function recoil(e: Enemy, impulse: Vec) {
  Matter.Body.setVelocity(e.body, {
    x: clamp(e.body.velocity.x + impulse.x, -14, 14),
    y: clamp(e.body.velocity.y + impulse.y, -14, 14),
  });
}
export function updateInterceptor(g: Game, e: Enemy, dt: number) {
  const rig = e.interceptor!;
  rig.muzzle = Math.max(0, rig.muzzle - dt);
  // Stabilizers hold an aimed shot; the short travel arc retains gravity and
  // recoil momentum. Every movement impulse still goes through Matter contacts.
  Matter.Body.applyForce(e.body, e.body.position, {
    x: 0,
    y: -e.body.mass * (e.state === 'airborne' ? 0.00075 : 0.001),
  });
  const phase = bossPhase(e.hp, e.maxHp);
  if (phase > e.phase) {
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
  if (['windup', 'followup', 'transition', 'idle'].includes(e.state))
    Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
  else if (e.state === 'recover')
    Matter.Body.setVelocity(e.body, { x: e.body.velocity.x * 0.94, y: e.body.velocity.y * 0.94 });

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
      e.hunt = undefined;
      return;
    }
    if (e.timer > interceptorLock(e) && e.attack !== 'vault') aim(g, e);
    if (e.timer > 0) return;
    for (const a of interceptorAngles(e))
      g.enemyShot(
        e,
        a,
        interceptorSpeed(e),
        e.attack === 'vault' ? 12 : e.attack === 'heavy' ? 26 : 22,
        rig.origin,
      );
    rig.muzzle = 0.16;
    if (e.attack === 'vault') {
      recoil(e, rig.launch);
      e.state = 'airborne';
      e.timer = INTERCEPTOR_VAULT_TIME;
      rig.relocate = false;
      g.onSound('interceptor-vault');
    } else {
      const kick = e.attack === 'heavy' ? 12 : 4;
      recoil(e, { x: -e.aim.x * kick, y: -e.aim.y * kick });
      g.onSound(e.attack === 'heavy' ? 'interceptor-heavy' : 'interceptor-shot');
      if (e.attack !== 'heavy' && rig.volley < e.phase) {
        rig.volley++;
        e.state = 'followup';
        e.timer = 0.78 - e.phase * 0.04;
        aim(g, e);
        g.onSound('interceptor-lock');
      } else {
        e.state = 'recover';
        e.timer = (e.attack === 'heavy' ? 1.4 : 1.1) - e.phase * 0.1;
        e.attacks++;
        rig.relocate = true;
        g.onSound('interceptor-open');
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
  e.attack = e.attacks % 2 === 0 ? 'aimed' : 'heavy';
  rig.volley = 0;
  aim(g, e);
  e.state = 'windup';
  e.timer = e.attack === 'heavy' ? INTERCEPTOR_HEAVY_TELL : 0.92 - e.phase * 0.04;
  g.onSound('interceptor-lock');
}
