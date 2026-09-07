import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import type { Input } from '../src/game.ts';
import { getLevel } from '../src/levels.ts';
import { PROP_STATS, propPlacements, traceProp } from '../src/props.ts';
import { getGun, segmentBox } from '../src/rules.ts';
const { Body, Bodies, Composite } = Matter;
function step(g: Game, n = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < n; i++)
    g.tick(1 / 60, {
      left: false,
      right: false,
      jump: false,
      jumpHeld: true,
      fire: false,
      aim: { x: 1200, y: 400 },
      ...input,
    });
}
function fixture() {
  const g = new Game();
  g.start('props');
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  for (const prop of [...g.props.items]) g.props.remove(prop);
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  Body.setPosition(g.player, { x: 400, y: 400 });
  g.aim = { x: 1200, y: 400 };
  return g;
}
function enemy(g: Game, x: number, y: number) {
  g.spawnEnemy('shooter', x, y);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  e.timer = 100;
  return e;
}
function wall(g: Game, x: number, y = 400, w = 22, h = 500) {
  const b = Bodies.rectangle(x, y, w, h, { isStatic: true });
  g.terrain.push(b);
  Composite.add(g.engine.world, b);
}

test('sparse props reproduce, avoid actor starts, and keep tall panels off the baseline route', () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < 60; seed++)
    for (let stage = 0; stage < 9; stage++) {
      const level = getLevel('props-' + seed, stage),
        placements = propPlacements(level, 'props-' + seed);
      assert.deepEqual(placements, propPlacements(level, 'props-' + seed));
      assert(placements.length <= (level.boss ? 2 : 3));
      for (const p of placements) {
        seen.add(p.kind);
        const { w, h } = PROP_STATS[p.kind];
        assert(p.x - w / 2 > 280 && p.x + w / 2 < 1800);
        for (const s of level.solids)
          assert(
            !(
              p.x + w / 2 > s.x &&
              p.x - w / 2 < s.x + s.w &&
              p.y + h / 2 > s.y &&
              p.y - h / 2 < s.y + s.h
            ),
          );
        for (const e of level.spawns)
          assert(Math.abs(p.x - e.x) >= w / 2 + 55 || Math.abs(p.y - e.y) >= h / 2 + 55);
        if (p.kind === 'cover') {
          const path = [{ x: 140, y: 680 }, ...level.route, { x: 1910, y: 720 }];
          for (let i = 1; i < path.length; i++)
            assert(
              !segmentBox(
                path[i - 1],
                path[i],
                { x: p.x - w / 2 - 26, y: p.y - h / 2 - 25 },
                { x: p.x + w / 2 + 26, y: p.y + h / 2 + 25 },
              ),
            );
        }
      }
    }
  assert.equal(seen.size, 3);
});

test('shots launch a crate, and its real collision damages an enemy', () => {
  const g = fixture(),
    crate = g.props.spawn('crate', 455, 400),
    e = enemy(g, 535, 410);
  g.fire();
  step(g);
  assert(crate.body.velocity.x > 5);
  const hp = e.hp;
  step(g, 20);
  assert(e.hp < hp);
  assert(crate.hits.has(e.id));
});

test('slow crate contact is harmless and resting crates are usable as ground', () => {
  const g = fixture(),
    crate = g.props.spawn('crate', 700, 718),
    e = enemy(g, 740, 724);
  step(g, 30);
  assert.equal(e.hp, e.maxHp);
  Body.setPosition(g.player, { x: crate.body.position.x, y: 675 });
  Body.setVelocity(g.player, { x: 0, y: 1 });
  step(g, 15);
  assert(g.grounded);
  const y = g.player.position.y;
  step(g, 5, { jump: true });
  assert(g.player.position.y < y - 35);
});

test('a fuel canister arms from a real shot and detonates on a hard wall impact', () => {
  const g = fixture(),
    fuel = g.props.spawn('canister', 455, 400);
  wall(g, 610);
  g.fire();
  step(g);
  assert(Number.isFinite(fuel.armedAt));
  assert(fuel.body.velocity.x > 8);
  assert(g.props.items.includes(fuel));
  step(g, 40);
  assert(!g.props.items.includes(fuel));
  assert(!Composite.allBodies(g.engine.world).includes(fuel.body));
});

test('fuel does not detonate from floor sliding or settling, but a hard drop does', () => {
  const g = fixture(),
    fuel = g.props.spawn('canister', 650, 721);
  fuel.armedAt = 0;
  Body.setVelocity(fuel.body, { x: 12, y: 0 });
  step(g, 10);
  assert(g.props.items.includes(fuel));
  Body.setPosition(fuel.body, { x: 850, y: 600 });
  Body.setVelocity(fuel.body, { x: 0, y: 10 });
  step(g, 25);
  assert(!g.props.items.includes(fuel));
});

