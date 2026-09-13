import test from 'node:test';
import assert from 'node:assert/strict';
import { Controller, controllerSettings, stick, type PadLike } from '../src/controller.ts';

function fixture() {
  const pad: PadLike = {
    index: 0,
    id: 'test standard pad',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  let pads: (PadLike | null)[] = [pad];
  const controller = new Controller(controllerSettings(null), () => pads);
  let time = 0;
  const poll = (ms = 17, active = true) => controller.poll((time += ms), active);
  const button = (index: number, value = 1) => {
    (pad.buttons as { pressed: boolean; value: number }[])[index] = {
      pressed: value >= 0.6,
      value,
    };
  };
  poll();
  return {
    pad,
    controller,
    poll,
    button,
    setPads: (next: (PadLike | null)[]) => {
      pads = next;
    },
  };
}

test('radial deadzones reject drift and invalid axes while preserving full diagonal aim', () => {
  assert.deepEqual(stick(0.1, -0.1, 0.18), { x: 0, y: 0 });
  assert.deepEqual(stick(NaN, Infinity, 0.18), { x: 0, y: 0 });
  assert.deepEqual(stick(1, 0, 0.18), { x: 1, y: 0 });
  const diagonal = stick(1, 1, 0.18);
  assert(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-9);
  assert(Math.abs(diagonal.x - diagonal.y) < 1e-9);
  assert(stick(0.5, 0, 0.18).x > 0 && stick(0.5, 0, 0.18).x < 0.5);
  assert.deepEqual(controllerSettings({ moveDeadzone: 0, aimDeadzone: 2, rumble: false }), {
    moveDeadzone: 0.05,
    aimDeadzone: 0.4,
    rumble: false,
  });
  assert.deepEqual(
    controllerSettings({ moveDeadzone: 'bad', aimDeadzone: NaN }),
    controllerSettings(null),
  );
});
test('standard controls separate edge presses from holds and release immediately', () => {
  const f = fixture();
  f.button(4);
  f.button(7);
  f.button(6);
  let s = f.poll();
  assert(s.jump && s.jumpHeld && s.fire && s.firePressed && s.portal);
  assert(!s.confirm);
  s = f.poll();
  assert(s.jumpHeld && s.fire);
  assert(!s.jump && !s.firePressed && !s.portal);
  f.button(4, 0);
  f.button(7, 0);
  f.button(6, 0);
  s = f.poll();
  assert(!s.fire && !s.jumpHeld);
  f.button(0);
  f.button(1);
  f.button(9);
  s = f.poll();
  assert(s.confirm && s.jump && s.back && s.pause);
});
test('analog trigger hysteresis prevents repeated fire and portal edges', () => {
  const f = fixture();
  f.button(7, 0.56);
  assert(f.poll().firePressed);
  for (const value of [0.51, 0.4, 0.55, 0.36]) {
    f.button(7, value);
    const s = f.poll();
    assert(s.fire && !s.firePressed);
  }
  f.button(7, 0.2);
  assert(!f.poll().fire);
  f.button(7, 0.8);
  assert(f.poll().firePressed);
});
test('dialog transitions require held actions and movement to return to neutral', () => {
  const f = fixture();
  f.pad.axes = [1, 0, 0, 1];
  f.button(0);
  f.button(7);
  f.button(6);
  f.poll();
  f.controller.disarm();
  for (let i = 0; i < 8; i++) {
    const s = f.poll();
    assert(!s.jump && !s.jumpHeld && !s.fire && !s.portal && !s.confirm);
    assert.equal(s.move, 0);
  }
  f.pad.axes = [0, 0, 0, 0];
  f.button(0, 0);
  f.button(7, 0);
  f.button(6, 0);
  f.poll();
  f.pad.axes = [0.8, 0, 0, 0];
  f.button(7);
  f.button(6);
  const s = f.poll();
  assert(s.firePressed && s.portal && s.move > 0.5);
});
test('focus loss cannot replay actions on return, even when a button was pressed while hidden', () => {
  const f = fixture();
  f.poll(17, false);
  f.button(7);
  f.button(9);
  f.poll(17, false);
  let s = f.poll();
  assert(!s.fire && !s.pause && !s.activity);
  f.button(7, 0);
  f.button(9, 0);
  f.poll();
  f.button(7);
  s = f.poll();
  assert(s.activity && s.firePressed);
});
test('a connected or drifting pad does not claim the mouse on every poll', () => {
  const f = fixture();
  f.pad.axes = [0.04, -0.05, 0.1, 0.03];
  assert(!f.poll().activity);
  f.pad.axes = [0, 0, 0.8, 0];
  assert(f.poll().activity);
  assert(!f.poll().activity);
  f.pad.axes = [0, 0, 0.81, 0.015];
  assert(!f.poll().activity);
  f.pad.axes = [0, 0, 0, 0];
  assert(!f.poll().activity);
  f.button(7);
  assert(f.poll().activity);
  assert(!f.poll().activity);
});
test('menu navigation repeats deliberately and conflicting D-pad directions cancel', () => {
  const f = fixture();
  f.button(13);
  assert.equal(f.poll().navigation, 'down');
  assert.equal(f.poll(100).navigation, null);
  assert.equal(f.poll(251).navigation, 'down');
  assert.equal(f.poll(125).navigation, 'down');
  f.button(12);
  assert.equal(f.poll().navigation, null);
  f.button(13, 0);
  assert.equal(f.poll().navigation, 'up');
  f.controller.disarm();
  assert.equal(f.poll(500).navigation, null);
});
test('a slow stick sweep still takes control without counting tiny jitter as activity', () => {
  const f = fixture();
  let activities = 0;
  for (let x = 0; x <= 0.8; x += 0.01) {
    f.pad.axes = [0, 0, x, 0];
    if (f.poll().activity) activities++;
  }
  assert(activities >= 4);
  for (let i = 0; i < 30; i++) {
    f.pad.axes = [0, 0, 0.79 + (i % 2) * 0.005, 0];
    assert(!f.poll().activity);
  }
});
test('disconnect, sparse lists, remapped devices and a replacement pad fail safely', () => {
  const f = fixture();
  f.button(7);
  assert(f.poll().fire);
  f.setPads([null]);
  let s = f.poll();
  assert(s.disconnected && !s.connected && !s.fire);
  assert(!f.poll().disconnected);
  f.pad.mapping = '';
  f.setPads([f.pad]);
  assert(!f.poll().connected);
  f.pad.mapping = 'standard';
  f.setPads([null, f.pad]);
  s = f.poll();
  assert(s.connected && !s.fire);
  f.button(7, 0);
  f.poll();
  f.button(7);
  assert(f.poll().firePressed);
  const other = { ...f.pad, index: 2, id: 'other' };
  f.setPads([other, f.pad]);
  assert(!f.poll().disconnected); // Keep the current player.
  f.setPads([other]);
  s = f.poll();
  assert(s.disconnected && !s.fire);
});
test('missing or denied Gamepad API leaves a neutral input', () => {
  const c = new Controller(controllerSettings(null), () => {
    throw new Error('denied');
  });
  assert(!c.poll(1).connected);
  assert.doesNotThrow(() => c.stopRumble());
});
test('rumble is bounded, damage takes priority, and stopping or disabling clears it', async () => {
  const f = fixture(),
    calls: GamepadEffectParameters[] = [];
  let resets = 0;
  f.pad.vibrationActuator = {
    playEffect: async (type, params) => {
      assert.equal(type, 'dual-rumble');
      calls.push(params);
    },
    reset: async () => {
      resets++;
    },
  };
  f.controller.rumble('shot', 0.5, 100);
  f.controller.rumble('shot', 1, 110);
  assert.equal(calls.length, 1);
  f.controller.rumble('hurt', 8, 120);
  assert.equal(calls.length, 2);
  f.controller.rumble('land', 1, 140);
  assert.equal(calls.length, 2);
  assert(calls[1].duration! <= 150 && calls[1].strongMagnitude! <= 0.5);
  f.controller.disarm();
  assert.equal(resets, 1);
  f.controller.stopRumble();
  assert.equal(resets, 1);
  f.controller.settings.rumble = false;
  f.controller.rumble('shot', 1, 1000);
  assert.equal(calls.length, 2);
  f.controller.settings.rumble = true;
  f.controller.rumble('shot', 1, 1100);
  f.setPads([]);
  f.poll();
  assert.equal(resets, 2);
  await Promise.resolve();
});
test('unsupported haptics and rejected effects never break play or spam promises', async () => {
  const f = fixture();
  let calls = 0;
  assert.doesNotThrow(() => f.controller.rumble('shot', 1, 0));
  f.pad.vibrationActuator = {
    playEffect: async () => {
      calls++;
      throw new Error('unsupported');
    },
    reset: async () => {
      throw new Error('unsupported');
    },
  };
  f.controller.rumble('shot', 1, 100);
  await Promise.resolve();
  await Promise.resolve();
  f.controller.rumble('shot', 1, 1000);
  assert.equal(calls, 1);
  assert.doesNotThrow(() => f.controller.stopRumble());
  await Promise.resolve();
});
