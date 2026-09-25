import type { Enemy, Game } from './game.ts';
import { clamp, type Vec } from './rules.ts';
import { TRANSMISSION } from './annex.ts';

export const ANNEX_PALETTE = {
  body: '#35323f',
  face: '#272631',
  surface: '#8e8798',
  edge: '#4a4555',
};
const amber = '#e8bb76',
  blue = '#79bdff',
  red = '#ed735d';
function line(c: CanvasRenderingContext2D, points: Vec[]) {
  c.beginPath();
  points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  c.stroke();
}
function circle(c: CanvasRenderingContext2D, p: Vec, r: number) {
  c.beginPath();
  c.arc(p.x, p.y, r, 0, Math.PI * 2);
}

export function drawAnnexScenery(c: CanvasRenderingContext2D, camera: Vec, w: number, h: number) {
  c.fillStyle = '#111019';
  c.fillRect(0, 0, w, h);
  c.save();
  c.translate(-camera.x * 0.3, -camera.y * 0.6);
  // Quiet, heavy equipment racks leave the foreground silhouettes uncluttered.
  for (let x = -250; x < w + camera.x * 0.3 + 320; x += 330) {
    c.fillStyle = '#1e1b29';
    c.fillRect(x, 180, 205, 620);
    c.strokeStyle = '#2a2535';
    c.lineWidth = 2;
    c.strokeRect(x + 9, 190, 187, 610);
    for (let y = 215; y < 760; y += 78) {
      c.fillStyle = '#24212e';
      c.fillRect(x + 25, y, 155, 46);
      c.fillStyle = '#39333e';
      c.fillRect(x + 38, y + 13, 71, 3);
      c.fillRect(x + 38, y + 24, 50, 3);
      c.fillStyle = '#60513d';
      c.fillRect(x + 165, y + 14, 3, 8);
    }
    c.strokeStyle = '#292331';
    c.lineWidth = 6;
    line(c, [
      { x: x + 80, y: 180 },
      { x: x + 80, y: 92 },
      { x: x + 300, y: 92 },
    ]);
  }
  c.restore();
}

export function drawAnnex(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  if (!g.annex.active) return;
  const a = g.annex,
    j = a.junction,
    p = a.port,
    t = a.transmission;
  const charging = t?.phase === 'charging' && a.valid(t);
  const color = t?.owner.allied ? blue : amber;
  const progress = charging ? clamp(1 - (t!.at - g.time) / TRANSMISSION.tell, 0, 1) : 0;
  const locked = charging && t!.at - g.time <= TRANSMISSION.lock;
  const cable = [j, { x: j.x, y: 228 }, { x: p.x, y: 228 }, p];
  c.save();
  c.lineWidth = 7;
  c.strokeStyle = '#17151e';
  line(c, cable);
  c.lineWidth = 2;
  c.strokeStyle = charging ? color : '#5c5367';
  line(c, cable);
  if (charging) {
    // A growing solid trace reads with effects reduced and without relying on a flash.
    let left = progress * (Math.abs(j.y - 228) + Math.abs(p.x - j.x) + Math.abs(p.y - 228));
    c.lineWidth = 4;
    c.strokeStyle = color;
    for (let i = 1; i < cable.length; i++) {
      const from = cable[i - 1],
        to = cable[i],
        length = Math.hypot(to.x - from.x, to.y - from.y);
      const part = clamp(left / length, 0, 1);
      if (part)
        line(c, [from, { x: from.x + (to.x - from.x) * part, y: from.y + (to.y - from.y) * part }]);
      left -= length;
    }
    const sender = t!.owner.body.position;
    c.lineWidth = 1;
    c.strokeStyle = color;
    c.setLineDash([4, 8]);
    line(c, [
      { x: sender.x, y: sender.y - 30 },
      { x: sender.x, y: j.y - 55 },
      { x: j.x, y: j.y - 55 },
      j,
    ]);
    c.setLineDash([]);
  }
  // Junction is a wall fixture, visually bolted to its platform.
  c.strokeStyle = '#625969';
  c.lineWidth = 3;
  line(c, [
    { x: j.x, y: j.y + 17 },
    { x: j.x, y: 502 },
  ]);
  c.fillStyle = '#17151e';
  c.fillRect(j.x - 20, j.y - 20, 40, 40);
  c.strokeStyle = charging ? color : '#807487';
  c.lineWidth = 2;
  c.strokeRect(j.x - 17, j.y - 17, 34, 34);
  c.strokeStyle = charging ? color : '#514957';
  line(c, [
    { x: j.x - 9, y: j.y - 9 },
    { x: j.x + 9, y: j.y + 9 },
  ]);
  line(c, [
    { x: j.x + 9, y: j.y - 9 },
    { x: j.x - 9, y: j.y + 9 },
  ]);
  if (charging) {
    c.fillStyle = color;
    c.fillRect(j.x - 17, j.y + 25, 34 * progress, 3);
    c.strokeStyle = color;
    c.lineWidth = 1;
    c.strokeRect(j.x - 23, j.y - 23, 46, 46);
  } else if (t?.interrupted && g.time - a.interruptedAt < 0.8) {
    c.strokeStyle = amber;
    c.lineWidth = 2;
    line(c, [
      { x: j.x - 10, y: j.y + 5 },
      { x: j.x - 2, y: j.y - 7 },
      { x: j.x + 2, y: j.y + 6 },
      { x: j.x + 10, y: j.y - 5 },
    ]);
  }
  const aim = t?.aim ?? { x: g.level.mirrored ? 0.7 : -0.7, y: 0.7 };
  if (charging && !t!.owner.allied) {
    c.strokeStyle = locked ? '#ed9475' : '#b79662';
    c.lineWidth = locked ? 2 : 1;
    c.setLineDash(locked ? [9, 5] : [2, 9]);
    for (const offset of [-0.12, 0, 0.12]) {
      const angle = Math.atan2(aim.y, aim.x) + offset;
      line(c, [
        p,
        g.lineEnd(p, { x: p.x + Math.cos(angle) * 1400, y: p.y + Math.sin(angle) * 1400 }),
      ]);
    }
    c.setLineDash([]);
  }
  c.fillStyle = '#191720';
  c.strokeStyle = charging ? color : '#756982';
  c.lineWidth = 3;
  circle(c, p, 21);
  c.fill();
  c.stroke();
  c.strokeStyle = locked && !t!.owner.allied ? red : charging ? color : '#887d91';
  c.lineWidth = 8;
  line(c, [p, { x: p.x + aim.x * 30, y: p.y + aim.y * 30 }]);
  c.fillStyle = charging ? color : '#443d4c';
  circle(c, p, 6);
  c.fill();
  c.restore();
}

