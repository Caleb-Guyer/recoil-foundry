import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { CROSSING } from '../src/crossing-layout.ts';
import { crossingTestFromUrl } from '../src/practice.ts';
import { getLevel } from '../src/levels.ts';
import { getOvertimeLevel } from '../src/overtime.ts';
import { dailyForDate } from '../src/daily.ts';
import { loadCheckpoint, validBuild, getGun } from '../src/rules.ts';
const { Body, Composite, Query } = Matter;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1500, y: 400 },
};
function room(area = 'docks', mirror = false) {
  const save = crossingTestFromUrl(
    new URL(`https://test/?test=crossing&area=${area}&mirror=${Number(mirror)}`),
  )!;
  assert(save);
  const g = new Game();
  g.startTest(save);
  return g;
}
function quiet(g: Game) {
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  for (const p of [...g.props.items]) g.props.remove(p);
  // Keep the room uncleared while isolating its physical machinery from combat AI.
  g.spawnEnemy('shooter', 1800, 100);
  g.updateEnemy = () => {};
}
function tick(g: Game, n = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < n; i++) {
    g.hitStop = 0;
    g.tick(1 / 60, { ...idle, ...input });
  }
}
function pass(g: Game, edge = 600, d = 1) {
  g.crossing.direction = d;
  g.crossing.beginStep(1.01);
  g.crossing.beginStep(CROSSING.tell + 0.01);
  assert.equal(g.crossing.cars.length, 2);
  for (const [i, c] of g.crossing.cars.entries())
    Body.setPosition(c.body, {
      x: edge - d * (CROSSING.width / 2 + i * (CROSSING.width + CROSSING.gap)),
      y: c.body.position.y,
    });
}
test('crossing links select real, repeatable rooms in both areas and preserve saves', () => {
  for (const area of ['docks', 'reclamation'])
    for (const mirror of [false, true]) {
      const g = room(area, mirror),
        save = g.testRun!;
      assert.equal(g.level.area, area);
      assert.equal(g.level.mirrored, mirror);
      assert(g.level.crossing);
      assert.equal(save.mods.length, save.stage);
      assert(validBuild(save.mods));
      assert.deepEqual(loadCheckpoint(save), save);
      assert.deepEqual(g.level, getLevel(save.seed, save.stage));
      assert.equal(
        g.hazards.bodies.length +
          g.breaches.bodies.length +
          g.conveyors.items.length +
          g.magnets.items.length,
        0,
      );
      for (const e of g.enemies) assert.equal(Query.collides(e.body, g.solidBodies).length, 0);
      let saves = 0;
      g.onCheckpoint = () => saves++;
      g.save();
      assert.equal(saves, 0);
      g.crossing.beginStep(1.01);
      g.startTest(save);
      assert.equal(g.crossing.phase, 'idle');
      assert.equal(g.crossing.cars.length, 0);
    }
});
test('crossing test rejects malformed or conflicting parameters', () => {
  for (const suffix of [
    '&test=crossing',
    '&mirror=2',
    '&mirror=0&mirror=1',
    '&area=furnace',
    '&area=docks&area=docks',
    ...['daily', 'dv', 'seed', 'build', 'layout', 'variant', 'route', 'mode', 'formation'].map(
      (k) => '&' + k + '=x',
    ),
  ])
    assert.equal(
      crossingTestFromUrl(new URL('https://test/?test=crossing' + suffix)),
      null,
      suffix,
    );
});
test('Daily and Overtime include crossings only in their two non-introductory slots', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const seed = dailyForDate(new Date(Date.UTC(2026, 8, i + 1)).toISOString().slice(0, 10))!.seed;
    for (let stage = 0; stage < 20; stage++)
      for (const [mode, l] of [
        ['daily', getLevel(seed, stage)],
        ['overtime', getOvertimeLevel(seed, stage)],
      ] as const) {
        if (l.crossing) {
          assert([1, 13].includes(stage));
          assert(!l.boss);
          seen.add(mode + ':' + stage + ':' + l.mirrored);
        }
      }
  }
  assert.equal(seen.size, 8);
});
test('the full warning precedes solid cars; pause freezes it and directions alternate', () => {
  const g = room();
  quiet(g);
  const sounds: string[] = [];
  g.onSound = (s) => sounds.push(s);
  tick(g, 61);
  assert.equal(g.crossing.phase, 'warning');
  assert.equal(g.crossing.cars.length, 0);
  const timer = g.crossing.timer;
  g.setMode('paused');
  tick(g, 120);
  assert.equal(g.crossing.timer, timer);
  g.setMode('playing');
  tick(g, 140);
  assert.equal(g.crossing.cars.length, 0);
  tick(g, 8);
  assert.equal(g.crossing.cars.length, 2);
  assert(sounds.includes('train-horn'));
  assert(sounds.includes('train-near'));
  Body.setPosition(g.player, { x: 140, y: 300 });
  Body.setStatic(g.player, true);
  const direction = g.crossing.direction;
  tick(g, 900);
  assert.equal(g.crossing.direction, -direction);
});
for (const d of [1, -1]) {
  test(`roof riders move with the car and inherit momentum once when jumping (${d})`, () => {
    const g = room();
    quiet(g);
    pass(g, 1000, d);
    const car = g.crossing.cars[0].body;
    Body.setPosition(g.player, { x: car.position.x, y: CROSSING.top - 18 });
    Body.setVelocity(g.player, { x: 0, y: 0 });
    const x = g.player.position.x;
    tick(g, 12);
    assert(
      Math.abs(g.player.position.x - x - d * 48) < 2,
      `rider drift ${g.player.position.x - x}`,
    );
    assert(Math.abs(g.player.position.y - (CROSSING.top - 18)) < 1);
    tick(g, 1, { jump: true });
    assert(g.player.velocity.x * d > 3.5);
    assert(g.player.velocity.y < -10);
    tick(g, 6);
    assert(g.player.velocity.x * d < 4.1, 'repeated carry accelerated the airborne rider');
    assert(g.hp === 100);
  });
  test(`train shoves crates, ignites canisters, and hits enemies without phantom rear damage (${d})`, () => {
    const g = room('reclamation');
    quiet(g);
    pass(g, 1000, d);
    const crate = g.props.spawn('crate', 1000 + d * 24, 718);
    tick(g, 1);
    assert.equal(crate.hp, 90);
    assert(crate.body.velocity.x * d > 3);
    assert(g.props.items.includes(crate));
    g.props.remove(crate);
    const fuel = g.props.spawn(
      'canister',
      g.crossing.cars[0].body.position.x + d * (CROSSING.width / 2 + 13),
      721,
    );
    tick(g, 3);
    assert(!g.props.items.includes(fuel));
    const edge = g.crossing.cars[0].body.position.x + (d * CROSSING.width) / 2;
    g.spawnEnemy('runner', edge + d * 17, 723);
    const enemy = g.enemies.at(-1)!;
    enemy.spawn = 0;
    const hp = enemy.hp;
    tick(g, 1);
    assert(enemy.hp < hp);
    assert.equal(enemy.hp, hp - 80);
    const rear = g.crossing.cars[0].body.position.x - d * (CROSSING.width / 2 + 35);
    g.spawnEnemy('runner', rear, 723);
    const behind = g.enemies.at(-1)!;
    behind.spawn = 0;
    tick(g, 1);
    assert.equal(behind.hp, behind.maxHp);
  });
  test(`wedging against the arena edge is a lethal crush, including during damage grace (${d})`, () => {
    for (const invulnerable of [false, true]) {
      const g = room();
      quiet(g);
      pass(g, d === 1 ? 1968 : 32, d);
      Body.setPosition(g.player, { x: d === 1 ? 1987 : 13, y: 722 });
      Body.setVelocity(g.player, { x: 0, y: 0 });
      if (invulnerable) g.hurtAt = g.time;
      tick(g, 10);
      assert.equal(g.mode, 'dead');
      assert.equal(g.hp, 0);
      assert(g.player.position.x >= 12.7 && g.player.position.x <= 1987.3);
      assert(
        Query.collides(g.player, g.crossing.bodies).every((c) => c.depth < 1),
        'crush must not embed the player',
      );
    }
  });
  test(`clearing the roof on the next physics step is not a side crush (${d})`, () => {
    for (const [bottom, vy] of [
      [637, -2],
      [642, -8],
    ]) {
      const g = room();
      quiet(g);
      pass(g, d === 1 ? 1973 : 27, d);
      Body.setPosition(g.player, { x: d === 1 ? 1987 : 13, y: bottom - 18 });
      Body.setVelocity(g.player, { x: 0, y: vy });
      tick(g, 1);
      assert.equal(g.hp, 100);
      assert.equal(g.mode, 'playing');
      assert(g.player.position.y + 18 < CROSSING.top + 1);
    }
  });
  test(`an early jump escapes the closing edge and a clear room stays harmless (${d})`, () => {
    const g = room();
    quiet(g);
    pass(g, d === 1 ? 1890 : 110, d);
    Body.setPosition(g.player, { x: d === 1 ? 1987 : 13, y: 722 });
    Body.setVelocity(g.player, { x: 0, y: 0 });
    tick(g, 30, { jump: true });
    assert.equal(g.hp, 100);
    assert.equal(g.mode, 'playing');
    assert(g.player.position.y < CROSSING.top);
    assert(!g.crossing.blocked);
    g.startTest(g.testRun!);
    quiet(g);
    pass(g, d === 1 ? 1968 : 32, d);
    g.clear = true;
    Body.setPosition(g.player, { x: d === 1 ? 1987 : 13, y: 722 });
    tick(g, 10);
    assert.notEqual(g.mode, 'dead');
    assert.equal(g.hp, 100);
  });
}
test('cars are real projectile cover and block a portal exit while passing', () => {
  const g = room();
  quiet(g);
  g.mods = ['fold'];
  assert(g.portals.place({ x: 0, y: 680 }));
  assert(g.portals.place({ x: 2000, y: 680 }));
  pass(g, 1990);
  const car = g.crossing.cars[0].body;
  const pos = { x: car.position.x - CROSSING.width / 2 - 20, y: 690 };
  g.addShot({
    pos,
    vel: { x: 50, y: 0 },
    damage: 24,
    life: 1,
    friendly: true,
    radius: 2,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
  });
  g.updateShots(1 / 60);
  assert.equal(g.shots.length, 0);
  assert.equal(g.portals.traceBody({ x: 20, y: 680 }, { x: 5, y: 680 }, g.player), null);
});
test('clear rooms cancel incoming trains and room transitions remove all car bodies', () => {
  const g = room();
  quiet(g);
  g.crossing.beginStep(1.01);
  g.clear = true;
  tick(g, 400);
  assert.equal(g.crossing.cars.length, 0);
  assert.equal(g.crossing.phase, 'idle');
  g.clear = false;
  g.crossing.reset();
  pass(g);
  const bodies = [...g.crossing.bodies];
  g.stage = 0;
  g.loadRoom();
  assert(!g.crossing.active);
  assert.equal(g.crossing.bodies.length, 0);
  for (const body of bodies) assert(!Composite.allBodies(g.engine.world).includes(body));
});
test('ordinary jumps cross the permanent upper route in both directions while trains run', () => {
  for (const mirror of [false, true])
    for (const d of [1, -1]) {
      const g = room('docks', mirror);
      quiet(g);
      g.mods = [];
      g.gun = getGun([]);
      Body.setPosition(g.player, { x: d === 1 ? 140 : 1860, y: 722 });
      const path = g.level.route.filter((p) => p.y < 700).sort((a, b) => (a.x - b.x) * d);
      path.push({ x: d === 1 ? 1850 : 150, y: 722 });
      let waypoint = 0,
        previous = g.player.position.x,
        stuck = 0;
      for (let frame = 0; frame < 1800 && waypoint < path.length && g.mode === 'playing'; frame++) {
        const p = g.player.position,
          target = path[waypoint],
          dx = target.x - p.x,
          dy = p.y - target.y;
        if (Math.abs(dx) < 34 && Math.abs(dy) < 8 && g.grounded) {
          waypoint++;
          continue;
        }
        stuck = Math.abs(p.x - previous) < 0.4 ? stuck + 1 : 0;
        previous = p.x;
        const move = Math.abs(dx) > 10 ? Math.sign(dx) : 0;
        const blocked =
          move && Query.ray(g.solidBodies, p, { x: p.x + move * 65, y: p.y }, 22).length > 0;
        const gap =
          !!move &&
          p.y < 620 &&
          Query.ray(
            g.terrainBodies,
            { x: p.x + move * 65, y: p.y + 14 },
            { x: p.x + move * 65, y: p.y + 80 },
            2,
          ).length === 0;
        tick(g, 1, {
          left: move < 0,
          right: move > 0,
          jump: g.grounded && (dy > 50 || !!blocked || gap || stuck > 15),
        });
      }
      assert.equal(
        waypoint,
        path.length,
        `route ${mirror}/${d} stopped at ${waypoint}: ${JSON.stringify(g.player.position)}`,
      );
      assert(g.hp > 0);
    }
});
test('riders carry stacked props safely and a pinned crate breaks without jamming the train', () => {
  const g = room();
  quiet(g);
  pass(g, 1100);
  const c = g.crossing.cars[0].body;
  const crate = g.props.spawn('crate', c.position.x, 614);
  Body.setPosition(g.player, { x: c.position.x, y: 574 });
  const start = g.player.position.x;
  tick(g, 10);
  assert(Math.abs(g.player.position.x - start - 40) < 3);
  assert(Math.abs(crate.body.position.x - g.player.position.x) < 3);
  g.props.remove(crate);
  Body.setPosition(g.player, { x: 1000, y: 300 });
  Body.setStatic(g.player, true);
  for (const [i, car] of g.crossing.cars.entries())
    Body.setPosition(car.body, { x: 1830 - i * 410, y: 688 });
  const pinned = g.props.spawn('crate', 1978, 718);
  tick(g, 180);
  assert(!g.props.items.includes(pinned));
  assert(g.crossing.cars[0].body.position.x > 1980);
});
test('an entering gunner is pushed safely during its spawn warning and becomes vulnerable afterward', () => {
  const g = room('reclamation');
  quiet(g);
  pass(g, 1000);
  g.spawnEnemy('shooter', 1020, 724);
  const e = g.enemies.at(-1)!;
  tick(g, 20);
  assert.equal(e.hp, e.maxHp);
  assert(!e.body.isStatic);
  assert(e.body.position.x > 1060);
  assert(Query.collides(e.body, g.crossing.bodies).every((c) => c.depth < 1));
  e.spawn = 0;
  tick(g, 1);
  assert.equal(e.hp, e.maxHp - 80);
});
test('anchored enemies can ride a car and tall cargo stops safely beneath catwalk steps', () => {
  const g = room('reclamation');
  quiet(g);
  pass(g, 1150);
  g.spawnEnemy('shooter', 1020, 620);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  tick(g, 10);
  assert(!e.body.isStatic);
  assert(Math.abs(e.body.position.x - 1060) < 2);
  assert.equal(e.hp, e.maxHp);
  // A 44px crate cannot fit between the 40px gap below an approach step.
  for (const enemy of [...g.enemies]) Composite.remove(g.engine.world, enemy.body);
  g.enemies = [];
  g.spawnEnemy('shooter', 1800, 100);
  Body.setPosition(g.player, { x: 1200, y: 300 });
  Body.setStatic(g.player, true);
  for (const [i, car] of g.crossing.cars.entries())
    Body.setPosition(car.body, { x: 1550 - i * 410, y: 688 });
  const crate = g.props.spawn('crate', 1575, 614);
  tick(g, 30);
  assert(crate.body.position.x < 1590, 'cargo was squeezed through the step');
  assert(Query.collides(crate.body, g.terrain).every((c) => c.depth < 1));
  assert(
    g.crossing.cars[0].body.position.x > 1640,
    'a blocked rider incorrectly stopped the whole train',
  );
});

