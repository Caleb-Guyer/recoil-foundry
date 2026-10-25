import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { loadCheckpoint } from '../src/rules.ts';
import { getRouteLevel } from '../src/route-layouts.ts';
import {
  CHOOSE_ROUTE_ROOMS,
  CHOOSE_ROUTE_ROOM_IDS,
  chooseRouteTestFromUrl,
  chooseRouteTestIdentity,
} from '../src/choose-route-test.ts';
function fixture(room = 'boiler-tunnels', scene = 'room', mirror = false) {
  return chooseRouteTestFromUrl(
    new URL(
      'https://test/?test=route-choice&scene=' +
        scene +
        '&room=' +
        room +
        '&mirror=' +
        (mirror ? '1' : '0') +
        '&v=1',
    ),
  );
}
function clean(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}

test('all route links use valid isolated checkpoints, bounded identities and native mirrors', () => {
  for (const room of CHOOSE_ROUTE_ROOM_IDS)
    for (const mirror of [false, true]) {
      const actual = fixture(room, 'room', mirror)!,
        preview = fixture(room, 'preview', mirror)!;
      assert(actual && preview);
      const plan = CHOOSE_ROUTE_ROOMS[room];
      assert.equal(actual.room, room);
      assert.equal(actual.checkpoint.stage, plan.stage);
      assert.equal(preview.checkpoint.stage, plan.stage - 1);
      assert.equal(actual.checkpoint.seed, preview.checkpoint.seed);
      assert.equal(actual.checkpoint.route, plan.route);
      assert.equal(preview.checkpoint.route, undefined);
      assert(actual.checkpoint.seed.length < 40);
      assert.equal(getRouteLevel(actual.checkpoint.seed, plan.stage, plan.route).mirrored, mirror);
      assert.deepEqual(chooseRouteTestIdentity(actual.checkpoint.seed), {
        room,
        route: plan.route,
        mirror,
        destinationStage: plan.stage,
      });
      for (const link of [actual, preview]) {
        const cp = link.checkpoint;
        assert.equal(cp.version, 6);
        assert.equal(cp.startingGun, 'pistol');
        assert.equal(cp.hp, 100);
        assert.deepEqual(cp.mods, []);
        assert.equal(cp.missedUpgrades, cp.stage);
        assert.equal(cp.encounters, 1);
        assert.equal(cp.teamwork, 1);
        assert(loadCheckpoint(cp), room + ' ' + link.scene);
        assert.deepEqual(fixture(room, link.scene, mirror), link);
      }
    }
});

test('strict route-choice URLs reject ambiguity, unsupported scenes, extra state and malformed versions', () => {
  const prefix = 'https://test/?test=route-choice';
  for (const tail of [
    '',
    '&v=2',
    '&v=',
    '&v=1&v=1',
    '&v=1&test=routes',
    '&v=1&scene=other',
    '&v=1&scene=room&scene=preview',
    '&v=1&room=unknown',
    '&v=1&room=__proto__',
    '&v=1&room=boiler-tunnels&room=flue-bridges',
    '&v=1&mirror=2',
    '&v=1&mirror=true',
    '&v=1&mirror=0&mirror=1',
    '&v=1&daily=x',
    '&v=1&seed=RF-C101-other',
    '&v=1&mode=overtime',
    '&v=1&area=furnace',
    '&v=1&route=high',
  ])
    assert.equal(chooseRouteTestFromUrl(new URL(prefix + tail)), null, tail);
  assert(chooseRouteTestFromUrl(new URL(prefix + '&v=1')));
  assert.equal(chooseRouteTestFromUrl(new URL('https://test/?test=routes&v=1')), null);
  for (const seed of [
    'RF-C100-ROUTE-6-L-M-0',
    'RF-C101-ROUTE-7-L-M-0',
    'RF-C101-ROUTE-6-L-M-256',
    'RF-C101-ROUTE-6-X-M-0',
    'RF-C101-ROUTE-6-L-Z-0',
    'custom',
  ])
    assert.equal(chooseRouteTestIdentity(seed), null, seed);
});

