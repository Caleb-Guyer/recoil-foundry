import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { courierTestFromUrl } from '../src/courier-layout.ts';
import { COURIER_DOOR, COURIER_DOOR_TIME } from '../src/courier.ts';
import {
  courierSnapshot,
  courierPose,
  courierShutdownPose,
  COURIER_EVENT_LIFE,
  COURIER_WRECK_LIFE,
} from '../src/courier-pose.ts';
import { seeded, type Checkpoint } from '../src/rules.ts';
const { Body, Bodies, Composite } = Matter;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1700, y: 700 },
};
function preset(mirror = false) {
  return courierTestFromUrl(
    new URL('https://example.test/?test=courier' + (mirror ? '&mirror=1' : '')),
  )!;
}
function setup(mirror = false, enabled = true) {
  const g = new Game();
  g.courier.presentation.enabled = enabled;
  g.startTest(preset(mirror));
  for (const e of [...g.enemies])
    if (!e.courier) {
      Composite.remove(g.engine.world, e.body);
      g.enemies = g.enemies.filter((a) => a !== e);
    }
  g.waves.clear();
  return g;
}
function ticks(g: Game, count = 1) {
  for (let i = 0; i < count; i++) g.tick(1 / 60, idle);
}
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
function native(g: Game) {
  const body = (b: Matter.Body | null) =>
    b
      ? {
          label: b.label,
          p: { ...b.position },
          v: { ...b.velocity },
          angle: b.angle,
          angularVelocity: b.angularVelocity,
          friction: b.friction,
          frictionAir: b.frictionAir,
          mask: { ...b.collisionFilter },
        }
      : null;
  const c = g.courier;
  return {
    seed: g.seed,
    mode: g.mode,
    time: g.time,
    elapsed: g.elapsed,
    hp: g.hp,
    kills: g.kills,
    stage: g.stage,
    clear: g.clear,
    mods: [...g.mods],
    offers: g.offers.map((m) => m.id),
    reward: g.courierReward,
    player: body(g.player),
    enemies: g.enemies.map((e) => ({
      kind: e.kind,
      courier: e.courier,
      hp: e.hp,
      maxHp: e.maxHp,
      spawn: e.spawn,
      state: e.state,
      timer: e.timer,
      body: body(e.body),
    })),
    courier: {
      state: c.state ? { ...c.state } : null,
      running: c.running,
      age: c.age,
      jumpAt: c.jumpAt,
      boost: c.boost,
      boostAt: c.boostAt,
      opening: c.opening,
      resting: c.resting,
      nextCover: c.nextCover,
      lastSafe: { ...c.lastSafe },
      cargo: body(c.cargo),
    },
    worldBodies: Composite.allBodies(g.engine.world)
      .map((b) => ({ label: b.label, p: { ...b.position }, angle: b.angle }))
      .sort((a, b) => a.label.localeCompare(b.label) || a.p.x - b.p.x || a.p.y - b.p.y),
  };
}

test('Courier snapshots and poses are detached pure reads without random draws or temporary Matter IDs', () => {
  const g = setup(),
    e = g.courier.enemy!,
    before = native(g);
  const random = Math.random,
    nextId = (Matter.Common as any)._nextId;
  const rng = g.rng;
  let draws = 0;
  g.rng = () => {
    draws++;
    throw new Error('Presentation cannot consume combat randomness');
  };
  Math.random = () => {
    throw new Error('Presentation cannot consume cosmetic randomness');
  };
  try {
    for (let i = 0; i < 12; i++) {
      const s = courierSnapshot(g, e),
        frozen = structuredClone(s);
      const p = courierPose(s, g.time + i / 60, i % 2 === 0);
      assert.deepEqual(s, frozen);
      p.position.x = -999;
      p.cargoOffset.y = 999;
      s.position.x = -1000;
      s.velocity.y = 1000;
      g.courier.presentation.observe(e);
      g.courier.presentation.update();
    }
  } finally {
    Math.random = random;
    g.rng = rng;
  }
  assert.equal(draws, 0);
  assert.equal((Matter.Common as any)._nextId, nextId);
  assert.deepEqual(native(g), before);
  assert.equal(courierSnapshot(g, e).position.x, e.body.position.x);
});

