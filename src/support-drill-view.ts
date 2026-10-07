import type { Input } from './game.ts';
import type { ControllerFrame } from './controller.ts';
import { Renderer } from './render.ts';
import { bindingLabel, held, matches, type Bindings } from './keyboard.ts';
import { escapeLogbook } from './logbook-menu.ts';
import { SupportDrill } from './support-drill.ts';
import { SUPPORT_DRILLS, supportDrillMastery, type SupportDrillId } from './support-drill-info.ts';

export class SupportDrillView {
  private drill: SupportDrill;
  private renderer: Renderer;
  private readonly canvas: HTMLCanvasElement;
  private readonly root: HTMLElement;
  private readonly bindings: Bindings;
  private readonly abort = new AbortController();
  private keys = new Set<string>();
  private pointer: { x: number; y: number } | null = null;
  private pointerId: number | null = null;
  private touchPointer = false;
  private firing = false;
  private jump = false;
  private firePressed = false;
  private touch = { left: false, right: false, jump: false };
  private padAim = { x: 1, y: 0 };
  private accumulator = 0;
  private renderedAt = -1000;
  private running = false;
  private begun = false;
  private stopped = false;
  private lastStatus = '';
  private ended = false;
  constructor(
    root: HTMLElement,
    id: SupportDrillId,
    bindings: Bindings,
    back: () => void,
    sound: (kind: string) => void,
  ) {
    this.root = root;
    this.bindings = bindings;
    const info = SUPPORT_DRILLS[id],
      mastery = supportDrillMastery(id);
    root.innerHTML =
      '<div class="drill-header"><div><p class="eyebrow">OPTIONAL TRAINING</p><h2 id="dialog-title">' +
      info.name +
      '.</h2></div><button class="quiet" data-drill-back>Back to Logbook</button></div>' +
      '<p class="drill-instruction">' +
      info.instruction +
      '</p><p class="drill-scope">Training only · no rewards or saved progress. Your run stays paused.</p>' +
      '<canvas class="drill-canvas" tabindex="0" aria-label="' +
      info.name +
      ' firing range" aria-describedby="drill-controls"></canvas>' +
      '<div class="drill-progress"><progress max="' +
      mastery.target +
      '" value="0" aria-label="Training progress"></progress><strong data-drill-count>0 / ' +
      mastery.target +
      ' ' +
      mastery.unit +
      '</strong><span data-drill-health>Health 100</span></div>' +
      '<p class="drill-cue" data-drill-cue>Begin when you are ready.</p><p class="sr-only" data-drill-status role="status" aria-live="polite"></p>' +
      '<p id="drill-controls" class="drill-controls">Aim with the mouse; hold click or ' +
      escapeLogbook(bindingLabel(bindings, 'fire')) +
      ' to fire. ' +
      escapeLogbook(bindingLabel(bindings, 'left') + ' / ' + bindingLabel(bindings, 'right')) +
      ' move · ' +
      escapeLogbook(bindingLabel(bindings, 'jump')) +
      ' jump. Controller: right stick aim, trigger fire. Touch: hold and drag in the range.</p>' +
      '<div class="drill-touch"><button data-drill-touch="left" aria-label="Move left">←</button><button data-drill-touch="right" aria-label="Move right">→</button><button data-drill-touch="jump" aria-label="Jump">↑</button></div>' +
      '<div class="actions"><button class="primary" data-drill-toggle>Begin drill</button><button class="quiet" data-drill-retry>Retry drill</button></div>';
    this.canvas = root.querySelector('canvas')!;
    this.drill = new SupportDrill(id);
    this.drill.game.onSound = sound;
    this.renderer = new Renderer(this.canvas, this.drill.game);
    root.querySelector<HTMLButtonElement>('[data-drill-back]')!.onclick = back;
    root.querySelector<HTMLButtonElement>('[data-drill-toggle]')!.onclick = () => this.toggle();
    root.querySelector<HTMLButtonElement>('[data-drill-retry]')!.onclick = () => {
      this.drill.dispose();
      this.drill = new SupportDrill(id);
      this.drill.game.onSound = sound;
      this.renderer = new Renderer(this.canvas, this.drill.game);
      this.ended = false;
      this.running = true;
      this.begun = true;
      this.resetInput();
      this.lastStatus = '';
      this.renderedAt = -1000;
      this.update();
      this.canvas.focus({ preventScroll: true });
    };
    const options = { signal: this.abort.signal };
    const aim = (event: PointerEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    this.canvas.addEventListener(
      'pointerdown',
      (event) => {
        if (!this.isPlaying || event.button !== 0 || this.pointerId !== null) return;
        event.preventDefault();
        this.canvas.focus({ preventScroll: true });
        this.canvas.setPointerCapture(event.pointerId);
        this.pointerId = event.pointerId;
        this.touchPointer = event.pointerType === 'touch';
        aim(event);
        this.firing = this.firePressed = true;
      },
      options,
    );
    this.canvas.addEventListener(
      'pointermove',
      (event) => {
        if (this.pointerId === null || this.pointerId === event.pointerId) aim(event);
      },
      options,
    );
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
      this.canvas.addEventListener(
        type,
        () => {
          this.firing = false;
          this.pointerId = null;
        },
        options,
      );
    this.canvas.addEventListener('blur', () => this.resetInput(), options);
    for (const button of Array.from(
      root.querySelectorAll<HTMLButtonElement>('[data-drill-touch]'),
    )) {
      const action = button.dataset.drillTouch as keyof typeof this.touch;
      button.addEventListener(
        'pointerdown',
        (event) => {
          event.preventDefault();
          button.setPointerCapture(event.pointerId);
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
  }
  get isPlaying() {
    return this.running && !this.drill.complete && !this.drill.failed;
  }
  toggle() {
    if (this.drill.complete || this.drill.failed) return;
    this.running = !this.running;
    this.begun ||= this.running;
    this.resetInput();
    this.update();
    if (this.running) this.canvas.focus({ preventScroll: true });
  }
  keyDown(event: KeyboardEvent) {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (matches(this.bindings, 'retry', event.code)) {
      event.preventDefault();
      if (!event.repeat) this.root.querySelector<HTMLButtonElement>('[data-drill-retry]')!.click();
      return;
    }
    if (matches(this.bindings, 'pause', event.code)) {
      event.preventDefault();
      if (!event.repeat) this.toggle();
      return;
    }
    if (document.activeElement !== this.canvas || !this.isPlaying) return;
    if (Object.values(this.bindings).some((codes) => codes.includes(event.code)))
      event.preventDefault();
    this.keys.add(event.code);
    if (!event.repeat && matches(this.bindings, 'jump', event.code)) this.jump = true;
    if (!event.repeat && matches(this.bindings, 'fire', event.code)) this.firePressed = true;
  }
  keyUp(event: KeyboardEvent) {
    this.keys.delete(event.code);
  }
  private resetInput() {
    this.keys.clear();
    this.firing = this.jump = this.firePressed = false;
    this.touch.left = this.touch.right = this.touch.jump = false;
    if (this.pointerId !== null && this.canvas.hasPointerCapture(this.pointerId))
      this.canvas.releasePointerCapture(this.pointerId);
    this.pointerId = null;
    this.accumulator = 0;
  }
  private update() {
    const d = this.drill,
      mastery = supportDrillMastery(d.id);
    this.root.querySelector<HTMLProgressElement>('progress')!.value = d.current;
    this.root.querySelector<HTMLElement>('[data-drill-count]')!.textContent =
      d.current + ' / ' + mastery.target + ' ' + mastery.unit;
    this.root.querySelector<HTMLElement>('[data-drill-health]')!.textContent =
      'Health ' + Math.ceil(d.game.hp);
    this.root.querySelector<HTMLElement>('[data-drill-cue]')!.textContent =
      d.complete || d.failed
        ? d.cue
        : this.running
          ? d.cue
          : this.begun
            ? 'Paused. Resume when you are ready.'
            : 'Begin when you are ready.';
    const toggle = this.root.querySelector<HTMLButtonElement>('[data-drill-toggle]')!;
    toggle.textContent = this.running ? 'Pause drill' : this.begun ? 'Resume drill' : 'Begin drill';
    toggle.disabled = d.complete || d.failed;
    const status = d.complete
      ? 'Drill complete. Training does not unlock rewards.'
      : d.failed
        ? d.cue
        : d.current + ' of ' + mastery.target + ' ' + mastery.unit;
    if (status !== this.lastStatus) {
      this.root.querySelector<HTMLElement>('[data-drill-status]')!.textContent = status;
      this.lastStatus = status;
    }
    if (!this.ended && (d.complete || d.failed)) {
      this.ended = true;
      this.resetInput();
      this.root
        .querySelector<HTMLButtonElement>('[data-drill-retry]')!
        .focus({ preventScroll: true });
    }
  }
  frame(dt: number, now: number, reduced: boolean, active: boolean, pad: ControllerFrame | null) {
    if (this.stopped || !this.root.isConnected) return;
    if (!active) this.resetInput();
    if (active && this.isPlaying) {
      this.accumulator = Math.min(0.08, this.accumulator + dt);
      const g = this.drill.game;
      if (pad && Math.hypot(pad.aim.x, pad.aim.y) > 0.05) {
        const length = Math.hypot(pad.aim.x, pad.aim.y);
        this.padAim = { x: pad.aim.x / length, y: pad.aim.y / length };
      }
      const input: Input = {
        left: !pad && (held(this.bindings, 'left', this.keys) || this.touch.left),
        right: !pad && (held(this.bindings, 'right', this.keys) || this.touch.right),
        ...(pad ? { move: pad.move } : {}),
        jump: this.jump || !!pad?.jump,
        jumpHeld: pad ? pad.jumpHeld : held(this.bindings, 'jump', this.keys) || this.touch.jump,
        fire: pad ? pad.fire : this.firing || held(this.bindings, 'fire', this.keys),
        firePressed: this.firePressed || !!pad?.firePressed,
        aim: pad
          ? {
              x: g.player.position.x + this.padAim.x * 800,
              y: g.player.position.y + this.padAim.y * 800,
            }
          : this.pointer
            ? this.renderer.toWorld(this.pointer.x, this.pointer.y)
            : { x: 490, y: 693 },
      };
      // Small ranges keep the actual hulls. Touch can aim near a mount rather
      // than requiring a finger to cover a twelve-pixel target exactly.
      if (!pad && this.touchPointer && this.pointer) {
        const targets = [
          ...g.enemies.filter((e) => e.maxHp < 100000).map((e) => e.body.position),
          ...g.props.items.map((p) => p.body.position),
        ];
        let nearest = 24;
        const pointerAim = input.aim;
        for (const p of targets) {
          const distance = Math.hypot(
            (p.x - pointerAim.x) * this.renderer.scale,
            (p.y - pointerAim.y) * this.renderer.scale,
          );
          if (distance < nearest) {
            nearest = distance;
            input.aim = { ...p };
          }
        }
      }
      while (this.accumulator >= 1 / 60) {
        this.drill.tick(1 / 60, input);
        input.jump = input.firePressed = false;
        this.accumulator -= 1 / 60;
      }
      this.jump = this.firePressed = false;
    }
    if (now - this.renderedAt < 1000 / 30) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    if (this.renderer.width !== rect.width || this.renderer.height !== rect.height)
      this.renderer.resize();
    this.renderer.reduced = reduced;
    this.renderer.draw(now, {
      camera: { x: 20, y: 770 - this.renderer.height / (this.renderer.width / 900) },
      scale: this.renderer.width / 900,
      player: true,
      navigation: false,
    });
    const c = this.renderer.ctx,
      g = this.drill.game;
    c.save();
    const ratio = this.canvas.width / this.renderer.width;
    c.setTransform(ratio, 0, 0, ratio, 0, 0);
    c.font = '11px sans-serif';
    c.textAlign = 'center';
    c.fillStyle = '#dce4dc';
    const label = (text: string, x: number, y: number) => {
      const half = c.measureText(text).width / 2 + 4;
      c.fillText(
        text,
        Math.max(
          half,
          Math.min(this.renderer.width - half, (x - this.renderer.camera.x) * this.renderer.scale),
        ),
        (y - this.renderer.camera.y) * this.renderer.scale,
      );
    };
    for (const e of g.enemies)
      label(
        this.drill.id === 'overkill'
          ? e.body.position.x < 600
            ? 'Weak target'
            : 'Charge target'
          : this.drill.id === 'armor'
            ? 'Incoming shots'
            : 'Heat target',
        e.body.position.x,
        e.body.position.y - 32,
      );
    if (this.drill.id === 'armor')
      for (const p of g.props.items)
        label('Break for a plate', p.body.position.x, p.body.position.y - 57);
    c.restore();
    this.update();
    this.renderedAt = now;
  }
  dispose() {
    this.stopped = true;
    this.resetInput();
    this.abort.abort();
    this.drill.dispose();
  }
}
