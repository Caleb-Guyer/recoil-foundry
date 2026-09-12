import { breakableSolids } from './destruction-layout.ts';
import { getLevel } from './levels.ts';
import { PHYSICS_LAYOUTS, PHYSICS_STAGES, physicsVariant } from './physics-layouts.ts';
import { bossStage, availableMods, type Checkpoint } from './rules.ts';

// Encounter-only records cannot prove a win; start a separate victory history.
export const VICTORIES_KEY = 'rf-boss-victories-v1';
export const PRACTICE_BOSSES = {
  loader: { name: 'The Loader', stage: bossStage(0) },
  crane: { name: 'The Crane', stage: bossStage(0) },
  press: { name: 'The Press', stage: bossStage(1) },
  kiln: { name: 'The Kiln', stage: bossStage(1) },
  condenser: { name: 'The Condenser', stage: bossStage(2) },
  turbine: { name: 'The Turbine', stage: bossStage(2) },
  sorter: { name: 'The Sorter', stage: bossStage(3) },
  interceptor: { name: 'The Interceptor', stage: bossStage(4) },
  boss: { name: 'The Reclaimer', stage: bossStage(3) },
} as const;
export type PracticeBoss = keyof typeof PRACTICE_BOSSES;
export interface Encounter {
  kind: PracticeBoss;
  seed: string;
}

// Explicit playtest links are isolated fights, never earned Practice unlocks.
export function testEncounterFromUrl(url: URL): Encounter | null {
  const params = url.searchParams;
  const requested = params.get('test');
  const kind = requested === 'reclaimer' ? 'boss' : requested;
  if (
    params.getAll('test').length !== 1 ||
    (kind !== 'turbine' && kind !== 'interceptor' && requested !== 'reclaimer') ||
    ['daily', 'dv', 'seed'].some((key) => params.has(key))
  )
    return null;
  return (
    loadEncounters([
      {
        kind,
        seed:
          kind === 'turbine'
            ? 'turbine-fight-1'
            : kind === 'boss'
              ? 'reclaimer-fight-0'
              : 'interceptor-fight-3',
      },
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
      kind === 'sorter' ||
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
    'rivet',
    'fracture',
    'capacitor',
    'reserve-cell',
  ];
  return {
    version: 5,
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
  const areas = ['docks', 'furnace', 'cooling', 'reclamation', 'rooftops'];
  if (p.getAll('area').length > 1) return null;
  const area = areas.indexOf(p.get('area') ?? 'docks');
  return area < 0 ? null : testCheckpoint('EXPANDED-16', area * 4 + 2);
}

export function overtimeTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (
    p.getAll('test').length !== 1 ||
    p.get('test') !== 'overtime' ||
    p.getAll('area').length > 1 ||
    ['daily', 'dv', 'seed'].some((k) => p.has(k))
  )
    return null;
  const area = ['docks', 'furnace', 'cooling', 'reclamation', 'rooftops'].indexOf(
    p.get('area') ?? 'docks',
  );
  if (area < 0) return null;
  const save = testCheckpoint('OVERTIME-40', 19);
  save.stage = area * 4;
  save.overtime = { baseMods: save.mods.length, repairs: 0 };
  for (let i = 0; i < save.stage; i++) {
    const mod = availableMods(save.mods)[0];
    if (mod) save.mods.push(mod.id);
    else save.overtime.repairs++;
  }
  return save;
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
    shield: { seed: 'SQUAD-SHIELD-1', stage: 4 },
    flank: { seed: 'SQUAD-FLANK-1', stage: 6 },
    ambush: { seed: 'SQUAD-AMBUSH-1', stage: 8 },
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
    area === 'furnace' ? 4 : 16,
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
    area === 'cooling' ? 8 : 16,
  );
}

export function harpoonerTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (
    p.getAll('test').length !== 1 ||
    p.get('test') !== 'harpooner' ||
    p.getAll('mode').length > 1 ||
    ['daily', 'dv', 'seed', 'area', 'formation', 'build'].some((k) => p.has(k))
  )
    return null;
  const mode = p.get('mode') ?? 'normal';
  if (mode !== 'normal' && mode !== 'overtime') return null;
  if (mode === 'normal') return testCheckpoint('HARPOONER-1', 12);
  const save = overtimeTestFromUrl(new URL('?test=overtime&area=reclamation', url))!;
  return { ...save, seed: 'HARPOONER-OT' };
}

