import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { seeded, STAGES } from '../src/rules.ts';
import { newUprising } from '../src/uprising-model.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import { playCampaign } from './campaign-pilot.ts';
import { uprisingInput } from './uprising-pilot.ts';

function deterministic(t: { after: (fn: () => void) => void }) {
  const random = Math.random;
  Math.random = seeded('starting-gun-pilot');
  t.after(() => {
    Math.random = random;
  });
  const common = Matter.Common as typeof Matter.Common & { _nextId: number; _seed: number };
  common._nextId = common._seed = 0;
}
for (const gun of STARTING_GUN_IDS)
  for (const seed of ['starting-guns-1', 'starting-guns-2']) {
    test(`${gun} clears and exits the real opening room on ${seed}`, (t) => {
      deterministic(t);
      const g = new Game();
      g.start(seed, undefined, null, null, false, 0, true, [], newUprising(), gun);
      playCampaign(g, {
        pathMods: [],
        seconds: 90,
        beforeInput: uprisingInput,
        stop: () => g.mode === 'upgrade',
      });
      assert.equal(
        g.mode,
        'upgrade',
        JSON.stringify({
          gun,
          hp: g.hp,
          p: g.player.position,
          enemies: g.enemies.map((e) => ({ kind: e.kind, hp: e.hp })),
        }),
      );
      assert(g.hp > 0 && g.kills > 0);
      assert.deepEqual(g.mods, []);
      assert.equal(g.startingGun, gun);
    });
  }
for (const gun of ['shotgun', 'nailgun'] as const) {
  test(`${gun} completes twenty rooms with real rewards, Factory events and jobs`, (t) => {
    deterministic(t);
    const g = new Game();
    g.start('starting-guns-1', undefined, null, null, false, 0, true, [], newUprising(), gun);
    const result = playCampaign(g, {
      pathMods: ['leech', 'magnum', 'airshot', 'rapid'],
      seconds: 1200,
      beforeInput: uprisingInput,
      chooseUpgrade: () =>
        [
          'leech',
          'countershot',
          'magnum',
          'rapid',
          'scatter',
          'airshot',
          'pierce',
          'ricochet',
          'light',
          'burst',
          'backblast',
          'deadeye',
          'execute',
          'banker',
          'kick',
          'landing',
          'capacitor',
          'reserve-cell',
          'fold',
          'spoof',
          'standing-orders',
          'priority-target',
        ].find((id) => g.offers.some((m) => m.id === id)) ?? g.offers[0].id,
    });
    assert.equal(
      g.mode,
      'won',
      JSON.stringify({
        gun,
        stage: g.stage,
        room: g.level.name,
        time: g.time,
        hp: g.hp,
        p: g.player.position,
        cause: g.deathCause,
        mods: g.mods,
        enemies: g.enemies.map((e) => ({ kind: e.kind, hp: e.hp, p: e.body.position })),
      }),
    );
    assert.equal(g.stage, STAGES - 1);
    assert(
      g.mods.length >= STAGES - 1 && g.mods.length <= STAGES + 1,
      'Room rewards and earned courier/auditor bonuses only',
    );
    assert.equal(g.startingGun, gun);
    assert(g.hp > 0 && result.escapeSeen);
    assert.equal(g.uprising.run!.choices.length, 4);
    t.diagnostic(JSON.stringify({ gun, seconds: g.elapsed, hp: g.hp, mods: g.mods }));
  });
}
