import type { Gun } from './rules.ts';

export interface TorchRay {
  angle: number;
  power: number;
}

export const BEAM_PATTERN_RULESET = 87;
export function legacyTorchPattern(seed?: string) {
  const daily = /^RF-D(\d+)-/.exec(seed ?? '');
  return !!daily && Number(daily[1]) < BEAM_PATTERN_RULESET;
}
export const torchRayCount = (gun: Gun, mods: readonly string[], seed?: string) =>
  (legacyTorchPattern(seed) ? 1 : gun.pellets * gun.lanes) * (mods.includes('prism-array') ? 2 : 1);

// Keep every pellet as a visible ray, while preserving an effective aimed core.
// The remaining energy fans out; adding spread never starves the center beam.
export function torchPattern(gun: Gun, mods: readonly string[], discharge: number): TorchRay[] {
  const prism = mods.includes('prism-array');
  const lanes = Array.from({ length: gun.lanes }, (_, i) => i).sort(
    (a, b) => Math.abs(a - (gun.lanes - 1) / 2) - Math.abs(b - (gun.lanes - 1) / 2),
  );
  const angles = Array.from({ length: gun.pellets }, (_, i) => i)
    .flatMap((pellet) =>
      (prism ? [-0.09, 0.09] : [0]).map(
        (split) => (pellet - (gun.pellets - 1) / 2) * gun.spread + split,
      ),
    )
    .sort((a, b) => Math.abs(a) - Math.abs(b));
  const core = Math.min(angles.length, prism || gun.pellets % 2 === 0 ? 2 : 1);
  const budget = prism ? 1.2 : 1;
  const laneSpread = mods.includes('pinwheel')
    ? 0.12 + (Math.sin((discharge * Math.PI) / 4) + 1) * 0.2
    : 0.22;
  return lanes.flatMap((lane) =>
    angles.map((angle, i) => ({
      angle: (lane - (gun.lanes - 1) / 2) * laneSpread + angle,
      power:
        budget *
        (angles.length === core ? 1 / core : i < core ? 0.8 / core : 0.2 / (angles.length - core)),
    })),
  );
}
