import { seeded, type Checkpoint } from './rules.ts';
import type { Level } from './levels.ts';

export const HUNTS = {
  cableweaver: {
    name: 'The Cableweaver',
    arena: 'Cable vault',
    hint: 'Jump over live cables. Shoot their anchors to cut the power.',
    commendation: 'cable-cut',
    reward: 'Copperline',
  },
  bulwark: {
    name: 'The Bulwark',
    arena: 'Plate depot',
    hint: 'Shots push and break its shield plates. Get above them to reach the core.',
    commendation: 'plate-breaker',
    reward: 'Sentinel',
  },
  demolisher: {
    name: 'The Demolisher',
    arena: 'Demolition bay',
    hint: 'Shoot planted charges to disarm them. Leave the marked blast radius before the fuse ends.',
    commendation: 'fuse-pulled',
    reward: 'Fusekeeper',
  },
} as const;
export type HuntKind = keyof typeof HUNTS;
export const HUNT_KINDS = Object.keys(HUNTS) as HuntKind[];
export const isHunt = (v: unknown): v is HuntKind =>
  typeof v === 'string' && Object.hasOwn(HUNTS, v);
export const huntSeed = (kind: HuntKind) => 'HUNT-' + kind;
export interface HuntSave {
  kind: HuntKind;
  stage: number;
  phase: 'available' | 'fight' | 'reward' | 'finished' | 'skipped';
  reward?: 'repair' | 'reroll';
  rerollSpent?: true;
}
// Separate RNG leaves patrols, upgrades and other optional rooms unchanged.
export function planHunt(seed: string): HuntSave | null {
  if (/^RF-D\d+-/.test(seed)) return null;
  const rng = seeded(seed + ':rare-hunt:1');
  if (rng() >= 0.5) return null;
  return {
    kind: HUNT_KINDS[Math.floor(rng() * 3)],
    stage: [4, 8, 12, 16][Math.floor(rng() * 4)],
    phase: 'available',
  };
}
export function huntDetour(d: Checkpoint) {
  return !!d.hunt && d.stage === d.hunt.stage && ['fight', 'reward'].includes(d.hunt.phase);
}
export function validHunt(d: Checkpoint): boolean {
  if (d.huntTest !== undefined)
    return (
      isHunt(d.huntTest) &&
      d.seed === huntSeed(d.huntTest) &&
      d.stage === 8 &&
      d.version === 6 &&
      !d.huntRules &&
      !d.hunt &&
      !d.detour &&
      !d.overtime &&
      !d.escape &&
      !d.reward &&
      !d.bossRemix
    );
  if (d.huntRules === undefined) return d.hunt === undefined;
  if (d.huntRules !== 1 || d.version !== 6 || d.encounters !== 1 || /^RF-D\d+-/.test(d.seed))
    return false;
  const s = d.hunt;
  if (s === undefined) return planHunt(d.seed) === null;
  const planned = planHunt(d.seed);
  return (
    !!s &&
    typeof s === 'object' &&
    !Array.isArray(s) &&
    !!planned &&
    isHunt(s.kind) &&
    s.kind === planned.kind &&
    s.stage === planned.stage &&
    ['available', 'fight', 'reward', 'finished', 'skipped'].includes(s.phase) &&
    Object.keys(s).every((k) => ['kind', 'stage', 'phase', 'reward', 'rerollSpent'].includes(k)) &&
    (['fight', 'reward'].includes(s.phase)
      ? d.stage === s.stage &&
        d.detour === true &&
        !d.overtime &&
        !d.escape &&
        !d.reward &&
        !d.route
      : true) &&
    (s.phase === 'available' ? d.stage <= s.stage && !d.overtime && !d.escape : true) &&
    (s.reward === undefined
      ? s.phase !== 'finished' && s.rerollSpent === undefined
      : s.phase === 'finished' && ['repair', 'reroll'].includes(s.reward)) &&
    (s.rerollSpent === undefined || (s.rerollSpent === true && s.reward === 'reroll'))
  );
}
export function huntLevel(kind: HuntKind): Level {
  const platforms =
    kind === 'bulwark'
      ? [
          { x: 520, y: 605, w: 180, h: 18 },
          { x: 1280, y: 605, w: 180, h: 18 },
        ]
      : kind === 'cableweaver'
        ? [
            { x: 460, y: 620, w: 200, h: 18 },
            { x: 1330, y: 580, w: 200, h: 18 },
          ]
        : [
            { x: 570, y: 590, w: 210, h: 18 },
            { x: 1250, y: 620, w: 210, h: 18 },
          ];
  return {
    id: 'hunt-' + kind,
    hunt: kind,
    name: HUNTS[kind].arena,
    area: kind === 'demolisher' ? 'furnace' : kind === 'bulwark' ? 'reclamation' : 'cooling',
    boss: true,
    detour: true,
    mirrored: false,
    solids: platforms,
    spawns: [{ kind, x: 1460, y: 705 }],
    route: [
      { x: 580, y: 570 },
      { x: 1420, y: 560 },
    ],
    hazards: [],
    setpiece: { rosters: [], props: [], cargo: [], weak: [] },
  };
}
