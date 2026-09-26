import type { Game } from './game.ts';

export function drawCrosswind(c: CanvasRenderingContext2D, g: Game, reduced = false) {
  for (const f of g.crosswind.items) {
    const warning = f.phase === 'warn',
      gust = f.phase === 'gust';
    const strength = g.crosswind.strength(f);
    c.save();
    c.translate(f.x, f.y);
    c.rotate(Math.atan2(f.dir.y, f.dir.x));
    // Flush grille and recessed rotors: the fan is machinery in the floor/wall.
    c.fillStyle = '#142328';
    c.fillRect(-16, -f.width / 2, 16, f.width);
    for (let y = -f.width / 2 + 20; y < f.width / 2; y += 38) {
      c.save();
      c.translate(-7, y);
      c.scale(0.42, 1);
      c.rotate(reduced ? 0 : f.rotation);
      c.fillStyle = warning ? '#d9c498' : gust ? '#9dcbbf' : '#49636a';
      for (let blade = 0; blade < 4; blade++) {
        c.rotate(Math.PI / 2);
        c.beginPath();
        c.moveTo(2, 0);
        c.lineTo(13, 3);
        c.lineTo(6, 10);
        c.closePath();
        c.fill();
      }
      c.restore();
    }
    c.strokeStyle = '#527078';
    c.lineWidth = 2;
    c.strokeRect(-16, -f.width / 2, 16, f.width);
    for (let y = -f.width / 2 + 7; y < f.width / 2; y += 10) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(-12, y);
      c.stroke();
    }
    c.fillStyle = warning ? '#dec58d' : gust ? '#acdfcf' : '#4a676a';
    c.fillRect(1, -f.width / 2, 3, 9);
    c.fillRect(1, f.width / 2 - 9, 3, 9);
    if (warning || gust) {
      for (let lane = -2; lane <= 2; lane++) {
        const across = (lane * f.width) / 5,
          length = g.crosswind.reach(f, across);
        if (length < 12) continue;
        c.strokeStyle = warning ? '#cdbc8f' : '#9fc9c3';
        c.globalAlpha = warning ? 0.3 : 0.16 + strength * 0.16;
        c.lineWidth = 1;
        c.setLineDash(warning ? [3, 13] : [12, 26]);
        c.beginPath();
        c.moveTo(5, across);
        c.lineTo(length, across);
        c.stroke();
        c.setLineDash([]);
        c.globalAlpha = warning ? 0.55 : 0.48;
        for (let n = 0; n < (reduced ? 2 : 4); n++) {
          const d =
            10 +
            ((n * 127 + lane * 29 + 2000 + (reduced ? 0 : g.time * (warning ? 25 : 180))) %
              Math.max(1, length - 25));
          if (d + 6 >= length) continue;
          c.beginPath();
          c.moveTo(d - 5, across - 3);
          c.lineTo(d, across);
          c.lineTo(d - 5, across + 3);
          c.stroke();
        }
      }
    }
    c.restore();
  }
}
