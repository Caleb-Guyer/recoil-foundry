import { getLevel } from './levels.ts';
import { testCheckpoint } from './practice.ts';
import type { Checkpoint } from './rules.ts';

export const BOSS_REMASTER_TESTS = {
  condenser: {
    name: 'The Condenser',
    stage: 11,
    instruction:
      'Use the raised flanks to cross the coolant. Watch the pressure coils, committed shot lines and cooling-front warnings. R restarts this phase; Continue and unlocks stay untouched.',
  },
  sorter: {
    name: 'The Sorter',
    stage: 15,
    instruction:
      'Use the upper routes to clear the floor sweep. Follow the magnetic lanes and scrap-shot warnings, then punish recovery. R restarts this phase; Continue and unlocks stay untouched.',
  },
} as const;
export type BossRemasterTestBoss = keyof typeof BOSS_REMASTER_TESTS;
/** Native remaster phases are zero-based; the URL displays phases 1, 2 and 3. */
export interface BossRemasterTestIdentity {
  boss: BossRemasterTestBoss;
  phase: 0 | 1 | 2;
  mirror: boolean;
  stage: 11 | 15;
}
export interface BossRemasterTestFixture extends BossRemasterTestIdentity {
  checkpoint: Checkpoint;
}

const sceneSeeds = new Map<string, string>();
function sceneSeed(boss: BossRemasterTestBoss, phase: 0 | 1 | 2, mirror: boolean): string {
  const key = `${boss}:${phase}:${mirror}`;
  const cached = sceneSeeds.get(key);
  if (cached) return cached;
  const stage = BOSS_REMASTER_TESTS[boss].stage;
  // Select the requested encounter and mirror through native campaign draws.
  // The bounded canonical suffix also distinguishes fixtures from player seeds.
  for (let i = 0; i < 256; i++) {
    const seed = `RF-C102-BOSS-${boss === 'condenser' ? 'C' : 'S'}-${phase + 1}-${mirror ? 'M' : 'N'}-${i}`;
    const level = getLevel(seed, stage);
    if (level.mirrored === mirror && level.spawns.some((spawn) => spawn.kind === boss)) {
      sceneSeeds.set(key, seed);
      return seed;
    }
  }
  throw new Error('No native boss seed for the requested encounter and mirror');
}

export function bossRemasterTestIdentity(seed: string): BossRemasterTestIdentity | null {
  const match = /^RF-C102-BOSS-(C|S)-([1-3])-(M|N)-(0|[1-9]\d{0,2})$/.exec(seed);
  if (!match || Number(match[4]) >= 256) return null;
  const boss = match[1] === 'C' ? 'condenser' : 'sorter';
  const phase = (Number(match[2]) - 1) as 0 | 1 | 2;
  const mirror = match[3] === 'M';
  if (sceneSeed(boss, phase, mirror) !== seed) return null;
  return { boss, phase, mirror, stage: BOSS_REMASTER_TESTS[boss].stage };
}

export function bossRemasterTestFromUrl(url: URL): BossRemasterTestFixture | null {
  const params = url.searchParams;
  if (params.get('test') !== 'boss-remaster' || params.get('v') !== '1') return null;
  let invalid = false;
  params.forEach((_, key) => {
    if (!['test', 'boss', 'phase', 'mirror', 'v'].includes(key) || params.getAll(key).length !== 1)
      invalid = true;
  });
  const rawBoss = params.get('boss') ?? 'condenser';
  const rawPhase = params.get('phase') ?? '1';
  const rawMirror = params.get('mirror') ?? '0';
  if (
    invalid ||
    !Object.hasOwn(BOSS_REMASTER_TESTS, rawBoss) ||
    !['1', '2', '3'].includes(rawPhase) ||
    !['0', '1'].includes(rawMirror)
  )
    return null;
  const boss = rawBoss as BossRemasterTestBoss;
  const phase = (Number(rawPhase) - 1) as 0 | 1 | 2;
  const mirror = rawMirror === '1';
  const stage = BOSS_REMASTER_TESTS[boss].stage;
  const checkpoint = testCheckpoint(sceneSeed(boss, phase, mirror), stage);
  // Keep ordinary legal upgrades while leaving room for the boss to demonstrate
  // its attacks. Missed fittings account for the deliberately shorter build.
  checkpoint.mods = checkpoint.mods.slice(0, 8);
  return {
    boss,
    phase,
    mirror,
    stage,
    checkpoint: {
      ...checkpoint,
      version: 6,
      startingGun: 'pistol',
      missedUpgrades: stage - checkpoint.mods.length,
      encounters: 1,
    },
  };
}
