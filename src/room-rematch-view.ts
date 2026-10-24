import { rematchDamageHtml } from './damage-summary-view.ts';
import type { Game, Input } from './game.ts';
import './room-rematch.css';
import type { ControllerFrame } from './controller.ts';
import { controllerPortalTarget } from './controller-target.ts';
import { Renderer } from './render.ts';
import type { CameraMode } from './combat-camera.ts';
import { bindingLabel, held, matches, type Bindings } from './keyboard.ts';
import { escapeLogbook } from './html.ts';
import { RoomRematch, type RoomRematchSnapshot } from './room-rematch.ts';
import { FINALE_PRACTICE_FORMS, finalePracticeGuidance } from './finale-practice.ts';

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
  private damageMarkup = '';
  private touch = { left: false, right: false, jump: false };
  private padAim = { x: 1, y: 0 };
  constructor(
    private readonly root: HTMLElement,
    snapshot: RoomRematchSnapshot,
    private readonly bindings: Bindings,
    private readonly back: () => void,
    sound: Game['onSound'],
    cameraMode: CameraMode = 'follow',
  ) {
    this.session = new RoomRematch(snapshot);
    this.session.game.onSound = sound;
    const finale = snapshot.finalePractice;
    root.innerHTML =
      '<div class="rematch-header"><div><p class="eyebrow">' +
      (finale ? 'BOSS PRACTICE' : 'ONE-ROOM PRACTICE') +
      '</p><h2 id="dialog-title">' +
      escapeLogbook(finale ? 'The Reclaimer' : snapshot.level.name) +
      '.</h2></div>' +
      '<button class="quiet" data-rematch-back>Back to run results</button></div>' +
      '<p class="rematch-scope">Your finished gun · Full health · No rewards or saved progress</p>' +
      (finale
        ? '<div class="rematch-phases" role="group" aria-label="Practice a reached form">' +
          FINALE_PRACTICE_FORMS.map(
            (name, phase) =>
              '<button class="quiet" data-rematch-phase="' +
              phase +
              '" aria-pressed="' +
              (phase === this.session.finalePhase) +
              '"' +
              (phase > finale.reached
                ? ' disabled title="Reach this form in your run to practice it."'
                : '') +
              '>' +
              name +
              (phase > finale.reached ? ' · Locked' : '') +
              '</button>',
          ).join('') +
          '</div>'
        : '') +
      '<details class="rematch-guidance"><summary data-rematch-guidance-label>' +
      escapeLogbook(snapshot.guidance.label) +
      ' · One tip</summary><p data-rematch-guidance-tip>' +
      escapeLogbook(snapshot.guidance.tip) +
      '</p></details>' +
      '<canvas class="rematch-canvas" tabindex="0" role="img" aria-label="Room rematch" aria-describedby="rematch-controls"></canvas>' +
      '<div class="rematch-footer"><progress max="100" value="100" aria-label="Rematch health"></progress>' +
      '<span data-rematch-status role="status">Begin when you are ready.</span></div>' +
      '<div data-rematch-damage></div>' +
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
    this.renderer.cameraMode = cameraMode;
    this.renderer.reset();
    root.querySelector<HTMLButtonElement>('[data-rematch-back]')!.onclick = back;
    root.querySelector<HTMLButtonElement>('[data-rematch-toggle]')!.onclick = () => this.toggle();
    root.querySelector<HTMLButtonElement>('[data-rematch-retry]')!.onclick = () => this.retry();
    root.querySelectorAll<HTMLButtonElement>('[data-rematch-phase]').forEach((button) => {
      button.onclick = () => {
        const phase = Number(button.dataset.rematchPhase);
        this.resetInput();
        if (!this.session.selectFinalePhase(phase)) return;
        this.renderer.reset();
        this.begun = this.ended = false;
        this.update();
        root
          .querySelector<HTMLButtonElement>('[data-rematch-toggle]')!
          .focus({ preventScroll: true });
      };
    });
    this.update();
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
    for (const button of Array.from(
      root.querySelectorAll<HTMLButtonElement>('[data-rematch-touch]'),
    )) {
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
        ? this.session.finalePhase !== null
          ? 'Form cleared. Practice grants no rewards.'
          : 'Room cleared. Practice grants no rewards.'
        : g.mode === 'dead'
          ? 'Try another approach, or return to your run results.'
          : this.isPlaying
            ? this.session.finalePhase !== null
              ? 'Defeat this form. Your original run stays finished.'
              : 'Clear this room. Your original run stays finished.'
            : this.begun
              ? 'Paused. Resume when you are ready.'
              : 'Begin when you are ready.';
    const phase = this.session.finalePhase,
      finale = this.session.snapshot.finalePractice;
    if (phase !== null && finale) {
      const guidance = finalePracticeGuidance(
        phase,
        phase === finale.deathPhase ? finale.cause : null,
      );
      this.root.querySelector<HTMLElement>('[data-rematch-guidance-label]')!.textContent =
        guidance.label + ' · One tip';
      this.root.querySelector<HTMLElement>('[data-rematch-guidance-tip]')!.textContent =
        guidance.tip;
      this.root
        .querySelectorAll<HTMLButtonElement>('[data-rematch-phase]')
        .forEach((button) =>
          button.setAttribute(
            'aria-pressed',
            String(Number(button.dataset.rematchPhase) === phase),
          ),
        );
      this.root.querySelector<HTMLButtonElement>('[data-rematch-retry]')!.textContent =
        'Retry form';
    }
    const damageResult = this.session.damageResult;
    const damageMarkup = damageResult
      ? rematchDamageHtml(
          this.session.snapshot,
          damageResult,
          g.mode as 'won' | 'dead',
          this.session.attemptStartingHp,
        )
      : '';
    if (damageMarkup !== this.damageMarkup) {
      this.damageMarkup = damageMarkup;
      this.root.querySelector<HTMLElement>('[data-rematch-damage]')!.innerHTML = damageMarkup;
    }
    const cue = this.root.querySelector<HTMLElement>('[data-rematch-status]')!;
    if (cue.textContent !== status) cue.textContent = status;
    const toggle = this.root.querySelector<HTMLButtonElement>('[data-rematch-toggle]')!;
    toggle.textContent =
      this.session.finalePhase !== null
        ? this.isPlaying
          ? 'Pause practice'
          : this.begun
            ? 'Resume practice'
            : 'Begin practice'
        : this.isPlaying
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
