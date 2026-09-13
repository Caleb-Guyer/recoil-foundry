import type { Game } from './game.ts';
import type { WireAnchor } from './tripwire.ts';
import { TRIPWIRE } from './tripwire.ts';
import { clamp } from './rules.ts';
export function drawTripwires(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  const system = g.tripwires;
  if (!system.anchor && !system.wires.length) return;
  c.save();
  const pin = (a: WireAnchor, bright: boolean) => {
    c.save();
    c.translate(a.pos.x, a.pos.y);
    c.rotate(Math.atan2(a.normal.y, a.normal.x));
    c.fillStyle = '#384344';
    c.fillRect(-3, -4, 4, 8);
    c.fillStyle = bright ? '#f1cf85' : '#9aa892';
    c.fillRect(0, -2, 3, 4);
    c.restore();
  };
  for (const w of system.wires) {
    const ready = g.time >= w.at,
      armed = clamp(1 - (w.at - g.time) / TRIPWIRE.arm, 0, 1);
    c.strokeStyle = w.tension > 0.5 ? '#edc27f' : '#b6c4a2';
    c.globalAlpha = ready ? 0.64 : 0.25 + armed * 0.2;
    c.lineWidth = 1;
    c.setLineDash(ready ? [] : [3, 5]);
    c.beginPath();
    c.moveTo(w.a.pos.x, w.a.pos.y);
    c.lineTo(w.b.pos.x, w.b.pos.y);
    c.stroke();
    c.setLineDash([]);
    if (!reduced && ready && g.time - w.at < 0.2) {
      c.globalAlpha = (1 - (g.time - w.at) / 0.2) * 0.18;
      c.lineWidth = 4;
      c.stroke();
    }
    c.globalAlpha = 1;
    pin(w.a, ready);
    pin(w.b, ready);
  }
  c.globalAlpha = 1;
  if (system.anchor) pin(system.anchor, false);
  c.restore();
}
