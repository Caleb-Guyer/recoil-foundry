import type { AreaId } from './areas.ts';
import type { Game } from './game.ts';
import type { Level, Solid, Spawn } from './levels.ts';
import type { Vec } from './rules.ts';

export const SHIFT_ROUTE_IDS = [
  'vacuum-docks',
  'turntable-works',
  'prism-glassworks',
  'express-airlocks',
  'rework-loop',
] as const;
export type ShiftRouteId = (typeof SHIFT_ROUTE_IDS)[number];
export const SHIFT_ROUTE_NAMES: Record<ShiftRouteId, string> = {
  'vacuum-docks': 'Vacuum Docks',
  'turntable-works': 'Turntable Works',
  'prism-glassworks': 'Prism Glassworks',
  'express-airlocks': 'Express Airlocks',
  'rework-loop': 'Rework Loop',
};
export interface ReworkSnapshot {
  version: 1;
  source: string;
  name: string;
  area: AreaId;
  solids: Solid[];
  props: { kind: 'crate' | 'cover' | 'canister'; x: number; y: number; hp?: number }[];
  scars: Vec[];
}
export interface ShiftRouteLayout extends Level {
  shiftRoute: ShiftRouteId;
  rotors?: { solid: number; console: Vec }[];
  mirrors?: { solid: number; console: Vec }[];
  airlocks?: { solid: number; console: Vec; chamberEnd: number }[];
}
const box = (x: number, y: number, w: number, h = 22): Solid => ({ x, y, w, h });
const floor = (kind: Spawn['kind'], x: number): Spawn => ({ kind, x, y: 723 });
const ranged = (x: number, y = 723): Spawn => ({ kind: 'shooter', x, y });
function level(
  kind: ShiftRouteId,
  area: AreaId,
  solids: Solid[],
  spawns: Spawn[],
  props: NonNullable<Level['setpiece']>['props'] = [],
): ShiftRouteLayout {
  return {
    id: 'shift-' + kind,
    name: SHIFT_ROUTE_NAMES[kind],
    shiftRoute: kind,
    area,
    mirrored: false,
    boss: false,
    solids,
    spawns,
    route: [
      { x: 240, y: 720 },
      { x: 1750, y: 720 },
    ],
    hazards: [],
    setpiece: { rosters: [spawns.map((_, i) => i)], weak: [], props },
  };
}
export function shiftRouteLayout(
  kind: ShiftRouteId,
  area: AreaId,
  rework?: ReworkSnapshot,
): ShiftRouteLayout {
  if (kind === 'vacuum-docks')
    return level(
      kind,
      area,
      [
        box(330, 640, 190, 100),
        box(680, 515, 230),
        box(1050, 390, 210),
        box(1370, 525, 220),
        box(1630, 640, 170, 100),
      ],
      [
        ranged(420, 623),
        { kind: 'flyer', x: 920, y: 275 },
        floor('runner', 1060),
        ranged(1470, 508),
        ranged(1710, 623),
      ],
      [
        { kind: 'cover', x: 590, y: 697 },
        { kind: 'crate', x: 1280, y: 717 },
      ],
    );
  if (kind === 'turntable-works') {
    const room = level(
      kind,
      area,
      [
        box(490, 440, 300),
        box(1210, 440, 300),
        box(260, 625, 170),
        box(1570, 625, 170),
        box(890, 550, 220),
      ],
      [
        ranged(345, 608),
        floor('runner', 830),
        ranged(1000, 533),
        floor('shooter', 1540),
        ranged(1660, 608),
      ],
      [{ kind: 'crate', x: 1100, y: 717 }],
    );
    room.rotors = [
      { solid: 0, console: { x: 380, y: 700 } },
      { solid: 1, console: { x: 1620, y: 700 } },
    ];
    return room;
  }
  if (kind === 'prism-glassworks') {
    const room = level(
      kind,
      area,
      [
        box(550, 465, 140, 12),
        box(970, 365, 140, 12),
        box(1390, 465, 140, 12),
        box(320, 620, 170),
        box(1590, 620, 170),
        box(870, 575, 230),
      ],
      [
        ranged(400, 603),
        floor('shooter', 760),
        { kind: 'flyer', x: 1120, y: 245 },
        floor('runner', 1290),
        ranged(1670, 603),
      ],
      [
        { kind: 'cover', x: 920, y: 697 },
        { kind: 'crate', x: 1200, y: 717 },
      ],
    );
    room.mirrors = [
      { solid: 0, console: { x: 620, y: 700 } },
      { solid: 1, console: { x: 1040, y: 700 } },
      { solid: 2, console: { x: 1460, y: 700 } },
    ];
    return room;
  }
  if (kind === 'express-airlocks') {
    const room = level(
      kind,
      area,
      [
        box(650, 400, 24, 340),
        box(1270, 400, 24, 340),
        box(0, 380, 2000),
        box(370, 640, 130),
        box(930, 600, 150),
        box(1510, 640, 160),
      ],
      [
        floor('runner', 360),
        ranged(440, 623),
        floor('shooter', 860),
        floor('runner', 1160),
        ranged(1600, 623),
        floor('runner', 1790),
      ],
      [
        { kind: 'crate', x: 540, y: 717 },
        { kind: 'cover', x: 1050, y: 697 },
        { kind: 'crate', x: 1710, y: 717 },
      ],
    );
    room.airlocks = [
      { solid: 0, console: { x: 570, y: 700 }, chamberEnd: 650 },
      { solid: 1, console: { x: 1190, y: 700 }, chamberEnd: 1270 },
    ];
    return room;
  }
  if (!rework) throw new RangeError('Rework needs an actual previously cleared room');
  const solids = rework.solids.map((s) => ({ ...s, x: 2000 - s.x - s.w }));
  const props = rework.props.map((p) => ({ kind: p.kind, x: 2000 - p.x, y: p.y }));
  const occupied = (x: number, y: number, w = 36, h = 36) =>
    solids.some(
      (s) =>
        x + w / 2 + 4 > s.x &&
        x - w / 2 - 4 < s.x + s.w &&
        y + h / 2 > s.y &&
        y - h / 2 - 4 < s.y + s.h,
    ) || props.some((p) => Math.abs(p.x - x) < 65 && Math.abs(p.y - y) < 65);
  const spawns: Spawn[] = [];
  for (const preferred of [430, 790, 1190, 1570]) {
    let chosen: Spawn | undefined;
    const surfaces = [
      { x: 230, y: 740, w: 1520, h: 100 },
      ...solids.filter((s) => s.w >= 100 && s.y >= 400),
    ];
    for (const surface of surfaces) {
      for (let x = surface.x + 50; x <= surface.x + surface.w - 50; x += 45) {
        const y = surface.y - 17;
        if (
          x < 300 ||
          x > 1780 ||
          occupied(x, y) ||
          spawns.some((s) => Math.abs(s.x - x) < 100 && Math.abs(s.y - y) < 100)
        )
          continue;
        if (!chosen || Math.abs(x - preferred) < Math.abs(chosen.x - preferred))
          chosen = { kind: spawns.length % 2 ? 'shooter' : 'runner', x, y };
      }
    }
    if (chosen) spawns.push(chosen);
  }
  const room = level(kind, rework.area, solids, spawns, props);
  room.name = 'Rework: ' + rework.name;
  return room;
}
/** Capture surviving real scenery and damage; no invented "previous room". */
export function captureRework(g: Game): ReworkSnapshot | null {
  const l = g.level;
  if (
    !g.clear ||
    l.boss ||
    l.hunt ||
    l.uprising ||
    l.annex ||
    l.freight ||
    l.crossing ||
    l.maintenance ||
    l.shutdown ||
    l.story ||
    l.courier ||
    l.floodgate ||
    l.sortingPit ||
    g.detour ||
    g.overtime ||
    l.id.startsWith('shift-')
  )
    return null;
  const bodies = new Set(g.engine.world.bodies);
  const solids = g.terrain
    .slice(4)
    .filter((b) => bodies.has(b) && Math.abs(b.angle) < 0.001)
    .slice(0, 36)
    .map((b) => {
      const x = Math.min(...b.vertices.map((p) => p.x)),
        y = Math.min(...b.vertices.map((p) => p.y));
      return {
        x,
        y,
        w: Math.max(...b.vertices.map((p) => p.x)) - x,
        h: Math.max(...b.vertices.map((p) => p.y)) - y,
      };
    })
    .filter((s) => s.x >= 0 && s.x + s.w <= 2000.01 && s.y >= 0 && s.y + s.h <= 740.01)
    // Capture surviving authored terrain, not temporary foam or a circuit
    // device that would otherwise become an inert permanent wall on return.
    .filter((s) =>
      l.solids.some(
        (original) =>
          Math.abs(s.x - original.x) < 0.01 &&
          Math.abs(s.y - original.y) < 0.01 &&
          Math.abs(s.w - original.w) < 0.01 &&
          Math.abs(s.h - original.h) < 0.01,
      ),
    );
  const props: ReworkSnapshot['props'] = g.props.items
    .filter(
      (p) =>
        ['crate', 'cover', 'canister'].includes(p.kind) &&
        Math.abs(p.body.angle) < 0.05 &&
        p.body.position.x > 180 &&
        p.body.position.x < 1820,
    )
    .slice(0, 12)
    .map((p) => ({
      kind: p.kind as 'crate' | 'cover' | 'canister',
      x: p.body.position.x,
      y: p.body.position.y,
      ...(Number.isFinite(p.hp) ? { hp: Math.max(1, p.hp) } : {}),
    }));
  const scars = g.destruction.broken.slice(0, 12).map((s) => ({ x: s.x + s.w / 2, y: s.y + s.h }));
  return {
    version: 1,
    source: l.id.slice(0, 80),
    name: l.name.slice(0, 80),
    area: l.area,
    solids,
    props,
    scars,
  };
}
