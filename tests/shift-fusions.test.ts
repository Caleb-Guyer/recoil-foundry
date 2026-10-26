import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy, type Shot, type Input } from '../src/game.ts';
import { ShiftFusions, SHIFT_FUSIONS } from '../src/shift-fusions.ts';
import { getGun, distance } from '../src/rules.ts';
import { STARTING_GUN_IDS, type StartingGun } from '../src/starting-guns.ts';
import type { WireAnchor } from '../src/tripwire.ts';
const { Body, Bodies, Composite, Engine } = Matter;
const dt = 1 / 60;
function fixture(mods: string[], gun: StartingGun = 'pistol') {
  const g = new Game();
  Object.assign(g, { shiftFusions: new ShiftFusions(g) });
  g.start('RF-C107-SHIFT-TEST');
  g.waves.clear();
  g.hazards.clear();
  g.breaches.clear();
  g.destruction.clear();
  g.conveyors.clear();
  g.crossing.clear();
  g.freight.clear();
  g.pressure.clear();
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.level.solids = [];
  g.mods = mods;
  g.startingGun = gun;
  g.gun = getGun(mods, gun);
  g.engine.gravity.y = 0;
  Body.setPosition(g.player, { x: 200, y: 400 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  g.aim = { x: 1400, y: 400 };
  g.grounded = false;
  return g;
}
function clean(g: Game) {
  Composite.clear(g.engine.world, false);
  Engine.clear(g.engine);
}
function wall(g: Game, x: number, y = 400, w = 20, h = 500) {
  const b = Bodies.rectangle(x, y, w, h, { isStatic: true });
  g.terrain.push(b);
  Composite.add(g.engine.world, b);
  return b;
}
function enemy(g: Game, x: number, y = 400) {
  const e = g.spawnEnemy('runner', x, y)!;
  e.spawn = 0;
  return e;
}
function shot(g: Game, pos = { x: 400, y: 400 }, extra: Partial<Shot> = {}) {
  return g.addShot({
    pos,
    vel: { x: 24, y: 0 },
    damage: 24,
    life: 2,
    friendly: true,
    radius: 2.5,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
    ...extra,
  })!;
}
function advance(g: Game, n = 1) {
  for (let i = 0; i < n; i++) {
    g.time += dt;
    g.shiftFusions.beforeStep(dt);
    g.updateShots(dt);
    g.shiftFusions.afterStep(dt);
  }
}
function anchor(
  body: Matter.Body,
  pos: { x: number; y: number },
  normal = { x: 0, y: -1 },
): WireAnchor {
  return { body, pos, normal, origin: { ...body.position }, angle: body.angle, damage: 24 };
}

test('Catch Chamber uses the real shared Countershot recharge, stores sanitized rounds, and releases aimable damaging shots', () => {
  const g = fixture(['suspension', 'countershot', 'catch-chamber']);
  const hostile = shot(
    g,
    { x: 550, y: 400 },
    { friendly: false, vel: { x: -12, y: 0 }, damage: 50, mutationShell: { owner: 99 } },
  );
  assert(g.ballistics.reflectRound(hostile, { ...hostile.pos }));
  assert.equal(hostile.life, 0);
  assert.equal(g.shiftFusions.captured.length, 1);
  assert(!g.ballistics.counterReady);
  const caught = g.shiftFusions.captured[0].shot;
  assert.equal(caught.damage, 24);
  assert.equal(caught.mutationShell, undefined);
  assert.equal(caught.counter, 0);
  assert(caught.reflected && caught.fragment && caught.echo);
  g.aim = { x: 600, y: 400 };
  const e = enemy(g, 470);
  const hp = e.hp;
  g.stasis.input(true);
  g.stasis.input(false);
  assert.equal(g.shiftFusions.captured.length, 0);
  const released = g.shots.find((s) => s !== hostile && s.reflected)!;
  assert(released && released.vel.x > 0);
  assert(!released.stasis);
  advance(g, 25);
  assert(e.hp < hp);
  assert.equal(g.shiftFusions.captured.length, 0);
  clean(g);
});

test('captured ammunition has a three-round cap, cannot recapture itself, expires, and resets without firing', () => {
  const g = fixture(['suspension', 'countershot', 'catch-chamber']);
  for (let i = 0; i < 5; i++) {
    const s = shot(g, { x: 500, y: 400 }, { reflected: true });
    g.shiftFusions.capture(s);
  }
  assert.equal(g.shiftFusions.captured.length, SHIFT_FUSIONS.caught);
  const hostile = shot(g, { x: 600, y: 400 }, { friendly: false, blade: true, radius: 11 });
  assert(!g.ballistics.reflectRound(hostile, hostile.pos));
  g.time += 4;
  g.shiftFusions.afterStep(dt);
  assert.equal(g.shiftFusions.captured.length, 0);
  const count = g.shots.length;
  g.shiftFusions.reset();
  g.shiftFusions.releaseCaptured();
  assert.equal(g.shots.length, count);
  clean(g);
});

function gateFixture() {
  const g = fixture(['fold', 'tripwire', 'gate-snare']);
  const left = wall(g, 600),
    right = wall(g, 1200),
    floor = wall(g, 1000, 730, 1600, 20);
  g.portals.pair = [
    { body: left, pos: { x: 589, y: 400 }, normal: { x: -1, y: 0 } },
    { body: right, pos: { x: 1211, y: 400 }, normal: { x: 1, y: 0 } },
  ];
  g.portals.next = 2;
  const a = anchor(floor, { x: 400, y: 717 }),
    b = anchor(floor, { x: 1450, y: 717 });
  assert(g.shiftFusions.linkGate(a, b));
  return g;
}

test('Gate Snare creates two real collision segments through portals and never detonates across the teleport gap', () => {
  const g = gateFixture(),
    gate = g.shiftFusions.gate!;
  assert.equal(gate.segments.length, 2);
  const middle = enemy(g, 900, 400);
  const hp = middle.hp;
  g.time = 0.3;
  g.shiftFusions.beforeStep(dt);
  g.shiftFusions.afterStep(dt);
  assert.equal(middle.hp, hp);
  assert(g.shiftFusions.gate);
  const s = gate.segments[1],
    p = { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 };
  const e = enemy(g, p.x, p.y);
  const before = e.hp;
  g.shiftFusions.beforeStep(dt);
  g.shiftFusions.afterStep(dt);
  assert(!g.shiftFusions.gate);
  assert(e.hp < before);
  clean(g);
});

test('portal replacement, destroyed anchors, new cover and swept moving cover remove a Gate Snare safely', () => {
  for (const change of ['portal', 'anchor', 'cover', 'swept'] as const) {
    const g = gateFixture(),
      gate = g.shiftFusions.gate!;
    g.shiftFusions.beforeStep(dt);
    if (change === 'portal') g.portals.pair[0] = { ...g.portals.pair[0]! };
    if (change === 'anchor') Body.translate(gate.a.body, { x: 1, y: 0 });
    if (change === 'cover') {
      const s = gate.segments[0];
      wall(g, (s.a.x + s.b.x) / 2, (s.a.y + s.b.y) / 2, 20, 50);
    }
    if (change === 'swept') {
      const s = gate.segments[0],
        p = { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 };
      const cover = wall(g, p.x - 80, p.y, 20, 70);
      g.shiftFusions.beforeStep(dt);
      Body.translate(cover, { x: 160, y: 0 });
    }
    g.shiftFusions.afterStep(dt);
    assert.equal(g.shiftFusions.gate, null, change);
    clean(g);
  }
});

function link(g: Game) {
  const a = enemy(g, 600, 400),
    b = enemy(g, 800, 400);
  g.tethers.link = { a, b, length: 200, until: 10, tension: 0 };
  return { a, b };
}
test('Hot Wire diverts actual beam energy into a moving cable and splits its bounded budget among crossing enemies', () => {
  const g = fixture(['cutting-torch', 'tether', 'hot-wire']);
  link(g);
  const a = enemy(g, 680, 400),
    b = enemy(g, 730, 400);
  const ha = a.hp,
    hb = b.hp;
  const segments = [
    { a: { x: 200, y: 400 }, b: { x: 800, y: 400 }, dir: { x: 1, y: 0 }, gain: 1, muzzle: true },
  ];
  g.shiftFusions.beforeStep(dt);
  assert.equal(g.shiftFusions.beamSample(segments, 40, 1), 0.75);
  assert.equal(g.shiftFusions.hot!.energy, 10);
  g.shiftFusions.afterStep(dt);
  assert.equal(ha - a.hp, 5);
  assert.equal(hb - b.hp, 5);
  assert.equal(g.shiftFusions.hot!.energy, 0);
  g.shiftFusions.afterStep(dt);
  assert.equal(ha - a.hp, 5, 'spent energy cannot hit again');
  clean(g);
});

test('Hot Wire requires a real beam/cable crossing and cover or a broken tether cancels the stored energy', () => {
  const g = fixture(['cutting-torch', 'tether', 'hot-wire']);
  link(g);
  assert.equal(
    g.shiftFusions.beamSample(
      [
        {
          a: { x: 200, y: 200 },
          b: { x: 800, y: 200 },
          dir: { x: 1, y: 0 },
          gain: 1,
          muzzle: true,
        },
      ],
      40,
      1,
    ),
    1,
  );
  const beam = [
    { a: { x: 200, y: 400 }, b: { x: 800, y: 400 }, dir: { x: 1, y: 0 }, gain: 1, muzzle: true },
  ];
  g.shiftFusions.beamSample(beam, 40, 2);
  wall(g, 700, 400, 20, 60);
  g.shiftFusions.afterStep(dt);
  assert.equal(g.shiftFusions.hot, null);
  clean(g);
});

for (const gun of STARTING_GUN_IDS)
  test(`Ghost Shift copies the native ${gun} volley from a rebooted ally without primary procs`, () => {
    const g = fixture(['crossfire', 'afterimage', 'spoof', 'ghost-shift'], gun),
      ally = g.factions.spawn('shooter', { x: 350, y: 450 })!;
    ally.spawn = 0;
    ally.rebootUntil = 10;
    const e = enemy(g, 1100, 450);
    assert(g.shiftFusions.suppressAllyFire(ally));
    for (let n = 0; n < 4; n++) g.fireRound();
    assert.equal(g.shiftFusions.ghosts.length, 1);
    const templates = g.shiftFusions.ghosts[0].shots.length;
    assert.equal(templates, g.gun.pellets * g.gun.lanes);
    g.shots = [];
    g.time = 0.43;
    g.shiftFusions.afterStep(dt);
    assert.equal(g.shiftFusions.ghosts.length, 0);
    assert.equal(g.shots.length, templates);
    assert(g.shots.every((s) => s.echo && s.allied && s.counter === 0 && !s.stasis && !s.tripwire));
    assert(g.shots.every((s) => Math.abs(s.pos.y - ally.body.position.y) < 50));
    assert(g.shots.every((s) => s.vel.x > 0));
    clean(g);
  });

test('Ghost Shift copies every actual beam ray and native energy, while expired allies and cover stop replay', () => {
  const g = fixture(['cutting-torch', 'crossfire', 'afterimage', 'spoof', 'ghost-shift']);
  const ally = g.factions.spawn('shooter', { x: 350, y: 400 })!;
  ally.spawn = 0;
  ally.rebootUntil = 10;
  const e = enemy(g, 750, 400);
  const hp = e.hp;
  const rays = [-0.15, 0, 0.15].map((a, ray) => ({
    a: { x: 200, y: 400 },
    b: { x: 900, y: 400 },
    dir: { x: Math.cos(a), y: Math.sin(a) },
    gain: 1 / 3,
    muzzle: true,
    ray,
  }));
  for (let pulse = 1; pulse <= 4; pulse++) g.shiftFusions.beamSample(rays, 30, pulse);
  assert.equal(g.shiftFusions.ghosts[0].rays.size, 3);
  g.time = 0.43;
  g.shiftFusions.afterStep(dt);
  assert(e.hp < hp);
  assert(g.shiftFusions.ghostEffects.length >= 3);
  g.shiftFusions.reset();
  for (let pulse = 1; pulse <= 4; pulse++) g.shiftFusions.beamSample(rays, 30, pulse);
  ally.rebootUntil = 0.44;
  g.time = 0.9;
  g.shiftFusions.afterStep(dt);
  assert.equal(g.shiftFusions.ghosts.length, 0);
  clean(g);
});

function millFixture() {
  const g = fixture(['grindshot', 'crosswind', 'windmill']);
  const floor = wall(g, 700, 600, 1000, 20);
  const s = shot(g, { x: 500, y: 589 }, { vel: { x: 20, y: 4 } });
  g.grind.impact(s, floor, { x: 0, y: -1 });
  assert(g.grind.saws.length);
  g.salvage.gusts = [{ a: { x: 450, y: 570 }, b: { x: 600, y: 589 }, id: 1, at: g.time }];
  g.grind.update(dt);
  assert.equal(g.shiftFusions.mills.length, 1);
  return g;
}
test('Windmill turns an actual spent surface saw into an airborne swept blade with single-hit damage and a finite life', () => {
  const g = millFixture(),
    m = g.shiftFusions.mills[0];
  assert.equal(g.grind.saws.length, 0);
  const e = enemy(g, m.center.x + 25, m.center.y + 15),
    hp = e.hp;
  for (let i = 0; i < 30; i++) {
    g.time += dt;
    g.shiftFusions.beforeStep(dt);
    g.shiftFusions.afterStep(dt);
  }
  assert(e.hp < hp);
  const damaged = e.hp;
  for (let i = 0; i < 40; i++) {
    g.time += dt;
    g.shiftFusions.afterStep(dt);
  }
  assert.equal(e.hp, damaged);
  assert.equal(g.shiftFusions.mills.length, 0);
  clean(g);
});
test('cover blocks Windmill orbit motion and the blade cannot damage through it', () => {
  const g = millFixture(),
    m = g.shiftFusions.mills[0];
  const e = enemy(g, m.center.x + 52, m.center.y),
    hp = e.hp;
  wall(g, m.center.x + 18, m.center.y + 10, 20, 100);
  for (let i = 0; i < 25; i++) {
    g.time += dt;
    g.shiftFusions.afterStep(dt);
  }
  assert.equal(e.hp, hp);
  assert.equal(g.shiftFusions.mills.length, 0);
  clean(g);
});

test('Scrap Comet attracts only real loose expendable debris, slows and spends banks, then throws the debris on impact', () => {
  const g = fixture(['mass-driver', 'arc-coil', 'scrap-comet']);
  const p = g.props.spawn('crate', 560, 430),
    objective = g.props.spawn('crate', 570, 510);
  objective.uprising = 'relay';
  const pinned = g.props.spawn('cover', 550, 300);
  Body.setStatic(pinned.body, true);
  const s = shot(g, { x: 500, y: 400 }, { vel: { x: 30, y: 0 }, bounces: 3 });
  const speed = Math.hypot(s.vel.x, s.vel.y);
  g.massDriver.update(dt);
  const comet = g.shiftFusions.comets.get(s.id)!;
  assert(comet.props.has(p));
  assert(!comet.props.has(objective));
  assert(!comet.props.has(pinned));
  assert(s.bounces < 3);
  assert(Math.hypot(s.vel.x, s.vel.y) < speed);
  assert(
    p.body.velocity.x < s.vel.x && p.body.velocity.y < 0,
    'real debris gains pursuit velocity toward the moving sphere',
  );
  const before = { ...p.body.velocity };
  g.massDriver.bounce(s, { x: -1, y: 0 });
  assert(!g.shiftFusions.comets.has(s.id));
  assert(distance(before, p.body.velocity) > 1);
  assert(p.body.velocity.x > 0, 'impact sends the real body forward');
  clean(g);
});
test('Scrap Comet cannot pull debris through cover and all six fusion states freeze during pause/hitstop and clear on reset', () => {
  const g = fixture([
    'mass-driver',
    'arc-coil',
    'scrap-comet',
    'grindshot',
    'crosswind',
    'windmill',
  ]);
  const p = g.props.spawn('crate', 650, 400);
  wall(g, 570, 400, 15, 100);
  const s = shot(g, { x: 500, y: 400 }, { vel: { x: 25, y: 0 } });
  g.massDriver.update(dt);
  assert(!g.shiftFusions.comets.get(s.id)?.props.has(p));
  const frozen = JSON.stringify(g.shiftFusions.mills);
  g.setMode('paused');
  g.shiftFusions.beforeStep(dt);
  g.shiftFusions.afterStep(dt);
  assert.equal(JSON.stringify(g.shiftFusions.mills), frozen);
  g.setMode('playing');
  g.hitStop = 0.1;
  const v = { ...p.body.velocity };
  g.shiftFusions.comet(s, dt);
  assert.deepEqual(p.body.velocity, v);
  g.shiftFusions.reset();
  assert.equal(g.shiftFusions.comets.size, 0);
  assert.equal(g.shiftFusions.captured.length, 0);
  assert.equal(g.shiftFusions.ghosts.length, 0);
  clean(g);
});

for (const gun of STARTING_GUN_IDS)
  test(`Ghost Shift integrates the complete native ${gun} beam pulse and every earned ray`, () => {
    const g = fixture(
      ['cutting-torch', 'crossfire', 'afterimage', 'spoof', 'ghost-shift', 'scatter', 'magnum'],
      gun,
    );
    const ally = g.factions.spawn('shooter', { x: 350, y: 450 })!;
    ally.spawn = 0;
    ally.rebootUntil = 100;
    const sample = g.shiftFusions.beamSample.bind(g.shiftFusions),
      totals = new Map<number, number>(),
      lastSample = new Map<number, number>();
    let fourth = -1;
    g.shiftFusions.beamSample = (segments, damage, pulse) => {
      if (g.shotCount === 4) {
        fourth = pulse;
        lastSample.set(pulse, g.time);
        totals.set(
          pulse,
          (totals.get(pulse) ?? 0) +
            segments.filter((s) => s.muzzle).reduce((n, s) => n + damage * s.gain, 0),
        );
      }
      return sample(segments, damage, pulse);
    };
    for (let frame = 0; frame < 3000 && g.shotCount < 5; frame++) {
      g.time += dt;
      g.ballistics.charge(dt, true);
      g.torch.beforeStep(dt, true);
      g.torch.afterStep(dt);
      g.shiftFusions.afterStep(dt);
    }
    assert.equal(g.shotCount, 5);
    const pending = g.shiftFusions.ghosts.find((v) => v.pulse === fourth)!;
    assert(
      pending,
      'the fourth actual beam must remain queued until its complete energy has been collected',
    );
    assert.equal(pending.rays.size, g.gun.pellets * g.gun.lanes);
    const energy = [...pending.rays.values()].reduce((n, r) => n + r.damage, 0);
    assert(Math.abs(energy - totals.get(fourth)! * 0.6) < 1e-7);
    assert(
      Math.abs(pending.at - lastSample.get(fourth)! - 0.42) < 1e-8,
      'replay follows the final lit sample, including slow charged tools',
    );
    clean(g);
  });

test('Ghost beam replay cannot reach through fresh cover or continue after its ally dies', () => {
  const g = fixture(['cutting-torch', 'crossfire', 'afterimage', 'spoof', 'ghost-shift']);
  const ally = g.factions.spawn('shooter', { x: 350, y: 400 })!;
  ally.spawn = 0;
  ally.rebootUntil = 10;
  const e = enemy(g, 750, 400),
    hp = e.hp;
  const rays = [
    {
      a: { x: 200, y: 400 },
      b: { x: 900, y: 400 },
      dir: { x: 1, y: 0 },
      gain: 1,
      muzzle: true,
      ray: 0,
    },
  ];
  for (let p = 1; p <= 4; p++) g.shiftFusions.beamSample(rays, 30, p);
  wall(g, 550, 400, 20, 300);
  g.time = 0.5;
  g.shiftFusions.afterStep(dt);
  assert.equal(e.hp, hp);
  assert(g.shiftFusions.ghostEffects.every((s) => Math.max(s.a.x, s.b.x) < 550));
  g.shiftFusions.reset();
  for (let p = 1; p <= 4; p++) g.shiftFusions.beamSample(rays, 30, p);
  ally.hp = 0;
  g.time = 1;
  const before = g.shots.length;
  g.shiftFusions.afterStep(dt);
  assert.equal(g.shots.length, before);
  clean(g);
});

test('Gate Snare rejects a path crossing the solid behind a backwards-facing portal', () => {
  const g = gateFixture(),
    gate = g.shiftFusions.gate!;
  g.shiftFusions.gate = null;
  g.portals.pair[0]!.normal = { x: 1, y: 0 };
  g.portals.pair[0]!.pos = { x: 611, y: 400 };
  assert(!g.shiftFusions.linkGate(gate.a, gate.b));
  clean(g);
});
