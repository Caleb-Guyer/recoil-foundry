import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { loadCheckpoint, validBuild } from '../src/rules.ts';
import { cinemaSolids } from '../src/finale-director.ts';
import { finalePreview } from '../src/final-arsenal.ts';
import { reclaimerPressureTestFromUrl } from '../src/reclaimer-pressure-test.ts';
import {
  RECLAIMER_ARSENAL_FORMS,
  reclaimerArsenalTestFromUrl,
  prepareReclaimerArsenalTest,
} from '../src/reclaimer-arsenal-test.ts';

const url = (query = '') => new URL('https://test.invalid/?test=arsenal&v=1' + query);
function fixture(query = '') {
  const f = reclaimerArsenalTestFromUrl(url(query));
  assert(f, query);
  return f;
}
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}

test('all six advertised Arsenal encounters and their mirrors retain legal native builds', () => {
  for (const [phase, form] of RECLAIMER_ARSENAL_FORMS.entries())
    for (const fight of ['campaign', 'overtime'])
      for (const mirror of [0, 1]) {
        const f = fixture(`&form=${form}&fight=${fight}&mirror=${mirror}`),
          overtime = fight === 'overtime';
        assert(loadCheckpoint(f.checkpoint), `${form}/${fight}/${mirror}`);
        assert(validBuild(f.checkpoint.mods));
        assert.equal(f.phase, phase);
        assert.equal(f.overtime, overtime);
        assert.equal(f.checkpoint.hp, 100);
        assert.equal(f.checkpoint.startingGun, 'pistol');
        assert.equal(f.checkpoint.stage, 19);
        assert.equal(f.checkpoint.mods.length, overtime ? 38 : 19);
        assert.equal(f.checkpoint.reward, undefined);
        assert.equal(f.checkpoint.uprising, undefined);
        assert.equal(f.checkpoint.finaleFirstClear, overtime ? 0 : 1);
        assert.equal(
          f.checkpoint.seed,
          `RF-C108-F-${overtime ? 'O' : 'C'}-${phase + 1}-A-0-${mirror}`,
        );
        assert.deepEqual(finalePreview(f.checkpoint.seed), {
          overtime,
          phase,
          attack: undefined,
          arena: 0,
          mirror: !!mirror,
        });
        assert(f.title.includes(['Chassis', 'Siege', 'Rupture'][phase]));
        assert(f.hint.includes('Continue, unlocks and records untouched'));
        if (overtime) {
          assert(f.title.includes('New Game+'));
          assert.equal(f.checkpoint.overtime!.baseMods, 19);
          assert(f.hint.includes('full warnings'));
        }
      }
});

test('Arsenal links enter their full-health form with physical collision and a clear mirrored spawn', () => {
  for (const [phase, form] of RECLAIMER_ARSENAL_FORMS.entries())
    for (const fight of ['campaign', 'overtime'])
      for (const mirror of [0, 1]) {
        const f = fixture(`&form=${form}&fight=${fight}&mirror=${mirror}`),
          g = new Game();
        g.startTest(f.checkpoint);
        assert(prepareReclaimerArsenalTest(g, f));
        assert.equal(g.seed, f.checkpoint.seed);
        assert.equal(g.finale.cinema!.state, ['duel', 'siege', 'rupture'][phase]);
        assert.equal(g.finale.phase, phase);
        assert.equal(g.level.mirrored, !!mirror);
        assert.equal(!!g.overtime, fight === 'overtime');
        assert.deepEqual(g.level.solids, cinemaSolids(phase, !!mirror));
        const boss = g.finale.enemy!;
        assert.equal(boss.hp, boss.maxHp);
        assert.equal(boss.body.isSensor, false);
        assert(boss.body.collisionFilter.mask! > 0);
        assert(!g.terrain.some((terrain) => Matter.Collision.collides(g.player, terrain)));
        assert(!Matter.Collision.collides(g.player, boss.body));
        assert.deepEqual(g.player.position, { x: mirror ? 1400 : 600, y: 718 });
        assert.equal(g.level.name, f.title);
        assert.equal(g.startingGun, 'pistol');
        assert.deepEqual(g.mods, f.checkpoint.mods);
        dispose(g);
      }
});

