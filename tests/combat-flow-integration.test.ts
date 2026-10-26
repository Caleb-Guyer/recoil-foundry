import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { COMBAT_FLOW_IDS } from '../src/combat-flow-rooms.ts';
import { combatFlowTestFromUrl } from '../src/combat-flow-test.ts';
import { RoomRematch, rematchEntry, roomRematchSnapshot } from '../src/room-rematch.ts';
import { newCampaignSeed } from '../src/run-seed.ts';
import { overtimeSeed } from '../src/overtime.ts';
import { combatFlowSeed } from '../src/combat-flow-rules.ts';

const idle = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1200, y: 600 },
};
const clean = (g: Game) => {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
};

test('new Campaign and Overtime identities preserve the Combat Flow revision without changing earlier seeds', () => {
  const seed = newCampaignSeed(undefined, () => 101);
  assert.match(seed, /^RF-C107-/);
  assert(combatFlowSeed(seed));
  assert.match(overtimeSeed(seed), /^RF-C105-OT-/);
  assert.match(overtimeSeed('RF-C98-HISTORICAL'), /^RF-C98-OT-/);
  for (const old of ['RF-C98-HISTORICAL', 'RF-C97-HISTORICAL', 'RF-D99-2026-10-24', 'custom-seed'])
    assert(!combatFlowSeed(old));
});

test('death rematches restart all three authored groups with the finished gun and leave the original defeat intact', () => {
  for (const room of COMBAT_FLOW_IDS)
    for (const variant of [1, 2, 3]) {
      const cp = combatFlowTestFromUrl(
        new URL('https://test/?test=flow&room=' + room + '&variant=' + variant + '&v=1'),
      );
      assert(cp);
      const original = new Game();
      let writes = 0;
      original.onCheckpoint = () => writes++;
      original.onCommendation = () => writes++;
      original.onCampaignClear = () => writes++;
      original.startTest(cp);
      const entry = rematchEntry(original);
      assert(entry);
      const authored = structuredClone(original.level.combatFlow);
      assert(authored);
      original.damagePlayer(100, undefined, { type: 'shot', enemy: 'shooter' });
      const snapshot = roomRematchSnapshot(original, entry);
      assert(snapshot);
      const originalWorld = Matter.Composite.allBodies(original.engine.world).map((b) => b.id);
      const session = new RoomRematch(snapshot);
      try {
        assert.equal(session.game.hp, 100);
        assert.equal(session.game.mode, 'paused');
        assert.equal(session.game.waves.flowBeat, 0);
        assert.deepEqual(session.game.level.combatFlow, authored);
        assert.deepEqual(session.game.gun, original.gun);
        assert.deepEqual(session.game.mods, original.mods);
        assert.equal(session.game.enemies.length, authored.beats[0].length);
        session.game.onCheckpoint = () => writes++;
        session.game.onCommendation = () => writes++;
        session.game.onCampaignClear = () => writes++;
        session.game.setMode('playing');
        for (let frame = 0; frame < 30; frame++) session.tick(1 / 60, idle);
        session.game.setMode('paused');
        const timer = session.game.waves.openingTime;
        session.tick(1, idle);
        assert.equal(session.game.waves.openingTime, timer);
        session.reset();
        assert.equal(session.game.waves.flowBeat, 0);
        assert.deepEqual(session.game.level.combatFlow, authored);
        assert.equal(original.mode, 'dead');
        assert.equal(original.hp, 0);
        assert.deepEqual(original.level.combatFlow, authored);
        assert.deepEqual(
          Matter.Composite.allBodies(original.engine.world).map((b) => b.id),
          originalWorld,
        );
        assert.equal(writes, 0);
      } finally {
        session.dispose();
        clean(original);
      }
    }
});
