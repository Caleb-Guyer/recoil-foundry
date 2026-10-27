import type { Vec } from './rules.ts';
import type { LivingFoundryFrame } from './living-foundry-types.ts';
const bound = (n: number) => Math.max(0, Math.min(1, n));
function line(c: CanvasRenderingContext2D, p: number[], color: string, w = 1) {
  c.strokeStyle = color;
  c.lineWidth = w;
  c.beginPath();
  for (let i = 0; i < p.length; i += 2) i ? c.lineTo(p[i], p[i + 1]) : c.moveTo(p[i], p[i + 1]);
  c.stroke();
}
function shape(c: CanvasRenderingContext2D, p: number[], color: string) {
  c.fillStyle = color;
  c.beginPath();
  for (let i = 0; i < p.length; i += 2) i ? c.lineTo(p[i], p[i + 1]) : c.moveTo(p[i], p[i + 1]);
  c.closePath();
  c.fill();
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
function scrap(c: CanvasRenderingContext2D, x: number, y: number, scale: number, tone = '#273b32') {
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  shape(c, [-60, 0, -56, -22, -31, -19, -23, -47, -2, -29, 21, -55, 37, -28, 61, -18, 65, 0], tone);
  line(c, [-44, -8, -19, -8, -11, -28, 3, -15, 21, -36, 31, -15, 50, -9], '#3d5140', 3);
  c.restore();
}
function belt(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  t: number,
  salvage: number,
  power: number,
) {
  c.fillStyle = '#14271f';
  c.fillRect(x, y, w, 26);
  line(c, [x, y + 1, x + w, y + 1], '#3a4e39', 3);
  line(c, [x, y + 26, x + w, y + 26], '#2c4030', 6);
  for (let i = 0; i < 12; i++) {
    const xx = x + ((i / 12 + t * 0.025) % 1) * w;
    line(c, [xx - 7, y + 8, xx + 7, y + 17], '#2f4432', 2);
  }
  const count = Math.round(2 + salvage * 4);
  for (let i = 0; i < count; i++) {
    const xx = x + ((i / count + t * 0.014) % 1) * w;
    scrap(c, xx, y - 2, 0.34 + (i % 2) * 0.1, power > 0.1 ? '#3b4d38' : '#2c3d31');
  }
}
function magnet(c: CanvasRenderingContext2D, x: number, y: number, t: number, power: number) {
  const yy = y + Math.sin(t * 0.42) * 17;
  line(c, [x - 13, 164, x - 13, yy - 39, x + 13, yy - 39, x + 13, 164], '#4a5947', 2);
  shape(
    c,
    [
      x - 28,
      yy - 40,
      x + 28,
      yy - 40,
      x + 55,
      yy - 6,
      x + 55,
      yy + 12,
      x - 55,
      yy + 12,
      x - 55,
      yy - 6,
    ],
    '#304330',
  );
  line(c, [x - 54, yy + 12, x + 54, yy + 12], power > 0.1 ? '#6d7650' : '#3d4f3b', 5);
  c.fillStyle = '#1d3026';
  c.fillRect(x - 35, yy - 12, 70, 7);
  if (power > 0.1) {
    c.strokeStyle = '#4c62403b';
    c.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.ellipse(x, yy + 23 + i * 13, 40 + i * 9, 6, 0, 0, Math.PI * 2);
      c.stroke();
    }
  }
}
/** A transfer gate opens around the machinery, with full-size leaves on rails. */
function transferGate(c: CanvasRenderingContext2D, center: number, reveal: number, power: number) {
  const left = center - 336,
    top = 142,
    width = 672,
    height = 394,
    leaf = 205;
  const travel = bound(reveal) * (leaf + 16);
  shape(
    c,
    [
      left - 29,
      top + height + 12,
      left - 29,
      top + 16,
      left - 4,
      top - 19,
      left + width + 4,
      top - 19,
      left + width + 29,
      top + 16,
      left + width + 29,
      top + height + 12,
      left + width + 12,
      top + height + 12,
      left + width + 12,
      top + 13,
      left - 12,
      top + 13,
      left - 12,
      top + height + 12,
    ],
    '#293f2f',
  );
  line(c, [left - 25, top - 23, left + width + 25, top - 23], '#42573d', 7);
  line(c, [left - 4, top + height + 10, left + width + 4, top + height + 10], '#354b32', 9);
  c.save();
  c.beginPath();
  c.rect(left, top, width, height);
  c.clip();
  for (const side of [-1, 1]) {
    c.save();
    c.translate(side < 0 ? left - travel : left + width - leaf + travel, top);
    c.fillStyle = '#20372a';
    c.fillRect(0, 0, leaf, height);
    shape(c, [12, 12, leaf - 12, 12, leaf - 12, height - 12, 12, height - 12], '#29422f');
    line(c, [12, 12, leaf - 12, 12, leaf - 12, height - 12], '#3d5339', 3);
    for (let i = 0; i < 3; i++) {
      const y = 62 + i * 112;
      line(c, [15, y + 55, leaf - 15, y], '#3b5036', 8);
    }
    const edge = side < 0 ? leaf - 12 : 12;
    line(c, [edge, 0, edge, height], '#506044', 4);
    c.fillStyle = '#5a6848';
    c.fillRect(edge + side * 7 - 3, height * 0.47, 6, 36);
    c.restore();
  }
  c.restore();
  c.fillStyle = '#263d2c';
  c.fillRect(center - 53, top - 37, 106, 18);
  c.fillStyle = power > 0.1 ? '#6e7650' : '#3a4d36';
  c.fillRect(center - 36, top - 29, 72, 4);
}
/** Processing silhouettes live behind the physical platforms and hazard marks. */
export function drawLivingReclamation(
  c: CanvasRenderingContext2D,
  frame: LivingFoundryFrame,
  camera: Vec,
  width: number,
  height: number,
  reduced: boolean,
) {
  const power = bound(frame.power),
    salvage = bound(frame.salvage),
    t = reduced || salvage <= 0.001 ? 0 : frame.motion;
  const sky = c.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#101b1d');
  sky.addColorStop(0.55, '#20332b');
  sky.addColorStop(1, '#2a3c2d');
  c.fillStyle = sky;
  c.fillRect(0, 0, width, height);
  const floor = Math.max(560, height * 0.87);
  layer(c, frame, camera, width, 0.06);
  for (let i = 0; i < 4; i++) {
    const x = i * 390 - 30;
    shape(
      c,
      [
        x,
        floor,
        x,
        253 + (i % 2) * 73,
        x + 120,
        187 + (i % 2) * 73,
        x + 262,
        253 + (i % 2) * 73,
        x + 262,
        floor,
      ],
      '#1b2e27',
    );
    line(c, [x + 27, 320, x + 235, 320], '#2a3e30', 7);
  }
  for (let i = 0; i < 5; i++) scrap(c, 95 + i * 298, floor + 15, 1.25 + (i % 2) * 0.35, '#21352b');
  c.restore();
  layer(c, frame, camera, width, 0.15);
  const center = width * 0.51 + 65;
  if (frame.variant === 0) {
    // Sloping legs and triangulated beam make a recognizable overhead gantry.
    shape(
      c,
      [center - 342, floor, center - 285, 131, center - 255, 131, center - 300, floor],
      '#29402f',
    );
    shape(
      c,
      [center + 300, floor, center + 255, 131, center + 285, 131, center + 342, floor],
      '#29402f',
    );
    c.fillStyle = '#304533';
    c.fillRect(center - 294, 128, 588, 38);
    for (let i = 0; i < 8; i++)
      line(
        c,
        [center - 286 + i * 72, 159, center - 250 + i * 72, 133, center - 214 + i * 72, 159],
        '#45573b',
        2,
      );
    const travel = Math.sin(t * 0.23) * 104;
    c.fillStyle = '#384c35';
    c.fillRect(center + travel - 44, 161, 88, 16);
    magnet(c, center + travel, 350, t, power);
    belt(c, center - 332, floor - 84, 664, t, salvage, power);
    scrap(c, center - 210, floor - 87, 1.25);
    scrap(c, center + 223, floor - 87, 0.95);
  } else if (frame.variant === 1) {
    // A heavy diagonal shear with a moving internal ram, rather than another box.
    shape(
      c,
      [
        center - 250,
        floor,
        center - 235,
        226,
        center - 120,
        153,
        center + 225,
        217,
        center + 252,
        floor,
      ],
      '#263d2d',
    );
    shape(
      c,
      [center - 185, 285, center + 162, 285, center + 175, 467, center - 175, 467],
      '#142a23',
    );
    const ram = Math.sin(t * 0.65) * 22;
    line(
      c,
      [center - 116, 241, center - 116, 315 + ram, center + 116, 315 + ram, center + 116, 241],
      '#42543b',
      16,
    );
    shape(
      c,
      [
        center - 156,
        326 + ram,
        center + 156,
        326 + ram,
        center + 146,
        360 + ram,
        center - 149,
        379 + ram,
      ],
      '#3b5038',
    );
    line(c, [center - 146, 379 + ram, center + 146, 360 + ram], '#536045', 3);
    c.fillStyle = power > 0.1 ? '#6e7650' : '#3a4d36';
    c.fillRect(center - 36, 212, 72, 4);
    belt(c, center - 355, floor - 96, 710, t, salvage, power);
    for (let i = 0; i < 3; i++) scrap(c, center - 290 + i * 285, floor - 99, 0.8 + i * 0.12);
  } else {
    // A tilted sorting drum shows concentric ribs and a turning inner cage.
    c.save();
    c.translate(center, 337);
    c.rotate(-0.12);
    c.fillStyle = '#273f2e';
    c.fillRect(-222, -112, 444, 224);
    for (const x of [-222, -112, 0, 112, 222]) {
      c.fillStyle = '#1b3127';
      c.strokeStyle = '#3b5138';
      c.lineWidth = 6;
      c.beginPath();
      c.ellipse(x, 0, 34, 112, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
    for (let i = 0; i < 5; i++) {
      const yy = Math.sin(t * 0.43 + (i * Math.PI * 2) / 5) * 89;
      line(c, [-214, yy, 214, yy], '#496044', 4);
    }
    c.restore();
    line(c, [center - 174, 446, center - 227, floor, center - 161, floor], '#314733', 17);
    line(c, [center + 174, 412, center + 227, floor, center + 161, floor], '#314733', 17);
    belt(c, center - 351, floor - 67, 702, t, salvage, power);
    scrap(c, center + 292, floor - 70, 1.1);
  }
  // The moving gate reveals the larger processing line without covering any
  // actor, collision surface or attack warning drawn in the foreground.
  transferGate(c, center, frame.reveal, power);
  c.restore();
}
