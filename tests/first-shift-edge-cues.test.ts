import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { firstShiftTestFromUrl } from '../src/first-shift-test.ts';
import { incomingEdgeCues } from '../src/combat-readability.ts';
import type { BossRemasterCue, BossRemasterVisual } from '../src/boss-remaster-cues.ts';
function fixture(boss: 'loader' | 'crane' = 'loader') {
  const g = new Game();
  g.startTest(
    firstShiftTestFromUrl(new URL(`https://test/?test=first-shift&boss=${boss}&v=1`))!.checkpoint,
  );
  const e = g.bossRemaster.enemy!;
  e.spawn = 0;
  Matter.Body.setPosition(e.body, { x: 1100, y: 400 });
  const view = { x: 200, y: 100, w: 800, h: 600 };
  function cues(
    warning: BossRemasterCue,
    player = { x: 500, y: 400 },
    stage: BossRemasterVisual['stage'] = 'combat',
  ) {
    const source = {
      owns: (other: typeof e) => other === e,
      rig: { remaining: 0.3 },
      visual: {
        kind: boss,
        center: { ...e.body.position },
        phase: 1,
        stage,
        progress: 1,
        warnings: [warning],
      },
    };
    return incomingEdgeCues([], player, view, g.time, g.solidBodies, 28, [e], () => true, source);
  }
  return {
    g,
    e,
    cues,
    dispose: () => {
      Matter.Composite.clear(g.engine.world, false);
      Matter.Engine.clear(g.engine);
    },
  };
}
const horizontal: BossRemasterCue = {
  kind: 'hull',
  from: { x: 1100, y: 400 },
  to: { x: 600, y: 400 },
  halfWidth: 56,
  halfHeight: 34,
  active: false,
  locked: true,
  progress: 0.9,
};
test('First Shift edge markers retain rectangular hull endpoints and actual upper safe space', () => {
  const f = fixture();
  assert.equal(f.cues(horizontal, { x: 530.9, y: 400 }).length, 0);
  assert.equal(f.cues(horizontal, { x: 531.1, y: 400 }).length, 1);
  assert.equal(f.cues(horizontal, { x: 700, y: 452.1 }).length, 0);
  assert.equal(f.cues(horizontal, { x: 700, y: 451.9 }).length, 1);
  assert.equal(f.cues({ ...horizontal, locked: false }, { x: 700, y: 400 }).length, 0);
  for (const stage of ['startup', 'transition', 'destroyed'] as const)
    assert.equal(f.cues(horizontal, { x: 700, y: 400 }, stage).length, 0);
  f.dispose();
});
test('diagonal physical sweeps never invent a warning throughout their enclosing rectangle', () => {
  const f = fixture();
  const hook: BossRemasterCue = {
    ...horizontal,
    from: { x: 1100, y: 100 },
    to: { x: 400, y: 800 },
    halfWidth: 25,
    halfHeight: 23,
  };
  assert.equal(f.cues(hook, { x: 500, y: 400 }).length, 0);
  assert.equal(f.cues(hook, { x: 600, y: 600 }).length, 1);
  f.dispose();
});
test('Crane edge warnings follow its actual hook rather than its distant rail chassis', () => {
  const f = fixture('crane');
  f.e.crane!.head = { x: 800, y: 400 };
  assert.equal(
    f.cues(horizontal, { x: 700, y: 400 }).length,
    0,
    'visible hook gets no offscreen marker',
  );
  Matter.Body.setPosition(f.e.body, { x: 700, y: 150 });
  f.e.crane!.head = { x: 1100, y: 400 };
  assert.equal(
    f.cues(horizontal, { x: 700, y: 400 }).length,
    1,
    'offscreen hook warns even with its chassis visible',
  );
  f.dispose();
});

test('Crane flak warnings retain the chassis muzzle rather than the visible hook', () => {
  const f = fixture('crane');
  f.e.crane!.head = { x: 800, y: 400 };
  const fan: BossRemasterCue = {
    kind: 'segment',
    from: { x: 1100, y: 400 },
    to: { x: 300, y: 400 },
    width: 10,
    active: false,
    locked: true,
    progress: 0.9,
  };
  assert.equal(f.cues(fan, { x: 500, y: 400 }).length, 1);
  Matter.Body.setPosition(f.e.body, { x: 700, y: 400 });
  f.e.crane!.head = { x: 1100, y: 400 };
  assert.equal(f.cues(fan, { x: 500, y: 400 }).length, 0);
  f.dispose();
});
