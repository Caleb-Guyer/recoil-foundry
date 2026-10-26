import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { loadCheckpoint, validBuild } from '../src/rules.ts';
import { cinemaSolids } from '../src/finale-director.ts';
import {
  RECLAIMER_PRESSURE_ROUTES,
  RECLAIMER_PRESSURE_SPOTS,
  RECLAIMER_REPORTED_MODS,
  reclaimerPressureTestFromUrl,
  prepareReclaimerPressureTest,
} from '../src/reclaimer-pressure-test.ts';

const url = (query = '') => new URL('https://test.invalid/?test=reclaimer&v=1' + query);
function fixture(query = '') {
  const f = reclaimerPressureTestFromUrl(url(query));
  assert(f, query);
  return f;
}
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}

test('all documented phase, tool, route, mirror and position comparisons are legal isolated checkpoints', () => {
  for (const phase of [1, 2, 3])
    for (const mirror of [0, 1])
      for (const build of ['standard', 'reported'])
        for (const spot of RECLAIMER_PRESSURE_SPOTS)
          for (const route of RECLAIMER_PRESSURE_ROUTES) {
            const f = fixture(
              `&phase=${phase}&mirror=${mirror}&build=${build}&spot=${spot}&route=${route}`,
            );
            assert(loadCheckpoint(f.checkpoint), JSON.stringify(f));
            assert(validBuild(f.checkpoint.mods));
            assert.equal(f.checkpoint.hp, 100);
            assert.equal(f.checkpoint.reward, undefined);
            assert.equal(f.checkpoint.stage, 19);
            assert.equal(f.phase, phase - 1);
            assert(f.title.includes(['Chassis', 'Siege', 'Rupture'][phase - 1]));
            assert(f.hint.includes('Continue, unlocks and records untouched'));
            if (build === 'reported') {
              assert.equal(f.checkpoint.startingGun, 'twinbore');
              assert.deepEqual(f.checkpoint.mods, RECLAIMER_REPORTED_MODS);
            }
          }
  for (const phase of [1, 2, 3])
    for (const build of ['standard', 'reported']) {
      const f = fixture(`&phase=${phase}&fight=overtime&build=${build}`);
      assert(loadCheckpoint(f.checkpoint));
      assert.equal(f.checkpoint.overtime!.remix, 5);
      assert.equal(f.checkpoint.mods.length, f.checkpoint.overtime!.baseMods + 19);
      assert.equal(f.checkpoint.uprising, undefined);
      if (build === 'reported') {
        assert.deepEqual(
          f.checkpoint.mods.slice(0, RECLAIMER_REPORTED_MODS.length),
          RECLAIMER_REPORTED_MODS,
        );
        assert(f.hint.includes('plus Overtime fittings'));
      }
    }
});

test('all three forms open directly with full native health, genuine collision and authored mirrored platforms', () => {
  for (const phase of [1, 2, 3])
    for (const mirror of [0, 1])
      for (const spot of ['entry', 'right', 'cover', 'upper']) {
        const f = fixture(`&phase=${phase}&mirror=${mirror}&spot=${spot}`),
          g = new Game();
        g.startTest(f.checkpoint);
        assert(prepareReclaimerPressureTest(g, f));
        assert.equal(g.finale.cinema!.state, ['duel', 'siege', 'rupture'][phase - 1]);
        assert.equal(g.finale.phase, phase - 1);
        assert.equal(g.level.mirrored, !!mirror);
        assert.deepEqual(g.level.solids, cinemaSolids(phase - 1, !!mirror));
        const boss = g.finale.enemy!;
        assert.equal(boss.hp, boss.maxHp);
        assert.equal(boss.body.isSensor, false);
        assert(boss.body.collisionFilter.mask! > 0);
        assert(
          !g.terrain.some((terrain) => Matter.Collision.collides(g.player, terrain)),
          `${phase}/${mirror}/${spot}: clear player spawn`,
        );
        assert(
          !Matter.Collision.collides(g.player, boss.body),
          'A test never starts inside the boss',
        );
        if (spot === 'right') assert.equal(g.player.position.x, mirror ? 470 : 1530);
        assert.equal(g.level.name, f.title);
        dispose(g);
      }
});

