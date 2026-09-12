import type { Game } from './game.ts';
import { ARC_EFFECT_LIFE } from './arc-coil.ts';
import { clamp, distance } from './rules.ts';

export function drawArcs(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  c.save();
  c.strokeStyle = '#b5d9e5';
  c.lineWidth = 1.3;
  for (const charge of g.arcs.charges.values()) {
    if (charge.enemy.hp <= 0 || charge.until <= g.time) continue;
    const flash = clamp(1 - (g.time - charge.flashAt) / 0.24, 0, 1);
    if (!flash) continue;
    const p = charge.enemy.body.position;
    c.globalAlpha = flash * (reduced ? 0.35 : 0.8);
    c.beginPath();
    for (let i = 0; i < charge.hits; i++) {
      const bounds = charge.enemy.body.bounds;
      const x = i ? bounds.min.x - 5 : bounds.max.x + 5;
      const y = p.y - 3;
      c.moveTo(x - 3, y - 5);
      c.lineTo(x + 1, y - 1);
      c.lineTo(x - 2, y + 2);
      c.lineTo(x + 2, y + 6);
    }
    c.stroke();
  }
  for (const f of g.arcs.effects) {
    const life = clamp(1 - (g.time - f.at) / ARC_EFFECT_LIFE, 0, 1),
      length = distance(f.a, f.b);
    if (!life || length < 0.1) continue;
    c.globalAlpha = life * (reduced ? 0.45 : 0.9) * (1 - f.hop * 0.14);
    c.lineWidth = reduced ? 1.2 : 1.8;
    const nx = -(f.b.y - f.a.y) / length,
      ny = (f.b.x - f.a.x) / length;
    const count = Math.max(2, Math.ceil(length / 24));
    c.beginPath();
    c.moveTo(f.a.x, f.a.y);
    for (let i = 1; i < count; i++) {
      // A fixed bend pattern makes a brief arc, without flicker or RNG use.
      const offset = (i % 2 ? 1 : -1) * (reduced ? 1.5 : 4);
      c.lineTo(
        f.a.x + ((f.b.x - f.a.x) * i) / count + nx * offset,
        f.a.y + ((f.b.y - f.a.y) * i) / count + ny * offset,
      );
    }
    c.lineTo(f.b.x, f.b.y);
    c.stroke();
  }
  c.restore();
}
