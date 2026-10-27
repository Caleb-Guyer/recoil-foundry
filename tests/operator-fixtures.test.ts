import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, type Input } from '../src/game.ts';
import { loadCheckpoint } from '../src/rules.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import { OUTFITS } from '../src/cosmetics.ts';
import {
  operatorTestFromUrl,
  operatorTestRoom,
  prepareOperatorTest,
  OPERATOR_SCENES,
  OPERATOR_MORPHS,
} from '../src/operator-test.ts';
const fixture = (query: string) =>
  operatorTestFromUrl(new URL('https://test/?test=operator&v=1&' + query));
const input: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1250, y: 500 },
};
test('Operator links cover four native private scenes, every earned tool and actual conversions', () => {
  for (const scene of OPERATOR_SCENES)
    for (const gun of STARTING_GUN_IDS)
      for (const outfit of Object.keys(OUTFITS)) {
        const f = fixture(`scene=${scene}&gun=${gun}&outfit=${outfit}`)!;
        assert(f);
        assert(loadCheckpoint(f.checkpoint));
        assert.equal(f.gun, gun);
        assert.equal(f.outfit, outfit);
        const room = operatorTestRoom(f);
        assert.equal(room.area, 'cooling');
        assert(!room.boss);
        assert(room.solids.some((s) => s.h === 22));
        assert(room.coolant?.length);
      }
  for (const morph of Object.keys(OPERATOR_MORPHS)) {
    const f = fixture(`scene=grips&morph=${morph}`)!;
    assert(f, morph);
    assert(loadCheckpoint(f.checkpoint));
    const g = new Game();
    g.startTest(f.checkpoint, operatorTestRoom(f));
    assert(prepareOperatorTest(g, f));
    assert.deepEqual(g.mods, f.checkpoint.mods);
  }
});
test('Operator course permits native movement, jump and firing without progress or reward writes', () => {
  const f = fixture('scene=animations')!;
  const g = new Game();
  let writes = 0,
    awards = 0;
  g.onCheckpoint = () => writes++;
  g.onCommendation = () => awards++;
  g.onCampaignClear = () => awards++;
  g.startTest(f.checkpoint, operatorTestRoom(f));
  assert(prepareOperatorTest(g, f));
  const x = g.player.position.x;
  for (let i = 0; i < 140; i++)
    g.tick(1 / 60, {
      ...input,
      right: true,
      jump: i === 35,
      jumpHeld: i >= 35 && i < 50,
      fire: i > 70,
    });
  assert(g.player.position.x > x + 90);
  assert(g.shotCount > 0);
  assert.equal(g.mode, 'playing');
  const t = g.elapsed;
  g.setMode('paused');
  for (let i = 0; i < 60; i++) g.tick(1 / 60, input);
  assert.equal(g.elapsed, t);
  assert.equal(writes, 0);
  assert.equal(awards, 0);
});
test('Operator private outfits and room restart do not modify starting gun, builds or saved cosmetics', () => {
  const f = fixture('scene=outfits&outfit=operator&gun=carbine')!;
  const g = new Game();
  const startCosmetics = { ...g.cosmetics };
  assert.equal(prepareOperatorTest(g, f), false);
  g.startTest(f.checkpoint, operatorTestRoom(f));
  assert(prepareOperatorTest(g, f));
  assert.equal(g.cosmetics.outfit, 'operator');
  assert.equal(g.startingGun, 'carbine');
  assert.deepEqual(g.mods, []);
  g.startTest(f.checkpoint, operatorTestRoom(f));
  assert(prepareOperatorTest(g, f));
  assert.equal(g.player.position.x, 140);
  assert.equal(g.cosmetics.gun, startCosmetics.gun);
});
test('Operator links reject malformed, duplicate, mixed-mode and unsupported parameters', () => {
  for (const q of [
    'scene=nope',
    'scene=grips&gun=unknown',
    'scene=surfaces&morph=beam',
    'scene=grips&morph=unknown',
    'scene=outfits&outfit=nope',
    'scene=animations&scene=grips',
    'scene=animations&v=1',
    'scene=grips&seed=SAVE',
    'scene=grips&daily=2026-10-27',
    'scene=grips&quick=ABC',
    'scene=grips#escape',
  ])
    assert.equal(fixture(q), null, q);
  assert.equal(operatorTestFromUrl(new URL('https://test/?test=operator&scene=grips&v=2')), null);
});
