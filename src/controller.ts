export type Stick = { x: number; y: number };
export type MenuDirection = 'up' | 'down' | 'left' | 'right';
export type HapticKind = 'shot' | 'land' | 'hurt';
export interface ControllerSettings {
  moveDeadzone: number;
  aimDeadzone: number;
  rumble: boolean;
}
export function controllerSettings(value: unknown): ControllerSettings {
  const raw = (value && typeof value === 'object' ? value : {}) as Partial<ControllerSettings>;
  const zone = (n: unknown, fallback: number) =>
    typeof n === 'number' && Number.isFinite(n) ? Math.min(0.4, Math.max(0.05, n)) : fallback;
  return {
    moveDeadzone: zone(raw.moveDeadzone, 0.18),
    aimDeadzone: zone(raw.aimDeadzone, 0.16),
    rumble: raw.rumble !== false,
  };
}
export function stick(x: number, y: number, deadzone: number): Stick {
  x = Number.isFinite(x) ? Math.min(1, Math.max(-1, x)) : 0;
  y = Number.isFinite(y) ? Math.min(1, Math.max(-1, y)) : 0;
  const length = Math.hypot(x, y);
  if (length <= deadzone) return { x: 0, y: 0 };
  const magnitude = (Math.min(1, length) - deadzone) / (1 - deadzone);
  return { x: (x / length) * magnitude, y: (y / length) * magnitude };
}
export interface PadLike {
  index: number;
  id: string;
  connected: boolean;
  mapping: string;
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
  vibrationActuator?: {
    playEffect(type: 'dual-rumble', params: GamepadEffectParameters): Promise<unknown>;
    reset(): Promise<unknown>;
  } | null;
}
export interface ControllerFrame {
  connected: boolean;
  disconnected: boolean;
  activity: boolean;
  move: number;
  aim: Stick;
  jump: boolean;
  jumpHeld: boolean;
  fire: boolean;
  firePressed: boolean;
  portal: boolean;
  confirm: boolean;
  back: boolean;
  pause: boolean;
  navigation: MenuDirection | null;
}
const empty = (): ControllerFrame => ({
  connected: false,
  disconnected: false,
  activity: false,
  move: 0,
  aim: { x: 0, y: 0 },
  jump: false,
  jumpHeld: false,
  fire: false,
  firePressed: false,
  portal: false,
  confirm: false,
  back: false,
  pause: false,
  navigation: null,
});

