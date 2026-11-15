import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import type { Game, Input } from '../src/game.ts';
import { getGun, type Vec } from '../src/rules.ts';
import {
  type ExperimentalWeapon,
  type SwitchjackLandingReason,
} from '../src/experimental-weapons.ts';
import { fixture, wall, Body, Composite } from './branches-fixture.ts';

function tool(id: ExperimentalWeapon, mods: string[] = []) {
  const g = fixture(mods);
  g.startingGun = id;
  g.gun = getGun(mods, id);
  g.experimentalWeapons.reset();
  return g;
}
function step(g: Game, fire: boolean, frames = 1, firePressed = false) {
  for (let frame = 0; frame < frames; frame++) {
    const input: Input = {
      left: false,
      right: false,
      jump: false,
      jumpHeld: false,
      fire,
      firePressed: firePressed && frame === 0,
      aim: { ...g.aim },
    };
    g.time += 1 / 60;
    g.experimentalWeapons.input(1 / 60, input);
    g.experimentalWeapons.beforePhysics();
  }
}
function launch(g: Game, to: Vec = { x: 500, y: 300 }, release = true) {
  step(g, true);
  const bolt = g.experimentalWeapons.bolt;
  assert(bolt);
  bolt.pos = { ...to };
  if (release) step(g, false);
  return bolt;
}
function tick(g: Game, fire: boolean, firePressed = false) {
  g.tick(1 / 60, {
    left: false,
    right: false,
    jump: false,
    jumpHeld: false,
    fire,
    firePressed,
    aim: { ...g.aim },
  });
}

for (const id of ['bellows', 'switchjack'] as const) {
  test(`${id} preserves one completed quick tap across real Game.tick impact hit-stop`, () => {
    const g = tool(id);
    g.hitStop = 0.05;
    tick(g, false, true);
    assert.equal(g.shotCount, 0);
    assert(g.fireBuffer > 0);
    for (let frame = 0; frame < 8; frame++) tick(g, false);
    assert.equal(g.shotCount, 1, 'the completed tap fires once when simulation resumes');
    assert.equal(g.fireBuffer, 0);
    for (let frame = 0; frame < 60; frame++) tick(g, false);
    assert.equal(g.shotCount, 1, 'a consumed tap cannot become delayed auto-fire');
  });

  test(`${id} consumes a buffered held press once without inventing a release or another press`, () => {
    const g = tool(id);
    g.hitStop = 0.05;
    tick(g, true, true);
    for (let frame = 0; frame < 12; frame++) tick(g, true);
    if (id === 'bellows') {
      assert.equal(g.shotCount, 0, 'holding the buffered Bellows trigger only charges');
      assert(g.experimentalWeapons.pressure > 0);
      tick(g, false);
      assert.equal(g.shotCount, 1);
    } else {
      assert.equal(g.shotCount, 1);
      assert(g.experimentalWeapons.bolt, 'holding cannot consume the newly launched bolt');
      for (let frame = 0; frame < 90; frame++) tick(g, true);
      assert.equal(g.shotCount, 1, 'holding after bolt expiry cannot become another launch');
    }
  });

  for (const cancel of ['pause', 'reset'] as const) {
    test(`${id} ${cancel} cancels a hit-stop buffered tap while a later fresh tap still works`, () => {
      const g = tool(id);
      g.hitStop = 0.05;
      tick(g, false, true);
      assert(g.fireBuffer > 0);
      if (cancel === 'pause') {
        g.setMode('paused');
        g.setMode('playing');
      } else g.experimentalWeapons.reset();
      assert.equal(g.fireBuffer, 0);
      for (let frame = 0; frame < 10; frame++) tick(g, false);
      assert.equal(g.shotCount, 0);
      assert.equal(g.experimentalWeapons.pressure, 0);
      assert.equal(g.experimentalWeapons.bolt, null);
      tick(g, false, true);
      assert.equal(g.shotCount, 1);
      for (let frame = 0; frame < 10; frame++) tick(g, false);
      assert.equal(g.shotCount, 1);
    });
  }
}

test('a Switchjack second tap completed during hit-stop relocates once without firing again', () => {
  const g = tool('switchjack');
  tick(g, true, true);
  for (let frame = 0; frame < 10; frame++) tick(g, false);
  const bolt = g.experimentalWeapons.bolt;
  assert(bolt);
  assert.equal(g.experimentalWeapons.landingPreview?.ready, true);
  const before = { ...g.player.position },
    destination = { ...bolt.pos };
  g.hitStop = 0.05;
  tick(g, false, true);
  assert.deepEqual(g.player.position, before);
  assert.equal(g.experimentalWeapons.bolt, bolt);
  for (let frame = 0; frame < 8; frame++) tick(g, false);
  assert(g.player.position.x > before.x + 100);
  assert(Math.abs(g.player.position.x - destination.x) < 70);
  assert.equal(g.experimentalWeapons.bolt, null);
  assert(bolt.life <= 0, 'the spent bolt cannot remain live or deal later damage');
  assert.equal(g.shotCount, 1);
  for (let frame = 0; frame < 60; frame++) tick(g, false);
  assert.equal(g.shotCount, 1);
});

