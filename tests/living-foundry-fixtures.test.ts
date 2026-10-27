import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, type Input } from '../src/game.ts';
import { loadCheckpoint } from '../src/rules.ts';
import {
  livingFoundryTestFromUrl,
  livingFoundryTestRoom,
  prepareLivingFoundryTest,
  LIVING_FOUNDRY_ZONES,
} from '../src/living-foundry-test.ts';

function fixture(query: string) {
  return livingFoundryTestFromUrl(new URL('https://test/?test=living-foundry&v=1&' + query));
}
const input: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1200, y: 600 },
};
test('all five zones, three compositions and inspection scenes use valid isolated native checkpoints', () => {
  for (const zone of LIVING_FOUNDRY_ZONES)
    for (const variant of [0, 1, 2])
      for (const scene of ['reveal', 'machinery', 'combat'])
        for (const mirror of [0, 1]) {
          const f = fixture(`zone=${zone}&variant=${variant}&scene=${scene}&mirror=${mirror}`)!;
          assert(f);
          assert(loadCheckpoint(f.checkpoint), `valid ${zone} ${scene} checkpoint`);
          const room = livingFoundryTestRoom(f);
          assert.equal(room.area, zone);
          assert.equal(room.mirrored, !!mirror);
          assert(room.spawns.length > 0, 'native patrol keeps the inspection room playable');
          assert.equal(room.boss, false);
          assert(!f.checkpoint.factory && !f.checkpoint.security && !f.checkpoint.overtime);
        }
});
test('outage and completed sabotage scenarios keep actual valid Campaign histories and scope', () => {
  for (const zone of ['furnace', 'cooling', 'reclamation']) {
    const f = fixture('zone=' + zone + '&state=blackout')!;
    assert(loadCheckpoint(f.checkpoint));
    const g = new Game();
    g.startTest(f.checkpoint, livingFoundryTestRoom(f));
    prepareLivingFoundryTest(g, f);
    assert.equal(g.areaEvents.dark, true);
    assert(g.areaEvents.fuseBox, 'real native fuse can restore power');
    g.areaEvents.hitFuse(g.areaEvents.fuseBox, 1, true);
    assert.equal(g.areaEvents.dark, false);
  }
  for (const zone of ['cooling', 'reclamation', 'rooftops']) {
    const f = fixture('zone=' + zone + '&state=sabotaged')!;
    assert(loadCheckpoint(f.checkpoint), 'valid completed job history for ' + zone);
    const g = new Game();
    g.startTest(f.checkpoint, livingFoundryTestRoom(f));
    assert(g.uprising.active);
    assert(
      g.uprising.run?.outcomes.some((o) => o.route === 'core-sabotage' && o.result === 'success'),
    );
    assert(
      !g.uprising.mission,
      'the fixture is after the completed job, not in another active mission',
    );
  }
});
test('inspection permits real movement, pause and fire without checkpoint or award callbacks', () => {
  for (const zone of LIVING_FOUNDRY_ZONES) {
    const f = fixture('zone=' + zone)!;
    const g = new Game();
    let writes = 0,
      rewards = 0;
    g.onCheckpoint = () => writes++;
    g.onCommendation = () => rewards++;
    g.onCampaignClear = () => rewards++;
    g.startTest(f.checkpoint, livingFoundryTestRoom(f));
    assert(prepareLivingFoundryTest(g, f));
    const x = g.player.position.x;
    for (let i = 0; i < 150; i++)
      g.tick(1 / 60, { ...input, right: true, fire: i > 40, aim: { x: 1300, y: 500 } });
    assert(g.player.position.x > x + 130, 'normal rightward input must move through entry');
    assert(g.shotCount > 0);
    assert.equal(g.mode, 'playing');
    const elapsed = g.elapsed;
    g.setMode('paused');
    for (let i = 0; i < 60; i++) g.tick(1 / 60, input);
    assert.equal(g.elapsed, elapsed);
    assert.equal(writes, 0);
    assert.equal(rewards, 0);
  }
});
test('malformed, duplicate, mixed or impossible scenery links fail closed', () => {
  for (const query of [
    'zone=unknown',
    'zone=docks&variant=3',
    'zone=docks&scene=intro',
    'zone=docks&state=sabotaged',
    'zone=docks&state=blackout',
    'zone=rooftops&state=blackout',
    'zone=docks&zone=cooling',
    'zone=docks&mirror=yes',
    'zone=docks&reduced=yes',
    'zone=docks&seed=CHEAT',
    'zone=docks&daily=2026-10-27',
    'zone=docks&quick=ABC',
    'zone=docks&v=1',
  ])
    assert.equal(fixture(query), null, query);
  assert.equal(
    livingFoundryTestFromUrl(new URL('https://test/?test=living-foundry&zone=docks&v=2')),
    null,
  );
  assert.equal(
    livingFoundryTestFromUrl(new URL('https://test/?test=living-foundry&zone=docks&v=1#mixed')),
    null,
  );
  const g = new Game();
  assert.equal(prepareLivingFoundryTest(g, fixture('zone=docks')), false);
});
