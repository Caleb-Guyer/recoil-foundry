import type Matter from 'matter-js';
import type { Game, Shot } from './game.ts';
import type { Prop } from './props.ts';
import { PROP_STATS } from './props.ts';
import type { Breakable } from './destruction.ts';
import type { Vec } from './rules.ts';
import { clamp } from './rules.ts';
import { firstSolid } from './collisions.ts';

export const MATERIAL_HIT_LIFE = 0.22;
export const MATERIAL_BREAK_LIFE = 1.15;
export const MATERIAL_BREAK_LIMIT = 24;
export const MATERIAL_HIT_LIMIT = 128;
export type MaterialKind = 'crate' | 'cover' | 'canister' | 'cargo' | 'wall' | 'shelf';
export type MaterialIdentity = 'wood' | 'steel' | 'casing' | 'freight' | 'masonry';
export interface MaterialHit {
  at: number;
  damage: number;
  /** Incoming direction in world coordinates; contact is local to the real hull. */
  direction: Vec | null;
  local: Vec | null;
}
export interface MaterialSnapshot {
  at: number;
  bodyId: number;
  source: 'prop' | 'terrain';
  kind: MaterialKind;
  position: Vec;
  angle: number;
  velocity: Vec;
  angularVelocity: number;
  width: number;
  height: number;
  vertices: Vec[];
  hp: number;
  maxHp: number;
  wear: 0 | 1 | 2;
  hit: MaterialHit | null;
  armedAt: number;
  detonateAt: number;
  throwUntil: number;
}
export interface MaterialPose {
  /** Only flexible surface hardware may use these; the real collision hull never moves. */
  offset: Vec;
  angle: number;
  hitStrength: number;
  hitLocal: Vec | null;
  hitDirection: Vec | null;
  wear: 0 | 1 | 2;
  canister: 'sealed' | 'grace' | 'armed' | 'impact';
  arming: number;
  alpha: number;
}
export interface MaterialFragment {
  material: MaterialIdentity;
  shape: 'board' | 'plate' | 'cap' | 'chip' | 'strut';
  /** Detached world positions and cosmetic pixels/second, never Matter bodies. */
  position: Vec;
  velocity: Vec;
  angle: number;
  spin: number;
  size: Vec;
}
export interface MaterialFragmentPose {
  material: MaterialIdentity;
  shape: MaterialFragment['shape'];
  position: Vec;
  angle: number;
  size: Vec;
  alpha: number;
}
export interface MaterialBreak {
  at: number;
  age: number;
  /** Remaining simulation seconds, not a duration or a wall clock. */
  life: number;
  cause: 'fracture' | 'explosion';
  snapshot: MaterialSnapshot;
  fragments: MaterialFragment[];
}
const copy = (v: Vec): Vec => ({ x: v.x, y: v.y });
const rotate = (v: Vec, angle: number): Vec => ({
  x: v.x * Math.cos(angle) - v.y * Math.sin(angle),
  y: v.x * Math.sin(angle) + v.y * Math.cos(angle),
});
const finiteVec = (v: Vec | null | undefined): v is Vec =>
  !!v && Number.isFinite(v.x) && Number.isFinite(v.y);
const copyHit = (hit: MaterialHit | undefined | null): MaterialHit | null =>
  hit
    ? {
        ...hit,
        direction: hit.direction && copy(hit.direction),
        local: hit.local && copy(hit.local),
      }
    : null;
