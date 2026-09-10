import type { Enemy, Game } from './game.ts';
import { clamp } from './rules.ts';
import { firstSolid } from './collisions.ts';
import { SCRAPPER_TELL } from './scrapper.ts';

export function drawScrapper(c: CanvasRenderingContext2D, g: Game, e: Enemy, reduced: boolean) {
  const rig = e.scrapper!,
    p = e.body.position,
    held = rig.held;
  c.save();
  c.globalAlpha = e.spawn > 0 ? clamp(1 - e.spawn / 0.65, 0.15, 1) : 1;
  if (held && rig.phase === 'aim') {
    let pos = { ...rig.release },
      vel = { ...rig.velocity };
    const gravity = g.engine.gravity.y * g.engine.gravity.scale * (1000 / 60) ** 2;
    c.strokeStyle = '#dcaa73';
    c.lineWidth = 1.4;
    c.setLineDash([5, 8]);
    c.beginPath();
    c.moveTo(pos.x, pos.y);
    const blockers = g.solidBodies.filter((b) => b !== held.body);
    for (let i = 0; i < 60; i++) {
      vel = {
        x: vel.x * (1 - held.body.frictionAir),
        y: vel.y * (1 - held.body.frictionAir) + gravity,
      };
      const next = { x: pos.x + vel.x, y: pos.y + vel.y };
      const hit = firstSolid(pos, next, { x: 24, y: 24 }, blockers);
      c.lineTo(pos.x + vel.x * (hit?.t ?? 1), pos.y + vel.y * (hit?.t ?? 1));
      if (hit) break;
      pos = next;
    }
    c.stroke();
    c.setLineDash([]);
  }
  // Low tracked chassis, offset shoulder and open mechanical pincer.
  c.translate(p.x, p.y);
  c.fillStyle = '#292d2d';
  c.fillRect(-16, 8, 32, 9);
  c.strokeStyle = '#aa8064';
  c.lineWidth = 1.5;
  c.strokeRect(-15, 9, 30, 6);
  const tread = reduced ? 0 : ((p.x % 8) + 8) % 8;
  c.fillStyle = '#756651';
  for (let x = -12 + tread; x < 14; x += 8) c.fillRect(x, 11, 3, 2);
  c.fillStyle = e.flash > 0 ? '#fff1d7' : '#98664f';
  c.beginPath();
  c.moveTo(-14, 7);
  c.lineTo(-14, -6);
  c.lineTo(-6, -16);
  c.lineTo(12, -13);
  c.lineTo(15, 7);
  c.closePath();
  c.fill();
  c.fillStyle = '#322c2b';
  c.fillRect(-8, -8, 15, 8);
  c.fillStyle = e.state === 'recover' ? '#74675b' : held ? '#ffe0a1' : '#ec9678';
  c.fillRect(e.facing > 0 ? 1 : -7, -6, 6, 3);
  const hand = held
    ? { x: held.body.position.x - p.x, y: held.body.position.y - p.y }
    : { x: e.facing * 25, y: e.state === 'recover' ? 6 : -12 };
  const armSide = held ? Math.sign(hand.x) || e.facing : e.facing;
  const elbow = { x: armSide * 21, y: held ? -39 : -25 };
  c.strokeStyle = '#5f4d42';
  c.lineWidth = 7;
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(0, -9);
  c.lineTo(elbow.x, elbow.y);
  c.lineTo(hand.x, hand.y);
  c.stroke();
  c.strokeStyle = '#c29770';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(0, -11);
  c.lineTo(elbow.x, elbow.y - 2);
  c.lineTo(hand.x, hand.y - 2);
  c.stroke();
  c.fillStyle = '#343334';
  c.beginPath();
  c.arc(elbow.x, elbow.y, 5, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = held ? '#dfbb8a' : '#a78564';
  c.lineWidth = 3;
  for (const side of [-1, 1]) {
    c.beginPath();
    c.moveTo(hand.x, hand.y - 10);
    c.lineTo(hand.x + side * (held ? 25 : 10), hand.y - 8);
    c.lineTo(hand.x + side * (held ? 25 : 10), hand.y + 8);
    c.stroke();
  }
  if (held && rig.phase === 'aim') {
    const progress = clamp(1 - e.timer / SCRAPPER_TELL, 0, 1);
    c.strokeStyle = '#f0b47d';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(elbow.x, elbow.y, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    c.stroke();
  }
  if (e.hp < e.maxHp) {
    c.fillStyle = '#342c29';
    c.fillRect(-17, 23, 34, 2);
    c.fillStyle = '#d48769';
    c.fillRect(-17, 23, 34 * Math.max(0, e.hp / e.maxHp), 2);
  }
  c.restore();
}
