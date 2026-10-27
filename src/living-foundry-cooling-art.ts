import type { Vec } from './rules.ts';
import type { LivingFoundryFrame } from './living-foundry-types.ts';

const bound = (n: number) => Math.max(0, Math.min(1, n));
function line(c: CanvasRenderingContext2D, points: number[], color: string, width = 1) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  for (let i = 0; i < points.length; i += 2)
    i ? c.lineTo(points[i], points[i + 1]) : c.moveTo(points[i], points[i + 1]);
  c.stroke();
}
function layer(
  c: CanvasRenderingContext2D,
  f: LivingFoundryFrame,
  camera: Vec,
  width: number,
  depth: number,
) {
  c.save();
  if (f.mirrored) {
    c.translate(width, 0);
    c.scale(-1, 1);
  }
  c.translate((f.mirrored ? camera.x : -camera.x) * depth, -camera.y * depth * 0.65);
}
function pipe(c: CanvasRenderingContext2D, points: number[], live: boolean) {
  line(c, points, '#132c32', 17);
  line(c, points, '#2a484d', 11);
  line(c, points, live ? '#527974' : '#3b5558', 2);
}
function wheel(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  phase: number,
  power: number,
) {
  c.save();
  c.translate(x, y);
  c.fillStyle = '#132b32';
  c.strokeStyle = '#335259';
  c.lineWidth = 5;
  c.beginPath();
  c.arc(0, 0, r, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.rotate(phase);
  for (let i = 0; i < 5; i++) {
    c.rotate((Math.PI * 2) / 5);
    c.fillStyle = '#304b50';
    c.beginPath();
    c.moveTo(4, -5);
    c.lineTo(r * 0.7, -r * 0.38);
    c.lineTo(r * 0.82, -3);
    c.lineTo(8, 10);
    c.closePath();
    c.fill();
  }
  c.fillStyle = power > 0.1 ? '#658d83' : '#3d5557';
  c.beginPath();
  c.arc(0, 0, 7, 0, Math.PI * 2);
  c.fill();
  c.restore();
}
function tower(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  power: number,
  coolant: number,
) {
  c.fillStyle = '#1b353b';
  c.beginPath();
  c.moveTo(x - 96, y + h);
  c.bezierCurveTo(x - 75, y + h * 0.55, x - 35, y + h * 0.38, x - 65, y);
  c.lineTo(x + 65, y);
  c.bezierCurveTo(x + 35, y + h * 0.38, x + 75, y + h * 0.55, x + 96, y + h);
  c.closePath();
  c.fill();
  c.strokeStyle = '#304e54';
  c.lineWidth = 2;
  c.stroke();
  for (const side of [-1, 1])
    line(
      c,
      [x + side * 47, y + 12, x + side * 37, y + h * 0.38, x + side * 75, y + h - 12],
      '#28474e',
      3,
    );
  c.fillStyle = '#112a31';
  c.beginPath();
  c.ellipse(x, y + 2, 65, 13, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#3a5e62';
  c.lineWidth = 3;
  c.stroke();
  c.fillStyle = '#29494e';
  c.fillRect(x - 87, y + h - 39, 174, 11);
  for (let i = 0; i < 8; i++) {
    c.fillStyle = '#102a31';
    c.fillRect(x - 69 + i * 19, y + h - 25, 10, 25);
  }
  c.fillStyle = power > 0.1 ? '#49776f' : '#304c50';
  c.fillRect(x - 39, y + h * 0.58, 78, 3 + coolant * 2);
  line(c, [x - 99, y + h + 3, x + 99, y + h + 3], '#36575b', 6);
}
function reservoir(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number,
  phase: number,
  power: number,
) {
  c.fillStyle = '#112b32';
  c.fillRect(x, y, w, h);
  c.strokeStyle = '#36565b';
  c.lineWidth = 5;
  c.strokeRect(x, y, w, h);
  const top = y + h * (1 - (0.18 + fill * 0.55));
  c.fillStyle = power > 0.1 ? '#264d50' : '#203e45';
  c.fillRect(x + 4, top, w - 8, y + h - top - 4);
  line(c, [x + 4, top, x + w - 4, top], power > 0.1 ? '#4f7e76' : '#36595a', 2);
  for (let i = 1; i < 5; i++) {
    const xx = x + ((i / 5 + phase * 0.025) % 1) * (w - 16) + 8;
    line(c, [xx, top + 12, xx + 10, top + 12], '#365e5f');
  }
  for (let i = 0; i < 4; i++) {
    const yy = y + 14 + i * ((h - 28) / 3);
    line(c, [x - 11, yy, x - 5, yy], '#52716d', 2);
  }
  line(c, [x + 15, y - 13, x + w - 15, y - 13], '#38565a', 5);
}
/** Rigid bulkhead leaves retract into side pockets around the circulation hall. */
function intakeGate(c: CanvasRenderingContext2D, center: number, reveal: number, power: number) {
  const left = center - 294,
    top = 128,
    width = 588,
    height = 406,
    leaf = 184;
  const travel = bound(reveal) * (leaf + 14);
  // Open rails and a narrow upper transom keep the scale of the hall readable.
  line(
    c,
    [
      left - 18,
      top + height + 8,
      left - 18,
      top - 20,
      left + width + 18,
      top - 20,
      left + width + 18,
      top + height + 8,
    ],
    '#28474e',
    18,
  );
  line(c, [left - 28, top - 25, left + width + 28, top - 25], '#426268', 5);
  line(c, [left - 12, top + height + 8, left + width + 12, top + height + 8], '#2b4b50', 8);
  c.save();
  c.beginPath();
  c.rect(left, top, width, height);
  c.clip();
  for (const side of [-1, 1]) {
    c.save();
    c.translate(side < 0 ? left - travel : left + width - leaf + travel, top);
    c.fillStyle = '#1b343c';
    c.fillRect(0, 0, leaf, height);
    c.fillStyle = '#203f46';
    c.fillRect(9, 8, leaf - 18, height - 16);
    line(c, [9, height - 12, 9, 8, leaf - 9, 8], '#35565d', 3);
    for (let i = 0; i < 4; i++) line(c, [12, 45 + i * 92, leaf - 12, 45 + i * 92], '#294a51', 8);
    line(c, [17, 75, leaf - 17, height - 52], '#34525a', 5);
    const edge = side < 0 ? leaf - 13 : 13;
    line(c, [edge, 0, edge, height], '#48646a', 3);
    line(c, [edge + side * 9, height * 0.47, edge + side * 9, height * 0.56], '#60736f', 4);
    c.restore();
  }
  c.restore();
  for (const offset of [-width * 0.35, width * 0.35]) {
    c.fillStyle = '#243f46';
    c.fillRect(center + offset - 24, top - 36, 48, 15);
    c.fillStyle = power > 0.1 ? '#638578' : '#384e4f';
    c.fillRect(center + offset - 15, top - 28, 30, 3);
  }
}
/** Large, quiet architecture. Bright playable edges and warnings are drawn later. */
export function drawLivingCooling(
  c: CanvasRenderingContext2D,
  frame: LivingFoundryFrame,
  camera: Vec,
  width: number,
  height: number,
  reduced: boolean,
) {
  const power = bound(frame.power),
    coolant = bound(frame.coolant),
    t = reduced || coolant <= 0.001 ? 0 : frame.motion;
  const sky = c.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#0b1a23');
  sky.addColorStop(0.6, '#16343c');
  sky.addColorStop(1, '#203b3c');
  c.fillStyle = sky;
  c.fillRect(0, 0, width, height);
  const floor = Math.max(535, height * 0.86);
  layer(c, frame, camera, width, 0.07);
  // Distant pipe bridges connect separate silhouettes instead of a tiled wall.
  line(c, [-70, 130, width + 200, 130], '#1b343e', 31);
  line(c, [width * 0.22, 136, width * 0.22, floor, width * 0.22 + 14, floor], '#1a323b', 16);
  line(c, [width * 0.8, 136, width * 0.8, floor], '#1a323b', 20);
  for (let i = 0; i < 3; i++) {
    const x = width * (0.12 + i * 0.35);
    c.fillStyle = '#172f39';
    c.fillRect(x, 205 + (i % 2) * 55, 115, floor);
    line(c, [x + 16, 215 + (i % 2) * 55, x + 99, 215 + (i % 2) * 55], '#28434a', 3);
  }
  c.restore();
  layer(c, frame, camera, width, 0.16);
  const center = width * 0.53 + 80;
  if (frame.variant === 0) {
    tower(c, center - 143, 145, floor - 145, power * coolant, coolant);
    tower(c, center + 126, 208, floor - 208, power * coolant, coolant);
    pipe(
      c,
      [center - 255, floor, center - 255, 380, center - 60, 380, center - 60, floor],
      power > 0.1 && coolant > 0.001,
    );
    reservoir(c, center - 58, 419, 116, 132, coolant, t, power);
    wheel(c, center - 255, 419, 35, t * 0.7, power * coolant);
  } else if (frame.variant === 1) {
    // A single cathedral-like circulation hall gives this composition its scale.
    c.fillStyle = '#18353c';
    c.beginPath();
    c.moveTo(center - 305, floor);
    c.lineTo(center - 305, 238);
    c.quadraticCurveTo(center, -12, center + 305, 238);
    c.lineTo(center + 305, floor);
    c.closePath();
    c.fill();
    c.strokeStyle = '#2e4f55';
    c.lineWidth = 7;
    c.stroke();
    for (const offset of [-198, 0, 198]) {
      pipe(
        c,
        [center + offset, 225 + Math.abs(offset) * 0.18, center + offset, floor],
        power > 0.1 && coolant > 0.001,
      );
      line(c, [center + offset - 18, 334, center + offset + 18, 334], '#385b5f', 5);
    }
    wheel(c, center, 302, 92, -t * 0.32, power * coolant);
    reservoir(c, center - 246, 458, 150, 120, coolant, t, power);
    reservoir(c, center + 96, 458, 150, 120, coolant, t, power);
    pipe(
      c,
      [center - 246, 604, center - 246, 626, center + 246, 626, center + 246, 604],
      power > 0.1 && coolant > 0.001,
    );
  } else {
    // A stepped aqueduct and cutaway reservoir, held well behind the route.
    c.fillStyle = '#1c3940';
    c.fillRect(center - 345, 276, 690, 38);
    for (const offset of [-300, -120, 120, 300]) {
      c.fillRect(center + offset - 13, 310, 26, floor - 310);
      line(c, [center + offset - 30, 320, center + offset + 30, 320], '#35555a', 5);
    }
    reservoir(c, center - 233, 348, 466, 202, coolant, t, power);
    for (const offset of [-300, 300])
      wheel(c, center + offset, 396, 44, t * (offset < 0 ? 0.6 : -0.6), power * coolant);
    pipe(
      c,
      [center - 300, 441, center - 300, 594, center + 300, 594, center + 300, 441],
      power > 0.1 && coolant > 0.001,
    );
    c.fillStyle = '#29494d';
    c.fillRect(center - 95, 244, 190, 16);
  }
  // The central opening preserves a preview; the two full-size leaves slide
  // behind side pockets as exploration exposes the whole circulation landmark.
  intakeGate(c, center, frame.reveal, power);
  c.restore();
  // One low service run anchors the foreground depth, without a solid top edge.
  layer(c, frame, camera, width, 0.23);
  pipe(c, [-180, floor + 44, width + 380, floor + 44], power > 0.1 && coolant > 0.001);
  c.restore();
}
