import type { MachineBodySnapshot } from './machine-breakdown-pose.ts';
import { surfaceMachinePose, type SurfaceMachinePose } from './surface-machine-pose.ts';
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
function wear(c: CanvasRenderingContext2D, p: SurfaceMachinePose, inactive: boolean) {
  if (!p.wear) return;
  line(c, { x: -11, y: -10 }, { x: -5, y: -6 }, '#172a30', 2.4);
  line(c, { x: -5, y: -6 }, { x: -7, y: -1 }, '#172a30', 2.2);
  line(c, { x: -10, y: -11 }, { x: -5, y: -7 }, '#b7b59b', 0.7);
  // Lower casing and rear shoulder stay legible when the real gimbal covers a front scar.
  line(c, { x: -12, y: 4 }, { x: -7, y: 6 }, '#172a30', 2.1);
  line(c, { x: -7, y: 6 }, { x: -10, y: 9 }, '#172a30', 1.8);
  line(c, { x: -12, y: 3 }, { x: -8, y: 5 }, '#c0ad88', 0.7);
  line(c, { x: 8, y: -12 }, { x: 11, y: -8 }, '#172a30', 1.7);
  if (p.wear < 2) return;
  plate(
    c,
    [
      { x: 5, y: 1 },
      { x: 12, y: 0 },
      { x: 10, y: 8 },
      { x: 4, y: 7 },
    ],
    '#16272d',
    '#7f8777',
  );
  for (let i = 0; i < 3; i++)
    line(
      c,
      { x: 6, y: 2 + i * 1.7 },
      { x: 9, y: 1 + i * 1.7 },
      inactive ? '#5e7266' : '#b8ad86',
      1,
    );
  line(c, { x: -11, y: 5 }, { x: -6, y: 8 }, '#bd9674', 1.2);
}
/** One captured physical rig. Contact legs/pads and gun tips are world-aligned relative
 * to the native hull center; only armor/shutters use the intrinsic mount rotation.
 * No bank surface, aim path, queued shot, projectile or extra body is painted here.
 */
