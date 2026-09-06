import { seeded, sample } from './rules.ts';
import type { Vec } from './rules.ts';
import type { AreaId } from './areas.ts';
export type EnemyKind = 'runner' | 'shooter' | 'flyer' | 'charger' | 'sniper' | 'hopper' | 'boss';
export interface Solid {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Spawn extends Vec {
  kind: EnemyKind;
}
export interface Layout {
  id: string;
  name: string;
  area: AreaId;
  solids: Solid[];
  spawns: Spawn[];
  route: Vec[];
}
export interface Level extends Layout {
  mirrored: boolean;
  boss: boolean;
}
const box = (x: number, y: number, w: number, h: number): Solid => ({ x, y, w, h });
const shelf = (x: number, y: number, w: number) => box(x, y, w, 22);
const runner = (x: number, top = 740): Spawn => ({ kind: 'runner', x, y: top - 17 });
const shooter = (x: number, top = 740): Spawn => ({ kind: 'shooter', x, y: top - 16 });
const flyer = (x: number, y: number): Spawn => ({ kind: 'flyer', x, y });
const route = (...points: number[][]): Vec[] => points.map(([x, y]) => ({ x, y }));
// Authored cover, spawn anchors and a generous baseline route belong to the same layout.
// Ground remains safe beneath raised gaps; recoil creates optional shortcuts.
export const LAYOUTS: Layout[] = [
  {
    id: 'loading-bays',
    area: 'docks',
    name: 'Loading bays',
    solids: [
      box(390, 650, 150, 90),
      box(930, 620, 190, 120),
      box(1470, 660, 130, 80),
      shelf(650, 485, 230),
      shelf(1230, 435, 230),
    ],
    spawns: [
      runner(690),
      shooter(1010, 620),
      runner(1310),
      shooter(1525, 660),
      flyer(1180, 315),
      runner(790),
      flyer(640, 350),
      runner(1710),
    ],
    route: route(
      [300, 720],
      [465, 630],
      [760, 720],
      [1025, 600],
      [1300, 720],
      [1530, 640],
      [1770, 720],
    ),
  },
  {
    id: 'overpass',
    area: 'docks',
    name: 'Overpass',
    solids: [
      box(510, 665, 180, 75),
      shelf(510, 515, 630),
      box(1010, 640, 130, 100),
      shelf(1330, 405, 270),
      box(1490, 650, 150, 90),
    ],
    spawns: [
      runner(820),
      shooter(770, 515),
      runner(1190),
      shooter(1410, 405),
      runner(1570, 650),
      flyer(1240, 295),
      runner(1720),
      flyer(650, 330),
    ],
    route: route(
      [360, 720],
      [600, 645],
      [820, 720],
      [1070, 620],
      [1280, 720],
      [1560, 630],
      [1770, 720],
    ),
  },
  {
    id: 'staggered',
    area: 'docks',
    name: 'Staggered cover',
    solids: [
      box(440, 635, 120, 105),
      box(800, 665, 170, 75),
      box(1210, 610, 150, 130),
      shelf(610, 455, 240),
      shelf(1020, 390, 220),
      shelf(1480, 495, 230),
    ],
    spawns: [
      runner(665),
      shooter(885, 665),
      runner(1080),
      shooter(1290, 610),
      shooter(1580, 495),
      flyer(930, 270),
      runner(1700),
      flyer(1470, 305),
    ],
    route: route(
      [330, 720],
      [500, 615],
      [675, 720],
      [885, 645],
      [1100, 720],
      [1285, 590],
      [1500, 720],
      [1770, 720],
    ),
  },
  {
    id: 'terraces',
    area: 'docks',
    name: 'Terraces',
    solids: [
      box(400, 655, 190, 85),
      box(590, 555, 200, 185),
      box(790, 655, 170, 85),
      box(1220, 630, 180, 110),
      box(1400, 530, 190, 210),
      box(1590, 650, 100, 90),
      shelf(1020, 365, 230),
    ],
    spawns: [
      shooter(670, 555),
      runner(875, 655),
      runner(1080),
      shooter(1485, 530),
      runner(1300, 630),
      flyer(1100, 280),
      runner(1740),
      flyer(1650, 360),
    ],
    route: route(
      [300, 720],
      [490, 635],
      [690, 535],
      [875, 635],
      [1070, 720],
      [1310, 610],
      [1490, 510],
      [1640, 630],
      [1750, 720],
    ),
  },
  {
    id: 'pillars',
    area: 'furnace',
    name: 'Pillar hall',
    solids: [
      box(400, 640, 170, 100),
      box(570, 505, 130, 235),
      box(700, 640, 110, 100),
      box(970, 605, 150, 135),
      box(1120, 470, 140, 270),
      box(1260, 605, 130, 135),
      shelf(745, 365, 200),
      shelf(1450, 445, 230),
    ],
    spawns: [
      shooter(630, 505),
      runner(865),
      shooter(1185, 470),
      shooter(1550, 445),
      runner(1450),
      flyer(820, 265),
      flyer(1410, 265),
      runner(1760),
    ],
    route: route(
      [300, 720],
      [490, 620],
      [635, 485],
      [755, 620],
      [865, 720],
      [1040, 585],
      [1190, 450],
      [1325, 585],
      [1410, 720],
      [1770, 720],
    ),
  },
  {
    id: 'underpass',
    area: 'furnace',
    name: 'Underpass',
    solids: [
      box(350, 300, 360, 250),
      box(520, 670, 140, 70),
      box(860, 600, 160, 140),
      box(1180, 255, 440, 240),
      box(1300, 640, 170, 100),
      shelf(790, 340, 230),
    ],
    spawns: [
      runner(770),
      shooter(940, 600),
      runner(1090),
      shooter(1380, 640),
      runner(1730),
      flyer(1090, 425),
      shooter(1420, 255),
      flyer(1700, 360),
    ],
    route: route(
      [330, 720],
      [455, 720],
      [585, 650],
      [755, 720],
      [940, 580],
      [1100, 720],
      [1385, 620],
      [1690, 720],
    ),
  },
  {
    id: 'split-deck',
    area: 'rooftops',
    name: 'Split deck',
    solids: [
      box(360, 660, 170, 80),
      box(530, 535, 190, 205),
      box(720, 655, 100, 85),
      shelf(720, 405, 340),
      box(1130, 655, 90, 85),
      box(1220, 560, 180, 180),
      box(1400, 665, 180, 75),
      shelf(1430, 330, 210),
    ],
    spawns: [
      shooter(620, 535),
      shooter(900, 405),
      runner(930),
      shooter(1310, 560),
      runner(1490, 665),
      flyer(1120, 250),
      runner(1750),
      flyer(1660, 440),
    ],
    route: route(
      [270, 720],
      [440, 640],
      [620, 515],
      [770, 635],
      [875, 720],
      [1040, 720],
      [1170, 635],
      [1300, 540],
      [1490, 645],
      [1770, 720],
    ),
  },
  {
    id: 'gantry',
    area: 'rooftops',
    name: 'Gantry',
    solids: [
      box(400, 640, 160, 100),
      shelf(560, 510, 280),
      shelf(960, 375, 260),
      box(1220, 610, 170, 130),
      shelf(1390, 475, 320),
      box(1560, 675, 150, 65),
    ],
    spawns: [
      shooter(680, 510),
      shooter(1090, 375),
      runner(940),
      shooter(1300, 610),
      shooter(1560, 475),
      flyer(860, 285),
      runner(1740),
      flyer(1460, 330),
    ],
    route: route(
      [300, 720],
      [480, 620],
      [700, 720],
      [1040, 720],
      [1300, 590],
      [1460, 720],
      [1630, 655],
      [1790, 720],
    ),
  },
  {
    id: 'chimney',
    area: 'furnace',
    name: 'Chimney',
    solids: [
      box(350, 630, 170, 110),
      box(520, 500, 180, 240),
      box(700, 370, 260, 370),
      box(960, 500, 180, 240),
      box(1140, 630, 170, 110),
      shelf(1470, 400, 260),
    ],
    spawns: [
      shooter(610, 500),
      shooter(805, 370),
      runner(1070, 500),
      shooter(1580, 400),
      runner(1490),
      flyer(1230, 340),
      flyer(630, 260),
      runner(1770),
      runner(420, 630),
      flyer(1700, 285),
    ],
    route: route(
      [260, 720],
      [435, 610],
      [610, 480],
      [825, 350],
      [1050, 480],
      [1220, 610],
      [1450, 720],
      [1780, 720],
    ),
  },
  {
    id: 'fortress',
    area: 'furnace',
    name: 'Fortress',
    solids: [
      box(420, 650, 150, 90),
      box(570, 525, 190, 215),
      box(760, 650, 90, 90),
      shelf(760, 390, 500),
      box(1260, 525, 180, 215),
      box(1440, 650, 150, 90),
      box(900, 650, 190, 90),
    ],
    spawns: [
      shooter(660, 525),
      shooter(880, 390),
      shooter(1170, 390),
      runner(805, 650),
      shooter(1350, 525),
      runner(1510, 650),
      flyer(1030, 280),
      runner(1730),
      runner(990, 650),
      flyer(1640, 380),
    ],
    route: route(
      [300, 720],
      [495, 630],
      [660, 505],
      [805, 630],
      [990, 630],
      [1335, 505],
      [1515, 630],
      [1780, 720],
    ),
  },
  {
    id: 'broken-bridge',
    area: 'rooftops',
    name: 'Broken bridge',
    solids: [
      box(390, 650, 160, 90),
      shelf(550, 515, 260),
      shelf(1020, 490, 250),
      shelf(1490, 465, 260),
      box(1150, 650, 120, 90),
      box(1580, 650, 170, 90),
    ],
    spawns: [
      shooter(680, 515),
      runner(930),
      shooter(1140, 490),
      shooter(1610, 465),
      runner(1390),
      flyer(910, 340),
      flyer(1400, 310),
      runner(1720, 650),
      runner(1190, 650),
      flyer(1700, 300),
    ],
    route: route(
      [290, 720],
      [470, 630],
      [690, 495],
      [910, 720],
      [1200, 630],
      [1380, 720],
      [1660, 630],
      [1810, 720],
    ),
  },
  {
    id: 'slalom',
    area: 'furnace',
    name: 'Slalom',
    solids: [
      box(390, 630, 140, 110),
      box(720, 270, 200, 300),
      box(1040, 610, 160, 130),
      box(1350, 240, 190, 310),
      box(1630, 650, 130, 90),
      shelf(450, 390, 170),
    ],
    spawns: [
      runner(620),
      shooter(820, 270),
      shooter(1120, 610),
      shooter(1440, 240),
      runner(1280),
      runner(1700, 650),
      flyer(950, 360),
      flyer(1600, 390),
      runner(970),
      flyer(650, 245),
    ],
    route: route(
      [280, 720],
      [460, 610],
      [630, 720],
      [930, 720],
      [1120, 590],
      [1290, 720],
      [1545, 720],
      [1690, 630],
      [1820, 720],
    ),
  },
];
export const BOSS_LAYOUTS: Layout[] = [
  {
    id: 'twin-towers',
    area: 'rooftops',
    name: 'Twin towers',
    solids: [
      box(390, 650, 150, 90),
      box(540, 540, 190, 200),
      box(730, 650, 110, 90),
      shelf(880, 570, 240),
      box(1120, 650, 150, 90),
      box(1270, 540, 190, 200),
      box(1460, 650, 150, 90),
    ],
    spawns: [{ kind: 'boss', x: 1490, y: 285 }],
    route: route(
      [300, 720],
      [465, 630],
      [630, 520],
      [785, 630],
      [860, 720],
      [1190, 630],
      [1360, 520],
      [1530, 630],
      [1770, 720],
    ),
  },
  {
    id: 'last-crossing',
    area: 'rooftops',
    name: 'Last crossing',
    solids: [
      box(410, 650, 150, 90),
      shelf(560, 525, 260),
      box(1020, 650, 130, 90),
      shelf(1290, 525, 320),
      box(1610, 650, 140, 90),
    ],
    spawns: [{ kind: 'boss', x: 1470, y: 285 }],
    route: route(
      [300, 720],
      [485, 630],
      [760, 720],
      [1080, 630],
      [1350, 720],
      [1680, 630],
      [1820, 720],
    ),
  },
];
export function getLevel(seed: string, stage: number): Level {
  const pick = seeded(seed + ':layouts');
  const order = [
    ...sample(
      LAYOUTS.filter((layout) => layout.area === 'docks'),
      3,
      pick,
    ),
    ...sample(
      LAYOUTS.filter((layout) => layout.area === 'furnace'),
      3,
      pick,
    ),
    ...sample(
      LAYOUTS.filter((layout) => layout.area === 'rooftops'),
      2,
      pick,
    ),
  ];
  const source =
    stage === 8 ? BOSS_LAYOUTS[Math.floor(pick() * BOSS_LAYOUTS.length)] : order[stage];
  if (!source) throw new RangeError('Invalid stage');
  const rng = seeded(seed + ':layout-variant:' + stage);
  const mirrored = rng() > 0.5;
  const solids = source.solids.map((s) => ({ ...s, x: mirrored ? 2000 - s.x - s.w : s.x }));
  const count = [3, 4, 5, 6, 7, 8, 9, 10, 1][stage];
  const anchors = source.spawns
    .map((s) => ({ ...s, x: mirrored ? 2000 - s.x : s.x }))
    .filter((s) => s.kind === 'boss' || s.x >= 380);
  const spawns = sample(anchors, count, rng);
  // Introduce one new behavior at a time, using the same terrain-safe hull anchors.
  const introduce = (kind: EnemyKind, from: EnemyKind) => {
    let index = spawns.findIndex((s) => s.kind === from);
    if (index < 0) {
      const anchor = anchors.find(
        (s) => s.kind === from && !spawns.some((p) => p.x === s.x && p.y === s.y),
      );
      if (!anchor) return;
      index = spawns.findIndex((s) => ['runner', 'shooter', 'flyer'].includes(s.kind));
      if (index < 0) return;
      spawns[index] = { ...anchor };
    }
    spawns[index] = { ...spawns[index], kind };
  };
  if (stage >= 1 && stage < 8) introduce('charger', 'runner');
  if (stage >= 2 && stage < 8) introduce('sniper', 'shooter');
  if (stage >= 3 && stage < 8) introduce('hopper', 'runner');
  for (const spawn of spawns) {
    if (spawn.kind !== 'sniper') continue;
    const support = solids.find(
      (s) => Math.abs(s.y - spawn.y - 16) < 0.1 && spawn.x >= s.x && spawn.x <= s.x + s.w,
    );
    if (support && support.x + support.w - 19 >= 380) spawn.x = Math.max(380, support.x + 19);
  }
  const path = source.route.map((p) => ({ ...p, x: mirrored ? 2000 - p.x : p.x }));
  return {
    ...source,
    solids,
    spawns,
    route: mirrored ? path.reverse() : path,
    mirrored,
    boss: stage === 8,
  };
}
