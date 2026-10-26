import {
  MODS,
  MOD_REQUIRES,
  MOD_PATHS,
  FUSION_REQUIRES,
  PATH_NAMES,
  availableMods,
  buildPath,
  buildFollowup,
  compatibleMod,
  isFusion,
  modDescription,
  modPathLabel,
  type Mod,
} from './rules.ts';
import { BRANCH_PARENTS } from './upgrade-branches.ts';
import { TOOLROOM_MODS } from './toolroom-catalog.ts';
import { isShiftMorph } from './shift-catalog.ts';
import { workshopBuild } from './workshop-build.ts';
import type { StartingGun } from './starting-guns.ts';

export const BENCH_CATEGORIES = [
  { id: 'all', label: 'All mechanics' },
  { id: 'movement', label: 'Movement' },
  { id: 'defense', label: 'Defense & repair' },
  { id: 'firing', label: 'Firing & patterns' },
  { id: 'heat', label: 'Heat & fire' },
  { id: 'precision', label: 'Precision' },
  { id: 'banking', label: 'Banks & reserve' },
  { id: 'control', label: 'Control & machinery' },
] as const;
export type BenchCategory = (typeof BENCH_CATEGORIES)[number]['id'];
export type BenchFacet = 'all' | 'compatible' | 'followups' | 'selected';
export interface BenchFilters {
  query?: string;
  category?: BenchCategory;
  facet?: BenchFacet;
  limit?: number;
}
export interface BenchRow {
  mod: Mod;
  tags: Exclude<BenchCategory, 'all'>[];
  selected: boolean;
  compatible: boolean;
  canAdd: boolean;
  canRemove: boolean;
  requirements: string[];
  missing: string[];
  followups: string[];
  conflicts: string[];
  reason: string;
  description: string;
  path: string;
  /** The selected fitting followed by every dependent lost in acquisition order. */
  removal: string[];
}
export interface BenchEdit {
  after: string[];
  removed: string[];
  added: string[];
  canApply: boolean;
  reason: string;
}
const byId = new Map<string, Mod>(MODS.map((m) => [m.id, m]));
const name = (id: string) => byId.get(id)?.name ?? 'Unknown fitting';
const unique = (ids: readonly (string | undefined)[]) => [
  ...new Set(ids.filter((id): id is string => !!id)),
];
const requirementsFor = (id: string) =>
  unique([MOD_REQUIRES[id], ...(BRANCH_PARENTS[id] ?? []), ...(FUSION_REQUIRES[id] ?? [])]);
const boundedLimit = (limit: number) =>
  Number.isFinite(limit) ? Math.max(0, Math.min(MODS.length, Math.floor(limit))) : MODS.length;

