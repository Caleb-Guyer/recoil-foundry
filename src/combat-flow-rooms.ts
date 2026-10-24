import type { Game } from './game.ts';
import type { Level, Solid, Spawn } from './levels.ts';
import { seeded, type RouteChoice, type Vec } from './rules.ts';
import { combatFlowSeed, type CombatFlowSpec } from './combat-flow-rules.ts';

type Anchor = readonly [number, number];
type Props = NonNullable<Level['setpiece']>['props'];
interface Geometry {
  solids: Solid[];
  route: Vec[];
  anchors: Record<'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'buddy', Anchor>;
  air: readonly Anchor[];
  props: Props;
}
const box = (x: number, y: number, w: number, h = 22): Solid => ({ x, y, w, h });
const path = (...points: number[][]): Vec[] => points.map(([x, y]) => ({ x, y }));
const crate = (x: number): Props[number] => ({ kind: 'crate', x, y: 718 });
const cover = (x: number): Props[number] => ({ kind: 'cover', x, y: 698 });
const canister = (x: number, floor = 740): Props[number] => ({
  kind: 'canister',
  x,
  y: floor - 19,
});
const on = (kind: Spawn['kind'], [x, floor]: Anchor, teamwork = false): Spawn => ({
  kind,
  x,
  y:
    floor -
    (
      {
        runner: 16,
        shooter: 16,
        flyer: 19,
        shutter: 20,
        strider: 18,
        mortar: 18,
        repairer: 14,
        relay: 14,
      } as Partial<Record<Spawn['kind'], number>>
    )[kind]!,
  ...(teamwork ? { teamwork: true as const } : {}),
});
const air = (at: Anchor): Spawn => ({ kind: 'flyer', x: at[0], y: at[1] });

// These are existing Campaign room identities and their broad native routes.
// The encounter owns its props and spawn anchors together with the terrain.
export const COMBAT_FLOW_ROOMS = {
  overpass: {
    stage: 1,
    name: 'Overpass',
    area: 'docks',
    source: 'overpass',
    guide: 'Cross below the firing deck, then use recoil to change the angle on the upper patrol.',
  },
  switchyard: {
    stage: 2,
    name: 'Cargo switchyard',
    area: 'docks',
    source: 'cargo-switchyard',
    guide:
      'Cargo banks shelter the low route; the high crossing separates aerial and ground pressure.',
  },
  'warm-exchange': {
    stage: 5,
    name: 'Warm exchange',
    area: 'furnace',
    source: 'toolroom-warm-exchange',
    guide: 'Break a fuel or cover position before crossing the next firing line.',
  },
  'upper-return': {
    stage: 9,
    name: 'Upper return',
    area: 'cooling',
    source: 'toolroom-upper-return',
    guide:
      'Choose the support target or the patrol first, then use the clear floor to change heights.',
  },
  'inspection-lane': {
    stage: 13,
    name: 'Inspection lane',
    area: 'reclamation',
    source: 'toolroom-inspection-lane',
    guide: 'Cut down the relay or flank its firing partner while the other approach remains open.',
  },
  'scrap-bridge': {
    stage: 14,
    name: 'Scrap bridge',
    area: 'reclamation',
    source: 'toolroom-scrap-bridge',
    guide: 'Break the side barricade, use the sheltered floor, or recoil onto the higher crossing.',
  },
} as const satisfies Record<
  string,
  { stage: number; name: string; area: Level['area']; source: string; guide: string }
>;
export type CombatFlowRoom = keyof typeof COMBAT_FLOW_ROOMS;
export const COMBAT_FLOW_IDS = Object.keys(COMBAT_FLOW_ROOMS) as CombatFlowRoom[];
export const isCombatFlowRoom = (id: unknown): id is CombatFlowRoom =>
  typeof id === 'string' && Object.hasOwn(COMBAT_FLOW_ROOMS, id);

