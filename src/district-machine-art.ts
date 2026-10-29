import type { MachineBodySnapshot } from './machine-breakdown-pose.ts';
import { districtMachinePose, type DistrictMachinePose } from './district-machine-pose.ts';
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
function wear(c: CanvasRenderingContext2D, p: DistrictMachinePose, inactive: boolean) {
  if (!p.wear) return;
  line(c, { x: -12, y: -9 }, { x: -5, y: -4 }, '#142c30', 2.5);
  line(c, { x: -5, y: -4 }, { x: -8, y: 2 }, '#142c30', 2.2);
  line(c, { x: -12, y: -10 }, { x: -6, y: -5 }, '#bbc2a1', 0.7);
  if (p.wear < 2) return;
  plate(
    c,
    [
      { x: 5, y: 0 },
      { x: 12, y: -1 },
      { x: 11, y: 8 },
      { x: 4, y: 7 },
    ],
    '#13272d',
    '#657e72',
  );
  for (let i = 0; i < 3; i++)
    line(
      c,
      { x: 6, y: 2 + i * 1.8 },
      { x: 9, y: 1 + i * 1.8 },
      inactive ? '#536c63' : '#a8b48b',
      1,
    );
  line(c, { x: -11, y: 6 }, { x: -5, y: 9 }, '#bfa783', 1);
}
/** Native mechanism hardware only. World warning lanes, cover and projectiles remain in their actual passes.
 * Every port begins at its real muzzle tip and is painted backward; recoil never shifts a launch point.
 */
