import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Level, Spawn } from './levels.ts';
import type { Checkpoint } from './rules.ts';
import { ENEMY_STATS } from './enemies.ts';
import { isStartingGun, type StartingGun } from './starting-guns.ts';

export const SUPPORT_UNITS = ['repairer', 'relay', 'fabricator', 'sentry'] as const;
export const SUPPORT_SCENES = [
  'animations',
  'reactions',
  'shutdowns',
  'wreckage',
  'interruptions',
  'power-loss',
] as const;
export type SupportUnit = (typeof SUPPORT_UNITS)[number];
export type SupportScene = (typeof SUPPORT_SCENES)[number];
export interface SupportSystemsTest {
  unit: SupportUnit;
  scene: SupportScene;
  gun: StartingGun;
  checkpoint: Checkpoint;
}
export function supportSystemsTestFromUrl(url: URL): SupportSystemsTest | null {
  const p = url.searchParams;
  let invalid = !!url.hash;
  p.forEach((_, key) => {
    if (!['test', 'unit', 'scene', 'gun', 'v'].includes(key) || p.getAll(key).length !== 1)
      invalid = true;
  });
  const unit = p.get('unit') ?? 'repairer',
    scene = p.get('scene') ?? 'animations',
    gun = p.get('gun') ?? 'pistol';
  if (
    invalid ||
    p.get('test') !== 'support-systems' ||
    p.get('v') !== '1' ||
    !(SUPPORT_UNITS as readonly string[]).includes(unit) ||
    !(SUPPORT_SCENES as readonly string[]).includes(scene) ||
    (['interruptions', 'power-loss'].includes(scene) &&
      unit !== 'fabricator' &&
      unit !== 'sentry') ||
    !isStartingGun(gun)
  )
    return null;
  return {
    unit: unit as SupportUnit,
    scene: scene as SupportScene,
    gun,
    checkpoint: {
      version: 6,
      seed: `RF-C108-SS-${SUPPORT_UNITS.indexOf(unit as SupportUnit)}-${SUPPORT_SCENES.indexOf(scene as SupportScene)}-${gun}`,
      stage: 8,
      startingGun: gun,
      mods: ['shutdowns', 'wreckage', 'power-loss'].includes(scene)
        ? ['magnum', 'rapid', 'scatter', 'pierce', 'burst']
        : [],
      hp: 100,
      kills: 0,
      elapsed: 0,
      encounters: 1,
      teamwork: 1,
      fabricators: true,
    },
  };
}
export function supportSystemsTestRoom(test: SupportSystemsTest): Level {
  const floating = test.unit === 'repairer' || test.unit === 'relay',
    elevated = test.scene === 'wreckage';
  const floor = elevated ? 550 : 740;
  const spawns: Spawn[] = floating
    ? [
        { kind: test.unit, x: 820, y: elevated ? 420 : 610 },
        { kind: 'shooter', x: 1020, y: floor - 16 },
      ]
    : [
        {
          kind: 'fabricator',
          x: test.unit === 'sentry' ? 1080 : 920,
          y: floor - ENEMY_STATS.fabricator.h / 2,
        },
      ];
  spawns.push({ kind: 'shooter', x: 1870, y: 354 });
  return {
    id: `support-${test.unit}-${test.scene}`,
    name: 'Support systems inspection floor',
    area: floating ? 'cooling' : 'reclamation',
    boss: false,
    mirrored: false,
    remastered: true,
    solids: [
      { x: 220, y: 650, w: 150, h: 90 },
      { x: 410, y: 600, w: 180, h: 22 },
      ...(elevated ? [{ x: 700, y: 550, w: 620, h: 22 }] : []),
      { x: 1450, y: 640, w: 100, h: 100 },
      { x: 1630, y: 370, w: 300, h: 22 },
    ],
    spawns,
    route: [
      { x: 140, y: 722 },
      { x: 450, y: 722 },
      { x: 500, y: 582 },
      { x: 900, y: 532 },
      { x: 1300, y: 532 },
      { x: 1840, y: 352 },
    ],
    hazards: [],
    vents: [],
    fans: [],
    coolant: [],
    counterweights: [],
    setpiece: { rosters: [spawns.map((_, i) => i)], weak: [], props: [] },
  };
}
/** Private initial conditions only. A Sentry is created/completed by its actual builder controller. */
export function prepareSupportSystemsTest(g: Game, test: SupportSystemsTest | null): boolean {
  if (
    !test ||
    g.seed !== test.checkpoint.seed ||
    g.testRun?.seed !== test.checkpoint.seed ||
    g.level.id !== supportSystemsTestRoom(test).id
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
  if (test.unit === 'repairer') {
    const patient = g.enemies.find((e) => e.kind === 'shooter' && e.body.position.x < 1400);
    if (patient) patient.hp = Math.max(1, patient.maxHp - 50);
  }
  const elevatedSentry = test.unit === 'sentry' && test.scene === 'wreckage';
  if (elevatedSentry) Matter.Body.setPosition(g.player, { x: 750, y: 532 });
  if (test.unit === 'sentry' || ['interruptions', 'power-loss'].includes(test.scene)) {
    const owner = g.enemies.find((e) => e.fabricator)!;
    if (owner && !g.enemies.some((e) => e.sentry?.owner === owner.id)) {
      owner.spawn = 0;
      owner.timer = 0;
      g.fabricators.updateBuilder(owner);
      const child = g.enemies.find((e) => e.sentry?.owner === owner.id);
      if (child && test.scene !== 'interruptions') {
        owner.timer = 0;
        g.fabricators.updateBuilder(owner);
      }
    }
  }
  if (elevatedSentry) {
    Matter.Body.setPosition(g.player, { x: 450, y: 722 });
    Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  }
  if (test.scene === 'power-loss') {
    // The real controller builds toward the original player position; then approach the builder
    // from the opposite side so its child does not intercept the inspection shot.
    Matter.Body.setPosition(g.player, { x: 1350, y: 722 });
    Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  }
  return true;
}
export const SUPPORT_NAMES: Record<SupportUnit, string> = {
  repairer: 'Repairer',
  relay: 'Relay',
  fabricator: 'Fabricator',
  sentry: 'Sentry',
};
export const SUPPORT_SCENE_NAMES: Record<SupportScene, string> = {
  animations: 'Animations',
  reactions: 'Damage reactions',
  shutdowns: 'Shutdowns',
  wreckage: 'Wreckage',
  interruptions: 'Construction interruption',
  'power-loss': 'Power-loss shutdown',
};
export function supportSystemsTestHint(test: SupportSystemsTest): string {
  const subject =
    test.scene === 'power-loss'
      ? 'Destroy the builder first to cut power to its actual owned Sentry.'
      : test.scene === 'interruptions'
        ? 'Hit the builder or destroy its unfinished frame to interrupt the actual assembly.'
        : test.unit === 'repairer'
          ? 'A wounded machine draws real repair pulses. Watch the tools and remaining repair supply; shoot across the link to interrupt it.'
          : test.unit === 'relay'
            ? 'Watch charge cells fill, discharge through actual partner shots and run out. Shoot across the link to break it.'
            : test.unit === 'fabricator'
              ? 'Watch it find a supported site and build. Hitting the builder interrupts construction; destroying it cuts power to its Sentries.'
              : 'This turret was completed by its actual builder. Watch deployment, aiming, lock and recoil; its owner remains in the room.';
  return (
    subject +
    (['shutdowns', 'wreckage', 'power-loss'].includes(test.scene)
      ? ' An upgraded tool helps inspect shutdowns.'
      : '') +
    ' R restarts this private test.'
  );
}
