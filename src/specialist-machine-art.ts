import type { Enemy } from './game.ts';
import type { Vec } from './rules.ts';
import { attackBrace } from './combat-readability.ts';
import type { MachineBodySnapshot } from './machine-breakdown-pose.ts';
import { specialistMachinePose, type SpecialistMachinePose } from './specialist-machine-pose.ts';

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
function spring(c: CanvasRenderingContext2D, a: Vec, b: Vec, color: string, width = 1) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    length = Math.max(0.001, Math.hypot(dx, dy)),
    nx = -dy / length,
    ny = dx / length;
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(a.x, a.y);
  for (let i = 1; i <= 6; i++) {
    const t = i / 7,
      side = i % 2 ? 1 : -1;
    c.lineTo(a.x + dx * t + nx * side * 1.8, a.y + dy * t + ny * side * 1.8);
  }
  c.lineTo(b.x, b.y);
  c.stroke();
}
function wear(c: CanvasRenderingContext2D, p: SpecialistMachinePose, dead: boolean) {
  if (!p.wear) return;
  line(c, { x: -11, y: -8 }, { x: -5, y: -4 }, '#162328', 2.3);
  line(c, { x: -5, y: -4 }, { x: -8, y: 1 }, '#162328', 2.3);
  line(c, { x: -10, y: -9 }, { x: -5, y: -5 }, '#b89a7a', 0.8);
  if (p.wear < 2) return;
  plate(
    c,
    [
      { x: 4, y: 1 },
      { x: 12, y: 0 },
      { x: 10, y: 8 },
      { x: 3, y: 7 },
    ],
    '#152126',
    '#6b726c',
  );
  for (let i = 0; i < 3; i++)
    line(c, { x: 5, y: 2 + i * 1.6 }, { x: 9, y: 1.6 + i * 1.6 }, dead ? '#4e5b58' : '#b09a78', 1);
}
/** Local-center mechanical chassis only. Native long barrels, faction glyphs and warning geometry stay outside. */
export function drawSpecialistChassis(
  c: CanvasRenderingContext2D,
  s: MachineBodySnapshot,
  reduced = false,
  p: SpecialistMachinePose = specialistMachinePose(s, reduced),
) {
  const dead = s.hp <= 0,
    flash = !dead && s.flash > 0 && !reduced,
    accent = flash ? '#fff5df' : s.allied ? '#79b9e0' : s.kind === 'sniper' ? '#dba677' : '#df846e',
    shell = flash ? '#e5dfd0' : s.allied ? '#293f49' : s.kind === 'sniper' ? '#49423a' : '#493d35',
    edge = dead ? '#58615c' : s.allied ? '#719dad' : '#a28c72',
    metal = '#a6a28e',
    dark = '#182429',
    lamp = dead
      ? '#45514e'
      : p.mode === 'crash'
        ? '#e7c38c'
        : p.recover
          ? '#b5c6ab'
          : p.locked
            ? '#ffdfad'
            : p.brace > 0
              ? '#d5b179'
              : p.wear === 2
                ? '#7b6b4e'
                : '#c8b892';
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  if (s.kind === 'charger') {
    const feet = p.legs.map((l) => l.foot);
    if (feet.length === 2) {
      // Two bogies and the drive belt follow the pose override, including collapsed wreck carriages.
      line(c, feet[0], feet[1], dark, 9);
      line(c, feet[0], feet[1], '#5b6057', 6.5);
      for (const [i, leg] of p.legs.entries()) {
        line(c, leg.hip, leg.knee, '#232e2f', 4);
        line(c, leg.knee, leg.foot, metal, 2);
        dot(c, leg.foot, 3.9, dark);
        dot(c, leg.foot, 2.6, '#8a8c76');
        const a = p.drive + i * Math.PI;
        line(
          c,
          leg.foot,
          { x: leg.foot.x + Math.cos(a) * 2, y: leg.foot.y + Math.sin(a) * 2 },
          '#d1b18a',
          1,
        );
      }
      for (let i = 0; i < 5; i++) {
        const t = (i + 0.5) / 5,
          a = feet[0],
          b = feet[1];
        line(
          c,
          { x: a.x + (b.x - a.x) * t - 0.7, y: a.y + (b.y - a.y) * t + 3 },
          { x: a.x + (b.x - a.x) * t + 0.7, y: a.y + (b.y - a.y) * t + 3 },
          '#b3a287',
          1,
        );
      }
    }
  } else {
    for (const [i, leg] of p.legs.entries()) {
      line(c, leg.hip, leg.knee, dark, s.kind === 'hopper' ? 5 : 4);
      line(c, leg.knee, leg.foot, dark, s.kind === 'hopper' ? 5 : 4);
      line(c, leg.hip, leg.knee, i === 0 ? '#6f7468' : metal, 2.4);
      line(c, leg.knee, leg.foot, i === 0 ? '#8a8c75' : '#c0b18f', 2);
      if (s.kind === 'hopper')
        spring(
          c,
          { x: leg.hip.x + (i ? -2 : 2), y: leg.hip.y },
          { x: leg.knee.x + (i ? -2 : 2), y: leg.knee.y },
          '#b6a17d',
          1,
        );
      dot(c, leg.knee, 2, dark);
      dot(c, leg.knee, 0.9, '#c6b593');
      c.fillStyle = '#283334';
      c.fillRect(leg.foot.x - 3.5, leg.foot.y - 1, 7, 3);
      c.fillStyle = '#aaa38a';
      c.fillRect(leg.foot.x - 3, leg.foot.y - 1, 6, 1);
    }
  }
  c.save();
  c.translate(p.body.x, p.body.y);
  c.rotate(p.angle);
  if (s.kind === 'charger') {
    c.save();
    c.scale(p.forward, 1);
    plate(
      c,
      [
        { x: -14, y: -11 },
        { x: -9, y: -16 },
        { x: 5, y: -14 },
        { x: 10, y: -8 },
        { x: 10, y: 5 },
        { x: -13, y: 5 },
      ],
      shell,
      edge,
    );
    c.fillStyle = dark;
    c.fillRect(-9, -9, 13, 8);
    c.fillStyle = lamp;
    c.fillRect(-7, -7, 8, 2);
    for (const y of [-8, 4]) {
      line(c, { x: -1, y }, { x: 11 + p.ram * 3, y }, '#292e2d', 4);
      line(c, { x: 1, y: y - 0.5 }, { x: 10 + p.ram * 3, y: y - 0.5 }, '#b49d7c', 1.5);
      c.fillStyle = '#706353';
      c.fillRect(1, y - 2, 4, 4);
    }
    const nose = 14 + p.ram * 4;
    plate(
      c,
      [
        { x: nose - 7, y: -13 },
        { x: nose - 3, y: -11 },
        { x: nose, y: 0 },
        { x: nose - 3, y: 11 },
        { x: nose - 7, y: 13 },
      ],
      '#5a4c3e',
      accent,
    );
    line(c, { x: nose - 3, y: -10 }, { x: nose - 0.4, y: 0 }, accent, 2);
    line(c, { x: nose - 0.4, y: 0 }, { x: nose - 3, y: 10 }, accent, 2);
    for (let i = 0; i < 3; i++) {
      c.fillStyle = p.recover ? lamp : '#a57855';
      c.fillRect(-12 + i * 4, 0, 2, 5);
    }
    if (p.mode === 'crash') {
      // A retained real crash entry, never merely proximity to a wall.
      line(c, { x: nose - 6, y: -6 }, { x: nose - 3, y: -2 }, '#222c2d', 1.4);
      line(c, { x: nose - 3, y: -2 }, { x: nose - 6, y: 2 }, '#222c2d', 1.4);
      c.fillStyle = '#b1a181';
      c.fillRect(6, -2, 4, 3);
    }
    c.restore();
    wear(c, p, dead);
  } else if (s.kind === 'hopper') {
    plate(
      c,
      [
        { x: -12, y: -10 },
        { x: -5, y: -17 },
        { x: 5, y: -17 },
        { x: 12, y: -10 },
        { x: 10, y: 4 },
        { x: 5, y: 8 },
        { x: -5, y: 8 },
        { x: -10, y: 4 },
      ],
      shell,
      edge,
    );
    c.fillStyle = dark;
    c.fillRect(-7, -10, 14, 9);
    c.fillStyle = lamp;
    c.fillRect(-4, -8, 8, 2.5);
    for (const side of [-1, 1]) {
      line(c, { x: side * 9, y: -9 }, { x: side * 9, y: 5 }, '#2b3432', 4);
      spring(c, { x: side * 9, y: -8 }, { x: side * 9, y: 4 - p.compression * 4 }, '#b6a280', 1);
      c.fillStyle = accent;
      c.fillRect(side < 0 ? -13 : 10, -7, 3, 9);
      dot(c, { x: side * 6, y: 4 }, 2.5, dark);
      dot(c, { x: side * 6, y: 4 }, 1, '#bba88a');
    }
    plate(
      c,
      [
        { x: -5, y: 0 },
        { x: 5, y: 0 },
        { x: 4, y: 7 },
        { x: -4, y: 7 },
      ],
      '#75614a',
      '#b39670',
    );
    line(c, { x: -3, y: 3 }, { x: 3, y: 3 }, '#293431', 1.2);
    wear(c, p, dead);
  } else {
    plate(
      c,
      [
        { x: -15, y: -9 },
        { x: -10, y: -14 },
        { x: 10, y: -14 },
        { x: 15, y: -9 },
        { x: 13, y: 4 },
        { x: -13, y: 4 },
      ],
      shell,
      edge,
    );
    c.fillStyle = '#242d2e';
    c.fillRect(-10, 1, 20, 5);
    c.fillStyle = '#817f6a';
    c.fillRect(-7, 2, 14, 2);
    for (const side of [-1, 1]) {
      c.fillStyle = accent;
      c.fillRect(side < 0 ? -14 : 11, -9, 3, 10);
      for (let i = 0; i < 3; i++)
        line(c, { x: side * 9, y: -8 + i * 2.5 }, { x: side * 12, y: -8 + i * 2.5 }, dark, 1);
    }
    dot(c, { x: 0, y: -2 }, 7, '#263234');
    dot(c, { x: 0, y: -2 }, 5, '#8a8b74');
    c.save();
    c.rotate(p.barrel);
    for (const [i, row] of (s.elite === 'twin' ? [-6, 6] : [-1]).entries()) {
      const opening = p.breech[i];
      c.fillStyle = '#292f2d';
      c.fillRect(-10 - opening * 2, row - 2, 12, 4);
      c.fillStyle = edge;
      c.fillRect(-10 - opening * 2, row - 2, 8, 1);
      c.fillStyle = dead ? '#4c554c' : i === (s.state === 'followup' ? 1 : 0) ? lamp : '#8f795c';
      c.fillRect(-7 - opening * 2, row - 1, 3, 1.5);
      if (opening > 0.1) {
        c.fillStyle = '#19262a';
        c.fillRect(-2 - opening, row - 1.5, opening * 3, 3);
      }
    }
    c.restore();
    // The existing Twin first/second indicators remain above the native receiver.
    if (s.elite === 'twin')
      for (const [i, x] of [-6, 3].entries()) {
        line(c, { x: x + 2, y: -17 }, { x: x + 2, y: -13 }, '#7d806c', 1.8);
        c.fillStyle = dead
          ? '#4c554c'
          : (s.state === 'windup' && i === 0) || (s.state === 'followup' && i === 1)
            ? '#ffe1aa'
            : '#8c6750';
        c.fillRect(x, -23, 4, 6);
      }
    if (p.tracking || p.locked) {
      c.fillStyle = p.locked ? '#f4d39b' : '#9d9879';
      c.fillRect(-4, -12, 8, 1.5);
      c.fillStyle = dark;
      c.fillRect(p.locked ? -1 : -4, -12, 2, 1.5);
    }
    wear(c, p, dead);
  }
  c.restore();
  c.restore();
}
/** Details stay inside the untouched native 30px Sniper/Twin barrels. */
export function drawSpecialistBarrelDetails(
  c: CanvasRenderingContext2D,
  e: Enemy,
  reduced: boolean,
) {
  if (e.kind !== 'sniper') return;
  const aim = e.allied ? e.aim : e.elite === 'shielded' ? { x: e.facing, y: 0 } : e.aim;
  c.save();
  if (e.squad?.kind === 'shield' && e.squad.role === 'support') c.translate(0, -34);
  c.rotate(Math.atan2(aim.y, aim.x));
  c.translate(-attackBrace(e) * 2, 0);
  for (const row of e.elite === 'twin' ? [-6, 6] : [-1]) {
    line(c, { x: 17, y: row - 1 }, { x: 31, y: row - 1 }, '#b9b39b', 0.7);
    line(c, { x: 17, y: row + 1 }, { x: 32, y: row + 1 }, '#3f4140', 0.7);
    c.fillStyle = e.flash > 0 && !reduced ? '#ece4cd' : '#a9ac95';
    c.fillRect(34, row - 1, 1, 2);
    for (const x of [20, 24, 28]) line(c, { x, y: row - 1 }, { x, y: row + 1 }, '#5c4c3b', 0.65);
  }
  c.restore();
}
