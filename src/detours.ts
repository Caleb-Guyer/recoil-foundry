import { formerStage } from './rules.ts';
import { seeded, isDetourStage, areaIndex } from './rules.ts';
import type { Level, Solid, Spawn, EnemyKind } from './levels.ts';
import type { HazardPlacement } from './hazard-layouts.ts';

export const DETOUR_DOOR = { x: 1930, floor: 460 };
// The final 220 units are reserved by every main layout. Suspended steps keep
// the ordinary ground exit open and make the upper route a deliberate choice.
export const DETOUR_STEPS: Solid[] = [
  { x: 1790, y: 590, w: 76, h: 18 },
  { x: 1890, y: 460, w: 102, h: 18 },
];
export const DETOUR_HEALTH = 1.15;
const box = (x: number, y: number, w: number, h: number): Solid => ({ x, y, w, h });
const at = (kind: EnemyKind, x: number, y: number, elite?: Spawn['elite']): Spawn => ({
  kind,
  x,
  y,
  ...(elite ? { elite } : {}),
});
const crusher = (x: number, y = 430): HazardPlacement => ({
  kind: 'crusher',
  x,
  y,
  w: 104,
  h: 32,
  travel: 708 - y,
});
const lift = (x: number, travel = 170): HazardPlacement => ({
  kind: 'lift',
  x,
  y: 690,
  w: 112,
  h: 18,
  travel,
});

// Authored hazards and spawn anchors share a layout. Mirroring transforms all
// of them together, preserving cover and safe space for every warned entrance.
export const DETOUR_LAYOUTS: Level[] = [
  {
    id: 'freight-cage',
    name: 'Freight cage',
    area: 'docks',
    detour: true,
    boss: false,
    mirrored: false,
    solids: [
      box(420, 650, 140, 90),
      box(850, 620, 150, 120),
      box(1390, 640, 150, 100),
      box(600, 440, 150, 22),
      box(1290, 460, 180, 22),
    ],
    hazards: [lift(700), crusher(1170)],
    spawns: [
      at('shooter', 490, 634),
      at('runner', 600, 723),
      at('shooter', 925, 604),
      at('flyer', 740, 300),
      at('flyer', 1230, 295),
      at('charger', 1320, 723),
      at('charger', 1620, 723),
      at('flyer', 1550, 355),
    ],
    route: [
      { x: 320, y: 720 },
      { x: 490, y: 630 },
      { x: 770, y: 720 },
      { x: 925, y: 600 },
      { x: 1200, y: 720 },
      { x: 1460, y: 620 },
      { x: 1730, y: 720 },
    ],
  },
  {
    id: 'pressure-vault',
    name: 'Pressure vault',
    area: 'furnace',
    detour: true,
    boss: false,
    mirrored: false,
    solids: [
      box(400, 650, 160, 90),
      box(650, 490, 190, 22),
      box(940, 650, 140, 90),
      box(1160, 410, 220, 22),
      box(1480, 640, 150, 100),
      box(820, 280, 90, 50),
    ],
    hazards: [lift(700, 100), crusher(1280, 470)],
    spawns: [
      at('shooter', 480, 634),
      at('charger', 600, 723),
      at('sniper', 670, 474),
      at('runner', 1010, 634),
      at('hopper', 1130, 723),
      at('sniper', 1220, 394),
      at('shooter', 1550, 624),
      at('flyer', 590, 300),
      at('flyer', 1390, 300),
      at('runner', 900, 723, 'shielded'),
    ],
    route: [
      { x: 320, y: 720 },
      { x: 480, y: 630 },
      { x: 800, y: 720 },
      { x: 1010, y: 630 },
      { x: 1330, y: 720 },
      { x: 1550, y: 620 },
      { x: 1760, y: 720 },
    ],
  },
  {
    id: 'spillway',
    name: 'Spillway',
    area: 'cooling',
    detour: true,
    boss: false,
    mirrored: false,
    solids: [
      box(410, 640, 150, 100),
      box(770, 615, 150, 125),
      box(1190, 650, 140, 90),
      box(1490, 610, 150, 130),
      box(570, 410, 180, 22),
      box(1120, 400, 190, 22),
    ],
    coolant: [box(570, 731, 190, 9), box(940, 731, 220, 9)],
    hazards: [crusher(1030, 470), lift(1410, 160)],
    spawns: [
      at('shooter', 480, 624),
      at('hopper', 650, 723),
      at('sniper', 790, 599),
      at('charger', 960, 723),
      at('sniper', 1210, 384, 'twin'),
      at('runner', 1260, 634),
      at('shooter', 1570, 594),
      at('skimmer', 650, 285),
      at('skimmer', 1470, 290),
      at('flyer', 950, 320),
      at('charger', 1120, 723),
      at('runner', 600, 723, 'shielded'),
    ],
    route: [
      { x: 310, y: 720 },
      { x: 485, y: 620 },
      { x: 660, y: 720 },
      { x: 845, y: 595 },
      { x: 1030, y: 720 },
      { x: 1260, y: 630 },
      { x: 1400, y: 720 },
      { x: 1560, y: 590 },
      { x: 1760, y: 720 },
    ],
  },
  {
    id: 'storm-deck',
    name: 'Storm deck',
    area: 'rooftops',
    detour: true,
    boss: false,
    mirrored: false,
    solids: [
      box(410, 650, 150, 90),
      box(710, 620, 150, 120),
      box(1070, 650, 150, 90),
      box(1430, 620, 160, 120),
      box(550, 420, 200, 22),
      box(1080, 410, 200, 22),
    ],
    hazards: [
      crusher(960, 470),
      crusher(1340, 470),
      { kind: 'crumble', x: 890, y: 420, w: 130, h: 18, travel: 0 },
    ],
    spawns: [
      at('sniper', 430, 634),
      at('hopper', 620, 723),
      at('sniper', 730, 604, 'twin'),
      at('charger', 885, 723),
      at('hopper', 1250, 723),
      at('sniper', 1100, 394),
      at('runner', 1140, 634, 'shielded'),
      at('shooter', 1510, 604),
      at('skimmer', 660, 280),
      at('skimmer', 1180, 290),
      at('skimmer', 1530, 300),
      at('flyer', 900, 280),
      at('charger', 1620, 723),
      at('runner', 1030, 723),
    ],
    route: [
      { x: 310, y: 720 },
      { x: 485, y: 630 },
      { x: 620, y: 720 },
      { x: 785, y: 600 },
      { x: 950, y: 720 },
      { x: 1140, y: 630 },
      { x: 1340, y: 720 },
      { x: 1510, y: 600 },
      { x: 1770, y: 720 },
    ],
  },
];

export function getDetour(seed: string, stage: number): Level {
  if (!isDetourStage(stage)) throw new RangeError('No detour at this stage');
  stage = formerStage(stage);
  const source = DETOUR_LAYOUTS[areaIndex(stage)];
  const mirrored = seeded(seed + ':detour-layout:' + stage)() > 0.5;
  const rect = (s: Solid) => ({ ...s, x: mirrored ? 2000 - s.x - s.w : s.x });
  const route = source.route.map((p) => ({ ...p, x: mirrored ? 2000 - p.x : p.x }));
  return {
    ...source,
    mirrored,
    solids: source.solids.map(rect),
    spawns: source.spawns.map((p) => ({ ...p, x: mirrored ? 2000 - p.x : p.x })),
    route: mirrored ? route.reverse() : route,
    hazards: source.hazards!.map((h) => ({ ...h, x: mirrored ? 2000 - h.x : h.x })),
    ...(source.coolant ? { coolant: source.coolant.map(rect) } : {}),
  };
}
