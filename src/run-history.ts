import type { Game } from './game.ts';
import { AREAS, type AreaId } from './areas.ts';
import { DAILY_RULESET, dailyFromSeed, isUnsupportedDailySeed } from './daily.ts';
import { STAGES, validBuild, validLegacyBuild, validSavedBuild } from './rules.ts';
import { loadDamageCause, type DamageCause } from './damage-cause.ts';
import { workshopBuild } from './workshop-build.ts';

export const RUN_HISTORY_KEY = 'rf-run-history-v1';
export const RUN_HISTORY_LIMIT = 10;
export interface RunRecap {
  version: 1;
  id: string;
  finishedAt: number;
  seed: string;
  ruleset: number;
  outcome: 'dead' | 'won';
  mode: 'normal' | 'daily';
  stage: number;
  area: AreaId;
  annex?: true;
  roomName: string;
  overtime: boolean;
  detour: boolean;
  escape: boolean;
  kills: number;
  elapsed: number;
  mods: string[];
  legacyMods?: string[];
  shutdown?: true;
  cause: DamageCause | null;
}
const text = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max;
export function loadRunHistory(value: unknown): RunRecap[] {
  if (!Array.isArray(value)) return [];
  const records: RunRecap[] = [];
  for (const raw of value.slice(0, 100)) {
    if (
      !raw ||
      typeof raw !== 'object' ||
      raw.version !== 1 ||
      !text(raw.id, 80) ||
      !text(raw.seed, 40) ||
      !text(raw.roomName, 80) ||
      !Number.isSafeInteger(raw.finishedAt) ||
      raw.finishedAt < 0 ||
      raw.finishedAt > 8.64e15 ||
      !Number.isSafeInteger(raw.ruleset) ||
      raw.ruleset < 1 ||
      !['normal', 'daily'].includes(raw.mode) ||
      !['dead', 'won'].includes(raw.outcome) ||
      !Number.isInteger(raw.stage) ||
      raw.stage < 0 ||
      raw.stage >= STAGES ||
      typeof raw.area !== 'string' ||
      !Object.hasOwn(AREAS, raw.area) ||
      !['overtime', 'detour', 'escape'].every((key) => typeof raw[key] === 'boolean') ||
      !Number.isSafeInteger(raw.kills) ||
      raw.kills < 0 ||
      raw.kills > 1e7 ||
      !Number.isFinite(raw.elapsed) ||
      raw.elapsed < 0 ||
      raw.elapsed > 1e8 ||
      !Array.isArray(raw.mods) ||
      !validSavedBuild(
        raw.mods,
        raw.legacyMods ?? (raw.ruleset <= 60 && validLegacyBuild(raw.mods) ? raw.mods : undefined),
      ) ||
      records.some((record) => record.id === raw.id)
    )
      continue;
    const daily = !!dailyFromSeed(raw.seed) || isUnsupportedDailySeed(raw.seed);
    if ((raw.mode === 'daily') !== daily || (daily && raw.overtime)) continue;
    records.push({
      version: 1,
      id: raw.id,
      finishedAt: raw.finishedAt,
      seed: raw.seed,
      ruleset: raw.ruleset,
      outcome: raw.outcome,
      ...(raw.shutdown === true && raw.stage === 19 && !raw.overtime && !raw.escape
        ? { shutdown: true }
        : {}),
      mode: raw.mode,
      stage: raw.stage,
      area: raw.area as AreaId,
      ...(raw.annex === true && raw.stage >= 8 && raw.stage <= 11 && !raw.overtime && !raw.detour
        ? { annex: true as const }
        : {}),
      roomName: raw.roomName,
      overtime: raw.overtime,
      detour: raw.detour,
      escape: raw.escape,
      kills: raw.kills,
      elapsed: raw.elapsed,
      mods: [...raw.mods],
      ...(raw.legacyMods
        ? { legacyMods: [...raw.legacyMods] }
        : !validBuild(raw.mods) && raw.ruleset <= 60
          ? { legacyMods: [...raw.mods] }
          : {}),
      cause: raw.outcome === 'dead' ? loadDamageCause(raw.cause) : null,
    });
  }
  return records.sort((a, b) => b.finishedAt - a.finishedAt).slice(0, RUN_HISTORY_LIMIT);
}
export function snapshotRun(game: Game, id: string, finishedAt = Date.now()): RunRecap | null {
  if (
    game.practice ||
    game.testRun ||
    game.workshop.active ||
    (game.mode !== 'dead' && game.mode !== 'won')
  )
    return null;
  return (
    loadRunHistory([
      {
        version: 1,
        id,
        finishedAt,
        seed: game.seed,
        ruleset: DAILY_RULESET,
        outcome: game.mode,
        mode: dailyFromSeed(game.seed) ? 'daily' : 'normal',
        stage: game.stage,
        area: game.level.area,
        ...(game.level.annex ? { annex: true as const } : {}),
        roomName: game.level.name,
        overtime: !!game.overtime,
        detour: game.detour,
        escape: !!game.escape,
        ...(game.shutdown.chamber ? { shutdown: true } : {}),
        kills: game.kills,
        elapsed: game.elapsed,
        mods: game.mods,
        ...(game.legacyMods ? { legacyMods: game.legacyMods } : {}),
        cause: game.deathCause,
      },
    ])[0] ?? null
  );
}
export function addRun(value: unknown, run: RunRecap): RunRecap[] {
  return loadRunHistory([run, ...loadRunHistory(value).filter((record) => record.id !== run.id)]);
}
export function canReplayRun(run: RunRecap) {
  return (
    run.ruleset === DAILY_RULESET &&
    !run.legacyMods &&
    !isUnsupportedDailySeed(run.seed) &&
    (run.mode !== 'daily' || !!dailyFromSeed(run.seed))
  );
}
export function canPracticeRunBuild(run: RunRecap, known: readonly string[]) {
  const build = workshopBuild(run.mods, known);
  return build.length === run.mods.length && build.every((id, i) => id === run.mods[i]);
}
export function reachedRoom(run: RunRecap) {
  return (
    (run.overtime ? 'Overtime · ' : '') +
    (run.shutdown
      ? 'Continuity control'
      : run.escape
        ? 'Escape'
        : (run.detour ? 'Challenge · ' : '') + 'Room ' + String(run.stage + 1).padStart(2, '0'))
  );
}
