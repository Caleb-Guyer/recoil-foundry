import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import {
  FACTORY_CONDITIONS,
  planFactory,
  factoryEncounter,
  freshFactorySeed,
  type FactoryCondition,
} from '../src/factory.ts';
import { getLevel } from '../src/levels.ts';
import {
  loadCheckpoint,
  rewardMods,
  seeded,
  OPENING_IDENTITY_MODS,
  OPENING_POWER_MODS,
  type Checkpoint,
} from '../src/rules.ts';
import { snapshotRun, loadRunHistory } from '../src/run-history.ts';
import { recapBody } from '../src/run-history-menu.ts';
import { dailyForDate } from '../src/daily.ts';
import { playRoom } from './room-pilot.ts';
import { freightPilot } from './freight-pilot.ts';
import { playCampaign } from './campaign-pilot.ts';
import { ProgressStore, CHECKPOINT_KEY, parseProgressBackup } from '../src/progress.ts';

const { Body } = Matter;
function seedFor(condition: FactoryCondition) {
  return Array.from({ length: 100 }, (_, i) => 'factory-test-' + i).find(
    (seed) => planFactory(seed).condition === condition,
  )!;
}
function room(condition: FactoryCondition, stage = 1, mods: string[] = []) {
  const seed = seedFor(condition);
  const g = new Game();
  g.start(seed, {
    version: 6,
    seed,
    stage,
    mods,
    hp: 100,
    kills: 0,
    elapsed: 0,
    factory: planFactory(seed),
  });
  return g;
}
const idle = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1000, y: 400 },
};
function clearPatrol(g: Game) {
  g.waves.clear();
  for (const e of [...g.enemies]) {
    e.spawn = 0;
    g.hitEnemy(e, 99999);
  }
  g.hitStop = 0;
  g.tick(1 / 60, idle);
}

test('factory plans have distinct early signatures, spaced recurrences and a contrasting later event', () => {
  const conditions = new Set<string>(),
    later = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const seed = 'factory-plan-' + i,
      f = planFactory(seed);
    assert.deepEqual(f, planFactory(seed));
    conditions.add(f.condition);
    assert.equal(f.encounters[0].stage, 1);
    assert.equal(f.encounters[1].stage, 5);
    assert.equal(factoryEncounter(f, 0), undefined);
    assert(
      f.encounters.every(
        (e, index) => e.stage % 4 !== 3 && (!index || e.stage - f.encounters[index - 1].stage > 1),
      ),
    );
    if (f.encounters[2]) {
      later.add(f.encounters[2].kind);
      assert.notEqual(f.encounters[2].kind, f.encounters[0].kind);
    }
    const g = new Game();
    let saved: Checkpoint | undefined;
    g.onCheckpoint = (save) => {
      saved = save;
    };
    g.start(seed);
    assert.deepEqual(g.level, getLevel(seed, 0), 'the teaching room retains its existing layout');
    assert(loadCheckpoint(saved), 'fresh checkpoint is valid');
    const reserved = f.encounters.map((e) => e.stage);
    assert(!reserved.includes(g.courier.state?.stage ?? -1));
    assert(!reserved.includes(g.story.state?.stage ?? -1));
    assert(!reserved.includes(g.auditor.state?.caseStage ?? -1));
    assert(!g.auditor.state?.rooms.some((stage) => reserved.includes(stage)));
  }
  assert.deepEqual([...conditions].sort(), Object.keys(FACTORY_CONDITIONS).sort());
  assert.deepEqual([...later].sort(), ['blackout', 'lockdown', 'turf']);
});

