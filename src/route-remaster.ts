import type { Level, Solid, Spawn } from './levels.ts';
import { ENEMY_STATS } from './enemies.ts';
import type { RouteChoice, Vec } from './rules.ts';

export const ROUTE_REMASTERS = {
  'boiler-tunnels': {
    id: 'route-boiler-tunnels',
    name: 'Boiler tunnels',
    stage: 6,
    route: 'low',
    traits: ['Low cover', 'Valve vent'],
  },
  'flue-bridges': {
    id: 'route-flue-bridges',
    name: 'Flue bridges',
    stage: 6,
    route: 'high',
    traits: ['Raised decks', 'Cargo lift'],
  },
  'intake-channels': {
    id: 'route-intake-channels',
    name: 'Intake channels',
    stage: 10,
    route: 'low',
    traits: ['Low cover', 'Coolant pools'],
  },
  'cooling-towers': {
    id: 'route-cooling-towers',
    name: 'Cooling towers',
    stage: 10,
    route: 'high',
    traits: ['Upper decks', 'Lift fan'],
  },
} as const;
export type RouteRemasterId = keyof typeof ROUTE_REMASTERS;
export const ROUTE_REMASTER_IDS = Object.keys(ROUTE_REMASTERS) as RouteRemasterId[];
export function chooseRouteSeed(seed: string) {
  return (
    typeof seed === 'string' &&
    Number(/^RF-C(\d+)-/.exec(seed)?.[1] ?? 0) >= 101 &&
    !/^RF-C\d+-OT-/.test(seed)
  );
}
export function routeRemasterTraits(
  level: Pick<Level, 'id'>,
): readonly [string, string] | undefined {
  return Object.values(ROUTE_REMASTERS).find((room) => room.id === level.id)?.traits;
}
const box = (x: number, y: number, w: number, h = 22): Solid => ({ x, y, w, h });
const path = (...points: number[][]): Vec[] => points.map(([x, y]) => ({ x, y }));
const on = (kind: Spawn['kind'], x: number, floor = 740): Spawn => ({
  kind,
  x,
  y: floor - ENEMY_STATS[kind].h / 2,
});
const air = (kind: 'flyer' | 'skimmer', x: number, y: number): Spawn => ({ kind, x, y });
type Geometry = Pick<
  Level,
  'solids' | 'spawns' | 'route' | 'coolant' | 'vents' | 'fans' | 'hazards'
> & { props: NonNullable<Level['setpiece']>['props'] };
function geometry(id: RouteRemasterId): Geometry {
  if (id === 'boiler-tunnels')
    return {
      solids: [
        box(430, 650, 180, 90),
        box(1040, 650, 160, 90),
        box(1440, 650, 200, 90),
        box(430, 480, 420),
        box(1110, 460, 370),
        box(850, 370, 240),
      ],
      spawns: [
        on('shooter', 520, 650),
        on('runner', 830),
        on('shooter', 1550, 650),
        on('runner', 1320),
        on('shooter', 660, 480),
        on('shooter', 1130, 650),
        air('flyer', 780, 300),
      ],
      route: path(
        [280, 716],
        [520, 626],
        [790, 716],
        [1120, 626],
        [1320, 716],
        [1540, 626],
        [1810, 716],
      ),
      props: [
        { kind: 'crate', x: 330, y: 718 },
        { kind: 'cover', x: 970, y: 698 },
        { kind: 'canister', x: 1490, y: 631 },
      ],
      vents: [
        {
          x: 1260,
          y: 738,
          dir: { x: 0, y: -1 },
          valve: { x: 1218, y: 714 },
          width: 76,
          length: 300,
          offset: 2,
          overpressure: true,
        },
      ],
    };
  if (id === 'flue-bridges')
    return {
      solids: [
        box(380, 650, 160, 90),
        box(1480, 650, 160, 90),
        box(520, 515, 320),
        box(1180, 515, 300),
        box(900, 405, 250),
      ],
      spawns: [
        on('shooter', 675, 515),
        air('flyer', 1060, 280),
        on('shooter', 1340, 515),
        on('runner', 880),
        on('shooter', 1590, 650),
        air('flyer', 1550, 300),
        on('shooter', 1010, 405),
      ],
      route: path([280, 716], [460, 626], [850, 716], [1210, 716], [1560, 626], [1810, 716]),
      props: [
        { kind: 'crate', x: 330, y: 718 },
        { kind: 'cover', x: 850, y: 698 },
        { kind: 'canister', x: 1300, y: 496 },
      ],
      hazards: [{ kind: 'lift', x: 1025, y: 660, w: 125, h: 18, travel: 150 }],
    };
  if (id === 'intake-channels')
    return {
      solids: [
        box(420, 650, 170, 90),
        box(980, 650, 180, 90),
        box(1520, 650, 170, 90),
        box(600, 500, 320),
        box(1160, 470, 280),
      ],
      spawns: [
        on('shooter', 505, 650),
        on('runner', 790),
        on('shooter', 1310, 470),
        on('runner', 1080, 650),
        air('flyer', 1060, 290),
        on('shooter', 800, 500),
        on('runner', 1430),
        air('skimmer', 1650, 300),
      ],
      route: path(
        [280, 716],
        [505, 626],
        [790, 716],
        [1070, 626],
        [1340, 716],
        [1605, 626],
        [1810, 716],
      ),
      props: [
        { kind: 'crate', x: 335, y: 718 },
        { kind: 'cover', x: 1280, y: 698 },
        { kind: 'canister', x: 860, y: 481 },
      ],
      coolant: [box(650, 731, 280, 9), box(1200, 731, 280, 9)],
    };
  return {
    solids: [
      box(380, 650, 160, 90),
      box(1480, 650, 160, 90),
      box(560, 520, 300),
      box(1110, 440, 300),
      box(1430, 520, 240),
      box(905, 620, 120),
    ],
    spawns: [
      on('shooter', 710, 520),
      on('runner', 900),
      air('flyer', 1100, 280),
      on('runner', 1560, 650),
      on('shooter', 1230, 440),
      air('skimmer', 1660, 320),
      on('shooter', 1540, 520),
      on('runner', 1250),
    ],
    route: path([280, 716], [460, 626], [900, 716], [1240, 716], [1560, 626], [1810, 716]),
    props: [
      { kind: 'crate', x: 330, y: 718 },
      { kind: 'cover', x: 1360, y: 698 },
      { kind: 'canister', x: 670, y: 501 },
    ],
    fans: [{ x: 1040, y: 738, dir: { x: 0, y: -1 }, width: 110, length: 330, offset: 0 }],
  };
}

