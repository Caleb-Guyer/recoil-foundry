import type { Enemy, Game, Shot } from './game.ts';
import { direction, distance, type Vec } from './rules.ts';

export const STASIS = { limit: 30, range: 118, hold: 2.5, trapLife: 4, trigger: 140, chain: 200 };
export interface StasisFlight {
  target: Vec;
  velocity: Vec;
  born: number;
  phase: 'setting' | 'parked' | 'queued' | 'released';
  launchAt?: number;
  batch?: number;
  order?: number;
}
interface Release {
  ids: number[];
  hits: Set<number>;
  until: number;
  spent?: boolean;
}
export const suspended = (s: Shot) => s.stasis?.phase === 'setting' || s.stasis?.phase === 'parked';
export const dormant = (s: Shot) => suspended(s) || s.stasis?.phase === 'queued';

export class StasisSystem {
  game: Game;
  held = false;
  private serial = 0;
  releases = new Map<number, Release>();
  constructor(game: Game) {
    this.game = game;
  }
  reset() {
    this.game.shots = this.game.shots.filter((s) => !dormant(s));
    this.releases.clear();
    this.held = false;
    this.serial = 0;
  }
  get stock() {
    return this.game.shots.filter((s) => suspended(s) && s.life > 0);
  }
  prepare(s: Shot) {
    const g = this.game;
    if (
      !g.mods.includes('suspension') ||
      !s.friendly ||
      s.fragment ||
      s.reflected ||
      s.echo ||
      s.rail
    )
      return;
    const stock = this.stock;
    if (stock.length >= STASIS.limit) {
      if (g.mods.includes('tripline')) stock[0].life = 0;
      else this.release([stock[0]]);
    }
    const velocity = { ...s.vel },
      angle =
        Math.atan2(s.vel.y, s.vel.x) +
        (g.mods.includes('crosshatch') ? ((stock.length % 5) - 2) * 0.14 : 0);
    const range =
      (g.mods.includes('tripline')
        ? Math.min(420, Math.max(70, distance(s.pos, g.aim) - 64))
        : STASIS.range) +
      (stock.length % 3) * 24;
    const target = { x: s.pos.x + Math.cos(angle) * range, y: s.pos.y + Math.sin(angle) * range };
    const speed = Math.hypot(s.vel.x, s.vel.y);
    s.vel = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
    s.stasis = { target, velocity, born: g.time, phase: 'setting' };
  }
  input(fire: boolean) {
    const g = this.game;
    if (!g.mods.includes('suspension')) return;
    if (!fire && this.held && !g.mods.includes('tripline')) this.release(this.stock);
    this.held = fire;
  }
  update() {
    const g = this.game;
    for (const s of g.shots)
      if (s.stasis?.phase === 'queued' && g.time >= s.stasis.launchAt!) s.stasis.phase = 'released';
    for (const [id, batch] of this.releases) if (batch.until < g.time) this.releases.delete(id);
    const traps = g.mods.includes('tripline');
    for (const s of this.stock) {
      const state = s.stasis!;
      if (g.time - state.born >= (traps ? STASIS.trapLife : STASIS.hold)) {
        if (traps) s.life = 0;
        else this.release([s]);
        continue;
      }
      if (state.phase !== 'parked') continue;
      // Parked rounds are not rigid bodies. Moving cover can consume them but
      // they can never obstruct a train, lift, enemy or player.
      if (distance(g.lineEnd(s.pos, { x: s.pos.x + 0.01, y: s.pos.y }, s.radius), s.pos) < 0.001) {
        s.life = 0;
        continue;
      }
      if (!traps) continue;
      const enemy = g.enemies
        .filter(
          (e) =>
            e.hp > 0 &&
            e.spawn <= 0 &&
            distance(e.body.position, s.pos) <= STASIS.trigger &&
            this.clear(s, e),
        )
        .sort(
          (a, b) =>
            distance(a.body.position, s.pos) - distance(b.body.position, s.pos) || a.id - b.id,
        )[0];
      if (!enemy) continue;
      const chain = g.mods.includes('chain-release')
        ? this.stock.filter(
            (other) =>
              other === s ||
              (other.stasis?.phase === 'parked' &&
                distance(other.pos, s.pos) <= STASIS.chain &&
                this.clear(other, enemy)),
          )
        : [s];
      this.release(chain, enemy.body.position);
    }
  }
  private clear(s: Shot, e: Enemy) {
    return distance(this.game.lineEnd(s.pos, e.body.position, s.radius), e.body.position) < 1;
  }
  release(shots: Shot[], target?: Vec) {
    const g = this.game;
    const rounds = shots.filter((s) => suspended(s) && s.life > 0);
    if (!rounds.length) return;
    const batch = ++this.serial;
    if (g.mods.includes('thread-the-needle')) {
      // One bounded record per release. Piercing or returning hits cannot add
      // extra credit to the same round.
      if (this.releases.size >= 32) this.releases.delete(this.releases.keys().next().value!);
      this.releases.set(batch, {
        ids: rounds.map((s) => s.id),
        hits: new Set(),
        until: g.time + 5,
      });
    }
    for (const [order, s] of rounds.entries()) {
      const state = s.stasis!;
      state.phase = 'released';
      state.batch = batch;
      state.order = order;
      if (
        g.mods.includes('thread-the-needle') &&
        rounds.length > 1 &&
        order === rounds.length - 1
      ) {
        state.phase = 'queued';
        state.launchAt = g.time + 0.12;
      }
      const aim = target ?? (g.mods.includes('crosshatch') ? g.aim : undefined);
      const d =
        aim && distance(s.pos, aim) > 1
          ? direction(s.pos, aim)
          : direction({ x: 0, y: 0 }, state.velocity);
      const speed = Math.hypot(state.velocity.x, state.velocity.y);
      s.vel = { x: d.x * speed, y: d.y * speed };
      s.prev = { ...s.pos };
      s.waypoints = undefined;
      if (s.trace) s.trace.points = [{ ...s.pos }];
      // Recall records actual travel after launch, never a shortcut from muzzle
      // through the parking spread; its returning route remains collision tested.
      if (s.recall?.route) s.recall.route = [{ pos: { ...s.pos } }];
    }
    g.onSound('loaded');
    g.burst(rounds[0].pos, 3, '#c3b4f0', 1.5);
  }
  abandon(s: Shot) {
    if (suspended(s)) s.stasis!.phase = 'released';
  }
  damage(s: Shot) {
    const state = s.stasis,
      batch = state?.batch && this.releases.get(state.batch);
    if (!batch || s.id !== batch.ids.at(-1) || batch.spent) return 1;
    batch.spent = true;
    let streak = 0;
    for (const id of batch.ids.slice(0, -1)) streak = batch.hits.has(id) ? streak + 1 : 0;
    return 1 + Math.min(1.5, streak * 0.25);
  }
  hit(s: Shot) {
    if (s.stasis?.batch) this.releases.get(s.stasis.batch)?.hits.add(s.id);
  }
}
