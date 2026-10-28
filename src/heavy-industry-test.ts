import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Level, Spawn } from './levels.ts';
import type { Checkpoint } from './rules.ts';
import { ENEMY_STATS } from './enemies.ts';
import { isStartingGun, type StartingGun } from './starting-guns.ts';
import { isMachineVariant, MACHINE_VARIANTS, type MachineVariant } from './patrol-machines.ts';

export const HEAVY_UNITS = ['shutter', 'strider', 'mortar'] as const;
export const HEAVY_SCENES = ['animations', 'reactions', 'shutdowns', 'wreckage'] as const;
export type HeavyUnit = (typeof HEAVY_UNITS)[number];
export type HeavyScene = (typeof HEAVY_SCENES)[number];
export interface HeavyIndustryTest {
  unit: HeavyUnit;
  scene: HeavyScene;
  variant: 'plain' | MachineVariant;
  gun: StartingGun;
  checkpoint: Checkpoint;
}
export function heavyIndustryTestFromUrl(url: URL): HeavyIndustryTest | null {
  const p = url.searchParams;
  let invalid = !!url.hash;
  p.forEach((_, key) => {
    if (
      !['test', 'unit', 'scene', 'variant', 'gun', 'v'].includes(key) ||
      p.getAll(key).length !== 1
    )
      invalid = true;
  });
  const unit = p.get('unit') ?? 'shutter',
    scene = p.get('scene') ?? 'animations',
    variant = p.get('variant') ?? 'plain',
    gun = p.get('gun') ?? 'pistol';
  if (
    invalid ||
    p.get('test') !== 'heavy-industry' ||
    p.get('v') !== '1' ||
    !(HEAVY_UNITS as readonly string[]).includes(unit) ||
    !(HEAVY_SCENES as readonly string[]).includes(scene) ||
    (variant !== 'plain' &&
      (!isMachineVariant(variant) || MACHINE_VARIANTS[variant].kind !== unit)) ||
    !isStartingGun(gun)
  )
    return null;
  const variantIndex = variant === 'plain' ? 0 : Object.keys(MACHINE_VARIANTS).indexOf(variant) + 1;
  return {
    unit: unit as HeavyUnit,
    scene: scene as HeavyScene,
    variant: variant as 'plain' | MachineVariant,
    gun,
    checkpoint: {
      version: 6,
      seed: `RF-C108-HI-${HEAVY_UNITS.indexOf(unit as HeavyUnit)}-${HEAVY_SCENES.indexOf(scene as HeavyScene)}-${variantIndex}-${gun}`,
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
export function heavyIndustryTestRoom(test: HeavyIndustryTest): Level {
  const elevated = test.scene === 'wreckage';
  const target: Spawn = {
    kind: test.unit,
    x: elevated ? 950 : 820,
    y: (elevated ? 550 : 740) - ENEMY_STATS[test.unit].h / 2,
    ...(test.variant !== 'plain' ? { machineVariant: test.variant } : {}),
  };
  return {
    id: `heavy-${test.unit}-${test.scene}-${test.variant}`,
    name: 'Heavy machine inspection floor',
    area: test.unit === 'shutter' ? 'docks' : test.unit === 'strider' ? 'reclamation' : 'furnace',
    boss: false,
    mirrored: false,
    remastered: true,
    solids: [
      { x: 220, y: 650, w: 150, h: 90 },
      { x: 410, y: 600, w: 180, h: 22 },
      ...(elevated
        ? [{ x: 720, y: 550, w: 440, h: 22 }]
        : test.unit === 'mortar'
          ? [{ x: 600, y: 520, w: 200, h: 22 }]
          : []),
      { x: 1190, y: 640, w: 150, h: 100 },
      { x: 1340, y: 530, w: 240, h: 22 },
      { x: 1630, y: 370, w: 300, h: 22 },
    ],
    spawns: [target, { kind: 'shooter', x: 1870, y: 354 }],
    route: [
      { x: 140, y: 722 },
      { x: 450, y: 722 },
      { x: 500, y: 582 },
      { x: 950, y: 532 },
      { x: 1450, y: 512 },
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
export function prepareHeavyIndustryTest(g: Game, test: HeavyIndustryTest | null): boolean {
  if (
    !test ||
    g.seed !== test.checkpoint.seed ||
    g.testRun?.seed !== test.checkpoint.seed ||
    g.level.id !== heavyIndustryTestRoom(test).id
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
export const HEAVY_NAMES: Record<HeavyUnit, string> = {
  shutter: 'Shutter Guard',
  strider: 'Strider',
  mortar: 'Mortar Cart',
};
export const HEAVY_SCENE_NAMES: Record<HeavyScene, string> = {
  animations: 'Animations',
  reactions: 'Damage reactions',
  shutdowns: 'Shutdowns',
  wreckage: 'Wreckage',
};
export function heavyIndustryTestHint(test: HeavyIndustryTest): string {
  const subject =
    test.unit === 'shutter'
      ? 'Watch its real shutter opening. Flank the closed front or fire during the open window.'
      : test.unit === 'strider'
        ? 'Watch walking feet settle into braces as the native firing lanes lock.'
        : 'Watch loading and recoil. Shoot the real shell, leave the landing mark or use solid cover.';
  return (
    subject +
    (test.scene === 'shutdowns' || test.scene === 'wreckage'
      ? ' An upgraded tool helps inspect defeat; a distant guard keeps the room active.'
      : '') +
    ' R restarts this private test.'
  );
}