export function drawSurfaceChassis(
  c: CanvasRenderingContext2D,
  s: MachineBodySnapshot,
  reduced = false,
  p: SurfaceMachinePose = surfaceMachinePose(s, reduced),
) {
  const inactive = p.energy <= 0,
    dark = '#182d33',
    metal = inactive ? '#64776e' : '#b6b99f',
    edge = inactive ? '#60776d' : s.allied ? '#8bb5c3' : '#b3977c',
    shell = s.allied ? '#315361' : s.kind === 'angler' ? '#46595a' : '#42575b',
    accent = inactive ? '#62796c' : s.allied ? '#92c6db' : '#d5a180',
    exposed = !inactive && p.exposure > 0,
    lamp = inactive ? '#4a635b' : exposed ? '#f1cb8c' : p.recover ? '#a6b29a' : '#d8856d';
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  // Every joint is already projected from the actual support face. Never rotate
  // these coordinates again with the armor: doing so would float feet off walls.
  for (const leg of p.legs) {
    line(c, leg.hip, leg.knee, dark, 5.8);
    line(c, leg.knee, leg.foot, dark, 5.2);
    line(c, leg.hip, leg.knee, '#7d9384', 3);
    line(c, leg.knee, leg.foot, metal, 2.5);
    const piston = {
      x: leg.hip.x + (leg.knee.x - leg.hip.x) * 0.65,
      y: leg.hip.y + (leg.knee.y - leg.hip.y) * 0.65,
    };
    line(c, { x: leg.hip.x + 1.8, y: leg.hip.y }, piston, '#b5a77f', 1);
    dot(c, leg.knee, 2.8, dark);
    dot(c, leg.knee, 1.3, metal);
  }
  for (const pad of p.pads) {
    const n = pad.normal,
      t = { x: -n.y, y: n.x },
      a = { x: pad.point.x - t.x * 3.5, y: pad.point.y - t.y * 3.5 },
      b = { x: pad.point.x + t.x * 3.5, y: pad.point.y + t.y * 3.5 };
    line(c, a, b, dark, 4);
    line(c, a, b, pad.planted && !inactive ? '#bdc2a0' : '#7b8c79', 2);
    for (const side of [-1, 1])
      line(
        c,
        { x: pad.point.x + t.x * side * 3.5, y: pad.point.y + t.y * side * 3.5 },
        {
          x: pad.point.x + t.x * side * 3.5 + n.x * 2,
          y: pad.point.y + t.y * side * 3.5 + n.y * 2,
        },
        accent,
        1.4,
      );
    if (pad.planted && !inactive)
      dot(c, { x: pad.point.x + n.x * 1.4, y: pad.point.y + n.y * 1.4 }, 0.8, '#c8d0ac');
  }
  c.save();
  c.translate(p.body.x, p.body.y);
  c.rotate(p.angle);
  if (s.kind === 'angler') {
    plate(
      c,
      [
        { x: -14, y: 9 },
        { x: -14, y: -8 },
        { x: -5, y: -18 },
        { x: 11, y: -13 },
        { x: 15, y: -4 },
        { x: 14, y: 9 },
      ],
      shell,
      edge,
    );
    plate(
      c,
      [
        { x: -12, y: -7 },
        { x: -8, y: -19 },
        { x: 2, y: -20 },
        { x: 8, y: -12 },
      ],
      '#667975',
      metal,
    );
    c.fillStyle = dark;
    c.fillRect(-7, -15, 12, 6);
    c.fillStyle = accent;
    c.fillRect(-4, -13, 6, 2);
    c.fillStyle = '#243b3d';
    c.fillRect(-9, -5, 18, 13);
    c.strokeStyle = '#849789';
    c.lineWidth = 0.8;
    c.strokeRect(-9, -5, 18, 13);
    c.fillStyle = lamp;
    c.fillRect(-5, -3, 10, 10);
    for (let x = -3; x <= 3; x += 3)
      line(c, { x, y: 0 }, { x, y: 5 }, exposed ? '#79543c' : '#503a36', 0.8);
    for (const side of [-1, 1]) {
      c.fillStyle = '#536d62';
      c.fillRect(side < 0 ? -15 : 10, -1, 5, 9);
      line(c, { x: side * 12, y: 1 }, { x: side * 12, y: 6 }, metal, 1);
    }
    line(c, { x: -9, y: 10 }, { x: 10, y: 10 }, '#b9ab86', 1.5);
  } else {
    plate(
      c,
      [
        { x: -13, y: -8 },
        { x: -7, y: -15 },
        { x: 8, y: -13 },
        { x: 14, y: -3 },
        { x: 13, y: 8 },
        { x: 6, y: 13 },
        { x: -9, y: 11 },
        { x: -14, y: 3 },
      ],
      shell,
      edge,
    );
    for (const side of [-1, 1]) {
      plate(
        c,
        [
          { x: side * 7, y: -10 },
          { x: side * 12, y: -5 },
          { x: side * 10, y: 7 },
          { x: side * 5, y: 9 },
        ],
        '#688379',
        metal,
      );
      dot(c, { x: side * 9, y: -4 }, 1.2, accent);
      line(c, { x: side * 7, y: 0 }, { x: side * 9, y: 4 }, dark, 1.1);
    }
    c.fillStyle = dark;
    c.fillRect(-6, -7, 12, 14);
    c.fillStyle = lamp;
    c.fillRect(-4, -5, 8, 10);
    if (exposed) {
      line(c, { x: 0, y: -6 }, { x: 0, y: 7 }, '#5e4335', 2);
      line(c, { x: -3, y: 3 }, { x: 3, y: 3 }, '#f3d7a0', 1);
    } else {
      c.fillStyle = '#455c53';
      c.fillRect(-4, -5, 3, 10);
      c.fillRect(1, -5, 3, 10);
    }
    line(c, { x: -6, y: -12 }, { x: 5, y: -11 }, '#a8b095', 1);
  }
  // Leaf endpoints are body-local final coordinates from native exposure state.
  for (const leaf of p.shutters) {
    line(c, leaf.from, leaf.to, dark, 5.2);
    line(c, leaf.from, leaf.to, metal, 3.2);
  }
  wear(c, p, inactive);
  c.restore();
  const b = p.barrel,
    hinge = {
      x: b.origin.x - Math.cos(b.angle) * b.length,
      y: b.origin.y - Math.sin(b.angle) * b.length,
    };
  line(c, p.gimbal.center, hinge, dark, 6);
  line(c, p.gimbal.center, hinge, metal, 2.5);
  dot(c, p.gimbal.center, 6.6, dark);
  dot(c, p.gimbal.center, 4.9, '#728c7e');
  for (let i = 0; i < 4; i++) {
    const a = p.gimbal.angle + (i * Math.PI) / 2;
    line(
      c,
      { x: p.gimbal.center.x + Math.cos(a) * 3.3, y: p.gimbal.center.y + Math.sin(a) * 3.3 },
      { x: p.gimbal.center.x + Math.cos(a) * 5.2, y: p.gimbal.center.y + Math.sin(a) * 5.2 },
      metal,
      1.1,
    );
  }
  dot(c, p.gimbal.center, 2.3, inactive ? '#5d7568' : accent);
  c.save();
  c.translate(b.origin.x, b.origin.y);
  c.rotate(b.angle);
  c.fillStyle = dark;
  c.fillRect(-b.length, -4, b.length, 8);
  c.fillStyle = s.kind === 'angler' ? '#a9b4a0' : '#a18e76';
  c.fillRect(-b.length + 2, -2.7, Math.max(0, b.length - 3), 5.4);
  c.fillStyle = '#415b53';
  c.fillRect(-b.length + 3 - b.recoil * 2.8, -5.5, 8, 11);
  line(
    c,
    { x: -b.length + 4 - b.recoil * 2.8, y: -4.5 },
    { x: -b.length + 9 - b.recoil * 2.8, y: -4.5 },
    metal,
    1.2,
  );
  for (const side of [-1, 1]) {
    line(c, { x: -11, y: side * 4.8 }, { x: -3, y: side * 4.8 }, metal, 1.3);
    line(c, { x: -3, y: side * 4.8 }, { x: -1, y: side * 2.5 }, accent, 1.2);
  }
  c.fillStyle = inactive ? '#6c7c6c' : '#d6c7a4';
  c.fillRect(-2, -2.5, 2, 5);
  for (const x of [-17, -13, -9])
    if (-x < b.length) line(c, { x, y: -1.8 }, { x, y: 1.8 }, '#4b6559', 0.8);
  c.restore();
  c.restore();
}
