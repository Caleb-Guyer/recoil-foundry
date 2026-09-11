import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import type { Input } from '../src/game.ts';
import { CABLE_HP, CARGO_TELL, CARGO_BOSS_DAMAGE } from '../src/cargo.ts';
import { CARGO_SIZE, cargoPlacement } from '../src/cargo-layout.ts';
import { getLevel } from '../src/levels.ts';
import { ENEMY_STATS, isBoss } from '../src/enemies.ts';
import type { EnemyKind } from '../src/levels.ts';
import { testCheckpoint, cargoTestFromUrl } from '../src/practice.ts';
import { loadCheckpoint } from '../src/rules.ts';
import { getGun } from '../src/rules.ts';
import { hazardBounds } from '../src/hazard-layouts.ts';
const { Body, Composite, Bodies, Query } = Matter;
const overlap = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) =>
  a.x < b.x + b.w - 0.1 && a.x + a.w > b.x + 0.1 && a.y < b.y + b.h - 0.1 && a.y + a.h > b.y + 0.1;
function step(g: Game, n = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < n; i++)
    g.tick(1 / 60, {
      left: false,
      right: false,
      jump: false,
      jumpHeld: true,
      fire: false,
      aim: { x: 1200, y: 350 },
      ...input,
    });
}
function fixture(x = 800, y = 400) {
  const g = new Game();
  g.start('cargo-fixture');
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  g.hazards.clear();
  g.breaches.clear();
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  Body.setPosition(g.player, { x: 180, y: 720 });
  return { g, load: g.cargo.spawn({ x, y, anchorY: 110 }) };
}
function shot(g: Game, x = 600, y = 250, friendly = true, damage = 24) {
  g.addShot({
    pos: { x, y },
    vel: { x: 500, y: 0 },
    damage,
    life: 1,
    friendly,
    radius: 2.5,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
  });
  g.updateShots(1 / 60);
}
function enemy(g: Game, kind: EnemyKind, x = 800, y = 724) {
  g.spawnEnemy(kind, x, y);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  e.timer = 100;
  return e;
}

test('cargo is sparse, deterministic, mirrored, and clear of machinery, entrances, and initial hulls', () => {
  const coverage = new Set<string>();
  let count = 0;
  for (let i = 0; i < 80; i++)
    for (let area = 0; area < 4; area++) {
      const seed = 'cargo-place-' + i,
        stage = (area === 3 ? 4 : area) * 4 + 2,
        g = new Game();
      g.start(seed, testCheckpoint(seed, stage));
      assert(g.cargo.items.length <= 1);
      for (const p of g.cargo.items) {
        const r = p.cargo!,
          b = p.body.bounds;
        count++;
        coverage.add(g.level.area + ':' + g.level.mirrored);
        assert(p.body.isStatic);
        assert.equal(r.cableHp, CABLE_HP);
        assert(r.anchor.x >= 400 && r.anchor.x <= 1600);
        assert(r.origin.y + CARGO_SIZE.h / 2 <= 603);
        assert(r.origin.y - CARGO_SIZE.h / 2 - r.anchor.y >= 45);
        const shaft = { x: b.min.x, y: b.min.y, w: CARGO_SIZE.w, h: 740 - b.min.y };
        for (const s of [
          ...g.level.solids,
          ...g.hazards.items.map((h) => hazardBounds(h.placement, 44)),
        ])
          assert(!overlap(shaft, s));
        const cable = { x: r.anchor.x - 9, y: r.anchor.y, w: 18, h: b.min.y - r.anchor.y };
        for (const s of g.level.solids) assert(!overlap(cable, s), 'cable crosses a platform');
        for (const s of g.level.spawns) {
          const { w, h } = ENEMY_STATS[s.kind];
          assert(
            !overlap(
              { x: b.min.x, y: b.min.y, w: CARGO_SIZE.w, h: CARGO_SIZE.h },
              { x: s.x - w / 2, y: s.y - h / 2, w, h },
            ),
          );
        }
        const replay = new Game();
        replay.start(seed, testCheckpoint(seed, stage));
        assert.deepEqual(
          replay.cargo.items.map((q) => q.cargo!.origin),
          g.cargo.items.map((q) => q.cargo!.origin),
        );
      }
    }
  assert.equal(coverage.size, 8);
  assert(count > 120 && count < 300);
  for (let stage = 0; stage < 20; stage++)
    if (stage % 4 !== 2)
      assert.equal(cargoPlacement(getLevel('cargo-none', stage), 'cargo-none', stage), null);
  const level = getLevel('cargo-blocked', 2);
  level.solids = [{ x: 300, y: 120, w: 1400, h: 620 }];
  assert.equal(cargoPlacement(level, 'cargo-blocked', 2), null);
});

