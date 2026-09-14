import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Portal } from './portals.ts';
import { traceTorch, TORCH, type TorchOrigin, type TorchSegment } from './torch.ts';
import { firstSolid } from './collisions.ts';
import { wireCrossing } from './tripwire.ts';
import { distance, type Vec } from './rules.ts';

export const RESONATOR = { delay: 0.22, power: 0.6, limit: 4, flash: 0.16 };
interface Resonance {
  id: number;
  origin: TorchOrigin;
  at: number;
  damage: number;
  heatDamage: number;
  target?: number;
  portals: (Portal | null)[];
}
export class ResonatorSystem {
  game: Game;
  pending: Resonance[] = [];
  effects: { at: number; segments: TorchSegment[] }[] = [];
  constructor(game: Game) {
    this.game = game;
  }
  reset() {
    this.pending = [];
    this.effects = [];
  }
  record(
    id: number,
    origin: TorchOrigin,
    damage: number,
    target: number | undefined,
    hot: number,
    end: number,
  ) {
    const g = this.game;
    if (!g.mods.includes('resonator') || !g.portals.linked || damage <= 0) return;
    let repeat = this.pending.find((p) => p.id === id);
    if (!repeat) {
      repeat = {
        id,
        origin: structuredClone(origin),
        at: end + RESONATOR.delay,
        damage: 0,
        heatDamage: 0,
        target,
        portals: [...g.portals.pair],
      };
      this.pending.push(repeat);
      if (this.pending.length > RESONATOR.limit) this.pending.shift();
    }
    // Accumulate only the lit portion that really crossed a portal. Tapping,
    // banks, rear fire and rendered segments cannot mint a second discharge.
    repeat.damage += damage * RESONATOR.power;
    if (target === repeat.target) repeat.heatDamage += damage * (hot - 1) * RESONATOR.power;
  }
  update() {
    const g = this.game;
    if (g.mode !== 'playing' || g.hitStop > 0 || g.escape?.phase === 'extracting') return;
    this.effects = this.effects.filter((e) => g.time - e.at < RESONATOR.flash);
    this.pending = this.pending.filter(
      (p) => g.portals.linked && p.portals.every((end, i) => g.portals.pair[i] === end),
    );
    const due = this.pending.filter((p) => p.at <= g.time);
    this.pending = this.pending.filter((p) => p.at > g.time);
    for (const p of due) {
      if (g.mode !== 'playing') return;
      // Retrace current cover from the frozen exit and aim. The portal gap has
      // no beam; spent bank, range and penetration budgets remain spent.
      const segments = traceTorch(g, false, 0, TORCH.segments, { used: true }, p.origin);
      this.effects.push({ at: g.time, segments });
      if (this.effects.length > RESONATOR.limit) this.effects.shift();
      const hit = new Set<object>();
      for (const s of segments) {
        if (g.mode !== 'playing') return;
        const body = s.body ?? s.cable ?? s.anchor ?? s.valve;
        if (!body || hit.has(body)) continue;
        hit.add(body);
        const damage = (p.damage + (s.enemy?.id === p.target ? p.heatDamage : 0)) * s.gain;
        if (s.enemy)
          g.hitEnemy(s.enemy, damage, {
            x: s.enemy.body.position.x - s.dir.x * 30,
            y: s.enemy.body.position.y - s.dir.y * 30,
          });
        else if (s.prop) g.props.hit(s.prop, damage, s.dir);
        else if (s.cable) g.cargo.cut(s.cable, damage);
        else if (s.anchor) g.harpoons.hitAnchor(s.anchor, damage);
        else if (s.valve) g.pressure.trigger(s.valve);
        else if (s.body) {
          g.counterweights.hit(s.body, s.b, s.dir, damage);
          g.breaches.hitBody(s.body, damage, s.dir);
          g.destruction.hitBody(s.body, damage, s.dir);
        }
      }
      // Secondary energy never grants cells, recoil, deflections, arcs or echoes.
      g.onSound('echo-shot');
    }
  }
}

