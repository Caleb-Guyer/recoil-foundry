import test from 'node:test';
import assert from 'node:assert/strict';
import { type Game, type Input } from '../src/game.ts';
import { getGun, type Vec } from '../src/rules.ts';
import { EXPERIMENTAL_WEAPONS, type ExperimentalWeapon } from '../src/experimental-weapons.ts';
import { fixture, target, wall, Body, beam } from './branches-fixture.ts';

const input = (g: Game, fire: boolean, firePressed = false): Input => ({
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire,
  firePressed,
  aim: { ...g.aim },
});
function tool(id: ExperimentalWeapon, mods: string[] = []) {
  const g = fixture(mods);
  g.startingGun = id;
  g.gun = getGun(mods, id);
  g.experimentalWeapons.reset();
  return g;
}
function step(g: Game, fire: boolean, frames = 1, firePressed = false) {
  for (let frame = 0; frame < frames; frame++) {
    g.time += 1 / 60;
    g.experimentalWeapons.input(1 / 60, input(g, fire, firePressed && frame === 0));
    g.experimentalWeapons.beforePhysics();
  }
}
function beacon(g: Game, pos: Vec = { x: 500, y: 300 }) {
  step(g, true);
  const s = g.experimentalWeapons.bolt;
  assert(s, 'first trigger launches a live bolt');
  s.pos = { ...pos };
  step(g, false);
  return s;
}

test('Bellows holds its volley, draws the player forward, then releases short-range fire and backward recoil', () => {
  const g = tool('bellows');
  step(g, true, 24);
  assert.equal(g.shotCount, 0);
  assert(g.experimentalWeapons.pressure > 0.5);
  assert(g.player.velocity.x > 0);
  step(g, false);
  assert.equal(g.shotCount, 1);
  assert.equal(g.shots.length, 5);
  assert(g.player.velocity.x < -5);
  assert.equal(g.experimentalWeapons.pressure, 0);
  for (const s of g.shots) {
    assert(s.damage > 0);
    assert(s.life * Math.hypot(s.vel.x, s.vel.y) * 60 <= 290 + 1e-7);
  }
  step(g, false, 60);
  assert.equal(g.shotCount, 1, 'release produces one volley rather than repeat fire');
});

test('Bellows accepts an isolated quick-click edge without requiring scrap or a held button', () => {
  const g = tool('bellows');
  step(g, false, 1, true);
  assert.equal(g.shotCount, 1);
  assert.equal(g.shots.length, 5);
  assert(g.shots.every((s) => s.damage > 0));
});

test('Bellows refills pressure while its previous blast cycles and can release a full second volley at its real cadence', () => {
  const g = tool('bellows');
  step(g, false, 1, true);
  const firstAt = g.lastShot,
    firstDamage = g.shots[0].damage;
  step(g, true, 20);
  assert(g.time < g.shootAt);
  assert(g.experimentalWeapons.pressure > 0.5, 'the intake is usable during mechanical recovery');
  assert.equal(g.shotCount, 1);
  step(g, true, 20);
  assert.equal(g.experimentalWeapons.pressure, 1);
  assert.equal(g.shotCount, 1, 'filling the bellows cannot auto-fire');
  step(g, false);
  assert.equal(g.shotCount, 2);
  assert(g.lastShot - firstAt < 0.8, 'refilling and cycling overlap rather than doubling recovery');
  assert(g.shots.at(-1)!.damage > firstDamage * 1.5);
});

test('releasing Bellows during recovery cancels pressure, retains gathered scrap and never queues an unwanted launch', () => {
  const g = tool('bellows');
  step(g, false, 1, true);
  const scrap = g.props.spawn('rubble', 233, 300);
  step(g, true, 6);
  assert(!g.props.items.includes(scrap));
  assert(g.experimentalWeapons.pressure > 0);
  assert.equal(g.experimentalWeapons.scrapCount, 1);
  step(g, false);
  assert.equal(g.experimentalWeapons.pressure, 0);
  assert.equal(g.experimentalWeapons.scrapCount, 1);
  step(g, false, 60);
  assert.equal(g.shotCount, 1);
  step(g, false, 1, true);
  assert.equal(g.shotCount, 2);
  assert.equal(g.experimentalWeapons.scrapCount, 0);
});

