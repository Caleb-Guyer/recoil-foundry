// The seed owns this encounter revision. Earlier saves and pinned Dailies
// reconstruct the wave schedule they were started with.
export const combatFlowSeed = (seed: string) => Number(/^RF-C(\d+)-/.exec(seed)?.[1] ?? 0) >= 99;

export interface CombatFlowSpec {
  room: string;
  variant: 0 | 1 | 2;
  // The first cohort is present on entry. Later cohorts use complete door tells.
  beats: number[][];
  rest: number;
  deadline: number;
  cap: number;
  overlap?: number;
}

export function validCombatFlowSpec(value: unknown, count: number): value is CombatFlowSpec {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const spec = value as Record<string, unknown>;
  if (
    !Object.keys(spec).every((key) =>
      ['room', 'variant', 'beats', 'rest', 'deadline', 'cap', 'overlap'].includes(key),
    ) ||
    typeof spec.room !== 'string' ||
    !/^[a-z][a-z-]{0,47}$/.test(spec.room) ||
    ![0, 1, 2].includes(Number(spec.variant)) ||
    typeof spec.variant !== 'number' ||
    !Array.isArray(spec.beats) ||
    spec.beats.length !== 3 ||
    !Number.isInteger(count) ||
    count < 3 ||
    count > 12 ||
    typeof spec.rest !== 'number' ||
    !Number.isFinite(spec.rest) ||
    spec.rest < 0.6 ||
    spec.rest > 2.5 ||
    typeof spec.deadline !== 'number' ||
    !Number.isFinite(spec.deadline) ||
    spec.deadline < 4 ||
    spec.deadline > 16 ||
    typeof spec.cap !== 'number' ||
    !Number.isInteger(spec.cap) ||
    spec.cap < 2 ||
    spec.cap > 6 ||
    (spec.overlap !== undefined && spec.overlap !== 0 && spec.overlap !== 1)
  )
    return false;
  const seen = new Set<number>();
  for (const beat of spec.beats) {
    if (!Array.isArray(beat) || beat.length < 1 || beat.length > spec.cap) return false;
    for (const index of beat) {
      if (!Number.isInteger(index) || index < 0 || index >= count || seen.has(index)) return false;
      seen.add(index);
    }
  }
  return seen.size === count;
}
