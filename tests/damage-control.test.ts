import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DamageControl,
  DAMAGE_HISTORY_LIMIT,
  DAMAGE_RECOVERY,
  damageHealthTrail,
} from '../src/damage-control.ts';
import { Game } from '../src/game.ts';
import type { Shot } from '../src/game.ts';

test('damage detail is bounded while totals retain all accepted health loss and copies stay independent', () => {
  const model = new DamageControl();
  const player = { x: 200, y: 700 },
    origin = { x: 100, y: 700 };
  for (let n = 0; n < 100; n++)
    model.record({
      at: n,
      elapsed: n,
      hpBefore: 100,
      hpAfter: 99,
      player,
      origin,
      direction: { x: -9, y: 0 },
      cause: { type: 'shot', enemy: 'shooter' },
    });
  assert.equal(model.hits.length, DAMAGE_HISTORY_LIMIT);
  assert.equal(model.lastHit!.damage, 1);
  assert.deepEqual(model.lastHit!.direction, { x: -1, y: 0 });
  player.x = origin.x = 999;
  assert.equal(model.lastHit!.player.x, 200);
  assert.equal(model.lastHit!.origin!.x, 100);
  const summary = model.summary();
  assert.equal(summary.damage, 100);
  assert.equal(summary.hits, 100);
  summary.sources[0].damage = 0;
  summary.sources[0].cause.enemy = 'runner';
  assert.equal(model.summary().sources[0].damage, 100);
  assert.equal(model.summary().sources[0].cause.enemy, 'shooter');
  model.reset();
  assert.equal(model.lastHit, null);
  assert.deepEqual(model.summary(), { damage: 0, hits: 0, sources: [] });
});

test('invalid or prevented health changes cannot become recorded damage or invented bearings', () => {
  const model = new DamageControl();
  const sample = {
    at: 1,
    elapsed: 1,
    hpBefore: 100,
    hpAfter: 90,
    player: { x: 100, y: 700 },
    cause: { type: 'unknown' as const },
  };
  for (const bad of [
    { hpBefore: 90, hpAfter: 90 },
    { hpBefore: 80, hpAfter: 90 },
    { at: NaN },
    { elapsed: -1 },
    { hpAfter: -2 },
    { player: { x: Infinity, y: 0 } },
  ])
    assert.equal(model.record({ ...sample, ...bad }), null);
  const hit = model.record({ ...sample, origin: { x: NaN, y: 1 }, direction: { x: 0, y: 0 } })!;
  assert.equal(hit.direction, undefined);
  assert.equal(hit.origin, undefined);
  const fall = model.record({
    ...sample,
    at: 2,
    elapsed: 2,
    cause: { type: 'fall' },
    origin: { x: 0, y: 0 },
    direction: { x: 0, y: -1 },
  })!;
  assert.equal(fall.direction, undefined);
  assert.equal(fall.origin, undefined);
});

test('actual lethal damage records only remaining health before death observers and cannot block saving', () => {
  const g = new Game();
  g.start('damage-model-lethal');
  const order: string[] = [];
  const saved: unknown[] = [];
  g.onCheckpoint = (value) => saved.push(value);
  g.onDamage = (hit) => {
    order.push('damage');
    assert.equal(hit.damage, 100);
    assert.equal(hit.hpAfter, 0);
    assert.equal(g.mode, 'playing');
    throw Error('optional viewer failed');
  };
  g.onDeath = () => {
    order.push('death');
    assert.equal(g.damageControl.summary().damage, 100);
    assert.equal(g.deathCause?.enemy, 'runner');
  };
  g.damagePlayer(
    999,
    { x: g.player.position.x - 80, y: g.player.position.y },
    { type: 'contact', enemy: 'runner' },
  );
  assert.deepEqual(order, ['damage', 'death']);
  assert.equal(g.mode, 'dead');
  assert.deepEqual(saved, [null]);
  g.damagePlayer(99);
  assert.equal(g.damageControl.summary().hits, 1);
});

