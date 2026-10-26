import type { Game } from './game.ts';
import { clamp } from './rules.ts';
export function drawShiftMorphs(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  const m = g.shiftMorphs;
  c.save();
  c.lineWidth = 2;
  for (const [s, f] of m.flights) {
    if (s.life <= 0 || !['piston-lance', 'cable-saw'].includes(f.kind)) continue;
    c.strokeStyle = f.kind === 'piston-lance' ? '#c7c5b5' : '#aebcc7';
    c.globalAlpha = 0.65;
    c.beginPath();
    c.moveTo(f.anchor.position.x, f.anchor.position.y - 3);
    c.lineTo(s.pos.x, s.pos.y);
    c.stroke();
    if (f.kind === 'cable-saw') {
      c.save();
      c.translate(s.pos.x, s.pos.y);
      c.rotate(reduced ? 0 : g.time * 20);
      c.fillStyle = '#384542';
      c.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI) / 8,
          r = i % 2 ? 6 : 10;
        i ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
      c.stroke();
      c.restore();
    }
  }
  for (const p of m.locks) {
    const at = p.enemy.body.position;
    c.strokeStyle = p.progress >= 1 ? '#e4be77' : '#91b8b9';
    c.globalAlpha = 0.85;
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(at.x, at.y, 25, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.progress);
    c.stroke();
    if (p.progress >= 1) {
      c.beginPath();
      c.moveTo(at.x - 7, at.y);
      c.lineTo(at.x + 7, at.y);
      c.moveTo(at.x, at.y - 7);
      c.lineTo(at.x, at.y + 7);
      c.stroke();
    }
  }
  for (const f of m.foams) {
    c.globalAlpha = clamp((f.until - g.time) / 0.3, 0, 0.85);
    c.fillStyle = '#638d77';
    c.strokeStyle = '#b7d6bb';
    c.lineWidth = 1.3;
    c.beginPath();
    f.body.vertices.forEach((v, i) => (i ? c.lineTo(v.x, v.y) : c.moveTo(v.x, v.y)));
    c.closePath();
    c.fill();
    c.stroke();
  }
  c.restore();
}
export function drawShiftMorphWeapon(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  const id = g.shiftMorphs.equipped;
  if (!id) return;
  c.save();
  c.strokeStyle = '#cad1c3';
  c.fillStyle = '#55645d';
  c.lineWidth = 1;
  if (id === 'piston-lance') {
    c.fillRect(5, -5, 12, 9);
    c.fillStyle = '#b6bcb2';
    c.fillRect(15, -2, 10 + g.muzzle * 35, 3);
    c.fillRect(24 + g.muzzle * 35, -5, 3, 9);
  } else if (id === 'cable-saw') {
    c.fillRect(5, -5, 13, 9);
    c.strokeStyle = '#bfc5af';
    c.beginPath();
    c.arc(18, -1, 5, 0, Math.PI * 2);
    c.stroke();
    c.fillRect(13, -2, 10, 2);
  } else if (id === 'seeker-rack') {
    c.fillRect(5, -6, 17, 11);
    for (let i = 0; i < 3; i++) {
      c.fillStyle = '#b7b59b';
      c.fillRect(9 + i * 4, -4, 2, 6);
    }
  } else {
    c.fillStyle = '#87af99';
    c.fillRect(4, -4, 14, 7);
    c.beginPath();
    c.moveTo(17, -4);
    c.lineTo(25, -6);
    c.lineTo(25, 5);
    c.lineTo(17, 3);
    c.closePath();
    c.fill();
    c.stroke();
  }
  c.restore();
}
