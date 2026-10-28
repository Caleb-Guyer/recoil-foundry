import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Level, Spawn } from './levels.ts';
import type { Checkpoint } from './rules.ts';
import { isStartingGun, type StartingGun } from './starting-guns.ts';

export const BREAKDOWN_SCENES = [
  'animations',
  'reactions',
  'shutdowns',
  'wreckage',
  'elites',
] as const;
export const BREAKDOWN_UNITS = ['all', 'runner', 'shooter', 'flyer'] as const;
export const BREAKDOWN_VARIANTS = [
  'plain',
  'mixed',
  'shielded',
  'twin',
  'volatile',
  'mutations',
  'squad',
] as const;
export type BreakdownScene = (typeof BREAKDOWN_SCENES)[number];
export interface MachineBreakdownTest {
  scene: BreakdownScene;
  unit: (typeof BREAKDOWN_UNITS)[number];
  variant: (typeof BREAKDOWN_VARIANTS)[number];
  gun: StartingGun;
  checkpoint: Checkpoint;
}
export function machineBreakdownTestFromUrl(url: URL): MachineBreakdownTest | null {
  const p = url.searchParams;
  let invalid = !!url.hash;
  p.forEach((_, key) => {
    if (
      !['test', 'scene', 'unit', 'variant', 'gun', 'v'].includes(key) ||
      p.getAll(key).length !== 1
    )
      invalid = true;
  });
  const scene = p.get('scene') ?? 'animations',
    unit = p.get('unit') ?? 'all';
  const variant =
    p.get('variant') ?? (scene === 'elites' || scene === 'reactions' ? 'mixed' : 'plain');
  const gun = p.get('gun') ?? 'pistol';
  if (
    invalid ||
    p.get('test') !== 'machine-breakdown' ||
    p.get('v') !== '1' ||
    !(BREAKDOWN_SCENES as readonly string[]).includes(scene) ||
    !(BREAKDOWN_UNITS as readonly string[]).includes(unit) ||
    !(BREAKDOWN_VARIANTS as readonly string[]).includes(variant) ||
    !isStartingGun(gun) ||
    (variant === 'squad' && unit !== 'all')
  )
    return null;
  const mods =
    scene === 'shutdowns' || scene === 'wreckage'
      ? ['magnum', 'rapid', 'scatter', 'pierce', 'burst']
      : [];
  return {
    scene: scene as BreakdownScene,
    unit: unit as MachineBreakdownTest['unit'],
    variant: variant as MachineBreakdownTest['variant'],
    gun,
    checkpoint: {
      version: 6,
      seed: `RF-C108-MB-${BREAKDOWN_SCENES.indexOf(scene as BreakdownScene)}-${BREAKDOWN_UNITS.indexOf(unit as MachineBreakdownTest['unit'])}-${BREAKDOWN_VARIANTS.indexOf(variant as MachineBreakdownTest['variant'])}-${gun}`,
      stage: 10,
      startingGun: gun,
      mods,
      hp: 100,
      kills: 0,
      elapsed: 0,
    },
  };
}
export function machineBreakdownTestRoom(test: MachineBreakdownTest): Level {
  const kinds: ('runner' | 'shooter' | 'flyer')[] =
    test.unit === 'all' ? ['runner', 'shooter', 'flyer'] : [test.unit];
  const spawns: Spawn[] = kinds.map((kind) => {
    const x = kind === 'runner' ? 680 : kind === 'shooter' ? 980 : 1190;
    const spawn: Spawn = { kind, x, y: kind === 'runner' ? 723 : kind === 'shooter' ? 524 : 395 };
    if (test.variant === 'mixed') {
      if (kind === 'runner') spawn.elite = 'shielded';
      else if (test.scene === 'elites') spawn.elite = kind === 'shooter' ? 'twin' : 'volatile';
    } else if (['shielded', 'twin', 'volatile'].includes(test.variant))
      spawn.elite = test.variant as 'shielded' | 'twin' | 'volatile';
    else if (test.variant === 'mutations')
      spawn.mutation = kind === 'runner' ? 'splitter' : kind === 'shooter' ? 'gunner' : 'blinker';
    else if (test.variant === 'squad' && kind !== 'runner')
      spawn.squad = { kind: 'flank', role: kind === 'shooter' ? 'lead' : 'support' };
    return spawn;
  });
  // A real distant guard keeps the native private room alive while early wrecks settle.
  spawns.push({ kind: 'shooter', x: 1870, y: 354 });
  return {
    id: `machine-breakdown-${test.scene}-${test.unit}-${test.variant}`,
    name: 'Machine inspection floor',
    area: 'reclamation',
    mirrored: false,
    boss: false,
    remastered: true,
    ...(test.variant === 'squad' ? { security: true as const } : {}),
    solids: [
      { x: 340, y: 650, w: 150, h: 90 },
      { x: 800, y: 540, w: 400, h: 22 },
      { x: 1230, y: 640, w: 180, h: 100 },
      { x: 1630, y: 370, w: 300, h: 22 },
    ],
    spawns,
    route: [
      { x: 140, y: 722 },
      { x: 530, y: 722 },
      { x: 910, y: 522 },
      { x: 1120, y: 722 },
      { x: 1390, y: 622 },
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
      props: [{ kind: 'cover', x: 1490, y: 697 }],
    },
  };
}
export function prepareMachineBreakdownTest(g: Game, test: MachineBreakdownTest | null): boolean {
  if (
    !test ||
    g.seed !== test.checkpoint.seed ||
    g.testRun?.seed !== test.checkpoint.seed ||
    g.level.id !== machineBreakdownTestRoom(test).id
  )
    return false;
  // Inspection opens the authored native cohorts together, without waiting for kills.
  const waiting = g.waves.doors.filter((d) => d.state !== 'spent').map((d) => d.spawn);
  g.waves.clear();
  for (const spawn of waiting)
    g.spawnEnemy(
      spawn.kind,
      spawn.x,
      spawn.y,
      spawn.elite,
      undefined,
      g.level.security ? spawn.squad : undefined,
      spawn.mutation,
      spawn.machineVariant,
    );
  Matter.Body.setPosition(g.player, { x: 470, y: 722 });
  Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  g.grounded = false;
  return true;
}
export const BREAKDOWN_TEST_COPY: Record<BreakdownScene, { title: string; hint: string }> = {
  animations: {
    title: 'Enemy animations',
    hint: 'Watch runner drives, gunner braces and flyer rotors through native patrols and attacks. R restarts this private room.',
  },
  reactions: {
    title: 'Damage reactions',
    hint: 'Compare armor hits from the front with actual chassis damage from behind. Existing warnings remain dangerous. R restarts.',
  },
  shutdowns: {
    title: 'Machine shutdowns',
    hint: 'Use the fitted upgraded pistol to dismantle the three machine families. A distant guard keeps the room active while they shut down.',
  },
  wreckage: {
    title: 'Settling wreckage',
    hint: 'Defeat a machine over a real deck or floor; its brief wreck cannot block you or your shots. R restarts.',
  },
  elites: {
    title: 'Elite variants',
    hint: 'Compare shielded, twin and volatile mechanisms with the new chassis. Their native warnings and strengths still apply. R restarts.',
  },
};
