import type { Enemy } from './game.ts';
import type { BossRemixId } from './boss-remix-rules.ts';
import { weaponAngles, type InterceptorMove } from './interceptor-weapons.ts';
import type { UprisingFinale } from './uprising-model.ts';
import { attackAngles } from './enemies.ts';
import { clamp } from './rules.ts';

export function sorterRemixLanes(id: BossRemixId | undefined, x: number, phase: number) {
  x = clamp(x, 60, 1940);
  if (id === 'sorter-beltline')
    return [
      x,
      clamp(x + (x < 1000 ? 300 : -300), 60, 1940),
      ...(phase >= 2 ? [clamp(x + (x < 1000 ? 600 : -600), 60, 1940)] : []),
    ];
  if (id === 'sorter-magnetic-return')
    return [x, ...[-320, 320].map((offset) => clamp(x + offset, 60, 1940))];
  return [
    x,
    ...(phase >= 1 ? [clamp(x + (x < 1000 ? 420 : -420), 60, 1940)] : []),
    ...(phase >= 2 ? [clamp(x + (x < 1000 ? 840 : -840), 60, 1940)] : []),
  ];
}
export function sorterRemixAttack(id: BossRemixId | undefined, attacks: number) {
  return id === 'sorter-beltline'
    ? attacks % 3 < 2
      ? 'slam'
      : 'fan'
    : id === 'sorter-magnetic-return'
      ? attacks % 3 === 1
        ? 'slam'
        : 'fan'
      : undefined;
}
export function lateInterceptorRemix(id: BossRemixId | undefined) {
  return id === 'boss-skybridge' || id === 'boss-crossfire';
}
export const commandRemix = lateInterceptorRemix;
export function commandRemixAttack(
  id: BossRemixId,
  phase: number,
  count: number,
  overloaded: boolean,
): Enemy['attack'] {
  const cycle: Enemy['attack'][] =
    id === 'boss-skybridge'
      ? phase === 0 && !overloaded
        ? ['aimed', 'aimed', 'fan']
        : ['aimed', 'fan', 'ring']
      : phase === 0 && !overloaded
        ? ['fan', 'aimed', 'fan']
        : ['fan', 'aimed', 'ring', 'fan'];
  return cycle[count % cycle.length];
}
export function commandRemixAngles(
  id: BossRemixId | undefined,
  e: Pick<Enemy, 'attack' | 'aim' | 'state' | 'phase'>,
) {
  const aim = Math.atan2(e.aim.y, e.aim.x);
  if (!commandRemix(id)) return attackAngles(e.attack, aim);
  if (e.attack === 'ring')
    return Array.from(
      { length: 12 },
      (_, i) => (i * Math.PI) / 6 + (id === 'boss-skybridge' ? Math.PI / 12 : Math.PI / 6),
    ).filter((_, i) => i % 3 !== 0);
  if (id === 'boss-crossfire') {
    const spread = e.attack === 'fan' ? 0.18 : 0.12,
      shift = e.state === 'followup' ? spread / 2 : 0;
    return [-3, -2, -1, 1, 2, 3].map((i) => aim + i * spread + shift);
  }
  const spread = e.attack === 'fan' ? 0.24 : 0.12,
    count = e.attack === 'fan' ? (e.phase >= 2 ? 4 : 3) : 1;
  return Array.from({ length: count * 2 + 1 }, (_, i) => aim + (i - count) * spread);
}
export function lateInterceptorMove(
  id: BossRemixId,
  e: Enemy,
  finale: UprisingFinale | null,
): InterceptorMove {
  const cycle: InterceptorMove[] =
    id === 'boss-skybridge'
      ? ['aimed', 'scatter', 'shockwave', e.phase > 0 ? 'precision' : 'heavy']
      : ['crossfire', 'recall', 'aimed', e.phase > 0 ? 'afterimage' : 'ricochet'];
  let move = cycle[e.attacks % cycle.length];
  if (finale === 'isolated' && ['afterimage', 'shockwave'].includes(move)) move = 'precision';
  if (finale === 'overloaded' && e.phase === 2 && e.attacks % cycle.length === 3)
    move = 'capacitor';
  return move;
}
// The weapon and warning use the same rays for the shifted second volley.
export function lateInterceptorAngles(id: BossRemixId | undefined, e: Enemy) {
  const rig = e.interceptor!,
    aim = Math.atan2(e.aim.y, e.aim.x);
  if (id === 'boss-crossfire' && rig.move === 'crossfire') {
    const shift = rig.volley > 0 ? 0.09 : 0;
    return [-0.54, -0.36, -0.18, 0.18, 0.36, 0.54].map((offset) => aim + offset + shift);
  }
  return weaponAngles(rig.move, e.aim, e.phase, rig.caught);
}