// Explicit mechanic membership, plus the catalog's authored families and real
// prerequisites. Names and search keywords never decide compatibility or tags.
const mechanicIds: Readonly<Record<Exclude<BenchCategory, 'all'>, readonly string[]>> = {
  movement: [
    'airshot',
    'kick',
    'light',
    'landing',
    'blast-surf',
    'slingshot',
    'redline',
    'ramjet',
    'slipstream',
    'triphammer',
    'wallrunner',
    'air-brake',
    'grapnel',
    'double-jump',
    'wing-harness',
    'static-reservoir',
    'ricochet-harness',
    'spring-rivets',
    'slip-gauge',
    'wake-wire',
    'false-silhouette',
    'gimbal-mount',
    'momentum-exchange',
    'momentum-battery',
  ],
  defense: [
    'leech',
    'breach',
    'countershot',
    'reprisal',
    'scrap-armor',
    'false-silhouette',
    'slip-gauge',
    'foamcaster',
    'catch-chamber',
  ],
  firing: [
    'magnum',
    'scatter',
    'rapid',
    'pierce',
    'split',
    'burst',
    'backblast',
    'crossfire',
    'bloom',
    'convergence',
    'backfire',
    'recall',
    'homecoming',
    'afterimage',
    'parallax',
    'grindshot',
    'corner-cutter',
    'cutting-torch',
    'vector',
    'afterburner',
    'mass-driver',
    'melt-through',
    'pulse-chamber',
    'charge-lens',
    'prism-array',
    'pinwheel',
    'follow-through',
    'crosscut',
    'clean-cut',
    'blowout',
    'collimator',
    'offset-nozzle',
    'piston-lance',
    'cable-saw',
    'seeker-rack',
    'foamcaster',
  ],
  heat: ['cinder', 'flashpoint', 'thermal-runaway', 'heat-relay', 'thermal-shock', 'hot-wire'],
  precision: [
    'deadeye',
    'execute',
    'deadlock',
    'rivet',
    'fracture',
    'capacitor',
    'reserve-cell',
    'rail-spike',
    'collimator',
  ],
  banking: [
    'ricochet',
    'banker',
    'shatter',
    'capacitor',
    'reserve-cell',
    'overkill-bank',
    'corner-pocket',
    'retrace',
    'relay-gate',
    'skid-plate',
    'flywheel',
    'momentum-battery',
  ],
  control: [
    'fold',
    'rewire',
    'tether',
    'snapback',
    'arc-coil',
    'daisy-chain',
    'implosion',
    'crosswind',
    'wrecking-ball',
    'tripwire',
    'tension',
    'short-circuit',
    'coolant-rounds',
    'deep-freeze',
    'icebreaker',
    'cold-snap',
    'cold-front',
    'suspension',
    'crosshatch',
    'thread-the-needle',
    'tripline',
    'chain-release',
    'convoy',
    'ground-fault',
    'conductive-tether',
    'spoof',
    'standing-orders',
    'priority-target',
    'cross-talk',
    'dead-switch',
    'polarity-rounds',
    'gate-snare',
    'ghost-shift',
    'windmill',
    'scrap-comet',
  ],
};
const familyCategory = {
  mobility: 'movement',
  precision: 'precision',
  thermal: 'heat',
  banking: 'banking',
  defense: 'defense',
  cadence: 'firing',
} as const;
const tagOrder = BENCH_CATEGORIES.filter((c) => c.id !== 'all').map((c) => c.id);
export function benchModTags(id: string): Exclude<BenchCategory, 'all'>[] {
  if (!byId.has(id)) return [];
  const tags = new Set<Exclude<BenchCategory, 'all'>>();
  const visited = new Set<string>();
  const visit = (current: string) => {
    if (visited.has(current)) return;
    visited.add(current);
    for (const category of tagOrder)
      if (mechanicIds[category].includes(current)) tags.add(category);
    const tool = TOOLROOM_MODS.find((m) => m.id === current);
    if (tool) tags.add(familyCategory[tool.family]);
    if (MOD_PATHS[current]?.path === 'precision') tags.add('precision');
    for (const parent of requirementsFor(current)) visit(parent);
  };
  visit(id);
  // Ordinary shared output fittings have no parents or specialized family.
  if (!tags.size) tags.add('firing');
  return tagOrder.filter((tag) => tags.has(tag));
}

