import { MODS, areaIndex, modPathLabel, type Checkpoint, type Mod } from './rules.ts';
import { AREAS, type AreaId } from './areas.ts';
import { ENEMY_NAMES } from './damage-cause.ts';
import type { EnemyKind } from './levels.ts';
import type { Game } from './game.ts';
import type { RunRecap } from './run-history.ts';
import { PRACTICE_BOSSES, type Encounter } from './practice.ts';
import { UPGRADE_LORE, type Lore } from './lore-upgrades.ts';
import { MACHINE_LORE, PLACE_LORE, RECORDS, TOOL_LORE } from './lore-factory.ts';

export const LOGBOOK_KEY = 'rf-logbook-v1';
export const LOGBOOK_SECTIONS = ['equipment', 'machines', 'places', 'records'] as const;
export type LogbookSection = (typeof LOGBOOK_SECTIONS)[number];
export interface LogbookProgress {
  version: 1;
  enemies: EnemyKind[];
  areas: AreaId[];
  escaped: boolean;
}
const areaIds = Object.keys(AREAS) as AreaId[];
const enemyIds = Object.keys(ENEMY_NAMES) as EnemyKind[];
export function loadLogbook(raw: unknown): LogbookProgress {
  const value = raw as Partial<LogbookProgress> | null;
  if (!value || value.version !== 1) return { version: 1, enemies: [], areas: [], escaped: false };
  return {
    version: 1,
    enemies: enemyIds.filter((id) => Array.isArray(value.enemies) && value.enemies.includes(id)),
    areas: areaIds.filter((id) => Array.isArray(value.areas) && value.areas.includes(id)),
    escaped: value.escaped === true,
  };
}
export function mergeLogbook(a: LogbookProgress, b: LogbookProgress): LogbookProgress {
  return loadLogbook({
    version: 1,
    enemies: [...a.enemies, ...b.enemies],
    areas: [...a.areas, ...b.areas],
    escaped: a.escaped || b.escaped,
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
    checkpoint?.stage,
    ...history.map((run) => run.stage),
    ...victories.map((victory) => PRACTICE_BOSSES[victory.kind].stage),
  ].filter((stage): stage is number => stage !== undefined);
  return mergeLogbook(progress, {
    version: 1,
    enemies: victories.map((victory) => victory.kind),
    areas: stages.length ? areaIds.slice(0, areaIndex(Math.max(...stages)) + 1) : [],
    escaped: history.some((run) => run.outcome === 'won'),
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
    areas: [game.level.area],
    escaped: game.mode === 'won',
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
}
export function logbookEntries(
  known: readonly string[],
  progress: LogbookProgress,
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
    ...RECORDS.filter(
      (record) =>
        record.unlock === 'always' ||
        (record.unlock === 'escaped' ? safe.escaped : safe.areas.includes(record.unlock)),
    ).map((record) => ({
      id: 'record:' + record.id,
      name: record.name,
      section: 'records' as const,
      label: 'Recovered document',
      description: '',
      lore: record.lore,
    })),
  ];
}
export const LOGBOOK_TOTALS: Record<LogbookSection, number> = {
  equipment: MODS.length + 1,
  machines: enemyIds.length,
  places: areaIds.length,
  records: RECORDS.length,
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