function geometry(id: CombatFlowRoom, route?: RouteChoice): Geometry {
  if (id === 'overpass')
    return {
      solids: [
        box(420, 650, 180, 90),
        box(880, 650, 150, 90),
        box(1420, 650, 180, 90),
        box(580, 510, 250),
        box(960, 450, 260),
        box(1350, 510, 250),
      ],
      route: path(
        [300, 716],
        [510, 626],
        [700, 716],
        [955, 626],
        [1170, 716],
        [1510, 626],
        [1800, 716],
      ),
      anchors: {
        a: [700, 740],
        b: [710, 510],
        c: [1150, 740],
        d: [1480, 510],
        e: [1700, 740],
        f: [1090, 450],
        buddy: [790, 510],
      },
      air: [
        [1080, 300],
        [780, 330],
        [1540, 300],
      ],
      props: [crate(365), cover(1250), canister(1320)],
    };
  if (id === 'switchyard')
    return route === 'high'
      ? {
          solids: [
            box(420, 650, 180, 90),
            box(1100, 650, 170, 90),
            box(1460, 650, 150, 90),
            box(600, 520, 300),
            box(1050, 420, 300),
            box(1420, 520, 220),
          ],
          route: path(
            [300, 716],
            [510, 626],
            [750, 716],
            [1185, 626],
            [1350, 716],
            [1535, 626],
            [1800, 716],
          ),
          anchors: {
            a: [750, 740],
            b: [730, 520],
            c: [1010, 740],
            d: [1500, 520],
            e: [1750, 740],
            f: [1180, 420],
            buddy: [820, 520],
          },
          air: [
            [1050, 280],
            [1550, 340],
            [800, 280],
          ],
          props: [crate(360), canister(950), cover(1750)],
        }
      : {
          solids: [
            box(420, 650, 180, 90),
            box(600, 545, 190, 195),
            box(1100, 650, 170, 90),
            box(1270, 545, 190, 195),
            box(1460, 650, 150, 90),
            box(800, 420, 240),
          ],
          route: path(
            [300, 716],
            [510, 626],
            [690, 521],
            [850, 716],
            [1010, 716],
            [1185, 626],
            [1360, 521],
            [1535, 626],
            [1800, 716],
          ),
          anchors: {
            a: [900, 740],
            b: [690, 545],
            c: [1010, 740],
            d: [1350, 545],
            e: [1700, 740],
            f: [920, 420],
            buddy: [760, 545],
          },
          air: [
            [1050, 280],
            [1550, 340],
            [800, 280],
          ],
          props: [crate(360), canister(1170, 650), cover(1750)],
        };
  if (id === 'warm-exchange')
    return {
      solids: [
        box(440, 650, 160, 90),
        box(920, 650, 150, 90),
        box(1480, 650, 160, 90),
        box(590, 510, 240),
        box(1120, 440, 250),
      ],
      route: path(
        [300, 716],
        [520, 626],
        [770, 716],
        [995, 626],
        [1240, 716],
        [1560, 626],
        [1810, 716],
      ),
      anchors: {
        a: [790, 740],
        b: [710, 510],
        c: [1190, 740],
        d: [1240, 440],
        e: [1750, 740],
        f: [1560, 650],
        buddy: [790, 510],
      },
      air: [
        [1000, 300],
        [1400, 310],
        [700, 320],
      ],
      props: [crate(365), cover(1390), canister(1670)],
    };
  if (id === 'upper-return')
    return {
      solids: [
        box(420, 650, 170, 90),
        box(920, 640, 170, 100),
        box(1480, 650, 170, 90),
        box(570, 505, 260),
        box(970, 415, 260),
        box(1370, 505, 260),
      ],
      route: path(
        [300, 716],
        [505, 626],
        [740, 716],
        [1005, 616],
        [1270, 716],
        [1565, 626],
        [1810, 716],
      ),
      anchors: {
        a: [740, 740],
        b: [705, 505],
        c: [1250, 740],
        d: [1500, 505],
        e: [1760, 740],
        f: [1095, 415],
        buddy: [790, 505],
      },
      air: [
        [940, 280],
        [1320, 300],
        [1700, 310],
      ],
      props: [crate(355), cover(1360), canister(1690)],
    };
  if (id === 'inspection-lane')
    return {
      solids: [
        box(400, 650, 160, 90),
        box(940, 650, 150, 90),
        box(1490, 650, 150, 90),
        box(630, 525, 300),
        box(1140, 550, 250),
      ],
      route: path(
        [300, 716],
        [480, 626],
        [740, 716],
        [1015, 626],
        [1260, 716],
        [1565, 626],
        [1810, 716],
      ),
      anchors: {
        a: [700, 740],
        b: [1265, 550],
        c: [1130, 740],
        d: [1565, 650],
        e: [1760, 740],
        f: [750, 525],
        buddy: [1175, 550],
      },
      air: [
        [900, 300],
        [1410, 350],
        [1690, 300],
      ],
      props: [crate(355), cover(845), canister(1670)],
    };
  return route === 'high'
    ? {
        solids: [
          box(420, 650, 150, 90),
          box(1510, 650, 150, 90),
          box(600, 490, 320),
          box(1050, 400, 320),
          box(1460, 500, 200),
        ],
        route: path(
          [300, 716],
          [495, 626],
          [740, 716],
          [1120, 716],
          [1380, 716],
          [1585, 626],
          [1820, 716],
        ),
        anchors: {
          a: [730, 740],
          b: [745, 490],
          c: [1220, 740],
          d: [1200, 400],
          e: [1780, 740],
          f: [1550, 500],
          buddy: [835, 490],
        },
        air: [
          [1020, 290],
          [1410, 300],
          [1700, 310],
        ],
        props: [crate(355), cover(960), canister(1690)],
      }
    : {
        solids: [
          box(430, 650, 150, 90),
          box(1510, 650, 150, 90),
          box(650, 525, 300),
          box(1120, 475, 300),
          box(980, 650, 130, 90),
        ],
        route: path(
          [300, 716],
          [505, 626],
          [740, 716],
          [1045, 626],
          [1290, 716],
          [1585, 626],
          [1820, 716],
        ),
        anchors: {
          a: [730, 740],
          b: [775, 525],
          c: [1250, 740],
          d: [1250, 475],
          e: [1780, 740],
          f: [1585, 650],
          buddy: [865, 525],
        },
        air: [
          [1020, 290],
          [1410, 300],
          [1700, 310],
        ],
        props: [cover(355), crate(900), canister(1690)],
      };
}

