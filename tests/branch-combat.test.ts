import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.ts';
import { BRANCH_TEST_BUILDS, branchTestFromUrl } from '../src/branch-builds.ts';
import { playRoom as play } from './room-pilot.ts';

test('every branch preset fights real rooms in both orientations with ordinary health and input', (t) => {
  const results = [];
  for (const build of Object.keys(BRANCH_TEST_BUILDS))
    for (const mirror of [0, 1]) {
      const g = new Game();
      g.startTest(
        branchTestFromUrl(new URL(`https://test/?test=branches&build=${build}&mirror=${mirror}`))!,
      );
      assert.equal(g.hp, 100);
      const result = { build, mirror, ...play(g, 65) };
      results.push(result);
      assert(result.clear, JSON.stringify(result));
    }
  t.diagnostic(JSON.stringify(results));
});

test('each beam specialization damages the live final boss without an invincibility fixture', (t) => {
  for (const build of ['pulse', 'charge', 'prism']) {
    const g = new Game();
    g.startTest(
      branchTestFromUrl(new URL(`https://test/?test=branches&build=${build}&room=boss`))!,
    );
    const boss = g.enemies.find((e) => e.kind === 'interceptor')!;
    assert(boss);
    const hp = boss.hp;
    const result = play(g, 45);
    assert(hp - boss.hp > hp * 0.15, JSON.stringify({ build, hp, remaining: boss.hp, result }));
    t.diagnostic(JSON.stringify({ build, bossDamage: hp - boss.hp, bossMaxHp: hp, ...result }));
  }
});
