import type { Game } from './game.ts';
import { overtimeRooftopsTestFromUrl } from './practice.ts';
import { EXTRACTION } from './escape-layout.ts';
import Matter from 'matter-js';

export function clockOutTestFromUrl(url: URL) {
  const p = url.searchParams;
  if (p.get('test') !== 'clock-out') return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'scene', 'v'].includes(key) || p.getAll(key).length !== 1) invalid = true;
  });
  const scene = p.get('scene') ?? 'departure';
  if (invalid || !['departure', 'walk'].includes(scene)) return null;
  const save = overtimeRooftopsTestFromUrl(
    new URL('https://test.invalid/?test=overtime-rooftops&room=interceptor'),
  )!;
  return {
    ...save,
    seed: 'CLOCK-OUT-' + scene.toUpperCase(),
    escape: true as const,
    kills: 438,
    elapsed: 2347,
  };
}

export function prepareClockOutTest(game: Game) {
  if (game.testRun?.seed !== 'CLOCK-OUT-DEPARTURE') return;
  Matter.Body.setPosition(game.player, { x: EXTRACTION.x, y: EXTRACTION.y - 18 });
  Matter.Body.setVelocity(game.player, { x: 0, y: 0 });
}
