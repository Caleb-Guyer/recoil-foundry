import type { Enemy, Game } from './game.ts';
import {
  courierPose,
  courierSnapshot,
  courierShutdownPose,
  type CourierPose,
} from './courier-pose.ts';
import { drawCourierChassis, type CourierArtPose } from './courier-chassis-art.ts';
import { drawCourierDispatchWorld } from './courier-world-art.ts';

function localArt(p: CourierPose, health: number | null): CourierArtPose {
  const f = p.facing || 1;
  return {
    body: { x: p.bodyOffset.x * f, y: p.bodyOffset.y },
    lean: p.bodyAngle * f,
    wheelAngle: p.wheelAngle * f,
    suspension: p.suspension,
    cargo: { ...p.cargoOffset },
    cargoAngle: p.cargoAngle * f,
    cargoHeld: p.cargoHeld,
    clampOpen: p.clampOpen,
    boost: p.boost,
    wear: p.wear,
    energy: p.energy,
    hit:
      p.hitLocal && p.hitStrength > 0
        ? { local: { x: p.hitLocal.x * f, y: p.hitLocal.y }, strength: p.hitStrength }
        : null,
    health,
  };
}
function drawPose(
  c: CanvasRenderingContext2D,
  p: CourierPose,
  health: number | null,
  wreck = false,
) {
  c.save();
  c.globalAlpha *= p.alpha;
  c.translate(p.position.x, p.position.y);
  c.rotate(p.angle);
  c.scale(p.facing || 1, 1);
  if (wreck && p.grounded) {
    // The observer's real support normal determines the rig angle. Its wheel contact
    // plane is local y=16; the cosmetic hull cannot paint beneath that plane.
    c.beginPath();
    c.rect(-120, -160, 240, 176);
    c.clip();
  }
  drawCourierChassis(c, localArt(p, health));
  c.restore();
}

/** One production rig serves live play and Logbook photographs. */
export function drawCourier(
  c: CanvasRenderingContext2D,
  g: Game,
  e: Enemy,
  reduced = false,
  portrait = false,
) {
  if (!e.courier) return;
  const snapshot = courierSnapshot(g, e),
    pose = courierPose(snapshot, g.time, reduced);
  drawPose(c, pose, portrait ? null : snapshot.maxHp > 0 ? snapshot.hp / snapshot.maxHp : 0);
}

/** Portraits retain the captive cargo and native chassis but omit the live latch-health display. */
export function drawCourierPortrait(
  c: CanvasRenderingContext2D,
  g: Game,
  e: Enemy,
  reduced = true,
) {
  drawCourier(c, g, e, reduced, true);
}

/** Real defeats only; a living escape never creates a wreck or a counterfeit cargo case. */
export function drawCourierWrecks(c: CanvasRenderingContext2D, g: Game, reduced = false) {
  for (const wreck of g.courier.presentation.wrecks) {
    if (wreck.life <= 0 || wreck.age < 0) continue;
    const pose = courierShutdownPose(wreck, reduced);
    if (pose.alpha <= 0) continue;
    drawPose(c, pose, null, true);
  }
}

export function drawCourierWorld(c: CanvasRenderingContext2D, g: Game, reduced = false) {
  // Put the inert rig under the authoritative hatch, physical case and pickup display.
  drawCourierWrecks(c, g, reduced);
  drawCourierDispatchWorld(c, g, reduced, g.courier.presentation.events);
}
