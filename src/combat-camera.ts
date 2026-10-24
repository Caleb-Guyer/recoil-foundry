import type { Vec } from './rules.ts';

export const CAMERA_MODES = {
  follow: {
    label: 'Follow',
    description: 'Anticipates climbs and falls. Opens the view slightly during fast movement.',
  },
  steady: {
    label: 'Steady',
    description: 'Fixed zoom with a gentle follow. Less camera motion while fighting.',
  },
  wide: {
    label: 'Wide',
    description: 'A consistently wider view of the room, with a gentle follow.',
  },
} as const;
export type CameraMode = keyof typeof CAMERA_MODES;
export function loadCameraMode(raw: unknown): CameraMode {
  return typeof raw === 'string' && Object.hasOwn(CAMERA_MODES, raw)
    ? (raw as CameraMode)
    : 'follow';
}

export interface CombatCameraInput {
  width: number;
  height: number;
  worldWidth: number;
  worldTop: number;
  worldBottom?: number;
  player: Vec;
  velocity: Vec;
  aim: Vec;
  mode?: CameraMode;
  centered?: boolean;
}
export interface CombatCameraFrame extends Vec {
  scale: number;
}
const finite = (n: number, fallback = 0) => (Number.isFinite(n) ? n : fallback);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const deadzone = (n: number, threshold: number) =>
  Math.sign(n) * Math.max(0, Math.abs(n) - threshold);

export function cameraFrameDelta(now: number, previous: number) {
  return Number.isFinite(now) && Number.isFinite(previous)
    ? clamp((now - previous) / 1000, 0, 0.05)
    : 0;
}
export function cameraBaseScale(height: number) {
  return clamp(Math.max(1, finite(height, 830)) / 830, 0.55, 1.6);
}

function bounds(input: CombatCameraInput) {
  const width = Math.max(1, finite(input.width, 1)),
    height = Math.max(1, finite(input.height, 1));
  const worldWidth = Math.max(1, finite(input.worldWidth, 2000));
  const top = finite(input.worldTop),
    bottom = Math.max(top + 1, finite(input.worldBottom ?? 835, 835));
  return {
    width,
    height,
    worldWidth,
    top,
    bottom,
    minimum: Math.max(width / worldWidth, height / (bottom - top)),
  };
}

export function combatCameraScale(input: CombatCameraInput) {
  const b = bounds(input),
    mode = loadCameraMode(input.mode);
  const speed = Math.hypot(finite(input.velocity.x), finite(input.velocity.y));
  const motion = clamp((speed - 8) / 17, 0, 1);
  const factor = mode === 'wide' ? 0.9 : mode === 'steady' ? 1 : 1 - motion * 0.08;
  return Math.max(b.minimum, cameraBaseScale(b.height) * 1.1 * factor);
}

export function combatCameraTarget(
  input: CombatCameraInput,
  scale = combatCameraScale(input),
): CombatCameraFrame {
  const b = bounds(input);
  scale = Math.max(b.minimum, finite(scale, combatCameraScale(input)));
  const w = b.width / scale,
    h = b.height / scale;
  const px = finite(input.player.x),
    py = finite(input.player.y, 700);
  const vx = finite(input.velocity.x),
    vy = finite(input.velocity.y);
  // Preserve the original horizontal aiming/velocity lead exactly. Vertical
  // anticipation ignores tiny grounded velocities and has a firm world cap.
  const leadX = clamp((finite(input.aim.x, px) - px) * 0.1, -95, 125) + vx * 5;
  const mode = loadCameraMode(input.mode);
  const leadY =
    mode === 'follow'
      ? clamp(deadzone(vy, 2.5) * 5, -78, 94)
      : clamp(deadzone(vy, 4) * 1.2, -20, 26);
  return {
    x: clamp(
      input.centered && w >= 780 ? b.worldWidth / 2 - w / 2 : px - w * 0.42 + leadX,
      0,
      Math.max(0, b.worldWidth - w),
    ),
    y: clamp(py - h * 0.58 + leadY, b.top, Math.max(b.top, b.bottom - h)),
    scale,
  };
}

// Hard bounds and a small emergency guard are separate from anticipation: a
// teleport or one late frame cannot leave the player outside the view while
// the camera catches up. No aim/velocity state is written back to gameplay.
export function boundCombatCamera(
  frame: CombatCameraFrame,
  input: CombatCameraInput,
): CombatCameraFrame {
  const b = bounds(input),
    scale = Math.max(b.minimum, finite(frame.scale, combatCameraScale(input)));
  const w = b.width / scale,
    h = b.height / scale;
  const mx = Math.min(125, w * 0.18),
    my = Math.min(95, h * 0.17);
  const px = finite(input.player.x, w / 2),
    py = finite(input.player.y, b.top + h / 2);
  return {
    x:
      input.centered && w >= 780
        ? clamp(finite(frame.x), 0, Math.max(0, b.worldWidth - w))
        : clamp(clamp(finite(frame.x), px - w + mx, px - mx), 0, Math.max(0, b.worldWidth - w)),
    y: clamp(
      clamp(finite(frame.y, b.top), py - h + my, py - my),
      b.top,
      Math.max(b.top, b.bottom - h),
    ),
    scale,
  };
}

export function advanceCombatCamera(
  previous: CombatCameraFrame,
  input: CombatCameraInput,
  dt: number,
  snap = false,
): CombatCameraFrame {
  dt = clamp(finite(dt), 0, 0.05);
  const targetScale = combatCameraScale(input),
    b = bounds(input);
  const oldScale = Math.max(b.minimum, finite(previous.scale, targetScale));
  const scale = oldScale + (targetScale - oldScale) * (snap ? 1 : 1 - Math.exp(-dt * 2.6));
  const target = combatCameraTarget(input, scale);
  const follow = snap ? 1 : 1 - Math.exp(-dt * 9);
  return boundCombatCamera(
    {
      x: finite(previous.x, target.x) + (target.x - finite(previous.x, target.x)) * follow,
      y: finite(previous.y, target.y) + (target.y - finite(previous.y, target.y)) * follow,
      scale,
    },
    input,
  );
}