function rosters(id: CombatFlowRoom, g: Geometry, high: boolean): Spawn[][][] {
  const p = g.anchors,
    A = (kind: Spawn['kind'], anchor: keyof Geometry['anchors'], team = false) =>
      on(kind, p[anchor], team),
    F = (index: number) => air(g.air[index]);
  if (id === 'overpass')
    return [
      [[A('runner', 'a'), A('shooter', 'b')], [A('runner', 'c')], [F(0), A('runner', 'e')]],
      [[A('runner', 'a'), F(1)], [A('shooter', 'f')], [A('shooter', 'd'), A('runner', 'c')]],
      [[A('runner', 'a'), A('runner', 'c')], [A('shooter', 'b')], [F(2), A('shooter', 'd')]],
    ];
  if (id === 'switchyard')
    return [
      [
        [A('shooter', 'b'), A('runner', 'a')],
        [A('runner', 'c')],
        [A('shooter', 'd'), F(high ? 1 : 0)],
      ],
      [
        [A('runner', 'a'), F(0)],
        [A('shooter', 'f')],
        [A('shooter', 'd'), high ? F(2) : A('runner', 'e')],
      ],
      [[A('shooter', 'b'), A('shooter', 'd')], [A('runner', 'a')], [F(1), A('runner', 'c')]],
    ];
  if (id === 'warm-exchange')
    return [
      [
        [A('runner', 'a'), A('shooter', 'b')],
        [F(0), A('runner', 'c')],
        [A('shooter', 'd'), A('runner', 'e')],
      ],
      [
        [A('shooter', 'b'), F(0)],
        [A('runner', 'a'), A('runner', 'c')],
        [A('shooter', 'd'), A('shooter', 'f')],
      ],
      [
        [A('runner', 'a'), A('runner', 'c')],
        [A('shooter', 'b'), F(1)],
        [A('shooter', 'd'), A('runner', 'e')],
      ],
    ];
  if (id === 'upper-return')
    return [
      [
        [A('runner', 'a'), A('shooter', 'b')],
        [A('runner', 'c'), F(0)],
        [A('shutter', 'd'), A('runner', 'e')],
      ],
      [
        [A('repairer', 'b', true), A('shooter', 'buddy', true)],
        [A('runner', 'c'), F(1)],
        [A('shooter', 'd'), A('runner', 'e')],
      ],
      [
        [A('shooter', 'b'), F(0)],
        [A('runner', 'a'), A('runner', 'c')],
        [A('shutter', 'd'), A('shooter', 'f'), A('runner', 'e')],
      ],
    ];
  if (id === 'inspection-lane')
    return [
      [
        [A('relay', 'b', true), A('shooter', 'buddy', true)],
        [A('runner', 'a'), F(0)],
        [A('strider', 'd'), A('runner', 'e')],
      ],
      [
        [A('shutter', 'f'), A('runner', 'a')],
        [A('shooter', 'b'), F(1)],
        [A('runner', 'c'), A('strider', 'd'), A('runner', 'e')],
      ],
      [
        [A('shooter', 'f'), A('runner', 'a')],
        [A('repairer', 'b', true), A('shooter', 'buddy', true)],
        [A('strider', 'd'), A('runner', 'e')],
      ],
    ];
  return [
    [
      [A('shutter', 'b'), A('runner', 'a')],
      [A('shooter', 'd'), high ? F(1) : A('runner', 'c')],
      [A('mortar', 'e'), A('runner', 'f')],
    ],
    [
      [A('relay', 'b', true), A('shooter', 'buddy', true)],
      [high ? F(0) : A('runner', 'a'), A('runner', 'c')],
      [A('strider', 'f'), A('runner', 'e')],
    ],
    [
      [A('shooter', 'b'), high ? F(0) : A('runner', 'a')],
      [A('shooter', 'd'), F(1)],
      [A('mortar', 'e'), A('runner', 'c'), A('runner', 'f')],
    ],
  ];
}

