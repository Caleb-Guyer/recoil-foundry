import type { Enemy, Game } from './game.ts';
import type { Vec } from './rules.ts';
import { clamp } from './rules.ts';
import { bossMuzzle, flakAngles, FLAK_LOCK, FLAK_TELL } from './enemies.ts';
import {
  CRANE_HEAD,
  CRANE_RAIL,
  CRANE_SWEEP_TELL,
  CRANE_SLAM_TELL,
  CRANE_LOCK,
} from './crane-ai.ts';

function line(c: CanvasRenderingContext2D, from: Vec, to: Vec, color: string, width = 1) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(from.x, from.y);
  c.lineTo(to.x, to.y);
  c.stroke();
}

function sweptHull(from: Vec, to: Vec): Vec[] {
  const points = [from, to].flatMap((p) =>
    [-1, 1].flatMap((x) =>
      [-1, 1].map((y) => ({ x: p.x + (x * CRANE_HEAD.w) / 2, y: p.y + (y * CRANE_HEAD.h) / 2 })),
    ),
  );
  points.sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (a: Vec, b: Vec, p: Vec) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x),
    lower: Vec[] = [],
    upper: Vec[] = [];
  for (const point of points) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, point) <= 0) lower.pop();
    lower.push(point);
  }
  for (const point of [...points].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, point) <= 0) upper.pop();
    upper.push(point);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function drawStrikeTell(c: CanvasRenderingContext2D, e: Enemy) {
  const rig = e.crane!;
  // Runtime endpoints already stop the full hammer hull at the first solid.
  const hull = sweptHull(rig.from, rig.to),
    locked = e.timer <= CRANE_LOCK,
    halfW = CRANE_HEAD.w / 2,
    halfH = CRANE_HEAD.h / 2;
  c.save();
  c.beginPath();
  for (const [index, point] of hull.entries()) {
    if (index === 0) c.moveTo(point.x, point.y);
    else c.lineTo(point.x, point.y);
  }
  c.closePath();
  c.fillStyle = locked ? '#e7b17913' : '#c5895c0b';
  c.fill();
  c.strokeStyle = locked ? '#dfb386' : '#a27853';
  c.lineWidth = locked ? 1.4 : 1;
  c.setLineDash(locked ? [] : [6, 9]);
  c.stroke();
  c.setLineDash([]);
  c.strokeStyle = locked ? '#f0c591' : '#ab8058';
  c.lineWidth = 2;
  if (e.attack === 'slam') {
    c.beginPath();
    c.moveTo(rig.to.x - halfW, rig.to.y + halfH);
    c.lineTo(rig.to.x + halfW, rig.to.y + halfH);
    c.stroke();
  } else {
    const side = Math.sign(rig.to.x - rig.from.x) || 1,
      x = rig.to.x + side * halfW;
    c.beginPath();
    c.moveTo(x, rig.to.y - halfH);
    c.lineTo(x, rig.to.y + halfH);
    c.stroke();
  }
  c.restore();
}

