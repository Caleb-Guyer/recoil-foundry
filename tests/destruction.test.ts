import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import {
  getLevel,
  LAYOUTS,
  BOSS_LAYOUTS,
  SPECIAL_LAYOUTS,
  type Level,
  type Solid,
} from '../src/levels.ts';
import { getRouteLevel } from '../src/route-layouts.ts';
import { breakableSolids } from '../src/destruction-layout.ts';
import { WALL_HP, LEDGE_HP, RUBBLE_LIFE, RUBBLE_LIMIT } from '../src/destruction.ts';
import { destructionTestFromUrl, testCheckpoint } from '../src/practice.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { getGun, loadCheckpoint, type Vec } from '../src/rules.ts';
import { dailyForDate } from '../src/daily.ts';
import { rivalCharge, updateArsenal } from '../src/interceptor-weapons.ts';

const { Body, Bodies, Composite, Engine, Query } = Matter;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1600, y: 400 },
};
function fixture() {
  const g = new Game();
  g.start('destruction-fixture');
  g.hazards.clear();
  g.breaches.clear();
  g.conveyors.clear();
  g.waves.clear();
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.destruction.clear();
  g.level.solids = [];
  g.level.route = [];
  g.engine.gravity.y = 0;
  Body.setPosition(g.player, { x: 400, y: 400 });
  return g;
}
function piece(g: Game, rect: Solid = { x: 700, y: 350, w: 100, h: 130 }) {
  const b = Bodies.rectangle(rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w, rect.h, {
    isStatic: true,
    friction: 0,
    label: 'terrain',
  });
  Composite.add(g.engine.world, b);
  g.terrain.push(b);
  g.level.solids.push({ ...rect });
  return g.destruction.register(b, rect);
}
function shot(g: Game, damage = 22, extra = {}) {
  g.addShot({
    pos: { x: 650, y: 400 },
    vel: { x: 90, y: 0 },
    damage,
    life: 3,
    radius: 3,
    friendly: true,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
    ...extra,
  });
  const s = g.shots.at(-1)!;
  g.updateShots(1 / 60);
  return s;
}
function physics(g: Game, frames = 1) {
  for (let i = 0; i < frames; i++) {
    g.time += 1 / 60;
    g.props.beforeStep();
    g.destruction.beforeStep();
    Engine.update(g.engine, 1000 / 60);
    g.props.afterStep(1 / 60);
    g.destruction.afterStep(1 / 60);
  }
}

test('normal and hostile rounds chip visible cover; its final impact stays spent', () => {
  for (const friendly of [true, false]) {
    const g = fixture(),
      p = piece(g);
    for (let i = 1; i <= 4; i++) {
      const s = shot(g, 22, { friendly });
      assert.equal(p.hp, WALL_HP - i * 22);
      assert.equal(s.life, 0);
      assert(g.terrain.includes(p.body));
    }
    const s = shot(g, 22, { friendly });
    assert.equal(s.life, 0);
    assert(!g.terrain.includes(p.body));
    assert(!Composite.allBodies(g.engine.world).includes(p.body));
    assert.equal(g.level.solids.length, 0);
    assert.equal(g.destruction.pieces.length, 0);
    const chunks = g.props.items.filter((p) => p.kind === 'rubble').length;
    assert(chunks > 0 && chunks <= 3);
  }
});

test('a breaking wall still consumes a ricochet; piercing never skips solid cover', () => {
  for (const bounces of [0, 1]) {
    const g = fixture(),
      p = piece(g);
    g.spawnEnemy('shooter', 860, 400);
    const e = g.enemies[0];
    e.spawn = 0;
    const s = shot(g, 120, { bounces, pierce: 5 });
    assert(!g.terrain.includes(p.body));
    assert.equal(e.hp, e.maxHp);
    if (bounces) {
      assert(s.vel.x < 0);
      assert.equal(s.bounces, 0);
    } else assert.equal(s.life, 0);
  }
});

test('shooting from a blocked enemy muzzle damages the nearest weak surface', () => {
  const g = fixture(),
    p = piece(g);
  g.spawnEnemy('shooter', 685, 400);
  const e = g.enemies[0];
  e.spawn = 0;
  g.enemyShot(e, 0, 10, 30);
  assert.equal(p.hp, WALL_HP - 30);
  assert.equal(g.shots.length, 0);
});

