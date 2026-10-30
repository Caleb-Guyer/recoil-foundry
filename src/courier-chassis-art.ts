import type { Vec } from './rules.ts';

/** Local captive parts only. World position, support clipping and real cargo are owned by the caller. */
export interface CourierArtPose {
  body: Vec;
  lean: number;
  wheelAngle: number;
  suspension: number;
  cargo: Vec;
  cargoAngle: number;
  clampOpen: number;
  boost: number;
  wear: 0 | 1 | 2;
  energy: number;
  hit: { local: Vec; strength: number } | null;
  health: number | null;
  cargoHeld: boolean;
}
const unit = (n: number) => Math.max(0, Math.min(1, n));
function line(c: CanvasRenderingContext2D, a: Vec, b: Vec, color: string, width = 1) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(a.x, a.y);
  c.lineTo(b.x, b.y);
  c.stroke();
}
function disc(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}
function polygon(c: CanvasRenderingContext2D, points: Vec[], fill: string, edge: string) {
  c.fillStyle = fill;
  c.strokeStyle = edge;
  c.lineWidth = 1.2;
  c.beginPath();
  points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  c.closePath();
  c.fill();
  c.stroke();
}

/** The same sealed case is used on the living courier and the actual native dropped body. */
export function drawCourierCase(c: CanvasRenderingContext2D, active = true) {
  const edge = active ? '#dfbb7b' : '#7e7964';
  c.save();
  c.lineJoin = 'round';
  polygon(
    c,
    [
      { x: -12, y: -9 },
      { x: 9, y: -9 },
      { x: 13, y: -5 },
      { x: 13, y: 9 },
      { x: -13, y: 9 },
      { x: -13, y: -5 },
    ],
    '#483c2c',
    edge,
  );
  c.fillStyle = '#212d2d';
  c.fillRect(-9, -5, 18, 11);
  c.strokeStyle = edge;
  c.lineWidth = 1.5;
  c.strokeRect(-5, -13, 10, 4);
  line(c, { x: -9, y: -1 }, { x: 9, y: -1 }, '#7c7157', 1);
  for (const x of [-8, 8]) {
    c.fillStyle = '#8b8a70';
    c.fillRect(x - 1.2, -7, 2.4, 14);
  }
  c.fillStyle = active ? '#f3d99d' : '#8a8c74';
  c.fillRect(-2, -6, 4, 12);
  for (const x of [-10, 10]) for (const y of [-6, 6]) disc(c, x, y, 0.75, '#192829');
  c.restore();
}

