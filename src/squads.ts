import Matter from 'matter-js';
import type { Enemy, Game } from './game.ts';
import type { Level, Spawn } from './levels.ts';
import type { Vec } from './rules.ts';
import { clamp, direction, distance, seeded, sample } from './rules.ts';
import { firstSolid } from './collisions.ts';
import { bossHuntTarget } from './boss-hunt.ts';

export type SquadKind = 'shield' | 'flank' | 'ambush';
export interface SquadTag {
  kind: SquadKind;
  role: 'lead' | 'support';
}
export interface SquadMember extends SquadTag {
  connected: boolean;
  side: number;
  planAt: number;
  jumpAt: number;
  origin?: Vec;
}
export const SQUAD_TELL = 0.85;
export const SQUAD_LOCK = 0.35;

// Pair existing members of the final wave. Counts, hull anchors, elite rolls,
// health, and the combat/reward random stream remain unchanged.
export function squadSpawns(spawns: Spawn[], level: Level, seed: string, stage: number): Spawn[] {
  const result = spawns.map(({ squad: _old, ...s }) => ({ ...s }) as Spawn);
  if (level.boss || level.detour || stage < 4) return result;
  const rng = seeded(seed + ':squads:' + stage);
  if (stage !== 4 && stage !== 6 && stage !== 8 && rng() > 0.7) return result;
  const pairs: { kind: SquadKind; lead: Spawn; support: Spawn }[] = [];
  for (const lead of result)
    for (const support of result) {
      if (lead === support || distance(lead, support) > 900) continue;
      if (
        lead.elite === 'shielded' &&
        support.kind === 'shooter' &&
        !support.elite &&
        Math.abs(lead.y - support.y) < 200
      )
        pairs.push({ kind: 'shield', lead, support });
      if (
        stage >= 6 &&
        ['shooter', 'sniper'].includes(lead.kind) &&
        !lead.elite &&
        support.kind === 'flyer' &&
        !support.elite
      )
        pairs.push({ kind: 'flank', lead, support });
      if (stage >= 8 && lead.kind === 'sniper' && !lead.elite && support.kind === 'hopper')
        pairs.push({ kind: 'ambush', lead, support });
    }
  const kinds = [...new Set(pairs.map((p) => p.kind))];
  const kind = sample(kinds, 1, rng)[0];
  const pair = sample(
    pairs.filter((p) => p.kind === kind),
    1,
    rng,
  )[0];
  if (pair) {
    pair.lead.squad = { kind: pair.kind, role: 'lead' };
    pair.support.squad = { kind: pair.kind, role: 'support' };
  }
  return result;
}

export function squadPartner(g: Game, e: Enemy): Enemy | undefined {
  return (
    e.squad &&
    g.enemies.find(
      (other) =>
        other !== e &&
        other.hp > 0 &&
        other.squad?.kind === e.squad!.kind &&
        other.squad.role !== e.squad!.role,
    )
  );
}
export function breakSquad(g: Game, e: Enemy) {
  const kind = e.squad?.kind;
  if (!kind) return;
  const partner = squadPartner(g, e);
  // A delayed doorway must not recreate a pair after its first member dies.
  for (const door of g.waves.doors) if (door.spawn.squad?.kind === kind) delete door.spawn.squad;
  for (const member of partner ? [e, partner] : [e]) {
    if (!member.squad) continue;
    member.squad = undefined;
    member.hunt = undefined;
    // Cancel a relocated gun's old warning; airborne hoppers finish their jump.
    if (member.kind === 'shooter' || member.kind === 'flyer' || member.kind === 'sniper') {
      member.state = 'idle';
      member.timer = Math.max(member.timer, SQUAD_TELL);
    }
  }
}
export function squadGunOrigin(e: Enemy): Vec {
  const p = e.body.position;
  return e.squad?.kind === 'shield' && e.squad.role === 'support' ? { x: p.x, y: p.y - 34 } : p;
}
export function squadLineEnd(g: Game, e: Enemy, from: Vec, to: Vec): Vec {
  const end = g.lineEnd(from, to, e.squad ? 5 : 0);
  if (!e.squad) return end;
  const hit = firstSolid(
    from,
    end,
    { x: 5, y: 5 },
    g.enemies.filter((other) => other !== e && other.spawn <= 0).map((other) => other.body),
  );
  return hit ? { x: from.x + (end.x - from.x) * hit.t, y: from.y + (end.y - from.y) * hit.t } : end;
}

function escortMove(g: Game, e: Enemy, goal: Vec) {
  const p = e.body.position,
    v = e.body.velocity,
    rig = e.squad!;
  if (p.y < goal.y - 80 && g.enemyGrounded(e)) {
    const support = g.solidBodies.find(
      (b) =>
        Math.abs(b.bounds.min.y - p.y - 16) < 6 && p.x > b.bounds.min.x && p.x < b.bounds.max.x,
    );
    if (support) {
      const edges = [support.bounds.min.x - 30, support.bounds.max.x + 30].filter(
        (x) => x >= 40 && x <= 1960,
      );
      edges.sort((a, b) => Math.abs(a - goal.x) - Math.abs(b - goal.x));
      if (edges.length) goal = { x: edges[0], y: goal.y };
    }
  }
  const dx = goal.x - p.x,
    sign = Math.abs(dx) > 22 ? Math.sign(dx) : 0;
  const grounded = g.enemyGrounded(e);
  Matter.Body.setVelocity(e.body, { x: v.x + (sign * 2.7 - v.x) * 0.14, y: v.y });
  const blocked =
    sign &&
    Matter.Query.ray(
      [...g.solidBodies, ...g.enemies.filter((other) => other !== e).map((other) => other.body)],
      p,
      { x: p.x + sign * 48, y: p.y },
      28,
    ).length > 0;
  const ceiling =
    Matter.Query.ray(g.solidBodies, { x: p.x, y: p.y - 16 }, { x: p.x, y: p.y - 55 }, 34).length >
    0;
  if (
    grounded &&
    sign &&
    !ceiling &&
    g.time >= rig.jumpAt &&
    (blocked || (goal.y < p.y - 55 && Math.abs(dx) < 230))
  ) {
    Matter.Body.setVelocity(e.body, { x: sign * 4.5, y: -11.8 });
    rig.jumpAt = g.time + 0.85;
  }
}

