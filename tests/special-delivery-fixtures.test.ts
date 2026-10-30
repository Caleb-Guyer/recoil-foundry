import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { loadCheckpoint, validBuild } from '../src/rules.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import {
  DELIVERY_SCENES,
  specialDeliveryFromUrl,
  specialDeliveryRoom,
  prepareSpecialDelivery,
} from '../src/special-delivery-test.ts';
import { COURIER_DOOR_TIME } from '../src/courier.ts';
const parse = (q = '') =>
  specialDeliveryFromUrl(new URL('https://test/?test=special-delivery&v=1&' + q));
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1000, y: 700 },
};
function course(q: string) {
  const f = parse(q)!;
  const g = new Game();
  g.startTest(f.checkpoint);
  assert(prepareSpecialDelivery(g, f));
  return { g, f };
}
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function step(g: Game, n: number) {
  for (let i = 0; i < n; i++) g.tick(1 / 60, idle);
}
test('all delivery scenes and both native arrangements reconstruct legal private checkpoints for six tools', () => {
  for (const scene of DELIVERY_SCENES)
    for (const gun of STARTING_GUN_IDS)
      for (const mirror of ['', '&mirror=1']) {
        const f = parse('scene=' + scene + '&gun=' + gun + mirror)!;
        assert(f);
        assert(loadCheckpoint(f.checkpoint));
        assert(validBuild(f.checkpoint.mods));
        if (scene === 'logbook') continue;
        const { g } = course('scene=' + scene + '&gun=' + gun + mirror);
        assert.equal(g.startingGun, gun);
        assert.deepEqual(g.level.solids, specialDeliveryRoom(f).solids);
        assert(!g.testRun?.rematchRoom);
        if (scene === 'rewards') assert.equal(g.mode, 'upgrade');
        else {
          assert.equal(g.enemies.length, 1);
          assert(g.courier.enemy);
          assert.equal(g.kills, 0);
          assert.equal(g.waves.pending, false);
        }
        dispose(g);
      }
});
test('escape inspection spends a complete native hatch opening then loses the courier without cargo, rewards or kill', () => {
  for (const mirror of ['', '&mirror=1']) {
    const { g } = course('scene=escape' + mirror);
    let openFrames = 0;
    for (let i = 0; i < 360 && g.courier.enemy; i++) {
      step(g, 1);
      if (g.courier.opening > 0) openFrames++;
    }
    assert(openFrames >= COURIER_DOOR_TIME * 60 - 2);
    assert(!g.courier.enemy && !g.courier.cargo);
    assert.equal(g.courier.state?.status, 'lost');
    assert.equal(g.kills, 0);
    assert.equal(g.mode, 'playing');
    assert(!g.courierReward);
    dispose(g);
  }
});
test('cargo inspection uses an actual defeat, line-of-sight pickup and the native two-choice reward sequence', () => {
  const { g } = course('scene=cargo');
  step(g, 45);
  const e = g.courier.enemy!;
  g.hitEnemy(e, 10000, { x: e.body.position.x - 100, y: e.body.position.y });
  assert(g.courier.cargo);
  assert(!g.courier.enemy);
  Matter.Body.setPosition(g.player, { ...g.courier.cargo.position });
  g.courier.update(1 / 60);
  assert.equal(g.courier.state?.status, 'collected');
  step(g, 3);
  assert.equal(g.mode, 'playing');
  g.hp = 64;
  g.openReward();
  assert(g.courierReward);
  const stage = g.stage,
    count = g.mods.length;
  g.chooseMod(g.offers[0].id);
  assert.equal(g.stage, stage);
  assert.equal(g.hp, 64);
  assert.equal(g.mods.length, count + 1);
  assert.equal(g.courier.state?.status, 'claimed');
  assert.equal(g.mode, 'upgrade');
  assert(!g.courierReward);
  g.chooseMod(g.offers[0].id);
  assert.equal(g.stage, stage + 1);
  assert.equal(g.mods.length, count + 2);
  dispose(g);
});
test('rewards sample restores the existing real bonus followed by a normal upgrade with no duplicate healing', () => {
  const { g } = course('scene=rewards');
  assert(g.courierReward);
  const hp = g.hp,
    stage = g.stage,
    count = g.mods.length;
  assert.equal(hp, 64);
  const pick = g.offers[0].id;
  g.chooseMod(pick);
  assert.equal(g.hp, hp);
  assert.equal(g.stage, stage);
  assert.equal(g.mods.length, count + 1);
  assert(!g.courierReward);
  assert.equal(g.mode, 'upgrade');
  g.chooseMod(pick);
  assert.equal(g.mods.length, count + 1);
  dispose(g);
});
test('inspection pause and restart preserve progress and native start state', () => {
  for (const scene of ['animations', 'reactions', 'shutdown', 'wreckage', 'escape', 'cargo']) {
    const { g, f } = course('scene=' + scene);
    let writes = 0;
    g.onCheckpoint = () => writes++;
    g.onEnemyDefeated = () => writes++;
    g.onCommendation = () => writes++;
    step(g, 45);
    g.setMode('paused');
    const time = g.time,
      pos = { ...g.courier.enemy!.body.position };
    step(g, 60);
    assert.equal(g.time, time);
    assert.deepEqual(g.courier.enemy!.body.position, pos);
    g.startTest(f.checkpoint);
    assert(prepareSpecialDelivery(g, f));
    assert.equal(g.kills, 0);
    assert.equal(writes, 0);
    dispose(g);
  }
});
test('unknown, duplicated, mixed and versionless delivery links fail closed', () => {
  for (const q of [
    'scene=nope',
    'scene=animations&scene=cargo',
    'test=courier',
    'gun=nope',
    'gun=pistol&gun=pistol',
    'seed=LIVE',
    'daily=2026-10-30',
    'mirror=0',
    'mirror=1&mirror=1',
    'v=2',
    'scene=escape#x',
  ])
    assert.equal(parse(q), null, q);
  assert.equal(specialDeliveryFromUrl(new URL('https://test/?test=special-delivery')), null);
  const g = new Game();
  assert(!prepareSpecialDelivery(g, parse()));
  dispose(g);
});
