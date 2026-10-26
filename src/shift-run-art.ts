import type { Game } from './game.ts';
import { clamp, distance } from './rules.ts';
import { firstSolid } from './collisions.ts';

/** Draw only the live service/circuit devices owned by ShiftRun. */
export function drawShiftRun(c: CanvasRenderingContext2D, g: Game, reduced = false) {
  const run = g.shiftRun;
  if (!run.enabled || !run.state) return;
  c.save();
  c.lineCap = 'round';
  const junction = run.junction;
  if (junction) {
    const x = 220,
      floor = 740;
    c.fillStyle = '#1a2a2c';
    c.fillRect(x - 31, floor - 88, 62, 88);
    c.strokeStyle = '#536d6b';
    c.lineWidth = 2;
    c.strokeRect(x - 31, floor - 88, 62, 88);
    c.fillStyle = '#0c171b';
    c.fillRect(x - 22, floor - 77, 44, 36);
    c.strokeStyle = '#bacb9b';
    c.lineWidth = 1.5;
    for (const offset of [-12, 0, 12]) {
      c.beginPath();
      c.moveTo(x + offset, floor - 68);
      c.lineTo(x + offset, floor - 51);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(x - 12, floor - 61);
    c.lineTo(x + 12, floor - 61);
    c.stroke();
    c.fillStyle = '#bdb78a';
    c.fillRect(x - 21, floor - 31, 12, 5);
    c.fillStyle = '#769a90';
    c.fillRect(x + 1, floor - 31, 20, 5);
    c.fillStyle = '#869e96';
    c.fillRect(x - 22, floor - 14, 44, 3);
    c.fillStyle = '#c5d0c1';
    c.font = '10px sans-serif';
    c.textAlign = 'center';
    c.fillText('SERVICE', x, floor - 97);
    if (distance(g.player.position, { x, y: 721 }) < 90 && g.grounded && g.mode === 'playing') {
      c.strokeStyle = '#d6c796';
      c.lineWidth = 1;
      c.strokeRect(x - 35, floor - 92, 70, 92);
      c.fillStyle = '#d6c796';
      c.fillText('Jump to use', x, floor - 111);
    }
  }
  if (run.repairNode && !junction) {
    const p = run.repairNode,
      used = run.state.repairs.includes(g.stage);
    c.fillStyle = '#243634';
    c.fillRect(p.x - 23, p.y - 43, 46, 61);
    c.strokeStyle = '#5b7470';
    c.lineWidth = 1.5;
    c.strokeRect(p.x - 23, p.y - 43, 46, 61);
    c.fillStyle = '#0d1a1c';
    c.fillRect(p.x - 16, p.y - 35, 32, 27);
    c.fillStyle = used ? '#536963' : '#b5d6ad';
    c.fillRect(p.x - 3, p.y - 30, 6, 17);
    c.fillRect(p.x - 9, p.y - 25, 18, 6);
    c.fillStyle = used ? '#405650' : '#a5b98c';
    c.fillRect(p.x - 14, p.y + 1, 28, 3);
    if (!used && distance(g.player.position, p) < 60 && g.mode === 'playing') {
      c.font = '10px sans-serif';
      c.textAlign = 'center';
      c.fillStyle = '#c4d2b7';
      c.fillText('Jump · repair', p.x, p.y - 54);
    }
  }
  const shutter = run.shutter;
  if (shutter) {
    const b = shutter.body.bounds,
      top = b.min.y,
      bottom = b.max.y,
      x = shutter.body.position.x;
    c.fillStyle = '#344846';
    c.fillRect(x - 17, top - 8, 34, 12);
    c.strokeStyle = '#6b7c71';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x - 15, top);
    c.lineTo(x - 15, bottom);
    c.moveTo(x + 15, top);
    c.lineTo(x + 15, bottom);
    c.stroke();
    const height = shutter.open ? 20 : bottom - top;
    c.fillStyle = shutter.open ? '#4c6356' : '#596963';
    c.fillRect(x - 10, top, 20, height);
    c.strokeStyle = '#293e3d';
    c.lineWidth = 1;
    for (let y = top + 8; y < top + height; y += 12) {
      c.beginPath();
      c.moveTo(x - 9, y);
      c.lineTo(x + 9, y);
      c.stroke();
    }
    const p = shutter.at;
    c.fillStyle = '#233735';
    c.fillRect(p.x - 12, p.y - 24, 24, 44);
    c.strokeStyle = '#688076';
    c.strokeRect(p.x - 12, p.y - 24, 24, 44);
    c.fillStyle = shutter.open ? '#b9d2aa' : '#deb278';
    c.fillRect(p.x - 5, p.y - 15, 10, 9);
    c.strokeStyle = '#5b7267';
    c.beginPath();
    c.moveTo(p.x + 12, p.y);
    c.lineTo(x - 15, p.y);
    c.stroke();
    if (distance(g.player.position, p) < 65 && g.mode === 'playing') {
      c.fillStyle = '#d0d8c7';
      c.font = '10px sans-serif';
      c.textAlign = 'center';
      c.fillText(shutter.open ? 'Jump · close' : 'Jump · open', p.x, p.y - 35);
    }
  }
  const lamp = run.lamp;
  if (lamp) {
    const p = lamp.at,
      destroyed = lamp.hp <= 0;
    c.strokeStyle = '#4f6360';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(p.x, p.y - 28);
    c.lineTo(p.x, p.y - 13);
    c.stroke();
    c.fillStyle = destroyed ? '#263431' : '#475c55';
    c.fillRect(p.x - 18, p.y - 13, 36, 26);
    c.strokeStyle = '#70877a';
    c.lineWidth = 1.5;
    c.strokeRect(p.x - 18, p.y - 13, 36, 26);
    if (destroyed) {
      c.strokeStyle = '#656452';
      c.beginPath();
      c.moveTo(p.x - 10, p.y - 7);
      c.lineTo(p.x - 2, p.y + 3);
      c.lineTo(p.x + 6, p.y - 4);
      c.lineTo(p.x + 12, p.y + 8);
      c.stroke();
    } else {
      c.save();
      c.translate(p.x, p.y);
      c.rotate(Math.atan2(lamp.aim.y, lamp.aim.x));
      c.fillStyle = '#233935';
      c.fillRect(10, -5, 15, 10);
      c.fillStyle =
        lamp.phase === 'warning' ? '#f0b57e' : lamp.phase === 'recover' ? '#566a5c' : '#a3c6ae';
      c.fillRect(16, -3, 7, 6);
      c.restore();
      c.fillStyle = '#708b70';
      c.fillRect(p.x - 14, p.y - 20, 28 * clamp(lamp.hp / 65, 0, 1), 2);
      if (lamp.phase === 'warning') {
        const from = { x: p.x + lamp.aim.x * 34, y: p.y + lamp.aim.y * 34 };
        const end = { x: from.x + lamp.aim.x * 800, y: from.y + lamp.aim.y * 800 };
        const hit = firstSolid(
          from,
          end,
          { x: 1, y: 1 },
          g.solidBodies.filter((b) => b !== lamp.body),
        );
        const to = hit
          ? { x: from.x + (end.x - from.x) * hit.t, y: from.y + (end.y - from.y) * hit.t }
          : end;
        c.strokeStyle = '#e9ab78';
        c.lineWidth = reduced ? 1.5 : 1;
        c.globalAlpha = reduced ? 0.65 : 0.35 + (1 - clamp(lamp.timer / 0.95, 0, 1)) * 0.45;
        c.setLineDash([7, 7]);
        c.beginPath();
        c.moveTo(from.x, from.y);
        c.lineTo(to.x, to.y);
        c.stroke();
        c.setLineDash([]);
        c.globalAlpha = 1;
      }
    }
  }
  c.restore();
}
