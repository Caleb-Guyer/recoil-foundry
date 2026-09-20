import type { Game, Input } from './game.ts';
import { DEFAULT_BINDINGS, bindingLabel, keyLabel, type Bindings } from './keyboard.ts';

export const FIRST_SESSION_KEY = 'rf-first-session-v1';
export type ControlDevice = 'keyboard' | 'controller' | 'touch';

// Presentation only: observes the real simulation without changing a run.
export class FirstSessionGuide {
  active = false;
  warmup = false;
  moved = false;
  jumped = false;
  fired = false;
  recoiled = false;
  hit = false;
  private originX = 0;
  private shots = 0;
  private kills = 0;
  private cue = '';
  private cueAt = 0;
  start(g: Game, warmup = false) {
    this.active = true;
    this.warmup = warmup;
    this.moved = this.jumped = this.fired = this.recoiled = this.hit = false;
    this.originX = g.player.position.x;
    this.shots = g.shotCount;
    this.kills = g.kills;
    this.cue = '';
    this.cueAt = g.time;
  }
  stop() {
    this.active = this.warmup = false;
  }
  get complete() {
    return this.moved && this.jumped && this.fired && this.recoiled && (!this.warmup || this.hit);
  }
  observe(g: Game, input: Input) {
    if (!this.active || g.mode !== 'playing') return;
    this.moved ||= Math.abs(g.player.position.x - this.originX) > 70;
    this.jumped ||= !!input.jump && !g.grounded && g.player.velocity.y < -2;
    const emitted = g.shotCount > this.shots;
    this.fired ||= emitted;
    this.recoiled ||=
      emitted &&
      !g.grounded &&
      input.aim.y > g.player.position.y + 60 &&
      Math.abs(input.aim.x - g.player.position.x) < input.aim.y - g.player.position.y &&
      g.player.velocity.y < -3;
    this.hit ||= g.kills > this.kills;
    this.shots = g.shotCount;
  }
  message(g: Game, device: ControlDevice, bindings: Bindings = DEFAULT_BINDINGS) {
    if (!this.active || g.mode !== 'playing') return '';
    if (
      !this.warmup &&
      (g.stage !== 0 || g.practice || g.testRun || g.workshop.active || g.overtime)
    )
      return '';
    const key =
      !this.warmup && g.clear
        ? 'exit'
        : !this.moved
          ? 'move'
          : !this.jumped
            ? 'jump'
            : !this.fired
              ? 'fire'
              : !this.recoiled
                ? 'recoil'
                : this.warmup && !this.hit
                  ? 'target'
                  : 'done';
    if (key !== this.cue) {
      this.cue = key;
      this.cueAt = g.time;
    }
    // Quiet after a brief hint. Controls and the safe warm-up remain available.
    if (!this.warmup && (key === 'done' || g.time - this.cueAt > 7)) return '';
    const text: Record<string, string> = {
      move:
        device === 'controller'
          ? 'Left stick to move.'
          : device === 'touch'
            ? 'Use the left arrows to move.'
            : `${keyLabel(bindings.left[0])} / ${keyLabel(bindings.right[0])} to move.`,
      jump:
        device === 'controller'
          ? 'LB / L1 or A / ✕ to jump.'
          : device === 'touch'
            ? 'Tap ↑ to jump.'
            : `${keyLabel(bindings.jump[0])} to jump.`,
      fire:
        device === 'controller'
          ? 'Right stick aims. Hold RT / R2 to fire.'
          : device === 'touch'
            ? 'Hold the right side to aim and fire.'
            : 'Aim with the mouse. Hold left click to fire.',
      recoil: 'Jump, aim down, and fire to climb.',
      target: 'Try your gun on a target.',
      exit: 'Room clear. Follow the lit door to the right →',
      done: 'Ready when you are. Done returns to the menu.',
    };
    return text[key];
  }
}

export function audioState(sound: boolean, music: boolean, effectsVolume = 1, musicVolume = 1) {
  const muted = !sound || (effectsVolume === 0 && (!music || musicVolume === 0));
  return {
    sound: sound ? 'On' : 'Off',
    music: !music ? 'Off' : sound && musicVolume > 0 ? 'On' : 'Muted',
    note: !sound
      ? 'Audio is off. Enable Sound for effects and music.'
      : muted
        ? 'Both channels are muted. Raise a volume to hear audio.'
        : '',
    settings: muted ? 'Settings · Muted' : 'Settings',
  };
}

export function controlsIntro(device: ControlDevice, bindings: Bindings = DEFAULT_BINDINGS) {
  const rows =
    device === 'controller'
      ? [
          ['Move', 'Left stick'],
          ['Jump', 'LB / L1 or A / ✕'],
          ['Aim', 'Right stick'],
          ['Fire', 'RT / R2'],
          ['Pause', 'Start / Options'],
        ]
      : device === 'touch'
        ? [
            ['Move', 'Left arrows'],
            ['Jump', '↑ button'],
            ['Aim & fire', 'Hold the right side'],
            ['Pause', 'Ⅱ button'],
          ]
        : [
            ['Move', `${bindingLabel(bindings, 'left')} · ${bindingLabel(bindings, 'right')}`],
            ['Jump', bindingLabel(bindings, 'jump')],
            ['Aim', 'Mouse'],
            ['Fire', 'Hold left click or ' + bindingLabel(bindings, 'fire')],
            ['Pause', 'Esc or ' + bindingLabel(bindings, 'pause')],
            ['Controls', bindingLabel(bindings, 'controls')],
          ];
  return (
    '<dl class="control-grid">' +
    rows.map(([label, key]) => `<div><dt>${label}</dt><dd>${key}</dd></div>`).join('') +
    '</dl>'
  );
}
