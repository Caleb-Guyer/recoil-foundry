import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { loadCheckpoint, getGun } from '../src/rules.ts';
import { getLevel } from '../src/levels.ts';
import { UPRISING_ROUTES, uprisingRoute } from '../src/uprising-model.ts';
import {
  uprisingRemasterTestFromUrl,
  uprisingRemasterTestIdentity,
  UPRISING_REMASTER_TEST_ROUTES,
} from '../src/uprising-remaster-test.ts';
import { UPRISING_REMASTER_ROOMS } from '../src/uprising-remaster-rooms.ts';

const base = 'https://test/?test=uprising-remaster';
function parsed(route: string) {
  const source = uprisingRemasterTestFromUrl(new URL(`${base}&route=${route}&v=1`));
  assert(source, route);
  return source;
}
function clean(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}

test('all eleven mission fixtures use ordinary native room builds and strict legal isolated checkpoints', () => {
  const seeds = new Set<string>();
  for (const route of UPRISING_ROUTES) {
    const source = parsed(route.id),
      cp = source.checkpoint;
    assert(loadCheckpoint(cp), JSON.stringify(cp));
    assert.equal(source.scene, 'job');
    assert.equal(cp.version, 6);
    assert.equal(cp.stage, route.fork + 1);
    assert.equal(cp.startingGun, 'pistol');
    assert.equal(cp.hp, 100);
    assert.equal(cp.kills, 0);
    assert.equal(cp.elapsed, 0);
    assert.equal(cp.mods.length, cp.stage);
    assert.equal(cp.uprising?.version, 3);
    assert.equal(cp.uprising?.choices.at(-1), route.id);
    assert.equal(cp.uprising?.outcomes.length, cp.uprising!.choices.length - 1);
    assert.equal(cp.reward, undefined);
    assert.deepEqual(uprisingRemasterTestIdentity(cp.seed), { route: route.id, scene: 'job' });
    assert.deepEqual(parsed(route.id), source);
    seeds.add(cp.seed);
    const g = new Game();
    let writes = 0;
    g.onCheckpoint = () => writes++;
    g.onUprisingMission = () => writes++;
    g.startTest(cp);
    assert.equal(g.level.id, 'uprising-' + route.id);
    assert.deepEqual(g.level.solids, UPRISING_REMASTER_ROOMS[route.id].solids);
    assert.deepEqual(g.gun, getGun(cp.mods, 'pistol'));
    assert.deepEqual(g.mods, cp.mods);
    g.save();
    assert.equal(writes, 0);
    clean(g);
  }
  assert.equal(seeds.size, 11);
});

test('choice, pending payment and natural consequence scenes remain legal and make no fake combat victory', () => {
  for (const route of ['choose', 'rewards', 'consequences']) {
    const source = parsed(route),
      cp = source.checkpoint;
    assert(loadCheckpoint(cp), JSON.stringify(cp));
    assert.equal(source.scene, route);
    assert.deepEqual(uprisingRemasterTestIdentity(cp.seed), { route, scene: route });
    assert(cp.seed.length <= 40);
    assert.equal(cp.hp, route === 'rewards' ? 64 : 100);
    if (route === 'choose') {
      assert.equal(cp.stage, 4);
      assert.equal(cp.uprising?.choices.length, 0);
      assert(cp.reward?.offers.length);
    }
    if (route === 'rewards') {
      assert.equal(cp.stage, 5);
      assert.equal(cp.uprising?.outcomes[0].route, 'rail-heist');
      assert(cp.uprising?.outcomes[0].reward);
      assert.equal(cp.uprising?.outcomes[0].reward?.selected, undefined);
      assert(cp.reward?.offers.length);
    }
    if (route === 'consequences') {
      assert.equal(cp.stage, 11);
      assert.equal(cp.reward, undefined);
      assert.equal(getLevel(cp.seed, 11).spawns[0].kind, 'turbine');
      assert(
        cp.uprising?.outcomes.some((o) => o.route === 'core-sabotage' && o.result === 'success'),
      );
    }
  }
});

test('fixture URL parsing rejects duplicate, unsupported, ambiguous and conflicting state', () => {
  for (const suffix of [
    '',
    '&v=0',
    '&v=2',
    '&v=01',
    '&v=1&v=1',
    '&v=1&test=uprising-remaster',
    '&v=1&route=rail-heist&route=rail-heist',
    '&v=1&route=RAIL-HEIST',
    '&v=1&route=',
    '&v=1&route=roof-reliefx',
    '&v=1&mirror=1',
    '&v=1&mirror=0',
    '&v=1&ng=1',
    '&v=1&seed=RF-C105-X',
    '&v=1&daily=x',
    '&v=1&hp=1000',
    '&v=1&route=choose&build=all',
  ])
    assert.equal(uprisingRemasterTestFromUrl(new URL(base + suffix)), null, suffix);
  assert.equal(
    uprisingRemasterTestFromUrl(new URL('https://test/?test=uprising&route=rail-heist&v=1')),
    null,
  );
  assert.equal(uprisingRemasterTestFromUrl(new URL(base + '&v=1'))?.route, 'rail-heist');
});

test('only bounded canonical fixture identities are recognized and callers receive independent records', () => {
  for (const route of UPRISING_REMASTER_TEST_ROUTES) {
    const source = parsed(route),
      seed = source.checkpoint.seed;
    assert(uprisingRemasterTestIdentity(seed));
    for (const fake of [
      seed.replace('C105', 'C104'),
      seed.replace('C105', 'D105'),
      seed + '-0',
      seed.replace(/-\d+$/, '-256'),
      seed.replace(/-\d+$/, '-00'),
      seed.replace(/-\d+$/, '--1'),
      seed.replace('JOB', 'JOBS'),
    ])
      assert.equal(uprisingRemasterTestIdentity(fake), null, fake);
    const copy = parsed(route);
    copy.checkpoint.mods.push('fake');
    copy.checkpoint.uprising!.outcomes.length = 0;
    assert.deepEqual(parsed(route), source);
  }
});
