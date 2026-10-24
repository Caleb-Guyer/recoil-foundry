import type { Game } from './game.ts';
import { finalApproachSeed } from './boss-progression.ts';
import { legalSwaps, type ReforgeSwap } from './reforge-rules.ts';
import {
  buildPath,
  distance,
  getGun,
  isFusion,
  sample,
  seeded,
  validSavedBuild,
  type Checkpoint,
} from './rules.ts';
import { isStartingGun, type StartingGun } from './starting-guns.ts';
import { validUnlocks } from './longevity.ts';

export const FINALE_SERVICE_REPAIR = 25;
export type FinaleServiceStatus = 'available' | 'repair' | 'swap' | 'left';
export interface FinaleServiceVisit {
  status: FinaleServiceStatus;
  baseMods: string[];
  startingGun: StartingGun;
  unlocks: string[];
  legacyMods?: string[];
  offers: ReforgeSwap[];
  swap?: number;
  open?: true;
}
export interface FinaleServiceSave {
  version: 1;
  campaign?: FinaleServiceVisit;
  overtime?: FinaleServiceVisit;
}

// The service adjusts fittings, never the weapon the player brought in. Keep
// fire mechanisms and earned fusions even when they have no dependent upgrade.
const IDENTITIES = new Set([
  'cutting-torch',
  'shellshock',
  'mass-driver',
  'fold',
  'recall',
  'vector',
  'grindshot',
  'suspension',
  'tripwire',
  'crossfire',
]);
export const serviceBuild = (mods: readonly string[], swap: ReforgeSwap) => [
  ...mods.filter((id) => id !== swap.from),
  swap.to,
];

