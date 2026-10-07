import type { Game } from './game.ts';
import { GUN_FINISHES, OUTFITS, type Cosmetics } from './cosmetics.ts';
import { SUPPORT_MASTERIES } from './support-mastery.ts';

export interface CombatResults {
  version: 1;
  heatTransfers: number;
  bankCharges: number;
  armorBlocks: number;
  bloodworkHealing: number;
  partial?: true;
  fromStage: number;
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
  return {
    version: 1,
    heatTransfers: raw.heatTransfers,
    bankCharges: raw.bankCharges,
    armorBlocks: raw.armorBlocks,
    bloodworkHealing: raw.bloodworkHealing,
    fromStage: raw.fromStage,
    ...(raw.partial ? { partial: true as const } : {}),
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
  constructor(game: Game) {
    this.game = game;
    this.reset();
  }
  reset(saved?: unknown, partialStage?: number) {
    this.results = loadCombatResults(saved) ?? {
      version: 1,
      heatTransfers: 0,
      bankCharges: 0,
      armorBlocks: 0,
      bloodworkHealing: 0,
      fromStage: partialStage ?? 0,
      ...(partialStage !== undefined ? { partial: true as const } : {}),
    };
  }
  snapshot(): CombatResults {
    return { ...this.results };
  }
  private get active() {
    return this.game.mode === 'playing' && this.game.hp > 0;
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
