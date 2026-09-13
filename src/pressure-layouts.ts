import type { Layout } from './levels.ts';
import type { Vec } from './rules.ts';
import { seeded } from './rules.ts';

// The nozzle sits two units outside a permanent floor or wall. The valve is
// mounted beside it in open space, where a normal shot can reach its wheel.
export interface PressurePlacement extends Vec {
  dir: Vec;
  valve: Vec;
  width: number;
  length: number;
  offset: number;
}
export const PRESSURE_LAYOUTS: Layout[] = [
  {
    id: 'pressure-chamber',
    name: 'Pressure Chamber',
    area: 'furnace',
    vents: [
      {
        x: 650,
        y: 738,
        dir: { x: 0, y: -1 },
        valve: { x: 590, y: 714 },
        width: 84,
        length: 420,
        offset: 0,
      },
      {
        x: 1210,
        y: 738,
        dir: { x: 0, y: -1 },
        valve: { x: 1150, y: 714 },
        width: 84,
        length: 440,
        offset: 1.7,
      },
    ],
    solids: [
      { x: 380, y: 640, w: 130, h: 100 },
      { x: 900, y: 625, w: 130, h: 115 },
      { x: 1490, y: 635, w: 130, h: 105 },
      { x: 755, y: 425, w: 190, h: 22 },
      { x: 1300, y: 395, w: 210, h: 22 },
    ],
    spawns: [
      { kind: 'shooter', x: 455, y: 624 },
      { kind: 'shooter', x: 990, y: 609 },
      { kind: 'shooter', x: 1560, y: 619 },
      { kind: 'runner', x: 740, y: 723 },
      { kind: 'runner', x: 1330, y: 723 },
      { kind: 'flyer', x: 780, y: 290 },
      { kind: 'flyer', x: 1350, y: 280 },
      { kind: 'shooter', x: 850, y: 409 },
      { kind: 'shooter', x: 1410, y: 379 },
      { kind: 'runner', x: 1110, y: 723 },
    ],
    route: [
      { x: 290, y: 720 },
      { x: 445, y: 620 },
      { x: 680, y: 720 },
      { x: 965, y: 605 },
      { x: 1210, y: 720 },
      { x: 1555, y: 615 },
      { x: 1820, y: 720 },
    ],
    setpiece: {
      rosters: [
        [0, 1, 2, 3, 4, 5, 6],
        [0, 1, 2, 3, 4, 7, 6],
        [0, 1, 2, 3, 9, 5, 8],
      ],
      props: [
        { kind: 'crate', x: 650, y: 717 },
        { kind: 'crate', x: 1230, y: 717 },
      ],
      weak: [3, 4],
    },
  },
  {
    id: 'pump-room',
    name: 'Pump Room',
    area: 'cooling',
    vents: [
      {
        x: 852,
        y: 606,
        dir: { x: 1, y: 0 },
        valve: { x: 866, y: 542 },
        width: 70,
        length: 420,
        offset: 0,
      },
      {
        x: 1528,
        y: 706,
        dir: { x: -1, y: 0 },
        valve: { x: 1514, y: 652 },
        width: 64,
        length: 410,
        offset: 1.7,
      },
    ],
    solids: [
      { x: 390, y: 650, w: 150, h: 90 },
      { x: 750, y: 560, w: 100, h: 180 },
      { x: 630, y: 650, w: 120, h: 90 },
      { x: 895, y: 645, w: 235, h: 22 },
      { x: 1230, y: 650, w: 140, h: 90 },
      { x: 1530, y: 625, w: 140, h: 115 },
      { x: 1070, y: 460, w: 230, h: 22 },
      { x: 1510, y: 380, w: 160, h: 22 },
    ],
    spawns: [
      { kind: 'shooter', x: 475, y: 634 },
      { kind: 'shooter', x: 800, y: 544 },
      { kind: 'shooter', x: 1110, y: 629 },
      { kind: 'shooter', x: 1300, y: 634 },
      { kind: 'shooter', x: 1620, y: 609 },
      { kind: 'runner', x: 1110, y: 723 },
      { kind: 'runner', x: 1500, y: 723 },
      { kind: 'flyer', x: 600, y: 360 },
      { kind: 'flyer', x: 1190, y: 285 },
      { kind: 'flyer', x: 1460, y: 430 },
      { kind: 'shooter', x: 1170, y: 444 },
      { kind: 'shooter', x: 1590, y: 364 },
    ],
    route: [
      { x: 285, y: 720 },
      { x: 465, y: 630 },
      { x: 690, y: 630 },
      { x: 800, y: 540 },
      { x: 990, y: 625 },
      { x: 1140, y: 720 },
      { x: 1300, y: 630 },
      { x: 1460, y: 720 },
      { x: 1600, y: 605 },
      { x: 1820, y: 720 },
    ],
    setpiece: {
      rosters: [
        [0, 1, 2, 3, 4, 5, 6, 7, 8],
        [0, 1, 2, 3, 4, 5, 6, 9, 10],
        [0, 1, 2, 3, 4, 5, 7, 8, 11],
      ],
      props: [
        { kind: 'crate', x: 1000, y: 622 },
        { kind: 'crate', x: 1410, y: 717 },
      ],
      weak: [6, 7],
    },
  },
];
export function pressureLayout(seed: string, stage: number) {
  if (![5, 9].includes(stage) || seeded(seed + ':pressure-room:' + stage)() >= 0.45) return;
  return PRESSURE_LAYOUTS[stage === 5 ? 0 : 1];
}
