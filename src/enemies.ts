import type { EnemyKind } from './levels.ts';
import type { Vec } from './rules.ts';

export type EliteKind = 'shielded' | 'twin' | 'volatile';
export const ELITE_HP: Record<EliteKind, number> = { shielded: 86, twin: 85, volatile: 60 };
export const SHIELD_TURN = 0.65;
export const TWIN_TELL = 0.65;
export const TWIN_LOCK = 0.4;
export const VOLATILE_TELL = 0.9;
export const VOLATILE_RADIUS = 135;

export const ENEMY_STATS: Record<EnemyKind, { w: number; h: number; hp: number }> = {
  runner: { w: 30, h: 32, hp: 52 },
  shooter: { w: 36, h: 32, hp: 70 },
  flyer: { w: 38, h: 38, hp: 48 },
  charger: { w: 30, h: 32, hp: 72 },
  sniper: { w: 36, h: 32, hp: 60 },
  hopper: { w: 30, h: 32, hp: 60 },
  loader: { w: 112, h: 68, hp: 800 },
  crane: { w: 90, h: 54, hp: 800 },
  press: { w: 120, h: 62, hp: 1250 },
  kiln: { w: 116, h: 84, hp: 1250 },
  skimmer: { w: 38, h: 38, hp: 76 },
  condenser: { w: 90, h: 76, hp: 2600 },
  turbine: { w: 90, h: 90, hp: 2400 },
  boss: { w: 90, h: 76, hp: 3200 },
};
export const CHARGE_TELL = 0.7;
export const SNIPER_TELL = 0.95;
export const HOP_TELL = 0.36;
export const LOADER_TELL = 0.9;
export const PRESS_TELL = 1.1;
export const PRESS_LOCK = 0.65;
export const FLAK_TELL = 0.85;
export const FLAK_LOCK = 0.38;
export const bossMuzzle = (e: { kind: EnemyKind; body: { position: Vec } }): Vec => ({
  x: e.body.position.x,
  y: e.body.position.y - (e.kind === 'loader' ? 42 : 38),
});
export function flakAngles(aim: number, enraged: boolean): number[] {
  const count = enraged ? 5 : 3;
  return Array.from(
    { length: count },
    (_, i) => aim + (i - (count - 1) / 2) * (enraged ? 0.13 : 0.16),
  );
}
export const isBoss = (kind: EnemyKind) =>
  kind === 'loader' ||
  kind === 'crane' ||
  kind === 'press' ||
  kind === 'kiln' ||
  kind === 'condenser' ||
  kind === 'turbine' ||
  kind === 'boss';
export function enemyHealth(kind: EnemyKind, stage: number, elite?: EliteKind): number {
  const base = elite ? ELITE_HP[elite] : ENEMY_STATS[kind].hp;
  return Math.ceil(base * (isBoss(kind) ? 1 : 1 + Math.max(0, Math.min(11, stage)) * 0.08));
}
export type Attack = 'aimed' | 'fan' | 'ring' | 'flak' | 'sweep' | 'slam' | 'mortar' | 'gust';
export type EnemyState =
  | 'idle'
  | 'windup'
  | 'rush'
  | 'recover'
  | 'airborne'
  | 'transition'
  | 'followup'
  | 'return';
export const bossPhase = (hp: number, max: number) =>
  hp > (max * 2) / 3 ? 0 : hp > max / 3 ? 1 : 2;
export function bossAttack(phase: number, count: number): Attack {
  const cycle: Attack[] =
    phase === 0
      ? ['aimed', 'fan']
      : phase === 1
        ? ['aimed', 'fan', 'ring']
        : ['fan', 'ring', 'aimed', 'ring'];
  return cycle[count % cycle.length];
}
export const attackTell = (attack: Attack) =>
  attack === 'flak' ? FLAK_TELL : attack === 'ring' ? 1.05 : 0.8;
export function attackAngles(attack: Attack, aim: number): number[] {
  if (attack === 'ring')
    return Array.from({ length: 12 }, (_, i) => aim + (i * Math.PI) / 6 + Math.PI / 12);
  if (attack === 'flak') return flakAngles(aim, false);
  const count = attack === 'fan' ? 7 : 5;
  return Array.from(
    { length: count },
    (_, i) => aim + (i - (count - 1) / 2) * (attack === 'fan' ? 0.27 : 0.16),
  );
}
