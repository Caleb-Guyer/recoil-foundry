import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { MODS, availableMods, getGun, loadCheckpoint, rewardMods, seeded } from '../src/rules.ts';
import { bodyHalf, portalVector } from '../src/portals.ts';
import type { Input } from '../src/game.ts';
const { Body, Bodies, Composite, Engine } = Matter;
const near = (a: number, b: number) => assert(Math.abs(a - b) < 0.02, `${a} != ${b}`);
function fixture() {
  const g = new Game();
  g.start('portal-test');
  g.hazards.clear();
  g.breaches.clear();
  g.waves.clear();
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const e of g.enemies) {
    Composite.remove(g.engine.world, e.body);
    if (e.crane) Composite.remove(g.engine.world, e.crane.body);
  }
  g.enemies = [];
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.mods = ['fold'];
  g.gun = getGun(g.mods);
  g.engine.gravity.y = 0;
  Body.setPosition(g.player, { x: 400, y: 400 });
  g.player.frictionAir = 0;
  return g;
}
function wall(g: Game, x = 800, y = 500, w = 40, h = 480) {
  const b = Bodies.rectangle(x, y, w, h, { isStatic: true });
  g.terrain.push(b);
  Composite.add(g.engine.world, b);
  return b;
}
function physics(g: Game, count = 1) {
  for (let i = 0; i < count; i++) {
    g.time += 1 / 60;
    g.props.beforeStep();
    g.portals.beforeStep();
    Engine.update(g.engine, 1000 / 60);
    g.props.afterStep(1 / 60);
  }
}
function step(g: Game, input: Partial<Input> = {}) {
  g.tick(1 / 60, {
    left: false,
    right: false,
    jump: false,
    jumpHeld: true,
    fire: false,
    aim: { x: 600, y: 740 },
    ...input,
  });
}
function shot(g: Game, friendly = true, extra = {}) {
  g.addShot({
    pos: { x: 600, y: 710 },
    vel: { x: 0, y: 45 },
    damage: 20,
    life: 2,
    radius: 3,
    friendly,
    bounces: 2,
    pierce: 2,
    fragment: false,
    split: false,
    ...extra,
  });
  return g.shots.at(-1)!;
}
test('Fold is shared, unique, saveable, and leaves the one gun unchanged', () => {
  for (const path of [[], ['crossfire'], ['deadeye']]) {
    assert(availableMods(path).some((m) => m.id === 'fold'));
    assert(!availableMods([...path, 'fold']).some((m) => m.id === 'fold'));
    assert.deepEqual(getGun(path), getGun([...path, 'fold']));
  }
  const g = fixture();
  let save: unknown;
  g.onCheckpoint = (s) => {
    save = s;
  };
  g.save();
  const checkpoint = loadCheckpoint(save)!;
  assert(checkpoint);
  g.start(checkpoint.seed, checkpoint);
  assert(g.portals.equipped);
  assert.deepEqual(g.portals.pair, [null, null]);
});
test('surface placement alternates, replaces only one end, and rejects air, props, short and buried faces', () => {
  const g = fixture();
  assert(!g.portals.place({ x: 300, y: 300 }));
  assert.equal(g.portals.next, 0);
  assert(g.portals.place({ x: 600, y: 740 }));
  assert(!g.portals.linked);
  const blue = g.portals.pair[0];
  assert(!g.portals.place({ x: 620, y: 740 }));
  assert.equal(g.portals.pair[0], blue);
  assert(g.portals.place({ x: 1000, y: 745 }));
  assert(g.portals.linked);
  const orange = g.portals.pair[1];
  assert(g.portals.place({ x: 1400, y: 740 }));
  assert.equal(g.portals.pair[1], orange);
  wall(g, 800, 400, 40, 40);
  assert(!g.portals.candidate({ x: 780, y: 400 }));
  wall(g, 1200, 710, 200, 60);
  assert(!g.portals.candidate({ x: 1200, y: 740 }), 'buried floor accepted');
  assert(!g.portals.candidate({ x: NaN, y: 740 }));
});
test('a single endpoint is solid, and deleting its supporting surface deactivates a pair', () => {
  const g = fixture();
  g.portals.place({ x: 600, y: 740 });
  Body.setPosition(g.player, { x: 600, y: 700 });
  Body.setVelocity(g.player, { x: 0, y: 20 });
  physics(g, 3);
  assert(g.player.position.y < 723);
  near(g.player.position.x, 600);
  g.portals.place({ x: 1000, y: 740 });
  g.terrain.shift();
  assert(!g.portals.linked);
});

