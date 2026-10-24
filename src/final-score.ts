import type { MusicNote } from './music-score.ts';

// One original 128-step phrase; layers enter without restarting at a phase change.
// Short, low lead phrases leave the warning-sound band available to the encounter.
export function finalMusicNotes(
  step: number,
  phase: number,
  overtime: boolean,
  clear: boolean,
): MusicNote[] {
  const n = ((Math.floor(step) % 128) + 128) % 128,
    beat = n % 16,
    bar = Math.floor(n / 16);
  const roots = [38, 38, 34, 36, 38, 41, 36, 33],
    root = roots[bar];
  const notes: MusicNote[] = [];
  const add = (part: MusicNote['part'], velocity: number, duration: number, midi?: number) =>
    notes.push({ part, velocity, duration, ...(midi === undefined ? {} : { midi }) });
  if (clear) {
    if (beat === 0) {
      add('pad', 0.13, 3.8, root + 24);
      add('pad', 0.1, 3.8, root + 31);
    }
    if (n === 12 || n === 76) add('pluck', 0.18, 2.4, 74);
    return notes;
  }
  if (beat === 0) {
    add('hum', 0.2, 3.8, root);
    add('pad', 0.1, 3.4, root + 19);
  }
  if ([0, 8].includes(beat) || (phase >= 1 && beat === 10) || (phase >= 2 && beat === 14))
    add('kick', 0.4, 0.3);
  if ([4, 12].includes(beat)) add('snare', 0.23, 0.2);
  if (beat % 4 === 2 || (phase >= 1 && beat % 4 === 0)) add('tick', 0.12, 0.09);
  const riff = [0, 0, 7, 0, 10, 7, 3, 7];
  if (beat % 2 === 0) add('bass', 0.3, 0.33, root + riff[beat / 2]);
  if (phase >= 1 && beat % 2 === 0) add('drive', 0.17, 0.22, root + 12 + riff[beat / 2]);
  if (phase >= 2 && [1, 5, 9, 13].includes(beat))
    add('pulse', 0.13, 0.28, root + 24 + [0, 7, 10, 7][Math.floor(beat / 4)]);
  if (phase >= 2 && [2, 6, 10, 14].includes(beat))
    add('lead', 0.14, 0.36, root + 36 + [0, 3, 7, 10][Math.floor(beat / 4)]);
  if (overtime && phase >= 1 && [7, 15].includes(beat)) add('snare', 0.14, 0.12);
  return notes;
}
