import Matter from 'matter-js';
import type { Game } from './game.ts';
import { MODS, type Checkpoint } from './rules.ts';
import { testCheckpoint } from './practice.ts';
import { goalPreviewProgress } from './next-goal-preview.ts';
import { loadWeaponUnlocks } from './weapon-unlocks.ts';

export const GOAL_RUN_SCENES = ['hunt', 'upgrade', 'loss'] as const;
export type GoalRunScene = (typeof GOAL_RUN_SCENES)[number];
export function goalRunPreviewFromUrl(url: URL): GoalRunScene | null {
  const p = url.searchParams;
  let invalid = false;
  p.forEach((_, k) => {
    if (!['test', 'scene', 'v'].includes(k) || p.getAll(k).length !== 1) invalid = true;
  });
  const scene = p.get('scene') as GoalRunScene;
  return !invalid &&
    p.get('test') === 'goal-run' &&
    p.get('v') === '1' &&
    GOAL_RUN_SCENES.includes(scene)
    ? scene
    : null;
}
export function goalRunTestFromUrl(url: URL): Checkpoint | null {
  const scene = goalRunPreviewFromUrl(url);
  if (!scene) return null;
  return {
    ...testCheckpoint('GOAL-RUN-' + scene.toUpperCase(), scene === 'hunt' ? 4 : 8),
    version: 6,
    ...(scene === 'upgrade'
      ? {
          mods: [
            'cutting-torch',
            'thermal-runaway',
            'scatter',
            'light',
            'leech',
            'pierce',
            'backblast',
            'burst',
          ],
        }
      : {}),
    ...(scene === 'hunt' ? { cleared: true } : {}),
  };
}
// Fictional display evidence stays outside ProgressStore and Continue.
export function goalRunTestProgress(scene: GoalRunScene, g?: Game) {
  if (scene === 'upgrade') {
    const p = goalPreviewProgress('discoveries');
    return g?.mods.includes('heat-relay') ? { ...p, discovered: MODS.map((m) => m.id) } : p;
  }
  const p = goalPreviewProgress('tools');
  p.discovered = p.discovered.filter((id) => !['fold', 'arc-coil', 'scatter'].includes(id));
  if (scene === 'loss' && g?.mode === 'dead')
    return {
      ...p,
      weapons: loadWeaponUnlocks({ version: 1, cleared: true, licenses: ['twinbore', 'carbine'] }),
      earned: [...p.earned, 'plate-breaker' as const],
      discovered: MODS.map((m) => m.id),
    };
  return p;
}
export function prepareGoalRunTest(g: Game, scene: GoalRunScene) {
  if (g.testRun?.seed !== 'GOAL-RUN-' + scene.toUpperCase()) return;
  if (scene === 'hunt') {
    g.loadRoom(false, true);
    g.hunts.state = { kind: 'bulwark', stage: g.stage as 4, phase: 'available' };
    g.hunts.reset(true);
    if (g.hunts.door) Matter.Body.setPosition(g.player, { x: g.hunts.door.x - 120, y: 722 });
    g.onChange();
  } else if (scene === 'upgrade') {
    g.offers = ['heat-relay', 'magnum', 'rapid'].map((id) => MODS.find((m) => m.id === id)!);
    g.setMode('upgrade');
  } else {
    g.hp = 0;
    g.setMode('dead');
  }
}
