import type { MachineBodySnapshot } from './machine-breakdown-pose.ts';
import { heavyMachinePose, type HeavyMachinePose, type HeavyBarrel } from './heavy-machine-pose.ts';
import type { Vec } from './rules.ts';

function line(c: CanvasRenderingContext2D, a: Vec, b: Vec, color: string, width = 1) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(a.x, a.y);
  c.lineTo(b.x, b.y);
  c.stroke();
}
function dot(c: CanvasRenderingContext2D, p: Vec, radius: number, color: string) {
  c.fillStyle = color;
  c.beginPath();
  c.arc(p.x, p.y, radius, 0, Math.PI * 2);
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
function chassisWear(c: CanvasRenderingContext2D, p: HeavyMachinePose, dead: boolean) {
  if (!p.wear) return;
  line(c, { x: -12, y: -9 }, { x: -6, y: -5 }, '#17262a', 2.3);
  line(c, { x: -6, y: -5 }, { x: -9, y: 0 }, '#17262a', 2.3);
  line(c, { x: -11, y: -10 }, { x: -6, y: -6 }, '#b4ab8f', 0.7);
  if (p.wear < 2) return;
  plate(
    c,
    [
      { x: 5, y: 2 },
      { x: 13, y: 1 },
      { x: 11, y: 9 },
      { x: 4, y: 8 },
    ],
    '#14242a',
    '#6d7d74',
  );
  for (let i = 0; i < 3; i++)
    line(c, { x: 6, y: 3 + i * 1.6 }, { x: 10, y: 2.5 + i * 1.6 }, dead ? '#51615a' : '#a5b599', 1);
}
function barrel(
  c: CanvasRenderingContext2D,
  b: HeavyBarrel,
  s: MachineBodySnapshot,
  color: string,
  dead: boolean,
) {
  const heavy = s.kind === 'mortar',
    width = heavy ? 7 : 3.4,
    back = b.length + b.recoil * 2;
  c.save();
  c.translate(b.origin.x, b.origin.y);
  c.rotate(b.angle);
  const offset = b.feedOffset ?? 0;
  if (offset) {
    line(c, { x: -back, y: offset }, { x: -5, y: offset }, '#283b3d', width + 1.5);
    line(c, { x: -5, y: offset }, { x: 0, y: 0 }, '#283b3d', width + 1.5);
    line(c, { x: -back, y: offset - 1 }, { x: -5, y: offset - 1 }, '#a2ad92', 0.8);
    c.fillStyle = dead ? '#57675f' : color;
    c.fillRect(-back + 2, offset - width / 2, 4, width);
    c.fillStyle = '#788e7b';
    c.fillRect(-3, -width / 2, 2, width);
    c.restore();
    return;
  }
  c.fillStyle = '#283b3d';
  c.fillRect(-back, -width / 2, back, width);
  c.strokeStyle = '#8b9e90';
  c.lineWidth = 0.9;
  c.strokeRect(-back, -width / 2, back, width);
  c.fillStyle = dead ? '#57675f' : color;
  c.fillRect(-5, -width / 2, 2, width);
  line(c, { x: -back + 3, y: -width / 2 + 1 }, { x: -7, y: -width / 2 + 1 }, '#b6bca2', 0.7);
  if (heavy) {
    c.fillStyle = '#627469';
    c.fillRect(-back + 2, -width / 2 - 1, 6, width + 2);
    c.fillStyle = '#223337';
    c.fillRect(-2, -width / 2 + 1, 2, width - 2);
    for (const x of [-14, -10]) line(c, { x, y: -2 }, { x, y: 2 }, '#657a6a', 0.7);
    if (s.patrol?.variant === 'mortar-slow') {
      c.strokeStyle = color;
      c.lineWidth = 1;
      c.strokeRect(-23, -width / 2 - 1.5, 5, width + 3);
    }
  } else {
    line(c, { x: -10, y: -1 }, { x: -10, y: 1 }, '#596d60', 0.8);
    if (s.patrol?.variant === 'strider-survey') {
      line(c, { x: -20, y: -2 }, { x: -20, y: -6 }, '#8f9d88', 1.4);
      line(c, { x: -9, y: -2 }, { x: -9, y: -6 }, '#8f9d88', 1.4);
      c.fillStyle = dead ? '#5c685b' : color;
      c.fillRect(-22, -7, 15, 2.5);
      dot(c, { x: -8, y: -5.7 }, 1.2, '#d0d4af');
    }
  }
  c.restore();
}
/** Pure world-aligned local chassis. Includes every native variant head; no warnings, captions or emitters. */
export function drawHeavyChassis(
  c: CanvasRenderingContext2D,
  s: MachineBodySnapshot,
  reduced = false,
  p: HeavyMachinePose = heavyMachinePose(s, reduced),
) {
  const dead = s.hp <= 0,
    flash = !dead && !reduced && s.flash > 0,
    color = flash
      ? '#fff3d0'
      : s.allied
        ? '#79b9e0'
        : s.kind === 'shutter'
          ? '#d79f7b'
          : s.kind === 'strider'
            ? '#d3ba82'
            : '#b3c8a6',
    shell = flash ? '#e5e7d1' : s.allied ? '#2c4752' : '#465651',
    edge = dead ? '#53665d' : s.allied ? '#709eae' : '#899b8a',
    dark = '#17282d',
    lamp = dead
      ? '#44574d'
      : s.kind === 'shutter' && p.opening > 0
        ? '#f5d29d'
        : p.brace > 0
          ? '#f0d09a'
          : p.recover
            ? '#a9c3a3'
            : '#c5d0ae';
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  if (s.kind === 'mortar') {
    if (p.wheels.length === 2) line(c, p.wheels[0], p.wheels[1], dark, 5);
    for (const [i, wheel] of p.wheels.entries()) {
      dot(c, wheel, 6, dark);
      dot(c, wheel, 4.8, '#5e7768');
      dot(c, wheel, 2.8, '#a6b194');
      for (const a of [p.drive + i, p.drive + i + Math.PI])
        line(
          c,
          wheel,
          { x: wheel.x + Math.cos(a) * 4.5, y: wheel.y + Math.sin(a) * 4.5 },
          '#243c37',
          1.2,
        );
      dot(c, wheel, 1, '#ced0af');
    }
  } else {
    for (const [i, l] of p.legs.entries()) {
      line(c, l.hip, l.knee, dark, s.kind === 'strider' ? 5 : 5.5);
      line(c, l.knee, l.foot, dark, s.kind === 'strider' ? 5 : 5.5);
      line(c, l.hip, l.knee, i ? '#abb69d' : '#728c7d', 2.3);
      line(c, l.knee, l.foot, '#9aa98f', 2.2);
      line(
        c,
        { x: l.hip.x + (i ? -2 : 2), y: l.hip.y },
        { x: l.knee.x + (i ? -2 : 2), y: l.knee.y },
        '#cfbd95',
        1,
      );
      dot(c, l.knee, 2.3, dark);
      dot(c, l.knee, 1.1, '#d1c59f');
      c.fillStyle = '#253a3b';
      c.fillRect(l.foot.x - 4, l.foot.y - 1, 8, 3);
      c.fillStyle = '#a9b49a';
      c.fillRect(l.foot.x - 3, l.foot.y - 1, 6, 1);
    }
  }
  c.save();
  c.translate(p.body.x, p.body.y);
  c.rotate(p.angle);
  if (s.kind === 'shutter') {
    plate(
      c,
      [
        { x: -16, y: -16 },
        { x: -11, y: -20 },
        { x: 12, y: -20 },
        { x: 17, y: -14 },
        { x: 16, y: 12 },
        { x: -16, y: 12 },
      ],
      shell,
      edge,
    );
    c.fillStyle = dark;
    c.fillRect(-11, -13, 21, 23);
    plate(
      c,
      [
        { x: -8, y: -11 },
        { x: 6, y: -11 },
        { x: 9, y: -5 },
        { x: 6, y: 6 },
        { x: -8, y: 7 },
      ],
      '#8a6851',
      '#b49670',
    );
    c.fillStyle = lamp;
    c.fillRect(-5, -8, 8, 3);
    for (const y of [-1, 3])
      line(c, { x: -5, y }, { x: 4, y }, p.opening > 0 ? '#dfbd87' : '#564e3a', 1.2);
    for (const side of [-1, 1]) {
      line(c, { x: side * 12, y: -15 }, { x: side * 12, y: 10 }, '#283c3a', 3);
      dot(c, { x: side * 12, y: -14 }, 1.2, '#b6b393');
      dot(c, { x: side * 12, y: 9 }, 1.2, '#b6b393');
    }
    chassisWear(c, p, dead);
  } else if (s.kind === 'strider') {
    plate(
      c,
      [
        { x: -13, y: -14 },
        { x: -8, y: -18 },
        { x: 9, y: -18 },
        { x: 14, y: -13 },
        { x: 12, y: 5 },
        { x: -12, y: 5 },
      ],
      shell,
      edge,
    );
    c.fillStyle = color;
    c.fillRect(-9, -15, 17, 2.5);
    c.fillStyle = dark;
    c.fillRect(-9, -8, 17, 9);
    for (const side of [-1, 1]) {
      c.fillStyle = '#6a7b67';
      c.fillRect(side < 0 ? -13 : 8, -7, 5, 10);
      for (let i = 0; i < 3; i++)
        line(
          c,
          { x: side * 10, y: -5 + i * 2.5 },
          { x: side * 12, y: -5 + i * 2.5 },
          '#243831',
          0.8,
        );
    }
    dot(c, { x: 0, y: -1 }, 6.5, '#8b957b');
    dot(c, { x: 0, y: -1 }, 4.5, dark);
    c.fillStyle = lamp;
    c.fillRect(-3, -8, 6, 2);
    line(c, { x: -7, y: 3 }, { x: 7, y: 3 }, '#b6b496', 1.5);
    chassisWear(c, p, dead);
  } else {
    plate(
      c,
      [
        { x: -20, y: -3 },
        { x: -15, y: -8 },
        { x: 14, y: -8 },
        { x: 20, y: -2 },
        { x: 19, y: 10 },
        { x: -19, y: 10 },
      ],
      shell,
      edge,
    );
    c.fillStyle = dark;
    c.fillRect(-16, 0, 32, 7);
    c.fillStyle = color;
    c.fillRect(-8, 1, 16, 2.5);
    for (const x of [-14, 14]) dot(c, { x, y: 4 }, 1.6, '#c4c69f');
    c.fillStyle = '#344a40';
    c.fillRect(-10, -10, 20, 5);
    c.strokeStyle = '#9bad91';
    c.lineWidth = 1.4;
    c.strokeRect(-10, -10, 20, 5);
    const tubes = s.patrol?.variant === 'mortar-twin' ? 2 : 1;
    for (let i = 0; i < tubes; i++) {
      const x = tubes === 2 ? (i ? 5 : -5) : 0;
      c.fillStyle = dead ? '#4c6251' : lamp;
      c.fillRect(x - 2, -7 - p.loader * 5, 4, 6);
      c.fillStyle = '#263d37';
      c.fillRect(x - 2, -5 - p.loader * 5, 4, 1);
    }
    chassisWear(c, p, dead);
  }
  c.restore();
  for (const b of p.barrels) {
    const breech = {
      x: b.origin.x - Math.cos(b.angle) * b.length,
      y: b.origin.y - Math.sin(b.angle) * b.length,
    };
    line(
      c,
      { x: p.body.x, y: p.body.y - (s.kind === 'mortar' ? 6 : 1) },
      breech,
      '#243a37',
      s.kind === 'mortar' ? 5 : 3.5,
    );
    line(c, { x: p.body.x, y: p.body.y - (s.kind === 'mortar' ? 6 : 1) }, breech, '#a6ab88', 1.3);
    barrel(c, b, s, color, dead);
    dot(c, breech, s.kind === 'mortar' ? 2.5 : 1.8, '#6d8471');
  }
  for (const leaf of p.panels) {
    c.save();
    c.translate(leaf.position.x, leaf.position.y);
    c.rotate(leaf.angle);
    c.fillStyle = !dead && s.patrol?.shieldFlash && !reduced ? '#fff0b5' : '#71867c';
    c.strokeStyle = edge;
    c.lineWidth = 1;
    c.fillRect(-leaf.width / 2, -leaf.height / 2, leaf.width, leaf.height);
    c.strokeRect(-leaf.width / 2, -leaf.height / 2, leaf.width, leaf.height);
    line(
      c,
      { x: p.forward * (leaf.width / 2 - 1), y: -leaf.height / 2 + 1 },
      { x: p.forward * (leaf.width / 2 - 1), y: leaf.height / 2 - 1 },
      color,
      1.5,
    );
    for (let y = -leaf.height / 2 + 3; y < leaf.height / 2 - 1; y += 6)
      line(c, { x: -2, y }, { x: 2, y: y + 2 }, '#b0b39b', 0.8);
    c.restore();
  }
  c.restore();
}