test('route comparisons use their actual completed-job consequences', () => {
  for (const route of RECLAIMER_PRESSURE_ROUTES) {
    const f = fixture('&route=' + route),
      g = new Game();
    g.startTest(f.checkpoint);
    assert(prepareReclaimerPressureTest(g, f));
    assert.equal(g.uprising.finale, route === 'standard' ? null : route);
    if (route === 'isolated') {
      assert.deepEqual(g.uprising.run!.choices, [
        'rail-heist',
        'core-sabotage',
        'crew-relief',
        'signal-cut',
      ]);
      assert(g.uprising.run!.outcomes.every((outcome) => outcome.result === 'success'));
    }
    dispose(g);
  }
});

test('retry restores the selected form, location, reported gun and sabotage without changing the source fixture', () => {
  const f = fixture('&phase=3&route=isolated&build=reported&spot=right&mirror=1');
  const before = JSON.stringify(f),
    g = new Game();
  let writes = 0;
  g.onCheckpoint = () => writes++;
  g.onEnemyDefeated = () => writes++;
  g.onBossDefeated = () => writes++;
  g.onCommendation = () => writes++;
  for (let attempt = 0; attempt < 2; attempt++) {
    g.startTest(f.checkpoint);
    assert(prepareReclaimerPressureTest(g, f));
    assert.equal(g.finale.phase, 2);
    assert.equal(g.finale.cinema!.state, 'rupture');
    assert.equal(g.hp, 100);
    assert.equal(g.startingGun, 'twinbore');
    assert.deepEqual(g.mods, RECLAIMER_REPORTED_MODS);
    assert.equal(g.uprising.finale, 'isolated');
    assert.deepEqual(g.player.position, { x: 470, y: 718 });
    g.save();
    g.damagePlayer(10000);
    assert.equal(g.mode, 'dead');
  }
  assert.equal(writes, 0);
  assert.equal(JSON.stringify(f), before);
  dispose(g);
});

test('preparation cannot touch an ordinary Campaign or another isolated scene', () => {
  const f = fixture(),
    g = new Game();
  g.start(f.checkpoint.seed, f.checkpoint);
  const normal = JSON.stringify(g.checkpointSnapshot());
  assert.equal(prepareReclaimerPressureTest(g, f), false);
  assert.equal(JSON.stringify(g.checkpointSnapshot()), normal);
  assert.equal(g.finale.cinema!.state, 'approach');
  g.startTest({ ...f.checkpoint, seed: 'RF-C107-OTHER' });
  const other = JSON.stringify(g.checkpointSnapshot());
  assert.equal(prepareReclaimerPressureTest(g, f), false);
  assert.equal(JSON.stringify(g.checkpointSnapshot()), other);
  assert.equal(prepareReclaimerPressureTest(g, null), false);
  dispose(g);
});

test('strict preview queries reject duplicates, invalid values, profile controls and nonexistent New Game+ route combinations', () => {
  for (const suffix of [
    '&test=reclaimer',
    '&v=1',
    '&phase=2&phase=3',
    '&fight=campaign&fight=overtime',
    '&route=isolated&route=hunted',
    '&build=reported&build=standard',
    '&mirror=0&mirror=1',
    '&spot=right&spot=upper',
    '&hp=9999',
    '&unlocks=all',
    '&daily=2026-10-26',
    '&seed=RF-C107',
    '&attack=sweep',
    '&first=0',
  ])
    assert.equal(reclaimerPressureTestFromUrl(url(suffix)), null, suffix);
  for (const suffix of [
    '&phase=0',
    '&phase=4',
    '&phase=',
    '&fight=ngplus',
    '&route=constructor',
    '&route=__proto__',
    '&build=laser',
    '&spot=roof',
    '&mirror=2',
    '&fight=overtime&route=isolated',
    '&fight=overtime&route=hunted',
    '&fight=overtime&route=mutiny',
    '&fight=overtime&route=overloaded',
  ])
    assert.equal(reclaimerPressureTestFromUrl(url(suffix)), null, suffix);
  assert.equal(reclaimerPressureTestFromUrl(new URL('https://test/?test=reclaimer')), null);
  assert.equal(reclaimerPressureTestFromUrl(new URL('https://test/?test=reclaimer&v=2')), null);
  assert.equal(reclaimerPressureTestFromUrl(new URL('https://test/?test=finale&v=1')), null);
});
