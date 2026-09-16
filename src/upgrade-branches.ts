// Local choices share one catalog across rewards, Daily, Workshop and saves.
export const BRANCH_MODS = [
  {
    id: 'pulse-chamber',
    name: 'Pulse Chamber',
    description: 'Two light beam pulses, then a hard, narrow finisher that pierces an extra enemy.',
    mark: 'pulse-chamber',
  },
  {
    id: 'charge-lens',
    name: 'Charge Lens',
    description: 'Hold to charge. Release a powerful cutting lance with a heavy kick.',
    mark: 'charge-lens',
  },
  {
    id: 'prism-array',
    name: 'Prism Array',
    description: 'Two angled rays, each at 60% power. Aim between them to split your fire.',
    mark: 'prism-array',
  },
  {
    id: 'pinwheel',
    name: 'Pinwheel',
    description: 'Outer firing lanes sweep across a forward fan. The center stays on aim.',
    mark: 'pinwheel',
  },
  {
    id: 'follow-through',
    name: 'Follow-through',
    description: 'Your echo fires from your new position, keeping the original aim.',
    mark: 'follow-through',
  },
  {
    id: 'shaped-charge',
    name: 'Shaped Charge',
    description: 'Shell blasts cut a longer cone in the impact direction. Less side coverage.',
    mark: 'shaped-charge',
  },
  {
    id: 'cluster-shell',
    name: 'Cluster Shell',
    description: 'Shells split their blast between the impact and three short-lived bomblets.',
    mark: 'cluster-shell',
  },
  {
    id: 'skid-plate',
    name: 'Skid Plate',
    description:
      'Shallow floor hits turn steel balls into fast rolling shots that bowl through debris.',
    mark: 'skid-plate',
  },
  {
    id: 'relay-gate',
    name: 'Relay Gate',
    description: 'Your fixed portals give each shot one extra bank and 15% speed, once.',
    mark: 'relay-gate',
  },
  {
    id: 'short-circuit',
    name: 'Short Circuit',
    description: 'Every third hit discharges into that enemy instead of arcing away.',
    mark: 'short-circuit',
  },
  {
    id: 'triphammer',
    name: 'Triphammer',
    description:
      'A fast ram kicks you back into the air. Travel and fire again to earn another impact.',
    mark: 'triphammer',
  },
  {
    id: 'crosscut',
    name: 'Crosscut',
    description: 'Spent hits send two saws in opposite directions, each at 60% power.',
    mark: 'crosscut',
  },
] as const;
export const BRANCH_GROUPS: Readonly<Record<string, readonly string[]>> = {
  Beam: ['pulse-chamber', 'charge-lens', 'prism-array'],
  Pattern: ['convergence', 'pinwheel'],
  Echo: ['parallax', 'follow-through'],
  Shell: ['implosion', 'shaped-charge', 'cluster-shell'],
  Ball: ['drop-forge', 'skid-plate'],
  Portal: ['rewire', 'relay-gate'],
  Arc: ['daisy-chain', 'short-circuit'],
  Ram: ['wrecking-ball', 'triphammer'],
  Saw: ['corner-cutter', 'crosscut'],
  Cold: ['deep-freeze', 'cold-snap'],
  Stasis: ['crosshatch', 'tripline'],
};
export const BRANCH_PARENTS: Readonly<Record<string, readonly string[]>> = {
  'pulse-chamber': ['cutting-torch', 'burst'],
  'charge-lens': ['cutting-torch'],
  'prism-array': ['cutting-torch'],
  pinwheel: ['crossfire'],
  'follow-through': ['afterimage'],
  'shaped-charge': ['shellshock'],
  'cluster-shell': ['shellshock'],
  'skid-plate': ['mass-driver'],
  'relay-gate': ['fold'],
  'short-circuit': ['arc-coil'],
  triphammer: ['ramjet'],
  crosscut: ['grindshot'],
};
export const BRANCH_PATHS = {
  'pulse-chamber': { path: 'precision' },
  'charge-lens': { path: 'precision' },
  'prism-array': { path: 'precision' },
  pinwheel: { path: 'bullet-hell' },
  'follow-through': { path: 'bullet-hell' },
  'shaped-charge': { path: 'demolition' },
  'cluster-shell': { path: 'demolition' },
} as const;
export const isBranch = (id: string) => Object.hasOwn(BRANCH_PARENTS, id);
export const branchGroup = (id: string) =>
  Object.entries(BRANCH_GROUPS).find(([, members]) => members.includes(id))?.[0];
export function compatibleBranch(mods: readonly string[], id: string) {
  const members = BRANCH_GROUPS[branchGroup(id) ?? ''];
  return !members || !mods.some((owned) => owned !== id && members.includes(owned));
}
export const BRANCH_STAGE = 7;