test('actual recovery gate rejects repeated hits and pause while shots retain their incoming bearing', () => {
  const g = new Game();
  g.start('damage-model-immunity');
  const shot = { vel: { x: 7, y: -7 } } as Shot;
  g.damagePlayer(18, { ...g.player.position }, { type: 'shot', enemy: 'shooter' }, shot);
  assert.equal(g.hp, 82);
  assert.equal(g.damageControl.summary().hits, 1);
  assert(g.damageControl.lastHit!.direction!.x < 0 && g.damageControl.lastHit!.direction!.y > 0);
  g.damagePlayer(18, undefined, { type: 'shot' });
  assert.equal(g.hp, 82);
  const idle = {
    left: false,
    right: false,
    jump: false,
    jumpHeld: false,
    fire: false,
    aim: { x: 400, y: 600 },
  };
  for (let n = 0; n < 90 && g.time - g.hurtAt < DAMAGE_RECOVERY; n++) g.tick(1 / 60, idle);
  assert(g.time - g.hurtAt >= DAMAGE_RECOVERY);
  g.setMode('paused');
  g.damagePlayer(18);
  assert.equal(g.hp, 82);
  g.setMode('playing');
  g.damagePlayer(18);
  assert.equal(g.hp, 64);
  assert.equal(g.damageControl.summary().hits, 2);
});

test('new room visits and restored checkpoints do not invent historical damage', () => {
  const g = new Game();
  g.start('damage-model-reset');
  g.damagePlayer(8, undefined, { type: 'steam' });
  const save = g.checkpointSnapshot();
  assert.equal(g.damageControl.summary().damage, 8);
  assert(!JSON.stringify(save).includes('damageControl'));
  const restored = new Game();
  restored.startTest(save);
  assert.equal(restored.hp, 92);
  assert.deepEqual(restored.damageControl.summary(), { damage: 0, hits: 0, sources: [] });
  g.loadRoom();
  assert.deepEqual(g.damageControl.summary(), { damage: 0, hits: 0, sources: [] });
});

test('health loss trail follows game time, ends promptly and cannot hide healing or become invalid', () => {
  const model = new DamageControl();
  const hit = model.record({
    at: 5,
    elapsed: 5,
    hpBefore: 100,
    hpAfter: 82,
    player: { x: 0, y: 0 },
    cause: { type: 'shot' },
  })!;
  assert.equal(damageHealthTrail(hit, 5, 82), 100);
  assert.equal(damageHealthTrail(hit, 5.1, 82), 100);
  assert(damageHealthTrail(hit, 5.4, 82) > 82 && damageHealthTrail(hit, 5.4, 82) < 100);
  assert.equal(damageHealthTrail(hit, 5.65, 82), 82);
  assert.equal(damageHealthTrail(hit, 5.4, 100), 100);
  assert.equal(damageHealthTrail(hit, 4, 82), 82);
  assert.equal(damageHealthTrail(hit, NaN, 82), 82);
});

test('a real Scrap Armor interception produces no accepted damage, impact or health trail', () => {
  const g = new Game();
  g.startTest({
    version: 6,
    seed: 'SUPPORT-damage-control',
    stage: 0,
    hp: 100,
    mods: ['scrap-armor'],
    kills: 0,
    elapsed: 0,
  });
  g.support.plateUntil = 2;
  assert.equal(g.support.plate, true);
  const shot = {
    pos: { ...g.player.position },
    vel: { x: 6, y: 0 },
    friendly: false,
    allied: false,
    life: 1,
    radius: 4,
    damage: 18,
  } as Shot;
  let calls = 0;
  g.onDamage = () => calls++;
  g.damagePlayer(18, shot.pos, { type: 'shot', enemy: 'shooter' }, shot);
  assert.equal(g.hp, 100);
  assert.equal(g.support.plate, false);
  assert.equal(calls, 0);
  assert.equal(g.damageControl.lastHit, null);
  assert.deepEqual(g.damageControl.summary(), { damage: 0, hits: 0, sources: [] });
  assert.equal(damageHealthTrail(g.damageControl.lastHit, g.time, g.hp), 100);
});
