import type { AreaId } from './areas.ts';
import type { Game } from './game.ts';
import type { LivingFoundryFrame } from './living-foundry-types.ts';
import { COMBAT_FLOW_ROOMS } from './combat-flow-rooms.ts';
import { planQuickShift } from './quick-shift-rules.ts';
import { successfulUprising } from './uprising-model.ts';

const AREAS: readonly AreaId[] = ['docks', 'furnace', 'cooling', 'reclamation', 'rooftops'];
const CLOCK_LIMIT = 1e6;
const MAX_SAMPLE = 0.25;
const ENTRY_X = 140;
const REVEALED_X = 650;
const unit = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0);
const clock = (value: number) => (Number.isFinite(value) && value >= 0 ? value : null);
const copy = (frame: LivingFoundryFrame) => ({ ...frame });
function variantFor(room: string): 0 | 1 | 2 {
  // A local hash, with no draw from the combat/generation random stream.
  let hash = 2166136261;
  for (let i = 0; i < room.length; i++) hash = Math.imul(hash ^ room.charCodeAt(i), 16777619);
  return ((hash >>> 0) % 3) as 0 | 1 | 2;
}
function fixture(g: Game) {
  if (!g.testRun || !g.seed.startsWith('RF-C108-LF-')) return null;
  const match =
    /^living-foundry-(docks|furnace|cooling|reclamation|rooftops)-(reveal|machinery|combat)-([012])$/.exec(
      g.level.id,
    );
  return match && match[1] === g.level.area
    ? { scene: match[2], variant: Number(match[3]) as 0 | 1 | 2 }
    : null;
}
function eligible(g: Game) {
  return (
    !!g.level &&
    AREAS.includes(g.level.area) &&
    !g.workshop.active &&
    !g.practice &&
    !g.escape &&
    !g.detour &&
    !g.clockOut.active &&
    !g.finale.active &&
    g.stage < 19 &&
    !g.level.maintenance &&
    !g.level.recoilTrial &&
    !g.level.annex &&
    !g.level.freight &&
    !g.level.crossing &&
    !g.level.shutdown &&
    !g.level.story &&
    !g.level.sortingPit &&
    g.level.uprising !== 'railworks' &&
    g.level.uprising !== 'core'
  );
}
function firstAreaRoom(g: Game) {
  const quick = g.quickShift.state;
  if (quick) {
    const plan = planQuickShift(quick.challenge);
    const areas: AreaId[] = [
      'docks',
      COMBAT_FLOW_ROOMS[plan.tactical[0]].area,
      COMBAT_FLOW_ROOMS[plan.tactical[1]].area,
      'docks',
      plan.boss === 'loader' || plan.boss === 'crane' ? 'docks' : 'furnace',
    ];
    return !areas.slice(0, quick.round).includes(g.level.area);
  }
  return g.stage % 4 === 0 && AREAS[Math.floor(g.stage / 4)] === g.level.area;
}
function services(g: Game) {
  let power = g.areaEvents.dark ? 0 : 1;
  // A disconnect belongs to its own room, not every later circuit.
  if (g.shutdown.eligible && g.shutdown.state?.disabled.includes(g.stage)) power = 0;

  // Core sabotage removes environmental hazard circuits. It leaves belts,
  // magnets, independent lighting and the rest of the factory supply intact.
  const cut = g.uprising.active && successfulUprising(g.uprising.run, 'core-sabotage');
  const belts = unit(
    g.conveyors.items.reduce(
      (n, belt) => n + (Number.isFinite(belt.speed) ? Math.abs(belt.speed) * 0.08 : 0),
      0,
    ),
  );
  const lifting = g.magnets.items.some(
    (magnet) => magnet.phase === 'lift' || magnet.phase === 'hold' || magnet.phase === 'drop',
  );
  const fan = unit(g.crosswind.items.reduce((n, item) => n + unit(g.crosswind.strength(item)), 0));
  const vent = g.pressure.items.some((item) => item.phase === 'burst');

  // These are background departmental service levels, not new gameplay
  // emitters: district circulation continues after a patrol is cleared.
  return {
    power,
    coolant: cut
      ? 0
      : power *
        unit(
          (g.level.area === 'cooling' ? 0.7 : 0) +
            ((g.level.coolant?.length ?? 0) > 0 ? 0.3 : 0) +
            (vent ? 0.1 : 0),
        ),
    salvage:
      power *
      unit((g.level.area === 'reclamation' ? 0.6 : 0) + belts * 0.25 + (lifting ? 0.25 : 0)),
    wind: cut ? 0 : power * unit((g.level.area === 'rooftops' ? 0.35 : 0) + fan * 0.65),
  };
}

