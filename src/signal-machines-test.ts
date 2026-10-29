import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Level, Spawn } from './levels.ts';
import type { Checkpoint } from './rules.ts';
import { ENEMY_STATS } from './enemies.ts';
import { isStartingGun, type StartingGun } from './starting-guns.ts';

export const SIGNAL_UNITS = ['caller', 'switchman'] as const;
export const SIGNAL_SCENES = [
  'animations',
  'reactions',
  'shutdowns',
  'wreckage',
  'mechanisms',
  'friendly',
] as const;
export type SignalUnit = (typeof SIGNAL_UNITS)[number];
export type SignalScene = (typeof SIGNAL_SCENES)[number];
export interface SignalMachinesTest {
  unit: SignalUnit;
  scene: SignalScene;
  gun: StartingGun;
  checkpoint: Checkpoint;
}
export function signalMachinesTestFromUrl(url: URL): SignalMachinesTest | null {
  const p = url.searchParams;
  let invalid = !!url.hash;
  p.forEach((_, key) => {
    if (!['test', 'unit', 'scene', 'gun', 'v'].includes(key) || p.getAll(key).length !== 1)
      invalid = true;
  });
  const unit = p.get('unit') ?? 'caller',
    scene = p.get('scene') ?? 'animations',
    gun = p.get('gun') ?? 'pistol';
  if (
    invalid ||
    p.get('test') !== 'signal-machines' ||
    p.get('v') !== '1' ||
    !(SIGNAL_UNITS as readonly string[]).includes(unit) ||
    !(SIGNAL_SCENES as readonly string[]).includes(scene) ||
    !isStartingGun(gun)
  )
    return null;
  return {
    unit: unit as SignalUnit,
    scene: scene as SignalScene,
    gun,
    checkpoint: {
      version: 6,
      seed: `RF-C108-SG-${SIGNAL_UNITS.indexOf(unit as SignalUnit)}-${SIGNAL_SCENES.indexOf(scene as SignalScene)}-${gun}`,
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
export function signalMachinesTestRoom(test: SignalMachinesTest): Level {
  const elevated = test.scene === 'wreckage',
    floor = elevated ? 550 : 740,
    x = test.unit === 'caller' && test.scene === 'mechanisms' ? 780 : 1000;
  const spawns: Spawn[] = [
    { kind: test.unit, x, y: floor - ENEMY_STATS[test.unit].h / 2 },
    ...(test.scene === 'friendly' ? [{ kind: 'shooter' as const, x: 1450, y: 724 }] : []),
    { kind: 'shooter', x: 1870, y: 354 },
  ];
  return {
    id: `signal-${test.unit}-${test.scene}`,
    name: 'Signal machinery inspection floor',
    area: 'cooling',
    annex: true,
    boss: false,
    mirrored: false,
    remastered: true,
    annexStation: {
      junction: { x: 700, y: floor - 120 },
      port: { x: 1250, y: floor - 330 },
      mount: floor - 78,
      cable: floor - 380,
      patrol: [850, 1100],
    },
    solids: [
      ...(elevated ? [{ x: 220, y: 550, w: 1250, h: 22 }] : []),
      { x: 650, y: floor - 78, w: 140, h: 22 },
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
    setpiece: {
      rosters: [spawns.map((_, i) => i)],
      weak: [],
      props:
        test.unit === 'caller' && test.scene === 'mechanisms'
          ? [{ kind: 'crate', x: x + 100, y: floor - 23 }]
          : [],
    },
  };
}
/** Only private starting conditions: recording, targeting, shooting and junction feedback stay native. */
export function prepareSignalMachinesTest(g: Game, test: SignalMachinesTest | null): boolean {
  if (
    !test ||
    g.seed !== test.checkpoint.seed ||
    g.testRun?.seed !== test.checkpoint.seed ||
    g.level.id !== signalMachinesTestRoom(test).id
  )
    return false;
  const waiting = g.waves.doors.filter((d) => d.state !== 'spent').map((d) => d.spawn);
  g.waves.clear();
  for (const s of waiting)
    g.spawnEnemy(s.kind, s.x, s.y, s.elite, undefined, undefined, s.mutation, s.machineVariant);
  Matter.Body.setPosition(g.player, { x: 450, y: test.scene === 'wreckage' ? 532 : 722 });
  Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  g.grounded = false;
  if (test.scene === 'friendly') {
    const subject = g.enemies.find((e) => e.kind === test.unit);
    if (!subject) return false;
    const position = { ...subject.body.position };
    subject.spawn = 0;
    g.hitEnemy(subject, 100000, undefined, false, false, false, 'cleanup');
    if (!g.factions.spawn(test.unit, position))
      throw Error('Native friendly fixture could not spawn');
  }
  return true;
}
export const SIGNAL_NAMES: Record<SignalUnit, string> = {
  caller: 'Caller',
  switchman: 'Switchman',
};
export const SIGNAL_SCENE_NAMES: Record<SignalScene, string> = {
  animations: 'Animations',
  reactions: 'Damage reactions',
  shutdowns: 'Shutdowns',
  wreckage: 'Wreckage',
  mechanisms: 'Signal counterplay',
  friendly: 'Friendly comparison',
};
export function signalMachinesTestHint(test: SignalMachinesTest): string {
  const subject =
    test.unit === 'caller'
      ? 'Watch the horn record three positions, lock and fire at those marks. Move after lock to evade; pushing the braced hull out of place cancels its queue.'
      : 'Watch patrol feet, firing braces and the receiver separately from the remote port. Shoot the amber junction while it charges to interrupt the transmission and send feedback to its owner.';
  return (
    subject +
    (test.scene === 'friendly'
      ? ' This private comparison starts a native blue ally against real enemies. Player shots keep their normal friendly-fire rules.'
      : '') +
    (['shutdowns', 'wreckage'].includes(test.scene)
      ? ' An upgraded tool helps inspect shutdowns.'
      : '') +
    ' R restarts this private test. Saved progress stays untouched.'
  );
}
