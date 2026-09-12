import type { Layout, Solid, Spawn } from './levels.ts';
import { seeded } from './rules.ts';

const box = (x: number, y: number, w: number, h: number): Solid => ({ x, y, w, h });
const at = (kind: Spawn['kind'], x: number, y: number): Spawn => ({ kind, x, y });
const route = (...points: number[][]) => points.map(([x, y]) => ({ x, y }));

// Setpieces author the props and cargo together with their firing lanes.
// Each roster uses the same safe anchors, so mirrors and retries stay exact.
export const PHYSICS_LAYOUTS: Layout[] = [
  {
    id: 'cable-yard',
    name: 'Cable Yard',
    area: 'cooling',
    solids: [
      box(400, 650, 150, 90),
      box(760, 620, 150, 120),
      box(1150, 650, 150, 90),
      box(1540, 635, 150, 105),
      box(570, 470, 180, 22),
      box(990, 420, 160, 22),
      box(1350, 455, 190, 22),
    ],
    spawns: [
      at('runner', 620, 723),
      at('runner', 1050, 723),
      at('runner', 1440, 723),
      at('flyer', 680, 550),
      at('flyer', 1030, 530),
      at('flyer', 1450, 540),
      at('shooter', 475, 634),
      at('shooter', 835, 604),
      at('shooter', 1235, 634),
      at('shooter', 1620, 619),
      at('flyer', 620, 330),
      at('flyer', 1440, 290),
    ],
    route: route(
      [280, 720],
      [475, 630],
      [650, 720],
      [835, 600],
      [1040, 720],
      [1225, 630],
      [1410, 720],
      [1615, 615],
      [1810, 720],
    ),
    setpiece: {
      rosters: [
        [0, 1, 2, 3, 4, 5, 6, 7, 9],
        [0, 1, 2, 3, 4, 11, 6, 8, 9],
        [0, 1, 2, 10, 4, 5, 7, 8, 9],
      ],
      props: [
        { kind: 'crate', x: 345, y: 717 },
        { kind: 'canister', x: 1080, y: 400 },
      ],
      weak: [5],
    },
  },
  {
    id: 'demolition-lane',
    name: 'Demolition Lane',
    area: 'furnace',
    solids: [
      box(500, 630, 100, 110),
      box(940, 620, 100, 120),
      box(1380, 640, 120, 100),
      box(630, 430, 230, 22),
      box(1110, 410, 210, 22),
    ],
    spawns: [
      at('sapper', 1000, 604),
      at('shooter', 550, 614),
      at('shooter', 1440, 624),
      at('runner', 730, 723),
      at('runner', 1190, 723),
      at('flyer', 800, 300),
      at('flyer', 1230, 285),
      at('runner', 840, 723),
      at('runner', 1600, 723),
      at('shooter', 740, 414),
      at('flyer', 1600, 370),
    ],
    route: route(
      [300, 720],
      [550, 610],
      [750, 720],
      [990, 600],
      [1190, 720],
      [1440, 620],
      [1700, 720],
      [1820, 720],
    ),
    setpiece: {
      rosters: [
        [0, 1, 2, 3, 4, 5, 6],
        [0, 1, 2, 7, 8, 5, 6],
        [0, 1, 2, 3, 4, 9, 10],
      ],
      props: [
        { kind: 'canister', x: 435, y: 720 },
        { kind: 'canister', x: 1320, y: 720 },
        { kind: 'crate', x: 1110, y: 717 },
      ],
      weak: [0, 1, 2],
    },
  },
  {
    id: 'suspension-hall',
    name: 'Suspension Hall',
    area: 'rooftops',
    solids: [
      box(400, 640, 160, 100),
      box(530, 540, 160, 22),
      box(650, 425, 140, 22),
      box(800, 240, 160, 22),
      box(1200, 240, 160, 22),
      box(1450, 430, 220, 22),
      box(1370, 540, 140, 22),
      box(1540, 640, 160, 100),
    ],
    spawns: [
      at('shooter', 880, 724),
      at('shooter', 1280, 724),
      at('runner', 680, 723),
      at('runner', 1060, 723),
      at('runner', 1450, 723),
      at('flyer', 730, 300),
      at('flyer', 1090, 330),
      at('flyer', 1560, 290),
      at('shooter', 470, 624),
      at('shooter', 1610, 624),
      at('runner', 760, 723),
      at('runner', 1170, 723),
      at('flyer', 500, 340),
    ],
    route: route(
      [280, 720],
      [480, 620],
      [680, 720],
      [880, 720],
      [1060, 720],
      [1280, 720],
      [1450, 720],
      [1620, 620],
      [1810, 720],
    ),
    setpiece: {
      rosters: [
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        [0, 1, 10, 3, 4, 12, 6, 7, 8, 9],
        [0, 1, 2, 11, 4, 5, 6, 7, 8, 9],
      ],
      props: [{ kind: 'crate', x: 360, y: 717 }],
      cargo: [
        { x: 880, y: 430, anchorY: 262 },
        { x: 1280, y: 400, anchorY: 262 },
      ],
      weak: [],
    },
  },
];
export const PHYSICS_STAGES: Record<string, number> = {
  'cable-yard': 9,
  'demolition-lane': 5,
  'suspension-hall': 17,
};
export const physicsVariant = (seed: string, id: string) =>
  Math.floor(seeded(seed + ':physics-roster:' + id)() * 3);
export function physicsLayout(seed: string, stage: number) {
  const layout = PHYSICS_LAYOUTS.find((l) => PHYSICS_STAGES[l.id] === stage);
  return layout && seeded(seed + ':physics-room:' + stage)() < 0.35 ? layout : undefined;
}
