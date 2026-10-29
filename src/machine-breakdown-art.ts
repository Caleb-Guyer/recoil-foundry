import type { Enemy, Game } from './game.ts';
import type { Vec } from './rules.ts';
import { clamp } from './rules.ts';
import { SPLIT_SCALE } from './mutations.ts';
import { attackBrace } from './combat-readability.ts';
import {
  isMachineKind,
  machineBodySnapshot,
  machinePose,
  type MachineBodySnapshot,
  type MachinePose,
} from './machine-breakdown-pose.ts';
import { isSpecialistMachineKind, type SpecialistMachinePose } from './specialist-machine-pose.ts';
import { drawSpecialistChassis } from './specialist-machine-art.ts';
import { isHeavyMachineKind, type HeavyMachinePose } from './heavy-machine-pose.ts';
import { drawHeavyChassis } from './heavy-machine-art.ts';
import { isSupportMachineKind, type SupportMachinePose } from './support-machine-pose.ts';
import { drawSupportChassis } from './support-machine-art.ts';
import { isHazardMachineKind, type HazardMachinePose } from './hazard-machine-pose.ts';
import { drawHazardChassis } from './hazard-machine-art.ts';
import { isDistrictMachineKind, type DistrictMachinePose } from './district-machine-pose.ts';
import { drawDistrictChassis } from './district-machine-art.ts';
import { isSurfaceMachineKind, type SurfaceMachinePose } from './surface-machine-pose.ts';
import { drawSurfaceChassis } from './surface-machine-art.ts';
import { isSignalMachineKind, type SignalMachinePose } from './signal-machine-pose.ts';
import { drawSignalChassis } from './signal-machine-art.ts';