test('direct links load the four actual remastered rooms in both mirrors with native enemies', () => {
  for (const room of CHOOSE_ROUTE_ROOM_IDS)
    for (const mirror of [false, true]) {
      const result = fixture(room, 'room', mirror)!,
        g = new Game();
      let writes = 0;
      g.onCheckpoint = () => writes++;
      g.onCommendation = () => writes++;
      g.onCampaignClear = () => writes++;
      g.startTest(result.checkpoint);
      assert.equal(g.mode, 'playing');
      assert.equal(g.level.id, CHOOSE_ROUTE_ROOMS[room].id);
      assert.equal(g.level.mirrored, mirror);
      assert.equal(g.level.routeChoice, CHOOSE_ROUTE_ROOMS[room].route);
      assert(g.enemies.length || g.waves.pending, 'actual combat remains');
      assert.equal(g.hp, 100);
      assert.deepEqual(g.mods, []);
      assert.equal(writes, 0);
      clean(g);
    }
});

test('cleared fork fixtures resolve the exact native destination without changing source progress', () => {
  for (const room of CHOOSE_ROUTE_ROOM_IDS)
    for (const mirror of [false, true]) {
      const source = fixture(room, 'preview', mirror)!,
        target = fixture(room, 'room', mirror)!;
      const fork = new Game();
      let writes = 0;
      fork.onCheckpoint = () => writes++;
      fork.onCommendation = () => writes++;
      fork.onCampaignClear = () => writes++;
      fork.onEnemyDefeated = () => writes++;
      fork.startTest(source.checkpoint);
      assert(fork.clear, 'only explicit preview fixtures start cleared');
      assert.equal(fork.enemies.length, 0);
      assert(!fork.waves.pending);
      assert.deepEqual(fork.routeHistory, []);
      const before = fork.checkpointSnapshot(),
        preview = fork.createRoutePreview(CHOOSE_ROUTE_ROOMS[room].route);
      assert(preview);
      const destination = new Game();
      destination.startTest(target.checkpoint);
      assert.deepEqual(preview.level, destination.level);
      assert.equal(preview.level.mirrored, mirror);
      assert.deepEqual(fork.checkpointSnapshot(), before);
      assert.equal(writes, 0);
      clean(fork);
      clean(destination);
    }
});

test('high-route fork fixtures remain on their real step while idle and ordinary right movement enters the advertised route', () => {
  const idle = {
    left: false,
    right: false,
    jump: false,
    jumpHeld: false,
    fire: false,
    aim: { x: 1800, y: 420 },
  };
  for (const room of ['flue-bridges', 'cooling-towers'] as const)
    for (const mirror of [false, true]) {
      const parsed = fixture(room, 'preview', mirror)!;
      const g = new Game();
      let writes = 0;
      g.onCheckpoint = () => writes++;
      g.onCommendation = () => writes++;
      g.startTest(parsed.checkpoint);
      for (let i = 0; i < 120; i++) g.tick(1 / 60, idle);
      assert.equal(g.mode, 'playing', room + ' must not select a route while idle');
      assert(g.grounded, room + ' must remain supported on the native high step');
      assert(
        Math.abs(g.player.position.y - (g.branchDoor.floor - 18)) < 3,
        room + ' must not fall to the low exit',
      );
      assert.equal(g.nearbyRoutePreview?.route, 'high');
      assert.equal(g.nearbyRoutePreview?.level.id, CHOOSE_ROUTE_ROOMS[room].id);
      for (let i = 0; i < 12 && g.mode === 'playing'; i++) g.tick(1 / 60, { ...idle, right: true });
      assert.equal(
        g.mode,
        'upgrade',
        room + ' should open its reward by walking across the threshold',
      );
      assert.equal(g.enteringRoute, 'high');
      assert.deepEqual(g.routeHistory, [], 'the pending fitting is not a committed route');
      g.chooseMod(g.offers[0].id);
      assert.equal(g.level.id, CHOOSE_ROUTE_ROOMS[room].id);
      assert.equal(g.level.mirrored, mirror);
      assert.deepEqual(g.routeHistory, [{ stage: CHOOSE_ROUTE_ROOMS[room].stage, route: 'high' }]);
      assert.equal(writes, 0, 'the entire isolated test grants no saved progress');
      clean(g);
    }
});