test('Bellows pressure and scrap are bounded; intact crates and mission props are never eaten', () => {
  const g = tool('bellows');
  for (let i = 0; i < EXPERIMENTAL_WEAPONS.bellowsScrapCap; i++) {
    const rubble = g.props.spawn('rubble', 233, 300);
    step(g, true);
    assert(!g.props.items.includes(rubble));
  }
  const spare = g.props.spawn('rubble', 233, 300);
  step(g, true, 120);
  assert.equal(g.experimentalWeapons.scrapCount, EXPERIMENTAL_WEAPONS.bellowsScrapCap);
  assert.equal(g.experimentalWeapons.pressure, 1);
  assert(g.props.items.includes(spare));
  g.props.remove(spare);
  const crate = g.props.spawn('crate', 300, 300);
  step(g, true);
  assert(g.props.items.includes(crate));
  assert(crate.body.velocity.x < 0, 'ordinary intact crates are drawn, not consumed');
  g.props.remove(crate);
  const mission = g.props.spawn('rubble', 233, 300);
  mission.auditCase = true;
  const before = { ...mission.body.velocity };
  step(g, true);
  assert.deepEqual(mission.body.velocity, before);
  assert(g.props.items.includes(mission));
});

test('Bellows suction respects cover and does not move allies, heavy machines or committed mission targets', () => {
  const g = tool('bellows');
  const exposed = target(g, 350, 300, 'runner');
  Body.setStatic(exposed.body, false);
  step(g, true);
  assert(exposed.body.velocity.x < 0);
  Body.setVelocity(exposed.body, { x: 0, y: 0 });
  exposed.allied = true;
  step(g, true);
  assert.equal(exposed.body.velocity.x, 0);
  exposed.allied = false;
  exposed.recoilTarget = 1;
  step(g, true);
  assert.equal(exposed.body.velocity.x, 0);
  exposed.recoilTarget = undefined;
  wall(g, 290, 300, 20, 200);
  step(g, true);
  assert.equal(exposed.body.velocity.x, 0);
  const heavy = target(g, 250, 300, 'welder');
  Body.setStatic(heavy.body, false);
  Body.setVelocity(heavy.body, { x: 0, y: 0 });
  step(g, true);
  assert.equal(heavy.body.velocity.x, 0);
});

test('Bellows intake changes a real flyer trajectory after native AI steering, while cover still blocks it', () => {
  const flight = (into: boolean, blocked: boolean) => {
    const g = tool('bellows');
    const e = target(g, 350, 300, 'flyer');
    Body.setStatic(e.body, false);
    if (blocked) wall(g, 290, 300, 20, 200);
    g.aim = { x: into ? 1400 : 0, y: 300 };
    // On this first tick the native flyer sees the exact same player position;
    // a difference therefore comes from intake after AI, not player drift.
    g.tick(1 / 60, input(g, true));
    return { x: e.body.position.x, vx: e.body.velocity.x };
  };
  const pulled = flight(true, false),
    away = flight(false, false);
  assert(pulled.vx < away.vx - 0.08);
  assert(pulled.x < away.x - 0.08);
  assert.deepEqual(flight(true, true), flight(false, true));
});

test('Bellows native Burst finishes the released salvo at native timings without another trigger', () => {
  const g = tool('bellows', ['burst', 'shellshock']);
  step(g, true, 12);
  step(g, false);
  assert.equal(g.shotCount, 1);
  const first = g.shots[0];
  assert(first.shell);
  const firstDamage = first.damage,
    firstShellDamage = first.shell.damage;
  step(g, false, 100);
  assert.equal(g.shotCount, 3);
  assert.equal(g.burstRemaining, 0);
  assert(g.shots.every((s) => s.damage === firstDamage && s.shell?.damage === firstShellDamage));
});

