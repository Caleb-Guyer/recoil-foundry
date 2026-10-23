import type { Game } from './game.ts';
import type { Level, Solid, Spawn } from './levels.ts';
import type { Checkpoint, Vec } from './rules.ts';
import { enemyRemasterSeed, type RemasteredEnemy } from './enemy-remaster.ts';
import { isStartingGun } from './starting-guns.ts';

const box = (x: number, y: number, w: number, h = 22): Solid => ({ x, y, w, h });
const floor = (kind: Spawn['kind'], x: number, top = 740): Spawn => ({
  kind,
  x,
  y: top - (kind === 'runner' ? 17 : kind === 'mortar' ? 18 : 16),
});
export const ENEMY_ENCOUNTERS = {
  'pursuit-lane': {
    name: 'Pursuit lane',
    stage: 2,
    area: 'docks',
    intro: 'runner',
    guide:
      'Let the runner commit, jump across its rush, then use the upper deck to cross the gunner’s lane.',
    solids: [box(480, 650, 160, 90), box(650, 520, 300), box(1230, 650, 160, 90)],
    spawns: [floor('runner', 820), floor('shooter', 850, 520), floor('runner', 1550)],
    props: [{ kind: 'crate', x: 1120, y: 717 }],
    route: [
      [300, 716],
      [560, 626],
      [810, 716],
      [1140, 716],
      [1310, 626],
      [1810, 716],
    ],
  },
  'split-level': {
    name: 'Split-level patrol',
    stage: 8,
    area: 'cooling',
    intro: 'shooter',
    guide:
      'Watch the gunner step into a firing lane and brace. Drop below the deck or recoil above it after the aim locks.',
    solids: [box(440, 650, 160, 90), box(630, 510, 430), box(1090, 650, 160, 90)],
    spawns: [floor('shooter', 830, 510), floor('runner', 1320), { kind: 'flyer', x: 1540, y: 300 }],
    props: [{ kind: 'cover', x: 1450, y: 697 }],
    route: [
      [300, 716],
      [520, 626],
      [850, 716],
      [1170, 626],
      [1540, 716],
      [1810, 716],
    ],
  },
  'mortar-crossing': {
    name: 'Mortar crossing',
    stage: 16,
    area: 'rooftops',
    intro: 'flyer',
    guide:
      'The flyer changes sides between volleys. Use the solid shelters against the mortar, or break its shell before crossing.',
    solids: [box(540, 610, 220), box(1150, 570, 250), box(1470, 650, 160, 90)],
    spawns: [{ kind: 'flyer', x: 820, y: 340 }, floor('mortar', 1690), floor('runner', 1040)],
    props: [
      { kind: 'cover', x: 480, y: 697 },
      { kind: 'cover', x: 1090, y: 697 },
    ],
    route: [
      [300, 716],
      [800, 716],
      [1435, 716],
      [1550, 626],
      [1810, 716],
    ],
  },
} satisfies Record<
  string,
  {
    name: string;
    stage: number;
    area: Level['area'];
    intro: RemasteredEnemy;
    guide: string;
    solids: Solid[];
    spawns: Spawn[];
    props: NonNullable<Level['setpiece']>['props'];
    route: number[][];
  }
>;
export type EnemyEncounterId = keyof typeof ENEMY_ENCOUNTERS;
export const isEnemyEncounter = (id: string): id is EnemyEncounterId =>
  Object.hasOwn(ENEMY_ENCOUNTERS, id);
