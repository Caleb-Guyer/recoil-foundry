import type { Level, Solid, Spawn } from './levels.ts';
import { annexLevel, annexPoint } from './annex-layout.ts';
import { seeded, type Checkpoint, type Vec } from './rules.ts';
import { annexRevision, type AnnexVersion } from './regions.ts';
import { ANNEX_ALTERNATES, type AnnexLayout } from './annex-alternates.ts';

export interface AnnexStation {
  junction: Vec;
  port: Vec;
  mount: number;
  cable: number;
  patrol: [number, number];
}
const shelf = (x: number, y: number, w: number): Solid => ({ x, y, w, h: 22 });
const spawn = (kind: Spawn['kind'], x: number, y: number): Spawn => ({ kind, x, y });
const point = (x: number, y: number): Vec => ({ x, y });

export function annexRouteLevel(
  seed: string,
  stage: number,
  mirror?: boolean,
  version: AnnexVersion = annexRevision(seed),
  layout?: AnnexLayout,
): Level {
  if (!Number.isInteger(stage) || stage < 8 || stage > 10)
    throw new RangeError('Annex combat rooms occupy stages 8–10');
  const mirrored = mirror ?? seeded(seed + ':annex-room:' + stage)() < 0.5;
  const base = annexLevel({ mirror: false, spoof: false });
  let room: Level =
    stage === 8
      ? {
          ...base,
          name: 'Broadcast Floor',
          route: [
            point(285, 722),
            point(455, 642),
            point(630, 535),
            point(915, 484),
            point(1285, 582),
            point(1585, 632),
            point(1810, 722),
          ],
          spawns: [...base.spawns, spawn('flyer', 1040, 300), spawn('shooter', 1590, 633)],
          annexStation: {
            junction: point(920, 460),
            port: point(1320, 285),
            mount: 502,
            cable: 228,
            patrol: [1190, 1410],
          },
        }
      : stage === 9
        ? {
            ...base,
            id: 'annex-cable-well',
            name: 'Cable Well',
            solids: [
              { x: 340, y: 645, w: 160, h: 95 },
              shelf(530, 535, 160),
              shelf(730, 425, 160),
              shelf(935, 315, 175),
              shelf(1150, 425, 170),
              shelf(1360, 535, 160),
              { x: 1545, y: 645, w: 140, h: 95 },
            ],
            spawns: [
              spawn('shooter', 610, 518),
              spawn('runner', 800, 723),
              spawn('flyer', 750, 280),
              spawn('shooter', 1020, 298),
              spawn('switchman', 1195, 722),
              spawn('flyer', 1310, 300),
              spawn('shooter', 1450, 518),
              spawn('runner', 1440, 723),
              spawn('runner', 1600, 628),
            ],
            route: [
              point(270, 722),
              point(420, 627),
              point(610, 517),
              point(810, 407),
              point(1020, 297),
              point(1235, 407),
              point(1440, 517),
              point(1610, 627),
              point(1780, 722),
            ],
            setpiece: { rosters: [], weak: [], props: [{ kind: 'crate', x: 1115, y: 717 }] },
            annexStation: {
              junction: point(810, 383),
              port: point(1240, 245),
              mount: 425,
              cable: 170,
              patrol: [1140, 1320],
            },
          }
        : {
            ...base,
            id: 'annex-receiver-gallery',
            name: 'Receiver Gallery',
            solids: [
              { x: 370, y: 655, w: 125, h: 85 },
              shelf(560, 520, 185),
              { x: 825, y: 615, w: 135, h: 125 },
              shelf(1045, 435, 195),
              { x: 1360, y: 655, w: 130, h: 85 },
              shelf(1570, 515, 170),
            ],
            spawns: [
              spawn('shooter', 650, 503),
              spawn('runner', 755, 723),
              spawn('shooter', 890, 598),
              spawn('flyer', 990, 305),
              spawn('shooter', 1140, 418),
              spawn('switchman', 1180, 722),
              spawn('runner', 1430, 638),
              spawn('shooter', 1650, 498),
              spawn('flyer', 1600, 345),
              spawn('runner', 1660, 723),
            ],
            route: [
              point(285, 722),
              point(430, 637),
              point(650, 502),
              point(890, 597),
              point(1140, 722),
              point(1425, 637),
              point(1660, 722),
              point(1790, 722),
            ],
            setpiece: {
              rosters: [],
              weak: [],
              props: [
                { kind: 'cover', x: 680, y: 696 },
                { kind: 'crate', x: 1530, y: 717 },
              ],
            },
            annexStation: {
              junction: point(1140, 393),
              port: point(1530, 280),
              mount: 435,
              cable: 205,
              patrol: [1030, 1300],
            },
          };
  // Keep the original roster byte-for-byte for Daily 80 and in-progress saves.
  if (version >= 2) {
    if (stage === 9)
      room.spawns = room.spawns.map((s) =>
        s.kind === 'switchman' ? spawn('caller', s.x, s.y) : s,
      );
    if (stage === 10)
      room.spawns = room.spawns.map((s) =>
        s.kind === 'shooter' && s.x === 1140 ? spawn('caller', 1090, 417) : s,
      );
  }
  // Layout selection has its own random stream: mirroring and reward identity
  // stay stable. Saved revisions and older Daily challenges keep their rooms.
  if (version >= 4 && (layout ?? annexArrangement(seed, stage)) === 'alternate')
    room = { ...base, ...ANNEX_ALTERNATES[stage] };
  const station = room.annexStation!;
  return {
    ...room,
    mirrored,
    solids: room.solids.map((s) => ({ ...s, x: mirrored ? 2000 - s.x - s.w : s.x })),
    spawns: room.spawns.map((s) => ({ ...s, ...annexPoint(mirrored, s) })),
    route: room.route.map((p) => annexPoint(mirrored, p)).sort((a, b) => a.x - b.x),
    setpiece: {
      ...room.setpiece!,
      rosters: [...room.setpiece!.rosters],
      weak: [...room.setpiece!.weak],
      props: room.setpiece!.props.map((p) => ({ ...p, ...annexPoint(mirrored, p) })),
    },
    annexStation: {
      ...station,
      patrol: [...station.patrol],
      junction: annexPoint(mirrored, station.junction),
      port: annexPoint(mirrored, station.port),
    },
  };
}