test('Debt Collector fires real ammunition immediately while delaying airborne recoil until release/current aim', () => {
  const g = tool('debt-collector');
  step(g, true);
  g.fire();
  assert.equal(g.shots.length, 1);
  assert.equal(g.player.velocity.x, 0);
  assert(g.experimentalWeapons.debt > 0);
  g.aim = { x: 200, y: 0 };
  step(g, false);
  assert.equal(g.player.velocity.x, 0);
  assert(g.player.velocity.y > 5, 'vent follows the new upward aim, kicking down');
  assert.equal(g.experimentalWeapons.debt, 0);
  const after = { ...g.player.velocity };
  step(g, false, 30);
  assert.deepEqual(g.player.velocity, after);
});

test('Debt Collector banks the already-scaled grounded kick instead of inventing full airborne pressure', () => {
  const g = tool('debt-collector');
  g.grounded = true;
  step(g, true);
  g.fire();
  const banked = g.experimentalWeapons.debt * EXPERIMENTAL_WEAPONS.debtCap;
  assert(Math.abs(banked - g.gun.recoil * 0.21) < 1e-8);
  step(g, false);
  assert(Math.abs(g.player.velocity.x + banked) < 1e-8);
});

test('Debt Collector automatically vents a full bounded chamber and clamps the launch', () => {
  const g = tool('debt-collector');
  let vents = 0;
  g.onSound = (name) => {
    if (name === 'debt-vent') vents++;
  };
  step(g, true);
  assert(g.experimentalWeapons.captureRecoil({ x: 1, y: 0 }, 99999));
  assert.equal(vents, 1);
  assert.equal(g.experimentalWeapons.debt, 0);
  assert.equal(g.player.velocity.x, -23);
  assert(g.experimentalWeapons.captureRecoil({ x: 1, y: 0 }, 99999));
  assert.equal(g.experimentalWeapons.debt, 1);
  assert.equal(vents, 1, 'full-pressure auto vents are rate bounded');
  step(g, true, 12);
  assert.equal(vents, 2);
  assert.equal(g.experimentalWeapons.debt, 0);
});

test('Debt Collector pays one release vent after a queued Burst completes, not one kick per subround', () => {
  const g = tool('debt-collector', ['burst']);
  let vents = 0;
  g.onSound = (name) => {
    if (name === 'debt-vent') vents++;
  };
  g.tick(1 / 60, input(g, true, true));
  assert.equal(g.shotCount, 1);
  for (let frame = 0; frame < 60; frame++) g.tick(1 / 60, input(g, false));
  assert.equal(g.shotCount, 3);
  assert.equal(vents, 1);
  assert.equal(g.experimentalWeapons.debt, 0);
});

test('Switchjack launches only on a fresh edge, tracks one slow bolt, and trades its damage for relocation', () => {
  const g = tool('switchjack');
  const hurtAt = g.hurtAt,
    hp = g.hp;
  const s = beacon(g);
  assert(Math.hypot(s.vel.x, s.vel.y) <= EXPERIMENTAL_WEAPONS.switchSpeed);
  assert(g.player.velocity.x < 0, 'the first shot retains normal recoil');
  const velocity = { ...g.player.velocity };
  step(g, true);
  assert.deepEqual(g.player.position, { x: 500, y: 300 });
  assert.deepEqual(g.player.velocity, velocity);
  assert.equal(s.life, 0);
  assert.equal(g.experimentalWeapons.bolt, null);
  assert.equal(g.hurtAt, hurtAt, 'relocation grants no recovery window');
  assert.equal(g.hp, hp);
  assert.equal(g.shotCount, 1, 'relocation cannot also discharge a damaging shot');
  step(g, true, 60);
  assert.equal(g.shotCount, 1, 'holding cannot jump/fire repeatedly');
});

