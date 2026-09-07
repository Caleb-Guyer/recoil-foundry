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
    description: 'Fire both ways, plus a rear blast. 40% longer shot delay.',
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
    description: 'Right-click two surfaces to link portals. Carry your momentum through.',
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
] as const;
export type Mod = (typeof MODS)[number];
export type BuildPath = 'bullet-hell' | 'precision' | 'demolition';
export const PATH_NAMES: Record<BuildPath, string> = {
  'bullet-hell': 'Bullet hell',
  precision: 'Precision',
  demolition: 'Demolition',
};
export const MOD_PATHS: Record<string, { path: BuildPath; requires?: string }> = {
  shellshock: { path: 'demolition' },
  'blast-surf': { path: 'demolition', requires: 'shellshock' },
  aftershock: { path: 'demolition', requires: 'shellshock' },
  'chain-reaction': { path: 'demolition', requires: 'shellshock' },
  crossfire: { path: 'bullet-hell' },
  bloom: { path: 'bullet-hell', requires: 'crossfire' },
  deadeye: { path: 'precision' },
  execute: { path: 'precision', requires: 'deadeye' },
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
      (!branch ||
        ((!chosen || branch.path === chosen) &&
          (!branch.requires || mods.includes(branch.requires))))
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
        g.interval *= 1.4;
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
export const STAGES = 12;
export const ROOM_HEAL = 12;
export interface Checkpoint {
  version: 3;
  seed: string;
  stage: number;
  hp: number;
  mods: string[];
  kills: number;
  elapsed: number;
  escape?: true;
}
export function loadCheckpoint(value: unknown): Checkpoint | null {
  if (!value || typeof value !== 'object') return null;
  let d = value as Checkpoint;
  // A saved nine-room escape has already earned its ending. Keep it intact.
  if (
    d.version === 3 &&
    d.escape === true &&
    d.stage === 8 &&
    Array.isArray(d.mods) &&
    d.mods.length === 8
  )
    d = { ...d, stage: STAGES - 1 };
  return d.version === 3 &&
    typeof d.seed === 'string' &&
    d.seed.length <= 40 &&
    Number.isInteger(d.stage) &&
    d.stage >= 0 &&
    d.stage < STAGES &&
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
    (d.escape === undefined ||
      (d.escape === true &&
        d.stage === STAGES - 1 &&
        (d.mods.length === STAGES - 1 || d.mods.length === 8)))
    ? d
    : null;
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