test('standing on a floor exit cannot cause an endless teleport loop; leaving it permits return', () => {
  const g = fixture();
  g.engine.gravity.y = 1;
  g.portals.place({ x: 600, y: 740 });
  g.portals.place({ x: 1100, y: 740 });
  Body.setPosition(g.player, { x: 600, y: 722 });
  physics(g, 100);
  assert.equal(g.portals.revision, 1);
  near(g.player.position.x, 1100);
  Body.setVelocity(g.player, { x: 0, y: -7 });
  physics(g, 100);
  assert(g.portals.revision >= 2, 'a deliberate jump back into the opening was blocked');
});
test('all sixteen entrance/exit orientations rotate velocity without losing speed', () => {
  const g = fixture();
  const points = [
    { x: 400, y: 740 },
    { x: 1200, y: 0 },
    { x: 0, y: 400 },
    { x: 2000, y: 400 },
  ];
  const surfaces = points.map((p) => g.portals.candidate(p)!);
  assert(surfaces.every(Boolean));
  for (const entry of surfaces)
    for (const exit of surfaces) {
      const v = {
        x: -entry.normal.x * 18 - entry.normal.y * 5,
        y: -entry.normal.y * 18 + entry.normal.x * 5,
      };
      const out = portalVector(v, entry, exit);
      near(Math.hypot(out.x, out.y), Math.hypot(v.x, v.y));
      near(out.x * exit.normal.x + out.y * exit.normal.y, 18);
      const roundTrip = portalVector(out, exit, entry);
      near(roundTrip.x, v.x);
      near(roundTrip.y, v.y);
    }
});
test('falling through a floor flings the player sideways with residual movement and no map-spanning trail', () => {
  const g = fixture();
  wall(g);
  g.portals.place({ x: 600, y: 740 });
  g.portals.place({ x: 780, y: 400 });
  Body.setPosition(g.player, { x: 600, y: 710 });
  Body.setVelocity(g.player, { x: 0, y: 20 });
  g.trail = [{ x: 600, y: 710 }];
  g.grounded = true;
  g.coyote = 0.1;
  physics(g);
  assert(g.player.position.x < 766 && g.player.position.x > 755);
  near(g.player.position.y, 400);
  near(g.player.velocity.x, -20);
  near(g.player.velocity.y, 0);
  assert.equal(g.portals.revision, 1);
  assert.equal(g.trail.length, 0);
  assert(!g.grounded);
  assert.equal(g.coyote, 0);
  physics(g, 10);
  assert.equal(g.portals.revision, 1);
});
test('walk into a wall portal at floor height, and high-speed actors cannot skip the opening', () => {
  for (const speed of [2, 80]) {
    const g = fixture();
    wall(g);
    assert(g.portals.place({ x: 780, y: 735 }));
    g.portals.place({ x: 1100, y: 740 });
    Body.setPosition(g.player, { x: 765 - speed / 2, y: 721.9 });
    Body.setVelocity(g.player, { x: speed, y: 0 });
    physics(g, 3);
    assert.equal(g.portals.revision, 1);
    assert(g.player.position.y < 720);
    assert(g.player.position.x > 1000);
  }
});
test('rim misses, back-side approaches, occupied exits, and entry obstacles remain solid', () => {
  for (const kind of ['rim', 'back', 'exit', 'entry']) {
    const g = fixture();
    wall(g);
    g.portals.place({ x: 600, y: 740 });
    g.portals.place({ x: 780, y: 400 });
    let from = { x: 600, y: 710 },
      to = { x: 600, y: 750 };
    if (kind === 'rim') from.x = to.x = 639;
    if (kind === 'back') {
      from.y = 780;
      to.y = 720;
    }
    if (kind === 'exit') wall(g, 750, 400, 20, 100);
    if (kind === 'entry') wall(g, 600, 730, 100, 4);
    assert.equal(g.portals.trace(from, to, { x: 13, y: 18 }), null, kind);
  }
});
test('hostile and friendly projectiles travel, preserve upgrades and ownership, and break their trail', () => {
  for (const friendly of [true, false]) {
    const g = fixture();
    wall(g);
    g.portals.place({ x: 600, y: 740 });
    g.portals.place({ x: 780, y: 400 });
    const s = shot(g, friendly);
    s.hits.add(999);
    s.banks = 2;
    s.bankGrowth = 0.35;
    g.updateShots(1 / 60);
    assert(s.pos.x < 776 && s.pos.x > 750);
    near(s.pos.y, 400);
    near(s.vel.x, -45);
    assert.equal(s.friendly, friendly);
    assert.equal(s.damage, 20);
    assert.equal(s.pierce, 2);
    assert.equal(s.bounces, 2);
    assert.equal(s.banks, 2);
    assert(s.hits.has(999));
    if (friendly) assert(s.trace!.points.every((p) => p.x > 740 && p.y === 400));
    assert.equal(s.prev.y, 400);
  }
});
test('exit targets take real damage, entry targets block travel, and hostile rounds can hit the player', () => {
  for (const type of ['enemy', 'player', 'entry']) {
    const g = fixture();
    wall(g);
    g.portals.place({ x: 600, y: 740 });
    g.portals.place({ x: 780, y: 400 });
    let enemy;
    if (type === 'player') Body.setPosition(g.player, { x: 735, y: 400 });
    else {
      g.spawnEnemy('shooter', type === 'entry' ? 600 : 735, type === 'entry' ? 705 : 400);
      enemy = g.enemies.at(-1)!;
      enemy.spawn = 0;
    }
    shot(g, type !== 'player', type === 'entry' ? { pos: { x: 600, y: 660 }, pierce: 0 } : {});
    g.updateShots(1 / 30);
    if (enemy) assert(enemy.hp < enemy.maxHp);
    else assert(g.hp < 100);
    if (type === 'entry') assert(g.shots.every((s) => s.pos.y > 600));
  }
});
test('smaller enemies and movable props travel; oversized bosses and anchored machines cannot fit', () => {
  for (const kind of [
    'runner',
    'flyer',
    'charger',
    'hopper',
    'boss',
    'loader',
    'press',
    'crane',
    'kiln',
  ] as const) {
    const g = fixture();
    g.portals.place({ x: 600, y: 740 });
    g.portals.place({ x: 1100, y: 740 });
    g.spawnEnemy(kind, 600, 700);
    const e = g.enemies.at(-1)!;
    e.spawn = 0;
    e.body.frictionAir = 0;
    Body.setPosition(e.body, { x: 600, y: 739 - bodyHalf(e.body).y });
    Body.setVelocity(e.body, { x: 0, y: 10 });
    physics(g);
    assert.equal(
      e.body.position.x > 1000,
      ['runner', 'flyer', 'charger', 'hopper'].includes(kind),
      kind,
    );
  }
  const g = fixture();
  g.portals.place({ x: 600, y: 740 });
  g.portals.place({ x: 1100, y: 740 });
  g.props.spawn('crate', 600, 710);
  const prop = g.props.items.at(-1)!;
  Body.setVelocity(prop.body, { x: 0, y: 12 });
  physics(g);
  assert(prop.body.position.x > 1000);
  assert.equal(prop.hp, prop.maxHp);
});
test('right-click requests survive hit stop once, clear on pause, and reset between rooms', () => {
  const g = fixture();
  g.hitStop = 0.03;
  step(g, { portal: { x: 600, y: 740 } });
  assert.equal(g.portals.next, 0);
  step(g);
  step(g);
  assert.equal(g.portals.next, 1);
  step(g);
  assert.equal(g.portals.next, 1);
  g.hitStop = 0.1;
  step(g, { portal: { x: 1100, y: 740 } });
  g.setMode('paused');
  g.setMode('playing');
  g.hitStop = 0;
  step(g);
  assert(!g.portals.linked);
  g.portals.place({ x: 1100, y: 740 });
  g.loadRoom();
  assert.deepEqual(g.portals.pair, [null, null]);
  g.mods = [];
  step(g, { portal: { x: 600, y: 740 } });
  assert.deepEqual(g.portals.pair, [null, null]);
});
test('repeated portal routes stay bounded and never multiply damage or projectile counts', () => {
  const g = fixture();
  g.portals.place({ x: 0, y: 400 });
  g.portals.place({ x: 2000, y: 400 });
  const s = shot(g, true, { pos: { x: 1990, y: 400 }, vel: { x: 100000, y: 0 }, life: 1 });
  for (let i = 0; i < 100; i++) g.updateShots(1 / 60);
  assert.equal(g.shots.length, 0);
  assert.equal(s.damage, 20);
  assert(Number.isFinite(s.pos.x));
});

