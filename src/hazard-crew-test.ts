import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Level, Spawn } from './levels.ts';
import type { Checkpoint } from './rules.ts';
import { ENEMY_STATS } from './enemies.ts';
import { isStartingGun, type StartingGun } from './starting-guns.ts';

export const HAZARD_UNITS = ['scrapper', 'harpooner', 'sapper'] as const;
export const HAZARD_SCENES = [
  'animations',
  'reactions',
  'shutdowns',
  'wreckage',
  'counterplay',
] as const;
export type HazardUnit = (typeof HAZARD_UNITS)[number];
export type HazardScene = (typeof HAZARD_SCENES)[number];
export interface HazardCrewTest {
  unit: HazardUnit;
  scene: HazardScene;
  gun: StartingGun;
  checkpoint: Checkpoint;
}
export function hazardCrewTestFromUrl(url: URL): HazardCrewTest | null {
  const p = url.searchParams;
  let invalid = !!url.hash;
  p.forEach((_, key) => {
    if (!['test', 'unit', 'scene', 'gun', 'v'].includes(key) || p.getAll(key).length !== 1)
      invalid = true;
  });
  const unit = p.get('unit') ?? 'scrapper',
    scene = p.get('scene') ?? 'animations',
    gun = p.get('gun') ?? 'pistol';
  if (
    invalid ||
    p.get('test') !== 'hazard-crew' ||
    p.get('v') !== '1' ||
    !(HAZARD_UNITS as readonly string[]).includes(unit) ||
    !(HAZARD_SCENES as readonly string[]).includes(scene) ||
    !isStartingGun(gun)
  )
    return null;
  return {
    unit: unit as HazardUnit,
    scene: scene as HazardScene,
    gun,
    checkpoint: {
      version: 6,
      seed: `RF-C108-HC-${HAZARD_UNITS.indexOf(unit as HazardUnit)}-${HAZARD_SCENES.indexOf(scene as HazardScene)}-${gun}`,
      stage: 8,
      startingGun: gun,
      mods: ['shutdowns', 'wreckage'].includes(scene)
        ? ['magnum', 'rapid', 'scatter', 'pierce', 'burst']
        : [],
      hp: 100,
      kills: 0,
      elapsed: 0,
      encounters: 1,
    },
  };
}
export function hazardCrewTestRoom(test: HazardCrewTest): Level {
  const elevated = test.scene === 'wreckage',
    floor = elevated ? 550 : 740,
    x = elevated ? 920 : 820;
  const spawns: Spawn[] = [
    { kind: test.unit, x, y: floor - ENEMY_STATS[test.unit].h / 2 },
    { kind: 'shooter', x: 1870, y: 354 },
  ];
  return {
    id: `hazard-${test.unit}-${test.scene}`,
    name: 'Hazard crew inspection floor',
    area: 'reclamation',
    boss: false,
    mirrored: false,
    remastered: true,
    solids: [
      ...(elevated ? [{ x: 220, y: 550, w: 1100, h: 22 }] : []),
      { x: 1450, y: 640, w: 100, h: 100 },
      { x: 1630, y: 370, w: 300, h: 22 },
    ],
    spawns,
    route: [
      { x: 140, y: 722 },
      { x: 450, y: floor - 18 },
      { x: 900, y: floor - 18 },
      { x: 1300, y: floor - 18 },
      { x: 1840, y: 352 },
    ],
    hazards: [],
    vents: [],
    fans: [],
    coolant: [],
    counterweights: [],
    setpiece: {
      rosters: [spawns.map((_, i) => i)],
      weak: [],
      props: test.unit === 'scrapper' ? [{ kind: 'crate', x: x - 110, y: floor - 23 }] : [],
    },
  };
}
/** Private initial conditions only: all grabs, launches and planted charges use native controllers. */
export function prepareHazardCrewTest(g: Game, test: HazardCrewTest | null): boolean {
  if (
    !test ||
    g.seed !== test.checkpoint.seed ||
    g.testRun?.seed !== test.checkpoint.seed ||
    g.level.id !== hazardCrewTestRoom(test).id
  )
    return false;
  const waiting = g.waves.doors.filter((d) => d.state !== 'spent').map((d) => d.spawn);
  g.waves.clear();
  for (const s of waiting)
    g.spawnEnemy(s.kind, s.x, s.y, s.elite, undefined, undefined, s.mutation, s.machineVariant);
  Matter.Body.setPosition(g.player, { x: 450, y: test.scene === 'wreckage' ? 532 : 722 });
  Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  g.grounded = false;
  return true;
}
export const HAZARD_NAMES: Record<HazardUnit, string> = {
  scrapper: 'Scrapper',
  harpooner: 'Harpooner',
  sapper: 'Sapper',
};
export const HAZARD_SCENE_NAMES: Record<HazardScene, string> = {
  animations: 'Animations',
  reactions: 'Damage reactions',
  shutdowns: 'Shutdowns',
  wreckage: 'Wreckage',
  counterplay: 'Interrupted mechanisms',
};
export function hazardCrewTestHint(test: HazardCrewTest): string {
  const subject =
    test.unit === 'scrapper'
      ? 'Watch the clamp grip, lift and throw its real crate. Shoot the held crate to break its grip.'
      : test.unit === 'harpooner'
        ? 'Watch the winch launch and reel its real cable. Shoot the yellow anchor when it latches to break the line.'
        : 'Watch the launcher load and eject real charges. Shoot an attached charge to knock it loose; its fuse keeps running.';
  return (
    subject +
    (['shutdowns', 'wreckage'].includes(test.scene)
      ? ' An upgraded tool helps inspect shutdowns.'
      : '') +
    ' R restarts this private test. Saved progress stays untouched.'
  );
}