export const STORM_CELL = {
  limit: 3,
  life: 1.3,
  assembly: 1.5,
  arm: 0.12,
  range: 420,
  power: 0.5,
  radius: 0.72,
};
interface StormNode {
  body: Matter.Body;
  local: Vec;
  pos: Vec;
}
export interface StormCell {
  id: number;
  nodes: StormNode[];
  damage: number;
  expires: number;
  armed: number;
  hits: Set<number>;
  links: { a: Vec; b: Vec }[];
}
export class StormCellSystem {
  game: Game;
  cells: StormCell[] = [];
  private serial = 0;
  private starts = new Map<Matter.Body, Vec>();
  private cover = new Map<Matter.Body, Vec[]>();
  private soundAt = -1;
  constructor(game: Game) {
    this.game = game;
  }
  reset() {
    this.cells = [];
    this.starts.clear();
    this.cover.clear();
    this.soundAt = -1;
  }
  create(damage: number) {
    const g = this.game;
    if (!g.mods.includes('storm-cell') || g.mode !== 'playing') return undefined;
    this.cells = this.cells.filter((c) => c.expires > g.time);
    // Protect assembling and live cells. Replacing one on every impact would
    // prevent rapid-fire guns from ever landing their first pair of nodes.
    if (this.cells.length >= STORM_CELL.limit) return undefined;
    const cell: StormCell = {
      id: ++this.serial,
      nodes: [],
      damage: damage * STORM_CELL.power,
      expires: g.time + STORM_CELL.assembly,
      armed: Infinity,
      hits: new Set(),
      links: [],
    };
    this.cells.push(cell);
    return cell.id;
  }
  land(id: number | undefined, pos: Vec, body: Matter.Body, normal: Vec) {
    const g = this.game,
      cell = this.cells.find((c) => c.id === id);
    if (
      !cell ||
      cell.nodes.length >= 3 ||
      !g.terrainBodies.includes(body) ||
      cell.expires <= g.time
    )
      return;
    const point = { x: pos.x + normal.x * 2, y: pos.y + normal.y * 2 };
    if (cell.nodes.some((n) => distance(n.pos, point) < 12)) return;
    const dx = point.x - body.position.x,
      dy = point.y - body.position.y,
      a = -body.angle;
    cell.nodes.push({
      body,
      pos: point,
      local: { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) },
    });
    if (cell.nodes.length === 2) {
      cell.armed = g.time + STORM_CELL.arm;
      cell.expires = cell.armed + STORM_CELL.life;
    }
  }
  private blockers() {
    const g = this.game;
    return [
      ...g.solidBodies,
      ...g.enemies.flatMap((e) => (e.crane && e.spawn <= 0 ? [e.crane.body] : [])),
    ];
  }
  beforeStep() {
    this.starts.clear();
    this.cover.clear();
    if (!this.cells.length) return;
    for (const e of this.game.enemies) this.starts.set(e.body, { ...e.body.position });
    for (const b of this.blockers())
      this.cover.set(
        b,
        b.vertices.map((v) => ({ x: v.x, y: v.y })),
      );
  }
  teleported(body: Matter.Body) {
    if (this.starts.has(body)) this.starts.set(body, { ...body.position });
    if (this.cover.has(body))
      this.cover.set(
        body,
        body.vertices.map((v) => ({ x: v.x, y: v.y })),
      );
  }
  afterStep() {
    const g = this.game;
    if (g.mode !== 'playing' || g.hitStop > 0 || g.escape?.phase === 'extracting') return;
    this.cells = this.cells.filter((c) => c.expires > g.time);
    const blockers = this.blockers();
    for (const cell of [...this.cells]) {
      cell.nodes = cell.nodes.filter((n) => g.terrainBodies.includes(n.body));
      for (const n of cell.nodes) {
        const a = n.body.angle;
        n.pos = {
          x: n.body.position.x + n.local.x * Math.cos(a) - n.local.y * Math.sin(a),
          y: n.body.position.y + n.local.x * Math.sin(a) + n.local.y * Math.cos(a),
        };
      }
      cell.links = [];
      for (let i = 0; i < cell.nodes.length; i++)
        for (let j = i + 1; j < cell.nodes.length; j++) {
          const a = cell.nodes[i].pos,
            b = cell.nodes[j].pos;
          if (distance(a, b) > STORM_CELL.range || firstSolid(a, b, { x: 1, y: 1 }, blockers))
            continue;
          // A moving train or prop can cut the link anywhere along its sweep.
          if (
            blockers.some((body) => {
              const old = this.cover.get(body);
              if (
                !old ||
                old.every((v, k) => body.vertices[k] && distance(v, body.vertices[k]) < 0.01)
              )
                return false;
              const vertices = Matter.Vertices.hull([...old, ...body.vertices] as Matter.Vertex[]);
              return !!firstSolid(a, b, { x: 1, y: 1 }, [{ ...body, vertices }]);
            })
          )
            continue;
          cell.links.push({ a, b });
        }
      if (g.time < cell.armed) continue;
      // Snapshot all visible contacts before damage can destroy cover. A cell
      // hits each enemy once across all links, with normal armor and no procs.
      const contacts = g.enemies
        .filter((e) => e.hp > 0 && e.spawn <= 0 && !cell.hits.has(e.id))
        .flatMap((enemy) => {
          for (const link of cell.links) {
            const crossing = wireCrossing(
              link.a,
              link.b,
              enemy.body,
              this.starts.get(enemy.body) ?? enemy.body.position,
            );
            if (crossing) return [{ enemy, source: link.a }];
          }
          return [];
        });
      for (const { enemy, source } of contacts) {
        if (g.mode !== 'playing') return;
        cell.hits.add(enemy.id);
        g.hitEnemy(enemy, cell.damage, source);
        g.burst(enemy.body.position, 3, '#a5ddce', 2);
        if (g.time >= this.soundAt) {
          g.onSound('arc');
          this.soundAt = g.time + 0.12;
        }
      }
    }
    this.starts.clear();
    this.cover.clear();
  }
}
