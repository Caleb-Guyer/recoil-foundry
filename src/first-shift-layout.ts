import type { Game } from './game.ts';
import type { Layout, Level, Solid } from './levels.ts';
import {
  FIRST_SHIFT_BOSSES,
  firstShiftCampaign,
  isFirstShiftBoss,
  type FirstShiftBoss,
} from './first-shift-rules.ts';
const box = (x: number, y: number, w: number, h = 22): Solid => ({ x, y, w, h });
const props = (...items: NonNullable<Layout['setpiece']>['props']) => items;
export const FIRST_SHIFT_ARENAS: Record<FirstShiftBoss, Layout> = {
  loader: {
    id: 'first-shift-loader',
    name: 'Cargo breach',
    area: 'docks',
    solids: [
      box(520, 660, 140, 80),
      box(1250, 660, 140, 80),
      box(850, 500, 250),
      box(360, 435, 240),
      box(1420, 435, 240),
      box(290, 635, 100),
      box(1640, 635, 110),
    ],
    spawns: [{ kind: 'loader', x: 1550, y: 706 }],
    route: [
      { x: 300, y: 615 },
      { x: 590, y: 640 },
      { x: 900, y: 480 },
      { x: 1320, y: 640 },
      { x: 1700, y: 615 },
      { x: 1810, y: 720 },
    ],
    setpiece: {
      rosters: [[0]],
      weak: [0, 1],
      props: props({ kind: 'crate', x: 410, y: 717 }, { kind: 'canister', x: 1750, y: 720 }),
      cargo: [
        { x: 730, y: 450, anchorY: 110 },
        { x: 1180, y: 450, anchorY: 110 },
      ],
    },
  },
  crane: {
    id: 'first-shift-crane',
    name: 'Hook gantry',
    area: 'docks',
    solids: [
      box(520, 640, 140, 100),
      box(1340, 640, 140, 100),
      box(380, 440, 260),
      box(1380, 440, 260),
      box(880, 520, 240),
    ],
    spawns: [{ kind: 'crane', x: 1470, y: 150 }],
    route: [
      { x: 300, y: 720 },
      { x: 590, y: 620 },
      { x: 1000, y: 500 },
      { x: 1410, y: 620 },
      { x: 1810, y: 720 },
    ],
    counterweights: [{ x: 1000, y: 650, w: 240 }],
    setpiece: {
      rosters: [[0]],
      weak: [],
      props: props({ kind: 'crate', x: 760, y: 717 }, { kind: 'cover', x: 1720, y: 697 }),
    },
  },
  press: {
    id: 'first-shift-press',
    name: 'Stamping galleries',
    area: 'furnace',
    solids: [
      box(360, 650, 100, 90),
      box(1540, 650, 100, 90),
      box(450, 550, 260),
      box(1220, 550, 260),
      box(460, 395, 180),
      box(1360, 395, 180),
    ],
    spawns: [{ kind: 'press', x: 1550, y: 260 }],
    route: [
      { x: 300, y: 720 },
      { x: 410, y: 630 },
      { x: 580, y: 530 },
      { x: 1000, y: 720 },
      { x: 1350, y: 530 },
      { x: 1590, y: 630 },
      { x: 1810, y: 720 },
    ],
    setpiece: {
      rosters: [[0]],
      weak: [],
      props: props(
        { kind: 'cover', x: 300, y: 697 },
        { kind: 'crate', x: 1070, y: 717 },
        { kind: 'cover', x: 1730, y: 697 },
      ),
    },
  },
  kiln: {
    id: 'first-shift-kiln',
    name: 'Cooling grates',
    area: 'furnace',
    solids: [
      box(430, 610, 200, 130),
      box(1370, 610, 200, 130),
      box(750, 455, 200),
      box(1070, 455, 200),
      box(280, 660, 100),
      box(1640, 660, 100),
    ],
    spawns: [{ kind: 'kiln', x: 1170, y: 698 }],
    route: [
      { x: 300, y: 640 },
      { x: 530, y: 590 },
      { x: 850, y: 435 },
      { x: 1150, y: 435 },
      { x: 1470, y: 590 },
      { x: 1690, y: 640 },
      { x: 1810, y: 720 },
    ],
    setpiece: {
      rosters: [[0]],
      weak: [],
      props: props(
        { kind: 'cover', x: 400, y: 697 },
        { kind: 'crate', x: 1000, y: 717 },
        { kind: 'cover', x: 1760, y: 697 },
      ),
    },
  },
};
export function firstShiftLevel(g: Game, level: Level): Level {
  const kind = level.spawns[0]?.kind;
  if (
    !firstShiftCampaign(g.seed) ||
    !level.boss ||
    level.bossRemix ||
    !isFirstShiftBoss(kind) ||
    g.stage !== FIRST_SHIFT_BOSSES[kind].stage ||
    g.escape ||
    g.detour ||
    g.inAnnex ||
    g.workshop.active
  )
    return level;
  const plan = structuredClone(FIRST_SHIFT_ARENAS[kind]),
    mirror = level.mirrored;
  const x = (n: number) => (mirror ? 2000 - n : n);
  const solids = plan.solids.map((s) => ({ ...s, x: mirror ? 2000 - s.x - s.w : s.x }));
  const boss = plan.spawns.map((s) => ({ ...s, x: x(s.x) }));
  // New Game+ retains its real support machines, placed in clear air over the new arena.
  const supports = g.overtime ? level.spawns.filter((s) => s.kind !== kind) : [];
  const air = [
    { x: 760, y: 280 },
    { x: 1000, y: 280 },
    { x: 1240, y: 280 },
  ];
  const spawns = [
    ...boss,
    ...supports.slice(0, 3).map((s, i) => ({ ...s, ...air[i], x: x(air[i].x) })),
  ];
  return {
    ...level,
    ...plan,
    boss: true,
    bossRemaster: kind,
    mirrored: mirror,
    solids,
    spawns,
    route: plan.route.map((p) => ({ ...p, x: x(p.x) })).sort((a, b) => a.x - b.x),
    hazards: [],
    vents: [],
    coolant: [],
    magnets: [],
    fans: [],
    counterweights: (plan.counterweights ?? []).map((c) => ({ ...c, x: x(c.x) })),
    setpiece: {
      ...plan.setpiece!,
      rosters: [spawns.map((_, i) => i)],
      props: plan.setpiece!.props.map((p) => ({ ...p, x: x(p.x) })),
      cargo: (plan.setpiece!.cargo ?? []).map((c) => ({ ...c, x: x(c.x) })),
    },
  };
}
