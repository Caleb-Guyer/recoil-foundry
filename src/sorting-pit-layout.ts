import { getLevel, type Level, type Solid, type Spawn } from './levels.ts';
import { courierEligible } from './courier-layout.ts';
import { seeded, type Checkpoint } from './rules.ts';

export const SORTING_LAYOUTS = ['shelter', 'feed', 'pit'] as const;
export type SortingLayout = (typeof SORTING_LAYOUTS)[number];

export function planSortingPit(seed: string, exclusions: Partial<Checkpoint> = {}) {
  const rng = seeded(seed + ':sorting-pit:1');
  if (seed.startsWith('RF-D') || rng() >= 0.4 || exclusions.areaEvent?.area === 3) return null;
  // Reclamation's first two rooms introduce the Harpooner and Fabricator.
  const stages = [14].filter(
    (s) =>
      s !== exclusions.courier?.stage &&
      s !== exclusions.story?.stage &&
      !exclusions.auditor?.rooms.includes(s) &&
      courierEligible(getLevel(seed, s)),
  );
  return stages.length ? stages[Math.floor(rng() * stages.length)] : null;
}

export function validSortingPit(d: Checkpoint) {
  return (
    d.sortingPit === undefined ||
    (d.version === 6 &&
      d.sortingPit === 14 &&
      typeof d.seed === 'string' &&
      !d.seed.startsWith('RF-D') &&
      d.areaEvent?.area !== 3 &&
      d.courier?.stage !== d.sortingPit &&
      d.story?.stage !== d.sortingPit &&
      !(Array.isArray(d.auditor?.rooms) && d.auditor.rooms.includes(d.sortingPit)))
  );
}

export function sortingPitLevel(seed: string): Level {
  const rng = seeded(seed + ':sorting-floor:1'),
    preview = /^SORTING-PIT-(shelter|feed|pit)-(0|1)$/.exec(seed),
    layout = (preview?.[1] ?? SORTING_LAYOUTS[Math.floor(rng() * 3)]) as SortingLayout,
    mirrored = preview ? preview[2] === '1' : rng() < 0.5;
  // A wide, unobstructed lifting column; fixed decks shelter both edges. The
  // lower sorting well has an ordinary floor and normal-jump exits on each side.
  const solids: Solid[] = [
    { x: 280, y: 635, w: 170, h: 105 },
    { x: 1550, y: 635, w: 170, h: 105 },
    { x: 390, y: 525, w: 240, h: 24 },
    { x: 1370, y: 525, w: 240, h: 24 },
    ...(layout === 'shelter'
      ? [
          { x: 470, y: 350, w: 160, h: 24 },
          { x: 1370, y: 350, w: 160, h: 24 },
        ]
      : layout === 'pit'
        ? [
            { x: 450, y: 680, w: 190, h: 60 },
            { x: 1360, y: 680, w: 190, h: 60 },
          ]
        : []),
  ];
  const spawns: Spawn[] = [
    { kind: 'shooter', x: 510, y: 509 },
    { kind: 'shooter', x: 1490, y: 509 },
    { kind: 'runner', x: 840, y: 723 },
    { kind: 'runner', x: 1160, y: 723 },
    { kind: 'hopper', x: 1430, y: layout === 'pit' ? 663 : 723 },
    { kind: 'borer', x: 1760, y: 720 },
    { kind: 'flyer', x: 870, y: 390 },
    { kind: 'sifter', x: 1180, y: 320 },
    { kind: 'skimmer', x: 1680, y: 300 },
    { kind: 'sniper', x: 1600, y: 619 },
  ];
  const flip = (x: number) => (mirrored ? 2000 - x : x);
  return {
    id: 'sorting-' + layout,
    name: 'The Sorting Pit',
    area: 'reclamation',
    boss: false,
    mirrored,
    sortingPit: layout,
    solids: solids.map((s) => ({ ...s, x: mirrored ? 2000 - s.x - s.w : s.x })),
    hazards: [],
    setpiece: {
      rosters: [],
      weak: [],
      props: [730, 950, 1050, 1270, ...(layout === 'feed' ? [660, 1340] : [])].map((x) => ({
        kind: 'crate',
        x: flip(x),
        y: 717,
      })),
    },
    spawns: spawns.map((s) => ({ ...s, x: flip(s.x) })),
    route: [
      { x: 170, y: 720 },
      { x: 365, y: 615 },
      { x: 520, y: 505 },
      { x: 1000, y: 720 },
      { x: 1480, y: 505 },
      { x: 1635, y: 615 },
      { x: 1830, y: 720 },
    ],
  };
}

export function sortingPitTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (p.get('test') !== 'sorting-pit') return null;
  let invalid = false;
  p.forEach((_, k) => {
    if (!['test', 'layout', 'mirror', 'build', 'v'].includes(k) || p.getAll(k).length !== 1)
      invalid = true;
  });
  const layout = p.get('layout') ?? 'shelter',
    build = p.get('build') ?? 'standard';
  if (
    invalid ||
    !SORTING_LAYOUTS.includes(layout as SortingLayout) ||
    !['standard', 'beam', 'portal', 'shell', 'ball'].includes(build) ||
    (p.has('mirror') && p.get('mirror') !== '1')
  )
    return null;
  const mods = [
    'magnum',
    'light',
    'airshot',
    'rapid',
    'pierce',
    'kick',
    'landing',
    ...(build === 'beam'
      ? ['cutting-torch']
      : build === 'portal'
        ? ['fold']
        : build === 'shell'
          ? ['shellshock']
          : build === 'ball'
            ? ['mass-driver']
            : ['ricochet']),
  ];
  return {
    version: 6,
    seed: `SORTING-PIT-${layout}-${p.has('mirror') ? 1 : 0}`,
    stage: 14,
    sortingPit: 14,
    hp: 100,
    mods,
    missedUpgrades: 14 - mods.length,
    kills: 0,
    elapsed: 0,
  };
}
