import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { ToolTrialView } from '../src/tool-trial-view.ts';
import { Renderer } from '../src/render.ts';
import { DEFAULT_BINDINGS } from '../src/keyboard.ts';
import type { ControllerFrame } from '../src/controller.ts';
import type { StartingGun } from '../src/starting-guns.ts';

class DocumentSurface extends EventTarget {
  hidden = false;
  activeElement: unknown = null;
}
class Button extends EventTarget {
  textContent = '';
  dataset: Record<string, string> = {};
}
class Canvas extends EventTarget {
  width = 920;
  height = 380;
  captures = new Set<number>();
  owner: DocumentSurface;
  mechanism = false;
  constructor(owner: DocumentSurface, mechanism = false) {
    super();
    this.owner = owner;
    this.mechanism = mechanism;
  }
  getContext() {
    return this.mechanism ? null : {};
  }
  getBoundingClientRect() {
    return { x: 0, y: 0, left: 0, top: 0, right: 920, bottom: 380, width: 920, height: 380 };
  }
  focus() {
    this.owner.activeElement = this;
  }
  setPointerCapture(id: number) {
    this.captures.add(id);
  }
  hasPointerCapture(id: number) {
    return this.captures.has(id);
  }
  releasePointerCapture(id: number) {
    this.captures.delete(id);
  }
}
class RangeRoot {
  isConnected = true;
  innerHTML = '';
  canvas: Canvas;
  closeup: Canvas;
  back = new Button();
  pause = new Button();
  reset = new Button();
  status = new Button();
  touches = ['left', 'right', 'jump'].map((action) => {
    const button = new Button();
    button.dataset.toolTrialTouch = action;
    return button;
  });
  constructor(document: DocumentSurface) {
    this.canvas = new Canvas(document);
    this.closeup = new Canvas(document, true);
  }
  querySelector(selector: string) {
    return (
      (
        {
          '.tool-trial-canvas': this.canvas,
          '.tool-trial-mechanism': this.closeup,
          '[data-tool-trial-back]': this.back,
          '[data-tool-trial-toggle]': this.pause,
          '[data-tool-trial-reset]': this.reset,
          '.tool-trial-status': this.status,
        } as Record<string, unknown>
      )[selector] ?? null
    );
  }
  querySelectorAll() {
    return this.touches;
  }
}
const key = (code: string) =>
  Object.assign(new Event('keydown', { cancelable: true }), {
    code,
    repeat: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
  }) as unknown as KeyboardEvent;
const pad = (change: Partial<ControllerFrame> = {}): ControllerFrame => ({
  connected: true,
  disconnected: false,
  activity: false,
  move: 0,
  aim: { x: 1, y: 0 },
  jump: false,
  jumpHeld: false,
  fire: false,
  firePressed: false,
  portal: false,
  confirm: false,
  back: false,
  pause: false,
  navigation: null,
  ...change,
});
function fixture(t: TestContext, gun: StartingGun = 'carbine') {
  const document = new DocumentSurface(),
    window = new EventTarget(),
    root = new RangeRoot(document);
  const descriptors = ['document', 'window', 'innerHeight', 'devicePixelRatio'].map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  );
  for (const [key, value] of Object.entries({
    document,
    window,
    innerHeight: 1000,
    devicePixelRatio: 1,
  }))
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  // These cases exercise the real view clocks, native physics and event lifetimes;
  // the separate renderer tests own pixel output, so no canvas emulator is needed.
  const drawing = t.mock.method(Renderer.prototype, 'draw', () => {});
  const audio = { pending: [] as string[], stops: 0 },
    callbacks = { back: 0 };
  const view = new ToolTrialView(root as unknown as HTMLElement, gun, {
    bindings: structuredClone(DEFAULT_BINDINGS),
    back: () => callbacks.back++,
    sound: (name) => audio.pending.push(name),
    stopAudio: () => {
      audio.pending = [];
      audio.stops++;
    },
  });
  let now = 0;
  const frame = (dt = 1 / 60, active = true, controller: ControllerFrame | null = null) => {
    now += Math.max(0, dt * 1000);
    view.frame(dt, now, false, active, controller);
  };
  const settle = () => {
    for (let i = 0; i < 25; i++) frame();
  };
  t.after(() => {
    view.dispose();
    drawing.mock.restore();
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  });
  return { view, root, document, window, audio, callbacks, frame, settle };
}

test('120Hz keyboard jump and tap-to-fire edges reach the next native tick after the keys are released', (t) => {
  const f = fixture(t),
    { view, frame } = f;
  f.settle();
  assert(view.game.grounded);
  const before = view.game.time;
  view.keyDown(key('Space'));
  view.keyDown(key('KeyF'));
  frame(1 / 120);
  assert.equal(view.game.time, before, 'half a simulation step must not tick');
  assert.equal(view.game.shotCount, 0);
  view.keyUp(key('Space'));
  view.keyUp(key('KeyF'));
  frame(1 / 120);
  assert(view.game.time > before);
  assert(view.game.jumpAt > before, 'the released jump edge still reaches native movement');
  assert(view.game.player.velocity.y < 0);
  assert.equal(
    view.game.shotCount,
    1,
    'the released fire edge still reaches the native fire buffer',
  );
  for (let i = 0; i < 140; i++) frame(1 / 120);
  assert.equal(view.game.shotCount, 1, 'a retained edge is consumed exactly once');
});