export function enemyEncounterLevel(id: EnemyEncounterId, mirror = false): Level {
  const room = ENEMY_ENCOUNTERS[id];
  const point = <T extends Vec>(p: T): T => ({ ...p, x: mirror ? 2000 - p.x : p.x });
  const route = room.route.map(([x, y]) => point({ x, y }));
  return {
    id: 'patrol-' + id,
    name: room.name,
    area: room.area,
    boss: false,
    mirrored: mirror,
    remastered: true,
    enemyEncounter: id,
    remasterIntro: room.intro,
    solids: room.solids.map((s) => ({ ...s, x: mirror ? 2000 - s.x - s.w : s.x })),
    spawns: room.spawns.map(point),
    route: mirror ? route.reverse() : route,
    setpiece: {
      rosters: [room.spawns.map((_, i) => i)],
      weak: [],
      props: room.props.map((p) => ({ ...p, x: mirror ? 2000 - p.x : p.x })),
    },
  };
}
function ordinary(g: Game, l: Level) {
  return (
    enemyRemasterSeed(g.seed) &&
    !g.overtime &&
    !g.practice &&
    !g.workshop.active &&
    !g.detour &&
    !g.escape &&
    !g.inAnnex &&
    !g.route &&
    !g.security &&
    !l.boss &&
    !l.detour &&
    !l.uprising &&
    !l.routeChoice &&
    !l.annex &&
    !l.story &&
    !l.shutdown &&
    !l.courier &&
    !l.floodgate &&
    !l.sortingPit &&
    !l.freight &&
    !l.crossing &&
    !l.hunt &&
    !l.machineIntro &&
    !l.teamworkIntro &&
    !l.fabricatorIntro &&
    !l.harpoonIntro &&
    !l.anglerIntro &&
    !l.crawlerIntro &&
    !l.sapperIntro &&
    !g.areaEvents.encounter
  );
}
export function enemyEncounterRoom(g: Game, l: Level): Level {
  const match = g.testRun && /^RF-C93-PATROL-([a-z-]+?)(-MIRROR)?$/.exec(g.seed);
  if (match && isEnemyEncounter(match[1])) return enemyEncounterLevel(match[1], !!match[2]);
  const solo = g.testRun && /^RF-C93-BEHAVIOR-(runner|shooter|flyer)(-MIRROR)?$/.exec(g.seed);
  if (solo) {
    const kind = solo[1] as RemasteredEnemy,
      mirror = !!solo[2];
    const spawns: Spawn[] = [
      kind === 'flyer'
        ? { kind, x: 1050, y: 390 }
        : floor(kind, 1050, kind === 'shooter' ? 580 : 740),
    ];
    return {
      id: 'patrol-inspection',
      name: 'Patrol inspection',
      area: l.area,
      boss: false,
      mirrored: mirror,
      solids:
        kind === 'shooter'
          ? [box(850, 580, 400), box(690, 650, 130, 90)].map((s) => ({
              ...s,
              x: mirror ? 2000 - s.x - s.w : s.x,
            }))
          : [],
      spawns: spawns.map((s) => ({ ...s, x: mirror ? 2000 - s.x : s.x })),
      route: [{ x: 1880, y: 716 }],
      setpiece: {
        rosters: [[0]],
        weak: [],
        props: kind === 'shooter' ? [{ kind: 'cover', x: mirror ? 1460 : 540, y: 697 }] : [],
      },
    };
  }
  if (g.testRun || !ordinary(g, l)) return l;
  const id = (Object.keys(ENEMY_ENCOUNTERS) as EnemyEncounterId[]).find(
    (id) => ENEMY_ENCOUNTERS[id].stage === g.stage,
  );
  return id ? enemyEncounterLevel(id, l.mirrored) : l;
}
export function enemyRemasterTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (p.get('test') !== 'enemies' || p.get('v') !== '1') return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (
      !['test', 'unit', 'encounter', 'gun', 'mirror', 'v'].includes(key) ||
      p.getAll(key).length !== 1
    )
      invalid = true;
  });
  const unit = p.get('unit'),
    encounter = p.get('encounter'),
    gun = p.get('gun') ?? 'pistol';
  if (
    invalid ||
    !!unit === !!encounter ||
    !isStartingGun(gun) ||
    (p.has('mirror') && !['0', '1'].includes(p.get('mirror')!))
  )
    return null;
  if (unit && !['runner', 'shooter', 'flyer'].includes(unit)) return null;
  if (encounter && !isEnemyEncounter(encounter)) return null;
  return {
    version: 6,
    seed:
      'RF-C93-' +
      (unit ? 'BEHAVIOR-' + unit : 'PATROL-' + encounter) +
      (p.get('mirror') === '1' ? '-MIRROR' : ''),
    stage: unit
      ? { runner: 2, shooter: 5, flyer: 8 }[unit as RemasteredEnemy]
      : ENEMY_ENCOUNTERS[encounter as EnemyEncounterId].stage,
    startingGun: gun,
    hp: 100,
    mods: [],
    kills: 0,
    elapsed: 0,
    encounters: 1,
  };
}