test('static gunners, their reinforcement replacements and perched cover fall off a broken ledge', () => {
  const g = fixture(),
    p = piece(g, { x: 650, y: 450, w: 280, h: 22 });
  for (const kind of ['shooter', 'sniper'] as const) {
    g.spawnEnemy(kind, kind === 'shooter' ? 690 : 800, 450 - ENEMY_STATS[kind].h / 2);
    g.enemies.at(-1)!.spawn = 0;
  }
  const cover = g.props.spawn('cover', 875, 407);
  g.destruction.hitBody(p.body, LEDGE_HP, { x: 0, y: 1 });
  assert(g.enemies.every((e) => !e.body.isStatic));
  assert(!cover.body.isStatic);
  assert(g.enemies.every((e) => Number.isFinite(e.body.mass)));
  assert(Number.isFinite(cover.body.mass));
  assert(Number.isFinite(cover.body.inertia));
  g.spawnEnemy('shooter', 735, 450 - ENEMY_STATS.shooter.h / 2);
  assert(!g.enemies.at(-1)!.body.isStatic);
  g.engine.gravity.y = 1;
  physics(g, 30);
  assert(g.enemies.every((e) => e.body.position.y > 475));
  assert(cover.body.position.y > 460);
});

for (const kind of ['loader', 'charger'] as const)
  test(`${kind} reaches and destroys cracked cover from either direction`, () => {
    for (const sign of [-1, 1]) {
      const g = fixture();
      g.spawnEnemy(kind, 700, 400);
      const e = g.enemies[0];
      e.spawn = 0;
      e.timer = 10;
      const near = 700 + sign * (ENEMY_STATS[kind].w / 2 + 17);
      const p = piece(g, { x: sign > 0 ? near : near - 60, y: 350, w: 60, h: 130 });
      e.state = 'rush';
      e.aim = { x: sign, y: 0 };
      g.updateEnemy(e, 1 / 60);
      assert.equal(e.state, 'rush');
      assert.equal(p.hp, WALL_HP);
      // The attack sweep performs the impact on the next AI tick, before a
      // collision response can erase its incoming velocity.
      g.props.beforeStep();
      Engine.update(g.engine, 1000 / 60);
      g.props.afterStep(1 / 60);
      g.updateEnemy(e, 1 / 60);
      assert.equal(e.state, 'recover');
      assert(!g.terrain.includes(p.body));
      assert(Math.abs(e.body.position.x - 700) >= 16);
    }
  });

test('Press and Crane slams break the first ledge and recover there', () => {
  for (const kind of ['press', 'crane'] as const) {
    const g = fixture();
    g.spawnEnemy(kind, 700, kind === 'crane' ? 150 : 400);
    const e = g.enemies[0];
    e.spawn = 0;
    e.timer = 10;
    e.state = 'rush';
    e.attack = 'slam';
    const start = { ...(e.crane ? e.crane.head : e.body.position) };
    if (e.crane) e.crane.to = { x: start.x, y: start.y + 200 };
    const p = piece(g, { x: 620, y: start.y + (kind === 'press' ? 31 : 23) + 8, w: 160, h: 22 });
    g.updateEnemy(e, 1 / 60);
    assert(!g.terrain.includes(p.body));
    assert.equal(e.state, 'recover');
    assert(Math.abs((e.crane ? e.crane.head.y : e.body.position.y) - start.y - 8) < 0.2);
  }
});

test('fast crates fracture terrain through real contact, while player landings and gentle pushes are harmless', () => {
  for (const speed of [3, 14]) {
    const g = fixture(),
      p = piece(g);
    const crate = g.props.spawn('crate', 670, 400);
    Body.setVelocity(crate.body, { x: speed, y: 0 });
    physics(g, 12);
    assert.equal(g.destruction.pieces.includes(p), speed === 3);
    if (speed === 3) assert.equal(p.hp, WALL_HP);
  }
  const g = fixture(),
    p = piece(g, { x: 350, y: 450, w: 200, h: 22 });
  Body.setPosition(g.player, { x: 420, y: 415 });
  Body.setVelocity(g.player, { x: 0, y: 18 });
  physics(g, 4);
  assert.equal(p.hp, LEDGE_HP);
});