test('wheel travel observes real supported motion, rests at zero displacement and ignores portal-sized relocations', () => {
  const g = setup(),
    e = g.courier.enemy!;
  e.spawn = 0;
  g.courier.running = true;
  g.courier.resting = 0;
  g.courier.boostAt = 100;
  const initial = courierSnapshot(g, e);
  ticks(g, 15);
  const moving = courierSnapshot(g, e);
  assert(moving.position.x > initial.position.x);
  assert(moving.wheelDistance > 0);
  const distance = moving.wheelDistance;
  g.courier.presentation.observe(e);
  g.courier.presentation.observe(e);
  assert.equal(courierSnapshot(g, e).wheelDistance, distance);
  Body.setPosition(e.body, { x: e.body.position.x + 300, y: e.body.position.y });
  g.courier.presentation.observe(e);
  assert.equal(courierSnapshot(g, e).wheelDistance, distance);
  const reduced = courierPose(courierSnapshot(g, e), g.time, true);
  assert.equal(reduced.wheelAngle, 0);
  assert.deepEqual(reduced.bodyOffset, { x: 0, y: 0 });
});

test('airborne posture and landing compression follow an actual fall and real supporting floor', () => {
  const g = setup(),
    e = g.courier.enemy!;
  Body.setPosition(g.player, { x: 1800, y: 724 });
  Body.setPosition(e.body, { x: 410, y: 500 });
  Body.setVelocity(e.body, { x: 0, y: 5 });
  e.spawn = 0;
  g.courier.presentation.observe(e);
  const airborne = courierSnapshot(g, e);
  assert.equal(airborne.grounded, false);
  assert.equal(airborne.supportY, null);
  let landed = false;
  for (let i = 0; i < 100; i++) {
    ticks(g);
    const s = courierSnapshot(g, e);
    if (s.landingAt !== null) {
      landed = true;
      assert(s.grounded);
      near(s.supportY!, 740);
      assert(s.landingStrength > 0);
      assert(courierPose(s, g.time).suspension > 0);
      break;
    }
  }
  assert(landed, 'the live native body must actually land');
});

test('only accepted hull loss records its real direction and the existing health thresholds drive wear', () => {
  const g = setup(),
    e = g.courier.enemy!;
  g.hitEnemy(e, 60, { x: e.body.position.x - 100, y: e.body.position.y }, false);
  let s = courierSnapshot(g, e);
  assert.equal(s.hp, 110);
  assert.equal(s.wear, 1);
  assert.equal(s.hit!.healthLost, 60);
  assert(s.hit!.direction!.x > 0.99);
  assert(s.hit!.local!.x < 0);
  const immutable = structuredClone(s.hit);
  s.hit!.local!.x = 999;
  assert.deepEqual(courierSnapshot(g, e).hit, immutable);
  g.hitEnemy(e, 60, { x: e.body.position.x + 100, y: e.body.position.y }, false);
  s = courierSnapshot(g, e);
  assert.equal(s.hp, 50);
  assert.equal(s.wear, 2);
  assert(s.hit!.direction!.x < -0.99);
  assert(s.hit!.local!.x > 0);
  const previous = structuredClone(s.hit);
  g.hitEnemy(e, 0, undefined, false);
  assert.deepEqual(courierSnapshot(g, e).hit, previous);
  e.allied = true;
  g.hitEnemy(e, 10, undefined, false);
  assert.equal(e.hp, 50);
  assert.deepEqual(courierSnapshot(g, e).hit, previous);
  e.allied = false;
  g.hitEnemy(e, 1, undefined, false, false, true, 'cleanup');
  assert.deepEqual(courierSnapshot(g, e).hit, previous);
});

