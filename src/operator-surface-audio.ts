export const OPERATOR_SURFACE_SOUNDS = [
  'operator-step-metal',
  'operator-step-grating',
  'operator-step-coolant',
  'operator-skid-metal',
  'operator-skid-grating',
  'operator-skid-coolant',
  'operator-land-metal',
  'operator-land-grating',
  'operator-land-coolant',
] as const;
export type OperatorSurfaceSound = (typeof OPERATOR_SURFACE_SOUNDS)[number];
export interface OperatorSurfaceRecipe {
  tones: readonly (readonly [number, number, number, number, OscillatorType, number])[];
  noise?: readonly [number, number, number];
}
const recipes: Record<OperatorSurfaceSound, OperatorSurfaceRecipe> = {
  'operator-step-metal': {
    tones: [
      [116, 62, 0.045, 0.017, 'triangle', 0],
      [1270, 710, 0.028, 0.006, 'sine', 0.008],
    ],
  },
  'operator-step-grating': {
    tones: [[435, 245, 0.065, 0.013, 'triangle', 0]],
    noise: [0.024, 0.013, 2450],
  },
  'operator-step-coolant': {
    tones: [[270, 185, 0.04, 0.005, 'sine', 0]],
    noise: [0.055, 0.018, 1540],
  },
  'operator-skid-metal': {
    tones: [[190, 125, 0.075, 0.006, 'triangle', 0]],
    noise: [0.085, 0.017, 1320],
  },
  'operator-skid-grating': {
    tones: [[640, 420, 0.09, 0.007, 'triangle', 0]],
    noise: [0.09, 0.015, 2380],
  },
  'operator-skid-coolant': {
    tones: [[300, 135, 0.07, 0.004, 'sine', 0]],
    noise: [0.1, 0.018, 1760],
  },
  'operator-land-metal': { tones: [[820, 325, 0.055, 0.006, 'sine', 0]] },
  'operator-land-grating': {
    tones: [[470, 205, 0.1, 0.012, 'triangle', 0]],
    noise: [0.04, 0.015, 2000],
  },
  'operator-land-coolant': {
    tones: [[240, 100, 0.08, 0.006, 'sine', 0]],
    noise: [0.11, 0.024, 1150],
  },
};
/** Exact-pitch one-shots; noise reuses the engine's existing prebuilt buffer. */
export function operatorSurfaceAudio(kind: string): OperatorSurfaceRecipe | null {
  return Object.hasOwn(recipes, kind) ? recipes[kind as OperatorSurfaceSound] : null;
}
