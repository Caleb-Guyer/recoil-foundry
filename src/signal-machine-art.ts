import type { MachineBodySnapshot } from './machine-breakdown-pose.ts';
import { signalMachinePose, type SignalMachinePose } from './signal-machine-pose.ts';
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
function wear(c: CanvasRenderingContext2D, p: SignalMachinePose, inactive: boolean) {
  if (!p.wear) return;
  line(c, { x: -12, y: 2 }, { x: -7, y: 5 }, '#1a2330', 2.2);
  line(c, { x: -7, y: 5 }, { x: -10, y: 9 }, '#1a2330', 2);
  line(c, { x: -11, y: 1 }, { x: -7, y: 4 }, '#bdb092', 0.7);
  line(c, { x: 8, y: -12 }, { x: 12, y: -8 }, '#1a2330', 1.8);
  if (p.wear < 2) return;
  plate(
    c,
    [
      { x: 5, y: 0 },
      { x: 12, y: -1 },
      { x: 11, y: 8 },
      { x: 4, y: 7 },
    ],
    '#16222d',
    '#7f7f85',
  );
  for (let i = 0; i < 3; i++)
    line(
      c,
      { x: 6, y: 2 + i * 1.8 },
      { x: 9, y: 1 + i * 1.8 },
      inactive ? '#666b74' : '#c2ae91',
      1,
    );
}
/** Captive signal hardware only. Record ground marks, Annex links, remote port and
 * projectiles stay in their native passes. Horn/antenna/legs/receiver geometry is
 * world-aligned relative to the real body center; only the armor tilts with p.angle.
 */
