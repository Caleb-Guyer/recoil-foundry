import type { Level } from './levels.ts';
import {
  UPRISING_DISTRICTS,
  uprisingRoute,
  uprisingFinale,
  successfulUprising,
  type UprisingRun,
} from './uprising-model.ts';

export function uprisingLevel(base: Level, run: UprisingRun, stage: number): Level {
  const level = structuredClone(base);
  const choice = run.choices.find((id) => uprisingRoute(id).fork + 1 === stage);
  if (choice) {
    const route = uprisingRoute(choice);
    return {
      id: 'uprising-' + choice,
      name: UPRISING_DISTRICTS[route.district] + ' · ' + route.name,
      area: base.area,
      mirrored: false,
      boss: false,
      uprising: route.district,
      solids:
        route.district === 'railworks'
          ? [
              { x: 360, y: 620, w: 300, h: 28 },
              { x: 790, y: 620, w: 300, h: 28 },
              { x: 1220, y: 620, w: 300, h: 28 },
              { x: 1680, y: 520, w: 150, h: 22 },
            ]
          : [
              { x: 360, y: 590, w: 260, h: 24 },
              { x: 800, y: 510, w: 220, h: 24 },
              { x: 1180, y: 590, w: 260, h: 24 },
              { x: 1600, y: 480, w: 200, h: 24 },
            ],
      route: [
        { x: 260, y: 700 },
        { x: 700, y: 700 },
        { x: 1120, y: 700 },
        { x: 1520, y: 700 },
        { x: 1880, y: 700 },
      ],
      spawns: [
        { kind: 'shooter', x: 680, y: 724 },
        { kind: 'runner', x: 1200, y: 724 },
        { kind: 'flyer', x: 1420, y: 350 },
        ...(stage > 4
          ? [
              { kind: 'shooter' as const, x: 1540, y: 724 },
              { kind: 'flyer' as const, x: 600, y: 320 },
            ]
          : []),
      ],
      setpiece: {
        rosters: [[0, 1], [2], ...(stage > 4 ? [[3, 4]] : [])],
        props: [
          { kind: 'crate', x: 520, y: 597 },
          { kind: 'cover', x: 1550, y: 697 },
        ],
        weak: [],
      },
    };
  }
  if (successfulUprising(run, 'core-sabotage')) {
    level.hazards = [];
    level.vents = [];
    level.coolant = [];
    level.fans = [];
    level.conductors = [];
  }
  const pursuit = ['rail-heist', 'core-recovery', 'scrap-raid'].some((id) =>
    successfulUprising(run, id as never),
  );
  if (pursuit && !base.boss && stage > 1 && stage % 4 === 2 && !base.annex) {
    const sites = [420, 780, 1120, 1560].filter(
      (x) =>
        !level.solids.some(
          (s) => x > s.x - 35 && x < s.x + s.w + 35 && 260 > s.y - 35 && 260 < s.y + s.h + 35,
        ),
    );
    level.spawns.push(...sites.slice(0, 2).map((x) => ({ kind: 'flyer' as const, x, y: 260 })));
    delete level.setpiece; // The normal reinforcement planner owns this complete roster.
    level.name += ' · cargo pursuit';
  }
  if (stage === 19 && base.boss) {
    const finale = uprisingFinale(run);
    level.name = {
      isolated: 'Isolated control',
      hunted: 'Pursuit command',
      mutiny: 'Crew-held control',
      overloaded: 'Overloaded control',
    }[finale];
    level.uprising = 'core';
    level.hazards = [];
    level.vents = [];
    level.coolant = [];
    level.conductors = [];
    level.fans = [];
    level.counterweights = [];
    level.magnets = [];
    level.spawns = [
      {
        kind: finale === 'hunted' ? 'interceptor' : 'boss',
        x: 1400,
        y: finale === 'hunted' ? 660 : 700,
      },
    ];
    level.solids = [
      { x: 350, y: 590, w: 300, h: 24 },
      { x: 880, y: 460, w: 240, h: 24 },
      { x: 1400, y: 590, w: 280, h: 24 },
    ];
    level.route = [
      { x: 260, y: 700 },
      { x: 780, y: 700 },
      { x: 1180, y: 700 },
      { x: 1860, y: 700 },
    ];
    delete level.setpiece;
  }
  return level;
}
