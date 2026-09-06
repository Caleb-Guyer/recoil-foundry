import type { EnemyKind } from './levels.ts';

export const ENEMY_STATS: Record<EnemyKind, { w: number; h: number; hp: number }> = {
  runner: { w: 30, h: 32, hp: 52 },
  shooter: { w: 36, h: 32, hp: 70 },
  flyer: { w: 38, h: 38, hp: 48 },
  charger: { w: 30, h: 32, hp: 72 },
  sniper: { w: 36, h: 32, hp: 60 },
  hopper: { w: 30, h: 32, hp: 60 },
  loader: { w: 112, h: 68, hp: 520 },
  press: { w: 120, h: 62, hp: 700 },
  boss: { w: 90, h: 76, hp: 1000 },
};
export const CHARGE_TELL = 0.7;
export const SNIPER_TELL = 0.95;
export const HOP_TELL = 0.36;
export const LOADER_TELL = 0.9;
export const PRESS_TELL = 1.1;
export const PRESS_LOCK = 0.65;
export const isBoss = (kind: EnemyKind) => kind === 'loader' || kind === 'press' || kind === 'boss';
export type Attack = 'aimed' | 'fan' | 'ring';
export type EnemyState =
  | 'idle'
  | 'windup'
  | 'rush'
  | 'recover'
  | 'airborne'
  | 'transition'
  | 'return';
export const bossPhase = (hp: number, max: number) =>
  hp > (max * 2) / 3 ? 0 : hp > max / 3 ? 1 : 2;
export function bossAttack(phase: number, count: number): Attack {
  const cycle: Attack[] =
    phase === 0 ? ['aimed'] : phase === 1 ? ['aimed', 'fan'] : ['aimed', 'fan', 'ring'];
  return cycle[count % cycle.length];
}
export const attackTell = (attack: Attack) => (attack === 'ring' ? 1.05 : 0.8);
export function attackAngles(attack: Attack, aim: number): number[] {
  if (attack === 'ring')
    return Array.from({ length: 12 }, (_, i) => (i * Math.PI) / 6 + Math.PI / 12);
  const count = attack === 'fan' ? 7 : 5;
  return Array.from(
    { length: count },
    (_, i) =>
      (attack === 'fan' ? Math.PI / 2 : aim) +
      (i - (count - 1) / 2) * (attack === 'fan' ? 0.27 : 0.16),
  );
}
