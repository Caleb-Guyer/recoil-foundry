import { getLevel } from './levels.ts';
import type { Checkpoint } from './rules.ts';

// Encounter-only records cannot prove a win; start a separate victory history.
export const VICTORIES_KEY = 'rf-boss-victories-v1';
export const PRACTICE_BOSSES = {
  loader: { name: 'The Loader', stage: 2 },
  crane: { name: 'The Crane', stage: 2 },
  press: { name: 'The Press', stage: 5 },
  kiln: { name: 'The Kiln', stage: 5 },
  condenser: { name: 'The Condenser', stage: 8 },
  turbine: { name: 'The Turbine', stage: 8 },
  boss: { name: 'Rooftop', stage: 11 },
} as const;
export type PracticeBoss = keyof typeof PRACTICE_BOSSES;
export interface Encounter {
  kind: PracticeBoss;
  seed: string;
}

export function loadEncounters(value: unknown): Encounter[] {
  if (!Array.isArray(value)) return [];
  const records: Encounter[] = [];
  for (const item of value.slice(0, 32)) {
    if (
      !item ||
      typeof item !== 'object' ||
      typeof item.kind !== 'string' ||
      !Object.hasOwn(PRACTICE_BOSSES, item.kind) ||
      typeof item.seed !== 'string' ||
      !item.seed.length ||
      item.seed.length > 40 ||
      records.some((record) => record.kind === item.kind)
    )
      continue;
    const kind = item.kind as PracticeBoss;
    // Every seed used the Condenser before the alternate boss existed. Retain
    // those earned victories, reconstructing its original arena for practice.
    if (
      kind === 'condenser' ||
      getLevel(item.seed, PRACTICE_BOSSES[kind].stage).spawns[0]?.kind === kind
    )
      records.push({ kind, seed: item.seed });
  }
  return records;
}

export function practiceCheckpoint(record: Encounter): Checkpoint | null {
  const encounter = loadEncounters([record])[0];
  if (!encounter) return null;
  const stage = PRACTICE_BOSSES[encounter.kind].stage;
  const build = [
    'magnum',
    'rapid',
    'kick',
    'airshot',
    'scatter',
    'ricochet',
    'pierce',
    'light',
    'leech',
    'deadeye',
    'execute',
  ];
  return {
    version: 3,
    seed: encounter.seed,
    stage,
    hp: 100,
    mods: build.slice(0, stage),
    kills: 0,
    elapsed: 0,
  };
}
