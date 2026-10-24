import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Level } from './levels.ts';
import type { Checkpoint } from './rules.ts';
import { combatFocusEntry, combatFocusRoom } from './combat-focus-test.ts';

export const DAMAGE_CONTROL_SCENES = {
  hit: {
    name: 'Read the hit',
    instruction:
      'Two real gunners cover this room. Move and shoot normally; accepted hits show their direction and recovery.',
    hp: 100,
  },
  replay: {
    name: 'Three-hit replay',
    instruction:
      'Start with 54 health. Let the actual gunners defeat you to review the hits, then practice the same room at full health.',
    hp: 54,
  },
  cover: {
    name: 'Damage behind cover',
    instruction:
      'The moving lift and crate block real shots. Compare an exposed hit with the protection of solid cover.',
    hp: 100,
  },
} as const;
export type DamageControlScene = keyof typeof DAMAGE_CONTROL_SCENES;
export const DAMAGE_CONTROL_IDS = Object.keys(DAMAGE_CONTROL_SCENES) as DamageControlScene[];
const isScene = (value: string): value is DamageControlScene =>
  Object.hasOwn(DAMAGE_CONTROL_SCENES, value);
export function damageControlTestFromUrl(
  url: URL,
): { checkpoint: Checkpoint; scene: DamageControlScene } | null {
  const p = url.searchParams;
  if (p.get('test') !== 'damage' || p.get('v') !== '1') return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'scene', 'v'].includes(key) || p.getAll(key).length !== 1) invalid = true;
  });
  const scene = p.get('scene') ?? 'hit';
  if (invalid || !isScene(scene)) return null;
  return {
    scene,
    checkpoint: {
      version: 6,
      seed: `RF-C99-DAMAGE-1-${scene.toUpperCase()}`,
      stage: 9,
      startingGun: 'pistol',
      mods: [],
      hp: DAMAGE_CONTROL_SCENES[scene].hp,
      kills: 0,
      elapsed: 0,
      encounters: 1,
    },
  };
}
function identity(g: Game): DamageControlScene | null {
  if (!g.testRun || g.testRun.seed !== g.seed || g.stage !== 9) return null;
  const match = /^RF-C99-DAMAGE-1-(HIT|REPLAY|COVER)$/.exec(g.seed);
  return match ? (match[1].toLowerCase() as DamageControlScene) : null;
}
export function damageControlLevel(g: Game, base: Level): Level {
  const scene = identity(g);
  if (!scene) return base;
  const room = combatFocusRoom(scene === 'cover' ? 'cover' : 'crossfire');
  if (scene === 'replay')
    room.spawns = [
      { kind: 'shooter', x: 650, y: 724 },
      { kind: 'shooter', x: 1350, y: 724 },
    ];
  return { ...room, id: 'damage-control-' + scene, name: DAMAGE_CONTROL_SCENES[scene].name };
}
export function prepareDamageControl(g: Game) {
  const scene = identity(g);
  if (!scene || g.level.id !== 'damage-control-' + scene) return;
  const entry = combatFocusEntry(scene === 'cover' ? 'cover' : 'crossfire');
  Matter.Body.setPosition(g.player, entry);
  Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  g.grounded = false;
  g.aim = { x: 100, y: 724 };
  if (
    scene === 'cover' &&
    !g.props.items.some((p) => p.kind === 'crate' && Math.abs(p.body.position.x - 1080) < 1)
  )
    g.props.spawn('crate', 1080, 686);
}
