import type { Layout } from './levels.ts';
import { seeded } from './rules.ts';

// x/y locate the fixed axle. The complete sweep has clear space above and below.
export interface CounterweightPlacement {
  x: number;
  y: number;
  w: number;
}
export const COUNTERWEIGHT = { h: 20, angle: 0.32, speed: 0.018, mass: 2.5 };
export const COUNTERWEIGHT_LAYOUTS: Layout[] = [
  {
    id: 'balance-house',
    name: 'Balance House',
    area: 'cooling',
    counterweights: [{ x: 780, y: 585, w: 340 }],
    solids: [
      { x: 380, y: 640, w: 150, h: 100 },
      { x: 1080, y: 530, w: 180, h: 22 },
      { x: 1370, y: 420, w: 190, h: 22 },
      { x: 1530, y: 635, w: 150, h: 105 },
    ],
    spawns: [
      { kind: 'shooter', x: 875, y: 559 },
      { kind: 'runner', x: 620, y: 723 },
      { kind: 'runner', x: 1010, y: 723 },
      { kind: 'shooter', x: 1180, y: 514 },
      { kind: 'flyer', x: 980, y: 340 },
      { kind: 'flyer', x: 1420, y: 280 },
      { kind: 'shooter', x: 1590, y: 619 },
      { kind: 'runner', x: 1320, y: 723 },
      { kind: 'flyer', x: 570, y: 345 },
      { kind: 'runner', x: 1460, y: 723 },
    ],
    route: [
      { x: 280, y: 720 },
      { x: 450, y: 620 },
      { x: 1010, y: 720 },
      { x: 1350, y: 720 },
      { x: 1600, y: 615 },
      { x: 1810, y: 720 },
    ],
    setpiece: {
      rosters: [
        [0, 1, 2, 3, 4, 5, 6, 7, 8],
        [0, 1, 2, 3, 4, 5, 6, 8, 9],
        [0, 1, 2, 3, 4, 6, 7, 8, 9],
      ],
      props: [
        { kind: 'crate', x: 670, y: 552 },
        { kind: 'cover', x: 1480, y: 377 },
      ],
      weak: [2],
    },
  },
  {
    id: 'counterweight-roof',
    name: 'Counterweight Roof',
    area: 'rooftops',
    counterweights: [
      { x: 670, y: 575, w: 300 },
      { x: 1350, y: 475, w: 320 },
    ],
    solids: [
      { x: 320, y: 645, w: 140, h: 95 },
      { x: 900, y: 540, w: 180, h: 22 },
      { x: 1520, y: 625, w: 150, h: 115 },
      { x: 1620, y: 420, w: 140, h: 22 },
      { x: 1170, y: 635, w: 95, h: 22 },
    ],
    spawns: [
      { kind: 'shooter', x: 745, y: 549 },
      { kind: 'shooter', x: 1425, y: 449 },
      { kind: 'shooter', x: 990, y: 524 },
      { kind: 'shooter', x: 1550, y: 609 },
      { kind: 'runner', x: 855, y: 723 },
      { kind: 'runner', x: 1130, y: 723 },
      { kind: 'runner', x: 1460, y: 723 },
      { kind: 'flyer', x: 750, y: 300 },
      { kind: 'flyer', x: 1140, y: 285 },
      { kind: 'flyer', x: 1510, y: 265 },
      { kind: 'flyer', x: 500, y: 360 },
      { kind: 'runner', x: 500, y: 723 },
    ],
    route: [
      { x: 260, y: 720 },
      { x: 390, y: 625 },
      { x: 850, y: 720 },
      { x: 1130, y: 720 },
      { x: 1420, y: 720 },
      { x: 1590, y: 605 },
      { x: 1810, y: 720 },
    ],
    setpiece: {
      rosters: [
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        [0, 1, 2, 3, 4, 5, 7, 8, 9, 11],
        [0, 1, 2, 3, 4, 6, 7, 8, 10, 11],
      ],
      props: [
        { kind: 'crate', x: 570, y: 542 },
        { kind: 'cover', x: 1260, y: 422 },
        { kind: 'canister', x: 1620, y: 605 },
      ],
      weak: [],
    },
  },
];
export function counterweightLayout(seed: string, stage: number) {
  if (![9, 17].includes(stage) || seeded(seed + ':counterweights:' + stage)() >= 0.4) return;
  return COUNTERWEIGHT_LAYOUTS[stage === 9 ? 0 : 1];
}
