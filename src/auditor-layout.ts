import { getLevel, type Level } from './levels.ts';
import { getRouteLevel } from './route-layouts.ts';
import { isRouteStage, seeded, type Checkpoint } from './rules.ts';
import type { AreaEventSave } from './area-events.ts';

export const AUDITOR_HP = 1800;
export const COMPANY_CASE = { x: 86, y: 718 };
export interface AuditorSave {
  caseStage: number;
  rooms: number[];
  status: 'sealed' | 'offered' | 'hunting' | 'defeated';
  hp: number;
  visits: number;
  room?: number;
  retreated?: true;
}
export const auditorEligible = (level: Level) =>
  !(
    level.boss ||
    level.freight ||
    level.crossing ||
    level.courier ||
    level.floodgate ||
    level.story ||
    level.shutdown ||
    level.fabricatorIntro ||
    level.anglerIntro ||
    level.crawlerIntro ||
    level.harpoonIntro ||
    level.sapperIntro ||
    level.detour
  );
export function planAuditor(
  seed: string,
  exclusions: {
    event?: AreaEventSave | null;
    courier?: number;
    floodgate?: number | null;
    story?: number;
  } = {},
): AuditorSave | null {
  const rng = seeded(seed + ':auditor-v1');
  if (rng() >= 0.3) return null;
  const stages = Array.from({ length: 18 }, (_, i) => i + 1).filter(
    (stage) =>
      stage !== 13 &&
      Math.floor(stage / 4) !== exclusions.event?.area &&
      stage !== exclusions.courier &&
      stage !== exclusions.floodgate &&
      stage !== exclusions.story &&
      auditorEligible(
        isRouteStage(stage) ? getRouteLevel(seed, stage, 'low') : getLevel(seed, stage),
      ),
  );
  const cases = stages.filter((s, i) => s <= 8 && stages.length - i - 1 >= 3);
  if (!cases.length) return null;
  const caseStage = cases[Math.floor(rng() * cases.length)];
  return {
    caseStage,
    rooms: stages.filter((s) => s > caseStage).slice(0, 3),
    status: 'sealed',
    hp: AUDITOR_HP,
    visits: 0,
  };
}
export function auditorBonus(s?: AuditorSave | null) {
  return s?.status === 'hunting' || s?.status === 'defeated' ? 1 : 0;
}
export function validAuditor(d: Checkpoint): boolean {
  const s = d.auditor;
  if (s === undefined) return d.reward?.auditor === undefined;
  if (
    !s ||
    d.version !== 6 ||
    typeof s !== 'object' ||
    !Number.isInteger(s.caseStage) ||
    s.caseStage < 1 ||
    s.caseStage > 8 ||
    s.caseStage % 4 === 3 ||
    !Array.isArray(s.rooms) ||
    s.rooms.length !== 3 ||
    !s.rooms.every(
      (room, i) =>
        Number.isInteger(room) &&
        room > (i ? s.rooms[i - 1] : s.caseStage) &&
        room < 19 &&
        room % 4 !== 3 &&
        room !== 13,
    ) ||
    !['sealed', 'offered', 'hunting', 'defeated'].includes(s.status) ||
    !Number.isFinite(s.hp) ||
    s.hp < 0 ||
    s.hp > AUDITOR_HP ||
    !Number.isInteger(s.visits) ||
    s.visits < 0 ||
    s.visits > 3 ||
    (s.retreated !== undefined && s.retreated !== true) ||
    (s.room !== undefined &&
      (s.visits < 1 || s.room !== s.rooms[s.visits - 1] || (!d.overtime && s.room > d.stage))) ||
    (s.visits > 0 && s.room === undefined) ||
    (s.retreated && (!s.room || s.visits >= 3 || s.status !== 'hunting')) ||
    [s.caseStage, ...s.rooms].some(
      (stage) =>
        Math.floor(stage / 4) === d.areaEvent?.area ||
        stage === d.courier?.stage ||
        stage === d.floodgate ||
        stage === d.story?.stage,
    )
  )
    return false;
  if (s.status === 'sealed' || s.status === 'offered') {
    if (s.hp !== AUDITOR_HP || s.visits !== 0 || s.room !== undefined || s.retreated) return false;
  } else if (!d.overtime && d.stage < s.caseStage) return false;
  if (s.status === 'offered')
    return (
      d.stage === s.caseStage && !d.detour && !d.overtime && !d.escape && d.reward?.auditor === true
    );
  if (d.reward?.auditor) return false;
  if (s.status === 'defeated') return s.hp === 0 && s.visits > 0;
  return s.hp > 0;
}

// A small, ordinary cover layout for repeatable non-persisting encounter tests.
export function auditorTestLevel(source: Level): Level {
  return {
    id: 'audit-yard',
    name: 'Audit yard',
    area: source.area,
    boss: false,
    mirrored: false,
    solids: [
      { x: 460, y: 634, w: 130, h: 106 },
      { x: 970, y: 608, w: 150, h: 132 },
      { x: 1430, y: 636, w: 130, h: 104 },
      { x: 670, y: 430, w: 200, h: 22 },
      { x: 1230, y: 420, w: 200, h: 22 },
    ],
    spawns: [],
    hazards: [],
    setpiece: {
      rosters: [],
      weak: [],
      props: [
        { kind: 'crate', x: 805, y: 407 },
        { kind: 'canister', x: 1190, y: 720 },
      ],
    },
    route: [
      { x: 520, y: 610 },
      { x: 775, y: 720 },
      { x: 1045, y: 585 },
      { x: 1280, y: 720 },
      { x: 1495, y: 613 },
      { x: 1810, y: 720 },
    ],
  };
}
export function auditorTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'phase', 'build', 'v'].includes(key) || p.getAll(key).length !== 1)
      invalid = true;
  });
  const phase = p.get('phase') ?? 'case',
    build = p.get('build') ?? 'standard';
  if (
    invalid ||
    p.get('test') !== 'auditor' ||
    !['case', 'hunt', 'damaged', 'final'].includes(phase) ||
    !['standard', 'beam', 'portal'].includes(build)
  )
    return null;
  const stage = { case: 4, hunt: 5, damaged: 9, final: 17 }[phase]!;
  const mods = [
    'magnum',
    'kick',
    'light',
    build === 'beam' ? 'cutting-torch' : build === 'portal' ? 'fold' : 'airshot',
    'ricochet',
    'rapid',
    'landing',
  ].slice(0, phase === 'case' ? 4 : phase === 'hunt' ? 6 : 7);
  const visits = { case: 0, hunt: 0, damaged: 1, final: 2 }[phase]!;
  return {
    version: 6,
    seed: 'AUDITOR-91-' + phase.toUpperCase(),
    stage,
    hp: 100,
    mods,
    kills: 0,
    elapsed: 0,
    missedUpgrades: Math.max(0, stage + (phase === 'case' ? 0 : 1) - mods.length),
    auditor: {
      caseStage: 4,
      rooms: [5, 9, 17],
      status: phase === 'case' ? 'sealed' : 'hunting',
      hp: phase === 'final' ? 560 : phase === 'damaged' ? 1100 : AUDITOR_HP,
      visits,
      ...(visits ? { room: visits === 1 ? 5 : 9, retreated: true as const } : {}),
    },
  };
}
