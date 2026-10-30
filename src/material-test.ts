import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Checkpoint } from './rules.ts';
import type { Level, Solid } from './levels.ts';
import { isStartingGun, type StartingGun } from './starting-guns.ts';

export const MATERIAL_SCENES = [
  'props',
  'reactions',
  'breakage',
  'canisters',
  'terrain',
  'combat',
] as const;
export type MaterialScene = (typeof MATERIAL_SCENES)[number];
export interface MaterialTest {
  scene: MaterialScene;
  mirror: boolean;
  gun: StartingGun;
  checkpoint: Checkpoint;
}
export const MATERIAL_COPY: Record<MaterialScene, { title: string; hint: string }> = {
  props: {
    title: 'Prop designs',
    hint: 'Walk through the material bays. Inspect the crate, movable cover, canister and suspended cargo; shoot the real cable to release its load.',
  },
  reactions: {
    title: 'Damage reactions',
    hint: 'Shoot the crate, cover and cargo from different angles. Local reactions and casing wear follow accepted native hits and remaining health.',
  },
  breakage: {
    title: 'Material breakage',
    hint: 'An upgraded tool helps break the crate, cover and cargo. Their harmless visual fragments are separate from real physical rubble.',
  },
  canisters: {
    title: 'Canister cues',
    hint: 'Shoot a canister to arm and launch it. After its short arming grace, a qualifying impact triggers the blast; it has no timed fuse. Compare the nearby chain and the crate shielded by the cover beyond it.',
  },
  terrain: {
    title: 'Walls and shelves',
    hint: 'Shoot the seamed low wall or optional shelf. Only registered weak material breaks; the plain structural platform remains solid. Shelf loads fall through the real native support rules.',
  },
  combat: {
    title: 'Mixed combat',
    hint: 'Fight the native patrol around crates, cover and canisters. Compare material reactions with the actual attack warnings and physical blasts.',
  },
};
export function materialTestFromUrl(url: URL): MaterialTest | null {
  const p = url.searchParams;
  let invalid = !!url.hash;
  p.forEach((_, key) => {
    if (!['test', 'scene', 'mirror', 'gun', 'v'].includes(key) || p.getAll(key).length !== 1)
      invalid = true;
  });
  const scene = p.get('scene') ?? 'props',
    gun = p.get('gun') ?? 'pistol';
  if (
    invalid ||
    p.get('test') !== 'material-response' ||
    p.get('v') !== '1' ||
    !(MATERIAL_SCENES as readonly string[]).includes(scene) ||
    !isStartingGun(gun) ||
    (p.has('mirror') && p.get('mirror') !== '1')
  )
    return null;
  const mods = ['breakage', 'combat'].includes(scene)
    ? ['magnum', 'rapid', 'scatter', 'pierce']
    : [];
  return {
    scene: scene as MaterialScene,
    mirror: p.has('mirror'),
    gun,
    checkpoint: {
      version: 6,
      seed: `MATERIAL546-${scene.toUpperCase()}-${Number(p.has('mirror'))}-${gun}`,
      stage: 8,
      hp: 100,
      mods,
      startingGun: gun,
      kills: 0,
      elapsed: 0,
    },
  };
}
export function materialTestRoom(test: MaterialTest): Level {
  const terrain = test.scene === 'terrain',
    canisters = test.scene === 'canisters',
    combat = test.scene === 'combat';
  const solids: Solid[] = terrain
    ? [
        { x: 570, y: 620, w: 110, h: 120 },
        { x: 980, y: 485, w: 240, h: 22 },
        { x: 1370, y: 640, w: 180, h: 100 },
        { x: 340, y: 580, w: 160, h: 22 },
      ]
    : [{ x: 1090, y: 300, w: 180, h: 22 }, ...(combat ? [{ x: 1370, y: 640, w: 230, h: 22 }] : [])];
  const props: NonNullable<Level['setpiece']>['props'] = terrain
    ? [
        { kind: 'crate', x: 1020, y: 462 },
        { kind: 'cover', x: 1120, y: 442 },
        { kind: 'crate', x: 810, y: 717 },
      ]
    : canisters
      ? [
          { kind: 'canister', x: 720, y: 720 },
          { kind: 'canister', x: 825, y: 720 },
          { kind: 'canister', x: 930, y: 720 },
          { kind: 'cover', x: 1010, y: 697 },
          { kind: 'crate', x: 1060, y: 717 },
        ]
      : [
          { kind: 'crate', x: 480, y: 717 },
          { kind: 'cover', x: 740, y: 697 },
          { kind: 'canister', x: 930, y: 720 },
        ];
  const sx = (x: number, w = 0) => (test.mirror ? 2000 - x - w : x),
    px = (x: number) => (test.mirror ? 2000 - x : x);
  return {
    id: 'material-range-' + test.scene,
    name: 'Material Response / ' + MATERIAL_COPY[test.scene].title,
    area: 'docks',
    boss: false,
    mirrored: test.mirror,
    solids: solids.map((s) => ({ ...s, x: sx(s.x, s.w) })),
    spawns: combat
      ? [
          { kind: 'shooter', x: px(1480), y: 624 },
          { kind: 'runner', x: px(1680), y: 723 },
          { kind: 'flyer', x: px(1610), y: 440 },
        ]
      : [],
    hazards: [],
    route: [
      { x: px(140), y: 720 },
      { x: px(1860), y: 720 },
    ],
    setpiece: {
      rosters: [],
      props: props.map((p) => ({ ...p, x: px(p.x) })),
      weak: terrain ? [0, 1] : [],
      ...(!terrain && !canisters ? { cargo: [{ x: px(1180), y: 540, anchorY: 322 }] } : {}),
    },
  };
}
/** A private material range keeps its native physics, without the boss-rematch auto-result. */
export function prepareMaterialTest(g: Game, test: MaterialTest | null): boolean {
  if (
    !test ||
    g.seed !== test.checkpoint.seed ||
    g.testRun?.seed !== test.checkpoint.seed ||
    g.level.id !== materialTestRoom(test).id
  )
    return false;
  delete g.testRun.rematchRoom;
  Matter.Body.setPosition(g.player, { x: test.mirror ? 1860 : 140, y: 720 });
  Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  g.grounded = false;
  return true;
}
export function materialTestHint(test: MaterialTest) {
  return (
    MATERIAL_COPY[test.scene].hint +
    ' R restarts this private range. Pause and Reduced Effects are supported. Saved progress stays untouched.'
  );
}
