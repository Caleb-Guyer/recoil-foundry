import type { Game } from './game.ts';
import type { Level, Solid, Spawn } from './levels.ts';
import { clamp, type Checkpoint, type Vec, type RouteChoice } from './rules.ts';
import { finalApproachSeed } from './boss-progression.ts';

const box = (x: number, y: number, w: number, h = 22): Solid => ({ x, y, w, h });
const on = (kind: Spawn['kind'], x: number, floor = 740): Spawn => ({
  kind,
  x,
  y: floor - (kind === 'runner' ? 17 : kind === 'shutter' ? 20 : 16),
});
export const FINAL_APPROACH_ROOMS = {
  'signal-yard': {
    stage: 16,
    name: 'Signal Yard',
    solids: [
      box(460, 650, 180, 90),
      box(1340, 650, 180, 90),
      box(650, 515, 300),
      box(1080, 440, 260),
    ],
    spawns: [on('shooter', 790, 515), on('runner', 1070), { kind: 'flyer', x: 1510, y: 330 }],
    props: [{ kind: 'crate', x: 350, y: 717 }],
    route: [
      [300, 716],
      [550, 626],
      [800, 716],
      [1150, 716],
      [1430, 626],
      [1790, 716],
    ],
    rest: 5.2,
  },
  'battery-walk': {
    stage: 17,
    name: 'Battery Walk',
    solids: [
      box(410, 650, 150, 90),
      box(970, 650, 150, 90),
      box(1530, 650, 150, 90),
      box(570, 510, 300),
      box(1160, 510, 300),
    ],
    spawns: [
      on('runner', 730),
      on('shooter', 1300, 510),
      on('shutter', 1640, 650),
      { kind: 'flyer', x: 1060, y: 310 },
    ],
    props: [{ kind: 'crate', x: 355, y: 717 }],
    route: [
      [300, 716],
      [485, 626],
      [730, 716],
      [1045, 626],
      [1300, 716],
      [1605, 626],
      [1810, 716],
    ],
    rest: 4.8,
  },
  'reactor-verge': {
    stage: 18,
    name: 'Reactor Verge',
    solids: [
      box(430, 650, 160, 90),
      box(1430, 650, 160, 90),
      box(600, 520, 290),
      box(1030, 440, 290),
      box(1420, 510, 250),
    ],
    spawns: [
      on('shooter', 745, 520),
      on('runner', 1010),
      on('shooter', 1535, 510),
      on('shutter', 1750),
    ],
    props: [{ kind: 'crate', x: 355, y: 717 }],
    route: [
      [300, 716],
      [510, 626],
      [760, 716],
      [1090, 716],
      [1510, 626],
      [1810, 716],
    ],
    rest: 4.4,
  },
} satisfies Record<
  string,
  {
    stage: number;
    name: string;
    solids: Solid[];
    spawns: Spawn[];
    props: NonNullable<Level['setpiece']>['props'];
    route: number[][];
    rest: number;
  }
>;
export const FINAL_APPROACH_ROUTE_VARIANTS = {
  low: {
    solids: [
      box(400, 650, 160, 90),
      box(900, 650, 180, 90),
      box(1430, 650, 160, 90),
      box(600, 540, 280),
      box(1130, 540, 280),
    ],
    spawns: [
      on('shutter', 480, 650),
      on('runner', 760),
      on('shooter', 1265, 540),
      on('runner', 1690),
    ],
    props: [{ kind: 'crate', x: 355, y: 717 }],
    route: [
      [300, 716],
      [480, 626],
      [730, 716],
      [990, 626],
      [1250, 716],
      [1510, 626],
      [1810, 716],
    ],
  },
  high: {
    solids: [
      box(420, 650, 160, 90),
      box(1430, 650, 160, 90),
      box(600, 520, 290),
      box(1030, 420, 290),
      box(1400, 510, 250),
    ],
    spawns: [
      on('shooter', 745, 520),
      { kind: 'flyer', x: 1070, y: 310 },
      { kind: 'flyer', x: 1510, y: 300 },
      on('runner', 1700),
    ],
    props: [{ kind: 'crate', x: 355, y: 717 }],
    route: [
      [300, 716],
      [500, 626],
      [760, 716],
      [1100, 716],
      [1510, 626],
      [1810, 716],
    ],
  },
} satisfies Record<
  RouteChoice,
  Pick<(typeof FINAL_APPROACH_ROOMS)['reactor-verge'], 'solids' | 'spawns' | 'props' | 'route'>
