import Matter from 'matter-js';
import type { Game, Shot } from './game.ts';
import { clamp, direction, distance } from './rules.ts';
import type { Vec } from './rules.ts';
import { isBoss } from './enemies.ts';
import type { Prop } from './props.ts';

export const SHELL_DIRECT = 0.55;
export const SHELL_BLAST = 0.85;
export const SHELL_RADIUS = 96;
export const AFTERSHOCK_DELAY = 0.38;
export const AFTERSHOCK_DAMAGE = 0.4;
export const CHAIN_DELAY = 0.12;
export const CHAIN_DAMAGE = 48;
export const DEMOLITION_EFFECT_LIMIT = 24;
export const DEMOLITION_PENDING_LIMIT = 256;
export interface ShellPayload {
  damage: number;
  launch: number;
}
export interface DemolitionBlast {
  pos: Vec;
  damage: number;
  radius: number;
  launch: number;
  kind: 'shell' | 'echo' | 'chain';
}
export interface PendingBlast extends DemolitionBlast {
  at: number;
}
export interface BlastEffect extends DemolitionBlast {
  at: number;
  outline: Vec[];
}

// Measure from the visible hull, not Matter's velocity-padded bounds. A shell
// striking a large boss should not lose its blast damage to the boss's size.
export function closestBlastPoint(origin: Vec, body: Matter.Body): Vec {
  if (Matter.Vertices.contains(body.vertices, origin)) return { ...origin };
  let nearest = { ...body.position },
    best = Infinity;
  for (let i = 0; i < body.vertices.length; i++) {
    const a = body.vertices[i],
      b = body.vertices[(i + 1) % body.vertices.length];
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const t = clamp(
      ((origin.x - a.x) * dx + (origin.y - a.y) * dy) / (dx * dx + dy * dy || 1),
      0,
      1,
    );
    const point = { x: a.x + dx * t, y: a.y + dy * t },
      d = distance(origin, point);
    if (d < best) {
      nearest = point;
      best = d;
    }
  }
  return nearest;
}

