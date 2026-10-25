import type { Spawn, Solid } from './levels.ts';
import type { Vec } from './rules.ts';
import type { UprisingRoom } from './uprising-rooms.ts';
import type { UprisingRouteId } from './uprising-model.ts';

export interface UprisingRemasterRoom extends UprisingRoom {
  /** A physical platform center; the attached objective keeps its offset. */
  convoy?: { solid: number; toX: number; duration: number };
  /** Each stop owns a separately supported generator. */
  defenseStops?: Vec[];
  /** Extraction is supported by this platform after its real drop finishes. */
  sabotageBridge?: { solid: number; drop: number };
  reinforcements: Spawn[][];
}
const shelf = (x: number, y: number, w: number): Solid => ({ x, y, w, h: 24 });
const crate = (x: number, y = 717) => ({ kind: 'crate' as const, x, y });
const cover = (x: number, y = 697) => ({ kind: 'cover' as const, x, y });
const ground = (kind: Spawn['kind'], x: number): Spawn => ({ kind, x, y: 724 });
const air = (kind: Spawn['kind'], x: number, y = 300): Spawn => ({ kind, x, y });
const pad = (x: number, floor: number, w = 180): Solid => ({ x, y: floor - 108, w, h: 108 });
const path = (...points: number[][]): Vec[] => points.map(([x, y]) => ({ x, y }));

