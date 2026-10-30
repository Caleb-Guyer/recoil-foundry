import type { LogbookEntry } from './logbook-progress.ts';
import type { Lore } from './lore-upgrades.ts';

import { COURIER_ARCHIVE_ID } from './courier-record-id.ts';
export { COURIER_ARCHIVE_ID } from './courier-record-id.ts';
export const COURIER_GUIDE =
  'An optional cargo chase. It vaults cover and needs three uninterrupted seconds beside the dispatch hatch to escape; pushing it away resets the opening. Defeat it, then approach the dropped case with a clear line to collect it. Clear the room and leave normally to choose one bonus upgrade before the ordinary room reward. The cargo choice cannot be rerolled and does not heal or advance the room. The Courier never blocks the room exit.';
export const COURIER_LORE: Lore = [
  'Dispatch manifest · carried stock',
  'T. Orr · dispatch',
  'The small delivery frame is still following its collection route. Its case contains fittings signed out to departments that no longer answer the telephone. Nobody has told it where to return them.\n\nThe dispatch hatch takes three seconds to release. That delay was added so a worker could check the manifest before the load left the building. The machine has kept the delay. We should keep the opportunity.',
];
export function courierLogbookEntry(): LogbookEntry {
  return {
    id: COURIER_ARCHIVE_ID,
    name: 'Scrap Courier',
    section: 'machines',
    label: 'Optional cargo encounter',
    description: COURIER_GUIDE,
    lore: [...COURIER_LORE],
  };
}