test('Switchjack preview is side-effect free, returns detached geometry and allocates no Matter IDs', () => {
  const g = tool('switchjack');
  const s = launch(g);
  const sounds: string[] = [];
  g.onSound = (name) => sounds.push(name);
  const snapshot = () => ({
    time: g.time,
    shootAt: g.shootAt,
    id: g.id,
    bodyId: (Matter.Common as typeof Matter.Common & { _nextId: number })._nextId,
    position: { ...g.player.position },
    velocity: { ...g.player.velocity },
    life: s.life,
    pos: { ...s.pos },
    vel: { ...s.vel },
    shots: g.shots.map((shot) => shot.id),
    hp: g.hp,
    blocked: g.experimentalWeapons.blocked,
  });
  const before = snapshot();
  const expected = g.experimentalWeapons.landingPreview;
  assert(expected?.ready);
  for (let i = 0; i < 20; i++) assert.deepEqual(g.experimentalWeapons.landingPreview, expected);
  assert.deepEqual(snapshot(), before);
  assert.deepEqual(sounds, []);
  expected.to.x = 123;
  expected.from.y = 123;
  expected.half.x = 123;
  assert.equal(g.experimentalWeapons.landingPreview!.to.x, 500);
  assert.equal(g.experimentalWeapons.landingPreview!.from.y, 300);
  assert.notEqual(g.experimentalWeapons.landingPreview!.half.x, 123);
});

test('Switchjack previews a point-clear but operator-obstructed gap before the player commits', () => {
  const g = tool('switchjack');
  const bolt = launch(g);
  wall(g, 350, 260, 20, 50);
  assert.deepEqual(g.lineEnd(g.player.position, bolt.pos), bolt.pos);
  const preview = g.experimentalWeapons.landingPreview;
  assert.equal(preview?.ready, false);
  assert.equal(preview?.reason, 'obstructed');
  assert.equal(
    g.experimentalWeapons.blocked,
    false,
    'previewing never generates a failed-press pulse',
  );
  const before = { ...g.player.position };
  step(g, true);
  assert.deepEqual(g.player.position, before);
  assert.equal(g.experimentalWeapons.bolt, bolt);
  assert.equal(g.experimentalWeapons.blocked, true);
});

test('Switchjack preview and failed cue immediately follow moving cover without another trigger or update', () => {
  const g = tool('switchjack');
  launch(g);
  const obstruction = wall(g, 350, 300, 20, 180);
  step(g, true);
  assert.equal(g.experimentalWeapons.blocked, true);
  Body.setPosition(obstruction, { x: 350, y: 100 });
  assert.equal(g.experimentalWeapons.landingPreview?.ready, true);
  assert.equal(g.experimentalWeapons.blocked, false);
  Body.setPosition(obstruction, { x: 350, y: 300 });
  assert.equal(g.experimentalWeapons.landingPreview?.reason, 'obstructed');
  g.time += 0.21;
  assert.equal(
    g.experimentalWeapons.blocked,
    false,
    'a failed pulse expires even while the route stays blocked',
  );
  assert.equal(g.experimentalWeapons.landingPreview?.ready, false);
  Composite.remove(g.engine.world, obstruction);
  g.terrain = g.terrain.filter((body) => body !== obstruction);
  assert.equal(g.experimentalWeapons.landingPreview?.ready, true);
});

test('safe Switchjack relocation stays available during launch recovery and explains the release gesture separately', () => {
  const g = tool('switchjack');
  const bolt = launch(g, { x: 500, y: 300 }, false);
  const held = g.experimentalWeapons.landingPreview;
  assert(held?.ready);
  assert(held.launchCooldown > 0);
  assert.equal(held.needsRelease, true);
  step(g, false);
  assert.equal(g.experimentalWeapons.landingPreview?.needsRelease, false);
  assert(g.experimentalWeapons.landingPreview!.launchCooldown > 0);
  step(g, true);
  assert.deepEqual(g.player.position, { x: 500, y: 300 });
  assert.equal(bolt.life, 0);
  assert.equal(g.experimentalWeapons.landingPreview, null);
});

test('Switchjack preview reports actual remaining lifetime without advancing either clock', () => {
  const g = tool('switchjack');
  const bolt = launch(g);
  const first = g.experimentalWeapons.landingPreview!.remainingLife;
  g.time += 0.2;
  assert(Math.abs(g.experimentalWeapons.landingPreview!.remainingLife - (first - 0.2)) < 1e-8);
  bolt.life = 0.05;
  assert.equal(g.experimentalWeapons.landingPreview!.remainingLife, 0.05);
  g.time += 2;
  assert.equal(g.experimentalWeapons.landingPreview, null);
  assert.equal(bolt.life, 0.05, 'reading an expired preview cannot mutate the ammunition');
});

