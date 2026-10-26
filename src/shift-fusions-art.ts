import type { Game } from './game.ts';
import { clamp } from './rules.ts';
export function drawShiftFusions(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  const f = g.shiftFusions;
  c.save();
  c.lineWidth = 1.6;
  c.strokeStyle = '#b4cfea';
  c.fillStyle = '#d5e8f8';
  for (let i = 0; i < f.captured.length; i++) {
    const p = f.caughtPosition(i);
    c.globalAlpha = 0.85;
    c.beginPath();
    c.arc(p.x, p.y, 4, 0, Math.PI * 2);
    c.stroke();
    c.fillRect(p.x - 1, p.y - 1, 2, 2);
  }
  if (f.gate) {
    c.strokeStyle = '#b3d4d7';
    c.globalAlpha = g.time < f.gate.armed ? 0.35 : 0.85;
    c.setLineDash([6, 4]);
    for (const s of f.gate.segments) {
      c.beginPath();
      c.moveTo(s.a.x, s.a.y);
      c.lineTo(s.b.x, s.b.y);
      c.stroke();
    }
    c.setLineDash([]);
  }
  if (f.hot) {
    c.globalAlpha = clamp((f.hot.until - g.time) / 0.28, 0, 0.9);
    c.strokeStyle = '#ffd39b';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(f.hot.link.a.body.position.x, f.hot.link.a.body.position.y);
    c.lineTo(f.hot.link.b.body.position.x, f.hot.link.b.body.position.y);
    c.stroke();
  }
  for (const m of f.mills) {
    c.globalAlpha = clamp(m.life / 0.2, 0, 0.8);
    c.strokeStyle = '#b4e1ce';
    if (!reduced) {
      c.beginPath();
      m.trail.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
      c.stroke();
    }
    c.save();
    c.translate(m.pos.x, m.pos.y);
    c.rotate(reduced ? 0 : m.angle * 4);
    c.fillStyle = '#334747';
    c.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8,
        r = i % 2 ? 6 : 9;
      i ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();
  }
  c.strokeStyle = '#96ccee';
  c.lineWidth = 2;
  for (const e of f.ghostEffects) {
    c.globalAlpha = clamp(1 - (g.time - e.at) / 0.14, 0, 0.8);
    c.beginPath();
    c.moveTo(e.a.x, e.a.y);
    c.lineTo(e.b.x, e.b.y);
    c.stroke();
  }
  c.strokeStyle = '#b4d8e5';
  c.lineWidth = 1;
  for (const comet of f.comets.values())
    for (const p of comet.props) {
      c.globalAlpha = reduced ? 0.3 : 0.55;
      c.setLineDash([3, 5]);
      c.beginPath();
      c.moveTo(comet.shot.pos.x, comet.shot.pos.y);
      c.lineTo(p.body.position.x, p.body.position.y);
      c.stroke();
    }
  c.setLineDash([]);
  c.restore();
}
