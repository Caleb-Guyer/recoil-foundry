import type { Game, Mode } from './game.ts';
import type { AreaId } from './areas.ts';
import { isBoss } from './enemies.ts';

export interface MusicScene {
  area: AreaId;
  room: string;
  mode: Mode;
  intensity: number;
  boss: boolean;
  clear: boolean;
}

export interface MusicNote {
  part: 'kick' | 'tick' | 'snare' | 'bass' | 'pad' | 'pluck';
  midi?: number;
  velocity: number;
  duration: number;
}

export const MUSIC_PROFILES: Record<AreaId, { bpm: number }> = {
  docks: { bpm: 88 },
  furnace: { bpm: 104 },
  rooftops: { bpm: 118 },
};

const unit = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0);

export function musicScene(game: Game): MusicScene {
  const alive = game.enemies.filter((enemy) => enemy.hp > 0);
  const boss = alive.some((enemy) => isBoss(enemy.kind));
  const clear = game.clear || alive.length === 0;
  let intensity = 0;
  if (game.mode === 'playing' && !clear) {
    let nearest = 0;
    let crowd = 0;
    let attacks = 0;
    for (const enemy of alive) {
      const distance = Math.hypot(
        enemy.body.position.x - game.player.position.x,
        enemy.body.position.y - game.player.position.y,
      );
      const proximity = unit(1 - distance / 850);
      nearest = Math.max(nearest, proximity);
      crowd += proximity;
      if (['windup', 'rush', 'followup', 'airborne'].includes(enemy.state)) {
        attacks += 0.4 + proximity * 0.6;
      }
    }
    const shotAge = game.time - game.lastShot;
    const firing = shotAge >= 0 && shotAge < 0.45 ? (1 - shotAge / 0.45) * 0.08 : 0;
    intensity = unit(
      nearest * 0.42 +
        Math.min(0.28, crowd * 0.1) +
        Math.min(0.24, attacks * 0.12) +
        firing +
        (boss ? 0.14 : 0),
    );
  }
  return {
    area: game.level.area,
    room: game.seed + ':' + game.stage,
    mode: game.mode,
    intensity,
    boss,
    clear,
  };
}

type Phrase = { roots: number[]; chords: number[][]; motif: [number, number, number][] };
// Four-bar phrases: sustained harmony, short answers, and deliberate empty beats.
// Motif entries are [sixteenth within the phrase, MIDI pitch, duration in beats].
const PHRASES: Record<AreaId, Phrase> = {
  docks: {
    roots: [38, 38, 34, 36],
    chords: [
      [62, 65, 69],
      [62, 65, 69],
      [58, 62, 65],
      [60, 64, 67],
    ],
    motif: [
      [2, 74, 0.5],
      [11, 69, 0.75],
      [22, 72, 0.5],
      [31, 65, 1],
      [38, 70, 0.75],
      [47, 65, 0.5],
      [54, 67, 0.5],
      [60, 64, 0.75],
    ],
  },
  furnace: {
    roots: [40, 36, 43, 38],
    chords: [
      [64, 67, 71],
      [60, 64, 67],
      [67, 71, 74],
      [62, 66, 69],
    ],
    motif: [
      [6, 67, 0.5],
      [13, 64, 0.25],
      [24, 64, 0.5],
      [30, 67, 0.5],
      [37, 71, 0.75],
      [46, 67, 0.25],
      [54, 69, 0.5],
      [61, 66, 0.75],
    ],
  },
  rooftops: {
    roots: [45, 41, 48, 43],
    chords: [
      [69, 72, 76],
      [65, 69, 72],
      [67, 72, 76],
      [67, 71, 74],
    ],
    motif: [
      [9, 81, 0.75],
      [18, 76, 1.25],
      [29, 79, 0.5],
      [41, 77, 1],
      [50, 76, 0.75],
      [61, 74, 1.5],
    ],
  },
};

export function musicNotes(
  area: AreaId,
  step: number,
  intensity: number,
  boss: boolean,
  clear: boolean,
): MusicNote[] {
  if (!Number.isFinite(step)) return [];
  const position = ((Math.floor(step) % 64) + 64) % 64;
  const bar = Math.floor(position / 16);
  const beat = position % 16;
  const phrase = PHRASES[area];
  const chord = phrase.chords[bar];
  const root = phrase.roots[bar];
  const notes: MusicNote[] = [];
  const weight = area === 'rooftops' ? 0.7 : area === 'docks' ? 0.85 : 1;
  const add = (part: MusicNote['part'], velocity: number, duration: number, midi?: number) => {
    notes.push({
      part,
      ...(midi === undefined ? {} : { midi }),
      velocity: unit(velocity * weight),
      duration,
    });
  };

  if (clear) {
    if (beat === 0) {
      add('pad', 0.12, 3.75, chord[0]);
      add('pad', 0.09, 3.75, chord[2]);
    }
    if (position === 12 || position === 44) add('pluck', 0.13, 1.5, chord[1] + 12);
    return notes;
  }

  const pressure = Math.max(unit(intensity), boss ? 0.68 : 0);
  if (beat === 0) {
    for (const pitch of chord) add('pad', 0.12, 3.6, pitch);
    if (area !== 'rooftops' || bar % 2 === 0 || pressure > 0.55)
      add('bass', 0.32 + pressure * 0.12, 1.6, root);
  }
  const kick =
    area === 'furnace'
      ? beat === 0 || beat === 8 || (bar % 2 === 1 && beat === 6)
      : area === 'docks'
        ? beat === 0 || (bar % 2 === 0 && beat === 8)
        : bar % 2 === 0 && (beat === 0 || beat === 10);
  if (kick || (pressure > 0.6 && beat === 10) || (boss && beat === 14))
    add('kick', 0.3 + pressure * 0.15, 0.35);
  const tick =
    area === 'furnace'
      ? [2, 6, 10, 14].includes(beat)
      : [6, 14].includes(beat) && (area !== 'rooftops' || bar % 2 === 1);
  if (
    tick ||
    (pressure > 0.45 && [3, 11].includes(beat)) ||
    (pressure > 0.8 && [7, 15].includes(beat))
  ) {
    add('tick', 0.12 + pressure * 0.06, 0.12);
  }
  if (
    (area === 'furnace' && [4, 12].includes(beat)) ||
    (beat === 12 && (bar % 2 === 1 || pressure > 0.45))
  ) {
    add('snare', 0.18 + pressure * 0.1, 0.25);
  }
  if (boss && bar % 2 === 1 && beat === 15) add('snare', 0.15, 0.15);
  if ((area === 'furnace' && pressure > 0.25 && beat === 6) || (pressure > 0.65 && beat === 10)) {
    add('bass', 0.26 + pressure * 0.1, 0.55, root + (beat === 10 ? 7 : 0));
  }
  const motif = phrase.motif.find(([at]) => at === position);
  if (motif) add('pluck', 0.19 + pressure * 0.04, motif[2], motif[1]);
  return notes;
}
