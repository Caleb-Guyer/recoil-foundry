import type { Game } from './game.ts';
import { ENEMY_STATS } from './enemies.ts';
import type { Vec } from './rules.ts';
import { drawMachineChassis } from './machine-breakdown-art.ts';
import { drawSpecialistMachineWreck } from './specialist-machine-wreck-art.ts';
import { drawHeavyMachineWreck } from './heavy-machine-wreck-art.ts';
import { drawSupportMachineWreck } from './support-machine-wreck-art.ts';
import { drawHazardMachineWreck } from './hazard-machine-wreck-art.ts';
import { drawDistrictMachineWreck } from './district-machine-wreck-art.ts';
import {
  machinePose,
  type MachineBodySnapshot,
  type MachinePose,
} from './machine-breakdown-pose.ts';
import {
  MACHINE_MAX_WRECKS,
  MACHINE_SHUTDOWN,
  MACHINE_WRECK_LIFETIME,
  type MachineWreck,
  type MachineLanding,
} from './machine-breakdown.ts';

const unit = (n: number) => Math.max(0, Math.min(1, n));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const point = (a: Vec, b: Vec, t: number): Vec => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) });
const finite = (...n: number[]) => n.every(Number.isFinite);
const smooth = (t: number) => 1 - (1 - unit(t)) ** 3;
export interface MachineWreckProjection {
  age: number;
  alpha: number;
  position: Vec;
  settled: boolean;
  fold: number;
}

/** Read-only visual descent to an actual captured support, never an assumed floor. */
export function projectMachineWreck(
  wreck: MachineWreck,
  time: number,
  reduced = false,
): MachineWreckProjection | null {
  const s = wreck.visual,
    age = time - wreck.at;
  if (
    !finite(
      time,
      wreck.at,
      wreck.lifetime,
      wreck.shutdown,
      s.position.x,
      s.position.y,
      s.velocity.x,
      s.velocity.y,
      s.scale,
    ) ||
    wreck.shutdown <= 0 ||
    s.scale <= 0 ||
    age < 0
  )
    return null;
  const supported = wreck.landing;
  if (
    supported &&
    !finite(
      supported.center.x,
      supported.center.y,
      supported.point.x,
      supported.point.y,
      supported.normal.x,
      supported.normal.y,
    )
  )
    return null;
  const lifetime = Math.min(
    wreck.lifetime,
    MACHINE_WRECK_LIFETIME,
    reduced ? 0.9 : supported ? MACHINE_WRECK_LIFETIME : 0.75,
  );
  if (age >= lifetime || lifetime <= 0) return null;
  const fade = reduced ? 0.3 : supported ? 0.65 : 0.45;
  let alpha = 0.78 * unit((lifetime - age) / fade);
  let position: Vec,
    settled = false;
  if (supported) {
    // The model shortens lifetime to 0.16s after a real support disappears.
    // Freeze that last supported position and fade instead of inventing a floor.
    const projectedAge = supported.available
      ? age
      : Math.min(age, Math.max(0, wreck.lifetime - 0.16));
    if (!supported.available) alpha = Math.min(alpha, 0.78 * unit((lifetime - age) / 0.16));
    const drop = Math.max(0, supported.center.y - s.position.y);
    const settleAt = Math.min(0.8, Math.max(wreck.shutdown, 0.16 + Math.sqrt(drop / 1000)));
    const travel = reduced ? 1 : unit(projectedAge / settleAt);
    position = {
      x: mix(s.position.x, supported.center.x, 1 - (1 - travel) ** 2),
      y: mix(s.position.y, supported.center.y, travel ** 2),
    };
    settled = travel === 1 && supported.available;
  } else {
    // Unsupported wreckage falls only a short visual distance while fading.
    // No WORLD.floor, terrain mutation, collision body or off-screen teleport.
    const travel = reduced ? 0 : Math.min(age, 0.6);
    position = {
      x: s.position.x + s.velocity.x * Math.min(travel, 0.3) * 4,
      y: s.position.y + Math.max(0, s.velocity.y) * travel * 4 + 24 * travel ** 2,
    };
  }
  return { age, alpha, position, settled, fold: reduced ? 1 : smooth(age / wreck.shutdown) };
}

