import type { Layout, Level, Solid, Spawn } from './levels.ts';
import type { Game } from './game.ts';
import type { Vec } from './rules.ts';
import { isStartingGun } from './starting-guns.ts';
import type { Checkpoint } from './rules.ts';
import { BRANCH_TEST_BUILDS } from './branch-builds.ts';

const box = (x: number, y: number, w: number, h = 22): Solid => ({ x, y, w, h });
const at = (kind: Spawn['kind'], x: number, floor = 740): Spawn => ({
  kind,
  x,
  y:
    floor -
    (kind === 'shutter'
      ? 20
      : kind === 'strider' || kind === 'mortar'
        ? 18
        : kind === 'runner'
          ? 17
          : 16),
});
const air = (x: number, y: number): Spawn => ({ kind: 'flyer', x, y });
const route = (...points: number[][]): Vec[] => points.map(([x, y]) => ({ x, y }));
const crate = (x: number, floor = 740) => ({ kind: 'crate' as const, x, y: floor - 23 });
const cover = (x: number, floor = 740) => ({ kind: 'cover' as const, x, y: floor - 43 });

// Real floor routes remain possible with an unmodified pistol and ordinary jumps.
// Broad optional upper decks offer different sight lines, not mandatory upgrades.
export const ROOM_REMASTERS = {
  overpass: {
    source: 'overpass',
    name: 'Overpass',
    area: 'docks',
    stage: 1,
    guide:
      'Launch from the low loading step to the overhead deck, or cross below and use the wide gaps to change sides.',
    solids: [
      box(420, 650, 180, 90),
      box(880, 650, 150, 90),
      box(1420, 650, 180, 90),
      box(580, 510, 250),
      box(960, 450, 260),
      box(1350, 510, 250),
    ],
    spawns: [
      at('runner', 700),
      at('shooter', 710, 510),
      at('runner', 1150),
      at('shooter', 1480, 510),
      air(1080, 300),
      at('runner', 1700),
      air(780, 330),
      at('shooter', 1540, 650),
    ],
    route: route(
      [300, 716],
      [510, 626],
      [700, 716],
      [955, 626],
      [1170, 716],
      [1510, 626],
      [1800, 716],
    ),
    props: [crate(365), crate(1270)],
  },
  switchyard: {
    source: 'cargo-switchyard',
    name: 'Cargo switchyard',
    area: 'docks',
    stage: 2,
    guide:
      'Two stepped cargo banks lead to separate firing decks. Recoil across the open center, or drop to the clear return lane.',
    solids: [
      box(420, 650, 180, 90),
      box(600, 545, 190, 195),
      box(1100, 650, 170, 90),
      box(1270, 545, 190, 195),
      box(1460, 650, 150, 90),
      box(800, 420, 240),
    ],
    spawns: [
      at('shooter', 690, 545),
      at('runner', 900),
      at('shooter', 1350, 545),
      at('runner', 1660),
      air(1050, 280),
      at('runner', 1010),
      air(1550, 340),
      at('shooter', 1540, 650),
    ],
    route: route(
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
    props: [crate(360), crate(1730)],
  },
  exchange: {
    source: 'toolroom-warm-exchange',
    name: 'Warm exchange',
    area: 'furnace',
    stage: 6,
    guide:
      'Low steps lead into offset heat-exchange decks. Break the lower patrol line, then launch past the guard to attack from above.',
    solids: [
      box(440, 650, 160, 90),
      box(920, 650, 150, 90),
      box(1480, 650, 160, 90),
      box(590, 510, 240),
      box(1120, 440, 250),
    ],
    spawns: [
      at('shutter', 710, 510),
      at('runner', 790),
      air(1000, 300),
      at('shooter', 1240, 440),
      at('strider', 1560, 650),
      at('runner', 1750),
    ],
    route: route(
      [300, 716],
      [520, 626],
      [770, 716],
      [995, 626],
      [1240, 716],
      [1560, 626],
      [1810, 716],
    ),
    props: [crate(365), cover(1390)],
  },
  'upper-return': {
    source: 'toolroom-upper-return',
    name: 'Upper return',
    area: 'cooling',
    stage: 10,
    guide:
      'The upper return decks connect three patrol groups. Their gaps let you drop out of a locked line and launch back from the lower steps.',
    solids: [
      box(420, 650, 170, 90),
      box(920, 640, 170, 100),
      box(1480, 650, 170, 90),
      box(570, 505, 260),
      box(970, 415, 260),
      box(1370, 505, 260),
    ],
    spawns: [
      at('shutter', 705, 505),
      at('shooter', 780, 505),
      air(940, 280),
      at('runner', 1095, 415),
      at('strider', 1500, 505),
      at('runner', 1760),
    ],
    route: route(
      [300, 716],
      [505, 626],
      [740, 716],
      [1005, 616],
      [1270, 716],
      [1565, 626],
      [1810, 716],
    ),
    props: [crate(355), cover(1300)],
  },
  'scrap-bridge': {
    source: 'toolroom-scrap-bridge',
    name: 'Scrap bridge',
    area: 'reclamation',
    stage: 14,
    guide:
      'A broken bridge leaves a wide ground escape beneath its two decks. Salvage the side barricades, then choose which height to cross on.',
    solids: [
      box(430, 650, 150, 90),
      box(1510, 650, 150, 90),
      box(650, 525, 300),
      box(1120, 475, 300),
      box(980, 650, 130, 90),
    ],
    spawns: [
      at('shutter', 535, 650),
      at('runner', 775, 525),
      at('strider', 875, 525),
      at('shooter', 1250, 475),
      at('mortar', 1740),
    ],
    route: route(
      [300, 716],
      [505, 626],
      [740, 716],
      [1045, 626],
      [1290, 716],
      [1585, 626],
      [1820, 716],
    ),
    props: [cover(355), cover(900), cover(1450), crate(1685)],
  },
  'roof-braces': {
    source: 'toolroom-roof-braces',
    name: 'Roof braces',
    area: 'rooftops',
    stage: 18,
    guide:
      'Recoil between broad roof decks with open gaps beneath. Low brace steps offer a recovery route when you lose height.',
    solids: [
      box(420, 650, 170, 90),
      box(930, 650, 160, 90),
      box(1480, 650, 170, 90),
      box(570, 505, 270),
      box(1010, 395, 280),
      box(1430, 505, 280),
    ],
    spawns: [
      at('shutter', 505, 650),
      at('shooter', 705, 505),
      at('runner', 1145, 395),
      at('strider', 1570, 505),
      at('mortar', 1770),
    ],
    route: route(
      [300, 716],
      [505, 626],
      [750, 716],
      [1010, 626],
      [1270, 716],
      [1565, 626],
      [1810, 716],
    ),
    props: [crate(355), cover(875), cover(1370), crate(1675, 505)],
  },
} satisfies Record<
  string,
  {
    source: string;
    name: string;
    area: Level['area'];
    stage: number;
    guide: string;
    solids: Solid[];
    spawns: Spawn[];
    route: Vec[];
    props: { kind: 'crate' | 'cover'; x: number; y: number }[];
  }
>;
export type RemasterRoom = keyof typeof ROOM_REMASTERS;
export const isRemasterRoom = (id: string): id is RemasterRoom => Object.hasOwn(ROOM_REMASTERS, id);
export function roomRemasterEnabled(seed: string) {
  return Number(/^RF-C(\d+)-/.exec(seed)?.[1] ?? 0) >= 92;
}
export function roomDesign(seed: string, source: string) {
  if (!roomRemasterEnabled(seed)) return undefined;
  return Object.entries(ROOM_REMASTERS).find(([, room]) => room.source === source)?.[1];
}
export function remasteredLayout(source: Layout, seed: string, stage: number): Layout {
  const design = stage > 0 && roomDesign(seed, source.id);
  if (!design) return source;
  return {
    ...source,
    solids: design.solids,
    spawns: design.spawns,
    route: design.route,
    remastered: true,
    setpiece: {
      rosters: Array.from({ length: 3 }, () =>
        design.spawns.slice(0, stage === 2 ? 6 : 4).map((_, i) => i),
      ),
      weak: [],
      props: design.props,
    },
  };
}
// Forced previews pass through ordinary Game.startTest save guards.
export function forcedRemasterRoom(g: Game): RemasterRoom | undefined {
  const match = g.testRun && /^RF-C92-ROOM-([a-z-]+)(?:-MIRROR)?$/.exec(g.testRun.seed);
  if (!match) return undefined;
  const key = match[1].replace(/-MIRROR$/, '');
  return isRemasterRoom(key) ? key : undefined;
}
export function remasterTestLevel(g: Game, level: Level): Level {
  const id = forcedRemasterRoom(g);
  if (!id) return level;
  const room = ROOM_REMASTERS[id],
    mirrored = g.seed.endsWith('-MIRROR');
  const point = <T extends Vec>(p: T): T => ({ ...p, x: mirrored ? 2000 - p.x : p.x });
  const path = room.route.map(point);
  const spawns = room.spawns
    .slice(0, id === 'overpass' ? 4 : id === 'switchyard' ? 6 : room.spawns.length)
    .map(point)
    .map((s) =>
      s.kind === 'strider' && g.stage < 10 ? { ...s, kind: 'shooter' as const, y: s.y + 2 } : s,
    );
  return {
    id: room.source,
    name: room.name,
    area: room.area,
    boss: false,
    mirrored,
    remastered: true,
    solids: room.solids.map((s) => ({ ...s, x: mirrored ? 2000 - s.x - s.w : s.x })),
    spawns,
    route: mirrored ? path.reverse() : path,
    setpiece: {
      rosters: [spawns.map((_, i) => i)],
      weak: [],
      props: room.props.map((p) => point(p)),
    },
  };
}
export function remasterTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (p.get('test') !== 'rooms' || p.get('v') !== '1') return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (
      !['test', 'room', 'build', 'gun', 'mirror', 'v'].includes(key) ||
      p.getAll(key).length !== 1
    )
      invalid = true;
  });
  const room = p.get('room') ?? 'overpass',
    build = p.get('build') ?? 'native',
    gun = p.get('gun') ?? 'pistol';
  if (
    invalid ||
    !isRemasterRoom(room) ||
    !isStartingGun(gun) ||
    !['native', 'beam', 'blast'].includes(build) ||
    (p.has('mirror') && !['0', '1'].includes(p.get('mirror')!))
  )
    return null;
  const mods =
    build === 'beam'
      ? [...BRANCH_TEST_BUILDS.prism.mods]
      : build === 'blast'
        ? [...BRANCH_TEST_BUILDS.cluster.mods]
        : [];
  if (mods.length > ROOM_REMASTERS[room].stage) return null;
  return {
    version: 6,
    seed: 'RF-C92-ROOM-' + room + (p.get('mirror') === '1' ? '-MIRROR' : ''),
    stage: ROOM_REMASTERS[room].stage,
    startingGun: gun,
    hp: 100,
    mods,
    kills: 0,
    elapsed: 0,
    encounters: 1,
  };
}

// Small painted platform ends identify real landing surfaces; no permanent HUD.
export function drawRoomLandings(c: CanvasRenderingContext2D, level: Level) {
  if (!level.remastered) return;
  c.save();
  c.strokeStyle = '#83a99b';
  c.lineWidth = 2;
  for (const s of level.solids) {
    if (s.h !== 22) continue;
    for (const x of [s.x + 8, s.x + s.w - 36]) {
      c.beginPath();
      c.moveTo(x, s.y + 1);
      c.lineTo(x + 28, s.y + 1);
      c.lineTo(x + 28, s.y + 7);
      c.stroke();
    }
  }
  c.restore();
}