export function routesTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (
    p.getAll('test').length !== 1 ||
    p.get('test') !== 'routes' ||
    ['area', 'route', 'mode'].some((k) => p.getAll(k).length > 1) ||
    ['daily', 'dv', 'seed', 'formation', 'build'].some((k) => p.has(k))
  )
    return null;
  const area = ['docks', 'furnace', 'cooling', 'reclamation', 'rooftops'].indexOf(
    p.get('area') ?? 'docks',
  );
  const route = p.get('route'),
    mode = p.get('mode') ?? 'normal';
  if (
    area < 0 ||
    (route !== null && route !== 'low' && route !== 'high') ||
    (mode !== 'normal' && mode !== 'overtime')
  )
    return null;
  const stage = area * 4 + (route ? 2 : 1);
  const save = testCheckpoint('ROUTES-43', stage);
  if (mode === 'overtime') {
    const base = overtimeTestFromUrl(
      new URL(
        '?test=overtime&area=' + ['docks', 'furnace', 'cooling', 'reclamation', 'rooftops'][area],
        url,
      ),
    )!;
    Object.assign(save, base, { seed: 'ROUTES-OT', stage });
    for (let i = base.stage; i < stage; i++) {
      const next = availableMods(save.mods)[0];
      if (next) save.mods.push(next.id);
      else save.overtime!.repairs++;
    }
  }
  return { ...save, ...(route ? { route } : {}) };
}

export function destructionTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (
    p.getAll('test').length !== 1 ||
    p.get('test') !== 'destruction' ||
    p.getAll('area').length > 1 ||
    ['daily', 'dv', 'seed', 'formation', 'build', 'route', 'mode'].some((k) => p.has(k))
  )
    return null;
  const area = ['docks', 'furnace', 'cooling', 'reclamation', 'rooftops'].indexOf(
    p.get('area') ?? 'docks',
  );
  return area < 0 ? null : { ...testCheckpoint('DESTRUCTION-44', area * 4 + 2), route: 'low' };
}

export function sapperTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (
    p.getAll('test').length !== 1 ||
    p.get('test') !== 'sapper' ||
    ['daily', 'dv', 'seed', 'area', 'formation', 'build', 'route', 'mode'].some((k) => p.has(k))
  )
    return null;
  return testCheckpoint('SAPPER-45', 4);
}

export const UPGRADE_TEST_BUILDS: Record<string, string[]> = {
  grindshot: ['grindshot', 'corner-cutter', 'magnum', 'rapid', 'light', 'leech'],
  'arc-coil': ['arc-coil', 'daisy-chain', 'rapid', 'pierce', 'light', 'leech'],
  tether: ['tether', 'snapback', 'rapid', 'pierce', 'light', 'leech'],
  recall: ['recall', 'pierce', 'homecoming', 'kick', 'airshot', 'light'],
  capacitor: ['capacitor', 'reserve-cell', 'magnum', 'kick', 'airshot', 'light'],
  countershot: ['countershot', 'reprisal', 'magnum', 'kick', 'airshot', 'light'],
  rivet: ['deadeye', 'rivet', 'fracture', 'magnum', 'kick', 'light'],
  fuse: ['shellshock', 'fuse', 'linked-fuse', 'blast-surf', 'kick', 'light'],
  afterimage: ['crossfire', 'afterimage', 'parallax', 'scatter', 'kick', 'light'],
};
export const FUSION_TEST_BUILDS: Record<string, string[]> = {
  'rail-spike': [
    'deadeye',
    'capacitor',
    'scatter',
    'magnum',
    'kick',
    'pierce',
    'light',
    'rail-spike',
  ],
  orbit: ['crossfire', 'recall', 'homecoming', 'scatter', 'kick', 'light', 'magnum', 'orbit'],
  implosion: [
    'shellshock',
    'fuse',
    'linked-fuse',
    'blast-surf',
    'kick',
    'light',
    'magnum',
    'implosion',
  ],
};
export function tetherTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (
    p.getAll('test').length !== 1 ||
    p.get('test') !== 'tether' ||
    ['daily', 'dv', 'seed', 'area', 'formation', 'build', 'route', 'mode'].some((k) => p.has(k))
  )
    return null;
  return { ...testCheckpoint('TETHER-46', 6), mods: [...UPGRADE_TEST_BUILDS.tether] };
}

export function arcTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (
    p.getAll('test').length !== 1 ||
    p.get('test') !== 'arc' ||
    [
      'daily',
      'dv',
      'seed',
      'area',
      'formation',
      'route',
      'mode',
      'layout',
      'variant',
      'mirror',
    ].some((k) => p.has(k)) ||
    p.getAll('build').length > 1 ||
    (p.has('build') && !['base', 'chain'].includes(p.get('build')!))
  )
    return null;
  const save = layoutTestFromUrl(new URL('https://test/?test=layouts&layout=cable-yard'))!;
  save.mods = [
    'arc-coil',
    'rapid',
    'pierce',
    'light',
    'leech',
    'kick',
    'airshot',
    'ricochet',
    p.get('build') === 'base' ? 'countershot' : 'daisy-chain',
  ];
  return save;
}