test('Switchjack preserves earned Deadeye and Guide Vane speed on the actual tracked bolt', () => {
  const baseline = tool('switchjack');
  const native = beacon(baseline);
  const nativeSpeed = Math.hypot(native.vel.x, native.vel.y);
  assert(Math.abs(nativeSpeed - EXPERIMENTAL_WEAPONS.switchSpeed) < 1e-8);
  assert(nativeSpeed < getGun([]).projectileSpeed / 2);
  for (const mod of ['deadeye', 'guide-vane']) {
    const g = tool('switchjack', [mod]);
    const s = beacon(g);
    assert(Math.hypot(s.vel.x, s.vel.y) > nativeSpeed, mod);
    assert(Math.abs(Math.hypot(s.vel.x, s.vel.y) - g.gun.projectileSpeed) < 1e-8, mod);
  }
});

test('Switchjack cannot jump through a wall, even if a converted/steered bolt reached the far side', () => {
  const g = tool('switchjack');
  const s = beacon(g);
  wall(g, 350, 300, 20, 200);
  step(g, true);
  assert.deepEqual(g.player.position, { x: 200, y: 300 });
  assert.equal(g.experimentalWeapons.blocked, true);
  assert.equal(g.experimentalWeapons.bolt, s, 'a blocked attempt does not destroy the live bolt');
  assert(s.life > 0);
  s.life = 0;
  g.experimentalWeapons.update();
  assert.equal(
    g.experimentalWeapons.blocked,
    false,
    'an expired bolt cannot leave a stale blocked HUD',
  );
});

test('Switchjack sweeps the player hull, so a point-clear gap cannot clip the operator through cover', () => {
  const g = tool('switchjack');
  beacon(g);
  wall(g, 350, 260, 20, 50);
  assert.deepEqual(g.lineEnd({ x: 200, y: 300 }, { x: 500, y: 300 }), { x: 500, y: 300 });
  step(g, true);
  assert.equal(g.player.position.x, 200);
  assert.equal(g.experimentalWeapons.blocked, true);
});

test('Switchjack permits a clear grounded route while floor contact remains tangential', () => {
  const g = tool('switchjack');
  const bottom = Math.max(...g.player.vertices.map((p) => p.y));
  wall(g, 500, bottom + 10, 1000, 20);
  g.grounded = true;
  beacon(g);
  step(g, true);
  assert.equal(g.player.position.x, 500);
  assert.equal(g.experimentalWeapons.blocked, false);
});

test('Switchjack can leave actual Matter resting contact slop to relocate upward', () => {
  const g = tool('switchjack');
  const bottom = Math.max(...g.player.vertices.map((p) => p.y));
  wall(g, 500, bottom + 10, 1000, 20);
  g.engine.gravity.y = 1;
  for (let frame = 0; frame < 60; frame++) g.tick(1 / 60, input(g, false));
  const contact = Math.max(...g.player.vertices.map((p) => p.y)) - bottom;
  assert(contact > 0 && contact < EXPERIMENTAL_WEAPONS.switchContactSlop);
  g.aim = { x: g.player.position.x, y: 0 };
  const destination = { x: g.player.position.x, y: 180 };
  beacon(g, destination);
  step(g, true);
  assert.deepEqual(g.player.position, destination);
  assert.equal(g.experimentalWeapons.blocked, false);
});

test('Switchjack contact tolerance never permits a deep overlap or movement into the contacting solid', () => {
  for (const cause of ['deep-overlap', 'into-floor'] as const) {
    const g = tool('switchjack');
    const bottom = Math.max(...g.player.vertices.map((p) => p.y));
    wall(g, 500, bottom + 10, 1000, 20);
    Body.setPosition(g.player, { x: 200, y: 300 + (cause === 'deep-overlap' ? 0.4 : 0.05) });
    g.aim = { x: 200, y: 0 };
    beacon(g, { x: 200, y: cause === 'deep-overlap' ? 180 : 350 });
    const before = { ...g.player.position };
    step(g, true);
    assert.deepEqual(g.player.position, before, cause);
    assert.equal(g.experimentalWeapons.blocked, true, cause);
  }
});

