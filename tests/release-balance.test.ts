import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import {
  OPENING_POWER_MODS,
  rewardMods,
  seeded,
  validBuild,
  availableMods,
} from '../src/rules.ts';
import { dailyForDate } from '../src/daily.ts';
import { fixture, target, Body, advance } from './branches-fixture.ts';
import { CLUSTER_LIMIT } from '../src/demolition.ts';
import { playCampaign } from './campaign-pilot.ts';

test('early real rewards offer shared firepower without forcing a path or changing Daily card count', () => {
  for (let i = 0; i < 300; i++) {
    for (const daily of [false, true]) {
      const seed = daily
        ? dailyForDate(
            `2026-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`,
          )!.seed
        : `release-opening-${i}`;
      const g = new Game();
      g.start(seed);
      for (let stage = 0; stage < 3; stage++) {
        g.openReward();
        assert.equal(g.offers.length, daily ? 1 : 3);
        if ((!daily || stage === 2) && !g.mods.some((id) => OPENING_POWER_MODS.includes(id)))
          assert(
            g.offers.some((m) => OPENING_POWER_MODS.includes(m.id)),
            seed,
          );
        const offers = g.offers.map((m) => m.id);
        g.openReward();
        assert.deepEqual(
          g.offers.map((m) => m.id),
          offers,
        );
        // Deliberately decline damage when possible. It remains a real choice.
        const choice = g.offers.find((m) => !OPENING_POWER_MODS.includes(m.id)) ?? g.offers[0];
        g.chooseMod(choice.id);
        assert(validBuild(g.mods));
      }
      if (daily)
        assert(
          g.mods.some((id) => OPENING_POWER_MODS.includes(id)),
          seed,
        );
    }
  }
});

test('opening safeguard respects reroll exclusions, chosen paths and deterministic seeds', () => {
  const build = ['coolant-rounds', 'countershot'];
  for (let i = 0; i < 200; i++) {
    const first = rewardMods(build, 3, seeded(`opening-${i}`), { stage: 2 });
    const excluded = first.map((m) => m.id);
    const again = rewardMods(build, 3, seeded(`reroll-${i}`), { stage: 2 }, excluded);
    assert.equal(again.length, 3);
    assert.equal(new Set(again.map((m) => m.id)).size, 3);
    assert(again.every((m) => !excluded.includes(m.id) && availableMods(build).includes(m)));
    assert(again.some((m) => OPENING_POWER_MODS.includes(m.id)));
    assert.deepEqual(again, rewardMods(build, 3, seeded(`reroll-${i}`), { stage: 2 }, excluded));
  }
  // Once any shared power is owned, later rewards need not repeat the category.
  assert(
    Array.from({ length: 100 }, (_, i) =>
      rewardMods(['magnum'], 3, seeded(`owned-${i}`), { stage: 1 }),
    ).some((offer) => offer.every((m) => !OPENING_POWER_MODS.includes(m.id))),
  );
  assert(
    Array.from({ length: 100 }, (_, i) =>
      rewardMods(build, 3, seeded(`late-${i}`), { stage: 8 }),
    ).some((offer) => offer.every((m) => !OPENING_POWER_MODS.includes(m.id))),
  );
});

test('Shaped Charge rewards a direct boss hit without double-amplifying Aftershock or recoil', () => {
  const results = [];
  for (const shaped of [false, true]) {
    const g = fixture([
      'shellshock',
      'aftershock',
      'blast-surf',
      ...(shaped ? ['shaped-charge'] : []),
    ]);
    const e = target(g, 600, 400, 'interceptor');
    e.state = 'recover';
    Body.setPosition(g.player, { x: 550, y: 400 });
    const hp = e.hp;
    g.demolition.detonate({
      pos: { x: 600, y: 400 },
      damage: 100,
      radius: 96,
      launch: 10,
      kind: 'shell',
      direction: { x: 1, y: 0 },
    });
    const direct = hp - e.hp;
    advance(g, 30);
    results.push({
      direct,
      total: hp - e.hp,
      echoes: g.demolition.pending.length,
      velocity: g.player.velocity.x,
    });
  }
  assert(Math.abs(results[1].direct / results[0].direct - 1.3) < 1e-6);
  assert(Math.abs(results[1].total / results[0].total - 1.3) < 1e-6);
  assert(results.every((r) => r.echoes === 0 && r.velocity < 0));
});