export class DemolitionSystem {
  game: Game;
  pending: PendingBlast[] = [];
  effects: BlastEffect[] = [];
  feedbackAt = -1;
  constructor(game: Game) {
    this.game = game;
  }
  clear() {
    this.pending = [];
    this.effects = [];
    this.feedbackAt = -1;
  }
  payload(damage: number): ShellPayload | undefined {
    const gun = this.game.gun;
    if (!gun.shellshock) return undefined;
    return {
      damage: damage * SHELL_BLAST,
      launch: gun.blastSurf ? 10 / (gun.pellets * gun.lanes * (gun.rearVolley ? 2 : 1)) : 0,
    };
  }
  impact(shot: Shot, body?: Matter.Body) {
    if (shot.friendly && !shot.fragment && this.game.ballistics.stick(shot, body)) return;
    const payload = shot.shell;
    shot.shell = undefined;
    if (!payload || !shot.friendly || shot.fragment) return;
    this.detonate({ pos: { ...shot.pos }, ...payload, radius: SHELL_RADIUS, kind: 'shell' });
  }
  brokenProp(pos: Vec) {
    if (!this.game.gun.chainReaction || this.game.mode !== 'playing') return;
    this.schedule(
      {
        pos: { ...pos },
        damage: CHAIN_DAMAGE,
        radius: 110,
        launch: this.game.gun.blastSurf ? 6 : 0,
        kind: 'chain',
      },
      CHAIN_DELAY,
    );
  }
  private schedule(blast: DemolitionBlast, delay: number) {
    if (this.pending.length >= DEMOLITION_PENDING_LIMIT) return;
    this.pending.push({ ...blast, pos: { ...blast.pos }, at: this.game.time + delay });
  }
  update() {
    const g = this.game;
    if (g.mode !== 'playing' || g.hitStop > 0) return;
    this.effects = this.effects.filter((e) => g.time - e.at < 0.22);
    const due = this.pending.filter((e) => e.at <= g.time);
    this.pending = this.pending.filter((e) => e.at > g.time);
    for (const blast of due) {
      if (g.mode !== 'playing') return;
      this.detonate(blast);
    }
  }
  detonate(blast: DemolitionBlast) {
    const g = this.game;
    if (g.mode !== 'playing' || g.escape?.phase === 'extracting' || !(blast.damage > 0)) return;
    const { pos, radius, damage } = blast;
    const strength = (body: Matter.Body, ignore?: Matter.Body | Prop) => {
      const point = closestBlastPoint(pos, body),
        d = distance(pos, point);
      if (d > radius || distance(g.lineEnd(pos, point, 0, ignore), point) > 0.1) return 0;
      return 1 - (0.65 * d) / radius;
    };
    // Snapshot cover before any hit can remove a panel or a prop. Chained blasts
    // get a new snapshot at their own position, on their own simulation tick.
    const enemies = g.enemies
      .filter((e) => e.spawn <= 0 && e.hp > 0)
      .map((enemy) => ({ enemy, amount: strength(enemy.body) }))
      .filter((hit) => hit.amount > 0);
    const props = g.props.items
      .map((prop) => ({ prop, amount: strength(prop.body, prop) }))
      .filter((hit) => hit.amount > 0);
    const panels = g.breaches.panels
      .map((panel) => ({ panel, amount: strength(panel.body, panel.body) }))
      .filter((hit) => hit.amount > 0);
    const launch = blast.launch * strength(g.player);
    const terrain = g.destruction.pieces
      .map((piece) => ({ piece, amount: strength(piece.body, piece.body) }))
      .filter((hit) => hit.amount > 0);
    g.harpoons.blast(pos, damage, radius);
    const showEffect = !this.effects.some(
      (e) => e.kind === blast.kind && g.time - e.at < 0.055 && distance(e.pos, pos) < 14,
    );
    if (showEffect) {
      const outline = Array.from({ length: 32 }, (_, i) => {
        const angle = (i * Math.PI) / 16;
        return g.lineEnd(pos, {
          x: pos.x + Math.cos(angle) * radius,
          y: pos.y + Math.sin(angle) * radius,
        });
      });
      this.effects.push({ ...blast, pos: { ...pos }, at: g.time, outline });
      if (this.effects.length > DEMOLITION_EFFECT_LIMIT) this.effects.shift();
      g.burst(pos, blast.kind === 'echo' ? 3 : 6, '#edbc7c', blast.kind === 'echo' ? 2 : 3);
    }
    if (g.time >= this.feedbackAt) {
      g.feedback(blast.kind === 'echo' ? 1 : 2);
      g.onSound(blast.kind === 'echo' ? 'aftershock' : 'shell-blast');
      this.feedbackAt = g.time + 0.055;
    }
    if (g.gun.aftershock && blast.kind !== 'echo')
      this.schedule(
        {
          ...blast,
          damage: damage * AFTERSHOCK_DAMAGE,
          radius: radius * (g.gun.shockfront ? 1.5 : 1),
          launch: blast.launch * AFTERSHOCK_DAMAGE,
          kind: 'echo',
        },
        AFTERSHOCK_DELAY,
      );
    for (const { enemy, amount } of enemies) {
      if (!g.enemies.includes(enemy) || enemy.hp <= 0) continue;
      g.hitEnemy(enemy, damage * amount, pos);
      if (enemy.hp > 0 && !enemy.body.isStatic) {
        const d = direction(pos, enemy.body.position);
        const push =
          (blast.kind === 'echo' && g.gun.shockfront ? 10 : Math.min(7, damage * 0.16)) *
          amount *
          (isBoss(enemy.kind) ? 0.08 : 1);
        Matter.Body.setVelocity(enemy.body, {
          x: enemy.body.velocity.x + d.x * push,
          y: enemy.body.velocity.y + d.y * push,
        });
      }
    }
    for (const { prop, amount } of props) {
      g.props.hit(prop, damage * amount, direction(pos, prop.body.position));
      if (g.mode !== 'playing') return;
    }
    for (const { panel, amount } of panels)
      g.breaches.hit(panel, damage * amount, direction(pos, panel.body.position));
    for (const { piece, amount } of terrain)
      g.destruction.hitBody(piece.body, damage * amount, direction(pos, piece.body.position));
    if (launch > 0 && g.mode === 'playing') {
      const d = direction(pos, g.player.position);
      if (!d.x && !d.y) d.y = -1;
      Matter.Body.setVelocity(g.player, {
        x: clamp(g.player.velocity.x + d.x * launch, -23, 23),
        y: clamp(g.player.velocity.y + d.y * launch, -21, 20),
      });
      g.grounded = false;
      g.coyote = 0;
      g.jumpCut = true;
      g.landingSpeed = 0;
    }
  }
}
