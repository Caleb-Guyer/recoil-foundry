import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Level, Spawn } from './levels.ts';
import type { Checkpoint } from './rules.ts';
import { isStartingGun, type StartingGun } from './starting-guns.ts';

export const SPECIALIST_UNITS = ['charger', 'hopper', 'sniper'] as const;
export const SPECIALIST_SCENES = ['animations', 'reactions', 'shutdowns', 'wreckage'] as const;
export type SpecialistUnit = (typeof SPECIALIST_UNITS)[number];
export type SpecialistScene = (typeof SPECIALIST_SCENES)[number];
export interface SpecialistMachineTest {
  unit: SpecialistUnit;
  scene: SpecialistScene;
  elite: 'plain' | 'twin';
  gun: StartingGun;
  checkpoint: Checkpoint;
}
export function specialistMachineTestFromUrl(url: URL): SpecialistMachineTest | null {
  const p = url.searchParams;
  let invalid = !!url.hash;
  p.forEach((_, key) => {
    if (!['test', 'unit', 'scene', 'elite', 'gun', 'v'].includes(key) || p.getAll(key).length !== 1)
      invalid = true;
  });
  const unit = p.get('unit') ?? 'charger',
    scene = p.get('scene') ?? 'animations';
  const elite = p.get('elite') ?? 'plain',
    gun = p.get('gun') ?? 'pistol';
  if (
    invalid ||
    p.get('test') !== 'specialists' ||
    p.get('v') !== '1' ||
    !(SPECIALIST_UNITS as readonly string[]).includes(unit) ||
    !(SPECIALIST_SCENES as readonly string[]).includes(scene) ||
    !['plain', 'twin'].includes(elite) ||
    (elite === 'twin' && unit !== 'sniper') ||
    !isStartingGun(gun)
  )
    return null;
  return {
    unit: unit as SpecialistUnit,
    scene: scene as SpecialistScene,
    elite: elite as 'plain' | 'twin',
    gun,
    checkpoint: {
      version: 6,
      seed: `RF-C108-SM-${SPECIALIST_UNITS.indexOf(unit as SpecialistUnit)}-${SPECIALIST_SCENES.indexOf(scene as SpecialistScene)}-${elite === 'twin' ? 1 : 0}-${gun}`,
      stage: 8,
      startingGun: gun,
      mods:
        scene === 'shutdowns' || scene === 'wreckage'
          ? ['magnum', 'rapid', 'scatter', 'pierce', 'burst']
          : [],
      hp: 100,
      kills: 0,
      elapsed: 0,
    },
  };
}
export function specialistMachineTestRoom(test: SpecialistMachineTest): Level {
  const elevated = test.scene === 'wreckage' && test.unit !== 'charger';
  const target: Spawn = {
    kind: test.unit,
    x: elevated ? 950 : 820,
    y: elevated ? 534 : 724,
    ...(test.elite === 'twin' ? { elite: 'twin' as const } : {}),
  };
  const solids =
    test.unit === 'charger'
      ? [
          { x: 220, y: 660, w: 150, h: 80 },
          { x: 1030, y: 660, w: 120, h: 80 },
          { x: 1150, y: 590, w: 360, h: 22 },
          { x: 1630, y: 370, w: 300, h: 22 },
        ]
      : test.unit === 'hopper'
        ? [
            { x: 280, y: 650, w: 120, h: 90 },
            { x: 470, y: 600, w: 240, h: 22 },
            { x: 720, y: 550, w: 380, h: 22 },
            { x: 1220, y: 470, w: 220, h: 22 },
            { x: 1630, y: 370, w: 300, h: 22 },
          ]
        : [
            { x: 280, y: 650, w: 140, h: 90 },
            { x: 470, y: 600, w: 180, h: 22 },
            { x: 720, y: 550, w: 380, h: 22 },
            { x: 1190, y: 640, w: 150, h: 100 },
            { x: 1630, y: 370, w: 300, h: 22 },
          ];
  return {
    id: `specialists-${test.unit}-${test.scene}-${test.elite}`,
    name: 'Specialist inspection floor',
    area: test.unit === 'charger' ? 'furnace' : test.unit === 'hopper' ? 'cooling' : 'reclamation',
    boss: false,
    mirrored: false,
    remastered: true,
    solids,
    spawns: [target, { kind: 'shooter', x: 1870, y: 354 }],
    route: [
      { x: 140, y: 722 },
      { x: 470, y: 722 },
      { x: 620, y: 582 },
      { x: 890, y: 532 },
      { x: 1300, y: 452 },
      { x: 1840, y: 352 },
    ],
    hazards: [],
    vents: [],
    fans: [],
    coolant: [],
    counterweights: [],
    setpiece: { rosters: [[0, 1]], weak: [], props: [] },
  };
}
export function prepareSpecialistMachineTest(g: Game, test: SpecialistMachineTest | null): boolean {
  if (
    !test ||
    g.seed !== test.checkpoint.seed ||
    g.testRun?.seed !== test.checkpoint.seed ||
    g.level.id !== specialistMachineTestRoom(test).id
  )
    return false;
  const waiting = g.waves.doors.filter((d) => d.state !== 'spent').map((d) => d.spawn);
  g.waves.clear();
  for (const spawn of waiting)
    g.spawnEnemy(
      spawn.kind,
      spawn.x,
      spawn.y,
      spawn.elite,
      undefined,
      undefined,
      spawn.mutation,
      spawn.machineVariant,
    );
  Matter.Body.setPosition(g.player, { x: 450, y: 722 });
  Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  g.grounded = false;
  return true;
}
export const SPECIALIST_NAMES: Record<SpecialistUnit, string> = {
  charger: 'Charger',
  hopper: 'Hopper',
  sniper: 'Sniper',
};
export const SPECIALIST_SCENE_NAMES: Record<SpecialistScene, string> = {
  animations: 'Animations',
  reactions: 'Damage reactions',
  shutdowns: 'Shutdowns',
  wreckage: 'Wreckage',
};
export function specialistMachineTestHint(test: SpecialistMachineTest): string {
  const subject =
    test.unit === 'charger'
      ? 'Bait the ram into a wall; compare impact recovery with a spent charge.'
      : test.unit === 'hopper'
        ? 'Climb the supported decks to watch spring loading, flight and real landings.'
        : test.elite === 'twin'
          ? 'Watch both native lock-and-fire cycles, then the shared recovery.'
          : 'Watch tracking, the committed firing lock and breech recovery.';
  return (
    subject +
    (test.scene === 'shutdowns' || test.scene === 'wreckage'
      ? ' An upgraded pistol helps inspect defeat; a distant guard keeps the room active.'
      : '') +
    ' R restarts this private test.'
  );
}
