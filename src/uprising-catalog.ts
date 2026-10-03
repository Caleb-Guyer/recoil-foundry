import type { LogbookEntry } from './logbook.ts';
import { loadArchive, archiveUnread } from './archive.ts';
import { uprisingContracts } from './uprising-model.ts';

export function uprisingCatalog(rawArchive: unknown, records: unknown): LogbookEntry[] {
  const archive = loadArchive(rawArchive);
  const sites = [
    {
      id: 'railworks',
      name: 'Railworks',
      description:
        'Moving railcars, stolen prototypes and evacuation platforms. Choose a job after room one.',
      lore: [
        'Dispatch record · unscheduled train',
        'T. Orr · dispatch',
        'The last train leaves without a manifest. I can give you the platform or the freight number, but not both.\n\nIf you take the prototype, expect somebody to come asking for it. If you catch the train, leave room for the crew. We have already lost enough people to this timetable.',
      ],
    },
    {
      id: 'core',
      name: 'Foundry Core',
      description:
        'Powered platforms and production relays. Cut production, protect the generator or recover research. Choose a job after room five.',
      lore: [
        'Production notice · power allocation',
        'M. Vale · maintenance',
        'The control relays keep the platform motors running. Break them and the platforms settle into their service position. That is the position we used before the foundry decided everything should keep moving.\n\nThe crew generator has its own circuit. If you keep it alive long enough, the crew can get out. Decide which circuit you came here for.',
      ],
    },
  ];
  return [
    ...sites.map((s) => ({
      id: 'region:' + s.id,
      name: archive.encountered.includes('region:' + s.id)
        ? s.name
        : 'District ' + (s.id === 'railworks' ? '01' : '02'),
      section: 'places' as const,
      label: 'Alternate district',
      description: archive.encountered.includes('region:' + s.id) ? s.description : '',
      lore: archive.encountered.includes('region:' + s.id)
        ? (s.lore as [string, string, string])
        : (['', '', ''] as [string, string, string]),
      state: archive.encountered.includes('region:' + s.id)
        ? ('known' as const)
        : ('unseen' as const),
      unread: archiveUnread(archive, 'region:' + s.id),
    })),
    ...uprisingContracts(records).map((c) => ({
      id: 'uprising:' + c.id,
      name: c.name,
      section: 'records' as const,
      label: 'Campaign contract · ' + c.current + ' / ' + c.target,
      description: c.requirement,
      unlock: c.reward,
      lore: [
        'Crew contract · ' + c.name,
        'T. Orr · dispatch',
        'We keep a record of completed jobs, even when the shift ends early. ' +
          c.requirement +
          '\n\n' +
          c.reward +
          ' The additional route becomes available when your next Campaign begins.',
      ] as [string, string, string],
      state: c.unlocked ? ('known' as const) : ('locked' as const),
      notification: 'uprising:' + c.id + ':unlocked',
      unread: c.unlocked && archiveUnread(archive, 'uprising:' + c.id + ':unlocked'),
    })),
  ];
}
