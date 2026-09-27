import type { Game } from './game.ts';
import { CARGO_SIZE } from './cargo-layout.ts';
import { CABLE_HP, CARGO_TELL } from './cargo.ts';

export function drawCargoCables(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  // Rails remain part of the room after a load lands or is destroyed.
  for (const p of g.level.setpiece?.cargo ?? []) {
    if (!p.transport) continue;
    const left = Math.min(p.x, p.transport.toX) - 60;
    const width = Math.abs(p.x - p.transport.toX) + 120;
    c.save();
    c.strokeStyle = '#43513f';
    c.lineWidth = 2;
    c.beginPath();
    for (const x of [left + 20, left + width - 20]) {
      c.moveTo(x, 100);
      c.lineTo(x, p.anchorY - 12);
    }
    c.stroke();
    c.fillStyle = '#26362d';
    c.fillRect(left, p.anchorY - 12, width, 12);
    c.strokeStyle = '#71806a';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(left, p.anchorY);
    c.lineTo(left + width, p.anchorY);
    c.stroke();
    c.fillStyle = '#95855b';
    for (const x of [left, left + width - 5]) c.fillRect(x, p.anchorY - 14, 5, 19);
    c.restore();
  }
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
    if (r.rail) {
      c.fillStyle = r.disabled
        ? '#667263'
        : warning && !reduced && Math.sin(g.time * 18) > 0
          ? '#ffe2a0'
          : '#dbb961';
      c.fillRect(x - 11, joint - 11, 22, 22);
      c.fillStyle = '#3b4333';
      c.fillRect(x - 6, joint - 2, 12, 4);
      c.fillStyle = '#8c997e';
      for (const wheel of [-12, 12]) {
        c.beginPath();
        c.arc(x + wheel, r.anchor.y - 5, 5, 0, Math.PI * 2);
        c.fill();
      }
    } else c.fillRect(x - 6, joint - 6, 12, 12);
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
      if (r.rail) {
        c.fillStyle = '#c2ae83';
        c.globalAlpha = 0.7;
        for (let n = 0; n < (reduced ? 2 : 5); n++) {
          const fall = reduced ? 14 + n * 12 : (g.time * 80 + n * 23) % 65;
          c.fillRect(x - 34 + n * 15, r.origin.y + CARGO_SIZE.h / 2 + fall, 2, 3);
        }
        c.globalAlpha = 1;
      }
      const floor = g.lineEnd({ x, y: r.origin.y + CARGO_SIZE.h / 2 + 1 }, { x, y: 740 }, 0, p).y;
      const progress = 1 - Math.max(0, r.releaseAt - g.time) / (r.tell ?? CARGO_TELL);
      c.fillStyle = 'rgba(220,163,89,0.06)';
      c.fillRect(x - CARGO_SIZE.w / 2, bottom, CARGO_SIZE.w, floor - bottom);
      c.strokeStyle = '#e8b577';
      c.lineWidth = 2;
      c.setLineDash([6, 5]);
      c.beginPath();
      c.moveTo(x - CARGO_SIZE.w / 2, floor - 4);
      c.lineTo(x + CARGO_SIZE.w / 2, floor - 4);
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
