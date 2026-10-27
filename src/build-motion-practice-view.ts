import type { Game, Input } from './game.ts';
import type { ControllerFrame } from './controller.ts';
import { bindingLabel, held, matches, type Bindings } from './keyboard.ts';
import { escapeLogbook } from './html.ts';
import { Renderer } from './render.ts';
import { BuildMotionPractice, type BuildMotionPracticeConfig } from './build-motion-practice.ts';
import { buildMotion, buildMotionDefinition } from './build-motion.ts';
import { WORKSHOP_SCENARIOS } from './workshop.ts';
import { controllerPortalTarget } from './controller-target.ts';

export interface BuildMotionPracticeViewOptions {
  bindings: Bindings;
  back: () => void;
  sound: Game['onSound'];
  unlockAudio?: () => void;
  stopAudio?: () => void;
}
export class BuildMotionPracticeView {
  private trial: BuildMotionPractice;
  private renderer: Renderer;
  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly options: BuildMotionPracticeViewOptions;
  private readonly abort = new AbortController();
  private readonly config: BuildMotionPracticeConfig;
  private portal: Input['portal'];
  private begun = false;
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
  private running = false;
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
    config: BuildMotionPracticeConfig,
    options: BuildMotionPracticeViewOptions,
  ) {
    this.root = root;
    this.config = structuredClone(config);
    this.options = options;
    const info = buildMotionDefinition(config.id)!,
      b = options.bindings;
    const range = WORKSHOP_SCENARIOS.find((s) => s.id === config.scenario)!;
    root.innerHTML =
      '<div class="motion-practice-header"><div><p class="eyebrow">BUILD PRACTICE · ' +
      escapeLogbook(range.label) +
      '</p><h2 id="dialog-title">' +
      escapeLogbook(info.name) +
      '.</h2></div><button class="quiet" data-motion-practice-back>Back to your build</button></div>' +
      '<p class="motion-practice-instruction">' +
      escapeLogbook(info.trigger) +
      '</p><p class="motion-practice-instruction">' +
      escapeLogbook(info.detail) +
      '</p>' +
      '<p class="motion-practice-scope">Your equipped gun and fittings · Fresh range conditions · No rewards or saved progress. Your run stays paused.</p>' +
      '<canvas class="motion-practice-canvas" tabindex="0" aria-label="' +
      escapeLogbook(info.name) +
      ' practice range" aria-describedby="motion-practice-controls"></canvas>' +
      '<p class="motion-practice-state" data-motion-practice-readiness></p>' +
      '<p id="motion-practice-controls" class="motion-practice-controls">' +
      escapeLogbook(bindingLabel(b, 'left') + ' / ' + bindingLabel(b, 'right')) +
      ' move · ' +
      escapeLogbook(bindingLabel(b, 'jump')) +
      ' jump · Mouse / ' +
      escapeLogbook(bindingLabel(b, 'fire')) +
      ' fire · Right click / ' +
      escapeLogbook(bindingLabel(b, 'portal')) +
      ' secondary · ' +
      escapeLogbook(bindingLabel(b, 'retry')) +
      ' reset · Esc back.</p>' +
      '<div class="motion-practice-touch"><button data-motion-practice-touch="left" aria-label="Move left">←</button><button data-motion-practice-touch="right" aria-label="Move right">→</button><button data-motion-practice-touch="jump" aria-label="Jump">↑</button><button data-motion-practice-secondary>Secondary</button></div>' +
      '<div class="actions"><button class="primary" data-motion-practice-toggle>Begin range</button><button class="quiet" data-motion-practice-reset>Reset range</button><progress class="motion-practice-health" max="100" value="100" aria-label="Practice health"' +
      (config.scenario === 'incoming' ? '' : ' hidden') +
      '></progress><span class="motion-practice-status" role="status" aria-live="polite">Begin when you are ready.</span></div>';
    this.canvas = root.querySelector<HTMLCanvasElement>('.motion-practice-canvas')!;
    this.trial = new BuildMotionPractice(this.config);
    this.game.onSound = options.sound;
    this.game.setMode('paused');
    this.renderer = new Renderer(this.canvas, this.game);
    this.renderer.reset();
    const events = { signal: this.abort.signal };
    root
      .querySelector<HTMLButtonElement>('[data-motion-practice-back]')!
      .addEventListener('click', () => this.back(), events);
    root
      .querySelector<HTMLButtonElement>('[data-motion-practice-toggle]')!
      .addEventListener('click', () => this.toggle(), events);
    root
      .querySelector<HTMLButtonElement>('[data-motion-practice-reset]')!
      .addEventListener('click', () => this.reset(), events);
    const aim = (event: PointerEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      this.padActive = false;
    };
    this.canvas.addEventListener(
      'pointerdown',
      (event) => {
        if (!this.isPlaying || this.pointerId !== null || ![0, 2].includes(event.button)) return;
        event.preventDefault();
        options.unlockAudio?.();
        this.canvas.focus({ preventScroll: true });
        this.canvas.setPointerCapture(event.pointerId);
        aim(event);
        if (event.button === 2) {
          this.portal = this.renderer.toWorld(this.pointer!.x, this.pointer!.y);
          return;
        }
        this.pointerId = event.pointerId;
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
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault(), events);
    this.canvas.addEventListener('blur', () => this.resetInput(), events);
    root.querySelector<HTMLButtonElement>('[data-motion-practice-secondary]')!.onclick = () => {
      if (this.isPlaying && this.pointer)
        this.portal = this.renderer.toWorld(this.pointer.x, this.pointer.y);
    };
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) this.suspend();
      },
      events,
    );
    window.addEventListener('blur', () => this.suspend(), events);
    for (const button of Array.from(
      root.querySelectorAll<HTMLButtonElement>('[data-motion-practice-touch]'),
    )) {
      const action = button.dataset.motionPracticeTouch as keyof typeof this.touch;
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
    this.updateStatus();
    root
      .querySelector<HTMLButtonElement>('[data-motion-practice-toggle]')!
      .focus({ preventScroll: true });
  }
  keyDown(event: KeyboardEvent) {
    if (this.stopped || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.code === 'Escape') {
      event.preventDefault();
      if (!event.repeat) this.back();
      return;
    }
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
    if (!event.repeat && matches(b, 'portal', event.code)) {
      this.portal = this.pointer
        ? this.renderer.toWorld(this.pointer.x, this.pointer.y)
        : {
            x: this.game.player.position.x + this.padAim.x * 500,
            y: this.game.player.position.y + this.padAim.y * 500,
          };
    }
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
    this.portal = undefined;
  }
  private suspend() {
    this.resetInput();
    if (!this.stopped && this.game.mode === 'playing') {
      this.game.setMode('paused');
      this.running = false;
      this.updateStatus();
      this.options.stopAudio?.();
    }
  }
  toggle() {
    if (this.stopped) return;
    this.options.unlockAudio?.();
    this.running = !this.running;
    this.begun ||= this.running;
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
    this.trial = new BuildMotionPractice(this.config);
    this.game.onSound = this.options.sound;
    this.renderer = new Renderer(this.canvas, this.game);
    this.running = this.begun = true;
    this.padActive = false;
    this.pointer = null;
    this.renderedAt = -1000;
    this.updateStatus('Range reset.');
    this.canvas.focus({ preventScroll: true });
  }
  private updateStatus(message?: string) {
    this.root.querySelector<HTMLButtonElement>('[data-motion-practice-toggle]')!.textContent = this
      .running
      ? 'Pause range'
      : this.begun
        ? 'Resume range'
        : 'Begin range';
    this.root.querySelector<HTMLElement>('.motion-practice-status')!.textContent =
      message ??
      (this.running ? 'Range ready.' : this.begun ? 'Paused.' : 'Begin when you are ready.');
    this.root.querySelector<HTMLProgressElement>('.motion-practice-health')!.value = this.game.hp;
    const row = buildMotion(this.game).find((r) => r.id === this.config.id);
    this.root.querySelector<HTMLElement>('[data-motion-practice-readiness]')!.textContent = row
      ? row.name + ' · ' + row.state + '. ' + row.detail
      : '';
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
      if (controller?.portal) {
        const target = controllerPortalTarget(g, this.padAim, {
          ...this.renderer.camera,
          width: this.renderer.width / this.renderer.scale,
          height: this.renderer.height / this.renderer.scale,
        });
        if (target) this.portal = target;
      }
      const input: Input = {
        left: !controller && (held(b, 'left', this.keys) || this.touch.left),
        right: !controller && (held(b, 'right', this.keys) || this.touch.right),
        ...(controller ? { move: controller.move } : {}),
        jump: this.jump || !!controller?.jump,
        jumpHeld: controller ? controller.jumpHeld : held(b, 'jump', this.keys) || this.touch.jump,
        fire: controller ? controller.fire : this.firing || held(b, 'fire', this.keys),
        firePressed: this.firePressed || !!controller?.firePressed,
        portal: this.portal,
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
        input.portal = this.portal = undefined;
        this.jump = this.firePressed = false;
        this.accumulator -= 1 / 60;
      }
    }
    if (now - this.renderedAt < 1000 / 30) return;
    if (this.renderer.width !== rect.width || this.renderer.height !== rect.height)
      this.renderer.resize();
    this.renderer.reduced = reduced;
    this.renderer.draw(now);
    this.updateStatus();
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
