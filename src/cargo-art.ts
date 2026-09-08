import type { Game } from './game.ts';
import { CARGO_SIZE } from './cargo-layout.ts';
import { CABLE_HP, CARGO_TELL } from './cargo.ts';

export function drawCargoCables(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  for (const p of g.cargo.items) {
    const r = p.cargo!;
    if (r.state === 'loose') continue;
    const x = r.anchor.x,
      bottom = r.origin.y - CARGO_SIZE.h / 2,
      joint = Math.max(r.anchor.y + 14, bottom - 48);
    const warning = r.state === 'warning';
    c.save();
    c.strokeStyle = r.flash > 0 ? '#efe0c0' : warning ? '#dbac70' : '#a39d89';
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(x, r.anchor.y);
    c.lineTo(x, joint - 5);
    c.moveTo(x, joint + 5);
    c.lineTo(x, bottom);
    c.stroke();
    c.fillStyle = '#29343b';
    c.fillRect(x - 19, r.anchor.y - 7, 38, 7);
    c.fillStyle = warning ? '#edbd7c' : '#b9a57b';
    c.fillRect(x - 6, joint - 6, 12, 12);
    if (r.cableHp < CABLE_HP) {
      c.strokeStyle = '#17212a';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x - 5, joint - 3);
      c.lineTo(x + 3, joint);
      c.lineTo(x - 2, joint + 5);
      c.stroke();
    }
    if (warning) {
      const progress = 1 - Math.max(0, r.releaseAt - g.time) / CARGO_TELL;
      c.fillStyle = 'rgba(220,163,89,0.06)';
      c.fillRect(x - CARGO_SIZE.w / 2, bottom, CARGO_SIZE.w, 740 - bottom);
      c.strokeStyle = '#e8b577';
      c.lineWidth = 2;
      c.setLineDash([6, 5]);
      c.beginPath();
      c.moveTo(x - CARGO_SIZE.w / 2, 736);
      c.lineTo(x + CARGO_SIZE.w / 2, 736);
      c.stroke();
      c.setLineDash([]);
      c.globalAlpha = reduced ? 1 : 0.6 + progress * 0.4;
      c.strokeRect(
        x - CARGO_SIZE.w / 2 - 4,
        r.origin.y - CARGO_SIZE.h / 2 - 4,
        CARGO_SIZE.w + 8,
        CARGO_SIZE.h + 8,
      );
    }
    c.restore();
  }
}