test('opening signatures and later recurrences actually load, leaving adjacent rooms ordinary', () => {
  for (const condition of Object.keys(FACTORY_CONDITIONS) as FactoryCondition[]) {
    const g = room(condition);
    assert.equal(g.level.crossing === true, condition === 'freight');
    assert.equal(
      g.areaEvents.active,
      condition === 'power' ? 'blackout' : condition === 'conflict' ? 'turf' : null,
    );
    if (condition === 'conflict') {
      assert.equal(g.enemies.length, 6);
      assert.equal(g.areaEvents.allies.length, 3);
      assert(g.enemies.every((e) => ['runner', 'shooter', 'flyer'].includes(e.kind)));
    }
    g.stage = 2;
    g.route = 'low';
    g.loadRoom();
    assert.equal(g.areaEvents.active, null);
    assert(!g.level.crossing && !g.level.freight);
    assert.equal(g.level.routeChoice, 'low');
    g.route = null;
    g.stage = 5;
    g.loadRoom();
    assert.equal(g.level.freight === true, condition === 'freight');
    assert.equal(
      g.areaEvents.active,
      condition === 'power' ? 'blackout' : condition === 'conflict' ? 'turf' : null,
    );
    g.stage = 6;
    g.route = 'high';
    g.loadRoom();
    assert.equal(g.areaEvents.active, null);
    assert.equal(g.level.routeChoice, 'high');
  }
});

test('factory relay progress and exact plan survive reward save, reload and next room', () => {
  const g = room('power');
  let saved: Checkpoint | undefined;
  g.onCheckpoint = (save) => {
    saved = save;
  };
  clearPatrol(g);
  assert(g.areaEvents.powered);
  g.openReward();
  assert.equal(g.mode, 'upgrade');
  const checkpoint = loadCheckpoint(saved)!;
  assert(checkpoint);
  assert.equal(checkpoint.areaEvent, undefined, 'factory progress has one owner');
  assert.deepEqual(checkpoint.factory!.events[0].relays, [1]);
  const resumed = new Game();
  resumed.start(checkpoint.seed, checkpoint);
  assert.deepEqual(resumed.factory, g.factory);
  assert(!resumed.areaEvents.dark);
  assert.deepEqual(resumed.offers, g.offers);
  resumed.chooseMod(resumed.offers[0].id, false, 'low');
  assert.equal(resumed.areaEvents.active, null);
  assert.deepEqual(resumed.factory!.events[0].relays, [1]);
});

test('faction caches grant a reroll bank that survives moving to a normal room and reload', () => {
  const g = room('conflict');
  clearPatrol(g);
  Body.setPosition(g.player, g.areaEvents.site);
  g.areaEvents.update(1 / 60);
  assert(g.areaEvents.freeReroll);
  g.openReward();
  g.chooseMod(g.offers[0].id, false, 'low');
  let saved: Checkpoint | undefined;
  g.onCheckpoint = (save) => {
    saved = save;
  };
  g.save();
  const checkpoint = loadCheckpoint(saved)!;
  assert(checkpoint);
  const resumed = new Game();
  resumed.start(checkpoint.seed, checkpoint);
  assert.equal(resumed.areaEvents.state, null);
  assert(resumed.areaEvents.freeReroll);
  resumed.areaEvents.spendReroll();
  assert(!resumed.areaEvents.freeReroll);
  assert.equal(resumed.factory!.events[0].rerolls, 0);
});

test('malformed plans, future claims, duplicate claims and conflicting special encounters are rejected', () => {
  const g = room('power');
  let saved: Checkpoint | undefined;
  g.onCheckpoint = (save) => {
    saved = save;
  };
  g.save();
  assert(loadCheckpoint(saved));
  for (const mutate of [
    (f: any) => {
      f.version = 3;
    },
    (f: any) => {
      f.condition = 'conflict';
    },
    (f: any) => {
      f.encounters[0].stage = 0;
    },
    (f: any) => {
      f.encounters.push({ stage: 2, kind: 'blackout' });
    },
    (f: any) => {
      f.events[0].relays = [1];
    },
    (f: any) => {
      f.events[1].relays = [5];
    },
    (f: any) => {
      f.events[0].caches = [1];
    },
    (f: any) => {
      f.events[0].relays = [1, 1];
    },
    (f: any) => {
      f.events[0].room = 2;
    },
    (f: any) => {
      f.events = null;
    },
  ]) {
    const broken = structuredClone(saved!);
    mutate(broken.factory);
    assert.equal(loadCheckpoint(broken), null);
  }
  assert.equal(loadCheckpoint({ ...saved, areaEvent: saved!.factory!.events[0] }), null);
  assert.equal(loadCheckpoint({ ...saved, courier: { stage: 5, status: 'pending' } }), null);
  assert.equal(
    loadCheckpoint({ ...saved, story: { kind: 'dispatch', stage: 1, recovered: false } }),
    null,
  );
});

