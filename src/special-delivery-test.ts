import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Checkpoint } from './rules.ts';
import { courierLevel, courierTestFromUrl } from './courier-layout.ts';
import { COURIER_DOOR } from './courier.ts';
import { getLevel, type Level } from './levels.ts';
import { isStartingGun, type StartingGun } from './starting-guns.ts';

export const DELIVERY_SCENES = [
  'animations',
  'reactions',
  'shutdown',
  'wreckage',
  'escape',
  'cargo',
  'rewards',
  'logbook',
] as const;
export type DeliveryScene = (typeof DELIVERY_SCENES)[number];
export interface SpecialDeliveryTest {
  scene: DeliveryScene;
  mirror: boolean;
  gun: StartingGun;
  checkpoint: Checkpoint;
}
export const DELIVERY_COPY: Record<DeliveryScene, { title: string; hint: string }> = {
  animations: {
    title: 'Animations',
    hint: 'Follow the Courier across the low walls. Watch its wheels, suspension, cargo clamps, boosts and landings.',
  },
  reactions: {
    title: 'Damage reactions',
    hint: 'Shoot from different angles. Actual hull hits jolt the chassis and wear the casing; the cargo latch still shows its remaining health.',
  },
  shutdown: {
    title: 'Shutdown',
    hint: 'Defeat the Courier with the upgraded tool. Watch its drive, suspension and clamps fail while its real case drops separately.',
  },
  wreckage: {
    title: 'Wreckage',
    hint: 'Defeat the Courier. Its brief unlit wreck settles toward real support without blocking movement or shots; only the real case can be collected.',
  },
  escape: {
    title: 'Escape cues',
    hint: 'The Courier starts beside its hatch. Watch the real three-second opening, or shoot and push it away to reset the opening. An escape grants no case.',
  },
  cargo: {
    title: 'Cargo cues',
    hint: 'Defeat the Courier, then approach its physical dropped case with a clear line of sight. Recover it and look for the case beside the normal room exit.',
  },
  rewards: {
    title: 'Rewards',
    hint: 'Choose the recovered cargo bonus upgrade. It grants no healing or room advance; your normal room reward follows. This is a private sample recovery.',
  },
  logbook: {
    title: 'Logbook preview',
    hint: 'Preview the real Scrap Courier portrait and chase guide without discovering it in your saved Logbook.',
  },
};
export function specialDeliveryFromUrl(url: URL): SpecialDeliveryTest | null {
  const p = url.searchParams;
  let invalid = !!url.hash;
  p.forEach((_, key) => {
    if (!['test', 'scene', 'mirror', 'gun', 'v'].includes(key) || p.getAll(key).length !== 1)
      invalid = true;
  });
  const scene = p.get('scene') ?? 'animations',
    gun = p.get('gun') ?? 'pistol';
  if (
    invalid ||
    p.get('test') !== 'special-delivery' ||
    p.get('v') !== '1' ||
    !(DELIVERY_SCENES as readonly string[]).includes(scene) ||
    !isStartingGun(gun) ||
    (p.has('mirror') && p.get('mirror') !== '1')
  )
    return null;
  const native = new URL('https://test/?test=courier');
  if (p.has('mirror')) native.searchParams.set('mirror', '1');
  if (scene === 'rewards') native.searchParams.set('phase', 'reward');
  native.searchParams.set(
    'build',
    ['shutdown', 'wreckage', 'cargo'].includes(scene) ? 'standard' : 'starter',
  );
  const checkpoint = courierTestFromUrl(native)!;
  checkpoint.startingGun = gun;
  if (['shutdown', 'wreckage', 'cargo'].includes(scene))
    checkpoint.mods = ['magnum', 'rapid', 'scatter', 'pierce', 'burst'];
  return { scene: scene as DeliveryScene, mirror: p.has('mirror'), gun, checkpoint };
}
/** The canonical dispatch lane is used for geometry comparisons. */
export function specialDeliveryRoom(test: SpecialDeliveryTest): Level {
  const native = courierLevel(
    getLevel(test.checkpoint.seed, test.checkpoint.stage),
    test.checkpoint.seed,
  );
  return native;
}
export function prepareSpecialDelivery(g: Game, test: SpecialDeliveryTest | null): boolean {
  if (
    !test ||
    g.seed !== test.checkpoint.seed ||
    g.testRun?.seed !== test.checkpoint.seed ||
    g.level.id !== 'dispatch-lane' ||
    !g.level.courier
  )
    return false;
  if (test.scene === 'rewards') return g.mode === 'upgrade' && g.courierReward;
  // Isolate this private inspection without registering kills or changing native terrain.
  g.waves.clear();
  for (const enemy of [...g.enemies])
    if (!enemy.courier) {
      Matter.Composite.remove(g.engine.world, enemy.body);
      g.enemies = g.enemies.filter((e) => e !== enemy);
    }
  const courier = g.courier.enemy;
  if (!courier) return false;
  const escape = test.scene === 'escape';
  Matter.Body.setPosition(g.player, { x: escape ? 1510 : 140, y: 720 });
  Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  if (escape) {
    Matter.Body.setPosition(courier.body, { x: COURIER_DOOR.x, y: 720 });
    Matter.Body.setVelocity(courier.body, { x: 0, y: 0 });
    g.courier.lastSafe = { x: COURIER_DOOR.x - 55, y: 720 };
  }
  g.grounded = false;
  return true;
}
export function specialDeliveryHint(test: SpecialDeliveryTest) {
  return (
    DELIVERY_COPY[test.scene].hint +
    (test.scene === 'logbook'
      ? ' Back closes this preview. Saved progress stays untouched.'
      : ' R restarts this private test. Pause and Reduced Effects are supported. Saved progress stays untouched.')
  );
}
