import type { Game } from './game.ts';
import type { Level, Solid } from './levels.ts';
import type { MagnetPlacement } from './reclamation-layouts.ts';
export type RemasteredBoss = 'condenser' | 'sorter';
export function bossRemasterCampaign(seed: unknown) {
  return typeof seed === 'string' && Number(/^RF-C(\d+)-/.exec(seed)?.[1]) >= 102;
}
const box = (x: number, y: number, w: number, h = 22): Solid => ({ x, y, w, h });
export function remasterPools(phase: number, mirror: boolean): Solid[] {
  const lanes =
    phase === 0
      ? [
          [600, 360],
          [1230, 260],
        ]
      : phase === 1
        ? [
            [280, 130],
            [820, 155],
            [1300, 150],
          ]
        : [
            [620, 340],
            [1170, 270],
          ];
  return lanes.map(([x, w]) => box(mirror ? 2000 - x - w : x, 731, w, 9));
}
export function remasterMagnets(phase: number, mirror: boolean): MagnetPlacement[] {
  const xs = phase === 0 ? [720] : phase === 1 ? [1280] : [720, 1280];
  return xs.map((x) => ({ x: mirror ? 2000 - x : x, y: 300, floor: 740, offset: 0 }));
}
export function bossRemasterLevel(g: Game, level: Level): Level {
  if (
    !bossRemasterCampaign(g.seed) ||
    !level.boss ||
    level.bossRemix ||
    g.overtime ||
    g.escape ||
    g.detour ||
    g.inAnnex ||
    g.workshop.active
  )
    return level;
  const kind =
    g.stage === 11 && level.spawns.some((s) => s.kind === 'condenser')
      ? 'condenser'
      : g.stage === 15 && level.spawns.some((s) => s.kind === 'sorter')
        ? 'sorter'
        : null;
  if (!kind) return level;
  const mirror = level.mirrored;
  const solids =
    kind === 'condenser'
      ? [
          box(420, 640, 180, 100),
          box(980, 640, 180, 100),
          box(1460, 640, 180, 100),
          box(600, 465, 250),
          box(1170, 435, 280),
        ]
      : [
          box(420, 620, 180, 120),
          box(1460, 620, 180, 120),
          box(890, 570, 220),
          box(380, 440, 210),
          box(1410, 430, 210),
        ];
  const props: NonNullable<Level['setpiece']>['props'] =
    kind === 'condenser'
      ? [
          { kind: 'cover', x: 320, y: 711 },
          { kind: 'crate', x: 1060, y: 617 },
          { kind: 'cover', x: 1730, y: 711 },
        ]
      : [
          { kind: 'crate', x: 720, y: 717 },
          { kind: 'crate', x: 1280, y: 717 },
          { kind: 'cover', x: 300, y: 711 },
          { kind: 'cover', x: 1740, y: 711 },
        ];
  return {
    ...level,
    id: `boss-remaster-${kind}`,
    bossRemaster: kind,
    solids: solids.map((s) => ({ ...s, x: mirror ? 2000 - s.x - s.w : s.x })),
    spawns: level.spawns
      .filter((s) => s.kind === kind)
      .map((s) => ({ ...s, x: mirror ? 530 : 1470, y: 270 })),
    route: [
      { x: 300, y: 720 },
      { x: 510, y: 620 },
      { x: 1000, y: 550 },
      { x: 1550, y: 620 },
      { x: 1810, y: 720 },
    ]
      .map((p) => ({ ...p, x: mirror ? 2000 - p.x : p.x }))
      .sort((a, b) => a.x - b.x),
    hazards: [],
    vents: [],
    fans: [],
    counterweights: [],
    coolant: kind === 'condenser' ? remasterPools(0, mirror) : [],
    magnets: kind === 'sorter' ? remasterMagnets(0, mirror) : [],
    setpiece: {
      rosters: [[0]],
      weak: [],
      props: props.map((p) => ({ ...p, x: mirror ? 2000 - p.x : p.x })),
    },
  };
}
