import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_BINDINGS,
  loadBindings,
  rebind,
  held,
  matches,
  bindable,
  keyLabel,
  type Action,
} from '../src/keyboard.ts';
import { controlsIntro, FirstSessionGuide } from '../src/first-session.ts';
import { DisplaySafety, watchSessionEvents } from '../src/display-safety.ts';
import { Game } from '../src/game.ts';

test('bindings survive JSON persistence without sharing mutable defaults', () => {
  const b = loadBindings(null);
  assert.equal(rebind(b, 'left', 0, 'KeyJ'), null);
  assert.equal(rebind(b, 'right', 0, 'KeyL'), null);
  assert.equal(rebind(b, 'jump', 0, 'KeyI'), null);
  const restored = loadBindings(JSON.parse(JSON.stringify(b)));
  assert.deepEqual(restored, b);
  assert.equal(DEFAULT_BINDINGS.left[0], 'KeyA');
  assert(held(restored, 'left', new Set(['KeyJ'])));
  assert(!held(restored, 'left', new Set(['KeyA'])));
  assert(matches(restored, 'jump', 'KeyI'));
  const copy = controlsIntro('keyboard', restored);
  assert.match(copy, /J \/ ←/);
  assert.match(copy, /I \/ W \/ ↑/);
  const g = new Game(),
    guide = new FirstSessionGuide();
  g.startWorkshop([]);
  guide.start(g, true);
  assert.match(guide.message(g, 'keyboard', restored), /J \/ L to move/);
  guide.moved = true;
  assert.match(guide.message(g, 'keyboard', restored), /I to jump/);
});

test('duplicate keys reject the edit without losing the original controls', () => {
  const b = loadBindings(null),
    original = structuredClone(b);
  assert.match(rebind(b, 'jump', 0, 'KeyA')!, /already assigned to move left/);
  assert.match(rebind(b, 'jump', 0, 'KeyW')!, /already assigned to jump/);
  assert.deepEqual(b, original);
  assert.equal(rebind(b, 'jump', 0, 'Space'), null, 'choosing the same key is harmless');
  for (const reserved of [
    'Escape',
    'Tab',
    'Enter',
    'Digit1',
    'Digit3',
    'F5',
    'F11',
    'AltLeft',
    'MetaLeft',
    'ControlLeft',
    '<script>',
  ]) {
    assert(!bindable(reserved));
    assert(rebind(b, 'pause', 0, reserved));
    assert.deepEqual(b, original);
  }
});

test('malformed saved controls fall back to a complete usable mapping', () => {
  const invalid = [
    null,
    2,
    'keys',
    [],
    {},
    { ...DEFAULT_BINDINGS, fire: [] },
    { ...DEFAULT_BINDINGS, jump: ['Space', 'KeyW', 'Escape'] },
    { ...DEFAULT_BINDINGS, right: ['KeyA', 'ArrowRight'] },
    { ...DEFAULT_BINDINGS, left: ['KeyJ'] },
  ];
  for (const raw of invalid) assert.deepEqual(loadBindings(raw), DEFAULT_BINDINGS);
  for (const action of Object.keys(DEFAULT_BINDINGS) as Action[])
    for (const code of DEFAULT_BINDINGS[action]) assert(matches(loadBindings(null), action, code));
});

test('alternate jump, fire and secondary bindings reach real simulation inputs', () => {
  const b = loadBindings(null);
  rebind(b, 'jump', 0, 'KeyI');
  rebind(b, 'fire', 0, 'KeyO');
  rebind(b, 'portal', 0, 'KeyU');
  const g = new Game();
  g.startWorkshop([]);
  const input = {
    left: false,
    right: false,
    jump: false,
    jumpHeld: false,
    fire: false,
    aim: { x: 1000, y: 715 },
  };
  for (let i = 0; i < 90; i++) g.tick(1 / 60, input);
  const y = g.player.position.y;
  g.tick(1 / 60, {
    ...input,
    jump: matches(b, 'jump', 'KeyI'),
    jumpHeld: held(b, 'jump', new Set(['KeyI'])),
  });
  assert(g.player.position.y < y && g.player.velocity.y < -2);
  for (let i = 0; i < 40; i++)
    g.tick(1 / 60, { ...input, fire: held(b, 'fire', new Set(['KeyO'])) });
  assert(g.shotCount > 0);
  assert(matches(b, 'portal', 'KeyU'));
  assert(!matches(b, 'portal', 'KeyE'));
  assert.equal(keyLabel('ShiftRight'), 'Right Shift');
});

test('display safety ignores initial/same-size observations and notices resize or fullscreen dimensions', () => {
  const display = new DisplaySafety();
  assert(!display.resized(960, 540));
  assert(!display.resized(960, 540));
  assert(display.resized(1920, 1080));
  assert(!display.resized(1920, 1080));
  assert(display.resized(390, 740));
  assert(!display.resized(390.1, 740.1));
});

test('focus, page suspension and fullscreen events pause a run without resuming held input', () => {
  const win = new EventTarget(),
    doc = new EventTarget(),
    g = new Game();
  let hidden = false,
    active = true;
  const keys = new Set(['KeyF']);
  const pause = () => {
    keys.clear();
    if (g.mode === 'playing') g.setMode('paused');
  };
  const dispose = watchSessionEvents(win, doc, {
    hidden: () => hidden,
    loseFocus: () => {
      active = false;
      pause();
    },
    regainFocus: () => {
      active = !hidden;
    },
    displayChanged: pause,
  });
  for (const [target, event] of [
    [win, 'blur'],
    [win, 'pagehide'],
    [doc, 'visibilitychange'],
    [doc, 'fullscreenchange'],
  ] as const) {
    g.startWorkshop([]);
    keys.add('KeyF');
    hidden = event === 'visibilitychange';
    target.dispatchEvent(new Event(event));
    assert.equal(g.mode, 'paused', event);
    assert.equal(keys.size, 0, event);
    if (event !== 'fullscreenchange') assert(!active);
    hidden = false;
    win.dispatchEvent(new Event('focus'));
    win.dispatchEvent(new Event('pageshow'));
    doc.dispatchEvent(new Event('visibilitychange'));
    assert(active);
    assert.equal(g.mode, 'paused', 'returning never automatically resumes the game');
  }
  dispose();
  g.setMode('playing');
  win.dispatchEvent(new Event('blur'));
  assert.equal(g.mode, 'playing');
});
