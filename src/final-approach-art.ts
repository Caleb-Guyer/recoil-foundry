import type { Game } from './game.ts';
import { clamp } from './rules.ts';
import {
  finalApproachAtmosphere,
  getFinalApproachRoom,
  FINAL_APPROACH_WARNING,
} from './final-approach.ts';

const TAU = Math.PI * 2;
function canonical(c: CanvasRenderingContext2D, g: Game) {
  if (g.level.mirrored) {
    c.translate(2000, 0);
    c.scale(-1, 1);
  }
}
function line(c: CanvasRenderingContext2D, points: number[], color: string, width = 2) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.stroke();
}
function shape(c: CanvasRenderingContext2D, points: number[], color: string) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.closePath();
  c.fill();
}
function flyover(g: Game, reduced: boolean) {
  return reduced ? 1470 : 2600 - (((g.time + g.stage * 1.7) % 30) / 14) * 3400;
}
// A distant silhouette of the same wide, twin-duct transport used in the finale.
function transport(c: CanvasRenderingContext2D, x: number, scale: number) {
  c.save();
  c.translate(x, 100);
  c.scale(scale, scale);
  shape(c, [-80, -18, -270, -132, -362, -128, -232, -10, -285, 72, -188, 80, 33, 12], '#182b34');
  shape(c, [111, -7, 342, -100, 411, -94, 290, -2, 364, 46, 291, 60, 94, 29], '#182b34');
  shape(
    c,
    [-386, -13, -337, -38, -128, -49, 139, -36, 329, -10, 303, 31, 130, 46, -194, 44, -349, 17],
    '#263c43',
  );
  shape(c, [245, -18, 320, -101, 350, -101, 337, -10], '#30474c');
  shape(c, [-337, -32, -274, -36, -289, -11, -360, -7], '#0d222b');
  line(c, [-330, -29, -297, -31, -307, -15, -346, -12], '#657c79', 2);
  for (const side of [-1, 1]) {
    c.fillStyle = '#1a2b31';
    c.fillRect(side * 240 - 31, -39, 62, 91);
    c.fillStyle = '#50655e';
    c.fillRect(side * 240 - 28, -37, 56, 3);
  }
  c.fillStyle = '#a85c46';
  c.fillRect(269, -37, 24, 4);
  c.restore();
}

/** Distant machinery only: reserved missions keep every foreground tell clear. */
export function drawFinalApproachBackdrop(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  if (!finalApproachAtmosphere(g) || g.mode === 'title') return;
  const step = g.stage - 16,
    radius = [72, 125, 187][step],
    rx = [1780, 1650, 1510][step],
    ry = [260, 280, 292][step];
  c.save();
  canonical(c, g);
  // The sealed city core grows in scale across the three rooms.
  c.fillStyle = '#1a2e35';
  c.beginPath();
  c.arc(rx, ry, radius, 0, TAU);
  c.fill();
  c.strokeStyle = '#40575a';
  c.lineWidth = 9;
  c.stroke();
  c.strokeStyle = '#687b70';
  c.lineWidth = 2;
  c.beginPath();
  c.arc(rx, ry, radius + 7, 0, TAU);
  c.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    line(
      c,
      [
        rx + Math.cos(a) * (radius - 3),
        ry + Math.sin(a) * (radius - 3),
        rx + Math.cos(a) * (radius + 12),
        ry + Math.sin(a) * (radius + 12),
      ],
      '#6f7e70',
      3,
    );
  }
  c.save();
  c.beginPath();
  c.arc(rx, ry, radius - 8, 0, TAU);
  c.clip();
  for (let i = -2; i < 3; i++)
    line(
      c,
      [rx - radius, ry + i * radius * 0.43, rx + radius, ry + i * radius * 0.43],
      '#334c50',
      8,
    );
  line(c, [rx, ry - radius, rx, ry + radius], '#7a8170', 3);
  for (let i = -2; i < 3; i++) {
    c.fillStyle = '#a3634c';
    c.fillRect(rx - 5, ry + i * radius * 0.38, 3, 9);
    c.fillRect(rx + 3, ry + i * radius * 0.38, 3, 9);
  }
  c.restore();
  // Feed lines descend into the city instead of covering playable platforms.
  for (let i = 0; i <= step; i++) {
    const x = 1720 + i * 52;
    line(c, [x, ry + 80, x + 45, ry + 125, x + 45, 725], '#243f46', 11);
    line(c, [x - 2, ry + 80, x + 43, ry + 125, x + 43, 725], '#4d6564', 2);
    const pulse = (g.time * 0.2 + i * 0.4) % 1;
    c.fillStyle = '#8d5544';
    c.fillRect(x + 40, ry + 130 + pulse * (560 - ry), 7, 14);
  }
  const px = flyover(g, reduced);
  if (px > -500 && px < 2600) transport(c, px, 0.32 + step * 0.075);
  c.restore();
}