function drawFlak(c: CanvasRenderingContext2D, g: Game, e: Enemy) {
  const origin = bossMuzzle(e),
    aim = Math.atan2(e.aim.y, e.aim.x),
    angles = flakAngles(aim, e.phase === 1),
    locked = e.timer <= FLAK_LOCK,
    charge = clamp(1 - e.timer / FLAK_TELL, 0, 1);
  c.save();
  c.setLineDash(locked ? [] : [5, 8]);
  for (const [index, angle] of angles.entries()) {
    const center = index === Math.floor(angles.length / 2),
      end = g.lineEnd(origin, {
        x: origin.x + Math.cos(angle) * 380,
        y: origin.y + Math.sin(angle) * 380,
      });
    line(
      c,
      origin,
      end,
      locked ? (center ? '#ffe0a4' : '#d5ad73') : '#96714e',
      center ? 1.25 : 0.9,
    );
  }
  c.setLineDash([]);
  c.translate(origin.x, origin.y);
  c.rotate(aim);
  c.fillStyle = '#938570';
  c.fillRect(2, -3, 19, 6);
  c.fillStyle = '#d5c5a5';
  c.fillRect(3, -3, 15, 1.5);
  c.fillStyle = '#534c3c';
  c.fillRect(17, -4, 5, 8);
  c.fillStyle = '#3b433b';
  c.beginPath();
  c.arc(0, 0, 7, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#9b8b6a';
  c.lineWidth = 1.5;
  c.stroke();
  c.fillStyle = locked ? '#ffe1a5' : '#d09b63';
  c.beginPath();
  c.arc(0, 0, 2.2 + charge * 1.5, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

export function drawCrane(c: CanvasRenderingContext2D, g: Game, e: Enemy, reduced: boolean): void {
  const rig = e.crane;
  if (!rig) return;
  const p = e.body.position,
    exposed = e.state === 'recover' && !rig.hit,
    striking = e.state === 'rush',
    lit = e.flash > 0;
  c.save();

  // The dim overhead rail has no bright, walkable surface edge.
  c.fillStyle = '#25353c';
  c.fillRect(CRANE_RAIL.left, CRANE_RAIL.y - 41, CRANE_RAIL.right - CRANE_RAIL.left, 8);
  c.fillStyle = '#34464e';
  c.fillRect(CRANE_RAIL.left, CRANE_RAIL.y - 44, CRANE_RAIL.right - CRANE_RAIL.left, 3);
  c.fillRect(CRANE_RAIL.left, CRANE_RAIL.y - 33, CRANE_RAIL.right - CRANE_RAIL.left, 3);
  for (let x = CRANE_RAIL.left + 90; x < CRANE_RAIL.right; x += 320) {
    c.fillStyle = '#24343c';
    c.fillRect(x, CRANE_RAIL.y - 71, 5, 27);
  }

  if (e.spawn > 0) c.globalAlpha *= clamp(1 - e.spawn / 0.65, 0.15, 1);
  if (e.spawn <= 0 && e.state === 'windup' && (e.attack === 'sweep' || e.attack === 'slam'))
    drawStrikeTell(c, e);

  for (const side of [-1, 1]) {
    const from = { x: p.x + side * 9, y: p.y + 20 },
      to = { x: rig.head.x + side * 10, y: rig.head.y - CRANE_HEAD.h / 2 };
    line(c, from, to, '#17232a', 4);
    line(c, from, to, '#85918c', 1.35);
  }

  c.save();
  c.translate(p.x, p.y);
  for (const side of [-1, 1]) {
    c.fillStyle = '#19252c';
    c.beginPath();
    c.arc(side * 29, -31, 8, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#768179';
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = '#515e59';
    c.fillRect(side * 29 - 3, -32, 6, 14);
  }
  c.fillStyle = lit ? (reduced ? '#aab6ad' : '#fff0d4') : '#605d50';
  c.beginPath();
  c.moveTo(-45, -20);
  c.lineTo(-38, -27);
  c.lineTo(38, -27);
  c.lineTo(45, -20);
  c.lineTo(45, 22);
  c.lineTo(36, 27);
  c.lineTo(-36, 27);
  c.lineTo(-45, 22);
  c.closePath();
  c.fill();
  c.fillStyle = '#a19c82';
  c.fillRect(-36, -25, 72, 3);
  c.fillStyle = '#bd7760';
  c.fillRect(-45, -15, 5, 29);
  c.fillRect(40, -15, 5, 29);
  c.fillStyle = '#19282b';
  c.fillRect(-33, -16, 66, 33);
  if (exposed) {
    const glow = reduced ? 0.11 : 0.09 + (Math.sin(g.time * 5) + 1) * 0.025;
    c.fillStyle = `rgba(247,197,112,${glow})`;
    c.fillRect(-31, -14, 62, 29);
    c.fillStyle = lit ? '#fff1c6' : '#efd099';
    for (let x = -23; x <= 23; x += 11) c.fillRect(x, -10, 5, 21);
    c.fillStyle = '#b89467';
    c.fillRect(-27, -13, 54, 2);
    c.fillRect(-27, 12, 54, 2);
  }
  for (const side of [-1, 1]) {
    c.save();
    c.scale(side, 1);
    c.fillStyle = lit ? '#d7d8bd' : '#777769';
    c.fillRect(exposed ? 31 : 2, -17, exposed ? 8 : 33, 35);
    c.fillStyle = '#454e47';
    for (let y = -10; y <= 10; y += 10) c.fillRect(exposed ? 33 : 6, y, exposed ? 5 : 28, 2);
    c.fillStyle = '#a19d83';
    c.fillRect(exposed ? 31 : 2, -16, 2, 32);
    c.restore();
  }
  if (!exposed) {
    c.fillStyle = '#bc8361';
    c.fillRect(-1, -4, 2, 8);
  }
  c.fillStyle = '#394942';
  c.fillRect(-15, 22, 30, 9);
  c.fillStyle = '#969d87';
  c.fillRect(-12, 25, 24, 2);
  c.restore();

  c.save();
  c.translate(rig.head.x, rig.head.y);
  c.scale(CRANE_HEAD.w / 50, CRANE_HEAD.h / 46);
  c.fillStyle = '#526058';
  c.fillRect(-13, -30, 26, 9);
  c.fillStyle = '#a0a38b';
  c.fillRect(-10, -30, 20, 2);
  c.fillStyle = '#535c53';
  c.beginPath();
  c.moveTo(-25, -17);
  c.lineTo(-19, -23);
  c.lineTo(19, -23);
  c.lineTo(25, -17);
  c.lineTo(25, 23);
  c.lineTo(-25, 23);
  c.closePath();
  c.fill();
  c.fillStyle = '#8d9480';
  c.fillRect(-19, -22, 38, 3);
  c.fillStyle = '#35463f';
  c.fillRect(-19, -13, 38, 25);
  c.fillStyle = '#a3a58b';
  c.fillRect(-15, -9, 4, 4);
  c.fillRect(11, -9, 4, 4);
  c.fillStyle = striking ? '#ec9978' : '#b08061';
  c.fillRect(-25, 14, 50, 9);
  c.fillStyle = '#26362f';
  for (let x = -18; x <= 18; x += 12) c.fillRect(x, 16, 5, 5);
  c.fillStyle = '#81937e';
  c.fillRect(-15, 5, 30, 2);
  if (e.state === 'windup' && e.attack !== 'flak') {
    const tell = e.attack === 'slam' ? CRANE_SLAM_TELL : CRANE_SWEEP_TELL,
      charge = clamp(1 - e.timer / tell, 0, 1);
    c.fillStyle = e.timer <= CRANE_LOCK ? '#ffe0a4' : '#c9a270';
    c.fillRect(-1.5 - charge * 6, -7, 3 + charge * 12, 3);
  }
  c.restore();

  if (e.hp < e.maxHp) {
    c.fillStyle = '#493632';
    c.fillRect(p.x - 45, p.y + 40, 90, 3);
    c.fillStyle = lit && !reduced ? '#fff0d4' : '#ee9072';
    c.fillRect(p.x - 45, p.y + 40, 90 * clamp(e.hp / e.maxHp, 0, 1), 3);
  }
  if (e.spawn > 0) {
    c.strokeStyle = '#d79678';
    c.lineWidth = 1.5;
    c.beginPath();
    for (const x of [-1, 1]) {
      for (const y of [-1, 1]) {
        const corner = { x: p.x + x * 53, y: p.y + y * 35 };
        c.moveTo(corner.x - x * 9, corner.y);
        c.lineTo(corner.x, corner.y);
        c.lineTo(corner.x, corner.y - y * 9);
      }
    }
    c.stroke();
  }
  if (e.spawn <= 0 && e.state === 'windup' && e.attack === 'flak') drawFlak(c, g, e);
  c.restore();
}
