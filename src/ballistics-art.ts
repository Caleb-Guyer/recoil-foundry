import type { Game } from './game.ts';
import { clamp, direction } from './rules.ts';
import { CHARGE_TIME, ECHO_DELAY, FUSE_TIME } from './ballistics.ts';

export function drawBallistics(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  c.save();
  // Small attached fuse ticks communicate timing without adding blast circles.
  for (const s of g.ballistics.shells) {
    const ready = clamp(1 - (s.at - g.time) / FUSE_TIME, 0, 1);
    c.strokeStyle = '#f3c28c';
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(s.pos.x, s.pos.y, 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ready);
    c.stroke();
    c.fillStyle = '#f1b368';
    c.fillRect(s.pos.x - 1.5, s.pos.y - 1.5, 3, 3);
  }
  for (const e of g.ballistics.echoes) {
    const phase = clamp((e.at - g.time) / ECHO_DELAY, 0, 1);
    c.save();
    c.translate(e.origin.x, e.origin.y);
    const aim = g.ballistics.has('parallax') && !e.fired ? direction(e.origin, g.aim) : e.direction;
    c.rotate(Math.atan2(aim.y, aim.x));
    c.globalAlpha =
      (e.fired ? clamp(1 - (g.time - e.at) / 0.12, 0, 1) : 0.35 + 0.25 * (1 - phase)) *
      (reduced ? 0.7 : 1);
    c.strokeStyle = '#a7c7b7';
    c.lineWidth = 1.2;
    c.strokeRect(6, -4, 19, 8);
    c.beginPath();
    c.moveTo(25, -2);
    c.lineTo(31, -2);
    c.lineTo(31, 2);
    c.lineTo(25, 2);
    c.stroke();
    c.fillStyle = '#b7dfbf';
    c.fillRect(8, -1, 14 * (1 - phase), 2);
    c.restore();
  }
  for (const [id, pin] of g.ballistics.pins) {
    const e = g.enemies.find((e) => e.id === id);
    if (!e || g.time >= pin.until) continue;
    c.globalAlpha = 0.75;
    c.strokeStyle = '#bfd6d9';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(e.body.position.x - 5, e.body.position.y - 5);
    c.lineTo(e.body.position.x + 5, e.body.position.y + 5);
    c.moveTo(e.body.position.x + 5, e.body.position.y - 5);
    c.lineTo(e.body.position.x - 5, e.body.position.y + 5);
    c.stroke();
  }
  c.restore();
}

export function drawCapacitor(c: CanvasRenderingContext2D, g: Game) {
  if (!g.ballistics.has('capacitor')) return;
  const n = g.ballistics.has('reserve-cell') ? 2 : 1;
  for (let i = 0; i < n; i++) {
    c.fillStyle = '#304c42';
    c.fillRect(10 + i * 7, -8, 5, 2.5);
    c.fillStyle = g.fusions.has('rail-spike') ? '#b7e4ef' : '#cbe6ad';
    const charge =
      i < g.ballistics.charges
        ? 1
        : i === g.ballistics.charges
          ? clamp(g.ballistics.idle / CHARGE_TIME, 0, 1)
          : 0;
    c.fillRect(10 + i * 7, -8, 5 * charge, 2.5);
  }
}
