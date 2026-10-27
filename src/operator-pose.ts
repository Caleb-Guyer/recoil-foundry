import type { Game } from './game.ts';
import { clamp, type Vec } from './rules.ts';
import { playerPose, pumpCycle } from './combat-feel.ts';
import { toolHandling } from './tool-handling.ts';

export type OperatorState = 'idle' | 'run' | 'brake' | 'jump' | 'launch' | 'fall' | 'landing';
export interface OperatorLimb {
  root: Vec;
  joint: Vec;
  end: Vec;
  planted: boolean;
  angle: number;
}
export interface OperatorPose {
  state: OperatorState;
  facing: 1 | -1;
  body: { x: number; y: number; angle: number; scaleX: number; scaleY: number; stride: number };
  legs: [OperatorLimb, OperatorLimb];
  arms: [OperatorLimb, OperatorLimb];
  weapon: { pivot: Vec; angle: number; kind: string; brace: number; grips: [Vec, Vec] };
  cloth: number;
}
const finite = (value: number, fallback = 0) => (Number.isFinite(value) ? value : fallback);
const unit = (value: number) => clamp(finite(value), 0, 1);
const part = (value: number) => ((value % 1) + 1) % 1;
const mix = (a: number, b: number, amount: number) => a + (b - a) * amount;
function transform(p: Vec, body: OperatorPose['body']): Vec {
  const x = p.x * body.scaleX,
    y = p.y * body.scaleY;
  return {
    x: body.x + x * Math.cos(body.angle) - y * Math.sin(body.angle),
    y: body.y + x * Math.sin(body.angle) + y * Math.cos(body.angle),
  };
}
/** A bounded two-link bend; endpoints remain at the real boot/weapon anchors. */
function limb(
  root: Vec,
  end: Vec,
  upper: number,
  lower: number,
  bend: number,
  planted = false,
  angle = 0,
): OperatorLimb {
  const dx = end.x - root.x,
    dy = end.y - root.y;
  const length = Math.max(0.001, Math.hypot(dx, dy));
  const reach = Math.min(length, upper + lower - 0.001);
  const along = clamp((upper * upper - lower * lower + reach * reach) / (2 * reach), 0, upper);
  const height = Math.sqrt(Math.max(0, upper * upper - along * along));
  return {
    root,
    end,
    joint: {
      x: root.x + (dx / length) * along - (dy / length) * height * bend,
      y: root.y + (dy / length) * along + (dx / length) * height * bend,
    },
    planted,
    angle,
  };
}
function foot(phase: number, speed: number, base: number, floor: number) {
  const t = part(phase);
  const stance = t < 0.6;
  const swing = stance ? 0 : (t - 0.6) / 0.4;
  // During stance, the local foot retreats exactly with the distance phase.
  // Its world position stays planted instead of being stretched like a piston.
  const strideX = stance ? 9 - 26 * t : mix(-6.6, 9, swing);
  const lift = Math.sin(swing * Math.PI) * 5.3;
  return {
    x: mix(base, strideX, speed),
    y: floor - lift * speed,
    planted: stance || speed < 0.08,
    angle: stance ? 0 : Math.sin(swing * Math.PI * 2) * 0.28,
  };
}
function tool(g: Game) {
  if (g.shiftMorphs.equipped) return g.shiftMorphs.equipped;
  if (g.torch.equipped) return 'beam';
  if (g.massDriver.equipped) return 'mass';
  if (g.gun.shellshock) return 'shell';
  return g.startingGun;
}
/** Derived cosmetic geometry only: no state, physics, timers or RNG are written. */
export function operatorPose(g: Game, reduced = false): OperatorPose {
  const time = finite(g.time),
    vx = clamp(finite(g.player.velocity.x), -40, 40),
    vy = clamp(finite(g.player.velocity.y), -40, 40);
  const dx = finite(g.aim.x - g.player.position.x, 1),
    dy = finite(g.aim.y - g.player.position.y);
  const aimAngle = Math.atan2(dy, dx);
  const facing: 1 | -1 = dx < 0 ? -1 : 1;
  const kind = tool(g);
  const heavy = [
    'shotgun',
    'carbine',
    'mass',
    'shell',
    'beam',
    'piston-lance',
    'seeker-rack',
  ].includes(kind);
  const age = Math.max(0, time - finite(g.lastShot, -100));
  const kick = unit(1 - age / (heavy ? 0.22 : 0.15)) ** 2;
  const landed = g.grounded
    ? unit(1 - (time - finite(g.combatFeel.landedAt, -100)) / 0.22) *
      unit(g.combatFeel.landingStrength)
    : 0;
  const surface = (
    g as Game & {
      operatorSurface?: {
        braking: number;
        contact: { point: Vec } | null;
      };
    }
  ).operatorSurface;
  const braking = g.grounded ? unit(surface?.braking ?? 0) : 0;
  const speed = unit(Math.abs(vx) / 5.5);
  const state: OperatorState = g.grounded
    ? landed > 0.12
      ? 'landing'
      : braking > 0.15
        ? 'brake'
        : speed > 0.12
          ? 'run'
          : 'idle'
    : kick > 0.08 && Math.abs(vx) + Math.abs(vy) > 4
      ? 'launch'
      : vy > 1.1
        ? 'fall'
        : 'jump';
  const original = playerPose(g, reduced);
  const phase = reduced ? 0.15 : finite(g.player.position.x) / 26;
  const motion = reduced ? 0 : 1;
  const breath = g.grounded ? Math.sin(time * 2.4) * 0.22 * (1 - speed) * (1 - landed) * motion : 0;
  const body = {
    x: clamp(finite(original.x), -3, 3) - Math.sign(vx) * braking * 1.3 * motion,
    y: clamp(finite(original.y), -4, 5) + landed * 1.7 * motion + breath,
    angle: clamp(
      finite(original.angle) * 1.25 - Math.sign(vx) * braking * 0.12 * motion,
      -0.22,
      0.22,
    ),
    scaleX: clamp(finite(original.scaleX, 1), 0.88, 1.15),
    scaleY: clamp(finite(original.scaleY, 1), 0.82, 1.15),
    stride: finite(original.stride),
  };
  const floor =
    g.grounded && surface?.contact
      ? clamp(finite(surface.contact.point.y - g.player.position.y, 18), 15, 21)
      : 18;
  const steps = [foot(phase, speed, -5, floor), foot(phase + 0.5, speed, 5, floor)];
  if (!g.grounded) {
    const rise = unit(-vy / 10),
      fall = unit(vy / 12);
    steps[0] = {
      x: -facing * (5 + rise * 5) - vx * 0.08,
      y: 11 + fall * 5,
      planted: false,
      angle: -facing * 0.25,
    };
    steps[1] = {
      x: facing * (5 + fall * 3) - vx * 0.1,
      y: 15 - rise * 5 + fall * 3,
      planted: false,
      angle: facing * 0.2,
    };
  } else if (braking > 0.15) {
    steps[0] = { x: -Math.sign(vx) * (8 + braking * 2), y: floor, planted: true, angle: 0 };
    steps[1] = { x: Math.sign(vx) * 6, y: floor, planted: true, angle: 0 };
  }
  const legs = steps.map((step, index) =>
    limb(
      transform({ x: index ? 4 : -4, y: 5.5 }, body),
      { x: step.x, y: step.y - 2 },
      8.8,
      9.3,
      index ? -facing : facing,
      step.planted,
      step.angle,
    ),
  ) as OperatorPose['legs'];
  const pump =
    kind === 'shotgun'
      ? pumpCycle(time - finite(g.combatFeel.pumpStartedAt, -100), finite(g.gun.interval, 0.2)) *
        (reduced ? 1 : 7)
      : 0;
  const front =
    kind === 'pistol'
      ? 15
      : kind === 'beam' || kind === 'mass'
        ? 24
        : kind === 'piston-lance' || kind === 'cable-saw' || kind === 'foamcaster'
          ? 17
          : kind === 'seeker-rack'
            ? 19
            : kind === 'carbine'
              ? 27
              : 23;
  const handling = toolHandling(g);
  const nativeHeavy =
    g.mods.includes('magnum') || g.massDriver.equipped || handling.native === 'carbine';
  const flash = unit((handling.native ? 0.065 - age : finite(g.muzzle)) / 0.065);
  const spring = unit(1 - age / (nativeHeavy ? 0.18 : 0.11));
  const punch = Math.max(flash, spring * spring);
  const receiver =
    g.shiftMorphs.equipped || g.torch.equipped
      ? 0
      : punch * (kind === 'shotgun' ? 4.2 : nativeHeavy ? 2.2 : 2.8) * (reduced ? 0.16 : 1);
  const grips: [Vec, Vec] = [
    { x: 10 - receiver, y: 6 },
    { x: front - pump - receiver, y: 5.5 },
  ];
  const hand = (p: Vec): Vec => ({
    x: Math.cos(aimAngle) * p.x - Math.sin(aimAngle) * p.y,
    y: -3 + Math.sin(aimAngle) * p.x + Math.cos(aimAngle) * p.y,
  });
  // Far support hand and near trigger hand, bent away from the visor.
  const arms: OperatorPose['arms'] = [
    limb(transform({ x: -facing * 7, y: -1 }, body), hand(grips[1]), 16, 17, facing),
    limb(transform({ x: facing * 8, y: -1 }, body), hand(grips[0]), 11, 12.5, facing),
  ];
  return {
    state,
    facing,
    body,
    legs,
    arms,
    weapon: {
      pivot: { x: 0, y: -3 },
      angle: aimAngle,
      kind,
      brace: heavy ? kick : kick * 0.65,
      grips,
    },
    cloth: motion * clamp(vx * 0.08 + Math.sin(time * 3 + phase) * speed * 0.18, -1, 1),
  };
}
