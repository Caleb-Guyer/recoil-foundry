import { addAngler } from './angler-layout.ts';
import { addWallcrawler } from './wallcrawler-layout.ts';
import type { Level, Solid, Spawn } from './levels.ts';
import type { RouteChoice } from './rules.ts';
import { areaIndex, isRouteStage, seeded, sample } from './rules.ts';
import { ENEMY_STATS } from './enemies.ts';
import { addHarpooner } from './harpooner-layout.ts';
import { addSapper } from './sapper-layout.ts';

const areas = ['docks', 'furnace', 'cooling', 'reclamation', 'rooftops'] as const;
const names = [
  ['Container alleys', 'Gantry walk'],
  ['Boiler tunnels', 'Flue bridges'],
  ['Intake channels', 'Cooling towers'],
  ['Compactor lanes', 'Sorting gantries'],
  ['Service trenches', 'Aerial crossing'],
];
// Each pair has its own footing. The last 240 units at both ends stay open;
// falling from a high route leaves a recoverable floor route beneath it.
const lowFooting = [
  [
    [380, 90, 140],
    [790, 110, 160],
    [1280, 80, 140],
    [1520, 100, 120],
  ],
  [
    [350, 110, 160],
    [720, 90, 130],
    [1100, 120, 160],
    [1510, 90, 140],
  ],
  [
    [390, 80, 140],
    [770, 120, 160],
    [1190, 100, 130],
    [1530, 120, 130],
  ],
  [
    [360, 120, 160],
    [740, 80, 130],
    [1120, 110, 160],
    [1490, 100, 150],
  ],
  [
    [380, 110, 140],
    [750, 130, 150],
    [1170, 90, 160],
    [1530, 120, 130],
  ],
];
const highFooting = [
  [
    [360, 80, 130],
    [550, 160, 120],
    [1130, 150, 150],
    [1500, 80, 140],
  ],
  [
    [360, 85, 120],
    [550, 175, 140],
    [1170, 170, 130],
    [1520, 85, 120],
  ],
  [
    [350, 80, 140],
    [550, 160, 140],
    [1190, 160, 130],
    [1510, 80, 140],
  ],
  [
    [360, 90, 130],
    [560, 185, 130],
    [1130, 170, 150],
    [1490, 80, 160],
  ],
  [
    [350, 90, 140],
    [560, 185, 120],
    [1190, 180, 140],
    [1520, 90, 130],
  ],
];
const box = (x: number, y: number, w: number, h: number): Solid => ({ x, y, w, h });

