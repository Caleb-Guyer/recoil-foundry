import type { Game } from './game.ts';
/** Small native contact marks, drawn over real support and below the player. */
export function drawOperatorSurface(c: CanvasRenderingContext2D, g: Game, reduced = false) {
  if (!['playing', 'paused'].includes(g.mode) || g.hp <= 0 || g.finale.cinema?.active) return;
  c.save();
  for (const mark of g.operatorSurface.marks) {
    const age = g.time - mark.at;
    if (age < 0 || age > 0.38) continue;
    const t = Math.min(1, age / 0.38),
      x = mark.point.x,
      y = mark.point.y;
    c.globalAlpha = (1 - t) * 0.4 * mark.strength;
    c.lineWidth = 1;
    if (mark.surface === 'coolant') {
      c.strokeStyle = '#91b6b4';
      c.beginPath();
      c.ellipse(
        x,
        y - 1,
        reduced ? 5 : 3 + t * (mark.kind === 'land' ? 15 : 8),
        reduced ? 1 : 1 + t * 1.2,
        0,
        0,
        Math.PI * 2,
      );
      c.stroke();
      if (!reduced)
        for (const side of [-1, 1]) {
          c.fillStyle = '#86a9a9';
          c.fillRect(
            x + side * (3 + t * 8),
            y - 2 - Math.sin(t * Math.PI) * (mark.kind === 'land' ? 8 : 4),
            1.5,
            1.5,
          );
        }
    } else if (mark.kind === 'skid') {
      c.strokeStyle = mark.surface === 'grating' ? '#738b8c' : '#778786';
      c.beginPath();
      c.moveTo(x - mark.side * (4 + 8 * t), y - 1);
      c.lineTo(x + mark.side * 2, y - 1);
      c.stroke();
      if (!reduced) {
        c.fillStyle = '#748583';
        c.fillRect(x - mark.side * (5 + t * 11), y - 2 - t * 4, 1.5, 1.5);
      }
    } else if (!reduced) {
      c.fillStyle = '#6f8180';
      for (const side of [-1, 1])
        c.fillRect(x + side * (3 + t * 7), y - 2 - Math.sin(t * Math.PI) * 3, 1.5, 1.5);
    }
  }
  c.restore();
}
