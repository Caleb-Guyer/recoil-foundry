import type { EnemyKind } from './levels.ts';

export const ENEMY_NAMES: Record<EnemyKind, string> = {
  switchboard: 'The Switchboard',
  caller: 'Caller',
  switchman: 'Switchman',
  auditor: 'The Auditor',
  fabricator: 'Fabricator',
  sentry: 'Sentry',
  runner: 'Runner',
  shooter: 'Gunner',
  flyer: 'Flyer',
  charger: 'Charger',
  sniper: 'Sniper',
  hopper: 'Hopper',
  scrapper: 'Scrapper',
  harpooner: 'Harpooner',
  sapper: 'Sapper',
  wallcrawler: 'Wallcrawler',
  angler: 'Angler',
  borer: 'Borer',
  sifter: 'Sifter',
  skimmer: 'Skimmer',
  loader: 'The Loader',
  crane: 'The Crane',
  press: 'The Press',
  kiln: 'The Kiln',
  condenser: 'The Condenser',
  turbine: 'The Turbine',
  sorter: 'The Sorter',
  interceptor: 'The Interceptor',
  boss: 'The Reclaimer',
};
const CAUSES = {
  shot: 'Gunfire',
  blade: 'Blade',
  contact: 'Collision',
  blast: 'Explosion',
  volatile: 'Volatile explosion',
  heat: 'Burning fuel',
  hook: 'Harpoon',
  saw: 'Surface saw',
  slam: 'Slam',
  induction: 'Induction strike',
  cargo: 'Falling cargo',
  crate: 'Thrown crate',
  fuel: 'Fuel canister',
  crusher: 'Crusher',
  train: 'Freight train',
  coolant: 'Scalding coolant',
  fall: 'Fall',
  unknown: 'Cause unavailable',
} as const;
export interface DamageCause {
  type: keyof typeof CAUSES;
  enemy?: EnemyKind;
}
export function loadDamageCause(value: unknown): DamageCause {
  const raw = value as Partial<DamageCause> | null;
  if (!raw || typeof raw.type !== 'string' || !Object.hasOwn(CAUSES, raw.type))
    return { type: 'unknown' };
  return {
    type: raw.type,
    ...(typeof raw.enemy === 'string' && Object.hasOwn(ENEMY_NAMES, raw.enemy)
      ? { enemy: raw.enemy }
      : {}),
  };
}
export function damageCauseText(value: DamageCause | null) {
  const cause = loadDamageCause(value);
  return (cause.enemy ? ENEMY_NAMES[cause.enemy] + ' · ' : '') + CAUSES[cause.type];
}