test('Cluster Shell keeps the stronger direct impact when its child limit is full', () => {
  for (const occupied of [0, CLUSTER_LIMIT - 1, CLUSTER_LIMIT]) {
    const g = fixture(['shellshock', 'cluster-shell', 'aftershock']);
    for (let i = 0; i < occupied; i++)
      g.demolition.bomblets.push({
        pos: { x: 1800, y: 400 },
        prev: { x: 1800, y: 400 },
        vel: { x: 0, y: 0 },
        damage: 1,
        launch: 0,
        at: 100,
        last: 0,
      });
    const e = target(g, 600, 400, 'interceptor');
    e.state = 'recover';
    const hp = e.hp;
    g.demolition.detonate({
      pos: { x: 600, y: 400 },
      damage: 100,
      radius: 96,
      launch: 10,
      kind: 'shell',
      normal: { x: 0, y: -1 },
    });
    const children = g.demolition.bomblets.slice(occupied);
    const impact = g.demolition.effects[0];
    assert.equal(children.length, Math.min(3, CLUSTER_LIMIT - occupied));
    assert(Math.abs(impact.damage + children.reduce((sum, b) => sum + b.damage, 0) - 125) < 1e-6);
    assert(Math.abs(impact.launch + children.reduce((sum, b) => sum + b.launch, 0) - 10) < 1e-6);
    assert(hp - e.hp >= 65 * 1.3 - 1e-6);
    assert.equal(g.demolition.pending.length, 1);
    assert.equal(g.demolition.pending[0].damage, impact.damage * 0.4);
    assert(g.demolition.bomblets.length <= CLUSTER_LIMIT);
  }
});

for (const daily of [false, true])
  test(`${daily ? 'Daily' : 'campaign'} reaches extraction with actual rewards and current encounters enabled`, (t) => {
    const random = Math.random;
    Math.random = seeded('balance-particles');
    t.after(() => {
      Math.random = random;
    });
    const common = Matter.Common as typeof Matter.Common & { _nextId: number; _seed: number };
    common._nextId = common._seed = 0;
    const g = new Game();
    g.start(daily ? dailyForDate('2026-09-20')!.seed : 'path-run-67');
    const plannedStory = g.story.state;
    const priorities = [
      'magnum',
      'rapid',
      'deadeye',
      'airshot',
      'light',
      'leech',
      'execute',
      'rivet',
      'fracture',
      'deadlock',
      'capacitor',
      'reserve-cell',
      'rail-spike',
    ];
    let rewards = 0;
    const { escapeSeen } = playCampaign(g, {
      pathMods: [],
      seconds: 1000,
      chooseUpgrade: () => {
        assert.equal(g.offers.length, daily ? 1 : 3);
        rewards++;
        const id =
          (!daily && priorities.find((id) => g.offers.some((m) => m.id === id))) || g.offers[0].id;
        assert(availableMods(g.mods, true).some((m) => m.id === id));
        return id;
      },
    });
    assert.equal(g.mode, 'won', JSON.stringify({ stage: g.stage, hp: g.hp, cause: g.deathCause }));
    assert(escapeSeen);
    assert.equal(rewards, 19);
    assert(validBuild(g.mods));
    assert.equal(g.mods.length, 19);
    assert(g.areaEvents.state);
    assert(g.fabricators.enabled);
    assert.equal(g.story.state, plannedStory);
    assert(g.hp > 0 && g.hp <= 100);
    t.diagnostic(JSON.stringify({ seed: g.seed, seconds: g.time, hp: g.hp, mods: g.mods }));
  });