test('legacy saves, legacy seed replays, test rooms, Workshop and Daily games retain their rules', () => {
  const seed = seedFor('power'),
    legacy: Checkpoint = { version: 6, seed, stage: 1, hp: 100, mods: [], kills: 0, elapsed: 0 };
  const g = new Game();
  g.start(seed, legacy);
  assert.equal(g.factory, null);
  assert.deepEqual(g.level, getLevel(seed, 1));
  g.start(seed, undefined, null, null, false, 0, false);
  assert.equal(g.factory, null);
  g.startTest(legacy);
  assert.equal(g.factory, null);
  g.startWorkshop([]);
  assert.equal(g.factory, null);
  for (const rules of [78, 79, 80, 81, 82, 83, 84, 85]) {
    const daily = dailyForDate('2026-10-01', rules)!;
    g.start(daily.seed);
    assert.equal(g.factory, null);
    assert.deepEqual(g.level, getLevel(daily.seed, 0));
    assert.equal(
      loadCheckpoint({ ...legacy, seed: daily.seed, factory: planFactory(daily.seed) }),
      null,
    );
  }
});

test('fresh random starts change condition while an explicit seed keeps its exact plan', () => {
  for (const condition of Object.keys(FACTORY_CONDITIONS) as FactoryCondition[]) {
    const seed = seedFor(condition),
      next = freshFactorySeed(() => seed, condition);
    assert.notEqual(planFactory(next).condition, condition);
    assert(next.length <= 40);
    assert.equal(
      freshFactorySeed(() => seed),
      seed,
    );
    assert.deepEqual(planFactory(seed), planFactory(seed));
  }
});

test('the opening power objective stays in sight and clear of terrain across seeded layouts', () => {
  for (let i = 0; i < 150; i++) {
    const seed = 'factory-placement-' + i;
    if (planFactory(seed).condition !== 'power') continue;
    const g = new Game();
    g.start(seed, {
      version: 6,
      seed,
      stage: 1,
      hp: 100,
      mods: [],
      kills: 0,
      elapsed: 0,
      factory: planFactory(seed),
    });
    const relay = g.enemies.find((enemy) => enemy.eventRole === 'relay')!;
    assert(relay && relay.body.position.x >= 200 && relay.body.position.x <= 700);
    assert.equal(Matter.Query.collides(relay.body, g.solidBodies).length, 0);
  }
});

test('progress backups preserve the exact factory plan and event claims', async () => {
  const g = room('power');
  clearPatrol(g);
  g.openReward();
  let saved: Checkpoint | undefined;
  g.onCheckpoint = (save) => {
    saved = save;
  };
  g.save();
  const memory = new Map<string, string>();
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
  };
  const store = new ProgressStore(() => storage);
  assert(await store.write(CHECKPOINT_KEY, saved));
  const backup = parseProgressBackup(store.backup('3.18.0'))!;
  assert(backup);
  const restored = new ProgressStore(() => ({
    getItem: () => null,
    setItem() {},
    removeItem() {},
  }));
  assert(await restored.restore(backup));
  assert.deepEqual((restored.snapshot()[CHECKPOINT_KEY] as Checkpoint).factory, saved!.factory);
});

test('both opening rewards and rerolls offer identity and power without duplicate or excluded cards', () => {
  for (let stage = 0; stage < 2; stage++)
    for (let i = 0; i < 300; i++) {
      const mods = stage ? ['magnum'] : [];
      const context = { stage, factory: true, seed: 'normal' };
      const offers = rewardMods(mods, 3, seeded('factory-offer-' + i), context);
      assert(offers.some((mod) => OPENING_IDENTITY_MODS.includes(mod.id)));
      if (!mods.length) assert(offers.some((mod) => OPENING_POWER_MODS.includes(mod.id)));
      assert.equal(new Set(offers.map((m) => m.id)).size, 3);
      const excluded = offers.map((m) => m.id);
      const reroll = rewardMods(mods, 3, seeded('factory-reroll-' + i), context, excluded);
      assert(reroll.some((mod) => OPENING_IDENTITY_MODS.includes(mod.id)));
      assert(reroll.every((mod) => !excluded.includes(mod.id)));
      for (const daily of ['RF-D78-2026-10-01', 'RF-D85-2026-10-01']) {
        assert.deepEqual(
          rewardMods(mods, 3, seeded('daily-' + i), { ...context, seed: daily }),
          rewardMods(mods, 3, seeded('daily-' + i), { stage, seed: daily }),
        );
      }
    }
});

