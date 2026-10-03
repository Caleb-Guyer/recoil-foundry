import type { Level, Solid, Spawn } from './levels.ts';
import type { Vec } from './rules.ts';
import type { UprisingRouteId } from './uprising-model.ts';

export interface UprisingRoom {
  solids: Solid[];
  route: Vec[];
  spawns: Spawn[];
  props: NonNullable<Level['setpiece']>['props'];
  objectives: Vec[];
  machines?: number[];
  switches?: Vec[];
  evacuation?: Solid;
  defenseEntries?: Vec[];
}
const shelf = (x: number, y: number, w: number): Solid => ({ x, y, w, h: 24 });
const patrol = (left: number, right: number, late = false): Spawn[] => [
  { kind: 'shooter', x: left, y: 724 },
  { kind: 'runner', x: right, y: 724 },
  { kind: 'flyer', x: 1420, y: 310 },
  ...(late
    ? [
        { kind: 'shooter' as const, x: 1620, y: 724 },
        { kind: 'flyer' as const, x: 430, y: 300 },
      ]
    : []),
];
const cover = (x: number, floor = 740) => ({ kind: 'cover' as const, x, y: floor - 43 });
const entries = [
  { x: 380, y: 330 },
  { x: 1640, y: 330 },
];

// Objective positions sit on authored supports. Moving-car indexes refer to
// solids, not the engine's incidental body order. Exits keep their own lane.
export const UPRISING_ROOMS: Record<UprisingRouteId, UprisingRoom> = {
  'rail-heist': {
    solids: [
      shelf(380, 620, 260),
      shelf(810, 620, 240),
      shelf(1220, 620, 220),
      shelf(1460, 520, 240),
      shelf(640, 520, 140),
      shelf(1090, 520, 140),
    ],
    route: [
      { x: 300, y: 720 },
      { x: 440, y: 600 },
      { x: 690, y: 500 },
      { x: 900, y: 600 },
      { x: 1140, y: 500 },
      { x: 1340, y: 600 },
      { x: 1560, y: 500 },
      { x: 1830, y: 720 },
    ],
    spawns: patrol(730, 1240),
    props: [cover(1170)],
    objectives: [{ x: 1580, y: 498 }],
    machines: [0, 1, 2],
  },
  'rail-escape': {
    solids: [
      shelf(300, 620, 260),
      shelf(770, 620, 260),
      shelf(1210, 620, 180),
      shelf(600, 520, 180),
      shelf(960, 540, 120),
      shelf(1090, 440, 220),
      shelf(1500, 620, 270),
    ],
    route: [
      { x: 260, y: 720 },
      { x: 420, y: 600 },
      { x: 680, y: 500 },
      { x: 870, y: 600 },
      { x: 1000, y: 520 },
      { x: 1200, y: 420 },
      { x: 1360, y: 600 },
      { x: 1650, y: 600 },
      { x: 1850, y: 720 },
    ],
    spawns: patrol(860, 1380),
    props: [],
    objectives: [],
    machines: [0, 1, 2],
    switches: [
      { x: 690, y: 498 },
      { x: 1200, y: 418 },
    ],
    evacuation: { x: 1570, y: 512, w: 170, h: 108 },
  },
  'rail-guard': {
    solids: [
      shelf(330, 600, 260),
      shelf(810, 560, 230),
      shelf(1330, 600, 250),
      shelf(660, 470, 160),
    ],
    route: [
      { x: 280, y: 720 },
      { x: 460, y: 580 },
      { x: 740, y: 450 },
      { x: 920, y: 540 },
      { x: 1180, y: 720 },
      { x: 1460, y: 580 },
      { x: 1850, y: 720 },
    ],
    spawns: patrol(680, 1410),
    props: [cover(850), cover(1250)],
    objectives: [{ x: 1050, y: 711 }],
    machines: [0, 1, 2],
    defenseEntries: entries,
  },
  'core-sabotage': {
    solids: [
      shelf(250, 590, 200),
      shelf(770, 570, 220),
      shelf(1100, 590, 200),
      shelf(1580, 560, 170),
      shelf(520, 530, 170),
      shelf(1340, 470, 180),
    ],
    route: [
      { x: 220, y: 720 },
      { x: 350, y: 570 },
      { x: 600, y: 510 },
      { x: 850, y: 550 },
      { x: 1200, y: 570 },
      { x: 1430, y: 450 },
      { x: 1660, y: 540 },
      { x: 1850, y: 720 },
    ],
    spawns: patrol(720, 1230, true),
    props: [cover(1010)],
    objectives: [
      { x: 610, y: 508 },
      { x: 1430, y: 448 },
    ],
    machines: [0, 1, 2, 3],
  },
  'core-defense': {
    solids: [
      shelf(330, 590, 240),
      shelf(740, 510, 180),
      shelf(1230, 590, 220),
      shelf(1620, 500, 160),
    ],
    route: [
      { x: 270, y: 720 },
      { x: 440, y: 570 },
      { x: 820, y: 490 },
      { x: 1000, y: 720 },
      { x: 1350, y: 570 },
      { x: 1690, y: 480 },
      { x: 1850, y: 720 },
    ],
    spawns: patrol(650, 1490, true),
    props: [cover(810), cover(1220)],
    objectives: [{ x: 1000, y: 711 }],
    machines: [0, 1, 2, 3],
    defenseEntries: entries,
  },
  'core-recovery': {
    solids: [
      shelf(330, 620, 220),
      shelf(740, 550, 230),
      shelf(1100, 600, 210),
      shelf(1510, 490, 240),
      shelf(1290, 500, 140),
    ],
    route: [
      { x: 270, y: 720 },
      { x: 440, y: 600 },
      { x: 850, y: 530 },
      { x: 1200, y: 580 },
      { x: 1350, y: 480 },
      { x: 1640, y: 470 },
      { x: 1850, y: 720 },
    ],
    spawns: patrol(640, 1190, true),
    props: [cover(1010)],
    objectives: [{ x: 1640, y: 468 }],
    machines: [0, 1, 2],
  },
  'crew-relief': {
    solids: [shelf(350, 580, 230), shelf(750, 460, 210), shelf(1330, 580, 250)],
    route: [
      { x: 290, y: 720 },
      { x: 470, y: 560 },
      { x: 850, y: 440 },
      { x: 1050, y: 720 },
      { x: 1460, y: 560 },
      { x: 1850, y: 720 },
    ],
    spawns: patrol(640, 1460, true),
    props: [cover(840), cover(1270)],
    objectives: [{ x: 1050, y: 711 }],
    defenseEntries: entries,
  },
  'scrap-raid': {
    solids: [
      shelf(330, 630, 230),
      shelf(680, 550, 210),
      shelf(1120, 530, 270),
      shelf(1550, 620, 200),
      { x: 920, y: 660, w: 100, h: 80 },
    ],
    route: [
      { x: 270, y: 720 },
      { x: 440, y: 610 },
      { x: 780, y: 530 },
      { x: 960, y: 640 },
      { x: 1250, y: 510 },
      { x: 1650, y: 600 },
      { x: 1850, y: 720 },
    ],
    spawns: patrol(620, 1450, true),
    props: [cover(1070)],
    objectives: [{ x: 1260, y: 508 }],
  },
  'signal-cut': {
    solids: [
      shelf(330, 630, 210),
      shelf(590, 530, 190),
      shelf(940, 600, 210),
      shelf(1300, 480, 230),
      shelf(1610, 590, 170),
    ],
    route: [
      { x: 270, y: 720 },
      { x: 440, y: 610 },
      { x: 680, y: 510 },
      { x: 1050, y: 580 },
      { x: 1410, y: 460 },
      { x: 1700, y: 570 },
      { x: 1850, y: 720 },
    ],
    spawns: patrol(840, 1540, true),
    props: [cover(1180)],
    objectives: [
      { x: 680, y: 508 },
      { x: 1420, y: 458 },
    ],
  },
  'roof-escape': {
    solids: [
      shelf(320, 630, 240),
      shelf(630, 530, 210),
      shelf(930, 600, 180),
      shelf(1170, 470, 180),
      shelf(1480, 450, 300),
    ],
    route: [
      { x: 270, y: 720 },
      { x: 440, y: 610 },
      { x: 730, y: 510 },
      { x: 1010, y: 580 },
      { x: 1260, y: 450 },
      { x: 1640, y: 430 },
      { x: 1850, y: 720 },
    ],
    spawns: patrol(880, 1420, true),
    props: [],
    objectives: [],
    switches: [
      { x: 740, y: 508 },
      { x: 1260, y: 448 },
    ],
    evacuation: { x: 1570, y: 342, w: 170, h: 108 },
  },
  'roof-relief': {
    solids: [
      shelf(330, 610, 230),
      shelf(730, 500, 190),
      shelf(1200, 570, 220),
      shelf(1590, 480, 190),
    ],
    route: [
      { x: 270, y: 720 },
      { x: 440, y: 590 },
      { x: 820, y: 480 },
      { x: 1050, y: 720 },
      { x: 1310, y: 550 },
      { x: 1690, y: 460 },
      { x: 1850, y: 720 },
    ],
    spawns: patrol(640, 1450, true),
    props: [cover(830), cover(1240)],
    objectives: [{ x: 1040, y: 711 }],
    defenseEntries: entries,
  },
};
