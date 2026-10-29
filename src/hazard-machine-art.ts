import type { MachineBodySnapshot } from './machine-breakdown-pose.ts';
import { hazardMachinePose, type HazardMachinePose } from './hazard-machine-pose.ts';
import type { Vec } from './rules.ts';

function line(c: CanvasRenderingContext2D, a: Vec, b: Vec, color: string, width = 1) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(a.x, a.y);
  c.lineTo(b.x, b.y);
  c.stroke();
}
function dot(c: CanvasRenderingContext2D, p: Vec, r: number, color: string) {
  c.fillStyle = color;
  c.beginPath();
  c.arc(p.x, p.y, r, 0, Math.PI * 2);
  c.fill();
}
function plate(c: CanvasRenderingContext2D, points: Vec[], fill: string, edge: string) {
  c.beginPath();
  points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  c.strokeStyle = edge;
  c.lineWidth = 1;
  c.stroke();
}
function wear(c: CanvasRenderingContext2D, p: HazardMachinePose, inactive: boolean) {
  if (!p.wear) return;
  line(c, { x: -12, y: -7 }, { x: -5, y: -3 }, '#17292e', 2.5);
  line(c, { x: -5, y: -3 }, { x: -8, y: 3 }, '#17292e', 2.3);
  line(c, { x: -12, y: -8 }, { x: -6, y: -4 }, '#c9b295', 0.7);
  if (p.wear < 2) return;
  plate(
    c,
    [
      { x: 5, y: 1 },
      { x: 13, y: -1 },
      { x: 12, y: 8 },
      { x: 4, y: 7 },
    ],
    '#13272c',
    '#7d8170',
  );
  for (let i = 0; i < 3; i++)
    line(
      c,
      { x: 6, y: 2 + i * 1.8 },
      { x: 10, y: 1 + i * 1.8 },
      inactive ? '#596761' : '#b0a27d',
      1,
    );
  line(c, { x: -10, y: 5 }, { x: -5, y: 8 }, '#ba9872', 1.2);
}
/** Shared local hardware. It contains no thrown prop, cable/head, charge, warning arc or caption.
 * Barrel tips remain at native muzzles; energy0 shuts down captured hardware without changing HP.
 */
