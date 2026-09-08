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
] as const;
export type Mod = (typeof MODS)[number];
export type BuildPath = 'bullet-hell' | 'precision' | 'demolition';
export const PATH_NAMES: Record<BuildPath, string> = {
  'bullet-hell': 'Bullet hell',
  precision: 'Precision',
  demolition: 'Demolition',
};
export const MOD_PATHS: Record<string, { path: BuildPath }> = {
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
};
export const MOD_REQUIRES: Record<string, string> = {
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
};
export function buildPath(mods: readonly string[]): BuildPath | undefined {
  return mods.map((id) => MOD_PATHS[id]?.path).find((path) => path !== undefined);
}
export function availableMods(mods: readonly string[]): Mod[] {
  const chosen = buildPath(mods);
  return MODS.filter((mod) => {
    const branch = MOD_PATHS[mod.id];
    return (
      !mods.includes(mod.id) &&
      (!MOD_REQUIRES[mod.id] || mods.includes(MOD_REQUIRES[mod.id])) &&
      (!branch || !chosen || branch.path === chosen)
    );
  });
}
// A small preference for the chosen path, sampled without replacement.
export function rewardMods(mods: readonly string[], count: number, rng: () => number): Mod[] {
  const path = buildPath(mods),
    pool = availableMods(mods),
    offers: Mod[] = [];
  const weight = (mod: Mod) => (path && MOD_PATHS[mod.id]?.path === path ? 1.5 : 1);
  while (pool.length && offers.length < count) {
    let roll = rng() * pool.reduce((sum, mod) => sum + weight(mod), 0);
    let index = 0;
    while (index < pool.length - 1 && roll >= weight(pool[index])) roll -= weight(pool[index++]);
    offers.push(pool.splice(index, 1)[0]);
  }
  return offers;
}
export function validBuild(mods: readonly string[]) {
  const picked: string[] = [];
  for (const id of mods) {
    if (!availableMods(picked).some((mod) => mod.id === id)) return false;
    picked.push(id);
  }
  return true;
}
export function modPathLabel(id: string): string {
  const branch = MOD_PATHS[id];
  return branch ? PATH_NAMES[branch.path] : '';
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
    }
  // Apply spread after Scattershot so acquisition order cannot change the build.
  if (mods.includes('deadeye')) g.spread *= 0.5;
  return g;
}
export const STAGES = 16;
export const ROOMS_PER_AREA = 4;
export const areaIndex = (stage: number) =>
  Math.min(3, Math.max(0, Math.floor(stage / ROOMS_PER_AREA)));
export const bossStage = (area: number) => area * ROOMS_PER_AREA + ROOMS_PER_AREA - 1;
export const ROOM_HEAL = 12;
export const isDetourStage = (stage: number) =>
  Number.isInteger(stage) && stage >= 0 && stage < STAGES && stage % ROOMS_PER_AREA === 2;
export interface Checkpoint {
  version: 4;
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
}
export function loadCheckpoint(value: unknown): Checkpoint | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const legacy = raw.version === 3;
  const d = value as Checkpoint;
  const stages = legacy ? 12 : STAGES;
  const rooms = legacy ? 3 : ROOMS_PER_AREA;
  const missed = d.missedUpgrades ?? 0;
  const oldEscape =
    legacy &&
    d.escape === true &&
    [8, 11].includes(d.stage) &&
    Array.isArray(d.mods) &&
    d.mods.length === 8;
  const completed = d.detours ?? [];
  const validDetours =
    Array.isArray(completed) &&
    completed.length <= 4 &&
    completed.every(
      (area, index) =>
        Number.isInteger(area) &&
        area >= 0 &&
        area < 4 &&
        area * rooms + rooms - 2 < d.stage &&
        (index === 0 || completed[index - 1] < area),
    );
  const valid =
    (d.version === 4 || legacy) &&
    typeof d.seed === 'string' &&
    d.seed.length <= 40 &&
    Number.isInteger(d.stage) &&
    d.stage >= 0 &&
    d.stage < stages &&
    Number.isInteger(missed) &&
    missed >= 0 &&
    missed <= 7 &&
    (!legacy || missed === 0) &&
    Number.isFinite(d.hp) &&
    d.hp > 0 &&
    d.hp <= 100 &&
    Array.isArray(d.mods) &&
    new Set(d.mods).size === d.mods.length &&
    d.mods.length <= MODS.length &&
    validBuild(d.mods) &&
    Number.isInteger(d.kills) &&
    d.kills >= 0 &&
    Number.isFinite(d.elapsed) &&
    d.elapsed >= 0 &&
    validDetours &&
    ((d.detour === undefined && d.detours === undefined) ||
      d.mods.length === d.stage + (d.detour ? 1 : 0) + completed.length - missed) &&
    (d.detour === undefined ||
      (d.detour === true && d.stage % rooms === rooms - 2 && d.escape === undefined)) &&
    (d.detours === undefined || (d.detours !== null && Array.isArray(d.detours))) &&
    (d.escape === undefined ||
      (d.escape === true &&
        (d.stage === stages - 1 || oldEscape) &&
        (d.mods.length === stages - 1 + completed.length - missed ||
          (oldEscape && completed.length === 0))));
  if (!valid) return null;
  if (!legacy) return d;
  // Keep the same room, gun and health. Skipped new rooms are recorded so later
  // detour and escape checkpoints remain valid without inventing upgrade picks.
  const stage = d.escape
    ? STAGES - 1
    : Math.floor(d.stage / 3) * 4 + (d.detour ? 2 : d.stage % 3 === 2 ? 3 : d.stage % 3);
  return { ...d, version: 4, stage, missedUpgrades: oldEscape ? 7 : stage - d.stage };
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