export function annexArrangement(seed: string, stage: number): AnnexLayout {
  return seeded(seed + ':annex-arrangement-v1:' + stage)() < 0.5 ? 'original' : 'alternate';
}

export const ANNEX_ROUTE_ROOMS = ['fork', 'broadcast', 'well', 'gallery'] as const;
export function annexRouteTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  let valid = p.get('test') === 'annex-route';
  p.forEach((_, k) => {
    if (!['test', 'room', 'mirror', 'layout'].includes(k) || p.getAll(k).length !== 1)
      valid = false;
  });
  const room = p.get('room') ?? 'fork';
  if (
    !valid ||
    !ANNEX_ROUTE_ROOMS.some((r) => r === room) ||
    (p.has('mirror') && !['0', '1'].includes(p.get('mirror')!)) ||
    (p.has('layout') && !['original', 'alternate'].includes(p.get('layout')!))
  )
    return null;
  const stage = 7 + ANNEX_ROUTE_ROOMS.indexOf(room as (typeof ANNEX_ROUTE_ROOMS)[number]);
  // A modest, legal build with room for Subversion; presets never touch run progress.
  const mods = [
    'magnum',
    'light',
    'kick',
    'pierce',
    'ricochet',
    'airshot',
    'leech',
    'rapid',
    'spoof',
    'standing-orders',
  ];
  return {
    version: 6,
    seed: 'ANNEX-ROUTE-80',
    stage,
    hp: 100,
    kills: 0,
    elapsed: 0,
    mods: mods.slice(0, stage),
    region: stage === 7 ? 'pending' : 'annex',
    annexVersion: 6,
    annexRouteTest: {
      mirror: p.get('mirror') === '1',
      fork: room === 'fork',
      layout: (p.get('layout') ?? 'original') as AnnexLayout,
    },
  };
}
