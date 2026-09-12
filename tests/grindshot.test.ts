import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Shot, type Input } from '../src/game.ts';
import { GRIND } from '../src/grindshot.ts';
import {
  getGun,
  availableMods,
  validBuild,
  loadCheckpoint,
  rewardMods,
  seeded,
} from '../src/rules.ts';
import { grindshotTestFromUrl } from '../src/practice.ts';
import { dailyForDate } from '../src/daily.ts';
const { Bodies, Body, Composite } = Matter;
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1000, y: 700 },
};
function fixture(mods = ['grindshot']) {
  const g = new Game();
  g.start('grind-tests');
  g.waves.clear();
  g.hazards.clear();
  g.breaches.clear();
  g.destruction.clear();
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.mods = mods;
  g.gun = getGun(mods);
  g.aim = { x: 1400, y: 700 };
  Body.setPosition(g.player, { x: 140, y: 400 });
  return g;
}
function wall(g: Game, x = 700, y = 500, w = 200, h = 40, angle = 0) {
  const body = Bodies.rectangle(x, y, w, h, { isStatic: true, angle });
  Composite.add(g.engine.world, body);
  g.terrain.push(body);
  return body;
}
function round(g: Game, extra: Partial<Shot> = {}) {
  g.addShot({
    pos: { x: 400, y: 700 },
    vel: { x: 20, y: 40 },
    damage: 24,
    life: 1,
    friendly: true,
    radius: 2,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
    ...extra,
  });
  return g.shots.at(-1)!;
}
function top(g: Game, body: Matter.Body, x = body.position.x, dir = 1) {
  const shot = round(g, { pos: { x, y: body.bounds.min.y - 2 }, vel: { x: dir * 10, y: 10 } });
  g.grind.impact(shot, body, { x: 0, y: -1 });
  return g.grind.saws.at(-1)!;
}
function advance(g: Game, frames = 1) {
  for (let i = 0; i < frames; i++) {
    g.time += 1 / 60;
    g.hitStop = 0;
    g.grind.update(1 / 60);
  }
}
function enemy(
  g: Game,
  x: number,
  y: number,
  kind: 'shooter' | 'loader' = 'shooter',
  shield = false,
) {
  g.spawnEnemy(kind, x, y, shield ? 'shielded' : undefined);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  e.hp = e.maxHp = 500;
  e.facing = -1;
  return e;
}

test('Grindshot is shared, reduces direct damage once, and gates Corner Cutter', () => {
  for (const path of [[], ['deadeye'], ['crossfire'], ['shellshock']]) {
    assert(availableMods(path).some((m) => m.id === 'grindshot'));
    assert(!availableMods(path).some((m) => m.id === 'corner-cutter'));
    assert(validBuild([...path, 'grindshot', 'corner-cutter']));
    near(getGun([...path, 'grindshot']).damage, getGun(path).damage * 0.8);
    near(getGun(['grindshot', ...path, 'corner-cutter']).damage, getGun(path).damage * 0.8);
  }
  assert(!validBuild(['corner-cutter', 'grindshot']));
});
test('ordinary floor impacts convert into bounded surface motion, with no extra recoil', () => {
  const g = fixture();
  const before = { ...g.player.velocity };
  round(g);
  g.updateShots(1 / 60);
  assert.equal(g.shots.length, 0);
  assert.equal(g.grind.saws.length, 1);
  const saw = g.grind.saws[0],
    x = saw.pos.x;
  advance(g, 10);
  near(saw.pos.x - x, GRIND.speed / 6);
  near(saw.pos.y, 740 - GRIND.offset);
  assert.deepEqual(g.player.velocity, before);
  advance(g, 75);
  assert.equal(g.grind.saws.length, 0);
});
for (const dir of [-1, 1])
  test(`base saws stop at exposed ends; Corner Cutter follows the outside (${dir})`, () => {
    for (const wrap of [false, true]) {
      const g = fixture(wrap ? ['grindshot', 'corner-cutter'] : ['grindshot']);
      const b = wall(g);
      const saw = top(g, b, 700, dir);
      advance(g, 20);
      assert.equal(g.grind.saws.length, wrap ? 1 : 0);
      if (wrap) {
        near(saw.pos.x, 700 + dir * (100 + GRIND.offset));
        assert(saw.pos.y > 480);
      }
    }
  });
