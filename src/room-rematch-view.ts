import type { Input } from './game.ts';
import type { ControllerFrame } from './controller.ts';
import { controllerPortalTarget } from './controller-target.ts';
import { Renderer } from './render.ts';
import { bindingLabel, held, matches, type Bindings } from './keyboard.ts';
import { escapeLogbook } from './logbook-menu.ts';
import { RoomRematch, type RoomRematchSnapshot } from './room-rematch.ts';

export class RoomRematchView {
  readonly session: RoomRematch;
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: Renderer;
  private readonly abort = new AbortController();
  private keys = new Set<string>();
  private pointer: { x: number; y: number } | null = null;
  private pointerId: number | null = null;
  private firing = false;
  private jump = false;
  private firePressed = false;
  private portal: Input['portal'];
  private accumulator = 0;
  private begun = false;
  private stopped = false;
  private ended = false;
  private touch = { left: false, right: false, jump: false };
  private padAim = { x: 1, y: 0 };
  constructor(
    private readonly root: HTMLElement,
    snapshot: RoomRematchSnapshot,
    private readonly bindings: Bindings,
    private readonly back: () => void,
    sound: (kind: string) => void,
  ) {
    this.session = new RoomRematch(snapshot);
    this.session.game.onSound = sound;
    root.innerHTML =
      '<div class="rematch-header"><div><p class="eyebrow">ONE-ROOM PRACTICE</p><h2 id="dialog-title">' +
      escapeLogbook(snapshot.level.name) +
      '.</h2></div>' +
      '<button class="quiet" data-rematch-back>Back to run results</button></div>' +
      '<p class="rematch-scope">Your finished gun · Full health · No rewards or saved progress</p>' +
      '<details class="rematch-guidance"><summary>' +
      escapeLogbook(snapshot.guidance.label) +
      ' · One tip</summary><p>' +
      escapeLogbook(snapshot.guidance.tip) +
      '</p></details>' +
      '<canvas class="rematch-canvas" tabindex="0" role="img" aria-label="Room rematch" aria-describedby="rematch-controls"></canvas>' +
      '<div class="rematch-footer"><progress max="100" value="100" aria-label="Rematch health"></progress>' +
      '<span data-rematch-status role="status">Begin when you are ready.</span></div>' +
      '<p id="rematch-controls" class="rematch-controls">' +
      escapeLogbook(bindingLabel(bindings, 'left') + ' / ' + bindingLabel(bindings, 'right')) +
      ' move · ' +
      escapeLogbook(bindingLabel(bindings, 'jump')) +
      ' jump · Mouse / ' +
      escapeLogbook(bindingLabel(bindings, 'fire')) +
      ' fire · Right click / ' +
      escapeLogbook(bindingLabel(bindings, 'portal')) +
      ' secondary · ' +
      escapeLogbook(bindingLabel(bindings, 'pause')) +
      ' pause · ' +
      escapeLogbook(bindingLabel(bindings, 'retry')) +
      ' retry</p>' +
      '<div class="rematch-touch" role="group" aria-label="Touch controls"><button data-rematch-touch="left" aria-label="Move left">←</button>' +
      '<button data-rematch-touch="right" aria-label="Move right">→</button><button data-rematch-touch="jump">Jump</button>' +
      '<button data-rematch-secondary>Secondary</button></div>' +
      '<div class="actions"><button class="primary" data-rematch-toggle>Begin rematch</button>' +
      '<button class="quiet" data-rematch-retry>Retry room</button></div>';
    this.canvas = root.querySelector('canvas')!;
    this.renderer = new Renderer(this.canvas, this.session.game);
    root.querySelector<HTMLButtonElement>('[data-rematch-back]')!.onclick = back;
    root.querySelector<HTMLButtonElement>('[data-rematch-toggle]')!.onclick = () => this.toggle();
    root.querySelector<HTMLButtonElement>('[data-rematch-retry]')!.onclick = () => this.retry();
    const options = { signal: this.abort.signal };
    const aim = (e: PointerEvent) => {
      const r = this.canvas.getBoundingClientRect();
      this.pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    this.canvas.addEventListener(
      'pointerdown',
      (e) => {
        if (!this.isPlaying || this.pointerId !== null) return;
        e.preventDefault();
        this.canvas.focus({ preventScroll: true });
        aim(e);
        if (e.button === 2) {
          this.portal = this.renderer.toWorld(this.pointer!.x, this.pointer!.y);
          return;
        }
        if (e.button !== 0) return;
        this.canvas.setPointerCapture(e.pointerId);
        this.pointerId = e.pointerId;
        this.firing = this.firePressed = true;
      },
      options,
    );
    this.canvas.addEventListener('pointermove', (e) => aim(e), options);
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
      this.canvas.addEventListener(
        type,
        () => {
          this.firing = false;
          this.pointerId = null;
        },
        options,
      );
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault(), options);
    this.canvas.addEventListener('blur', () => this.resetInput(), options);
    for (const button of Array.from(root.querySelectorAll<HTMLButtonElement>('[data-rematch-touch]'))) {
      const action = button.dataset.rematchTouch as keyof typeof this.touch;
      button.addEventListener(
        'pointerdown',
        (e) => {
          if (!this.isPlaying) return;
          e.preventDefault();
          button.setPointerCapture(e.pointerId);
          this.touch[action] = true;
          if (action === 'jump') this.jump = true;
        },
        options,
      );
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
        button.addEventListener(
          type,
          () => {
            this.touch[action] = false;
          },
          options,
        );
    }
    root.querySelector<HTMLButtonElement>('[data-rematch-secondary]')!.onclick = () => {
      if (this.isPlaying && this.pointer)
        this.portal = this.renderer.toWorld(this.pointer.x, this.pointer.y);
    };
  }
  get isPlaying() {
    return this.session.game.mode === 'playing';
  }
  toggle() {
    const g = this.session.game;
    if (!['playing', 'paused'].includes(g.mode)) return;
    g.setMode(this.isPlaying ? 'paused' : 'playing');
    this.begun = true;
    this.resetInput();
    this.update();
    if (this.isPlaying) this.canvas.focus({ preventScroll: true });
  }
  retry() {
    this.resetInput();
    this.session.reset();
    this.renderer.reset();
    this.begun = this.ended = false;
    this.update();
    this.toggle();
  }
  keyDown(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (matches(this.bindings, 'retry', e.code)) {
      e.preventDefault();
      if (!e.repeat) this.retry();
      return;
    }
    if (matches(this.bindings, 'pause', e.code)) {
      e.preventDefault();
      if (!e.repeat) this.toggle();
      return;
    }
    if (document.activeElement !== this.canvas || !this.isPlaying) return;
    if (Object.values(this.bindings).some((codes) => codes.includes(e.code))) e.preventDefault();
    this.keys.add(e.code);
    if (!e.repeat && matches(this.bindings, 'jump', e.code)) this.jump = true;
    if (!e.repeat && matches(this.bindings, 'fire', e.code)) this.firePressed = true;
    if (!e.repeat && matches(this.bindings, 'portal', e.code) && this.pointer)
      this.portal = this.renderer.toWorld(this.pointer.x, this.pointer.y);
  }
  keyUp(e: KeyboardEvent) {
    this.keys.delete(e.code);
  }
  private resetInput() {
    this.keys.clear();
    this.touch.left = this.touch.right = this.touch.jump = false;
    this.firing = this.jump = this.firePressed = false;
    this.portal = undefined;
    this.accumulator = 0;
    if (this.pointerId !== null && this.canvas.hasPointerCapture(this.pointerId))
      this.canvas.releasePointerCapture(this.pointerId);
    this.pointerId = null;
  }
  private update() {
    const g = this.session.game,
      terminal = g.mode === 'dead' || g.mode === 'won';
    const health = this.root.querySelector<HTMLProgressElement>('progress')!;
    health.value = g.hp;
    health.setAttribute('aria-valuetext', Math.ceil(g.hp) + ' health');
    const status =
      g.mode === 'won'
        ? 'Room cleared. Practice grants no rewards.'
        : g.mode === 'dead'
          ? 'Try another approach, or return to your run results.'
          : this.isPlaying
            ? 'Clear this room. Your original run stays finished.'
            : this.begun
              ? 'Paused. Resume when you are ready.'
              : 'Begin when you are ready.';
    const cue = this.root.querySelector<HTMLElement>('[data-rematch-status]')!;
    if (cue.textContent !== status) cue.textContent = status;
    const toggle = this.root.querySelector<HTMLButtonElement>('[data-rematch-toggle]')!;
    toggle.textContent = this.isPlaying
      ? 'Pause rematch'
      : this.begun
        ? 'Resume rematch'
        : 'Begin rematch';
    toggle.disabled = terminal;
    if (terminal && !this.ended) {
      this.ended = true;
      this.resetInput();
      this.root
        .querySelector<HTMLButtonElement>('[data-rematch-retry]')!
        .focus({ preventScroll: true });
    }
  }
  frame(dt: number, now: number, reduced: boolean, active: boolean, pad: ControllerFrame | null) {
    if (this.stopped || !this.root.isConnected) return;
    const g = this.session.game;
    if (!active) {
      if (this.isPlaying) g.setMode('paused');
      this.resetInput();
    }
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (this.renderer.width !== r.width || this.renderer.height !== r.height) {
      if (this.isPlaying) {
        g.setMode('paused');
        this.resetInput();
      }
      this.renderer.resize();
    }
    this.renderer.scale = Math.max(0.72, this.renderer.scale);
    this.renderer.reduced = reduced;
    if (active && this.isPlaying) {
      this.accumulator = Math.min(0.08, this.accumulator + dt);
      if (pad && Math.hypot(pad.aim.x, pad.aim.y) > 0.05) {
        const length = Math.hypot(pad.aim.x, pad.aim.y);
        this.padAim = { x: pad.aim.x / length, y: pad.aim.y / length };
      }
      this.jump ||= !!pad?.jump;
      this.firePressed ||= !!pad?.firePressed;
      const input: Input = {
        left: !pad && (this.touch.left || held(this.bindings, 'left', this.keys)),
        right: !pad && (this.touch.right || held(this.bindings, 'right', this.keys)),
        ...(pad ? { move: pad.move } : {}),
        jump: this.jump,
        jumpHeld: pad ? pad.jumpHeld : this.touch.jump || held(this.bindings, 'jump', this.keys),
        fire: pad ? pad.fire : this.firing || held(this.bindings, 'fire', this.keys),
        firePressed: this.firePressed,
        aim: pad
          ? {
              x: g.player.position.x + this.padAim.x * 400,
              y: g.player.position.y + this.padAim.y * 400,
            }
          : this.pointer
            ? this.renderer.toWorld(this.pointer.x, this.pointer.y)
            : { x: 850, y: 600 },
        portal: this.portal,
      };
      this.renderer.portalAim = pad
        ? controllerPortalTarget(g, this.padAim, {
            ...this.renderer.camera,
            width: this.renderer.width / this.renderer.scale,
            height: this.renderer.height / this.renderer.scale,
          })
        : undefined;
      if (pad?.portal && this.renderer.portalAim)
        this.portal = input.portal = this.renderer.portalAim;
      while (this.accumulator >= 1 / 60 && this.isPlaying) {
        if (pad)
          input.aim = {
            x: g.player.position.x + this.padAim.x * 400,
            y: g.player.position.y + this.padAim.y * 400,
          };
        this.session.tick(1 / 60, input);
        this.jump = this.firePressed = false;
        this.portal = undefined;
        input.jump = input.firePressed = false;
        input.portal = undefined;
        this.accumulator -= 1 / 60;
      }
    }
    this.renderer.draw(now);
    this.update();
  }
  dispose() {
    this.stopped = true;
    this.resetInput();
    this.abort.abort();
    this.session.dispose();
  }
}
