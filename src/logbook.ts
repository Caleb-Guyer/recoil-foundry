import { COURIER_ARCHIVE_ID } from './courier-record-id.ts';
import { courierLogbookEntry } from './courier-record.ts';
import { MODS, modPathLabel } from './rules.ts';
import { AREAS, type AreaId } from './areas.ts';
import { ENEMY_NAMES } from './damage-cause.ts';
import type { EnemyKind } from './levels.ts';
import { UPGRADE_LORE, type Lore } from './lore-upgrades.ts';
import { MACHINE_LORE, PLACE_LORE, RECORDS, TOOL_LORE } from './lore-factory.ts';
import { COMMENDATIONS, commendationVisible, type CommendationId } from './commendations.ts';
import { REGION_NAMES } from './regions.ts';

import {
  loadLogbook,
  type LogbookProgress,
  type LogbookEntry,
  type LogbookSection,
} from './logbook-progress.ts';
export * from './logbook-progress.ts';
const areaIds = Object.keys(AREAS) as AreaId[];
const enemyIds = Object.keys(ENEMY_NAMES) as EnemyKind[];
export function logbookEntries(
  known: readonly string[],
  progress: LogbookProgress,
  commendations: readonly CommendationId[] = [],
  revealed: readonly string[] = [],
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
    ...(revealed.includes(COURIER_ARCHIVE_ID) ? [courierLogbookEntry()] : []),
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
    ...COMMENDATIONS.filter((c) =>
      commendationVisible(c.id, safe.enemies, commendations, known, revealed),
    ).map((c) => ({
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
  machines: enemyIds.length + 1,
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
// Curated, early-game documents only. This view never enters the discovery store.
export function logbookPreviewEntries() {
  return logbookEntries(
    ['magnum', 'kick', 'ricochet', 'fold', 'cutting-torch'],
    {
      version: 1,
      enemies: ['runner', 'shooter', 'charger'],
      areas: ['docks'],
      escaped: false,
    },
    [],
    [COURIER_ARCHIVE_ID],
  );
}
