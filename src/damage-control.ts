import type { Vec } from './rules.ts';
import { damageCauseText, loadDamageCause, type DamageCause } from './damage-cause.ts';

// Match the existing accepted-hit gate; presentation never extends protection.
export const DAMAGE_RECOVERY = 0.75;
export const DAMAGE_HISTORY_LIMIT = 64;
export interface DamageHit {
  readonly id: number;
  readonly at: number;
  readonly elapsed: number;
  readonly damage: number;
  readonly hpBefore: number;
  readonly hpAfter: number;
  readonly player: Vec;
  readonly origin?: Vec;
  readonly direction?: Vec;
  readonly cause: DamageCause;
}
export interface DamageRoomSummary {
  damage: number;
  hits: number;
  sources: { cause: DamageCause; damage: number; hits: number }[];
}
export interface DamageHitInput {
  at: number;
  elapsed: number;
  hpBefore: number;
  hpAfter: number;
  player: Vec;
  origin?: Vec;
  direction?: Vec;
  cause: DamageCause;
}
const point = (value: Vec | undefined): Vec | undefined =>
  value && Number.isFinite(value.x) && Number.isFinite(value.y)
    ? { x: value.x, y: value.y }
    : undefined;

// One current room visit, in memory only. A continued room starts a fresh visit.
// Totals retain every accepted hit; only visual/replay detail has a fixed cap.
export class DamageControl {
  private history: DamageHit[] = [];
  private totalDamage = 0;
  private totalHits = 0;
  private serial = 0;
  private sources = new Map<string, DamageRoomSummary['sources'][number]>();
  get hits(): readonly DamageHit[] {
    return this.history;
  }
  get lastHit(): DamageHit | null {
    return this.history.at(-1) ?? null;
  }
  reset() {
    this.history = [];
    this.totalDamage = this.totalHits = this.serial = 0;
    this.sources.clear();
  }
  record(input: DamageHitInput): DamageHit | null {
    const player = point(input.player);
    if (
      !player ||
      ![input.at, input.elapsed, input.hpBefore, input.hpAfter].every(Number.isFinite) ||
      input.at < 0 ||
      input.elapsed < 0 ||
      input.hpAfter < 0 ||
      input.hpBefore <= input.hpAfter
    )
      return null;
    const cause = loadDamageCause(input.cause);
    const origin = cause.type === 'fall' ? undefined : point(input.origin);
    const rawDirection = cause.type === 'fall' ? undefined : point(input.direction);
    const length = rawDirection ? Math.hypot(rawDirection.x, rawDirection.y) : 0;
    const direction =
      rawDirection && length > 0.001 && Number.isFinite(length)
        ? { x: rawDirection.x / length, y: rawDirection.y / length }
        : undefined;
    const hit: DamageHit = Object.freeze({
      id: ++this.serial,
      at: input.at,
      elapsed: input.elapsed,
      hpBefore: input.hpBefore,
      hpAfter: input.hpAfter,
      damage: input.hpBefore - input.hpAfter,
      player: Object.freeze(player),
      ...(origin ? { origin: Object.freeze(origin) } : {}),
      ...(direction ? { direction: Object.freeze(direction) } : {}),
      cause: Object.freeze(cause),
    });
    this.history.push(hit);
    if (this.history.length > DAMAGE_HISTORY_LIMIT) this.history.shift();
    this.totalDamage += hit.damage;
    this.totalHits++;
    const key = cause.type + ':' + (cause.enemy ?? '');
    const source = this.sources.get(key) ?? { cause: { ...cause }, damage: 0, hits: 0 };
    source.damage += hit.damage;
    source.hits++;
    this.sources.set(key, source);
    return hit;
  }
  summary(): DamageRoomSummary {
    return {
      damage: this.totalDamage,
      hits: this.totalHits,
      sources: [...this.sources.values()]
        .map((source) => ({ ...source, cause: { ...source.cause } }))
        .sort(
          (a, b) =>
            b.damage - a.damage || damageCauseText(a.cause).localeCompare(damageCauseText(b.cause)),
        ),
    };
  }
}

// Health-loss trail is presentation only and follows the paused game clock.
export function damageHealthTrail(hit: DamageHit | null, now: number, hp: number) {
  const health = Number.isFinite(hp) ? Math.max(0, Math.min(100, hp)) : 0;
  if (!hit || !Number.isFinite(now)) return health;
  const age = now - hit.at;
  if (age < 0 || age >= 0.65) return health;
  const t = Math.max(0, Math.min(1, (age - 0.12) / 0.53));
  const trail = hit.hpBefore + (hit.hpAfter - hit.hpBefore) * t;
  return Math.max(health, Math.min(100, trail));
}