test('blasts snapshot cover before destruction, so protected enemies and surfaces survive that blast', () => {
  const g = fixture(),
    front = piece(g),
    back = piece(g, { x: 840, y: 350, w: 30, h: 130 });
  g.spawnEnemy('shooter', 825, 400);
  const e = g.enemies[0];
  e.spawn = 0;
  g.demolition.detonate({
    pos: { x: 680, y: 400 },
    damage: 300,
    radius: 240,
    launch: 0,
    kind: 'shell',
  });
  assert(!g.terrain.includes(front.body));
  assert.equal(back.hp, WALL_HP);
  assert.equal(e.hp, e.maxHp);
  for (const p of [...g.props.items]) g.props.remove(p);
  g.demolition.detonate({
    pos: { x: 810, y: 400 },
    damage: 300,
    radius: 100,
    launch: 0,
    kind: 'shell',
  });
  assert(!g.terrain.includes(back.body));
  assert(e.hp < e.maxHp);
});

test('loose cargo applies one material impact, without duplicate contact damage', () => {
  const g = fixture(),
    p = piece(g);
  const load = g.cargo.spawn({ x: 600, y: 400, anchorY: 150 });
  load.cargo!.state = 'loose';
  Body.setStatic(load.body, false);
  const half = (load.body.bounds.max.x - load.body.bounds.min.x) / 2;
  Body.setPosition(load.body, { x: 700 - half - 4, y: 400 });
  Body.setVelocity(load.body, { x: 8, y: 0 });
  physics(g, 2);
  assert(p.hp > 30 && p.hp < 50, 'one medium cargo impact should chip, not destroy the wall');
  assert(load.cargo!.hits.has(p.body.id));
  const hp = p.hp;
  physics(g, 20);
  assert.equal(p.hp, hp);
});

test('Backblast respects its rear cone and fuel explosions chip nearby walls', () => {
  const g = fixture();
  Body.setPosition(g.player, { x: 650, y: 400 });
  const p = piece(g);
  g.fireBackblast({ x: 1, y: 0 }, 50);
  assert.equal(p.hp, WALL_HP);
  g.fireBackblast({ x: -1, y: 0 }, 50);
  assert.equal(p.hp, WALL_HP - 50);
  const fuel = g.props.spawn('canister', 655, 400);
  g.props.strike(fuel, 1, { x: 1, y: 0 });
  assert(!g.terrain.includes(p.body));
});

test('a destroyed portal host unlinks the pair without refunding a placement', () => {
  const g = fixture();
  g.mods = ['fold'];
  g.gun = getGun(g.mods);
  const p = piece(g);
  assert(g.portals.place({ x: 700, y: 415 }));
  assert(g.portals.place({ x: 1100, y: 740 }));
  assert(g.portals.linked);
  const remaining = g.portals.pair[1];
  g.destruction.hitBody(p.body, WALL_HP, { x: 1, y: 0 });
  assert.equal(g.portals.pair[0], null);
  assert.equal(g.portals.pair[1], remaining);
  assert(!g.portals.linked);
  assert(!g.portals.canPlace);
  assert.equal(g.portals.next, 2);
});

test('rubble is solid and shootable, expires in simulation time, and cannot multiply Chain reaction', () => {
  const g = fixture(),
    p = piece(g);
  g.mods = ['shellshock', 'chain-reaction'];
  g.gun = getGun(g.mods);
  g.destruction.hitBody(p.body, WALL_HP, { x: 1, y: 0 });
  assert.equal(g.demolition.pending.length, 0);
  const rubble = g.props.items[0];
  assert(g.solidBodies.includes(rubble.body));
  assert.equal(Query.collides(rubble.body, [g.player, ...g.terrain]).length, 0);
  g.props.hit(rubble, 5, { x: 15, y: 0 });
  assert(rubble.body.velocity.x > 0);
  g.props.hit(rubble, 100, { x: 1, y: 0 });
  assert(!g.props.items.includes(rubble));
  assert.equal(g.demolition.pending.length, 0);
  const count = g.props.items.length;
  g.setMode('paused');
  for (let i = 0; i < 200; i++) g.tick(1 / 60, idle);
  assert.equal(g.props.items.length, count);
  g.setMode('playing');
  g.time += RUBBLE_LIFE + 0.01;
  g.props.afterStep(1 / 60);
  assert.equal(g.props.items.length, 0);
});