test('real defeat captures one detached prelethal rig while native physics owns exactly one separate case', () => {
  const g = setup(),
    e = g.courier.enemy!;
  Body.setPosition(e.body, { x: 800, y: 400 });
  Body.setVelocity(e.body, { x: 4, y: 2 });
  const bodies = Composite.allBodies(g.engine.world).length,
    before = courierSnapshot(g, e);
  g.hitEnemy(e, 9999, { x: 700, y: 400 }, false);
  const records = g.courier.presentation.wrecks,
    w = records[0];
  assert.equal(records.length, 1);
  assert(g.courier.cargo);
  assert.equal(
    Composite.allBodies(g.engine.world).length,
    bodies,
    'only native hull -> native case replacement',
  );
  assert.equal(w.snapshot.hp, before.hp);
  assert.deepEqual(w.snapshot.position, before.position);
  assert.deepEqual(w.snapshot.velocity, before.velocity);
  assert.equal(w.snapshot.cargoHeld, false);
  const p = courierShutdownPose(w);
  assert.equal(p.energy, 0);
  assert.equal(p.cargoHeld, false);
  assert.equal(p.boost, 0);
  assert.equal(g.courier.presentation.events.filter((e) => e.kind === 'drop').length, 1);
  const caseBody = g.courier.cargo;
  g.courier.killed(e);
  assert.equal(g.courier.cargo, caseBody);
  assert.equal(records.length, 1);
  Body.setPosition(e.body, { x: 10, y: 10 });
  assert.deepEqual(
    w.snapshot.position,
    before.position,
    'removed native body cannot mutate detached wreck',
  );
  const serialized = JSON.parse(JSON.stringify(w));
  assert.deepEqual(serialized, w);
});

for (const angle of [0, 0.12])
  test(`inert wreck lands on real raised support at angle ${angle}, follows movement and falls when support is removed`, () => {
    const g = setup(),
      e = g.courier.enemy!;
    const deck = Bodies.rectangle(800, 510, 320, 24, { isStatic: true, angle });
    g.terrain.push(deck);
    Composite.add(g.engine.world, deck);
    Body.setPosition(e.body, { x: 800, y: 350 });
    Body.setVelocity(e.body, { x: 0, y: 0 });
    g.hitEnemy(e, 9999, undefined, false);
    const w = g.courier.presentation.wrecks[0];
    for (let i = 0; i < 100 && !w.grounded; i++) {
      g.time += 1 / 60;
      g.courier.presentation.update();
    }
    assert(w.grounded);
    assert.equal(w.landing?.bodyId, deck.id);
    assert(w.position.y < 510);
    near(w.angle, angle);
    const at = { ...w.position };
    Body.translate(deck, { x: 50, y: -12 });
    g.time += 1 / 60;
    g.courier.presentation.update();
    near(w.position.x, at.x + 50);
    near(w.position.y, at.y - 12);
    Composite.remove(g.engine.world, deck);
    g.terrain = g.terrain.filter((b) => b !== deck);
    const y = w.position.y;
    g.time += 1 / 60;
    g.courier.presentation.update();
    assert.equal(w.grounded, false);
    assert.equal(w.landing, null);
    assert(w.position.y > y);
  });

test('Pause and impact hitstop freeze live/wreck/event presentation, while retry, room changes and death clear it', () => {
  const g = setup(),
    e = g.courier.enemy!;
  g.hitEnemy(e, 9999, undefined, false);
  const before = structuredClone(g.courier.presentation.wrecks),
    events = structuredClone(g.courier.presentation.events);
  g.setMode('paused');
  ticks(g, 120);
  assert.deepEqual(g.courier.presentation.wrecks, before);
  assert.deepEqual(g.courier.presentation.events, events);
  g.setMode('playing');
  g.hitStop = 0.5;
  ticks(g, 10);
  assert.deepEqual(g.courier.presentation.wrecks, before);
  g.hitStop = 0;
  ticks(g);
  assert(g.courier.presentation.wrecks[0].age > 0);
  g.startTest(preset());
  assert.equal(g.courier.presentation.wrecks.length, 0);
  assert.equal(g.courier.presentation.events.length, 0);
  g.hitEnemy(g.courier.enemy!, 9999, undefined, false);
  g.loadRoom();
  assert.equal(g.courier.presentation.wrecks.length, 0);
  assert.equal(g.courier.presentation.events.length, 0);
  g.setMode('dead');
  assert.equal(g.courier.presentation.wrecks.length, 0);
  assert.equal(g.courier.presentation.events.length, 0);
});