test('recaps retain and display factory conditions, while legacy recaps remain loadable', () => {
  const g = room('freight');
  g.setMode('dead');
  const recap = snapshotRun(g, 'factory-recap', 1000)!;
  assert.equal(recap.factory, 'freight');
  assert(recapBody(recap, 0, []).includes('Freight surge'));
  assert.deepEqual(loadRunHistory([recap]), [recap]);
  const legacy = { ...recap };
  delete legacy.factory;
  delete legacy.factoryVersion;
  assert.equal(loadRunHistory([legacy]).length, 1);
  assert.equal(loadRunHistory([{ ...recap, factory: 'power' }]).length, 0);
});

for (const condition of Object.keys(FACTORY_CONDITIONS) as FactoryCondition[]) {
  test(condition + ' opening signature clears with the starting gun and ordinary inputs', () => {
    const g = room(condition);
    const result = playRoom(g, 90);
    assert(g.clear && g.hp > 0, JSON.stringify(result));
    if (condition === 'power') assert(g.areaEvents.powered);
    if (condition === 'conflict') assert(g.areaEvents.cacheReady);
  });
  test(condition + ' later signature clears with the starting gun and ordinary inputs', () => {
    const g = room(condition, 5);
    if (condition === 'freight') {
      for (let frame = 0; frame < 120 * 60 && g.mode === 'playing'; frame++)
        g.tick(1 / 60, freightPilot(g));
      assert.equal(g.mode, 'upgrade');
    } else {
      const result = playRoom(g, 90);
      assert(g.clear && g.hp > 0, JSON.stringify(result));
    }
  });
  test(
    condition + ' campaign reaches extraction with actual upgrade choices and planned encounters',
    (t) => {
      const oldRandom = Math.random;
      Math.random = seeded('factory-campaign-' + condition);
      t.after(() => {
        Math.random = oldRandom;
      });
      const common = Matter.Common as typeof Matter.Common & { _nextId: number; _seed: number };
      common._nextId = common._seed = 0;
      const g = new Game();
      g.start(condition === 'conflict' ? 'NRW1FY' : seedFor(condition));
      const priorities = [
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
        'spoof',
        'standing-orders',
        'priority-target',
        'deadeye',
        'execute',
        'fracture',
        'banker',
        'capacitor',
        'reserve-cell',
        'rail-spike',
      ];
      const encounters = new Set<number>();
      let saved: Checkpoint | undefined;
      g.onCheckpoint = (checkpoint) => {
        saved = checkpoint;
        if (checkpoint)
          assert(
            loadCheckpoint(checkpoint),
            JSON.stringify({ stage: checkpoint.stage, reward: !!checkpoint.reward }),
          );
      };
      const result = playCampaign(g, {
        pathMods: [],
        seconds: 1000,
        ...(condition === 'freight' ? { region: 'annex' as const } : {}),
        chooseUpgrade: () => {
          assert.equal(g.offers.length, 3);
          return priorities.find((id) => g.offers.some((mod) => mod.id === id)) ?? g.offers[0].id;
        },
        beforeInput: () => {
          if (factoryEncounter(g.factory, g.stage)) encounters.add(g.stage);
          return undefined;
        },
      });
      assert.equal(
        g.mode,
        'won',
        JSON.stringify({ stage: g.stage, hp: g.hp, cause: g.deathCause }),
      );
      assert(result.escapeSeen);
      assert(encounters.has(1) && encounters.has(5));
      assert(g.hp > 0);
      t.diagnostic(
        JSON.stringify({ condition, hp: g.hp, time: g.time, encounters: [...encounters] }),
      );
    },
  );
}