test('a charging enemy recognizes the aperture instead of braking at its supporting wall', () => {
  const g = fixture();
  wall(g);
  g.portals.place({ x: 780, y: 730 });
  g.portals.place({ x: 1100, y: 740 });
  Body.setPosition(g.player, { x: 1400, y: 700 });
  g.spawnEnemy('charger', 740, 722);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  e.state = 'rush';
  e.timer = 1;
  e.aim = { x: 1, y: 0 };
  step(g);
  step(g);
  step(g);
  assert(e.body.position.x > 1000);
  assert.equal(e.state, 'recover');
  assert(e.body.velocity.y < 0);
});

test('a hostile muzzle touching an opening sends its shot through instead of swallowing it', () => {
  const g = fixture();
  wall(g);
  g.portals.place({ x: 780, y: 400 });
  g.portals.place({ x: 1100, y: 740 });
  g.spawnEnemy('shooter', 760, 400);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  g.enemyShot(e, 0, 30, 14);
  assert.equal(g.shots.length, 1);
  const s = g.shots[0];
  g.updateShots(1 / 30);
  assert(s.pos.x > 1000);
  assert(s.vel.y < 0);
  assert(!s.friendly);
});

test('a blocked exit releases safely when cleared, including rotated props and live enemies', () => {
  const g = fixture();
  wall(g);
  g.portals.place({ x: 600, y: 740 });
  g.portals.place({ x: 780, y: 400 });
  const prop = g.props.spawn('crate', 755, 400);
  Body.setAngle(prop.body, Math.PI / 4);
  Body.setPosition(g.player, { x: 600, y: 710 });
  Body.setVelocity(g.player, { x: 0, y: 15 });
  physics(g, 2);
  assert.equal(g.portals.revision, 0);
  g.props.remove(prop);
  g.spawnEnemy('shooter', 755, 400);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  Body.setPosition(g.player, { x: 600, y: 710 });
  Body.setVelocity(g.player, { x: 0, y: 15 });
  physics(g, 2);
  assert.equal(g.portals.revision, 0);
  Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  Body.setPosition(g.player, { x: 600, y: 710 });
  Body.setVelocity(g.player, { x: 0, y: 15 });
  physics(g, 2);
  assert.equal(g.portals.revision, 1);
});
test('committed path upgrades have modestly better odds without forcing them or changing legality', () => {
  for (const [root, follow] of [
    ['crossfire', 'bloom'],
    ['deadeye', 'execute'],
  ]) {
    let favored = 0,
      shared = 0;
    const rng = seeded('weighted-' + root);
    for (let i = 0; i < 20000; i++) {
      const offers = rewardMods([root], 3, rng);
      assert.equal(new Set(offers).size, 3);
      assert(offers.every((m) => availableMods([root]).includes(m)));
      if (offers.some((m) => m.id === follow)) favored++;
      if (offers.some((m) => m.id === 'fold')) shared++;
    }
    assert(favored > shared * 1.3 && favored < shared * 1.6, `${favored} vs ${shared}`);
    assert(favored < 20000 * 0.4);
    assert.deepEqual(
      rewardMods([root], 3, seeded('retry')),
      rewardMods([root], 3, seeded('retry')),
    );
  }
  assert.equal(MODS.filter((m) => m.id === 'fold').length, 1);
});