/**
 * A visual-only projection. It never advances Game, applies forces, emits
 * sounds, consumes run randomness or writes a checkpoint.
 */
export class LivingFoundryScenery {
  private game: Game | null = null;
  private run = '';
  private room = '';
  private lastElapsed: number | null = null;
  private playing = false;
  private ended = false;
  private time = 0;
  private motion = 0;
  private previousPower = 1;
  private previousArea: AreaId | null = null;
  private seen = new Set<AreaId>();
  private entry = false;
  private farthest = ENTRY_X;
  private frame: LivingFoundryFrame | null = null;

  /** A deliberate lifecycle reset, separate from a camera/renderer reset. */
  reset() {
    this.game = null;
    this.run = this.room = '';
    this.lastElapsed = null;
    this.playing = this.ended = false;
    this.time = this.motion = 0;
    this.previousPower = 1;
    this.previousArea = null;
    this.seen.clear();
    this.entry = false;
    this.farthest = ENTRY_X;
    this.frame = null;
  }

  update(g: Game, reduced = false): LivingFoundryFrame | null {
    const now = clock(g.elapsed);
    const run = g.seed + (g.overtime ? ':overtime' : ':first');
    if (
      this.game !== g ||
      this.run !== run ||
      (g.mode === 'playing' && this.ended) ||
      (now !== null && this.lastElapsed !== null && now < this.lastElapsed - 0.02)
    ) {
      this.reset();
      this.game = g;
      this.run = run;
    }
    if (g.mode === 'title') {
      this.ended = true;
      this.lastElapsed = now;
      this.playing = false;
      return null;
    }
    if (!eligible(g)) {
      this.room = '';
      this.frame = null;
      this.lastElapsed = now;
      this.playing = false;
      return null;
    }
    const room = g.roomSeed + ':' + g.stage + ':' + g.level.id + ':' + Number(g.level.mirrored);
    const changed = room !== this.room;
    if (!changed && g.mode !== 'playing' && this.frame) {
      this.lastElapsed = now;
      this.playing = false;
      if (g.mode === 'dead' || g.mode === 'won') this.ended = true;
      return copy(this.frame);
    }
    const live = services(g);
    const requested = fixture(g);
    if (changed) {
      this.entry =
        !this.seen.has(g.level.area) &&
        requested?.scene !== 'machinery' &&
        (!!requested ||
          firstAreaRoom(g) ||
          (this.previousArea !== null && this.previousArea !== g.level.area));
      this.seen.add(g.level.area);
      this.previousArea = g.level.area;
      this.farthest = ENTRY_X;
      this.room = room;
      this.previousPower = live.power;
    }
    const active = g.mode === 'playing' && g.hp > 0;
    const delta =
      !changed && active && this.playing && now !== null && this.lastElapsed !== null
        ? Math.min(MAX_SAMPLE, Math.max(0, now - this.lastElapsed))
        : 0;
    if (!reduced) {
      this.time = Math.min(CLOCK_LIMIT, this.time + delta);
      // The minimum also prevents restoration from catching up an unpowered
      // interval on its first frame. New room cameras do not reset this phase.
      this.motion = Math.min(
        CLOCK_LIMIT,
        this.motion + delta * Math.min(this.previousPower, live.power),
      );
    }
    const exploredX =
      requested && g.level.mirrored ? g.worldWidth - g.player.position.x : g.player.position.x;
    if (active && Number.isFinite(exploredX))
      this.farthest = Math.max(this.farthest, Math.min(REVEALED_X, exploredX));
    const t = this.entry ? unit((this.farthest - ENTRY_X) / (REVEALED_X - ENTRY_X)) : 1;
    const reveal = t * t * (3 - 2 * t);
    this.frame = {
      area: g.level.area,
      variant: requested?.variant ?? variantFor(g.roomSeed + ':' + g.stage + ':' + g.level.id),
      room,
      time: this.time,
      motion: this.motion,
      ...live,
      reveal,
      revealing: this.entry && reveal < 1,
      mirrored: g.level.mirrored,
    };
    this.lastElapsed = now;
    this.previousPower = live.power;
    this.playing = active;
    if (g.mode === 'dead' || g.mode === 'won') this.ended = true;
    return copy(this.frame);
  }
}
