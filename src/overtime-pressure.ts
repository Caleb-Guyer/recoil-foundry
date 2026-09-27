import type { Spawn } from './levels.ts';
import { areaIndex } from './rules.ts';

export function overtimePressure(stage: number, boss: boolean) {
  const area = areaIndex(stage);
  return {
    deadline: (boss ? [7, 6.5, 7.5, 6.5, 6] : [4.8, 4.2, 4.8, 4.4, 3.8])[area],
    spacing: [0.85, 0.8, 1, 0.9, 1.1][area],
  };
}

// Move one area-appropriate pressure unit into the opening, using its existing
// safe anchor. Preserve elite reserves and authored lead/support partnerships.
export function shapeOvertimeOpening(opening: Spawn[], reserve: Spawn[], stage: number) {
  const kinds = [
    ['charger', 'skimmer'],
    ['hopper', 'charger'],
    ['skimmer', 'sifter'],
    ['scrapper', 'borer'],
    ['sifter', 'skimmer'],
  ][areaIndex(stage)];
  if (opening.some((s) => kinds.includes(s.kind))) return;
  const incoming = reserve.findIndex((s) => kinds.includes(s.kind) && !s.squad && !s.elite);
  const outgoing = opening.findIndex((s) => !s.squad && !s.elite);
  if (incoming >= 0 && outgoing >= 0)
    [opening[outgoing], reserve[incoming]] = [reserve[incoming], opening[outgoing]];
}

// Paired entrances create readable successive threats instead of nine enemies
// arriving together. A squad shares a ticket even when its anchors are apart.
export function overtimeEntryDelays(spawns: Spawn[], spacing: number): number[] {
  const delays = spawns.map(() => -1);
  let ticket = 0;
  for (let i = 0; i < spawns.length; i++) {
    if (delays[i] >= 0) continue;
    const s = spawns[i];
    const partner = spawns.findIndex(
      (other, j) =>
        j !== i &&
        delays[j] < 0 &&
        (s.squad
          ? other.squad?.kind === s.squad.kind && other.squad.role !== s.squad.role
          : !other.squad),
    );
    delays[i] = ticket * spacing;
    if (partner >= 0) delays[partner] = delays[i];
    ticket++;
  }
  return delays;
}
