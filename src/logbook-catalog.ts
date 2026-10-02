import { MODS, MOD_PATHS, PATH_NAMES } from './rules.ts';
import { AREAS } from './areas.ts';
import { ENEMY_NAMES } from './damage-cause.ts';
import type { EnemyKind } from './levels.ts';
import { COMMENDATIONS, type CommendationId } from './commendations.ts';
import { RECORDS, PLACE_LORE } from './lore-factory.ts';
import type { Lore } from './lore-upgrades.ts';
import {
  loadLogbook,
  mergeLogbook,
  logbookEntries,
  type LogbookProgress,
  type LogbookEntry,
} from './logbook.ts';
import { loadArchive, archiveToken, archiveUnread } from './archive.ts';
import { ENEMY_GUIDES } from './archive-art.ts';

const EMPTY_LORE: Lore = ['', '', ''];
export const VARIANT_RECORDS = [
  {
    id: 'elite:shielded',
    name: 'Shielded Runner',
    description: 'Its forward shield blocks attacks. Move around it or attack while it turns.',
    lore: [
      'Security requisition · shield conversion',
      'E. Holt · safety office',
      'The plate was issued to protect the small delivery frame from falling scrap. Security moved it to the front and deleted the delivery schedule.\n\nThe turn mechanism still takes time to carry that much weight. I have left the service interval on the panel. Somebody may find it more useful than the new instructions.',
    ] as Lore,
  },
  {
    id: 'elite:twin',
    name: 'Twin Sniper',
    description:
      'Follows its first shot with a second warned shot. Keep moving through both releases.',
    lore: [
      'Alignment redundancy · two readings',
      'Dr. S. Anik · development',
      'One correction was considered insufficient. The second head checks the same line after the first has finished. That was the design submitted to Purchasing.\n\nThe field version has no measurement attachment. Both heads fire instead. There is still a delay between them, because nobody paid for a second timing board.',
    ] as Lore,
  },
  {
    id: 'elite:volatile',
    name: 'Volatile Flyer',
    description: 'Warns before releasing an explosive attack. Give its marked blast space.',
    lore: [
      'Inspection fuel · revised load',
      'M. Vale · maintenance',
      'The inspection head was never meant to carry a pressure vessel. Its lift motor can manage the load, but the housing rings every time the valve opens.\n\nI asked them to remove the vessel. They added a warning lamp instead. The lamp works. Please treat it as the answer to my request.',
    ] as Lore,
  },
  {
    id: 'mutation:splitter',
    name: 'Splitter',
    description:
      'Breaks into smaller attackers when defeated. The room is not clear until those units are gone.',
    lore: [
      'Floor service · distributed frame',
      'M. Vale · maintenance',
      'Three smaller frames share one delivery route. We joined them so a single motor could take the loaded tray across the floor.\n\nThe coupling is now designed to fail under impact. The remaining frames keep following the route independently. I recognise the replacement bolts. Someone has been preparing these failures on purpose.',
    ] as Lore,
  },
  {
    id: 'mutation:gunner',
    name: 'Volatile Gunner',
    description: 'Uses explosive ammunition. Watch the shell warning and leave its impact area.',
    lore: [
      'Fastening stock · sealed ammunition',
      'E. Holt · safety office',
      'The new cartridges were signed out as fastening stock. Their packing instructions require everyone in the room to leave before the case is opened.\n\nThe converted head cannot read packing instructions. It can read a target coordinate. I have attached both documents to the same incident report and requested that someone explain the difference.',
    ] as Lore,
  },
  {
    id: 'mutation:blinker',
    name: 'Blinker',
    description:
      'Telegraphs a new position before relocating. Follow the destination warning rather than its old position.',
    lore: [
      'Inspection route · missing transit',
      'T. Orr · dispatch',
      'The head acknowledged one station and reported from the next without recording the aisle between them. I assumed the route log had failed.\n\nThe overhead camera shows the same omission. There is a brief lamp at the receiving station before it arrives. That is the only part of its schedule we can still trust.',
    ] as Lore,
  },
] as const;

const ZONE_GUIDES: Record<string, string> = {
  docks:
    'Loading routes, moving cargo and overhead handling machinery. Watch the warning lights and leave space around heavy loads.',
  furnace:
    'Production halls with hot machinery and changing cover. Plan a route around the next warned attack.',
  cooling:
    'Pressure-controlled aisles and coolant machinery. Read the warnings before entering a marked lane.',
  reclamation:
    'Sorting machinery and loose industrial debris. Cover and cargo can become part of the fight.',
  rooftops:
    'Exposed upper levels and electrical machinery. Keep a safe landing route while using recoil to climb.',
};
const shutdownLore: Lore = [
  'Continuity control · chamber access',
  'T. Orr · dispatch',
  'The room was omitted from the route plan, but every instruction eventually passed through it. I found the missing label inside a locked filing cabinet.\n\nThere was no operator listed for the controls. There was a space for a signature after the shutdown procedure. I have left that space where the next person can see it.',
];