/** Polls standard mappings only. Unmapped devices never commandeer the game. */
export class Controller {
  settings: ControllerSettings;
  pad: PadLike | null = null;
  private down: boolean[] = [];
  private armed: boolean[] = [];
  private previousSticks = [0, 0, 0, 0];
  private moveBlocked = true;
  private menuDirection: MenuDirection | null = null;
  private repeatAt = 0;
  private hapticUntil = 0;
  private hapticPriority = 0;
  private vibrating = false;
  private hapticFailed = false;
  private getPads: () => readonly (PadLike | null)[];
  constructor(
    settings: ControllerSettings,
    getPads = (): readonly (PadLike | null)[] =>
      typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [],
  ) {
    this.settings = settings;
    this.getPads = getPads;
  }
  /** A new room, focus change or dialog requires releases before held actions can resume. */
  disarm() {
    this.armed = [];
    this.moveBlocked = true;
    this.menuDirection = null;
    this.repeatAt = Infinity;
    this.stopRumble();
  }
  poll(now: number, active = true): ControllerFrame {
    let pads: readonly (PadLike | null)[] = [];
    try {
      pads = this.getPads();
    } catch {
      /* Browser policy may deny this API. */
    }
    const valid = pads.filter((p): p is PadLike => !!p && p.connected && p.mapping === 'standard');
    const pad =
      valid.find((p) => p.index === this.pad?.index && p.id === this.pad?.id) ?? valid[0] ?? null;
    const result = empty();
    if (pad?.index !== this.pad?.index || pad?.id !== this.pad?.id) {
      result.disconnected = !!this.pad;
      this.disarm();
      this.pad = pad;
      this.down = [];
      this.previousSticks = [0, 0, 0, 0];
      this.hapticFailed = false;
    } else this.pad = pad;
    if (!pad) return result;
    result.connected = true;
    const move = stick(pad.axes[0], pad.axes[1], this.settings.moveDeadzone);
    const aim = stick(pad.axes[2], pad.axes[3], this.settings.aimDeadzone);
    const axes = [move.x, move.y, aim.x, aim.y];
    const held: boolean[] = [],
      pressed: boolean[] = [];
    let buttonActivity = false;
    for (let i = 0; i < 17; i++) {
      const button = pad.buttons[i];
      // Hysteresis keeps analog triggers from retriggering around the threshold.
      const down = !!button && (button.pressed || button.value > (this.down[i] ? 0.35 : 0.55));
      buttonActivity ||= down && !this.down[i];
      held[i] = down && !!this.armed[i];
      pressed[i] = held[i] && !this.down[i];
      if (!down) this.armed[i] = true;
      this.down[i] = down;
    }
    const stickActivity = axes.some(
      (v, i) => Math.abs(v) > 0.12 && Math.abs(v - this.previousSticks[i]) > 0.08,
    );
    result.activity = active && (buttonActivity || stickActivity);
    // Use the last meaningful pose so a slow, deliberate sweep still takes control.
    if (stickActivity || axes.every((v) => Math.abs(v) < 0.1)) this.previousSticks = axes;
    if (!active) {
      this.disarm();
      return result;
    }
    if (Math.hypot(move.x, move.y) < 0.1) this.moveBlocked = false;
    const dpad = Number(held[15]) - Number(held[14]);
    result.move = dpad || (this.moveBlocked ? 0 : move.x);
    result.aim = aim;
    result.jump = pressed[0] || pressed[4];
    result.jumpHeld = held[0] || held[4];
    result.fire = held[7];
    result.firePressed = pressed[7];
    result.portal = pressed[6];
    result.confirm = pressed[0];
    result.back = pressed[1];
    result.pause = pressed[9];
    const navX = dpad || (this.moveBlocked ? 0 : move.x);
    const navY = Number(held[13]) - Number(held[12]) || (this.moveBlocked ? 0 : move.y);
    const nav =
      Math.max(Math.abs(navX), Math.abs(navY)) < 0.5
        ? null
        : Math.abs(navX) > Math.abs(navY)
          ? navX > 0
            ? 'right'
            : 'left'
          : navY > 0
            ? 'down'
            : 'up';
    if (!nav) {
      this.menuDirection = null;
      this.repeatAt = 0;
    } else if (nav !== this.menuDirection || now >= this.repeatAt) {
      result.navigation = nav;
      this.repeatAt = now + (nav === this.menuDirection ? 125 : 350);
      this.menuDirection = nav;
    }
    return result;
  }
  rumble(kind: HapticKind, strength: number, now: number) {
    const actuator = this.pad?.vibrationActuator;
    if (!this.settings.rumble || !actuator || this.hapticFailed || !Number.isFinite(strength))
      return;
    const priority = kind === 'hurt' ? 3 : kind === 'land' ? 2 : 1;
    // A rapid gun cannot erase a damage pulse or enqueue an unbounded effect stream.
    if (now < this.hapticUntil && priority <= this.hapticPriority) return;
    const amount = Math.max(0, Math.min(1, strength));
    const duration = kind === 'hurt' ? 135 : kind === 'land' ? 90 : 45;
    this.hapticUntil = now + duration;
    this.hapticPriority = priority;
    this.vibrating = true;
    try {
      void Promise.resolve(
        actuator.playEffect('dual-rumble', {
          duration,
          startDelay: 0,
          strongMagnitude: amount * (kind === 'shot' ? 0.12 : 0.5),
          weakMagnitude: amount * (kind === 'hurt' ? 0.6 : 0.28),
        }),
      ).catch(() => {
        if (this.pad?.vibrationActuator === actuator) this.hapticFailed = true;
      });
    } catch {
      this.hapticFailed = true;
    }
  }
  stopRumble() {
    this.hapticUntil = 0;
    if (!this.vibrating) return;
    this.vibrating = false;
    try {
      void Promise.resolve(this.pad?.vibrationActuator?.reset()).catch(() => {});
    } catch {
      /* Optional hardware. */
    }
  }
}
