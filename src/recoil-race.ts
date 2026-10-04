import type { RecoilTrials } from './recoil-trials.ts';
import type { RecoilTrialResult } from './recoil-trial-rules.ts';
import {
  GHOST_DURATION,
  GHOST_FRAME_LIMIT,
  RECOIL_RACE_RULES,
  RECOIL_SPLITS,
  validRecoilGhost,
  validRecoilChallenge,
  recoilChallenge,
  ghostFrameAt,
  type GhostFrame,
  type RecoilGhost,
  type RecoilChallenge,
} from './recoil-race-rules.ts';

export class RecoilRace {
  trial: RecoilTrials;
  ghost: RecoilGhost | null = null;
  target: RecoilChallenge | null = null;
  challenge: RecoilChallenge | null = null;
  showGhost = true;
  frames: GhostFrame[] = [];
  splits: number[] = [];
  recording: RecoilGhost | null = null;
  feedback: { index: number; deltaMs: number; until: number } | null = null;
  private progress = 0;
  private attempts = 0;
  private overflow = false;
  constructor(trial: RecoilTrials) {
    this.trial = trial;
  }
  reset() {
    this.ghost = this.target = this.challenge = this.recording = null;
    this.frames = [];
    this.splits = [];
    this.feedback = null;
    this.progress = this.attempts = 0;
    this.overflow = false;
  }
  begin(ghost: RecoilGhost | null, challenge: RecoilChallenge | null, showGhost: boolean) {
    this.reset();
    const t = this.trial;
    if (!t.practice || !t.active || t.game.mods.length) return;
    const same = (v: RecoilChallenge) => v.kind === t.kind && v.gun === t.game.startingGun;
    this.ghost = ghost && validRecoilGhost(ghost) && same(ghost) ? structuredClone(ghost) : null;
    this.challenge =
      challenge && validRecoilChallenge(challenge) && same(challenge)
        ? structuredClone(challenge)
        : null;
    this.target = this.challenge ?? (showGhost && this.ghost ? recoilChallenge(this.ghost) : null);
    this.showGhost = showGhost;
    this.sample(0, false);
  }
  private sample(ms: number, reset: boolean) {
    if (this.overflow) return;
    if (ms > GHOST_DURATION || this.frames.length >= GHOST_FRAME_LIMIT - 1) {
      this.overflow = true;
      this.frames = [];
      return;
    }
    const g = this.trial.game,
      p = g.player.position,
      angle = Math.round((Math.atan2(g.aim.y - p.y, g.aim.x - p.x) * 180) / Math.PI),
      flags =
        (g.grounded ? 0 : 1) |
        (Math.cos((angle * Math.PI) / 180) < 0 ? 2 : 0) |
        (g.time - g.lastShot < 0.15 ? 4 : 0) |
        (reset ? 8 : 0);
    const f: GhostFrame = [ms, Math.round(p.x), Math.round(p.y), angle, flags];
    if (this.frames.at(-1)?.[0] === ms) this.frames[this.frames.length - 1] = f;
    else this.frames.push(f);
  }
  afterStep() {
    const t = this.trial;
    if (!t.practice || !t.active || t.game.mode !== 'playing' || t.game.clear) return;
    const ms = t.timeMs,
      reset = this.attempts !== t.attempts,
      progress = t.kind === 'airborne' ? t.targets.filter((e) => e.hp <= 0).length : t.waypoint;
    if (reset || progress < this.progress) {
      this.splits = [];
      this.progress = 0;
      this.feedback = null;
    }
    while (this.progress < progress) {
      const index = this.progress++;
      this.splits.push(ms);
      if (this.target)
        this.feedback = { index, deltaMs: ms - this.target.splits[index], until: ms + 1800 };
    }
    if (reset || ms - (this.frames.at(-1)?.[0] ?? -100) >= 100) this.sample(ms, reset);
    this.attempts = t.attempts;
  }
  completed(result: RecoilTrialResult) {
    if (
      !this.trial.practice ||
      result.mods.length ||
      this.recording ||
      this.overflow ||
      this.splits.length !== RECOIL_SPLITS[result.kind]
    )
      return;
    this.sample(result.timeMs, false);
    const ghost: RecoilGhost = {
      rules: RECOIL_RACE_RULES,
      kind: result.kind,
      gun: result.gun,
      timeMs: result.timeMs,
      shots: result.shots,
      splits: [...this.splits],
      frames: this.frames.map((f) => [...f]),
    };
    if (validRecoilGhost(ghost)) this.recording = ghost;
  }
  get frame() {
    const t = this.trial;
    return t.practice &&
      t.active &&
      ['playing', 'paused'].includes(t.game.mode) &&
      this.showGhost &&
      this.ghost
      ? ghostFrameAt(this.ghost, t.timeMs)
      : null;
  }
  get score(): RecoilChallenge | null {
    const r = this.trial.result;
    if (!this.trial.practice || !r) return null;
    const score = {
      rules: RECOIL_RACE_RULES,
      kind: r.kind,
      gun: r.gun,
      timeMs: r.timeMs,
      shots: r.shots,
      splits: [...this.splits],
    };
    return validRecoilChallenge(score) ? score : null;
  }
  get split() {
    return (this.showGhost || this.challenge) &&
      this.feedback &&
      this.trial.timeMs <= this.feedback.until
      ? this.feedback
      : null;
  }
}
