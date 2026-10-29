import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Level, Spawn } from './levels.ts';
import type { Checkpoint } from './rules.ts';
import { ENEMY_STATS } from './enemies.ts';
import { isStartingGun, type StartingGun } from './starting-guns.ts';

export const DISTRICT_UNITS = ['borer', 'sifter', 'skimmer'] as const;
export const DISTRICT_SCENES = [
  'animations',
  'reactions',
  'shutdowns',
  'wreckage',
  'mechanisms',
] as const;
export type DistrictUnit = (typeof DISTRICT_UNITS)[number];
export type DistrictScene = (typeof DISTRICT_SCENES)[number];
export interface DistrictMachinesTest {
  unit: DistrictUnit;
  scene: DistrictScene;
  gun: StartingGun;
  checkpoint: Checkpoint;
}
export function districtMachinesTestFromUrl(url: URL): DistrictMachinesTest | null {
  const p = url.searchParams;
  let invalid = !!url.hash;
  p.forEach((_, key) => {
    if (!['test', 'unit', 'scene', 'gun', 'v'].includes(key) || p.getAll(key).length !== 1)
      invalid = true;
  });
  const unit = p.get('unit') ?? 'borer',
    scene = p.get('scene') ?? 'animations',
    gun = p.get('gun') ?? 'pistol';
  if (
    invalid ||
    p.get('test') !== 'district-machines' ||
    p.get('v') !== '1' ||
    !(DISTRICT_UNITS as readonly string[]).includes(unit) ||
    !(DISTRICT_SCENES as readonly string[]).includes(scene) ||
    !isStartingGun(gun)
  )
    return null;
  return {
    unit: unit as DistrictUnit,
    scene: scene as DistrictScene,
    gun,
    checkpoint: {
      version: 6,
      seed: `RF-C108-DM-${DISTRICT_UNITS.indexOf(unit as DistrictUnit)}-${DISTRICT_SCENES.indexOf(scene as DistrictScene)}-${gun}`,
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
export function districtMachinesTestRoom(test: DistrictMachinesTest): Level {
  const elevated = test.scene === 'wreckage',
    floor = elevated ? 550 : 740,
    x = elevated ? 920 : 820;
  const flying = test.unit !== 'borer';
  const spawns: Spawn[] = [
    { kind: test.unit, x, y: flying ? floor - 130 : floor - ENEMY_STATS[test.unit].h / 2 },
    { kind: 'shooter', x: 1870, y: 354 },
  ];
  return {
    id: `district-${test.unit}-${test.scene}`,
    name: 'District machines inspection floor',
    area: test.unit === 'skimmer' ? 'cooling' : 'reclamation',
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
      props:
        test.scene === 'mechanisms' || (test.unit === 'borer' && test.scene === 'animations')
          ? [{ kind: 'crate', x: x - 110, y: floor - 23 }]
          : [],
    },
  };
}
/** Private initial conditions only. Native cover selection, hover, aiming and volleys run normally. */
export function prepareDistrictMachinesTest(g: Game, test: DistrictMachinesTest | null): boolean {
  if (
    !test ||
    g.seed !== test.checkpoint.seed ||
    g.testRun?.seed !== test.checkpoint.seed ||
    g.level.id !== districtMachinesTestRoom(test).id
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
export const DISTRICT_NAMES: Record<DistrictUnit, string> = {
  borer: 'Borer',
  sifter: 'Sifter',
  skimmer: 'Skimmer',
};
export const DISTRICT_SCENE_NAMES: Record<DistrictScene, string> = {
  animations: 'Animations',
  reactions: 'Damage reactions',
  shutdowns: 'Shutdowns',
  wreckage: 'Wreckage',
  mechanisms: 'Native mechanisms',
};
export function districtMachinesTestHint(test: DistrictMachinesTest): string {
  const subject =
    test.unit === 'borer'
      ? ['animations', 'mechanisms'].includes(test.scene)
        ? 'Watch the tracked Borer brace behind real loose cover and fire its compact volley. Break the crate to change its firing position.'
        : 'Watch the Borer drive, brace and cycle its receiver around actual compact volleys.'
      : test.unit === 'sifter'
        ? 'Watch the Sifter bank, work its fans and open its ports for a real wide volley. Its firing lanes keep their native warnings.'
        : 'Watch the Skimmer impeller and louvers track, lock and recoil on actual volleys. Leave its committed firing lanes.';
  return (
    subject +
    (['shutdowns', 'wreckage'].includes(test.scene)
      ? ' An upgraded tool helps inspect shutdowns.'
      : '') +
    ' R restarts this private test. Saved progress stays untouched.'
  );
}
