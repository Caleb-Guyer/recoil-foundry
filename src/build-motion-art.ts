import type { Game } from './game.ts';
import { buildMotionCue } from './build-motion.ts';

/** One quiet action hint below the player; committed threat layers are drawn afterwards. */
export function drawBuildMotion(c: CanvasRenderingContext2D, g: Game, reduced = false, scale = 1) {
  const cue = buildMotionCue(g);
  if (!cue) return;
  const zoom = Math.max(0.4, scale),
    p = g.player.position;
  c.save();
  c.font = `${11 / zoom}px sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const width = c.measureText(cue.label).width + 14 / zoom;
  const inset = width / 2 + 8 / zoom;
  const x = Math.max(inset, Math.min(g.worldWidth - inset, p.x));
  const y = p.y + 39 + 7 / zoom;
  c.fillStyle = '#101a1ee8';
  c.fillRect(x - width / 2, y - 9 / zoom, width, 18 / zoom);
  c.fillStyle = reduced ? '#dae8da' : '#c4dccb';
  c.fillText(cue.label, x, y);
  c.restore();
}
