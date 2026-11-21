import type { Game } from './game.ts';
import { clamp } from './rules.ts';
import { GUN_FINISHES } from './cosmetics.ts';
import { isMeleeWeapon } from './starting-guns.ts';

/** The world renderer supplies player-center coordinates. Read the committed
 * strike direction so turning the reticle cannot rotate an active hit. */
export function drawMeleeStrike(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  if (!isMeleeWeapon(g.startingGun)) return;
  const strike = g.melee.activeStrike;
  if (!strike || strike.until < g.time) return;
  const p = g.player.position;
  const heading = Math.atan2(strike.aim.y, strike.aim.x);
  const tip = (angle: number) => {
    const end = g.lineEnd(p, {
      x: p.x + Math.cos(angle) * strike.reach,
      y: p.y + Math.sin(angle) * strike.reach,
    });
    return { x: end.x - p.x, y: end.y - p.y };
  };
  c.save();
  c.strokeStyle = strike.weapon === 'hammer' ? '#e5bc88' : '#b8e7dd';
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.globalAlpha = reduced
    ? 0.65
    : 0.3 + 0.5 * clamp((strike.until - g.time) / Math.max(0.001, strike.until - g.lastShot), 0, 1);
  c.lineWidth = strike.weapon === 'hammer' ? 3 : 2;
  c.beginPath();
  if (strike.weapon === 'spear') {
    const end = tip(heading);
    const length = Math.hypot(end.x, end.y);
    if (length > 12) {
      c.moveTo(end.x * 0.3, end.y * 0.3);
      c.lineTo(end.x, end.y);
      const d = strike.aim;
      for (const side of [-1, 1]) {
        c.moveTo(end.x - d.x * 9 + side * d.y * 3, end.y - d.y * 9 - side * d.x * 3);
        c.lineTo(end.x, end.y);
      }
    }
  } else {
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const end = tip(heading + strike.halfAngle * ((2 * i) / steps - 1));
      if (i === 0) c.moveTo(end.x, end.y);
      else c.lineTo(end.x, end.y);
    }
  }
  c.stroke();
  c.restore();
}

export function drawMeleeWeapon(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  const weapon = g.startingGun;
  if (!isMeleeWeapon(weapon)) return false;
  const finish = GUN_FINISHES[g.cosmetics.gun],
    age = Math.max(0, g.time - g.lastShot);
  const stroke = clamp(1 - age / (weapon === 'hammer' ? 0.28 : 0.19), 0, 1);
  c.save();
  if (weapon === 'spear') c.translate(8 * stroke - 5 * g.melee.charge, 0);
  else c.rotate((reduced ? 0.15 : 1) * stroke * (weapon === 'hammer' ? 1.15 : -0.85));
  c.fillStyle = finish.shell;
  c.strokeStyle = '#263936';
  c.lineWidth = 1;
  c.fillRect(3, -1.8, weapon === 'katana' ? 12 : 32, 3.6);
  c.fillStyle = finish.trim;
  for (let x = 4; x < 15; x += 3) c.fillRect(x, -2.2, 1.4, 4.4);
  c.beginPath();
  if (weapon === 'katana') {
    c.fillRect(14, -5, 3, 10);
    c.moveTo(17, -2.5);
    c.quadraticCurveTo(39, -2, 53, -10);
    c.quadraticCurveTo(44, 1, 17, 2.5);
    c.closePath();
    c.fillStyle = '#d9e8df';
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(19, 0);
    c.quadraticCurveTo(38, -1, 47, -6);
    c.stroke();
    if (g.melee.riposteReady) {
      c.fillStyle = '#ffe6a5';
      c.fillRect(14, -7, 3, 3);
      c.fillRect(14, 4, 3, 3);
      c.fillRect(18, -1.5, 10, 1.5);
    }
  } else if (weapon === 'hammer') {
    c.fillStyle = finish.shell;
    c.roundRect(27, -12, 14, 24, 2);
    c.fill();
    c.stroke();
    c.fillStyle = '#d1b089';
    c.fillRect(26, -12, 16, 4);
    c.fillRect(26, 8, 16, 4);
    c.fillStyle = finish.face;
    c.fillRect(30, -6, 7, 12);
    c.fillStyle = '#263936';
    c.fillRect(33, -3, 2, 6);
  } else {
    c.fillStyle = finish.face;
    c.fillRect(20, -2, 16, 4);
    c.fillStyle = '#8bcfc7';
    c.moveTo(31, -2);
    c.lineTo(39, -5);
    c.lineTo(54, 0);
    c.lineTo(39, 5);
    c.lineTo(31, 2);
    c.closePath();
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(34, 0);
    c.lineTo(51, 0);
    c.stroke();
    if (g.melee.charge > 0) {
      c.fillStyle = '#e9bc72';
      c.fillRect(18, -6, 14 * g.melee.charge, 2);
      if (g.melee.charge >= 1) {
        c.beginPath();
        c.moveTo(34, -9);
        c.lineTo(38, -6);
        c.lineTo(34, -3);
        c.closePath();
        c.fill();
      }
    }
  }
  c.restore();
  return true;
}
