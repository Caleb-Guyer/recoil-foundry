import { COURIER_ARCHIVE_ID } from './courier-record-id.ts';
import { COMMENDATIONS, commendationVisible, type CommendationId } from './commendations.ts';
import { RECORD_RULES } from './record-index.ts';
import type { LogbookProgress } from './logbook-progress.ts';
import type { UnlockGoal } from './longevity.ts';
import type { ArchiveProgress } from './archive.ts';
import type { WeaponUnlocks } from './weapon-unlocks.ts';
import { MODS } from './rules.ts';

export function recoveredLogbookTokens(
  known: readonly string[],
  book: LogbookProgress,
  earned: readonly CommendationId[] = [],
  revealed: readonly string[] = [],
): string[] {
  return [
    'tool',
    ...MODS.filter((mod) => known.includes(mod.id)).map((mod) => 'mod:' + mod.id),
    ...(revealed.includes(COURIER_ARCHIVE_ID) ? [COURIER_ARCHIVE_ID] : []),
    ...book.enemies.map((id) => 'enemy:' + id),
    ...book.areas.map((id) => 'area:' + id),
    ...(book.annex ? ['region:annex'] : []),
    ...RECORD_RULES.filter(
      (record) =>
        record.unlock === 'always' ||
        (record.unlock === 'disconnect'
          ? book.disconnects?.includes(record.stage)
          : record.unlock === 'shutdown'
            ? book.shutdown
            : record.unlock === 'found'
              ? book.stories?.includes(record.story)
              : record.unlock === 'escaped'
                ? book.escaped
                : book.areas.includes(record.unlock)),
    ).map((record) => 'record:' + record.id),
    ...COMMENDATIONS.filter((c) =>
      commendationVisible(c.id, book.enemies, earned, known, revealed),
    ).map((c) => 'commendation:' + c.id + (earned.includes(c.id) ? ':earned' : '')),
  ];
}

// The title needs notification tokens, not every document's prose and picture.
// Keep token selection identical to the catalog, including unlock -> discovery
// and pending -> earned transitions, so reading one item clears only that item.
export function unreadCatalogCount(
  collected: readonly string[],
  earned: readonly CommendationId[],
  archive: ArchiveProgress,
  goals: readonly UnlockGoal[],
  weapons: WeaponUnlocks,
) {
  const read = new Set(archive.read),
    encountered = new Set(archive.encountered);
  return archive.encountered.filter((token) => {
    if (read.has(token)) return false;
    if (token.startsWith('gun:')) return weapons.started;
    if (token.startsWith('mod:')) {
      const id = token.split(':')[1];
      const known = collected.includes(id) || encountered.has('mod:' + id);
      return token.endsWith(':unlocked')
        ? !known && !!goals.find((g) => g.id === id)?.unlocked
        : true;
    }
    if (token.startsWith('commendation:')) {
      const id = token.split(':')[1] as CommendationId;
      return token.endsWith(':earned') === earned.includes(id);
    }
    return true;
  }).length;
}
