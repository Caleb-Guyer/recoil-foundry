import type { Game } from './game.ts';

// A wall appliance, not a solid prop: walking past never catches the player.
// The one nearby prompt is the only approach text this object adds.
export function drawFinaleService(c: CanvasRenderingContext2D, g: Game, reduced = false) {
  const service = g.finaleService,
    site = service.site;
  if (!site) return;
  const spent = service.current?.status !== undefined && service.current.status !== 'available';
  c.save();
  c.translate(site.x, site.floor);
  c.fillStyle = '#111c22';
  c.fillRect(-35, -83, 70, 73);
  c.strokeStyle = '#566970';
  c.lineWidth = 2;
  c.strokeRect(-35, -83, 70, 73);
  // Mounts and cable attach it to the rain-soaked city wall.
  c.strokeStyle = '#253840';
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(21, -83);
  c.lineTo(21, -112);
  c.lineTo(40, -112);
  c.stroke();
  c.fillStyle = '#25383c';
  c.fillRect(-29, -77, 58, 47);
  c.fillStyle = spent ? '#526660' : '#c1d8c0';
  c.fillRect(-3, -68, 6, 23);
  c.fillRect(-11, -60, 22, 6);
  c.fillStyle = '#111c22';
  c.fillRect(-28, -24, 56, 8);
  c.fillStyle = spent ? '#40524e' : '#a6bdad';
  c.fillRect(-23, -22, 32, 3);
  c.fillStyle = spent ? '#40524e' : '#e4c594';
  c.fillRect(18, -22, 5, 3);
  c.fillStyle = '#74827f';
  for (const x of [-29, 29]) for (const y of [-77, -16]) c.fillRect(x - 1, y - 1, 2, 2);
  if (service.available && service.nearby && g.mode === 'playing') {
    const lift = reduced ? 0 : Math.sin(g.time * 2) * 1;
    c.font = '600 13px monospace';
    c.textAlign = 'center';
    c.textBaseline = 'bottom';
    c.fillStyle = '#dce4d9';
    c.fillText('Jump · Service', 0, -125 + lift);
  }
  c.restore();
}