/** Shared live, portrait and defeated rig. No physics, RNG, emissions or world warnings. */
export function drawCourierChassis(c: CanvasRenderingContext2D, p: CourierArtPose) {
  const inactive = p.energy <= 0,
    dark = '#17282b',
    metal = inactive ? '#758078' : '#c0b892',
    edge = inactive ? '#747a6c' : '#c4a576',
    amber = inactive ? '#586b65' : '#e6bd79',
    body = p.body,
    spring = Math.max(-1, Math.min(1, p.suspension));
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  // The wheel contact plane remains fixed. Suspension compression moves the captive upper chassis.
  line(c, { x: -12, y: 10 }, { x: 12, y: 10 }, dark, 8);
  line(c, { x: -12, y: 8 }, { x: 12, y: 8 }, '#55695e', 2);
  for (const x of [-12, 12]) {
    const hip = { x: body.x + x * 0.72, y: body.y + 1 },
      foot = { x, y: 10 };
    line(c, hip, foot, dark, 5.5);
    line(c, hip, foot, metal, 2);
    const ox = x < 0 ? 1.9 : -1.9;
    line(c, { x: hip.x + ox, y: hip.y + 1 }, { x: foot.x + ox, y: 9 }, '#807956', 1.4);
    for (let i = 0; i < 3; i++) {
      const t = (i + 0.35) / 3,
        y = hip.y + (foot.y - hip.y) * t;
      line(
        c,
        { x: hip.x - 2.2 + (foot.x - hip.x) * t, y },
        { x: hip.x + 2.2 + (foot.x - hip.x) * t, y: y + 1.4 - spring * 0.45 },
        '#b7ae84',
        1,
      );
    }
    disc(c, x, 10, 6, dark);
    disc(c, x, 10, 4.9, inactive ? '#425a54' : '#5c6d5d');
    c.strokeStyle = metal;
    c.lineWidth = 1;
    c.beginPath();
    c.arc(x, 10, 4.3, 0, Math.PI * 2);
    c.stroke();
    for (let i = 0; i < 3; i++) {
      const a = p.wheelAngle + (i * Math.PI * 2) / 3;
      line(
        c,
        { x: x + Math.cos(a) * 1.1, y: 10 + Math.sin(a) * 1.1 },
        { x: x + Math.cos(a) * 3.8, y: 10 + Math.sin(a) * 3.8 },
        metal,
        1.2,
      );
    }
    disc(c, x, 10, 1.8, '#283f3f');
    disc(c, x, 10, 0.75, metal);
  }
  c.save();
  c.translate(body.x, body.y);
  c.rotate(p.lean);
  // Rear drive housing, flywheel and connected axle belt remain captive after drive loss.
  c.fillStyle = '#31443f';
  c.fillRect(-18, -6, 10, 12);
  c.strokeStyle = edge;
  c.lineWidth = 1;
  c.strokeRect(-18, -6, 10, 12);
  for (let y = -3; y <= 3; y += 3) line(c, { x: -16, y }, { x: -11, y }, '#93a28b', 1);
  disc(c, -11, 1, 4.4, dark);
  disc(c, -11, 1, 2.7, '#879078');
  line(
    c,
    { x: -11, y: 1 },
    { x: -11 + Math.cos(p.wheelAngle) * 2.3, y: 1 + Math.sin(p.wheelAngle) * 2.3 },
    dark,
    1.3,
  );
  polygon(
    c,
    [
      { x: -15, y: -5 },
      { x: 8, y: -7 },
      { x: 17, y: -1 },
      { x: 14, y: 8 },
      { x: -13, y: 8 },
    ],
    inactive ? '#3b4942' : '#65583e',
    edge,
  );
  c.fillStyle = '#283d3d';
  c.fillRect(-9, -1, 19, 5.5);
  line(c, { x: -11, y: 6 }, { x: 12, y: 6 }, '#999579', 1.3);
  for (const x of [-11, 11]) disc(c, x, 3, 1.2, dark);
  c.fillStyle = amber;
  c.fillRect(11, -3, 5, 2.3);
  // Casing wear is visual only; the bright seal remains cargo, never a new weak point.
  if (p.wear > 0) {
    line(c, { x: -8, y: -5 }, { x: -4, y: -2 }, dark, 2.2);
    line(c, { x: -4, y: -2 }, { x: -6, y: 3 }, dark, 1.8);
    line(c, { x: -8, y: -6 }, { x: -4.5, y: -3 }, '#c2ad7f', 0.8);
  }
  if (p.wear > 1) {
    polygon(
      c,
      [
        { x: 2, y: 0 },
        { x: 10, y: -1 },
        { x: 9, y: 6 },
        { x: 1, y: 5 },
      ],
      dark,
      '#78867b',
    );
    for (let i = 0; i < 3; i++)
      line(c, { x: 3 + i * 2, y: 1 }, { x: 3 + i * 2, y: 4 }, '#9b9f83', 0.8);
    line(c, { x: 12, y: -4 }, { x: 15, y: -1 }, '#b09e79', 1);
  }
  // The empty cradle is visible after defeat. The dropped case belongs exclusively to CourierSystem.
  const opening = unit(p.clampOpen);
  for (const side of [-1, 1]) {
    c.save();
    c.translate(side * 13, -6);
    c.rotate(side * opening * 0.85);
    line(c, { x: 0, y: 0 }, { x: side, y: -12 }, dark, 5);
    line(c, { x: 0, y: 0 }, { x: side, y: -12 }, metal, 2.2);
    line(c, { x: side, y: -12 }, { x: -side * 3.5, y: -13 }, edge, 2.7);
    disc(c, 0, 0, 2.5, dark);
    disc(c, 0, 0, 1.2, metal);
    c.restore();
  }
  if (p.cargoHeld) {
    c.save();
    c.translate(p.cargo.x - body.x, p.cargo.y - body.y);
    c.rotate(p.cargoAngle - p.lean);
    drawCourierCase(c, !inactive);
    c.restore();
  } else {
    line(c, { x: -10, y: -7 }, { x: 10, y: -7 }, '#8e927d', 2.5);
    for (const x of [-7, 0, 7]) line(c, { x, y: -10 }, { x, y: -6 }, dark, 1.4);
  }
  // The original health readout stays on the cargo latch, never above the machine.
  if (p.health !== null && !inactive) {
    c.fillStyle = dark;
    c.fillRect(-11.5, 7.5, 23, 2.1);
    c.fillStyle = '#edc486';
    c.fillRect(-11.5, 7.5, 23 * unit(p.health), 2.1);
  }
  c.restore();
  if (p.boost > 0 && !inactive) {
    const power = unit(p.boost),
      start = { x: body.x - 18, y: body.y + 1 };
    line(c, start, { x: start.x - 5 - power * 9, y: start.y + 1 }, '#b09e76', 2.5);
    line(
      c,
      { x: start.x - 1, y: start.y - 2 },
      { x: start.x - 5 - power * 5, y: start.y - 1 },
      '#ead49a',
      1.1,
    );
  }
  if (p.hit && p.hit.strength > 0 && !inactive) {
    const at = p.hit.local,
      amount = unit(p.hit.strength);
    line(
      c,
      { x: at.x - 2.2, y: at.y - 1.5 },
      { x: at.x + 1.4, y: at.y + 1.8 },
      '#f6dda6',
      0.8 + amount * 1.1,
    );
    line(c, { x: at.x + 1.4, y: at.y + 1.8 }, { x: at.x + 3.2, y: at.y - 1 }, '#aa9973', 1.1);
  }
  c.restore();
}