test('real fast bullets sever the cable after two ordinary hits and give the full warning before falling', () => {
  const { g, load } = fixture();
  shot(g);
  assert.equal(load.cargo!.cableHp, 24);
  assert.equal(load.cargo!.state, 'hanging');
  shot(g);
  assert.equal(load.cargo!.state, 'warning');
  assert(load.body.isStatic);
  const deadline = load.cargo!.releaseAt;
  assert.equal(deadline - g.time, CARGO_TELL);
  shot(g);
  assert.equal(load.cargo!.releaseAt, deadline);
  step(g, 38);
  assert(load.body.isStatic);
  assert.equal(load.body.position.y, 400);
  step(g, 3);
  assert(!load.body.isStatic);
  assert.equal(load.cargo!.state, 'loose');
  step(g, 80);
  assert(load.body.position.y > 690 && load.body.position.y < 714);
  assert.equal(load.body.angle, 0);
});

test('walls and the load hull protect the cable, and hostile rounds use the same swept hit test', () => {
  const { g, load } = fixture();
  const wall = Bodies.rectangle(710, 250, 8, 200, { isStatic: true });
  g.terrain.push(wall);
  Composite.add(g.engine.world, wall);
  shot(g);
  assert.equal(load.cargo!.cableHp, CABLE_HP);
  g.terrain = g.terrain.filter((b) => b !== wall);
  Composite.remove(g.engine.world, wall);
  shot(g, 600, 400);
  assert.equal(load.hp, 376);
  assert.equal(load.cargo!.cableHp, CABLE_HP);
  assert(load.body.isStatic);
  assert.equal(load.body.position.x, 800);
  shot(g, 600, 250, false, 48);
  assert.equal(load.cargo!.state, 'warning');
});

test('falling loads crush real enemy hulls but stay solid, survive, and become movable cover', () => {
  const { g, load } = fixture();
  const e = enemy(g, 'runner');
  g.cargo.cut(load, 48);
  step(g, 140);
  assert(e.hp <= 0);
  assert(g.props.items.includes(load));
  assert(!load.body.isStatic);
  assert(load.body.position.y > 690);
  assert.equal(load.hp, load.maxHp);
  assert(g.lineEnd({ x: 600, y: 700 }, { x: 1000, y: 700 }).x < 800);
  const before = load.body.position.x;
  g.props.hit(load, 24, { x: 1, y: 0 });
  step(g, 10);
  assert(load.body.position.x > before + 4);
});

test('cargo impacts detonate unlit fuel and trigger nearby canister chains', () => {
  const { g, load } = fixture();
  const a = g.props.spawn('canister', 800, 720),
    b = g.props.spawn('canister', 925, 720);
  g.cargo.cut(load, 48);
  step(g, 140);
  assert(!g.props.items.includes(a));
  assert(!g.props.items.includes(b));
  assert(g.props.items.includes(load));
  assert(g.hp > 0);
});

test('a player can escape the warned lane and move out from under a landed load', () => {
  for (const dodge of [false, true]) {
    const { g, load } = fixture();
    Body.setPosition(g.player, { x: 800, y: 721 });
    g.cargo.cut(load, 48);
    step(g, 90, dodge ? { left: true } : {});
    assert.equal(g.hp, dodge ? 100 : 76);
    step(g, 35, { right: true });
    assert(Math.abs(g.player.position.x - load.body.position.x) > CARGO_SIZE.w / 2 + 20);
  }
});

