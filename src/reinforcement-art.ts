import type { Game } from './game.ts';
import { AREAS } from './areas.ts';
import { ENEMY_STATS } from './enemies.ts';
import { REINFORCEMENT_ENTRY, REINFORCEMENT_TELL } from './reinforcements.ts';
import { clamp } from './rules.ts';

export function drawReinforcementDoors(
  c: CanvasRenderingContext2D,
  g: Game,
  reduced: boolean,
): void {
  const palette = AREAS[g.level.area];
  c.save();
  for (const door of g.waves.doors) {
    const hull = ENEMY_STATS[door.spawn.kind],
      vent = door.spawn.kind === 'flyer',
      w = hull.w + (vent ? 20 : 16),
      h = hull.h + (vent ? 12 : 16),
      left = -w / 2,
      top = -h / 2,
      warning = door.state === 'warning',
      charge = warning ? clamp(1 - door.timer / REINFORCEMENT_TELL, 0, 1) : 0,
      opening =
        door.state === 'spent'
          ? 1
          : door.state === 'open'
            ? reduced
              ? 1
              : clamp(1 - door.timer / REINFORCEMENT_ENTRY, 0, 1)
            : 0;
    c.save();
    c.translate(door.spawn.x, door.spawn.y);

    // Recessed frames lack the bright top edge used by physical cover.
    c.fillStyle = palette.detail;
    c.fillRect(left - 4, top - 4, w + 8, h + 8);
    c.fillStyle = '#111b20';
    c.fillRect(left, top, w, h);
    c.strokeStyle = palette.edge;
    c.lineWidth = 1;
    c.strokeRect(left - 2.5, top - 2.5, w + 5, h + 5);
    c.fillStyle = palette.face;
    if (vent) {
      c.fillRect(left + 7, top - 8, 5, 4);
      c.fillRect(-left - 12, top - 8, 5, 4);
    } else {
      c.fillRect(left - 6, top + 9, 2, h - 15);
      c.fillRect(-left + 4, top + 9, 2, h - 15);
    }

    c.save();
    c.beginPath();
    c.rect(left, top, w, h);
    c.clip();
    for (const side of [-1, 1]) {
      c.save();
      c.translate(vent ? 0 : (side * w * opening) / 2, vent ? (side * h * opening) / 2 : 0);
      const x = vent ? left : side < 0 ? left : 0.75,
        y = vent ? (side < 0 ? top : 0.75) : top,
        leafW = vent ? w : w / 2 - 0.75,
        leafH = vent ? h / 2 - 0.75 : h;
      c.fillStyle = palette.face;
      c.fillRect(x, y, leafW, leafH);
      c.fillStyle = palette.body;
      c.fillRect(x + 2, y + 2, leafW - 4, leafH - 4);
      if (vent) {
        c.fillStyle = '#172228';
        for (let slot = 0; slot < 2; slot++) c.fillRect(x + 7, y + 7 + slot * 7, w - 14, 2);
      } else {
        c.fillStyle = palette.detail;
        c.fillRect(x + 4, y + 7, leafW - 8, 2);
        c.fillRect(x + 4, y + leafH - 10, leafW - 8, 2);
        c.fillStyle = palette.edge;
        c.fillRect(side < 0 ? -4 : 2, -3, 2, 6);
      }
      c.restore();
    }
    if (warning) {
      c.fillStyle = `rgba(229,160,88,${0.015 + charge * 0.025})`;
      c.fillRect(left, top, w, h);
    }
    c.restore();

    // One integrated lamp becomes a steady arrival cue, without screen flashes.
    c.fillStyle = '#172126';
    c.fillRect(-10, top - 6, 20, 5);
    c.fillStyle = warning ? '#725337' : palette.detail;
    c.fillRect(-8, top - 5, 16, 2);
    if (warning || door.state === 'open') {
      c.fillStyle = warning ? '#e4b376' : '#94734b';
      c.fillRect(-8, top - 5, warning ? 3 + charge * 13 : 16, 2);
    }
    c.restore();
  }
  c.restore();
}
