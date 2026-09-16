import {
  BRANCH_MODS,
  BRANCH_PATHS,
  BRANCH_PARENTS,
  BRANCH_STAGE,
  isBranch,
  compatibleBranch,
  branchGroup,
} from './upgrade-branches.ts';
import { WORKSHOP_MODS, WORKSHOP_PARENTS } from './workshop-upgrades.ts';
import { NEW_PATH_MODS, NEW_PATH_PARENTS, NEW_PATH_IDS } from './new-paths.ts';
export type Vec = { x: number; y: number };
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
export const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export function direction(a: Vec, b: Vec): Vec {
  const d = distance(a, b) || 1;
  return { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
}
export function seeded(seed: string) {
  let s = 2166136261;
  for (const c of seed) s = Math.imul(s ^ c.charCodeAt(0), 16777619);
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function sample<T>(items: readonly T[], count: number, rng: () => number): T[] {
  const pool = [...items],
    out: T[] = [];
  while (pool.length && out.length < count)
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
}
export interface Gun {
  damage: number;
  interval: number;
  recoil: number;
  pellets: number;
  spread: number;
  bounces: number;
  pierce: number;
  fragments: boolean;
  airDamage: number;
  heal: number;
  speed: number;
  burstCount: number;
  bankGrowth: number;
  backblast: boolean;
  rearVolley: boolean;
  redline: boolean;
  breach: boolean;
  shatter: boolean;
  convergence: boolean;
  deadlock: boolean;
  shockfront: boolean;
  landing: boolean;
  lanes: number;
  projectileSpeed: number;
  deathBloom: boolean;
  execute: boolean;
  shellshock: boolean;
  blastSurf: boolean;
  aftershock: boolean;
  chainReaction: boolean;
}
export const MODS = [
  {
    id: 'magnum',
    name: 'Heavy hitter',
    description: '75% more damage. Slower shots. Bigger kick.',
    mark: 'heavy',
  },
  {
    id: 'scatter',
    name: 'Scattershot',
    description: 'Five pellets. Wider spread. One heavy kick.',
    mark: 'spread',
  },
  {
    id: 'rapid',
    name: 'Hair trigger',
    description: '60% faster fire. Lighter rounds and recoil.',
    mark: 'rapid',
  },
  {
    id: 'ricochet',
    name: 'Bank shot',
    description: 'Rounds bounce twice off the walls.',
    mark: 'bounce',
  },
  {
    id: 'pierce',
    name: 'Punch through',
    description: 'Rounds pass through two more enemies.',
    mark: 'pierce',
  },
  {
    id: 'split',
    name: 'Splinter',
    description: 'Hits break into three smaller rounds.',
    mark: 'split',
  },
  { id: 'airshot', name: 'Airshot', description: '45% more damage while airborne.', mark: 'air' },
  {
    id: 'kick',
    name: 'Kickback',
    description: '20% more damage. 40% more recoil.',
    mark: 'kick',
  },
  { id: 'leech', name: 'Bloodwork', description: 'Every kill restores 2 health.', mark: 'heal' },
  {
    id: 'light',
    name: 'Light frame',
    description: 'Move 20% faster. Keep your momentum.',
    mark: 'light',
  },
  {
    id: 'burst',
    name: 'Burst fire',
    description: 'Three quick shots, then recovery. 10% lighter rounds.',
    mark: 'burst',
  },
  {
    id: 'backblast',
    name: 'Backblast',
    description: 'A rear blast. 25% more damage. 20% longer shot delay.',
    mark: 'backblast',
  },
  {
    id: 'banker',
    name: 'Banker',
    description: 'One extra bounce. +35% damage per bounce. 20% lighter rounds.',
    mark: 'banker',
  },
  {
    id: 'landing',
    name: 'Landing shot',
    description: 'Hard landings double your next shot. Other shots hit 10% lighter.',
    mark: 'landing',
  },
  {
    id: 'crossfire',
    name: 'Crossfire',
    description: 'Three firing lanes. 55% damage each. 20% longer shot delay.',
    mark: 'crossfire',
  },
  {
    id: 'bloom',
    name: 'Death bloom',
    description: 'Bullet kills release six fragments at 35% round damage.',
    mark: 'bloom',
  },
  {
    id: 'deadeye',
    name: 'Deadeye',
    description: '30% more damage. Faster, tighter rounds. 20% longer shot delay.',
    mark: 'deadeye',
  },
  {
    id: 'execute',
    name: 'Executioner',
    description: 'Rounds hit 60% harder against enemies below 30% health.',
    mark: 'execute',
  },
  {
    id: 'fold',
    name: 'Fold',
    description: 'Right-click two surfaces to link portals. One pair per room.',
    mark: 'fold',
  },
  {
    id: 'shellshock',
    name: 'Shellshock',
    description: 'Explosive rounds. Lighter direct hits. 35% longer shot delay.',
    mark: 'shellshock',
  },
  {
    id: 'blast-surf',
    name: 'Blast surfing',
    description: 'Your blasts launch you without hurting you.',
    mark: 'blast-surf',
  },
  {
    id: 'aftershock',
    name: 'Aftershock',
    description: 'Your blasts repeat after a brief delay at 40% strength.',
    mark: 'aftershock',
  },
  {
    id: 'chain-reaction',
    name: 'Chain reaction',
    description: 'Destroyed crates and cover trigger another blast.',
    mark: 'chain-reaction',
  },
  {
    id: 'rewire',
    name: 'Rewire',
    description: 'Reposition your two portals as often as you like.',
    mark: 'rewire',
  },
  {
    id: 'slingshot',
    name: 'Slingshot',
    description: 'Exit portals faster. Your next shot hits 50% harder.',
    mark: 'slingshot',
  },
  {
    id: 'redline',
    name: 'Redline',
    description: 'Moving faster adds up to 50% shot damage.',
    mark: 'redline',
  },
  {
    id: 'breach',
    name: 'Breach',
    description: 'Your rear blast also destroys incoming bullets.',
    mark: 'breach',
  },
  {
    id: 'shatter',
    name: 'Shatter',
    description: 'Wall hits scatter six stronger fragments back into the room.',
    mark: 'shatter',
  },
  {
    id: 'convergence',
    name: 'Convergence',
    description: 'Outer firing lanes bend inward and cross at your aim point.',
    mark: 'convergence',
  },
  {
    id: 'deadlock',
    name: 'Deadlock',
    description: 'Each accurate shot adds 12% damage, up to 60%. A miss resets it.',
    mark: 'deadlock',
  },
  {
    id: 'shockfront',
    name: 'Shockfront',
    description: 'Aftershocks reach 50% farther and push enemies away.',
    mark: 'shockfront',
  },
  {
    id: 'backfire',
    name: 'Backfire',
    description: 'Also fire rounds backward. 20% longer shot delay.',
    mark: 'backfire',
  },
  {
    id: 'recall',
    name: 'Recall',
    description: 'Rounds pierce once, then curve back to you. 25% lighter hits.',
    mark: 'recall',
  },
  {
    id: 'homecoming',
    name: 'Homecoming',
    description: 'Returning rounds pierce two more enemies without losing damage.',
    mark: 'homecoming',
  },
  {
    id: 'capacitor',
    name: 'Capacitor',
    description: 'Pause firing to charge a double-damage shot.',
    mark: 'capacitor',
  },
  {
    id: 'reserve-cell',
    name: 'Reserve cell',
    description: 'A longer pause stores a second charged shot.',
    mark: 'reserve-cell',
  },
  {
    id: 'countershot',
    name: 'Countershot',
    description: 'Deflect one small enemy bullet. Stop firing for 0.8s to recharge.',
    mark: 'countershot',
  },
  {
    id: 'reprisal',
    name: 'Reprisal',
    description: 'Reflected bullets punch through two more enemies.',
    mark: 'reprisal',
  },
  {
    id: 'rivet',
    name: 'Rivet',
    description: 'Shove enemies into nearby walls to briefly pin them. Bosses resist.',
    mark: 'rivet',
  },
  {
    id: 'fracture',
    name: 'Fracture',
    description: 'Your next round against a pinned enemy hits 60% harder.',
    mark: 'fracture',
  },
  {
    id: 'fuse',
    name: 'Fuse',
    description: 'Shells stick before exploding. 40% stronger blasts.',
    mark: 'fuse',
  },
  {
    id: 'linked-fuse',
    name: 'Linked fuse',
    description: 'Exploding charges ignite nearby stuck shells through clear space.',
    mark: 'linked-fuse',
  },
  {
    id: 'afterimage',
    name: 'Afterimage',
    description: 'Every fourth discharge leaves a delayed volley at 60% damage.',
    mark: 'afterimage',
  },
  {
    id: 'parallax',
    name: 'Parallax',
    description: 'Afterimages turn toward your current aim when they fire.',
    mark: 'parallax',
  },
  {
    id: 'rail-spike',
    name: 'Rail spike',
    description: 'Charged volleys merge into one heavy, piercing round. A much bigger kick.',
    mark: 'rail-spike',
  },
  {
    id: 'tether',
    name: 'Tether rounds',
    description:
      'Hit two enemies to link them with a short cable. Their movement pulls against each other.',
    mark: 'tether',
  },
  {
    id: 'snapback',
    name: 'Snapback',
    description:
      'Overstretched cables snap, yanking enemies inward. Hard collisions deal bonus damage.',
    mark: 'snapback',
  },
  {
    id: 'orbit',
    name: 'Orbit',
    description: 'Caught rounds orbit briefly. Your next shot launches them toward your aim.',
    mark: 'orbit',
  },
  {
    id: 'arc-coil',
    name: 'Arc Coil',
    description:
      'Hit one enemy three times to arc to a nearby enemy or metal prop. 10% lighter rounds.',
    mark: 'arc-coil',
  },
  {
    id: 'daisy-chain',
    name: 'Daisy Chain',
    description: 'Arcs jump through two more targets. Each jump is 30% weaker.',
    mark: 'daisy-chain',
  },
  {
    id: 'implosion',
    name: 'Implosion',
    description: 'Stuck shells pull nearby enemies and loose debris inward before exploding.',
    mark: 'implosion',
  },
  {
    id: 'ramjet',
    name: 'Ramjet',
    mark: 'ramjet',
    description: 'Fast recoil launches ram enemies. More speed, more damage. Bosses resist impact.',
  },
  {
    id: 'cinder',
    name: 'Cinder rounds',
    mark: 'cinder',
    description:
      'Impacts leave brief burning patches on nearby surfaces. Overlapping burns do not stack.',
  },
  {
    id: 'crosswind',
    name: 'Crosswind',
    mark: 'crosswind',
    description:
      'Shots leave a brief gust that pushes loose props and bends ordinary enemy bullets.',
  },
  {
    id: 'wrecking-ball',
    name: 'Wrecking Ball',
    mark: 'wrecking-ball',
    description:
      'Rammed enemies become projectiles that hurt others on impact. Heavy enemies resist the throw.',
  },
  {
    id: 'flashpoint',
    name: 'Flashpoint',
    mark: 'flashpoint',
    description:
      'Killing a burning enemy triggers a fireburst, consuming nearby flames. Burst kills cannot chain.',
  },
  {
    id: 'slipstream',
    name: 'Slipstream',
    mark: 'slipstream',
    description: 'Gusts linger longer. Enter one to ride it through the air.',
  },
  {
    id: 'grindshot',
    name: 'Grindshot',
    description: '20% lighter hits. Spent rounds skim surfaces as saws.',
    mark: 'grindshot',
  },
  {
    id: 'corner-cutter',
    name: 'Corner Cutter',
    description: 'Your saws wrap around exposed corners.',
    mark: 'corner-cutter',
  },
  {
    id: 'tripwire',
    name: 'Tripwire',
    description: 'Shoot two surfaces to rig an explosive wire. Keep two traps active.',
    mark: 'tripwire',
  },
  {
    id: 'tension',
    name: 'Tension',
    description: 'Longer tripwires deal up to 75% more blast damage.',
    mark: 'tension',
  },
  {
    id: 'cutting-torch',
    name: 'Cutting Torch',
    description: 'A continuous beam with steady recoil. Hold fire to cut.',
    mark: 'torch',
  },
  {
    id: 'thermal-runaway',
    name: 'Thermal Runaway',
    description: 'Hold the beam on one enemy for up to 75% more damage.',
    mark: 'thermal',
  },
  {
    id: 'vector',
    name: 'Vector rounds',
    description: 'Steer flying rounds with your aim. 25% slower projectiles.',
    mark: 'vector',
  },
  {
    id: 'afterburner',
    name: 'Afterburner',
    description: 'Straighten a curved round: 35% faster, 30% more damage.',
    mark: 'afterburner',
  },
  {
    id: 'mass-driver',
    name: 'Mass Driver',
    description:
      'Heavy steel balls arc, bounce and launch debris. Slower fire. A much bigger kick.',
    mark: 'mass-driver',
  },
  {
    id: 'drop-forge',
    name: 'Drop Forge',
    description:
      'Falling steel balls build up to 75% more direct-hit damage and slam light targets down.',
    mark: 'drop-forge',
  },
  ...BRANCH_MODS,
  ...NEW_PATH_MODS,
  ...WORKSHOP_MODS,
  {
    id: 'resonator',
    name: 'Resonator',
    description:
      'A third pulse through a portal repeats from its exit at 60% power. First two pulses are 25% lighter.',
    mark: 'resonator',
  },
  {
    id: 'flywheel',
    name: 'Flywheel',
    description:
      'Rolling distance charges your final saws, up to double damage. Two fewer ball banks.',
    mark: 'flywheel',
  },
  {
    id: 'storm-cell',
    name: 'Storm Cell',
    description:
      'Landed bomblets link into brief electrical traps. 28% smaller shell explosions. Keep three cells.',
    mark: 'storm-cell',
  },
] as const;
export const REPAIR_REWARD = {
  id: 'repair',
  name: 'Field repair',
  description: 'Build complete. Restore 24 health and keep going.',
  mark: 'heal',
} as const;
export type Mod = (typeof MODS)[number] | typeof REPAIR_REWARD;
// Conversion-specific copy describes what the owned gun will actually do.
export function modDescription(mod: Mod, mods: readonly string[]): string {
  if (mod.id === 'tether' && mods.includes('grapnel'))
    return 'Airborne wall hits anchor your swing cable. Recoil builds momentum; jump to detach. One anchor per airtime.';
  if (mod.id === 'suspension' && mods.includes('convoy'))
    return 'Hold to store up to 15 rounds in a trailing convoy. Release to fire; old rounds auto-launch after 2.5 seconds.';
  if (mod.id === 'corner-pocket' && mods.includes('cutting-torch'))
    return 'The first wall bank redirects the beam toward a nearby exposed enemy. Beam hits before that bank deal 20% less damage.';
  if (mod.id === 'suspension' && mods.includes('tripline'))
    return 'Fire to park up to 30 proximity traps toward your aim. Recoil is immediate; traps expire after four seconds.';
  if (mod.id === 'backfire' && mods.includes('crosshatch'))
    return 'Also parks a rear volley. Both directions converge on your aim when released. 20% slower firing.';
  if (mod.id === 'air-brake' && mods.includes('cutting-torch'))
    return 'Release the beam during recoil flight to brake once per jump. The next beam pulse kicks 35% harder.';
  if (mod.id === 'deep-freeze' && mods.includes('coolant-rounds'))
    return 'Full cold briefly freezes ordinary enemies, with a recovery window. Boss cold hits gain a larger damage bonus.';
  const beam = mods.includes('cutting-torch');
  if (mod.id === 'cutting-torch' && mods.includes('charge-lens'))
    return 'Hold to charge the beam. Release a cutting lance with a heavy kick.';
  if (mod.id === 'cutting-torch' && mods.includes('prism-array'))
    return 'Two angled rays with steady recoil. Hold fire and aim along either ray.';
  if (beam && mods.includes('charge-lens')) {
    if (mod.id === 'scatter')
      return 'A wider lance with 60% more damage. 25% longer charge and recovery.';
    if (mod.id === 'rapid')
      return 'Shorter charge and recovery. 28% lighter lances and gentler recoil.';
    if (mod.id === 'magnum') return '75% stronger lances with 40% longer charge and recovery.';
    if (mod.id === 'deadeye') return '30% stronger lances with 20% longer charge and recovery.';
  }
  if (mod.id === 'relay-gate' && beam)
    return 'Your fixed portals give each beam one extra bank and 15% remaining range, once.';
  if (mod.id === 'thermal-runaway' && mods.includes('charge-lens'))
    return 'Track one exposed enemy while charging for up to 75% more lance damage.';
  if (mod.id === 'burst' && mods.includes('charge-lens'))
    return 'Release three shorter charged lances, then recover. Each pulse can spend a stored charge.';
  if (mod.id === 'rail-spike')
    return 'Charged pellets merge into a piercing rail. Backfire keeps a separate rear rail.';
  if (mods.includes('rail-spike')) {
    if (mod.id === 'scatter')
      return 'Five pellets merge into a stronger charged rail. Uncharged fire stays a spread.';
    if (mod.id === 'backfire')
      return 'Add a charged rear rail or an uncharged rear volley. 20% longer shot delay.';
    if (mod.id === 'grindshot')
      return 'Spent rounds and rails become surface saws. 20% lighter direct hits.';
  }
  if (mod.id === 'recall' && mods.includes('mass-driver'))
    return 'Steel balls curve back and may hit each enemy once per leg. 25% lighter hits.';
  if (mod.id === 'vector' && mods.includes('recall'))
    return 'Guide rounds for up to half a second before they return. 25% slower projectiles.';
  if (mod.id === 'fuse' && mods.includes('tripwire'))
    return 'Shells stick, then blast 40% harder. Wires still trigger immediately on contact.';
  if (mod.id === 'breach')
    return 'Rear blasts clear up to two small bullets every 0.45 seconds. Heavy rounds resist.';
  if (mod.id === 'cutting-torch')
    return mods.includes('burst')
      ? 'A laser with three concentrated pulses, then recovery. Hold fire to cut.'
      : mod.description;
  if (!beam) return mod.description;
  switch (mod.id) {
    case 'scatter':
      return 'A wider beam. 28% more sustained damage. Slower pulses.';
    case 'burst':
      return 'Three concentrated beam pulses, then recovery. 10% lighter hits.';
    case 'rapid':
      return '15% more sustained beam damage. Faster pulses. Gentler recoil.';
    case 'magnum':
      return '75% stronger pulses with 40% longer spacing. 25% more sustained damage.';
    case 'deadeye':
      return '30% stronger pulses with 20% longer spacing. 8% more sustained damage.';
    default:
      return mod.description;
  }
}
export type BuildPath = 'bullet-hell' | 'precision' | 'demolition' | 'cryogenic' | 'stasis';
export const PATH_NAMES: Record<BuildPath, string> = {
  'bullet-hell': 'Bullet hell',
  precision: 'Precision',
  demolition: 'Demolition',
  cryogenic: 'Cryogenic',
  stasis: 'Stasis',
};
export const MOD_PATHS: Record<string, { path: BuildPath }> = {
  ...BRANCH_PATHS,
  ...NEW_PATH_IDS,
  convoy: { path: 'stasis' },
  'thermal-shock': { path: 'cryogenic' },
  tripwire: { path: 'demolition' },
  tension: { path: 'demolition' },
  'cutting-torch': { path: 'precision' },
  'thermal-runaway': { path: 'precision' },
  shellshock: { path: 'demolition' },
  'blast-surf': { path: 'demolition' },
  aftershock: { path: 'demolition' },
  'chain-reaction': { path: 'demolition' },
  crossfire: { path: 'bullet-hell' },
  bloom: { path: 'bullet-hell' },
  deadeye: { path: 'precision' },
  execute: { path: 'precision' },
  deadlock: { path: 'precision' },
  convergence: { path: 'bullet-hell' },
  shockfront: { path: 'demolition' },
  rivet: { path: 'precision' },
  fracture: { path: 'precision' },
  fuse: { path: 'demolition' },
  'linked-fuse': { path: 'demolition' },
  afterimage: { path: 'bullet-hell' },
  parallax: { path: 'bullet-hell' },
  'rail-spike': { path: 'precision' },
  orbit: { path: 'bullet-hell' },
  implosion: { path: 'demolition' },
  resonator: { path: 'precision' },
  'storm-cell': { path: 'demolition' },
};
export const FUSION_REQUIRES: Record<string, readonly string[]> = {
  'rail-spike': ['deadeye', 'capacitor'],
  orbit: ['crossfire', 'recall'],
  implosion: ['shellshock', 'fuse'],
  resonator: ['pulse-chamber', 'relay-gate'],
  flywheel: ['skid-plate', 'crosscut'],
  'storm-cell': ['cluster-shell', 'arc-coil'],
  'thermal-shock': ['coolant-rounds', 'cinder'],
};
export const isFusion = (id: string) => Object.hasOwn(FUSION_REQUIRES, id);
export interface RewardContext {
  stage: number;
  overtime?: boolean;
  salvage?: string | null;
}
export const SALVAGE_BOSSES: Readonly<Record<string, string>> = {
  loader: 'ramjet',
  crane: 'ramjet',
  press: 'cinder',
  kiln: 'cinder',
  condenser: 'crosswind',
  turbine: 'crosswind',
  sorter: 'ramjet',
  boss: 'cinder',
};
export const isSalvage = (id: string) => ['ramjet', 'cinder', 'crosswind'].includes(id);
export const fusionUnlocked = ({ stage, overtime }: RewardContext) => !!overtime || stage >= 7;
export const MOD_REQUIRES: Record<string, string> = {
  ...Object.fromEntries(Object.entries(BRANCH_PARENTS).map(([id, parents]) => [id, parents[0]])),
  'drop-forge': 'mass-driver',
  tension: 'tripwire',
  'thermal-runaway': 'cutting-torch',
  afterburner: 'vector',
  'corner-cutter': 'grindshot',
  'wrecking-ball': 'ramjet',
  flashpoint: 'cinder',
  slipstream: 'crosswind',
  'daisy-chain': 'arc-coil',
  snapback: 'tether',
  'blast-surf': 'shellshock',
  aftershock: 'shellshock',
  'chain-reaction': 'shellshock',
  bloom: 'crossfire',
  execute: 'deadeye',
  rewire: 'fold',
  slingshot: 'fold',
  redline: 'kick',
  breach: 'backblast',
  shatter: 'split',
  convergence: 'crossfire',
  deadlock: 'deadeye',
  shockfront: 'aftershock',
  backfire: 'backblast',
  homecoming: 'recall',
  'reserve-cell': 'capacitor',
  reprisal: 'countershot',
  rivet: 'deadeye',
  fracture: 'rivet',
  fuse: 'shellshock',
  'linked-fuse': 'fuse',
  afterimage: 'crossfire',
  parallax: 'afterimage',
  ...NEW_PATH_PARENTS,
  ...WORKSHOP_PARENTS,
};
export function buildPath(mods: readonly string[]): BuildPath | undefined {
  return mods.map((id) => MOD_PATHS[id]?.path).find((path) => path !== undefined);
}
export const TORCH_ALTERNATIVES = [
  'recall',
  'vector',
  'grindshot',
  'rail-spike',
  'mass-driver',
] as const;
export function compatibleMod(mods: readonly string[], id: string, legacy = false) {
  return (
    compatibleBranch(mods, id) &&
    (legacy ||
      !(
        (id === 'rail-spike' && mods.includes('vector')) ||
        (id === 'vector' && mods.includes('rail-spike'))
      )) &&
    !(
      id === 'cutting-torch' &&
      mods.some((m) => (TORCH_ALTERNATIVES as readonly string[]).includes(m))
    ) &&
    !(mods.includes('cutting-torch') && (TORCH_ALTERNATIVES as readonly string[]).includes(id)) &&
    !(id === 'mass-driver' && mods.includes('rail-spike')) &&
    !(id === 'rail-spike' && mods.includes('mass-driver'))
  );
}
export function availableMods(
  mods: readonly string[],
  includeSalvage = false,
  legacy = false,
): Mod[] {
  const chosen = buildPath(mods);
  return MODS.filter((mod) => {
    const branch = MOD_PATHS[mod.id];
    return (
      (includeSalvage || !isSalvage(mod.id)) &&
      !mods.includes(mod.id) &&
      compatibleMod(mods, mod.id, legacy) &&
      (!BRANCH_PARENTS[mod.id] || BRANCH_PARENTS[mod.id].every((id) => mods.includes(id))) &&
      (!MOD_REQUIRES[mod.id] || mods.includes(MOD_REQUIRES[mod.id])) &&
      (!isFusion(mod.id) ||
        (!mods.some(isFusion) && FUSION_REQUIRES[mod.id].every((id) => mods.includes(id)))) &&
      (!branch || !chosen || branch.path === chosen)
    );
  });
}
// A small preference for the chosen path, sampled without replacement.
export function rewardMods(
  mods: readonly string[],
  count: number,
  rng: () => number,
  context: RewardContext = { stage: 0 },
  excluded: readonly string[] = [],
): Mod[] {
  const path = buildPath(mods),
    pool = availableMods(mods).filter(
      (mod) =>
        !excluded.includes(mod.id) &&
        (!isFusion(mod.id) || fusionUnlocked(context)) &&
        (!isBranch(mod.id) || context.overtime || context.stage >= BRANCH_STAGE),
    ),
    offers: Mod[] = [];
  const salvage = MODS.find(
    (m) =>
      m.id === context.salvage &&
      isSalvage(m.id) &&
      availableMods(mods, true).some((candidate) => candidate.id === m.id) &&
      !mods.includes(m.id) &&
      !excluded.includes(m.id),
  );
  if (salvage && count > 0) offers.push(salvage);
  const weight = (mod: Mod) =>
    (path && MOD_PATHS[mod.id]?.path === path ? 1.5 : 1) *
    (isFusion(mod.id) ? (context.overtime ? 0.65 : 0.18) : 1);
  while (pool.length && offers.length < count) {
    let roll = rng() * pool.reduce((sum, mod) => sum + weight(mod), 0);
    let index = 0;
    while (index < pool.length - 1 && roll >= weight(pool[index])) roll -= weight(pool[index++]);
    offers.push(pool.splice(index, 1)[0]);
  }
  return offers;
}
export function validBuild(mods: readonly string[], legacy = false) {
  const picked: string[] = [];
  for (const id of mods) {
    if (!availableMods(picked, true, legacy).some((mod) => mod.id === id)) return false;
    picked.push(id);
  }
  return true;
}
export const validLegacyBuild = (mods: readonly string[]) =>
  !mods.some(isBranch) && validBuild(mods, true);
export function validSavedBuild(mods: readonly string[], legacyMods?: readonly string[]) {
  if (legacyMods === undefined) return validBuild(mods);
  if (
    !Array.isArray(legacyMods) ||
    !validLegacyBuild(legacyMods) ||
    legacyMods.length > mods.length ||
    legacyMods.some((id, i) => mods[i] !== id)
  )
    return false;
  const picked = [...legacyMods];
  for (const id of mods.slice(legacyMods.length)) {
    if (!availableMods(picked, true).some((m) => m.id === id)) return false;
    picked.push(id);
  }
  return true;
}
export function modPathLabel(id: string): string {
  if (isSalvage(id) || isSalvage(MOD_REQUIRES[id])) return 'Salvage';
  const branch = MOD_PATHS[id];
  const group = isBranch(id) ? branchGroup(id) : undefined;
  return branch
    ? PATH_NAMES[branch.path] + (isFusion(id) ? ' · Fusion' : group ? ' · ' + group : '')
    : (group ?? (isFusion(id) ? 'Fusion' : ''));
}
export function getGun(mods: readonly string[]): Gun {
  const g: Gun = {
    damage: 24,
    interval: 0.22,
    recoil: 5.4,
    pellets: 1,
    spread: 0,
    bounces: 0,
    pierce: 0,
    fragments: false,
    airDamage: 1,
    heal: 0,
    speed: 1,
    burstCount: 1,
    bankGrowth: 0,
    backblast: false,
    rearVolley: false,
    redline: false,
    breach: false,
    shatter: false,
    convergence: false,
    deadlock: false,
    shockfront: false,
    landing: false,
    lanes: 1,
    projectileSpeed: 30,
    deathBloom: false,
    execute: false,
    shellshock: false,
    blastSurf: false,
    aftershock: false,
    chainReaction: false,
  };
  for (const id of new Set(mods))
    switch (id) {
      case 'magnum':
        g.damage *= 1.75;
        g.interval *= 1.4;
        g.recoil *= 1.35;
        break;
      case 'scatter':
        g.pellets = 5;
        g.damage *= 0.32;
        g.interval *= 1.25;
        g.recoil *= 1.2;
        g.spread = 0.105;
        break;
      case 'rapid':
        g.damage *= 0.72;
        g.interval /= 1.6;
        g.recoil /= 1.35;
        break;
      case 'ricochet':
        g.bounces += 2;
        break;
      case 'pierce':
        g.pierce = 2;
        break;
      case 'split':
        g.fragments = true;
        break;
      case 'airshot':
        g.airDamage = 1.45;
        break;
      case 'kick':
        g.damage *= 1.2;
        g.recoil *= 1.4;
        break;
      case 'leech':
        g.heal = 2;
        break;
      case 'light':
        g.speed = 1.2;
        break;
      case 'burst':
        g.burstCount = 3;
        g.damage *= 0.9;
        g.recoil *= 0.8;
        break;
      case 'backblast':
        g.backblast = true;
        g.damage *= 1.25;
        g.interval *= 1.2;
        break;
      case 'backfire':
        g.rearVolley = true;
        g.interval *= 1.2;
        break;
      case 'redline':
        g.redline = true;
        break;
      case 'breach':
        g.breach = true;
        break;
      case 'shatter':
        g.shatter = true;
        break;
      case 'convergence':
        g.convergence = true;
        break;
      case 'deadlock':
        g.deadlock = true;
        break;
      case 'shockfront':
        g.shockfront = true;
        break;
      case 'banker':
        g.bounces += 1;
        g.bankGrowth = 0.35;
        g.damage *= 0.8;
        break;
      case 'landing':
        g.landing = true;
        g.damage *= 0.9;
        break;
      case 'crossfire':
        g.lanes = 3;
        g.damage *= 0.55;
        g.interval *= 1.2;
        break;
      case 'bloom':
        g.deathBloom = true;
        break;
      case 'deadeye':
        g.damage *= 1.3;
        g.interval *= 1.2;
        g.projectileSpeed *= 1.5;
        break;
      case 'shellshock':
        g.shellshock = true;
        g.interval *= 1.35;
        break;
      case 'blast-surf':
        g.blastSurf = true;
        break;
      case 'aftershock':
        g.aftershock = true;
        break;
      case 'chain-reaction':
        g.chainReaction = true;
        break;
      case 'execute':
        g.execute = true;
        break;
      case 'recall':
        g.damage *= 0.75;
        g.pierce += 1;
        break;
      case 'corner-pocket':
      case 'coolant-rounds':
        g.damage *= 0.8;
        break;
      case 'vector':
        g.projectileSpeed *= 0.75;
        break;
      case 'grindshot':
        g.damage *= 0.8;
        break;
      case 'arc-coil':
        g.damage *= 0.9;
        break;
      case 'mass-driver':
        g.damage *= 2.4;
        g.interval *= 2.5;
        g.recoil *= 1.65;
        g.projectileSpeed *= 0.6;
        g.bounces += 4;
        break;
    }
  // Apply spread after Scattershot so acquisition order cannot change the build.
  if (mods.includes('deadeye')) g.spread *= 0.5;
  // Recall's extra penetration must compose in either acquisition order.
  if (mods.includes('recall') && mods.includes('pierce')) g.pierce = 3;
  if (mods.includes('flywheel')) g.bounces = Math.max(0, g.bounces - 2);
  return g;
}
export const STAGES = 20;
export const ROOMS_PER_AREA = 4;
// Environmental seed streams from the original route remain stable after the
// inserted area. Use the real stage for combat scaling and reward generation.
export const formerStage = (stage: number) => (stage >= 16 ? stage - 4 : stage);
export const areaIndex = (stage: number) =>
  Math.min(4, Math.max(0, Math.floor(stage / ROOMS_PER_AREA)));
export const bossStage = (area: number) => area * ROOMS_PER_AREA + ROOMS_PER_AREA - 1;
export const ROOM_HEAL = 12;
export const REROLL_COST = 12;
export type RouteChoice = 'low' | 'high';
export const isRouteStage = (stage: number) =>
  Number.isInteger(stage) && stage >= 0 && stage < STAGES && stage % ROOMS_PER_AREA === 2;
export const dailyRoute = (seed: string, stage: number): RouteChoice =>
  seeded(seed + ':route:' + stage)() < 0.5 ? 'low' : 'high';
export const isDetourStage = (stage: number) =>
  Number.isInteger(stage) &&
  stage >= 0 &&
  stage < STAGES &&
  stage !== 14 &&
  stage % ROOMS_PER_AREA === 2;
export interface RewardCheckpoint {
  offers: string[];
  rerolled: boolean;
  salvage?: string;
  enteringDetour?: true;
  enteringRoute?: RouteChoice;
}
export interface Checkpoint {
  version: 5 | 6;
  legacyMods?: string[];
  legacyOffers?: string[];
  seed: string;
  stage: number;
  hp: number;
  mods: string[];
  kills: number;
  elapsed: number;
  escape?: true;
  detour?: true;
  detours?: number[];
  missedUpgrades?: number;
  overtime?: { baseMods: number; repairs: number };
  route?: RouteChoice;
  reward?: RewardCheckpoint;
}
function validRewardCheckpoint(d: Checkpoint) {
  const r = d.reward;
  if (r === undefined) return true;
  if (
    !r ||
    typeof r !== 'object' ||
    ![5, 6].includes(d.version) ||
    d.escape ||
    d.stage === STAGES - 1
  )
    return false;
  const daily = /^RF-D\d+-/.test(d.seed);
  if (
    typeof r.rerolled !== 'boolean' ||
    (daily && r.rerolled) ||
    !Array.isArray(r.offers) ||
    r.offers.length < 1 ||
    r.offers.length > (daily ? 1 : 3) ||
    new Set(r.offers).size !== r.offers.length ||
    (r.salvage !== undefined &&
      (d.detour ||
        !(
          (r.salvage === 'ramjet' && [3, 15].includes(d.stage)) ||
          (r.salvage === 'cinder' && [7, 15].includes(d.stage)) ||
          (r.salvage === 'crosswind' && d.stage === 11)
        ))) ||
    (r.enteringDetour !== undefined &&
      (r.enteringDetour !== true ||
        d.detour ||
        d.overtime ||
        !isDetourStage(d.stage) ||
        d.detours?.includes(areaIndex(d.stage))))
  )
    return false;
  if (!d.detour && isRouteStage(d.stage + 1)) {
    if (
      (r.enteringRoute !== 'low' && r.enteringRoute !== 'high') ||
      (daily && r.enteringRoute !== dailyRoute(d.seed, d.stage + 1))
    )
      return false;
  } else if (r.enteringRoute !== undefined) return false;
  if (r.offers.includes('repair'))
    return (
      !!d.overtime && !r.rerolled && r.offers.length === 1 && availableMods(d.mods).length === 0
    );
  const legal = availableMods(d.mods, true, !!d.legacyOffers);
  return r.offers.every(
    (id) =>
      legal.some((m) => m.id === id) &&
      (!isSalvage(id) || (!r.rerolled && id === r.salvage)) &&
      (!isFusion(id) || fusionUnlocked({ stage: d.stage, overtime: !!d.overtime })) &&
      (!isBranch(id) || !!d.overtime || d.stage >= BRANCH_STAGE),
  );
}
export function loadCheckpoint(value: unknown): Checkpoint | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const legacy = raw.version === 3;
  const previous = raw.version === 4;
  const incoming = value as Checkpoint;
  if (
    incoming.version !== 6 &&
    (incoming.legacyMods !== undefined || incoming.legacyOffers !== undefined)
  )
    return null;
  const oldBuild =
    incoming.version === 5 && Array.isArray(incoming.mods) && validLegacyBuild(incoming.mods);
  const oldOffers =
    oldBuild &&
    Array.isArray(incoming.reward?.offers) &&
    incoming.reward.offers.some(
      (id) =>
        !availableMods(incoming.mods, true).some((m) => m.id === id) &&
        availableMods(incoming.mods, true, true).some((m) => m.id === id),
    );
  const d: Checkpoint = {
    ...incoming,
    ...(oldBuild && !validBuild(incoming.mods) ? { legacyMods: [...incoming.mods] } : {}),
    ...(oldOffers ? { legacyOffers: [...incoming.reward!.offers] } : {}),
  };
  if (
    d.legacyOffers !== undefined &&
    (!Array.isArray(d.legacyOffers) ||
      !d.reward ||
      !Array.isArray(d.reward.offers) ||
      !Array.isArray(d.mods) ||
      !validLegacyBuild(d.mods) ||
      d.legacyOffers.some(isBranch) ||
      d.legacyOffers.length !== d.reward.offers.length ||
      d.legacyOffers.some((id, i) => d.reward!.offers[i] !== id))
  )
    return null;
  const stages = legacy ? 12 : previous ? 16 : STAGES;
  const rooms = legacy ? 3 : ROOMS_PER_AREA;
  const missed = d.missedUpgrades ?? 0;
  const oldEscape =
    legacy &&
    d.escape === true &&
    [8, 11].includes(d.stage) &&
    Array.isArray(d.mods) &&
    d.mods.length === 8;
  const completed = d.detours ?? [];
  const overtime = d.overtime;
  const validOvertime =
    overtime === undefined ||
    ([5, 6].includes(d.version) &&
      !!overtime &&
      typeof overtime === 'object' &&
      Array.isArray(completed) &&
      Number.isInteger(overtime.baseMods) &&
      overtime.baseMods === STAGES - 1 + completed.length - missed &&
      Number.isInteger(overtime.repairs) &&
      overtime.repairs >= 0 &&
      overtime.repairs <= d.stage &&
      Array.isArray(d.mods) &&
      d.mods.length + overtime.repairs === overtime.baseMods + d.stage &&
      d.detour === undefined &&
      typeof d.seed === 'string' &&
      !/^RF-D\d+-/.test(d.seed) &&
      // Older exhausted builds can contain repairs earned before later mods
      // existed. They may resume and earn those additions on their next clear.
      (overtime.repairs === 0 ||
        (validSavedBuild(d.mods, d.legacyMods) &&
          availableMods(d.mods).every(
            (m) =>
              isFusion(m.id) ||
              isBranch(m.id) ||
              NEW_PATH_MODS.some((mod) => mod.id === m.id) ||
              WORKSHOP_MODS.some((mod) => mod.id === m.id) ||
              m.id === 'arc-coil' ||
              m.id === 'daisy-chain' ||
              m.id === 'grindshot' ||
              m.id === 'corner-cutter' ||
              m.id === 'vector' ||
              m.id === 'afterburner' ||
              m.id === 'cutting-torch' ||
              m.id === 'thermal-runaway' ||
              m.id === 'tripwire' ||
              m.id === 'tension' ||
              m.id === 'mass-driver' ||
              m.id === 'drop-forge' ||
              isSalvage(MOD_REQUIRES[m.id]),
          ))));
  const validDetours =
    Array.isArray(completed) &&
    completed.length <= 4 &&
    completed.every(
      (area, index) =>
        Number.isInteger(area) &&
        area >= 0 &&
        area < (legacy || previous ? 4 : 5) &&
        (legacy || previous || area !== 3) &&
        (!!overtime || area * rooms + rooms - 2 < d.stage) &&
        (index === 0 || completed[index - 1] < area),
    );
  const valid =
    ([5, 6].includes(d.version) || previous || legacy) &&
    typeof d.seed === 'string' &&
    d.seed.length <= 40 &&
    Number.isInteger(d.stage) &&
    d.stage >= 0 &&
    d.stage < stages &&
    Number.isInteger(missed) &&
    missed >= 0 &&
    missed <= (previous ? 7 : 11) &&
    (!legacy || missed === 0) &&
    Number.isFinite(d.hp) &&
    d.hp > 0 &&
    d.hp <= 100 &&
    Array.isArray(d.mods) &&
    new Set(d.mods).size === d.mods.length &&
    d.mods.length <= MODS.length &&
    validSavedBuild(d.mods, d.legacyMods) &&
    (!d.mods.some(isFusion) || ([5, 6].includes(d.version) && (!!overtime || d.stage >= 8))) &&
    (!d.mods.some(isBranch) || ([5, 6].includes(d.version) && (!!overtime || d.stage >= 8))) &&
    Number.isInteger(d.kills) &&
    d.kills >= 0 &&
    Number.isFinite(d.elapsed) &&
    d.elapsed >= 0 &&
    validDetours &&
    validOvertime &&
    (d.route === undefined ||
      ([5, 6].includes(d.version) &&
        (d.route === 'low' || d.route === 'high') &&
        isRouteStage(d.stage) &&
        !d.detour &&
        !d.escape &&
        (!/^RF-D\d+-/.test(d.seed) || d.route === dailyRoute(d.seed, d.stage)))) &&
    (!!overtime ||
      (d.detour === undefined && d.detours === undefined) ||
      d.mods.length === d.stage + (d.detour ? 1 : 0) + completed.length - missed) &&
    (d.detour === undefined ||
      (d.detour === true &&
        d.stage % rooms === rooms - 2 &&
        (legacy || previous || isDetourStage(d.stage)) &&
        d.escape === undefined)) &&
    (d.detours === undefined || (d.detours !== null && Array.isArray(d.detours))) &&
    (d.escape === undefined ||
      (d.escape === true &&
        (d.stage === stages - 1 || oldEscape) &&
        (!!overtime ||
          d.mods.length === stages - 1 + completed.length - missed ||
          (oldEscape && completed.length === 0))));
  if (!valid || !validRewardCheckpoint(d)) return null;
  if (!legacy && !previous)
    return oldOffers || (oldBuild && !validBuild(incoming.mods)) ? { ...d, version: 6 } : incoming;
  // Keep the same room, gun and health. Skipped new rooms are recorded so later
  // detour and escape checkpoints remain valid without inventing upgrade picks.
  const oldStage = legacy
    ? d.escape
      ? 15
      : Math.floor(d.stage / 3) * 4 + (d.detour ? 2 : d.stage % 3 === 2 ? 3 : d.stage % 3)
    : d.stage;
  const stage = oldStage >= 12 ? oldStage + 4 : oldStage;
  return {
    ...d,
    version: 6,
    stage,
    ...(d.detours ? { detours: d.detours.map((area) => (area === 3 ? 4 : area)) } : {}),
    missedUpgrades:
      (legacy ? (oldEscape ? 7 : oldStage - d.stage) : missed) + (oldStage >= 12 ? 4 : 0),
  };
}
export function segmentBox(a: Vec, b: Vec, min: Vec, max: Vec): { t: number; normal: Vec } | null {
  let lo = 0,
    hi = 1,
    normal: Vec = { x: 0, y: -1 };
  for (const axis of ['x', 'y'] as const) {
    const d = b[axis] - a[axis];
    if (Math.abs(d) < 1e-8) {
      if (a[axis] < min[axis] || a[axis] > max[axis]) return null;
      continue;
    }
    let first = (min[axis] - a[axis]) / d,
      second = (max[axis] - a[axis]) / d;
    const sign = d > 0 ? -1 : 1;
    if (first > second) [first, second] = [second, first];
    if (first > lo) {
      lo = first;
      normal = axis === 'x' ? { x: sign, y: 0 } : { x: 0, y: sign };
    }
    hi = Math.min(hi, second);
    if (lo > hi) return null;
  }
  return lo >= 0 && lo <= 1 ? { t: lo, normal } : null;
}
