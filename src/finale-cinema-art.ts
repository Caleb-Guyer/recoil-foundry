import type { Game, Enemy } from './game.ts';
import { clamp, type Vec } from './rules.ts';
import { drawOutfit } from './cosmetics.ts';

// All acting is derived from the director clock. Rendering never advances a
// scene, consumes randomness, or changes the playable player's body.
const TAU = Math.PI * 2;
const RED = '#e34138';
const STEEL = '#657378';
const DARK = '#18252b';
const ease = (a: number) => {
  const t = clamp(a, 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const fract = (a: number) => a - Math.floor(a);
const noise = (i: number) => fract(Math.sin(i * 127.1 + 311.7) * 43758.5453);
const combat = (state: string) => state === 'duel' || state === 'siege' || state === 'rupture';
const worldX = (g: Game, x: number) => (g.level.mirrored ? 2000 - x : x);

function canonical(c: CanvasRenderingContext2D, g: Game) {
  if (g.level.mirrored) {
    c.translate(2000, 0);
    c.scale(-1, 1);
  }
}
function polygon(
  c: CanvasRenderingContext2D,
  points: number[],
  fill: string,
  edge?: string,
  width = 2,
) {
  c.beginPath();
  c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (edge) {
    c.strokeStyle = edge;
    c.lineWidth = width;
    c.stroke();
  }
}
function line(c: CanvasRenderingContext2D, points: number[], color: string, width: number) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.stroke();
}
function disc(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
}
function bloom(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  alpha: number,
  color = '228,61,49',
) {
  if (radius <= 0 || alpha <= 0) return;
  const gradient = c.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(${color},${alpha})`);
  gradient.addColorStop(1, `rgba(${color},0)`);
  c.fillStyle = gradient;
  c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}
function rivets(c: CanvasRenderingContext2D, points: number[]) {
  c.fillStyle = '#a1aaa5';
  for (let i = 0; i < points.length; i += 2) c.fillRect(points[i] - 1, points[i + 1] - 1, 2, 2);
}
function sparks(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  reduced: boolean,
  intensity = 1,
) {
  const count = reduced ? 9 : 34;
  c.save();
  for (let i = 0; i < count; i++) {
    const age = fract(time * (0.75 + noise(i + 20) * 0.6) + noise(i + 7));
    const a = noise(i + 91) * TAU;
    const speed = (30 + noise(i + 45) * 135) * intensity;
    const px = x + Math.cos(a) * age * speed;
    const py = y + Math.sin(a) * age * speed + age * age * 100;
    c.globalAlpha = (1 - age) * 0.95;
    line(
      c,
      [px, py, px - Math.cos(a) * (4 + age * 9), py - Math.sin(a) * (4 + age * 9)],
      i % 4 ? '#ffd59c' : '#fff3db',
      1.5,
    );
  }
  c.restore();
}
function smoke(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  reduced: boolean,
  intensity = 1,
) {
  c.save();
  const count = reduced ? 4 : 8;
  for (let i = 0; i < count; i++) {
    const age = fract(time * 0.17 + i / count);
    const sx = x + Math.sin(i * 5.7 + age * 2) * (15 + age * 36) * intensity;
    const sy = y - age * 180 * intensity;
    const r = 12 + age * 50 * intensity;
    const gradient = c.createRadialGradient(sx, sy, 0, sx, sy, r);
    gradient.addColorStop(0, `rgba(37,46,49,${(1 - age) * 0.46})`);
    gradient.addColorStop(1, 'rgba(37,46,49,0)');
    c.fillStyle = gradient;
    c.fillRect(sx - r, sy - r, r * 2, r * 2);
  }
  c.restore();
}

function pilot(
  c: CanvasRenderingContext2D,
  g: Game,
  x: number,
  y: number,
  stride = 0,
  scale = 1,
  facing = 1,
  climbing = false,
) {
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  // The same outfit renderer gives the double the player's exact silhouette.
  drawOutfit(c, g.cosmetics.outfit, facing, stride);
  c.fillStyle = '#172125';
  c.fillRect(-11, -16, 22, 14);
  c.fillRect(-9, 0, 18, 11);
  c.fillStyle = '#435252';
  c.fillRect(-13, -18, 26, 3);
  c.fillRect(-12, -1, 5, 12);
  c.fillRect(7, -1, 5, 12);
  c.fillStyle = RED;
  c.fillRect(-8, -11, 16, 3);
  c.fillRect(3, 0, 2, 8);
  line(c, [-5, -5, -2, 0, -6, 5], '#a5453a', 1);
  if (climbing) {
    line(c, [-10, -1, -18, -14, -12, -27], '#7b8580', 5);
    line(c, [10, -1, 18, -18, 12, -30], '#7b8580', 5);
  } else {
    c.save();
    c.translate(facing * 12, -1);
    c.scale(facing, 1);
    polygon(c, [0, -4, 26, -4, 28, 1, 14, 4, 8, 10, 3, 9, 5, 3, 0, 2], '#5f6c6a', '#111e22', 1);
    c.fillStyle = '#ce6651';
    c.fillRect(23, -3, 4, 4);
    c.restore();
  }
  c.restore();
}

function firstHull(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  aim: number,
  powered: number,
  build = 1,
  flash = false,
  broken = false,
) {
  c.save();
  c.translate(x, y);
  const spread = (1 - ease(build)) * 90;
  for (const side of [-1, 1]) {
    c.save();
    c.translate(side * spread, -spread * 0.25);
    line(c, [side * 19, 18, side * 23, 30, side * 22, 43], '#526166', 9);
    polygon(c, [side * 11, 34, side * 31, 34, side * 38, 45, side * 10, 45], '#233238', STEEL);
    polygon(
      c,
      [side * 18, -27, side * 38, -22, side * 41, 8, side * 22, 16],
      flash ? '#e9d2ba' : '#34434a',
      STEEL,
    );
    c.fillStyle = '#121f24';
    c.fillRect(side < 0 ? -37 : 26, -17, 11, 18);
    c.fillStyle = powered ? RED : '#4e4841';
    c.fillRect(side < 0 ? -34 : 29, -13, 3, 11);
    rivets(c, [side * 26, -21, side * 33, 5]);
    c.restore();
  }
  polygon(
    c,
    [-27, -33, 21, -33, 33, -14, 28, 29, -24, 29, -34, -5],
    flash ? '#f3dbbf' : '#29383f',
    '#788580',
    2,
  );
  polygon(c, [-21, -31, 17, -31, 25, -18, -25, -18], '#65716c');
  c.fillStyle = '#0b171c';
  c.fillRect(-20, -14, 40, 13);
  c.fillStyle = powered ? RED : '#394343';
  c.fillRect(-14, -10, 28, 4);
  if (powered) bloom(c, 0, -8, 45, powered * 0.24);
  polygon(c, [-20, 3, 20, 3, 15, 23, -15, 23], '#17262d', '#4c5c61', 1);
  line(c, [-10, 9, 0, 19, 11, 8], powered ? '#d2674d' : '#4d5958', 2);
  c.save();
  c.rotate(aim);
  c.fillStyle = '#15232a';
  c.fillRect(23, -7, 40, 14);
  c.fillStyle = '#6d7974';
  c.fillRect(28, -6, 28, 3);
  c.fillStyle = '#a4a89a';
  c.fillRect(54, -9, 8, 18);
  c.fillStyle = '#111e23';
  c.fillRect(61, -5, 6, 10);
  c.restore();
  if (broken) line(c, [-23, -27, -9, -5, -18, 5, 4, 23], '#090f13', 4);
  rivets(c, [-24, -25, 23, -21, -21, 20, 21, 20]);
  c.restore();
}

function siegeHull(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  aim: number,
  flash = false,
  broken = false,
  deploy = 1,
) {
  c.save();
  c.translate(x, y);
  const spread = 1 + (1 - ease(deploy)) * 0.4;
  for (const side of [-1, 1]) {
    c.save();
    c.scale(side * spread, 1);
    polygon(c, [31, 26, 102, 26, 116, 39, 108, 58, 32, 58, 23, 44], '#17252b', '#697470', 2);
    for (let i = 0; i < 7; i++) {
      c.fillStyle = '#35464a';
      c.fillRect(34 + i * 10, 33, 5, 17);
    }
    line(c, [36, 30, 101, 30, 109, 40], '#88918a', 2);
    polygon(
      c,
      [29, -44, 79, -52, 104, -33, 98, 4, 65, 24, 27, 11],
      flash ? '#f7d5b0' : '#3d4c51',
      '#86908a',
      2,
    );
    polygon(c, [45, -40, 75, -43, 88, -30, 86, -12, 44, -12], '#26383e');
    for (let i = 0; i < 4; i++) {
      c.fillStyle = '#b3614b';
      c.fillRect(47 + i * 9, -36, 4, 17);
    }
    c.save();
    c.translate(72, -8);
    c.rotate(clamp(aim * side, -0.55, 0.55));
    polygon(c, [0, -12, 57, -10, 62, -5, 62, 8, 0, 12], '#1c2b32', '#6b7976');
    c.fillStyle = '#92998d';
    c.fillRect(24, -9, 26, 4);
    c.fillStyle = '#a4a894';
    c.fillRect(53, -13, 9, 26);
    c.fillStyle = '#09151b';
    c.fillRect(62, -7, 7, 14);
    c.restore();
    rivets(c, [36, -35, 77, -45, 93, -28, 73, 12]);
    c.restore();
  }
  polygon(
    c,
    [-48, -50, 34, -50, 55, -29, 49, 38, -42, 38, -55, -15],
    flash ? '#ffe1b7' : '#283b42',
    '#87938d',
    2,
  );
  polygon(c, [-40, -45, 30, -45, 40, -32, -46, -32], '#697870');
  c.fillStyle = '#101f26';
  c.fillRect(-31, -26, 62, 14);
  c.fillStyle = RED;
  c.fillRect(-24, -22, 48, 4);
  polygon(c, [-34, -3, 34, -3, 27, 27, -26, 27], '#15282e', '#51676a');
  disc(c, 0, 10, 18, '#0b181f');
  disc(c, 0, 10, 12, broken ? '#ab6a46' : '#ce4437');
  line(c, [-13, 10, 13, 10, 0, -2, 0, 22], '#f4ae7e', 2);
  bloom(c, 0, 10, 80, broken ? 0.1 : 0.17);
  if (broken) line(c, [-39, -38, -17, -11, -27, 0, 15, 29], '#071319', 5);
  rivets(c, [-43, -33, 41, -27, -36, 30, 37, 31]);
  c.restore();
}

function ruptureHull(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  aim: number,
  reduced: boolean,
  flash = false,
  broken = false,
  scale = 1,
) {
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  const breathe = reduced ? 0 : Math.sin(time * 1.4) * 3;
  bloom(c, 0, 0, 220, broken ? 0.1 : 0.15);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + Math.PI / 6;
    const handX = Math.cos(a) * (128 + breathe),
      handY = Math.sin(a) * (102 + breathe);
    const elbowX = Math.cos(a + 0.18) * 78,
      elbowY = Math.sin(a + 0.18) * 64;
    line(c, [Math.cos(a) * 35, Math.sin(a) * 37, elbowX, elbowY, handX, handY], '#16272e', 19);
    line(c, [Math.cos(a) * 35, Math.sin(a) * 37, elbowX, elbowY, handX, handY], '#65766f', 9);
    line(c, [elbowX, elbowY, handX, handY], '#b7634d', 2);
    disc(c, elbowX, elbowY, 11, '#1a2b31');
    disc(c, elbowX, elbowY, 5, '#79857b');
    c.save();
    c.translate(handX, handY);
    c.rotate(a);
    polygon(
      c,
      [-18, -18, 21, -15, 29, 0, 17, 18, -18, 18],
      flash ? '#e9cfaf' : '#34464a',
      '#76877e',
      2,
    );
    c.fillStyle = '#0d2027';
    c.fillRect(7, -10, 20, 20);
    c.fillStyle = broken ? '#a35b43' : RED;
    c.fillRect(19, -7, 4, 14);
    c.restore();
  }
  c.strokeStyle = '#3e5a5a';
  c.lineWidth = 8;
  c.beginPath();
  c.arc(0, 0, 74, 0, TAU);
  c.stroke();
  c.strokeStyle = '#9d6955';
  c.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    c.beginPath();
    c.arc(0, 0, 74, a + 0.07, a + 0.53);
    c.stroke();
  }
  polygon(
    c,
    [-40, -59, 30, -59, 53, -35, 51, 37, 25, 61, -28, 61, -53, 32, -52, -33],
    flash ? '#f4d9b9' : '#24383f',
    '#8a9b8e',
    2,
  );
  polygon(c, [-34, -55, 28, -55, 43, -39, -42, -39], '#5d726b');
  c.fillStyle = '#0a1c24';
  c.fillRect(-30, -32, 60, 12);
  c.fillStyle = RED;
  c.fillRect(-22, -28, 44, 4);
  disc(c, 0, 12, 33, '#0c222b');
  c.strokeStyle = '#a2b9a4';
  c.lineWidth = 4;
  c.beginPath();
  c.arc(0, 12, 31, 0, TAU);
  c.stroke();
  disc(c, 0, 12, 23, broken ? '#f0ac76' : '#d84435');
  disc(c, 0, 12, broken ? 10 : 7, '#ffe3b3');
  const rotor = reduced ? 0 : time * 0.6;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + rotor;
    line(
      c,
      [Math.cos(a) * 10, 12 + Math.sin(a) * 10, Math.cos(a) * 27, 12 + Math.sin(a) * 27],
      '#293e42',
      5,
    );
  }
  for (const side of [-1, 1]) {
    line(c, [side * 34, 30, side * 26, 71, side * 42, 85], '#516860', 8);
    polygon(c, [side * 23, 68, side * 44, 68, side * 52, 88, side * 26, 88], '#273e43', '#6f8478');
  }
  if (broken) line(c, [-38, -51, -21, -17, -40, 4, -14, 43], '#0b171d', 5);
  rivets(c, [-40, -33, 40, -31, -38, 32, 37, 34]);
  c.restore();
}

function transport(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  reduced: boolean,
  scale = 1,
) {
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  // Nose points left. The wings and paired ducted engines span most of the room.
  polygon(
    c,
    [-81, -18, -270, -132, -362, -128, -232, -10, -285, 72, -188, 80, 33, 12],
    '#17282e',
    '#4d6467',
  );
  polygon(
    c,
    [111, -7, 342, -100, 411, -94, 290, -2, 364, 46, 291, 60, 94, 29],
    '#1a2d33',
    '#52696b',
  );
  for (const ex of [-251, 243]) {
    c.fillStyle = '#0b1c23';
    c.fillRect(ex - 39, -44, 78, 103);
    c.strokeStyle = '#6f807a';
    c.lineWidth = 6;
    c.strokeRect(ex - 39, -44, 78, 103);
    c.fillStyle = '#344b50';
    c.fillRect(ex - 31, -36, 62, 13);
    disc(c, ex, 14, 27, '#09191f');
    for (let n = 0; n < 7; n++) {
      const a = (n / 7) * TAU + (reduced ? 0 : time * 9);
      line(
        c,
        [
          ex + Math.cos(a) * 8,
          14 + Math.sin(a) * 8,
          ex + Math.cos(a + 0.2) * 23,
          14 + Math.sin(a + 0.2) * 23,
        ],
        '#657979',
        3,
      );
    }
    disc(c, ex, 14, 7, '#9aa49a');
    if (!reduced) bloom(c, ex, 85, 70, 0.13, '128,173,172');
  }
  polygon(
    c,
    [-386, -13, -337, -38, -128, -49, 139, -36, 329, -10, 303, 31, 130, 46, -194, 44, -349, 17],
    '#2c4048',
    '#81918b',
    2,
  );
  polygon(c, [-337, -32, -274, -36, -289, -11, -360, -7], '#0a1e28', '#718e8c', 1);
  line(c, [-330, -29, -297, -31, -307, -15, -346, -12], '#7eafa5', 2);
  c.fillStyle = '#142930';
  c.fillRect(-212, -19, 415, 45);
  for (let i = 0; i < 7; i++) {
    c.fillStyle = i % 2 ? '#657973' : '#3d5657';
    c.fillRect(-185 + i * 57, -12, 38, 5);
    rivets(c, [-189 + i * 57, 17, -150 + i * 57, 17]);
  }
  polygon(c, [245, -18, 320, -101, 350, -101, 337, -10], '#354b50', '#7b8c83', 2);
  c.fillStyle = '#ac5b49';
  c.fillRect(263, -37, 25, 5);
  c.fillStyle = '#d0d8c2';
  c.fillRect(-367, 9, 11, 4);
  c.fillRect(289, 24, 12, 3);
  c.fillStyle = '#0c2029';
  c.fillRect(-54, 38, 130, 14);
  c.fillStyle = '#798a80';
  c.fillRect(-34, 48, 92, 5);
  bloom(c, -358, 28, 95, 0.15, '197,213,187');
  c.restore();
}

function rain(c: CanvasRenderingContext2D, time: number, reduced: boolean, front = false) {
  c.save();
  c.strokeStyle = front ? '#aac2bf' : '#6d8d91';
  c.lineWidth = front ? 1.1 : 0.7;
  c.globalAlpha = front ? 0.19 : 0.13;
  const count = reduced ? (front ? 24 : 52) : front ? 60 : 155;
  for (let i = 0; i < count; i++) {
    const speed = front ? 510 : 340;
    const px = fract(noise(i + 5) + time * 0.018) * 2240 - 120;
    const py = fract(noise(i + 719) + (time * speed) / 1100) * 1100 - 190;
    const length = front ? 24 : 15;
    c.beginPath();
    c.moveTo(px, py);
    c.lineTo(px - length * 0.22, py + length);
    c.stroke();
  }
  c.restore();
}

function reactor(
  c: CanvasRenderingContext2D,
  open: number,
  time: number,
  reduced: boolean,
  energy = 1,
) {
  c.save();
  c.translate(1240, 343);
  bloom(c, 0, 0, 470, (0.08 + open * 0.12) * energy);
  c.fillStyle = '#11252d';
  c.beginPath();
  c.arc(0, 0, 252, 0, TAU);
  c.fill();
  c.strokeStyle = '#344d54';
  c.lineWidth = 28;
  c.stroke();
  c.strokeStyle = '#607570';
  c.lineWidth = 3;
  c.beginPath();
  c.arc(0, 0, 270, 0, TAU);
  c.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    line(
      c,
      [Math.cos(a) * 253, Math.sin(a) * 253, Math.cos(a) * 277, Math.sin(a) * 277],
      '#799084',
      4,
    );
    disc(c, Math.cos(a) * 265, Math.sin(a) * 265, 2, '#a1b0a0');
  }
  c.save();
  c.beginPath();
  c.arc(0, 0, 237, 0, TAU);
  c.clip();
  c.fillStyle = '#091c25';
  c.fillRect(-250, -250, 500, 500);
  if (open > 0) {
    bloom(c, 0, 5, 250, open * energy * 0.5);
    for (let i = 0; i < 6; i++) {
      const radius = 80 + i * 25;
      c.strokeStyle = i % 2 && energy > 0.3 ? '#753f35' : '#2c454a';
      c.lineWidth = 4;
      c.beginPath();
      c.arc(0, 0, radius, 0, TAU);
      c.stroke();
    }
    disc(c, 0, 8, 52, energy > 0.3 ? '#b04032' : '#1b3138');
    disc(c, 0, 8, 29, energy > 0.5 ? '#e9a878' : energy > 0.15 ? '#80503b' : '#122a33');
  }
  for (const side of [-1, 1]) {
    c.save();
    c.translate(side * ease(open) * 227, 0);
    const x = side < 0 ? -244 : 0;
    c.fillStyle = '#263b43';
    c.fillRect(x, -244, 244, 488);
    for (let n = 0; n < 6; n++) {
      const yy = -220 + n * 84;
      line(c, [x + 15, yy, x + 229, yy], '#3c555a', 12);
      line(c, [x + 15, yy - 6, x + 229, yy - 6], '#62766e', 2);
    }
    c.fillStyle = '#62766e';
    c.fillRect(side < 0 ? -6 : 1, -240, 5, 480);
    c.fillStyle = '#a55d49';
    for (let n = 0; n < 7; n++) c.fillRect(side < 0 ? -18 : 11, -201 + n * 64, 7, 22);
    c.restore();
  }
  c.restore();
  if (open > 0.5 && energy > 0.2 && !reduced) sparks(c, 0, 100, time, reduced, 0.7);
  c.restore();
}

/**
 * Canonical acting poses for the airlift. The same curve drives the aircraft,
 * pilot, wreck, cable and camera, including defeats beside either roof edge.
 */
/** The combat gunship is the same transport that delivered the Siege frame. */
export function drawFinaleTransport(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  reduced: boolean,
  direction: number,
) {
  c.save();
  c.translate(x, y);
  c.scale(direction > 0 ? -1 : 1, 1);
  transport(c, 0, 0, time, reduced, 0.62);
  c.restore();
}

export function finaleAirliftStaging(wreck: Vec, time: number) {
  const t = Math.max(0, time);
  const falling = clamp(t / 1.2, 0, 1);
  const groundedY = 685;
  const wreckY = mix(Math.min(groundedY, wreck.y), groundedY, falling * falling);
  const planeY = 195 - Math.sin(ease(t / 8) * Math.PI) * 13;
  const relocate = ease((t - 4.4) / 1);
  const exit = ease((t - 7.3) / 0.7);
  const planeX = mix(mix(wreck.x + 1230, wreck.x, ease(t / 2)), 1300, relocate) - exit * 2300;
  const roofY = groundedY - 52;
  const lifting = ease((t - 3) / 1.4);
  const cableY =
    t < 3 ? mix(planeY + 53, roofY - 18, ease((t - 2) / 1)) : mix(roofY - 18, planeY + 2, lifting);
  const pilotY = t < 3 ? mix(groundedY - 8, roofY, ease((t - 1.2) / 1)) : cableY + 18;
  const drop = ease((t - 5.4) / 1.9);
  return {
    wreck: { x: wreck.x, y: wreckY },
    plane: { x: planeX, y: planeY },
    pilot: { x: wreck.x, y: pilotY, visible: t >= 1.2 && t < 4.4 },
    cable: { x: wreck.x, y: cableY, visible: t >= 2 && t < 4.4 && cableY >= planeY + 53 },
    siege: { x: 1300, y: mix(planeY + 85, 665, drop), visible: t >= 5.4, drop },
    focus: { x: mix(wreck.x, 1300, relocate), y: 395 },
  };
}

/** Focal points for locked acting only. The core-opening remains player led. */
export function finaleCinemaCamera(g: Game): Vec | null {
  const cine = g.finale.cinema;
  if (!cine?.active) return null;
  const t = cine.clock;
  switch (cine.state) {
    case 'boarding':
      return { x: worldX(g, 1390), y: 555 };
    case 'airlift': {
      const pose = finaleAirliftStaging({ x: worldX(g, g.finale.wreck.x), y: g.finale.wreck.y }, t);
      return { x: worldX(g, pose.focus.x), y: pose.focus.y };
    }
    case 'destruction':
      return { x: g.finale.wreck.x, y: Math.min(g.finale.wreck.y + 50, 460) };
    case 'escape':
      return { x: worldX(g, mix(1240, 1060, ease(t / 5))), y: 390 };
    default:
      return null;
  }
}

/** A closer boarding shot, a wide airlift and a held finale composition. */
export function finaleCinemaScale(
  g: Game,
  base: number,
  width: number,
  height: number,
  reduced: boolean,
) {
  const cine = g.finale.cinema;
  if (!cine?.active || !cine.locked || reduced) return base;
  const duration =
    cine.state === 'boarding' ? 6 : cine.state === 'airlift' ? 8 : cine.state === 'escape' ? 5 : 7;
  const target =
    cine.state === 'boarding'
      ? Math.min(base * 1.75, width / 710, height / 470)
      : cine.state === 'airlift'
        ? Math.min(base * 1.1, width / 1140, height / 760)
        : Math.min(base * 1.2, width / 1000, height / 680);
  const hold = ease(cine.clock / 0.9) * (1 - ease((cine.clock - duration + 0.9) / 0.9));
  return mix(base, Math.max(base, target), hold);
}

/** Drawn behind the physical arena: rain, skyline and the opening city core. */
export function drawFinaleCinemaBackground(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  const cine = g.finale.cinema;
  if (!cine?.active || g.mode === 'title') return;
  const state = cine.state,
    t = cine.clock;
  c.save();
  canonical(c, g);
  const sky = c.createLinearGradient(0, -150, 0, 730);
  sky.addColorStop(0, '#09131bd9');
  sky.addColorStop(1, '#182d32d0');
  c.fillStyle = sky;
  c.fillRect(-1000, -400, 4000, 1400);
  // Layered distant buildings, retaining the game's straight industrial forms.
  for (let i = 0; i < 24; i++) {
    const xx = i * 94 - 70,
      top = 300 + noise(i + 210) * 210;
    c.fillStyle = '#13272e';
    c.fillRect(xx, top, 78, 740 - top);
    c.fillStyle = '#294147';
    c.fillRect(xx + 3, top, 75, 3);
    for (let j = 0; j < 5; j++) {
      c.fillStyle = (i + j) % 4 ? '#294441' : '#755245';
      c.fillRect(xx + 12 + (j % 3) * 20, top + 22 + Math.floor(j / 3) * 25, 8, 3);
    }
    if (i % 3 === 0) line(c, [xx + 44, top, xx + 44, top - 65], '#334d52', 3);
  }
  const opening =
    state === 'core-opening'
      ? ease((t - 1.1) / 4)
      : g.finale.phase >= 2 || state === 'escape' || state === 'destruction'
        ? 1
        : 0;
  const energy =
    state === 'destruction'
      ? 1 - ease((t - 2.7) / 2)
      : state === 'complete' && (cine.firstClear || g.overtime)
        ? 0
        : 1;
  reactor(c, opening, g.time, reduced, energy);
  // Rooftop infrastructure frames, rather than covers, the actual jump lanes.
  for (const x of [140, 1850]) {
    line(c, [x, 737, x, 214, x + (x < 1000 ? 105 : -105), 178], '#2b434a', 14);
    line(c, [x, 525, x + (x < 1000 ? 90 : -90), 435, x, 435], '#354e51', 7);
    c.fillStyle = '#687568';
    c.fillRect(x - 12, 218, 24, 4);
  }
  rain(c, g.time, reduced);
  if (state === 'core-opening') {
    const w = g.finale.wreck,
      wx = worldX(g, w.x);
    if (t > 0.5 && t < 4.7) {
      const jump = ease((t - 0.5) / 3.2);
      pilot(
        c,
        g,
        mix(wx, 1240, jump),
        mix(w.y - 65, 352, jump) - Math.sin(jump * Math.PI) * 215,
        t * 10,
        mix(1, 0.38, jump),
        wx > 1240 ? -1 : 1,
      );
    }
    if (t >= 4.7) {
      const emerge = ease((t - 4.7) / 3.3);
      ruptureHull(
        c,
        1240,
        mix(335, 360, emerge),
        g.time,
        Math.PI,
        reduced,
        false,
        false,
        mix(0.28, 1, emerge),
      );
      if (t > 6.6) sparks(c, 1240, 470, t, reduced, 1.8);
    }
  }
  c.restore();
}

function destruction(
  c: CanvasRenderingContext2D,
  g: Game,
  x: number,
  y: number,
  time: number,
  reduced: boolean,
  escape: boolean,
) {
  const burstAt = escape ? 1.8 : 2.65;
  const burst = Math.max(0, time - burstAt);
  const shake = reduced ? 0 : Math.sin(time * 39) * clamp(time * 1.3, 0, 5) * (1 - ease(burst));
  if (time < burstAt + 0.3) {
    ruptureHull(c, x + shake, y, time, Math.PI, reduced, false, true);
    sparks(c, x, y + 5, time * 1.3, reduced, 1.5 + time * 0.8);
    bloom(c, x, y + 5, 130 + time * 45, clamp(time / burstAt, 0, 1) * 0.42, '255,160,102');
    for (let n = 0; n < 7; n++) {
      const a = (n / 7) * TAU + 0.2;
      line(
        c,
        [
          x + Math.cos(a) * 20,
          y + Math.sin(a) * 20,
          x + Math.cos(a) * (75 + time * 15),
          y + Math.sin(a) * (65 + time * 14),
        ],
        '#f6c493',
        reduced ? 1 : 2,
      );
    }
  }
  if (burst > 0) {
    const outward = ease(burst / 1.8),
      fade = 1 - ease((burst - 0.4) / 3);
    bloom(c, x, y + 10, 130 + outward * 450, fade * (reduced ? 0.21 : 0.5), '249,133,67');
    c.save();
    c.globalAlpha = fade * 0.75;
    c.strokeStyle = '#e2ba8b';
    c.lineWidth = 1 + (1 - outward) * 10;
    c.beginPath();
    c.ellipse(x, y + 12, 35 + outward * 480, 35 + outward * 310, 0, 0, TAU);
    c.stroke();
    // Several offset fire fronts tear through the hull, rather than a single
    // screen flash. The reduced-effects version retains the same silhouette.
    for (let i = 0; i < (reduced ? 5 : 11); i++) {
      const age = Math.max(0, burst - noise(i + 801) * 0.36);
      if (age <= 0 || age >= 2.1) continue;
      const a = noise(i + 84) * TAU;
      const expansion = Math.sin(clamp(age / 2.1, 0, 1) * Math.PI);
      const fx = x + Math.cos(a) * age * (35 + noise(i + 940) * 90);
      const fy = y + Math.sin(a) * age * 65 - age * 20;
      const radius = (27 + noise(i + 352) * 48) * expansion;
      c.globalAlpha = fade * (reduced ? 0.45 : 0.82);
      disc(c, fx, fy, radius, age < 0.65 ? '#ad5b35' : '#654331');
      disc(
        c,
        fx - radius * 0.12,
        fy - radius * 0.12,
        radius * 0.68,
        age < 0.85 ? '#e6a15c' : '#a45d36',
      );
      if (age < 0.75) disc(c, fx - radius * 0.2, fy - radius * 0.2, radius * 0.36, '#f3d49c');
    }
    c.globalAlpha = 0.75;
    const count = reduced ? 14 : 34;
    for (let i = 0; i < count; i++) {
      const a = noise(i + 83) * TAU,
        speed = 60 + noise(i + 519) * 175;
      const vy = Math.sin(a) * speed;
      const impact = (-vy + Math.sqrt(vy * vy + 344 * Math.max(0, 722 - y))) / 172;
      const flight = Math.min(burst, impact);
      const px = x + Math.cos(a) * speed * flight;
      const py = Math.min(722, y + vy * flight + flight * flight * 86);
      c.save();
      c.translate(px, py);
      c.rotate(a + (py >= 722 ? 1 : flight * (noise(i + 213) - 0.5) * 5));
      const w = 5 + noise(i + 14) * 20,
        h = 4 + noise(i + 71) * 12;
      c.fillStyle = i % 5 === 0 ? '#b46843' : '#40565a';
      c.fillRect(-w / 2, -h / 2, w, h);
      c.fillStyle = '#7f8f81';
      c.fillRect(-w / 2, -h / 2, w, 2);
      c.restore();
    }
    c.restore();
    if (burst < 2.5) sparks(c, x, y, burst * 0.8, reduced, 2 + burst);
    smoke(c, x, Math.min(700, y + 100), time, reduced, 2.7);
  }
}

/** Logbook photography reuses the exact first-form hull from the live finale. */
export function drawFinaleCinemaPortrait(c: CanvasRenderingContext2D, g: Game, e: Enemy) {
  const p = e.body.position;
  firstHull(c, p.x, p.y, g.time, Math.atan2(e.aim.y, e.aim.x), 1);
}
/** Actors and aircraft sit above the player art, below hostile warning marks. */
export function drawFinaleCinemaForeground(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  const cine = g.finale.cinema,
    e = g.finale.enemy;
  if (!cine?.active || g.mode === 'title') return;
  const state = cine.state,
    t = cine.clock;
  // Physical bodies already contain mirrored world coordinates.
  if (combat(state) && e && e.hp > 0) {
    const p = e.body.position,
      aim = Math.atan2(e.aim.y, e.aim.x);
    if (g.finale.phase === 0) firstHull(c, p.x, p.y, g.time, aim, 1, 1, e.flash > 0);
    else if (g.finale.phase === 1) siegeHull(c, p.x, p.y, g.time, aim, e.flash > 0);
    else ruptureHull(c, p.x, p.y, g.time, aim, reduced, e.flash > 0);
    if (e.interceptor && e.interceptor.muzzle > 0 && !reduced)
      sparks(c, p.x + Math.cos(aim) * 65, p.y + Math.sin(aim) * 65, g.time * 2, reduced, 0.5);
  }
  c.save();
  canonical(c, g);
  const wreck = g.finale.wreck,
    wx = worldX(g, wreck.x);
  if (state === 'approach') {
    firstHull(c, 1450, 660, g.time, Math.PI, 0, 0);
    pilot(c, g, 1350, 710, 0, 1, -1);
  } else if (state === 'boarding') {
    const walk = ease(t / 2),
      climb = ease((t - 2) / 1.2),
      assembly = ease((t - 3.1) / 2);
    firstHull(c, 1450, 660, g.time, Math.PI, ease((t - 4.5) / 1.2), assembly);
    if (t < 3.6)
      pilot(
        c,
        g,
        mix(1350, 1450, walk),
        mix(710, 647, climb),
        t < 2 ? Math.sin(t * 11) : 0,
        1,
        1,
        t > 2,
      );
    // The cockpit shutters visibly seal over the pilot before ignition.
    if (t >= 3 && t < 4.7) {
      const close = ease((t - 3) / 1.2);
      for (const side of [-1, 1]) {
        c.fillStyle = '#677771';
        c.fillRect(1450 + side * (22 - close * 20) - 11, 634, 20, 32);
        c.fillStyle = '#293c42';
        c.fillRect(1450 + side * (22 - close * 20) - 9, 639, 16, 24);
      }
    }
    if (t > 4.6) {
      sparks(c, 1450, 680, t, reduced, 0.65);
      bloom(c, 1450, 651, 100, ease((t - 4.6) / 1.3) * 0.23);
    }
  } else if (state === 'airlift') {
    const pose = finaleAirliftStaging({ x: wx, y: wreck.y }, t);
    firstHull(c, pose.wreck.x, pose.wreck.y, t, Math.PI, 0.2, 1, false, true);
    smoke(c, pose.wreck.x, pose.wreck.y, t, reduced, 1.2);
    sparks(c, pose.wreck.x, pose.wreck.y, t, reduced, 0.8);
    if (t >= 1.2 && t < 1.9) {
      smoke(c, wx, 725, t, reduced, 1.1);
      sparks(c, wx, 725, t, reduced, 0.65);
    }
    if (pose.cable.visible) {
      line(c, [pose.cable.x, pose.plane.y + 53, pose.cable.x, pose.cable.y], '#a2b1a6', 2);
      line(
        c,
        [
          pose.cable.x - 8,
          pose.cable.y - 5,
          pose.cable.x - 8,
          pose.cable.y + 6,
          pose.cable.x + 8,
          pose.cable.y + 6,
          pose.cable.x + 8,
          pose.cable.y - 5,
        ],
        '#7d9088',
        3,
      );
    }
    if (pose.pilot.visible) pilot(c, g, pose.pilot.x, pose.pilot.y, 0, 1, -1, true);
    if (pose.siege.visible) {
      if (t < 7.4)
        for (const side of [-1, 1])
          line(
            c,
            [
              pose.plane.x + side * 63,
              pose.plane.y + 42,
              pose.siege.x + side * 65,
              pose.siege.y - 49,
            ],
            '#a2b0a4',
            2,
          );
      siegeHull(c, pose.siege.x, pose.siege.y, g.time, Math.PI, false, false, pose.siege.drop);
      if (t > 7.1) {
        sparks(c, 1300, 720, t, reduced, 1.2);
        smoke(c, 1300, 725, t, reduced, 1.4);
      }
    }
    // The fuselage occludes the last part of the lift as the pilot enters its
    // open belly. He is fully inside before the aircraft starts crossing town.
    transport(c, pose.plane.x, pose.plane.y, g.time, reduced);
  } else if (state === 'core-opening') {
    siegeHull(c, wx, Math.min(665, wreck.y + t * 4), t, Math.PI, false, true);
    smoke(c, wx, wreck.y - 20, t, reduced, 1.9);
    sparks(c, wx - 28, wreck.y, t, reduced, 1.4);
  } else if (state === 'destruction' || state === 'escape') {
    const escape = state === 'escape';
    destruction(c, g, wx, wreck.y, t, reduced, escape);
    if (escape) {
      const depart = ease((t - 1.7) / 3.3),
        lift = ease(t / 2.8);
      const px = mix(wx + 420, wx + 70, ease(t / 1.7)) - depart * 1550;
      const py = mix(190, -95, depart);
      transport(c, px, py, g.time, reduced, mix(0.7, 0.25, depart));
      if (t < 2.8)
        pilot(
          c,
          g,
          mix(wx, px, lift),
          mix(wreck.y - 60, py + 20, lift) - Math.sin(lift * Math.PI) * 100,
          t * 8,
          mix(1, 0.4, lift),
          -1,
          true,
        );
    }
  } else if (state === 'complete') {
    destruction(c, g, wx, wreck.y, 7, reduced, !(cine.firstClear || g.overtime));
  }
  rain(c, g.time, reduced, true);
  // Tiny rooftop splashes show depth without filling the combat space.
  if (!reduced) {
    c.strokeStyle = '#90aaa2';
    c.lineWidth = 1;
    c.globalAlpha = 0.2;
    for (let i = 0; i < 18; i++) {
      const age = fract(g.time * 1.3 + noise(i + 310));
      const x = noise(i + 11) * 2000;
      c.beginPath();
      c.ellipse(x, 729, age * 8, age * 1.5, 0, Math.PI, TAU);
      c.stroke();
    }
  }
  c.restore();
}

/** One red rectangle and a name. No phase captions, cards, or cutscene text. */
export function drawFinaleCinemaHud(c: CanvasRenderingContext2D, g: Game, w: number, _h: number) {
  const cine = g.finale.cinema,
    e = g.finale.enemy;
  if (!cine?.active || !combat(cine.state) || !e || e.hp <= 0 || g.mode === 'title' || g.escape)
    return;
  const width = Math.min(550, w - 70),
    x = (w - width) / 2,
    y = w < 620 ? 64 : 55;
  c.save();
  c.font = `${w < 620 ? 12 : 14}px sans-serif`;
  c.textAlign = 'left';
  c.fillStyle = '#e1e4db';
  c.fillText('The Reclaimer', x, y - 9);
  c.fillStyle = '#3e2023';
  c.fillRect(x, y, width, 9);
  c.fillStyle = '#c93532';
  c.fillRect(x, y, width * clamp(e.hp / e.maxHp, 0, 1), 9);
  c.fillStyle = '#e86658';
  c.fillRect(x, y, width * clamp(e.hp / e.maxHp, 0, 1), 1);
  c.restore();
}