const previews: { reason: SwitchjackLandingReason; to: Vec; setup?: (g: Game) => void }[] = [
  { reason: 'ready', to: { x: 500, y: 300 } },
  { reason: 'too-close', to: { x: 205, y: 300 } },
  { reason: 'out-of-range', to: { x: 700, y: 300 } },
  { reason: 'boundary', to: { x: 200, y: 5 } },
  {
    reason: 'crusher',
    to: { x: 500, y: 300 },
    setup: (g) => {
      g.hazards.spawn({ kind: 'crusher', x: 500, y: 150, w: 90, h: 24, travel: 220 });
    },
  },
  {
    reason: 'obstructed',
    to: { x: 500, y: 300 },
    setup: (g) => {
      g.props.spawn('crate', 350, 300);
    },
  },
];
for (const { reason, to, setup } of previews) {
  test(`Switchjack ${reason} preview and the committed action use identical safety decisions`, () => {
    const g = tool('switchjack');
    const bolt = launch(g, to);
    setup?.(g);
    const before = { ...g.player.position },
      preview = g.experimentalWeapons.landingPreview;
    assert.equal(preview?.reason, reason);
    assert.equal(preview?.ready, reason === 'ready');
    step(g, true);
    assert.deepEqual(g.player.position, reason === 'ready' ? to : before);
    assert.equal(bolt.life === 0, reason === 'ready');
  });
}

test('Bellows full-pressure cue sounds once per charge, including while the receiver is still cycling', () => {
  const g = tool('bellows', ['magnum']);
  const sounds: string[] = [];
  g.onSound = (name) => sounds.push(name);
  step(g, false, 1, true);
  step(g, true, 40);
  assert.equal(g.experimentalWeapons.pressure, 1);
  assert(g.time < g.shootAt, 'full pressure is distinct from receiver readiness');
  assert.equal(sounds.filter((name) => name === 'bellows-ready').length, 1);
  step(g, true, 60);
  assert.equal(sounds.filter((name) => name === 'bellows-ready').length, 1);
  step(g, false);
  step(g, true, 45);
  assert.equal(sounds.filter((name) => name === 'bellows-ready').length, 2);
});

test('Debt high-pressure warning occurs once per banked cycle and resets after a vent', () => {
  const g = tool('debt-collector');
  const sounds: string[] = [];
  g.onSound = (name) => sounds.push(name);
  g.experimentalWeapons.captureRecoil({ x: 1, y: 0 }, 19.3);
  assert.equal(sounds.filter((name) => name === 'debt-warning').length, 1);
  g.experimentalWeapons.captureRecoil({ x: 1, y: 0 }, 0.1);
  step(g, true, 20);
  assert.equal(sounds.filter((name) => name === 'debt-warning').length, 1);
  step(g, false);
  assert.equal(g.experimentalWeapons.debt, 0);
  g.experimentalWeapons.captureRecoil({ x: 1, y: 0 }, 19.3);
  assert.equal(sounds.filter((name) => name === 'debt-warning').length, 2);
});

test('Debt skips a redundant high-pressure warning for an immediate automatic vent', () => {
  const g = tool('debt-collector');
  const sounds: string[] = [];
  g.onSound = (name) => sounds.push(name);
  g.experimentalWeapons.captureRecoil({ x: 1, y: 0 }, 100);
  assert.deepEqual(sounds, ['debt-vent']);
  g.experimentalWeapons.captureRecoil({ x: 1, y: 0 }, 100);
  assert.equal(g.experimentalWeapons.debt, 1);
  assert.deepEqual(
    sounds,
    ['debt-vent', 'debt-warning'],
    'a cap held during vent recovery merits one warning',
  );
});

test('Debt vent direction snapshots the actual paid kick and cannot be changed through a read or later aim', () => {
  const g = tool('debt-collector');
  g.experimentalWeapons.captureRecoil({ x: 1, y: 0 }, 8);
  g.aim = { x: 200, y: 0 };
  step(g, false);
  assert.deepEqual(g.experimentalWeapons.ventDirection, { x: 0, y: 1 });
  g.aim = { x: 1000, y: 300 };
  const copy = g.experimentalWeapons.ventDirection!;
  copy.x = 9;
  assert.deepEqual(g.experimentalWeapons.ventDirection, { x: 0, y: 1 });
  g.time += 0.21;
  assert.equal(g.experimentalWeapons.ventDirection, null);
});

test('a fully clamped Debt vent does not invent a displayed kick, and pause clears its snapshot', () => {
  const g = tool('debt-collector');
  g.experimentalWeapons.captureRecoil({ x: 1, y: 0 }, 8);
  Body.setVelocity(g.player, { x: -23, y: 0 });
  step(g, false);
  assert.equal(g.experimentalWeapons.ventDirection, null);
  Body.setVelocity(g.player, { x: 0, y: 0 });
  g.experimentalWeapons.captureRecoil({ x: 1, y: 0 }, 8);
  step(g, false);
  assert.deepEqual(g.experimentalWeapons.ventDirection, { x: -1, y: 0 });
  g.setMode('paused');
  assert.equal(g.experimentalWeapons.ventDirection, null);
});
