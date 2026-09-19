import type { Level, Spawn } from './levels.ts';
import { availableMods, type Checkpoint } from './rules.ts';

export const DISCONNECT_STAGES = [3, 7, 15] as const;
export interface ShutdownSave {
  disabled: number[];
  chamber?: true;
  cycle?: number;
}
export const DISCONNECT = { x: 76, y: 592 };
export const SHUTDOWN_PANELS = [
  { x: 520, y: 548 },
  { x: 1480, y: 548 },
  { x: 1000, y: 358 },
];
export const SHUTDOWN_WAVES: Spawn[][] = [
  [
    { kind: 'hopper', x: 810, y: 723 },
    { kind: 'charger', x: 1770, y: 717, elite: 'shielded' },
    { kind: 'shooter', x: 1510, y: 574, elite: 'twin' },
    { kind: 'skimmer', x: 1200, y: 250 },
    { kind: 'flyer', x: 680, y: 300 },
    { kind: 'hopper', x: 1160, y: 723 },
  ],
  [
    { kind: 'borer', x: 1780, y: 720 },
    { kind: 'sifter', x: 740, y: 260 },
    { kind: 'skimmer', x: 1280, y: 250, elite: 'twin' },
    { kind: 'shooter', x: 480, y: 574, elite: 'shielded' },
    { kind: 'hopper', x: 1150, y: 723, elite: 'volatile' },
    { kind: 'charger', x: 810, y: 717 },
    { kind: 'flyer', x: 1560, y: 260 },
  ],
  [
    { kind: 'skimmer', x: 710, y: 260, elite: 'twin' },
    { kind: 'skimmer', x: 1310, y: 240 },
    { kind: 'borer', x: 830, y: 720, elite: 'shielded' },
    { kind: 'hopper', x: 1760, y: 723, elite: 'volatile' },
    { kind: 'shooter', x: 480, y: 574, elite: 'twin' },
    { kind: 'shooter', x: 1510, y: 574, elite: 'shielded' },
    { kind: 'sifter', x: 1600, y: 280 },
    { kind: 'hopper', x: 1140, y: 723 },
  ],
];
export function shutdownLevel(cycle: number): Level {
  return {
    id: 'continuity-control',
    name: 'Continuity control',
    area: 'rooftops',
    boss: false,
    mirrored: false,
    shutdown: true,
    solids: [
      { x: 300, y: 675, w: 115, h: 65 },
      { x: 420, y: 590, w: 220, h: 20 },
      { x: 730, y: 490, w: 160, h: 20 },
      { x: 915, y: 400, w: 170, h: 20 },
      { x: 1110, y: 490, w: 160, h: 20 },
      { x: 1360, y: 590, w: 220, h: 20 },
      { x: 1585, y: 675, w: 115, h: 65 },
    ],
    hazards: [],
    setpiece: {
      rosters: [],
      weak: [],
      props: [
        { kind: 'canister', x: 1240, y: 720 },
        { kind: 'crate', x: 670, y: 717 },
      ],
    },
    spawns: (SHUTDOWN_WAVES[cycle] ?? []).map((s) => ({ ...s })),
    route: [
      { x: 140, y: 720 },
      { x: 355, y: 650 },
      { x: 520, y: 570 },
      { x: 810, y: 470 },
      { x: 1000, y: 380 },
    ],
  };
}
export function validShutdown(d: Checkpoint) {
  const s = d.shutdown;
  if (s === undefined) return true;
  return (
    d.version === 6 &&
    !!s &&
    typeof s === 'object' &&
    Array.isArray(s.disabled) &&
    s.disabled.length <= 3 &&
    s.disabled.every(
      (stage, i) =>
        (DISCONNECT_STAGES as readonly number[]).includes(stage) &&
        (i === 0 || s.disabled[i - 1] < stage) &&
        (!!d.overtime || stage <= d.stage),
    ) &&
    (s.chamber === undefined
      ? s.cycle === undefined
      : s.chamber === true &&
        s.disabled.length === 3 &&
        d.stage === 19 &&
        !d.overtime &&
        !d.escape &&
        !d.detour &&
        !d.route &&
        !d.reward &&
        !d.reforgeRoom &&
        Number.isInteger(s.cycle) &&
        s.cycle! >= 0 &&
        s.cycle! <= 3)
  );
}
export function shutdownTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams,
    scene = p.get('scene') ?? 'relay';
  if (
    p.get('test') !== 'shutdown' ||
    p.getAll('test').length !== 1 ||
    !['relay', 'retaliation', 'entrance', 'finale', 'ending'].includes(scene)
  )
    return null;
  let bad = false;
  p.forEach((_, key) => {
    if (!['test', 'scene', 'v'].includes(key) || p.getAll(key).length !== 1) bad = true;
  });
  if (bad) return null;
  const stage = scene === 'relay' ? 3 : scene === 'retaliation' ? 16 : 19;
  const mods = ['magnum', 'rapid', 'light'].slice(0, stage);
  // A legal campaign-sized gun, including parents before their branches.
  while (mods.length < stage) {
    const choices = availableMods(mods, true);
    const next =
      choices.find((m) =>
        [
          'kick',
          'airshot',
          'pierce',
          'ricochet',
          'leech',
          'scatter',
          'burst',
          'backblast',
          'landing',
          'execute',
          'redline',
          'split',
        ].includes(m.id),
      ) ?? choices[0];
    if (!next) break;
    mods.push(next.id);
  }
  return {
    version: 6,
    seed: 'SHUTDOWN-89-' + scene.toUpperCase(),
    stage,
    hp: 100,
    mods,
    ...(mods.length < stage ? { missedUpgrades: stage - mods.length } : {}),
    kills: 0,
    elapsed: 0,
    shutdown: {
      disabled: scene === 'relay' ? [] : [...DISCONNECT_STAGES],
      ...(['finale', 'ending'].includes(scene)
        ? { chamber: true as const, cycle: scene === 'ending' ? 3 : 0 }
        : {}),
    },
  };
}
