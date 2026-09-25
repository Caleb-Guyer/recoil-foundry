import { MODS, areaIndex, modPathLabel, type Checkpoint, type Mod } from './rules.ts';
import { AREAS, type AreaId } from './areas.ts';
import { ENEMY_NAMES } from './damage-cause.ts';
import type { EnemyKind } from './levels.ts';
import type { Game } from './game.ts';
import type { RunRecap } from './run-history.ts';
import { PRACTICE_BOSSES, type Encounter } from './practice.ts';
import { UPGRADE_LORE, type Lore } from './lore-upgrades.ts';
import { MACHINE_LORE, PLACE_LORE, RECORDS, TOOL_LORE } from './lore-factory.ts';
import { DISCONNECT_STAGES } from './shutdown-layout.ts';
import { STORY_KINDS, type StoryKind } from './story-layout.ts';
import { COMMENDATIONS, type CommendationId } from './commendations.ts';
import { annexRevision, isAnnexStage, REGION_NAMES } from './regions.ts';

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
    ...victories.map((victory) =>
      victory.kind === 'switchboard' ? 7 : PRACTICE_BOSSES[victory.kind].stage,
    ),
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
  earned?: boolean;
  reward?: string;
}
export function logbookEntries(
  known: readonly string[],
  progress: LogbookProgress,
  commendations: readonly CommendationId[] = [],
): LogbookEntry[] {
  const safe = loadLogbook(progress);
  return [
    {
      id: 'tool',
      name: 'Service tool',
      section: 'equipment' as const,
      label: 'Standard issue',
      description: 'One gun. Interchangeable fittings. Enough recoil to find another way up.',
      lore: TOOL_LORE,
    },
    ...MODS.filter((mod) => known.includes(mod.id)).map((mod) => ({
      id: 'mod:' + mod.id,
      name: mod.name,
      section: 'equipment' as const,
      label: modPathLabel(mod.id) || 'General fitting',
      description: mod.description,
      lore: UPGRADE_LORE[mod.id],
      mod,
    })),
    ...safe.enemies.map((id) => ({
      id: 'enemy:' + id,
      name: ENEMY_NAMES[id],
      section: 'machines' as const,
      label: 'Machine record',
      description: '',
      lore: MACHINE_LORE[id],
    })),
    ...safe.areas.map((id) => ({
      id: 'area:' + id,
      name: AREAS[id].name,
      section: 'places' as const,
      label: 'Site record',
      description: '',
      lore: PLACE_LORE[id],
    })),
    ...(safe.annex
      ? [
          {
            id: 'region:annex',
            name: REGION_NAMES.annex,
            section: 'places' as const,
            label: 'Site record',
            description: '',
            lore: [
              'Cable survey · annex access',
              'T. Orr · dispatch',
              'The cooling line goes straight ahead. The other door is above it, where a maintenance ladder used to be. Nobody has filed a request to replace the ladder.\n\nInside, the racks are warm. Every receiver is waiting for instructions from a floor that no longer appears on our plans. I disconnected one. The others started answering for it.',
            ] as Lore,
          },
        ]
      : []),
    ...RECORDS.filter(
      (record) =>
        record.unlock === 'always' ||
        (record.unlock === 'disconnect'
          ? !!safe.disconnects?.includes(record.stage)
          : record.unlock === 'shutdown'
            ? !!safe.shutdown
            : record.unlock === 'found'
              ? !!safe.stories?.includes(record.story)
              : record.unlock === 'escaped'
                ? safe.escaped
                : safe.areas.includes(record.unlock)),
    ).map((record) => ({
      id: 'record:' + record.id,
      name: record.name,
      section: 'records' as const,
      label: 'Recovered document',
      description: '',
      lore: record.lore,
    })),
    ...COMMENDATIONS.map((c) => ({
      id: 'commendation:' + c.id,
      name: c.name,
      section: 'commendations' as const,
      label: commendations.includes(c.id) ? 'Commendation earned' : 'Commendation · Pending',
      description: c.objective,
      earned: commendations.includes(c.id),
      reward: c.reward + ' · ' + c.slot,
      lore: c.lore,
    })),
  ];
}
export const LOGBOOK_TOTALS: Record<LogbookSection, number> = {
  equipment: MODS.length + 1,
  machines: enemyIds.length,
  places: areaIds.length,
  records: RECORDS.length,
  commendations: COMMENDATIONS.length,
};
export function logbookMatches(
  entries: readonly LogbookEntry[],
  section: LogbookSection,
  query: string,
) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter(
    (entry) =>
      entry.section === section &&
      words.every((word) => (entry.name + ' ' + entry.label).toLocaleLowerCase().includes(word)),
  );
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
// Curated, early-game documents only. This view never enters the discovery store.
export function logbookPreviewEntries() {
  return logbookEntries(['magnum', 'kick', 'ricochet', 'fold', 'cutting-torch'], {
    version: 1,
    enemies: ['runner', 'shooter', 'charger'],
    areas: ['docks'],
    escaped: false,
  });
}