export function layoutTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (
    p.getAll('test').length !== 1 ||
    p.get('test') !== 'layouts' ||
    ['daily', 'dv', 'seed', 'area', 'formation', 'build', 'route', 'mode'].some((k) => p.has(k)) ||
    ['layout', 'variant', 'mirror'].some((k) => p.getAll(k).length > 1)
  )
    return null;
  const id = p.get('layout') ?? 'cable-yard';
  const variant = p.get('variant') ?? '1';
  const mirror = p.get('mirror') ?? '0';
  if (
    !PHYSICS_LAYOUTS.some((l) => l.id === id) ||
    !['1', '2', '3'].includes(variant) ||
    !['0', '1'].includes(mirror)
  )
    return null;
  const stage = PHYSICS_STAGES[id];
  // Select a real seeded room. Playtests exercise the same generator as a run.
  for (let i = 0; i < 1024; i++) {
    const seed = `ROOM47-${id[0].toUpperCase()}-${i}`;
    if (physicsVariant(seed, id) !== Number(variant) - 1) continue;
    const level = getLevel(seed, stage);
    if (level.id !== id || level.mirrored !== (mirror === '1')) continue;
    const save = testCheckpoint(seed, stage);
    if (id === 'cable-yard')
      save.mods = [
        'tether',
        'snapback',
        'leech',
        'light',
        'kick',
        'airshot',
        'rapid',
        'pierce',
        'ricochet',
      ];
    if (id === 'demolition-lane')
      save.mods = ['shellshock', 'blast-surf', 'leech', 'kick', 'light'];
    return save;
  }
  return null;
}
export function fusionTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (
    p.getAll('test').length !== 1 ||
    p.get('test') !== 'fusions' ||
    p.getAll('build').length > 1 ||
    ['daily', 'dv', 'seed', 'area', 'formation'].some((k) => p.has(k))
  )
    return null;
  const key = p.get('build') ?? 'rail-spike';
  if (!Object.hasOwn(FUSION_TEST_BUILDS, key)) return null;
  return {
    ...testCheckpoint('FUSIONS-' + key.toUpperCase(), 8),
    mods: [...FUSION_TEST_BUILDS[key]],
  };
}
export function upgradeTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (
    p.getAll('test').length !== 1 ||
    p.get('test') !== 'upgrades' ||
    p.getAll('build').length > 1 ||
    ['daily', 'dv', 'seed', 'area', 'formation'].some((k) => p.has(k))
  )
    return null;
  const key = p.get('build') ?? 'recall';
  if (!Object.hasOwn(UPGRADE_TEST_BUILDS, key)) return null;
  return {
    ...testCheckpoint('UPGRADES-' + key.toUpperCase(), 6),
    mods: [...UPGRADE_TEST_BUILDS[key]],
  };
}

export function reclamationTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (
    p.getAll('test').length !== 1 ||
    p.get('test') !== 'reclamation' ||
    ['daily', 'dv', 'seed', 'area', 'formation'].some((k) => p.has(k))
  )
    return null;
  return testCheckpoint('RECLAMATION-20', 12);
}

export function salvageTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (
    p.getAll('test').length !== 1 ||
    p.get('test') !== 'salvage' ||
    [
      'daily',
      'dv',
      'seed',
      'area',
      'formation',
      'route',
      'mode',
      'layout',
      'variant',
      'mirror',
    ].some((k) => p.has(k)) ||
    p.getAll('build').length > 1 ||
    p.getAll('evolved').length > 1 ||
    (p.has('evolved') && !['0', '1'].includes(p.get('evolved')!)) ||
    (p.has('build') && !['ramjet', 'cinder', 'crosswind', 'all'].includes(p.get('build')!))
  )
    return null;
  const mods = [
    'leech',
    'airshot',
    'light',
    'kick',
    'rapid',
    'magnum',
    'pierce',
    'ricochet',
    'burst',
    'countershot',
  ];
  const chosen = p.get('build') ?? 'all';
  for (const id of ['ramjet', 'cinder', 'crosswind'])
    mods.push(
      chosen === 'all' || chosen === id
        ? id
        : id === 'ramjet'
          ? 'redline'
          : id === 'cinder'
            ? 'split'
            : 'landing',
    );
  if (p.get('evolved') === '1')
    for (const [replacement, parent, child] of [
      ['ricochet', 'ramjet', 'wrecking-ball'],
      ['burst', 'cinder', 'flashpoint'],
      ['countershot', 'crosswind', 'slipstream'],
    ] as const)
      if (mods.includes(parent)) {
        mods.splice(mods.indexOf(replacement), 1);
        mods.push(child);
      }
  return { ...testCheckpoint('SALVAGE-49', 13), mods };
}