test('Arsenal retries restore form, health, loadout and position without profile callbacks or fixture mutation', () => {
  for (const form of RECLAIMER_ARSENAL_FORMS) {
    const f = fixture(`&form=${form}&fight=overtime&mirror=1`),
      before = JSON.stringify(f),
      g = new Game();
    let writes = 0;
    g.onCheckpoint = () => writes++;
    g.onEnemyDefeated = () => writes++;
    g.onBossDefeated = () => writes++;
    g.onCommendation = () => writes++;
    for (let attempt = 0; attempt < 2; attempt++) {
      g.startTest(f.checkpoint);
      assert(prepareReclaimerArsenalTest(g, f));
      assert.equal(g.finale.phase, f.phase);
      assert.equal(g.finale.enemy!.hp, g.finale.enemy!.maxHp);
      assert.equal(g.hp, 100);
      assert.equal(g.startingGun, 'pistol');
      assert.deepEqual(g.mods, f.checkpoint.mods);
      assert.deepEqual(g.player.position, { x: 1400, y: 718 });
      g.save();
      g.damagePlayer(10000);
      assert.equal(g.mode, 'dead');
    }
    assert.equal(writes, 0);
    assert.equal(JSON.stringify(f), before);
    dispose(g);
  }
});

test('5.27.1 pressure links keep their original generation and Arsenal preparation cannot alter other runs', () => {
  const f = fixture(),
    g = new Game(),
    old = reclaimerPressureTestFromUrl(
      new URL('https://test.invalid/?test=reclaimer&v=1&phase=3'),
    )!;
  assert(old.checkpoint.seed.startsWith('RF-C107-'));
  assert.equal(finalePreview(old.checkpoint.seed)!.phase, 2);
  g.start(f.checkpoint.seed, f.checkpoint);
  const normal = JSON.stringify(g.checkpointSnapshot());
  assert.equal(prepareReclaimerArsenalTest(g, f), false);
  assert.equal(JSON.stringify(g.checkpointSnapshot()), normal);
  assert.equal(g.finale.cinema!.state, 'approach');
  g.startTest(old.checkpoint);
  const archived = JSON.stringify(g.checkpointSnapshot());
  assert.equal(prepareReclaimerArsenalTest(g, f), false);
  assert.equal(JSON.stringify(g.checkpointSnapshot()), archived);
  assert.equal(prepareReclaimerArsenalTest(g, null), false);
  dispose(g);
});

test('Arsenal queries reject ambiguous values and profile, route, stat or attack overrides', () => {
  for (const suffix of [
    '&test=arsenal',
    '&v=1',
    '&form=chassis&form=siege',
    '&fight=campaign&fight=overtime',
    '&mirror=0&mirror=1',
    '&hp=9999',
    '&unlocks=all',
    '&daily=2026-10-26',
    '&seed=RF-C108',
    '&attack=sweep',
    '&build=reported',
    '&route=isolated',
    '&phase=2',
    '&first=0',
    '&form=constructor',
    '&form=__proto__',
    '&form=Chassis',
    '&form=',
    '&fight=ngplus',
    '&fight=',
    '&mirror=2',
  ])
    assert.equal(reclaimerArsenalTestFromUrl(url(suffix)), null, suffix);
  assert.equal(reclaimerArsenalTestFromUrl(new URL('https://test/?test=arsenal')), null);
  assert.equal(reclaimerArsenalTestFromUrl(new URL('https://test/?test=arsenal&v=2')), null);
  assert.equal(reclaimerArsenalTestFromUrl(new URL('https://test/?test=finale&v=1')), null);
  assert.equal(reclaimerArsenalTestFromUrl(new URL('https://test/?test=reclaimer&v=1')), null);
});
