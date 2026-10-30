import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Level } from './levels.ts';
import type { Checkpoint } from './rules.ts';
import { huntLevel, HUNTS, type HuntKind } from './hunt-rules.ts';
import { isStartingGun, type StartingGun } from './starting-guns.ts';

export const CONTRACT_UNITS = ['cableweaver', 'bulwark', 'demolisher'] as const;
export const CONTRACT_SCENES = [
  'animations',
  'reactions',
  'shutdowns',
  'wreckage',
  'mechanisms',
] as const;
export type ContractUnit = (typeof CONTRACT_UNITS)[number];
export type ContractScene = (typeof CONTRACT_SCENES)[number];
export interface ContractMachinesTest {
  unit: ContractUnit;
  scene: ContractScene;
  gun: StartingGun;
  checkpoint: Checkpoint;
}
export function contractMachinesTestFromUrl(url: URL): ContractMachinesTest | null {
  const p = url.searchParams;
  let invalid = !!url.hash;
  p.forEach((_, key) => {
    if (!['test', 'unit', 'scene', 'gun', 'v'].includes(key) || p.getAll(key).length !== 1)
      invalid = true;
  });
  const unit = p.get('unit') ?? 'cableweaver',
    scene = p.get('scene') ?? 'animations',
    gun = p.get('gun') ?? 'pistol';
  if (
    invalid ||
    p.get('test') !== 'contract-machines' ||
    p.get('v') !== '1' ||
    !(CONTRACT_UNITS as readonly string[]).includes(unit) ||
    !(CONTRACT_SCENES as readonly string[]).includes(scene) ||
    !isStartingGun(gun)
  )
    return null;
  return {
    unit: unit as ContractUnit,
    scene: scene as ContractScene,
    gun,
    checkpoint: {
      version: 6,
      seed: `RF-C109-CM-${CONTRACT_UNITS.indexOf(unit as ContractUnit)}-${CONTRACT_SCENES.indexOf(scene as ContractScene)}-${gun}`,
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
export function contractMachinesTestRoom(test: ContractMachinesTest): Level {
  const room = huntLevel(test.unit as HuntKind);
  return {
    ...room,
    id: `contract-${test.unit}-${test.scene}`,
    name: `${HUNTS[test.unit].arena} inspection`,
    setpiece: { rosters: [], props: [], cargo: [], weak: [] },
  };
}
/** Private starting conditions only. Hunt AI, gear, armor, damage and cleanup stay native. */
export function prepareContractMachinesTest(g: Game, test: ContractMachinesTest | null): boolean {
  if (
    !test ||
    g.seed !== test.checkpoint.seed ||
    g.testRun?.seed !== test.checkpoint.seed ||
    g.level.id !== contractMachinesTestRoom(test).id ||
    g.level.hunt !== test.unit
  )
    return false;
  const waiting = g.waves.doors.filter((d) => d.state !== 'spent').map((d) => d.spawn);
  g.waves.clear();
  for (const s of waiting)
    g.spawnEnemy(s.kind, s.x, s.y, s.elite, undefined, undefined, s.mutation, s.machineVariant);
  if (!g.enemies.some((e) => e.kind === test.unit)) return false;
  Matter.Body.setPosition(g.player, { x: 1000, y: 722 });
  Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  g.grounded = false;
  return true;
}
export const CONTRACT_NAMES: Record<ContractUnit, string> = {
  cableweaver: 'Cableweaver',
  bulwark: 'Bulwark',
  demolisher: 'Demolisher',
};
export const CONTRACT_SCENE_NAMES: Record<ContractScene, string> = {
  animations: 'Animations',
  reactions: 'Damage reactions',
  shutdowns: 'Shutdowns',
  wreckage: 'Wreckage',
  mechanisms: 'Gear counterplay',
};
export function contractMachinesTestHint(test: ContractMachinesTest): string {
  const subject =
    test.unit === 'cableweaver'
      ? 'Watch the cable drums and anchor launcher. Jump live cables and shoot an anchor to cut the circuit.'
      : test.unit === 'bulwark'
        ? 'Watch the hydraulic braces and shield plates. Shots push and break the real plates; get above them to reach the core.'
        : 'Watch the charge loader and arming rack. Shoot planted charges to disarm them, or leave the marked blast radius before the fuse expires.';
  return (
    subject +
    (['shutdowns', 'wreckage'].includes(test.scene)
      ? ' An upgraded tool helps inspect shutdowns and brief inert wreckage.'
      : '') +
    ' R restarts this private test. Saved progress stays untouched.'
  );
}