test('oversized cargo stays solid at wall and floor portal openings', () => {
  const { g, load } = fixture(600, 400);
  g.mods = ['fold'];
  g.gun = getGun(g.mods);
  g.cargo.cut(load, 48);
  step(g, 40);
  g.engine.gravity.y = 0;
  const wall = Bodies.rectangle(820, 430, 40, 600, { isStatic: true });
  g.terrain.push(wall);
  Composite.add(g.engine.world, wall);
  const exitWall = Bodies.rectangle(1220, 430, 40, 600, { isStatic: true });
  g.terrain.push(exitWall);
  Composite.add(g.engine.world, exitWall);
  assert(g.portals.place({ x: 800, y: 400 }));
  assert(g.portals.place({ x: 1240, y: 400 }));
  Body.setPosition(load.body, { x: 740, y: 400 });
  Body.setVelocity(load.body, { x: 18, y: 0 });
  step(g, 8);
  assert(load.body.position.x <= 752.1);
  assert(load.body.position.x > 740);
  assert.equal(load.cargo!.state, 'loose');
  g.portals.reset();
  assert(g.portals.place({ x: 600, y: 740 }));
  assert(g.portals.place({ x: 1500, y: 740 }));
  Body.setPosition(load.body, { x: 600, y: 690 });
  Body.setVelocity(load.body, { x: 0, y: 12 });
  step(g, 12);
  assert(Math.abs(load.body.position.x - 600) < 5);
  assert(load.body.position.y <= 713);
});

test('shooting through a portal cuts the real cable', () => {
  const { g, load } = fixture(1100, 400);
  g.mods = ['fold'];
  g.gun = getGun(g.mods);
  const a = Bodies.rectangle(600, 300, 40, 400, { isStatic: true }),
    b = Bodies.rectangle(900, 300, 40, 400, { isStatic: true });
  g.terrain.push(a, b);
  Composite.add(g.engine.world, [a, b]);
  assert(g.portals.place({ x: 580, y: 250 }));
  assert(g.portals.place({ x: 920, y: 250 }));
  shot(g, 500, 250, true, 48);
  assert.equal(load.cargo!.state, 'warning');
});

test('the cargo test link supplies a real load and preserves ordinary saves through restart', () => {
  const base = 'https://caleb-guyer.github.io/recoil-foundry/';
  const save = cargoTestFromUrl(new URL('?test=cargo', base))!;
  assert(save);
  const g = new Game();
  let writes = 0;
  g.onCheckpoint = () => {
    writes++;
  };
  g.startTest(save);
  assert.equal(g.cargo.items.length, 1);
  assert.equal(g.mods.length, 2);
  g.cargo.cut(g.cargo.items[0], 48);
  step(g, 90);
  g.startTest(g.testRun!);
  assert.equal(g.cargo.items[0].cargo!.state, 'hanging');
  assert.equal(writes, 0);
  for (const query of [
    '?test=cargo&daily=2026-09-07',
    '?test=cargo&seed=other',
    '?test=cargo&dv=25',
    '?test=cargo&area=docks',
    '?test=cargo&test=cargo',
    '?test=CARGO',
  ])
    assert.equal(cargoTestFromUrl(new URL(query, base)), null);
});

test('every boss resists a falling load without bypassing its armor or repeating resting-contact damage', () => {
  for (const kind of (Object.keys(ENEMY_STATS) as EnemyKind[]).filter(isBoss)) {
    const { g, load } = fixture(800, 400),
      e = enemy(g, kind, 800, 610);
    Body.setStatic(e.body, true);
    e.timer = 100;
    g.updateEnemy = () => {};
    const initial = e.hp;
    g.cargo.cut(load, 48);
    step(g, 120);
    assert(e.hp < initial, kind + ' missed actual cargo contact');
    assert(initial - e.hp <= CARGO_BOSS_DAMAGE * 1.4 + 0.01, kind + ' ignored cargo resistance');
    assert(e.hp > 0);
    const after = e.hp;
    step(g, 120);
    assert.equal(e.hp, after, kind + ' repeated resting impact');
  }
});

test('a direct drop hurts the player once, while standing on landed cargo is safe', () => {
  const { g, load } = fixture();
  Body.setPosition(g.player, { x: 800, y: 721 });
  g.cargo.cut(load, 48);
  step(g, 120);
  assert.equal(g.hp, 76);
  Body.setPosition(g.player, {
    x: load.body.position.x,
    y: load.body.position.y - CARGO_SIZE.h / 2 - 19,
  });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  step(g, 80);
  assert.equal(g.hp, 76);
  assert(g.grounded);
  assert(g.player.position.y < load.body.position.y - 35);
});

