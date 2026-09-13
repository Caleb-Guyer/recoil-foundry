import type { Game } from './game.ts';
import { PRESSURE } from './pressure.ts';
import { AREAS } from './areas.ts';

export function drawPressure(c: CanvasRenderingContext2D, g: Game, reduced = false) {
  const palette = AREAS[g.level.area];
  for (const v of g.pressure.items) {
    const warn = v.phase === 'warn',
      burst = v.phase === 'burst';
    const color = warn ? '#d8b783' : burst || v.phase === 'ready' ? '#b3d6cd' : palette.edge;
    c.save();
    c.strokeStyle = palette.edge;
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(v.valve.x, v.valve.y);
    c.lineTo(v.x, v.valve.y);
    c.lineTo(v.x, v.y);
    c.stroke();
    // The grille is recessed into its host, with its front edge exactly at the
    // visible floor/wall. It never looks like a floating platform or loose prop.
    c.save();
    c.translate(v.x, v.y);
    c.rotate(Math.atan2(v.dir.y, v.dir.x));
    c.fillStyle = '#172124';
    c.fillRect(-12, -v.width / 2, 14, v.width);
    c.strokeStyle = palette.surface;
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(0, -v.width / 2);
    c.lineTo(0, v.width / 2);
    c.stroke();
    c.strokeStyle = palette.edge;
    for (let y = -v.width / 2 + 6; y < v.width / 2; y += 10) {
      c.beginPath();
      c.moveTo(-9, y - 3);
      c.lineTo(0, y + 2);
      c.stroke();
    }
    if (warn || burst) {
      for (let lane = -2; lane <= 2; lane++) {
        const across = (lane * v.width) / 5,
          length = g.pressure.reach(v, across);
        c.strokeStyle = color;
        c.globalAlpha = burst ? 0.24 : 0.12;
        c.lineWidth = burst ? 3 : 1;
        c.setLineDash(warn ? [3, 14] : []);
        c.beginPath();
        c.moveTo(3, across);
        c.lineTo(length, across);
        c.stroke();
        c.setLineDash([]);
        if (burst) {
          c.globalAlpha = 0.55;
          c.lineWidth = 1.5;
          for (let n = 0; n < 4; n++) {
            const x =
              14 +
              ((n * 91 + (reduced ? 0 : g.time * 680) + lane * 19 + 1000) %
                Math.max(1, length - 22));
            if (x + 10 > length) continue;
            c.beginPath();
            c.moveTo(x - 10, across);
            c.lineTo(x, across);
            c.stroke();
          }
        }
      }
    }
    c.restore();
    c.globalAlpha = 1;
    c.translate(v.valve.x, v.valve.y);
    if (warn && !reduced) c.rotate(Math.sin(g.time * 45) * 0.07);
    c.fillStyle = palette.face;
    c.strokeStyle = color;
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, 0, PRESSURE.radius, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(Math.cos(a) * 11, Math.sin(a) * 11);
      c.stroke();
    }
    const charge = v.phase === 'recharge' ? Math.max(0, 1 - v.timer / PRESSURE.recharge) : 1;
    c.strokeStyle = warn ? '#e2c391' : '#9dada5';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, 0, 18, -Math.PI / 2, -Math.PI / 2 + charge * Math.PI * 2);
    c.stroke();
    c.restore();
  }
}
