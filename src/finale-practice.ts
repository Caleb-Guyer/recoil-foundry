import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Checkpoint } from './rules.ts';
import { cinematicFinale } from './boss-progression.ts';
import { finaleTestFromUrl } from './final-arsenal.ts';
import { loadDamageCause, type DamageCause } from './damage-cause.ts';
import { replayGuidance } from './replay-guidance.ts';

export type FinalePracticePhase = 0 | 1 | 2;
export const FINALE_PRACTICE_FORMS = ['Chassis', 'Siege', 'Rupture'] as const;
export interface FinalePracticeSnapshot {
  reached: FinalePracticePhase;
  deathPhase: FinalePracticePhase;
  cause: DamageCause | null;
}
export const isFinalePracticePhase = (value: unknown): value is FinalePracticePhase =>
  value === 0 || value === 1 || value === 2;

export function finalePracticeFor(game: Game): FinalePracticeSnapshot | null {
  if (
    game.mode !== 'dead' ||
    !cinematicFinale(game.seed) ||
    game.stage !== 19 ||
    !game.finale.cinema ||
    game.practice ||
    game.workshop.active ||
    game.escape ||
    game.detour ||
    game.testRun?.rematchRoom ||
    !isFinalePracticePhase(game.reachedFinalePhase)
  )
    return null;
  const phase = game.finale.phase;
  if (!isFinalePracticePhase(phase) || phase > game.reachedFinalePhase) return null;
  return {
    reached: game.reachedFinalePhase,
    deathPhase: phase,
    cause: game.deathCause ? loadDamageCause(game.deathCause) : null,
  };
}

export function finalePracticeGuidance(phase: FinalePracticePhase, value: DamageCause | null) {
  const recorded = replayGuidance(value),
    cause = loadDamageCause(value);
  let tip: string;
  if (cause.type === 'fall') tip = recorded.tip;
  else if (cause.type === 'induction' || cause.type === 'lightning')
    tip =
      phase === 1
        ? 'Leave the marked floor strike, then use the platforms to cross the Siege’s firing lanes.'
        : 'Leave the marked arena lanes before they fire. Choose a new landing between volleys.';
  else if (cause.type === 'blast' || cause.type === 'volatile' || cause.type === 'fuel')
    tip = 'Leave the blast warning first. Return fire during the break between volleys.';
  else if (cause.type === 'contact')
    tip = 'Keep room around the chassis. Cross above it with a jump and a downward recoil shot.';
  else
    tip = [
      'Change height after a firing lane locks. Use the break between volleys to return fire.',
      'Cross between platforms after the aim locks. Leave the marked floor before the strike.',
      'Move between the marked arena lanes and keep a different landing ready for the next volley.',
    ][phase];
  return {
    label: FINALE_PRACTICE_FORMS[phase] + (value ? ' · ' + recorded.label : ' practice'),
    tip,
  };
}

// The controller is installed only on the rematch's private, unsaved Game.
// It intercepts the zero-health boundary before Game awards a boss kill or
// enters another form. The original run's director and result remain intact.
export function startFinalePracticePhase(game: Game, phase: FinalePracticePhase): boolean {
  const cinema = game.finale.cinema;
  if (!game.testRun?.rematchRoom || !cinema || !cinematicFinale(game.seed)) return false;
  const sound = game.onSound;
  game.onSound = () => {};
  try {
    cinema.enterForm(phase);
  } finally {
    game.onSound = sound;
  }
  Matter.Body.setPosition(game.player, { x: cinema.x(900), y: 718 });
  Matter.Body.setVelocity(game.player, { x: 0, y: 0 });
  cinema.breakForm = (enemy) => {
    if (!game.finale.owns(enemy) || !cinema.combat) return false;
    game.finale.wreck = { ...enemy.body.position };
    game.finale.quiet();
    Matter.Composite.remove(game.engine.world, enemy.body);
    game.enemies = game.enemies.filter((other) => other !== enemy);
    cinema.state = 'complete';
    game.finale.state = 'complete';
    game.finale.cleared = true;
    game.clear = true;
    game.setMode('won');
    return true;
  };
  game.hp = 100;
  game.setMode('paused');
  return true;
}

export interface FinalePracticePreview {
  phase: FinalePracticePhase;
  checkpoint: Checkpoint;
}
export function finalePracticePreviewFromUrl(url: URL): FinalePracticePreview | null {
  const p = url.searchParams;
  if (p.get('test') !== 'final-practice' || p.get('v') !== '1') return null;
  let valid = true;
  p.forEach((_, key) => {
    if (!['test', 'phase', 'fight', 'v'].includes(key) || p.getAll(key).length !== 1) valid = false;
  });
  const phase = p.get('phase') ?? '1',
    fight = p.get('fight') ?? 'campaign';
  if (!valid || !['1', '2', '3'].includes(phase) || !['campaign', 'overtime'].includes(fight))
    return null;
  const checkpoint = finaleTestFromUrl(
    new URL(`https://test.invalid/?test=finale&v=3&phase=${phase}&fight=${fight}`),
  );
  return checkpoint ? { checkpoint, phase: (Number(phase) - 1) as FinalePracticePhase } : null;
}
export function prepareFinalePracticePreview(game: Game, preview: FinalePracticePreview): boolean {
  if (
    !game.testRun ||
    game.testRun.rematchRoom ||
    game.seed !== preview.checkpoint.seed ||
    !game.finale.cinema
  )
    return false;
  game.finale.cinema.enterForm(preview.phase);
  return true;
}