test('120Hz controller edge pulses survive the frame before a native tick and are consumed once', (t) => {
  const f = fixture(t),
    { view, frame } = f;
  f.settle();
  const before = view.game.time;
  frame(
    1 / 120,
    true,
    pad({ activity: true, jump: true, jumpHeld: true, fire: true, firePressed: true }),
  );
  assert.equal(view.game.time, before);
  assert.equal(view.game.shotCount, 0);
  frame(1 / 120, true, pad());
  assert(view.game.jumpAt > before);
  assert.equal(view.game.shotCount, 1);
  for (let i = 0; i < 140; i++) frame(1 / 120, true, pad());
  assert.equal(view.game.shotCount, 1);
});

test('Reset cancels pending audio and input, destroys the old world and starts a fresh native range', (t) => {
  const f = fixture(t),
    { view, frame, audio } = f;
  f.settle();
  const old = view.game;
  view.keyDown(key('Space'));
  view.keyDown(key('KeyF'));
  frame(1 / 120);
  audio.pending.push('scheduled mechanical return');
  f.root.reset.dispatchEvent(new Event('click'));
  assert.equal(audio.stops, 1);
  assert.deepEqual(audio.pending, []);
  assert.notEqual(view.game, old);
  assert.equal(old.engine.world.bodies.length, 0);
  assert.equal(view.game.startingGun, 'carbine');
  assert.equal(view.game.hp, 100);
  assert.deepEqual(view.game.mods, []);
  assert(view.isPlaying);
  assert.equal(f.document.activeElement, f.root.canvas);
  frame();
  assert.equal(view.game.shotCount, 0);
  assert.equal(view.game.jumpAt, -100);
});

test('manual Pause cancels audio and queued bursts once, then resumes without stale held input', (t) => {
  const f = fixture(t, 'nailgun'),
    { view, frame, audio } = f;
  f.settle();
  view.keyDown(key('KeyF'));
  frame();
  assert.equal(view.game.shotCount, 1);
  assert(audio.pending.length > 0);
  f.root.pause.dispatchEvent(new Event('click'));
  assert.equal(audio.stops, 1);
  assert.deepEqual(audio.pending, []);
  assert.equal(view.isPlaying, false);
  assert.equal(view.isFiring, false);
  const time = view.game.time;
  for (let i = 0; i < 30; i++) frame();
  assert.equal(view.game.time, time);
  assert.equal(audio.stops, 1);
  f.root.pause.dispatchEvent(new Event('click'));
  assert.equal(audio.stops, 1, 'resuming does not cancel a new audio session');
  for (let i = 0; i < 45; i++) frame();
  assert.equal(view.game.shotCount, 1, 'the old burst cannot resume after pause');
});

test('inactive frames and page hiding cancel audio once per suspension and discard half-step input', (t) => {
  const f = fixture(t),
    { view, frame, audio, document } = f;
  f.settle();
  view.keyDown(key('KeyF'));
  view.keyDown(key('Space'));
  frame(1 / 120);
  audio.pending.push('scheduled coil return');
  frame(1 / 120, false);
  assert.equal(audio.stops, 1);
  assert.deepEqual(audio.pending, []);
  assert.equal(view.isPlaying, false);
  const time = view.game.time;
  for (let i = 0; i < 10; i++) frame(1 / 60, false);
  assert.equal(audio.stops, 1);
  assert.equal(view.game.time, time);
  frame();
  assert(view.isPlaying);
  assert.equal(view.game.shotCount, 0);
  assert.equal(view.game.jumpAt, -100);
  audio.pending.push('another scheduled sound');
  document.hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(audio.stops, 2);
  assert.deepEqual(audio.pending, []);
  const hiddenTime = view.game.time;
  frame();
  frame();
  assert.equal(audio.stops, 2);
  assert.equal(view.game.time, hiddenTime);
  document.hidden = false;
  frame();
  assert(view.isPlaying);
  assert.equal(view.game.shotCount, 0);
});

test('Back cancels audio, disposes its native world and removes scoped reset and background listeners', (t) => {
  const f = fixture(t),
    { view, audio, callbacks } = f;
  const game = view.game;
  audio.pending.push('scheduled post-shot sound');
  f.root.back.dispatchEvent(new Event('click'));
  assert.equal(callbacks.back, 1);
  assert.equal(audio.stops, 1);
  assert.deepEqual(audio.pending, []);
  assert.equal(view.isPlaying, false);
  assert.equal(game.engine.world.bodies.length, 0);
  f.root.reset.dispatchEvent(new Event('click'));
  f.window.dispatchEvent(new Event('blur'));
  f.document.hidden = true;
  f.document.dispatchEvent(new Event('visibilitychange'));
  view.back();
  view.dispose();
  assert.equal(callbacks.back, 1);
  assert.equal(audio.stops, 1);
  assert.equal(view.game, game);
});