// Return true only when replacing this enemy's ordinary movement/attack update.
export function updateSquad(g: Game, e: Enemy): boolean {
  const rig = e.squad;
  if (!rig) return false;
  const partner = squadPartner(g, e);
  if (!partner) {
    if (rig.connected || !g.waves.pending) breakSquad(g, e);
    return false;
  }
  if (partner.spawn > 0) return false;
  if (distance(e.body.position, partner.body.position) > 950) {
    breakSquad(g, e);
    return false;
  }
  if (!rig.connected) {
    rig.connected = partner.squad!.connected = true;
    for (const member of [e, partner]) {
      member.timer = Math.max(member.timer, SQUAD_TELL);
      member.squad!.planAt = g.time + 2.5;
    }
  }
  const p = e.body.position,
    player = g.player.position;
  if (rig.kind === 'shield') {
    if (rig.role === 'lead') {
      if (!g.updateShield(e)) {
        const d = direction(p, player);
        // Let the gunner catch up without surrendering close-range pressure.
        if (distance(p, partner.body.position) > 220 && distance(p, player) > 200) d.x *= 0.35;
        g.updateRunner(e, d, distance(p, player));
      }
      return true;
    }
    const origin = squadGunOrigin(e);
    const mountClear = distance(g.lineEnd(p, origin, 4), origin) < 0.1;
    if (e.state === 'windup') {
      Matter.Body.setVelocity(e.body, { x: e.body.velocity.x * 0.55, y: e.body.velocity.y });
      if (!mountClear || (rig.origin && distance(origin, rig.origin) > 20)) {
        e.state = 'recover';
        e.timer = 0.6;
        rig.origin = undefined;
      } else {
        if (e.timer > SQUAD_LOCK) e.aim = direction(origin, player);
        if (e.timer <= 0) {
          const end = { x: origin.x + e.aim.x * 1450, y: origin.y + e.aim.y * 1450 };
          // Allied hulls stop the round even if they move into its lane later.
          if (distance(origin, squadLineEnd(g, e, origin, end)) > 45) {
            g.enemyShot(e, Math.atan2(e.aim.y, e.aim.x), undefined, undefined, origin);
            g.onSound('enemy');
          }
          e.state = 'recover';
          e.timer = 1.1;
          rig.origin = undefined;
        }
      }
      return true;
    }
    e.aim = direction(origin, player);
    const goal = {
      x: clamp(partner.body.position.x - partner.facing * 115, 50, 1950),
      y: partner.body.position.y,
    };
    escortMove(g, e, goal);
    if (
      e.timer <= 0 &&
      mountClear &&
      g.enemyGrounded(e) &&
      distance(p, partner.body.position) < 245 &&
      distance(origin, player) < 1100 &&
      distance(squadLineEnd(g, e, origin, player), player) < 1
    ) {
      e.state = 'windup';
      e.timer = SQUAD_TELL;
      rig.origin = { ...origin };
      g.onSound('lock');
    }
    return true;
  }
  if (rig.kind === 'flank' && rig.role === 'support') {
    if (!rig.side || g.time >= rig.planAt) {
      rig.side = -Math.sign(partner.body.position.x - player.x) || (p.x < player.x ? -1 : 1);
      rig.planAt = g.time + 2.5;
      e.hunt = undefined;
    }
    const target = bossHuntTarget(g, e, false, rig.side);
    Matter.Body.applyForce(e.body, p, { x: 0, y: -e.body.mass * 0.001 });
    const locked = e.timer <= SQUAD_LOCK;
    Matter.Body.setVelocity(
      e.body,
      locked
        ? { x: 0, y: 0 }
        : { x: clamp((target.x - p.x) * 0.1, -3.2, 3.2), y: clamp((target.y - p.y) * 0.1, -3, 3) },
    );
    // Keep the original flyer volley, rate, and lock window in Game.updateEnemy.
    return true;
  }
  if (rig.kind === 'ambush') {
    if (rig.role === 'support') {
      // The sniper fires first; the full hop tell leaves a gap before landing.
      if (e.state !== 'windup' && e.state !== 'airborne' && e.timer <= 0) {
        if (!(partner.state === 'windup' && partner.timer <= 0.32)) e.timer = 0.05;
      }
    } else if (
      e.state !== 'windup' &&
      e.state !== 'followup' &&
      e.timer <= 0 &&
      (partner.state === 'windup' || partner.state === 'airborne')
    ) {
      e.timer = 0.15;
    }
  }
  return false;
}