/** Buckled knees, collapsed stabilizers and a rotor that loses speed, all from one native rig. */
export function machineShutdownPose(
  s: MachineBodySnapshot,
  age: number,
  reduced = false,
  shutdown = MACHINE_SHUTDOWN,
): MachinePose {
  const duration = Number.isFinite(shutdown) ? Math.max(0.01, shutdown) : MACHINE_SHUTDOWN;
  const elapsed = Number.isFinite(age) ? Math.max(0, age) : 0;
  const start = machinePose({ ...s, flash: 0 }, reduced),
    f = start.forward;
  const t = reduced ? 1 : smooth(elapsed / duration);
  const floor = ENEMY_STATS[s.kind].h / 2 - 1;
  const body =
    s.kind === 'runner'
      ? { x: f * 2.8, y: 6.4 }
      : s.kind === 'shooter'
        ? { x: f * 1.8, y: 4.6 }
        : { x: f * 1.6, y: 0.6 };
  const stoppedAt = Math.min(elapsed, duration);
  const rotor = start.rotor + 18 * (stoppedAt - (stoppedAt * stoppedAt) / (2 * duration));
  return {
    ...start,
    wear: 2,
    brace: 0,
    recover: false,
    receiver: 0,
    body: point(start.body, body, t),
    angle: mix(
      start.angle,
      f * (s.kind === 'runner' ? 0.28 : s.kind === 'shooter' ? 0.13 : 0.14),
      t,
    ),
    rotor: reduced ? start.rotor + 9 * duration : rotor,
    legs: start.legs.map((leg, index) => {
      const side = index ? 1 : -1;
      const hip = { x: body.x + side * (s.kind === 'runner' ? 5 : 7), y: body.y + 4 };
      const knee = {
        x: side * (s.kind === 'runner' ? 12 : 15) + f * 1.8,
        y: floor - (s.kind === 'runner' ? 1.5 : 2.8),
      };
      const foot = { x: side * (s.kind === 'runner' ? 6 : 8) + f * 2, y: floor };
      return {
        hip: point(leg.hip, hip, t),
        knee: point(leg.knee, knee, t),
        foot: point(leg.foot, foot, t),
        planted: t > 0.8,
      };
    }),
  };
}
function line(c: CanvasRenderingContext2D, a: Vec, b: Vec, color: string, width: number) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(a.x, a.y);
  c.lineTo(b.x, b.y);
  c.stroke();
}
/** Clip only against the real upward support plane. Foreground collision remains untouched. */
function supportClip(
  c: CanvasRenderingContext2D,
  landing: MachineLanding,
  position: Vec,
  scale: number,
) {
  if (!landing.available) return;
  const length = Math.hypot(landing.normal.x, landing.normal.y);
  if (length < 0.5) return;
  const n = { x: landing.normal.x / length, y: landing.normal.y / length },
    tangent = { x: -n.y, y: n.x };
  const p = {
    x: (landing.point.x - position.x) / scale,
    y: (landing.point.y - position.y) / scale,
  };
  const reach = Math.min(8192, Math.max(128, Math.abs(p.x) + Math.abs(p.y) + 96));
  c.beginPath();
  c.moveTo(p.x + tangent.x * reach, p.y + tangent.y * reach);
  c.lineTo(p.x - tangent.x * reach, p.y - tangent.y * reach);
  c.lineTo(p.x - tangent.x * reach + n.x * reach * 2, p.y - tangent.y * reach + n.y * reach * 2);
  c.lineTo(p.x + tangent.x * reach + n.x * reach * 2, p.y + tangent.y * reach + n.y * reach * 2);
  c.closePath();
  c.clip();
}
function droppedBarrel(
  c: CanvasRenderingContext2D,
  s: MachineBodySnapshot,
  p: MachinePose,
  fold: number,
) {
  const start = Math.atan2(s.aim.y, s.aim.x),
    target = p.forward > 0 ? 0.25 : Math.PI - 0.25;
  const delta = Math.atan2(Math.sin(target - start), Math.cos(target - start));
  c.save();
  c.translate(p.body.x, p.body.y - 1);
  c.rotate(start + delta * fold);
  const rows = s.elite === 'twin' ? [-5, 4] : [-2.5];
  for (const y of rows) {
    c.fillStyle = '#354345';
    c.fillRect(5, y, s.elite === 'twin' ? 29 : 22, s.elite === 'twin' ? 4 : 5);
    c.fillStyle = s.allied ? '#526872' : '#6d6258';
    c.fillRect(8, y, 13, 1.5);
    c.fillStyle = '#1b292d';
    c.fillRect(s.elite === 'twin' ? 31 : 24, y, 3, s.elite === 'twin' ? 4 : 5);
  }
  c.restore();
}
function failedRotor(
  c: CanvasRenderingContext2D,
  s: MachineBodySnapshot,
  p: MachinePose,
  fold: number,
) {
  const side = s.id % 2 ? 1 : -1;
  c.save();
  c.translate(p.body.x, p.body.y);
  c.rotate(p.angle);
  const hub = { x: side * 24, y: -8 };
  // A dark broken hub replaces one blade cross; the exact native duct stays.
  c.fillStyle = '#263337';
  c.beginPath();
  c.ellipse(hub.x, hub.y, 6.6 * fold, 3.4 * fold, 0, 0, Math.PI * 2);
  c.fill();
  if (fold > 0) {
    line(c, hub, { x: hub.x + side * 4, y: hub.y + 1.3 }, '#66716c', 1.4);
    line(c, hub, { x: hub.x - side * 2, y: hub.y - 1 }, '#495956', 1.2);
  }
  c.restore();
  const cos = Math.cos(p.angle),
    sin = Math.sin(p.angle);
  const from = { x: p.body.x + hub.x * cos - hub.y * sin, y: p.body.y + hub.x * sin + hub.y * cos };
  const end = { x: side * 28, y: ENEMY_STATS.flyer.h / 2 - 3 };
  const at = point(from, end, fold);
  c.save();
  c.translate(at.x, at.y);
  c.rotate(side * fold * 0.8);
  c.fillStyle = '#435550';
  c.fillRect(-6, -1, 12, 2);
  c.fillStyle = '#727b6c';
  c.fillRect(-4, -1, 5, 0.8);
  c.restore();
}
function inertIdentity(
  c: CanvasRenderingContext2D,
  s: MachineBodySnapshot,
  p: MachinePose,
  fold: number,
) {
  if (s.elite === 'shielded') {
    const f = s.facing < 0 ? -1 : 1;
    c.save();
    c.translate(mix(f * 23, f * 8, fold), mix(0, 10, fold));
    c.rotate(((f * Math.PI) / 2) * fold);
    c.fillStyle = '#344242';
    c.strokeStyle = '#69716b';
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(-5, -23);
    c.lineTo(5, -18);
    c.lineTo(5, 18);
    c.lineTo(-5, 23);
    c.closePath();
    c.fill();
    c.stroke();
    line(c, { x: 1, y: -14 }, { x: 1, y: 14 }, '#4e5a56', 2.5);
    c.restore();
  }
  if (!s.mutation && !s.squad?.connected) return;
  c.save();
  c.translate(p.body.x, p.body.y);
  c.rotate(p.angle);
  if (s.mutation?.kind === 'blinker') {
    for (const side of [-1, 1]) {
      line(c, { x: side * 12, y: -11 }, { x: side * 19, y: -6 }, '#6d657b', 2);
      line(c, { x: side * 19, y: -6 }, { x: side * 17, y: 5 }, '#6d657b', 2);
    }
  } else if (s.mutation?.kind === 'splitter') {
    line(c, { x: 0, y: -12 }, { x: -3, y: -4 }, '#9b8165', 1.5);
    line(c, { x: -3, y: -4 }, { x: 3, y: 3 }, '#9b8165', 1.5);
  } else if (s.mutation?.kind === 'gunner') {
    c.fillStyle = '#514838';
    c.fillRect(-21, -9, 7, 17);
    c.fillStyle = '#776548';
    c.fillRect(-20, -7, 4, 7);
  }
  if (s.squad?.connected) {
    c.fillStyle =
      s.squad.kind === 'shield' ? '#6c6554' : s.squad.kind === 'flank' ? '#5e6d65' : '#796354';
    c.fillRect(-7, 7, 4, 2);
    c.fillRect(3, 7, 4, 2);
  }
  c.restore();
}

