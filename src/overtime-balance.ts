import { availableMods, type Checkpoint } from './rules.ts';

// Legal, deliberately strong diagnostic guns. These are isolated previews,
// not a claim that a seeded first lap will offer every requested component.
export const OVERTIME_BUILDS: Record<string, readonly string[]> = {
  beam: [
    'cutting-torch',
    'magnum',
    'rapid',
    'burst',
    'pulse-chamber',
    'light',
    'leech',
    'airshot',
    'scatter',
    'countershot',
    'kick',
    'redline',
    'thermal-runaway',
  ],
  precision: [
    'deadeye',
    'magnum',
    'rapid',
    'execute',
    'rivet',
    'fracture',
    'deadlock',
    'airshot',
    'light',
    'leech',
    'capacitor',
    'reserve-cell',
    'rail-spike',
  ],
  volley: [
    'crossfire',
    'magnum',
    'rapid',
    'scatter',
    'burst',
    'convergence',
    'afterimage',
    'parallax',
    'bloom',
    'airshot',
    'leech',
    'pierce',
    'ricochet',
    'light',
  ],
  explosive: [
    'shellshock',
    'magnum',
    'rapid',
    'aftershock',
    'shockfront',
    'fuse',
    'linked-fuse',
    'chain-reaction',
    'blast-surf',
    'airshot',
    'leech',
    'light',
    'scatter',
    'burst',
  ],
  mobility: [
    'light',
    'kick',
    'redline',
    'airshot',
    'magnum',
    'rapid',
    'vector',
    'afterburner',
    'landing',
    'leech',
    'countershot',
    'fold',
    'rewire',
    'slingshot',
  ],
};
const shared = [
  'pierce',
  'ricochet',
  'split',
  'backblast',
  'breach',
  'backfire',
  'capacitor',
  'reserve-cell',
  'arc-coil',
  'daisy-chain',
  'tether',
  'snapback',
  'coolant-rounds',
  'deep-freeze',
];

export function overtimeBuild(name: string, stage: number, seed = 'OT-BALANCE-0'): Checkpoint {
  if (!Object.hasOwn(OVERTIME_BUILDS, name) || !Number.isInteger(stage) || stage < 0 || stage > 19)
    throw new Error('Invalid Overtime preview');
  const mods: string[] = [];
  let repairs = 0;
  for (let i = 0; i < 19 + stage; i++) {
    const pool = availableMods(mods);
    const mod =
      [...OVERTIME_BUILDS[name], ...shared]
        .map((id) => pool.find((m) => m.id === id))
        .find(Boolean) ?? pool[0];
    if (mod) mods.push(mod.id);
    else repairs++;
  }
  return {
    version: 5,
    seed,
    stage,
    hp: 100,
    mods,
    kills: 0,
    elapsed: 0,
    overtime: { baseMods: 19, repairs, remix: 5 },
  };
}

export function overtimeBalanceTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (p.get('test') !== 'overtime-balance') return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'build', 'room', 'v'].includes(key) || p.getAll(key).length !== 1) invalid = true;
  });
  const build = p.get('build') ?? 'beam',
    room = p.get('room') ?? '1';
  if (invalid || !Object.hasOwn(OVERTIME_BUILDS, build) || !/^(?:[1-9]|1[0-9]|20)$/.test(room))
    return null;
  return overtimeBuild(build, Number(room) - 1);
}
