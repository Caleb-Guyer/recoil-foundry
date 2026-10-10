import type { Game } from './game.ts';
import { practiceStage } from './practice.ts';
import { REMIX_IDS, isBossRemix, type BossRemixId } from './boss-remix-rules.ts';
import {
  gauntletChallengeAccess,
  validGauntletChallenge,
  type GauntletChallenge,
} from './gauntlet-challenge.ts';
import { isStartingGun, type StartingGun } from './starting-guns.ts';
import { loadWeaponUnlocks, unlockedStartingGuns } from './weapon-unlocks.ts';
import { getGun, type Checkpoint } from './rules.ts';
import {
  GAUNTLET_RULES,
  GAUNTLET_REPAIR,
  GAUNTLET_ROUNDS,
  gauntletEncounter,
  gauntletOffers,
  gauntletBuild,
  validGauntletRecord,
  remixGauntletChoices,
  gauntletBossHp,
  isGauntletTier,
  type GauntletChoice,
  type GauntletOptions,
  type GauntletMode,
  type GauntletTier,
  type GauntletRecord,
} from './gauntlet-rules.ts';

export interface GauntletState {
  gun: StartingGun;
  preview: boolean;
  phase: 'route' | 'fight' | 'service' | 'complete' | 'dead';
  route: GauntletChoice[];
  mode: GauntletMode;
  tier: GauntletTier;
  seen: BossRemixId[];
  challenge?: GauntletChallenge;
  path?: 1 | 2;
  mods: string[];
  repairs: number;
  hp: number;
  timeMs: number;
  hits: number;
  shots: number;
  cleared: number;
  offers: string[];
}
export class BossGauntlet {
  game: Game;
  state: GauntletState | null = null;
  result: GauntletRecord | null = null;
  private bossDefeated = false;
  constructor(game: Game) {
    this.game = game;
  }
  reset() {
    this.state = null;
    this.result = null;
    this.bossDefeated = false;
  }
  begin(gun: StartingGun, profile: unknown, preview = false, options: GauntletOptions = {}) {
    const access = loadWeaponUnlocks(profile);
    if (!preview && (!access.cleared || !unlockedStartingGuns(access).includes(gun))) return false;
    if (!isStartingGun(gun)) return false;
    const mode = options.mode ?? 'classic',
      tier = options.tier ?? 'standard';
    const seen = preview ? [...REMIX_IDS] : [...new Set((options.seen ?? []).filter(isBossRemix))];
    if (
      !['classic', 'remix'].includes(mode) ||
      !isGauntletTier(tier) ||
      (mode === 'classic' && (tier !== 'standard' || options.challenge || options.path)) ||
      (mode === 'remix' && !seen.length)
    )
      return false;
    if (options.path !== undefined && (!preview || ![1, 2].includes(options.path))) return false;
    if (
      options.challenge &&
      (!validGauntletChallenge(options.challenge) ||
        options.challenge.gun !== gun ||
        options.challenge.tier !== tier ||
        (!preview && !gauntletChallengeAccess(options.challenge, profile, seen).allowed))
    )
      return false;
    this.reset();
    this.state = {
      gun,
      preview,
      phase: 'route',
      route: [],
      mode,
      tier,
      seen,
      ...(options.challenge ? { challenge: structuredClone(options.challenge) } : {}),
      ...(options.path ? { path: options.path } : {}),
      mods: [],
      repairs: 0,
      hp: 100,
      timeMs: 0,
      hits: 0,
      shots: 0,
      cleared: 0,
      offers: [],
    };
    return true;
  }
  get choices(): readonly GauntletChoice[] {
    const s = this.state;
    if (!s || s.phase !== 'route') return [];
    if (s.mode === 'classic') return GAUNTLET_ROUNDS[s.cleared] ?? [];
    if (s.challenge) return [s.challenge.route[s.cleared]];
    const choices = remixGauntletChoices(s.cleared, s.seen);
    return s.path ? [choices[s.path - 1]] : choices;
  }
  chooseBoss(kind: GauntletChoice) {
    const s = this.state,
      g = this.game;
    if (!s || !this.choices.includes(kind)) return false;
    const encounter = gauntletEncounter(kind),
      stage = practiceStage(encounter);
    const save: Checkpoint = {
      version: 6,
      seed: encounter.seed,
      stage,
      startingGun: s.gun,
      hp: s.hp,
      mods: [...s.mods],
      kills: 0,
      elapsed: s.timeMs / 1000,
    };
    s.route.push(kind);
    s.phase = 'fight';
    s.offers = [];
    g.start(save.seed, save, { ...encounter, build: [...s.mods] }, save);
    for (const enemy of g.enemies)
      if (enemy.kind === encounter.kind)
        enemy.hp = enemy.maxHp = gauntletBossHp(s.cleared, s.tier, s.mode);
    // Game.start clears the previous mode. Restore only this validated session.
    this.state = s;
    this.result = null;
    this.bossDefeated = false;
    g.onChange();
    return true;
  }
  defeated(kind: string, credited: boolean) {
    const s = this.state;
    if (s?.phase === 'fight' && credited && kind === gauntletEncounter(s.route.at(-1)!).kind)
      this.bossDefeated = true;
  }
  completeFight() {
    const s = this.state,
      g = this.game;
    const encounter = s?.route.length ? gauntletEncounter(s.route.at(-1)!) : null;
    if (
      !s ||
      s.phase !== 'fight' ||
      !this.bossDefeated ||
      !g.clear ||
      g.mode !== 'playing' ||
      g.hp <= 0 ||
      g.combatEnemyCount ||
      g.waves.pending ||
      !g.practice ||
      !g.testRun ||
      !encounter ||
      g.practice.kind !== encounter.kind ||
      g.practice.remix !== encounter.remix ||
      g.level.bossRemix !== encounter.remix ||
      g.seed !== encounter.seed ||
      g.stage !== practiceStage(encounter) ||
      g.startingGun !== s.gun ||
      JSON.stringify(g.mods) !== JSON.stringify(s.mods)
    )
      return false;
    s.hp = g.hp;
    s.timeMs = Math.max(1, Math.round(g.elapsed * 1000));
    s.hits += g.practiceHits;
    s.shots += g.shotCount;
    s.cleared++;
    this.bossDefeated = false;
    if (s.cleared === 5) {
      s.phase = 'complete';
      const r = {
        rules: GAUNTLET_RULES,
        gun: s.gun,
        route: [...s.route],
        mods: [...s.mods],
        repairs: s.repairs,
        timeMs: s.timeMs,
        hits: s.hits,
        shots: s.shots,
        ...(s.mode === 'remix' ? { mode: 'remix' as const, tier: s.tier } : {}),
      };
      if (validGauntletRecord(r) && !s.preview) this.result = r;
    } else {
      s.phase = 'service';
      s.offers = gauntletOffers(s.mods, s.cleared);
    }
    return true;
  }
  service(id: string) {
    const s = this.state;
    if (!s || s.phase !== 'service' || this.game.mode !== 'won') return false;
    if (id === 'repair') {
      if (s.hp >= 100) return false;
      s.hp = Math.min(100, s.hp + GAUNTLET_REPAIR);
      s.repairs++;
    } else {
      if (!s.offers.includes(id) || !gauntletBuild(s.mods, id)) return false;
      s.mods.push(id);
    }
    this.game.hp = s.hp;
    this.game.mods = [...s.mods];
    this.game.gun = getGun(s.mods, s.gun);
    s.offers = [];
    s.phase = 'route';
    this.game.onSound('upgrade');
    this.game.onChange();
    return true;
  }
  died() {
    const s = this.state,
      g = this.game;
    if (s?.phase !== 'fight') return;
    s.phase = 'dead';
    s.hp = 0;
    s.timeMs = Math.max(1, Math.round(g.elapsed * 1000));
    s.hits += g.practiceHits;
    s.shots += g.shotCount;
    this.result = null;
  }
}
