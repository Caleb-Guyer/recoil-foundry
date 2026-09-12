import type { Game } from './game.ts';
import { CINDER_LIFE } from './boss-salvage.ts';
import { FLASH_LIFE, FLASH_RADIUS, WRECK_LIFE } from './salvage-evolutions.ts';
import { clamp, direction } from './rules.ts';

export function drawBossSalvage(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  c.save();
  for (const f of g.salvage.cinders) {
    const fade = clamp((f.until - g.time) / CINDER_LIFE, 0, 1);
    c.globalAlpha = fade * (reduced ? 0.45 : 0.75);
    c.strokeStyle = '#e9a06f';
    c.lineWidth = 2;
    const n = f.outward,
      t = { x: -n.y, y: n.x };
    c.beginPath();
    for (let i = -2; i <= 2; i++) {
      const x = f.pos.x + t.x * i * 7,
        y = f.pos.y + t.y * i * 7;
      c.moveTo(x, y);
      const height = i % 2 ? 5 : 9;
      c.quadraticCurveTo(
        x + n.x * 3 - t.x * 3,
        y + n.y * 3 - t.y * 3,
        x + n.x * height + t.x * 2,
        y + n.y * height + t.y * 2,
      );
    }
    c.stroke();
  }
  c.strokeStyle = '#b4cec7';
  c.lineWidth = 1;
  for (const f of g.salvage.gusts) {
    c.globalAlpha = clamp(1 - (g.time - f.at) / g.salvage.windLife, 0, 1) * (reduced ? 0.1 : 0.22);
    const d = direction(f.a, f.b);
    c.beginPath();
    c.moveTo(f.a.x - d.y * 7, f.a.y + d.x * 7);
    c.quadraticCurveTo(
      (f.a.x + f.b.x) / 2 - d.y * 11,
      (f.a.y + f.b.y) / 2 + d.x * 11,
      f.b.x - d.y * 7,
      f.b.y + d.x * 7,
    );
    c.stroke();
    if (g.mods.includes('slipstream')) {
      const x = (f.a.x + f.b.x) / 2,
        y = (f.a.y + f.b.y) / 2;
      c.beginPath();
      c.moveTo(x - d.x * 4 - d.y * 3, y - d.y * 4 + d.x * 3);
      c.lineTo(x + d.x * 3, y + d.y * 3);
      c.lineTo(x - d.x * 4 + d.y * 3, y - d.y * 4 - d.x * 3);
      c.stroke();
    }
  }
  for (const w of g.salvageEvolutions.wrecks) {
    const fade = clamp(((w.until - g.time) / WRECK_LIFE) * 3, 0, 1);
    const p = w.body.position,
      d = direction({ x: 0, y: 0 }, w.body.velocity);
    c.globalAlpha = fade * (reduced ? 0.4 : 0.7);
    c.strokeStyle = '#d7b991';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(p.x - d.x * 22, p.y - d.y * 22);
    c.lineTo(p.x - d.x * 40, p.y - d.y * 40);
    c.stroke();
    if (w.corpse) {
      c.fillStyle = '#ab7568';
      c.beginPath();
      w.body.vertices.forEach((v, i) => (i ? c.lineTo(v.x, v.y) : c.moveTo(v.x, v.y)));
      c.closePath();
      c.fill();
    }
  }
  for (const f of g.salvageEvolutions.flashes) {
    const t = clamp((g.time - f.at) / FLASH_LIFE, 0, 1);
    c.globalAlpha = (1 - t) * (reduced ? 0.3 : 0.7);
    c.strokeStyle = '#efb375';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(f.pos.x, f.pos.y, FLASH_RADIUS * (reduced ? 0.6 : 0.35 + t * 0.65), 0, Math.PI * 2);
    c.stroke();
  }
  if (g.salvage.ramReady) {
    const p = g.player.position,
      d = direction({ x: 0, y: 0 }, g.player.velocity);
    c.globalAlpha = reduced ? 0.35 : 0.65;
    c.lineWidth = 2;
    c.strokeStyle = '#e9c28c';
    c.beginPath();
    for (const side of [-1, 1]) {
      c.moveTo(p.x - d.x * 12 - d.y * side * 10, p.y - d.y * 12 + d.x * side * 10);
      c.lineTo(p.x - d.x * 29 - d.y * side * 10, p.y - d.y * 29 + d.x * side * 10);
    }
    c.stroke();
  }
  c.restore();
}
