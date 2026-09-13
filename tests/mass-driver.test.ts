import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy, type Input, type Shot } from '../src/game.ts';
import { MASS_DRIVER } from '../src/mass-driver.ts';
import {
  availableMods,
  getGun,
  loadCheckpoint,
  rewardMods,
  seeded,
  validBuild,
} from '../src/rules.ts';
import { MASS_DRIVER_TEST_BUILDS, massDriverTestFromUrl } from '../src/practice.ts';
import { CROSSING } from '../src/crossing-layout.ts';
import { dailyForDate } from '../src/daily.ts';
import { dodgePilot } from './combat-pilot.ts';
import { distance } from '../src/rules.ts';
const { Body, Bodies, Composite, Engine } = Matter;
const dt = 1 / 60;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1000, y: 300 },
};
const near = (a: number, b: number, epsilon = 1e-6) =>
  assert(Math.abs(a - b) < epsilon, `${a} != ${b}`);
function fixture(mods = ['mass-driver']) {
  const g = new Game();
  g.start('mass-fixture');
  g.waves.clear();
  g.hazards.clear();
  g.breaches.clear();
  g.destruction.clear();
  g.conveyors.clear();
  g.pressure.clear();
  g.crossing.clear();
  g.counterweights.clear();
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.mods = mods;
  g.gun = getGun(mods);
  g.engine.gravity.y = 0;
  Body.setPosition(g.player, { x: 200, y: 300 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  g.aim = { ...idle.aim };
  g.grounded = false;
  return g;
}
function ball(g: Game, extra: Partial<Shot> = {}) {
  g.addShot({
    pos: { x: 400, y: 300 },
    vel: { x: 18, y: 0 },
    damage: g.gun.damage,
    life: 1.4,
    radius: 2.5,
    friendly: true,
    fragment: false,
    split: false,
    bounces: g.gun.bounces,
    pierce: g.gun.pierce,
    bankGrowth: g.gun.bankGrowth,
    ...extra,
  });
  return g.shots.at(-1)!;
}
function shots(g: Game, count = 1) {
  for (let i = 0; i < count && g.mode === 'playing'; i++) {
    g.time += dt;
    g.updateShots(dt);
  }
}
function target(g: Game, kind: Enemy['kind'] = 'runner', x = 500, y = 300, shield = false) {
  g.spawnEnemy(kind, x, y, shield ? 'shielded' : undefined);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  e.hp = e.maxHp = 10000;
  e.timer = 10;
  return e;
}
function wall(g: Game, x = 500, y = 300, w = 3, h = 200) {
  const b = Bodies.rectangle(x, y, w, h, { isStatic: true });
  g.terrain.push(b);
  Composite.add(g.engine.world, b);
  return b;
}

test('Mass Driver is shared, saveable, and trades cadence for mass, recoil and four bounces', () => {
  for (const path of [[], ['crossfire'], ['deadeye'], ['shellshock']]) {
    assert(availableMods(path).some((m) => m.id === 'mass-driver'));
    assert(validBuild([...path, 'mass-driver']));
    assert(!availableMods([...path, 'mass-driver']).some((m) => m.id === 'mass-driver'));
  }
  const base = getGun([]),
    g = getGun(['mass-driver']);
  near(g.damage / base.damage, 2.4);
  near(g.interval / base.interval, 2.5);
  near(g.recoil / base.recoil, 1.65);
  near(g.projectileSpeed / base.projectileSpeed, 0.6);
  assert.equal(g.bounces, 4);
  for (const other of ['cutting-torch', 'rail-spike']) {
    assert(!availableMods(['mass-driver', 'deadeye', 'capacitor']).some((m) => m.id === other));
    assert(
      !availableMods(other === 'rail-spike' ? ['deadeye', 'capacitor', other] : [other]).some(
        (m) => m.id === 'mass-driver',
      ),
    );
  }
  const save = massDriverTestFromUrl(new URL('https://game.test/?test=mass-driver'))!;
  assert(loadCheckpoint(save));
  const continued = new Game();
  continued.start(save.seed, save);
  assert(continued.massDriver.equipped);
  let seen = false;
  for (let i = 0; i < 100; i++)
    seen ||= rewardMods([], 3, seeded('mass' + i)).some((m) => m.id === 'mass-driver');
  assert(seen);
});

test('steel balls follow gravity and carry visual mass without adding solver bodies', () => {
  const g = fixture();
  g.engine.gravity.y = 1;
  const before = Composite.allBodies(g.engine.world).length,
    s = ball(g);
  shots(g, 20);
  near(s.pos.x, 760);
  assert(s.pos.y > 350);
  assert(s.vel.y > 5);
  assert.equal(s.radius, MASS_DRIVER.radius);
  assert(s.massDriver!.spin > 0);
  assert.equal(Composite.allBodies(g.engine.world).length, before);
  assert(g.shots.includes(s));
});

test('thin walls and tilted machinery catch fast balls and dissipate bounce energy', () => {
  for (const angle of [0, 0.18, -0.18]) {
    const g = fixture(),
      b = wall(g);
    Body.setAngle(b, angle);
    const s = ball(g, { pos: { x: 450, y: 300 }, vel: { x: 200, y: 0 } });
    g.time += 1 / 30;
    g.updateShots(1 / 30);
    assert(s.vel.x < 0);
    assert(s.pos.x < 500);
    assert(Math.hypot(s.vel.x, s.vel.y) < MASS_DRIVER.maxSpeed);
    assert.equal(s.bounces, 3);
    assert.equal(s.banks, 1);
    assert(s.trace!.points.every((p) => p.x < 500));
  }
});

test('close muzzle fire cannot create a ball beyond cover', () => {
  const g = fixture();
  wall(g, 220, 300, 3, 200);
  g.fire();
  const s = g.shots[0];
  assert(s.pos.x < 220);
  shots(g);
  assert(s.life <= 0 || s.pos.x < 220);
  assert(s.life <= 0 || s.vel.x < 0);
});
test('firing delivers the stronger recoil in the air and spends one kick per volley', () => {
  const kicks = [];
  for (const grounded of [true, false]) {
    const g = fixture(['mass-driver', 'crossfire', 'scatter', 'backblast', 'backfire']);
    g.grounded = grounded;
    g.aim = { x: 200, y: 1000 };
    g.fire();
    kicks.push(-g.player.velocity.y);
    assert.equal(g.shotCount, 1);
    assert.equal(g.shots.filter((s) => s.massDriver).length, 30);
    assert(g.shake > 0);
    assert(g.shootAt > g.time);
  }
  near(kicks[1] / kicks[0], 1 / 0.21);
});
test('normal gameplay transfers a moving lift’s velocity into the bounce', () => {
  const rebounds: number[] = [];
  for (const travel of [0, 300]) {
    const g = fixture();
    const lift = g.hazards.spawn({
      kind: 'lift',
      x: 500,
      y: 350 + travel / 2,
      w: 200,
      h: 20,
      travel,
    });
    lift.phase = 2;
    Body.setPosition(lift.body, { x: 500, y: 360 });
    const s = ball(g, { pos: { x: 500, y: 332 }, vel: { x: 0, y: 12 } });
    g.tick(dt, idle);
    assert.equal(s.bounces, 3);
    assert(s.vel.y < 0);
    if (travel) assert(lift.body.position.y < 359);
    rebounds.push(s.vel.y);
  }
  assert(rebounds[0] > -12, 'a stationary deck dissipates momentum');
  assert(rebounds[1] < -12, 'the rising deck adds upward momentum');
});

test('a bank launches a crate with bounded linear and angular momentum without immediately destroying it', () => {
  const g = fixture(),
    crate = g.props.spawn('crate', 480, 300),
    s = ball(g);
  shots(g, 4);
  assert(g.props.items.includes(crate));
  assert(crate.hp < crate.maxHp && crate.hp > 0);
  assert(crate.body.velocity.x > 8 && crate.body.velocity.x <= 18);
  assert(crate.body.velocity.y < 0);
  assert(Math.abs(crate.body.angularVelocity) > 0);
  assert(s.massDriver!.surfaces.has(crate.body.id));
  const hp = crate.hp;
  for (let i = 0; i < 3; i++) {
    s.pos = { x: crate.body.position.x - 32, y: crate.body.position.y };
    s.vel = { x: 18, y: 0 };
    shots(g);
  }
  assert.equal(crate.hp, hp, 'the same ball cannot grind repeated structural damage');
});

test('the launched crate damages another enemy through real Matter contact', () => {
  const g = fixture(),
    crate = g.props.spawn('crate', 480, 300),
    e = target(g, 'shooter', 570, 300);
  Body.setStatic(e.body, true);
  ball(g);
  shots(g, 4);
  const hp = e.hp;
  // Remove the ball to isolate the physical prop impact from direct gun damage.
  g.shots = [];
  for (let i = 0; i < 20 && e.hp === hp; i++) {
    g.time += dt;
    g.props.beforeStep();
    Engine.update(g.engine, 1000 / 60);
    g.props.afterStep(dt);
  }
  assert(crate.body.position.x > 500);
  assert(e.hp < hp);
});

test('small enemies lose their perch while bosses, heavy machines and frontal shields resist knockback', () => {
  const g = fixture(),
    e = target(g, 'shooter');
  Body.setStatic(e.body, true);
  ball(g);
  shots(g, 7);
  assert(!e.body.isStatic);
  assert(e.body.velocity.x > 5);
  assert(e.body.velocity.y < 0);
  assert(g.massDriver.staggered(e));
  assert(e.hp < e.maxHp);
  for (const kind of [
    'loader',
    'crane',
    'press',
    'kiln',
    'condenser',
    'turbine',
    'sorter',
    'boss',
    'interceptor',
    'charger',
    'scrapper',
    'harpooner',
    'borer',
  ] as const) {
    const h = fixture(),
      heavy = target(h, kind, 550, 300),
      before = { ...heavy.body.velocity };
    ball(h);
    shots(h, 12);
    assert(heavy.hp < heavy.maxHp, kind);
    assert.deepEqual(heavy.body.velocity, before, kind);
    assert(!h.massDriver.staggered(heavy), kind);
  }
  const h = fixture(),
    shield = target(h, 'runner', 500, 300, true);
  shield.facing = -1;
  ball(h);
  shots(h, 8);
  near(shield.body.velocity.x, 0);
  near(shield.maxHp - shield.hp, h.gun.damage * 0.1);
});

test('one ball damages a boss only once even after ricocheting back, and has finite impacts', () => {
  const g = fixture(),
    e = target(g, 'loader', 550),
    s = ball(g);
  shots(g, 10);
  const hp = e.hp;
  assert(hp < e.maxHp);
  for (let i = 0; i < 5 && s.life > 0; i++) {
    s.pos = { x: e.body.bounds.min.x - 9, y: 300 };
    s.vel = { x: 18, y: 0 };
    shots(g);
    assert.equal(e.hp, hp);
  }
  assert(s.life <= 0);
});

test('piercing penetrates new targets and retains ordinary damage falloff', () => {
  const g = fixture(['mass-driver', 'pierce']);
  const a = target(g, 'runner', 480),
    b = target(g, 'runner', 600);
  Body.setStatic(a.body, true);
  Body.setStatic(b.body, true);
  ball(g);
  shots(g, 16);
  near(a.maxHp - a.hp, g.gun.damage);
  near(b.maxHp - b.hp, g.gun.damage * 0.8);
});

test('Banker grows damage on banks and Splinter fragments never become more steel balls', () => {
  const g = fixture(['mass-driver', 'banker', 'split']);
  wall(g);
  const s = ball(g),
    damage = s.damage;
  shots(g, 7);
  near(s.damage, damage * 1.35);
  assert(s.banks === 1);
  const fragments = g.shots.filter((s) => s.fragment);
  assert(fragments.length > 0);
  assert(fragments.every((s) => !s.massDriver));
});

test('shells and sticky fuses keep their payload and finish at the real contact', () => {
  for (const sticky of [false, true]) {
    const g = fixture(['mass-driver', 'shellshock', ...(sticky ? ['fuse'] : [])]),
      e = target(g, 'runner', 500);
    const s = ball(g);
    shots(g, 8);
    assert(!g.shots.includes(s));
    assert(e.hp < e.maxHp);
    assert.equal(g.ballistics.shells.length, sticky ? 1 : 0);
    if (sticky) assert.equal(g.ballistics.shells[0].body, e.body);
    else assert(g.demolition.effects.length > 0);
  }
});

test('portals rotate ball momentum without refilling lifetime, bounces or bank damage', () => {
  const g = fixture(['mass-driver', 'fold']);
  assert(g.portals.place({ x: 600, y: 740 }));
  assert(g.portals.place({ x: 1100, y: 740 }));
  const s = ball(g, { pos: { x: 600, y: 710 }, vel: { x: 0, y: 18 } });
  shots(g, 2);
  assert(s.pos.x > 1000);
  assert(s.vel.y < 0);
  assert.equal(s.bounces, 4);
  assert.equal(s.banks, 0);
  near(s.massDriver!.age, 2 * dt);
  assert(s.trace!.points.every((p) => p.x > 1000));
});

test('Countershot retains one shared recharge and hostile reflected rounds do not inherit Mass Driver', () => {
  const g = fixture(['mass-driver', 'countershot']);
  const s = ball(g, { pos: { x: 400, y: 300 } });
  const enemy = ball(g, {
    friendly: false,
    pos: { x: 405, y: 300 },
    vel: { x: -8, y: 0 },
    damage: 24,
  });
  assert(!enemy.massDriver);
  g.ballistics.reflect(dt);
  assert(enemy.reflected);
  assert(!enemy.massDriver);
  assert(!g.ballistics.counterReady);
  assert.equal(s.counter, 0);
});

test('Recall, Vector, echoes and Orbit retain bounded physical balls', () => {
  for (const mods of [
    ['mass-driver', 'recall', 'homecoming'],
    ['mass-driver', 'vector', 'afterburner'],
    ['mass-driver', 'crossfire', 'afterimage', 'parallax'],
    ['mass-driver', 'crossfire', 'recall', 'orbit'],
  ]) {
    const g = fixture(mods);
    g.engine.gravity.y = 1;
    for (let i = 0; i < 4; i++) {
      g.fireRound();
      g.time += 0.05;
    }
    for (let i = 0; i < 240; i++) {
      g.time += dt;
      g.ballistics.update();
      g.updateShots(dt);
    }
    assert(g.shots.every((s) => Number.isFinite(s.pos.x) && Number.isFinite(s.vel.y)));
    assert(!g.shots.some((s) => s.massDriver && s.life > 0));
  }
});

test('dense volleys stay bounded, age out, and freeze during pause and hitstop', () => {
  const g = fixture([
    'mass-driver',
    'crossfire',
    'scatter',
    'burst',
    'backblast',
    'backfire',
    'afterimage',
  ]);
  for (let i = 0; i < 6; i++) g.fireRound();
  shots(g);
  assert(g.shots.filter((s) => s.massDriver).length <= MASS_DRIVER.limit);
  const before = structuredClone(g.shots);
  g.setMode('paused');
  g.tick(1, idle);
  assert.deepEqual(g.shots, before);
  g.setMode('playing');
  g.hitStop = 0.1;
  g.tick(dt, idle);
  assert.deepEqual(g.shots, before);
  g.hitStop = 0;
  shots(g, 210);
  assert(!g.shots.some((s) => s.massDriver));
  ball(g);
  g.die();
  assert(!g.shots.some((s) => s.massDriver));
  g.start('fresh');
  assert(!g.shots.some((s) => s.massDriver));
  assert(!g.massDriver.equipped);
});

test('expiry explodes an armed shell once and low-speed impacts break a resting ball', () => {
  const g = fixture(['mass-driver', 'shellshock']),
    s = ball(g);
  s.massDriver!.age = MASS_DRIVER.life - dt / 2;
  shots(g);
  assert(!g.shots.includes(s));
  assert.equal(g.demolition.effects.length, 1);
  shots(g);
  assert.equal(g.demolition.effects.length, 1);
  const h = fixture();
  wall(h, 500);
  const slow = ball(h, { pos: { x: 491, y: 300 }, vel: { x: 2, y: 0 } });
  shots(h);
  assert(slow.life <= 0);
});

test('playtest links support all preset builds, both mirrors, boss fights and real train rooms', () => {
  for (const room of ['furnace', 'boss', 'train'])
    for (const mirror of [0, 1])
      for (const build of Object.keys(MASS_DRIVER_TEST_BUILDS)) {
        const save = massDriverTestFromUrl(
          new URL(
            `https://game.test/?test=mass-driver&room=${room}&build=${build}&mirror=${mirror}`,
          ),
        );
        assert(save);
        assert(loadCheckpoint(save));
        assert(validBuild(save.mods));
        assert.equal(save.mods.length, save.stage);
        const g = new Game();
        let writes = 0,
          victories = 0;
        g.onCheckpoint = () => writes++;
        g.onBossDefeated = () => victories++;
        g.startTest(save);
        assert.equal(g.level.mirrored, !!mirror);
        assert(g.massDriver.equipped);
        if (room === 'train') assert(g.level.crossing);
        if (room === 'boss') assert(g.level.boss);
        g.die();
        g.startTest(g.testRun!);
        assert.equal(writes, 0);
        assert.equal(victories, 0);
      }
  for (const extra of [
    '&daily=2026-09-13',
    '&dv=56',
    '&seed=run',
    '&test=mass-driver',
    '&build=unknown',
    '&room=unknown',
    '&mirror=2',
    '&build=base&build=bank',
  ])
    assert.equal(
      massDriverTestFromUrl(new URL('https://game.test/?test=mass-driver' + extra)),
      null,
    );
  const seed = dailyForDate('2026-09-13')!.seed;
  const first = rewardMods([], 3, seeded(seed)),
    second = rewardMods([], 3, seeded(seed));
  assert.deepEqual(first, second);
});

test('dense balls and launched debris cannot jam the train against the boundary', () => {
  for (const mirror of [0, 1]) {
    const save = massDriverTestFromUrl(
      new URL(`https://game.test/?test=mass-driver&room=train&mirror=${mirror}`),
    )!;
    const g = new Game();
    g.startTest(save);
    for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
    g.enemies = [];
    g.waves.clear();
    g.spawnEnemy('shooter', 1000, 100);
    g.updateEnemy = () => {};
    Body.setPosition(g.player, { x: 1000, y: 250 });
    g.crossing.beginStep(1.01);
    g.crossing.beginStep(CROSSING.tell + 0.01);
    assert.equal(g.crossing.cars.length, 2);
    const d = g.crossing.direction,
      edge = d > 0 ? 1930 : 70;
    g.props.spawn('crate', d > 0 ? 1974 : 26, 715);
    g.props.spawn('canister', d > 0 ? 1960 : 40, 700);
    for (const [i, c] of g.crossing.cars.entries())
      Body.setPosition(c.body, {
        x: edge - d * (CROSSING.width / 2 + i * (CROSSING.width + CROSSING.gap)),
        y: c.body.position.y,
      });
    for (let i = 0; i < 300 && g.crossing.cars.length; i++) {
      for (let j = 0; j < 4; j++)
        ball(g, { pos: { x: d > 0 ? 1980 : 20, y: 700 - j * 4 }, vel: { x: -d * 18, y: 0 } });
      g.hitStop = 0;
      g.tick(dt, idle);
      assert.equal(g.mode, 'playing');
    }
    assert.equal(g.crossing.cars.length, 0, 'the complete train must leave the edge');
    assert(g.shots.filter((s) => s.massDriver).length <= MASS_DRIVER.limit);
  }
});
test('base, bank and shell builds clear both real test-room mirrors with normal health and ordinary inputs', () => {
  for (const build of ['base', 'bank', 'shell'])
    for (const mirror of [0, 1]) {
      const g = new Game();
      g.startTest(
        massDriverTestFromUrl(
          new URL(`https://test/?test=mass-driver&build=${build}&mirror=${mirror}`),
        )!,
      );
      let stuck = 0,
        lastX = g.player.position.x,
        advanceUntil = 0;
      for (let frames = 0; frames < 60 * 110 && !g.clear && g.mode === 'playing'; frames++) {
        const e = g.enemies
          .filter((e) => e.spawn <= 0)
          .sort(
            (a, b) =>
              distance(a.body.position, g.player.position) -
              distance(b.body.position, g.player.position),
          )[0];
        let input: Partial<Input> = e ? dodgePilot(g, e) : {};
        stuck = Math.abs(g.player.position.x - lastX) < 0.2 ? stuck + 1 : 0;
        lastX = g.player.position.x;
        if (
          e &&
          (stuck > 90 || g.time < advanceUntil || (g.time > 2 && Math.floor(g.time) % 4 < 2)) &&
          distance(g.lineEnd(g.player.position, e.body.position), e.body.position) > 1
        ) {
          if (stuck > 90) {
            advanceUntil = g.time + 0.65;
            stuck = 0;
          }
          const dx = e.body.position.x - g.player.position.x;
          const dir = Math.abs(dx) < 80 ? (g.player.position.x < 1000 ? 1 : -1) : Math.sign(dx);
          input = { left: dir < 0, right: dir > 0, jump: g.grounded, fire: false };
          if (e.body.position.y < g.player.position.y - 200)
            input = {
              ...input,
              fire: true,
              aim: { x: g.player.position.x, y: g.player.position.y + 300 },
            };
        }
        if (e && input.fire && input.aim && distance(input.aim, e.body.position) < 80) {
          // Aiming a low ballistic arc is a player input. The pilot never moves
          // a projectile or changes damage, enemies, health, or the level.
          const p = g.player.position,
            dx = e.body.position.x - p.x,
            dy = e.body.position.y - (p.y - 3);
          const v = g.gun.projectileSpeed,
            gravity = 0.2777777778;
          const discriminant = v ** 4 - gravity * (gravity * dx * dx - 2 * dy * v * v);
          if (Math.abs(dx) > 20 && discriminant >= 0) {
            const tangent = (v * v - Math.sqrt(discriminant)) / (gravity * Math.abs(dx));
            input.aim = { x: p.x + Math.sign(dx) * 1000, y: p.y - tangent * 1000 };
          }
        }
        g.tick(dt, { ...idle, ...input });
      }
      assert(
        g.clear && g.hp > 0,
        JSON.stringify({ build, mirror, hp: g.hp, remaining: g.enemies.length }),
      );
    }
});