test('an upward wall shot climbs the struck face and wraps onto the top', () => {
  const g = fixture(['grindshot', 'corner-cutter']),
    b = wall(g, 700, 500, 100, 180);
  const s = round(g, { pos: { x: 648, y: 470 }, vel: { x: 15, y: -12 } });
  g.grind.impact(s, b, { x: -1, y: 0 });
  const saw = g.grind.saws[0];
  advance(g, 16);
  near(saw.pos.y, 410 - GRIND.offset);
  assert(saw.pos.x > 650);
});
test('rotated and moving supports use their actual hull; removing one destroys its saw', () => {
  const g = fixture(['grindshot', 'corner-cutter']);
  const b = wall(g, 700, 500, 200, 40, Math.PI / 6);
  const a = b.vertices[0],
    z = b.vertices[1],
    n = { x: 0.5, y: -Math.sqrt(3) / 2 };
  const s = round(g, {
    pos: { x: (a.x + z.x) / 2 + n.x * 2, y: (a.y + z.y) / 2 + n.y * 2 },
    vel: { x: 20, y: 20 },
  });
  g.grind.impact(s, b, n);
  const saw = g.grind.saws[0];
  assert(saw);
  const old = { ...saw.pos };
  Body.translate(b, { x: 30, y: -20 });
  advance(g);
  near(saw.pos.x - old.x, 30 + 7 * Math.cos(Math.PI / 6));
  near(saw.pos.y - old.y, -20 + 7 * 0.5);
  g.terrain = g.terrain.filter((t) => t !== b);
  Composite.remove(g.engine.world, b);
  advance(g);
  assert.equal(g.grind.saws.length, 0);
});
test('a saw hits each enemy once and only damages targets along its traversed edge', () => {
  const g = fixture(['grindshot', 'corner-cutter']);
  const b = wall(g, 700, 500, 100, 40);
  const e = enemy(g, 700, 454),
    hidden = enemy(g, 700, 550);
  top(g, b, 650);
  advance(g, 12);
  near(e.hp, 476);
  near(hidden.hp, 500);
  advance(g, 58);
  near(e.hp, 476);
  assert(hidden.hp < 500, 'wrapping must reach the far side physically');
});
test('thin cover stops a saw before a target, including if the impact breaks the cover', () => {
  const g = fixture();
  const floor = g.terrain.find((b) => b.bounds.min.y === 740)!;
  const target = enemy(g, 590, 720);
  const p = g.props.spawn('crate', 550, 718);
  p.hp = 1;
  top(g, floor, 500);
  advance(g, 25);
  assert(!g.props.items.includes(p));
  near(target.hp, 500);
  assert.equal(g.grind.saws.length, 0);
});
test('shield contact consumes the saw and boss armor retains its damage reduction', () => {
  const g = fixture(),
    floor = g.terrain.find((b) => b.bounds.min.y === 740)!;
  const shield = enemy(g, 560, 718, 'shooter', true),
    behind = enemy(g, 620, 718);
  top(g, floor, 500);
  advance(g, 25);
  near(shield.hp, 497.6);
  near(behind.hp, 500);
  const h = fixture(),
    base = h.terrain.find((b) => b.bounds.min.y === 740)!;
  const loader = enemy(h, 600, 700, 'loader');
  top(h, base, 500);
  advance(h, 25);
  near(loader.hp, 490.4);
});
test('secondary rounds, props, and enemy hulls cannot seed saws; density is bounded', () => {
  const g = fixture(),
    b = wall(g);
  for (const extra of [
    { fragment: true },
    { echo: true },
    { reflected: true },
    { rail: true },
    { friendly: false },
  ]) {
    g.grind.impact(round(g, { pos: { x: 700, y: 478 }, ...extra }), b, { x: 0, y: -1 });
  }
  const p = g.props.spawn('crate', 1000, 718);
  g.grind.impact(round(g), p.body, { x: 0, y: -1 });
  assert.equal(g.grind.saws.length, 0);
  for (let i = 0; i < 80; i++) top(g, b);
  assert.equal(g.grind.saws.length, GRIND.limit);
});
test('banks take priority and the final impact retains Banker damage', () => {
  const g = fixture(['grindshot', 'banker']);
  const s = round(g, { bounces: 1, bankGrowth: 0.35 });
  g.updateShots(1 / 60);
  assert.equal(g.grind.saws.length, 0);
  near(s.damage, 32.4);
  s.pos = { x: 500, y: 700 };
  s.vel = { x: 20, y: 40 };
  g.updateShots(1 / 60);
  assert.equal(g.grind.saws.length, 1);
  near(g.grind.saws[0].damage, 32.4);
});
test('Recall returns first; its spent returning round can make a saw', () => {
  const g = fixture(['grindshot', 'recall']);
  const s = round(g);
  g.updateShots(1 / 60);
  assert(s.recall?.returning);
  assert.equal(g.grind.saws.length, 0);
  s.pos = { x: 500, y: 737 };
  s.vel = { x: 2, y: 40 };
  g.updateShots(1 / 60);
  assert.equal(g.grind.saws.length, 1);
});
test('shell impacts still detonate or attach their fuse while saws keep the direct payload', () => {
  for (const fuse of [false, true]) {
    const g = fixture(['grindshot', 'shellshock', ...(fuse ? ['fuse'] : [])]);
    const s = round(g);
    const damage = s.damage;
    g.updateShots(1 / 60);
    assert.equal(g.grind.saws.length, 1);
    near(g.grind.saws[0].damage, damage);
    assert(fuse ? g.ballistics.shells.length > 0 : g.demolition.effects.length > 0);
  }
});
test('saws freeze on pause and hitstop, then clear on death and retry', () => {
  const g = fixture(),
    b = wall(g);
  top(g, b);
  const pos = { ...g.grind.saws[0].pos };
  const life = g.grind.saws[0].life;
  g.setMode('paused');
  g.grind.update(1);
  near(g.grind.saws[0].life, life);
  g.setMode('playing');
  g.hitStop = 0.1;
  g.grind.update(1);
  assert.deepEqual(g.grind.saws[0].pos, pos);
  g.die();
  assert.equal(g.grind.saws.length, 0);
  const save = grindshotTestFromUrl(new URL('https://example.com/?test=grindshot'))!;
  g.startTest(save);
  top(g, g.terrain[0]);
  g.startTest(save);
  assert.equal(g.grind.saws.length, 0);
});
test('test links are legal, isolated, repeatable, and reject conflicting requests', () => {
  for (const build of ['base', 'evolved', 'bank', 'shell']) {
    const save = grindshotTestFromUrl(
      new URL('https://example.com/?test=grindshot&build=' + build),
    )!;
    assert(save);
    assert(validBuild(save.mods));
    assert(loadCheckpoint(save));
    const g = new Game();
    let writes = 0;
    g.onCheckpoint = () => writes++;
    g.startTest(save);
    g.tick(1 / 60, idle);
    assert.equal(g.testRun?.seed, save.seed);
    assert.equal(writes, 0);
    assert.equal(g.route, 'low');
  }
  for (const tail of [
    '&test=grindshot',
    '&daily=2026-09-12',
    '&seed=other',
    '&build=no',
    '&build=base&build=shell',
    '&mode=overtime',
  ])
    assert.equal(grindshotTestFromUrl(new URL('https://example.com/?test=grindshot' + tail)), null);
  const seed = dailyForDate('2026-09-12')!.seed;
  const a = rewardMods(['grindshot'], 1, seeded(seed), { stage: 2 });
  assert.deepEqual(a, rewardMods(['grindshot'], 1, seeded(seed), { stage: 2 }));
});
