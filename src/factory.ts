import { seeded, type Checkpoint } from './rules.ts';
import { validAreaEvent, type AreaEventKind, type AreaEventSave } from './area-events.ts';

export const FACTORY_CONDITIONS = {
  freight: {
    name: 'Freight surge',
    description: 'Moving cargo and machinery interrupt the shift.',
  },
  power: { name: 'Power failure', description: 'Restore power in darkened rooms.' },
  conflict: { name: 'Faction conflict', description: 'Rival crews fight over the factory.' },
} as const;
export type FactoryCondition = keyof typeof FACTORY_CONDITIONS;
export const FACTORY_RULESET = 2;
export type FactoryVersion = 1 | 2 | 3 | 4;
export type FactoryEncounterKind = AreaEventKind | 'crossing' | 'freight';
export interface FactoryEncounter {
  stage: number;
  kind: FactoryEncounterKind;
}
export interface FactoryRun {
  version: FactoryVersion;
  condition: FactoryCondition;
  encounters: FactoryEncounter[];
  events: AreaEventSave[];
}

// Separate streams leave combat, rewards, bosses and old Daily seeds intact.
// The first room teaches the gun. Version four keeps Uprising signatures in
// rooms two and five, clear of the jobs that now begin in room six.
export function planFactory(seed: string, version: FactoryVersion = FACTORY_RULESET): FactoryRun {
  const rng = seeded(seed + ':factory-v1');
  const condition = (Object.keys(FACTORY_CONDITIONS) as FactoryCondition[])[Math.floor(rng() * 3)];
  const signature: FactoryEncounterKind =
    condition === 'freight' ? 'crossing' : condition === 'power' ? 'blackout' : 'turf';
  const encounters: FactoryEncounter[] = [
    { stage: version === 3 ? 0 : 1, kind: signature },
    { stage: version >= 3 ? 4 : 5, kind: condition === 'freight' ? 'freight' : signature },
  ];
  // A later contrasting encounter preserves the other event types. Keep a
  // normal room between signatures rather than applying an event area-wide.
  if (rng() < 0.75) {
    const alternatives = (['blackout', 'turf', 'lockdown'] as const).filter((k) => k !== signature);
    encounters.push({ stage: 12, kind: alternatives[Math.floor(rng() * alternatives.length)] });
  }
  return {
    version,
    condition,
    encounters,
    events: encounters.flatMap(({ stage, kind }) =>
      kind === 'crossing' || kind === 'freight'
        ? []
        : [
            {
              kind,
              area: Math.floor(stage / 4),
              room: stage,
              relays: [],
              caches: [],
              commander: false,
              rerolls: 0,
            },
          ],
    ),
  };
}

export function factoryEncounter(factory: FactoryRun | null | undefined, stage: number) {
  if (stage === 0) return undefined;
  return factory?.encounters.find((encounter) => encounter.stage === stage);
}

export function validFactory(d: Checkpoint): boolean {
  const f = d.factory;
  if (f === undefined) return true;
  if (
    !f ||
    typeof f !== 'object' ||
    ![1, 2, 3, 4].includes(f.version) ||
    d.version !== 6 ||
    typeof d.seed !== 'string' ||
    /^RF-D\d+-/.test(d.seed) ||
    d.areaEvent !== undefined
  )
    return false;
  const expected = planFactory(d.seed, f.version);
  if (
    f.condition !== expected.condition ||
    !Array.isArray(f.encounters) ||
    f.encounters.length !== expected.encounters.length ||
    !Array.isArray(f.events) ||
    f.events.length !== expected.events.length
  )
    return false;
  if (
    f.encounters.some(
      (e, i) =>
        !e || e.stage !== expected.encounters[i].stage || e.kind !== expected.encounters[i].kind,
    )
  )
    return false;
  const reserved = f.encounters.map((e) => e.stage);
  if (
    reserved.includes(d.courier?.stage ?? -1) ||
    reserved.includes(d.story?.stage ?? -1) ||
    reserved.includes(d.auditor?.caseStage ?? -1) ||
    (Array.isArray(d.auditor?.rooms) && d.auditor.rooms.some((s) => reserved.includes(s)))
  )
    return false;
  return f.events.every(
    (e, i) =>
      !!e &&
      e.kind === expected.events[i].kind &&
      e.area === expected.events[i].area &&
      e.room === expected.events[i].room &&
      validAreaEvent(e, d.overtime ? 19 : d.stage, !!d.reward || !!d.overtime, true) &&
      [...e.relays, ...e.caches].every((stage) => stage === e.room) &&
      (!e.commander || d.overtime || d.stage > e.room! || (d.stage === e.room && !!d.reward)),
  );
}

export function factoryHint(factory: FactoryRun, stage: number) {
  switch (factoryEncounter(factory, stage)?.kind) {
    case 'crossing':
      return 'Watch the warning lights. Fight between moving loads.';
    case 'freight':
      return 'Ride the lift. Watch for boarding crews.';
    case 'blackout':
      return 'Shoot the lit power box to restore the lights.';
    case 'turf':
      return 'Blue crews fight red crews. Choose when to intervene.';
    case 'lockdown':
      return 'Clear the patrol, then jump by the terminal to call its commander.';
    default:
      return FACTORY_CONDITIONS[factory.condition].description;
  }
}

// Only fresh, unlinked normal games use this. Explicit seeds and Daily retries
// reproduce exactly; the saved plan fixes the condition for Continue.
export function freshFactorySeed(create: () => string, previous?: FactoryCondition) {
  const first = create();
  if (!previous || planFactory(first).condition !== previous) return first;
  for (let i = 0; i < 64; i++) {
    const candidate = (first.slice(0, 33) + '-F' + i).slice(0, 40);
    if (planFactory(candidate).condition !== previous) return candidate;
  }
  return first;
}
