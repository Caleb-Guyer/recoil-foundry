import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { factoryUnboundTestFromUrl } from '../src/factory-unbound-test.ts';
import { rewardMods, seeded, validBuild } from '../src/rules.ts';
import { SHIFT_MORPHS, isShiftMorph } from '../src/shift-catalog.ts';

test('Rework rotates all four legal morph rewards between runs while preserving each seed and ordinary fitting', () => {
  const cp = factoryUnboundTestFromUrl(
    new URL('https://test/?test=factory-unbound&scene=rework-loop&v=1'),
  )!.checkpoint;
  const seen = new Set<string>();
  for (let i = 0; i < 24; i++) {
    const g = new Game();
    let writes = 0;
    g.onCheckpoint = () => writes++;
    const scene = { ...structuredClone(cp), seed: 'SHIFT-107-REWORK-' + i };
    g.startTest(scene);
    assert.equal(g.shiftRoutes.kind, 'rework-loop');
    const ordinary = rewardMods(g.mods, 3, seeded(g.seed), { stage: g.stage, seed: g.seed });
    const first = g.shiftRun.offers(ordinary),
      again = g.shiftRun.offers(ordinary);
    assert.deepEqual(first, again);
    assert.equal(first.length, 3);
    assert.equal(first.filter((m) => isShiftMorph(m.id)).length, 2);
    assert.equal(new Set(first.map((m) => m.id)).size, 3);
    assert(first.every((m) => validBuild([...g.mods, m.id])));
    assert(first.some((m) => ordinary.some((o) => o.id === m.id)));
    for (const m of first) if (isShiftMorph(m.id)) seen.add(m.id);
    assert.equal(writes, 0);
    Matter.Composite.clear(g.engine.world, false);
    Matter.Engine.clear(g.engine);
  }
  assert.deepEqual([...seen].sort(), [...SHIFT_MORPHS].sort());
});
