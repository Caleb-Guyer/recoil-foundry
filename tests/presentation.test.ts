import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.ts';
import { loadCheckpoint } from '../src/rules.ts';
import { snapshotRun } from '../src/run-history.ts';
import { presentationTestFromUrl, finishPresentationTest } from '../src/presentation-test.ts';
import { endingCopy } from '../src/ending.ts';

test('result previews exercise real ending states without progress writes or earned records', () => {
  for (const scene of ['escape', 'overtime', 'shutdown']) {
    const save = presentationTestFromUrl(
      new URL('https://test.invalid/?test=presentation&scene=' + scene),
    )!;
    assert.ok(loadCheckpoint(save), scene + ' must remain a legal isolated checkpoint');
    const game = new Game();
    let writes = 0;
    game.onCheckpoint = () => writes++;
    game.startTest(save);
    assert.equal(finishPresentationTest(game), true);
    assert.equal(game.mode, 'won');
    assert.equal(game.shutdown.complete, scene === 'shutdown');
    assert.equal(!!game.overtime, scene === 'overtime');
    assert.equal(snapshotRun(game, 'preview'), null);
    assert.equal(game.commendations.eligible, false);
    game.save();
    assert.equal(writes, 0);
    const copy = endingCopy(game.shutdown.complete, !!game.overtime);
    assert.ok(copy.title && copy.note);
    assert.doesNotMatch(endingCopy(false, false).note, /shutdown|continuity|overtime/i);
  }
});

test('presentation links reject mixed modes and cannot finish ordinary runs', () => {
  for (const query of [
    'test=presentation&daily=2026-09-20',
    'test=presentation&scene=unknown',
    'test=presentation&seed=anything',
    'test=presentation&test=presentation',
    'test=presentation&scene=escape&scene=shutdown',
    'test=shutdown',
  ])
    assert.equal(presentationTestFromUrl(new URL('https://test.invalid/?' + query)), null);
  const game = new Game();
  game.start('PRESENTATION-ESCAPE');
  assert.equal(finishPresentationTest(game), false);
  assert.equal(game.mode, 'playing');
});
