import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Level } from './levels.ts';
import { OUTFITS, type Cosmetics } from './cosmetics.ts';
import { STARTING_GUN_IDS, isStartingGun, type StartingGun } from './starting-guns.ts';
import { validBuild, type Checkpoint } from './rules.ts';

export const OPERATOR_SCENES = ['animations', 'grips', 'surfaces', 'outfits'] as const;
export type OperatorScene = (typeof OPERATOR_SCENES)[number];
export const OPERATOR_MORPHS = {
  native: [],
  beam: ['cutting-torch'],
  piston: ['piston-lance'],
  saw: ['cable-saw'],
  seeker: ['seeker-rack'],
  foam: ['foamcaster'],
} as const;
export interface OperatorTest {
  scene: OperatorScene;
  gun: StartingGun;
  morph: keyof typeof OPERATOR_MORPHS;
  outfit: Cosmetics['outfit'];
  checkpoint: Checkpoint;
}
/** Deliberate private inspections: no authored input, rewards, settings or Continue writes. */
export function operatorTestFromUrl(url: URL): OperatorTest | null {
  const p = url.searchParams;
  let invalid = !!url.hash;
  p.forEach((_, key) => {
    if (
      !['test', 'scene', 'gun', 'morph', 'outfit', 'v'].includes(key) ||
      p.getAll(key).length !== 1
    )
      invalid = true;
  });
  const scene = p.get('scene') ?? 'animations';
  const gun = p.get('gun') ?? (scene === 'grips' ? 'shotgun' : 'pistol');
  const morph = p.get('morph') ?? 'native';
  const outfit = p.get('outfit') ?? 'standard';
  if (
    invalid ||
    p.get('test') !== 'operator' ||
    p.get('v') !== '1' ||
    !(OPERATOR_SCENES as readonly string[]).includes(scene) ||
    !isStartingGun(gun) ||
    !Object.hasOwn(OPERATOR_MORPHS, morph) ||
    !Object.hasOwn(OUTFITS, outfit) ||
    (morph !== 'native' && scene !== 'grips')
  )
    return null;
  const mods = [...OPERATOR_MORPHS[morph as keyof typeof OPERATOR_MORPHS]];
  if (!validBuild(mods)) return null;
  return {
    scene: scene as OperatorScene,
    gun,
    morph: morph as keyof typeof OPERATOR_MORPHS,
    outfit: outfit as Cosmetics['outfit'],
    checkpoint: {
      version: 6,
      seed: `RF-C108-OP-${OPERATOR_SCENES.indexOf(scene as OperatorScene)}-${STARTING_GUN_IDS.indexOf(gun)}-${Object.keys(OPERATOR_MORPHS).indexOf(morph)}-${Object.keys(OUTFITS).indexOf(outfit)}`,
      stage: 8,
      startingGun: gun,
      mods,
      hp: 100,
      kills: 0,
      elapsed: 0,
    },
  };
}
export function operatorTestRoom(test: OperatorTest): Level {
  return {
    id: `operator-${test.scene}`,
    name: 'Operator inspection course',
    area: 'cooling',
    mirrored: false,
    boss: false,
    remastered: true,
    solids: [
      { x: 320, y: 650, w: 190, h: 90 },
      { x: 540, y: 550, w: 110, h: 22 },
      { x: 680, y: 660, w: 260, h: 22 },
      { x: 1460, y: 620, w: 210, h: 120 },
      { x: 1700, y: 500, w: 210, h: 22 },
    ],
    coolant: [{ x: 1000, y: 730, w: 430, h: 10 }],
    route: [
      { x: 140, y: 722 },
      { x: 420, y: 632 },
      { x: 720, y: 642 },
      { x: 1120, y: 722 },
      { x: 1560, y: 602 },
      { x: 1840, y: 482 },
    ],
    spawns: [{ kind: 'shooter', x: 1840, y: 484 }],
    hazards: [],
    vents: [],
    fans: [],
    counterweights: [],
    setpiece: { rosters: [], weak: [], props: [] },
  };
}
export function prepareOperatorTest(g: Game, test: OperatorTest | null): boolean {
  if (
    !test ||
    g.testRun?.seed !== test.checkpoint.seed ||
    g.seed !== test.checkpoint.seed ||
    g.level.id !== operatorTestRoom(test).id
  )
    return false;
  Matter.Body.setPosition(g.player, { x: 140, y: 722 });
  Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  g.grounded = false;
  g.cosmetics = { ...g.cosmetics, outfit: test.outfit };
  return true;
}
export const OPERATOR_TEST_COPY: Record<OperatorScene, { title: string; hint: string }> = {
  animations: {
    title: 'Player animations',
    hint: 'Run, reverse, jump, fall and shoot downward to launch. R restarts this private course.',
  },
  grips: {
    title: 'Weapon grips',
    hint: 'Aim in every direction and fire on the ground and in flight. R restarts; your progress is untouched.',
  },
  surfaces: {
    title: 'Surface sounds',
    hint: 'Cross solid metal, the raised thin grating and the coolant on the right. Sound follows Settings; R restarts.',
  },
  outfits: {
    title: 'Outfit previews',
    hint: 'Inspect every outfit in Appearance. Preview selections are temporary and grant no unlocks.',
  },
};
