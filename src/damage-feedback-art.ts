import type { Game } from './game.ts';
import type { Vec } from './rules.ts';
import { DAMAGE_RECOVERY, type DamageHit } from './damage-control.ts';

export const DAMAGE_IMPACT_TIME = 0.32;
const unit = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

export function damageFeedbackState(
  hit: DamageHit | null,
  now: number,
  reduced = false,
  recoveryAt?: number,
) {
  if (!Number.isFinite(now)) return null;
  const accepted = hit && Number.isFinite(hit.at) && Number.isFinite(hit.damage) && hit.damage > 0;
  const age = accepted ? now - hit.at : Infinity;
  // The simulation's protection clock can survive a room reset even though
  // this room's accepted-hit history is empty. Show that real protection
  // without inventing a damage record, source, or impact mark.
  const protectedAt = recoveryAt ?? (accepted ? hit.at : undefined);
  const protectionAge =
    protectedAt !== undefined && Number.isFinite(protectedAt) ? now - protectedAt : Infinity;
  const recovery =
    protectionAge >= 0 && protectionAge < DAMAGE_RECOVERY
      ? 0.64 * unit((DAMAGE_RECOVERY - protectionAge) / 0.16)
      : 0;
  const direction = accepted && age >= 0 && age < DAMAGE_IMPACT_TIME ? hit.direction : undefined;
  const length =
    direction && Number.isFinite(direction.x) && Number.isFinite(direction.y)
      ? Math.hypot(direction.x, direction.y)
      : 0;
  const impact =
    length > 0.001 && age < DAMAGE_IMPACT_TIME
      ? reduced
        ? 0.72 * unit((DAMAGE_IMPACT_TIME - age) / 0.09)
        : 0.86 * unit(1 - age / DAMAGE_IMPACT_TIME)
      : 0;
  if (recovery <= 0 && impact <= 0) return null;
  return {
    // A steady hold followed by one short fade, never an oscillating flash.
    recovery,
    impact,
    direction: length > 0.001 ? { x: direction!.x / length, y: direction!.y / length } : null,
  };
}

export function showDamageFeedback(g: Game, explicitFrame = false) {
  return (
    !explicitFrame &&
    g.mode === 'playing' &&
    g.hp > 0 &&
    !g.workshop.active &&
    !g.finale.safe &&
    !g.clockOut.active &&
    !g.shutdown.complete &&
    g.escape?.phase !== 'extracting'
  );
}

// Called inside the world's existing transform, after the player but before
// hostile projectiles and attack lanes. Stroke widths stay small on screen;
// the physical player hull and true incoming direction supply all geometry.
export function drawDamageFeedback(
  c: CanvasRenderingContext2D,
  hit: DamageHit | null,
  now: number,
  player: Vec,
  scale: number,
  reduced = false,
  pressure = 0,
  recoveryAt?: number,
) {
  const state = damageFeedbackState(hit, now, reduced, recoveryAt);
  if (
    !state ||
    !Number.isFinite(scale) ||
    scale <= 0 ||
    !Number.isFinite(player.x) ||
    !Number.isFinite(player.y)
  )
    return;
  const px = 1 / Math.max(0.25, scale),
    quiet = 1 - unit(pressure) * 0.18;
  c.save();
  c.translate(player.x, player.y);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  // Four separated corners read as recovery, without covering the outfit,
  // competing with Scrap Armor's side plates, or washing out attack colors.
  if (state.recovery > 0) {
    c.globalAlpha = state.recovery * quiet;
    c.beginPath();
    for (const x of [-1, 1])
      for (const y of [-1, 1]) {
        c.moveTo(x * 10, y * 23);
        c.lineTo(x * 18, y * 23);
        c.lineTo(x * 18, y * 15);
      }
    c.strokeStyle = '#102025';
    c.lineWidth = 4 * px;
    c.stroke();
    c.strokeStyle = '#ead6bc';
    c.lineWidth = 1.4 * px;
    c.stroke();
  }
  if (state.impact > 0 && state.direction) {
    c.save();
    c.rotate(Math.atan2(state.direction.y, state.direction.x));
    c.globalAlpha = state.impact * quiet;
    const radius = 25 + 9 * px;
    c.beginPath();
    c.moveTo(radius - 2 * px, -6 * px);
    c.lineTo(radius, 0);
    c.lineTo(radius - 2 * px, 6 * px);
    c.strokeStyle = '#102025';
    c.lineWidth = 5 * px;
    c.stroke();
    c.strokeStyle = '#e79a87';
    c.lineWidth = 2 * px;
    c.stroke();
    c.restore();
  }
  c.restore();
}
