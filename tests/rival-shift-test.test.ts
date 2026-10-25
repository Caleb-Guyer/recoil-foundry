import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { getLevel } from '../src/levels.ts';
import { getOvertimeLevel, overtimeHealth } from '../src/overtime.ts';
import { enemyHealth } from '../src/enemies.ts';
import { getGun, loadCheckpoint } from '../src/rules.ts';
import { rivalShiftTestFromUrl, rivalShiftTestIdentity } from '../src/rival-shift-test.ts';
import { RIVAL_SHIFT_BOSSES, type RivalShiftBoss } from '../src/rival-shift-rules.ts';

const BOSSES = Object.keys(RIVAL_SHIFT_BOSSES) as RivalShiftBoss[];
function parsed(boss: RivalShiftBoss, phase = 1, mirror = false, ng = false) {
  const scene = rivalShiftTestFromUrl(
    new URL(
      `https://test/?test=rival-shift&boss=${RIVAL_SHIFT_BOSSES[boss].url}&phase=${phase}&mirror=${mirror ? 1 : 0}&ng=${ng ? 1 : 0}&v=1`,
    ),
  );
  assert(scene);
  return scene;
}
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}

test('twenty Rival Shift links select legal native encounters, both mirrors and all normal/NG+ phases', () => {
  const seeds = new Set<string>();
  for (const boss of BOSSES)
    for (const ng of [false, true])
      for (const phase of ng ? [2, 3] : [1, 2, 3])
        for (const mirror of [false, true]) {
          const scene = parsed(boss, phase, mirror, ng),
            cp = scene.checkpoint;
          assert.deepEqual(rivalShiftTestIdentity(cp.seed), {
            boss,
            phase: phase - 1,
            mirror,
            ng,
            stage: RIVAL_SHIFT_BOSSES[boss].stage,
          });
          assert(cp.seed.startsWith('RF-C104-') && cp.seed.length < 40);
          assert.equal(cp.hp, 100);
          assert.equal(cp.version, 6);
          assert.equal(cp.startingGun, 'pistol');
          assert.equal(cp.kills, 0);
          assert.equal(cp.elapsed, 0);
          assert.equal(cp.encounters, 1);
          assert.equal(cp.bossRemix, undefined);
          assert.equal(cp.bossRemixes, undefined);
          assert(loadCheckpoint(cp), `${boss}/${phase}/${mirror}/${ng} is a legal checkpoint`);
          if (ng) {
            assert.deepEqual(cp.overtime, { baseMods: 8, repairs: 0, remix: 5 });
            assert.equal(cp.mods.length, 8 + cp.stage);
            assert.equal(cp.missedUpgrades, 11);
          } else {
            assert.equal(cp.overtime, undefined);
            assert.equal(cp.mods.length, cp.stage);
          }
          const native = ng ? getOvertimeLevel(cp.seed, cp.stage, 5) : getLevel(cp.seed, cp.stage);
          assert.equal(native.spawns[0].kind, boss);
          assert.equal(native.mirrored, mirror);
          const g = new Game();
          let writes = 0;
          g.onCheckpoint = () => writes++;
          g.onBossDefeated = () => writes++;
          g.onEnemyDefeated = () => writes++;
          g.startTest(cp);
          const e = g.enemies.find((enemy) => enemy.kind === boss);
          assert(e);
          assert.equal(
            g.level.id,
            boss === 'boss' ? 'rival-shift-interceptor' : 'rival-shift-turbine',
          );
          assert.equal(g.level.bossRemaster, boss);
          assert.equal(g.level.mirrored, mirror);
          assert.equal(e.maxHp, ng ? overtimeHealth(boss, cp.stage) : enemyHealth(boss, cp.stage));
          assert.equal(e.hp, e.maxHp * (ng && phase === 2 ? 1 : [1, 0.6, 0.25][phase - 1]));
          assert.equal(g.bossRemaster.rig?.phase, phase - 1);
          assert.deepEqual(g.mods, cp.mods);
          assert.deepEqual(g.gun, getGun(cp.mods, 'pistol'));
          assert.deepEqual(
            g.level.spawns.slice(1).map((s) => s.kind),
            native.spawns.slice(1).map((s) => s.kind),
          );
          g.save();
          assert.equal(writes, 0, 'fixtures never write Continue or award progress');
          dispose(g);
          seeds.add(cp.seed);
        }
  assert.equal(seeds.size, 20);
});

test('Rival Shift parser rejects duplicate, unknown, ambiguous or conflicting URL state', () => {
  for (const tail of [
    '',
    '&v=',
    '&v=0',
    '&v=2',
    '&v=01',
    '&v=1&v=1',
    '&v=1&test=rival-shift',
    '&v=1&boss=',
    '&v=1&boss=boss',
    '&v=1&boss=Turbine',
    '&v=1&boss=reclaimer',
    '&v=1&boss=constructor',
    '&v=1&boss=__proto__',
    '&v=1&boss=turbine&boss=interceptor',
    '&v=1&phase=0',
    '&v=1&phase=4',
    '&v=1&phase=01',
    '&v=1&phase=1.0',
    '&v=1&phase=2&phase=3',
    '&v=1&mirror=true',
    '&v=1&mirror=',
    '&v=1&mirror=2',
    '&v=1&mirror=0&mirror=1',
    '&v=1&ng=2',
    '&v=1&ng=true',
    '&v=1&ng=0&ng=1',
    '&v=1&ng=1&phase=1',
    '&v=1&seed=custom',
    '&v=1&daily=2026-10-25',
    '&v=1&mode=overtime',
    '&v=1&build=forge',
  ])
    assert.equal(
      rivalShiftTestFromUrl(new URL('https://test/?test=rival-shift' + tail)),
      null,
      tail,
    );
  assert.equal(rivalShiftTestFromUrl(new URL('https://test/?test=first-shift&v=1')), null);
  assert.equal(rivalShiftTestFromUrl(new URL('https://test/?v=1')), null);
  const normal = rivalShiftTestFromUrl(new URL('https://test/?test=rival-shift&v=1'))!;
  const ng = rivalShiftTestFromUrl(new URL('https://test/?test=rival-shift&ng=1&v=1'))!;
  assert.equal(normal.boss, 'turbine');
  assert.equal(normal.phase, 0);
  assert.equal(ng.phase, 1);
});

test('only bounded canonical fixture identities grant phase-preview health; fixture records are independent', () => {
  const scene = parsed('turbine'),
    seed = scene.checkpoint.seed;
  for (const forged of [
    seed.replace('C104', 'C103'),
    seed.replace('C104', 'D104'),
    seed.replace('-RS-T-', '-RS-B-'),
    seed.replace('-1-N-C-', '-0-N-C-'),
    seed.replace('-1-N-C-', '-4-N-C-'),
    seed.replace('-1-N-C-', '-1-X-C-'),
    seed.replace('-1-N-C-', '-1-N-X-'),
    seed.replace('-1-N-C-', '-1-N-O-'),
    seed.replace(/-\d+$/, '-256'),
    seed.replace(/-\d+$/, '-999'),
    seed.replace(/-\d+$/, '-00'),
    seed + '-extra',
    'RF-C104-HISTORY',
    'RF-C104-OT-HISTORY',
  ])
    assert.equal(rivalShiftTestIdentity(forged), null, forged);
  const original = structuredClone(scene);
  scene.checkpoint.mods.push('bad-fixture-mutation');
  scene.checkpoint.hp = 1;
  assert.deepEqual(parsed('turbine'), original);
});