export function drawSignalChassis(
  c: CanvasRenderingContext2D,
  s: MachineBodySnapshot,
  reduced = false,
  p: SignalMachinePose = signalMachinePose(s, reduced),
) {
  const inactive = p.energy <= 0,
    dark = '#1b2330',
    metal = inactive ? '#73767d' : '#b7b9ac',
    edge = inactive ? '#686c77' : s.allied ? '#8bbce4' : '#a79a96',
    shell = s.allied ? '#304d66' : s.kind === 'caller' ? '#4b4753' : '#474a5b',
    accent = inactive ? '#6b727e' : s.allied ? '#79bdff' : '#ed8c75',
    lamp = inactive ? '#505a68' : p.recover ? '#b2c4b0' : accent;
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  for (const leg of p.legs) {
    line(c, leg.hip, leg.knee, dark, 5.5);
    line(c, leg.knee, leg.foot, dark, 5);
    line(c, leg.hip, leg.knee, '#808b8c', 2.8);
    line(c, leg.knee, leg.foot, metal, 2.4);
    dot(c, leg.knee, 2.5, dark);
    dot(c, leg.knee, 1.2, metal);
    line(
      c,
      { x: leg.foot.x - 3.2, y: leg.foot.y },
      { x: leg.foot.x + 3.2, y: leg.foot.y },
      dark,
      4,
    );
    line(
      c,
      { x: leg.foot.x - 2.5, y: leg.foot.y - 1 },
      { x: leg.foot.x + 2.5, y: leg.foot.y - 1 },
      leg.planted && !inactive ? accent : '#727d80',
      1.5,
    );
  }
  if (s.kind === 'caller' && p.slots.length) {
    for (const side of [-1, 1]) {
      const slot = side < 0 ? p.slots[0] : p.slots.at(-1)!,
        top = { x: slot.point.x + side * 3, y: slot.point.y + 4 },
        base = { x: p.gimbal.center.x + side * 5, y: p.gimbal.center.y + 5 };
      line(c, base, top, dark, 4.8);
      line(c, base, top, metal, 2);
      dot(c, top, 1.5, accent);
    }
  }
  c.save();
  c.translate(p.body.x, p.body.y);
  c.rotate(p.angle);
  if (s.kind === 'caller') {
    plate(
      c,
      [
        { x: -10, y: 11 },
        { x: -10, y: 0 },
        { x: -7, y: -8 },
        { x: 7, y: -8 },
        { x: 10, y: 0 },
        { x: 10, y: 11 },
      ],
      shell,
      edge,
    );
    c.fillStyle = '#2b3040';
    c.fillRect(-7, 0, 14, 10);
    c.strokeStyle = metal;
    c.lineWidth = 0.8;
    c.strokeRect(-7, 0, 14, 10);
    for (const y of [2, 5, 8]) line(c, { x: -4, y }, { x: 4, y }, '#8e9290', 1);
    c.fillStyle = '#48505c';
    c.fillRect(-13, 11, 26, 3);
    line(c, { x: -12, y: 14 }, { x: 12, y: 14 }, metal, 1.2);
    for (const side of [-1, 1]) {
      dot(c, { x: side * 9, y: 12.5 }, 1.1, accent);
      line(c, { x: side * 7, y: 2 }, { x: side * 11, y: 11 }, '#c2ad8c', 1.2);
    }
  } else {
    plate(
      c,
      [
        { x: -17, y: 10 },
        { x: -17, y: -9 },
        { x: -11, y: -18 },
        { x: 10, y: -18 },
        { x: 17, y: -10 },
        { x: 17, y: 10 },
      ],
      shell,
      edge,
    );
    c.fillStyle = '#262d3d';
    c.fillRect(-13, -11, 26, 18);
    c.strokeStyle = '#818894';
    c.lineWidth = 0.8;
    c.strokeRect(-13, -11, 26, 18);
    c.fillStyle = lamp;
    c.fillRect(-10, -8, 9, 3);
    c.fillStyle = inactive ? '#626a79' : '#a6a29b';
    c.fillRect(3, -8, 7, 3);
    // Radio coils are real transmission indicators, separate from the hand receiver.
    for (let i = 0; i < 3; i++) {
      const y = -1 + i * 3.1;
      line(c, { x: -11, y }, { x: 11, y }, dark, 2.7);
      line(
        c,
        { x: -10, y: y - 0.4 },
        { x: -10 + 20 * p.radio.charge, y: y - 0.4 },
        inactive ? '#626b79' : p.radio.locked ? '#e8c696' : accent,
        1.4,
      );
      line(c, { x: -10, y: y + 1 }, { x: 9, y: y + 1 }, '#717786', 0.6);
    }
    line(c, { x: -13, y: 10 }, { x: 13, y: 10 }, metal, 1.2);
    if (p.radio.feedback > 0) {
      line(c, { x: -12, y: -12 }, { x: -6, y: -12 - p.radio.feedback * 2.5 }, metal, 1.7);
      line(c, { x: -6, y: -12 - p.radio.feedback * 2.5 }, { x: -3, y: -9 }, '#e6bd88', 1.5);
    }
  }
  wear(c, p, inactive);
  c.restore();
  const g = p.gimbal;
  dot(c, g.center, 6.5, dark);
  dot(c, g.center, 4.7, '#7f9291');
  for (let i = 0; i < 4; i++) {
    const a = g.angle + (i * Math.PI) / 2;
    line(
      c,
      { x: g.center.x + Math.cos(a) * 3.2, y: g.center.y + Math.sin(a) * 3.2 },
      { x: g.center.x + Math.cos(a) * 5.1, y: g.center.y + Math.sin(a) * 5.1 },
      metal,
      1,
    );
  }
  dot(c, g.center, 2.2, accent);
  if (s.kind === 'caller') {
    const h = p.horn,
      dx = h.lip.x - h.throat.x,
      dy = h.lip.y - h.throat.y,
      length = Math.max(10, Math.hypot(dx, dy));
    line(c, g.center, h.throat, dark, 7);
    line(c, g.center, h.throat, metal, 3);
    c.save();
    c.translate(h.lip.x, h.lip.y);
    c.rotate(h.angle);
    plate(
      c,
      [
        { x: -length, y: -5.8 },
        { x: -1, y: -13 },
        { x: -1, y: 13 },
        { x: -length, y: 5.8 },
      ],
      shell,
      edge,
    );
    line(c, { x: -length + 2, y: -4 }, { x: -3, y: -10 }, metal, 1.4);
    line(c, { x: -length + 2, y: 4 }, { x: -3, y: 10 }, metal, 1.4);
    // Persistent casing wear belongs on the physical horn as well as its small pedestal.
    if (p.wear) {
      line(c, { x: -length * 0.62, y: 2 }, { x: -length * 0.43, y: 4 }, dark, 2.1);
      line(c, { x: -length * 0.43, y: 4 }, { x: -length * 0.5, y: 7 }, dark, 1.8);
      line(c, { x: -length * 0.61, y: 1 }, { x: -length * 0.45, y: 3 }, '#c1ad92', 0.65);
      if (p.wear > 1) {
        plate(
          c,
          [
            { x: -length * 0.58, y: -6 },
            { x: -length * 0.36, y: -7 },
            { x: -length * 0.34, y: -1 },
            { x: -length * 0.55, y: 0 },
          ],
          dark,
          '#848b8e',
        );
        for (let i = 0; i < 3; i++)
          line(
            c,
            { x: -length * 0.53 + i * 1.7, y: -4.5 },
            { x: -length * 0.5 + i * 1.7, y: -1.4 },
            inactive ? '#626f79' : '#a99d91',
            0.8,
          );
      }
    }
    c.fillStyle = dark;
    c.beginPath();
    c.ellipse(-1, 0, 2.4, 12.4, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = metal;
    c.lineWidth = 1.6;
    c.stroke();
    c.fillStyle = inactive ? '#65727c' : accent;
    c.beginPath();
    c.ellipse(-3 - h.diaphragm * 2.6, 0, 1.8, 8.5, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#394958';
    c.fillRect(-length + 1 - h.diaphragm * 2, -7, 7, 14);
    line(
      c,
      { x: -length + 2 - h.diaphragm * 2, y: -5.8 },
      { x: -length + 6 - h.diaphragm * 2, y: -5.8 },
      metal,
      1.1,
    );
    c.restore();
    if (p.cancellation > 0)
      line(
        c,
        { x: g.center.x - 5, y: g.center.y + 5 },
        { x: g.center.x - 9 - p.cancellation * 2, y: g.center.y + 2 },
        metal,
        1.5,
      );
    // Three captive mechanical record slots use only the native recorded/next flags.
    if (p.slots.length) {
      line(
        c,
        { x: p.slots[0].point.x - 4, y: p.slots[0].point.y + 4 },
        { x: p.slots.at(-1)!.point.x + 4, y: p.slots.at(-1)!.point.y + 4 },
        dark,
        5,
      );
    }
    for (const slot of p.slots) {
      const point = slot.point;
      c.fillStyle = '#343447';
      c.fillRect(point.x - 3.3, point.y - 4.5, 6.6, 8.5);
      c.strokeStyle = edge;
      c.lineWidth = 0.75;
      c.strokeRect(point.x - 3.3, point.y - 4.5, 6.6, 8.5);
      dot(c, { x: point.x, y: point.y - 2.2 }, 1.1, metal);
      c.fillStyle = inactive
        ? '#5e6874'
        : slot.pending
          ? accent
          : slot.recorded
            ? '#8b8c88'
            : '#303b4a';
      c.fillRect(point.x - 1.8, point.y - 0.5, 3.6, 3.2);
      if (slot.selected && !inactive)
        line(
          c,
          { x: point.x - 2.3, y: point.y + 4.2 },
          { x: point.x + 2.3, y: point.y + 4.2 },
          '#e8d1a7',
          1.3,
        );
    }
  } else {
    const b = p.barrel,
      hinge = {
        x: b.origin.x - Math.cos(b.angle) * b.length,
        y: b.origin.y - Math.sin(b.angle) * b.length,
      };
    line(c, g.center, hinge, dark, 6);
    line(c, g.center, hinge, metal, 2.5);
    c.save();
    c.translate(b.origin.x, b.origin.y);
    c.rotate(b.angle);
    c.fillStyle = dark;
    c.fillRect(-b.length, -4, b.length, 8);
    c.fillStyle = inactive ? '#76818a' : accent;
    c.fillRect(-b.length + 2, -2.8, Math.max(0, b.length - 3), 5.6);
    c.fillStyle = '#415568';
    c.fillRect(-b.length + 3 - b.recoil * 2.5, -5.5, 8, 11);
    line(
      c,
      { x: -b.length + 4 - b.recoil * 2.5, y: -4.5 },
      { x: -b.length + 9 - b.recoil * 2.5, y: -4.5 },
      metal,
      1.1,
    );
    c.fillStyle = metal;
    c.fillRect(-2, -2.5, 2, 5);
    for (const x of [-15, -10, -5]) line(c, { x, y: -1.5 }, { x, y: 1.5 }, '#54546a', 0.8);
    c.restore();
    const a = p.antenna;
    line(c, a.base, a.tip, dark, 4.5);
    line(c, a.base, a.tip, metal, 1.8);
    dot(c, a.base, 3, dark);
    dot(c, a.base, 1.5, metal);
    dot(c, a.tip, 3.2, dark);
    dot(c, a.tip, 1.8, inactive ? '#66717b' : a.locked ? '#e8c696' : accent);
    const arm = { x: a.base.x + Math.cos(a.angle) * 6, y: a.base.y + Math.sin(a.angle) * 6 };
    line(c, a.base, arm, metal, 1.4);
    for (let i = 0; i < 3; i++) {
      const t = 0.25 + i * 0.2,
        x = a.base.x + (a.tip.x - a.base.x) * t,
        y = a.base.y + (a.tip.y - a.base.y) * t;
      line(
        c,
        { x: x - 2.2, y },
        { x: x + 2.2, y },
        inactive ? '#65717c' : i / 3 < a.charge ? accent : '#919997',
        1.4,
      );
    }
    if (a.release > 0 && !inactive) {
      line(
        c,
        { x: a.tip.x - 4, y: a.tip.y - 2 },
        { x: a.tip.x + 4, y: a.tip.y - 2 },
        '#e9c9a0',
        1.2,
      );
    }
    if (a.feedback > 0 && !inactive) {
      line(
        c,
        { x: a.base.x - 4, y: a.base.y - 2 },
        { x: a.base.x - 6, y: a.base.y + 3 },
        '#e4b880',
        1.7,
      );
    }
  }
  c.restore();
}