test('native three-second hatch escape keeps its live cargo and never creates a corpse, reward or dropped case', () => {
  const g = setup(),
    e = g.courier.enemy!;
  e.spawn = 0;
  g.courier.running = true;
  Body.setPosition(e.body, { x: COURIER_DOOR.x, y: 724 });
  Body.setVelocity(e.body, { x: 0, y: 0 });
  ticks(g, 90);
  assert(g.courier.enemy);
  assert(g.courier.opening >= 1.4 && g.courier.opening < COURIER_DOOR_TIME);
  const s = courierSnapshot(g, e);
  assert.equal(courierPose(s).mode, 'hatch');
  assert.equal(s.cargoHeld, true);
  for (let i = 0; i < 100 && g.courier.enemy; i++) ticks(g);
  assert.equal(g.courier.enemy, null);
  assert.equal(g.courier.cargo, null);
  assert.equal(g.courier.state?.status, 'lost');
  assert.equal(g.kills, 0);
  assert.equal(g.courierReward, false);
  assert.equal(g.courier.presentation.wrecks.length, 0);
  const event = g.courier.presentation.events.find((e) => e.kind === 'escape');
  assert(event?.snapshot);
  assert(event.snapshot.opening >= COURIER_DOOR_TIME);
  assert(event.snapshot.hp > 0);
  assert(event.snapshot.cargoHeld);
});

test('case-drop and pickup observations follow native line-of-sight acceptance without changing saved Courier status', () => {
  const g = setup();
  g.hitEnemy(g.courier.enemy!, 9999, undefined, false);
  const cargo = g.courier.cargo!;
  Body.setPosition(g.player, { x: cargo.position.x - 30, y: cargo.position.y });
  const wall = Bodies.rectangle(cargo.position.x - 15, cargo.position.y, 6, 80, { isStatic: true });
  g.terrain.push(wall);
  Composite.add(g.engine.world, wall);
  g.courier.update(1 / 60);
  assert(g.courier.cargo);
  assert.equal(g.courier.presentation.events.filter((e) => e.kind === 'pickup').length, 0);
  Composite.remove(g.engine.world, wall);
  g.terrain = g.terrain.filter((b) => b !== wall);
  g.courier.update(1 / 60);
  assert.equal(g.courier.cargo, null);
  assert.equal(g.courier.state?.status, 'collected');
  assert.equal(g.courier.presentation.events.filter((e) => e.kind === 'pickup').length, 1);
  assert.equal(g.courier.presentation.wrecks[0].snapshot.cargoHeld, false);
  g.courier.update(1 / 60);
  assert.equal(g.courier.presentation.events.filter((e) => e.kind === 'pickup').length, 1);
});

