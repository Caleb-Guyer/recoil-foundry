import type { Game } from './game.ts';
import type { Layout, Level, Solid } from './levels.ts';
import {
  RIVAL_SHIFT_BOSSES,
  isRivalShiftBoss,
  rivalShiftCampaign,
  type RivalShiftBoss,
} from './rival-shift-rules.ts';
const box = (x: number, y: number, w: number, h = 22): Solid => ({ x, y, w, h });
/** The clear floor, low steps and permanent upper decks remain usable in every phase. */
export const RIVAL_SHIFT_ARENAS: Record<RivalShiftBoss, Layout> = {
  turbine: {
    id: 'rival-shift-turbine',
    name: 'Crossflow galleries',
    area: 'cooling',
    solids: [
      box(400, 650, 160, 90),
      box(930, 625, 160, 115),
      box(1480, 650, 150, 90),
      box(590, 455, 240),
      box(1180, 430, 250),
    ],
    spawns: [{ kind: 'turbine', x: 1450, y: 250 }],
    route: [
      { x: 280, y: 720 },
      { x: 480, y: 630 },
      { x: 710, y: 435 },
      { x: 1010, y: 605 },
      { x: 1305, y: 410 },
      { x: 1555, y: 630 },
      { x: 1810, y: 720 },
    ],
    setpiece: {
      rosters: [[0]],
      weak: [],
      props: [
        { kind: 'cover', x: 290, y: 697 },
        { kind: 'crate', x: 830, y: 717 },
        { kind: 'cover', x: 1740, y: 697 },
      ],
    },
  },
  boss: {
    id: 'rival-shift-interceptor',
    name: 'Relay galleries',
    area: 'reclamation',
    solids: [
      box(470, 640, 150, 100),
      box(1370, 640, 150, 100),
      box(900, 520, 220),
      box(360, 440, 230),
      box(1410, 430, 230),
    ],
    spawns: [{ kind: 'boss', x: 1470, y: 260 }],
    route: [
      { x: 280, y: 720 },
      { x: 545, y: 620 },
      { x: 1010, y: 500 },
      { x: 1445, y: 620 },
      { x: 1810, y: 720 },
    ],
    setpiece: {
      rosters: [[0]],
      weak: [],
      props: [
        { kind: 'cover', x: 290, y: 697 },
        { kind: 'crate', x: 1130, y: 717 },
        { kind: 'cover', x: 1740, y: 697 },
      ],
    },
  },
};
export function rivalShiftLevel(g: Game, level: Level): Level {
  const kind = level.spawns[0]?.kind;
  if (
    !rivalShiftCampaign(g.seed) ||
    !level.boss ||
    level.bossRemix ||
    !isRivalShiftBoss(kind) ||
    g.stage !== RIVAL_SHIFT_BOSSES[kind].stage ||
    g.escape ||
    g.detour ||
    g.inAnnex ||
    g.workshop.active
  )
    return level;
  const plan = structuredClone(RIVAL_SHIFT_ARENAS[kind]),
    mirror = level.mirrored,
    x = (n: number) => (mirror ? 2000 - n : n);
  const boss = plan.spawns.map((s) => ({ ...s, x: x(s.x) }));
  // These are the native Overtime support machines, not replacement enemies.
  // Keep the complete roster; every reserved point clears both decks and boss hull.
  const air = [
    { x: 760, y: 250 },
    { x: 1000, y: 240 },
    { x: 1240, y: 250 },
  ];
  const supports = g.overtime ? level.spawns.filter((s) => s.kind !== kind) : [];
  const spawns = [
    ...boss,
    ...supports.map((s, i) => ({
      ...s,
      x: x(air[i]?.x ?? 440 + ((i - air.length) % 6) * 220),
      y: air[i]?.y ?? 140 - Math.floor((i - air.length) / 6) * 55,
    })),
  ];
  return {
    ...level,
    ...plan,
    boss: true,
    bossRemaster: kind,
    mirrored: mirror,
    solids: plan.solids.map((s) => ({ ...s, x: mirror ? 2000 - s.x - s.w : s.x })),
    spawns,
    route: plan.route.map((p) => ({ ...p, x: x(p.x) })).sort((a, b) => a.x - b.x),
    hazards: [],
    vents: [],
    coolant: [],
    magnets: [],
    fans: [],
    counterweights: [],
    setpiece: {
      ...plan.setpiece!,
      rosters: [spawns.map((_, i) => i)],
      props: plan.setpiece!.props.map((p) => ({ ...p, x: x(p.x) })),
      cargo: [],
    },
  };
}

/** Phase machinery starts through CrosswindSystem.reset, preserving its entire warning. */
export function rivalShiftFans(
  phase: number,
  mirror: boolean,
): import('./crosswind.ts').FanPlacement[] {
  return (phase <= 0 ? [] : phase === 1 ? [880] : [880, 1135]).map((x, i) => ({
    x: mirror ? 2000 - x : x,
    y: 738,
    dir: { x: 0, y: -1 },
    width: i === 0 ? 80 : 70,
    length: 500,
    offset: i * 1.8,
  }));
}
/** Belts are confined to clear floor strips; decks and exit approaches never move. */
export function rivalShiftBelts(
  phase: number,
  mirror: boolean,
): import('./conveyor-layout.ts').Conveyor[] {
  const speeds = phase <= 0 ? [1.1, -1.1] : phase === 1 ? [-1.4, 1.4] : [1.8, -1.8];
  return [650, 1150].map((x, i) => ({
    x: mirror ? 2000 - x - 200 : x,
    y: 740,
    w: 200,
    speed: speeds[i] * (mirror ? -1 : 1),
  }));
}
