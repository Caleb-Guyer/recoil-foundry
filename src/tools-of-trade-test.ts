import { isStartingGun, type StartingGun } from './starting-guns.ts';
import { validBuild, type Checkpoint } from './rules.ts';

export const TOOLS_OF_TRADE_SCENES = ['range', 'picker', 'converted'] as const;
export type ToolsOfTradeScene = (typeof TOOLS_OF_TRADE_SCENES)[number];
export const TOOL_TRIAL_CONVERTED_MODS = ['scatter', 'cutting-torch'] as const;
export interface ToolsOfTradeFixture {
  gun: StartingGun;
  scene: ToolsOfTradeScene;
  checkpoint: Checkpoint;
}
/** Explicit local previews never grant a license or replace the player's Continue. */
export function toolsOfTradeTestFromUrl(url: URL): ToolsOfTradeFixture | null {
  const p = url.searchParams;
  if (p.get('test') !== 'tools-of-trade' || p.get('v') !== '1') return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'gun', 'scene', 'v'].includes(key) || p.getAll(key).length !== 1) invalid = true;
  });
  const gun = p.get('gun') ?? 'carbine',
    scene = p.get('scene') ?? 'range';
  if (
    invalid ||
    !isStartingGun(gun) ||
    !(TOOLS_OF_TRADE_SCENES as readonly string[]).includes(scene)
  )
    return null;
  const mods = scene === 'converted' ? [...TOOL_TRIAL_CONVERTED_MODS] : [];
  if (!validBuild(mods)) return null;
  return {
    gun,
    scene: scene as ToolsOfTradeScene,
    checkpoint: {
      version: 6,
      seed: `RF-C106-TOOLS-${gun}-${scene}`,
      stage: mods.length,
      startingGun: gun,
      mods,
      hp: 100,
      kills: 0,
      elapsed: 0,
    },
  };
}
