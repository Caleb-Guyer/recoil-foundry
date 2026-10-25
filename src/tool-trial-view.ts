import type { Game, Input } from './game.ts';
import type { ControllerFrame } from './controller.ts';
import { bindingLabel, held, matches, type Bindings } from './keyboard.ts';
import { escapeLogbook } from './html.ts';
import { Renderer } from './render.ts';
import { drawWeapon } from './weapon-art.ts';
import { STARTING_GUNS, type StartingGun } from './starting-guns.ts';
import { ToolTrial, type ToolTrialScene } from './tool-trial.ts';

export interface ToolTrialViewOptions {
  bindings: Bindings;
  back: () => void;
  sound: Game['onSound'];
  unlockAudio?: () => void;
  stopAudio?: () => void;
}
export class ToolTrialView {
  private trial: ToolTrial;
  private renderer: Renderer;
  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly closeup: HTMLCanvasElement;
  private readonly options: ToolTrialViewOptions;
  private readonly abort = new AbortController();
  private readonly gun: StartingGun;
  private readonly scene: ToolTrialScene;
  private keys = new Set<string>();
  private pointer: { x: number; y: number } | null = null;
  private pointerId: number | null = null;
  private firing = false;
  private jump = false;
  private firePressed = false;
  private touch = { left: false, right: false, jump: false };
  private padAim = { x: 1, y: 0 };
  private padActive = false;
  private padFiring = false;
  private accumulator = 0;
  private renderedAt = -1000;
  private running = true;
  private stopped = false;
  get game() {
    return this.trial.game;
  }
  get isPlaying() {
    return !this.stopped && this.running && this.game.mode === 'playing';
  }
  get isFiring() {
    return (
      this.isPlaying &&
      (this.firing || this.padFiring || held(this.options.bindings, 'fire', this.keys))
    );
  }
  constructor(
    root: HTMLElement,
    gun: StartingGun,
    options: ToolTrialViewOptions,
    scene: ToolTrialScene = 'range',
  ) {
    this.root = root;
    this.gun = gun;
    this.scene = scene;
    this.options = options;
    const info = STARTING_GUNS[gun],
      b = options.bindings;
    root.innerHTML =
      '<div class="tool-trial-header"><div><p class="eyebrow">TRY TOOL</p><h2 id="dialog-title">' +
      info.name +
      '.</h2></div><button class="quiet" data-tool-trial-back>Back to tools</button></div>' +
      '<div class="tool-trial-summary"><p>' +
      (scene === 'converted'
        ? 'Scattershot + Cutting Torch. The conversion keeps this tool’s native firing pattern.'
        : info.description) +
      '</p><canvas class="tool-trial-mechanism" width="420" height="140" aria-label="Live close-up of the actual weapon mechanism"></canvas></div>' +
      '<p class="tool-trial-scope">Private range · no rewards or saved progress. Targets return after you destroy them.</p>' +
      '<canvas class="tool-trial-canvas" tabindex="0" aria-label="' +
      info.name +
      ' practice range" aria-describedby="tool-trial-controls"></canvas>' +
      '<p id="tool-trial-controls" class="tool-trial-controls">Aim with the mouse; hold click or ' +
      escapeLogbook(bindingLabel(b, 'fire')) +
      ' to fire. ' +
      escapeLogbook(bindingLabel(b, 'left') + ' / ' + bindingLabel(b, 'right')) +
      ' move · ' +
      escapeLogbook(bindingLabel(b, 'jump')) +
      ' jump. Controller: right stick aim, trigger fire. Touch: hold and drag in the range.</p>' +
      '<div class="tool-trial-touch"><button data-tool-trial-touch="left" aria-label="Move left">←</button><button data-tool-trial-touch="right" aria-label="Move right">→</button><button data-tool-trial-touch="jump" aria-label="Jump">↑</button></div>' +
      '<div class="actions"><button class="quiet" data-tool-trial-toggle>Pause range</button><button class="quiet" data-tool-trial-reset>Reset range</button><span class="tool-trial-status" role="status" aria-live="polite">Range ready.</span></div>';
    this.canvas = root.querySelector<HTMLCanvasElement>('.tool-trial-canvas')!;
    this.closeup = root.querySelector<HTMLCanvasElement>('.tool-trial-mechanism')!;
    this.trial = new ToolTrial(gun, scene);
    this.trial.game.onSound = options.sound;
    this.renderer = new Renderer(this.canvas, this.game);
    const events = { signal: this.abort.signal };
    root
      .querySelector<HTMLButtonElement>('[data-tool-trial-back]')!
      .addEventListener('click', () => this.back(), events);
    root
      .querySelector<HTMLButtonElement>('[data-tool-trial-toggle]')!
      .addEventListener('click', () => this.toggle(), events);
    root
      .querySelector<HTMLButtonElement>('[data-tool-trial-reset]')!
      .addEventListener('click', () => this.reset(), events);
    const aim = (event: PointerEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      this.padActive = false;
    };
    this.canvas.addEventListener(
      'pointerdown',
      (event) => {
        if (!this.isPlaying || event.button !== 0 || this.pointerId !== null) return;
        event.preventDefault();
        options.unlockAudio?.();
        this.canvas.focus({ preventScroll: true });
        this.canvas.setPointerCapture(event.pointerId);
        this.pointerId = event.pointerId;
        aim(event);
        this.firing = this.firePressed = true;
      },
      events,
    );
    this.canvas.addEventListener(
      'pointermove',
      (event) => {
        if (this.pointerId === null || this.pointerId === event.pointerId) aim(event);
      },
      events,
    );
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
      this.canvas.addEventListener(
        type,
        () => {
          this.firing = false;
          this.pointerId = null;
        },
        events,
      );
    this.canvas.addEventListener('blur', () => this.resetInput(), events);
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) this.suspend();
      },
      events,
    );
    window.addEventListener('blur', () => this.suspend(), events);
    for (const button of Array.from(
      root.querySelectorAll<HTMLButtonElement>('[data-tool-trial-touch]'),
    )) {
      const action = button.dataset.toolTrialTouch as keyof typeof this.touch;
      button.addEventListener(
        'pointerdown',
        (event) => {
          event.preventDefault();
          if (!this.isPlaying) return;
          options.unlockAudio?.();
          button.setPointerCapture(event.pointerId);
          this.touch[action] = true;
          if (action === 'jump') this.jump = true;
        },
        events,
      );
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
        button.addEventListener(
          type,
          () => {
            this.touch[action] = false;
          },
          events,
        );
    }
    this.canvas.focus({ preventScroll: true });
  }
  keyDown(event: KeyboardEvent) {
    if (this.stopped || event.ctrlKey || event.altKey || event.metaKey) return;
    const b = this.options.bindings;
    if (matches(b, 'retry', event.code)) {
      event.preventDefault();
      if (!event.repeat) this.reset();
      return;
    }
    if (matches(b, 'pause', event.code)) {
      event.preventDefault();
      if (!event.repeat) this.toggle();
      return;
    }
    if (document.activeElement !== this.canvas || !this.isPlaying) return;
    if (Object.values(b).some((codes) => codes.includes(event.code))) event.preventDefault();
    this.options.unlockAudio?.();
    this.padActive = false;
    this.keys.add(event.code);
    if (!event.repeat && matches(b, 'jump', event.code)) this.jump = true;
    if (!event.repeat && matches(b, 'fire', event.code)) this.firePressed = true;
  }
  keyUp(event: KeyboardEvent) {
    this.keys.delete(event.code);
  }
  private resetInput() {
    this.keys.clear();
    this.firing = this.jump = this.firePressed = this.padFiring = false;
    this.touch.left = this.touch.right = this.touch.jump = false;
    if (this.pointerId !== null && this.canvas.hasPointerCapture(this.pointerId))
      this.canvas.releasePointerCapture(this.pointerId);
    this.pointerId = null;
    this.accumulator = 0;
  }
  private suspend() {
    this.resetInput();
    if (!this.stopped && this.game.mode === 'playing') {
      this.game.setMode('paused');
      this.options.stopAudio?.();
    }
  }
  toggle() {
    if (this.stopped) return;
    this.options.unlockAudio?.();
    this.running = !this.running;
    this.resetInput();
    this.game.setMode(this.running && !document.hidden ? 'playing' : 'paused');
    if (this.game.mode !== 'playing') this.options.stopAudio?.();
    this.updateStatus();
    if (this.running) this.canvas.focus({ preventScroll: true });
  }
  reset() {
    if (this.stopped) return;
    this.options.unlockAudio?.();
    this.options.stopAudio?.();
    this.resetInput();
    this.trial.dispose();
    this.trial = new ToolTrial(this.gun, this.scene);
    this.game.onSound = this.options.sound;
    this.renderer = new Renderer(this.canvas, this.game);
    this.running = true;
    this.padActive = false;
    this.pointer = null;
    this.renderedAt = -1000;
    this.updateStatus('Range reset.');
    this.canvas.focus({ preventScroll: true });
  }
  private updateStatus(message?: string) {
    this.root.querySelector<HTMLButtonElement>('[data-tool-trial-toggle]')!.textContent = this
      .running
      ? 'Pause range'
      : 'Resume range';
    this.root.querySelector<HTMLElement>('.tool-trial-status')!.textContent =
      message ?? (this.running ? 'Range ready.' : 'Paused.');
  }
  frame(
    dt: number,
    now: number,
    reduced: boolean,
    active: boolean,
    pad: ControllerFrame | null = null,
  ) {
    if (this.stopped || !this.root.isConnected) return;
    const rect = this.canvas.getBoundingClientRect();
    if (
      !active ||
      document.hidden ||
      !rect.width ||
      !rect.height ||
      rect.bottom <= 0 ||
      rect.top >= innerHeight
    ) {
      this.suspend();
      return;
    }
    if (this.running && this.game.mode === 'paused') this.game.setMode('playing');
    if (this.isPlaying && Number.isFinite(dt) && dt > 0) {
      this.accumulator = Math.min(0.08, this.accumulator + dt);
      if (pad?.connected && pad.activity) this.padActive = true;
      const controller = this.padActive && pad?.connected ? pad : null;
      if (controller && Math.hypot(controller.aim.x, controller.aim.y) > 0.05) {
        const length = Math.hypot(controller.aim.x, controller.aim.y);
        this.padAim = { x: controller.aim.x / length, y: controller.aim.y / length };
      }
      this.padFiring = !!controller?.fire;
      this.jump ||= !!controller?.jump;
      this.firePressed ||= !!controller?.firePressed;
      const g = this.game,
        b = this.options.bindings;
      const input: Input = {
        left: !controller && (held(b, 'left', this.keys) || this.touch.left),
        right: !controller && (held(b, 'right', this.keys) || this.touch.right),
        ...(controller ? { move: controller.move } : {}),
        jump: this.jump || !!controller?.jump,
        jumpHeld: controller ? controller.jumpHeld : held(b, 'jump', this.keys) || this.touch.jump,
        fire: controller ? controller.fire : this.firing || held(b, 'fire', this.keys),
        firePressed: this.firePressed || !!controller?.firePressed,
        aim: controller
          ? {
              x: g.player.position.x + this.padAim.x * 800,
              y: g.player.position.y + this.padAim.y * 800,
            }
          : this.pointer
            ? this.renderer.toWorld(this.pointer.x, this.pointer.y)
            : { x: 750, y: 723 },
      };
      while (this.accumulator >= 1 / 60) {
        this.trial.tick(1 / 60, input);
        input.jump = input.firePressed = false;
        this.jump = this.firePressed = false;
        this.accumulator -= 1 / 60;
      }
    }
    if (now - this.renderedAt < 1000 / 30) return;
    if (this.renderer.width !== rect.width || this.renderer.height !== rect.height)
      this.renderer.resize();
    this.renderer.reduced = reduced;
    this.renderer.draw(now, {
      camera: { x: 0, y: 770 - this.renderer.height / (this.renderer.width / 920) },
      scale: this.renderer.width / 920,
      player: true,
      navigation: false,
    });
    const ctx = this.closeup.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, this.closeup.width, this.closeup.height);
      ctx.save();
      ctx.translate(70, 70);
      ctx.scale(5, 5);
      drawWeapon(ctx, this.game, reduced);
      ctx.restore();
    }
    this.renderedAt = now;
  }
  back() {
    if (this.stopped) return;
    this.dispose();
    this.options.back();
  }
  dispose() {
    if (this.stopped) return;
    this.resetInput();
    this.stopped = true;
    this.options.stopAudio?.();
    this.abort.abort();
    this.trial.dispose();
  }
}