test('a hard impact during the brief arming window still detonates after the window', () => {
  const g = fixture(),
    fuel = g.props.spawn('canister', 500, 400);
  wall(g, 528);
  g.props.hit(fuel, 24, { x: 1, y: 0 });
  step(g, 2);
  assert(g.props.items.includes(fuel));
  assert(Number.isFinite(fuel.detonateAt));
  step(g, 5);
  assert(!g.props.items.includes(fuel));
});

test('cover absorbs three ordinary rounds and its removal opens the firing lane', () => {
  const g = fixture(),
    cover = g.props.spawn('cover', 480, 400),
    e = enemy(g, 560, 400);
  for (let i = 0; i < 3; i++) {
    g.fire();
    g.updateShots(1 / 30);
  }
  assert.equal(e.hp, e.maxHp);
  assert(!g.props.items.includes(cover));
  assert(!g.solidBodies.includes(cover.body));
  g.fire();
  g.updateShots(1 / 6);
  assert(e.hp < e.maxHp);
});

test('rotated props trace their visible hull, including muzzle blocking and banked shots', () => {
  const g = fixture(),
    crate = g.props.spawn('crate', 450, 400);
  Body.setAngle(crate.body, Math.PI / 4);
  assert.equal(traceProp(crate, { x: 470, y: 425 }, { x: 480, y: 425 }), null);
  assert(traceProp(crate, { x: 400, y: 400 }, { x: 500, y: 400 }));
  g.mods = ['banker'];
  g.gun = getGun(g.mods);
  g.fire();
  g.updateShots(1 / 60);
  assert(crate.hp < crate.maxHp);
  assert.equal(g.shots[0].banks, 1);
  assert.equal(g.shots[0].bounces, 0);
  assert(Math.abs(g.shots[0].damage - g.gun.damage * 1.35) < 1e-7);
});

test('explosions respect solid cover, chain once, and remove each canister once', () => {
  const g = fixture(),
    fuel = g.props.spawn('canister', 700, 400),
    chain = g.props.spawn('canister', 760, 360);
  const exposed = enemy(g, 650, 420),
    protectedEnemy = enemy(g, 835, 400);
  wall(g, 800);
  g.props.explode(fuel);
  assert(exposed.hp < exposed.maxHp);
  assert.equal(protectedEnemy.hp, protectedEnemy.maxHp);
  assert(!g.props.items.includes(fuel) && !g.props.items.includes(chain));
  const kills = g.kills,
    particles = g.particles.length;
  g.props.explode(fuel);
  assert.equal(g.kills, kills);
  assert.equal(g.particles.length, particles);
});

test('a lethal chain stops immediately without later kills healing a dead player', () => {
  const g = fixture();
  g.gun = getGun(['leech']);
  g.hp = 10;
  Body.setPosition(g.player, { x: 450, y: 400 });
  const first = g.props.spawn('canister', 600, 400);
  g.props.spawn('canister', 500, 400);
  const later = g.props.spawn('canister', 700, 400),
    e = enemy(g, 800, 400);
  g.props.explode(first);
  assert.equal(g.mode, 'dead');
  assert.equal(g.hp, 0);
  assert.equal(e.hp, e.maxHp);
  assert(g.props.items.includes(later));
});

test('rear blasts and enemy muzzle shots damage the blocking prop before actors behind it', () => {
  const g = fixture();
  Body.setPosition(g.player, { x: 600, y: 400 });
  const cover = g.props.spawn('cover', 550, 400),
    e = enemy(g, 500, 400);
  g.fireBackblast({ x: 1, y: 0 }, 24);
  assert.equal(e.hp, e.maxHp);
  assert.equal(cover.hp, 48);
  Body.setPosition(e.body, { x: 526, y: 400 });
  g.enemyShot(e, 0);
  assert.equal(cover.hp, 34);
  assert.equal(g.shots.length, 0);
});

test('pause freezes armed props and continuing resets room props without saving transient damage', () => {
  const g = fixture(),
    fuel = g.props.spawn('canister', 700, 400);
  g.props.hit(fuel, 24, { x: 1, y: 0 });
  const p = { ...fuel.body.position },
    time = g.time;
  g.setMode('paused');
  step(g, 30);
  assert.deepEqual(fuel.body.position, p);
  assert.equal(g.time, time);
  const save = {
    version: 3 as const,
    seed: 'props-continue',
    stage: 4,
    hp: 70,
    mods: ['banker'],
    kills: 10,
    elapsed: 42,
  };
  g.start(save.seed, save);
  assert.equal(g.hp, 70);
  assert.deepEqual(
    g.props.items.map((p) => ({ kind: p.kind, ...p.body.position })),
    propPlacements(g.level, save.seed),
  );
  assert(g.props.items.every((p) => p.hp === p.maxHp && !Number.isFinite(p.armedAt)));
  assert(!Composite.allBodies(g.engine.world).includes(fuel.body));
});
