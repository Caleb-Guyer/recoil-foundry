import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Level } from './levels.ts';
import type { Prop } from './props.ts';
import { PROP_STATS } from './props.ts';
import { firstSolid } from './collisions.ts';
import { clamp, segmentBox, type Checkpoint, type Vec } from './rules.ts';
import { planSortingPit, sortingPitLevel } from './sorting-pit-layout.ts';

const { Body } = Matter;
export const SORTING = {
  rest: 3.2,
  lift: 3.6,
  hold: 0.7,
  warning: 1.15,
  manualWarning: 0.85,
  drop: 2.4,
  radius: 23,
  limit: 6,
  playerDamage: 22,
  enemyDamage: 160,
};
type Lifted = { prop: Prop; x: number; y: number };
type Drop = { until: number; hits: Set<number> };

export class SortingPitSystem {
  game: Game;
  stage: number | null = null;
  active = false;
  phase: 'rest' | 'lift' | 'hold' | 'warning' | 'drop' | 'done' = 'done';
  timer = 0;
  flash = 0;
  held: Lifted[] = [];
  drops = new Map<Prop, Drop>();
  constructor(game: Game) {
    this.game = game;
  }
  get coil(): Vec {
    return { x: this.game.level.mirrored ? 1350 : 650, y: 278 };
  }
  get exposed() {
    return this.active && !this.game.clear && (this.phase === 'lift' || this.phase === 'hold');
  }
  start(save?: Checkpoint) {
    const g = this.game;
    this.stage = save
      ? (save.sortingPit ?? null)
      : planSortingPit(g.seed, {
          areaEvent: g.areaEvents.state ?? undefined,
          courier: g.courier.state ?? undefined,
          story: g.story.state ?? undefined,
          auditor: g.auditor.state ?? undefined,
        });
  }
  level(source: Level) {
    const g = this.game;
    if (
      this.stage !== g.stage ||
      g.practice ||
      g.workshop.active ||
      g.detour ||
      g.escape ||
      g.overtime ||
      source.courier ||
      source.story ||
      g.areaEvents.state?.area === 3 ||
      (g.testRun && !g.seed.startsWith('SORTING-PIT-'))
    )
      return source;
    return sortingPitLevel(g.seed);
  }
  clear() {
    this.active = false;
    this.phase = 'done';
    this.timer = this.flash = 0;
    this.held = [];
    this.drops.clear();
  }
  reset(cleared: boolean) {
    this.clear();
    if (!this.game.level.sortingPit) return;
    this.active = true;
    this.phase = cleared ? 'done' : 'rest';
    this.timer = SORTING.rest;
  }
  trigger() {
    if (this.game.mode !== 'playing' || !this.exposed || !this.held.length) return false;
    this.flash = 0.24;
    this.warn(SORTING.manualWarning);
    this.game.burst(this.coil, 12, '#a9dace', 3);
    return true;
  }
  trace(from: Vec, to: Vec, radius = 0) {
    if (!this.exposed) return null;
    const p = this.coil,
      r = SORTING.radius + radius;
    return segmentBox(from, to, { x: p.x - r, y: p.y - r }, { x: p.x + r, y: p.y + r });
  }
  private warn(time: number) {
    this.phase = 'warning';
    this.timer = time;
    // Freeze target heights, not physical bodies. Contacts still resolve normally.
    for (const item of this.held) item.y = item.prop.body.position.y;
    this.game.onSound('sorting-warn');
  }
  private collect() {
    const g = this.game;
    this.held = g.props.items
      .filter(
        (p) =>
          ['crate', 'rubble', 'cover'].includes(p.kind) &&
          !p.body.isStatic &&
          !p.welded &&
          !p.auditCase &&
          p.body.position.x >= 670 &&
          p.body.position.x <= 1330 &&
          p.body.position.y > 245 &&
          (p.throwUntil ?? 0) < g.time &&
          !g.enemies.some((e) => e.scrapper?.held === p) &&
          !firstSolid(
            p.body.position,
            { x: p.body.position.x, y: 248 },
            { x: PROP_STATS[p.kind].w / 2 + 2, y: PROP_STATS[p.kind].h / 2 + 2 },
            g.terrainBodies.filter(
              (b) => b.bounds.min.y < p.body.position.y + PROP_STATS[p.kind].h / 2 - 2,
            ),
          ),
      )
      .slice(0, SORTING.limit)
      .map((prop) => ({ prop, x: prop.body.position.x, y: 248 }));
    if (this.held.length) {
      this.phase = 'lift';
      this.timer = SORTING.lift;
      g.onSound('sorting-lift');
    } else this.timer = SORTING.rest;
  }
  update(dt: number) {
    const g = this.game;
    if (!this.active || g.mode !== 'playing' || !(dt > 0)) return;
    this.flash = Math.max(0, this.flash - dt);
    for (const [p, drop] of this.drops)
      if (!g.props.items.includes(p) || drop.until <= g.time) this.drops.delete(p);
    if (g.clear || (!g.combatEnemyCount && !g.waves.pending && !g.mutations.pending.length)) {
      this.phase = 'done';
      this.held = [];
      this.drops.clear();
      return;
    }
    if (this.phase === 'done') return;
    this.held = this.held.filter(
      ({ prop: p, x }) =>
        g.props.items.includes(p) &&
        !p.body.isStatic &&
        Math.abs(p.body.position.x - x) < 85 &&
        p.body.position.y > 195 &&
        !g.enemies.some((e) => e.scrapper?.held === p),
    );
    this.timer -= dt;
    if (this.timer <= 1e-8) {
      if (this.phase === 'rest') this.collect();
      else if (this.phase === 'lift') {
        this.phase = 'hold';
        this.timer = SORTING.hold;
      } else if (this.phase === 'hold') this.warn(SORTING.warning);
      else if (this.phase === 'warning') {
        for (const { prop: p } of this.held) {
          Body.setVelocity(p.body, { x: clamp(p.body.velocity.x, -1, 1), y: 7 });
          this.drops.set(p, { until: g.time + SORTING.drop, hits: new Set() });
        }
        if (this.held.length) g.onSound('sorting-drop');
        this.held = [];
        this.phase = 'drop';
        this.timer = SORTING.drop;
      } else {
        this.phase = 'rest';
        this.timer = SORTING.rest;
      }
    }
    for (const { prop: p, x, y } of this.held) {
      const b = p.body,
        pos = b.position;
      const blocked = firstSolid(
        pos,
        { x, y },
        { x: PROP_STATS[p.kind].w / 2 + 2, y: PROP_STATS[p.kind].h / 2 + 2 },
        g.terrainBodies.filter((b) => b.bounds.min.y < pos.y + PROP_STATS[p.kind].h / 2 - 2),
      );
      if (blocked) continue;
      g.harpoons.disrupt(b);
      // Only loose props receive force. Never move the player, enemies or shots.
      Body.applyForce(b, pos, { x: 0, y: -b.mass * g.engine.gravity.y * g.engine.gravity.scale });
      Body.setVelocity(b, {
        x: clamp((x - pos.x) * 0.05, -1.5, 1.5),
        y: clamp((y - pos.y) * 0.07, -4.5, 2),
      });
      Body.setAngularVelocity(b, b.angularVelocity * 0.75);
    }
  }
  landing(prop: Prop) {
    const p = prop.body.position,
      half = PROP_STATS[prop.kind];
    const hit = firstSolid(
      p,
      { x: p.x, y: 790 },
      { x: half.w / 2, y: half.h / 2 },
      this.game.terrainBodies,
    );
    return { x: p.x, y: hit ? p.y + (790 - p.y) * hit.t + half.h / 2 : 740, w: half.w + 26 };
  }
  impact(prop: Prop, other: Matter.Body, speed: number) {
    const drop = this.drops.get(prop),
      g = this.game;
    if (!drop || !this.active || g.clear || g.mode !== 'playing') return false;
    // Settled scrap is ordinary cover, even if someone later jumps onto it.
    if (other.isStatic && prop.velocity.y > 0 && other.bounds.min.y >= prop.body.position.y) {
      this.drops.delete(prop);
      if (speed >= 5) {
        g.onSound('cargo-impact');
        g.feedback(2.5);
      }
      return true;
    }
    if (speed < 5 || prop.velocity.y < 5 || drop.hits.has(other.id)) return true;
    drop.hits.add(other.id);
    if (other === g.player)
      g.damagePlayer(SORTING.playerDamage, prop.body.position, { type: 'cargo' });
    else {
      const e = g.enemies.find((e) => e.body === other);
      if (e && e.hp > 0 && e.spawn <= 0)
        g.hitEnemy(e, Math.min(SORTING.enemyDamage, speed * 16), undefined, true, true);
      else {
        const p = g.props.items.find((p) => p.body === other);
        if (p) g.props.hit(p, Math.min(80, speed * 6), prop.velocity);
      }
    }
    if (g.mode === 'playing') {
      g.onSound('cargo-impact');
      g.feedback(3);
    }
    return true;
  }
}
