import type { Game } from './game.ts';
import type { CombatResults } from './combat-report.ts';
import type { Level } from './levels.ts';
import { combatFlowRoomLevel } from './combat-flow-rooms.ts';
import { FIRST_SHIFT_ARENAS } from './first-shift-layout.ts';
import { loadCheckpoint, type Checkpoint } from './rules.ts';
import { isStartingGun, type StartingGun } from './starting-guns.ts';
import {
  QUICK_SHIFT_DRAFT_STAGES,
  quickShiftOffers,
  quickShiftRuntimeSeed,
  planQuickShift,
  validQuickShiftChallenge,
  validQuickShiftRecord,
  isQuickShiftRoute,
  type QuickShiftChallenge,
  type QuickShiftRecord,
  type QuickShiftRoute,
  type QuickShiftRules,
} from './quick-shift-rules.ts';

export const QUICK_SHIFT_CONTINUE_KEY = 'rf-quick-shift-continue-v1';
export const QUICK_SHIFT_JOB_SECONDS = 45;
export type QuickShiftPhase = 'draft' | 'route' | 'job' | 'fight' | 'complete' | 'dead';
export type QuickShiftJobState = 'accepted' | 'skipped' | 'complete' | 'failed' | null;
export interface QuickShiftState {
  challenge: QuickShiftChallenge;
  gun: StartingGun;
  preview: boolean;
  phase: QuickShiftPhase;
  round: number;
  cleared: number;
  mods: string[];
  hp: number;
  timeMs: number;
  kills: number;
  hits: number;
  shots: number;
  offers: string[];
  draftRemaining: number;
  selectedRoute: QuickShiftRoute | null;
  job: QuickShiftJobState;
  roomTimeMs: number;
  roomHits: number;
}
export interface QuickShiftContinue {
  version: 1;
  rules: QuickShiftRules;
  state: Omit<QuickShiftState, 'offers' | 'preview'>;
  /** Combat resumes at this room's entry; no arbitrary world/room is serialized. */
  checkpoint: Checkpoint;
}
const plain = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown, min: number, max: number): v is number =>
  Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max;
const keys = (v: Record<string, unknown>, list: readonly string[]) =>
  Object.keys(v).length === list.length && Object.keys(v).every((key) => list.includes(key));
