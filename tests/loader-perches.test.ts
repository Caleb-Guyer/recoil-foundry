import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { testCheckpoint } from '../src/practice.ts';
import { distance } from '../src/rules.ts';
import { LOADER_TELL } from '../src/enemies.ts';

const { Body, Query } = Matter;
function room(mirror: boolean, shelfIndex: number, offset = 0, approach = 0) {
  const g = new Game(),
    seed = mirror ? 'LOADER-SHIFT-0' : 'LOADER-SHIFT-5';
  g.start(seed, { ...testCheckpoint(seed, 3), mods: ['ricochet', 'rapid', 'light'] });
  const e = g.enemies[0],
    shelf = g.level.solids[shelfIndex],
    x = shelf.x + shelf.w / 2 + offset;
  e.spawn = 0;
  e.timer = 0;
  Body.setPosition(g.player, { x, y: shelf.y - 18 });
  const bossX = x + approach;
  const floor = Math.min(
    740,
    ...g.solidBodies
      .filter(
        (b) =>
          b.bounds.min.y > shelf.y + shelf.h &&
          b.bounds.min.x < bossX + 56 &&
          b.bounds.max.x > bossX - 56,
      )
      .map((b) => b.bounds.min.y),
  );
  Body.setPosition(e.body, { x: bossX, y: floor - 34 - 0.1 });
  Body.setVelocity(e.body, { x: 0, y: 0 });
  return { g, e, x, shelf };
}
function step(g: Game, x: number, input: Partial<Input> = {}) {
  const correction = x - g.player.position.x - g.player.velocity.x * 5;
  g.tick(1 / 60, {
    left: correction < -8,
    right: correction > 8,
    jump: false,
    jumpHeld: true,
    fire: false,
    aim: { x, y: 0 },
    ...input,
  });
}

test('every Loader shelf and mirror stops protecting a stationary player from below', () => {
  for (const mirror of [false, true])
    for (const shelf of [2, 3, 4])
      for (const offset of [-80, 0, 80])
        for (const approach of [-65, 0, 65]) {
          const { g, e, x } = room(mirror, shelf, offset, approach);
          for (let n = 0; n < 1080 && g.hp === 100; n++) {
            const before = { ...e.body.position };
            step(g, x);
            assert(
              distance(before, e.body.position) < 27,
              `${mirror}/${shelf}/${offset}/${approach}: navigation teleported the Loader`,
            );
            assert(
              Query.collides(e.body, g.terrain).every((c) => c.depth < 2),
              'climbed through terrain',
            );
          }
          assert(g.hp < 100, `${mirror}/${shelf}/${offset}/${approach} remained safe`);
        }
});

test('ceiling Bank Shot fire cannot hold the Loader under any platform', () => {
  for (const mirror of [false, true])
    for (const shelf of [2, 3, 4]) {
      const { g, e, x } = room(mirror, shelf, 65);
      for (let n = 0; n < 1080 && g.hp === 100 && e.hp > 0; n++)
        step(g, x, { fire: true, aim: { x: e.body.position.x, y: -e.body.position.y } });
      assert(g.shotCount > 5, 'did not exercise sustained ricochet fire');
      assert(g.hp < 100, `${mirror}/${shelf}: stationary bank fire killed or stalled the boss`);
    }
});

test('a Loader that climbs a ledge still warns its ram and a normal jump can evade it', () => {
  for (const mirror of [false, true])
    for (const shelf of [2, 3, 4]) {
      const { g, e, x } = room(mirror, shelf);
      for (let n = 0; n < 900 && e.state !== 'windup'; n++) step(g, x);
      assert.equal(g.hp, 100, 'climbing caused an unavoidable contact hit');
      assert.equal(e.state, 'windup');
      assert.equal(e.attack, 'aimed');
      assert.equal(e.timer, LOADER_TELL);
      const aim = { ...e.aim };
      for (let n = 0; n < 90 && g.mode === 'playing'; n++) {
        step(g, x, { left: aim.x < 0, right: aim.x > 0, jump: n === 22 });
        if (e.state === 'windup' || e.state === 'rush') assert.deepEqual(e.aim, aim);
      }
      assert.equal(g.hp, 100, `${mirror}/${shelf}: warned ram could not be evaded`);
    }
});

test('climbing freezes with pause and hitstop, abandons a departed perch, and resets on retry', () => {
  const { g, e, x } = room(false, 2);
  step(g, x);
  assert(e.loaderClimb);
  const saved = { pos: { ...e.body.position }, route: { ...e.loaderClimb } };
  g.setMode('paused');
  for (let n = 0; n < 60; n++) step(g, x);
  assert.deepEqual({ pos: e.body.position, route: e.loaderClimb }, saved);
  g.setMode('playing');
  g.hitStop = 0.2;
  for (let n = 0; n < 5; n++) step(g, x);
  assert.deepEqual({ pos: e.body.position, route: e.loaderClimb }, saved);
  g.hitStop = 0;
  Body.setPosition(g.player, { x: 1800, y: 722 });
  step(g, 1800);
  assert.equal(e.loaderClimb, undefined);
  g.start(g.seed, testCheckpoint(g.seed, 3));
  assert.equal(g.enemies[0].loaderClimb, undefined);
});