export function getRouteLevel(seed: string, stage: number, choice: RouteChoice): Level {
  if (!isRouteStage(stage)) throw new RangeError('No route room at this stage');
  const area = areaIndex(stage),
    high = choice === 'high';
  const footing = (high ? highFooting : lowFooting)[area].map(([x, h, w]) => box(x, 740 - h, w, h));
  const overhead = high
    ? [box(780 + area * 5, 465 - area * 12, 180, 22), box(1360, 435 - area * 10, 140, 22)]
    : [
        box(520, 470 - area * 6, 210, 24),
        box(945, 440 - area * 6, 155, 24),
        box(1290, 450 - area * 6, 180, 24),
      ];
  // High rooms keep the space below their isolated towers passable from either
  // side. Small side steps prevent a fallen player needing a particular upgrade.
  const recovery = high
    ? [
        box(footing[1].x + footing[1].w, 655, 110, 85),
        box(footing[2].x - 110, 655, 110, 85),
        box(footing[2].x + footing[2].w, 655, 110, 85),
      ]
    : [];
  const solids = [...footing, ...overhead, ...recovery];
  const spawns: Spawn[] = [];
  const at = (kind: Spawn['kind'], x: number, floor: number, elite?: Spawn['elite']) =>
    spawns.push({ kind, x, y: floor - ENEMY_STATS[kind].h / 2, ...(elite ? { elite } : {}) });
  // Ground anchors sit on the authored obstacles; aerial anchors stay above
  // every shelf. No enemy is relocated to an invented point at wave time.
  for (const [i, s] of footing.entries()) {
    const kind =
      i % 2 === 0
        ? area
          ? 'sniper'
          : 'shooter'
        : area >= 3
          ? 'borer'
          : area
            ? 'hopper'
            : 'charger';
    at(kind, s.x + s.w / 2, s.y);
  }
  const count = [6, 9, 11, 12, 12][area];
  if (high) {
    for (let i = 0; spawns.length < count; i++) {
      const kind =
        area >= 3 && i % 3 === 0 ? 'sifter' : area >= 2 && i % 2 === 0 ? 'skimmer' : 'flyer';
      spawns.push({ kind, x: 560 + (i % 4) * 310, y: i < 4 ? 240 : 330 });
    }
  } else {
    for (const s of overhead) {
      if (spawns.length >= count - 1) break;
      at(area ? 'sniper' : 'shooter', s.x + s.w / 2, s.y);
    }
    const gaps = footing.slice(0, -1).map((s, i) => (s.x + s.w + footing[i + 1].x) / 2);
    for (const [i, x] of gaps.entries()) {
      if (spawns.length >= count - 1) break;
      at(area >= 3 && i === 0 ? 'borer' : area ? 'hopper' : 'charger', x, 740);
    }
    for (let i = 0; spawns.length < count; i++)
      spawns.push({ kind: 'flyer', x: 660 + i * 360, y: 260 });
  }
  if (area) {
    if (high) {
      spawns[4].kind = 'flyer';
      spawns[4].elite = 'volatile';
    } else {
      spawns[1].kind = 'runner';
      spawns[1].y = footing[1].y - 17;
      spawns[1].elite = 'shielded';
    }
  }
  if (area >= 3) spawns[0].elite = 'twin';
  const mirrored = seeded(seed + ':route-layout:' + stage + ':' + choice)() < 0.5;
  const point = <T extends { x: number }>(p: T): T => ({ ...p, x: mirrored ? 2000 - p.x : p.x });
  const steps = [...footing, ...recovery].sort((a, b) => a.x - b.x);
  const route = [{ x: 270, y: 720 }];
  for (const [i, s] of steps.entries()) {
    if (i && s.x - steps[i - 1].x - steps[i - 1].w > 180)
      route.push({ x: (steps[i - 1].x + steps[i - 1].w + s.x) / 2, y: 720 });
    route.push({ x: s.x + s.w / 2, y: s.y - 20 });
  }
  route.push({ x: 1730, y: 720 });
  return addAngler(
    addWallcrawler(
      addSapper(
        {
          id: areas[area] + '-' + choice + '-road',
          name: names[area][high ? 1 : 0],
          area: areas[area],
          routeChoice: choice,
          boss: false,
          mirrored,
          solids: solids.map((s) => ({ ...s, x: mirrored ? 2000 - s.x - s.w : s.x })),
          spawns: spawns.map(point),
          route: (mirrored ? route.reverse() : route).map(point),
        },
        seed,
        stage,
      ),
      seed,
      stage,
    ),
    seed,
    stage,
  );
}

export function reinforceRoute(level: Level, seed: string, stage: number): Level {
  const spawns = level.spawns.map((s): Spawn => {
    if (s.elite) return { ...s };
    const kind =
      s.kind === 'charger' || s.kind === 'hopper'
        ? 'borer'
        : s.kind === 'flyer'
          ? 'skimmer'
          : s.kind;
    return { ...s, kind, y: s.y + (ENEMY_STATS[s.kind].h - ENEMY_STATS[kind].h) / 2 };
  });
  const eliteCount = stage >= 12 ? 3 : 2;
  for (const s of sample(
    spawns.filter(
      (s) => !s.elite && s.kind !== 'sapper' && s.kind !== 'wallcrawler' && s.kind !== 'angler',
    ),
    spawns.length,
    seeded(seed + ':route-elites:' + stage),
  )) {
    if (spawns.filter((s) => s.elite).length >= eliteCount) break;
    if (['flyer', 'skimmer', 'sifter'].includes(s.kind)) {
      s.kind = 'flyer';
      s.elite = 'volatile';
    } else if (s.kind === 'shooter' || s.kind === 'sniper') s.elite = 'twin';
    else {
      s.y += (ENEMY_STATS[s.kind].h - ENEMY_STATS.runner.h) / 2;
      s.kind = 'runner';
      s.elite = 'shielded';
    }
  }
  return addAngler(
    addWallcrawler(
      addSapper(addHarpooner({ ...level, spawns }, seed, stage, true), seed, stage, true),
      seed,
      stage,
      true,
    ),
    seed,
    stage,
    true,
  );
}
