import { getLevel } from './levels.ts';
import { bossStage, type Checkpoint } from './rules.ts';

// Encounter-only records cannot prove a win; start a separate victory history.
export const VICTORIES_KEY = 'rf-boss-victories-v1';
export const PRACTICE_BOSSES = {
  loader: { name: 'The Loader', stage: bossStage(0) },
  crane: { name: 'The Crane', stage: bossStage(0) },
  press: { name: 'The Press', stage: bossStage(1) },
  kiln: { name: 'The Kiln', stage: bossStage(1) },
  condenser: { name: 'The Condenser', stage: bossStage(2) },
  turbine: { name: 'The Turbine', stage: bossStage(2) },
  interceptor: { name: 'The Interceptor', stage: bossStage(3) },
  boss: { name: 'Rooftop', stage: bossStage(3) },
} as const;
export type PracticeBoss = keyof typeof PRACTICE_BOSSES;
export interface Encounter {
  kind: PracticeBoss;
  seed: string;
}

// Explicit playtest links are isolated fights, never earned Practice unlocks.
export function testEncounterFromUrl(url: URL): Encounter | null {
  const params = url.searchParams;
  const kind = params.get('test');
  if (
    params.getAll('test').length !== 1 ||
    (kind !== 'turbine' && kind !== 'interceptor') ||
    ['daily', 'dv', 'seed'].some((key) => params.has(key))
  )
    return null;
  return (
    loadEncounters([
      { kind, seed: kind === 'turbine' ? 'turbine-fight-1' : 'interceptor-fight-3' },
    ])[0] ?? null
  );
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
    // Existing victories predate alternate bosses. Keep their original arenas
    // available for earned practice even if that seed now selects a new boss.
    if (
      kind === 'condenser' ||
      kind === 'boss' ||
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
  return testCheckpoint(encounter.seed, stage);
}
export function testCheckpoint(seed: string, stage: number): Checkpoint {
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
    'split',
    'landing',
    'redline',
    'backblast',
  ];
  return {
    version: 4,
    seed,
    stage,
    hp: 100,
    mods: build.slice(0, stage),
    kills: 0,
    elapsed: 0,
  };
}

export function expandedTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (
    p.getAll('test').length !== 1 ||
    p.get('test') !== 'expanded' ||
    ['daily', 'dv', 'seed'].some((k) => p.has(k))
  )
    return null;
  const areas = ['docks', 'furnace', 'cooling', 'rooftops'];
  if (p.getAll('area').length > 1) return null;
  const area = areas.indexOf(p.get('area') ?? 'docks');
  return area < 0 ? null : testCheckpoint('EXPANDED-16', area * 4 + 2);
}

export function cargoTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (
    p.getAll('test').length !== 1 ||
    p.get('test') !== 'cargo' ||
    ['daily', 'dv', 'seed', 'area'].some((key) => p.has(key))
  )
    return null;
  return testCheckpoint('CARGO-DROP', 2);
}

export function squadsTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (
    p.getAll('test').length !== 1 ||
    p.get('test') !== 'squads' ||
    p.getAll('formation').length > 1 ||
    ['daily', 'dv', 'seed', 'area'].some((key) => p.has(key))
  )
    return null;
  const presets = {
    shield: { seed: 'SQUAD-SHIELD-11', stage: 4 },
    flank: { seed: 'SQUAD-FLANK-1', stage: 6 },
    ambush: { seed: 'SQUAD-AMBUSH-0', stage: 8 },
  };
  const formation = p.get('formation') ?? 'shield';
  if (!Object.hasOwn(presets, formation)) return null;
  const preset = presets[formation as keyof typeof presets];
  return testCheckpoint(preset.seed, preset.stage);
}

export function conveyorsTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (
    p.getAll('test').length !== 1 ||
    p.get('test') !== 'conveyors' ||
    p.getAll('area').length > 1 ||
    ['daily', 'dv', 'seed', 'formation'].some((key) => p.has(key))
  )
    return null;
  const area = p.get('area') ?? 'furnace';
  if (area !== 'furnace' && area !== 'rooftops') return null;
  return testCheckpoint(
    area === 'furnace' ? 'BELT-FURNACE-7' : 'BELT-ROOFTOPS-3',
    area === 'furnace' ? 4 : 12,
  );
}

export function freightTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (
    p.getAll('test').length !== 1 ||
    p.get('test') !== 'freight' ||
    ['daily', 'dv', 'seed', 'area', 'formation'].some((k) => p.has(k))
  )
    return null;
  return testCheckpoint('FREIGHT-RIDE-2', 5);
}

export function scrapperTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (
    p.getAll('test').length !== 1 ||
    p.get('test') !== 'scrapper' ||
    p.getAll('area').length > 1 ||
    ['daily', 'dv', 'seed', 'formation'].some((k) => p.has(k))
  )
    return null;
  const area = p.get('area') ?? 'cooling';
  if (area !== 'cooling' && area !== 'rooftops') return null;
  return testCheckpoint(
    area === 'cooling' ? 'SCRAPPER-8-10' : 'SCRAPPER-12-26',
    area === 'cooling' ? 8 : 12,
  );
}