test('pause, hitstop, death, destruction, Continue and escape cannot leak a delayed falling load', () => {
  const { g, load } = fixture();
  g.cargo.cut(load, 48);
  const before = { time: g.time, y: load.body.position.y, release: load.cargo!.releaseAt };
  g.setMode('paused');
  step(g, 90);
  assert.deepEqual(
    { time: g.time, y: load.body.position.y, release: load.cargo!.releaseAt },
    before,
  );
  g.setMode('playing');
  g.hitStop = 0.1;
  step(g, 5);
  assert.equal(g.time, before.time);
  g.hitStop = 0;
  g.damagePlayer(999);
  step(g, 90);
  assert(load.body.isStatic);
  const fresh = fixture();
  fresh.g.cargo.cut(fresh.load, 48);
  fresh.g.props.break(fresh.load);
  step(fresh.g, 90);
  assert.equal(fresh.g.cargo.items.length, 0);
  const save = testCheckpoint('CARGO-DROP', 2);
  g.start(save.seed, save);
  const original = g.cargo.items[0];
  assert(original);
  g.cargo.cut(original, 48);
  step(g, 60);
  g.start(save.seed, loadCheckpoint(save)!);
  assert.equal(g.cargo.items[0].cargo!.state, 'hanging');
  assert.equal(g.cargo.items[0].cargo!.cableHp, 48);
  assert(!Composite.allBodies(g.engine.world).includes(original.body));
  g.startTest(testCheckpoint('cargo-exit', 19));
  g.cargo.spawn({ x: 800, y: 400, anchorY: 100 });
  g.clear = true;
  g.startEscape();
  assert.equal(g.cargo.items.length, 0);
});

test('new layouts remain traversable in both orientations with hanging and landed loads', () => {
  const cases = new Map<string, { seed: string; stage: number }>();
  for (let i = 0; i < 120 && cases.size < 8; i++)
    for (let area = 0; area < 4; area++) {
      const seed = 'cargo-walk-' + i,
        stage = (area === 3 ? 4 : area) * 4 + 2,
        g = new Game();
      g.start(seed, testCheckpoint(seed, stage));
      if (g.cargo.items.length) cases.set(g.level.area + ':' + g.level.mirrored, { seed, stage });
    }
  assert.equal(cases.size, 8);
  for (const [label, { seed, stage }] of cases)
    for (const drop of [false, true]) {
      const g = new Game();
      g.start(seed, testCheckpoint(seed, stage));
      for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
      g.enemies = [];
      g.waves.clear();
      if (drop) {
        g.cargo.cut(g.cargo.items[0], 48);
        step(g, 160);
      }
      const path = [...g.level.route, { x: 1910, y: 720 }];
      let index = 0,
        previousX = 140,
        stuck = 0;
      for (let frame = 0; frame < 3600 && g.mode === 'playing' && index < path.length; frame++) {
        const p = g.player.position,
          q = path[index],
          dx = q.x - p.x,
          dy = p.y - q.y;
        // A moving lift or the landed load can be the walkable surface above a
        // ground waypoint. Continue across it instead of waiting inside the deck.
        if (Math.abs(dx) < 40 && (Math.abs(dy) < 65 || (g.grounded && dy < 0))) {
          index++;
          continue;
        }
        stuck = Math.abs(p.x - previousX) < 0.4 ? stuck + 1 : 0;
        previousX = p.x;
        const move = dx > 12 ? 1 : dx < -12 ? -1 : 0,
          blocked =
            !!move && Query.ray(g.solidBodies, p, { x: p.x + move * 70, y: p.y }, 24).length > 0;
        step(g, 1, {
          left: move < 0,
          right: move > 0,
          jump: g.grounded && (dy > 50 || blocked || stuck > 12),
        });
      }
      assert(
        index >= path.length || g.mode === 'upgrade',
        `${label}, dropped=${drop}, stopped at ${index} (${g.player.position.x},${g.player.position.y}), hp ${g.hp}`,
      );
      assert(g.hp > 0);
    }
});
