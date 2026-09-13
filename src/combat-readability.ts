import type Matter from 'matter-js';
import type { Enemy, Shot } from './game.ts';
import type { Vec } from './rules.ts';
import { clamp, distance } from './rules.ts';
import { firstSolid } from './collisions.ts';

export const THREAT_COLOR = '#ff8875';
export const THREAT_CORE = '#fff0d8';
export const THREAT_BACK = '#102025';
export const EDGE_CUE_TIME = 0.42;
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
}

export function inCombatView(p: Vec, view: CombatView, padding = 0) {
  return (
    p.x >= view.x - padding &&
    p.x <= view.x + view.w + padding &&
    p.y >= view.y - padding &&
    p.y <= view.y + view.h + padding
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

export function incomingEdgeCues(
  shots: readonly Shot[],
  player: Vec,
  view: CombatView,
  time: number,
  solids: Matter.Body[],
  inset: number,
): EdgeCue[] {
  const cues: EdgeCue[] = [];
  if (!inCombatView(player, view)) return cues;
  for (const shot of shots) {
    const launch = shot.launch;
    if (shot.friendly || shot.life <= 0 || !launch) continue;
    const age = time - launch.at;
    if (
      age < 0 ||
      age >= EDGE_CUE_TIME ||
      inCombatView(launch.pos, view, 12) ||
      inCombatView(shot.pos, view, shot.radius)
    )
      continue;
    const speed = Math.hypot(shot.vel.x, shot.vel.y);
    if (speed < 0.01) continue;
    const dx = shot.vel.x / speed,
      dy = shot.vel.y / speed;
    const along = (player.x - shot.pos.x) * dx + (player.y - shot.pos.y) * dy;
    if (along <= 0 || along > Math.min(1400, speed * 60 * shot.life)) continue;
    const closest = { x: shot.pos.x + dx * along, y: shot.pos.y + dy * along };
    if (distance(closest, player) > 65 + shot.radius) continue;
    // Actual solid geometry includes movable crates and broken/moving terrain.
    if (firstSolid(shot.pos, closest, { x: shot.radius, y: shot.radius }, solids)) continue;
    const outward = { x: shot.pos.x - player.x, y: shot.pos.y - player.y };
    const margin = Math.min(inset, view.w / 4, view.h / 4);
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
    const pos = {
      x: clamp(player.x + outward.x * travel, view.x + margin, view.x + view.w - margin),
      y: clamp(player.y + outward.y * travel, view.y + margin, view.y + view.h - margin),
    };
    const cue = {
      pos,
      angle: Math.atan2(outward.y, outward.x),
      alpha: 0.85 * (1 - age / EDGE_CUE_TIME),
    };
    const nearby = cues.find((other) => distance(other.pos, pos) < 60);
    if (nearby) nearby.alpha = Math.max(nearby.alpha, cue.alpha);
    else if (cues.length < 4) cues.push(cue);
  }
  return cues;
}

export function attackBrace(e: Enemy) {
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
