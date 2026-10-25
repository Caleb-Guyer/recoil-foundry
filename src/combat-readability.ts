import { segmentBox } from './rules.ts';
import type Matter from 'matter-js';
import type { Enemy, Shot, Game } from './game.ts';
import type { Vec } from './rules.ts';
import { clamp, distance } from './rules.ts';
import { firstSolid } from './collisions.ts';
import { REMASTER_TELL, remasterKind } from './enemy-remaster.ts';
import { TWIN_LOCK } from './enemies.ts';
import { SQUAD_LOCK, squadGunOrigin } from './squads.ts';
import { machineAngles } from './patrol-machine-system.ts';
import type { BossRemasterCue, BossRemasterVisual } from './boss-remaster-cues.ts';

export const THREAT_COLOR = '#ff8875';
export const THREAT_CORE = '#fff0d8';
export const THREAT_BACK = '#102025';
// Look ahead to imminent contact, not back to when the projectile was fired.
export const EDGE_CUE_TIME = 1.6;
export interface CombatView {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface EdgeCue {
  pos: Vec;
  angle: number;
  alpha: number;
  phase?: 'tell' | 'shot';
  impactIn?: number;
  fireIn?: number;
  source?: number;
}

// A bounded, presentation-only workload. Offscreen clutter must not dim this fight.
// No seeded randomness, projectile removal or changes to damage/attack timing.
export function combatClarity(g: Game, view: CombatView) {
  let rounds = 0,
    rays = 0,
    particles = 0;
  for (const s of g.shots) {
    if (s.friendly && s.life > 0 && inCombatView(s.pos, view, 20)) rounds++;
    if (rounds >= 60) break;
  }
  rays: for (const path of [g.torch.segments, g.torch.rear])
    for (const ray of path) {
      if (g.torch.active && segmentInCombatView(ray.a, ray.b, view, 20)) rays++;
      if (rays >= 48) break rays;
    }
  for (const p of g.particles) {
    if (p.life > 0 && inCombatView(p.pos, view, 20)) particles++;
    if (particles >= 100) break;
  }
  const pressure = clamp((rounds * 0.45 + rays * 1.2 + particles * 0.18 - 12) / 35, 0, 1);
  return {
    pressure,
    particles: 1 - pressure * 0.65,
    friendly: 1 - pressure * 0.3,
    glow: 1 - pressure * 0.7,
    motion: 1 - pressure * 0.45,
  };
}

export function inCombatView(p: Vec, view: CombatView, padding = 0) {
  return (
    p.x >= view.x - padding &&
    p.x <= view.x + view.w + padding &&
    p.y >= view.y - padding &&
    p.y <= view.y + view.h + padding
  );
}

export function segmentInCombatView(a: Vec, b: Vec, view: CombatView, padding = 0) {
  return (
    Math.max(a.x, b.x) >= view.x - padding &&
    Math.min(a.x, b.x) <= view.x + view.w + padding &&
    Math.max(a.y, b.y) >= view.y - padding &&
    Math.min(a.y, b.y) <= view.y + view.h + padding
  );
}

// Cosmetic effects yield locally to a bullet's head and its next short segment.
// The shot, its collision hull and every active hazard remain fully visible.
export function effectOpacity(p: Vec, radius: number, threats: readonly Shot[]) {
  let opacity = 1;
  for (const shot of threats) {
    const speed = Math.hypot(shot.vel.x, shot.vel.y);
    const length = Math.min(65, speed * 4);
    const dx = speed ? shot.vel.x / speed : 0,
      dy = speed ? shot.vel.y / speed : 0;
    const along = clamp((p.x - shot.pos.x) * dx + (p.y - shot.pos.y) * dy, 0, length);
    const gap = Math.hypot(p.x - shot.pos.x - dx * along, p.y - shot.pos.y - dy * along);
    opacity = Math.min(opacity, 0.18 + 0.82 * clamp((gap - Math.min(radius, 60) - 16) / 48, 0, 1));
  }
  return opacity;
}

interface LockedFire {
  origin: Vec;
  angles: number[];
  lock: number;
  range: number;
  alliedHulls: boolean;
}
const finitePoint = (p: Vec) => Number.isFinite(p.x) && Number.isFinite(p.y);

// Mirror only committed straight-shot states from the actual AI. Tracking
// sights, idle cooldowns, unsupported archetypes and melee windups are silent.
function lockedFire(e: Enemy, enemies: readonly Enemy[]): LockedFire | null {
  if (
    e.hp <= 0 ||
    e.spawn > 0 ||
    e.allied ||
    e.workshopTarget ||
    e.courier ||
    e.eventRole ||
    e.mutation ||
    e.elite === 'volatile' ||
    !Number.isFinite(e.timer) ||
    e.timer < 0 ||
    !finitePoint(e.aim) ||
    Math.hypot(e.aim.x, e.aim.y) < 0.1
  )
    return null;
  const origin = squadGunOrigin(e);
  const angle = Math.atan2(e.aim.y, e.aim.x);
  let lock = 0;
  let angles = [angle];
  let alliedHulls = !!e.squad;
  if (e.remaster && (e.kind === 'shooter' || e.kind === 'flyer')) {
    if (e.state !== 'windup') return null;
    lock = REMASTER_TELL[e.kind];
    if (e.kind === 'flyer') angles = [-0.18, 0, 0.18].map((offset) => angle + offset);
  } else if (e.kind === 'sniper') {
    if (e.state !== 'windup' && e.state !== 'followup') return null;
    lock = e.state === 'followup' ? TWIN_LOCK : 0.32;
  } else if (e.kind === 'shutter' || e.kind === 'strider') {
    if (!e.patrol || (e.state !== 'windup' && e.state !== 'followup')) return null;
    lock = 0.4;
    angles = machineAngles(e);
  } else if (e.kind === 'shooter' || e.kind === 'flyer') {
    if (e.squad?.kind === 'shield' && e.squad.role === 'support') {
      if (
        e.state !== 'windup' ||
        !e.squad.connected ||
        !e.squad.origin ||
        distance(origin, e.squad.origin) > 20 ||
        !enemies.some(
          (other) =>
            other !== e &&
            other.hp > 0 &&
            other.spawn <= 0 &&
            other.squad?.kind === 'shield' &&
            other.squad.role === 'lead' &&
            distance(other.body.position, e.body.position) <= 950,
        )
      )
        return null;
      lock = SQUAD_LOCK;
    } else {
      if (e.state !== 'idle') return null;
      lock = 0.35;
      if (e.kind === 'flyer') angles = [-0.18, 0, 0.18].map((offset) => angle + offset);
    }
  } else return null;
  if (e.timer > lock) return null;
  return { origin, angles, lock, range: 1450, alliedHulls };
}

function laneApproach(origin: Vec, heading: Vec, player: Vec, radius: number) {
  const along = (player.x - origin.x) * heading.x + (player.y - origin.y) * heading.y;
  if (along <= 0) return null;
  const closest = { x: origin.x + heading.x * along, y: origin.y + heading.y * along };
  if (distance(closest, player) > 32 + radius) return null;
  return { along, closest };
}

interface BossWarningSource {
  owns(enemy: Enemy): boolean;
  readonly visual: BossRemasterVisual | null;
  readonly rig: { readonly remaining: number } | null;
}

// Test the actual 26 x 36 player hull against the supplied, butt-ended strip.
// The rig has already clipped projectile paths to cover. Reconstructing a fan
// or extending an endpoint here would invent attacks beyond that cover.
function bossSegmentTouchesPlayer(from: Vec, to: Vec, width: number, player: Vec) {
  if (!finitePoint(from) || !finitePoint(to) || !Number.isFinite(width) || width <= 0) return false;
  const length = distance(from, to);
  if (length <= 0.001) return false;
  const dx = (to.x - from.x) / length,
    dy = (to.y - from.y) / length;
  const x = player.x - (from.x + to.x) / 2,
    y = player.y - (from.y + to.y) / 2;
  const halfLength = length / 2,
    radius = width / 2;
  // Separating axes for the player rectangle and the oriented cue rectangle.
  return (
    Math.abs(x) < 13 + Math.abs(dx) * halfLength + Math.abs(dy) * radius &&
    Math.abs(y) < 18 + Math.abs(dy) * halfLength + Math.abs(dx) * radius &&
    Math.abs(x * dx + y * dy) < halfLength + 13 * Math.abs(dx) + 18 * Math.abs(dy) &&
    Math.abs(-x * dy + y * dx) < radius + 13 * Math.abs(dy) + 18 * Math.abs(dx)
  );
}
function bossCueTouchesPlayer(cue: BossRemasterCue, player: Vec) {
  if (!cue.active && !cue.locked) return false;
  if (cue.kind === 'lane')
    return (
      [cue.x, cue.width, cue.top, cue.bottom].every(Number.isFinite) &&
      cue.width > 0 &&
      cue.bottom > cue.top &&
      player.x + 13 > cue.x - cue.width / 2 &&
      player.x - 13 < cue.x + cue.width / 2 &&
      player.y + 18 > cue.top &&
      player.y - 18 < cue.bottom
    );
  if (cue.kind === 'segment') return bossSegmentTouchesPlayer(cue.from, cue.to, cue.width, player);
  if (cue.kind === 'hull') {
    if (
      !finitePoint(cue.from) ||
      !finitePoint(cue.to) ||
      ![cue.halfWidth, cue.halfHeight].every((n) => Number.isFinite(n) && n > 0)
    )
      return false;
    return !!segmentBox(
      cue.from,
      cue.to,
      { x: player.x - 13 - cue.halfWidth, y: player.y - 18 - cue.halfHeight },
      { x: player.x + 13 + cue.halfWidth, y: player.y + 18 + cue.halfHeight },
    );
  }
  return cue.ends.some((end) => bossSegmentTouchesPlayer(cue.from, end, cue.width, player));
}
export function incomingEdgeCues(
  shots: readonly Shot[],
  player: Vec,
  view: CombatView,
  time: number,
  solids: Matter.Body[],
  inset: number,
  enemies: readonly Enemy[] = [],
  isAttackActive?: (enemy: Enemy) => boolean,
  bossWarnings?: BossWarningSource,
): EdgeCue[] {
  if (
    !Number.isFinite(time) ||
    !finitePoint(player) ||
    !Number.isFinite(inset) ||
    !finitePoint(view) ||
    !Number.isFinite(view.w) ||
    !Number.isFinite(view.h) ||
    view.w <= 0 ||
    view.h <= 0 ||
    !inCombatView(player, view)
  )
    return [];
  const candidates: (EdgeCue & { urgency: number })[] = [];
  const project = (from: Vec, cue: Omit<EdgeCue, 'pos' | 'angle'>, urgency: number) => {
    const outward = { x: from.x - player.x, y: from.y - player.y };
    const margin = Math.max(0, Math.min(inset, view.w / 4, view.h / 4));
    const tx =
      outward.x > 0
        ? (view.x + view.w - margin - player.x) / outward.x
        : outward.x < 0
          ? (view.x + margin - player.x) / outward.x
          : Infinity;
    const ty =
      outward.y > 0
        ? (view.y + view.h - margin - player.y) / outward.y
        : outward.y < 0
          ? (view.y + margin - player.y) / outward.y
          : Infinity;
    const travel = Math.max(0, Math.min(tx, ty));
    candidates.push({
      ...cue,
      urgency,
      pos: {
        x: clamp(player.x + outward.x * travel, view.x + margin, view.x + view.w - margin),
        y: clamp(player.y + outward.y * travel, view.y + margin, view.y + view.h - margin),
      },
      angle: Math.atan2(outward.y, outward.x),
    });
  };
  for (const shot of shots) {
    if (
      shot.friendly ||
      shot.allied ||
      shot.reflected ||
      !Number.isFinite(shot.life) ||
      !Number.isFinite(shot.damage) ||
      shot.life <= 0 ||
      shot.damage <= 0 ||
      !finitePoint(shot.pos) ||
      !finitePoint(shot.vel) ||
      !Number.isFinite(shot.radius) ||
      shot.radius < 0 ||
      shot.meltTransit ||
      ['setting', 'parked', 'queued'].includes(shot.stasis?.phase ?? '') ||
      (shot.launch && time < shot.launch.at) ||
      inCombatView(shot.pos, view, shot.radius)
    )
      continue;
    const speed = Math.hypot(shot.vel.x, shot.vel.y);
    if (speed < 0.01) continue;
    const heading = { x: shot.vel.x / speed, y: shot.vel.y / speed };
    const approach = laneApproach(shot.pos, heading, player, shot.radius);
    if (!approach) continue;
    const impactIn = Math.max(0, (approach.along - 26 - shot.radius) / (speed * 60));
    if (impactIn > EDGE_CUE_TIME || impactIn > shot.life) continue;
    // Read live convex cover, including moved crates and destroyed terrain.
    if (firstSolid(shot.pos, approach.closest, { x: shot.radius, y: shot.radius }, solids))
      continue;
    if (
      shot.allyBlock !== undefined &&
      firstSolid(
        shot.pos,
        approach.closest,
        { x: shot.radius, y: shot.radius },
        enemies
          .filter((e) => e.id !== shot.allyBlock && e.hp > 0 && e.spawn <= 0)
          .map((e) => e.body),
      )
    )
      continue;
    project(
      shot.pos,
      {
        phase: 'shot',
        impactIn,
        source: shot.id,
        alpha: 0.5 + 0.35 * (1 - impactIn / EDGE_CUE_TIME),
      },
      impactIn,
    );
  }
  for (const e of enemies) {
    // The Crane's physical hook can be far from its rail chassis. A visible
    // hook needs no offscreen marker; an offscreen hook uses its real origin.
    const hookWarning =
      bossWarnings?.owns(e) &&
      e.kind === 'crane' &&
      e.crane &&
      bossWarnings.visual?.warnings.some((cue) => cue.kind === 'hull');
    const warningOrigin = hookWarning && e.crane ? e.crane.head : e.body.position;
    if (
      (isAttackActive && !isAttackActive(e)) ||
      !finitePoint(warningOrigin) ||
      inCombatView(warningOrigin, view, 30)
    )
      continue;
    if (bossWarnings?.owns(e)) {
      const visual = bossWarnings.visual,
        remaining = bossWarnings.rig?.remaining;
      if (
        e.hp > 0 &&
        e.spawn <= 0 &&
        !e.allied &&
        visual?.stage === 'combat' &&
        finitePoint(visual.center) &&
        remaining !== undefined &&
        Number.isFinite(remaining) &&
        remaining >= 0 &&
        remaining <= EDGE_CUE_TIME &&
        visual.warnings.some((cue) => bossCueTouchesPlayer(cue, player))
      ) {
        const fireIn = visual.warnings.some(
          (cue) => cue.active && bossCueTouchesPlayer(cue, player),
        )
          ? 0
          : remaining;
        project(
          e.kind === 'crane' ? warningOrigin : visual.center,
          {
            phase: 'tell',
            fireIn,
            source: e.id,
            alpha: 0.5 + 0.3 * (1 - fireIn / EDGE_CUE_TIME),
          },
          fireIn + 0.25,
        );
      }
      // Owned rigs are authoritative even during startup, breaks and recovery.
      continue;
    }
    const fire = lockedFire(e, enemies);
    if (!fire || distance(fire.origin, player) > fire.range) continue;
    if (firstSolid(e.body.position, fire.origin, { x: 4, y: 4 }, solids)) continue;
    for (const angle of fire.angles) {
      const heading = { x: Math.cos(angle), y: Math.sin(angle) };
      const approach = laneApproach(fire.origin, heading, player, 5);
      if (
        !approach ||
        approach.along > fire.range ||
        firstSolid(fire.origin, approach.closest, { x: 5, y: 5 }, solids)
      )
        continue;
      if (
        fire.alliedHulls &&
        firstSolid(
          fire.origin,
          approach.closest,
          { x: 5, y: 5 },
          enemies
            .filter((other) => other !== e && other.hp > 0 && other.spawn <= 0)
            .map((other) => other.body),
        )
      )
        continue;
      project(
        fire.origin,
        {
          phase: 'tell',
          fireIn: e.timer,
          source: e.id,
          alpha: 0.5 + 0.25 * (1 - e.timer / fire.lock),
        },
        e.timer + 0.25,
      );
    }
  }
  // Select by urgency before the cap, rather than by array/insertion order.
  // Nearby rays and rounds from a single volley share one restrained chevron.
  const cues: EdgeCue[] = [];
  candidates.sort((a, b) => a.urgency - b.urgency || (a.source ?? 0) - (b.source ?? 0));
  for (const { urgency: _urgency, ...cue } of candidates) {
    const nearby = cues.find((other) => distance(other.pos, cue.pos) < 60);
    if (nearby) nearby.alpha = Math.max(nearby.alpha, cue.alpha);
    else if (cues.length < 4) cues.push(cue);
  }
  return cues;
}

export function attackBrace(e: Enemy) {
  const kind = remasterKind(e);
  if (e.remaster && kind)
    return e.state === 'windup' ? clamp(1 - e.timer / REMASTER_TELL[kind], 0, 1) : 0;
  if (e.hp <= 0 || e.spawn > 0 || e.workshopTarget || e.elite === 'shielded' || e.timer <= 0)
    return 0;
  const warning =
    e.state === 'windup' ||
    e.state === 'followup' ||
    ((e.kind === 'shooter' || e.kind === 'flyer') && e.elite !== 'volatile' && !e.squad);
  return warning ? clamp(1 - e.timer / 0.4, 0, 1) : 0;
}

// A dark separation stroke and warm hollow silhouette distinguish hostile rounds
// from the player's solid pale projectiles, even without color perception.
export function drawThreatRound(c: CanvasRenderingContext2D, s: Shot) {
  const fast = Math.hypot(s.vel.x, s.vel.y) > 12;
  const radius = s.radius + 1;
  c.save();
  c.translate(s.pos.x, s.pos.y);
  c.rotate(Math.atan2(s.vel.y, s.vel.x));
  c.beginPath();
  if (fast) {
    c.moveTo(radius + 3, 0);
    c.lineTo(0, radius);
    c.lineTo(-radius - 3, 0);
    c.lineTo(0, -radius);
    c.closePath();
  } else c.arc(0, 0, radius, 0, Math.PI * 2);
  c.fillStyle = THREAT_BACK;
  c.fill();
  c.strokeStyle = THREAT_BACK;
  c.lineWidth = 5;
  c.stroke();
  c.strokeStyle = THREAT_COLOR;
  c.lineWidth = 2;
  c.stroke();
  c.fillStyle = THREAT_CORE;
  c.fillRect(-1.5, -1.5, 3, 3);
  c.restore();
}
