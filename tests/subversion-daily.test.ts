import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game } from '../src/game.ts';
import {
  dailyForDate,
  dailyFromSeed,
  dailyLink,
  dailyFromUrl,
  loadDailyBests,
  recordDailyWin,
} from '../src/daily.ts';
import { rewardMods, seeded, loadCheckpoint, type Checkpoint } from '../src/rules.ts';
import { isSubversion } from '../src/subversion-rules.ts';
import Matter from 'matter-js';
import { playCampaign } from './campaign-pilot.ts';

// Frozen from c3e4a11, before Subversion entered the reward pool.
const baseline: { seed: string; rooms: string[]; rewards: string[] }[] = JSON.parse(
  readFileSync(new URL('./fixtures/daily78.json', import.meta.url), 'utf8'),
);
for (const old of baseline)
  test(old.seed + ' keeps its original twenty rooms and nineteen forced upgrades', () => {
    const g = new Game();
    g.start(old.seed);
    g.areaEvents.state = null;
    for (let stage = 0; stage < 20; stage++) {
      assert.equal(g.level.id, old.rooms[stage]);
      if (stage === 19) break;
      g.openReward();
      assert.deepEqual(
        g.offers.map((m) => m.id),
        [old.rewards[stage]],
      );
      g.chooseMod(g.offers[0].id);
    }
    assert(!g.mods.some(isSubversion));
  });

test('both supported Daily identities round-trip without merging or discarding existing scores', () => {
  const old = dailyForDate('2026-09-24', 78)!,
    latest = dailyForDate('2026-09-24')!;
  for (const day of [old, latest]) {
    assert.deepEqual(dailyFromSeed(day.seed), day);
    assert.deepEqual(dailyFromUrl(new URL(dailyLink(day, 'https://example.test/game/'))), day);
  }
  const bests = { [old.seed]: 10000, [latest.seed]: 9000 };
  assert.deepEqual(loadDailyBests(bests), bests);
  assert.deepEqual(recordDailyWin(bests, latest, 80)?.bests, {
    [old.seed]: 10000,
    [latest.seed]: 8000,
  });
});

test('new Daily pool admits Subversion while legacy pool preserves old eligibility', () => {
  const latest = rewardMods(['spoof'], 200, seeded('pool'), {
    stage: 8,
    seed: 'RF-D79-2026-09-24',
  });
  assert(latest.some((m) => m.id === 'standing-orders'));
  assert(latest.some((m) => m.id === 'cross-talk'));
  assert(
    !rewardMods([], 200, seeded('pool'), { stage: 8, seed: 'RF-D78-2026-09-24' }).some((m) =>
      isSubversion(m.id),
    ),
  );
  const save: Checkpoint = {
    version: 6,
    seed: 'RF-D78-2026-09-24',
    stage: 3,
    hp: 80,
    kills: 8,
    mods: ['magnum', 'rapid'],
    elapsed: 40,
  };
  assert(loadCheckpoint(save));
  assert(!loadCheckpoint({ ...save, mods: ['spoof'] }));
  const g = new Game();
  g.start(save.seed, save);
  g.openReward();
  let pending: Checkpoint | null = null;
  g.onCheckpoint = (s) => {
    pending = s;
  };
  g.save();
  const restored = loadCheckpoint(pending)!;
  assert(restored);
  const continued = new Game();
  continued.start(restored.seed, restored);
  assert.deepEqual(continued.offers, g.offers);
});

test('retention sorts across rulesets by actual date', () => {
  const records: Record<string, number> = {};
  for (let i = 0; i < 365; i++) {
    const date = new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10);
    records[dailyForDate(date, 79)!.seed] = 100;
  }
  const recent = dailyForDate('2026-09-23', 78)!;
  records[recent.seed] = 321;
  const result = recordDailyWin(records, dailyForDate('2026-09-24')!, 30)!;
  assert.equal(Object.keys(result.bests).length, 365);
  assert.equal(result.bests[recent.seed], 321);
  assert.equal(result.bests['RF-D79-2020-01-01'], undefined);
});

test('Daily 79 earns the complete Dead Switch branch and clears its first Lockdown through ordinary input', (t) => {
  const random = Math.random;
  Math.random = seeded('balance-particles');
  t.after(() => {
    Math.random = random;
  });
  const common = Matter.Common as typeof Matter.Common & { _nextId: number; _seed: number };
  common._nextId = common._seed = 0;
  const g = new Game();
  g.start('RF-D79-2026-09-24');
  playCampaign(g, { pathMods: [], seconds: 1000, stop: () => g.stage === 9 });
  assert.equal(g.stage, 9, JSON.stringify({ stage: g.stage, hp: g.hp, mode: g.mode }));
  assert.equal(g.mode, 'playing');
  assert(g.hp > 0);
  assert(['spoof', 'cross-talk', 'dead-switch'].every((id) => g.mods.includes(id)));
  assert.equal(g.mods.length, 9);
  t.diagnostic(JSON.stringify({ seed: g.seed, stage: g.stage, hp: g.hp, mods: g.mods }));
});