export function ordinaryMaterialProp(p: Prop): boolean {
  return (
    !p.hunt &&
    !p.uprising &&
    !p.auditCase &&
    !p.welded &&
    !p.charge &&
    ['crate', 'cover', 'canister', 'cargo'].includes(p.kind)
  );
}
function healthWear(hp: number, maxHp: number): 0 | 1 | 2 {
  if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || maxHp <= 0) return 0;
  return hp <= maxHp * 0.3 ? 2 : hp <= maxHp * 0.65 ? 1 : 0;
}
function contact(body: Matter.Body, velocity: Vec, source?: Shot) {
  if (!finiteVec(velocity) || Math.hypot(velocity.x, velocity.y) < 1e-9)
    return { direction: null, local: null };
  const length = Math.hypot(velocity.x, velocity.y),
    direction = { x: velocity.x / length, y: velocity.y / length },
    radius =
      Math.hypot(body.bounds.max.x - body.bounds.min.x, body.bounds.max.y - body.bounds.min.y) + 4,
    from =
      source && finiteVec(source.pos)
        ? copy(source.pos)
        : {
            x: body.position.x - direction.x * radius,
            y: body.position.y - direction.y * radius,
          },
    to = { x: from.x + direction.x * radius * 3, y: from.y + direction.y * radius * 3 },
    hit = firstSolid(from, to, { x: 0, y: 0 }, [body]);
  let local: Vec | null = null;
  if (hit) {
    const point = { x: from.x + (to.x - from.x) * hit.t, y: from.y + (to.y - from.y) * hit.t };
    local = rotate({ x: point.x - body.position.x, y: point.y - body.position.y }, -body.angle);
  } else if (
    source &&
    finiteVec(source.pos) &&
    Number.isFinite(source.radius) &&
    source.radius > 0
  ) {
    // A native swept round may graze the hull with its radius while its centre
    // ray misses entirely. Project that accepted centre to the real local face;
    // never retrace gameplay or invent a contact from a distant damage source.
    const centre = rotate(
        { x: source.pos.x - body.position.x, y: source.pos.y - body.position.y },
        -body.angle,
      ),
      vertices = body.vertices.map((v) =>
        rotate({ x: v.x - body.position.x, y: v.y - body.position.y }, -body.angle),
      ),
      nearest = {
        x: clamp(
          centre.x,
          Math.min(...vertices.map((v) => v.x)),
          Math.max(...vertices.map((v) => v.x)),
        ),
        y: clamp(
          centre.y,
          Math.min(...vertices.map((v) => v.y)),
          Math.max(...vertices.map((v) => v.y)),
        ),
      };
    if (
      Math.max(Math.abs(nearest.x - centre.x), Math.abs(nearest.y - centre.y)) <=
      source.radius + 1e-6
    )
      local = nearest;
  }
  return { direction, local };
}
export function materialPropSnapshot(g: Game, p: Prop): MaterialSnapshot | null {
  return g.materialResponse.snapshotProp(p);
}
export function materialTerrainSnapshot(g: Game, piece: Breakable): MaterialSnapshot | null {
  return g.materialResponse.snapshotTerrain(piece);
}
/** Reading a pose is pure: health, arming and contact always come from the native snapshot. */
export function materialPose(s: MaterialSnapshot, time = s.at, reduced = false): MaterialPose {
  const age = Math.max(0, time - (s.hit?.at ?? -100)),
    hitStrength =
      !reduced && s.hit && age < MATERIAL_HIT_LIFE
        ? (1 - age / MATERIAL_HIT_LIFE) * clamp(s.hit.damage / 60, 0.15, 1)
        : 0,
    localDirection = s.hit?.direction ? rotate(s.hit.direction, -s.angle) : { x: 0, y: 0 },
    armed = s.kind === 'canister' && Number.isFinite(s.armedAt),
    canister = !armed
      ? 'sealed'
      : time < s.armedAt
        ? 'grace'
        : Number.isFinite(s.detonateAt)
          ? 'impact'
          : 'armed';
  return {
    offset: { x: localDirection.x * hitStrength * 1.4, y: localDirection.y * hitStrength * 1.4 },
    angle: localDirection.x * hitStrength * 0.025,
    hitStrength,
    hitLocal: s.hit?.local ? copy(s.hit.local) : null,
    hitDirection: s.hit?.direction ? copy(s.hit.direction) : null,
    wear: s.wear,
    canister,
    arming: armed ? clamp((time - s.armedAt + 0.06) / 0.06, 0, 1) : 0,
    alpha: 1,
  };
}
const materials: Record<MaterialKind, MaterialIdentity> = {
  crate: 'wood',
  cover: 'steel',
  canister: 'casing',
  cargo: 'freight',
  wall: 'masonry',
  shelf: 'steel',
};
function fragments(s: MaterialSnapshot, cause: MaterialBreak['cause']): MaterialFragment[] {
  const count = s.kind === 'cargo' ? 8 : s.kind === 'cover' ? 5 : 6,
    material = materials[s.kind],
    impact = s.hit?.direction ?? { x: 0, y: 0 },
    incoming = { x: clamp(s.velocity.x * 12, -90, 90), y: clamp(s.velocity.y * 12, -90, 90) };
  return Array.from({ length: count }, (_, i) => {
    const side = i % 2 ? 1 : -1,
      row = Math.floor(i / 2),
      local = {
        x: side * s.width * 0.22,
        y: ((row + 0.5) / Math.ceil(count / 2) - 0.5) * s.height * 0.7,
      },
      offset = rotate(local, s.angle),
      blast = cause === 'explosion' ? 1.45 : 1,
      shape: MaterialFragment['shape'] =
        s.kind === 'crate'
          ? 'board'
          : s.kind === 'wall'
            ? 'chip'
            : s.kind === 'shelf'
              ? 'strut'
              : s.kind === 'canister' && row === 0
                ? 'cap'
                : 'plate';
    return {
      material,
      shape,
      position: { x: s.position.x + offset.x, y: s.position.y + offset.y },
      velocity: {
        x: incoming.x + impact.x * 24 + side * (24 + row * 11) * blast,
        y: incoming.y + impact.y * 18 - (24 + row * 9) * blast,
      },
      angle: s.angle + side * row * 0.12,
      spin: side * (0.6 + row * 0.3),
      size: {
        x: Math.min(s.kind === 'wall' ? 12 : 22, s.width * (shape === 'board' ? 0.42 : 0.22)),
        y: Math.min(shape === 'strut' ? 6 : 12, s.height * 0.16),
      },
    };
  });
}
/** Inert, short-lived fragments are visibly separate from native solid rubble. */
export function materialBreakPose(
  record: MaterialBreak,
  time = record.at + record.age,
  reduced = false,
) {
  const age = clamp(time - record.at, 0, MATERIAL_BREAK_LIFE),
    t = reduced ? 0.12 : age,
    alpha =
      age >= MATERIAL_BREAK_LIFE
        ? 0
        : reduced
          ? 0.65
          : clamp((MATERIAL_BREAK_LIFE - age) / 0.3, 0, 1);
  return {
    age,
    alpha,
    fragments: record.fragments.map(
      (f): MaterialFragmentPose => ({
        material: f.material,
        shape: f.shape,
        position: {
          x: f.position.x + f.velocity.x * t,
          y: f.position.y + f.velocity.y * t + 90 * t * t,
        },
        angle: f.angle + f.spin * t,
        size: copy(f.size),
        alpha,
      }),
    ),
  };
}
/** Transient observer only. It never allocates a physics body or consumes any random source. */
export class MaterialResponse {
  readonly game: Game;
  enabled = true;
  breaks: MaterialBreak[] = [];
  private hits = new Map<number, MaterialHit>();
  constructor(game: Game) {
    this.game = game;
  }
  reset(source?: MaterialSnapshot['source']) {
    if (!source) {
      this.breaks = [];
      this.hits.clear();
      return;
    }
    this.breaks = this.breaks.filter((b) => b.snapshot.source !== source);
    const ids =
      source === 'prop'
        ? this.game.props.items.map((p) => p.body.id)
        : this.game.destruction.pieces.map((p) => p.body.id);
    for (const id of ids) this.hits.delete(id);
  }
  forget(bodyId: number) {
    this.hits.delete(bodyId);
  }
  private snapshot(
    body: Matter.Body,
    kind: MaterialKind,
    source: MaterialSnapshot['source'],
    hp: number,
    maxHp: number,
    width: number,
    height: number,
  ): MaterialSnapshot {
    return {
      at: this.game.time,
      bodyId: body.id,
      source,
      kind,
      position: copy(body.position),
      angle: body.angle,
      velocity: copy(body.velocity),
      angularVelocity: body.angularVelocity,
      width,
      height,
      vertices: body.vertices.map(copy),
      hp,
      maxHp,
      wear: healthWear(hp, maxHp),
      hit: copyHit(this.enabled ? this.hits.get(body.id) : null),
      armedAt: Infinity,
      detonateAt: Infinity,
      throwUntil: 0,
    };
  }
  snapshotProp(p: Prop): MaterialSnapshot | null {
    if (!ordinaryMaterialProp(p) || !this.game.props.items.includes(p)) return null;
    const s = this.snapshot(
      p.body,
      p.kind as MaterialKind,
      'prop',
      p.hp,
      p.maxHp,
      PROP_STATS[p.kind].w,
      PROP_STATS[p.kind].h,
    );
    s.armedAt = p.armedAt;
    s.detonateAt = p.detonateAt;
    s.throwUntil = p.throwUntil ?? 0;
    return s;
  }
  snapshotTerrain(piece: Breakable): MaterialSnapshot | null {
    if (!this.game.destruction.pieces.includes(piece)) return null;
    return this.snapshot(
      piece.body,
      piece.rect.h <= 28 ? 'shelf' : 'wall',
      'terrain',
      piece.hp,
      piece.maxHp,
      piece.rect.w,
      piece.rect.h,
    );
  }
  propHit(p: Prop, damage: number, velocity: Vec, source?: Shot) {
    if (this.enabled && ordinaryMaterialProp(p) && this.game.props.items.includes(p))
      this.hit(p.body, damage, velocity, source);
  }
  terrainHit(piece: Breakable, damage: number, velocity: Vec, source?: Shot) {
    if (this.enabled && this.game.destruction.pieces.includes(piece))
      this.hit(piece.body, damage, velocity, source);
  }
  private hit(body: Matter.Body, damage: number, velocity: Vec, source?: Shot) {
    if (this.game.mode !== 'playing' || !Number.isFinite(damage) || damage <= 0) return;
    this.hits.delete(body.id);
    this.hits.set(body.id, { at: this.game.time, damage, ...contact(body, velocity, source) });
    while (this.hits.size > MATERIAL_HIT_LIMIT) this.hits.delete(this.hits.keys().next().value!);
  }
  propBreak(p: Prop, cause: MaterialBreak['cause']) {
    if (!this.enabled || this.game.mode !== 'playing') return;
    const snapshot = this.snapshotProp(p);
    if (snapshot) this.broken(snapshot, cause);
  }
  terrainBreak(piece: Breakable) {
    if (!this.enabled || this.game.mode !== 'playing') return;
    const snapshot = this.snapshotTerrain(piece);
    if (snapshot) this.broken(snapshot, 'fracture');
  }
  private broken(snapshot: MaterialSnapshot, cause: MaterialBreak['cause']) {
    if (this.breaks.some((b) => b.snapshot.bodyId === snapshot.bodyId)) return;
    this.breaks.push({
      at: this.game.time,
      age: 0,
      life: MATERIAL_BREAK_LIFE,
      cause,
      snapshot,
      fragments: fragments(snapshot, cause),
    });
    if (this.breaks.length > MATERIAL_BREAK_LIMIT)
      this.breaks.splice(0, this.breaks.length - MATERIAL_BREAK_LIMIT);
    this.hits.delete(snapshot.bodyId);
  }
  update() {
    if (!this.enabled) {
      this.reset();
      return;
    }
    const time = this.game.time;
    for (const record of this.breaks) {
      record.age = Math.max(0, time - record.at);
      record.life = Math.max(0, MATERIAL_BREAK_LIFE - record.age);
    }
    this.breaks = this.breaks.filter((r) => r.life > 0);
    for (const [id, hit] of this.hits) if (time - hit.at >= MATERIAL_HIT_LIFE) this.hits.delete(id);
  }
}