/** Authored objective geometry; a continuous floor always offers missed-jump recovery. */
export const UPRISING_REMASTER_ROOMS: Record<UprisingRouteId, UprisingRemasterRoom> = {
  'rail-heist': {
    solids: [
      shelf(500, 600, 280),
      shelf(280, 650, 140),
      shelf(860, 420, 230),
      shelf(1350, 500, 260),
      shelf(1620, 630, 160),
    ],
    route: path(
      [260, 720],
      [350, 630],
      [640, 580],
      [970, 400],
      [1480, 480],
      [1700, 610],
      [1840, 720],
    ),
    spawns: [ground('shooter', 960), ground('runner', 1470), air('flyer', 1280)],
    props: [cover(1390)],
    objectives: [{ x: 640, y: 578 }],
    machines: [0],
    convoy: { solid: 0, toX: 1140, duration: 25 },
    evacuation: pad(1640, 630, 120),
    reinforcements: [
      [air('flyer', 380), ground('runner', 1550)],
      [ground('shooter', 1520), air('flyer', 1030, 250)],
      [ground('hopper', 1160), ground('shooter', 1730)],
    ],
  },
  'rail-escape': {
    solids: [
      shelf(350, 650, 230),
      shelf(680, 540, 230),
      shelf(1020, 430, 230),
      shelf(1340, 540, 230),
      shelf(1600, 640, 190),
    ],
    route: path(
      [260, 720],
      [465, 630],
      [795, 520],
      [1135, 410],
      [1455, 520],
      [1695, 620],
      [1840, 720],
    ),
    spawns: [ground('shooter', 1030), ground('hopper', 1330), air('flyer', 1500, 290)],
    props: [],
    objectives: [],
    switches: [
      { x: 470, y: 628 },
      { x: 1135, y: 408 },
      { x: 1450, y: 518 },
    ],
    evacuation: pad(1630, 640, 130),
    reinforcements: [
      [air('flyer', 380), ground('runner', 930)],
      [ground('shooter', 1520), air('skimmer', 1140, 280)],
      [ground('hopper', 1690)],
    ],
  },
  'rail-guard': {
    solids: [
      shelf(500, 600, 300),
      shelf(270, 650, 150),
      shelf(1580, 650, 150),
      shelf(490, 410, 230),
      shelf(1280, 410, 230),
    ],
    route: path(
      [250, 720],
      [345, 630],
      [650, 580],
      [1000, 720],
      [1390, 580],
      [1650, 630],
      [1840, 720],
    ),
    spawns: [ground('runner', 900), ground('shooter', 1520), air('flyer', 1220, 280)],
    props: [cover(1800)],
    objectives: [{ x: 650, y: 571 }],
    machines: [0],
    convoy: { solid: 0, toX: 1350, duration: 25 },
    defenseEntries: [
      { x: 380, y: 300 },
      { x: 1660, y: 300 },
    ],
    reinforcements: [
      [ground('runner', 430), air('flyer', 1660)],
      [ground('shooter', 1550), air('flyer', 450, 260)],
      [ground('hopper', 1600), ground('shooter', 410)],
    ],
  },
  'core-sabotage': {
    solids: [
      shelf(850, 370, 300),
      shelf(300, 650, 150),
      shelf(500, 520, 230),
      shelf(1330, 520, 230),
      shelf(1600, 650, 150),
    ],
    route: path(
      [250, 720],
      [375, 630],
      [615, 500],
      [1000, 600],
      [1445, 500],
      [1675, 630],
      [1840, 720],
    ),
    spawns: [
      ground('shooter', 780),
      ground('charger', 1270),
      air('skimmer', 1580, 300),
      air('flyer', 420, 300),
    ],
    props: [cover(1200)],
    objectives: [
      { x: 615, y: 498 },
      { x: 1445, y: 498 },
    ],
    machines: [0],
    sabotageBridge: { solid: 0, drop: 250 },
    evacuation: pad(920, 620, 160),
    reinforcements: [
      [air('skimmer', 410), ground('runner', 1580)],
      [ground('shooter', 1240), air('flyer', 740, 290)],
      [ground('hopper', 1560)],
    ],
  },
  'core-defense': {
    solids: [
      shelf(300, 650, 180),
      shelf(560, 500, 240),
      shelf(1200, 500, 240),
      shelf(1520, 650, 180),
    ],
    route: path(
      [250, 720],
      [390, 630],
      [680, 480],
      [1000, 720],
      [1320, 480],
      [1610, 630],
      [1840, 720],
    ),
    spawns: [
      ground('shooter', 900),
      ground('charger', 1510),
      air('skimmer', 1250, 280),
      air('flyer', 430, 270),
    ],
    props: [cover(850), cover(1150)],
    objectives: [{ x: 1000, y: 711 }],
    defenseStops: [{ x: 1000, y: 711 }],
    defenseEntries: [
      { x: 370, y: 300 },
      { x: 1650, y: 300 },
    ],
    reinforcements: [
      [ground('shooter', 370), air('skimmer', 1630)],
      [ground('hopper', 1570), air('flyer', 430, 270)],
      [ground('charger', 430), ground('shooter', 1640)],
    ],
  },
  'core-recovery': {
    solids: [
      shelf(300, 650, 190),
      shelf(590, 540, 240),
      shelf(1010, 640, 160),
      shelf(1260, 490, 290),
      shelf(1610, 630, 160),
    ],
    route: path(
      [250, 720],
      [395, 630],
      [710, 520],
      [1090, 620],
      [1405, 470],
      [1690, 610],
      [1840, 720],
    ),
    spawns: [
      ground('shooter', 920),
      ground('hopper', 1190),
      air('skimmer', 1620, 280),
      air('flyer', 450, 300),
    ],
    props: [crate(1120), cover(1660)],
    objectives: [{ x: 1405, y: 468 }],
    switches: [{ x: 710, y: 518 }],
    evacuation: pad(310, 650, 170),
    reinforcements: [
      [ground('charger', 1540), air('skimmer', 430, 300)],
      [ground('shooter', 1020), air('flyer', 1630, 250)],
      [ground('hopper', 430)],
    ],
  },
  'crew-relief': {
    solids: [
      shelf(410, 600, 280),
      shelf(810, 460, 240),
      shelf(1270, 600, 280),
      shelf(290, 660, 100),
      shelf(1590, 660, 110),
    ],
    route: path(
      [250, 720],
      [340, 640],
      [550, 580],
      [930, 440],
      [1410, 580],
      [1640, 640],
      [1840, 720],
    ),
    spawns: [
      ground('shooter', 780),
      ground('borer', 1160),
      air('sifter', 1530, 280),
      air('flyer', 420, 290),
    ],
    props: [cover(1000)],
    objectives: [
      { x: 550, y: 571 },
      { x: 1410, y: 571 },
    ],
    defenseStops: [
      { x: 550, y: 571 },
      { x: 1410, y: 571 },
    ],
    defenseEntries: [
      { x: 350, y: 300 },
      { x: 1680, y: 300 },
    ],
    reinforcements: [
      [ground('shooter', 1550), air('sifter', 380)],
      [ground('borer', 760), air('flyer', 1630, 260)],
      [ground('shooter', 420), air('skimmer', 1630)],
    ],
  },
  'scrap-raid': {
    solids: [
      shelf(330, 650, 170),
      shelf(600, 540, 220),
      shelf(1020, 510, 300),
      shelf(1490, 620, 270),
    ],
    route: path([250, 720], [415, 630], [710, 520], [1170, 490], [1625, 600], [1840, 720]),
    spawns: [
      ground('shooter', 880),
      ground('borer', 1390),
      air('sifter', 1630, 300),
      air('skimmer', 440, 300),
    ],
    props: [crate(930), cover(1450)],
    objectives: [{ x: 1170, y: 488 }],
    evacuation: pad(1550, 620, 170),
    reinforcements: [
      [air('sifter', 400), ground('charger', 1570)],
      [ground('shooter', 1520), air('skimmer', 740, 300)],
      [ground('borer', 430), ground('shooter', 1710)],
    ],
  },
  'signal-cut': {
    solids: [
      shelf(860, 350, 280),
      shelf(320, 650, 170),
      shelf(560, 510, 230),
      shelf(1280, 500, 270),
      shelf(1640, 640, 120),
    ],
    route: path(
      [250, 720],
      [405, 630],
      [675, 490],
      [1000, 580],
      [1415, 480],
      [1700, 620],
      [1840, 720],
    ),
    spawns: [
      ground('sniper', 850),
      ground('charger', 1230),
      air('sifter', 1630, 300),
      air('flyer', 420, 290),
    ],
    props: [cover(1180)],
    objectives: [
      { x: 675, y: 488 },
      { x: 1415, y: 478 },
    ],
    machines: [0],
    sabotageBridge: { solid: 0, drop: 250 },
    evacuation: pad(920, 600, 160),
    reinforcements: [
      [ground('shooter', 420), air('sifter', 1660)],
      [ground('hopper', 1520), air('flyer', 780, 270)],
      [ground('sniper', 1630)],
    ],
  },
  'roof-escape': {
    solids: [
      shelf(320, 650, 220),
      shelf(640, 540, 230),
      shelf(950, 630, 190),
      shelf(1130, 430, 250),
      shelf(1500, 560, 280),
    ],
    route: path(
      [250, 720],
      [430, 630],
      [755, 520],
      [1045, 610],
      [1255, 410],
      [1640, 540],
      [1840, 720],
    ),
    spawns: [
      ground('sniper', 920),
      ground('hopper', 1430),
      air('sifter', 1600, 280),
      air('flyer', 440, 300),
    ],
    props: [],
    objectives: [],
    switches: [
      { x: 755, y: 518 },
      { x: 1255, y: 408 },
      { x: 1045, y: 608 },
    ],
    evacuation: pad(1580, 560, 170),
    reinforcements: [
      [air('flyer', 380), ground('shooter', 1510)],
      [air('sifter', 1640), ground('charger', 800)],
      [ground('hopper', 1630)],
    ],
  },
  'roof-relief': {
    solids: [
      shelf(360, 650, 280),
      shelf(890, 550, 280),
      shelf(1410, 650, 280),
      shelf(650, 430, 170),
      shelf(1220, 430, 170),
    ],
    route: path(
      [250, 720],
      [500, 630],
      [735, 410],
      [1030, 530],
      [1305, 410],
      [1550, 630],
      [1840, 720],
    ),
    spawns: [
      ground('shooter', 780),
      ground('charger', 1260),
      air('sifter', 1650, 280),
      air('skimmer', 430, 300),
    ],
    props: [cover(850), cover(1210)],
    objectives: [
      { x: 500, y: 621 },
      { x: 1030, y: 521 },
      { x: 1550, y: 621 },
    ],
    defenseStops: [
      { x: 500, y: 621 },
      { x: 1030, y: 521 },
      { x: 1550, y: 621 },
    ],
    defenseEntries: [
      { x: 350, y: 300 },
      { x: 1660, y: 300 },
    ],
    reinforcements: [
      [ground('shooter', 1510), air('sifter', 380)],
      [ground('charger', 430), air('skimmer', 1640)],
      [ground('sniper', 430), air('flyer', 1630, 270)],
    ],
  },
};
