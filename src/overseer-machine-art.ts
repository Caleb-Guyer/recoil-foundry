import type { MachineBodySnapshot } from './machine-breakdown-pose.ts';
import { overseerMachinePose, type OverseerMachinePose } from './overseer-machine-pose.ts';
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
function plate(
  c: CanvasRenderingContext2D,
  points: Vec[],
  fill: string,
  edge: string,
  width = 1.3,
) {
  c.beginPath();
  points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  c.strokeStyle = edge;
  c.lineWidth = width;
  c.stroke();
}
function hydraulic(c: CanvasRenderingContext2D, a: Vec, b: Vec, metal: string, width = 3) {
  const shoulder = { x: a.x + (b.x - a.x) * 0.58, y: a.y + (b.y - a.y) * 0.58 };
  line(c, a, b, '#17282e', width + 3.5);
  line(c, a, shoulder, '#607676', width + 1.5);
  line(c, shoulder, b, metal, width);
  dot(c, a, width * 0.8, '#17282e');
  dot(c, a, width * 0.38, metal);
  dot(c, b, width * 0.7, '#17282e');
  dot(c, b, width * 0.3, metal);
}
function casingWear(c: CanvasRenderingContext2D, p: OverseerMachinePose, inactive: boolean) {
  if (!p.wear) return;
  line(c, { x: -17, y: -8 }, { x: -9, y: -4 }, '#14272c', 3);
  line(c, { x: -9, y: -4 }, { x: -13, y: 2 }, '#14272c', 2.8);
  line(c, { x: -13, y: 2 }, { x: -7, y: 7 }, '#14272c', 2.5);
  line(c, { x: -17, y: -9 }, { x: -10, y: -5 }, '#bfb69b', 0.85);
  line(c, { x: 12, y: -17 }, { x: 19, y: -12 }, '#18282c', 2.5);
  if (p.wear < 2) return;
  plate(
    c,
    [
      { x: 7, y: 2 },
      { x: 19, y: 0 },
      { x: 18, y: 13 },
      { x: 6, y: 12 },
    ],
    '#14292f',
    '#788d84',
    0.9,
  );
  for (let i = 0; i < 4; i++)
    line(
      c,
      { x: 9 + i * 2.1, y: 4 },
      { x: 8 + i * 2.1, y: 10 },
      inactive ? '#526b6a' : '#b5aa88',
      1,
    );
  line(c, { x: -20, y: 14 }, { x: -11, y: 12 }, '#b1a084', 1.2);
}

function caseMark(c: CanvasRenderingContext2D, at: Vec, color: string, inactive: boolean) {
  c.strokeStyle = color;
  c.lineWidth = 1;
  c.strokeRect(at.x - 8, at.y - 6, 16, 12);
  c.fillStyle = inactive ? '#586d70' : color;
  c.fillRect(at.x - 5, at.y - 3.5, 2.7, 7);
  c.fillRect(at.x - 0.5, at.y - 3.5, 1.6, 7);
  c.fillRect(at.x + 4, at.y - 3.5, 1.5, 7);
}
/** Captive Overseer machinery. Native seam/barrier/port/junction/recall world
 * passes retain their existing warnings and authority. No emitter or physics
 * object is created, and defeated hardware cannot replay an attack or recall.
 */
