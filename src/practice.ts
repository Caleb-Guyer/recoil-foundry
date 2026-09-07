import type { Game } from './game.ts';
import { getLevel } from './levels.ts';
import type { Checkpoint } from './rules.ts';

export const ENCOUNTERS_KEY = 'rf-encounters-v1';
export const PRACTICE_BOSSES = {
  loader: { name: 'The Loader', stage: 2 },
  crane: { name: 'The Crane', stage: 2 },
  press: { name: 'The Press', stage: 5 },
  kiln: { name: 'The Kiln', stage: 5 },
  boss: { name: 'Rooftop', stage: 8 },
} as const;
export type PracticeBoss = keyof typeof PRACTICE_BOSSES;
export interface Encounter {
  kind: PracticeBoss;
  seed: string;
}
export interface View {
  x: number;
  y: number;
  w: number;
  h: number;
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
    if (getLevel(item.seed, PRACTICE_BOSSES[kind].stage).spawns[0]?.kind === kind)
      records.push({ kind, seed: item.seed });
  }
  return records;
}

// Only the live camera can discover a boss. Loading a checkpoint, viewing the
// title backdrop, and entering practice cannot reveal another encounter.
export function visibleEncounter(
  g: Game,
  view: View,
  known: readonly Encounter[],
): Encounter | null {
  if (g.mode !== 'playing' || g.practice || !g.level.boss || g.escape) return null;
  const enemy = g.enemies.find(
    (e) => Object.hasOwn(PRACTICE_BOSSES, e.kind) && e.hp > 0 && e.spawn <= 0,
  );
  if (!enemy || known.some((record) => record.kind === enemy.kind)) return null;
  const p = enemy.body.position;
  if (p.x < view.x || p.x > view.x + view.w || p.y < view.y || p.y > view.y + view.h) return null;
  return { kind: enemy.kind as PracticeBoss, seed: g.seed };
}

export function practiceCheckpoint(record: Encounter): Checkpoint | null {
  const encounter = loadEncounters([record])[0];
  if (!encounter) return null;
  const stage = PRACTICE_BOSSES[encounter.kind].stage;
  const build = ['magnum', 'rapid', 'kick', 'airshot', 'scatter', 'ricochet', 'pierce', 'light'];
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
