import type { Game } from './game.ts';
import { PORTAL_RADIUS, PORTAL_COLORS } from './portals.ts';
import type { Portal } from './portals.ts';

export function drawPortals(c: CanvasRenderingContext2D, g: Game, clock: number, reduced: boolean) {
  if (!g.portals.equipped) return;
  const aperture = (p: Portal, index: number, preview = false) => {
    c.save();
    c.translate(p.pos.x, p.pos.y);
    c.rotate(Math.atan2(p.normal.y, p.normal.x));
    const color = PORTAL_COLORS[index];
    c.globalAlpha = preview ? 0.42 : 1;
    c.strokeStyle = color;
    c.lineWidth = preview ? 1.5 : 2.5;
    if (preview) c.setLineDash([4, 5]);
    else {
      const halo = c.createRadialGradient(0, 0, 1, 0, 0, PORTAL_RADIUS + 12);
      halo.addColorStop(0, color + (g.portals.linked ? '35' : '16'));
      halo.addColorStop(1, color + '00');
      c.fillStyle = halo;
      c.fillRect(-12, -52, 45, 104);
      c.shadowBlur = reduced ? 4 : 10;
      c.shadowColor = color;
    }
    c.beginPath();
    c.ellipse(1.5, 0, preview ? 4 : 7, PORTAL_RADIUS, 0, 0, Math.PI * 2);
    if (!preview) {
      c.fillStyle = '#101d27';
      c.fill();
    }
    c.stroke();
    c.shadowBlur = 0;
    if (!preview && g.portals.linked) {
      c.globalAlpha = reduced ? 0.7 : 0.65 + Math.sin(clock * 3 + index * 2) * 0.15;
      c.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const phase = reduced ? i / 3 : (clock * 0.45 + i / 3) % 1;
        c.beginPath();
        c.ellipse(1.5, 0, 2 + phase * 3, 8 + phase * 28, 0, 0, Math.PI * 2);
        c.stroke();
      }
    }
    // The second endpoint gets a second tiny rim notch, retaining a non-color cue.
    c.globalAlpha = preview ? 0.5 : 0.9;
    c.setLineDash([]);
    for (let i = 0; i <= index; i++) {
      const y = (i - index / 2) * 7;
      c.beginPath();
      c.moveTo(11, y);
      c.lineTo(16, y);
      c.stroke();
    }
    c.restore();
  };
  g.portals.pair.forEach((p, i) => {
    if (p) aperture(p, i);
  });
  if (g.mode === 'playing' && g.escape?.phase !== 'extracting') {
    const preview = g.portals.candidate(g.aim);
    if (preview) aperture(preview, g.portals.nextIndex, true);
    const rejected = g.portals.rejected;
    if (rejected && rejected.until > g.time) {
      c.save();
      c.globalAlpha = (rejected.until - g.time) / 0.22;
      c.strokeStyle = '#ef8273';
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(rejected.pos.x, rejected.pos.y, 7, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
  }
}