test('attached fuses and rivet pins release cleanly when their terrain host disappears', () => {
  const g = fixture(),
    p = piece(g);
  g.mods = ['shellshock', 'fuse'];
  g.gun = getGun(g.mods);
  shot(g);
  const fuse = g.ballistics.shells[0];
  assert(fuse);
  assert.equal(fuse.body, p.body);
  const pos = { ...fuse.pos };
  g.spawnEnemy('runner', 665, 430);
  const e = g.enemies[0];
  e.spawn = 0;
  g.ballistics.pins.set(e.id, {
    pos: { ...e.body.position },
    surface: p.body,
    surfacePos: { ...p.body.position },
    until: g.time + 1,
    fractured: false,
  });
  assert(g.ballistics.pinned(e));
  g.destruction.hitBody(p.body, WALL_HP, { x: 1, y: 0 });
  assert(!g.ballistics.pinned(e));
  assert.equal(fuse.body, undefined);
  g.ballistics.positionShells();
  assert.deepEqual(fuse.pos, pos);
  g.time = fuse.at;
  g.ballistics.update();
  assert.equal(g.ballistics.shells.length, 0);
  assert(g.demolition.effects.length > 0);
});

test('the Interceptor’s delayed charges can break cover without hitting through that same explosion', () => {
  const g = fixture(),
    p = piece(g),
    behind = piece(g, { x: 825, y: 350, w: 30, h: 130 });
  g.spawnEnemy('interceptor', 400, 600);
  const e = g.enemies[0];
  e.spawn = 0;
  Body.setPosition(g.player, { x: 810, y: 400 });
  p.hp = 80;
  rivalCharge(g, e, { x: 680, y: 400 }, 240, 20, 0.1, false);
  updateArsenal(g, e, 0.2);
  assert(!g.terrain.includes(p.body));
  assert.equal(behind.hp, WALL_HP);
  assert.equal(g.hp, 100);
});

test('rubble stays bounded, never spawns inside actors, and clears on death and room reload', () => {
  const g = fixture();
  Body.setPosition(g.player, { x: 725, y: 385 });
  const first = piece(g);
  g.destruction.hitBody(first.body, WALL_HP, { x: 1, y: 0 });
  assert(g.props.items.every((p) => Query.collides(p.body, [g.player]).length === 0));
  for (let i = 0; i < 12; i++) {
    const p = piece(g, { x: 450 + i * 70, y: 200, w: 60, h: 22 });
    g.destruction.hitBody(p.body, LEDGE_HP, { x: 0, y: 1 });
    assert(g.props.items.length <= RUBBLE_LIMIT);
  }
  g.setMode('dead');
  assert.equal(g.props.items.length, 0);
  g.start('destruction-fixture');
  assert.equal(g.destruction.broken.length, 0);
});

test('weak-material selection repeats and excludes structural floors, tall obstacles, machinery, and freight', () => {
  for (let stage = 0; stage < 20; stage++)
    for (let n = 0; n < 8; n++) {
      const seed = 'breakables-' + n,
        l = getLevel(seed, stage);
      const selected = breakableSolids(l, seed, stage);
      assert.deepEqual(breakableSolids(l, seed, stage), selected);
      assert(selected.length <= 3);
      assert(selected.every((s) => s.x >= 280 && s.x + s.w <= 1740 && s.h <= 130));
      if (l.freight) assert.equal(selected.length, 0);
    }
  const g = new Game();
  g.start('FREIGHT-RIDE-2', testCheckpoint('FREIGHT-RIDE-2', 5));
  assert.equal(g.destruction.pieces.length, 0);
  const finalArena = getLevel('interceptor-fight-3', 19);
  assert(breakableSolids(finalArena, 'interceptor-fight-3', 19).every((s) => s.h > 28));
});

function walk(g: Game, path: Vec[]) {
  let index = 0,
    previous = g.player.position.x,
    stuck = 0;
  for (let i = 0; i < 3600 && g.mode === 'playing' && index < path.length; i++) {
    const p = g.player.position,
      t = path[index],
      dx = t.x - p.x,
      dy = p.y - t.y;
    if (Math.abs(dx) < 40 && Math.abs(dy) < 65) {
      index++;
      continue;
    }
    stuck = Math.abs(p.x - previous) < 0.4 ? stuck + 1 : 0;
    previous = p.x;
    const move = dx > 12 ? 1 : dx < -12 ? -1 : 0;
    const blocked =
      move && Query.ray(g.solidBodies, p, { x: p.x + move * 70, y: p.y }, 24).length > 0;
    g.tick(1 / 60, {
      ...idle,
      left: move < 0,
      right: move > 0,
      jump: g.grounded && (dy > 50 || !!blocked || stuck > 12),
    });
  }
  assert(
    index === path.length || g.mode === 'upgrade',
    g.level.id +
      ' waypoint ' +
      index +
      ' at ' +
      JSON.stringify(g.player.position) +
      ' target ' +
      JSON.stringify(path[index]),
  );
}

