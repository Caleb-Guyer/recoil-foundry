import { MODS } from './rules.ts';
import { ENEMY_NAMES } from './damage-cause.ts';
import { AREAS } from './areas.ts';
import { RECORDS } from './lore-factory.ts';
import { COMMENDATIONS } from './commendations.ts';
import { logbookEntries, type LogbookEntry, type LogbookProgress } from './logbook.ts';
import type { CommendationId } from './commendations.ts';
import type { Enemy } from './game.ts';

export const ARCHIVE_KEY = 'rf-archive-v1';
export const VARIANT_IDS = [
  'elite:shielded',
  'elite:twin',
  'elite:volatile',
  'mutation:splitter',
  'mutation:gunner',
  'mutation:blinker',
] as const;
const ids = [
  'tool',
  ...MODS.map((m) => 'mod:' + m.id),
  ...Object.keys(ENEMY_NAMES).map((id) => 'enemy:' + id),
  ...Object.keys(AREAS).map((id) => 'area:' + id),
  'region:annex',
  'region:shutdown',
  ...VARIANT_IDS,
  ...RECORDS.map((r) => 'record:' + r.id),
  ...COMMENDATIONS.flatMap((c) => ['commendation:' + c.id, 'commendation:' + c.id + ':earned']),
];
export interface ArchiveProgress {
  version: 1;
  encountered: string[];
  read: string[];
}
export const archiveToken = (entry: LogbookEntry) =>
  entry.notification ?? entry.id + (entry.earned ? ':earned' : '');
export function loadArchive(raw: unknown): ArchiveProgress {
  const value = raw as Partial<ArchiveProgress> | null;
  const encountered = ids.filter(
    (id) =>
      value?.version === 1 && Array.isArray(value.encountered) && value.encountered.includes(id),
  );
  return {
    version: 1,
    encountered,
    read: encountered.filter((id) => Array.isArray(value?.read) && value.read.includes(id)),
  };
}
export function validArchive(raw: unknown): raw is ArchiveProgress {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const value = raw as ArchiveProgress;
  if (Object.keys(value).some((k) => !['version', 'encountered', 'read'].includes(k))) return false;
  const clean = loadArchive(value);
  return (
    value.version === 1 &&
    Array.isArray(value.encountered) &&
    Array.isArray(value.read) &&
    value.encountered.length === clean.encountered.length &&
    value.read.length === clean.read.length
  );
}
export function mergeArchive(a: unknown, b: unknown): ArchiveProgress {
  const first = loadArchive(a),
    second = loadArchive(b);
  return loadArchive({
    version: 1,
    encountered: [...first.encountered, ...second.encountered],
    read: [...first.read, ...second.read],
  });
}
export function encounterArchive(raw: unknown, encountered: readonly string[]): ArchiveProgress {
  const before = loadArchive(raw);
  return loadArchive({ ...before, encountered: [...before.encountered, ...encountered] });
}
export function readArchiveEntry(raw: unknown, token: string): ArchiveProgress {
  const before = loadArchive(raw);
  return loadArchive({ ...before, read: [...before.read, token] });
}
export function archiveUnread(raw: unknown, token: string) {
  const progress = loadArchive(raw);
  return progress.encountered.includes(token) && !progress.read.includes(token);
}
export function migrateArchive(
  raw: unknown,
  collected: readonly string[],
  book: LogbookProgress,
  earned: readonly CommendationId[],
): ArchiveProgress {
  if (raw !== null && raw !== undefined) return loadArchive(raw);
  // Existing records are the migration baseline. New discoveries after this
  // point notify individually instead of giving an established player 100 badges.
  const recovered = logbookEntries(collected, book, earned).map(archiveToken);
  if (book.shutdown) recovered.push('region:shutdown');
  return loadArchive({ version: 1, encountered: recovered, read: recovered });
}
export function enemyArchiveIds(enemy: Enemy) {
  if (
    enemy.hp <= 0 ||
    enemy.spawn > 0 ||
    enemy.allied ||
    enemy.courier ||
    enemy.eventRole === 'relay'
  )
    return [];
  return [
    'enemy:' + enemy.kind,
    ...(enemy.elite ? ['elite:' + enemy.elite] : []),
    ...(enemy.mutation ? ['mutation:' + enemy.mutation.kind] : []),
  ];
}
