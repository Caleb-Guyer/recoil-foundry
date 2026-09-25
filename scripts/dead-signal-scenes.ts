import { Game } from '../src/game.ts';
import { seeded, validBuild, type Checkpoint } from '../src/rules.ts';
import { actionInput, recordAction, takeQuality, type ActionFrame } from './trailer-scenes.ts';

export const TEASER_FPS = 60;
export const TEASER_BPM = 112;
export const beatFrame = (beat: number) => Math.round((beat * 60 * TEASER_FPS) / TEASER_BPM);
export const INTRO_BEATS = 6;
export const TITLE_BEAT = 34;
export const TEASER_FRAMES = 1380;
export const templates = [
  {
    name: 'transmission',
    stage: 8,
    mods: ['magnum', 'rapid', 'light', 'kick', 'airshot', 'pierce', 'ricochet', 'leech'],
  },
  {
    name: 'climb',
    stage: 9,
    mods: ['magnum', 'rapid', 'light', 'kick', 'airshot', 'pierce', 'ricochet', 'leech'],
  },
  {
    name: 'orders',
    stage: 10,
    mods: [
      'magnum',
      'rapid',
      'light',
      'kick',
      'pierce',
      'spoof',
      'standing-orders',
      'priority-target',
    ],
  },
  {
    name: 'cross-talk',
    stage: 8,
    mods: ['magnum', 'rapid', 'light', 'scatter', 'spoof', 'cross-talk', 'dead-switch', 'ricochet'],
  },
] as const;
export interface SignalTake {
  name: string;
  stage: number;
  mods: string[];
  seed: string;
  style: number;
  start: number;
  length: number;
  score?: number;
  quality?: ReturnType<typeof takeQuality>;
  layout?: string;
  mirror?: boolean;
  reboots?: number[];
  blueFrames?: number;
}
export function startSignalTake(t: SignalTake) {
  if (!validBuild(t.mods) || t.mods.length > t.stage)
    throw Error(`Invalid capture build ${t.name}`);
  Math.random = seeded(t.seed + ':capture-fx');
  const checkpoint: Checkpoint = {
    version: 6,
    seed: t.seed,
    stage: t.stage,
    hp: 100,
    mods: [...t.mods],
    kills: 0,
    elapsed: 0,
    region: 'annex',
    annexVersion: 5,
  };
  const g = new Game();
  g.startTest(checkpoint);
  if (!g.annex.active || g.enemies.some((e) => e.kind === 'switchboard'))
    throw Error('Spoiler guard');
  return g;
}
export function surveySignalTakes() {
  const results: Record<string, SignalTake[]> = {};
  for (const template of templates) {
    const length = beatFrame(template.name === 'transmission' ? 4 : 8);
    const candidates: SignalTake[] = [];
    for (let index = 0; index < (template.name === 'transmission' ? 80 : 24); index++) {
      const take: SignalTake = {
        ...template,
        mods: [...template.mods],
        seed: `SIGNAL-MEDIA-${template.name}-${index}`,
        style: index % 2,
        start: 0,
        length,
      };
      const g = startSignalTake(take);
      const frames: ActionFrame[] = [],
        reboots: number[] = [],
        blue: boolean[] = [],
        signals: boolean[] = [];
      for (let tick = 0; tick < 1200; tick++) {
        const before = g.spoof.reboots;
        frames.push(recordAction(g, actionInput(g, tick, take.style)));
        if (g.spoof.reboots > before) reboots.push(tick);
        const p = g.player.position;
        blue.push(
          g.factions.allies.some(
            (e) =>
              Math.abs(e.body.position.x - p.x) < 510 && Math.abs(e.body.position.y - p.y) < 330,
          ),
        );
        signals.push(
          g.annex.transmission?.phase === 'charging' && Math.abs(g.annex.junction.x - p.x) < 650,
        );
        if (g.mode !== 'playing' || g.hp < 25 || g.clear) break;
        if (tick < length || tick % 12) continue;
        const start = tick - length + 1,
          sample = frames.slice(start, tick + 1),
          quality = takeQuality(sample);
        const blueFrames = blue.slice(start, tick + 1).filter(Boolean).length;
        const rebootFrames = reboots.filter((at) => at >= start + 20 && at <= tick - 50);
        const signalFrames = signals.slice(start, tick + 1).filter(Boolean).length;
        if (
          quality.blockedFireFrames ||
          quality.visibleFraction < 0.6 ||
          quality.longestQuietFrames > 65 ||
          quality.longestStallFrames > 24 ||
          quality.travel < length * 1.7 ||
          quality.span < 180 ||
          quality.damage < 70
        )
          continue;
        if (template.name === 'transmission' && signalFrames < 30) continue;
        if (
          template.name === 'climb' &&
          Math.max(...sample.map((f) => f.y)) - Math.min(...sample.map((f) => f.y)) < 160
        )
          continue;
        if (
          ['orders', 'cross-talk'].includes(template.name) &&
          (!rebootFrames.length || blueFrames < 90)
        )
          continue;
        candidates.push({
          ...take,
          start,
          quality,
          layout: g.level.id,
          mirror: g.level.mirrored,
          reboots: rebootFrames,
          blueFrames,
          score: sample.reduce((s, f) => s + f.score, 0) + blueFrames * 2 + signalFrames,
        });
      }
    }
    results[template.name] = candidates.sort((a, b) => b.score! - a.score!).slice(0, 12);
    console.log(template.name, results[template.name].length, results[template.name][0]);
  }
  return results;
}