const totalPicks = (round: number) => 3 + round * 2;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Validate the entire acquisition history, including the exact seeded choices. */
function draftedBuild(s: Pick<QuickShiftState, 'challenge' | 'gun' | 'mods'>) {
  if (!Array.isArray(s.mods) || s.mods.length > 11) return false;
  const acquired: string[] = [];
  for (let i = 0; i < s.mods.length; i++) {
    const completed = i < 3 ? 0 : Math.floor((i - 3) / 2) + 1;
    const pick = i < 3 ? i : (i - 3) % 2;
    if (!quickShiftOffers(s.challenge, acquired, completed, s.gun, pick).includes(s.mods[i]))
      return false;
    acquired.push(s.mods[i]);
  }
  return true;
}
/** Separate storage accepts only safe, reproducible Quick Shift room entries. */
export function validQuickShiftContinue(value: unknown): value is QuickShiftContinue {
  if (
    !plain(value) ||
    !keys(value, ['version', 'rules', 'state', 'checkpoint']) ||
    value.version !== 1 ||
    (value.rules !== 1 && value.rules !== 2) ||
    !plain(value.state)
  )
    return false;
  const s = value.state;
  if (
    !keys(s, [
      'challenge',
      'gun',
      'phase',
      'round',
      'cleared',
      'mods',
      'hp',
      'timeMs',
      'kills',
      'hits',
      'shots',
      'draftRemaining',
      'selectedRoute',
      'job',
      'roomTimeMs',
      'roomHits',
    ]) ||
    !validQuickShiftChallenge(s.challenge) ||
    value.rules !== s.challenge.rules ||
    !isStartingGun(s.gun) ||
    !['draft', 'route', 'job', 'fight'].includes(String(s.phase)) ||
    !integer(s.round, 0, 4) ||
    s.cleared !== s.round ||
    typeof s.hp !== 'number' ||
    !Number.isFinite(s.hp) ||
    s.hp <= 0 ||
    s.hp > 100 ||
    !integer(s.timeMs, 0, 86400000) ||
    !integer(s.kills, 0, 100000) ||
    !integer(s.hits, 0, 100000) ||
    !integer(s.shots, 0, 1000000) ||
    !integer(s.roomTimeMs, 0, 86400000) ||
    s.roomTimeMs > s.timeMs ||
    !integer(s.roomHits, 0, 100000) ||
    s.roomHits > s.hits ||
    !integer(s.draftRemaining, 0, 3) ||
    (s.selectedRoute !== null && !isQuickShiftRoute(s.selectedRoute)) ||
    ![null, 'accepted', 'skipped', 'complete', 'failed'].includes(s.job as null) ||
    !draftedBuild(s as unknown as QuickShiftState)
  )
    return false;
  const state = s as unknown as QuickShiftState;
  if (state.phase === 'draft') {
    const budget = state.round === 0 ? 3 : 2;
    if (
      state.draftRemaining < 1 ||
      state.draftRemaining > budget ||
      state.mods.length !== totalPicks(state.round) - state.draftRemaining
    )
      return false;
  } else if (state.draftRemaining !== 0 || state.mods.length !== totalPicks(state.round))
    return false;
  if (state.round === 0 && state.selectedRoute !== null) return false;
  if (state.round > 1 && state.selectedRoute === null) return false;
  if (state.round === 1 && state.phase === 'fight' && state.selectedRoute === null) return false;
  if (state.phase === 'route' && (state.round !== 1 || state.selectedRoute !== null)) return false;
  if (state.phase === 'job' && (state.round !== 3 || state.job !== null)) return false;
  if (state.round < 3 && state.job !== null) return false;
  if (
    state.round === 3 &&
    state.phase === 'fight' &&
    !['accepted', 'skipped'].includes(String(state.job))
  )
    return false;
  if (state.round === 3 && state.job !== null && !['accepted', 'skipped'].includes(state.job))
    return false;
  if (state.round === 4 && !['complete', 'failed', 'skipped'].includes(String(state.job)))
    return false;
  if (state.phase !== 'fight' && (state.roomHits !== 0 || state.roomTimeMs !== 0)) return false;
  if (
    !plain(value.checkpoint) ||
    !Object.keys(value.checkpoint).every((k) =>
      [
        'version',
        'seed',
        'stage',
        'startingGun',
        'hp',
        'mods',
        'kills',
        'elapsed',
        'encounters',
        'combatResults',
      ].includes(k),
    )
  )
    return false;
  const cp = loadCheckpoint(value.checkpoint);
  return (
    !!cp &&
    cp.version === 6 &&
    cp.seed === quickShiftRuntimeSeed(state.challenge) &&
    cp.stage === QUICK_SHIFT_DRAFT_STAGES[state.round] &&
    cp.startingGun === state.gun &&
    cp.hp === state.hp &&
    same(cp.mods, state.mods) &&
    cp.kills === state.kills &&
    cp.elapsed === state.timeMs / 1000 &&
    cp.encounters === 1
  );
}
export function loadQuickShiftContinue(value: unknown): QuickShiftContinue | null {
  return validQuickShiftContinue(value) ? structuredClone(value) : null;
}

/** Authored rooms are reconstructed rather than trusting saved terrain or enemy data. */
export function quickShiftLevel(
  state: Pick<QuickShiftState, 'challenge' | 'round' | 'selectedRoute'>,
): Level {
  const plan = planQuickShift(state.challenge);
  if (state.round === 4) {
    const layout = structuredClone(FIRST_SHIFT_ARENAS[plan.boss]);
    const x = (n: number) => (plan.mirrored ? 2000 - n : n);
    return {
      ...layout,
      boss: true,
      mirrored: plan.mirrored,
      bossRemaster: plan.boss,
      solids: layout.solids.map((s) => ({ ...s, x: plan.mirrored ? 2000 - s.x - s.w : s.x })),
      spawns: layout.spawns.map((s) => ({ ...s, x: x(s.x) })),
      route: layout.route.map((p) => ({ ...p, x: x(p.x) })).sort((a, b) => a.x - b.x),
      counterweights: (layout.counterweights ?? []).map((c) => ({ ...c, x: x(c.x) })),
      setpiece: {
        ...layout.setpiece!,
        props: layout.setpiece!.props.map((p) => ({ ...p, x: x(p.x) })),
        cargo: (layout.setpiece!.cargo ?? []).map((c) => ({ ...c, x: x(c.x) })),
      },
    };
  }
  const room =
    state.round === 0
      ? plan.patrol
      : state.round === 3
        ? plan.patrol === 'overpass'
          ? 'switchyard'
          : 'overpass'
        : plan.tactical[state.round - 1];
  // These two rooms own authored upper/lower branches. Other rooms retain
  // their tested native geometry and change the patrol angle by reflection.
  const branch = room === 'switchyard' || room === 'scrap-bridge';
  const alternate = state.round > 0 && state.selectedRoute === 'high' && !branch;
  return combatFlowRoomLevel(
    room,
    plan.variants[state.round],
    alternate ? !plan.mirrored : plan.mirrored,
    state.round === 0 ? undefined : (state.selectedRoute ?? undefined),
  );
}

