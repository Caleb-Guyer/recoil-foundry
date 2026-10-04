import type { Level } from './levels.ts';
import { RECOIL_TRIALS, type RecoilTrialKind } from './recoil-trial-rules.ts';

export const TRIAL_TOP = -620;
export const trialEntry = (kind: RecoilTrialKind) =>
  kind === 'launch'
    ? { x: 1000, y: 720 }
    : kind === 'cargo'
      ? { x: 170, y: 622 }
      : { x: 420, y: 642 };
export const trialExit = (kind: RecoilTrialKind) =>
  kind === 'launch'
    ? { x: 1200, floor: -120 }
    : kind === 'cargo'
      ? { x: 1810, floor: 540 }
      : { x: 1720, floor: 660 };
export const AIR_TARGETS = [
  { x: 780, y: 455 },
  { x: 1080, y: 365 },
  { x: 1370, y: 455 },
];
export function recoilTrialLevel(kind: RecoilTrialKind): Level {
  const l: Level = {
    id: 'recoil-trial-' + kind,
    name: RECOIL_TRIALS[kind].name,
    recoilTrial: kind,
    detour: true,
    area: kind === 'launch' ? 'furnace' : kind === 'cargo' ? 'docks' : 'rooftops',
    mirrored: false,
    boss: false,
    solids: [],
    route: [],
    spawns: [],
    hazards: [],
    setpiece: { rosters: [[]], props: [], cargo: [], weak: [] },
  };
  if (kind === 'launch') {
    l.solids.push(
      { x: 0, y: TRIAL_TOP, w: 650, h: 1360 },
      { x: 1350, y: TRIAL_TOP, w: 650, h: 1360 },
    );
    for (let i = 0; i < 6; i++) {
      const left = i % 2 === 0,
        y = 580 - i * 140;
      l.solids.push({ x: left ? 650 : 1110, y, w: 240, h: 22 });
      l.route.push({ x: left ? 790 : 1200, y: y - 18 });
      if (i < 5)
        l.hazards!.push({
          kind: 'crusher',
          x: left ? 850 : 1150,
          y: y - 170,
          w: 70,
          h: 24,
          travel: 146,
        });
    }
  } else if (kind === 'cargo') {
    l.solids.push({ x: 0, y: 640, w: 320, h: 100 }, { x: 1660, y: 540, w: 340, h: 200 });
    for (let i = 0; i < 5; i++) {
      const x = 480 + i * 260;
      l.hazards!.push({ kind: 'lift', x, y: 560, w: 146, h: 24, travel: 130 });
      l.route.push({ x, y: 412 });
    }
  } else {
    l.solids.push({ x: 280, y: 660, w: 290, h: 80 }, { x: 1560, y: 660, w: 440, h: 80 });
    l.route.push(...AIR_TARGETS);
  }
  return l;
}
