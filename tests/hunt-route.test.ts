import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import {
  HUNTS,
  HUNT_KINDS,
  HUNT_STAGES,
  HUNT_THRESHOLD,
  planHunts,
  type HuntKind,
} from '../src/hunt-rules.ts';
import { loadCheckpoint, type Checkpoint } from '../src/rules.ts';
import { testCheckpoint } from '../src/practice.ts';
import { newUprising } from '../src/uprising-model.ts';
import { loadRunHistory, snapshotRun } from '../src/run-history.ts';
import { migrateWeaponUnlocks } from '../src/weapon-unlocks.ts';
import { loadLogbook } from '../src/logbook.ts';
import { huntTestFromUrl } from '../src/hunt-test.ts';
const { Body, Query } = Matter;
const idle = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1460, y: 705 },
};
function scheduled(kind: HuntKind = 'bulwark', region?: 'annex') {
  const seed = 'HUNT-ROUTE-REGRESSION';
  const hunts = planHunts(seed);
  const other = HUNT_KINDS.find((k) => k !== kind)!;
  hunts[0].kind = kind;
  hunts[1].kind = other;
  const save: Checkpoint = {
    ...testCheckpoint(seed, 8),
    version: 6,
    encounters: 1,
    huntRules: 2,
    hunts,
    ...(region ? { region, annexVersion: 6 } : {}),
  };
  assert(loadCheckpoint(save));
  const g = new Game();
  g.start(seed, save);
  return g;
}
function enter(g: Game) {
  assert(g.hunts.door);
  g.clear = true;
  g.time = 1;
  g.clearAt = 0;
  g.grounded = true;
  Body.setPosition(g.player, { x: g.hunts.door.x, y: 722 });
  assert(g.hunts.enter(true));
}
function approach(g: Game) {
  for (let n = 0; n < 180 && g.hunts.approaching; n++) g.tick(1 / 60, { ...idle, right: true });
  assert.equal(g.hunts.state!.phase, 'fight');
  assert.equal(g.enemies.length, 1);
}
function win(g: Game) {
  const e = g.enemies[0];
  e.spawn = 0;
  g.hitEnemy(e, 100000);
  g.hitStop = 0;
  g.tick(1 / 60, idle);
  for (let n = 0; n < 120 && g.mode === 'playing' && g.machineBreakdown.contractShutdownActive; n++)
    g.tick(1 / 60, idle);
  assert.equal(g.mode, 'upgrade');
}
test('every new Campaign plans two distinct hunts in zones three and five, favoring unbeaten machines', () => {
  const seen = new Set();
  for (let n = 0; n < 400; n++) {
    const seed = 'HUNT-ROUTE-' + n,
      plan = planHunts(seed);
    assert.deepEqual(plan, planHunts(seed));
    assert.deepEqual(
      plan.map((s) => s.stage),
      [...HUNT_STAGES],
    );
    assert.notEqual(plan[0].kind, plan[1].kind);
    plan.forEach((s) => seen.add(s.kind));
    for (const missing of HUNT_KINDS) {
      const favored = planHunts(
        seed,
        HUNT_KINDS.filter((k) => k !== missing),
      );
      assert.equal(favored[0].kind, missing);
    }
  }
  assert.equal(seen.size, 3);
  assert.deepEqual(planHunts('RF-D90-20261020'), []);
});
test('reserved entrances survive factory conditions, security, authored patrols and either zone-three route', () => {
  for (let n = 0; n < 100; n++) {
    const g = new Game();
    g.start(
      'HUNT-RESERVE-' + n,
      undefined,
      null,
      null,
      false,
      (n % 4) as 0 | 1 | 2 | 3,
      4,
      [],
      newUprising(),
      'pistol',
      1,
      true,
      true,
      true,
      true,
    );
    for (const [stage, region] of [
      [8, 'cooling'],
      [8, 'annex'],
      [16, 'cooling'],
    ] as const) {
      g.stage = stage;
      g.region = region;
      if (stage === 16) g.hunts.plans[0].phase = 'skipped';
      g.loadRoom();
      assert(
        g.hunts.door,
        JSON.stringify({ seed: g.seed, stage, region, level: g.level.id, state: g.hunts.state }),
      );
      assert.equal(g.hunts.state!.phase, 'available');
      assert.equal(g.areaEvents.active, null);
      const { x, y } = g.hunts.door;
      assert.equal(
        Query.region(g.solidBodies, { min: { x: x - 38, y: y - 96 }, max: { x: x + 38, y: y - 3 } })
          .length,
        0,
      );
    }
  }
});
for (const kind of HUNT_KINDS) {
  test(`${kind}: approach cannot auto-clear; crossing the threshold seals the arena and Continue restores each phase`, () => {
    const g = scheduled(kind, 'annex'),
      parent = structuredClone(g.level),
      mods = [...g.mods];
    let cp: Checkpoint | null = null;
    g.onCheckpoint = (s) => {
      cp = s;
    };
    enter(g);
    assert.equal(g.hunts.state!.phase, 'approach');
    assert.equal(g.enemies.length, 0);
    for (let n = 0; n < 90; n++) g.tick(1 / 60, idle);
    assert.equal(g.clear, false);
    assert.equal(g.mode, 'playing');
    assert(loadCheckpoint(cp));
    const restored = new Game();
    restored.start(cp!.seed, cp!);
    assert(restored.hunts.approaching);
    assert.equal(restored.enemies.length, 0);
    approach(g);
    assert(g.hunts.gate && g.terrain.includes(g.hunts.gate));
    assert(g.lineEnd({ x: 700, y: 700 }, { x: 200, y: 700 }).x > HUNT_THRESHOLD);
    assert(loadCheckpoint(cp));
    restored.start(cp!.seed, cp!);
    assert(restored.hunts.gate);
    assert.equal(restored.enemies.length, 1);
    for (let n = 0; n < 60; n++) restored.tick(1 / 60, { ...idle, left: true });
    assert(restored.player.position.x >= HUNT_THRESHOLD + 26);
    win(g);
    assert.equal(g.hunts.gate, null);
    assert(loadCheckpoint(cp));
    restored.start(cp!.seed, cp!);
    assert(restored.hunts.rewarding);
    assert.equal(restored.enemies.length, 0);
    assert(g.hunts.choose('repair'));
    assert(!g.detour);
    assert(g.clear);
    assert.deepEqual(g.level, parent);
    assert.deepEqual(g.mods, mods);
    assert(loadCheckpoint(cp));
    restored.start(cp!.seed, cp!);
    assert(restored.clear);
    assert.equal(restored.hunts.state!.phase, 'finished');
  });
}
test('skipping the first hunt never cancels the second; two earned rerolls pay for separate choices', () => {
  const g = scheduled();
  g.clear = true;
  g.openReward();
  assert.equal(g.hunts.plans[0].phase, 'skipped');
  const seed = g.seed,
    hunts = structuredClone(g.hunts.plans);
  const later: Checkpoint = {
    ...testCheckpoint(seed, 16),
    version: 6,
    encounters: 1,
    huntRules: 2,
    hunts,
  };
  assert(loadCheckpoint(later));
  g.start(seed, later);
  assert(g.hunts.door);
  enter(g);
  approach(g);
  win(g);
  assert(g.hunts.choose('reroll'));
  assert(g.hunts.freeReroll);

  // Earn both credits through the actual hunt/reward flow, then Continue into
  // the later room. Each ordinary upgrade screen can spend exactly one.
  const both = scheduled();
  enter(both);
  approach(both);
  win(both);
  assert(both.hunts.choose('reroll'));
  const savedPair = structuredClone(both.hunts.plans);
  const next: Checkpoint = {
    ...testCheckpoint(both.seed, 16),
    version: 6,
    encounters: 1,
    huntRules: 2,
    hunts: savedPair,
  };
  assert(loadCheckpoint(next));
  g.start(next.seed, next);
  enter(g);
  approach(g);
  win(g);
  assert(g.hunts.choose('reroll'));
  g.hp = 5;
  g.openReward();
  assert(g.rerollReward());
  assert(g.hunts.freeReroll);
  assert(!g.rerollReward());
  assert.equal(g.hp, 5);
  g.chooseMod(g.offers[0].id);
  assert.equal(g.stage, 17);
  g.hp = 5;
  g.clear = true;
  g.openReward();
  assert(g.rerollReward());
  assert.equal(g.hp, 5);
  assert(!g.hunts.freeReroll);
  assert(g.hunts.plans.every((s) => s.rerollSpent));
});
test('malformed schedules, future victories and mixed legacy state cannot enter Continue', () => {
  const g = scheduled();
  let cp: Checkpoint | null = null;
  g.onCheckpoint = (s) => {
    cp = s;
  };
  g.save();
  for (const hunts of [
    [],
    [null, null],
    [cp!.hunts![0]],
    [cp!.hunts![0], { ...cp!.hunts![1], kind: cp!.hunts![0].kind }],
    [cp!.hunts![0], { ...cp!.hunts![1], phase: 'finished', reward: 'repair' }],
    [{ ...cp!.hunts![0], phase: 'approach' }, cp!.hunts![1]],
    [{ ...cp!.hunts![0], stage: 9 }, cp!.hunts![1]],
    [{ ...cp!.hunts![0], extra: true }, cp!.hunts![1]],
  ])
    assert.equal(loadCheckpoint({ ...cp!, hunts }), null);
  assert.equal(loadCheckpoint({ ...cp!, hunt: cp!.hunts![0] }), null);
  assert.equal(loadCheckpoint({ ...cp!, huntRules: 1 }), null);
});
test('approach previews use ordinary inputs and cannot write Campaign progress', () => {
  for (const kind of HUNT_KINDS) {
    const save = huntTestFromUrl(new URL(`https://test/?test=hunt&hunt=${kind}&approach=1&v=1`))!;
    assert(loadCheckpoint(save));
    const g = new Game();
    let writes = 0,
      awards = 0;
    g.onCheckpoint = () => writes++;
    g.onCommendation = () => awards++;
    g.startTest(save);
    assert(g.hunts.approaching);
    assert.equal(g.enemies.length, 0);
    for (let n = 0; n < 180 && g.hunts.approaching; n++) g.tick(1 / 60, { ...idle, right: true });
    assert(g.hunts.gate);
    assert.equal(g.enemies.length, 1);
    g.enemies[0].spawn = 0;
    g.hitEnemy(g.enemies[0], 100000);
    g.hitStop = 0;
    g.tick(1 / 60, idle);
    for (
      let n = 0;
      n < 120 && g.mode === 'playing' && g.machineBreakdown.contractShutdownActive;
      n++
    )
      g.tick(1 / 60, idle);
    assert.equal(g.mode, 'won');
    assert.equal(writes, 0);
    assert.equal(awards, 0);
  }
  for (const query of ['approach=2', 'approach=1&approach=0'])
    assert.equal(huntTestFromUrl(new URL('https://test/?test=hunt&' + query)), null);
});
test('the selected pair survives run history and Retry, while two existing distinct victories still unlock the carbine', () => {
  const g = scheduled();
  const order = [...g.hunts.order];
  g.setMode('dead');
  const recap = snapshotRun(g, 'hunt-route-retry')!;
  assert.equal(recap.huntRules, 2);
  assert.deepEqual(recap.huntKinds, order);
  assert.deepEqual(loadRunHistory([recap])[0].huntKinds, order);
  assert.deepEqual(loadRunHistory([{ ...recap, huntKinds: [order[0], order[0]] }]), []);
  g.start(
    recap.seed,
    undefined,
    null,
    null,
    false,
    0,
    false,
    [],
    null,
    'pistol',
    1,
    false,
    false,
    false,
    recap.huntRules!,
    recap.huntKinds,
  );
  assert.deepEqual(g.hunts.order, order);
  const profile = migrateWeaponUnlocks(
    null,
    null,
    [],
    loadLogbook(null),
    order.map((k) => HUNTS[k].commendation),
  );
  assert(profile.licenses!.includes('carbine'));
});
