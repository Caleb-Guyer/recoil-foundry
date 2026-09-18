import type { Game } from './game.ts';

export function drawReforge(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  const s = g.reforge,
    p = s.site;
  if (!p || !g.clear || !s.eligible) return;
  const used = s.state!.used;
  c.save();
  c.translate(p.x, p.floor);
  c.fillStyle = '#263537';
  c.strokeStyle = '#758980';
  c.lineWidth = 2;
  c.fillRect(-30, -56, 60, 48);
  c.strokeRect(-30, -56, 60, 48);
  c.fillStyle = '#182627';
  c.fillRect(-24, -48, 48, 28);
  c.fillStyle = used ? '#62766e' : '#e4c594';
  c.fillRect(-22, -61, 44, 5);
  c.fillRect(-22, -8, 9, 8);
  c.fillRect(13, -8, 9, 8);
  // Two opposing jaws explain the machine's exchange, with one spent lamp.
  c.strokeStyle = used ? '#657970' : '#e4c594';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(-19, -40);
  c.lineTo(-5, -40);
  c.lineTo(-5, -33);
  c.moveTo(19, -27);
  c.lineTo(5, -27);
  c.lineTo(5, -34);
  c.stroke();
  c.fillStyle = used ? '#465b52' : '#b4d2b3';
  c.fillRect(-4, -16, 8, 3);
  if (!used && s.nearby) {
    const y = -77 + (reduced ? 0 : Math.sin(g.time * 3) * 2);
    c.strokeStyle = '#e4c594';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-5, y + 5);
    c.lineTo(0, y);
    c.lineTo(5, y + 5);
    c.stroke();
  }
  c.restore();
}