export function combatFlowRoomLevel(
  id: CombatFlowRoom,
  variant: 0 | 1 | 2 = 0,
  mirror = false,
  route?: RouteChoice,
): Level {
  const room = COMBAT_FLOW_ROOMS[id],
    geo = geometry(id, route),
    groups = rosters(id, geo, route === 'high')[variant];
  const point = <T extends Vec>(p: T): T => ({ ...p, x: mirror ? 2000 - p.x : p.x });
  const beats: number[][] = [];
  let at = 0;
  for (const group of groups) beats.push(group.map(() => at++));
  const spec: CombatFlowSpec = {
    room: id,
    variant,
    beats,
    rest: room.stage < 4 ? 1 : 1.2,
    deadline: room.stage < 4 ? 10 : 9,
    cap: room.stage < 4 ? 3 : 4,
    overlap: 0,
  };
  const spawns = groups.flat().map(point),
    routePath = geo.route.map(point);
  return {
    id: 'combat-flow-' + id,
    name: room.name + (route ? (route === 'high' ? ' · High route' : ' · Low route') : ''),
    area: room.area,
    boss: false,
    mirrored: mirror,
    remastered: true,
    ...(route ? { routeChoice: route } : {}),
    combatFlow: spec,
    solids: geo.solids.map((s) => ({ ...s, x: mirror ? 2000 - s.x - s.w : s.x })),
    spawns,
    route: mirror ? routePath.reverse() : routePath,
    setpiece: { rosters: [spawns.map((_, i) => i)], weak: [], props: geo.props.map(point) },
  };
}

export function combatFlowPreviewSeed(
  seed: string,
): { room: CombatFlowRoom; variant: 0 | 1 | 2; mirror: boolean; route?: RouteChoice } | null {
  const match = /^RF-C99-FLOW-([a-z-]+)-([123])-([MN])-(NONE|LOW|HIGH)$/.exec(seed);
  if (!match || !isCombatFlowRoom(match[1])) return null;
  const room = match[1],
    route = match[4] === 'NONE' ? undefined : (match[4].toLowerCase() as RouteChoice);
  if (route && !['switchyard', 'scrap-bridge'].includes(room)) return null;
  return {
    room,
    variant: (Number(match[2]) - 1) as 0 | 1 | 2,
    mirror: match[3] === 'M',
    ...(route ? { route } : {}),
  };
}

function reserved(g: Game, level: Level) {
  return (
    g.overtime ||
    g.practice ||
    g.workshop.active ||
    g.detour ||
    g.escape ||
    g.inAnnex ||
    g.security ||
    level.boss ||
    level.detour ||
    level.hunt ||
    level.security ||
    level.annex ||
    level.uprising ||
    level.story ||
    level.shutdown ||
    level.courier ||
    level.floodgate ||
    level.sortingPit !== undefined ||
    level.freight ||
    level.crossing ||
    level.machineIntro ||
    level.teamworkIntro ||
    level.remasterIntro ||
    level.fabricatorIntro ||
    level.anglerIntro ||
    level.crawlerIntro ||
    level.harpoonIntro ||
    level.sapperIntro ||
    level.maintenance ||
    level.recoilTrial ||
    g.areaEvents.encounter
  );
}
export function combatFlowLevel(g: Game, base: Level): Level {
  const forced = g.testRun ? combatFlowPreviewSeed(g.seed) : null;
  if (
    forced &&
    g.stage === COMBAT_FLOW_ROOMS[forced.room].stage &&
    !g.practice &&
    !g.workshop.active &&
    !g.overtime &&
    !g.escape &&
    !g.detour
  )
    return combatFlowRoomLevel(forced.room, forced.variant, forced.mirror, forced.route);
  if (g.testRun || !combatFlowSeed(g.seed) || g.encounters !== 1 || reserved(g, base)) return base;
  const id = COMBAT_FLOW_IDS.find((key) => COMBAT_FLOW_ROOMS[key].stage === g.stage);
  if (!id) return base;
  const route = g.route ?? base.routeChoice;
  if (route && !['switchyard', 'scrap-bridge'].includes(id)) return base;
  const variant = Math.floor(seeded(g.roomSeed + ':combat-flow-v1:' + id)() * 3) as 0 | 1 | 2;
  return combatFlowRoomLevel(id, variant, base.mirrored, route ?? undefined);
}
