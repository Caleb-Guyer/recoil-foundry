import { areaIndex, type Checkpoint, type Mod } from './rules.ts';
import { AREAS, type AreaId } from './areas.ts';
import { ENEMY_NAMES } from './damage-cause.ts';
import type { EnemyKind } from './levels.ts';
import type { Game } from './game.ts';
import type { RunRecap } from './run-history.ts';
import { practiceStage, type Encounter } from './practice.ts';
import type { Lore } from './lore-upgrades.ts';

import { DISCONNECT_STAGES } from './shutdown-layout.ts';
import { STORY_KINDS, type StoryKind } from './story-layout.ts';
import { COMMENDATIONS, commendationVisible, type CommendationId } from './commendations.ts';
import { annexRevision, isAnnexStage } from './regions.ts';

export const LOGBOOK_KEY = 'rf-logbook-v1';
export const LOGBOOK_SECTIONS = [
  'equipment',
  'machines',
  'places',
  'records',
  'commendations',
] as const;
export type LogbookSection = (typeof LOGBOOK_SECTIONS)[number];
export interface LogbookProgress {
  version: 1;
  enemies: EnemyKind[];
  areas: AreaId[];
  escaped: boolean;
  stories?: StoryKind[];
  disconnects?: number[];
  shutdown?: true;
  annex?: true;
}
const areaIds = Object.keys(AREAS) as AreaId[];
const enemyIds = Object.keys(ENEMY_NAMES) as EnemyKind[];
export function loadLogbook(raw: unknown): LogbookProgress {
  const value = raw as Partial<LogbookProgress> | null;
  if (!value || value.version !== 1) return { version: 1, enemies: [], areas: [], escaped: false };
  const stories = STORY_KINDS.filter(
    (id) => Array.isArray(value.stories) && value.stories.includes(id),
  );
  return {
    version: 1,
    enemies: enemyIds.filter((id) => Array.isArray(value.enemies) && value.enemies.includes(id)),
    areas: areaIds.filter((id) => Array.isArray(value.areas) && value.areas.includes(id)),
    escaped: value.escaped === true,
    ...(stories.length ? { stories } : {}),
    ...(Array.isArray(value.disconnects) &&
    value.disconnects.some((s) => (DISCONNECT_STAGES as readonly number[]).includes(s))
      ? { disconnects: DISCONNECT_STAGES.filter((s) => value.disconnects!.includes(s)) }
      : {}),
    ...(value.shutdown === true ? { shutdown: true } : {}),
    ...(value.annex === true ? { annex: true } : {}),
  };
}
export function mergeLogbook(a: LogbookProgress, b: LogbookProgress): LogbookProgress {
  return loadLogbook({
    version: 1,
    enemies: [...a.enemies, ...b.enemies],
    areas: [...a.areas, ...b.areas],
    escaped: a.escaped || b.escaped,
    stories: [...(a.stories ?? []), ...(b.stories ?? [])],
    disconnects: [...(a.disconnects ?? []), ...(b.disconnects ?? [])],
    ...(a.shutdown || b.shutdown ? { shutdown: true } : {}),
    ...(a.annex || b.annex ? { annex: true } : {}),
  });
}
export function migrateLogbook(
  raw: unknown,
  checkpoint: Checkpoint | null,
  history: readonly RunRecap[],
  victories: readonly Encounter[],
) {
  const progress = loadLogbook(raw);
  const stages = [
    checkpoint &&
    isAnnexStage(
      checkpoint.region,
      checkpoint.stage,
      !!checkpoint.overtime,
      annexRevision(checkpoint.seed, checkpoint),
    )
      ? 7
      : checkpoint?.stage,
    ...history.map((run) => (run.annex ? 7 : run.stage)),
    ...victories.map((victory) => (victory.kind === 'switchboard' ? 7 : practiceStage(victory))),
  ].filter((stage): stage is number => stage !== undefined);
  return mergeLogbook(progress, {
    version: 1,
    enemies: victories.map((victory) => victory.kind),
    ...((checkpoint &&
      isAnnexStage(
        checkpoint.region,
        checkpoint.stage,
        !!checkpoint.overtime,
        annexRevision(checkpoint.seed, checkpoint),
      )) ||
    history.some((run) => run.annex) ||
    victories.some((v) => v.kind === 'switchboard')
      ? { annex: true as const }
      : {}),
    areas: stages.length ? areaIds.slice(0, areaIndex(Math.max(...stages)) + 1) : [],
    escaped: history.some((run) => run.outcome === 'won' && !run.shutdown),
    stories: checkpoint?.story?.recovered ? [checkpoint.story.kind] : [],
    disconnects: checkpoint?.shutdown?.disabled ?? [],
    ...(history.some((run) => run.outcome === 'won' && run.shutdown) ? { shutdown: true } : {}),
  });
}
export function recordLogbook(progress: LogbookProgress, game: Game, enemy?: EnemyKind) {
  if (
    game.practice ||
    game.testRun ||
    game.workshop.active ||
    !['playing', 'paused', 'upgrade', 'reforge', 'dead', 'won'].includes(game.mode)
  )
    return progress;
  return mergeLogbook(progress, {
    version: 1,
    enemies: enemy ? [enemy] : [],
    areas: game.level.annex ? [] : [game.level.area],
    ...(game.level.annex ? { annex: true as const } : {}),
    escaped: game.mode === 'won' && !game.shutdown.complete,
    stories: game.story.state?.recovered ? [game.story.state.kind] : [],
    disconnects: game.shutdown.state?.disabled ?? [],
    ...(game.shutdown.complete && game.mode === 'won' ? { shutdown: true } : {}),
  });
}

export interface LogbookEntry {
  id: string;
  name: string;
  section: LogbookSection;
  label: string;
  description: string;
  lore: Lore;
  mod?: Mod;
  weapon?: import('./starting-guns.ts').StartingGun;
  earned?: boolean;
  reward?: string;
  state?: 'locked' | 'unseen' | 'known';
  family?: string;
  unread?: boolean;
  notification?: string;
  unlock?: string;
  goal?: import('./longevity.ts').UnlockGoal;
  mastery?: import('./support-mastery.ts').SupportMasteryProgress;
}
export function logbookLink(url: URL): 'collection' | 'preview' | null {
  const p = url.searchParams;
  const kind =
    p.get('logbook') === '1' ? 'collection' : p.get('test') === 'logbook' ? 'preview' : null;
  if (!kind) return null;
  const field = kind === 'collection' ? 'logbook' : 'test';
  let invalid = p.getAll(field).length !== 1;
  p.forEach((_, key) => {
    if (![field, 'v'].includes(key)) invalid = true;
  });
  return invalid ? null : kind;
}