/** Ground-mounted emitters and a soft flyover shadow, beneath combat actors. */
export function drawFinalApproachDetails(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  if (!finalApproachAtmosphere(g) || g.mode === 'title') return;
  c.save();
  canonical(c, g);
  if (getFinalApproachRoom(g.level)) {
    for (const x of [500, 850, 1200, 1550]) {
      c.fillStyle = '#172a30';
      c.fillRect(x - 24, 733, 48, 7);
      c.fillStyle = '#6c7c70';
      c.fillRect(x - 22, 731, 44, 2);
      for (let i = 0; i < 5; i++) {
        c.fillStyle = '#9a6a4c';
        c.fillRect(x - 18 + i * 8, 735, 4, 3);
      }
    }
  }
  if (!reduced) {
    const px = flyover(g, reduced);
    if (px > -400 && px < 2400) {
      c.globalAlpha = 0.09;
      c.fillStyle = '#020b10';
      c.beginPath();
      c.ellipse(px + 40, 736, 220 + (g.stage - 16) * 35, 12, 0, 0, TAU);
      c.fill();
    }
  }
  c.restore();
}

/** The same locked rectangular warning language as the final boss, without captions. */
export function drawFinalApproachThreat(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  const strike = g.finalApproach.strike;
  if (!strike || !g.finalApproach.active || g.clear || g.mode === 'title') return;
  const progress = strike.fired ? 1 : clamp(1 - strike.left / FINAL_APPROACH_WARNING, 0, 1);
  c.save();
  for (const s of strike.rects) {
    c.globalAlpha = strike.fired ? (reduced ? 0.25 : 0.46) : 0.055;
    c.fillStyle = strike.fired ? '#f5d7b0' : '#d6a76c';
    c.fillRect(s.x, s.y, s.w, s.h);
    c.globalAlpha = 1;
    c.strokeStyle = '#10252b';
    c.lineWidth = 5;
    c.strokeRect(s.x, s.y, s.w, s.h);
    c.strokeStyle = strike.fired ? '#ffe8bc' : '#e8b56d';
    c.lineWidth = 2;
    c.setLineDash(strike.fired ? [] : [8, 7]);
    c.strokeRect(s.x, s.y, s.w, s.h);
    c.setLineDash([]);
    const x = s.x + s.w / 2,
      y = strike.kind === 'column' ? s.y + 33 : s.y + 28;
    c.fillStyle = '#14272e';
    c.beginPath();
    c.arc(x, y, 14, 0, TAU);
    c.fill();
    c.strokeStyle = '#e8bd7a';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(x, y, 9, -Math.PI / 2, -Math.PI / 2 + TAU * progress);
    c.stroke();
    if (strike.fired) {
      line(c, [x, s.y + 5, x, s.y + s.h - 5], '#e2a76f', reduced ? 2 : 4);
    } else {
      for (const side of [-1, 1])
        line(c, [x + side * 24, y - 6, x + side * 18, y, x + side * 24, y + 6], '#deb178', 1.5);
    }
  }
  c.restore();
}
