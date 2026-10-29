import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Level, Spawn } from './levels.ts';
import type { Checkpoint } from './rules.ts';
import { ENEMY_STATS } from './enemies.ts';
import { isStartingGun, type StartingGun } from './starting-guns.ts';

export const SURFACE_UNITS = ['angler', 'wallcrawler'] as const;
export const SURFACE_SCENES = [
  'animations',
  'reactions',
  'shutdowns',
  'wreckage',
  'mechanisms',
] as const;
export const SURFACE_FACES = ['floor', 'wall', 'ceiling'] as const;
export type SurfaceUnit = (typeof SURFACE_UNITS)[number];
export type SurfaceScene = (typeof SURFACE_SCENES)[number];
export type SurfaceFace = (typeof SURFACE_FACES)[number];
export interface SurfaceMachinesTest {
  unit: SurfaceUnit;
  scene: SurfaceScene;
  gun: StartingGun;
  face: SurfaceFace;
  checkpoint: Checkpoint;
}
export function surfaceMachinesTestFromUrl(url: URL): SurfaceMachinesTest | null {
  const p = url.searchParams;
  let invalid = !!url.hash;
  p.forEach((_, key) => {
    if (!['test', 'unit', 'scene', 'gun', 'face', 'v'].includes(key) || p.getAll(key).length !== 1)
      invalid = true;
  });
  const unit = p.get('unit') ?? 'angler',
    scene = p.get('scene') ?? 'animations',
    gun = p.get('gun') ?? 'pistol',
    face =
      p.get('face') ??
      (unit === 'wallcrawler' && ['wreckage', 'mechanisms'].includes(scene)
        ? 'ceiling'
        : unit === 'wallcrawler'
          ? 'wall'
          : 'floor');
  if (
    invalid ||
    p.get('test') !== 'surface-machines' ||
    p.get('v') !== '1' ||
    !(SURFACE_UNITS as readonly string[]).includes(unit) ||
    !(SURFACE_SCENES as readonly string[]).includes(scene) ||
    !(SURFACE_FACES as readonly string[]).includes(face) ||
    (unit !== 'wallcrawler' && p.has('face')) ||
    !isStartingGun(gun)
  )
    return null;
  return {
    unit: unit as SurfaceUnit,
    scene: scene as SurfaceScene,
    gun,
    face: face as SurfaceFace,
    checkpoint: {
      version: 6,
      seed: `RF-C108-SM-${SURFACE_UNITS.indexOf(unit as SurfaceUnit)}-${SURFACE_SCENES.indexOf(scene as SurfaceScene)}-${SURFACE_FACES.indexOf(face as SurfaceFace)}-${gun}`,
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
export function surfaceMachinesTestRoom(test: SurfaceMachinesTest): Level {
  const angler = test.unit === 'angler',
    elevated = angler && test.scene === 'wreckage',
    floor = elevated ? 610 : 740;
  const subject = angler
    ? { x: 1000, y: floor - ENEMY_STATS.angler.h / 2 }
    : test.face === 'floor'
      ? { x: 1000, y: 493 }
      : test.face === 'ceiling'
        ? { x: 1000, y: 607 }
        : { x: 773, y: 550 };
  const spawns: Spawn[] = [
    { kind: test.unit, ...subject },
    { kind: 'shooter', x: 1870, y: 354 },
  ];
  return {
    id: `surface-${test.unit}-${test.scene}-${test.face}`,
    name: 'Surface machinery inspection floor',
    area: 'furnace',
    boss: false,
    mirrored: false,
    remastered: true,
    solids: angler
      ? [
          { x: 330, y: 350, w: 1000, h: 22 },
          { x: 690, y: floor - 125, w: 100, h: 125 },
          ...(elevated ? [{ x: 220, y: 610, w: 1100, h: 22 }] : []),
          { x: 1630, y: 370, w: 300, h: 22 },
        ]
      : [
          { x: 790, y: 510, w: 420, h: 80 },
          { x: 1630, y: 370, w: 300, h: 22 },
        ],
    spawns,
    route: [
      { x: 140, y: 722 },
      { x: 450, y: floor - 18 },
      { x: 1300, y: floor - 18 },
      { x: 1840, y: 352 },
    ],
    hazards: [],
    vents: [],
    fans: [],
    coolant: [],
    counterweights: [],
    setpiece: { rosters: [spawns.map((_, i) => i)], weak: [0], props: [] },
  };
}
/** Private initial conditions only. Bank planning, attached motion, grip loss and shots stay native. */
export function prepareSurfaceMachinesTest(g: Game, test: SurfaceMachinesTest | null): boolean {
  if (
    !test ||
    g.seed !== test.checkpoint.seed ||
    g.testRun?.seed !== test.checkpoint.seed ||
    g.level.id !== surfaceMachinesTestRoom(test).id
  )
    return false;
  const waiting = g.waves.doors.filter((d) => d.state !== 'spent').map((d) => d.spawn);
  g.waves.clear();
  for (const s of waiting)
    g.spawnEnemy(s.kind, s.x, s.y, s.elite, undefined, undefined, s.mutation, s.machineVariant);
  Matter.Body.setPosition(g.player, {
    x: 450,
    y: test.unit === 'angler' && test.scene === 'wreckage' ? 592 : 722,
  });
  Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  g.grounded = false;
  return true;
}
export const SURFACE_NAMES: Record<SurfaceUnit, string> = {
  angler: 'Angler',
  wallcrawler: 'Wallcrawler',
};
export const SURFACE_SCENE_NAMES: Record<SurfaceScene, string> = {
  animations: 'Animations',
  reactions: 'Damage reactions',
  shutdowns: 'Shutdowns',
  wreckage: 'Wreckage',
  mechanisms: 'Breakable surfaces',
};
export function surfaceMachinesTestHint(test: SurfaceMachinesTest): string {
  const subject =
    test.unit === 'angler'
      ? 'Watch the stance, bank-lock hardware and real shot recoil. Break the marked overhead bank surface during its warning to interrupt the shot and expose its casing.'
      : 'Watch the gripping feet and individual shots on real terrain. Shoot the marked support to break its grip, cancel the remaining burst and expose its falling hull.';
  return (
    subject +
    (['shutdowns', 'wreckage'].includes(test.scene)
      ? ' An upgraded tool helps inspect shutdowns.'
      : '') +
    ' R restarts this private test. Saved progress stays untouched.'
  );
}