export function drawHazardChassis(
  c: CanvasRenderingContext2D,
  s: MachineBodySnapshot,
  reduced = false,
  p: HazardMachinePose = hazardMachinePose(s, reduced),
) {
  const inactive = p.energy <= 0,
    dark = '#172b30',
    metal = inactive ? '#62736c' : '#b7b69b',
    edge = inactive ? '#65766d' : s.allied ? '#8db9c5' : '#b39b7c',
    shell = s.allied
      ? '#31525e'
      : s.kind === 'scrapper'
        ? '#8f6550'
        : s.kind === 'harpooner'
          ? '#925e52'
          : '#9f8054',
    accent = inactive
      ? '#586d64'
      : s.allied
        ? '#8cc6df'
        : s.kind === 'sapper'
          ? '#ebc47e'
          : '#dfb487',
    lamp = inactive ? '#425a54' : p.recover ? '#9eac90' : accent;
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  // Three captive rollers and a continuous tread read as heavy plant, not walking legs.
  c.fillStyle = dark;
  c.fillRect(-18, 8, 36, 10);
  c.strokeStyle = inactive ? '#596c65' : '#8d8c74';
  c.lineWidth = 1.2;
  c.strokeRect(-17, 9, 34, 8);
  for (const x of [-12, 0, 12]) {
    dot(c, { x, y: 13 }, 3.9, '#42554f');
    dot(c, { x, y: 13 }, 2.3, metal);
    line(
      c,
      { x: x - Math.cos(p.tread) * 1.7, y: 13 - Math.sin(p.tread) * 1.7 },
      { x: x + Math.cos(p.tread) * 1.7, y: 13 + Math.sin(p.tread) * 1.7 },
      dark,
      1,
    );
  }
  const travel = ((p.tread % 6) + 6) % 6;
  for (let x = -15 + travel; x < 17; x += 6) {
    line(c, { x, y: 9 }, { x: x + 2, y: 9 }, '#c0ad87', 0.9);
    line(c, { x, y: 17 }, { x: x + 2, y: 17 }, '#7e8c75', 1);
  }
  c.save();
  c.translate(p.body.x, p.body.y);
  c.rotate(p.angle);
  if (s.kind === 'scrapper') {
    plate(
      c,
      [
        { x: -16, y: 8 },
        { x: -15, y: -7 },
        { x: -6, y: -18 },
        { x: 11, y: -15 },
        { x: 17, y: 8 },
      ],
      shell,
      edge,
    );
    plate(
      c,
      [
        { x: -13, y: -8 },
        { x: -8, y: -23 },
        { x: 5, y: -23 },
        { x: 10, y: -13 },
      ],
      '#725645',
      edge,
    );
    c.fillStyle = dark;
    c.fillRect(-7, -19, 11, 7);
    c.fillStyle = lamp;
    c.fillRect(p.forward > 0 ? -1 : -6, -17, 4, 2.3);
    c.fillStyle = '#34443f';
    c.fillRect(-13, 1, 28, 7);
    for (const x of [-9, -1, 7]) line(c, { x, y: 2 }, { x: x + 4, y: 6 }, '#b7a075', 2);
    dot(c, { x: 0, y: -8 }, 7, dark);
    dot(c, { x: 0, y: -8 }, 4.7, '#768374');
    dot(c, { x: 0, y: -8 }, 2.3, accent);
  } else if (s.kind === 'harpooner') {
    plate(
      c,
      [
        { x: -17, y: 8 },
        { x: -13, y: -12 },
        { x: -3, y: -21 },
        { x: 12, y: -15 },
        { x: 17, y: 8 },
      ],
      shell,
      edge,
    );
    c.fillStyle = '#34443f';
    c.fillRect(-14, 1, 28, 7);
    for (const side of [-1, 1]) {
      c.fillStyle = '#5c6858';
      c.fillRect(side < 0 ? -18 : 12, -4, 6, 12);
      for (let y = -1; y < 7; y += 3) line(c, { x: side * 13, y }, { x: side * 16, y }, dark, 0.9);
    }
    c.fillStyle = dark;
    c.fillRect(-10, -15, 20, 5);
    c.fillStyle = lamp;
    c.fillRect(p.forward > 0 ? 5 : -9, -14, 4, 2.4);
    line(c, { x: -10, y: 5 }, { x: 10, y: 5 }, metal, 1.5);
  } else {
    plate(
      c,
      [
        { x: -17, y: 8 },
        { x: -16, y: -8 },
        { x: -10, y: -17 },
        { x: 12, y: -17 },
        { x: 17, y: 8 },
      ],
      shell,
      edge,
    );
    c.fillStyle = '#4e4a39';
    c.fillRect(-13, -9, 26, 15);
    // Solid armored magazine doors; these are hardware, not fictitious charge-count pips.
    for (const x of [-9, 2]) {
      c.fillStyle = '#8d8660';
      c.fillRect(x, -7, 7, 12);
      c.strokeStyle = metal;
      c.lineWidth = 0.8;
      c.strokeRect(x, -7, 7, 12);
      line(c, { x: x + 2, y: -3 }, { x: x + 5, y: -3 }, dark, 1);
      line(c, { x: x + 2, y: 1 }, { x: x + 5, y: 1 }, dark, 1);
    }
    c.fillStyle = dark;
    c.fillRect(p.forward > 0 ? 6 : -14, -15, 8, 4);
    c.fillStyle = lamp;
    c.fillRect(p.forward > 0 ? 9 : -13, -14, 3, 1.8);
    line(c, { x: -13, y: 8 }, { x: 13, y: 8 }, metal, 1.2);
  }
  wear(c, p, inactive);
  c.restore();
  if (p.arm) {
    const a = p.arm,
      side = a.hand.x < 0 ? -1 : 1;
    // A doubled hydraulic boom follows the actual held crate center. No crate is painted here.
    line(c, a.shoulder, a.elbow, dark, 8.5);
    line(c, a.elbow, a.hand, dark, 7);
    line(c, a.shoulder, a.elbow, '#8b8470', 5);
    line(c, a.elbow, a.hand, '#b89e78', 3.8);
    const piston = {
      x: (a.shoulder.x + a.elbow.x) * 0.58 + side * 3,
      y: (a.shoulder.y + a.elbow.y) * 0.58 + 2,
    };
    line(c, { x: a.shoulder.x - side * 5, y: a.shoulder.y + 1 }, piston, '#4e665b', 4);
    line(c, piston, { x: a.elbow.x + side * 3, y: a.elbow.y - 1 }, metal, 1.8);
    c.strokeStyle = '#374943';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(a.shoulder.x - side * 5, a.shoulder.y);
    c.quadraticCurveTo(a.elbow.x - side * 13, a.elbow.y + 8, a.hand.x - side * 5, a.hand.y + 6);
    c.stroke();
    for (const joint of [a.shoulder, a.elbow]) {
      dot(c, joint, 5, dark);
      dot(c, joint, 3, metal);
      dot(c, joint, 1.1, '#59695b');
    }
    dot(c, a.hand, 4.7, dark);
    dot(c, a.hand, 2.9, '#a58e6e');
    const held = s.hazardMachine?.scrapper?.held,
      heldHalf = held ? Math.max(12, held.hull.x / 2 + 2) : 25,
      span = held ? heldHalf + (1 - a.grip) * 12 : 12 + p.release * 25;
    for (const jaw of [-1, 1]) {
      const base = { x: a.hand.x, y: a.hand.y - 11 },
        corner = { x: a.hand.x + jaw * span, y: a.hand.y - 9 },
        end = { x: a.hand.x + jaw * span, y: a.hand.y + 10 };
      line(c, base, corner, dark, 5);
      line(c, corner, end, dark, 5);
      line(c, base, corner, metal, 2.8);
      line(c, corner, end, accent, 2.6);
      line(c, end, { x: end.x - jaw * 5, y: end.y - 1 }, metal, 2.6);
    }
  }
  if (p.spool) {
    const w = p.spool;
    line(c, { x: -9, y: 7 }, { x: w.center.x - 4, y: w.center.y + 5 }, dark, 5);
    for (const offset of [-3, 3]) {
      dot(c, { x: w.center.x + offset, y: w.center.y }, 8.6, dark);
      dot(c, { x: w.center.x + offset, y: w.center.y }, 7.1, offset < 0 ? '#647367' : '#a99979');
    }
    dot(c, w.center, 6.2, '#3f514b');
    for (let i = 0; i < 4; i++) {
      const a = w.angle + (i * Math.PI) / 2;
      line(
        c,
        { x: w.center.x + Math.cos(a) * 1.8, y: w.center.y + Math.sin(a) * 1.8 },
        { x: w.center.x + Math.cos(a) * 5.7, y: w.center.y + Math.sin(a) * 5.7 },
        metal,
        1.3,
      );
    }
    dot(c, w.center, 2, accent);
    // The physical line is already gone during braking; only captive shoes arrest the real spool.
    for (const side of [-1, 1]) {
      const x = w.center.x + side * (9.5 - p.brake * 1.5);
      c.fillStyle = dark;
      c.fillRect(x - 1.6, w.center.y - 4, 3.2, 8);
      line(
        c,
        { x: x - side * 0.8, y: w.center.y - 2.5 },
        { x: x - side * 0.8, y: w.center.y + 2.5 },
        p.brake > 0 && !inactive ? accent : metal,
        1.5,
      );
    }
    if (w.tension > 0)
      line(
        c,
        { x: w.center.x - 6, y: w.center.y + 8 },
        { x: w.center.x + 6, y: w.center.y + 8 },
        inactive ? '#68776a' : '#e0c38e',
        1 + w.tension,
      );
  }
  if (p.loader) {
    const l = p.loader;
    line(c, l.origin, l.seat, dark, 8);
    line(c, l.origin, l.seat, '#8a9175', 4);
    const dx = l.seat.x - l.origin.x,
      dy = l.seat.y - l.origin.y;
    line(
      c,
      { x: l.origin.x + dx * 0.15, y: l.origin.y + dy * 0.15 },
      {
        x: l.origin.x + dx * (0.35 + l.stroke * 0.5),
        y: l.origin.y + dy * (0.35 + l.stroke * 0.5),
      },
      metal,
      2,
    );
    dot(c, l.origin, 3.5, dark);
    dot(c, l.origin, 1.7, accent);
    if (l.charge) {
      c.save();
      c.translate(l.seat.x, l.seat.y);
      c.rotate(p.barrel?.angle ?? 0);
      c.fillStyle = inactive ? '#667568' : '#c19e62';
      c.fillRect(-4, -3.5, 7, 7);
      line(c, { x: -2, y: -2 }, { x: 1, y: -2 }, metal, 1);
      c.restore();
    }
  }
  if (p.barrel) {
    const b = p.barrel;
    if (s.kind === 'sapper' && p.loader) {
      const hinge = {
        x: b.origin.x - Math.cos(b.angle) * b.length,
        y: b.origin.y - Math.sin(b.angle) * b.length,
      };
      line(c, p.loader.seat, hinge, dark, 6);
      line(c, p.loader.seat, hinge, metal, 2.8);
      dot(c, hinge, 3.3, dark);
      dot(c, hinge, 1.7, accent);
    }
    c.save();
    c.translate(b.origin.x, b.origin.y);
    c.rotate(b.angle);
    if (s.kind === 'harpooner') {
      // The forward end is zero: exactly where the native cable/head starts.
      c.fillStyle = dark;
      c.fillRect(-b.length, -4.5, b.length, 9);
      c.fillStyle = '#8e8c70';
      c.fillRect(-b.length + 2, -3.2, Math.max(0, b.length - 3), 6.4);
      c.fillStyle = '#455c53';
      c.fillRect(-b.length + 3 - b.recoil * 2, -6.5, 9, 13);
      line(c, { x: -b.length + 4, y: -5.5 }, { x: -3, y: -5.5 }, metal, 1.8);
      line(c, { x: -b.length + 4, y: 5.5 }, { x: -3, y: 5.5 }, metal, 1.8);
      line(c, { x: -3, y: -5.5 }, { x: 0, y: -8 }, accent, 1.8);
      line(c, { x: -3, y: 5.5 }, { x: 0, y: 8 }, accent, 1.8);
      for (const x of [-15, -10, -5])
        if (-x < b.length) line(c, { x, y: -2 }, { x, y: 2 }, '#59685a', 0.9);
    } else {
      // A captive ejection cup sits at the actual sapper launch origin.
      c.fillStyle = dark;
      c.fillRect(-b.length, -5.5, b.length, 11);
      c.fillStyle = inactive ? '#657567' : '#b7a373';
      c.fillRect(-b.length + 2, -4, Math.max(0, b.length - 3), 8);
      c.fillStyle = '#42574d';
      c.fillRect(-b.length + 3 - b.recoil * 3, -7, 8, 14);
      for (const y of [-6.5, 6.5]) line(c, { x: -b.length + 4, y }, { x: 0, y }, metal, 1.8);
      c.strokeStyle = accent;
      c.lineWidth = 1.5;
      c.strokeRect(-2, -6.5, 3, 13);
      line(c, { x: -b.length + 6, y: -3 }, { x: -5, y: -3 }, '#e0c998', 1);
    }
    c.restore();
  }
  c.restore();
}
