import type { Enemy, Game } from './game.ts';
import { clamp, type Vec } from './rules.ts';
import { remasterKind } from './enemy-remaster.ts';
import { firstSolid } from './collisions.ts';

// Cosmetic geometry only. Damage states never change speed, aim or attack timing.
export function machineWear(e: Enemy) {
  return e.hp <= 0 ? 0 : e.hp / e.maxHp <= 0.3 ? 2 : e.hp / e.maxHp <= 0.65 ? 1 : 0;
}
export function drawRemasteredBody(
  c: CanvasRenderingContext2D,
  g: Game,
  e: Enemy,
  reduced: boolean,
) {
  const kind = remasterKind(e);
  if (!kind || e.allied || e.elite || e.mutation || e.squad || e.splitChild) return;
  const wear = machineWear(e);
  c.save();
  c.lineWidth = 2;
  const active = !!e.remaster && (e.state === 'windup' || e.state === 'rush');
  c.strokeStyle = active ? '#ffd6a0' : e.state === 'recover' ? '#b2cfc2' : '#927d70';
  if (kind === 'runner') {
    const leaning = reduced ? 0 : e.state === 'windup' ? -3 : e.state === 'rush' ? 4 : 0;
    c.translate(leaning, 0);
    c.fillStyle = '#67534b';
    c.fillRect(-11, -13, 22, 6);
    c.beginPath();
    c.moveTo(-9, 5);
    c.lineTo(0, -1);
    c.lineTo(9, 5);
    c.stroke();
    if (active) {
      c.beginPath();
      c.moveTo(e.aim.x * 16, -8);
      c.lineTo(e.aim.x * 22, -2);
      c.lineTo(e.aim.x * 16, 4);
      c.stroke();
    }
  } else if (kind === 'shooter') {
    const brace = e.state === 'windup' ? 1 : 0;
    for (const side of [-1, 1]) {
      c.beginPath();
      c.moveTo(side * 8, 7);
      c.lineTo(side * (14 + brace * 5), 16);
      c.lineTo(side * (20 + brace * 5), 16);
      c.stroke();
    }
    c.fillStyle = '#887a62';
    c.fillRect(-12, -11, 24, 5);
  } else {
    const bank = reduced ? 0 : clamp(e.body.velocity.x * 0.09, -0.2, 0.2);
    c.rotate(bank);
    for (const side of [-1, 1]) {
      c.fillStyle = wear === 2 && side === 1 ? '#34464a' : '#63878a';
      c.fillRect(side < 0 ? -30 : 20, -8, 10, 5);
      c.strokeRect(side < 0 ? -32 : 18, -11, 14, 11);
    }
  }
  const lamp = active ? '#ffe4ad' : wear === 2 ? '#63534a' : wear === 1 ? '#a28a63' : '#c4c9a5';
  c.fillStyle = lamp;
  c.fillRect(-3, -8, 6, 4);
  if (wear) {
    c.strokeStyle = '#111b20';
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(-10, -5);
    c.lineTo(-4, 0);
    c.lineTo(-7, 5);
    c.lineTo(-1, 9);
    c.stroke();
    c.strokeStyle = '#aa8975';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(-9, -5);
    c.lineTo(-3, 0);
    c.lineTo(-6, 5);
    c.stroke();
  }
  if (wear === 2) {
    c.fillStyle = '#142226';
    c.fillRect(4, 3, 9, 7);
    c.strokeStyle = '#a9b7ae';
    c.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.moveTo(5, 4 + i * 2);
      c.lineTo(11, 4 + i * 2);
      c.stroke();
    }
  }
  c.restore();
}
export function drawRemasterTell(c: CanvasRenderingContext2D, g: Game, e: Enemy) {
  if (!e.remaster || e.allied || e.state !== 'windup') return;
  const kind = remasterKind(e)!;
  const p = e.body.position;
  c.save();
  c.strokeStyle = '#f3c68b';
  c.fillStyle = '#ffe4b7';
  c.lineWidth = 1.5;
  const line = (a: Vec, b: Vec) => {
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.stroke();
  };
  if (kind === 'runner') {
    const x = p.x + e.aim.x * 126,
      y = e.body.bounds.max.y - 7;
    const hit = firstSolid({ x: p.x, y }, { x, y }, { x: 13, y: 3 }, g.solidBodies);
    const end = p.x + (x - p.x) * (hit?.t ?? 1);
    line({ x: p.x, y }, { x: end, y });
    line({ x: end - e.aim.x * 10, y: y - 6 }, { x: end, y });
    line({ x: end - e.aim.x * 10, y: y + 6 }, { x: end, y });
  } else {
    const base = Math.atan2(e.aim.y, e.aim.x);
    const length = Math.min(
      1450,
      Math.max(350, Math.hypot(e.target.x - p.x, e.target.y - p.y) + 70),
    );
    c.setLineDash([7, 8]);
    for (const offset of kind === 'flyer' ? [-0.18, 0, 0.18] : [0]) {
      const a = base + offset,
        end = { x: p.x + Math.cos(a) * length, y: p.y + Math.sin(a) * length };
      line(p, g.lineEnd(p, end, 3));
    }
    c.setLineDash([]);
  }
  c.restore();
}
