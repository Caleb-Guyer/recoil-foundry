import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { rivalShiftTestFromUrl } from '../src/rival-shift-test.ts';
import { newUprising } from '../src/uprising-model.ts';
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1500, y: 300 },
};
test('Core sabotage keeps Turbine phase machinery disabled in existing C104 runs through both phase changes and Continue', () => {
  for (const mirror of [false, true]) {
    const cp = rivalShiftTestFromUrl(
      new URL(`https://test/?test=rival-shift&boss=turbine&mirror=${mirror ? 1 : 0}&v=1`),
    )!.checkpoint;
    const uprising = newUprising();
    uprising.choices = ['rail-escape', 'core-sabotage'];
    uprising.outcomes = uprising.choices.map((route) => ({ route, result: 'success' }));
    for (const phaseHp of [1, 0.6, 0.25]) {
      const g = new Game();
      g.start(cp.seed, { ...cp, uprising });
      const e = g.bossRemaster.enemy!;
      for (let i = 0; i < 100; i++) g.tick(1 / 60, idle);
      e.hp = e.maxHp * phaseHp;
      for (let i = 0; i < 110; i++) g.tick(1 / 60, idle);
      assert(g.uprising.active);
      assert.equal(g.bossRemaster.rig?.phase, phaseHp === 1 ? 0 : phaseHp === 0.6 ? 1 : 2);
      assert.deepEqual(g.level.fans, []);
      assert.deepEqual(g.crosswind.items, []);
      Matter.Composite.clear(g.engine.world, false);
      Matter.Engine.clear(g.engine);
    }
  }
});
test('unsabotaged Campaign and native New Game+ retain the advertised Turbine phase updrafts', () => {
  for (const ng of [false, true]) {
    const cp = rivalShiftTestFromUrl(
      new URL(`https://test/?test=rival-shift&boss=turbine&phase=3&ng=${ng ? 1 : 0}&v=1`),
    )!.checkpoint;
    const g = new Game();
    g.startTest(cp);
    assert.equal(g.crosswind.items.length, 2);
    assert.equal(g.level.fans?.length, 2);
    Matter.Composite.clear(g.engine.world, false);
    Matter.Engine.clear(g.engine);
  }
});
