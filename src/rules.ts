export type WeaponId = 'coil' | 'scatter' | 'lance' | 'mortar';
export type Vec = { x: number; y: number };
export const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
export const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export function pointerButtons(buttons: number) {
  return { fire: (buttons & 1) !== 0, winch: (buttons & 2) !== 0 };
}
export function direction(a: Vec, b: Vec): Vec {
  const d = distance(a, b) || 1;
  return { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
}
export function seeded(seed: string): () => number {
  let s = 2166136261;
  for (const ch of seed) s = Math.imul(s ^ ch.charCodeAt(0), 16777619);
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
export interface Stats {
  damage: number;
  recoil: number;
  interval: number;
  cost: number;
  maxHp: number;
  maxEnergy: number;
  regen: number;
  winchCost: number;
  bounce: number;
  fragments: boolean;
  induction: boolean;
  airJump: boolean;
  salvage: boolean;
  emergency: boolean;
  pierce: number;
  blast: number;
  cargoArmor: number;
  cargoRepair: number;
}
export function getStats(techs: readonly string[]): Stats {
  const s: Stats = {
    damage: 1,
    recoil: 1,
    interval: 1,
    cost: 1,
    maxHp: 100,
    maxEnergy: 100,
    regen: 18,
    winchCost: 1,
    bounce: 0,
    fragments: false,
    induction: false,
    airJump: false,
    salvage: false,
    emergency: false,
    pierce: 0,
    blast: 1,
    cargoArmor: 1,
    cargoRepair: 25,
  };
  for (const id of new Set(techs)) {
    switch (id) {
      case 'dense':
        s.damage *= 1.25;
        s.recoil *= 1.5;
        s.interval *= 1.15;
        break;
      case 'elastic':
        s.bounce = 2;
        s.damage *= 0.9;
        break;
      case 'fragment':
        s.fragments = true;
        break;
      case 'induction':
        s.induction = true;
        break;
      case 'overclock':
        s.interval *= 0.8;
        s.cost *= 1.2;
        break;
      case 'capacitor':
        s.maxEnergy += 40;
        s.regen += 4;
        break;
      case 'efficient':
        s.winchCost *= 0.7;
        break;
      case 'stabilizer':
        s.recoil *= 0.5;
        s.damage *= 1.1;
        break;
      case 'thrusters':
        s.airJump = true;
        break;
      case 'armor':
        s.maxHp += 30;
        break;
      case 'emergency':
        s.emergency = true;
        break;
      case 'salvage':
        s.salvage = true;
        break;
      case 'piercing':
        s.pierce = 2;
        break;
      case 'cluster':
        s.blast *= 1.3;
        break;
      case 'cargo-armor':
        s.cargoArmor = 0.7;
        break;
      case 'repair':
        s.cargoRepair = 45;
        break;
    }
  }
  return s;
}
export interface Tech {
  id: string;
  name: string;
  category: string;
  description: string;
  glyph: string;
  requiresWeapon?: WeaponId;
}
export const TECHS: Tech[] = [
  {
    id: 'dense',
    name: 'Heavy rivets',
    category: 'BALLISTICS',
    description: '+25% weapon damage. +50% recoil. Fire 15% slower.',
    glyph: 'ρ',
  },
  {
    id: 'elastic',
    name: 'Bankshot rounds',
    category: 'BALLISTICS',
    description: 'Rivet and breacher rounds ricochet twice. −10% weapon damage.',
    glyph: '↗',
  },
  {
    id: 'fragment',
    name: 'Fragmentation',
    category: 'REACTION',
    description:
      'The first ballistic impact releases 3 fragments. Demo charges release 8. Fragments cannot split.',
    glyph: '※',
  },
  {
    id: 'induction',
    name: 'Impact dynamo',
    category: 'ENERGY',
    description:
      'Direct weapon hits return 1 energy, up to 4 per shot. Secondary effects do not trigger it.',
    glyph: '∿',
  },
  {
    id: 'overclock',
    name: 'Overclock',
    category: 'OUTPUT',
    description: '20% shorter firing intervals. Energy weapons cost 20% more.',
    glyph: '»',
  },
  {
    id: 'capacitor',
    name: 'Supercapacitor',
    category: 'ENERGY',
    description: '+40 maximum energy. +4 energy regeneration per second.',
    glyph: 'Ⅱ',
  },
  {
    id: 'efficient',
    name: 'Geared winch',
    category: 'HAULING',
    description: 'The powered winch consumes 30% less energy.',
    glyph: '◎',
  },
  {
    id: 'stabilizer',
    name: 'Inertial stabilizer',
    category: 'MOTION',
    description: '50% less recoil. +10% weapon damage. Recoil jumps become weaker.',
    glyph: '⊥',
  },
  {
    id: 'thrusters',
    name: 'Jump jets',
    category: 'MOTION',
    description: 'Gain a second jump in the air and 60% stronger air control.',
    glyph: '↑',
  },
  {
    id: 'armor',
    name: 'Rover plating',
    category: 'SURVIVAL',
    description: '+30 maximum integrity. Immediately repair 30 integrity.',
    glyph: '⬡',
  },
  {
    id: 'emergency',
    name: 'Emergency conversion',
    category: 'SURVIVAL',
    description: 'Regenerate 14 additional energy per second while below 35% integrity.',
    glyph: '!',
  },
  {
    id: 'salvage',
    name: 'Salvage protocol',
    category: 'SURVIVAL',
    description: 'Each eliminated enemy has a 30% chance to drop an additional repair cell.',
    glyph: '+',
  },
  {
    id: 'piercing',
    name: 'Piercing optics',
    category: 'OPTICS',
    description:
      'The cutting laser penetrates 2 more targets. Each penetration retains 70% damage.',
    glyph: '⇢',
    requiresWeapon: 'lance',
  },
  {
    id: 'cluster',
    name: 'Demolition mix',
    category: 'REACTION',
    description: 'Demo charge blast radius increases 30%. Explosion damage increases 15%.',
    glyph: '✳',
    requiresWeapon: 'mortar',
  },
  {
    id: 'cargo-armor',
    name: 'Cargo cage',
    category: 'HAULING',
    description: 'The power core takes 30% less damage from hostile rounds.',
    glyph: '⬡',
  },
  {
    id: 'repair',
    name: 'Patch kit',
    category: 'HAULING',
    description: 'Immediately repair 20 core integrity. Repair 45 instead of 25 between yards.',
    glyph: '+',
  },
];
export function eligibleTechs(owned: readonly string[], weapons: readonly WeaponId[]) {
  return TECHS.filter(
    (t) => !owned.includes(t.id) && (!t.requiresWeapon || weapons.includes(t.requiresWeapon)),
  );
}
export const WEAPONS: Record<
  WeaponId,
  {
    name: string;
    label: string;
    description: string;
    damage: number;
    interval: number;
    cost: number;
    speed: number;
    recoil: number;
    color: string;
  }
> = {
  coil: {
    name: 'Rivet gun',
    label: 'KINETIC / 01',
    description: 'Fast, precise rounds. No energy cost. Your reliable baseline.',
    damage: 16,
    interval: 0.18,
    cost: 0,
    speed: 22,
    recoil: 0.85,
    color: '#ffc080',
  },
  scatter: {
    name: 'Breacher',
    label: 'KINETIC / 02',
    description: 'Seven pellets. Heavy kick. Aim down to extend a jump.',
    damage: 7,
    interval: 0.56,
    cost: 10,
    speed: 19,
    recoil: 3.7,
    color: '#ffa05f',
  },
  lance: {
    name: 'Cutting laser',
    label: 'OPTICS / 03',
    description: 'An instant beam with pinpoint accuracy. Consumes energy.',
    damage: 12,
    interval: 0.09,
    cost: 3,
    speed: 0,
    recoil: 0.05,
    color: '#89f7db',
  },
  mortar: {
    name: 'Demo launcher',
    label: 'REACTION / 04',
    description: 'Bouncing charges explode after a short fuse. Blasts launch nearby objects.',
    damage: 60,
    interval: 0.8,
    cost: 14,
    speed: 12,
    recoil: 2.8,
    color: '#e5b1ff',
  },
};
export const STAGES = [
  {
    name: 'Wreck intake',
    subtitle: 'Recover the last power core.',
    label: 'YARD 01 / INTAKE',
    count: 4,
  },
  {
    name: 'Sorting yard',
    subtitle: 'Find a route through the scrap.',
    label: 'YARD 02 / SORTING',
    count: 6,
  },
  {
    name: 'Smelter run',
    subtitle: 'Keep the cargo moving.',
    label: 'YARD 03 / SMELTER',
    count: 8,
  },
  {
    name: 'Freight junction',
    subtitle: 'Beat the security patrols.',
    label: 'YARD 04 / FREIGHT',
    count: 10,
  },
  {
    name: 'Dead conveyor',
    subtitle: 'The last stretch is unpowered.',
    label: 'YARD 05 / CONVEYOR',
    count: 12,
  },
  {
    name: 'Loading dock',
    subtitle: 'Break the yard warden. Deliver the core.',
    label: 'YARD 06 / EXTRACTION',
    count: 1,
  },
];
export function enemyTypes(stage: number, rng: () => number): string[] {
  const pool = ['crawler', 'sentry', 'hopper', 'drone', 'bulwark'].slice(0, Math.min(stage + 2, 5));
  return stage === 5
    ? ['boss']
    : Array.from({ length: STAGES[stage].count }, () => pool[Math.floor(rng() * pool.length)]);
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
export interface Checkpoint {
  version: 2;
  seed: string;
  stage: number;
  hp: number;
  energy: number;
  techs: string[];
  weapons: WeaponId[];
  weapon: WeaponId;
  cargoHp: number;
  kills: number;
  elapsed: number;
}
export function validateCheckpoint(data: unknown): data is Checkpoint {
  if (!data || typeof data !== 'object') return false;
  const d = data as Checkpoint;
  return (
    d.version === 2 &&
    typeof d.seed === 'string' &&
    d.seed.length <= 40 &&
    Number.isInteger(d.stage) &&
    d.stage >= 0 &&
    d.stage < 6 &&
    Number.isFinite(d.hp) &&
    d.hp > 0 &&
    d.hp <= 130 &&
    Number.isFinite(d.energy) &&
    d.energy >= 0 &&
    d.energy <= 140 &&
    Array.isArray(d.techs) &&
    d.techs.length <= TECHS.length &&
    new Set(d.techs).size === d.techs.length &&
    d.techs.every((t) => TECHS.some((x) => x.id === t)) &&
    Array.isArray(d.weapons) &&
    d.weapons.length > 0 &&
    d.weapons.length <= 4 &&
    d.weapons.includes('coil') &&
    new Set(d.weapons).size === d.weapons.length &&
    d.weapons.every((w) => Object.hasOwn(WEAPONS, w)) &&
    d.weapons.includes(d.weapon) &&
    Number.isFinite(d.cargoHp) &&
    d.cargoHp > 0 &&
    d.cargoHp <= 120 &&
    Number.isFinite(d.kills) &&
    d.kills >= 0 &&
    Number.isFinite(d.elapsed) &&
    d.elapsed >= 0
  );
}
export function loadCheckpoint(data: unknown): Checkpoint | null {
  if (!data || typeof data !== 'object') return null;
  const raw = data as Record<string, unknown>;
  if (raw.version === 1) {
    if (!['repulsor', 'tractor'].includes(String(raw.field)) || !Array.isArray(raw.techs))
      return null;
    const { field: _retiredField, ...rest } = raw;
    const migrated = {
      ...rest,
      version: 2,
      cargoHp: 120,
      techs: raw.techs.map((id) =>
        id === 'conductive' ? 'cargo-armor' : id === 'feedback' ? 'repair' : id,
      ),
    };
    return validateCheckpoint(migrated) ? migrated : null;
  }
  return validateCheckpoint(data) ? data : null;
}