// This is the same authored level used by play and by destination previews.
// Every room keeps a recoverable floor path beneath its optional upper route.
export function routeRemasterRoom(
  stage: 6 | 10,
  choice: RouteChoice,
  mirrored = false,
  teamwork = false,
): Level {
  if ((stage !== 6 && stage !== 10) || !['low', 'high'].includes(choice))
    throw new RangeError('Unknown remastered route');
  const id = ROUTE_REMASTER_IDS.find(
    (key) => ROUTE_REMASTERS[key].stage === stage && ROUTE_REMASTERS[key].route === choice,
  )!;
  const room = ROUTE_REMASTERS[id],
    source = geometry(id);
  // Preserve the native zone support introduction with an authored clear pair.
  // The opt-in follows the run's saved teamwork rule; older/disabled rules keep
  // the ordinary three cohorts and never acquire a new support machine.
  if (teamwork) {
    const pair = {
      'boiler-tunnels': [4, 6],
      'flue-bridges': [2, 5],
      'intake-channels': [2, 4],
      'cooling-towers': [6, 5],
    }[id];
    const [index, partner] = pair;
    const old = source.spawns[index];
    const kind = stage === 6 ? 'repairer' : 'relay';
    source.spawns[index] = {
      kind,
      x: old.x,
      y: old.y + ENEMY_STATS[old.kind].h / 2 - ENEMY_STATS[kind].h / 2,
      teamwork: true,
    };
    source.spawns[partner] = { ...source.spawns[partner], teamwork: true };
  }
  const point = <T extends Vec>(p: T): T => ({ ...p, x: mirrored ? 2000 - p.x : p.x });
  const solid = (p: Solid): Solid => ({ ...p, x: mirrored ? 2000 - p.x - p.w : p.x });
  const direction = (v: Vec): Vec => ({ x: mirrored ? -v.x : v.x, y: v.y });
  const route = source.route.map(point);
  const groups =
    source.spawns.length === 7
      ? [
          [0, 1, 2],
          [3, 4],
          [5, 6],
        ]
      : [
          [0, 1, 2],
          [3, 4],
          [5, 6, 7],
        ];
  return {
    id: room.id,
    name: room.name,
    area: stage === 6 ? 'furnace' : 'cooling',
    routeChoice: choice,
    boss: false,
    mirrored,
    remastered: true,
    ...(teamwork
      ? { teamworkIntro: stage === 6 ? ('repairer' as const) : ('relay' as const) }
      : {}),
    solids: source.solids.map(solid),
    spawns: source.spawns.map(point),
    route: mirrored ? route.reverse() : route,
    setpiece: {
      rosters: [source.spawns.map((_, i) => i)],
      props: source.props.map(point),
      weak: [],
    },
    ...(!teamwork
      ? {
          combatFlow: {
            room: id,
            variant: 0 as const,
            beats: groups,
            rest: stage === 6 ? 1.45 : 1.3,
            deadline: 10,
            cap: 3,
            overlap: 0,
          },
        }
      : {}),
    ...(source.coolant ? { coolant: source.coolant.map(solid) } : {}),
    ...(source.vents
      ? {
          vents: source.vents.map((p) => ({
            ...point(p),
            dir: direction(p.dir),
            valve: point(p.valve),
          })),
        }
      : {}),
    ...(source.fans
      ? { fans: source.fans.map((p) => ({ ...point(p), dir: direction(p.dir) })) }
      : {}),
    // An explicit empty list prevents a generic hazard being added to the authored floor.
    hazards: source.hazards?.map(point) ?? [],
  };
}
export function remasterRouteLevel(
  base: Level,
  seed: string,
  stage: number,
  choice: RouteChoice,
  teamwork = false,
): Level {
  if (
    !chooseRouteSeed(seed) ||
    (stage !== 6 && stage !== 10) ||
    base.boss ||
    base.detour ||
    base.annex ||
    base.routeChoice !== choice
  )
    return base;
  return routeRemasterRoom(stage, choice, base.mirrored, teamwork);
}
