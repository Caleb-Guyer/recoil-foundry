import type { MachineBodySnapshot } from './machine-breakdown-pose.ts';
import { contractMachinePose, type ContractMachinePose } from './contract-machine-pose.ts';
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
function casingWear(c: CanvasRenderingContext2D, p: ContractMachinePose, inactive: boolean) {
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

/** Captive hull machinery only. Real shield props, cable spans, mines and attack
 * warnings keep their existing world passes. All rig coordinates are body-relative
 * native projections; drawing cannot emit gear, advance a fuse or change armor.
 */
export function drawContractChassis(
  c: CanvasRenderingContext2D,
  s: MachineBodySnapshot,
  reduced = false,
  p: ContractMachinePose = contractMachinePose(s, reduced),
) {
  const inactive = p.energy <= 0,
    dark = '#172a30',
    metal = inactive ? '#60716f' : '#b8c5b5',
    edge = inactive
      ? '#5c7371'
      : s.allied
        ? '#89bdde'
        : s.kind === 'cableweaver'
          ? '#8ccac5'
          : s.kind === 'bulwark'
            ? '#a3bea7'
            : '#d9b18b',
    shell = s.allied
      ? '#2a4c60'
      : s.kind === 'cableweaver'
        ? '#35575f'
        : s.kind === 'bulwark'
          ? '#465d55'
          : '#7c5d47',
    accent = inactive
      ? '#526967'
      : s.allied
        ? '#7bbce7'
        : s.kind === 'cableweaver'
          ? '#87d4cc'
          : s.kind === 'bulwark'
            ? '#c1caaa'
            : '#e8b87e',
    lamp = inactive ? '#3c5557' : p.recover ? '#a4b7a1' : accent;
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  for (const leg of p.legs) {
    line(c, leg.hip, leg.knee, dark, 9);
    line(c, leg.knee, leg.foot, dark, 8);
    line(c, leg.hip, leg.knee, '#6a807c', 5);
    line(c, leg.knee, leg.foot, metal, 3.5);
    hydraulic(
      c,
      { x: leg.hip.x - p.forward * 2, y: leg.hip.y - 3 },
      { x: leg.knee.x - p.forward * 2, y: leg.knee.y - 1 },
      metal,
      2,
    );
    dot(c, leg.knee, 4.2, dark);
    dot(c, leg.knee, 2, metal);
    line(c, { x: leg.foot.x - 6, y: leg.foot.y }, { x: leg.foot.x + 6, y: leg.foot.y }, dark, 6);
    line(
      c,
      { x: leg.foot.x - 5, y: leg.foot.y - 1.5 },
      { x: leg.foot.x + 5, y: leg.foot.y - 1.5 },
      leg.planted ? accent : '#74867c',
      2,
    );
  }
  // A connected mast carries the native high Bulwark muzzle. Other launchers
  // attach directly to the shoulder deck, never to a guessed alternate origin.
  if (s.kind === 'bulwark') {
    hydraulic(c, p.mast.base, p.mast.tip, metal, 5);
    const dx = p.mast.tip.x - p.mast.base.x,
      dy = p.mast.tip.y - p.mast.base.y;
    for (const t of [0.25, 0.55, 0.8]) {
      const a = { x: p.mast.base.x + dx * t, y: p.mast.base.y + dy * t };
      line(c, { x: a.x - 6, y: a.y }, { x: a.x + 6, y: a.y }, dark, 4);
      line(c, { x: a.x - 5, y: a.y - 0.5 }, { x: a.x + 5, y: a.y - 0.5 }, '#8b9b8b', 1.5);
    }
  }
  c.save();
  c.translate(p.body.x, p.body.y);
  c.rotate(p.angle);
  if (s.kind === 'cableweaver') {
    plate(
      c,
      [
        { x: -29, y: -17 },
        { x: -18, y: -28 },
        { x: 15, y: -28 },
        { x: 29, y: -14 },
        { x: 25, y: 18 },
        { x: 12, y: 23 },
        { x: -20, y: 20 },
      ],
      shell,
      edge,
    );
    plate(
      c,
      [
        { x: -15, y: -17 },
        { x: 15, y: -17 },
        { x: 18, y: 9 },
        { x: 11, y: 15 },
        { x: -13, y: 14 },
      ],
      '#233f49',
      '#6c9795',
    );
    for (const side of [-1, 1]) {
      hydraulic(c, { x: side * 9, y: -12 }, { x: side * 25, y: 11 }, metal, 2.3);
      line(c, { x: side * 12, y: 14 }, { x: side * 29, y: 14 }, dark, 5);
    }
    c.fillStyle = lamp;
    c.fillRect(-7, -22, 14, 4);
    for (const y of [-10, -5, 0, 5]) line(c, { x: -6, y }, { x: 6, y }, '#7d9c98', 1.5);
  } else if (s.kind === 'bulwark') {
    plate(
      c,
      [
        { x: -32, y: -18 },
        { x: -20, y: -31 },
        { x: 19, y: -31 },
        { x: 32, y: -18 },
        { x: 30, y: 19 },
        { x: 16, y: 25 },
        { x: -20, y: 25 },
        { x: -32, y: 15 },
      ],
      shell,
      edge,
      1.8,
    );
    plate(
      c,
      [
        { x: -16, y: -20 },
        { x: 16, y: -20 },
        { x: 20, y: -10 },
        { x: 17, y: 17 },
        { x: -17, y: 17 },
        { x: -20, y: -10 },
      ],
      '#253e3d',
      '#7f9e8b',
    );
    // These are captive shoulder braces. Freestanding armor plates remain real
    // props and are deliberately not duplicated or tethered to the body artwork.
    for (const side of [-1, 1]) {
      const opening = p.shield.extension * 5;
      hydraulic(c, { x: side * 12, y: -15 }, { x: side * (25 + opening), y: 13 }, metal, 3);
      plate(
        c,
        [
          { x: side * 24 - 4, y: -20 },
          { x: side * 24 + 4, y: -20 },
          { x: side * 24 + 4, y: 16 },
          { x: side * 24 - 4, y: 16 },
        ],
        '#688376',
        edge,
      );
    }
    const shutter = p.shield.closed ? 7 : 13;
    dot(c, { x: 0, y: 0 }, 12.5, dark);
    dot(c, { x: 0, y: 0 }, 8.5, inactive ? '#415b5d' : p.shield.closed ? '#879b83' : '#d6c58a');
    line(c, { x: -shutter, y: -12 }, { x: -shutter, y: 14 }, '#8aa08c', 5);
    line(c, { x: shutter, y: -12 }, { x: shutter, y: 14 }, '#8aa08c', 5);
    for (const y of [-4, 1, 6]) line(c, { x: -4, y }, { x: 4, y }, dark, 1.4);
    c.fillStyle = lamp;
    c.fillRect(-10, -25, 20, 3.5);
  } else {
    plate(
      c,
      [
        { x: -30, y: -17 },
        { x: -20, y: -29 },
        { x: 16, y: -25 },
        { x: 32, y: -12 },
        { x: 28, y: 20 },
        { x: -25, y: 24 },
      ],
      shell,
      edge,
    );
    plate(
      c,
      [
        { x: -18, y: -14 },
        { x: 18, y: -14 },
        { x: 21, y: 14 },
        { x: -20, y: 17 },
      ],
      '#443e35',
      '#a3987e',
    );
    line(c, { x: -27, y: 19 }, { x: 27, y: 17 }, '#b09a75', 3);
    for (const y of [-3, 4, 11]) {
      line(c, { x: -13, y }, { x: 13, y }, dark, 3.5);
      for (let x = -11; x < 12; x += 5)
        line(c, { x, y: y - 1 }, { x: x + 2, y: y + 1 }, '#a89a7a', 1);
    }
    c.fillStyle = lamp;
    c.fillRect(-8, -22, 16, 4);
  }
  casingWear(c, p, inactive);
  c.restore();
  if (s.kind === 'cableweaver') {
    for (const d of p.drums) {
      hydraulic(
        c,
        { x: p.body.x + (d.center.x < 0 ? -15 : 15), y: p.body.y + 8 },
        d.center,
        metal,
        2.7,
      );
      dot(c, d.center, d.radius + 2.6, dark);
      dot(c, d.center, d.radius, '#3b6870');
      c.strokeStyle = edge;
      c.lineWidth = 1.7;
      c.beginPath();
      c.arc(d.center.x, d.center.y, d.radius, 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      c.arc(d.center.x, d.center.y, d.radius * 0.67, 0, Math.PI * 2);
      c.stroke();
      for (let i = 0; i < 5; i++) {
        const a = d.angle + (i * Math.PI * 2) / 5;
        line(
          c,
          {
            x: d.center.x + Math.cos(a) * d.radius * 0.28,
            y: d.center.y + Math.sin(a) * d.radius * 0.28,
          },
          {
            x: d.center.x + Math.cos(a) * d.radius * 0.83,
            y: d.center.y + Math.sin(a) * d.radius * 0.83,
          },
          metal,
          1.7,
        );
      }
      dot(c, d.center, 3.7, dark);
      dot(c, d.center, 1.8, accent);
      const brake = {
        x: d.center.x + (d.center.x < 0 ? -1 : 1) * (d.radius + 2),
        y: d.center.y - 4,
      };
      hydraulic(
        c,
        { x: p.body.x + (d.center.x < 0 ? -12 : 12), y: p.body.y - 15 },
        brake,
        metal,
        1.8,
      );
      line(
        c,
        { x: brake.x, y: brake.y },
        { x: brake.x, y: brake.y + 8 + d.tension * 3 },
        inactive ? '#536c6a' : d.tension > 0 ? accent : '#718c85',
        3,
      );
    }
  }
  if (s.kind === 'demolisher') {
    if (p.rack.length) {
      const first = p.rack[0].point,
        last = p.rack.at(-1)!.point;
      line(c, { x: first.x - 4, y: first.y + 10 }, { x: last.x + 4, y: last.y + 10 }, dark, 5);
      for (const q of [first, last])
        hydraulic(
          c,
          { x: p.body.x + (q.x < 0 ? -17 : 17), y: p.body.y - 10 },
          { x: q.x, y: q.y + 10 },
          metal,
          2.5,
        );
    }
    for (const cell of p.rack) {
      const q = cell.point;
      c.fillStyle = '#263c40';
      c.fillRect(q.x - 3.4, q.y - 9, 6.8, 19);
      c.strokeStyle = edge;
      c.lineWidth = 1;
      c.strokeRect(q.x - 3.4, q.y - 9, 6.8, 19);
      if (cell.loaded && !inactive) {
        c.fillStyle = '#b38d5d';
        c.fillRect(q.x - 2.3, q.y - 6, 4.6, 12);
        c.fillStyle = cell.arming > 0 ? '#efce9b' : accent;
        c.fillRect(q.x - 1.8, q.y - 4.5, 3.6, 3);
        line(c, { x: q.x - 2, y: q.y + 2 }, { x: q.x + 2, y: q.y + 2 }, dark, 1.3);
        line(c, { x: q.x, y: q.y - 9 }, { x: q.x, y: q.y - 12 - cell.arming * 3 }, metal, 1.2);
      } else {
        line(c, { x: q.x - 2, y: q.y - 3 }, { x: q.x + 2, y: q.y + 4 }, '#526c6a', 1);
      }
    }
    // Captive transfer linkage follows the real deployment, not the existence of
    // a separately ticking planted charge elsewhere in the arena.
    const transfer = {
      x: p.gimbal.center.x - p.forward * (12 + p.deploy * 9),
      y: p.gimbal.center.y + 6 - p.deploy * 5,
    };
    hydraulic(c, { x: p.body.x - p.forward * 16, y: p.body.y - 12 }, transfer, metal, 2.3);
    line(c, { x: transfer.x - 3, y: transfer.y }, { x: transfer.x + 3, y: transfer.y }, metal, 2.4);
  }
  const b = p.barrel,
    g = p.gimbal,
    hinge = {
      x: b.origin.x - Math.cos(b.angle) * b.length,
      y: b.origin.y - Math.sin(b.angle) * b.length,
    };
  hydraulic(
    c,
    s.kind === 'bulwark' ? p.mast.tip : { x: p.body.x, y: p.body.y - 18 },
    g.center,
    metal,
    2.7,
  );
  dot(c, g.center, 8.8, dark);
  dot(c, g.center, 6.4, '#718a83');
  dot(c, g.center, 3.1, accent);
  line(c, g.center, hinge, dark, 8);
  line(c, g.center, hinge, metal, 3);
  c.save();
  c.translate(b.origin.x, b.origin.y);
  c.rotate(b.angle);
  c.fillStyle = dark;
  c.fillRect(-b.length, -5, b.length, 10);
  c.fillStyle = inactive ? '#687b75' : accent;
  c.fillRect(-b.length + 2, -3.2, Math.max(0, b.length - 4), 6.4);
  c.fillStyle = s.kind === 'bulwark' ? '#5f796a' : s.kind === 'cableweaver' ? '#446b74' : '#94764f';
  c.fillRect(-b.length + 1 - b.recoil * 4, -7, 10, 14);
  line(
    c,
    { x: -b.length + 3 - b.recoil * 4, y: -5.5 },
    { x: -b.length + 8 - b.recoil * 4, y: -5.5 },
    metal,
    1.3,
  );
  c.fillStyle = metal;
  c.fillRect(-2, -3, 2, 6);
  for (const x of [-15, -10, -5]) line(c, { x, y: -2 }, { x, y: 2 }, dark, 0.9);
  c.restore();
  if (p.interruption > 0 && !inactive) {
    const q = { x: p.body.x - p.forward * 13, y: p.body.y - 22 };
    line(c, q, { x: q.x - p.forward * (4 + p.interruption * 5), y: q.y - 4 }, metal, 2);
    line(
      c,
      { x: q.x - p.forward * (4 + p.interruption * 5), y: q.y - 4 },
      { x: q.x - p.forward * 7, y: q.y + 2 },
      '#c8b592',
      1.3,
    );
  }
  c.restore();
}
