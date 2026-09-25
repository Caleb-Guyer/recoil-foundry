import type { Level, Solid, Spawn } from './levels.ts';
import type { AnnexStation } from './annex-route.ts';
import type { Vec } from './rules.ts';

export type AnnexLayout = 'original' | 'alternate';
const shelf = (x: number, y: number, w: number): Solid => ({ x, y, w, h: 22 });
const block = (x: number, y: number, w: number): Solid => ({ x, y, w, h: 740 - y });
const spawn = (kind: Spawn['kind'], x: number, y: number): Spawn => ({ kind, x, y });
const path = (points: number[][]): Vec[] => points.map(([x, y]) => ({ x, y }));
interface Arrangement {
  id: string;
  name: string;
  solids: Solid[];
  spawns: Spawn[];
  route: Vec[];
  setpiece: NonNullable<Level['setpiece']>;
  annexStation: AnnexStation;
}

// Canonical left-to-right geometry. The route generator mirrors fixtures,
// props, spawns and navigation together, after choosing the arrangement.
export const ANNEX_ALTERNATES: Readonly<Record<number, Arrangement>> = {
  8: {
    id: 'annex-crossed-lines',
    name: 'Crossed Lines',
    solids: [
      block(350, 650, 150),
      shelf(530, 540, 280),
      shelf(840, 425, 240),
      shelf(1170, 540, 300),
      block(1540, 650, 140),
      shelf(1520, 405, 150),
    ],
    spawns: [
      spawn('shooter', 630, 523),
      spawn('runner', 820, 723),
      spawn('switchman', 1040, 722),
      spawn('flyer', 1170, 350),
      spawn('shooter', 1330, 523),
      spawn('runner', 1460, 723),
      spawn('shooter', 1600, 388),
      spawn('runner', 1600, 633),
    ],
    route: path([
      [270, 722],
      [425, 632],
      [665, 522],
      [920, 407],
      [1210, 522],
      [1610, 632],
      [1790, 722],
    ]),
    setpiece: {
      rosters: [],
      weak: [],
      props: [
        { kind: 'crate', x: 570, y: 717 },
        { kind: 'cover', x: 1395, y: 696 },
      ],
    },
    annexStation: {
      junction: { x: 920, y: 383 },
      port: { x: 1040, y: 285 },
      mount: 425,
      cable: 205,
      patrol: [860, 1140],
    },
  },
  9: {
    id: 'annex-broken-ladder',
    name: 'Broken Ladder',
    solids: [
      block(340, 650, 145),
      shelf(520, 530, 165),
      shelf(690, 410, 230),
      shelf(475, 290, 165),
      shelf(1040, 545, 165),
      shelf(1260, 445, 165),
      shelf(1460, 325, 180),
      shelf(1430, 535, 190),
      block(1640, 650, 150),
    ],
    spawns: [
      spawn('shooter', 600, 513),
      spawn('shooter', 765, 393),
      spawn('shooter', 555, 273),
      spawn('runner', 950, 723),
      spawn('flyer', 1040, 340),
      spawn('caller', 1340, 427),
      spawn('runner', 1490, 723),
      spawn('shooter', 1550, 308),
      spawn('runner', 1660, 633),
    ],
    route: path([
      [270, 722],
      [415, 632],
      [605, 512],
      [765, 392],
      [1110, 527],
      [1340, 427],
      [1530, 517],
      [1740, 632],
      [1830, 722],
    ]),
    setpiece: {
      rosters: [],
      weak: [],
      props: [
        { kind: 'crate', x: 890, y: 717 },
        { kind: 'cover', x: 1200, y: 696 },
      ],
    },
    annexStation: {
      junction: { x: 760, y: 368 },
      port: { x: 1100, y: 235 },
      mount: 410,
      cable: 160,
      patrol: [880, 1020],
    },
  },
  10: {
    id: 'annex-relay-stacks',
    name: 'Relay Stacks',
    solids: [
      block(380, 640, 130),
      shelf(570, 515, 175),
      block(800, 620, 145),
      shelf(805, 375, 160),
      shelf(1000, 490, 155),
      block(1205, 645, 145),
      shelf(1400, 525, 180),
      block(1630, 650, 110),
    ],
    spawns: [
      spawn('shooter', 645, 498),
      spawn('runner', 875, 603),
      spawn('caller', 880, 357),
      spawn('flyer', 1080, 300),
      spawn('shooter', 1075, 473),
      spawn('runner', 1270, 628),
      spawn('switchman', 1445, 722),
      spawn('shooter', 1530, 508),
      spawn('runner', 1660, 633),
      spawn('flyer', 1540, 380),
    ],
    route: path([
      [270, 722],
      [445, 622],
      [655, 497],
      [870, 357],
      [1075, 472],
      [1275, 627],
      [1490, 507],
      [1685, 632],
      [1805, 722],
    ]),
    setpiece: {
      rosters: [],
      weak: [],
      props: [
        { kind: 'cover', x: 735, y: 696 },
        { kind: 'crate', x: 1115, y: 717 },
      ],
    },
    annexStation: {
      junction: { x: 1460, y: 483 },
      port: { x: 1040, y: 245 },
      mount: 525,
      cable: 180,
      patrol: [1390, 1580],
    },
  },
};