>;

export type FinalApproachRoom = keyof typeof FINAL_APPROACH_ROOMS;
export const FINAL_APPROACH_IDS = Object.keys(FINAL_APPROACH_ROOMS) as FinalApproachRoom[];
export const FINAL_APPROACH_WARNING = 1.65;
export const FINAL_APPROACH_DAMAGE = 12;
export const isFinalApproachRoom = (value: unknown): value is FinalApproachRoom =>
  typeof value === 'string' && Object.hasOwn(FINAL_APPROACH_ROOMS, value);
export function getFinalApproachRoom(level: Level): FinalApproachRoom | undefined {
  const id = level.id.replace(/^final-approach-/, '');
  return level.id.startsWith('final-approach-') && isFinalApproachRoom(id) ? id : undefined;
}
function eligible(g: Game) {
  return (
    finalApproachSeed(g.seed) &&
    g.stage >= 16 &&
    g.stage <= 18 &&
    !g.overtime &&
    !g.detour &&
    !g.escape &&
    !g.practice &&
    !g.workshop.active
  );
}
// Jobs, hunts and security keep their authored floor plans and objective nodes.
// They can share the distant skyline, but never the tutorial strike machinery.
export function finalApproachAtmosphere(g: Game): FinalApproachRoom | undefined {
  return eligible(g) && g.level.area === 'rooftops'
    ? FINAL_APPROACH_IDS.find((id) => FINAL_APPROACH_ROOMS[id].stage === g.stage)
    : undefined;
}
function forcedRoom(g: Game) {
  const match = g.testRun && /^RF-C98-APPROACH-([a-z-]+?)(-MIRROR)?$/.exec(g.seed);
  return match && isFinalApproachRoom(match[1]) ? { id: match[1], mirrored: !!match[2] } : null;
}
export function finalApproachLevel(g: Game, base: Level): Level {
  const forced = forcedRoom(g);
  const chosenRoute = g.stage === 18 ? (g.route ?? base.routeChoice) : undefined;
  if (
    !eligible(g) ||
    (g.testRun && !forced) ||
    (g.route && g.stage !== 18) ||
    base.boss ||
    base.detour ||
    (base.routeChoice && g.stage !== 18) ||
    base.hunt ||
    base.security ||
    base.freight ||
    base.crossing ||
    base.annex ||
    base.story ||
    base.shutdown ||
    base.courier ||
    base.floodgate ||
    base.sortingPit ||
    base.uprising ||
    base.fabricatorIntro ||
    base.anglerIntro ||
    base.crawlerIntro ||
    base.harpoonIntro ||
    base.sapperIntro ||
    base.machineIntro ||
    base.teamworkIntro ||
    g.areaEvents.encounter
  )
    return base;
  const id =
    forced?.id ?? FINAL_APPROACH_IDS.find((key) => FINAL_APPROACH_ROOMS[key].stage === g.stage);
  if (!id) return base;
  const room = FINAL_APPROACH_ROOMS[id],
    source =
      id === 'reactor-verge' && chosenRoute ? FINAL_APPROACH_ROUTE_VARIANTS[chosenRoute] : room,
    mirrored = forced?.mirrored ?? base.mirrored;
  const point = <T extends Vec>(p: T): T => ({ ...p, x: mirrored ? 2000 - p.x : p.x });
  const route = source.route.map(([x, y]) => point({ x, y }));
  const spawns = source.spawns.map(point);
  return {
    id: 'final-approach-' + id,
    name:
      room.name +
      (chosenRoute ? (chosenRoute === 'high' ? ' · Aerial crossing' : ' · Service trench') : ''),
    ...(chosenRoute ? { routeChoice: chosenRoute } : {}),
    area: 'rooftops',
    boss: false,
    mirrored,
    remastered: true,
    solids: source.solids.map((s) => ({ ...s, x: mirrored ? 2000 - s.x - s.w : s.x })),
    spawns,
    route: mirrored ? route.reverse() : route,
    setpiece: { rosters: [spawns.map((_, i) => i)], weak: [], props: source.props.map(point) },
  };
}
export function finalApproachTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (p.get('test') !== 'approach' || p.get('v') !== '1') return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'room', 'v', 'mirror', 'route'].includes(key) || p.getAll(key).length !== 1)
      invalid = true;
  });
  const room = p.get('room') ?? 'signal-yard',
    mirror = p.get('mirror') ?? '0',
    route = p.get('route');
  if (
    invalid ||
    !isFinalApproachRoom(room) ||
    !['0', '1'].includes(mirror) ||
    (route !== null && (room !== 'reactor-verge' || !['low', 'high'].includes(route)))
  )
    return null;
  return {
    version: 6,
    seed: 'RF-C98-APPROACH-' + room + (mirror === '1' ? '-MIRROR' : ''),
    stage: FINAL_APPROACH_ROOMS[room].stage,
    startingGun: 'pistol',
    ...(route ? { route: route as RouteChoice } : {}),
    hp: 100,
    mods: [],
    kills: 0,
    elapsed: 0,
    encounters: 1,
  };
}
export interface FinalApproachStrike {
  kind: 'column' | 'floor';
  rects: Solid[];
  left: number;
  fired: boolean;
}
// Targets lock once. They never track a player during the complete warning.
export function finalApproachStrike(
  room: FinalApproachRoom,
  cycle: number,
  targetX: number,
  mirrored: boolean,
): FinalApproachStrike {
  const kind =
    room === 'signal-yard' || (room === 'reactor-verge' && cycle % 2 === 0) ? 'column' : 'floor';
  const center = clamp(mirrored ? 2000 - targetX : targetX, 500, 1500);
  const width = kind === 'column' ? 120 : room === 'battery-walk' ? 300 : 340;
  const s = box(
    center - width / 2,
    kind === 'column' ? 70 : 674,
    width,
    kind === 'column' ? 670 : 66,
  );
  if (mirrored) s.x = 2000 - s.x - s.w;
  return { kind, rects: [s], left: FINAL_APPROACH_WARNING, fired: false };
}
export class FinalApproachSystem {
  game: Game;
  room: FinalApproachRoom | undefined;
  strike: FinalApproachStrike | null = null;
  timer = 2.4;
  cycle = 0;
  constructor(game: Game) {
    this.game = game;
  }
  get active() {
    return this.room !== undefined;
  }
  clear() {
    this.room = undefined;
    this.strike = null;
    this.timer = 2.4;
    this.cycle = 0;
  }
  reset(clearedRoom = false) {
    this.clear();
    if (!clearedRoom && eligible(this.game)) this.room = getFinalApproachRoom(this.game.level);
  }
  beforeStep(dt: number) {
    const g = this.game;
    if (!this.room || g.mode !== 'playing' || !(dt > 0) || !Number.isFinite(dt)) return;
    if (g.clear) {
      this.strike = null;
      return;
    }
    dt = Math.min(dt, 0.05);
    if (this.strike) {
      this.strike.left = Math.max(0, this.strike.left - dt);
      if (this.strike.left > 1e-8) return;
      if (!this.strike.fired) {
        this.strike.fired = true;
        this.strike.left = 0.24;
        const b = g.player.bounds;
        if (
          this.strike.rects.some(
            (s) => b.max.x > s.x && b.min.x < s.x + s.w && b.max.y > s.y && b.min.y < s.y + s.h,
          )
        )
          g.damagePlayer(FINAL_APPROACH_DAMAGE, undefined, { type: 'induction' });
        g.onSound('finale-arena-fire');
      } else {
        this.strike = null;
        this.timer = FINAL_APPROACH_ROOMS[this.room].rest;
      }
      return;
    }
    // Leave both the entrance and exit calm; crossing the room starts the drill.
    if (g.player.position.x < 420 || g.player.position.x > 1760) return;
    this.timer = Math.max(0, this.timer - dt);
    if (this.timer <= 1e-8) {
      this.strike = finalApproachStrike(
        this.room,
        this.cycle++,
        g.player.position.x,
        g.level.mirrored,
      );
      g.onSound('finale-arena-warn');
    }
  }
}
