import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { conveyorPlacements } from '../src/conveyor-layout.ts';
import { getLevel, LAYOUTS, type EnemyKind } from '../src/levels.ts';
import { testCheckpoint, conveyorsTestFromUrl } from '../src/practice.ts';
import { dailyForDate } from '../src/daily.ts';
import { hazardBounds } from '../src/hazard-layouts.ts';
import { loadCheckpoint, getGun } from '../src/rules.ts';
const { Body, Bodies, Composite } = Matter;
const base = 'https://caleb-guyer.github.io/recoil-foundry/';
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1800, y: 720 },
};
function step(g: Game, frames = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < frames; i++) g.tick(1 / 60, { ...idle, ...input });
}
function fixture(speed = 2) {
  const g = new Game();
  g.start('belt-fixture');
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  g.hazards.clear();
  g.breaches.clear();
  g.conveyors.clear();
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.level.solids = [];
  g.conveyors.items = [{ x: 300, y: 740, w: 1400, speed }];
  Body.setPosition(g.player, { x: 500, y: 722 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  return g;
}
const bounds = (b: Matter.Body) => ({
  left: Math.min(...b.vertices.map((v) => v.x)),
  right: Math.max(...b.vertices.map((v) => v.x)),
  top: Math.min(...b.vertices.map((v) => v.y)),
  bottom: Math.max(...b.vertices.map((v) => v.y)),
});
function wall(g: Game, x: number, y: number, w: number, h: number) {
  const b = Bodies.rectangle(x + w / 2, y + h / 2, w, h, { isStatic: true });
  g.terrain.push(b);
  Composite.add(g.engine.world, b);
  return b;
}
function enemy(g: Game, kind: EnemyKind, x = 900, y = 724) {
  g.spawnEnemy(kind, x, y);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  e.timer = 100;
  return e;
}

test('belts are sparse flush inserts with clear approaches, safe machinery spacing and deterministic entrances', () => {
  const coverage = new Set<string>();
  for (let i = 0; i < 40; i++)
    for (let stage = 0; stage < 20; stage++) {
      const seed = 'belt-layout-' + i,
        g = new Game();
      g.start(seed, testCheckpoint(seed, stage));
      assert(g.conveyors.items.length <= (stage < 8 ? 1 : 2));
      if (stage < 4 || stage % 4 === 3) assert.equal(g.conveyors.items.length, 0);
      const snapshot = structuredClone(g.conveyors.items);
      g.conveyors.reset();
      assert.deepEqual(g.conveyors.items, snapshot);
      for (const b of snapshot) {
        coverage.add(g.level.area + ':' + g.level.mirrored);
        assert(b.w >= 180 && b.w <= 320);
        assert(b.x >= 260 && b.x + b.w <= 1740);
        assert.equal(Math.abs(b.speed), stage === 4 ? 1.7 : stage < 8 ? 2 : stage < 12 ? 2.6 : 3.2);
        const support = [{ x: 0, y: 740, w: 2000 }, ...g.level.solids].find(
          (s) => s.y === b.y && b.x >= s.x + 32 && b.x + b.w <= s.x + s.w - 32,
        );
        assert(support, 'ordinary platform remains on both ends');
        const clear = { x: b.x - 44, y: b.y - 100, w: b.w + 88, h: 100 };
        for (const s of [
          ...g.level.solids,
          ...(g.level.coolant ?? []),
          ...g.hazards.items.map((h) => hazardBounds(h.placement, 44)),
        ]) {
          assert(
            !(
              clear.x < s.x + s.w &&
              clear.x + clear.w > s.x &&
              clear.y < s.y + s.h &&
              clear.y + clear.h > s.y
            ),
            'clear belt approach',
          );
        }
      }
    }
  assert.equal(coverage.size, 6);
});

test('canonical belt placement mirrors position and direction without mutating layouts or run RNG', () => {
  for (const source of LAYOUTS.filter((l) => l.area === 'furnace')) {
    const normal = { ...structuredClone(source), mirrored: false, boss: false };
    const mirrored = {
      ...structuredClone(source),
      mirrored: true,
      boss: false,
      solids: source.solids.map((s) => ({ ...s, x: 2000 - s.x - s.w })),
    };
    const before = JSON.stringify([normal, mirrored]);
    const a = conveyorPlacements(normal, 'mirror-belts', 4);
    const b = conveyorPlacements(mirrored, 'mirror-belts', 4);
    assert.deepEqual(
      b,
      a.map((c) => ({ ...c, x: 2000 - c.x - c.w, speed: -c.speed })),
    );
    assert.equal(JSON.stringify([normal, mirrored]), before);
    assert.deepEqual(conveyorPlacements({ ...normal, detour: true }, 'x', 4), []);
  }
});

test('idle player rides both directions at bounded belt speed and can run against it', () => {
  for (const sign of [-1, 1]) {
    const g = fixture(sign * 3.2);
    Body.setPosition(g.player, { x: 1000, y: 722 });
    step(g, 90);
    assert((g.player.position.x - 1000) * sign > 230);
    assert(Math.abs(g.player.velocity.x - sign * 3.2) < 0.15);
    const start = g.player.position.x;
    step(g, 45, sign === 1 ? { left: true } : { right: true });
    assert((g.player.position.x - start) * sign < -90, 'walking wins against the fastest belt');
    assert(g.grounded);
  }
});

test('jump inherits belt momentum while airborne recoil stays fully effective', () => {
  const a = fixture(3.2),
    b = fixture(3.2);
  step(a, 30);
  step(b, 30);
  step(a, 1, { jump: true });
  step(b, 1, { jump: true });
  assert(!a.grounded && a.player.velocity.y < -10);
  assert(a.player.velocity.x > 3);
  b.conveyors.clear();
  step(a, 10);
  step(b, 10);
  assert(Math.abs(a.player.position.x - b.player.position.x) < 0.001, 'no midair conveyor force');
  a.aim = { x: a.player.position.x, y: 840 };
  const vy = a.player.velocity.y;
  a.fire();
  assert(a.player.velocity.y < vy - a.gun.recoil * 0.95);
});

test('ground recoil is retained instead of overwritten by the conveyor drive', () => {
  const g = fixture(2);
  step(g, 30);
  const vx = g.player.velocity.x;
  step(g, 1, { fire: true, aim: { x: 0, y: g.player.position.y } });
  assert(g.player.velocity.x > vx + g.gun.recoil * 0.15);
});

test('crates, unlit canisters, loose cargo and a player on stacked cover ride together', () => {
  const g = fixture();
  Body.setPosition(g.player, { x: 500, y: 634 });
  const lower = g.props.spawn('crate', 500, 718),
    upper = g.props.spawn('crate', 500, 674);
  const fuel = g.props.spawn('canister', 900, 721),
    cargo = g.props.spawn('cargo', 1300, 712);
  step(g, 75);
  for (const [body, start] of [
    [g.player, 500],
    [lower.body, 500],
    [upper.body, 500],
    [fuel.body, 900],
    [cargo.body, 1300],
  ] as const)
    assert(body.position.x - start > 110);
  assert(Math.abs(g.player.position.x - lower.body.position.x) < 9);
  assert.equal(fuel.armedAt, Infinity);
  assert(g.props.items.includes(fuel));
  assert.equal(g.hp, 100);
  assert.equal(lower.hp, lower.maxHp);
});

test('belts do not drag airborne bodies, fixed panels or hanging cargo', () => {
  const g = fixture(),
    panel = g.props.spawn('cover', 900, 698);
  const load = g.cargo.spawn({ x: 1250, y: 450, anchorY: 110 });
  Body.setPosition(g.player, { x: 500, y: 300 });
  const flyer = enemy(g, 'flyer', 1100, 300);
  g.updateEnemy = () => {};
  step(g, 10);
  assert.equal(g.player.position.x, 500);
  assert.equal(flyer.body.position.x, 1100);
  assert.equal(panel.body.position.x, 900);
  assert.equal(load.body.position.x, 1250);
});

test('all grounded ordinary enemy hulls are carried without bypassing physics or their spawn warning', () => {
  for (const kind of ['runner', 'charger', 'hopper', 'shooter', 'sniper'] as const) {
    const g = fixture(),
      e = enemy(g, kind);
    g.updateEnemy = () => {};
    step(g, 50);
    assert(e.body.position.x > 970, kind);
    assert(!e.body.isStatic);
    assert.equal(e.hp, e.maxHp);
  }
  const g = fixture(),
    e = enemy(g, 'shooter');
  e.spawn = 0.65;
  step(g, 20);
  assert.equal(e.body.position.x, 900);
  assert(e.body.isStatic);
  step(g, 35);
  assert(e.body.position.x > 910);
  assert(!e.body.isStatic);
});

test('real runner AI gains belt motion and a carried sniper retains its full warning and locked aim', () => {
  const a = fixture(2),
    b = fixture(0);
  Body.setPosition(a.player, { x: 100, y: 722 });
  Body.setPosition(b.player, { x: 100, y: 722 });
  const runnerA = enemy(a, 'runner'),
    runnerB = enemy(b, 'runner');
  step(a, 50);
  step(b, 50);
  assert(runnerA.body.position.x > runnerB.body.position.x + 60);
  const g = fixture(),
    sniper = enemy(g, 'sniper');
  Body.setPosition(g.player, { x: 100, y: 722 });
  sniper.timer = 0;
  step(g);
  assert.equal(sniper.state, 'windup');
  assert(g.shots.length === 0);
  step(g, 40);
  assert(g.shots.length === 0);
  const aim = { ...sniper.aim };
  Body.setPosition(g.player, { x: 300, y: 300 });
  step(g, 5);
  assert.deepEqual(sniper.aim, aim);
  assert(sniper.body.position.x > 945);
});

test('fast belts stop player and loose cover against walls without tunneling or reverse kicks', () => {
  for (const sign of [-1, 1]) {
    const g = fixture(3.2 * sign);
    const wallX = sign > 0 ? 760 : 300;
    wall(g, wallX, 540, 30, 200);
    Body.setPosition(g.player, { x: sign > 0 ? 700 : 390, y: 722 });
    step(g, 90);
    const b = bounds(g.player);
    assert(sign > 0 ? b.right < wallX + 1 : b.left > wallX + 29);
    assert(Math.abs(g.player.velocity.x) < 0.1);
    const x = g.player.position.x;
    step(g, 30, sign > 0 ? { left: true } : { right: true });
    assert((g.player.position.x - x) * sign < -50);
  }
  const g = fixture(3.2);
  Body.setPosition(g.player, { x: 100, y: 722 });
  wall(g, 900, 500, 30, 240);
  const crate = g.props.spawn('crate', 800, 718);
  step(g, 160);
  assert(bounds(crate.body).right < 901);
  assert(g.props.items.includes(crate));
});

test('raised belts leave a safe stationary ledge and dislodged gun emplacements fall and land physically', () => {
  const g = fixture(3.2);
  g.conveyors.items = [{ x: 500, y: 500, w: 240, speed: 3.2 }];
  wall(g, 470, 500, 300, 22);
  const sniper = enemy(g, 'sniper', 720, 484);
  g.updateEnemy = () => {};
  Body.setPosition(g.player, { x: 100, y: 722 });
  step(g, 150);
  assert(!sniper.body.isStatic);
  assert(sniper.body.position.x > 750);
  assert(sniper.body.position.y < 490);
  Body.setVelocity(sniper.body, { x: 10, y: -2 });
  step(g, 90);
  assert(sniper.body.position.y > 700 && sniper.body.position.y < 726);
});

test('pause and hitstop freeze transport and room reload clears belt momentum', () => {
  const g = fixture();
  step(g, 30);
  const p = { ...g.player.position },
    time = g.time;
  g.setMode('paused');
  step(g, 60);
  assert.deepEqual(g.player.position, p);
  assert.equal(g.time, time);
  g.setMode('playing');
  g.hitStop = 0.2;
  step(g, 6);
  assert.deepEqual(g.player.position, p);
  g.start('fresh-room');
  assert.deepEqual(g.conveyors.items, []);
  step(g, 30);
  assert.equal(g.player.position.x, 140);
});

test('belt motion cannot accumulate into damaging cargo speed, and ordinary friction returns off the belt', () => {
  const g = fixture(3.2);
  Body.setPosition(g.player, { x: 100, y: 722 });
  const crate = g.props.spawn('crate', 400, 718),
    fuel = g.props.spawn('canister', 700, 721);
  for (let i = 0; i < 150; i++) {
    step(g);
    assert(Math.abs(crate.body.velocity.x) <= 3.3);
    assert(Math.abs(fuel.body.velocity.x) <= 3.3);
    assert.equal(crate.body.friction, 0.35);
    assert.equal(fuel.armedAt, Infinity);
  }
  Body.setPosition(crate.body, { x: 1800, y: 718 });
  step(g, 30);
  assert(Math.abs(crate.body.velocity.x) < 0.3);
});

test('belt-driven player, fuel and enemy travel through a wall portal with no remote belt pull', () => {
  for (const kind of ['player', 'fuel', 'enemy']) {
    const g = fixture(3.2);
    g.conveyors.items = [{ x: 300, y: 740, w: 500, speed: 3.2 }];
    wall(g, 800, 100, 40, 640);
    wall(g, 1200, 100, 40, 640);
    g.mods = ['fold'];
    g.gun = getGun(g.mods);
    assert(g.portals.place({ x: 800, y: 700 }));
    assert(g.portals.place({ x: 1240, y: 700 }));
    Body.setPosition(g.player, { x: kind === 'player' ? 750 : 100, y: 722 });
    const fuel = kind === 'fuel' ? g.props.spawn('canister', 750, 721) : undefined;
    const e = kind === 'enemy' ? enemy(g, 'runner', 750) : undefined;
    const b = fuel?.body ?? e?.body ?? g.player;
    g.updateEnemy = () => {};
    let traveled = false;
    for (let i = 0; i < 90; i++) {
      step(g);
      if (b.position.x > 1240) {
        traveled = true;
        break;
      }
    }
    assert(traveled, kind);
    assert(b.velocity.x > 0);
    const x = b.position.x;
    step(g, 30);
    assert(b.position.x >= x);
    if (fuel) assert.equal(fuel.armedAt, Infinity);
  }
});

test('Continue and Daily recreate the same belts independently of combat RNG', () => {
  for (const seed of ['belt-continue', dailyForDate('2026-09-08')!.seed]) {
    const checkpoint = testCheckpoint(seed, 6),
      a = new Game(),
      b = new Game();
    a.start(seed, checkpoint);
    for (let i = 0; i < 100; i++) a.rng();
    b.start(seed, loadCheckpoint(JSON.parse(JSON.stringify(checkpoint)))!);
    assert.deepEqual(a.conveyors.items, b.conveyors.items);
    assert.deepEqual(a.waves.doors, b.waves.doors);
    const state = structuredClone(a.conveyors.items);
    step(a, 20);
    a.loadRoom();
    assert.deepEqual(a.conveyors.items, state);
  }
});

test('conveyor playtests contain belts, retry safely and reject ambiguous modes', () => {
  for (const area of ['furnace', 'rooftops']) {
    const save = conveyorsTestFromUrl(new URL('?test=conveyors&area=' + area, base))!;
    assert(save);
    const g = new Game();
    let writes = 0;
    g.onCheckpoint = () => {
      writes++;
    };
    g.startTest(save);
    assert(g.conveyors.items.length > 0);
    const belts = structuredClone(g.conveyors.items);
    step(g, 30);
    g.startTest(g.testRun!);
    assert.deepEqual(g.conveyors.items, belts);
    assert.equal(writes, 0);
    assert.equal(g.hp, 100);
    assert.deepEqual(g.gun, getGun(save.mods));
  }
  for (const q of [
    '?test=conveyors&test=conveyors',
    '?test=conveyors&area=cooling',
    '?test=conveyors&area=furnace&area=rooftops',
    '?test=conveyors&daily=x',
    '?test=conveyors&dv=27',
    '?test=conveyors&seed=x',
    '?test=conveyors&formation=shield',
  ])
    assert.equal(conveyorsTestFromUrl(new URL(q, base)), null);
});
