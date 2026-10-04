import type { Game } from './game.ts';
import { drawOutfit } from './cosmetics.ts';
import { drawWeapon } from './weapon-art.ts';
import { recoilDelta, RECOIL_SPLITS } from './recoil-race-rules.ts';

export function drawRecoilRace(c: CanvasRenderingContext2D, g: Game) {
  if (!g.recoil.practice || !g.recoil.active || !['playing', 'paused'].includes(g.mode)) return;
  const race = g.recoil.race,
    frame = race.frame;
  if (frame) {
    const [ms, x, y, angle, flags] = frame;
    c.save();
    c.translate(x, y);
    c.globalAlpha = 0.28;
    drawOutfit(c, g.cosmetics.outfit, flags & 2 ? -1 : 1, flags & 1 ? 0.5 : 0);
    c.strokeStyle = '#a9dce4';
    c.lineWidth = 1.5;
    c.strokeRect(-15, -20, 30, 40);
    c.fillStyle = '#c6e7ec';
    c.font = '9px monospace';
    c.textAlign = 'center';
    c.fillText('YOUR GHOST', 0, -29);
    c.translate(0, -3);
    c.rotate((angle * Math.PI) / 180);
    // A rendering-only view shadows the clock; no shared state or physics writes.
    const weapon: Game = Object.create(g);
    weapon.time = ms / 1000;
    weapon.lastShot = flags & 4 ? weapon.time - 0.04 : -100;
    weapon.muzzle = 0;
    drawWeapon(c, weapon, true);
    c.restore();
  }
  const split = race.split;
  if (split) {
    const p = g.player.position,
      text =
        split.index + 1 + '/' + RECOIL_SPLITS[g.recoil.kind] + ' · ' + recoilDelta(split.deltaMs);
    c.save();
    c.font = '11px monospace';
    c.textAlign = 'center';
    const width = c.measureText(text).width + 18;
    c.fillStyle = '#142329';
    c.fillRect(p.x - width / 2, p.y - 66, width, 22);
    c.fillStyle = split.deltaMs <= 0 ? '#b1dbcc' : '#e7c491';
    c.fillText(text, p.x, p.y - 51);
    c.restore();
  }
}
