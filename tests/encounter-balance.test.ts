import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { seeded, STAGES, loadCheckpoint } from '../src/rules.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import { newUprising, UPRISING_ROUTES } from '../src/uprising-model.ts';
import { encounterTestFromUrl } from '../src/encounter-test.ts';
import { playCampaign } from './campaign-pilot.ts';
import { uprisingInput } from './uprising-pilot.ts';

function deterministic(t: { after: (fn: () => void) => void }) {
  const random = Math.random;
  Math.random = seeded('encounter-pilot');
  t.after(() => {
    Math.random = random;
  });
  const common = Matter.Common as typeof Matter.Common & { _nextId: number; _seed: number };
  common._nextId = common._seed = 0;
}

const priority = [
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
];

for (const [gun, seed, wholeRun] of [
  ['pistol', 'starting-guns-1', true],
  ...STARTING_GUN_IDS.map((gun) => [gun, 'starting-guns-2', false] as const),
] as const)
  test(`paced Campaign: ${gun} completes ${wholeRun ? 'twenty rooms' : 'the first zone'} on ${seed}`, (t) => {
    deterministic(t);
    const g = new Game();
    g.start(seed, undefined, null, null, false, 0, true, [], newUprising(), gun);
    const rooms = new Map<number, { rhythm: string; at: number; hp: number }>();
    const result = playCampaign(g, {
      pathMods: ['leech', 'magnum', 'airshot', 'rapid'],
      seconds: wholeRun ? 1200 : 180,
      stop: wholeRun ? undefined : () => g.stage === 4,
      beforeInput: (game) => {
        if (!rooms.has(game.stage))
          rooms.set(game.stage, {
            rhythm: game.waves.plan?.rhythm ?? 'special',
            at: game.time,
            hp: game.hp,
          });
        return uprisingInput(game);
      },
      chooseUpgrade: () =>
        priority.find((id) => g.offers.some((m) => m.id === id)) ?? g.offers[0].id,
    });
    assert.equal(
      g.mode,
      wholeRun ? 'won' : 'playing',
      JSON.stringify({
        gun,
        seed,
        stage: g.stage,
        hp: g.hp,
        time: g.time,
        cause: g.deathCause,
        enemies: g.enemies.map((e) => ({ kind: e.kind, hp: e.hp, p: e.body.position })),
      }),
    );
    assert.equal(g.encounters, 1);
    assert.equal(g.stage, wholeRun ? STAGES - 1 : 4);
    assert.equal(rooms.size, wholeRun ? STAGES : 4);
    assert(g.hp > 0);
    if (wholeRun) {
      assert(result.escapeSeen);
      assert(g.mods.length >= STAGES - 1 && g.mods.length <= STAGES + 1);
      assert.equal(g.uprising.run!.choices.length, 4);
    } else {
      assert.equal(g.mods.length, 4, 'Use only earned first-zone rewards');
      assert.equal(g.uprising.run!.choices.length, 0, 'Jobs begin in the second zone');
    }
    assert.equal(rooms.get(0)!.rhythm, 'intro');
    if (wholeRun)
      assert(
        ['breather', 'special'].includes(rooms.get(4)!.rhythm),
        'Factory events retain their own introduction',
      );
    for (const stage of wholeRun ? [3, 7, 11, 15, 19] : [3])
      assert.equal(rooms.get(stage)!.rhythm, 'boss');
    t.diagnostic(
      JSON.stringify({ gun, seed, seconds: Math.round(g.elapsed), hp: g.hp, rooms: [...rooms] }),
    );
  });

for (const gun of STARTING_GUN_IDS)
  for (const route of UPRISING_ROUTES)
    test(`paced job: ${gun} completes and exits ${route.name} with normal controls`, (t) => {
      deterministic(t);
      const save = encounterTestFromUrl(
        new URL(`https://test/?test=encounters&route=${route.id}&gun=${gun}`),
      )!;
      assert(loadCheckpoint(save));
      const g = new Game();
      g.startTest(save);
      assert.equal(
        g.waves.plan?.rhythm,
        route.mission === 'escape'
          ? 'traversal'
          : route.mission === 'defend'
            ? 'crossfire'
            : 'ambush',
      );
      playCampaign(g, {
        pathMods: ['magnum', 'light', 'airshot', 'swift'],
        seconds: 120,
        beforeInput: uprisingInput,
        stop: () => g.mode === 'upgrade',
      });
      const details = JSON.stringify({
        gun,
        route: route.id,
        hp: g.hp,
        mode: g.mode,
        time: g.time,
        outcome: g.uprising.outcome,
        p: g.player.position,
        nodes: g.uprising.nodes.map((n) => ({ hp: n.hp, pos: n.body.position })),
      });
      assert.equal(g.uprising.outcome?.result, 'success', details);
      assert.equal(g.mode, 'upgrade', details);
      assert(g.hp > 0, details);
      if (route.mission === 'escape') assert(g.time > 5 && g.time < 40, details);
      if (route.mission === 'defend')
        assert(g.uprising.armedAt !== null && g.time - g.uprising.armedAt >= 18, details);
      t.diagnostic(
        JSON.stringify({ gun, job: route.id, seconds: Math.round(g.time * 10) / 10, hp: g.hp }),
      );
    });
