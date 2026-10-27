import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Level } from './levels.ts';
import { AREAS, type AreaId } from './areas.ts';
import type { Checkpoint } from './rules.ts';

export const LIVING_FOUNDRY_ZONES = [
  'docks',
  'furnace',
  'cooling',
  'reclamation',
  'rooftops',
] as const;
export type LivingFoundryTestScene = 'reveal' | 'machinery' | 'combat';
export type LivingFoundryTestState = 'powered' | 'blackout' | 'sabotaged';
export interface LivingFoundryTest {
  zone: AreaId;
  scene: LivingFoundryTestScene;
  state: LivingFoundryTestState;
  variant: 0 | 1 | 2;
  mirror: boolean;
  reduced: boolean;
  checkpoint: Checkpoint;
}
/** Authored private inspection corridors use native movement and enemies, never saved progress. */
export function livingFoundryTestFromUrl(url: URL): LivingFoundryTest | null {
  const p = url.searchParams;
  let invalid = !!url.hash;
  p.forEach((_, key) => {
    if (
      !['test', 'zone', 'scene', 'state', 'variant', 'mirror', 'reduced', 'v'].includes(key) ||
      p.getAll(key).length !== 1
    )
      invalid = true;
  });
  const zone = p.get('zone') as AreaId;
  const scene = p.get('scene') ?? 'reveal';
  const state = p.get('state') ?? 'powered';
  const variant = p.get('variant') ?? '0';
  if (
    invalid ||
    p.get('test') !== 'living-foundry' ||
    p.get('v') !== '1' ||
    !LIVING_FOUNDRY_ZONES.includes(zone) ||
    !['reveal', 'machinery', 'combat'].includes(scene) ||
    !['powered', 'blackout', 'sabotaged'].includes(state) ||
    !['0', '1', '2'].includes(variant) ||
    (p.has('mirror') && !['0', '1'].includes(p.get('mirror')!)) ||
    (p.has('reduced') && !['0', '1'].includes(p.get('reduced')!))
  )
    return null;
  // Outages and successful Core sabotage keep their native Campaign scope.
  if (state === 'blackout' && (zone === 'docks' || zone === 'rooftops')) return null;
  if (state === 'sabotaged' && (zone === 'docks' || zone === 'furnace')) return null;
  const mirror = p.get('mirror') === '1';
  const stage =
    LIVING_FOUNDRY_ZONES.indexOf(zone) * 4 + (state === 'sabotaged' && zone === 'cooling' ? 2 : 0);
  const seed =
    'RF-C108-LF-' +
    zone +
    '-' +
    variant +
    '-' +
    scene[0] +
    '-' +
    state[0] +
    '-' +
    (mirror ? 'M' : 'N');
  const checkpoint: Checkpoint = {
    version: 6,
    seed,
    stage,
    startingGun: 'pistol',
    hp: 100,
    mods: scene === 'combat' ? ['rapid', 'scatter', 'ricochet', 'light'] : ['light'],
    kills: 0,
    elapsed: 0,
    encounters: 1,
    ...(state === 'sabotaged'
      ? {
          uprising: {
            version: 3,
            choices:
              zone === 'rooftops'
                ? ['rail-heist', 'core-sabotage', 'crew-relief']
                : ['rail-heist', 'core-sabotage'],
            outcomes: [
              { route: 'rail-heist', result: 'failed' },
              { route: 'core-sabotage', result: 'success' },
              ...(zone === 'rooftops'
                ? [{ route: 'crew-relief' as const, result: 'failed' as const }]
                : []),
            ],
            unlocks: [],
          },
        }
      : {}),
    ...(state === 'blackout'
      ? {
          areaEvent: {
            kind: 'blackout',
            area: stage / 4,
            room: stage,
            relays: [],
            caches: [],
            commander: false,
            rerolls: 0,
          },
        }
      : {}),
  };
  return {
    zone,
    scene: scene as LivingFoundryTestScene,
    state: state as LivingFoundryTestState,
    variant: Number(variant) as 0 | 1 | 2,
    mirror,
    reduced: p.get('reduced') === '1',
    checkpoint,
  };
}
export function livingFoundryTestRoom(test: LivingFoundryTest): Level {
  const point = (x: number) => (test.mirror ? 2000 - x : x);
  return {
    id: 'living-foundry-' + test.zone + '-' + test.scene + '-' + test.variant,
    name: AREAS[test.zone].name,
    area: test.zone,
    boss: false,
    mirrored: test.mirror,
    remastered: true,
    solids: [
      { x: test.mirror ? 520 : 1280, y: 650, w: 200, h: 90 },
      { x: test.mirror ? 950 : 760, y: 480, w: 290, h: 22 },
      { x: test.mirror ? 260 : 1450, y: 470, w: 290, h: 22 },
    ],
    spawns:
      test.scene === 'combat'
        ? [
            { kind: 'shooter', x: point(1640), y: 454 },
            { kind: 'runner', x: point(1670), y: 723 },
            { kind: 'flyer', x: point(1580), y: 310 },
          ]
        : [{ kind: 'shooter', x: point(1680), y: 454 }],
    route: [
      { x: point(140), y: 722 },
      { x: point(680), y: 722 },
      { x: point(1080), y: 722 },
      { x: point(1380), y: 625 },
      { x: point(1840), y: 722 },
    ],
    hazards: [],
    vents: [],
    fans: [],
    coolant: [],
    counterweights: [],
    setpiece: { rosters: [], weak: [], props: [{ kind: 'crate', x: point(1120), y: 717 }] },
  };
}
export function prepareLivingFoundryTest(g: Game, test: LivingFoundryTest | null) {
  if (
    !test ||
    g.testRun?.seed !== test.checkpoint.seed ||
    g.seed !== test.checkpoint.seed ||
    g.level.id !== livingFoundryTestRoom(test).id
  )
    return false;
  const x = test.scene === 'machinery' ? 820 : 140;
  Matter.Body.setPosition(g.player, { x: test.mirror ? 2000 - x : x, y: 722 });
  Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  g.grounded = false;
  return true;
}