export function logbookCatalog(
  collected: readonly string[],
  progress: LogbookProgress,
  earned: readonly CommendationId[],
  rawArchive: unknown,
): LogbookEntry[] {
  const archive = loadArchive(rawArchive),
    base = loadLogbook(progress);
  const knownMods = MODS.filter(
    (m) => collected.includes(m.id) || archive.encountered.includes('mod:' + m.id),
  ).map((m) => m.id);
  const book = mergeLogbook(base, {
    version: 1,
    enemies: (Object.keys(ENEMY_NAMES) as EnemyKind[]).filter((id) =>
      archive.encountered.includes('enemy:' + id),
    ),
    areas: [],
    escaped: false,
  });
  const recovered = new Map(logbookEntries(knownMods, book, earned).map((e) => [e.id, e]));
  const entries: LogbookEntry[] = [
    recovered.get('tool')!,
    ...MODS.map((mod, index) => {
      const existing = recovered.get('mod:' + mod.id);
      return {
        ...(existing ?? {
          id: 'mod:' + mod.id,
          name: 'Upgrade ' + String(index + 1).padStart(3, '0'),
          section: 'equipment' as const,
          label: 'Not yet encountered',
          description: '',
          lore: EMPTY_LORE,
          mod,
        }),
        state: existing ? ('known' as const) : ('unseen' as const),
        family: MOD_PATHS[mod.id]?.path ?? 'general',
      };
    }),
    ...Object.entries(ENEMY_NAMES).map(([id, name], index) => {
      const entry = recovered.get('enemy:' + id);
      return entry
        ? { ...entry, description: ENEMY_GUIDES[id as EnemyKind], state: 'known' as const }
        : {
            id: 'enemy:' + id,
            name: 'Machine ' + String(index + 1).padStart(2, '0'),
            section: 'machines' as const,
            label: 'Not yet encountered',
            description: '',
            lore: EMPTY_LORE,
            state: 'unseen' as const,
          };
    }),
    ...VARIANT_RECORDS.map((record) => {
      const known = archive.encountered.includes(record.id);
      return {
        id: record.id,
        name: known ? record.name : 'Unseen variant',
        section: 'machines' as const,
        label: known ? 'Variant record' : 'Not yet encountered',
        description: known ? record.description : '',
        lore: known ? record.lore : EMPTY_LORE,
        state: known ? ('known' as const) : ('unseen' as const),
      };
    }),
    ...Object.entries(AREAS).map(([id, area], index) => {
      const known = book.areas.includes(id as keyof typeof AREAS);
      return {
        id: 'area:' + id,
        name: known ? area.name : 'Zone ' + String(index + 1).padStart(2, '0'),
        section: 'places' as const,
        label: known ? 'Site record' : 'Not yet visited',
        description: known ? ZONE_GUIDES[id] : '',
        lore: known ? PLACE_LORE[id as keyof typeof AREAS] : EMPTY_LORE,
        state: known ? ('known' as const) : ('unseen' as const),
      };
    }),
    ...(recovered.has('region:annex')
      ? [
          {
            ...recovered.get('region:annex')!,
            state: 'known' as const,
            description: 'An alternate route through signal racks and disputed dispatch orders.',
          },
        ]
      : [
          {
            id: 'region:annex',
            name: 'Unvisited site',
            section: 'places' as const,
            label: 'Not yet visited',
            description: '',
            lore: EMPTY_LORE,
            state: 'unseen' as const,
          },
        ]),
    {
      id: 'region:shutdown',
      name: book.shutdown ? 'Continuity control' : 'Unvisited site',
      section: 'places',
      label: book.shutdown ? 'Site record' : 'Not yet visited',
      description: book.shutdown ? 'The Foundry’s hidden control chamber.' : '',
      lore: book.shutdown ? shutdownLore : EMPTY_LORE,
      state: book.shutdown ? 'known' : 'unseen',
    },
    ...RECORDS.map(
      (record, index) =>
        recovered.get('record:' + record.id) ?? {
          id: 'record:' + record.id,
          name: 'Document ' + String(index + 1).padStart(2, '0'),
          section: 'records' as const,
          label: 'Not yet recovered',
          description: '',
          lore: EMPTY_LORE,
          state: 'unseen' as const,
        },
    ),
    ...COMMENDATIONS.map((commendation, index) => {
      const entry = recovered.get('commendation:' + commendation.id);
      return entry
        ? {
            ...entry,
            state: entry.earned ? ('known' as const) : ('locked' as const),
            unlock: entry.earned ? undefined : commendation.objective,
          }
        : {
            id: 'commendation:' + commendation.id,
            name: 'Challenge ' + String(index + 1).padStart(2, '0'),
            section: 'commendations' as const,
            label: 'Not yet revealed',
            description: '',
            lore: EMPTY_LORE,
            state: 'unseen' as const,
          };
    }),
  ];
  return entries.map((entry) => ({
    ...entry,
    state: entry.state ?? 'known',
    notification: archiveToken(entry),
    unread: archiveUnread(archive, archiveToken(entry)),
  }));
}

export function recoveredCatalogTokens(entries: readonly LogbookEntry[]) {
  return entries.filter((e) => e.state === 'known' || e.state === 'locked').map(archiveToken);
}
export const CATALOG_FAMILIES = [
  { id: 'all', name: 'All families' },
  { id: 'general', name: 'General' },
  ...Object.entries(PATH_NAMES).map(([id, name]) => ({ id, name })),
];
export type CatalogFilter = 'all' | 'known' | 'unseen' | 'locked' | 'unread';
export function catalogMatches(
  entries: readonly LogbookEntry[],
  section: LogbookEntry['section'],
  query: string,
  filter: CatalogFilter = 'all',
  family = 'all',
) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter(
    (entry) =>
      entry.section === section &&
      (family === 'all' || entry.family === family) &&
      (filter === 'all' || (filter === 'unread' ? entry.unread : entry.state === filter)) &&
      words.every((word) => (entry.name + ' ' + entry.label).toLocaleLowerCase().includes(word)),
  );
}
