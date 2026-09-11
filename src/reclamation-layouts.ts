import type { Layout, Level, Spawn, Solid } from './levels.ts';
import { seeded } from './rules.ts';

export interface MagnetPlacement {
  x: number;
  y: number;
  floor: number;
  offset: number;
}
const box = (x: number, y: number, w: number, h = 22): Solid => ({ x, y, w, h });
const at = (kind: Spawn['kind'], x: number, y: number): Spawn => ({ kind, x, y });
const path = (...points: number[][]) => points.map(([x, y]) => ({ x, y }));

// Each shaft has an uninterrupted physical path from floor to magnet. Raised
// routes run alongside it; taking away every crate never removes the main route.
export const RECLAMATION_LAYOUTS: Layout[] = [
  {
    id: 'sorting-floor',
    name: 'Sorting floor',
    area: 'reclamation',
    solids: [
      box(400, 650, 140, 90),
      box(900, 620, 160, 120),
      box(1440, 650, 140, 90),
      box(830, 440, 300),
      box(1430, 450, 150),
    ],
    magnets: [
      { x: 690, y: 350, floor: 740, offset: 0 },
      { x: 1250, y: 350, floor: 740, offset: 3.2 },
    ],
    spawns: [
      at('borer', 570, 723),
      at('runner', 860, 723),
      at('shooter', 980, 604),
      at('sifter', 1200, 260),
      at('charger', 1370, 723),
      at('hopper', 1660, 723),
      at('sniper', 850, 424),
      at('flyer', 1580, 320),
      at('skimmer', 980, 270),
      at('borer', 1740, 723),
    ],
    route: path(
      [300, 720],
      [470, 630],
      [700, 720],
      [980, 600],
      [1240, 720],
      [1510, 630],
      [1770, 720],
    ),
  },
  {
    id: 'gantry-walk',
    name: 'Gantry walk',
    area: 'reclamation',
    solids: [
      box(400, 650, 120, 90),
      box(610, 520, 230),
      box(1010, 650, 140, 90),
      box(1260, 500, 280),
      box(1640, 650, 120, 90),
    ],
    magnets: [
      { x: 900, y: 300, floor: 740, offset: 1 },
      { x: 1570, y: 330, floor: 740, offset: 4.2 },
    ],
    spawns: [
      at('borer', 590, 723),
      at('shooter', 690, 504),
      at('sifter', 920, 220),
      at('runner', 970, 723),
      at('charger', 1180, 723),
      at('sniper', 1280, 484),
      at('sifter', 1450, 290),
      at('hopper', 1620, 723),
      at('skimmer', 1720, 260),
      at('borer', 1820, 723),
      at('flyer', 630, 270),
    ],
    route: path(
      [300, 720],
      [460, 630],
      [700, 720],
      [900, 720],
      [1080, 630],
      [1300, 720],
      [1530, 720],
      [1700, 630],
      [1830, 720],
    ),
  },
  {
    id: 'scrap-channels',
    name: 'Scrap channels',
    area: 'reclamation',
    solids: [
      box(420, 650, 140, 90),
      box(820, 600, 160, 140),
      box(1240, 650, 140, 90),
      box(1620, 600, 150, 140),
      box(810, 420, 240),
    ],
    magnets: [
      { x: 680, y: 330, floor: 740, offset: 0 },
      { x: 1100, y: 300, floor: 740, offset: 2.2 },
      { x: 1490, y: 330, floor: 740, offset: 4.4 },
    ],
    spawns: [
      at('borer', 590, 723),
      at('sniper', 840, 404),
      at('sifter', 720, 240),
      at('hopper', 1030, 723),
      at('runner', 900, 584),
      at('borer', 1180, 723),
      at('charger', 1410, 723),
      at('sifter', 1320, 270),
      at('skimmer', 1640, 300),
      at('shooter', 1690, 584),
      at('flyer', 1090, 230),
      at('hopper', 1810, 723),
    ],
    route: path(
      [300, 720],
      [490, 630],
      [680, 720],
      [900, 580],
      [1100, 720],
      [1310, 630],
      [1490, 720],
      [1690, 580],
      [1840, 720],
    ),
  },
];

export const SORTER_ARENA: Layout = {
  id: 'separation-chamber',
  name: 'Separation chamber',
  area: 'reclamation',
  solids: [
    box(400, 650, 150, 90),
    box(890, 590, 220),
    box(1450, 650, 150, 90),
    box(370, 430, 180),
    box(1450, 430, 180),
  ],
  magnets: [
    { x: 710, y: 330, floor: 740, offset: 0 },
    { x: 1290, y: 330, floor: 740, offset: 3.2 },
  ],
  spawns: [at('sorter', 1470, 260)],
  route: path(
    [300, 720],
    [475, 630],
    [710, 720],
    [1000, 720],
    [1290, 720],
    [1525, 630],
    [1800, 720],
  ),
};

export function reclamationLevel(seed: string, stage: number, alternate?: Layout): Level {
  const slot = stage % 4;
  const source = slot === 3 ? (alternate ?? SORTER_ARENA) : RECLAMATION_LAYOUTS[slot];
  const mirrored = seeded(seed + ':reclamation:' + slot)() > 0.5;
  const route = source.route.map((p) => ({ ...p, x: mirrored ? 2000 - p.x : p.x }));
  const seen = new Set<string>();
  const spawns = source.spawns
    .map((s) => ({ ...s, x: mirrored ? 2000 - s.x : s.x }))
    .filter((s) => s.x >= 380)
    .filter((s) => {
      if (s.kind !== 'borer' && s.kind !== 'sifter') return true;
      if (seen.has(s.kind)) return false;
      seen.add(s.kind);
      return true;
    })
    .slice(0, slot === 3 ? 1 : 8 + slot);
  return {
    ...source,
    boss: slot === 3,
    mirrored,
    solids: source.solids.map((s) => ({ ...s, x: mirrored ? 2000 - s.x - s.w : s.x })),
    spawns,
    magnets: (source.magnets ?? []).map((m) => ({ ...m, x: mirrored ? 2000 - m.x : m.x })),
    route: mirrored ? route.reverse() : route,
  };
}
