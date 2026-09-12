import type { Enemy, Game } from './game.ts';
import { clamp, distance } from './rules.ts';
import { HARPOON_TELL, HARPOON_LOCK, HARPOON_RANGE, harpoonMuzzle } from './harpooner.ts';

export function drawHarpooner(c: CanvasRenderingContext2D, g: Game, e: Enemy, reduced: boolean) {
  const rig = e.harpoon!,
    p = e.body.position,
    muzzle = harpoonMuzzle(e);
  const latched = rig.phase === 'latched',
    aiming = rig.phase === 'aim';
  const angle = Math.atan2(e.aim.y, e.aim.x);
  c.save();
  c.globalAlpha = e.spawn > 0 ? clamp(1 - e.spawn / 0.65, 0.15, 1) : 1;
  if (aiming) {
    const locked = e.timer <= HARPOON_LOCK;
    const end = g.lineEnd(
      muzzle,
      { x: muzzle.x + e.aim.x * HARPOON_RANGE, y: muzzle.y + e.aim.y * HARPOON_RANGE },
      4,
    );
    c.strokeStyle = locked ? '#efbe8b' : '#9e785d';
    c.lineWidth = locked ? 1.5 : 1;
    c.setLineDash(locked ? [8, 5] : [3, 9]);
    c.beginPath();
    c.moveTo(muzzle.x, muzzle.y);
    c.lineTo(end.x, end.y);
    c.stroke();
    c.setLineDash([]);
  }
  if (latched || rig.phase === 'flight') {
    const slack = latched
      ? Math.min(18, Math.max(0, rig.length - distance(muzzle, rig.head)) * 0.12)
      : 0;
    c.strokeStyle = latched ? '#d6b27d' : '#9e8662';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(muzzle.x, muzzle.y);
    c.quadraticCurveTo(
      (muzzle.x + rig.head.x) / 2,
      (muzzle.y + rig.head.y) / 2 + slack,
      rig.head.x,
      rig.head.y,
    );
    c.stroke();
    c.save();
    c.translate(rig.head.x, rig.head.y);
    c.rotate(angle);
    c.strokeStyle = '#f0cf9e';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-10, 0);
    c.lineTo(2, 0);
    c.moveTo(-5, -5);
    c.lineTo(2, 0);
    c.lineTo(-5, 5);
    c.stroke();
    c.restore();
  }
  // A squat winch chassis and a long forked barrel distinguish it from shooters.
  c.save();
  c.translate(p.x, p.y);
  c.fillStyle = '#272b2c';
  c.fillRect(-17, 8, 34, 8);
  c.strokeStyle = '#9a7560';
  c.lineWidth = 1.5;
  c.strokeRect(-15, 9, 30, 6);
  const tread = reduced ? 0 : ((p.x % 8) + 8) % 8;
  c.fillStyle = '#927451';
  for (let x = -12 + tread; x < 14; x += 8) c.fillRect(x, 11, 3, 2);
  c.fillStyle = e.flash > 0 ? '#fff0db' : '#aa6655';
  c.beginPath();
  c.moveTo(-15, 7);
  c.lineTo(-12, -12);
  c.lineTo(0, -18);
  c.lineTo(14, -10);
  c.lineTo(15, 7);
  c.closePath();
  c.fill();
  c.fillStyle = '#413b37';
  c.fillRect(-8, -10, 15, 14);
  c.strokeStyle = '#c5a277';
  c.lineWidth = 2;
  c.beginPath();
  c.arc(0, -4, 7, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = '#efbd83';
  c.fillRect(e.facing > 0 ? 9 : -12, -10, 3, 4);
  c.translate(0, -5);
  c.rotate(angle);
  c.fillStyle = '#4d443b';
  c.fillRect(0, -4, 29, 8);
  c.strokeStyle = e.state === 'recover' ? '#887561' : '#d1b48c';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(10, -5);
  c.lineTo(30, -5);
  c.lineTo(34, -9);
  c.moveTo(10, 5);
  c.lineTo(30, 5);
  c.lineTo(34, 9);
  c.stroke();
  c.restore();
  if (latched || aiming) {
    c.fillStyle = latched ? '#f6dfac' : '#403b34';
    c.strokeStyle = '#edc48c';
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(muzzle.x, muzzle.y, 7, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = '#66513d';
    c.beginPath();
    c.arc(muzzle.x, muzzle.y, 2.5, 0, Math.PI * 2);
    c.fill();
    if (aiming) {
      const progress = clamp(1 - e.timer / HARPOON_TELL, 0, 1);
      c.beginPath();
      c.arc(muzzle.x, muzzle.y, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      c.stroke();
    } else {
      for (const side of [-1, 1]) {
        c.beginPath();
        c.moveTo(muzzle.x + side * 10, muzzle.y - 3);
        c.lineTo(muzzle.x + side * 10, muzzle.y + 3);
        c.stroke();
      }
    }
  }
  if (e.hp < e.maxHp) {
    c.fillStyle = '#342c29';
    c.fillRect(p.x - 17, p.y + 23, 34, 2);
    c.fillStyle = '#d48769';
    c.fillRect(p.x - 17, p.y + 23, 34 * Math.max(0, e.hp / e.maxHp), 2);
  }
  c.restore();
}
