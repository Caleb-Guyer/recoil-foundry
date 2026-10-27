import test from 'node:test';
import assert from 'node:assert/strict';
import { quickShiftTestFromUrl, QUICK_SHIFT_TEST_SCENES } from '../src/quick-shift-test.ts';
import { quickShiftFromUrl, quickShiftLink } from '../src/quick-shift-rules.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';

test('all Quick Shift test scenes bind an explicit native seed and tool', () => {
  for (const scene of QUICK_SHIFT_TEST_SCENES)
    for (const gun of STARTING_GUN_IDS) {
      const fixture = quickShiftTestFromUrl(
        new URL(`https://game.test/?test=quick-shift&scene=${scene}&gun=${gun}&v=1`),
      );
      assert.equal(fixture?.scene, scene);
      assert.equal(fixture?.gun, gun);
      assert.match(fixture!.challenge.seed, /^RF-Q1-[A-Z0-9]+$/);
    }
});
test('private fixtures reject duplicates, mixed modes, unsupported versions and fragments', () => {
  for (const query of [
    'test=quick-shift&v=1&scene=nope',
    'test=quick-shift&v=2',
    'test=quick-shift&v=1&v=1',
    'test=quick-shift&v=1&scene=run&scene=drafts',
    'test=quick-shift&v=1&daily=2026-10-27',
    'test=quick-shift&v=1&seed=INJECT',
    'test=quick-shift&v=1&quick=QUICK531',
    'test=quick-shift&v=1&gun=constructor',
    'test=quick-shift&v=1&extra=true',
    'test=quick-shift&v=1#play',
  ])
    assert.equal(quickShiftTestFromUrl(new URL('https://game.test/?' + query)), null, query);
});
test('run and replay tests share the same authored seed; draft test has its own repeatable seed', () => {
  const fixture = (scene: string) =>
    quickShiftTestFromUrl(new URL(`https://game.test/?test=quick-shift&scene=${scene}&v=1`))!;
  assert.equal(fixture('run').challenge.seed, fixture('seeds').challenge.seed);
  assert.notEqual(fixture('run').challenge.seed, fixture('drafts').challenge.seed);
  assert.deepEqual(fixture('drafts'), fixture('drafts'));
});
test('sharing from a private fixture produces a clean real challenge rather than test parameters', () => {
  const f = quickShiftTestFromUrl(
    new URL('https://game.test/?test=quick-shift&scene=seeds&gun=carbine&v=1'),
  )!;
  const href = quickShiftLink(f.challenge, 'https://game.test/path/?test=old#ignored', f.gun);
  const linked = quickShiftFromUrl(new URL(href));
  assert.deepEqual(linked, { challenge: f.challenge, gun: f.gun });
  assert.equal(new URL(href).searchParams.has('test'), false);
  assert.equal(quickShiftTestFromUrl(new URL(href)), null);
});
