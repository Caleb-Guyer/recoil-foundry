import { getLevel, type Level, type Solid } from './levels.ts';
import { courierEligible, type CourierSave } from './courier-layout.ts';
import type { AreaEventSave } from './area-events.ts';
import { seeded, type Checkpoint } from './rules.ts';

export function planFloodgate(
  seed: string,
  event?: AreaEventSave | null,
  courier?: CourierSave | null,
) {
  const rng = seeded(seed + ':floodgate-v1');
  if (rng() >= 0.35 || event?.area === 2) return null;
  const stages = [8, 9].filter((s) => s !== courier?.stage && courierEligible(getLevel(seed, s)));
  return stages.length ? stages[Math.floor(rng() * stages.length)] : null;
}

// Both sides have a normal-jump staircase. Dry decks have generous landing
// widths and gaps; recoil can skip steps, but is never needed to escape.
export function floodgateLevel(seed: string): Level {
  const mirrored = seeded(seed + ':floodgate-layout')() < 0.5;
  const solids: Solid[] = [
    { x: 240, y: 645, w: 150, h: 95 },
    { x: 390, y: 540, w: 150, h: 22 },
    { x: 540, y: 435, w: 260, h: 22 },
    { x: 960, y: 400, w: 300, h: 22 },
    { x: 1320, y: 435, w: 220, h: 22 },
    { x: 1540, y: 540, w: 110, h: 22 },
    { x: 1650, y: 645, w: 110, h: 95 },
    { x: 900, y: 650, w: 100, h: 90 },
    { x: 1300, y: 645, w: 100, h: 95 },
  ].map((s) => ({ ...s, x: mirrored ? 2000 - s.x - s.w : s.x }));
  return {
    id: 'floodgate',
    name: 'Floodgate',
    area: 'cooling',
    boss: false,
    floodgate: true,
    mirrored,
    solids,
    hazards: [],
    setpiece: { rosters: [], props: [], weak: [] },
    spawns: [
      { kind: 'shooter', x: 750, y: 419 },
      { kind: 'shooter', x: 1010, y: 384 },
      { kind: 'shooter', x: 1210, y: 384 },
      { kind: 'shooter', x: 1450, y: 419 },
      { kind: 'flyer', x: 700, y: 280 },
      { kind: 'flyer', x: 950, y: 225 },
      { kind: 'flyer', x: 1300, y: 240 },
      { kind: 'skimmer', x: 1510, y: 210 },
      { kind: 'skimmer', x: 1760, y: 290 },
      { kind: 'flyer', x: 1110, y: 170 },
    ].map((s) => ({ ...s, x: mirrored ? 2000 - s.x : s.x })) as Level['spawns'],
    route: [
      { x: 170, y: 720 },
      ...solids
        .filter((s) => s.y < 650 && s.w >= 110 && s.x < 1800)
        .sort((a, b) => a.x - b.x)
        .map((s) => ({ x: s.x + s.w / 2, y: s.y - 20 })),
      { x: 1810, y: 720 },
    ],
  };
}

export function floodgateTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'build', 'mirror', 'v'].includes(key)) invalid = true;
  });
  if (
    invalid ||
    p.get('test') !== 'floodgate' ||
    p.getAll('test').length !== 1 ||
    (p.has('build') &&
      (p.getAll('build').length !== 1 ||
        !['standard', 'starter', 'beam', 'portal'].includes(p.get('build')!))) ||
    (p.has('mirror') && (p.getAll('mirror').length !== 1 || p.get('mirror') !== '1'))
  )
    return null;
  const mods =
    p.get('build') === 'starter'
      ? []
      : [
          'magnum',
          'light',
          'airshot',
          'rapid',
          'pierce',
          'kick',
          'landing',
          p.get('build') === 'beam'
            ? 'cutting-torch'
            : p.get('build') === 'portal'
              ? 'fold'
              : 'ricochet',
        ];
  return {
    version: 6,
    seed: p.has('mirror') ? 'FLOODGATE-83-1' : 'FLOODGATE-83-0',
    stage: 8,
    floodgate: 8,
    hp: 100,
    mods,
    kills: 0,
    elapsed: 0,
  };
}