export function drawDistrictChassis(
  c: CanvasRenderingContext2D,
  s: MachineBodySnapshot,
  reduced = false,
  p: DistrictMachinePose = districtMachinePose(s, reduced),
) {
  const inactive = p.energy <= 0,
    dark = '#162d32',
    metal = inactive ? '#627b6d' : '#b6c2a4',
    edge = inactive ? '#567567' : s.allied ? '#91bdc6' : '#94a78c',
    shell = s.allied
      ? '#30515e'
      : s.kind === 'borer'
        ? '#4c6656'
        : s.kind === 'sifter'
          ? '#3a5b54'
          : '#31585c',
    accent = inactive
      ? '#527268'
      : s.allied
        ? '#8ec8e0'
        : s.kind === 'skimmer'
          ? '#d9b58c'
          : '#d6ad81',
    lamp = inactive ? '#3d5c54' : p.recover ? '#bac8a4' : accent;
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  if (s.kind === 'borer') {
    c.fillStyle = dark;
    c.fillRect(-17, 7, 34, 10);
    c.strokeStyle = metal;
    c.lineWidth = 1;
    c.strokeRect(-16, 8, 32, 8);
    for (const x of [-11, 0, 11]) {
      dot(c, { x, y: 12 }, 3.6, '#516c5a');
      dot(c, { x, y: 12 }, 2.2, metal);
      line(
        c,
        { x: x - Math.cos(p.tread) * 1.5, y: 12 - Math.sin(p.tread) * 1.5 },
        { x: x + Math.cos(p.tread) * 1.5, y: 12 + Math.sin(p.tread) * 1.5 },
        dark,
        1,
      );
    }
    const shift = ((p.tread % 6) + 6) % 6;
    for (let x = -14 + shift; x < 16; x += 6) {
      line(c, { x, y: 8 }, { x: x + 2, y: 8 }, '#c5bc94', 1);
      line(c, { x, y: 16 }, { x: x + 2, y: 16 }, '#809b80', 1);
    }
    if (p.coverBrace > 0) {
      const side =
          Math.sign((s.districtMachine?.cover?.position.x ?? s.position.x) - s.position.x) ||
          p.forward,
        foot = { x: side * (16 + p.coverBrace * 6), y: 15 };
      line(c, { x: side * 9, y: 1 }, foot, dark, 5);
      line(c, { x: side * 9, y: 1 }, foot, metal, 2.4);
      line(c, { x: foot.x - 3, y: foot.y }, { x: foot.x + 3, y: foot.y }, accent, 2.2);
    }
  }
  for (const fin of p.fins) {
    line(c, fin.base, fin.tip, dark, 6);
    line(c, fin.base, fin.tip, metal, 2.4);
  }
  c.save();
  c.translate(p.body.x, p.body.y);
  c.rotate(p.angle);
  if (s.kind === 'borer') {
    plate(
      c,
      [
        { x: -16, y: 7 },
        { x: -15, y: -10 },
        { x: -9, y: -18 },
        { x: 9, y: -18 },
        { x: 16, y: -10 },
        { x: 16, y: 7 },
      ],
      shell,
      edge,
    );
    c.fillStyle = dark;
    c.fillRect(-11, -13, 22, 8);
    c.fillStyle = lamp;
    c.fillRect(p.forward > 0 ? 3 : -9, -11, 6, 2.5);
    c.fillStyle = '#6a8269';
    c.fillRect(-14, 2, 28, 5);
    for (const x of [-9, -1, 7]) line(c, { x, y: 3 }, { x: x + 3, y: 6 }, '#b5b48c', 1.7);
    const f = p.forward;
    plate(
      c,
      [
        { x: f * 7, y: -5 },
        { x: f * 16, y: -9 },
        { x: f * 17, y: 7 },
        { x: f * 8, y: 8 },
      ],
      '#788870',
      metal,
    );
    for (let y = -4; y < 6; y += 4) line(c, { x: f * 10, y }, { x: f * 15, y: y - 1 }, dark, 1);
    dot(c, { x: 0, y: -2 }, 5.6, dark);
    dot(c, { x: 0, y: -2 }, 3.5, '#859a7b');
    dot(c, { x: 0, y: -2 }, 1.6, accent);
  } else if (s.kind === 'sifter') {
    plate(
      c,
      [
        { x: -18, y: -9 },
        { x: -10, y: -19 },
        { x: 9, y: -19 },
        { x: 18, y: -9 },
        { x: 18, y: 10 },
        { x: 8, y: 17 },
        { x: -8, y: 17 },
        { x: -18, y: 10 },
      ],
      shell,
      edge,
    );
    c.fillStyle = dark;
    c.fillRect(-12, -8, 24, 14);
    c.fillStyle = '#627f69';
    c.fillRect(-11, -7, 22, 3);
    c.strokeStyle = metal;
    c.lineWidth = 1.1;
    c.strokeRect(-12, -8, 24, 14);
    for (const side of [-1, 1]) {
      c.fillStyle = '#507763';
      c.fillRect(side < 0 ? -20 : 13, -4, 7, 13);
      line(c, { x: side * 15, y: -1 }, { x: side * 18, y: 7 }, accent, 1.5);
    }
    c.fillStyle = lamp;
    c.fillRect(-7, 9, 14, 2.5);
    line(c, { x: -8, y: -15 }, { x: 8, y: -15 }, metal, 1);
  } else {
    plate(
      c,
      [
        { x: -19, y: -11 },
        { x: -11, y: -19 },
        { x: 11, y: -19 },
        { x: 19, y: -11 },
        { x: 19, y: 11 },
        { x: 11, y: 19 },
        { x: -11, y: 19 },
        { x: -19, y: 11 },
      ],
      shell,
      edge,
    );
    // Open fan cage: the native impeller remains visible beneath a rigid cross brace.
    c.strokeStyle = '#7a9e88';
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(0, 0, 14, 0, Math.PI * 2);
    c.stroke();
    for (const side of [-1, 1]) {
      line(c, { x: side * 11, y: -10 }, { x: side * 8, y: 11 }, metal, 1.3);
      dot(c, { x: side * 14, y: -13 }, 1.4, accent);
    }
    c.fillStyle = dark;
    c.fillRect(-5, -18, 10, 4);
    c.fillStyle = lamp;
    c.fillRect(-3, -17, 6, 1.8);
    line(c, { x: -9, y: 15 }, { x: 9, y: 15 }, metal, 1);
  }
  c.restore();
  if (s.kind !== 'skimmer')
    for (const rotor of p.rotors) {
      line(c, { x: Math.sign(rotor.center.x) * 8, y: -1 }, rotor.center, dark, 5);
      line(c, { x: Math.sign(rotor.center.x) * 8, y: -1 }, rotor.center, '#7b9a84', 2);
      dot(c, rotor.center, rotor.radius + 2, dark);
      dot(c, rotor.center, rotor.radius, '#668b79');
      dot(c, rotor.center, Math.max(1, rotor.radius - 1.5), '#2b4a46');
      for (let i = 0; i < 4; i++) {
        const angle = rotor.angle + (i * Math.PI) / 2,
          rad = rotor.radius - 2;
        line(
          c,
          { x: rotor.center.x + Math.cos(angle) * 1.7, y: rotor.center.y + Math.sin(angle) * 1.7 },
          { x: rotor.center.x + Math.cos(angle) * rad, y: rotor.center.y + Math.sin(angle) * rad },
          inactive ? '#5e8070' : '#acbca0',
          1.8,
        );
      }
      dot(c, rotor.center, 2, metal);
    }
  // Skimmer's center fan is on the front face, visible through its cage.
  if (s.kind === 'skimmer')
    for (const rotor of p.rotors) {
      dot(c, rotor.center, Math.max(1, rotor.radius - 1.2), '#1e4144');
      for (let i = 0; i < 5; i++) {
        const a = rotor.angle + (i * Math.PI * 2) / 5,
          rad = Math.max(2, rotor.radius - 2);
        plate(
          c,
          [
            { x: rotor.center.x + Math.cos(a) * 2, y: rotor.center.y + Math.sin(a) * 2 },
            { x: rotor.center.x + Math.cos(a) * rad, y: rotor.center.y + Math.sin(a) * rad },
            {
              x: rotor.center.x + Math.cos(a + 0.45) * (rad - 1),
              y: rotor.center.y + Math.sin(a + 0.45) * (rad - 1),
            },
          ],
          inactive ? '#5c8070' : '#91af94',
          '#4e7e70',
        );
      }
      dot(c, rotor.center, 3, metal);
      dot(c, rotor.center, 1.2, dark);
    }
  for (const slat of p.louvers) {
    line(c, slat.from, slat.to, dark, 4.2);
    const dx = slat.to.x - slat.from.x,
      dy = slat.to.y - slat.from.y,
      len = Math.max(0.001, Math.hypot(dx, dy)),
      offset = slat.open * 1.5;
    line(
      c,
      { x: slat.from.x - (dy / len) * offset, y: slat.from.y + (dx / len) * offset },
      { x: slat.to.x - (dy / len) * offset, y: slat.to.y + (dx / len) * offset },
      metal,
      2.1,
    );
  }
  c.save();
  c.translate(p.body.x, p.body.y);
  c.rotate(p.angle);
  wear(c, p, inactive);
  c.restore();
  for (const port of p.ports) {
    c.save();
    c.translate(port.origin.x, port.origin.y);
    c.rotate(port.angle);
    const b = port.length;
    line(c, { x: -b, y: 0 }, { x: -1, y: 0 }, dark, s.kind === 'borer' ? 6 : 5);
    line(c, { x: -b + 1, y: -1.1 }, { x: -1, y: -1.1 }, metal, 2.5);
    c.fillStyle = inactive ? '#5f7b6b' : accent;
    c.fillRect(-3, -2.7, 2, 5.4);
    c.fillStyle = '#3c5b50';
    c.fillRect(-b + 2 - port.recoil * 2, -3.5, Math.min(6, b - 2), 7);
    line(
      c,
      { x: -b + 3 - port.recoil * 2, y: -2.5 },
      { x: -b + 6 - port.recoil * 2, y: -2.5 },
      metal,
      1,
    );
    if (port.open > 0 && !inactive)
      line(c, { x: -1, y: -1.5 * port.open }, { x: -1, y: 1.5 * port.open }, lamp, 1.3);
    c.restore();
  }
  c.restore();
}
