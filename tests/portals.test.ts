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
  assert(g.portals.place({ x: 600, y: 740 }));
  assert(g.portals.place({ x: 1100, y: 740 }));
  assert(!g.portals.canPlace);
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
  assert(g.portals.canPlace);
});
test('invalid surfaces and overlapping openings never spend either placement', () => {
  const g = fixture();
  wall(g, 800, 400, 40, 40);
  wall(g, 1200, 710, 200, 60);
  g.props.spawn('crate', 1500, 690);
  assert(!g.portals.candidate({ x: 780, y: 400 }), 'short face accepted');
  assert(!g.portals.candidate({ x: 1200, y: 740 }), 'buried floor accepted');
  assert(!g.portals.candidate({ x: 1500, y: 668 }), 'prop accepted');
  assert(!g.portals.candidate({ x: NaN, y: 740 }));
  assert(!g.portals.place({ x: 300, y: 300 }));
  assert.equal(g.portals.next, 0);
  assert(g.portals.place({ x: 600, y: 740 }));
  assert(!g.portals.linked);
  const blue = g.portals.pair[0];
  assert(!g.portals.place({ x: 620, y: 740 }));
  assert.equal(g.portals.pair[0], blue);
  assert.equal(g.portals.next, 1);
  assert(g.portals.canPlace);
  assert(g.portals.place({ x: 1000, y: 745 }));
  assert(g.portals.linked);
  assert.equal(g.portals.next, 2);
  assert(!g.portals.canPlace);
});

test('a completed pair cannot be moved by repeated placement requests, pause, or a blocked exit', () => {
  const g = fixture();
  assert(g.portals.place({ x: 600, y: 740 }));
  assert(g.portals.place({ x: 1100, y: 740 }));
  const pair = [...g.portals.pair];
  const sounds: string[] = [];
  g.onSound = (sound) => sounds.push(sound);
  for (const point of [
    { x: 1400, y: 740 },
    { x: 0, y: 400 },
    { x: 1200, y: 0 },
  ]) {
    assert.equal(g.portals.candidate(point), null, 'Spent placement still offered a preview');
    assert(!g.portals.place(point));
    assert.deepEqual(g.portals.pair, pair);
  }
  assert.deepEqual(sounds, ['portal-denied', 'portal-denied', 'portal-denied']);
  assert.equal(g.portals.next, 2);
  g.hitStop = 0.03;
  step(g, { portal: { x: 1500, y: 740 } });
  step(g);
  step(g);
  g.setMode('paused');
  g.setMode('playing');
  step(g, { portal: { x: 1700, y: 740 } });
  g.props.spawn('crate', 1100, 718);
  assert(!g.portals.place({ x: 1800, y: 740 }));
  assert.deepEqual(g.portals.pair, pair);
  assert(!g.portals.canPlace);
});

test('leaving a cleared room restores one fresh pair and keeps Fold equipped', () => {
  const g = fixture();
  g.portals.place({ x: 600, y: 740 });
  g.portals.place({ x: 1100, y: 740 });
  assert(!g.portals.canPlace);
  step(g);
  assert(g.clear);
  g.openReward();
  g.chooseMod(g.offers[0].id);
  assert.equal(g.stage, 1);
  assert(g.portals.equipped && g.portals.canPlace);
  assert.deepEqual(g.portals.pair, [null, null]);
  assert.equal(g.portals.next, 0);
  assert(g.portals.place({ x: 100, y: 740 }));
  assert.equal(g.portals.next, 1);
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
  assert(!g.portals.canPlace, 'Teleporting refunded placement');
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
test('normal walking enters wall portals under gravity, in both directions and on raised floors', () => {
  for (const floor of [740, 500])
    for (const sign of [-1, 1])
      for (const exit of ['floor', 'wall']) {
        const g = fixture();
        g.engine.gravity.y = 1;
        g.player.frictionAir = 0.008;
        if (floor < 740) wall(g, 1000, floor + 20, 2000, 40);
        wall(g, 800, floor - 150, 40, 300);
        wall(g, 1200, floor - 150, 40, 300);
        assert(g.portals.place({ x: 800 - sign * 20, y: floor - 5 }));
        assert(
          g.portals.place(
            exit === 'floor'
              ? { x: sign > 0 ? 1400 : 400, y: floor }
              : { x: 1200 + sign * 20, y: floor - 5 },
          ),
        );
        Body.setPosition(g.player, { x: sign > 0 ? 600 : 1000, y: floor - 60 });
        for (let i = 0; i < 90; i++) step(g);
        assert(g.grounded, 'the walking test must start on its support');
        for (let i = 0; i < 90 && !g.portals.revision; i++)
          step(g, { left: sign < 0, right: sign > 0 });
        assert.equal(g.portals.revision, 1, `${floor}, ${sign}, ${exit}`);
        assert.equal(g.hp, 100);
        assert(g.player.position.y + bodyHalf(g.player).y <= floor + 0.06);
      }
});

test('linking the second portal while already pushing against the first wall lets the player through', () => {
  const g = fixture();
  g.engine.gravity.y = 1;
  g.player.frictionAir = 0.008;
  wall(g);
  g.portals.place({ x: 780, y: 735 });
  Body.setPosition(g.player, { x: 700, y: 700 });
  for (let i = 0; i < 90; i++) step(g, { right: true });
  assert.equal(g.portals.revision, 0);
  assert(g.grounded);
  assert(Math.abs(g.player.position.x - 767) < 0.1);
  g.portals.place({ x: 1100, y: 740 });
  for (let i = 0; i < 10 && !g.portals.revision; i++) step(g, { right: true });
  assert.equal(g.portals.revision, 1);
});

test('walking enemies also pass wall portals while resting on the floor', () => {
  const g = fixture();
  g.engine.gravity.y = 1;
  wall(g);
  wall(g, 1200);
  g.portals.place({ x: 780, y: 735 });
  g.portals.place({ x: 1220, y: 735 });
  Body.setPosition(g.player, { x: 1600, y: 700 });
  g.spawnEnemy('runner', 720, 700);
  const enemy = g.enemies.at(-1)!;
  enemy.spawn = 0;
  enemy.timer = 100;
  for (let i = 0; i < 180 && enemy.body.position.x < 1200; i++) step(g);
  assert(enemy.body.position.x > 1200);
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
    assert.equal(g.portals.traceBody(from, to, g.player), null, kind);
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
  assert(g.portals.canPlace);
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
