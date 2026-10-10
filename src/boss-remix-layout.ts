import type { Game } from './game.ts';
import type { Layout, Level } from './levels.ts';
import { BOSS_REMIXES, bossRemixFor, type BossRemixId } from './boss-remix-rules.ts';

const vent = (x: number, offset: number, length = 620) => ({
  x,
  y: 738,
  dir: { x: 0, y: -1 },
  valve: { x: x - 64, y: 714 },
  width: 80,
  length,
  offset,
  overpressure: true as const,
});
const empty = { rosters: [[0]], weak: [], props: [] };
export const REMIX_LAYOUTS: Record<BossRemixId, Layout> = {
  'sorter-beltline': {
    id: 'sorter-beltline',
    area: 'reclamation',
    name: 'Beltline',
    solids: [
      { x: 480, y: 535, w: 240, h: 22 },
      { x: 940, y: 440, w: 210, h: 22 },
      { x: 1400, y: 535, w: 240, h: 22 },
    ],
    spawns: [{ kind: 'sorter', x: 1500, y: 280 }],
    route: [
      { x: 300, y: 720 },
      { x: 600, y: 515 },
      { x: 1000, y: 720 },
      { x: 1520, y: 515 },
      { x: 1810, y: 720 },
    ],
    hazards: [],
    setpiece: empty,
  },
  'sorter-magnetic-return': {
    id: 'sorter-magnetic-return',
    area: 'reclamation',
    name: 'Magnetic Return',
    solids: [
      { x: 420, y: 650, w: 120, h: 90 },
      { x: 920, y: 515, w: 200, h: 22 },
      { x: 1460, y: 650, w: 120, h: 90 },
    ],
    spawns: [{ kind: 'sorter', x: 1450, y: 270 }],
    route: [
      { x: 300, y: 720 },
      { x: 480, y: 630 },
      { x: 1000, y: 495 },
      { x: 1520, y: 630 },
      { x: 1810, y: 720 },
    ],
    magnets: [
      { x: 710, y: 310, floor: 740, offset: 0 },
      { x: 1300, y: 310, floor: 740, offset: 3.8 },
    ],
    hazards: [],
    setpiece: {
      rosters: [[0]],
      weak: [],
      props: [
        { kind: 'crate', x: 710, y: 718 },
        { kind: 'crate', x: 1300, y: 718 },
      ],
    },
  },
  'boss-skybridge': {
    id: 'boss-skybridge',
    area: 'rooftops',
    name: 'Skybridge',
    solids: [
      { x: 410, y: 450, w: 230, h: 22 },
      { x: 900, y: 330, w: 210, h: 22 },
      { x: 1390, y: 450, w: 230, h: 22 },
    ],
    spawns: [{ kind: 'boss', x: 1490, y: 240 }],
    route: [
      { x: 300, y: 720 },
      { x: 750, y: 610 },
      { x: 1000, y: 310 },
      { x: 1260, y: 610 },
      { x: 1810, y: 720 },
    ],
    hazards: [
      { kind: 'lift', x: 750, y: 650, w: 160, h: 18, travel: 240 },
      { kind: 'lift', x: 1260, y: 650, w: 160, h: 18, travel: 240 },
    ],
    setpiece: empty,
  },
  'boss-crossfire': {
    id: 'boss-crossfire',
    area: 'rooftops',
    name: 'Crossfire',
    solids: [
      { x: 400, y: 625, w: 180, h: 22 },
      { x: 740, y: 475, w: 180, h: 22 },
      { x: 1090, y: 625, w: 180, h: 22 },
      { x: 1430, y: 475, w: 180, h: 22 },
    ],
    spawns: [{ kind: 'boss', x: 1470, y: 270 }],
    route: [
      { x: 300, y: 720 },
      { x: 490, y: 605 },
      { x: 830, y: 455 },
      { x: 1180, y: 605 },
      { x: 1520, y: 455 },
      { x: 1810, y: 720 },
    ],
    hazards: [],
    setpiece: empty,
  },
  'loader-crossdock': {
    id: 'loader-crossdock',
    area: 'docks',
    name: 'Crossdock',
    solids: [
      { x: 480, y: 660, w: 110, h: 80 },
      { x: 970, y: 660, w: 110, h: 80 },
      { x: 1480, y: 660, w: 110, h: 80 },
      { x: 340, y: 405, w: 180, h: 22 },
      { x: 845, y: 430, w: 180, h: 22 },
      { x: 1370, y: 405, w: 180, h: 22 },
    ],
    spawns: [{ kind: 'loader', x: 1740, y: 705 }],
    route: [
      { x: 300, y: 720 },
      { x: 535, y: 640 },
      { x: 810, y: 720 },
      { x: 1025, y: 640 },
      { x: 1320, y: 720 },
      { x: 1535, y: 640 },
      { x: 1810, y: 720 },
    ],
    hazards: [],
    setpiece: {
      rosters: [[0]],
      weak: [0, 1, 2],
      props: [],
      cargo: [
        { x: 740, y: 465, anchorY: 110 },
        { x: 1220, y: 465, anchorY: 110 },
        { x: 1750, y: 465, anchorY: 110 },
      ],
    },
  },
  'loader-switchyard': {
    id: 'loader-switchyard',
    area: 'docks',
    name: 'Switchyard',
    solids: [
      { x: 440, y: 660, w: 130, h: 80 },
      { x: 1400, y: 660, w: 130, h: 80 },
      { x: 590, y: 430, w: 190, h: 22 },
      { x: 1210, y: 430, w: 190, h: 22 },
    ],
    spawns: [{ kind: 'loader', x: 1710, y: 705 }],
    route: [
      { x: 300, y: 720 },
      { x: 505, y: 640 },
      { x: 780, y: 720 },
      { x: 1000, y: 620 },
      { x: 1250, y: 720 },
      { x: 1465, y: 640 },
      { x: 1810, y: 720 },
    ],
    hazards: [{ kind: 'lift', x: 1000, y: 670, w: 170, h: 18, travel: 190 }],
    setpiece: {
      rosters: [[0]],
      weak: [0, 1],
      props: [],
      cargo: [
        { x: 860, y: 470, anchorY: 110 },
        { x: 1600, y: 470, anchorY: 110 },
      ],
    },
  },
  'press-split-die': {
    id: 'press-split-die',
    area: 'furnace',
    name: 'Split Die',
    solids: [
      { x: 390, y: 650, w: 140, h: 90 },
      { x: 900, y: 650, w: 180, h: 90 },
      { x: 1530, y: 650, w: 140, h: 90 },
      { x: 710, y: 470, w: 180, h: 22 },
      { x: 1110, y: 470, w: 180, h: 22 },
    ],
    spawns: [{ kind: 'press', x: 1340, y: 260 }],
    route: [
      { x: 300, y: 720 },
      { x: 460, y: 630 },
      { x: 650, y: 720 },
      { x: 990, y: 630 },
      { x: 1360, y: 720 },
      { x: 1600, y: 630 },
      { x: 1810, y: 720 },
    ],
    hazards: [],
    vents: [vent(650, 0), vent(1360, 3.6)],
    setpiece: empty,
  },
  'press-stamping-line': {
    id: 'press-stamping-line',
    area: 'furnace',
    name: 'Stamping Line',
    solids: [
      { x: 420, y: 625, w: 160, h: 22 },
      { x: 800, y: 560, w: 170, h: 22 },
      { x: 1170, y: 625, w: 160, h: 22 },
      { x: 1530, y: 560, w: 170, h: 22 },
    ],
    spawns: [{ kind: 'press', x: 1360, y: 260 }],
    route: [
      { x: 300, y: 720 },
      { x: 500, y: 605 },
      { x: 710, y: 720 },
      { x: 885, y: 540 },
      { x: 1050, y: 720 },
      { x: 1250, y: 605 },
      { x: 1440, y: 720 },
      { x: 1615, y: 540 },
      { x: 1810, y: 720 },
    ],
    hazards: [],
    vents: [vent(1040, 0)],
    setpiece: empty,
  },
  'condenser-cold-circuit': {
    id: 'condenser-cold-circuit',
    area: 'cooling',
    name: 'Cold Circuit',
    solids: [
      { x: 390, y: 655, w: 140, h: 85 },
      { x: 1100, y: 655, w: 140, h: 85 },
      { x: 1560, y: 650, w: 140, h: 90 },
      { x: 580, y: 450, w: 250, h: 22 },
      { x: 1250, y: 435, w: 230, h: 22 },
    ],
    spawns: [{ kind: 'condenser', x: 1450, y: 270 }],
    route: [
      { x: 300, y: 720 },
      { x: 460, y: 635 },
      { x: 700, y: 430 },
      { x: 900, y: 720 },
      { x: 1170, y: 635 },
      { x: 1365, y: 415 },
      { x: 1630, y: 630 },
      { x: 1810, y: 720 },
    ],
    coolant: [
      { x: 610, y: 731, w: 220, h: 9 },
      { x: 1290, y: 731, w: 200, h: 9 },
    ],
    hazards: [],
    vents: [vent(1000, 0)],
    setpiece: empty,
  },
  'condenser-purge-chamber': {
    id: 'condenser-purge-chamber',
    area: 'cooling',
    name: 'Purge Chamber',
    solids: [
      { x: 390, y: 645, w: 170, h: 95 },
      { x: 910, y: 545, w: 180, h: 22 },
      { x: 1440, y: 645, w: 170, h: 95 },
      { x: 600, y: 425, w: 190, h: 22 },
      { x: 1230, y: 425, w: 190, h: 22 },
    ],
    spawns: [{ kind: 'condenser', x: 1470, y: 270 }],
    route: [
      { x: 300, y: 720 },
      { x: 475, y: 625 },
      { x: 695, y: 405 },
      { x: 1000, y: 525 },
      { x: 1325, y: 405 },
      { x: 1525, y: 625 },
      { x: 1810, y: 720 },
    ],
    coolant: [
      { x: 600, y: 731, w: 300, h: 9 },
      { x: 1100, y: 731, w: 300, h: 9 },
    ],
    hazards: [],
    vents: [vent(850, 0), vent(1150, 3.6)],
    setpiece: empty,
  },
};
export function bossRemixLevel(g: Game, level: Level): Level {
  if (g.overtime || g.escape || g.detour || g.workshop.active || g.inAnnex || !level.boss)
    return level;
  const forced = g.practice?.remix ?? g.testRun?.bossRemix;
  const id =
    forced ??
    (g.bossRemixes && !g.practice && !g.testRun
      ? bossRemixFor(g.seed, level.spawns[0]?.kind)
      : undefined);
  if (!id || g.stage !== BOSS_REMIXES[id].stage) return level;
  const layout = structuredClone(REMIX_LAYOUTS[id]);
  // Uprising can substitute its pursuit rival. Keep that consequence while
  // giving it the same authored arena and its own warned arsenal sequence.
  if (g.stage === 19 && !forced && g.uprising.finale === 'hunted')
    layout.spawns[0].kind = 'interceptor';
  return { ...layout, boss: true, mirrored: false, bossRemix: id };
}