test('cosmetic records stay bounded, expire on simulation time and Reduced Effects uses a steady defeated pose', () => {
  const g = setup();
  g.hitEnemy(g.courier.enemy!, 9999, undefined, false);
  for (let i = 0; i < 30; i++) g.courier.presentation.event('drop', { x: i, y: 100 });
  assert.equal(g.courier.presentation.events.length, 8);
  assert.equal(g.courier.presentation.wrecks.length, 1);
  const w = g.courier.presentation.wrecks[0],
    pose = courierShutdownPose(w, true);
  w.age = 0.5;
  const later = courierShutdownPose(w, true);
  assert.deepEqual(later.bodyOffset, pose.bodyOffset);
  assert.equal(later.bodyAngle, pose.bodyAngle);
  assert.equal(later.wheelAngle, pose.wheelAngle);
  assert.equal(later.cargoHeld, false);
  assert.equal(later.energy, 0);
  g.time = COURIER_EVENT_LIFE + 0.01;
  g.courier.presentation.update();
  assert.equal(g.courier.presentation.events.length, 0);
  g.time = COURIER_WRECK_LIFE + 0.01;
  g.courier.presentation.update();
  assert.equal(g.courier.presentation.wrecks.length, 0);
});

function trace(enabled: boolean, mirror: boolean, escape: boolean) {
  const random = Math.random;
  Math.random = seeded('courier-native-cosmetics');
  try {
    const g = setup(mirror, enabled),
      frames: unknown[] = [],
      sounds: string[] = [],
      checkpoints: unknown[] = [];
    g.onSound = (s) => sounds.push(s);
    g.onCheckpoint = (s) => checkpoints.push(structuredClone(s));
    const e = g.courier.enemy!;
    if (escape) {
      e.spawn = 0;
      g.courier.running = true;
      Body.setPosition(e.body, { x: 1760, y: 724 });
      Body.setVelocity(e.body, { x: 0, y: 0 });
    }
    for (let i = 0; i < (escape ? 200 : 160); i++) {
      if (!escape && i === 70)
        g.hitEnemy(e, 20, { x: e.body.position.x - 30, y: e.body.position.y });
      if (!escape && i === 100)
        g.hitEnemy(e, 40, { x: e.body.position.x + 30, y: e.body.position.y });
      if (!escape && i === 130)
        g.hitEnemy(e, 9999, { x: e.body.position.x - 30, y: e.body.position.y });
      if (!escape && i === 150 && g.courier.cargo)
        Body.setPosition(g.player, { ...g.courier.cargo.position });
      ticks(g);
      frames.push(native(g));
    }
    if (!escape) {
      g.clear = true;
      g.openReward();
      frames.push(native(g));
      g.chooseMod(g.offers[0].id);
      frames.push(native(g));
    }
    const nextRandom = g.rng();
    return { frames, sounds, checkpoints, nextRandom };
  } finally {
    Math.random = random;
  }
}
for (const mirror of [false, true])
  for (const escape of [false, true])
    test(`observer enabled/disabled preserve native ${escape ? 'hatch escape' : 'damage, case and bonus reward'} trace, arrangement ${Number(mirror)}`, () => {
      assert.deepEqual(trace(true, mirror, escape), trace(false, mirror, escape));
    });

test('presentation state is excluded from real version-six Courier checkpoints and original Continue fields', () => {
  const cp: Checkpoint = {
    ...preset(),
    stage: 5,
    mods: [...preset().mods, 'rapid'],
    courier: { stage: 5, status: 'pending' },
  };
  const g = new Game();
  g.start(cp.seed, cp);
  let saved: Checkpoint | null = null;
  g.onCheckpoint = (s) => (saved = s);
  const before = JSON.parse(JSON.stringify(g.courier.state));
  g.courier.presentation.event('drop', { x: 100, y: 100 });
  g.courier.presentation.observe(g.courier.enemy!);
  g.save();
  assert(saved);
  assert.deepEqual((saved as Checkpoint).courier, before);
  assert(!JSON.stringify(saved).includes('presentation'));
  assert(!JSON.stringify(saved).includes('wheelDistance'));
  assert.deepEqual(Object.keys((saved as Checkpoint).courier!).sort(), ['stage', 'status']);
  const h = new Game();
  h.start((saved as Checkpoint).seed, saved);
  assert.deepEqual(h.courier.state, g.courier.state);
  assert.equal(h.courier.presentation.events.length, 0);
  assert.equal(h.courier.presentation.wrecks.length, 0);
});
