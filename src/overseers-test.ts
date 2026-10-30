import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Level } from './levels.ts';
import type { Checkpoint } from './rules.ts';
import { isStartingGun, type StartingGun } from './starting-guns.ts';
import { welderPracticeLevel } from './welder-layout.ts';
import { switchboardLevel } from './switchboard-layout.ts';
import { auditorTestLevel, AUDITOR_HP } from './auditor-layout.ts';
import { getLevel } from './levels.ts';

export const OVERSEER_UNITS = ['welder', 'switchboard', 'auditor'] as const;
export const OVERSEER_SCENES = [
  'animations',
  'reactions',
  'shutdowns',
  'wreckage',
  'mechanisms',
  'recall',
] as const;
export type OverseerUnit = (typeof OVERSEER_UNITS)[number];
export type OverseerScene = (typeof OVERSEER_SCENES)[number];
export interface OverseersTest {
  unit: OverseerUnit;
  scene: OverseerScene;
  gun: StartingGun;
  checkpoint: Checkpoint;
}
export function overseersTestFromUrl(url: URL): OverseersTest | null {
  const p = url.searchParams;
  let invalid = !!url.hash;
  p.forEach((_, key) => {
    if (!['test', 'unit', 'scene', 'gun', 'v'].includes(key) || p.getAll(key).length !== 1)
      invalid = true;
  });
  const unit = p.get('unit') ?? 'welder',
    scene = p.get('scene') ?? 'animations',
    gun = p.get('gun') ?? 'pistol';
  if (
    invalid ||
    p.get('test') !== 'overseers' ||
    p.get('v') !== '1' ||
    !(OVERSEER_UNITS as readonly string[]).includes(unit) ||
    !(OVERSEER_SCENES as readonly string[]).includes(scene) ||
    !isStartingGun(gun) ||
    (scene === 'recall' && unit !== 'auditor')
  )
    return null;
  const mods = ['shutdowns', 'wreckage'].includes(scene)
    ? ['magnum', 'rapid', 'scatter', 'pierce', 'burst']
    : [];
  const stage = unit === 'switchboard' ? 11 : unit === 'auditor' ? (scene === 'recall' ? 5 : 9) : 8;
  return {
    unit: unit as OverseerUnit,
    scene: scene as OverseerScene,
    gun,
    checkpoint: {
      version: 6,
      seed: `RF-C110-FO-${OVERSEER_UNITS.indexOf(unit as OverseerUnit)}-${OVERSEER_SCENES.indexOf(scene as OverseerScene)}-${gun}`,
      stage,
      startingGun: gun,
      mods,
      hp: 100,
      kills: 0,
      elapsed: 0,
      encounters: 1,
      ...(unit === 'switchboard' ? { region: 'annex' as const, annexVersion: 5 as const } : {}),
      ...(unit === 'auditor'
        ? {
            missedUpgrades: stage + 1 - mods.length,
            auditor: {
              caseStage: 4,
              rooms: [5, 8, 9],
              status: 'hunting' as const,
              hp: AUDITOR_HP,
              visits: scene === 'recall' ? 0 : 2,
              ...(scene === 'recall' ? {} : { room: 8, retreated: true as const }),
            },
          }
        : {}),
    },
  };
}
export function overseersTestRoom(test: OverseersTest): Level {
  const native =
    test.unit === 'welder'
      ? welderPracticeLevel('WELDER-51')
      : test.unit === 'switchboard'
        ? switchboardLevel(test.checkpoint.seed, false)
        : auditorTestLevel(getLevel(test.checkpoint.seed, test.checkpoint.stage));
  return { ...native, name: `${OVERSEER_NAMES[test.unit]} inspection` };
}
/** Only the private starting placement changes; native AI, arrivals, arenas and gear stay authoritative. */
export function prepareOverseersTest(g: Game, test: OverseersTest | null): boolean {
  if (
    !test ||
    g.seed !== test.checkpoint.seed ||
    g.testRun?.seed !== test.checkpoint.seed ||
    g.level.id !== overseersTestRoom(test).id
  )
    return false;
  const waiting = g.waves.doors.filter((d) => d.state !== 'spent').map((d) => d.spawn);
  g.waves.clear();
  for (const s of waiting)
    g.spawnEnemy(s.kind, s.x, s.y, s.elite, undefined, undefined, s.mutation, s.machineVariant);
  if (test.unit === 'auditor' ? !g.auditor.scheduled : !g.enemies.some((e) => e.kind === test.unit))
    return false;
  Matter.Body.setPosition(g.player, { x: 140, y: 722 });
  Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  g.grounded = false;
  return true;
}
export const OVERSEER_NAMES: Record<OverseerUnit, string> = {
  welder: 'Welder',
  switchboard: 'Switchboard',
  auditor: 'Auditor',
};
export const OVERSEER_SCENE_NAMES: Record<OverseerScene, string> = {
  animations: 'Animations',
  reactions: 'Damage reactions',
  shutdowns: 'Shutdowns',
  wreckage: 'Wreckage',
  mechanisms: 'Counterplay',
  recall: 'Recall',
};
export function overseersTestHint(test: OverseersTest): string {
  const hint =
    test.unit === 'welder'
      ? 'Watch the tracks, articulated torch and cooling shutters. Avoid warned seams and attack during its cooling opening.'
      : test.unit === 'switchboard'
        ? 'Watch the three signal channels. Move after lock and shoot an amber junction during charge to interrupt its real transmission.'
        : test.scene === 'recall'
          ? 'The Auditor arrives through its warned door. Survive its first 18-second visit to inspect its mechanical recall; retreat is not a defeat.'
          : 'The Auditor arrives through its warned door. Watch its braced shots and committed charges; this final visit continues until an actual defeat.';
  return (
    hint +
    (['shutdowns', 'wreckage'].includes(test.scene)
      ? ' An upgraded tool helps inspect the mechanical shutdown and brief inert wreck.'
      : '') +
    ' R restarts this private test. Saved progress stays untouched.'
  );
}
