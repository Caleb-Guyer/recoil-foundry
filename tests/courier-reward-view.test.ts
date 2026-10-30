import test from 'node:test';
import assert from 'node:assert/strict';
import { courierRewardCue } from '../src/courier-reward-view.ts';
test('real cargo bonus explains the extra choice and its unchanged healing and room rules', () => {
  const cue = courierRewardCue(true, 4, { stage: 4, status: 'collected' });
  assert.match(cue, /Recovered cargo/);
  assert.match(cue, /No healing or room advance/);
  assert.match(cue, /normal reward follows/);
});
test('normal reward cue follows a claimed case only in its actual recovery room', () => {
  assert.match(courierRewardCue(false, 4, { stage: 4, status: 'claimed' }), /Cargo fitted/);
  assert.equal(courierRewardCue(false, 5, { stage: 4, status: 'claimed' }), '');
  for (const status of ['pending', 'lost', 'collected'] as const)
    assert.equal(courierRewardCue(false, 4, { stage: 4, status }), '');
  assert.equal(courierRewardCue(false, 4, null), '');
});
