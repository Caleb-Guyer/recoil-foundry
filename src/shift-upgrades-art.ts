import type { Game } from './game.ts';
import { clamp, distance } from './rules.ts';
import { firstSolid } from './collisions.ts';
import { SHIFT, mountPoint, mountNormal, type ShiftUpgrades } from './shift-upgrades.ts';

/** Finite world-space cues; no extra HUD panel or cosmetic gameplay randomness. */
export function drawShiftUpgrades(c: CanvasRenderingContext2D, g: Game, reduced = false) {
  const shift = (g as Game & { shiftUpgrades?: ShiftUpgrades }).shiftUpgrades;
  if (!shift) return;
  c.save();
  c.lineCap = 'round';
  const marks = [...shift.polarity.values()].filter((m) => m.until > g.time && m.enemy.hp > 0);
  for (let i = 0; i < marks.length; i++) {
    const a = marks[i],
      p = a.enemy.body.position;
    c.strokeStyle = a.pole > 0 ? '#e0ae83' : '#91c1cd';
    c.globalAlpha = 0.8;
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(p.x, p.y - 28, 6, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.moveTo(p.x - 3, p.y - 28);
    c.lineTo(p.x + 3, p.y - 28);
    if (a.pole > 0) {
      c.moveTo(p.x, p.y - 31);
      c.lineTo(p.x, p.y - 25);
    }
    c.stroke();
    for (let j = i + 1; j < marks.length; j++) {
      const b = marks[j],
        q = b.enemy.body.position;
      if (distance(p, q) > SHIFT.polarityRange || firstSolid(p, q, { x: 1, y: 1 }, g.solidBodies))
        continue;
      c.globalAlpha = 0.18;
      c.setLineDash(a.pole === b.pole ? [3, 7] : [8, 5]);
      c.beginPath();
      c.moveTo(p.x, p.y);
      c.lineTo(q.x, q.y);
      c.stroke();
      c.setLineDash([]);
    }
  }
  for (const rivet of shift.rivets) {
    if (rivet.until <= g.time) continue;
    const p = mountPoint(rivet),
      n = mountNormal(rivet),
      t = { x: -n.y, y: n.x };
    c.globalAlpha = clamp((rivet.until - g.time) / 0.6, 0, 1);
    c.strokeStyle = '#c0d6a5';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(p.x - t.x * 19, p.y - t.y * 19);
    c.lineTo(p.x + t.x * 19, p.y + t.y * 19);
    for (let i = -2; i <= 2; i++) {
      const x = p.x + t.x * i * 6,
        y = p.y + t.y * i * 6;
      c.moveTo(x, y);
      c.lineTo(x + n.x * (i % 2 ? 5 : 9), y + n.y * (i % 2 ? 5 : 9));
    }
    c.stroke();
    c.beginPath();
    c.moveTo(p.x + n.x * 15 - t.x * 5, p.y + n.y * 15 - t.y * 5);
    c.lineTo(p.x + n.x * 21, p.y + n.y * 21);
    c.lineTo(p.x + n.x * 15 + t.x * 5, p.y + n.y * 15 + t.y * 5);
    c.stroke();
  }
  const wire = shift.wire;
  const paths = wire && wire.until > g.time ? wire.points : shift.trail;
  if (paths.length > 1) {
    c.globalAlpha = wire ? clamp((wire.until - g.time) / 0.25, 0, 0.75) : 0.25;
    c.strokeStyle = '#accab7';
    c.lineWidth = wire ? 2 : 1;
    if (!wire) c.setLineDash([4, 5]);
    c.beginPath();
    c.moveTo(paths[0].x, paths[0].y);
    for (const p of paths.slice(1)) c.lineTo(p.x, p.y);
    c.stroke();
    c.setLineDash([]);
  }
  const decoy = shift.silhouette;
  if (decoy && decoy.until > g.time) {
    const p = decoy.pos;
    c.globalAlpha = clamp((decoy.until - g.time) / 0.3, 0, reduced ? 0.4 : 0.55);
    c.strokeStyle = '#a9c4c6';
    c.lineWidth = 1.5;
    c.setLineDash([4, 3]);
    c.strokeRect(p.x - 13, p.y - 18, 26, 36);
    c.strokeRect(p.x + decoy.facing * 13 - (decoy.facing < 0 ? 20 : 0), p.y - 7, 20, 7);
    c.setLineDash([]);
    c.fillStyle = '#a9c4c6';
    c.fillRect(p.x - 7, p.y - 11, 14, 3);
  }
  const nozzle = shift.nozzle;
  if (nozzle && nozzle.until > g.time) {
    const p = mountPoint(nozzle),
      n = mountNormal(nozzle);
    c.save();
    c.globalAlpha = 0.85;
    c.translate(p.x + n.x * 3, p.y + n.y * 3);
    c.rotate(Math.atan2(n.y, n.x));
    c.fillStyle = '#384b4a';
    c.fillRect(-3, -8, 10, 16);
    c.strokeStyle = '#d1b48a';
    c.lineWidth = 1.5;
    c.strokeRect(1, -5, 12, 10);
    c.fillStyle = nozzle.used === undefined ? '#c1d3a4' : '#768c81';
    c.fillRect(5, -2, 5, 4);
    c.restore();
  }
  if (shift.slipReady) {
    const p = g.player.position;
    c.globalAlpha = 0.65;
    c.strokeStyle = '#a5d0ce';
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(p.x, p.y, 25, -0.5, 0.5);
    c.moveTo(p.x - 22, p.y + 12);
    c.arc(p.x, p.y, 25, Math.PI - 0.5, Math.PI + 0.5);
    c.stroke();
  }
  if (shift.slipReady && shift.slipCharges > 1) {
    const p = g.player.position;
    c.globalAlpha = 0.7;
    c.fillStyle = '#a5d0ce';
    c.fillRect(p.x - 3, p.y + 28, 2, 3);
    c.fillRect(p.x + 2, p.y + 28, 2, 3);
  }
  if (shift.battery > 0 && g.mods.includes('momentum-battery')) {
    const p = g.player.position,
      count = Math.ceil((shift.battery / SHIFT.batteryCap) * 4);
    c.globalAlpha = 0.8;
    c.fillStyle = '#cbd3a0';
    for (let i = 0; i < count; i++) c.fillRect(p.x - 9 + i * 5, p.y + 22, 3, 3);
  }
  if (shift.flashPoint && shift.flash > 0 && !reduced) {
    c.globalAlpha = shift.flash * 2;
    c.strokeStyle = '#d3e1bf';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(shift.flashPoint.x, shift.flashPoint.y, 12 + (0.2 - shift.flash) * 35, 0, Math.PI * 2);
    c.stroke();
  }
  c.restore();
}