for (const d of [1, -1]) {
  for (const kind of ['crate', 'cargo', 'cover', 'rubble', 'canister', 'charge'] as const)
    test(`edge compression clears ${kind} without stopping the train (${d})`, () => {
      const g = room('reclamation');
      quiet(g);
      Body.setPosition(g.player, { x: 1000, y: 250 });
      Body.setStatic(g.player, true);
      let prop;
      if (kind === 'charge') {
        g.spawnEnemy('sapper', 1000, 580);
        const e = g.enemies.at(-1)!;
        e.spawn = 0;
        prop = g.sappers.launch(e, { x: 1050, y: 560 }, { x: 0, y: 0 })!;
        assert(prop?.charge);
        // Prove compression handles the bomb; waiting for its fuse would hide a jam.
        prop.charge.at = 1000;
      } else prop = g.props.spawn(kind, 1000, 500);
      Body.setAngle(prop.body, kind === 'cargo' ? 0 : 0.3);
      const halfX = Math.max(
          ...prop.body.vertices.map((v) => Math.abs(v.x - prop.body.position.x)),
        ),
        halfY = Math.max(...prop.body.vertices.map((v) => Math.abs(v.y - prop.body.position.y)));
      Body.setPosition(prop.body, { x: d === 1 ? 2000 - halfX : halfX, y: 740 - halfY });
      pass(g, d === 1 ? 2000 - 2 * halfX : 2 * halfX, d);
      const cars = [...g.crossing.bodies],
        start = cars[0].position.x;
      tick(g);
      assert(!g.props.items.includes(prop), 'compressed hull survived');
      assert(!Composite.allBodies(g.engine.world).includes(prop.body));
      assert.equal(g.sappers.items.length, 0);
      assert(!g.crossing.blocked);
      assert(Math.abs(cars[0].position.x - start - 4 * d) < 1e-6);
      assert.equal(g.hp, 100);
      tick(g, 200);
      assert.equal(g.crossing.cars.length, 0, 'train never left the room');
    });
  test(`stacked obstacles and chain explosions do not retain a stale blocked sweep (${d})`, () => {
    const g = room();
    quiet(g);
    Body.setPosition(g.player, { x: 1000, y: 250 });
    Body.setStatic(g.player, true);
    const edge = d === 1 ? 1868 : 132;
    const props = [0, 1, 2].map((i) => g.props.spawn('crate', edge + d * (22 + 44 * i), 718));
    // An explosion can remove several members of a push chain during planning.
    g.props.spawn('canister', edge + d * 54, 670);
    pass(g, edge, d);
    const car = g.crossing.cars[0].body,
      start = car.position.x;
    for (let i = 0; i < 40; i++) {
      tick(g);
      assert(!g.crossing.blocked, 'destroyed chain kept its old collision');
      assert(Math.abs(car.position.x - start - (i + 1) * 4 * d) < 1e-5);
    }
    assert(props.every((p) => !g.props.items.includes(p)));
  });
  test(`compressed wrecks are consumed without waiting for their lifetime (${d})`, () => {
    const g = room();
    quiet(g);
    g.mods = ['ramjet', 'wrecking-ball'];
    g.gun = getGun(g.mods);
    Body.setPosition(g.player, { x: 1000, y: 250 });
    Body.setStatic(g.player, true);
    g.spawnEnemy('runner', d === 1 ? 1983 : 17, 723);
    const enemy = g.enemies.at(-1)!;
    enemy.spawn = 0;
    g.hitEnemy(enemy, 99999);
    assert(g.salvageEvolutions.throwEnemy(enemy, { x: d, y: 0 }, 15));
    const wreck = g.salvageEvolutions.wrecks[0];
    wreck.until = 1000;
    Body.setVelocity(wreck.body, { x: 0, y: 0 });
    pass(g, d === 1 ? 1966 : 34, d);
    const car = g.crossing.cars[0].body,
      start = car.position.x;
    g.crossing.beforeStep(1 / 60);
    assert.equal(g.salvageEvolutions.wrecks.length, 0);
    assert(!Composite.allBodies(g.engine.world).includes(wreck.body));
    assert(!g.crossing.blocked);
    assert(Math.abs(car.position.x - start - 4 * d) < 1e-6);
  });
}
