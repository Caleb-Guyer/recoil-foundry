import type { Game } from './game.ts';
import { GUN_FINISHES, OUTFITS, type Cosmetics } from './cosmetics.ts';
import { SUPPORT_MASTERIES } from './support-mastery.ts';

/** Actual mechanism activations, counted at native success points (never estimated damage). */
export const BUILD_ACTIVATION_IDS = [
  'polarity-rounds',
  'ricochet-harness',
  'spring-rivets',
  'slip-gauge',
  'wake-wire',
  'false-silhouette',
  'gimbal-mount',
  'momentum-exchange',
  'offset-nozzle',
  'momentum-battery',
  'piston-lance',
  'cable-saw',
  'seeker-rack',
  'foamcaster',
  'catch-chamber',
  'gate-snare',
  'hot-wire',
  'ghost-shift',
  'windmill',
  'scrap-comet',
] as const;
export type BuildActivationId = (typeof BUILD_ACTIVATION_IDS)[number];
export type BuildActivations = Partial<Record<BuildActivationId, number>>;
const activationId = (id: string): id is BuildActivationId =>
  BUILD_ACTIVATION_IDS.includes(id as BuildActivationId);

export interface CombatResults {
  version: 1;
  heatTransfers: number;
  bankCharges: number;
  armorBlocks: number;
  bloodworkHealing: number;
  partial?: true;
  fromStage: number;
  /** Absent on historical reports. A present empty dictionary means measured zero. */
  activations?: BuildActivations;
  activationFromStage?: number;
  activationPartial?: true;
}
const counts = ['heatTransfers', 'bankCharges', 'armorBlocks'] as const;
const amounts = ['bloodworkHealing'] as const;

// Optional reporting data must never prevent a valid run or backup from loading.
export function loadCombatResults(value: unknown): CombatResults | undefined {
  if (!value || typeof value !== 'object') return;
  const raw = value as CombatResults;
  if (
    raw.version !== 1 ||
    !Number.isInteger(raw.fromStage) ||
    raw.fromStage < 0 ||
    raw.fromStage > 19 ||
    (raw.partial !== undefined && raw.partial !== true) ||
    counts.some((key) => !Number.isSafeInteger(raw[key]) || raw[key] < 0 || raw[key] > 1e7) ||
    amounts.some((key) => !Number.isFinite(raw[key]) || raw[key] < 0 || raw[key] > 1e9)
  )
    return;
  let activations: BuildActivations | undefined;
  if (
    raw.activations &&
    typeof raw.activations === 'object' &&
    !Array.isArray(raw.activations) &&
    Number.isInteger(raw.activationFromStage) &&
    raw.activationFromStage! >= 0 &&
    raw.activationFromStage! <= 19 &&
    (raw.activationPartial === undefined || raw.activationPartial === true)
  ) {
    const entries = Object.entries(raw.activations);
    // Invalid optional new data is dropped without discarding the established counters.
    if (
      entries.length <= BUILD_ACTIVATION_IDS.length &&
      entries.every(([id, n]) => activationId(id) && Number.isSafeInteger(n) && n >= 0 && n <= 1e7)
    )
      activations = Object.fromEntries(entries) as BuildActivations;
  }
  return {
    version: 1,
    heatTransfers: raw.heatTransfers,
    bankCharges: raw.bankCharges,
    armorBlocks: raw.armorBlocks,
    bloodworkHealing: raw.bloodworkHealing,
    fromStage: raw.fromStage,
    ...(raw.partial ? { partial: true as const } : {}),
    ...(activations
      ? {
          activations,
          activationFromStage: raw.activationFromStage,
          ...(raw.activationPartial ? { activationPartial: true as const } : {}),
        }
      : {}),
  };
}
export function loadRecordedAppearance(value: unknown): Cosmetics | undefined {
  if (!value || typeof value !== 'object') return;
  const raw = value as Cosmetics;
  if (
    typeof raw.gun !== 'string' ||
    typeof raw.outfit !== 'string' ||
    !Object.hasOwn(GUN_FINISHES, raw.gun) ||
    !Object.hasOwn(OUTFITS, raw.outfit)
  )
    return;
  return { gun: raw.gun, outfit: raw.outfit };
}

export class CombatReport {
  private results!: CombatResults;
  private game: Game;
  private activationTokens = new Map<BuildActivationId, Set<string>>();
  constructor(game: Game) {
    this.game = game;
    this.reset();
  }
  reset(saved?: unknown, partialStage?: number) {
    this.activationTokens.clear();
    this.results = loadCombatResults(saved) ?? {
      version: 1,
      heatTransfers: 0,
      bankCharges: 0,
      armorBlocks: 0,
      bloodworkHealing: 0,
      fromStage: partialStage ?? 0,
      ...(partialStage !== undefined
        ? { partial: true as const }
        : { activations: {}, activationFromStage: 0 }),
    };
  }
  snapshot(): CombatResults {
    return {
      ...this.results,
      ...(this.results.activations ? { activations: { ...this.results.activations } } : {}),
    };
  }
  private get active() {
    return this.game.mode === 'playing' && this.game.hp > 0;
  }
  /** Optional token deduplicates a complete discharge/trigger, including later beam frames. */
  activation(id: BuildActivationId, token?: number | string) {
    if (!activationId(id) || !this.active || this.game.hitStop > 0 || this.game.finale.safe) return;
    const equipped = this.game.mods.includes(id) || this.game.shiftMorphs.equipped === id;
    if (!equipped) return;
    if (token !== undefined) {
      if (
        (typeof token !== 'number' && typeof token !== 'string') ||
        (typeof token === 'number' && (!Number.isSafeInteger(token) || token < 0)) ||
        (typeof token === 'string' && (token.length === 0 || token.length > 80))
      )
        return;
      const key = `${typeof token}:${token}`;
      const seen = this.activationTokens.get(id) ?? new Set<string>();
      if (seen.has(key)) return;
      seen.add(key);
      if (seen.size > 256) seen.delete(seen.values().next().value!);
      this.activationTokens.set(id, seen);
    }
    if (!this.results.activations) {
      this.results.activations = {};
      this.results.activationFromStage = this.game.stage;
      this.results.activationPartial = true;
    }
    this.results.activations[id] = Math.min(1e7, (this.results.activations[id] ?? 0) + 1);
  }
  checkMasteries() {
    if (!this.game.commendations.eligible) return;
    for (const mastery of SUPPORT_MASTERIES)
      if (this.results[mastery.counter] >= mastery.target)
        this.game.commendations.award(mastery.id);
  }
  bankCharge(bonus: number) {
    if (!this.active || !Number.isFinite(bonus) || bonus <= 0) return;
    this.results.bankCharges = Math.min(1e7, this.results.bankCharges + 1);
    this.checkMasteries();
  }
  heatTransfer(heat: number) {
    if (this.active && Number.isFinite(heat) && heat > 0) {
      this.results.heatTransfers = Math.min(1e7, this.results.heatTransfers + 1);
      this.checkMasteries();
    }
  }
  armorBlock() {
    if (this.active) {
      this.results.armorBlocks = Math.min(1e7, this.results.armorBlocks + 1);
      this.checkMasteries();
    }
  }
  bloodworkHeal(amount: number) {
    if (this.active && Number.isFinite(amount) && amount > 0)
      this.results.bloodworkHealing = Math.min(1e9, this.results.bloodworkHealing + amount);
  }
}
