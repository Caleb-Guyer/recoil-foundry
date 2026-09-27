import type { Level, Spawn } from './levels.ts';
import { ENEMY_STATS } from './enemies.ts';
import { getOvertimeLevel } from './overtime.ts';
import { seeded } from './rules.ts';

import type { WelderSave } from './welder-rules.ts';

// Reserve an existing grounded squad anchor. Its wider hull must fit the entire
// machinery sweep as well as the solid geometry before the encounter is selected.
export function welderPair(level: Level) {
  if (level.boss || level.freight || !level.setpiece) return null;
  const lead = level.spawns.findIndex((s) => s.squad?.role === 'lead');
  const source = level.spawns[lead];
  if (!source) return null;
  const support = level.spawns.findIndex(
    (s) => s.squad?.role === 'support' && s.squad.kind === source.squad!.kind,
  );
  if (support < 0) return null;
  const floor = source.y + ENEMY_STATS[source.kind].h / 2;
  const spawn: Spawn = { kind: 'welder', x: source.x, y: floor - 31 };
  const overlaps = (x: number, y: number, w: number, h: number) =>
    spawn.x + 32 > x && spawn.x - 32 < x + w && floor - 1 > y && floor - 65 < y + h;
  if (
    source.x < 350 ||
    source.x > 1680 ||
    level.solids.some((s) => overlaps(s.x, s.y, s.w, s.h)) ||
    level.hazards?.some((h) =>
      overlaps(
        h.x - h.w / 2 - 16,
        h.y - (h.kind === 'lift' ? h.travel : 0) - 16,
        h.w + 32,
        h.h + (h.travel ?? 0) + 32,
      ),
    ) ||
    level.setpiece.props.some((p) => overlaps(p.x - 34, p.y - 50, 68, 100))
  )
    return null;
  return { lead, support, spawn };
}

export function planWelder(seed: string): WelderSave | null {
  const rng = seeded(seed + ':welder-v1');
  if (rng() >= 0.3) return null;
  // No route forks or major bosses: the reservation is independent of choices.
  const stages = [1, 4, 5, 8, 9, 12, 13, 16, 17].filter((stage) =>
    welderPair(getOvertimeLevel(seed, stage, 5)),
  );
  return stages.length
    ? { stage: stages[Math.floor(rng() * stages.length)], status: 'scheduled' }
    : null;
}

export function welderLevel(level: Level, state: WelderSave | null, stage: number): Level {
  if (!state || state.stage !== stage) return level;
  const pair = welderPair(level);
  if (!pair) return level;
  const result = structuredClone(level);
  const remap = new Map<number, number>();
  result.spawns = [];
  level.spawns.forEach((s, i) => {
    if (i === pair.support || (i === pair.lead && state.status !== 'scheduled')) return;
    remap.set(i, result.spawns.length);
    result.spawns.push(i === pair.lead ? pair.spawn : structuredClone(s));
  });
  result.setpiece!.rosters = result.setpiece!.rosters.map((r) =>
    r.flatMap((i) => (remap.has(i) ? [remap.get(i)!] : [])),
  );
  return result;
}

export function welderPracticeLevel(seed: string): Level {
  const plan = planWelder(seed);
  const stage = plan?.stage ?? 1;
  const level = getOvertimeLevel(seed, stage, 5);
  const pair = welderPair(level);
  // Earned records always reconstruct the actual encounter. This fallback only
  // protects old/imported practice records if their seed is no longer available.
  if (!pair)
    return {
      id: 'welder-yard',
      name: 'Welding yard',
      area: 'docks',
      boss: true,
      mirrored: false,
      solids: [],
      route: [],
      spawns: [{ kind: 'welder', x: 1400, y: 709 }],
    };
  return {
    ...level,
    boss: true,
    spawns: [pair.spawn],
    setpiece: { ...level.setpiece!, rosters: [[0]] },
  };
}