test('every authored room and both roads remain crossable in both directions after all weak terrain is destroyed', () => {
  const levels: Level[] = [...LAYOUTS, ...BOSS_LAYOUTS, ...SPECIAL_LAYOUTS]
    .filter((l) => !l.freight)
    .map((l) => ({ ...l, boss: BOSS_LAYOUTS.includes(l), mirrored: false }));
  for (const stage of [2, 6, 10, 14, 18])
    for (const route of ['low', 'high'] as const)
      levels.push(getRouteLevel('break-walk', stage, route));
  for (const source of levels)
    for (const mirror of [false, true])
      for (const reverse of [false, true]) {
        const g = fixture();
        g.engine.gravity.y = 1;
        const solids = source.solids.map((s) => ({ ...s, x: mirror ? 2000 - s.x - s.w : s.x }));
        const route = source.route.map((p) => ({ ...p, x: mirror ? 2000 - p.x : p.x }));
        if (mirror) route.reverse();
        g.level = { ...source, solids: [], route, mirrored: mirror };
        for (const s of solids) piece(g, s);
        // Destroy every eligible piece, including choices outside one seeded
        // selection, to prove safety when different eligible pieces fail together.
        const eligible = new Set<string>();
        for (let n = 0; n < 20; n++)
          for (const s of breakableSolids({ ...g.level, solids }, 'walk-' + n, 0))
            eligible.add(JSON.stringify(s));
        for (const p of [...g.destruction.pieces])
          if (eligible.has(JSON.stringify(p.rect)))
            g.destruction.hitBody(p.body, 1000, { x: 0, y: 1 });
        g.destruction.pieces = []; // Remaining structural terrain must stay intact.
        for (const p of [...g.props.items]) g.props.remove(p);
        g.hitStop = 0;
        Body.setPosition(g.player, { x: reverse ? 1860 : 140, y: 680 });
        walk(g, [
          ...(reverse ? [...g.level.route].reverse() : g.level.route),
          { x: reverse ? 100 : 1900, y: 720 },
        ]);
      }
});

test('Continue, Daily and isolated test retries rebuild the same intact terrain without changing progression', () => {
  for (const seed of ['DESTRUCTION-44', dailyForDate('2026-09-11')!.seed]) {
    const save = { ...testCheckpoint(seed, 2), route: 'low' as const },
      g = new Game();
    g.start(seed, save);
    const original = g.destruction.pieces.map((p) => p.rect);
    assert(original.length > 0);
    g.destruction.hitBody(g.destruction.pieces[0].body, 1000, { x: 1, y: 0 });
    let stored: unknown;
    g.onCheckpoint = (s) => (stored = s);
    g.save();
    const loaded = loadCheckpoint(stored);
    assert(loaded);
    const continued = new Game();
    continued.start(seed, loaded);
    assert.deepEqual(
      continued.destruction.pieces.map((p) => p.rect),
      original,
    );
    assert.equal(continued.route, g.route);
    assert.deepEqual(continued.mods, g.mods);
  }
  for (const area of ['docks', 'furnace', 'cooling', 'reclamation', 'rooftops']) {
    const save = destructionTestFromUrl(new URL('https://test/?test=destruction&area=' + area));
    assert(save);
    assert(loadCheckpoint(save));
    const g = new Game();
    let writes = 0;
    g.onCheckpoint = () => writes++;
    g.onBossDefeated = () => writes++;
    g.startTest(save);
    const rects = g.destruction.pieces.map((p) => p.rect);
    assert(rects.length > 0);
    g.destruction.hitBody(g.destruction.pieces[0].body, 1000, { x: 1, y: 0 });
    g.save();
    g.startTest(g.testRun!);
    assert.deepEqual(
      g.destruction.pieces.map((p) => p.rect),
      rects,
    );
    assert.equal(writes, 0);
  }
  for (const query of [
    'test=destruction&test=destruction',
    'test=destruction&daily=2026-09-11',
    'test=destruction&area=nope',
    'test=destruction&area=docks&area=docks',
    'test=destruction&route=high',
  ])
    assert.equal(destructionTestFromUrl(new URL('https://test/?' + query)), null);
});
