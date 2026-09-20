import type { Game } from './game.ts';
import { availableMods, type Checkpoint } from './rules.ts';
import { exitTestFromUrl } from './practice.ts';
import { shutdownTestFromUrl } from './shutdown-layout.ts';

// Explicit, isolated result previews. They use the actual result UI without
// awarding a victory, unlocking lore or replacing an in-progress run.
export function presentationTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (p.get('test') !== 'presentation') return null;
  const scene = p.get('scene') ?? 'escape';
  if (!['escape', 'overtime', 'shutdown'].includes(scene)) return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'scene', 'v'].includes(key) || p.getAll(key).length !== 1) invalid = true;
  });
  if (invalid) return null;
  const save =
    scene === 'shutdown'
      ? shutdownTestFromUrl(new URL('https://test.invalid/?test=shutdown&scene=ending'))!
      : exitTestFromUrl(new URL('https://test.invalid/?test=exits'))!;
  const baseMods = save.mods.length;
  if (scene === 'overtime') {
    for (let i = 0; i < save.stage; i++) {
      const next = availableMods(save.mods)[0];
      if (next) save.mods.push(next.id);
    }
  }
  return {
    ...save,
    seed: 'PRESENTATION-' + scene.toUpperCase(),
    kills: scene === 'overtime' ? 438 : 216,
    elapsed: scene === 'overtime' ? 2347 : 1163,
    ...(scene === 'overtime'
      ? { overtime: { baseMods, repairs: baseMods + save.stage - save.mods.length } }
      : {}),
  };
}

export function finishPresentationTest(game: Game) {
  if (!game.testRun || !/^PRESENTATION-(ESCAPE|OVERTIME|SHUTDOWN)$/.test(game.testRun.seed))
    return false;
  game.setMode('won');
  return true;
}
