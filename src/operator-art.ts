import type { Game } from './game.ts';
import { OUTFITS, drawOutfit } from './cosmetics.ts';
import { drawWeapon } from './weapon-art.ts';
import { operatorPose, type OperatorLimb } from './operator-pose.ts';

function link(c: CanvasRenderingContext2D, limb: OperatorLimb, color: string, width: number) {
  c.strokeStyle = '#18292d';
  c.lineWidth = width + 1.5;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(limb.root.x, limb.root.y);
  c.lineTo(limb.joint.x, limb.joint.y);
  c.lineTo(limb.end.x, limb.end.y);
  c.stroke();
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}
function leg(
  c: CanvasRenderingContext2D,
  limb: OperatorLimb,
  g: Game,
  facing: number,
  far: boolean,
) {
  const p = OUTFITS[g.cosmetics.outfit];
  c.save();
  link(c, limb, far ? '#536763' : p.boots, 4.6);
  c.fillStyle = far ? '#263e40' : '#243a3d';
  c.beginPath();
  c.arc(limb.joint.x, limb.joint.y, 2.1, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = far ? '#73887b' : p.trim;
  c.fillRect(limb.joint.x - 1.5, limb.joint.y - 0.7, 3, 1.3);
  c.translate(limb.end.x, limb.end.y + 1.5);
  c.rotate(limb.angle);
  c.scale(facing, 1);
  c.fillStyle = '#1a2a2e';
  c.beginPath();
  c.moveTo(-3.8, -3);
  c.lineTo(2.7, -3);
  c.lineTo(4.6, -0.5);
  c.lineTo(6, 0);
  c.lineTo(6, 2);
  c.lineTo(-3.8, 2);
  c.closePath();
  c.fill();
  c.fillStyle = far ? '#536763' : p.boots;
  c.fillRect(-3, -2.5, 5.5, 3);
  c.fillRect(2, -0.5, 3, 1.4);
  c.fillStyle = far ? '#73887b' : p.trim;
  c.fillRect(-2.6, -2.1, 3.6, 1);
  c.restore();
}
function arm(c: CanvasRenderingContext2D, limb: OperatorLimb, g: Game, far: boolean) {
  const p = OUTFITS[g.cosmetics.outfit];
  c.save();
  link(c, limb, far ? '#3c5351' : p.body, far ? 3.8 : 4.3);
  c.fillStyle = far ? '#263e40' : p.boots;
  c.beginPath();
  c.arc(limb.joint.x, limb.joint.y, 2.2, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = p.trim;
  c.fillRect(limb.root.x - 2, limb.root.y - 1.2, 4, 1.5);
  c.restore();
}
/** Local player-center coordinates; the weapon keeps its original world pivot. */
export function drawOperator(c: CanvasRenderingContext2D, g: Game, reduced: boolean, pressure = 0) {
  const pose = operatorPose(g, reduced);
  c.save();
  leg(c, pose.legs[0], g, pose.facing, true);
  arm(c, pose.arms[0], g, true);
  leg(c, pose.legs[1], g, pose.facing, false);
  c.save();
  c.translate(pose.body.x, pose.body.y);
  c.rotate(pose.body.angle);
  c.scale(pose.body.scaleX, pose.body.scaleY);
  if (pressure > 0) {
    c.beginPath();
    c.roundRect(-13, -18, 26, 28, 4);
    c.strokeStyle = '#081216';
    c.lineWidth = 2 + Math.min(1, pressure) * 3;
    c.stroke();
  }
  drawOutfit(c, g.cosmetics.outfit, pose.facing, pose.body.stride, {
    articulated: true,
    cloth: pose.cloth,
    brace: pose.weapon.brace,
  });
  c.restore();
  arm(c, pose.arms[1], g, false);
  c.save();
  c.translate(pose.weapon.pivot.x, pose.weapon.pivot.y);
  c.rotate(pose.weapon.angle);
  drawWeapon(c, g, reduced);
  // Small glove fingers sit underneath the receiver/foregrip, never over the
  // barrel mouth, charge lamps, beam axis or the player's bright visor.
  const p = OUTFITS[g.cosmetics.outfit];
  for (const hand of pose.weapon.grips) {
    c.fillStyle = '#203439';
    c.fillRect(hand.x - 2, hand.y - 1, 4.5, 3.4);
    c.fillStyle = p.boots;
    c.fillRect(hand.x - 1.5, hand.y - 0.7, 3.5, 1.8);
    c.fillStyle = p.trim;
    c.fillRect(hand.x - 1, hand.y - 0.7, 2.5, 0.8);
  }
  c.restore();
  c.restore();
}