test('Switchjack blocks occupied destinations, loose props and world-edge destinations', () => {
  for (const blocker of ['enemy', 'prop', 'boundary'] as const) {
    const g = tool('switchjack');
    const destination = blocker === 'boundary' ? { x: 1999, y: 300 } : { x: 500, y: 300 };
    beacon(g, destination);
    if (blocker === 'enemy') target(g, 500, 300);
    if (blocker === 'prop') g.props.spawn('crate', 350, 300);
    step(g, true);
    assert.equal(g.player.position.x, 200, blocker);
    assert.equal(g.experimentalWeapons.blocked, true, blocker);
  }
});

test('Switchjack does not relocate into a crusher sweep even while its plate is currently raised', () => {
  const g = tool('switchjack');
  beacon(g);
  g.hazards.spawn({ kind: 'crusher', x: 500, y: 150, w: 90, h: 24, travel: 220 });
  step(g, true);
  assert.equal(g.player.position.x, 200);
  assert.equal(g.experimentalWeapons.blocked, true);
});

test('a Switchjack bolt loses relocation on hit, bank, expiry, removal or parked ammunition', () => {
  for (const cause of ['hit', 'bank', 'expiry', 'removed', 'parked'] as const) {
    const g = tool('switchjack');
    const s = beacon(g);
    if (cause === 'hit') s.hits.add(123);
    if (cause === 'bank') s.banks++;
    if (cause === 'expiry') g.time += EXPERIMENTAL_WEAPONS.switchLife;
    if (cause === 'removed') g.shots = [];
    if (cause === 'parked')
      s.stasis = { target: { ...s.pos }, velocity: { ...s.vel }, born: g.time, phase: 'parked' };
    g.experimentalWeapons.update();
    assert.equal(g.experimentalWeapons.bolt, null, cause);
    const before = { ...g.player.position };
    step(g, true);
    assert.deepEqual(g.player.position, before, cause);
  }
});

test('Switchjack Burst does not create replacement beacons after the first bolt is spent', () => {
  const g = tool('switchjack', ['burst']);
  const s = beacon(g);
  step(g, true);
  assert.equal(s.life, 0);
  step(g, false, 100);
  assert.equal(g.shotCount, 3);
  assert.equal(g.experimentalWeapons.bolt, null);
});

for (const id of ['bellows', 'debt-collector', 'switchjack'] as const) {
  test(`${id} clears transient mechanisms at pause/death and cannot secretly release through Resume`, () => {
    const g = tool(id);
    step(g, true, id === 'bellows' ? 15 : 1);
    if (id === 'debt-collector') g.fire();
    const count = g.shotCount;
    g.setMode('paused');
    assert.equal(g.experimentalWeapons.pressure, 0);
    assert.equal(g.experimentalWeapons.debt, 0);
    assert.equal(g.experimentalWeapons.bolt, null);
    g.setMode('playing');
    step(g, true, 20);
    step(g, false);
    assert.equal(g.shotCount, count);
    assert.equal(g.experimentalWeapons.debt, 0);
    g.setMode('dead');
    assert.equal(g.experimentalWeapons.pressure, 0);
    assert.equal(g.experimentalWeapons.bolt, null);
  });
}

for (const id of ['bellows', 'debt-collector', 'switchjack'] as const) {
  test(`${id} Suspension conversion stores native rounds on hold and releases them without a competing trigger`, () => {
    const g = tool(id, ['suspension']);
    target(g, 1000, 300);
    for (let frame = 0; frame < 24; frame++) g.tick(1 / 60, input(g, true));
    assert(g.shotCount > 0);
    assert(g.stasis.stock.length > 0);
    if (id === 'debt-collector') assert(g.experimentalWeapons.debt > 0);
    else assert.equal(g.experimentalWeapons.kind, null);
    g.tick(1 / 60, input(g, false));
    for (let frame = 0; frame < 5; frame++) g.tick(1 / 60, input(g, false));
    assert.equal(g.stasis.stock.length, 0);
    assert(g.shots.some((s) => s.stasis?.phase === 'released'));
    assert.equal(g.experimentalWeapons.bolt, null);
    assert.equal(g.experimentalWeapons.debt, 0);
  });
}