export function drawSwitchman(c: CanvasRenderingContext2D, g: Game, e: Enemy, reduced: boolean) {
  const p = e.body.position,
    color = e.allied ? blue : red;
  c.save();
  c.globalAlpha = e.spawn > 0 ? clamp(1 - e.spawn / 0.65, 0.2, 1) : 1;
  if (e.timer <= 0.55 && e.spawn <= 0) {
    const end = g.lineEnd(p, { x: p.x + e.aim.x * 1100, y: p.y + e.aim.y * 1100 });
    c.strokeStyle = color;
    c.lineWidth = 1;
    c.setLineDash([3, 9]);
    line(c, [p, end]);
    c.setLineDash([]);
  }
  c.translate(p.x, p.y);
  c.fillStyle = '#1b1821';
  c.strokeStyle = e.flash > 0 && !reduced ? '#fff1da' : color;
  c.lineWidth = 2;
  c.fillRect(-16, -15, 32, 30);
  c.strokeRect(-16, -15, 32, 30);
  c.fillStyle = color;
  c.fillRect(-11, -9, 10, 4);
  c.fillStyle = '#766170';
  c.fillRect(3, -9, 8, 4);
  c.fillRect(-11, 1, 22, 2);
  c.fillRect(-11, 6, 22, 2);
  c.fillStyle = color;
  c.fillRect(-13, 15, 8, 3);
  c.fillRect(5, 15, 8, 3);
  c.lineWidth = 2;
  line(c, [
    { x: -7, y: -16 },
    { x: -7, y: -29 },
    { x: 6, y: -29 },
  ]);
  circle(c, { x: 6, y: -29 }, 3);
  c.stroke();
  c.lineWidth = 5;
  line(c, [
    { x: 0, y: 0 },
    { x: e.aim.x * 27, y: e.aim.y * 27 },
  ]);
  if (e.hp < e.maxHp) {
    c.fillStyle = '#4a353b';
    c.fillRect(-16, -38, 32, 2);
    c.fillStyle = color;
    c.fillRect(-16, -38, 32 * clamp(e.hp / e.maxHp, 0, 1), 2);
  }
  c.restore();
}