interface BenchContext {
  known: readonly string[];
  draft: string[];
  gun: StartingGun;
  limit: number;
  eligible: Set<string>;
}
function context(
  known: readonly string[],
  draft: readonly string[],
  gun: StartingGun,
  limit: number,
): BenchContext {
  const clean = workshopBuild(draft, known);
  return {
    known,
    draft: clean,
    gun,
    limit: boundedLimit(limit),
    eligible: new Set(availableMods(clean, true).map((m) => m.id)),
  };
}
function inspect(id: string, c: BenchContext): BenchRow | null {
  const mod = byId.get(id);
  if (!mod || !c.known.includes(id)) return null;
  const selected = c.draft.includes(id);
  const requirements = requirementsFor(id);
  const missing = requirements.filter((parent) => !c.draft.includes(parent));
  const compatible = selected || c.eligible.has(id);
  const full = c.draft.length >= c.limit;
  const conflicts: string[] = [];
  if (!selected) {
    const pair = c.draft.filter((owned) => !compatibleMod([owned], id));
    if (pair.length) conflicts.push('Conflicts with ' + pair.map(name).join(' + ') + '.');
    const chosen = buildPath(c.draft),
      path = MOD_PATHS[id]?.path;
    if (chosen && path && chosen !== path)
      conflicts.push(
        'This build follows ' +
          PATH_NAMES[chosen] +
          '; this fitting uses ' +
          PATH_NAMES[path] +
          '.',
      );
    const fusion = c.draft.find(isFusion);
    if (isFusion(id) && fusion)
      conflicts.push('One fusion per build. ' + name(fusion) + ' is already fitted.');
  }
  const afterRemoval = selected
    ? workshopBuild(
        c.draft.filter((m) => m !== id),
        c.known,
      )
    : c.draft;
  const removal = selected ? c.draft.filter((m) => !afterRemoval.includes(m)) : [];
  let reason = '';
  if (selected)
    reason =
      removal.length > 1
        ? 'Removing this fitting also removes ' + removal.slice(1).map(name).join(' + ') + '.'
        : 'Fitted. Remove this fitting to change the build.';
  else if (conflicts.length) reason = conflicts.join(' ');
  else if (missing.length) {
    const collected = missing.filter((m) => c.known.includes(m));
    const hidden = missing.length - collected.length;
    const terms = [
      ...collected.map(name),
      ...(hidden
        ? [hidden + (hidden === 1 ? ' uncollected requirement' : ' uncollected requirements')]
        : []),
    ];
    reason = 'Fit ' + terms.join(' + ') + ' first.';
  } else if (full) reason = 'Build full. Remove a fitting to swap.';
  else if (!compatible) reason = 'Incompatible with this build.';
  else reason = 'Compatible with this build.';
  return {
    mod,
    tags: benchModTags(id),
    selected,
    compatible,
    canAdd: !selected && compatible && !full,
    canRemove: selected,
    requirements,
    missing,
    followups: MODS.filter((m) => c.known.includes(m.id) && requirementsFor(m.id).includes(id)).map(
      (m) => m.id,
    ),
    conflicts,
    reason,
    description: modDescription(mod, c.draft, c.gun),
    path: isShiftMorph(id) ? 'Weapon morph' : modPathLabel(id),
    removal,
  };
}

export function benchInspect(
  id: string,
  known: readonly string[],
  draft: readonly string[],
  startingGun: StartingGun = 'pistol',
  limit: number = MODS.length,
): BenchRow | null {
  return inspect(id, context(known, draft, startingGun, limit));
}
export function benchRows(
  known: readonly string[],
  draft: readonly string[],
  startingGun: StartingGun = 'pistol',
  filters: BenchFilters = {},
): BenchRow[] {
  const c = context(known, draft, startingGun, filters.limit ?? MODS.length);
  const query = (filters.query ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return MODS.flatMap((mod) => {
    const row = inspect(mod.id, c);
    if (!row) return [];
    if (filters.category && filters.category !== 'all' && !row.tags.includes(filters.category))
      return [];
    if (filters.facet === 'selected' && !row.selected) return [];
    if (filters.facet === 'compatible' && !row.compatible) return [];
    if (filters.facet === 'followups' && (!row.canAdd || !buildFollowup(mod.id, c.draft)))
      return [];
    const text = [
      mod.id,
      mod.name,
      mod.description,
      row.description,
      row.path,
      ...row.tags,
      ...row.tags.map((tag) => BENCH_CATEGORIES.find((category) => category.id === tag)!.label),
    ]
      .join(' ')
      .normalize('NFKC')
      .toLocaleLowerCase('en-US');
    return query.every((term) => text.includes(term)) ? [row] : [];
  });
}

/** Describe an atomic legal toggle. The caller confirms a cascade before applying it. */
export function benchEdit(
  draft: readonly string[],
  id: string,
  known: readonly string[],
  limit: number = MODS.length,
): BenchEdit {
  const c = context(known, draft, 'pistol', limit);
  const row = inspect(id, c);
  const unchanged = (reason: string): BenchEdit => ({
    after: [...c.draft],
    removed: [],
    added: [],
    canApply: false,
    reason,
  });
  if (!row) return unchanged('Collect this fitting during a run to use it here.');
  if (row.selected) {
    const after = workshopBuild(
      c.draft.filter((m) => m !== id),
      known,
    );
    return {
      after,
      removed: c.draft.filter((m) => !after.includes(m)),
      added: [],
      canApply: true,
      reason: row.reason,
    };
  }
  if (!row.canAdd) return unchanged(row.reason);
  const after = workshopBuild([...c.draft, id], known);
  return { after, removed: [], added: [id], canApply: after.includes(id), reason: row.reason };
}