export function drawOverseerChassis(
  c: CanvasRenderingContext2D,
  s: MachineBodySnapshot,
  reduced = false,
  p: OverseerMachinePose = overseerMachinePose(s, reduced),
) {
  const inactive = p.energy <= 0,
    dark = '#17262c',
    metal = inactive ? '#6b7775' : '#bac2ae',
    edge = inactive
      ? '#697774'
      : s.kind === 'welder'
        ? '#b19b7d'
        : s.kind === 'switchboard'
          ? '#ae8fa9'
          : '#c0a581',
    shell = s.kind === 'welder' ? '#615340' : s.kind === 'switchboard' ? '#46384f' : '#3d504d',
    accent = inactive
      ? '#536b6a'
      : s.kind === 'welder'
        ? '#e6b478'
        : s.kind === 'switchboard'
          ? '#e39186'
          : '#d4b384',
    lamp = inactive ? '#40595a' : p.recover ? '#c6cba0' : accent,
    f = p.forward;
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  if (s.kind === 'welder') {
    const tracks = p.tracks;
    if (tracks.length) {
      const left = Math.min(...tracks.map((t) => t.center.x)) - 8,
        right = Math.max(...tracks.map((t) => t.center.x)) + 8,
        y = tracks[0].center.y;
      c.fillStyle = dark;
      c.fillRect(left, y - 8, right - left, 16);
      c.strokeStyle = inactive ? '#5d706e' : '#a39779';
      c.lineWidth = 1.4;
      c.strokeRect(left + 1, y - 7, right - left - 2, 14);
      for (const t of tracks) {
        dot(c, t.center, 6, '#51645d');
        dot(c, t.center, 3.9, metal);
        dot(c, t.center, 1.8, dark);
        const a = t.phase;
        line(
          c,
          { x: t.center.x - Math.cos(a) * 3, y: t.center.y - Math.sin(a) * 3 },
          { x: t.center.x + Math.cos(a) * 3, y: t.center.y + Math.sin(a) * 3 },
          dark,
          1.6,
        );
      }
      const phase = ((tracks[0].phase % 7) + 7) % 7;
      for (let x = left + 1 + phase; x < right - 2; x += 7) {
        line(c, { x, y: y - 7 }, { x: x + 2.5, y: y - 7 }, metal, 1.1);
        line(c, { x, y: y + 7 }, { x: x + 2.5, y: y + 7 }, '#718575', 1.1);
      }
    }
  } else {
    for (const leg of p.legs) {
      line(c, leg.hip, leg.knee, dark, 7);
      line(c, leg.knee, leg.foot, dark, 6.5);
      line(c, leg.hip, leg.knee, '#768a7d', 3.7);
      line(c, leg.knee, leg.foot, metal, 2.8);
      dot(c, leg.knee, 3.2, dark);
      dot(c, leg.knee, 1.6, metal);
      line(c, { x: leg.foot.x - 5, y: leg.foot.y }, { x: leg.foot.x + 5, y: leg.foot.y }, dark, 5);
      line(
        c,
        { x: leg.foot.x - 4, y: leg.foot.y - 1 },
        { x: leg.foot.x + 4, y: leg.foot.y - 1 },
        leg.planted ? accent : '#78877c',
        1.8,
      );
    }
  }
  c.save();
  c.translate(p.body.x, p.body.y);
  c.rotate(p.angle);
  if (s.kind === 'welder') {
    // Twin gas bottles are captive to the tracked frame, with a real hose route.
    for (const x of [-f * 25, -f * 15]) {
      c.fillStyle = '#384744';
      c.fillRect(x - 4.5, -33, 9, 47);
      c.strokeStyle = edge;
      c.lineWidth = 1.2;
      c.strokeRect(x - 4.5, -33, 9, 47);
      line(c, { x: x - 2, y: -36 }, { x: x + 2, y: -36 }, metal, 2);
      line(c, { x, y: -33 }, { x, y: -38 }, metal, 1.3);
      for (const y of [-20, 4]) line(c, { x: x - 4.5, y }, { x: x + 4.5, y }, '#778878', 1.2);
    }
    plate(
      c,
      [
        { x: -20, y: -17 },
        { x: -10, y: -25 },
        { x: 19, y: -22 },
        { x: 25, y: -10 },
        { x: 22, y: 16 },
        { x: -20, y: 16 },
      ],
      shell,
      edge,
    );
    plate(
      c,
      [
        { x: -11, y: -24 },
        { x: -7, y: -31 },
        { x: 19, y: -30 },
        { x: 25, y: -23 },
        { x: 22, y: -11 },
        { x: -10, y: -12 },
      ],
      '#293b3e',
      edge,
    );
    c.fillStyle = lamp;
    c.fillRect(f > 0 ? 6 : -17, -25, 11, 3.5);
    c.fillStyle = dark;
    c.fillRect(-12, -4, 27, 16);
    const opening = p.torch.opening;
    for (const side of [-1, 1]) {
      const x = side * (3 + opening * 7);
      line(c, { x, y: -3 }, { x, y: 11 }, inactive ? '#6c7770' : '#b39b7b', 3.5);
    }
    if (opening > 0 && !inactive) {
      c.fillStyle = '#dcbb85';
      c.fillRect(-2, -1, 7, 10);
      for (const y of [1, 5, 9]) line(c, { x: -1, y }, { x: 4, y }, dark, 1);
    }
    line(c, { x: -23, y: 16 }, { x: 24, y: 16 }, metal, 2.2);
  } else if (s.kind === 'switchboard') {
    plate(
      c,
      [
        { x: -42, y: -23 },
        { x: -28, y: -35 },
        { x: 27, y: -35 },
        { x: 42, y: -23 },
        { x: 42, y: 22 },
        { x: 27, y: 35 },
        { x: -27, y: 35 },
        { x: -42, y: 22 },
      ],
      shell,
      edge,
      1.6,
    );
    plate(
      c,
      [
        { x: -32, y: -22 },
        { x: 32, y: -22 },
        { x: 32, y: 22 },
        { x: -32, y: 22 },
      ],
      '#292d3c',
      '#7a6f85',
    );
    for (const side of [-1, 1]) {
      hydraulic(c, { x: side * 30, y: -27 }, { x: side * 30, y: -47 }, metal, 1.8);
      line(c, { x: side * 30, y: -47 }, { x: side * 12, y: -47 }, metal, 2);
      dot(c, { x: side * 12, y: -47 }, 2, accent);
    }
    line(c, { x: -29, y: 22 }, { x: 29, y: 22 }, metal, 1.8);
    // Relay sockets are attached to the same physical cabinet. Actual remote
    // port barrels remain drawn once by drawSwitchboardArena.
    for (const x of [-22, 0, 22]) {
      line(c, { x, y: 14 }, { x, y: 27 }, dark, 4);
      line(c, { x, y: 14 }, { x, y: 27 }, metal, 1.2);
    }
    for (const side of [-1, 1]) {
      c.fillStyle = '#746477';
      c.fillRect(side < 0 ? -38 : 32, -15, 6, 32);
      for (const y of [-11, -5, 1, 7, 13])
        line(c, { x: side < 0 ? -37 : 33, y }, { x: side < 0 ? -33 : 37, y }, dark, 1.1);
    }
  } else {
    plate(
      c,
      [
        { x: -20, y: -22 },
        { x: -13, y: -29 },
        { x: 13, y: -29 },
        { x: 20, y: -21 },
        { x: 18, y: 17 },
        { x: 10, y: 23 },
        { x: -13, y: 22 },
        { x: -20, y: 14 },
      ],
      shell,
      edge,
    );
    plate(
      c,
      [
        { x: -14, y: -24 },
        { x: 14, y: -24 },
        { x: 14, y: -13 },
        { x: -14, y: -13 },
      ],
      '#15282c',
      edge,
      1,
    );
    c.fillStyle = lamp;
    c.fillRect(-10, -21, 20, 3.5);
    for (const side of [-1, 1]) {
      const x = side * 18;
      hydraulic(c, { x, y: -9 }, { x: x + side * 4, y: 11 }, metal, 2);
      c.fillStyle = inactive ? '#637572' : '#a38b6e';
      c.fillRect(side < 0 ? -26 : 18, -13, 8, 24);
      line(c, { x: side * 21, y: -9 }, { x: side * 21, y: 7 }, dark, 1.4);
    }
    line(c, { x: -14, y: 18 }, { x: 14, y: 18 }, metal, 1.6);
  }
  casingWear(c, p, inactive);
  c.restore();
  if (s.kind === 'welder') {
    const a = p.torch;
    // Two connected links and a captured flexible hose follow the native tool tip.
    c.strokeStyle = dark;
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(p.body.x - f * 24, p.body.y - 24);
    c.quadraticCurveTo(p.body.x - f * 39, p.body.y + 20, a.elbow.x, a.elbow.y + 6);
    c.lineTo(a.tip.x, a.tip.y);
    c.stroke();
    c.strokeStyle = inactive ? '#5c7470' : '#839b8c';
    c.lineWidth = 2;
    c.stroke();
    hydraulic(c, a.shoulder, a.elbow, metal, 3.2);
    hydraulic(c, a.elbow, a.tip, metal, 2.4);
    dot(c, a.shoulder, 5, dark);
    dot(c, a.shoulder, 2.4, metal);
    dot(c, a.elbow, 3.7, dark);
    dot(c, a.elbow, 1.7, metal);
  }
  if (s.kind === 'switchboard') {
    for (const channel of p.channels) {
      const q = channel.point,
        charge = inactive ? 0 : channel.charge;
      c.fillStyle = '#1d2934';
      c.fillRect(q.x - 6.5, q.y - 13, 13, 28);
      c.strokeStyle = edge;
      c.lineWidth = 1;
      c.strokeRect(q.x - 6.5, q.y - 13, 13, 28);
      c.fillStyle = inactive ? '#526b6b' : channel.cut ? '#5b626d' : '#a98b8d';
      c.fillRect(q.x - 3.5, q.y + 9 - charge * 17, 7, 3 + charge * 17);
      dot(c, { x: q.x, y: q.y - 9 }, 1.8, metal);
      line(c, { x: q.x - 4, y: q.y + 12 }, { x: q.x + 4, y: q.y + 12 }, metal, 1.1);
      const kick = inactive ? 0 : channel.release * 3;
      line(
        c,
        { x: q.x - 5, y: q.y - 4 - kick },
        { x: q.x + 5, y: q.y - 4 - kick },
        channel.locked && !inactive ? '#e8c796' : metal,
        2.2,
      );
      if (channel.cut) {
        line(
          c,
          { x: q.x - 4, y: q.y - 6 },
          { x: q.x + 3, y: q.y + 5 },
          inactive ? '#697878' : '#c4a482',
          1.7,
        );
      } else if (channel.mobile && !inactive) {
        line(c, { x: q.x - 2, y: q.y + 3 }, { x: q.x, y: q.y }, accent, 1);
        line(c, { x: q.x, y: q.y }, { x: q.x + 2, y: q.y + 3 }, accent, 1);
      }
      if (channel.release > 0 && !inactive)
        line(c, { x: q.x - 3, y: q.y + 15 }, { x: q.x + 3, y: q.y + 15 }, '#e8c796', 1.5);
    }
  } else {
    const b = p.barrel,
      g = p.gimbal,
      hinge = {
        x: b.origin.x - Math.cos(b.angle) * b.length,
        y: b.origin.y - Math.sin(b.angle) * b.length,
      };
    if (s.kind === 'auditor') {
      hydraulic(c, { x: p.body.x - f * 9, y: p.body.y - 6 }, g.center, metal, 2.3);
      dot(c, g.center, 7.2, dark);
      dot(c, g.center, 4.8, '#849482');
    }
    line(c, g.center, hinge, dark, 6);
    line(c, g.center, hinge, metal, 2.5);
    c.save();
    c.translate(b.origin.x, b.origin.y);
    c.rotate(b.angle);
    c.fillStyle = dark;
    c.fillRect(-b.length, -4, b.length, 8);
    c.fillStyle = inactive ? '#677b75' : accent;
    c.fillRect(-b.length + 1.5, -2.7, Math.max(0, b.length - 3), 5.4);
    c.fillStyle = s.kind === 'welder' ? '#6f745c' : '#8c8065';
    c.fillRect(-b.length + 1 - b.recoil * 3.5, -6, 10, 12);
    line(
      c,
      { x: -b.length + 3 - b.recoil * 3.5, y: -4.6 },
      { x: -b.length + 8 - b.recoil * 3.5, y: -4.6 },
      metal,
      1.2,
    );
    c.fillStyle = metal;
    c.fillRect(-2, -2.7, 2, 5.4);
    if (s.kind === 'welder') {
      c.fillStyle = inactive ? '#4b6869' : p.torch.heat > 0 ? '#e6c49a' : '#6b8f87';
      c.fillRect(-4, -1.5, 2, 3);
    }
    c.restore();
  }
  if (s.kind === 'auditor') {
    const latch = p.caseLatch,
      q = latch.point,
      opening = inactive ? 0 : Number(latch.open);
    plate(
      c,
      [
        { x: q.x - 11, y: q.y - 9 },
        { x: q.x + 11, y: q.y - 9 },
        { x: q.x + 11, y: q.y + 9 },
        { x: q.x - 11, y: q.y + 9 },
      ],
      '#596250',
      edge,
      1,
    );
    caseMark(c, q, accent, inactive);
    line(c, { x: q.x - 10, y: q.y - 8 }, { x: q.x + 10, y: q.y - 8 }, metal, 1.5);
    for (const side of [-1, 1]) {
      const x = q.x + side * (7 + opening * 3);
      line(c, { x, y: q.y - 7 }, { x, y: q.y + 7 }, dark, 2.5);
    }
    if (latch.recall > 0 && !inactive) {
      const distance = 8 + latch.recall * 4;
      line(
        c,
        { x: q.x - distance, y: q.y - 12 },
        { x: q.x, y: q.y - 12 - latch.recall * 4 },
        metal,
        1.6,
      );
      line(
        c,
        { x: q.x, y: q.y - 12 - latch.recall * 4 },
        { x: q.x + distance, y: q.y - 12 },
        metal,
        1.6,
      );
    }
    for (const cell of p.magazine) {
      const a = cell.point;
      c.fillStyle = '#263b3d';
      c.fillRect(a.x - 2.4, a.y - 3.6, 4.8, 8);
      c.strokeStyle = '#82917f';
      c.lineWidth = 0.7;
      c.strokeRect(a.x - 2.4, a.y - 3.6, 4.8, 8);
      if (cell.loaded && !inactive) {
        c.fillStyle = cell.selected ? '#e6cca0' : '#b69973';
        c.fillRect(a.x - 1.4, a.y - 2.5, 2.8, 5.7);
      } else line(c, { x: a.x - 1.1, y: a.y - 1.5 }, { x: a.x + 1.1, y: a.y + 2 }, '#566d68', 0.8);
    }
  }
  if (p.interruption > 0 && !inactive) {
    const a = { x: p.body.x - f * 13, y: p.body.y - 19 };
    line(c, a, { x: a.x - f * (4 + p.interruption * 4), y: a.y - 4 }, metal, 1.9);
  }
  c.restore();
}