export function finaleServiceOffers(
  mods: readonly string[],
  seed: string,
  overtime = false,
  legacyMods?: readonly string[],
  unlocks: readonly string[] = [],
): ReforgeSwap[] {
  const path = buildPath(mods);
  const swaps = legalSwaps(mods, 19, legacyMods, unlocks, seed).filter(
    (swap) =>
      !IDENTITIES.has(swap.from) &&
      !IDENTITIES.has(swap.to) &&
      !isFusion(swap.from) &&
      !isFusion(swap.to) &&
      buildPath(serviceBuild(mods, swap)) === path,
  );
  const pool = sample(
    swaps,
    swaps.length,
    seeded(seed + ':final-service-v1:' + Number(overtime) + ':' + mods.join(',')),
  );
  const chosen: ReforgeSwap[] = [];
  for (const uniqueSource of [true, false])
    for (const swap of pool) {
      if (chosen.length === 3) return chosen;
      if (chosen.some((s) => s.to === swap.to || (uniqueSource && s.from === swap.from))) continue;
      // legalSwaps already protects prerequisites for every candidate. Validate
      // the selected complete build once, rather than scanning it hundreds of
      // times merely to show a three-card service menu.
      if (!validSavedBuild(serviceBuild(mods, swap), legacyMods)) continue;
      chosen.push({ ...swap });
    }
  return chosen;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const sameOffers = (a: readonly ReforgeSwap[], b: readonly ReforgeSwap[]) =>
  a.length === b.length &&
  a.every((swap, index) => swap.from === b[index].from && swap.to === b[index].to);
const record = (raw: unknown): raw is Record<string, unknown> =>
  !!raw && typeof raw === 'object' && !Array.isArray(raw);
const keys = (raw: Record<string, unknown>, allowed: readonly string[]) =>
  Object.keys(raw).every((key) => allowed.includes(key));
export const isFinaleServiceTestSeed = (seed: string) =>
  /^RF-C98-SERVICE-(STANDARD|BEAM|FUSION)-[01]$/.test(seed);

function validVisit(raw: unknown, cp: Checkpoint, overtime: boolean) {
  if (
    !record(raw) ||
    !keys(raw, [
      'status',
      'baseMods',
      'startingGun',
      'unlocks',
      'legacyMods',
      'offers',
      'swap',
      'open',
    ]) ||
    !['available', 'repair', 'swap', 'left'].includes(String(raw.status)) ||
    !Array.isArray(raw.baseMods) ||
    !raw.baseMods.every((id) => typeof id === 'string') ||
    !validSavedBuild(raw.baseMods, raw.legacyMods as string[] | undefined) ||
    !isStartingGun(raw.startingGun) ||
    raw.startingGun !== (cp.startingGun ?? 'pistol') ||
    !validUnlocks(raw.unlocks) ||
    !Array.isArray(raw.offers) ||
    raw.offers.length > 3 ||
    raw.offers.some(
      (s) =>
        !record(s) ||
        !keys(s, ['from', 'to']) ||
        typeof s.from !== 'string' ||
        typeof s.to !== 'string',
    ) ||
    (raw.open !== undefined && raw.open !== true) ||
    (raw.open && raw.status !== 'available') ||
    (raw.status === 'swap'
      ? !Number.isInteger(raw.swap) || Number(raw.swap) < 0 || Number(raw.swap) >= raw.offers.length
      : raw.swap !== undefined)
  )
    return false;
  const visit = raw as unknown as FinaleServiceVisit;
  if (
    !sameOffers(
      visit.offers,
      finaleServiceOffers(visit.baseMods, cp.seed, overtime, visit.legacyMods, visit.unlocks),
    )
  )
    return false;
  const current = !!cp.overtime === overtime;
  if (visit.open && (!current || cp.stage !== 19 || cp.escape || cp.detour)) return false;
  if (current && cp.stage === 19 && !cp.escape && !cp.detour) {
    const expected =
      visit.status === 'swap'
        ? serviceBuild(visit.baseMods, visit.offers[visit.swap!])
        : visit.baseMods;
    if (!same(cp.mods, expected) || !same(cp.legacyMods, visit.legacyMods)) return false;
  }
  return true;
}

export function validFinaleService(cp: Checkpoint): boolean {
  const raw = (cp as Checkpoint & { finaleService?: unknown }).finaleService;
  if (raw === undefined) return true;
  if (
    !record(raw) ||
    !keys(raw, ['version', 'campaign', 'overtime']) ||
    raw.version !== 1 ||
    cp.version !== 6 ||
    !finalApproachSeed(cp.seed) ||
    /^RF-D\d+-/.test(cp.seed) ||
    (raw.overtime !== undefined && !cp.overtime)
  )
    return false;
  return (
    (raw.campaign === undefined || validVisit(raw.campaign, cp, false)) &&
    (raw.overtime === undefined || validVisit(raw.overtime, cp, true))
  );
}

export class FinaleService {
  game: Game;
  state: FinaleServiceSave = { version: 1 };
  private blocked = false;
  constructor(game: Game) {
    this.game = game;
  }
  get lap(): 'campaign' | 'overtime' {
    return this.game.overtime ? 'overtime' : 'campaign';
  }
  get current() {
    return this.state[this.lap];
  }
  get open() {
    return this.current?.open === true;
  }
  get offers() {
    return this.current?.offers ?? [];
  }
  get eligible() {
    const g = this.game;
    return (
      !this.blocked &&
      finalApproachSeed(g.seed) &&
      g.stage === 19 &&
      !g.practice &&
      !g.workshop.active &&
      !g.detour &&
      !g.escape &&
      (!g.testRun || isFinaleServiceTestSeed(g.testRun.seed)) &&
      g.finale.cinema?.state === 'approach'
    );
  }
  get available() {
    return this.eligible && (!this.current || this.current.status === 'available');
  }
  get site() {
    return this.eligible ? { x: this.game.level.mirrored ? 1440 : 560, y: 710, floor: 740 } : null;
  }
  get nearby() {
    const site = this.site,
      g = this.game;
    return (
      !!site &&
      distance(g.player.position, site) < 78 &&
      distance(g.lineEnd(g.player.position, site), site) < 1
    );
  }
  get checkpoint(): FinaleServiceSave | undefined {
    return this.state.campaign || this.state.overtime ? structuredClone(this.state) : undefined;
  }
  start(save?: Checkpoint) {
    this.blocked = !!save && !validFinaleService(save);
    const raw = (save as (Checkpoint & { finaleService?: FinaleServiceSave }) | undefined)
      ?.finaleService;
    this.state = !this.blocked && raw ? structuredClone(raw) : { version: 1 };
  }
  private prepare() {
    if (!this.eligible || this.current) return;
    const g = this.game;
    this.state[this.lap] = {
      status: 'available',
      baseMods: [...g.mods],
      startingGun: g.startingGun,
      unlocks: [...g.unlocks],
      ...(g.legacyMods ? { legacyMods: [...g.legacyMods] } : {}),
      offers: finaleServiceOffers(g.mods, g.seed, !!g.overtime, g.legacyMods, g.unlocks),
    };
  }
  reset() {
    this.prepare();
    if (this.available && this.open && this.game.mode === 'playing')
      this.game.setMode('finale-service');
  }
  interact() {
    const g = this.game;
    if (!this.available || !this.nearby || g.mode !== 'playing' || !g.grounded || g.hitStop > 0)
      return false;
    this.prepare();
    this.current!.open = true;
    g.setMode('finale-service');
    g.save();
    return true;
  }
  private canChoose() {
    const g = this.game,
      visit = this.current;
    return (
      this.available &&
      !!visit?.open &&
      g.mode === 'finale-service' &&
      same(g.mods, visit.baseMods) &&
      g.startingGun === visit.startingGun &&
      same(g.unlocks, visit.unlocks) &&
      same(g.legacyMods, visit.legacyMods) &&
      sameOffers(
        visit.offers,
        finaleServiceOffers(visit.baseMods, g.seed, !!g.overtime, visit.legacyMods, visit.unlocks),
      )
    );
  }
  private finish(status: Exclude<FinaleServiceStatus, 'available'>, swap?: number) {
    const visit = this.current!;
    visit.status = status;
    delete visit.open;
    if (swap !== undefined) visit.swap = swap;
    this.game.setMode('playing');
    this.game.save();
  }
  repair() {
    if (!this.canChoose() || this.game.hp >= 100 || this.game.hp <= 0) return false;
    this.game.hp = Math.min(100, this.game.hp + FINALE_SERVICE_REPAIR);
    this.finish('repair');
    return true;
  }
  leave() {
    if (!this.canChoose()) return false;
    this.finish('left');
    return true;
  }
  close() {
    return this.leave();
  }
  choose(index: number) {
    const g = this.game,
      swap = this.offers[index];
    if (
      !Number.isInteger(index) ||
      !swap ||
      !this.canChoose() ||
      !finaleServiceOffers(g.mods, g.seed, !!g.overtime, g.legacyMods, g.unlocks).some(
        (s) => s.from === swap.from && s.to === swap.to,
      )
    )
      return false;
    g.mods = serviceBuild(g.mods, swap);
    g.gun = getGun(g.mods, g.startingGun);
    // Reuse Reforge's cleanup contract without rebuilding the arena or giving
    // back spent room resources. No parked old projectile survives a refit.
    g.melt.reset();
    g.massDriver.reset();
    g.arcs.reset();
    g.grind.reset();
    g.torch.reset();
    g.tripwires.reset();
    g.salvage.reset();
    g.salvageEvolutions.reset();
    g.tethers.reset();
    g.evolutions.reset();
    g.ballistics.reset();
    g.cryogenic.reset();
    g.stasis.reset();
    g.mobility.reset();
    g.grapnel.reset();
    g.scrap.reset();
    g.support.reset();
    g.fusions.reset();
    g.demolition.clear();
    g.shots = [];
    g.burstRemaining = g.fireBuffer = g.jumpBuffer = 0;
    g.portalRequest = null;
    g.landingReady = g.chargedFlash = false;
    g.blast.life = g.muzzle = 0;
    g.shootAt = g.time;
    this.finish('swap', index);
    return true;
  }
}