function line(c: CanvasRenderingContext2D, a: Vec, b: Vec, color: string, width: number) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(a.x, a.y);
  c.lineTo(b.x, b.y);
  c.stroke();
}
function circle(c: CanvasRenderingContext2D, p: Vec, radius: number, color: string) {
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
function wear(c: CanvasRenderingContext2D, p: MachinePose, width: number, dead: boolean) {
  if (!p.wear) return;
  // Thresholds are the native 65/30% states; no cosmetic hit fabricates lost health.
  line(c, { x: -width * 0.35, y: -7 }, { x: -4, y: -3 }, '#152026', 2.5);
  line(c, { x: -4, y: -3 }, { x: -7, y: 2 }, '#152026', 2.5);
  line(c, { x: -7, y: 2 }, { x: -1, y: 6 }, '#152026', 2.5);
  line(c, { x: -width * 0.35, y: -8 }, { x: -4, y: -4 }, '#b49982', 0.8);
  if (p.wear < 2) return;
  plate(
    c,
    [
      { x: 3, y: 2 },
      { x: 12, y: 0 },
      { x: 11, y: 9 },
      { x: 3, y: 10 },
    ],
    '#121c20',
    '#6e7270',
  );
  for (let i = 0; i < 3; i++)
    line(c, { x: 5, y: 3 + i * 2 }, { x: 9, y: 2 + i * 2 }, dead ? '#4b5656' : '#ad9c80', 1);
  line(c, { x: -11, y: 8 }, { x: -6, y: 6 }, '#a88a72', 1);
}

/** Shared local-center chassis. Position/split scale, faction overlays, weapons and tells stay outside. */
export function drawMachineChassis(
  c: CanvasRenderingContext2D,
  s: MachineBodySnapshot,
  reduced = false,
  p: MachinePose = machinePose(s, reduced),
) {
  if (isSignalMachineKind(s.kind)) return drawSignalChassis(c, s, reduced, p as SignalMachinePose);
  if (isSurfaceMachineKind(s.kind))
    return drawSurfaceChassis(c, s, reduced, p as SurfaceMachinePose);
  if (isDistrictMachineKind(s.kind))
    return drawDistrictChassis(c, s, reduced, p as DistrictMachinePose);
  if (isHazardMachineKind(s.kind)) return drawHazardChassis(c, s, reduced, p as HazardMachinePose);
  if (isSupportMachineKind(s.kind))
    return drawSupportChassis(c, s, reduced, p as SupportMachinePose);
  if (isHeavyMachineKind(s.kind)) return drawHeavyChassis(c, s, reduced, p as HeavyMachinePose);
  if (isSpecialistMachineKind(s.kind))
    return drawSpecialistChassis(c, s, reduced, p as SpecialistMachinePose);
  const dead = s.hp <= 0,
    flash = s.flash > 0 && !reduced && !dead,
    accent = flash ? '#fff5df' : s.allied ? '#79b9e0' : '#df846e',
    edge = dead ? '#535c5d' : s.allied ? '#7099ad' : '#92796b',
    shell = flash ? '#e4ded0' : s.allied ? '#263b46' : '#443b38',
    dark = '#192328',
    lamp = dead
      ? '#3c4849'
      : p.brace > 0
        ? '#ffdaa1'
        : p.recover
          ? '#b1cab6'
          : p.wear === 2
            ? '#766448'
            : p.wear === 1
              ? '#b49b72'
              : '#d5caa3';
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  if (s.kind !== 'flyer') {
    for (const [i, leg] of p.legs.entries()) {
      const metal = i === 0 ? '#5f6461' : '#9b9a8c';
      line(c, leg.hip, leg.knee, dark, 5.5);
      line(c, leg.knee, leg.foot, dark, 5.5);
      line(c, leg.hip, leg.knee, metal, 2.5);
      line(c, leg.knee, leg.foot, metal, 2.5);
      const spring = { x: leg.knee.x + (i ? -2 : 2), y: leg.knee.y - 1 };
      line(c, { x: leg.hip.x + (i ? -2 : 2), y: leg.hip.y }, spring, '#655e52', 1.5);
      circle(c, leg.knee, 2.5, dark);
      circle(c, leg.knee, 1.2, '#c1b9a0');
      c.fillStyle = dark;
      c.fillRect(leg.foot.x - 4, leg.foot.y - 1, 8, 3);
      c.fillStyle = dead ? '#5a6260' : '#a59880';
      c.fillRect(leg.foot.x - 3, leg.foot.y - 1, 6, 1.2);
    }
  }
  c.save();
  c.translate(p.body.x, p.body.y);
  c.rotate(p.angle);
  if (s.kind === 'runner') {
    // Open lower drive and two exposed knees replace the old solid box silhouette.
    plate(
      c,
      [
        { x: -14, y: -11 },
        { x: -9, y: -16 },
        { x: 9, y: -16 },
        { x: 14, y: -11 },
        { x: 12, y: 6 },
        { x: -12, y: 6 },
      ],
      shell,
      edge,
    );
    c.fillStyle = dark;
    c.fillRect(-9, 2, 18, 5);
    for (const side of [-1, 1]) {
      const x = side * 11;
      line(c, { x, y: -9 }, { x: x - side * 2, y: 6 }, '#262d2d', 4);
      line(c, { x, y: -6 }, { x: x - side * 2, y: 4 }, '#b8a48a', 1.5);
      c.fillStyle = accent;
      c.fillRect(side < 0 ? -14 : 11, -10, 3, 12);
      circle(c, { x: side * 7, y: 5 }, 2.8, '#292d2b');
      circle(c, { x: side * 7, y: 5 }, 1.2, '#9e927c');
    }
    plate(
      c,
      [
        { x: -7, y: -11 },
        { x: 7, y: -11 },
        { x: 6, y: 1 },
        { x: -6, y: 1 },
      ],
      '#62534a',
      '#8a7865',
    );
    line(c, { x: -5, y: -6 }, { x: 5, y: -6 }, dark, 1.2);
    c.fillStyle = lamp;
    c.fillRect(-3, -10, 6, 2.5);
    // The same committed rush remains signaled by native warning art above the body.
    if (p.brace > 0 || s.state === 'rush') {
      const f = p.forward;
      line(c, { x: f * 7, y: -8 }, { x: f * 11, y: -5 }, '#e9bd87', 1.5);
      line(c, { x: f * 11, y: -5 }, { x: f * 7, y: -2 }, '#e9bd87', 1.5);
    }
    wear(c, p, 28, dead);
  } else if (s.kind === 'shooter') {
    // Stabilizers extend from real windup/recovery; they never move the native firing pivot.
    plate(
      c,
      [
        { x: -17, y: -10 },
        { x: -12, y: -14 },
        { x: 12, y: -14 },
        { x: 17, y: -10 },
        { x: 15, y: 7 },
        { x: -15, y: 7 },
      ],
      shell,
      edge,
    );
    c.fillStyle = accent;
    c.fillRect(-15, -13, 30, 2.5);
    c.fillStyle = '#272c2b';
    c.fillRect(-10, 2, 20, 6);
    c.fillStyle = '#7c786a';
    c.fillRect(-9, 4, 18, 2);
    for (const side of [-1, 1]) {
      c.fillStyle = '#6d6254';
      c.fillRect(side < 0 ? -16 : 11, -8, 5, 11);
      for (let i = 0; i < 3; i++)
        line(c, { x: side * 12, y: -6 + i * 3 }, { x: side * 15, y: -6 + i * 3 }, '#252c2c', 1.2);
      circle(c, { x: side * 11, y: 5 }, 2, '#b7a68b');
    }
    circle(c, { x: 0, y: 0 }, 8, '#252e31');
    circle(c, { x: 0, y: 0 }, 6, '#74796e');
    circle(c, { x: 0, y: 0 }, 3.5, dark);
    c.save();
    c.rotate(Math.atan2(s.aim.y, s.aim.x));
    c.fillStyle = '#9c9480';
    c.fillRect(-8 - p.receiver, -5, 10, 3);
    c.fillStyle = lamp;
    c.fillRect(-5 - p.receiver, -4, 4, 1.5);
    c.restore();
    wear(c, p, 34, dead);
  } else {
    // Ducted rotors are separate hardware, not a flickering wing line.
    for (const side of [-1, 1]) {
      const hub = { x: side * 24, y: -8 };
      line(c, { x: side * 11, y: -2 }, { x: side * 20, y: -8 }, dark, 5);
      line(c, { x: side * 11, y: -2 }, { x: side * 20, y: -8 }, '#8b9388', 2);
      c.fillStyle = '#263337';
      c.beginPath();
      c.ellipse(hub.x, hub.y, 9, 4.5, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = edge;
      c.lineWidth = 1.3;
      c.stroke();
      const a = p.rotor * side,
        rx = Math.cos(a) * 7,
        ry = Math.sin(a) * 2.8;
      line(
        c,
        { x: hub.x - rx, y: hub.y - ry },
        { x: hub.x + rx, y: hub.y + ry },
        dead ? '#687875' : '#c2c3a6',
        1.5,
      );
      line(
        c,
        { x: hub.x + ry * 1.5, y: hub.y - rx * 0.25 },
        { x: hub.x - ry * 1.5, y: hub.y + rx * 0.25 },
        '#657f7a',
        1.2,
      );
      circle(c, hub, 1.6, '#b7ac8c');
      c.fillStyle = accent;
      c.fillRect(hub.x - 4, hub.y + 4, 8, 2);
    }
    if (s.elite === 'volatile') {
      const points = Array.from({ length: 16 }, (_, i) => {
        const a = (i * Math.PI) / 8,
          r = i % 2 ? 15 : 23;
        return { x: Math.cos(a) * r, y: Math.sin(a) * r };
      });
      plate(c, points, shell, accent);
      circle(c, { x: 0, y: 0 }, 11, '#292c2b');
      c.strokeStyle = '#d2a47b';
      c.lineWidth = 1.7;
      c.beginPath();
      c.arc(0, 0, 10, 0, Math.PI * 2);
      c.stroke();
      circle(c, { x: 0, y: 0 }, 4 + p.brace * 5, lamp);
    } else {
      plate(
        c,
        [
          { x: -17, y: -7 },
          { x: -12, y: -15 },
          { x: 0, y: -18 },
          { x: 12, y: -15 },
          { x: 17, y: -7 },
          { x: 15, y: 10 },
          { x: 7, y: 17 },
          { x: -7, y: 17 },
          { x: -15, y: 10 },
        ],
        shell,
        edge,
      );
      line(c, { x: -12, y: 11 }, { x: -5, y: 15 }, accent, 2.5);
      line(c, { x: 5, y: 15 }, { x: 12, y: 11 }, accent, 2.5);
      circle(c, { x: 0, y: 0 }, 11, '#253136');
      circle(c, { x: 0, y: 0 }, 8, '#64716b');
      circle(c, { x: 0, y: 0 }, 5, dark);
      c.fillStyle = lamp;
      c.fillRect(-4, -13, 8, 2.5);
      for (const x of [-5, 0, 5]) line(c, { x, y: 7 }, { x, y: 12 }, '#b39c7d', 1.1);
    }
    wear(c, p, 32, dead);
  }
  c.restore();
  c.restore();
}

/** Does not translate, rotate the firing rig, or apply the outer native split-child scale. */
export function drawMachineBody(c: CanvasRenderingContext2D, g: Game, e: Enemy, reduced: boolean) {
  const snapshot = machineBodySnapshot(e, g.time, g);
  if (!snapshot) return false;
  drawMachineChassis(c, snapshot, reduced);
  return true;
}

// Small hull-local records complement the native sparks, without new emitters or hit claims.
export function drawMachineContacts(
  c: CanvasRenderingContext2D,
  g: Game,
  e: Enemy,
  reduced: boolean,
) {
  if (!isMachineKind(e.kind)) return;
  const scale = e.splitChild ? SPLIT_SCALE : 1,
    angle = e.body.angle,
    cos = Math.cos(angle),
    sin = Math.sin(angle);
  c.save();
  for (const hit of g.machineBreakdown.getHits(e.id)) {
    if (!hit.contact || (!hit.blocked && hit.healthLost <= 0)) continue;
    const age = g.time - hit.at;
    if (age < 0 || age >= 0.24) continue;
    const local = hit.contact.local,
      normal = hit.contact.normal,
      point = {
        x: (local.x * cos - local.y * sin) / scale,
        y: (local.x * sin + local.y * cos) / scale,
      },
      n = { x: normal.x * cos - normal.y * sin, y: normal.x * sin + normal.y * cos },
      tangent = { x: -n.y, y: n.x },
      block = hit.blocked || hit.absorbed > 0.5;
    c.save();
    c.globalAlpha *= clamp(1 - age / 0.24, 0, 1);
    if (block) {
      line(
        c,
        { x: point.x - tangent.x * 3, y: point.y - tangent.y * 3 },
        { x: point.x + tangent.x * 3, y: point.y + tangent.y * 3 },
        '#162228',
        4,
      );
      line(
        c,
        { x: point.x - tangent.x * 3, y: point.y - tangent.y * 3 },
        { x: point.x + tangent.x * 3, y: point.y + tangent.y * 3 },
        '#dfc69b',
        1.5,
      );
      if (!reduced)
        for (const side of [-1, 1])
          line(
            c,
            {
              x: point.x + n.x * 2 + tangent.x * side * 2,
              y: point.y + n.y * 2 + tangent.y * side * 2,
            },
            {
              x: point.x + n.x * 6 + tangent.x * side * 4,
              y: point.y + n.y * 6 + tangent.y * side * 4,
            },
            '#c1ad89',
            1,
          );
    } else {
      circle(c, point, 2.8, '#172327');
      line(
        c,
        { x: point.x - tangent.x * 2 - n.x, y: point.y - tangent.y * 2 - n.y },
        { x: point.x + tangent.x * 2 - n.x, y: point.y + tangent.y * 2 - n.y },
        '#b38d73',
        1.2,
      );
      if (!reduced)
        line(
          c,
          { x: point.x + n.x * 2, y: point.y + n.y * 2 },
          { x: point.x + n.x * 4, y: point.y + n.y * 4 },
          '#e9c5a1',
          1,
        );
    }
    c.restore();
  }
  c.restore();
}

/** A fixed detail pass inside the existing barrel silhouette; native ends and firing pivot stay untouched. */
export function drawMachineBarrelDetails(c: CanvasRenderingContext2D, e: Enemy, reduced: boolean) {
  if ((e.kind !== 'shooter' && e.kind !== 'flyer') || e.elite === 'volatile') return;
  const aim = e.allied ? e.aim : e.elite === 'shielded' ? { x: e.facing, y: 0 } : e.aim,
    brace = attackBrace(e),
    twin = e.elite === 'twin',
    collar = twin ? 34 : 26;
  c.save();
  if (e.squad?.kind === 'shield' && e.squad.role === 'support') c.translate(0, -34);
  c.rotate(Math.atan2(aim.y, aim.x));
  c.translate(-brace * 2, 0);
  for (const center of twin ? [-6, 6] : [0]) {
    line(
      c,
      { x: 16, y: center - (twin ? 1 : 2) },
      { x: collar - 2, y: center - (twin ? 1 : 2) },
      '#b7ad93',
      0.8,
    );
    line(
      c,
      { x: 16, y: center + (twin ? 1 : 2) },
      { x: collar - 1, y: center + (twin ? 1 : 2) },
      '#343e40',
      0.8,
    );
    c.fillStyle = e.flash > 0 && !reduced ? '#e2e7d8' : '#a6ac9b';
    c.fillRect(collar, center - (twin ? 1 : 2), 1.2, twin ? 2 : 4);
    for (const x of [18, 21]) line(c, { x, y: center - 1 }, { x, y: center + 1 }, '#503f38', 0.7);
  }
  c.restore();
}
