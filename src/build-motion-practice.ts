import { Game, type Input } from './game.ts';
import type { StartingGun } from './starting-guns.ts';
import type { Cosmetics } from './cosmetics.ts';
import { getGun } from './rules.ts';
import { destroyUpgradeDemo } from './upgrade-demo.ts';
import { buildMotionDefinition } from './build-motion.ts';
import type { ShiftRunSave } from './shift-run.ts';
import type { WorkshopScenario } from './workshop.ts';

export interface BuildMotionPracticeConfig {
  id: string;
  mods: string[];
  startingGun: StartingGun;
  seed: string;
  cosmetics: Cosmetics;
  scenario: WorkshopScenario;
  shiftRun?: ShiftRunSave;
}
/** Capture equipment only. Neither combat state nor any parent callback is shared. */
export function buildMotionPracticeConfig(
  source: Game,
  id: string,
): BuildMotionPracticeConfig | null {
  const definition = buildMotionDefinition(id);
  if (!definition || (!source.mods.includes(id) && source.shiftRun.leasedMorph !== id)) return null;
  return {
    id,
    mods: [...source.mods],
    startingGun: source.startingGun,
    seed: source.seed,
    cosmetics: { ...source.cosmetics },
    scenario: definition.scenario,
    ...(source.shiftRun.snapshot() ? { shiftRun: source.shiftRun.snapshot()! } : {}),
  };
}
/** A disposable native Workshop world; the paused Campaign is never replaced or restarted. */
export class BuildMotionPractice {
  game: Game;
  readonly config: BuildMotionPracticeConfig;
  private stopped = false;
  constructor(config: BuildMotionPracticeConfig) {
    this.config = structuredClone(config);
    this.game = this.create();
    this.preserveEquipment();
  }
  private preserveEquipment() {
    const g = this.game,
      c = this.config;
    // Existing runs can contain legacy or leased equipment that acquisition filters must not erase.
    g.seed = c.seed;
    g.startingGun = c.startingGun;
    g.mods = [...c.mods];
    g.gun = getGun(g.mods, c.startingGun);
    g.cosmetics = { ...c.cosmetics };
    g.shiftRun.state = c.shiftRun ? structuredClone(c.shiftRun) : null;
  }
  private create() {
    const g = new Game(),
      c = this.config;
    g.startWorkshop(c.mods, c.mods, c.startingGun, c.scenario);
    return g;
  }
  tick(dt: number, input: Input) {
    if (this.stopped || !Number.isFinite(dt) || dt <= 0 || this.game.mode !== 'playing') return;
    const level = this.game.level;
    this.game.tick(Math.min(dt, 1 / 30), input);
    if (level !== this.game.level) this.preserveEquipment();
  }
  reset() {
    if (this.stopped) return;
    destroyUpgradeDemo(this.game);
    this.game = this.create();
    this.preserveEquipment();
  }
  dispose() {
    if (this.stopped) return;
    this.stopped = true;
    destroyUpgradeDemo(this.game);
  }
}
