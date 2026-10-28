import type { MachineBodySnapshot } from './machine-breakdown-pose.ts';
import type { Vec } from './rules.ts';
import {
  supportMachinePose,
  type SupportMachinePose,
  type SupportTool,
} from './support-machine-pose.ts';

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
function wear(c: CanvasRenderingContext2D, p: SupportMachinePose, inactive: boolean) {
  if (!p.wear) return;
  line(c, { x: -11, y: -7 }, { x: -6, y: -3 }, '#14272d', 2.2);
  line(c, { x: -6, y: -3 }, { x: -8, y: 2 }, '#14272d', 2.2);
  line(c, { x: -10, y: -8 }, { x: -6, y: -4 }, '#c0b397', 0.7);
  if (p.wear < 2) return;
  plate(
    c,
    [
      { x: 5, y: 1 },
      { x: 12, y: 0 },
      { x: 10, y: 8 },
      { x: 4, y: 7 },
    ],
    '#13242a',
    '#627b72',
  );
  for (let i = 0; i < 3; i++)
    line(
      c,
      { x: 6, y: 2 + i * 1.7 },
      { x: 9, y: 1.5 + i * 1.7 },
      inactive ? '#53635b' : '#b7b58d',
      1,
    );
}
function tool(
  c: CanvasRenderingContext2D,
  t: SupportTool,
  color: string,
  inactive: boolean,
  fabricator: boolean,
) {
  line(c, t.base, t.elbow, '#223b3c', 6);
  line(c, t.elbow, t.tip, '#223b3c', 5);
  line(c, t.base, t.elbow, '#8aa58f', 2.6);
  line(c, t.elbow, t.tip, '#b7ae89', 2);
  const dx = t.elbow.x - t.base.x,
    dy = t.elbow.y - t.base.y;
  line(
    c,
    { x: t.base.x + 2, y: t.base.y },
    { x: t.base.x + dx * 0.7 + 2, y: t.base.y + dy * 0.7 },
    '#c6b78f',
    1,
  );
  dot(c, t.elbow, 2.6, '#203737');
  dot(c, t.elbow, 1.3, '#c1c1a0');
  c.save();
  c.translate(t.tip.x, t.tip.y);
  c.rotate(t.angle ?? Math.atan2(t.tip.y - t.elbow.y, t.tip.x - t.elbow.x));
  c.fillStyle = inactive ? '#4d635a' : t.active ? color : '#7e9884';
  c.fillRect(-3, -2.8, 5, 5.6);
  if (fabricator) {
    for (const side of [-1, 1]) {
      line(c, { x: 0, y: side * 3 }, { x: 5, y: side * 3 }, '#acb597', 1.3);
      line(c, { x: 5, y: side * 3 }, { x: 7, y: side * 1.5 }, '#acb597', 1.3);
    }
  } else {
    c.fillStyle = '#273f3d';
    c.fillRect(1, -1.2, 4, 2.4);
    c.fillStyle = inactive ? '#5b6a5c' : color;
    c.fillRect(4, -1.6, 1.5, 3.2);
  }
  c.restore();
}
/** Shared local rig. energy=0 independently disables intact owner-lost/interrupted machines without inventing HP damage. */
export function drawSupportChassis(
  c: CanvasRenderingContext2D,
  s: MachineBodySnapshot,
  reduced = false,
  p: SupportMachinePose = supportMachinePose(s, reduced),
) {
  const inactive = p.energy <= 0,
    flash = !inactive && !reduced && s.flash > 0,
    color = flash
      ? '#fff1d2'
      : s.allied
        ? '#79b9e0'
        : s.kind === 'repairer'
          ? '#a8d9c3'
          : s.kind === 'relay'
            ? '#efc477'
            : s.kind === 'sentry'
              ? '#e7a07f'
              : '#d4af80',
    shell = flash ? '#e3e8cf' : s.allied ? '#294853' : s.kind === 'sentry' ? '#51433a' : '#3d5851',
    edge = inactive ? '#536c60' : '#8ea58e',
    dark = '#172c31',
    lamp = inactive ? '#42594e' : p.mode === 'spent' ? '#6a7c69' : color;
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  for (const pod of p.pods) {
    line(c, { x: Math.sign(pod.x) * 9, y: 3 }, { x: pod.x, y: pod.y + 3 }, dark, 4);
    line(c, { x: Math.sign(pod.x) * 9, y: 3 }, { x: pod.x, y: pod.y + 3 }, '#8eaa94', 1.6);
    c.fillStyle = '#294744';
    c.beginPath();
    c.ellipse(pod.x, pod.y, 9, 4.5, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = edge;
    c.lineWidth = 1.1;
    c.stroke();
    const a = p.rotor * Math.sign(pod.x),
      rx = Math.cos(a) * 6.7,
      ry = Math.sin(a) * 2.5;
    line(
      c,
      { x: pod.x - rx, y: pod.y - ry },
      { x: pod.x + rx, y: pod.y + ry },
      inactive ? '#536e61' : '#c0c6a4',
      1.5,
    );
    dot(c, pod, 1.3, '#a6b49a');
    c.fillStyle = lamp;
    c.fillRect(pod.x - 3, pod.y + 4, 6, 1.5);
  }
  if (s.kind === 'fabricator' && p.legs.length >= 2) {
    const wheels = p.legs.map((l) => ({ x: l.foot.x, y: l.foot.y - 3 }));
    line(c, wheels[0], wheels[1], dark, 8);
    line(c, wheels[0], wheels[1], '#67816b', 5.7);
    for (const w of wheels) {
      dot(c, w, 3.6, dark);
      dot(c, w, 2.3, '#a5af8c');
      line(c, w, { x: w.x + Math.cos(p.rotor) * 2, y: w.y + Math.sin(p.rotor) * 2 }, '#456354', 1);
    }
    for (const l of p.legs) line(c, l.hip, { x: l.foot.x, y: l.foot.y - 3 }, '#9ba989', 2);
  } else
    for (const l of p.legs) {
      line(c, l.hip, l.knee, dark, 5);
      line(c, l.knee, l.foot, dark, 4.5);
      line(c, l.hip, l.knee, '#849b82', 2.5);
      line(c, l.knee, l.foot, '#b2b18f', 2);
      dot(c, l.knee, 2, dark);
      dot(c, l.knee, 1, '#c9be9a');
      c.fillStyle = '#2b443e';
      c.fillRect(l.foot.x - 3.5, l.foot.y - 1, 7, 3);
      c.fillStyle = '#a4b18d';
      c.fillRect(l.foot.x - 3, l.foot.y - 1, 6, 1);
    }
  c.save();
  c.translate(p.body.x, p.body.y);
  c.rotate(p.angle);
  if (s.kind === 'repairer' || s.kind === 'relay') {
    plate(
      c,
      [
        { x: -14, y: -8 },
        { x: -9, y: -14 },
        { x: 9, y: -14 },
        { x: 14, y: -8 },
        { x: 13, y: 9 },
        { x: 7, y: 13 },
        { x: -7, y: 13 },
        { x: -13, y: 9 },
      ],
      shell,
      edge,
    );
    c.fillStyle = dark;
    c.fillRect(-10, -10, 20, 19);
    if (s.kind === 'repairer') {
      c.fillStyle = '#31534c';
      c.fillRect(-12, -8, 5, 17);
      c.strokeStyle = '#92bca4';
      c.lineWidth = 0.8;
      c.strokeRect(-12, -8, 5, 17);
      c.fillStyle = inactive ? '#5b7765' : '#9bcbb1';
      c.fillRect(-11, 8 - 15 * p.reserve, 3, 15 * p.reserve);
      for (let i = 1; i < 6; i++)
        line(c, { x: -12, y: 8 - i * 2.5 }, { x: -10.5, y: 8 - i * 2.5 }, '#718e79', 0.6);
      c.fillStyle = lamp;
      c.fillRect(-5, -2, 13, 4);
      c.fillRect(-0.5, -6.5, 4, 13);
      c.fillStyle = '#425e4e';
      c.fillRect(8, -6, 4, 12);
      line(
        c,
        { x: 10, y: -3 - p.pulse * 3 },
        { x: 10, y: 5 },
        inactive ? '#607865' : '#c2c9a2',
        1.5,
      );
      line(c, { x: 8, y: -3 - p.pulse * 3 }, { x: 12, y: -3 - p.pulse * 3 }, color, 1.5);
    } else {
      c.strokeStyle = inactive ? '#596d59' : p.coil > 0.01 ? '#dfbd77' : '#8c916a';
      c.lineWidth = 1.1;
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.ellipse(0, -7 + i * 1.7, 8, 3, 0, 0, Math.PI * 2);
        c.stroke();
      }
      for (let i = 0; i < 3; i++) {
        const x = -9 + i * 7;
        c.fillStyle = '#2b3e38';
        c.fillRect(x, 1, 5, 9);
        c.strokeStyle = '#849778';
        c.lineWidth = 0.8;
        c.strokeRect(x, 1, 5, 9);
        c.fillStyle = inactive ? '#5c6f59' : p.cells[i] ? color : '#3f5547';
        c.fillRect(x + 1, 3, 3, 6);
        line(c, { x: x + 1, y: 2 }, { x: x + 4, y: 2 }, '#b4b18b', 0.7);
      }
      c.fillStyle = lamp;
      c.beginPath();
      c.moveTo(2, -11);
      c.lineTo(-3, -5);
      c.lineTo(1, -5);
      c.lineTo(-2, 0);
      c.lineTo(5, -7);
      c.lineTo(1, -7);
      c.closePath();
      c.fill();
      if (p.coil > 0 && !inactive) {
        c.fillStyle = '#f3d49c';
        c.fillRect(-7, -8, 14 * p.coil, 1);
      }
    }
    wear(c, p, inactive);
  } else if (s.kind === 'fabricator') {
    plate(
      c,
      [
        { x: -15, y: -7 },
        { x: -9, y: -12 },
        { x: 11, y: -12 },
        { x: 15, y: -6 },
        { x: 14, y: 10 },
        { x: -15, y: 10 },
      ],
      shell,
      edge,
    );
    c.fillStyle = '#a47c5c';
    c.fillRect(-10, -19, 20, 14);
    c.strokeStyle = '#c1a376';
    c.lineWidth = 1;
    c.strokeRect(-10, -19, 20, 14);
    c.fillStyle = dark;
    c.fillRect(-7, -15, 14, 7);
    c.fillStyle = lamp;
    c.fillRect(p.forward > 0 ? 1 : -6, -13, 5, 2.5);
    for (const side of [-1, 1]) {
      c.fillStyle = '#667f6a';
      c.fillRect(side < 0 ? -17 : 11, -4, 6, 12);
      for (let i = 0; i < 3; i++)
        line(c, { x: side * 13, y: -1 + i * 3 }, { x: side * 16, y: -1 + i * 3 }, dark, 0.8);
    }
    c.fillStyle = '#223a36';
    c.fillRect(-7, 2, 14, 6);
    c.fillStyle = inactive ? '#65745b' : color;
    c.fillRect(-5, 4, 10, 1.5);
    wear(c, p, inactive);
  } else {
    // The native full-sized construction frame remains visible at every real assembly stage.
    c.strokeStyle = inactive ? '#5e7060' : '#b69c76';
    c.lineWidth = 1.5;
    c.strokeRect(-12, -13, 24, 21);
    for (const x of [-10, 10]) line(c, { x, y: -11 }, { x, y: 6 }, '#5d715d', 1);
    c.fillStyle = shell;
    c.fillRect(-12, 8 - 21 * p.assembly, 24, 21 * p.assembly);
    if (p.assembly > 0.3) {
      line(c, { x: -10, y: -5 }, { x: 10, y: -5 }, edge, 1);
      c.fillStyle = dark;
      c.fillRect(-7, -3, 14, 8);
    }
    for (let i = 0; i < Math.ceil(p.assembly * 3); i++) {
      c.fillStyle = lamp;
      c.fillRect(-8 + i * 6, 3, 3, 2);
    }
    if (p.assembly > 0.65) {
      c.fillStyle = color;
      c.fillRect(-11, -12, 22, 2);
    }
    wear(c, p, inactive);
  }
  c.restore();
  for (const t of p.tools) tool(c, t, color, inactive, s.kind === 'fabricator');
  if (p.barrel) {
    const b = p.barrel;
    c.save();
    c.translate(b.origin.x, b.origin.y);
    c.rotate(b.angle);
    c.fillStyle = inactive ? '#4b6256' : color;
    c.fillRect(0, -3, b.length, 6);
    c.fillStyle = dark;
    c.fillRect(2 - b.recoil * 2, -6, 11, 12);
    c.fillStyle = '#8d9e80';
    c.fillRect(3 - b.recoil * 2, -5, 8, 1.5);
    if (b.length > 18) line(c, { x: 15, y: -2 }, { x: b.length - 3, y: -2 }, '#c7b38b', 0.8);
    c.fillStyle = inactive ? '#62725c' : '#aab38d';
    c.fillRect(Math.max(0, b.length - 3), -2, 1, 4);
    for (const x of [16, 20])
      if (x < b.length - 4) line(c, { x, y: -1 }, { x, y: 1 }, '#5a6451', 0.7);
    dot(c, { x: 0, y: 0 }, 4, '#587263');
    dot(c, { x: 0, y: 0 }, 2, inactive ? '#4e6254' : lamp);
    c.restore();
  }
  c.restore();
}
