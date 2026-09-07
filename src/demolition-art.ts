import type { Game } from './game.ts';
import { AFTERSHOCK_DELAY, CHAIN_DELAY } from './demolition.ts';
import { clamp, distance } from './rules.ts';

export function drawDemolition(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  c.save();
  const shown: typeof g.demolition.pending = [];
  for (const blast of g.demolition.pending) {
    if (
      shown.some(
        (other) =>
          other.kind === blast.kind &&
          Math.abs(other.at - blast.at) < 0.1 &&
          distance(other.pos, blast.pos) < 24,
      )
    )
      continue;
    shown.push(blast);
    const delay = blast.kind === 'echo' ? AFTERSHOCK_DELAY : CHAIN_DELAY;
    const progress = clamp(1 - (blast.at - g.time) / delay, 0, 1);
    c.strokeStyle = blast.kind === 'echo' ? '#d5b786' : '#d79860';
    c.lineWidth = 1;
    c.globalAlpha = reduced ? 0.36 : 0.25 + progress * 0.25;
    c.setLineDash([3, 9]);
    c.beginPath();
    c.arc(blast.pos.x, blast.pos.y, blast.radius, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
    c.globalAlpha = 0.6;
    c.beginPath();
    c.arc(blast.pos.x, blast.pos.y, 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    c.stroke();
  }
  for (const blast of g.demolition.effects) {
    const age = clamp((g.time - blast.at) / 0.22, 0, 1);
    const spread = reduced ? 1 : 0.35 + 0.65 * Math.sqrt(age);
    c.beginPath();
    blast.outline.forEach((point, i) => {
      const x = blast.pos.x + (point.x - blast.pos.x) * spread;
      const y = blast.pos.y + (point.y - blast.pos.y) * spread;
      if (!i) c.moveTo(x, y);
      else c.lineTo(x, y);
    });
    c.closePath();
    c.fillStyle = blast.kind === 'echo' ? '#e9c994' : '#dfa469';
    c.globalAlpha = (1 - age) * (reduced ? 0.025 : 0.065);
    c.fill();
    c.strokeStyle = blast.kind === 'echo' ? '#eed4aa' : '#efb867';
    c.lineWidth = blast.kind === 'echo' ? 1 : 1.5;
    c.globalAlpha = (1 - age) * (reduced ? 0.3 : 0.65);
    c.stroke();
  }
  c.restore();
}
