import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Level, Solid, Spawn } from './levels.ts';
import type { Checkpoint, Vec } from './rules.ts';
import type { CameraMode } from './combat-camera.ts';

export const COMBAT_FOCUS_SCENES = {
  climb: {
    name: 'Recoil ascent',
    instruction:
      'Jump and shoot down to climb the marked shelves. Retry resets this isolated room.',
    stage: 5,
  },
  descent: {
    name: 'Controlled descent',
    instruction:
      'Walk off the upper shelf, then steer toward the lower landings. Shoot down to brake your fall.',
    stage: 9,
  },
  crossfire: {
    name: 'Crossfire',
    instruction:
      'Move between both firing lanes. Compare the same actual attacks in each camera mode.',
    stage: 9,
  },
  cover: {
    name: 'Moving cover',
    instruction:
      'The cargo lift blocks real firing lanes. Move, jump or shoot its crate and watch the approach warnings.',
    stage: 9,
  },
} as const;
export type CombatFocusScene = keyof typeof COMBAT_FOCUS_SCENES;
export const COMBAT_FOCUS_IDS = Object.keys(COMBAT_FOCUS_SCENES) as CombatFocusScene[];
export interface CombatFocusTest {
  checkpoint: Checkpoint;
  camera: CameraMode;
  scene: CombatFocusScene;
  mirror: boolean;
}
const ids = (value: string | null): value is CombatFocusScene =>
  !!value && Object.hasOwn(COMBAT_FOCUS_SCENES, value);
const seed = (scene: CombatFocusScene, mirror: boolean) =>
  `RF-C99-FOCUS-1-${scene.toUpperCase()}-${mirror ? 'M' : 'N'}`;
export function combatFocusTestFromUrl(url: URL): CombatFocusTest | null {
  const p = url.searchParams;
  if (p.get('test') !== 'focus' || p.get('v') !== '1') return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'scene', 'camera', 'mirror', 'v'].includes(key) || p.getAll(key).length !== 1)
      invalid = true;
  });
  const scene = p.get('scene') ?? 'climb',
    camera = p.get('camera') ?? 'follow',
    mirror = p.get('mirror') ?? '0';
  if (
    invalid ||
    !ids(scene) ||
    !['follow', 'steady', 'wide'].includes(camera) ||
    !['0', '1'].includes(mirror)
  )
    return null;
  return {
    scene,
    camera: camera as CameraMode,
    mirror: mirror === '1',
    checkpoint: {
      version: 6,
      seed: seed(scene, mirror === '1'),
      stage: COMBAT_FOCUS_SCENES[scene].stage,
      startingGun: 'pistol',
      hp: 100,
      mods: [],
      kills: 0,
      elapsed: 0,
      encounters: 1,
    },
  };
}
function identity(g: Game) {
  if (!g.testRun || g.testRun.seed !== g.seed) return null;
  const match = /^RF-C99-FOCUS-1-(CLIMB|DESCENT|CROSSFIRE|COVER)-(N|M)$/.exec(g.seed);
  if (!match) return null;
  const scene = match[1].toLowerCase() as CombatFocusScene;
  if (g.stage !== COMBAT_FOCUS_SCENES[scene].stage) return null;
  return { scene, mirror: match[2] === 'M' };
}
const shelves: Solid[] = [
  { x: 230, y: 600, w: 300, h: 22 },
  { x: 620, y: 445, w: 320, h: 22 },
  { x: 1020, y: 290, w: 320, h: 22 },
  { x: 1390, y: 130, w: 360, h: 22 },
  { x: 1080, y: -30, w: 360, h: 22 },
  { x: 700, y: -190, w: 360, h: 22 },
];
const ascent: Vec[] = [
  { x: 380, y: 582 },
  { x: 780, y: 427 },
  { x: 1180, y: 272 },
  { x: 1570, y: 112 },
  { x: 1260, y: -48 },
  { x: 870, y: -208 },
];
const point = (p: Vec, mirror: boolean) => ({ x: mirror ? 2000 - p.x : p.x, y: p.y });
export function combatFocusEntry(scene: CombatFocusScene, mirror = false) {
  return point(
    scene === 'descent'
      ? { x: 850, y: -208 }
      : scene === 'crossfire'
        ? { x: 1000, y: 722 }
        : scene === 'cover'
          ? { x: 1450, y: 722 }
          : { x: 140, y: 722 },
    mirror,
  );
}
export function combatFocusWaypoints(scene: CombatFocusScene, mirror = false) {
  const route =
    scene === 'climb'
      ? ascent
      : scene === 'descent'
        ? [...ascent].reverse().slice(1).concat({ x: 1840, y: 722 })
        : [
            { x: 500, y: 722 },
            { x: 1500, y: 722 },
          ];
  return route.map((p) => point(p, mirror));
}
export function combatFocusRoom(scene: CombatFocusScene, mirror = false): Level {
  const tall = scene === 'climb' || scene === 'descent';
  const spawns: Spawn[] =
    scene === 'climb'
      ? [{ kind: 'shooter', x: 970, y: -206 }]
      : scene === 'descent'
        ? [{ kind: 'shooter', x: 1700, y: 724 }]
        : scene === 'crossfire'
          ? [
              { kind: 'shooter', x: 140, y: 724 },
              { kind: 'shooter', x: 1860, y: 724 },
            ]
          : [{ kind: 'shooter', x: 180, y: 724 }];
  return {
    id: 'combat-focus-' + scene,
    name: COMBAT_FOCUS_SCENES[scene].name,
    area: scene === 'climb' ? 'furnace' : 'cooling',
    boss: false,
    mirrored: mirror,
    remastered: true,
    // Reuse the established launch-course world extent without activating a
    // trial/race, changing gravity or altering ordinary Campaign movement.
    ...(tall ? { recoilTrial: 'launch' as const } : {}),
    solids: (tall ? shelves : []).map((s) => ({ ...s, x: mirror ? 2000 - s.x - s.w : s.x })),
    route: combatFocusWaypoints(scene, mirror),
    spawns: spawns.map((s) => ({ ...s, ...point(s, mirror) })),
    hazards:
      scene === 'cover'
        ? [{ kind: 'lift', x: mirror ? 920 : 1080, y: 708, w: 200, h: 28, travel: 300 }]
        : [],
    vents: [],
    counterweights: [],
    setpiece: {
      rosters: [spawns.map((_, i) => i)],
      weak: [],
      props: [],
    },
  };
}
export function combatFocusLevel(g: Game, base: Level): Level {
  const chosen = identity(g);
  return chosen ? combatFocusRoom(chosen.scene, chosen.mirror) : base;
}
// Called once at the end of loadRoom, including Retry. Only authored initial
// placement changes; health, gun, enemies, warnings and normal physics stay live.
export function prepareCombatFocus(g: Game) {
  const chosen = identity(g);
  if (!chosen || g.level.id !== 'combat-focus-' + chosen.scene) return;
  const entry = combatFocusEntry(chosen.scene, chosen.mirror);
  Matter.Body.setPosition(g.player, entry);
  Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  g.grounded = false;
  g.aim = { x: entry.x + (chosen.mirror ? -350 : 350), y: entry.y };
  if (chosen.scene === 'cover') {
    // Like the freight encounter, authored cargo is placed after the moving
    // platform exists; general prop placement excludes its entire travel lane.
    const at = point({ x: 1080, y: 686 }, chosen.mirror);
    if (!g.props.items.some((p) => p.kind === 'crate' && Math.abs(p.body.position.x - at.x) < 1))
      g.props.spawn('crate', at.x, at.y);
  }
}
