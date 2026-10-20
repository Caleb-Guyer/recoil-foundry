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
export const HUNT_STAGES = [8, 16] as const;
export const HUNT_THRESHOLD = 480;
export const isHuntOrder = (v: unknown): v is [HuntKind, HuntKind] =>
  Array.isArray(v) && v.length === 2 && v.every(isHunt) && v[0] !== v[1];
export interface HuntSave {
  kind: HuntKind;
  stage: number;
  phase: 'available' | 'approach' | 'fight' | 'reward' | 'finished' | 'skipped';
  reward?: 'repair' | 'reroll';
  rerollSpent?: true;
}
// Prefer undiscovered machines without tying combat or reward RNG to the profile.
// The chosen pair is saved, so Continue, Retry and shared replays keep that pair.
export function planHunts(seed: string, defeated: readonly HuntKind[] = []): HuntSave[] {
  if (/^RF-D\d+-/.test(seed)) return [];
  const rng = seeded(seed + ':hunt-route:2');
  const kinds = [...HUNT_KINDS];
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  kinds.sort((a, b) => Number(defeated.includes(a)) - Number(defeated.includes(b)));
  return HUNT_STAGES.map((stage, i) => ({ kind: kinds[i], stage, phase: 'available' }));
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
  return [d.hunt, ...(d.hunts ?? [])].some(
    (s) => s && d.stage === s.stage && ['approach', 'fight', 'reward'].includes(s.phase),
  );
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
      !d.hunts &&
      !d.detour &&
      !d.overtime &&
      !d.escape &&
      !d.reward &&
      !d.bossRemix &&
      (d.huntApproach === undefined || d.huntApproach === true)
    );
  if (d.huntApproach !== undefined) return false;
  if (d.huntRules === undefined) return d.hunt === undefined && d.hunts === undefined;
  if (
    ![1, 2].includes(d.huntRules) ||
    d.version !== 6 ||
    d.encounters !== 1 ||
    /^RF-D\d+-/.test(d.seed)
  )
    return false;
  if (d.huntRules === 2) {
    if (
      d.hunt !== undefined ||
      !Array.isArray(d.hunts) ||
      !isHuntOrder(d.hunts.map((s) => s?.kind))
    )
      return false;
    return d.hunts.every(
      (s, i) =>
        s.stage === HUNT_STAGES[i] &&
        validHuntState(d, s, true) &&
        (s.stage > d.stage
          ? s.phase === 'available'
          : s.stage < d.stage || d.overtime || d.escape
            ? ['finished', 'skipped'].includes(s.phase)
            : true),
    );
  }
  if (d.hunts !== undefined) return false;
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
    validHuntState(d, s, false)
  );
}
function validHuntState(d: Checkpoint, s: HuntSave, approach: boolean): boolean {
  return (
    !!s &&
    typeof s === 'object' &&
    !Array.isArray(s) &&
    isHunt(s.kind) &&
    (approach
      ? ['available', 'approach', 'fight', 'reward', 'finished', 'skipped']
      : ['available', 'fight', 'reward', 'finished', 'skipped']
    ).includes(s.phase) &&
    Object.keys(s).every((k) => ['kind', 'stage', 'phase', 'reward', 'rerollSpent'].includes(k)) &&
    (['approach', 'fight', 'reward'].includes(s.phase)
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
export function huntLevel(kind: HuntKind, approach = false): Level {
  const platforms =
    kind === 'bulwark'
      ? [
          { x: 620, y: 570, w: 210, h: 22 },
          { x: 1060, y: 465, w: 210, h: 22 },
          { x: 1580, y: 570, w: 210, h: 22 },
        ]
      : kind === 'cableweaver'
        ? [
            { x: 620, y: 650, w: 160, h: 22 },
            { x: 920, y: 555, w: 180, h: 22 },
            { x: 1240, y: 460, w: 190, h: 22 },
            { x: 1580, y: 575, w: 180, h: 22 },
          ]
        : [
            { x: 650, y: 610, w: 180, h: 26 },
            { x: 1040, y: 525, w: 220, h: 26 },
            { x: 1530, y: 610, w: 180, h: 26 },
          ];
  return {
    id: 'hunt-' + kind,
    hunt: kind,
    name: HUNTS[kind].arena,
    area: kind === 'demolisher' ? 'furnace' : kind === 'bulwark' ? 'reclamation' : 'cooling',
    boss: true,
    detour: true,
    mirrored: false,
    solids: [
      { x: 0, y: 555, w: HUNT_THRESHOLD - 35, h: 24 },
      { x: HUNT_THRESHOLD - 22, y: 0, w: 44, h: 555 },
      ...platforms,
    ],
    spawns: approach ? [] : [{ kind, x: 1460, y: 705 }],
    route: [{ x: 580, y: 722 }, ...platforms.map((s) => ({ x: s.x + s.w / 2, y: s.y - 18 }))],
    hazards: [],
    setpiece: { rosters: [], props: [], cargo: [], weak: [] },
  };
}