export function crossingTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (
    p.getAll('test').length !== 1 ||
    p.get('test') !== 'crossing' ||
    ['daily', 'dv', 'seed', 'formation', 'build', 'route', 'mode', 'layout', 'variant'].some((k) =>
      p.has(k),
    ) ||
    ['area', 'mirror'].some((k) => p.getAll(k).length > 1) ||
    (p.has('area') && !['docks', 'reclamation'].includes(p.get('area')!)) ||
    (p.has('mirror') && !['0', '1'].includes(p.get('mirror')!))
  )
    return null;
  const stage = p.get('area') === 'reclamation' ? 13 : 1;
  for (let i = 0; i < 128; i++) {
    const seed = 'CROSSING-51-' + i;
    const level = getLevel(seed, stage);
    if (level.crossing && level.mirrored === (p.get('mirror') === '1'))
      return testCheckpoint(seed, stage);
  }
  return null;
}

export function grindshotTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (
    p.getAll('test').length !== 1 ||
    p.get('test') !== 'grindshot' ||
    p.getAll('build').length > 1 ||
    [
      'daily',
      'dv',
      'seed',
      'area',
      'formation',
      'route',
      'mode',
      'layout',
      'variant',
      'mirror',
    ].some((k) => p.has(k)) ||
    (p.has('build') && !['base', 'evolved', 'bank', 'shell'].includes(p.get('build')!))
  )
    return null;
  const mods = [...UPGRADE_TEST_BUILDS.grindshot];
  if (p.get('build') === 'base') mods[1] = 'airshot';
  if (p.get('build') === 'bank') mods.splice(2, 2, 'ricochet', 'banker');
  if (p.get('build') === 'shell') mods.splice(2, 2, 'shellshock', 'fuse');
  return { ...testCheckpoint('GRIND-52', 6), route: 'low', mods };
}

export function interceptorGrindTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (
    p.getAll('test').length !== 1 ||
    p.get('test') !== 'interceptor-grindshot' ||
    ['phase', 'mirror'].some((k) => p.getAll(k).length > 1) ||
    [
      'daily',
      'dv',
      'seed',
      'area',
      'formation',
      'build',
      'route',
      'mode',
      'layout',
      'variant',
    ].some((k) => p.has(k)) ||
    (p.has('phase') && !['1', '2', '3'].includes(p.get('phase')!)) ||
    (p.has('mirror') && !['0', '1'].includes(p.get('mirror')!))
  )
    return null;
  for (let i = 0; i < 128; i++) {
    const seed = `SAW-BOSS-53-${p.get('phase') ?? '1'}-${i}`;
    if (getLevel(seed, 19).mirrored === (p.get('mirror') === '1')) return testCheckpoint(seed, 19);
  }
  return null;
}

export function wallcrawlerTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (
    p.getAll('test').length !== 1 ||
    p.get('test') !== 'wallcrawler' ||
    ['area', 'mirror'].some((k) => p.getAll(k).length > 1) ||
    [
      'daily',
      'dv',
      'seed',
      'formation',
      'build',
      'route',
      'mode',
      'layout',
      'variant',
      'phase',
    ].some((k) => p.has(k)) ||
    (p.has('area') && !['cooling', 'rooftops'].includes(p.get('area')!)) ||
    (p.has('mirror') && !['0', '1'].includes(p.get('mirror')!))
  )
    return null;
  const stage = p.get('area') === 'rooftops' ? 16 : 8;
  for (let i = 0; i < 512; i++) {
    const seed = 'CRAWLER-54-' + i,
      level = getLevel(seed, stage),
      spawn = level.spawns.find((s) => s.kind === 'wallcrawler');
    if (!spawn || level.mirrored !== (p.get('mirror') === '1')) continue;
    const weak = breakableSolids(level, seed, stage).some(
      (s) =>
        spawn.x >= s.x - 18 &&
        spawn.x <= s.x + s.w + 18 &&
        spawn.y >= s.y - 18 &&
        spawn.y <= s.y + s.h + 18,
    );
    if (weak) return testCheckpoint(seed, stage);
  }
  return null;
}
