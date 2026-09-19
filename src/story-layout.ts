import { getLevel, type Level, type Solid, type Spawn } from './levels.ts';
import { seeded, type Checkpoint, type Vec } from './rules.ts';
import { courierEligible, type CourierSave } from './courier-layout.ts';
import type { AreaEventSave } from './area-events.ts';

export const STORY_ROOMS = {
  breakroom: { name: 'Abandoned break room', stages: [8, 9], note: { x: 665, y: 486 }, floor: 520 },
  dispatch: { name: 'Dispatch office', stages: [1, 12], note: { x: 550, y: 516 }, floor: 550 },
  experiment: {
    name: 'Failed experiment',
    stages: [4, 5, 8, 9],
    note: { x: 550, y: 606 },
    floor: 640,
  },
  hideout: { name: 'Maintenance hideout', stages: [16, 17], note: { x: 650, y: 496 }, floor: 530 },
} as const;
export type StoryKind = keyof typeof STORY_ROOMS;
export const STORY_KINDS = Object.keys(STORY_ROOMS) as StoryKind[];
export interface StorySave {
  kind: StoryKind;
  stage: number;
  recovered: boolean;
}
export const storyEligible = (level: Level) =>
  courierEligible(level) && !level.setpiece && !level.routeChoice && !level.fabricatorIntro;

export function planStory(
  seed: string,
  event?: AreaEventSave | null,
  courier?: CourierSave | null,
  floodgate?: number | null,
): StorySave | null {
  const rng = seeded(seed + ':story-rooms-v1');
  if (rng() >= 0.5) return null;
  const choices = STORY_KINDS.flatMap((kind) =>
    STORY_ROOMS[kind].stages
      .filter(
        (stage) =>
          Math.floor(stage / 4) !== event?.area &&
          stage !== courier?.stage &&
          stage !== floodgate &&
          storyEligible(getLevel(seed, stage)),
      )
      .map((stage) => ({ kind, stage, recovered: false })),
  );
  // Choose the story first so the experiment's extra suitable rooms don't make
  // it disproportionately common. One optional discovery at most per campaign.
  const kinds = STORY_KINDS.filter((kind) => choices.some((choice) => choice.kind === kind));
  const kind = kinds[Math.floor(rng() * kinds.length)];
  const matches = choices.filter((choice) => choice.kind === kind);
  return matches[Math.floor(rng() * matches.length)] ?? null;
}

export function validStory(d: Checkpoint) {
  const s = d.story;
  return (
    s === undefined ||
    (d.version === 6 &&
      !!s &&
      typeof s === 'object' &&
      STORY_KINDS.includes(s.kind) &&
      (STORY_ROOMS[s.kind].stages as readonly number[]).includes(s.stage) &&
      typeof s.recovered === 'boolean' &&
      (!s.recovered || !!d.overtime || d.stage >= s.stage) &&
      d.areaEvent?.area !== Math.floor(s.stage / 4) &&
      d.courier?.stage !== s.stage &&
      d.floodgate !== s.stage)
  );
}

export const storyPoint = (level: Level, point: Vec): Vec => ({
  x: level.mirrored ? 2000 - point.x : point.x,
  y: point.y,
});
export const COLD_RIG = { x: 1130, y: 614, radius: 225, period: 5.2, warning: 1, pulse: 0.65 };

const rect = (x: number, y: number, w: number, h: number): Solid => ({ x, y, w, h });
const layouts: Record<StoryKind, Solid[]> = {
  breakroom: [
    rect(290, 645, 170, 95),
    rect(440, 540, 130, 22),
    rect(570, 520, 320, 22),
    rect(862, 370, 28, 150),
    rect(1070, 640, 130, 100),
    rect(1320, 455, 230, 22),
    rect(1530, 650, 140, 90),
  ],
  dispatch: [
    rect(290, 645, 150, 95),
    rect(440, 550, 300, 22),
    rect(880, 530, 480, 22),
    rect(1410, 645, 140, 95),
    rect(1540, 430, 210, 22),
  ],
  experiment: [
    rect(330, 640, 310, 22),
    rect(740, 625, 105, 115),
    rect(1020, 390, 220, 22),
    rect(1410, 625, 115, 115),
    rect(1530, 470, 230, 22),
  ],
  hideout: [
    rect(270, 640, 150, 100),
    rect(420, 530, 400, 22),
    rect(420, 375, 240, 22),
    rect(950, 630, 120, 110),
    rect(1210, 465, 250, 22),
    rect(1510, 625, 140, 115),
  ],
};
const props: Record<StoryKind, NonNullable<Level['setpiece']>['props']> = {
  breakroom: [
    { kind: 'crate', x: 1000, y: 717 },
    { kind: 'canister', x: 1450, y: 720 },
  ],
  dispatch: [
    { kind: 'crate', x: 1040, y: 507 },
    { kind: 'cover', x: 1590, y: 697 },
    { kind: 'canister', x: 1500, y: 626 },
  ],
  experiment: [
    { kind: 'crate', x: 1360, y: 717 },
    { kind: 'canister', x: 1320, y: 720 },
  ],
  hideout: [
    { kind: 'cover', x: 784, y: 487 },
    { kind: 'crate', x: 727, y: 507 },
    { kind: 'cover', x: 900, y: 697 },
    { kind: 'canister', x: 1150, y: 720 },
  ],
};

