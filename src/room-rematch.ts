import type { DamageRoomSummary } from './damage-control.ts';
import Matter from 'matter-js';
import { Game, type Input } from './game.ts';
import type { Checkpoint } from './rules.ts';
import type { Level } from './levels.ts';
import type { Cosmetics } from './cosmetics.ts';
import { practiceCheckpoint } from './practice.ts';
import { replayGuidance } from './replay-guidance.ts';
import {
  finalePracticeFor,
  finalePracticeGuidance,
  isFinalePracticePhase,
  startFinalePracticePhase,
  type FinalePracticePhase,
  type FinalePracticeSnapshot,
} from './finale-practice.ts';

export interface RematchEntry {
  source: Level;
  level: Level;
  checkpoint: Checkpoint;
}
export interface RoomRematchSnapshot {
  damageSummary?: DamageRoomSummary;
  startingHp?: number;
  finalePractice?: FinalePracticeSnapshot;
  level: Level;
  checkpoint: Checkpoint;
  cosmetics: Cosmetics;
  guidance: ReturnType<typeof replayGuidance>;
}
export function rematchEntry(g: Game): RematchEntry | null {
  // Traversal trials, the long extraction and scripted shutdown are not a
  // single combat room. Their existing retries remain available.
  if (
    g.mode !== 'playing' ||
    g.clear ||
    g.practice ||
    g.workshop.active ||
    g.testRun?.rematchRoom ||
    g.escape ||
    g.maintenance.active ||
    g.recoil.active ||
    g.shutdown.chamber
  )
    return null;
  const checkpoint = { ...g.testRun, ...g.checkpointSnapshot() };
  delete checkpoint.reward;
  delete checkpoint.reforgeRoom;
  return { source: g.level, level: structuredClone(g.level), checkpoint };
}
export function roomRematchSnapshot(
  g: Game,
  entry: RematchEntry | null,
): RoomRematchSnapshot | null {
  if (g.mode !== 'dead' || !entry || entry.source !== g.level || g.practice || g.workshop.active)
    return null;
  const finalePractice = finalePracticeFor(g);
  return {
    ...(finalePractice ? { finalePractice } : {}),
    damageSummary: structuredClone(g.damageControl.summary()),
    startingHp: entry.checkpoint.hp,
    level: structuredClone(entry.level),
    checkpoint: {
      ...structuredClone(entry.checkpoint),
      hp: 100,
      kills: 0,
      elapsed: 0,
      startingGun: g.startingGun,
      mods: [...g.mods],
      legacyMods: g.legacyMods ? [...g.legacyMods] : undefined,
      finaleService: g.finaleService.checkpoint,
      combatResults: undefined,
    },
    cosmetics: { ...g.cosmetics },
    guidance: finalePractice
      ? finalePracticeGuidance(finalePractice.deathPhase, finalePractice.cause)
      : replayGuidance(g.deathCause),
  };
}
export class RoomRematch {
  readonly game = new Game();
  readonly snapshot: RoomRematchSnapshot;
  finalePhase: FinalePracticePhase | null = null;
  attemptStartingHp = 100;
  constructor(snapshot: RoomRematchSnapshot) {
    this.snapshot = structuredClone(snapshot);
    const finale = this.snapshot.finalePractice;
    if (
      finale &&
      isFinalePracticePhase(finale.deathPhase) &&
      isFinalePracticePhase(finale.reached) &&
      finale.deathPhase <= finale.reached
    )
      this.finalePhase = finale.deathPhase;
    else delete this.snapshot.finalePractice;
    this.reset();
  }
  reset() {
    this.game.cosmetics = { ...this.snapshot.cosmetics };
    this.game.startTest(this.snapshot.checkpoint, this.snapshot.level);
    if (this.finalePhase !== null) startFinalePracticePhase(this.game, this.finalePhase);
    this.attemptStartingHp = this.game.hp;
    this.game.setMode('paused');
  }
  selectFinalePhase(phase: number): boolean {
    if (
      !isFinalePracticePhase(phase) ||
      !this.snapshot.finalePractice ||
      phase > this.snapshot.finalePractice.reached
    )
      return false;
    this.finalePhase = phase;
    this.reset();
    return true;
  }
  get damageResult(): DamageRoomSummary | null {
    return this.game.mode === 'dead' || this.game.mode === 'won'
      ? this.game.damageControl.summary()
      : null;
  }
  tick(dt: number, input: Input) {
    this.game.tick(dt, input);
  }
  dispose() {
    this.game.setMode('title');
    Matter.Composite.clear(this.game.engine.world, false);
    Matter.Engine.clear(this.game.engine);
  }
}
export function rematchPreviewFromUrl(url: URL): { scene: string; checkpoint: Checkpoint } | null {
  const p = url.searchParams;
  if (p.get('test') !== 'rematch' || p.get('v') !== '1') return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'scene', 'v'].includes(key) || p.getAll(key).length !== 1) invalid = true;
  });
  const scene = p.get('scene') ?? 'patrol';
  if (invalid || !['patrol', 'mortar', 'boss'].includes(scene)) return null;
  const checkpoint: Checkpoint =
    scene === 'boss'
      ? practiceCheckpoint({ kind: 'loader', seed: 'LOADER-SHIFT-5' })!
      : {
          version: 6,
          seed: scene === 'mortar' ? 'RF-C89-EXP-MACH-mortar' : 'DEATH-REPLAY-86',
          stage: scene === 'mortar' ? 14 : 0,
          mods: scene === 'mortar' ? ['magnum', 'rapid', 'scatter', 'pierce'] : [],
          hp: 1,
          kills: 0,
          elapsed: 0,
          ...(scene === 'mortar' ? { encounters: 1 as const } : {}),
        };
  return { scene, checkpoint: { ...checkpoint, hp: 1 } };
}
