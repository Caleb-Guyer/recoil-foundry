import type { MusicNote } from './music-score.ts';

// "Orders After Hours": original eight-bar D-minor theme, 112 BPM.
// The final dominant turns back into the opening; a second phrase changes the
// melody instead of continuously filling every subdivision with an arpeggio.
const ROOTS = [38, 34, 41, 36, 38, 34, 43, 45];
const CHORDS = [
  [62, 65, 69],
  [58, 62, 65],
  [60, 65, 69],
  [60, 64, 67],
  [62, 65, 69],
  [58, 62, 65],
  [62, 67, 70],
  [61, 64, 69],
];
// Sixteenth, pitch, duration in beats. The first falling answer returns later.
const MELODY = [
  [0, 74, 0.75],
  [6, 69, 0.5],
  [10, 77, 0.75],
  [18, 74, 1],
  [26, 70, 1.25],
  [34, 72, 0.75],
  [40, 69, 1.25],
  [50, 76, 0.5],
  [54, 74, 0.5],
  [58, 72, 1],
  [64, 74, 0.75],
  [70, 69, 0.5],
  [74, 77, 1],
  [82, 81, 1.25],
  [90, 77, 0.75],
  [98, 79, 1],
  [106, 74, 1.25],
  [114, 73, 0.5],
  [118, 76, 0.5],
  [122, 69, 1.25],
];

export function annexMusicNotes(
  step: number,
  intensity: number,
  boss: boolean,
  clear: boolean,
  bossPhase = 0,
): MusicNote[] {
  const position = ((Math.floor(step) % 128) + 128) % 128;
  const bar = Math.floor(position / 16),
    beat = position % 16;
  const root = ROOTS[bar],
    chord = CHORDS[bar];
  const notes: MusicNote[] = [];
  const add = (part: MusicNote['part'], velocity: number, duration: number, midi?: number) =>
    notes.push({ part, velocity, duration, ...(midi === undefined ? {} : { midi }) });
  // A single bar of machinery and melody on entry, never replayed at loop points.
  const entry = step >= 0 && step < 16;
  const pressure = clear || entry ? 0 : Math.max(intensity, boss ? 0.72 : 0);
  if (beat === 0) {
    add('hum', clear ? 0.19 : 0.14, 3.95, root);
    add('pad', 0.12, 3.8, chord[0]);
    add('pad', 0.08, 3.8, chord[2]);
  }
  if (clear) {
    if (bar % 2 === 0 && beat === 10) add('pulse', 0.12, 1.5, chord[1]);
    return notes;
  }
  if ([0, 6, 10].includes(beat)) add('pulse', 0.18, 0.5, chord[beat === 6 ? 2 : 0]);
  const motif = MELODY.find(([at]) => at === position);
  if (motif)
    add(boss && !entry ? 'lead' : 'pluck', boss && !entry ? 0.26 : 0.21, motif[2], motif[1]);
  if (pressure < 0.24) return notes;

  // Muted eighth-note bass, a backbeat, and a few displaced kick accents.
  if ([0, 2, 6, 8, 10, 14].includes(beat))
    add('drive', 0.29 + pressure * 0.09, beat === 14 ? 0.42 : 0.3, root + (beat === 10 ? 12 : 0));
  if ([0, 8].includes(beat) || (pressure > 0.65 && [6, 14].includes(beat)))
    add('kick', 0.32 + pressure * 0.1, 0.32);
  if ([4, 12].includes(beat)) add('snare', 0.25 + pressure * 0.07, 0.28);
  if ([2, 6, 10, 14].includes(beat)) add('tick', 0.11 + pressure * 0.05, 0.1);
  if (boss && bossPhase > 0) {
    // Answer the same theme in phase two; keep its tempo and harmonic position.
    if ([3, 11].includes(beat)) add('lead', 0.17, 0.45, chord[beat === 3 ? 1 : 2] + 12);
    if (bar % 2 === 1 && beat === 15) add('snare', 0.18, 0.15);
  }
  return notes;
}