export function storyLevel(source: Level, kind: StoryKind, seed: string): Level {
  const mirrored = seeded(seed + ':story-layout')() < 0.5;
  const level: Level = {
    id: 'story-' + kind,
    name: STORY_ROOMS[kind].name,
    area: source.area,
    story: kind,
    boss: false,
    mirrored,
    solids: layouts[kind].map((s) => ({ ...s, x: mirrored ? 2000 - s.x - s.w : s.x })),
    hazards: [],
    setpiece: {
      rosters: [],
      weak: [],
      props: props[kind].map((p) => ({ ...p, x: mirrored ? 2000 - p.x : p.x })),
    },
    spawns: [],
    route: [],
  };
  const area = ['docks', 'furnace', 'cooling', 'reclamation', 'rooftops'].indexOf(source.area);
  const ground = (x: number, kind: Spawn['kind'] = 'runner'): Spawn => ({ x, y: 723, kind });
  // Keep the discovery alcove quiet. Every gun emplacement uses an actual
  // support, and the late-area rosters retain their flanking/air pressure.
  const farShelf = layouts[kind].filter((s) => s.h === 22 && s.x > 1200).at(-1)!;
  const spawns: Spawn[] = [
    ground(930),
    ground(1280, area >= 2 ? 'hopper' : 'runner'),
    { kind: area >= 2 ? 'sniper' : 'shooter', x: farShelf.x + farShelf.w / 2, y: farShelf.y - 16 },
    { kind: 'flyer', x: 1010, y: 300 },
    ground(1740, area >= 3 ? 'borer' : 'runner'),
    { kind: area >= 2 ? 'skimmer' : 'flyer', x: 1560, y: 260 },
  ];
  if (area >= 1) spawns.push(ground(kind === 'breakroom' ? 1350 : 1190, 'charger'));
  if (area >= 2) spawns.push({ kind: 'flyer', x: 1390, y: 340 });
  if (area >= 3)
    spawns.push(
      { kind: area === 3 ? 'sifter' : 'skimmer', x: 1760, y: 390 },
      ground(1700, 'hopper'),
    );
  if (area >= 4)
    spawns.push({ kind: 'shooter', x: 1370, y: 449, elite: 'shielded' }, ground(1095, 'hopper'));
  level.spawns = spawns.map((s) => ({ ...s, ...storyPoint(level, s) }));
  // The exit always remains reachable without visiting the story alcove.
  level.route = [
    { x: 180, y: 720 },
    ...level.solids
      .filter((s) => s.y >= 625 && s.h > 22)
      .sort((a, b) => a.x - b.x)
      .map((s) => ({ x: s.x + s.w / 2, y: s.y - 20 })),
    { x: 1810, y: 720 },
  ];
  return level;
}

export function storyTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams,
    kind = p.get('room') as StoryKind;
  if (
    p.get('test') !== 'story' ||
    p.getAll('test').length !== 1 ||
    p.getAll('room').length !== 1 ||
    !STORY_KINDS.includes(kind)
  )
    return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'room', 'mirror', 'phase', 'v'].includes(key)) invalid = true;
  });
  if (
    invalid ||
    (p.has('phase') && (p.getAll('phase').length !== 1 || p.get('phase') !== 'inspect')) ||
    (p.has('mirror') && (p.getAll('mirror').length !== 1 || p.get('mirror') !== '1'))
  )
    return null;
  let seed = '';
  for (let i = 0; i < 20; i++) {
    seed = 'STORY-88-' + kind + '-' + i + (p.has('phase') ? '-INSPECT' : '');
    if (seeded(seed + ':story-layout')() < 0.5 === p.has('mirror')) break;
  }
  const stage = STORY_ROOMS[kind].stages[0];
  return {
    version: 6,
    seed,
    stage,
    hp: 75,
    mods: ['magnum', 'light', 'airshot', 'rapid', 'ricochet'],
    kills: 0,
    elapsed: 0,
    story: { kind, stage, recovered: false },
  };
}