test('beam conversions explicitly replace Bellows/Switchjack triggers, clear transient state and restore safely', () => {
  for (const id of ['bellows', 'switchjack'] as const) {
    const g = tool(id);
    step(g, true, 8);
    g.mods = ['cutting-torch'];
    g.gun = getGun(g.mods, id);
    assert.equal(g.experimentalWeapons.input(1 / 60, input(g, true)), false);
    assert.equal(g.experimentalWeapons.kind, null);
    assert.equal(g.experimentalWeapons.pressure, 0);
    assert.equal(g.experimentalWeapons.bolt, null);
    g.mods = [];
    g.gun = getGun([], id);
    g.experimentalWeapons.update();
    assert.equal(g.experimentalWeapons.kind, id);
    assert.equal(g.experimentalWeapons.pressure, 0);
    assert.equal(g.experimentalWeapons.bolt, null);
  }
});

test('Debt Collector beam conversion still banks and releases its actual continuous recoil', () => {
  const g = tool('debt-collector', ['cutting-torch']);
  beam(g, 0.1);
  assert.equal(g.experimentalWeapons.kind, 'debt-collector');
  assert(g.experimentalWeapons.debt > 0);
  assert.equal(g.player.velocity.x, 0);
  step(g, false);
  assert(g.player.velocity.x < 0);
  assert.equal(g.experimentalWeapons.debt, 0);
});

test('a paused Debt Collector beam cannot deal stale damage or emit while Resume waits for trigger release', () => {
  const g = tool('debt-collector', ['cutting-torch']);
  const e = target(g, 400, 300);
  for (let frame = 0; frame < 6; frame++) g.tick(1 / 60, input(g, true));
  assert(e.hp < e.maxHp);
  assert(g.experimentalWeapons.debt > 0);
  g.setMode('paused');
  const hp = e.hp,
    shots = g.shotCount;
  assert.equal(g.torch.active, false);
  g.setMode('playing');
  for (let frame = 0; frame < 30; frame++) g.tick(1 / 60, input(g, true));
  assert.equal(e.hp, hp);
  assert.equal(g.shotCount, shots);
  assert.equal(g.experimentalWeapons.debt, 0);
  assert.equal(g.player.velocity.x, 0);
  g.tick(1 / 60, input(g, false));
  for (let frame = 0; frame < 12; frame++) g.tick(1 / 60, input(g, true));
  assert(e.hp < hp, 'a fresh press restarts the real beam');
  assert(g.shotCount > shots);
});

for (const id of ['bellows', 'debt-collector', 'switchjack'] as const) {
  test(`${id} Seeker Rack paints on the real held trigger and launches on release without competing triggers`, () => {
    const g = tool(id, ['seeker-rack']);
    target(g, 600, 300);
    let vents = 0;
    g.onSound = (name) => {
      if (name === 'debt-vent') vents++;
    };
    if (id === 'debt-collector') g.experimentalWeapons.captureRecoil({ x: 1, y: 0 }, 3);
    for (let frame = 0; frame < 40; frame++) g.tick(1 / 60, input(g, true));
    assert.equal(g.shotCount, 0, 'painting cannot accidentally fire the native weapon');
    assert(g.shiftMorphs.locks.some((lock) => lock.progress >= 1));
    if (id === 'debt-collector') {
      assert.equal(g.experimentalWeapons.kind, id);
      assert(g.experimentalWeapons.debt > 0);
      assert.equal(
        vents,
        0,
        'filtered fire=false while painting is not a physical trigger release',
      );
    } else {
      assert.equal(g.experimentalWeapons.kind, null);
      assert.equal(g.experimentalWeapons.pressure, 0);
    }
    g.tick(1 / 60, input(g, false));
    assert.equal(g.shotCount, 1);
    assert(g.shots.length > 0);
    assert.equal(
      g.experimentalWeapons.bolt,
      null,
      'seeker missiles do not become hidden jump beacons',
    );
    for (let frame = 0; frame < 5; frame++) g.tick(1 / 60, input(g, false));
    if (id === 'debt-collector') {
      assert.equal(vents, 1);
      assert.equal(g.experimentalWeapons.debt, 0);
    }
  });
}
