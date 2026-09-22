import {
  actionInput,
  recordAction,
  startTake,
  takeQuality,
  usableAction,
  type Take,
  type ActionFrame,
} from './trailer-scenes.ts';

export interface Beat {
  beat: number;
  frame: number;
  sourceSeconds: number;
  strength: number;
  frameErrorMs: number;
}
export interface ClosingMusic {
  spliceFrame: number;
  sourceIn: number;
  sourceOut: number;
  crossfadeSeconds: number;
  titleFrame: number;
  subtitleFrame: number;
  titleSourceSeconds: number;
  subtitleSourceSeconds: number;
  titleFrameErrorMs: number;
  subtitleFrameErrorMs: number;
  method: string;
}
export const MONTAGE = [
  ['recoil', 0, 0, 4],
  ['scatter', 0, 4, 8],
  ['prism', 0, 8, 12],
  ['pinwheel', 0, 12, 16],
  ['turf', 0, 16, 20],
  ['saw', 2, 20, 24],
  ['cluster', 1, 24, 28],
  ['storm', 0, 28, 32],
  ['loader', 0, 32, 36],
  ['cluster', 0, 36, 40],
  ['scatter', 2, 40, 42],
  ['prism', 1, 42, 43],
  ['turf', 1, 43, 44],
  ['saw', 1, 44, 45],
  ['pinwheel', 2, 45, 46],
  ['cluster', 2, 46, 48],
] as const;
export interface SyncPoint {
  output: number;
  source: number;
  kind: string;
  beat?: number;
}
export interface EditShot {
  take: Take;
  fromBeat: number;
  toBeat: number;
  start: number;
  end: number;
  points: SyncPoint[];
  score: number;
}
const weights: Record<string, number> = {
  'shell-shot': 9,
  heavy: 9,
  scatter: 9,
  shot: 8,
  charged: 10,
  'mass-shot': 10,
  explode: 12,
  kill: 11,
  break: 7,
  'beam-start': 10,
  'beam-hit': 7,
};
interface Moment {
  tick: number;
  kind: string;
  weight: number;
}

export function planEdit(takes: Record<string, Take[]>, beats: Beat[]): EditShot[] {
  const cache = new Map<string, { frames: ActionFrame[]; moments: Moment[] }>();
  const used: { seed: string; start: number; end: number }[] = [];
  return MONTAGE.map(([name, preferred, fromBeat, toBeat]) => {
    const start = beats[fromBeat].frame,
      end = beats[toBeat].frame,
      len = end - start;
    const choices: EditShot[] = [];
    const options = [takes[name][preferred], ...takes[name].filter((_, n) => n !== preferred)];
    for (const take of options) {
      const key = `${take.seed}:${take.style}`;
      let history = cache.get(key);
      if (!history) {
        const g = startTake(take);
        const frames: ActionFrame[] = [],
          moments: Moment[] = [];
        let kinds: string[] = [];
        g.onSound = (kind) => kinds.push(kind);
        for (
          let tick = 0;
          tick <
          Math.max(...takes[name].filter((x) => x.seed === take.seed).map((x) => x.start)) + 240;
          tick++
        ) {
          const wasTorch = g.torch.active;
          kinds = [];
          const metric = recordAction(g, actionInput(g, tick, take.style));
          if (g.mode !== 'playing' || g.clear || g.hp < 15) break;
          frames.push(metric);
          if (g.torch.active && !wasTorch) kinds.push('beam-start');
          if (g.torch.active && metric.damage > 2) kinds.push('beam-hit');
          const kind = kinds.filter((k) => weights[k]).sort((a, b) => weights[b] - weights[a])[0];
          if (kind && metric.visible)
            moments.push({ tick, kind, weight: weights[kind] + Math.min(4, metric.damage / 20) });
        }
        history = { frames, moments };
        cache.set(key, history);
      }
      const { frames, moments } = history;
      for (const first of moments.filter((m) => Math.abs(m.tick - take.start) <= 42)) {
        const sourceStart = first.tick;
        if (
          sourceStart + len > frames.length ||
          used.some(
            (u) =>
              u.seed === take.seed && sourceStart < u.end + 12 && sourceStart + len > u.start - 12,
          )
        )
          continue;
        const visibleLength = len;
        const clip = frames.slice(sourceStart, sourceStart + visibleLength),
          quality = takeQuality(clip);
        if (!usableAction(quality, visibleLength)) continue;
        const points: SyncPoint[] = [{ output: 0, source: 0, kind: first.kind, beat: fromBeat }];
        let strength = first.weight;
        for (let b = fromBeat + 1; b < toBeat; b++) {
          const output = beats[b].frame - start;
          const previous = points.at(-1)!;
          const candidates = moments
            .filter((m) => {
              const source = m.tick - sourceStart;
              const rate = (source - previous.source) / (output - previous.output);
              const tail = (len - 1 - source) / (len - 1 - output);
              return (
                Math.abs(source - output) <= 16 &&
                source > previous.source &&
                rate >= 0.8 &&
                rate <= 1.2 &&
                tail >= 0.8 &&
                tail <= 1.2
              );
            })
            .sort(
              (a, b) =>
                b.weight -
                Math.abs(b.tick - sourceStart - output) * 0.18 -
                (a.weight - Math.abs(a.tick - sourceStart - output) * 0.18),
            );
          if (candidates[0]) {
            const moment = candidates[0];
            points.push({ output, source: moment.tick - sourceStart, kind: moment.kind, beat: b });
            strength += moment.weight;
          }
        }
        if (len > 100 && points.length < 2) continue;
        points.push({ output: len - 1, source: len - 1, kind: 'end' });
        const score =
          clip.reduce((s, f) => s + f.score, 0) / visibleLength +
          strength * 0.5 +
          (take === takes[name][preferred] ? 1 : 0) -
          Math.abs(sourceStart - take.start) * 0.025;
        choices.push({
          take: { ...take, start: sourceStart, length: len, quality },
          fromBeat,
          toBeat,
          start,
          end,
          points,
          score,
        });
      }
    }
    choices.sort((a, b) => b.score - a.score);
    if (!choices[0])
      throw new Error(`No visible, moving beat-synced take for ${name} at beat ${fromBeat}`);
    const choice = choices[0];
    used.push({ seed: choice.take.seed, start: choice.take.start, end: choice.take.start + len });
    console.log(
      `${name}: ${choice.take.seed} @${choice.take.start}; ${choice.points.length - 1} synced moments`,
    );
    return choice;
  });
}

// Monotone cubic interpolation gently changes playback speed between real impacts.
export function sourceFrame(points: SyncPoint[], output: number) {
  const index = Math.max(0, points.findIndex((p) => p.output >= output) - 1);
  const a = points[index],
    b = points[Math.min(index + 1, points.length - 1)];
  if (output >= points.at(-1)!.output) return points.at(-1)!.source;
  const slope = (i: number) =>
    (points[i + 1].source - points[i].source) / (points[i + 1].output - points[i].output);
  const secant = slope(index);
  const m0 = index ? 2 / (1 / slope(index - 1) + 1 / secant) : secant;
  const m1 = index + 2 < points.length ? 2 / (1 / secant + 1 / slope(index + 1)) : secant;
  const width = b.output - a.output,
    t = (output - a.output) / width;
  return (
    (2 * t * t * t - 3 * t * t + 1) * a.source +
    (t * t * t - 2 * t * t + t) * width * m0 +
    (-2 * t * t * t + 3 * t * t) * b.source +
    (t * t * t - t * t) * width * m1
  );
}
