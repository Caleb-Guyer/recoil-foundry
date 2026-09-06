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
    description: '40% more recoil. Turn shots into movement.',
    mark: 'kick',
  },
  { id: 'leech', name: 'Bloodwork', description: 'Every kill restores 5 health.', mark: 'heal' },
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
    description: 'A short blast behind every shot. Slower fire.',
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
] as const;
export type Mod = (typeof MODS)[number];
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
        g.damage *= 0.38;
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
        g.recoil *= 1.4;
        break;
      case 'leech':
        g.heal = 5;
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
        g.interval *= 1.15;
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
    }
  return g;
}
export const STAGES = 9;
export interface Checkpoint {
  version: 3;
  seed: string;
  stage: number;
  hp: number;
  mods: string[];
  kills: number;
  elapsed: number;
}
export function loadCheckpoint(value: unknown): Checkpoint | null {
  if (!value || typeof value !== 'object') return null;
  const d = value as Checkpoint;
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
    d.mods.every((id) => MODS.some((m) => m.id === id)) &&
    Number.isInteger(d.kills) &&
    d.kills >= 0 &&
    Number.isFinite(d.elapsed) &&
    d.elapsed >= 0
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
