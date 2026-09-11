import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { getLevel } from '../src/levels.ts';
import { getGun } from '../src/rules.ts';
import { SCRAPPER_GRAB, SCRAPPER_TELL, SCRAPPER_STUN, SCRAPPER_DAMAGE } from '../src/scrapper.ts';
import { propPlacements } from '../src/props.ts';
import { scrapperTestFromUrl, testCheckpoint } from '../src/practice.ts';
import { dailyForDate } from '../src/daily.ts';
const { Body, Bodies, Composite, Query } = Matter;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1000, y: 700 },
};
function step(g: Game, n = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < n; i++) g.tick(1 / 60, { ...idle, ...input });
}
function until(g: Game, condition: () => boolean, limit = 240) {
  for (let i = 0; i < limit && !condition(); i++) step(g);
  assert(
    condition(),
    JSON.stringify({
      time: g.time,
      hp: g.hp,
      enemies: g.enemies.map((e) => ({
        kind: e.kind,
        state: e.state,
        timer: e.timer,
        p: e.body.position,
        phase: e.scrapper?.phase,
        held: e.scrapper?.held?.body.position,
        attacks: e.attacks,
      })),
    }),
  );
}
function fixture(side = -1) {
  const g = new Game();
  g.start('scrapper-fixture');
  g.hazards.clear();
  g.breaches.clear();
  g.waves.clear();
  g.conveyors.clear();
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.stage = 8;
  g.mods = [];
  g.gun = getGun([]);
  Body.setPosition(g.player, { x: 1000 + side * 500, y: 722 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  g.spawnEnemy('scrapper', 1000, 724);
  const e = g.enemies[0];
  e.spawn = 0;
  e.timer = 0;
  const crate = g.props.spawn('crate', 1000 + side * 110, 717);
  return { g, e, crate };
}

test('Scrapper placement is sparse, deterministic, keeps elites and roster counts, and reserves one usable crate', () => {
  let count = 0;
  for (let i = 0; i < 160; i++)
    for (let stage = 0; stage < 20; stage++) {
      const seed = 'scrap-placement-' + i,
        level = getLevel(seed, stage);
      const scrap = level.spawns.filter((s) => s.kind === 'scrapper');
      assert(scrap.length <= 1);
      if (!scrap.length) {
        assert(!level.scrapperCrate);
        continue;
      }
      count++;
      assert([8, 9, 16, 17].includes(stage));
      assert(!scrap[0].elite && !level.boss);
      assert.deepEqual(level, getLevel(seed, stage));
      const placed = propPlacements(level, seed).filter((p) => p.kind === 'crate');
      assert.equal(placed.length, 1);
      assert.deepEqual({ x: placed[0].x, y: placed[0].y }, level.scrapperCrate);
      const g = new Game();
      g.stage = stage;
      g.seed = seed;
      g.loadRoom();
      const crate = g.props.items.find((p) => p.kind === 'crate');
      assert(crate, seed + ':' + stage);
      assert.equal(Query.collides(crate.body, g.terrainBodies).length, 0);
    }
  assert(count > 40 && count < 400, String(count));
});

test('a real grab lifts the existing crate, locks the target, gives a full tell and commits the throw in both directions', () => {
  for (const side of [-1, 1]) {
    const { g, e, crate } = fixture(side);
    const original = { ...crate.body.position };
    step(g);
    assert.equal(e.state, 'windup');
    assert.equal(e.scrapper!.held, crate);
    assert.equal(Composite.allConstraints(g.engine.world).length, 1);
    assert(!crate.body.isStatic);
    const began = g.time;
    until(g, () => e.scrapper!.phase === 'aim');
    assert(g.time - began >= SCRAPPER_GRAB - 1 / 60 - 0.001);
    assert(crate.body.position.y < original.y - 35);
    const aim = { ...e.target },
      velocity = { ...e.scrapper!.velocity },
      locked = g.time;
    Body.setPosition(g.player, { x: 1000 + side * 700, y: 500 });
    step(g, Math.floor(SCRAPPER_TELL * 60) - 2);
    assert.equal(e.attacks, 0);
    assert.deepEqual(e.target, aim);
    assert.deepEqual(e.scrapper!.velocity, velocity);
    until(g, () => e.attacks === 1);
    assert(g.time - locked >= SCRAPPER_TELL - 1 / 60 - 0.001);
    assert.equal(e.scrapper!.held, null);
    assert.equal(Composite.allConstraints(g.engine.world).length, 0);
    assert(g.props.items.includes(crate));
    assert.equal(g.props.items.length, 1);
    assert(Math.sign(crate.body.velocity.x) === side);
    assert((crate.throwUntil ?? 0) > g.time);
  }
});

test('a committed crate physically hits a stationary player once, while an ordinary crate remains harmless', () => {
  const { g, e, crate } = fixture();
  until(g, () => e.attacks === 1);
  until(g, () => g.hp < 100, 90);
  assert.equal(g.hp, 100 - SCRAPPER_DAMAGE);
  assert.equal(crate.throwUntil, 0);
  assert(g.player.position.x < e.body.position.x - 200);
  const other = fixture();
  Body.setPosition(other.crate.body, { x: 540, y: 722 });
  Body.setVelocity(other.crate.body, { x: -14, y: 0 });
  other.g.updateEnemy = () => {};
  step(other.g, 10);
  assert.equal(other.g.hp, 100);
});

test('shooting the held crate releases it immediately and stuns the Scrapper without cancelling the bullet impulse', () => {
  for (const phase of ['lift', 'aim']) {
    const { g, e, crate } = fixture();
    step(g);
    if (phase === 'aim') until(g, () => e.scrapper!.phase === 'aim');
    const before = crate.body.velocity.x;
    g.props.hit(crate, 24, { x: -1, y: 0 });
    assert.equal(e.scrapper!.held, null);
    assert.equal(e.state, 'recover');
    assert.equal(e.timer, SCRAPPER_STUN);
    assert.equal(Composite.allConstraints(g.engine.world).length, 0);
    assert.equal(crate.hp, 96);
    assert(crate.body.velocity.x < before - 6);
    step(g, 40);
    assert.equal(e.attacks, 0);
  }
});

test('destroying a held crate or killing its owner releases the tether exactly once', () => {
  for (const target of ['crate', 'enemy']) {
    const { g, e, crate } = fixture();
    step(g);
    if (target === 'crate') g.props.hit(crate, 999, { x: -1, y: 0 });
    else g.hitEnemy(e, 999);
    assert.equal(e.scrapper!.held, null);
    assert.equal(Composite.allConstraints(g.engine.world).length, 0);
    assert.equal(g.props.items.includes(crate), target === 'enemy');
    assert.equal(g.enemies.includes(e), target === 'crate');
  }
});

test('pause and hitstop freeze the lift and locked windup; death and retry clear the grip', () => {
  const { g, e, crate } = fixture();
  until(g, () => e.scrapper!.phase === 'aim');
  const snapshot = () =>
    JSON.stringify({ p: crate.body.position, timer: e.timer, time: g.time, attacks: e.attacks });
  const before = snapshot();
  g.setMode('paused');
  step(g, 120);
  assert.equal(snapshot(), before);
  g.setMode('playing');
  g.hitStop = 0.2;
  step(g, 6);
  assert.equal(snapshot(), before);
  g.setMode('dead');
  assert.equal(Composite.allConstraints(g.engine.world).length, 0);
  assert.equal(e.scrapper!.held, null);
  g.loadRoom();
  assert.equal(Composite.allConstraints(g.engine.world).length, 0);
});

test('walls and supported actors prevent pulling a crate through solid geometry or stealing a player platform', () => {
  for (const obstacle of ['wall', 'player']) {
    const { g, e, crate } = fixture();
    if (obstacle === 'wall') {
      const wall = Bodies.rectangle(917, 680, 12, 120, { isStatic: true });
      g.terrain.push(wall);
      Composite.add(g.engine.world, wall);
    } else {
      Body.setPosition(g.player, { x: crate.body.position.x, y: crate.body.position.y - 40 });
    }
    step(g);
    assert.equal(e.scrapper!.held, null);
    assert.equal(Composite.allConstraints(g.engine.world).length, 0);
  }
});

test('moving after the aim lock dodges the committed throw with ordinary input', () => {
  const { g, e } = fixture();
  until(g, () => e.scrapper!.phase === 'aim');
  const target = { ...e.target };
  step(g, 100, { left: true });
  assert(e.attacks >= 1);
  assert(g.player.position.x < target.x - 200);
  assert.equal(g.hp, 100);
});

test('real gunfire into the held crate interrupts the attack; stunned contact is harmless', () => {
  const { g, e, crate } = fixture();
  until(g, () => e.scrapper!.phase === 'aim');
  const aim = { ...crate.body.position };
  for (let i = 0; i < 45 && e.scrapper!.held; i++) step(g, 1, { fire: true, aim });
  assert.equal(e.scrapper!.held, null);
  assert.equal(e.state, 'recover');
  assert.equal(e.attacks, 0);
  assert(crate.hp < crate.maxHp);
  Body.setPosition(g.player, { ...e.body.position });
  step(g);
  assert.equal(g.hp, 100);
});

test('thrown crates hit cover and other enemies, ignite fuel, and cannot reach a player behind a wall', () => {
  for (const target of ['wall', 'enemy', 'crate', 'cover', 'fuel']) {
    const { g, e, crate } = fixture();
    until(g, () => e.attacks === 1);
    const x = crate.body.position.x - 100,
      y = crate.body.position.y - 12;
    let victim: ReturnType<Game['props']['spawn']> | undefined;
    let enemy: typeof e | undefined;
    if (target === 'wall') {
      const wall = Bodies.rectangle(x, 600, 14, 280, { isStatic: true });
      g.terrain.push(wall);
      Composite.add(g.engine.world, wall);
    } else if (target === 'enemy') {
      g.spawnEnemy('shooter', x, y);
      enemy = g.enemies.at(-1)!;
      enemy.spawn = 0;
      enemy.timer = 100;
    } else {
      victim = g.props.spawn(target === 'fuel' ? 'canister' : (target as 'crate' | 'cover'), x, y);
    }
    step(g, 25);
    if (target === 'wall') {
      assert(crate.body.position.x > x);
      assert.equal(g.hp, 100);
    } else if (enemy) assert(enemy.hp < enemy.maxHp);
    else if (target === 'fuel') assert(!g.props.items.includes(victim!));
    else assert(victim!.hp < victim!.maxHp);
  }
});

test('portal travel of either held body breaks the grip before the constraint can pull across the room', () => {
  for (const who of ['crate', 'scrapper']) {
    const { g, e, crate } = fixture();
    until(g, () => e.scrapper!.phase === 'aim');
    const body = who === 'crate' ? crate.body : e.body;
    const walls = [
      Bodies.rectangle(620, 400, 40, 600, { isStatic: true }),
      Bodies.rectangle(1220, 400, 40, 600, { isStatic: true }),
    ];
    g.terrain.push(...walls);
    Composite.add(g.engine.world, walls);
    g.mods = ['fold'];
    g.gun = getGun(g.mods);
    assert(g.portals.place({ x: 600, y: 400 }));
    assert(g.portals.place({ x: 1240, y: 400 }));
    Body.setPosition(body, { x: 560, y: 400 });
    Body.setVelocity(body, { x: 18, y: 0 });
    g.updateEnemy = () => {};
    // Remove spring force only for this isolated portal transport fixture.
    e.scrapper!.tether!.stiffness = 0;
    step(g, 10);
    assert(body.position.x > 1240, who);
    assert.equal(e.scrapper!.held, null);
    assert.equal(e.state, 'recover');
    assert.equal(Composite.allConstraints(g.engine.world).length, 0);
    assert.equal(e.attacks, 0);
  }
});

test('thrown crates keep their physical velocity and danger through a portal', () => {
  const { g, e, crate } = fixture(1);
  until(g, () => e.attacks === 1);
  const walls = [
    Bodies.rectangle(620, 400, 40, 600, { isStatic: true }),
    Bodies.rectangle(1220, 400, 40, 600, { isStatic: true }),
  ];
  g.terrain.push(...walls);
  Composite.add(g.engine.world, walls);
  g.mods = ['fold'];
  g.gun = getGun(g.mods);
  assert(g.portals.place({ x: 600, y: 400 }));
  assert(g.portals.place({ x: 1240, y: 400 }));
  Body.setPosition(crate.body, { x: 560, y: 400 });
  Body.setVelocity(crate.body, { x: 17, y: 0 });
  Body.setPosition(g.player, { x: 1330, y: 400 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  g.updateEnemy = () => {};
  step(g, 12);
  assert(crate.body.position.x > 1240);
  assert.equal(g.hp, 100 - SCRAPPER_DAMAGE);
});

test('only loose unoccupied crates can be grabbed, and two Scrappers cannot own the same crate', () => {
  const { g, e, crate } = fixture();
  g.spawnEnemy('scrapper', 1040, 724);
  const other = g.enemies.at(-1)!;
  other.spawn = 0;
  other.timer = 0;
  step(g);
  assert.equal(g.enemies.filter((enemy) => enemy.scrapper?.held === crate).length, 1);
  assert.equal(Composite.allConstraints(g.engine.world).length, 1);
  g.props.remove(crate);
  g.props.spawn('canister', 890, 720);
  g.props.spawn('cover', 1120, 698);
  g.cargo.spawn({ x: 850, y: 530, anchorY: 380 });
  step(g, 180);
  assert(!e.scrapper!.held && !other.scrapper!.held);
  assert.equal(Composite.allConstraints(g.engine.world).length, 0);
  assert.equal(e.attacks + other.attacks, 0);
});

test('Scrapper test links retry safely and normal and Daily entrances reconstruct the same fresh crate', () => {
  const base = 'https://caleb-guyer.github.io/recoil-foundry/';
  for (const area of ['cooling', 'rooftops']) {
    const save = scrapperTestFromUrl(new URL('?test=scrapper&area=' + area, base))!;
    assert(save);
    const g = new Game();
    let writes = 0;
    g.onCheckpoint = () => writes++;
    g.startTest(save);
    assert(g.level.spawns.some((s) => s.kind === 'scrapper'));
    assert.equal(
      g.enemies.filter((e) => e.kind === 'scrapper').length +
        g.waves.doors.filter((d) => d.spawn.kind === 'scrapper').length,
      1,
    );
    const crate = g.props.items.find((p) => p.kind === 'crate')!;
    g.props.hit(crate, 90, { x: 1, y: 0 });
    step(g, 30);
    g.startTest(g.testRun!);
    assert.equal(writes, 0);
    assert.equal(g.hp, 100);
    assert.equal(g.props.items.find((p) => p.kind === 'crate')!.hp, 120);
    assert.equal(Composite.allConstraints(g.engine.world).length, 0);
  }
  for (const query of [
    '?test=scrapper&test=scrapper',
    '?test=scrapper&daily=x',
    '?test=scrapper&seed=x',
    '?test=scrapper&dv=29',
    '?test=scrapper&area=docks',
    '?test=scrapper&area=cooling&area=cooling',
    '?test=scrapper&formation=shield',
  ])
    assert.equal(scrapperTestFromUrl(new URL(query, base)), null);
  const daily = Array.from(
    { length: 28 },
    (_, i) => dailyForDate('2026-09-' + String(i + 1).padStart(2, '0'))!.seed,
  ).find((seed) => getLevel(seed, 8).scrapperCrate)!;
  assert(daily);
  for (const seed of ['SCRAPPER-8-10', daily]) {
    const save = testCheckpoint(seed, 8),
      a = new Game(),
      b = new Game();
    a.start(seed, save);
    b.start(seed, structuredClone(save));
    assert.deepEqual(a.level, b.level);
    assert.deepEqual(a.waves.doors, b.waves.doors);
    assert.deepEqual(
      a.props.items.map((p) => [p.kind, p.body.position, p.hp]),
      b.props.items.map((p) => [p.kind, p.body.position, p.hp]),
    );
  }
});

test('authored Cooling Works and rooftop rooms support real grabs and throws after normal reinforcement entry', () => {
  for (const [seed, stage] of [
    ['SCRAPPER-8-10', 8],
    ['SCRAPPER-8-5', 8],
    ['SCRAPPER-12-26', 16],
  ] as const) {
    const g = new Game();
    g.startTest(testCheckpoint(seed, stage));
    let attacks = 0;
    for (let i = 0; i < 600 && !attacks; i++) {
      for (const e of [...g.enemies]) if (e.kind !== 'scrapper') g.hitEnemy(e, 99999);
      step(g);
      attacks = g.enemies.find((e) => e.kind === 'scrapper')?.attacks ?? 0;
    }
    assert.equal(attacks, 1, seed);
    const thrown = g.props.items.find((p) => (p.throwUntil ?? 0) > g.time);
    assert(thrown, seed);
    assert.equal(thrown.hp, 120);
  }
});