/** Noncolliding shared chassis; no warning, health bar, light, sound or gameplay callback. */
export function drawMachineWreck(
  c: CanvasRenderingContext2D,
  wreck: MachineWreck,
  time: number,
  reduced = false,
): boolean {
  const projection = projectMachineWreck(wreck, time, reduced);
  if (!projection || projection.alpha <= 0) return false;
  const s = wreck.visual;
  c.save();
  c.translate(projection.position.x, projection.position.y);
  c.scale(s.scale, s.scale);
  c.globalAlpha *= projection.alpha;
  if (wreck.landing) supportClip(c, wreck.landing, projection.position, s.scale);
  const district = drawDistrictMachineWreck(c, wreck, projection, reduced);
  if (district) {
    inertIdentity(c, s, district, projection.fold);
    c.restore();
    return true;
  }
  const hazard = drawHazardMachineWreck(c, wreck, projection, reduced);
  if (hazard) {
    inertIdentity(c, s, hazard, projection.fold);
    c.restore();
    return true;
  }
  const support = drawSupportMachineWreck(c, wreck, projection, reduced);
  if (support) {
    inertIdentity(c, s, support, projection.fold);
    c.restore();
    return true;
  }
  const heavy = drawHeavyMachineWreck(c, wreck, projection, reduced);
  if (heavy) {
    inertIdentity(c, s, heavy, projection.fold);
    c.restore();
    return true;
  }
  const specialist = drawSpecialistMachineWreck(c, wreck, projection, reduced);
  if (specialist) {
    inertIdentity(c, s, specialist, projection.fold);
    c.restore();
    return true;
  }
  const pose = machineShutdownPose(s, projection.age, reduced, wreck.shutdown);
  const inactive: MachineBodySnapshot = {
    ...s,
    hp: 0,
    flash: 0,
    brace: 0,
    timer: 0,
    state: 'recover',
    velocity: { x: 0, y: 0 },
  };
  drawMachineChassis(c, inactive, reduced, pose);
  if (s.kind === 'shooter') droppedBarrel(c, s, pose, projection.fold);
  else if (s.kind === 'flyer') failedRotor(c, s, pose, projection.fold);
  inertIdentity(c, s, pose, projection.fold);
  c.restore();
  return true;
}
export function drawMachineWrecks(c: CanvasRenderingContext2D, game: Game, reduced = false) {
  for (const wreck of game.machineBreakdown.wrecks.slice(-MACHINE_MAX_WRECKS))
    drawMachineWreck(c, wreck, game.time, reduced);
}
