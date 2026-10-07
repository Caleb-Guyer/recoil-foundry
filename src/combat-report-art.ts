import { Game } from './game.ts';
import { getGun } from './rules.ts';
import { drawWeapon } from './weapon-art.ts';
import { drawOutfit } from './cosmetics.ts';
import type { ReportGun } from './combat-report-menu.ts';

let preview: Game | undefined;
export function drawCombatReportImages(root: HTMLElement, records: readonly ReportGun[]) {
  const canvases = root.querySelectorAll<HTMLCanvasElement>('canvas[data-run-gun]');
  if (!canvases.length) return;
  const g = (preview ??= new Game());
  for (const canvas of Array.from(canvases)) {
    const run = records[Number(canvas.dataset.runGun)];
    if (!run) continue;
    // Use the exact gameplay art in an idle display object. No live run is mutated.
    g.seed = run.seed;
    g.mods = [...run.mods];
    g.startingGun = run.startingGun ?? 'pistol';
    g.gun = getGun(g.mods, g.startingGun);
    g.cosmetics = { ...(run.appearance ?? { gun: 'standard', outfit: 'standard' }) };
    g.time = 10;
    g.lastShot = -99;
    g.muzzle = 0;
    g.support.reset();
    const c = canvas.getContext('2d');
    if (!c) continue;
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = '#101c20';
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.strokeStyle = '#26383b';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(40, 156);
    c.lineTo(600, 156);
    c.stroke();
    c.save();
    c.translate(110, 108);
    c.scale(2.5, 2.5);
    drawOutfit(c, g.cosmetics.outfit, 1, 0);
    c.restore();
    c.save();
    c.translate(250, 102);
    c.scale(6, 6);
    drawWeapon(c, g, true);
    c.restore();
  }
}