/** A private native run: no Campaign save, license, mastery or victory is emitted. */
export class QuickShift {
  readonly game: Game;
  state: QuickShiftState | null = null;
  result: QuickShiftRecord | null = null;
  loading = false;
  private bossDefeated = false;
  private entryHp = 100;
  private report: CombatResults | undefined;
  constructor(game: Game) {
    this.game = game;
  }
  reset() {
    this.state = null;
    this.result = null;
    this.bossDefeated = false;
    this.report = undefined;
  }
  begin(challenge: QuickShiftChallenge, gun: StartingGun, preview = false) {
    if (!validQuickShiftChallenge(challenge) || !isStartingGun(gun)) return false;
    this.reset();
    this.state = {
      challenge: structuredClone(challenge),
      gun,
      preview,
      phase: 'draft',
      round: 0,
      cleared: 0,
      mods: [],
      hp: 100,
      timeMs: 0,
      kills: 0,
      hits: 0,
      shots: 0,
      offers: [],
      draftRemaining: 3,
      selectedRoute: null,
      job: null,
      roomTimeMs: 0,
      roomHits: 0,
    };
    this.load(false);
    this.draft();
    return true;
  }
  private checkpoint(): Checkpoint {
    const s = this.state!;
    return {
      version: 6,
      seed: quickShiftRuntimeSeed(s.challenge),
      stage: QUICK_SHIFT_DRAFT_STAGES[s.round],
      startingGun: s.gun,
      hp: s.hp,
      mods: [...s.mods],
      kills: s.kills,
      elapsed: s.timeMs / 1000,
      encounters: 1,
      ...(this.report ? { combatResults: structuredClone(this.report) } : {}),
    };
  }
  private load(fighting = true, checkpoint?: Checkpoint) {
    const s = this.state!,
      g = this.game;
    const cp = checkpoint ?? this.checkpoint();
    this.loading = true;
    if (fighting) s.phase = 'fight';
    this.entryHp = cp.hp;
    this.report = cp.combatResults ? structuredClone(cp.combatResults) : undefined;
    this.bossDefeated = false;
    try {
      g.start(cp.seed, cp, null, { ...cp, rematchRoom: quickShiftLevel(s) });
    } finally {
      this.loading = false;
    }
    if (fighting) {
      s.offers = [];
      s.draftRemaining = 0;
      g.onChange();
    }
  }
  private draft() {
    const s = this.state!,
      g = this.game;
    s.phase = 'draft';
    const pick = (s.round === 0 ? 3 : 2) - s.draftRemaining;
    s.offers = quickShiftOffers(s.challenge, s.mods, s.cleared, s.gun, pick);
    g.setMode('upgrade');
  }
  chooseMod(id: string) {
    const s = this.state,
      g = this.game;
    if (
      !s ||
      s.phase !== 'draft' ||
      g.mode !== 'upgrade' ||
      !s.offers.includes(id) ||
      !quickShiftOffers(
        s.challenge,
        s.mods,
        s.cleared,
        s.gun,
        (s.round === 0 ? 3 : 2) - s.draftRemaining,
      ).includes(id)
    )
      return false;
    s.mods.push(id);
    s.draftRemaining--;
    g.applyJobRefit(s.mods);
    g.onSound('upgrade');
    if (s.draftRemaining > 0) this.draft();
    else this.nextRoom();
    return true;
  }
  private nextRoom() {
    const s = this.state!,
      g = this.game;
    s.offers = [];
    if (s.round === 1 && !s.selectedRoute) {
      s.phase = 'route';
      g.setMode('upgrade');
      return;
    }
    if (s.round === 3 && s.job === null) {
      s.phase = 'job';
      g.setMode('upgrade');
      return;
    }
    this.load();
  }
  chooseRoute(route: QuickShiftRoute) {
    const s = this.state;
    if (!s || s.phase !== 'route' || !isQuickShiftRoute(route) || this.game.mode !== 'upgrade')
      return false;
    s.selectedRoute = route;
    this.nextRoom();
    return true;
  }
  chooseJob(choice: 'accept' | 'skip') {
    const s = this.state;
    if (
      !s ||
      s.phase !== 'job' ||
      !['accept', 'skip'].includes(choice) ||
      this.game.mode !== 'upgrade'
    )
      return false;
    s.job = choice === 'accept' ? 'accepted' : 'skipped';
    this.nextRoom();
    return true;
  }
  damaged() {
    const s = this.state;
    if (!s || s.phase !== 'fight' || this.game.mode !== 'playing') return;
    s.hits++;
    // Both jobs lock their combat result at the native clear, before the exit walk.
    if (!this.game.clear) s.roomHits++;
  }
  defeated(kind: string, credited: boolean) {
    const s = this.state;
    if (
      s?.phase === 'fight' &&
      s.round === 4 &&
      credited &&
      kind === planQuickShift(s.challenge).boss
    )
      this.bossDefeated = true;
  }
  update() {
    const s = this.state,
      g = this.game;
    if (
      !s ||
      s.phase !== 'fight' ||
      g.mode !== 'playing' ||
      !g.clear ||
      g.hp <= 0 ||
      g.combatEnemyCount ||
      g.waves.pending ||
      g.bossRemaster.waiting ||
      g.time - g.clearAt < 0.4 ||
      (s.round === 4 && !this.bossDefeated) ||
      (s.round !== 4 && (g.player.position.x <= 1870 || g.player.position.y <= 590)) ||
      !g.testRun?.rematchRoom ||
      g.seed !== quickShiftRuntimeSeed(s.challenge) ||
      g.stage !== QUICK_SHIFT_DRAFT_STAGES[s.round] ||
      g.startingGun !== s.gun ||
      !same(g.mods, s.mods)
    )
      return false;
    this.report = g.combatReport.snapshot();
    s.hp = g.hp;
    s.timeMs = Math.max(1, Math.round(g.elapsed * 1000));
    s.kills = g.kills;
    s.shots += g.shotCount;
    if (s.round === 3 && s.job === 'accepted') {
      const success =
        planQuickShift(s.challenge).job === 'clean'
          ? s.roomHits === 0
          : s.roomTimeMs + g.clearAt * 1000 <= QUICK_SHIFT_JOB_SECONDS * 1000;
      s.job = success ? 'complete' : 'failed';
      if (success) s.hp = g.hp = Math.min(100, s.hp + 15);
    }
    s.cleared++;
    s.roomTimeMs = 0;
    s.roomHits = 0;
    if (s.cleared === 5) {
      s.phase = 'complete';
      this.finish('won');
      g.setMode('won');
    } else {
      s.round++;
      s.draftRemaining = 2;
      this.draft();
    }
    return true;
  }
  private finish(outcome: 'won' | 'dead') {
    const s = this.state!;
    const record: QuickShiftRecord = {
      version: 1,
      rules: s.challenge.rules,
      seed: s.challenge.seed,
      gun: s.gun,
      route: s.selectedRoute ?? 'low',
      job: s.job === null || s.job === 'skipped' ? 'skip' : 'accept',
      jobWon: s.job === 'complete',
      outcome,
      rooms: s.cleared,
      timeMs: s.timeMs,
      hits: s.hits,
      shots: s.shots,
      kills: s.kills,
      mods: [...s.mods],
    };
    this.result = validQuickShiftRecord(record) ? record : null;
  }
  died() {
    const s = this.state,
      g = this.game;
    if (!s || s.phase !== 'fight') return;
    s.phase = 'dead';
    s.hp = 0;
    s.timeMs = Math.max(0, Math.round(g.elapsed * 1000));
    s.kills = g.kills;
    s.shots += g.shotCount;
    this.finish('dead');
  }
  snapshot(): QuickShiftContinue | null {
    const s = this.state,
      g = this.game;
    if (!s || s.preview || this.loading || !['draft', 'route', 'job', 'fight'].includes(s.phase))
      return null;
    const { offers: _offers, preview: _preview, ...state } = structuredClone(s);
    if (s.phase === 'fight') {
      state.hp = this.entryHp;
      state.timeMs = Math.round(g.elapsed * 1000);
      state.roomTimeMs += Math.round(g.time * 1000);
      state.shots += g.shotCount;
    }
    const cp: Checkpoint = {
      ...this.checkpoint(),
      hp: state.hp,
      elapsed: state.timeMs / 1000,
      ...(s.phase === 'fight' ? { combatResults: g.combatReport.snapshot() } : {}),
    };
    const wrapper: QuickShiftContinue = {
      version: 1,
      rules: s.challenge.rules,
      state,
      checkpoint: cp,
    };
    return loadQuickShiftContinue(wrapper);
  }
  resume(raw: unknown) {
    const saved = loadQuickShiftContinue(raw);
    if (!saved) return false;
    this.reset();
    const s = (this.state = { ...saved.state, offers: [], preview: false });
    if (s.phase === 'fight') this.load(true, saved.checkpoint);
    else {
      this.load(false, saved.checkpoint);
      if (s.phase === 'draft') this.draft();
      else this.game.setMode('upgrade');
    }
    return true;
  }
}
