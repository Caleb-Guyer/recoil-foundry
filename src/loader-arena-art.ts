import type { Game } from './game.ts';
import { clamp } from './rules.ts';
import { LOADER_COLLAPSE_TELL } from './loader-arena.ts';

export function drawLoaderSupports(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  for (const support of g.loaderArena.supports) {
    const r = support.barrier.rect;
    const intact = g.destruction.pieces.includes(support.barrier);
    const warning = support.state === 'warning';
    const progress = clamp(1 - (support.releaseAt - g.time) / LOADER_COLLAPSE_TELL, 0, 1);
    const side = support.cargo.cargo!.origin.x > r.x + r.w / 2 ? 1 : -1;
    const postX = side > 0 ? r.x + r.w - 12 : r.x + 12;
    const anchor = support.cargo.cargo!.anchor;
    c.save();
    // A thin recessed service frame visually links each bumper to its load.
    // It is background steel, without an invisible collision surface.
    c.strokeStyle = warning ? '#ad8b63' : '#3c4b4e';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(postX, intact ? r.y : r.y - 28);
    c.lineTo(postX, anchor.y - 12);
    c.lineTo(anchor.x, anchor.y - 12);
    c.lineTo(anchor.x, anchor.y);
    c.stroke();
    if (intact) {
      c.fillStyle = '#171f22';
      c.fillRect(r.x + 6, r.y + 12, r.w - 12, 15);
      c.strokeStyle = warning ? '#efbc7d' : '#af966f';
      c.lineWidth = 3;
      for (let x = r.x + 16; x < r.x + r.w - 12; x += 24) {
        c.beginPath();
        c.moveTo(x - side * 5, r.y + 15);
        c.lineTo(x + side * 3, r.y + 19);
        c.lineTo(x - side * 5, r.y + 23);
        c.stroke();
      }
      c.fillStyle = warning ? '#eac28d' : '#7f8a82';
      for (const x of [r.x + 10, r.x + r.w - 10]) {
        c.fillRect(x - 2, r.y + 38, 4, 4);
        c.fillRect(x - 2, r.y + r.h - 12, 4, 4);
      }
      if (warning) {
        c.strokeStyle = '#edbd7c';
        c.lineWidth = 2;
        c.setLineDash([5, 5]);
        c.strokeRect(r.x - 4, r.y - 4, r.w + 8, r.h + 4);
        c.setLineDash([]);
        c.globalAlpha = reduced ? 1 : 0.55 + progress * 0.45;
        c.fillRect(r.x + 6, r.y + 3, (r.w - 12) * progress, 2);
      }
    } else {
      c.fillStyle = '#596461';
      c.fillRect(postX - 6, r.y - 36, 12, 5);
    }
    c.restore();
  }
}
