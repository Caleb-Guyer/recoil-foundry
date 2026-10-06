import type { Gun } from './rules.ts';

export interface TorchRay {
  angle: number;
  power: number;
}

export const torchRayCount = (gun: Gun, mods: readonly string[]) =>
  gun.pellets * gun.lanes * (mods.includes('prism-array') ? 2 : 1);

// A pellet stays a ray after conversion. Prism splits each pellet, rather than
// replacing the entire spread. The aimed lane comes first for Thermal Runaway.
export function torchPattern(gun: Gun, mods: readonly string[], discharge: number): TorchRay[] {
  const prism = mods.includes('prism-array');
  const lanes = Array.from({ length: gun.lanes }, (_, i) => i).sort(
    (a, b) => Math.abs(a - (gun.lanes - 1) / 2) - Math.abs(b - (gun.lanes - 1) / 2),
  );
  const pellets = Array.from({ length: gun.pellets }, (_, i) => i).sort(
    (a, b) => Math.abs(a - (gun.pellets - 1) / 2) - Math.abs(b - (gun.pellets - 1) / 2),
  );
  const laneSpread = mods.includes('pinwheel')
    ? 0.12 + (Math.sin((discharge * Math.PI) / 4) + 1) * 0.2
    : 0.22;
  return lanes.flatMap((lane) =>
    pellets.flatMap((pellet) =>
      (prism ? [-0.09, 0.09] : [0]).map((split) => ({
        angle:
          (lane - (gun.lanes - 1) / 2) * laneSpread +
          (pellet - (gun.pellets - 1) / 2) * gun.spread +
          split,
        power: (prism ? 0.6 : 1) / gun.pellets,
      })),
    ),
  );
}
